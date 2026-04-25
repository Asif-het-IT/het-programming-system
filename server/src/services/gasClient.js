import { env } from '../config/env.js';
import { clearCache, getCache, setCache } from './cache.js';

function resolveGasTarget(params = {}) {
  const database = String(params.database || '').toUpperCase();

  if (database === 'MEN_MATERIAL') {
    return {
      bridgeUrl: env.gasBridgeUrlMenMaterial,
      secretKey: env.gasSecretKeyMenMaterial,
    };
  }

  return {
    bridgeUrl: env.gasBridgeUrlLaceGayle || env.gasBridgeUrl,
    secretKey: env.gasSecretKeyLaceGayle || env.gasSecretKey,
  };
}

function isWorkerProxyEnabled() {
  return Boolean(env.gasProxyUrl);
}

function enforceProxyPolicy() {
  if (env.nodeEnv === 'production' && !env.gasProxyUrl) {
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

async function callGas(action, payload = {}, useCache = true) {
  return callGasGet(action, payload, useCache);
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

async function parseGasJsonResponse(response, api) {
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`GAS bridge failed (${response.status}) for api=${api}`);
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const isFailed = parsed.success === false || parsed.ok === false;
      if (isFailed) {
        const message = parsed.error || parsed.message || `GAS returned unsuccessful payload for api=${api}`;
        throw new Error(String(message));
      }
    }
    return parsed;
  } catch {
    const normalized = raw.trim().toLowerCase();
    if (normalized.startsWith('<!doctype html') || normalized.startsWith('<html')) {
      throw new Error(`GAS bridge returned HTML for api=${api}; expected JSON. Verify GAS deployment URL/contract mode.`);
    }

    throw new Error(`GAS bridge returned non-JSON payload for api=${api}`);
  }
}

async function callGasGet(api, params = {}, useCache = true, ttlMs = env.cacheTtlMs) {
  enforceProxyPolicy();
  const cacheKey = `GET:${api}:${JSON.stringify(params)}`;

  if (useCache) {
    const cached = getCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  let response;

  if (isWorkerProxyEnabled()) {
    const url = new URL(env.gasProxyUrl);
    url.searchParams.set('database', String(params.database || 'LACE_GAYLE'));
    url.searchParams.set('api', api);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-proxy-auth': env.gasProxyAuthToken,
      },
    });
  } else {
    const target = resolveGasTarget(params);
    validateGasConfig(target, params);
    const url = toUrlWithApi(api, params, target);
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: buildGasHeaders(target.secretKey),
    });
  }

  const data = await parseGasJsonResponse(response, api);
  setCache(cacheKey, data, ttlMs);
  return data;
}

async function callGasPost(api, body = {}, query = {}) {
  enforceProxyPolicy();
  let response;

  if (isWorkerProxyEnabled()) {
    const url = new URL(env.gasProxyUrl);
    url.searchParams.set('database', String(query.database || 'LACE_GAYLE'));
    url.searchParams.set('api', api);

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'x-proxy-auth': env.gasProxyAuthToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } else {
    const target = resolveGasTarget(query);
    validateGasConfig(target, query);
    const url = toUrlWithApi(api, query, target);
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        ...buildGasHeaders(target.secretKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  const data = await parseGasJsonResponse(response, api);
  // Writes invalidate read-side caches so users see updated records quickly.
  clearCache();
  return data;
}

export async function fetchDataFromGas(payload) {
  return callGasGet('records', payload, true);
}

export async function fetchDashboardFromGas(payload) {
  return callGasGet('dashboard', payload, true);
}

export async function fetchFiltersFromGas(payload) {
  return callGasGet('product-names', payload, true);
}

export async function fetchExportFromGas(payload) {
  return callGasGet('records', payload, false);
}

export async function fetchViewConfigFromGas(payload) {
  return callGasGet('view-config', payload, true);
}

export async function fetchViewOutputFromGas(payload) {
  // view-output is expensive for LACE_GAYLE; a short cache window improves response time
  // without changing authorization or projection logic.
  return callGasGet('view-output', payload, true, Math.min(env.cacheTtlMs, 30000));
}

export async function saveEntryToGas(body, query = {}) {
  return callGasPost('save-entry', body, query);
}
