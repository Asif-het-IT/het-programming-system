import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.resolve(__dirname, '../../storage');
const registryFilePath = path.join(storageDir, 'database-registry.json');

const LEGACY_DATABASES = [
  {
    name: 'MEN_MATERIAL',
    type: 'legacy',
    active: true,
    sheetName: 'Database',
    dataRange: 'A:AZ',
    primaryKey: 'ENTRY_ID',
  },
  {
    name: 'LACE_GAYLE',
    type: 'legacy',
    active: true,
    sheetName: 'Database',
    dataRange: 'A:AZ',
    primaryKey: 'ENTRY_ID',
  },
];

function ensureStorageDir() {
  fs.mkdirSync(storageDir, { recursive: true });
}

function normalizeName(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeId(value) {
  return String(value || '').trim();
}

function makeRandomId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeLegacyId(name) {
  return `legacy_${String(name || '').trim().toLowerCase()}`;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeDataRange(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return 'A:AZ';
  return /^[A-Z]+:[A-Z]+$/.test(raw) ? raw : 'A:AZ';
}

function normalizeArray(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const safe = normalizeString(value);
    if (!safe) continue;
    const key = safe.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(safe);
  }
  return out;
}

function normalizeFilterRule(rule) {
  const column = normalizeString(rule?.column);
  const operator = normalizeString(rule?.operator || '=').toLowerCase();
  const value = normalizeString(rule?.value);

  return {
    column,
    operator: ['=', 'contains', '>', '<'].includes(operator) ? operator : '=',
    value,
  };
}

function normalizeDatabase(input) {
  const name = normalizeName(input?.name);
  const type = normalizeString(input?.type || 'custom') === 'legacy' ? 'legacy' : 'custom';

  return {
    id: normalizeId(input?.id) || (type === 'legacy' ? makeLegacyId(name) : makeRandomId('db')),
    name,
    displayName: normalizeString(input?.displayName || name),
    type,
    sheetIdOrUrl: normalizeString(input?.sheetIdOrUrl),
    sheetName: normalizeString(input?.sheetName || 'Database'),
    dataRange: normalizeDataRange(input?.dataRange || 'A:AZ'),
    primaryKey: normalizeString(input?.primaryKey),
    active: input?.active !== false,
    bridgeUrl: normalizeString(input?.bridgeUrl),
    apiToken: normalizeString(input?.apiToken),
    hiddenColumns: normalizeArray(input?.hiddenColumns),
    createdAt: input?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeView(input) {
  return {
    id: normalizeString(input?.id) || `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    viewName: normalizeString(input?.viewName),
    database: normalizeName(input?.database),
    selectedColumns: normalizeArray(input?.selectedColumns),
    filterRules: (Array.isArray(input?.filterRules) ? input.filterRules : [])
      .map(normalizeFilterRule)
      .filter((rule) => rule.column && rule.value),
    sort: {
      column: normalizeString(input?.sort?.column),
      direction: normalizeString(input?.sort?.direction || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc',
    },
    active: input?.active !== false,
    createdAt: input?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function readRegistry() {
  ensureStorageDir();
  if (!fs.existsSync(registryFilePath)) {
    return {
      databases: LEGACY_DATABASES.map((db) => normalizeDatabase(db)),
      views: [],
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(registryFilePath, 'utf8'));
    const databases = Array.isArray(parsed?.databases) ? parsed.databases.map(normalizeDatabase) : [];
    const views = Array.isArray(parsed?.views) ? parsed.views.map(normalizeView) : [];

    for (const legacyDb of LEGACY_DATABASES) {
      const legacyName = normalizeName(legacyDb.name);
      if (!databases.some((db) => db.name === legacyName)) {
        databases.push(normalizeDatabase(legacyDb));
      }
    }

    return { databases, views };
  } catch {
    return {
      databases: LEGACY_DATABASES.map((db) => normalizeDatabase(db)),
      views: [],
    };
  }
}

function writeRegistry(state) {
  ensureStorageDir();
  fs.writeFileSync(registryFilePath, JSON.stringify(state, null, 2), 'utf8');
}

let registry = readRegistry();
writeRegistry(registry);

export function listDatabases({ includeInactive = true } = {}) {
  const databases = includeInactive
    ? registry.databases
    : registry.databases.filter((db) => db.active);
  return databases.map((db) => ({ ...db, apiToken: db.apiToken ? '***' : '' }));
}

export function getDatabaseById(id) {
  const normalized = normalizeId(id);
  return registry.databases.find((db) => db.id === normalized) || null;
}

export function getDatabaseByName(name) {
  const normalized = normalizeName(name);
  return registry.databases.find((db) => db.name === normalized) || null;
}

export function createDatabase(input) {
  const next = normalizeDatabase(input);
  if (!next.name) throw new Error('Database name is required');
  if (!next.id) throw new Error('Database id generation failed');
  if (registry.databases.some((db) => db.id === next.id)) {
    throw new Error('Database id already exists');
  }
  if (registry.databases.some((db) => db.name === next.name)) {
    throw new Error('Database already exists');
  }
  registry.databases.push(next);
  writeRegistry(registry);
  return { ...next, apiToken: next.apiToken ? '***' : '' };
}

export function updateDatabase(name, input) {
  const normalized = normalizeName(name);
  const index = registry.databases.findIndex((db) => db.name === normalized);
  if (index === -1) throw new Error('Database not found');

  const current = registry.databases[index];
  const candidate = normalizeDatabase({ ...current, ...input, name: normalized, type: current.type });
  candidate.createdAt = current.createdAt;
  registry.databases[index] = candidate;
  writeRegistry(registry);
  return { ...candidate, apiToken: candidate.apiToken ? '***' : '' };
}

export function updateDatabaseById(id, input) {
  const normalizedId = normalizeId(id);
  const index = registry.databases.findIndex((db) => db.id === normalizedId);
  if (index === -1) throw new Error('Database not found');

  const current = registry.databases[index];
  const requestedName = input?.name ? normalizeName(input.name) : current.name;
  if (!requestedName) throw new Error('Database name is required');

  if (current.type === 'legacy' && requestedName !== current.name) {
    throw new Error('Legacy database names cannot be changed');
  }

  const duplicateName = registry.databases.some((item, idx) => idx !== index && item.name === requestedName);
  if (duplicateName) throw new Error('Database name already exists');

  const candidate = normalizeDatabase({
    ...current,
    ...input,
    id: current.id,
    name: requestedName,
    type: current.type,
  });
  candidate.createdAt = current.createdAt;

  // If database name changed, cascade update linked views.
  if (candidate.name !== current.name) {
    registry.views = registry.views.map((view) => (
      view.database === current.name
        ? {
          ...view,
          database: candidate.name,
          updatedAt: new Date().toISOString(),
        }
        : view
    ));
  }

  registry.databases[index] = candidate;
  writeRegistry(registry);
  return { ...candidate, apiToken: candidate.apiToken ? '***' : '' };
}

export function deleteDatabase(name) {
  const normalized = normalizeName(name);
  const db = getDatabaseByName(normalized);
  if (!db) throw new Error('Database not found');
  if (db.type === 'legacy') throw new Error('Legacy databases cannot be deleted');

  registry.databases = registry.databases.filter((item) => item.name !== normalized);
  registry.views = registry.views.filter((view) => view.database !== normalized);
  writeRegistry(registry);
  return { ...db, apiToken: db.apiToken ? '***' : '' };
}

export function deleteDatabaseById(id) {
  const normalizedId = normalizeId(id);
  const db = getDatabaseById(normalizedId);
  if (!db) throw new Error('Database not found');
  if (db.type === 'legacy') throw new Error('Legacy databases cannot be deleted');

  registry.databases = registry.databases.filter((item) => item.id !== normalizedId);
  registry.views = registry.views.filter((view) => view.database !== db.name);
  writeRegistry(registry);
  return { ...db, apiToken: db.apiToken ? '***' : '' };
}

export function listViews({ includeInactive = true, database } = {}) {
  const dbName = database ? normalizeName(database) : null;
  const base = registry.views.filter((view) => {
    if (!includeInactive && !view.active) return false;
    if (dbName && view.database !== dbName) return false;
    return true;
  });
  return base.map((view) => ({ ...view }));
}

export function getViewByName(database, viewName) {
  const db = normalizeName(database);
  const target = normalizeString(viewName);
  return registry.views.find((view) => view.database === db && view.viewName === target) || null;
}

export function createView(input) {
  const next = normalizeView(input);
  if (!next.database) throw new Error('Database is required');
  if (!next.viewName) throw new Error('View name is required');

  const database = getDatabaseByName(next.database);
  if (!database?.active) throw new Error('Database not available');

  if (registry.views.some((view) => view.database === next.database && view.viewName.toLowerCase() === next.viewName.toLowerCase())) {
    throw new Error('View already exists for this database');
  }

  registry.views.push(next);
  writeRegistry(registry);
  return { ...next };
}

export function updateView(id, input) {
  const viewId = normalizeString(id);
  const index = registry.views.findIndex((view) => view.id === viewId);
  if (index === -1) throw new Error('View not found');

  const current = registry.views[index];
  const candidate = normalizeView({ ...current, ...input, id: current.id, database: current.database });
  candidate.createdAt = current.createdAt;

  if (!candidate.viewName) throw new Error('View name is required');
  const duplicate = registry.views.some((item) => item.id !== viewId && item.database === current.database && item.viewName.toLowerCase() === candidate.viewName.toLowerCase());
  if (duplicate) throw new Error('View already exists for this database');

  registry.views[index] = candidate;
  writeRegistry(registry);
  return { ...candidate };
}

export function deleteView(id) {
  const viewId = normalizeString(id);
  const view = registry.views.find((item) => item.id === viewId);
  if (!view) throw new Error('View not found');
  registry.views = registry.views.filter((item) => item.id !== viewId);
  writeRegistry(registry);
  return { ...view };
}

export function getRegistrySnapshot() {
  return {
    databases: listDatabases(),
    views: listViews(),
  };
}
