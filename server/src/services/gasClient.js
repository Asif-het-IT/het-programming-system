import { env } from '../config/env.js';
import { clearCache, getCache, setCache } from './cache.js';
import { logSyncEvent } from '../data/syncLog.js';
import { recordFetchSuccess, recordFetchError, recordCacheHit } from '../data/monitorState.js';
import { notifySyncFailure } from './syncAlerts.js';
import { getDatabaseByName } from '../data/databaseRegistry.js';

const RETRYABLE_STATUS_CODES = new Set(
  Array.isArray(env.gasRetryStatusCodes) && env.gasRetryStatusCodes.length > 0
    ? env.gasRetryStatusCodes
    : [429, 500, 502, 503, 504],
);
const GAS_RETRY_MAX_ATTEMPTS = Math.max(1, Number(env.gasRetryMaxAttempts || 3));
const GAS_RETRY_BASE_DELAY_MS = Math.max(50, Number(env.gasRetryBaseDelayMs || 300));
const GAS_RETRY_MAX_DELAY_MS = Math.max(GAS_RETRY_BASE_DELAY_MS, Number(env.gasRetryMaxDelayMs || 4000));
const GAS_REQUEST_CONCURRENCY = Math.max(1, Number(env.gasRequestConcurrency || 6));

function createSemaphore(maxConcurrency) {
  let active = 0;
  const waiters = [];

  const buildRelease = () => {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
      drain();
    };
  };

  const drain = () => {
    if (active >= maxConcurrency) return;
    const next = waiters.shift();
    if (!next) return;
    active += 1;
    next();
  };

  return {
    acquire() {
      return new Promise((resolve) => {
        const onGranted = () => {
          resolve(buildRelease());
        };

        if (active < maxConcurrency) {
          active += 1;
          onGranted();
          return;
        }

        waiters.push(onGranted);
      });
    },
  };
}

const gasRequestSemaphore = createSemaphore(GAS_REQUEST_CONCURRENCY);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(response) {
  const header = response?.headers?.get?.('retry-after');
  if (!header) return null;

  const asNumber = Number(header);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return asNumber * 1000;
  }

  const asDate = Date.parse(header);
  if (!Number.isFinite(asDate)) return null;
  return Math.max(0, asDate - Date.now());
}

function computeBackoffDelayMs(attempt, retryAfterMs = null) {
  if (typeof retryAfterMs === 'number' && retryAfterMs >= 0) {
    return Math.min(retryAfterMs, GAS_RETRY_MAX_DELAY_MS);
  }

  const base = GAS_RETRY_BASE_DELAY_MS * (2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 150);
  return Math.min(base + jitter, GAS_RETRY_MAX_DELAY_MS);
}

function shouldRetryStatus(statusCode) {
  return RETRYABLE_STATUS_CODES.has(Number(statusCode));
}

function isLikelyNetworkError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('fetch failed')
    || message.includes('etimedout')
    || message.includes('timeout')
    || message.includes('econnreset')
    || message.includes('econnrefused')
    || message.includes('network');
}

async function fetchWithThrottleAndRetry(makeRequest) {
  let attempt = 0;

  while (attempt < GAS_RETRY_MAX_ATTEMPTS) {
    attempt += 1;

    try {
      let response;
      const release = await gasRequestSemaphore.acquire();
      try {
        response = await makeRequest();
      } finally {
        release();
      }

      if (shouldRetryStatus(response.status) && attempt < GAS_RETRY_MAX_ATTEMPTS) {
        const delayMs = computeBackoffDelayMs(attempt, parseRetryAfterMs(response));
        await sleep(delayMs);
        continue;
      }

      return response;
    } catch (error) {
      if (!isLikelyNetworkError(error) || attempt >= GAS_RETRY_MAX_ATTEMPTS) {
        throw error;
      }

      const delayMs = computeBackoffDelayMs(attempt);
      await sleep(delayMs);
    }
  }

  throw new Error('GAS request retries exhausted');
}

/** Mask a URL for safe admin display — hide deployment ID but keep domain. */
function maskUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(String(url));
    // Keep only origin + first path segment
    const parts = u.pathname.split('/');
    const masked = parts.map((p, i) => (i > 3 && p.length > 6 ? `${p.slice(0, 4)}…${p.slice(-4)}` : p)).join('/');
    return `${u.origin}${masked}`;
  } catch {
    return '(masked)';
  }
}

function extractDbFromParams(params) {
  const db = String(params?.database || '').trim().toUpperCase();
  return db || 'UNKNOWN';
}

function buildScopedCacheKey(method, api, params = {}) {
  const database = extractDbFromParams(params);
  const view = String(params?.view || '').trim();
  const paramsForCache = { ...params };
  delete paramsForCache.bridgeUrl;
  delete paramsForCache.apiToken;
  delete paramsForCache.requester;

  const sortedEntries = Object.entries(paramsForCache)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return `${method}:${api}:db:${database}:view:${view || '*'}:params:${JSON.stringify(sortedEntries)}`;
}

function countRecords(data) {
  if (!data) return null;
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data?.data?.records)) return data.data.records.length;
  if (Array.isArray(data?.records)) return data.records.length;
  if (Array.isArray(data?.data?.items)) return data.data.items.length;
  if (typeof data?.data?.total === 'number') return data.data.total;
  if (typeof data?.total === 'number') return data.total;
  return null;
}

function inferSheetType(params = {}, data = null) {
  const candidates = [
    params.sheetName,
    params.view,
    data?.source?.sheet_name,
    data?.config?.sheetName,
  ].filter(Boolean).map((value) => String(value).toLowerCase());

  if (candidates.some((value) => value.includes('lace'))) return 'Lace';
  if (candidates.some((value) => value.includes('gayle'))) return 'Gayle';
  return null;
}

function extractLogMeta(params = {}, data = null) {
  return {
    view: params.view ? String(params.view) : null,
    sheetType: inferSheetType(params, data),
    sourceSheetName: data?.source?.sheet_name || data?.config?.sheetName || params.sheetName || null,
    sourceUrl: data?.config?.url || null,
  };
}

function resolveGasTarget(params = {}) {
  const database = extractDbFromParams(params);
  const registryDb = getDatabaseByName(database);

  if (registryDb?.type === 'custom') {
    return {
      mode: 'direct',
      bridgeUrl: registryDb.bridgeUrl,
      secretKey: registryDb.apiToken,
      database,
    };
  }

  if (database === 'MEN_MATERIAL') {
    if (env.gasProxyUrl) {
      return { mode: 'proxy', database };
    }

    return {
      mode: 'direct',
      bridgeUrl: env.gasBridgeUrlMenMaterial,
      secretKey: env.gasSecretKeyMenMaterial,
      database,
    };
  }

  if (database === 'LACE_GAYLE') {
    if (env.gasProxyUrl) {
      return { mode: 'proxy', database };
    }

    return {
      mode: 'direct',
      bridgeUrl: env.gasBridgeUrlLaceGayle || env.gasBridgeUrl,
      secretKey: env.gasSecretKeyLaceGayle || env.gasSecretKey,
      database,
    };
  }

  // Unknown non-legacy databases can still use direct mode if the caller provided explicit target params.
  return {
    mode: 'direct',
    bridgeUrl: String(params.bridgeUrl || ''),
    secretKey: String(params.apiToken || ''),
    database,
  };
}

function isWorkerProxyEnabled(target) {
  return target?.mode === 'proxy' && Boolean(env.gasProxyUrl);
}

function enforceProxyPolicy(target) {
  if (target?.mode === 'proxy' && env.nodeEnv === 'production' && !env.gasProxyUrl) {
    throw new Error('Proxy required in production');
  }
}

function buildGasHeaders(secretKey) {
  const headers = {
    'x-gas-secret': secretKey,
    'x-app-referrer': env.gasAllowedReferrer,
  };

  // Keep bearer token flow compatible with legacy bridge auth.
  if (secretKey) {
    headers.Authorization = `Bearer ${secretKey}`;
  }

  return headers;
}

function validateGasConfig(target, params = {}) {
  if (!target.bridgeUrl) {
    const database = params.database || 'UNKNOWN';
    throw new Error(`GAS bridge URL is not configured for database=${database}`);
  }
}

function toUrlWithApi(api, params, target) {
  const url = new URL(target.bridgeUrl);
  url.searchParams.set('api', api);
  // Keep legacy route compatibility for GAS scripts that key off "action".
  url.searchParams.set('action', api);

  // Keep legacy token query compatibility while still sending secure headers.
  if (target.secretKey) {
    url.searchParams.set('token', target.secretKey);
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

function getRequestLayer(target) {
  return isWorkerProxyEnabled(target) ? 'proxy' : 'gas';
}

function parseGasPayload(rawText, api) {
  try {
    const data = JSON.parse(rawText);
    if (data && typeof data === 'object') {
      const isFailed = data.success === false || data.ok === false;
      if (isFailed) {
        const message = data.error || data.message || `GAS returned unsuccessful payload for api=${api}`;
        throw new Error(String(message));
      }
    }
    return data;
  } catch {
    const normalized = rawText.trim().toLowerCase();
    if (normalized.startsWith('<!doctype html') || normalized.startsWith('<html')) {
      throw new Error(`GAS bridge returned HTML for api=${api}; expected JSON.`);
    }
    throw new Error(`GAS bridge returned non-JSON payload for api=${api}`);
  }
}

function buildProxyUrl(api, target, params) {
  const url = new URL(env.gasProxyUrl);
  url.searchParams.set('database', String(target.database || params.database || 'LACE_GAYLE'));
  url.searchParams.set('api', api);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

async function requestGas({ api, method, target, params = {}, body }) {
  if (isWorkerProxyEnabled(target)) {
    const proxyUrl = buildProxyUrl(api, target, params);
    const response = await fetchWithThrottleAndRetry(() => fetch(proxyUrl.toString(), {
      method,
      headers: {
        'x-proxy-auth': env.gasProxyAuthToken,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(body || {}) } : {}),
    }));
    return { response, requestUrl: maskUrl(proxyUrl.toString()) };
  }

  validateGasConfig(target, params);
  const url = toUrlWithApi(api, params, target);
  const response = await fetchWithThrottleAndRetry(() => fetch(url.toString(), {
    method,
    headers: {
      ...buildGasHeaders(target.secretKey),
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify(body || {}) } : {}),
  }));

  return { response, requestUrl: maskUrl(url.toString()) };
}

async function reportFailure({
  database,
  action,
  durationMs,
  error,
  target,
  requestUrl,
  responseSize,
  shouldSuppressAlerts,
  logMeta,
}) {
  const layer = getRequestLayer(target);
  const errorText = String(error);
  recordFetchError(database, { durationMs, error: errorText });
  logSyncEvent({ database, action, status: 'error', durationMs, error: errorText, layer, requestUrl, responseSize, ...logMeta });
  if (!shouldSuppressAlerts) {
    await notifySyncFailure({ database, view: logMeta.view, layer, error: errorText, requestUrl });
  }
}

async function callGasGet(api, params = {}, useCache = true, ttlMs = env.cacheTtlMs, options = {}) {
  const target = resolveGasTarget(params);
  enforceProxyPolicy(target);
  const cacheKey = buildScopedCacheKey('GET', api, params);
  const database = extractDbFromParams(params);
  const action = `data.fetch.${api}`;
  const shouldSuppressAlerts = options.suppressAlerts === true;
  const logMeta = extractLogMeta(params);

  if (useCache) {
    const cached = getCache(cacheKey);
    if (cached) {
      recordCacheHit(database);
      logSyncEvent({ database, action, status: 'cache_hit', cacheHit: true, layer: 'cache', ...extractLogMeta(params, cached) });
      return cached;
    }
  }

  const t0 = Date.now();
  let requestUrl = null;
  let responseSize = null;
  let failureHandled = false;

  try {
    const gasResponse = await requestGas({ api, method: 'GET', target, params });
    const response = gasResponse.response;
    requestUrl = gasResponse.requestUrl;

    const rawText = await response.text();
    const durationMs = Date.now() - t0;
    responseSize = Buffer.byteLength(rawText, 'utf8');
    const layer = getRequestLayer(target);

    if (!response.ok) {
      const err = `GAS bridge failed (${response.status}) for api=${api}`;
      await reportFailure({ database, action, durationMs, error: err, target, requestUrl, responseSize, shouldSuppressAlerts, logMeta });
      failureHandled = true;
      throw new Error(err);
    }

    const data = parseGasPayload(rawText, api);

    const recordCount = countRecords(data);
    recordFetchSuccess(database, { durationMs, recordCount });
    logSyncEvent({ database, action, status: 'success', durationMs, recordCount, layer, requestUrl, responseSize, ...extractLogMeta(params, data) });

    setCache(cacheKey, data, ttlMs);
    return data;
  } catch (err) {
    const durationMs = Date.now() - t0;
    // Record failures that happen before a response or after parsing an unsuccessful payload.
    if (!failureHandled) {
      await reportFailure({ database, action, durationMs, error: err.message, target, requestUrl, responseSize, shouldSuppressAlerts, logMeta });
      failureHandled = true;
    }
    throw err;
  }
}

async function callGasPost(api, body = {}, query = {}) {
  const target = resolveGasTarget(query);
  enforceProxyPolicy(target);
  const database = extractDbFromParams(query);
  const action = `data.write.${api}`;
  const t0 = Date.now();
  let requestUrl = null;
  let responseSize = null;
  let failureHandled = false;

  try {
    const gasResponse = await requestGas({ api, method: 'POST', target, params: query, body });
    const response = gasResponse.response;
    requestUrl = gasResponse.requestUrl;

    const rawText = await response.text();
    const durationMs = Date.now() - t0;
    responseSize = Buffer.byteLength(rawText, 'utf8');
    const layer = getRequestLayer(target);

    if (!response.ok) {
      const err = `GAS bridge failed (${response.status}) for api=${api}`;
      recordFetchError(database, { durationMs, error: err });
      logSyncEvent({ database, action, status: 'error', durationMs, error: err, layer, requestUrl, responseSize });
      failureHandled = true;
      throw new Error(err);
    }

    const data = parseGasPayload(rawText, api);

    logSyncEvent({ database, action, status: 'success', durationMs, layer, requestUrl, responseSize });

    // Writes invalidate read-side caches so users see updated records quickly.
    clearCache();
    return data;
  } catch (err) {
    const durationMs = Date.now() - t0;
    if (!failureHandled) {
      const layer = getRequestLayer(target);
      recordFetchError(database, { durationMs, error: String(err.message) });
      logSyncEvent({ database, action, status: 'error', durationMs, error: String(err.message), layer, requestUrl, responseSize });
      failureHandled = true;
    }
    throw err;
  }
}

export async function fetchDataFromGas(payload, options) {
  return callGasGet('records', payload, true, env.cacheTtlMs, options);
}

export async function fetchDashboardFromGas(payload, options) {
  return callGasGet('dashboard', payload, true, env.cacheTtlMs, options);
}

export async function fetchFiltersFromGas(payload, options) {
  return callGasGet('product-names', payload, true, env.cacheTtlMs, options);
}

export async function fetchExportFromGas(payload, options) {
  return callGasGet('records', payload, false, env.cacheTtlMs, options);
}

export async function fetchViewConfigFromGas(payload, options) {
  return callGasGet('view-config', payload, true, env.cacheTtlMs, options);
}

export async function fetchViewOutputFromGas(payload, options) {
  // view-output is expensive for LACE_GAYLE; a short cache window improves response time
  // without changing authorization or projection logic.
  return callGasGet('view-output', payload, true, Math.min(env.cacheTtlMs, 30000), options);
}

export async function saveEntryToGas(body, query = {}) {
  return callGasPost('save-entry', body, query);
}
