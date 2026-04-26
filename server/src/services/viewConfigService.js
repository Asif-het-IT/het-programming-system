import { fetchViewConfigFromGas } from './gasClient.js';

const viewConfigCache = new Map();
const CACHE_TTL_MS = 30 * 1000;

function cacheKey(database, view) {
  return `${String(database || '').toUpperCase()}::${String(view || '')}`;
}

function fromCache(database, view) {
  const key = cacheKey(database, view);
  const item = viewConfigCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    viewConfigCache.delete(key);
    return null;
  }
  return item.value;
}

function toCache(database, view, value) {
  viewConfigCache.set(cacheKey(database, view), {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function normalizeConfig(config, requestedView) {
  const columnsList = Array.isArray(config?.columnsList)
    ? config.columnsList.map((x) => String(x).trim()).filter(Boolean)
    : [];

  const filterColumns = Array.isArray(config?.filterColumns)
    ? config.filterColumns.map((x) => String(x).trim()).filter(Boolean)
    : [];

  const filterValues = Array.isArray(config?.filterValues)
    ? config.filterValues.map((x) => String(x).trim())
    : [];

  return {
    view: String(config?.view || requestedView || ''),
    columnsRaw: String(config?.columnsRaw || columnsList.join(',')),
    columnsList,
    filterColumns,
    filterValues,
    url: String(config?.url || ''),
    sheetName: String(config?.sheetName || ''),
  };
}

function normalizeViewName(value) {
  return String(value || '')
    .replace(/\s*-\s*(lace|gayle)\s*$/i, '')
    .toLowerCase()
    .replaceAll('&', 'and')
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeSheetQualifier(sheetName) {
  const sheet = String(sheetName || '').trim().toLowerCase();
  if (sheet.includes('lace')) return 'Lace';
  if (sheet.includes('gayle')) return 'Gayle';
  return '';
}

export function getQualifiedViewName({ database, viewName, sheetName }) {
  const rawView = String(viewName || '').trim();
  if (!rawView) return '';

  if (String(database || '').toUpperCase() !== 'LACE_GAYLE') {
    return rawView;
  }

  const qualifier = normalizeSheetQualifier(sheetName);
  if (!qualifier) {
    return rawView;
  }

  if (/\s-\s(lace|gayle)$/i.test(rawView)) {
    return rawView.replace(/\s-\s(lace|gayle)$/i, ` - ${qualifier}`);
  }

  return `${rawView} - ${qualifier}`;
}

export function isViewNameMatch(left, right) {
  return normalizeViewName(left) === normalizeViewName(right);
}

function resolveRequestedQualifier(value) {
  const v = String(value || '').toLowerCase();
  if (v.includes(' lace') || v.endsWith('lace')) return 'lace';
  if (v.includes(' gayle') || v.endsWith('gayle')) return 'gayle';
  return '';
}

export async function getViewConfigFromSource({ database, view }) {
  const cached = fromCache(database, view);
  if (cached) return cached;

  let response = await fetchViewConfigFromGas({ database, view });
  let data = response?.data || response || {};
  let configs = Array.isArray(data?.configs) ? data.configs : [];

  if (configs.length === 0 && view) {
    response = await fetchViewConfigFromGas({ database });
    data = response?.data || response || {};
    configs = Array.isArray(data?.configs) ? data.configs : [];
  }

  const target = String(view || '').trim().toLowerCase();
  const normalizedTarget = normalizeViewName(view);
  const requestedQualifier = resolveRequestedQualifier(view);
  let first = null;

  if (target) {
    first = configs.find((cfg) => String(cfg?.view || '').trim().toLowerCase() === target) || null;
  }

  if (!first && normalizedTarget) {
    const normalizedMatches = configs.filter((cfg) => normalizeViewName(cfg?.view) === normalizedTarget);

    if (normalizedMatches.length > 1 && requestedQualifier) {
      first = normalizedMatches.find((cfg) => {
        const sheet = String(cfg?.sheetName || '').toLowerCase();
        const filters = Array.isArray(cfg?.filterValues)
          ? cfg.filterValues.map((x) => String(x || '').toLowerCase())
          : [];
        return sheet.includes(requestedQualifier) || filters.includes(requestedQualifier);
      }) || null;
    }

    if (!first) {
      [first] = normalizedMatches;
      first = first || null;
    }
  }

  if (!first && !target) {
    first = configs[0] || null;
  }

  if (!first) {
    const empty = normalizeConfig({ view }, view);
    toCache(database, view, empty);
    return empty;
  }

  const normalized = normalizeConfig(first, view);
  toCache(database, view, normalized);
  return normalized;
}
