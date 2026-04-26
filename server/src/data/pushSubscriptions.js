import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.resolve(__dirname, '../../storage');
const dbPath = path.join(storageDir, 'push-subscriptions.json');

function readDb() {
  if (!fs.existsSync(dbPath)) {
    return { subscriptions: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    return { subscriptions: [] };
  }
}

function writeDb(db) {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
}

export function saveSubscription({ email, role, subscription }) {
  const db = readDb();
  const endpoint = subscription?.endpoint;
  if (!endpoint) return;

  const existing = db.subscriptions.findIndex((s) => s.endpoint === endpoint);
  const record = {
    email,
    role,
    endpoint,
    keys: subscription.keys,
    subscribedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };

  if (existing >= 0) {
    db.subscriptions[existing] = { ...db.subscriptions[existing], ...record };
  } else {
    db.subscriptions.push(record);
  }

  writeDb(db);
}

export function removeSubscription(endpoint) {
  const db = readDb();
  db.subscriptions = db.subscriptions.filter((s) => s.endpoint !== endpoint);
  writeDb(db);
}

export function removeExpiredSubscriptions(endpoints = []) {
  const db = readDb();
  const before = db.subscriptions.length;
  db.subscriptions = db.subscriptions.filter((s) => !endpoints.includes(s.endpoint));
  writeDb(db);
  return before - db.subscriptions.length;
}

export function getAllSubscriptions() {
  return readDb().subscriptions;
}

export function getSubscriptionsByEmail(email) {
  return readDb().subscriptions.filter(
    (s) => s.email.toLowerCase() === email.toLowerCase(),
  );
}

export function getSubscriptionsByRole(role) {
  return readDb().subscriptions.filter(
    (s) => s.role === role,
  );
}

export function getSubscriptionsByEmails(emails) {
  const set = new Set(emails.map((e) => e.toLowerCase()));
  return readDb().subscriptions.filter((s) => set.has(s.email.toLowerCase()));
}

export function touchSubscription(endpoint) {
  const db = readDb();
  const sub = db.subscriptions.find((s) => s.endpoint === endpoint);
  if (sub) {
    sub.lastSeen = new Date().toISOString();
    writeDb(db);
  }
}
