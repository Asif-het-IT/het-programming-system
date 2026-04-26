import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.resolve(__dirname, '../../storage');
const quotaFilePath = path.join(storageDir, 'quota-db.json');

function ensureStorageDir() {
  fs.mkdirSync(storageDir, { recursive: true });
}

function readQuotaDb() {
  ensureStorageDir();
  if (!fs.existsSync(quotaFilePath)) {
    return { users: {} };
  }

  try {
    const raw = fs.readFileSync(quotaFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { users: {} };
    }

    return {
      users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
    };
  } catch {
    return { users: {} };
  }
}

function writeQuotaDb(db) {
  ensureStorageDir();
  fs.writeFileSync(quotaFilePath, JSON.stringify(db, null, 2), 'utf8');
}

function getDayKey(inputDate) {
  if (inputDate) {
    return String(inputDate).slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function getMonthKey(inputDate) {
  return getDayKey(inputDate).slice(0, 7);
}

function buildInitialUsage(dayKey, monthKey) {
  return {
    daily: {},
    monthly: {},
    total: 0,
    testWrites: 0,
    liveWrites: 0,
    updatedAt: new Date().toISOString(),
    lastDayKey: dayKey,
    lastMonthKey: monthKey,
  };
}

function isLegacyDailyMap(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return false;
  }

  const values = Object.values(entry);
  return values.length > 0 && values.every((value) => value && typeof value === 'object' && !Array.isArray(value) && 'writes' in value);
}

function normalizeUserUsage(entry, dayKey, monthKey) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return buildInitialUsage(dayKey, monthKey);
  }

  if (isLegacyDailyMap(entry)) {
    const daily = {};
    let total = 0;
    for (const [key, value] of Object.entries(entry)) {
      const writes = Number(value?.writes || 0);
      daily[key] = writes;
      total += writes;
    }

    const monthly = {};
    for (const [key, writes] of Object.entries(daily)) {
      const month = String(key).slice(0, 7);
      monthly[month] = Number(monthly[month] || 0) + Number(writes || 0);
    }

    return {
      daily,
      monthly,
      total,
      testWrites: 0,
      liveWrites: total,
      updatedAt: new Date().toISOString(),
      lastDayKey: dayKey,
      lastMonthKey: monthKey,
    };
  }

  return {
    daily: entry.daily && typeof entry.daily === 'object' ? entry.daily : {},
    monthly: entry.monthly && typeof entry.monthly === 'object' ? entry.monthly : {},
    total: Number(entry.total || 0),
    testWrites: Number(entry.testWrites || 0),
    liveWrites: Number(entry.liveWrites || 0),
    updatedAt: entry.updatedAt || new Date().toISOString(),
    lastDayKey: entry.lastDayKey || dayKey,
    lastMonthKey: entry.lastMonthKey || monthKey,
  };
}

function getUserRecord(db, email, dayKey, monthKey) {
  if (!db.users[email]) {
    db.users[email] = buildInitialUsage(dayKey, monthKey);
  }

  db.users[email] = normalizeUserUsage(db.users[email], dayKey, monthKey);

  return db.users[email];
}

export function getUserQuotaUsage({ email, day }) {
  const db = readQuotaDb();
  const dayKey = getDayKey(day);
  const monthKey = getMonthKey(day);
  const record = normalizeUserUsage(db.users[email], dayKey, monthKey);

  return {
    email,
    day: dayKey,
    month: monthKey,
    writes: Number(record.daily[dayKey] || 0),
    dailyWrites: Number(record.daily[dayKey] || 0),
    monthlyWrites: Number(record.monthly[monthKey] || 0),
    totalWrites: Number(record.total || 0),
    testWrites: Number(record.testWrites || 0),
    liveWrites: Number(record.liveWrites || 0),
  };
}

function normalizeLimit(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildDeniedResult({ reason, email, dayKey, monthKey, used, limit }) {
  return {
    allowed: false,
    reason,
    email,
    day: dayKey,
    month: monthKey,
    used,
    limit,
  };
}

function getRemainingByType(writeType, testWriteLimit, liveWriteLimit, nextTest, nextLive) {
  if (writeType === 'test') {
    return testWriteLimit === null ? null : Math.max(0, testWriteLimit - nextTest);
  }
  return liveWriteLimit === null ? null : Math.max(0, liveWriteLimit - nextLive);
}

export function consumeUserWriteQuota({ email, limits = {}, writeType = 'live', day }) {
  const db = readQuotaDb();
  const dayKey = getDayKey(day);
  const monthKey = getMonthKey(day);
  const record = getUserRecord(db, email, dayKey, monthKey);

  const currentDaily = Number(record.daily[dayKey] || 0);
  const currentMonthly = Number(record.monthly[monthKey] || 0);
  const currentTotal = Number(record.total || 0);
  const currentTest = Number(record.testWrites || 0);
  const currentLive = Number(record.liveWrites || 0);

  const dailyWriteLimit = normalizeLimit(limits.dailyWriteLimit);
  const monthlyWriteLimit = normalizeLimit(limits.monthlyWriteLimit);
  const totalWriteLimit = normalizeLimit(limits.totalWriteLimit);
  const testWriteLimit = normalizeLimit(limits.testWriteLimit);
  const liveWriteLimit = normalizeLimit(limits.liveWriteLimit);

  if (dailyWriteLimit !== null && currentDaily >= dailyWriteLimit) {
    return buildDeniedResult({
      reason: 'daily_limit_reached',
      email,
      dayKey,
      monthKey,
      used: currentDaily,
      limit: dailyWriteLimit,
    });
  }

  if (monthlyWriteLimit !== null && currentMonthly >= monthlyWriteLimit) {
    return buildDeniedResult({
      reason: 'monthly_limit_reached',
      email,
      dayKey,
      monthKey,
      used: currentMonthly,
      limit: monthlyWriteLimit,
    });
  }

  if (totalWriteLimit !== null && currentTotal >= totalWriteLimit) {
    return buildDeniedResult({
      reason: 'total_limit_reached',
      email,
      dayKey,
      monthKey,
      used: currentTotal,
      limit: totalWriteLimit,
    });
  }

  if (writeType === 'test' && testWriteLimit !== null && currentTest >= testWriteLimit) {
    return buildDeniedResult({
      reason: 'test_limit_reached',
      email,
      dayKey,
      monthKey,
      used: currentTest,
      limit: testWriteLimit,
    });
  }

  if (writeType === 'live' && liveWriteLimit !== null && currentLive >= liveWriteLimit) {
    return buildDeniedResult({
      reason: 'live_limit_reached',
      email,
      dayKey,
      monthKey,
      used: currentLive,
      limit: liveWriteLimit,
    });
  }

  const nextDaily = currentDaily + 1;
  const nextMonthly = currentMonthly + 1;
  const nextTotal = currentTotal + 1;
  const nextTest = writeType === 'test' ? currentTest + 1 : currentTest;
  const nextLive = writeType === 'live' ? currentLive + 1 : currentLive;

  record.daily[dayKey] = nextDaily;
  record.monthly[monthKey] = nextMonthly;
  record.total = nextTotal;
  record.testWrites = nextTest;
  record.liveWrites = nextLive;
  record.updatedAt = new Date().toISOString();
  record.lastDayKey = dayKey;
  record.lastMonthKey = monthKey;
  writeQuotaDb(db);

  return {
    allowed: true,
    email,
    day: dayKey,
    month: monthKey,
    writeType,
    dailyWrites: nextDaily,
    monthlyWrites: nextMonthly,
    totalWrites: nextTotal,
    testWrites: nextTest,
    liveWrites: nextLive,
    remainingDaily: dailyWriteLimit === null ? null : Math.max(0, dailyWriteLimit - nextDaily),
    remainingMonthly: monthlyWriteLimit === null ? null : Math.max(0, monthlyWriteLimit - nextMonthly),
    remainingTotal: totalWriteLimit === null ? null : Math.max(0, totalWriteLimit - nextTotal),
    remainingType: getRemainingByType(writeType, testWriteLimit, liveWriteLimit, nextTest, nextLive),
  };
}