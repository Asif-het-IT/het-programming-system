const cache = new Map();
const MIN_TTL_MS = 30_000;
const MAX_TTL_MS = 120_000;

function normalizeTtl(ttlMs) {
  const parsed = Number(ttlMs);
  if (!Number.isFinite(parsed)) return 60_000;
  return Math.max(MIN_TTL_MS, Math.min(MAX_TTL_MS, parsed));
}

export function getCache(key) {
  const item = cache.get(key);
  if (!item) {
    return null;
  }

  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }

  return item.value;
}

export function setCache(key, value, ttlMs) {
  const ttl = normalizeTtl(ttlMs);
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttl,
  });
}

export function clearCache() {
  cache.clear();
}

export function clearCacheByScope({ database = '', view = '' } = {}) {
  const db = String(database || '').trim().toUpperCase();
  const vw = String(view || '').trim();

  if (!db && !vw) {
    clearCache();
    return;
  }

  for (const key of cache.keys()) {
    const hasDb = db ? key.includes(`:db:${db}:`) : true;
    const hasView = vw ? key.includes(`:view:${vw}:`) : true;
    if (hasDb && hasView) {
      cache.delete(key);
    }
  }
}

export function getCacheTtlBounds() {
  return { minTtlMs: MIN_TTL_MS, maxTtlMs: MAX_TTL_MS };
}
