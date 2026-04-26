/**
 * syncLog.js
 * File-backed circular log of every GAS data-fetch event.
 * Entries: start, success, error, cache_hit
 * Kept at server/storage/sync-log.json, max 1 000 entries.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const STORAGE_DIR = join(process.cwd(), 'server', 'storage');
const LOG_PATH = join(STORAGE_DIR, 'sync-log.json');
const MAX_ENTRIES = 1000;

function ensureDir() {
  if (!existsSync(STORAGE_DIR)) mkdirSync(STORAGE_DIR, { recursive: true });
}

function load() {
  try {
    if (!existsSync(LOG_PATH)) return [];
    return JSON.parse(readFileSync(LOG_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function save(logs) {
  ensureDir();
  writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
}

/**
 * Append a sync event to the log.
 * @param {object} opts
 * @param {string} opts.database         - 'MEN_MATERIAL' | 'LACE_GAYLE' | 'UNKNOWN'
 * @param {string} opts.action           - e.g. 'data.fetch.success'
 * @param {'success'|'error'|'cache_hit'|'start'} opts.status
 * @param {number|null} opts.durationMs  - wall-clock time for the GAS round-trip
 * @param {number|null} [opts.recordCount]
 * @param {string|null} [opts.error]
 * @param {boolean} [opts.cacheHit]
 * @param {string|null} [opts.view]
 * @param {string|null} [opts.sheetType]
 * @param {string|null} [opts.sourceSheetName]
 * @param {string|null} [opts.sourceUrl]
 * @param {string} [opts.layer]          - 'proxy' | 'gas' | 'cache'
 * @param {string|null} [opts.requestUrl]  - masked URL shown to admin
 * @param {number|null} [opts.responseSize] - bytes
 */
export function logSyncEvent({
  database = 'UNKNOWN',
  action,
  status,
  durationMs = null,
  recordCount = null,
  error = null,
  cacheHit = false,
  view = null,
  sheetType = null,
  sourceSheetName = null,
  sourceUrl = null,
  layer = 'gas',
  requestUrl = null,
  responseSize = null,
}) {
  const logs = load();
  const entry = {
    id: randomBytes(6).toString('hex'),
    at: new Date().toISOString(),
    database,
    action,
    status,
    durationMs,
    recordCount,
    error,
    cacheHit,
    view,
    sheetType,
    sourceSheetName,
    sourceUrl,
    layer,
    requestUrl,
    responseSize,
  };
  logs.unshift(entry);
  if (logs.length > MAX_ENTRIES) logs.length = MAX_ENTRIES;
  save(logs);
  return entry;
}

/**
 * Return the most recent sync log entries.
 * @param {number} limit
 */
export function getSyncLogs(limit = 100) {
  return load().slice(0, Math.min(limit, MAX_ENTRIES));
}

/** Wipe all sync logs. */
export function clearSyncLogs() {
  save([]);
}
