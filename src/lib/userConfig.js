/**
 * User Configuration & View Mapping
 * Maps users to pre-defined views from viewConfig
 */

import viewConfigData from '@/config/viewConfig.json';
import { Logger } from '@/lib/logger';

const USERS_STORAGE_KEY = 'app_users';
const USER_SESSIONS_KEY = 'app_user_sessions';

export const DEFAULT_USERS = [
  { username: 'dua', password: 'dua123', viewNames: ['Dua View', 'Dua Trading & General Merchant Ltd - Gayle', 'Dua Trading & General Merchant Ltd - Lace'], role: 'user' },
  { username: 'fazal', password: 'fazal123', viewNames: ['Fazal View', 'Fazal Investment NIG Ltd - Gayle', 'Fazal Investment NIG Ltd - Lace'], role: 'user' },
  { username: 'sattar', password: 'sattar123', viewNames: ['Sattar View', 'ETS Sattar - Gayle', 'ETS Sattar - Lace'], role: 'user' },
  { username: 'noor', password: 'noor123', viewNames: ['Noor View', 'Noor Import & Export Ltd - Gayle', 'Noor Import & Export Ltd - Lace'], role: 'user' },
  { username: 'admin', password: 'admin123', viewNames: [], role: 'admin' }
];

export function initializeUsers() {
  const existing = localStorage.getItem(USERS_STORAGE_KEY);
  if (!existing) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
    Logger.info('Default users initialized');
  }
}

export function getStoredUsers() {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_USERS;
  } catch (err) {
    Logger.error('Failed to load users', err);
    return DEFAULT_USERS;
  }
}

export function findUserByUsername(username) {
  const users = getStoredUsers();
  return users.find(u => u.username === username);
}

export function getUserViews(user) {
  if (!user) return [];
  if (user.role === 'admin') {
    return getAllViews();
  }

  const userViewNames = user.viewNames || [];
  if (userViewNames.length === 0) return [];

  return getAllViews().filter(v => userViewNames.includes(v.viewName));
}

export function getAllViews() {
  const allViews = [
    ...viewConfigData.menMaterial,
    ...viewConfigData.laceGayle
  ];
  return allViews;
}

export function getViewByName(viewName) {
  const allViews = getAllViews();
  return allViews.find(v => v.viewName === viewName);
}

export function getViewsByDatabase(database) {
  const allViews = getAllViews();
  return allViews.filter(v => v.database === database);
}

export function saveSessions(sessions) {
  try {
    localStorage.setItem(USER_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (err) {
    Logger.warn('Failed to save user session', err);
  }
}

export function loadSessions() {
  try {
    const stored = localStorage.getItem(USER_SESSIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (err) {
    Logger.warn('Failed to load sessions', err);
    return {};
  }
}

export function createSession(username, viewName) {
  const sessions = loadSessions();
  sessions[username] = {
    username,
    viewName,
    timestamp: Date.now()
  };
  saveSessions(sessions);
  return sessions[username];
}

export function getSession(username) {
  const sessions = loadSessions();
  return sessions[username] || null;
}

export function clearSession(username) {
  const sessions = loadSessions();
  delete sessions[username];
  saveSessions(sessions);
}

export function clearAllSessions() {
  localStorage.removeItem(USER_SESSIONS_KEY);
}

export function addUser(username, password, viewNames = [], role = 'user') {
  const users = getStoredUsers();
  if (users.some(u => u.username === username)) {
    throw new Error('Username already exists');
  }

  const newUser = {
    username,
    password,
    viewNames,
    role,
    created_date: new Date().toISOString()
  };

  users.push(newUser);
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  Logger.info('User added', { username, role });

  return newUser;
}

export function deleteUser(username) {
  const users = getStoredUsers();
  const filtered = users.filter(u => u.username !== username);

  if (filtered.length === users.length) {
    throw new Error('User not found');
  }

  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
  Logger.info('User deleted', { username });
}

export function updateUserViews(username, viewNames) {
  const users = getStoredUsers();
  const user = users.find(u => u.username === username);

  if (!user) {
    throw new Error('User not found');
  }

  user.viewNames = viewNames;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  Logger.info('User views updated', { username, viewCount: viewNames.length });

  return user;
}

initializeUsers();
