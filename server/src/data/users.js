import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.resolve(__dirname, '../../storage');
const usersFilePath = path.join(storageDir, 'users-db.json');

function getBootstrapUsers() {
  const email = String(env.bootstrapAdminEmail || '').trim();
  const password = String(env.bootstrapAdminPassword || '').trim();

  if (!email || !password) {
    return [];
  }

  return [
    {
      id: 'u_admin',
      email,
      password,
      role: 'admin',
      databases: ['MEN_MATERIAL', 'LACE_GAYLE'],
      views: ['*'],
      disabled: false,
    },
  ];
}

// ---------- Persistence helpers ----------

function ensureStorageDir() {
  fs.mkdirSync(storageDir, { recursive: true });
}

function readUsersDb() {
  ensureStorageDir();
  if (!fs.existsSync(usersFilePath)) return { users: [] };
  try {
    const raw = fs.readFileSync(usersFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.users)) return parsed;
  } catch {
    // corrupt file — start fresh
  }
  return { users: [] };
}

function writeUsersDb(usersList) {
  ensureStorageDir();
  const safe = usersList.map(({ passwordHash, ...rest }) => ({ ...rest, passwordHash }));
  fs.writeFileSync(usersFilePath, JSON.stringify({ users: safe }, null, 2), 'utf8');
}

// ---------- In-memory state (loaded from / flushed to JSON) ----------

let users = [];
const refreshTokenStore = new Map();
let initialized = false;

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function initUsers() {
  if (initialized) return;

  const db = readUsersDb();

  if (db.users.length === 0) {
    const bootstrapUsers = getBootstrapUsers();
    for (const seed of bootstrapUsers) {
      const hash = await bcrypt.hash(seed.password, 10);
      users.push({ ...seed, password: undefined, passwordHash: hash });
    }
    if (users.length > 0) {
      writeUsersDb(users);
    }
  } else {
    users = db.users;
  }

  initialized = true;
}

export function listUsers() {
  return users.map(sanitizeUser);
}

export function findByEmail(email) {
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function verifyCredentials(email, password) {
  const user = findByEmail(email);
  if (!user || user.disabled) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return sanitizeUser(user);
}

export function upsertRefreshToken(userId, token) {
  refreshTokenStore.set(userId, token);
}

export function hasRefreshToken(userId, token) {
  return refreshTokenStore.get(userId) === token;
}

export function clearRefreshToken(userId) {
  refreshTokenStore.delete(userId);
}

export function createUser(input) {
  const exists = users.some((u) => u.email.toLowerCase() === input.email.toLowerCase());
  if (exists) throw new Error('Email already exists');

  const user = {
    id: `u_${Date.now()}`,
    email: input.email,
    role: input.role || 'user',
    databases: input.databases || [],
    views: input.views || [],
    disabled: false,
    passwordHash: bcrypt.hashSync(input.password, 10),
  };

  users.push(user);
  writeUsersDb(users);
  return sanitizeUser(user);
}

export function assignView(email, payload) {
  const user = findByEmail(email);
  if (!user) throw new Error('User not found');

  if (payload.databases !== undefined) user.databases = payload.databases;
  if (payload.views !== undefined) user.views = payload.views;
  if (payload.role !== undefined) user.role = payload.role;

  writeUsersDb(users);
  return sanitizeUser(user);
}

export function deleteUser(email) {
  const index = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (index === -1) throw new Error('User not found');
  if (users[index].role === 'admin') throw new Error('Admin account cannot be deleted');

  const [removed] = users.splice(index, 1);
  clearRefreshToken(removed.id);
  writeUsersDb(users);
  return sanitizeUser(removed);
}

export function setUserStatus(email, enabled) {
  const user = findByEmail(email);
  if (!user) throw new Error('User not found');
  if (user.role === 'admin' && !enabled) throw new Error('Admin account cannot be disabled');

  user.disabled = !enabled;
  clearRefreshToken(user.id);
  writeUsersDb(users);
  return sanitizeUser(user);
}

export function resetUserPassword(email, nextPassword) {
  const user = findByEmail(email);
  if (!user) throw new Error('User not found');

  user.passwordHash = bcrypt.hashSync(nextPassword, 10);
  clearRefreshToken(user.id);
  writeUsersDb(users);
  return sanitizeUser(user);
}

export function updateUserQuota(email, quotaData) {
  const user = findByEmail(email);
  if (!user) throw new Error('User not found');

  user.quota = quotaData;
  writeUsersDb(users);
  return sanitizeUser(user);
}
