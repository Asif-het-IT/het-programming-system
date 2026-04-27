function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function letterToIndex(token) {
  const t = normalizeText(token).toUpperCase();
  if (!/^[A-Z]+$/.test(t)) return -1;

  let n = 0;
  for (let i = 0; i < t.length; i += 1) {
    n = n * 26 + ((t.codePointAt(i) || 0) - 64);
  }
  return n - 1;
}

function indexToLetter(index) {
  let n = Number(index) + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCodePoint(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function expandColumnToken(token) {
  const t = normalizeText(token).toUpperCase();
  if (!t) return [];
  if (!t.includes(':')) return [t];

  const [a, b] = t.split(':').map((x) => x.trim());
  const start = letterToIndex(a);
  const end = letterToIndex(b);
  if (start < 0 || end < 0) return [t];

  const out = [];
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  for (let i = lo; i <= hi; i += 1) {
    out.push(indexToLetter(i));
  }
  return out;
}

function toColumnTokens(columns) {
  const source = Array.isArray(columns) ? columns : [];
  return source
    .flatMap((value) => String(value || '').split(','))
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .flatMap((token) => expandColumnToken(token));
}

function resolveHeaderByToken(headers, token) {
  const sourceHeaders = Array.isArray(headers) ? headers : [];
  const clean = normalizeText(token);
  if (!clean) return '';

  const exact = sourceHeaders.find((header) => header === clean);
  if (exact) return exact;

  const byCase = sourceHeaders.find((header) => normalizeText(header).toLowerCase() === clean.toLowerCase());
  if (byCase) return byCase;

  const idx = letterToIndex(clean);
  if (idx >= 0 && idx < sourceHeaders.length) {
    return sourceHeaders[idx];
  }

  return '';
}

function resolveHeadersFromColumns(columns, headers) {
  const sourceHeaders = Array.isArray(headers) ? headers : [];
  const tokens = toColumnTokens(columns);

  if (tokens.length === 0) {
    return sourceHeaders.slice();
  }

  const out = [];
  const seen = new Set();

  for (const token of tokens) {
    const header = resolveHeaderByToken(sourceHeaders, token);
    if (!header) continue;
    if (seen.has(header)) continue;
    seen.add(header);
    out.push(header);
  }

  return out;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesRule(rowValue, operator, expectedValue) {
  const op = String(operator || '=').toLowerCase();
  const rowText = normalizeText(rowValue);
  const expectedText = normalizeText(expectedValue);

  if (op === 'in') {
    const candidates = Array.isArray(expectedValue)
      ? expectedValue.map((item) => normalizeText(item)).filter(Boolean)
      : String(expectedValue || '')
        .split(',')
        .map((item) => normalizeText(item))
        .filter(Boolean);

    if (candidates.length === 0) return true;
    const rowKey = rowText.toLowerCase();
    return candidates.some((candidate) => candidate.toLowerCase() === rowKey);
  }

  if (!expectedText) return true;

  if (op === 'contains') {
    return rowText.toLowerCase().includes(expectedText.toLowerCase());
  }

  if (op === '>') {
    const left = toNumber(rowValue);
    const right = toNumber(expectedValue);
    if (left == null || right == null) return false;
    return left > right;
  }

  if (op === '<') {
    const left = toNumber(rowValue);
    const right = toNumber(expectedValue);
    if (left == null || right == null) return false;
    return left < right;
  }

  return rowText.toLowerCase() === expectedText.toLowerCase();
}

export function applyFilterRules(rows, filterRules) {
  const source = Array.isArray(rows) ? rows : [];
  const rules = Array.isArray(filterRules) ? filterRules : [];
  const headers = Object.keys(source[0] || {});

  if (rules.length === 0) {
    return source;
  }

  return source.filter((row) => {
    for (const rule of rules) {
      const column = resolveHeaderByToken(headers, rule?.column);
      if (!column) continue;

      if (!matchesRule(row?.[column], rule?.operator, rule?.value)) {
        return false;
      }
    }

    return true;
  });
}

export function applySearch(rows, query, columns) {
  const source = Array.isArray(rows) ? rows : [];
  const term = normalizeText(query).toLowerCase();
  if (!term) return source;

  const headers = Object.keys(source[0] || {});
  const scope = Array.isArray(columns) && columns.length > 0
    ? resolveHeadersFromColumns(columns, headers)
    : headers;

  if (scope.length === 0) return [];
  return source.filter((row) => scope.some((column) => normalizeText(row?.[column]).toLowerCase().includes(term)));
}

export function applySort(rows, sortColumn, sortOrder = 'asc') {
  const source = Array.isArray(rows) ? [...rows] : [];
  const headers = Object.keys(source[0] || {});
  const column = resolveHeaderByToken(headers, sortColumn);
  if (!column) return source;

  const direction = String(sortOrder || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  source.sort((a, b) => {
    const leftText = normalizeText(a?.[column]);
    const rightText = normalizeText(b?.[column]);

    const leftNum = toNumber(leftText);
    const rightNum = toNumber(rightText);
    if (leftNum != null && rightNum != null) {
      return (leftNum - rightNum) * direction;
    }

    return leftText.localeCompare(rightText, undefined, { sensitivity: 'base', numeric: true }) * direction;
  });

  return source;
}

export function projectColumns(rows, selectedColumns) {
  const source = Array.isArray(rows) ? rows : [];
  const headers = Object.keys(source[0] || {});
  const tokens = toColumnTokens(selectedColumns);
  const selectedHeaders = tokens.length === 0
    ? headers
    : resolveHeadersFromColumns(selectedColumns, headers);

  if (selectedHeaders.length === 0) {
    return { headers: [], rows: source.map(() => ({})) };
  }

  const projected = source.map((row) => {
    const out = {};
    for (const col of selectedHeaders) {
      out[col] = row?.[col];
    }
    return out;
  });

  return { headers: selectedHeaders, rows: projected };
}

export function paginateRows(rows, page = 1, pageSize = 50) {
  const source = Array.isArray(rows) ? rows : [];
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 50);
  const start = (safePage - 1) * safePageSize;
  const records = source.slice(start, start + safePageSize);

  return {
    records,
    total: source.length,
    page: safePage,
    pageSize: safePageSize,
  };
}
