function text(value) {
  return String(value == null ? '' : value).trim();
}

function letterToIndex(token) {
  const t = text(token).toUpperCase();
  if (!/^[A-Z]+$/.test(t)) return -1;

  let n = 0;
  for (let i = 0; i < t.length; i += 1) {
    n = n * 26 + (t.charCodeAt(i) - 64);
  }
  return n - 1;
}

function indexToLetter(index) {
  let n = Number(index) + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function expandToken(token) {
  const t = text(token).toUpperCase();
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

function resolveSelectedHeaders(columnsList, headers) {
  const rawTokens = Array.isArray(columnsList) ? columnsList : [];
  const tokens = rawTokens
    .map((x) => text(x).toUpperCase())
    .filter(Boolean)
    .flatMap((token) => expandToken(token));

  if (tokens.length === 0) {
    return headers.slice();
  }

  const out = [];
  const seen = new Set();
  for (const token of tokens) {
    const idx = letterToIndex(token);
    if (idx < 0 || idx >= headers.length) continue;
    const header = headers[idx];
    if (!seen.has(header)) {
      seen.add(header);
      out.push(header);
    }
  }

  return out;
}

function applyFilters(records, filterColumns, filterValues) {
  const cols = Array.isArray(filterColumns) ? filterColumns : [];
  const vals = Array.isArray(filterValues) ? filterValues : [];

  if (cols.length === 0 || vals.length === 0) {
    return records.slice();
  }

  return records.filter((row) => {
    for (let i = 0; i < cols.length; i += 1) {
      const col = text(cols[i]);
      const val = text(vals[i]).toLowerCase();
      if (!col || !val) continue;
      if (text(row[col]).toLowerCase() !== val) return false;
    }
    return true;
  });
}

export function alignRecordsToView(records, viewConfig) {
  const source = Array.isArray(records) ? records : [];
  if (source.length === 0) {
    return {
      selectedHeaders: [],
      records: [],
      count: 0,
    };
  }

  const headers = Object.keys(source[0]);
  const selectedHeaders = resolveSelectedHeaders(viewConfig?.columnsList || [], headers);
  const filtered = applyFilters(source, viewConfig?.filterColumns || [], viewConfig?.filterValues || []);

  const projected = filtered.map((row) => {
    const out = {};
    for (const header of selectedHeaders) {
      out[header] = row[header];
    }
    return out;
  });

  return {
    selectedHeaders,
    records: projected,
    count: projected.length,
  };
}

function normalizeValue(value) {
  return String(value == null ? '' : value).trim();
}

function isEmptyRow(row, headers) {
  for (const h of headers) {
    if (normalizeValue(row?.[h]) !== '') {
      return false;
    }
  }
  return true;
}

export function compareViewOutputs(webRows, targetRows, selectedHeaders) {
  const headers = Array.isArray(selectedHeaders) ? selectedHeaders : [];

  const normalizeRow = (row) => {
    const out = {};
    for (const h of headers) {
      out[h] = normalizeValue(row?.[h]);
    }
    return JSON.stringify(out);
  };

  const webSource = Array.isArray(webRows) ? webRows : [];
  const targetSource = Array.isArray(targetRows) ? targetRows : [];

  const web = webSource
    .filter((row) => !isEmptyRow(row, headers))
    .map(normalizeRow);

  const target = targetSource
    .filter((row) => !isEmptyRow(row, headers))
    .map(normalizeRow);

  const max = Math.max(web.length, target.length);
  const mismatches = [];

  for (let i = 0; i < max; i += 1) {
    const a = web[i] || null;
    const b = target[i] || null;
    if (a !== b) {
      mismatches.push({
        index: i,
        web: a,
        target: b,
      });
      if (mismatches.length >= 20) break;
    }
  }

  return {
    match: mismatches.length === 0,
    webCount: web.length,
    targetCount: target.length,
    mismatchCount: mismatches.length,
    mismatches,
  };
}
