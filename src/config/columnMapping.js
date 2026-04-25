export const DATABASE_TYPES = {
  MEN_MATERIAL: 'MEN_MATERIAL',
  GAYLE_LACE: 'GAYLE_LACE'
};

const TYPE_COLUMN_ALIAS = {
  [DATABASE_TYPES.MEN_MATERIAL]: {
    MARKA: ['Marka', 'MARKA_CODE'],
    STAGE: ['STAGE NIG', 'STAGE SSS', 'STAGE', 'Remarks', 'Shipment Status'],
    QTY: ['Quantity', 'TOTAL_ORDER'],
    PRODUCT_CATEGORY: ['Category', 'PRODUCT_CATEGORY'],
    OUTLET: ['Consignee', 'Party Name', 'OUTLET_NAME'],
    BRAND: ['Brand', 'PRODUCT_NAME']
  },
  [DATABASE_TYPES.GAYLE_LACE]: {
    MARKA: ['MARKA_CODE', 'Marka'],
    STAGE: ['STAGE', 'STAGE NIG', 'STAGE SSS', 'Remarks', 'Shipment Status'],
    QTY: ['TOTAL_ORDER', 'Quantity'],
    PRODUCT_CATEGORY: ['PRODUCT_CATEGORY', 'Category'],
    OUTLET: ['OUTLET_NAME', 'Consignee', 'Party Name'],
    BRAND: ['PRODUCT_NAME', 'Brand']
  }
};

function normalizeKey(key = '') {
  return String(key).trim().toUpperCase();
}

function getAliasList(canonicalKey, databaseType) {
  const key = normalizeKey(canonicalKey);
  const type = normalizeDatabaseType(databaseType);
  return TYPE_COLUMN_ALIAS[type]?.[key] || [];
}

function findRecordValue(rawRecord = {}, aliases = []) {
  for (const alias of aliases) {
    if (Object.hasOwn(rawRecord, alias)) {
      return rawRecord[alias];
    }
  }
  return '';
}

export function normalizeDatabaseType(type) {
  const t = normalizeKey(type);
  if (t === DATABASE_TYPES.MEN_MATERIAL) return DATABASE_TYPES.MEN_MATERIAL;
  return DATABASE_TYPES.GAYLE_LACE;
}

export function resolveCanonicalValue(rawRecord, canonicalKey) {
  return findRecordValue(rawRecord, getAliasList(canonicalKey));
}

function pickFirstNonEmpty(values = []) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function resolveStageWithPriority(databaseType, rawRecord = {}) {
  const type = normalizeDatabaseType(databaseType);

  if (type === DATABASE_TYPES.MEN_MATERIAL) {
    // MEN MATERIAL priority: STAGE NIG > STAGE SSS > STAGE
    return pickFirstNonEmpty([
      rawRecord['STAGE NIG'],
      rawRecord['STAGE SSS'],
      rawRecord['STAGE'],
      rawRecord['Remarks'],
      rawRecord['Shipment Status']
    ]);
  }

  return pickFirstNonEmpty([
    rawRecord['STAGE'],
    rawRecord['STAGE NIG'],
    rawRecord['STAGE SSS'],
    rawRecord['Remarks'],
    rawRecord['Shipment Status']
  ]);
}

export function getDynamicFilterFields(databaseType) {
  const type = normalizeDatabaseType(databaseType);

  if (type === DATABASE_TYPES.MEN_MATERIAL) {
    return [
      { key: 'MARKA', label: 'Marka' },
      { key: 'STAGE', label: 'STAGE NIG / STAGE SSS' }
    ];
  }

  return [
    { key: 'MARKA', label: 'MARKA_CODE' },
    { key: 'STAGE', label: 'STAGE' },
    { key: 'PRODUCT_CATEGORY', label: 'PRODUCT_CATEGORY (Gayle/Lace)' }
  ];
}

export function mapSourceRecordToUnified(rawRecord = {}, databaseType = DATABASE_TYPES.GAYLE_LACE) {
  const type = normalizeDatabaseType(databaseType);
  const status = resolveStageWithPriority(type, rawRecord);

  return {
    marka: findRecordValue(rawRecord, getAliasList('MARKA', type)),
    status,
    shipment_status: status,
    quantity: findRecordValue(rawRecord, getAliasList('QTY', type)),
    category: findRecordValue(rawRecord, getAliasList('PRODUCT_CATEGORY', type)),
    party_name: findRecordValue(rawRecord, getAliasList('OUTLET', type)),
    brand: findRecordValue(rawRecord, getAliasList('BRAND', type))
  };
}

export function formatDatabaseLabel(database) {
  if (!database) return 'Unknown Database';
  const type = normalizeDatabaseType(database.type);
  return `${database.name} (${type === DATABASE_TYPES.MEN_MATERIAL ? 'MEN_MATERIAL' : 'GAYLE_LACE'})`;
}
