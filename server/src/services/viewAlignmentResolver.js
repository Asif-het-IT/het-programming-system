const COLUMN_ALIASES = {
  MEN_MATERIAL: {
    MARKA_CODE: ['Marka', 'MARKA_CODE', 'MARKA CODE'],
    PRODUCT_CATEGORY: ['Category', 'PRODUCT_CATEGORY', 'PRODUCT CATEGORY'],
    PRODUCT_NAME: ['Brand', 'PRODUCT_NAME', 'PRODUCT NAME'],
    STAGE: ['Remarks', 'STAGE', 'STATUS'],
    PROCESS_DATE: ['Contarct Date', 'PROCESS_DATE', 'PROCESS DATE'],
  },
  LACE_GAYLE: {
    MARKA_CODE: ['MARKA_CODE', 'Marka', 'MARKA CODE'],
    PRODUCT_CATEGORY: ['PRODUCT_CATEGORY', 'Category', 'PRODUCT CATEGORY'],
    PRODUCT_NAME: ['PRODUCT_NAME', 'Brand', 'PRODUCT NAME'],
    STAGE: ['STAGE', 'Remarks', 'STATUS'],
    PROCESS_DATE: ['PROCESS_DATE', 'PROCESS DATE'],
  },
};

function toUpper(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeFilters(viewAlignment) {
  const rawCols = viewAlignment?.filterColumn;
  const rawVals = viewAlignment?.filterValue;

  let cols = [];
  if (Array.isArray(rawCols)) {
    cols = rawCols;
  } else if (rawCols) {
    cols = [rawCols];
  }

  let vals = [];
  if (Array.isArray(rawVals)) {
    vals = rawVals;
  } else if (rawVals) {
    vals = [rawVals];
  }

  const rules = [];
  for (let i = 0; i < Math.max(cols.length, vals.length); i += 1) {
    const col = String(cols[i] || '').trim();
    const val = String(vals[i] || '').trim();
    if (!col || !val) {
      continue;
    }
    rules.push({ column: col, value: val });
  }

  return rules;
}

function resolveColumnByTemplate(candidate, templateHeaders = []) {
  const wanted = toUpper(candidate).replaceAll(/[^A-Z0-9]/g, '');
  for (const header of templateHeaders) {
    const normalized = toUpper(header).replaceAll(/[^A-Z0-9]/g, '');
    if (normalized && normalized === wanted) {
      return header;
    }
  }
  return null;
}

function resolveColumnName(database, logicalColumn, templateHeaders = []) {
  const dbAliases = COLUMN_ALIASES[database] || {};
  const aliasList = dbAliases[toUpper(logicalColumn)] || [logicalColumn];

  for (const alias of aliasList) {
    const matched = resolveColumnByTemplate(alias, templateHeaders);
    if (matched) {
      return matched;
    }
  }

  return aliasList[0];
}

function letterToIndex(letter) {
  const clean = String(letter || '').trim().toUpperCase();
  if (!clean || /[^A-Z]/.test(clean)) {
    return -1;
  }

  let value = 0;
  for (let i = 0; i < clean.length; i += 1) {
    value = value * 26 + ((clean.codePointAt(i) || 64) - 64);
  }
  return value - 1;
}

function resolveSelectedHeaders(columnsList = [], templateHeaders = []) {
  if (!Array.isArray(columnsList) || columnsList.length === 0 || templateHeaders.length === 0) {
    return [];
  }

  const headers = [];
  for (const col of columnsList) {
    const idx = letterToIndex(col);
    if (idx >= 0 && idx < templateHeaders.length) {
      headers.push(templateHeaders[idx]);
    }
  }

  return headers;
}

export function resolveViewAlignment({ database, view, mappedPayload, templateHeaders = [], viewAlignment = null }) {
  const normalizedDb = toUpper(database);
  const payloadObject = mappedPayload && typeof mappedPayload === 'object' ? mappedPayload : null;
  const aligned = payloadObject ? { ...payloadObject } : {};

  const rules = normalizeFilters(viewAlignment);

  const appliedRules = [];
  for (const rule of rules) {
    const resolvedColumn = resolveColumnName(normalizedDb, rule.column, templateHeaders);
    aligned[resolvedColumn] = rule.value;
    appliedRules.push({
      logicalColumn: rule.column,
      resolvedColumn,
      enforcedValue: rule.value,
    });
  }

  const selectedHeaders = resolveSelectedHeaders(viewAlignment?.columnsList || [], templateHeaders);
  const selectedSet = new Set(selectedHeaders.map((h) => toUpper(h)));
  const payloadVisibleKeys = Object.keys(aligned).filter((k) => selectedSet.has(toUpper(k)));

  const visibility = {
    selectedHeaders,
    payloadVisibleKeys,
    satisfiesFilters: appliedRules.every((rule) => toUpper(aligned[rule.resolvedColumn]) === toUpper(rule.enforcedValue)),
  };

  visibility.guaranteedVisible = visibility.satisfiesFilters && (
    visibility.selectedHeaders.length === 0 || visibility.payloadVisibleKeys.length > 0
  );

  return {
    alignedPayload: aligned,
    alignment: {
      database: normalizedDb,
      view,
      resolverVersion: 'view-alignment-v1',
      viewFound: Boolean(viewAlignment),
      appliedRules,
      visibility,
    },
  };
}
