import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.resolve(__dirname, '../../storage');
const logPath = path.join(storageDir, 'notification-log.json');

function readLog() {
  if (!fs.existsSync(logPath)) {
    return { entries: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(logPath, 'utf8'));
  } catch {
    return { entries: [] };
  }
}

function writeLog(db) {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  fs.writeFileSync(logPath, JSON.stringify(db, null, 2), 'utf8');
}

export function logNotification({ actor, target, title, body, priority, type, recipientCount, delivered, failed }) {
  const db = readLog();
  db.entries.unshift({
    id: `notif_${Date.now()}`,
    sentAt: new Date().toISOString(),
    actor,
    target,
    title,
    body,
    priority: priority || 'normal',
    type: type || 'admin_announcement',
    recipientCount: recipientCount || 0,
    delivered: delivered || 0,
    failed: failed || 0,
  });

  // keep last 500 entries
  if (db.entries.length > 500) {
    db.entries = db.entries.slice(0, 500);
  }

  writeLog(db);
}

export function getNotificationLogs(limit = 50) {
  const db = readLog();
  return db.entries.slice(0, limit);
}
