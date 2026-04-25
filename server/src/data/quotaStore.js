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

function getDailyUserRecord(db, email, dayKey) {
  if (!db.users[email]) {
    db.users[email] = {};
  }

  if (!db.users[email][dayKey]) {
    db.users[email][dayKey] = { writes: 0, updatedAt: new Date().toISOString() };
  }

  return db.users[email][dayKey];
}

export function getUserQuotaUsage({ email, day }) {
  const db = readQuotaDb();
  const dayKey = getDayKey(day);
  const daily = db.users[email]?.[dayKey];

  return {
    email,
    day: dayKey,
    writes: Number(daily?.writes || 0),
  };
}

export function consumeUserWriteQuota({ email, limit, day }) {
  const db = readQuotaDb();
  const dayKey = getDayKey(day);
  const daily = getDailyUserRecord(db, email, dayKey);
  const writes = Number(daily.writes || 0);

  if (writes >= limit) {
    return {
      allowed: false,
      email,
      day: dayKey,
      used: writes,
      remaining: 0,
      limit,
    };
  }

  const nextWrites = writes + 1;
  daily.writes = nextWrites;
  daily.updatedAt = new Date().toISOString();
  writeQuotaDb(db);

  return {
    allowed: true,
    email,
    day: dayKey,
    used: nextWrites,
    remaining: Math.max(0, limit - nextWrites),
    limit,
  };
}