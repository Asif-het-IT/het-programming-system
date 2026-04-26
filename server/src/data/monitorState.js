/**
 * monitorState.js
 * In-memory per-database monitoring state.
 * Reset on server restart — provides real-time stats since last boot.
 * Complemented by the persistent syncLog for historical data.
 */

/** @type {Record<string, DatabaseMonitorState>} */
const state = {};

function createEmptyState() {
  return {
    lastSyncAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastErrorAt: null,
    recordCount: null,
    totalFetches: 0,
    totalErrors: 0,
    cacheHits: 0,
    avgDurationMs: null,
    _durations: [], // rolling window of last 50 durations
  };
}

function ensureDb(database) {
  const db = String(database || '').trim().toUpperCase();
  if (!db) return null;

  if (!state[db]) {
    state[db] = createEmptyState();
  }

  return db;
}

function resolveDb(database) {
  return ensureDb(database);
}

function resolveStatus(lastError, lastSuccessAt) {
  if (lastError) return 'error';
  if (lastSuccessAt) return 'ok';
  return 'pending';
}

function updateAvg(s, durationMs) {
  if (typeof durationMs !== 'number' || durationMs < 0) return;
  s._durations.push(durationMs);
  if (s._durations.length > 50) s._durations.shift();
  s.avgDurationMs = Math.round(
    s._durations.reduce((a, b) => a + b, 0) / s._durations.length,
  );
}

export function recordFetchSuccess(database, { durationMs = null, recordCount = null } = {}) {
  const db = resolveDb(database);
  if (!db) return;
  const s = state[db];
  s.lastSyncAt = new Date().toISOString();
  s.lastSuccessAt = s.lastSyncAt;
  s.lastError = null;
  s.totalFetches++;
  if (recordCount !== null) s.recordCount = recordCount;
  updateAvg(s, durationMs);
}

export function recordFetchError(database, { durationMs = null, error = '' } = {}) {
  const db = resolveDb(database);
  if (!db) return;
  const s = state[db];
  s.lastSyncAt = new Date().toISOString();
  s.lastError = String(error).slice(0, 500);
  s.lastErrorAt = s.lastSyncAt;
  s.totalFetches++;
  s.totalErrors++;
  updateAvg(s, durationMs);
}

export function recordCacheHit(database) {
  const db = resolveDb(database);
  if (!db) return;
  state[db].cacheHits++;
}

/**
 * Return the full monitoring state for all databases.
 * Strips internal _durations array before returning.
 */
export function getMonitorState() {
  return Object.fromEntries(
    Object.entries(state).map(([db, s]) => {
      const { _durations, ...rest } = s;
      return [db, { ...rest, status: resolveStatus(s.lastError, s.lastSuccessAt) }];
    }),
  );
}

export function getDatabaseState(database) {
  const db = resolveDb(database);
  if (!db) return null;
  const { _durations, ...rest } = state[db];
  return { ...rest, status: resolveStatus(rest.lastError, rest.lastSuccessAt) };
}
