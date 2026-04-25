import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.resolve(__dirname, '../../storage');
const reportFilePath = path.join(storageDir, 'daily-audit-reports.json');

function ensureStorageDir() {
  fs.mkdirSync(storageDir, { recursive: true });
}

function readReportsDb() {
  ensureStorageDir();
  if (!fs.existsSync(reportFilePath)) {
    return { days: {} };
  }

  try {
    const raw = fs.readFileSync(reportFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { days: {} };
    }

    return {
      days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
    };
  } catch {
    return { days: {} };
  }
}

function writeReportsDb(db) {
  ensureStorageDir();
  fs.writeFileSync(reportFilePath, JSON.stringify(db, null, 2), 'utf8');
}

function normalizeDay(value) {
  return String(value || new Date().toISOString()).slice(0, 10);
}

function ensureDay(db, day) {
  if (!db.days[day]) {
    db.days[day] = {
      day,
      totalEvents: 0,
      actions: {},
      actors: {},
      writeSuccess: 0,
      writeBlocked: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  return db.days[day];
}

export function recordAuditEventForDailyReport(event) {
  const db = readReportsDb();
  const day = normalizeDay(event?.at);
  const bucket = ensureDay(db, day);
  const action = String(event?.action || 'unknown');
  const actor = String(event?.actor || 'unknown');

  bucket.totalEvents += 1;
  bucket.actions[action] = Number(bucket.actions[action] || 0) + 1;
  bucket.actors[actor] = Number(bucket.actors[actor] || 0) + 1;

  if (action === 'data.save_entry.write.success') {
    bucket.writeSuccess += 1;
  }

  if (action === 'data.save_entry.write.blocked') {
    bucket.writeBlocked += 1;
  }

  bucket.updatedAt = new Date().toISOString();
  writeReportsDb(db);
}

export function getDailyAuditReport(day) {
  const db = readReportsDb();
  const dayKey = normalizeDay(day);
  const report = db.days[dayKey];

  if (!report) {
    return {
      day: dayKey,
      totalEvents: 0,
      actions: {},
      actors: {},
      writeSuccess: 0,
      writeBlocked: 0,
      updatedAt: null,
    };
  }

  return report;
}

export function listDailyAuditReports(limit = 7) {
  const db = readReportsDb();
  const safeLimit = Math.max(1, Math.min(90, Number(limit) || 7));

  return Object.values(db.days)
    .sort((a, b) => String(b.day).localeCompare(String(a.day)))
    .slice(0, safeLimit);
}