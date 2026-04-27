import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const apiBaseUrl = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 400;
const DEFAULT_GET_CACHE_TTL_MS = 8_000;
const AUTH_STORAGE_KEY = 'auth_user';
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const SAFE_RETRY_METHODS = new Set(['get', 'head', 'options']);

const responseCache = new Map();

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildCacheKey(config) {
  const method = String(config?.method || 'get').toLowerCase();
  const base = String(config?.baseURL || '');
  const url = String(config?.url || '');
  const params = config?.params ? JSON.stringify(config.params) : '';
  return `${method}:${base}:${url}:${params}`;
}

function getRetryAfterMs(error) {
  const retryAfter = error?.response?.headers?.['retry-after'];
  if (!retryAfter) return 0;
  const asNumber = Number(retryAfter);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber * 1000;

  const asDate = Date.parse(retryAfter);
  if (Number.isNaN(asDate)) return 0;
  return Math.max(0, asDate - Date.now());
}

function shouldRetryRequest(config, status) {
  const method = String(config?.method || 'get').toLowerCase();
  const isSafeMethod = SAFE_RETRY_METHODS.has(method);
  const url = String(config?.url || '');
  const isDetectColumnsRequest = method === 'post' && /\/admin\/databases\/[^/]+\/detect-columns$/i.test(url);
  if (!RETRYABLE_STATUSES.has(status)) return false;
  return isSafeMethod || isDetectColumnsRequest;
}

function isCacheEligible(config) {
  const method = String(config?.method || 'get').toLowerCase();
  if (method !== 'get') return false;
  const url = String(config?.url || '');
  return url.startsWith('/admin/') || url === '/my-views' || url === '/filters';
}

function handleSessionExpiry() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem(AUTH_STORAGE_KEY);
  responseCache.clear();

  if (!globalThis.window) return;
  const currentPath = globalThis.location?.pathname || '';
  if (currentPath !== '/login' && currentPath !== '/') {
    globalThis.location.assign('/login');
  }
}

export const httpClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
});

let isRefreshing = false;
let pendingQueue = [];

function flushQueue(error, token) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  pendingQueue = [];
}

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const wantsCache = isCacheEligible(config) && config.skipCache !== true;
  if (wantsCache) {
    const cacheKey = buildCacheKey(config);
    const now = Date.now();
    const cachedEntry = responseCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > now) {
      config.adapter = async () => ({
        data: cachedEntry.data,
        status: 200,
        statusText: 'OK',
        headers: cachedEntry.headers || {},
        config,
        request: null,
      });
      return config;
    }
    if (cachedEntry) {
      responseCache.delete(cacheKey);
    }
    config._cacheKey = cacheKey;
  }

  return config;
});

httpClient.interceptors.response.use(
  (response) => {
    if (isCacheEligible(response?.config) && response?.config?.skipCache !== true) {
      const cacheKey = response?.config?._cacheKey || buildCacheKey(response.config);
      const ttl = Number(response?.config?.cacheTtlMs) > 0 ? Number(response.config.cacheTtlMs) : DEFAULT_GET_CACHE_TTL_MS;
      responseCache.set(cacheKey, {
        data: response.data,
        headers: response.headers,
        expiresAt: Date.now() + ttl,
      });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error?.config || {};
    const status = error?.response?.status;

    if (status && shouldRetryRequest(originalRequest, status)) {
      const attempt = Number(originalRequest._retryAttempt || 0);
      const maxAttempts = Number(originalRequest.maxRetryAttempts || DEFAULT_RETRY_ATTEMPTS);
      if (attempt < maxAttempts) {
        originalRequest._retryAttempt = attempt + 1;
        const retryAfterMs = getRetryAfterMs(error);
        const backoffMs = DEFAULT_RETRY_BASE_DELAY_MS * (2 ** attempt) + Math.floor(Math.random() * 120);
        const waitMs = Math.max(retryAfterMs, backoffMs);
        await sleep(waitMs);
        return httpClient(originalRequest);
      }
    }

    if (!error.response?.status || error.response.status !== 401 || originalRequest._retry) {
      throw error;
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return httpClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('Missing refresh token');
      }

      const refreshResponse = await axios.post(`${apiBaseUrl}/refresh`, {
        refreshToken,
      });

      const newToken = refreshResponse.data.accessToken;
      localStorage.setItem('access_token', newToken);
      flushQueue(null, newToken);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return httpClient(originalRequest);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      handleSessionExpiry();
      throw refreshError;
    } finally {
      isRefreshing = false;
    }
  },
);
