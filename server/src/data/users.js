import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.resolve(__dirname, '../../storage');
const usersFilePath = path.join(storageDir, 'users-db.json');

const ROLE_DEFAULT_PERMISSIONS = {
  admin: { read: true, write: true, export: true, dashboard: true, viewOnly: false },
  manager: { read: true, write: true, export: true, dashboard: true, viewOnly: false },
  user: { read: true, write: false, export: false, dashboard: false, viewOnly: true },
};

const DEFAULT_QUOTA = {
  dailyWriteLimit: 50,
  monthlyWriteLimit: 1000,
  totalWriteLimit: 10000,
  testWriteLimit: 100,
  liveWriteLimit: 10000,
};

const SUPPORTED_DATABASES = ['MEN_MATERIAL', 'LACE_GAYLE'];

function normalizeDatabases(databases) {
  if (!Array.isArray(databases)) return [];
  return databases.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeViews(views) {
  if (!Array.isArray(views)) return [];
  return views.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeColumns(columns) {
  if (!Array.isArray(columns)) return [];
  const seen = new Set();
  const out = [];

  for (const col of columns) {
    const value = String(col || '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }

  return out;
}

function normalizeAllowedColumns(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const out = {};
  for (const database of SUPPORTED_DATABASES) {
    if (Object.hasOwn(input, database)) {
      out[database] = normalizeColumns(input[database]);
    }
  }

  return out;
}

function normalizeAllowedColumnsByView(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const out = {};
  for (const [viewName, columns] of Object.entries(input)) {
    const safeView = String(viewName || '').trim();
    if (!safeView) continue;
    out[safeView] = normalizeColumns(columns);
  }

  return out;
}

function sanitizeQuotaValue(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function defaultPermissionsForRole(role) {
  const safeRole = ROLE_DEFAULT_PERMISSIONS[role] ? role : 'user';
  return { ...ROLE_DEFAULT_PERMISSIONS[safeRole] };
}

function normalizePermissions(role, inputPermissions) {
  const defaults = defaultPermissionsForRole(role);
  const source = inputPermissions && typeof inputPermissions === 'object' ? inputPermissions : {};

  return {
    read: typeof source.read === 'boolean' ? source.read : defaults.read,
    write: typeof source.write === 'boolean' ? source.write : defaults.write,
    export: typeof source.export === 'boolean' ? source.export : defaults.export,
    dashboard: typeof source.dashboard === 'boolean' ? source.dashboard : defaults.dashboard,
    viewOnly: typeof source.viewOnly === 'boolean' ? source.viewOnly : defaults.viewOnly,
  };
}

function normalizeQuota(inputQuota) {
  const source = inputQuota && typeof inputQuota === 'object' ? inputQuota : {};
  return {
    dailyWriteLimit: sanitizeQuotaValue(source.dailyWriteLimit, DEFAULT_QUOTA.dailyWriteLimit),
    monthlyWriteLimit: sanitizeQuotaValue(source.monthlyWriteLimit, DEFAULT_QUOTA.monthlyWriteLimit),
    totalWriteLimit: sanitizeQuotaValue(source.totalWriteLimit, DEFAULT_QUOTA.totalWriteLimit),
    testWriteLimit: sanitizeQuotaValue(source.testWriteLimit, DEFAULT_QUOTA.testWriteLimit),
    liveWriteLimit: sanitizeQuotaValue(source.liveWriteLimit, DEFAULT_QUOTA.liveWriteLimit),
  };
}

function normalizeUserRecord(record) {
  const role = String(record?.role || 'user').trim() || 'user';

  return {
    ...record,
    role,
    databases: normalizeDatabases(record?.databases),
    views: normalizeViews(record?.views),
    permissions: normalizePermissions(role, record?.permissions),
    quota: normalizeQuota(record?.quota),
    allowedColumns: normalizeAllowedColumns(record?.allowedColumns),
    allowedColumnsByView: normalizeAllowedColumnsByView(record?.allowedColumnsByView),
    disabled: Boolean(record?.disabled),
  };
}

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
      permissions: defaultPermissionsForRole('admin'),
      quota: normalizeQuota(),
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
    users = db.users.map(normalizeUserRecord);
    writeUsersDb(users);
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
    databases: normalizeDatabases(input.databases),
    views: normalizeViews(input.views),
    permissions: normalizePermissions(input.role || 'user', input.permissions),
    quota: normalizeQuota(input.quota),
    allowedColumns: normalizeAllowedColumns(input.allowedColumns),
    allowedColumnsByView: normalizeAllowedColumnsByView(input.allowedColumnsByView),
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

  if (payload.databases !== undefined) user.databases = normalizeDatabases(payload.databases);
  if (payload.views !== undefined) user.views = normalizeViews(payload.views);
  if (payload.role !== undefined) {
    user.role = payload.role;
    user.permissions = normalizePermissions(user.role, user.permissions);
  }
  if (payload.permissions !== undefined) {
    user.permissions = normalizePermissions(user.role, payload.permissions);
  }
  if (payload.quota !== undefined) {
    user.quota = normalizeQuota(payload.quota);
  }
  if (payload.allowedColumns !== undefined) {
    user.allowedColumns = normalizeAllowedColumns(payload.allowedColumns);
  }
  if (payload.allowedColumnsByView !== undefined) {
    user.allowedColumnsByView = normalizeAllowedColumnsByView(payload.allowedColumnsByView);
  }

  writeUsersDb(users);
  return sanitizeUser(user);
}

export function updateUser(email, payload) {
  return assignView(email, payload);
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

  user.quota = normalizeQuota(quotaData);
  writeUsersDb(users);
  return sanitizeUser(user);
}
