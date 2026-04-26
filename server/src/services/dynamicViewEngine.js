function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesRule(rowValue, operator, expectedValue) {
  const op = String(operator || '=').toLowerCase();
  const rowText = normalizeText(rowValue);
  const expectedText = normalizeText(expectedValue);

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

  if (rules.length === 0) {
    return source;
  }

  return source.filter((row) => {
    for (const rule of rules) {
      const column = normalizeText(rule?.column);
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

  const scope = Array.isArray(columns) && columns.length > 0 ? columns : Object.keys(source[0] || {});
  return source.filter((row) => scope.some((column) => normalizeText(row?.[column]).toLowerCase().includes(term)));
}

export function applySort(rows, sortColumn, sortOrder = 'asc') {
  const source = Array.isArray(rows) ? [...rows] : [];
  const column = normalizeText(sortColumn);
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
  const cols = Array.isArray(selectedColumns) ? selectedColumns : [];
  if (cols.length === 0) {
    const headers = Object.keys(source[0] || {});
    return { headers, rows: source };
  }

  const projected = source.map((row) => {
    const out = {};
    for (const col of cols) {
      out[col] = row?.[col];
    }
    return out;
  });

  return { headers: cols, rows: projected };
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
