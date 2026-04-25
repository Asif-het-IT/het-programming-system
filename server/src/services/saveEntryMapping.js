function cleanText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function buildEntryId(database) {
  const prefix = database === 'MEN_MATERIAL' ? 'MEN' : 'LACE';
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

function requireFields(payload, fields) {
  const missing = fields.filter((field) => !cleanText(payload[field]));
  if (missing.length > 0) {
    throw new Error(`Missing required save-entry fields: ${missing.join(', ')}`);
  }
}

function mapMenMaterial(payload, context = {}) {
  requireFields(payload, ['PROCESS_DATE', 'PRODUCT_NAME']);

  const entryId = cleanText(payload.ENTRY_ID) || buildEntryId('MEN_MATERIAL');
  const template = context.templateRecord || {};

  const mapped = {
    'Contarct Date': cleanText(payload.PROCESS_DATE),
    Brand: cleanText(payload.PRODUCT_NAME),
    Remarks: cleanText(payload.REMARKS) || cleanText(payload.STAGE) || 'PROCESS',
    Reason: `ENTRY_ID:${entryId}`,
    'Contarct Num': cleanText(payload.CONTRACT_NO) || cleanText(payload.CONTRACT_NUMBER) || `API-${entryId}`,
    Category: cleanText(payload.CATEGORY) || cleanText(template.Category),
    Range: cleanText(payload.RANGE) || cleanText(template.Range),
    Marka: cleanText(payload.MARKA) || cleanText(template.Marka),
    'Party Name': cleanText(payload.PARTY_NAME) || cleanText(template['Party Name']),
    Consignee: cleanText(payload.CONSIGNEE) || cleanText(template.Consignee),
    Quantity: cleanText(payload.QUANTITY) || cleanText(template.Quantity),
    'Price Usd': cleanText(payload.PRICE_USD) || cleanText(template['Price Usd']),
  };

  return {
    mapped,
    metadata: {
      entryId,
      strategy: 'men-material-v1',
      templateUsed: Boolean(context.templateRecord),
      templateKeys: Object.keys(template || {}),
      visibleFieldHints: ['Contarct Date', 'Brand', 'Remarks', 'Reason', 'Contarct Num'],
    },
  };
}

function mapLaceGayle(payload) {
  requireFields(payload, ['PROCESS_DATE', 'PRODUCT_NAME']);

  const entryId = cleanText(payload.ENTRY_ID) || buildEntryId('LACE_GAYLE');

  const mapped = {
    PROCESS_DATE: cleanText(payload.PROCESS_DATE),
    PRODUCT_NAME: cleanText(payload.PRODUCT_NAME),
    REMARKS: cleanText(payload.REMARKS) || cleanText(payload.STAGE) || 'PROCESS',
    ENTRY_ID: entryId,
    STAGE: cleanText(payload.STAGE) || 'PROCESS',
  };

  return {
    mapped,
    metadata: {
      entryId,
      strategy: 'lace-gayle-v1',
      templateUsed: false,
      templateKeys: [],
      visibleFieldHints: ['PROCESS_DATE', 'PRODUCT_NAME', 'REMARKS', 'ENTRY_ID', 'STAGE'],
    },
  };
}

export function mapSaveEntryPayload({ database, payload, context = {} }) {
  const normalizedDb = cleanText(database).toUpperCase();

  if (normalizedDb === 'MEN_MATERIAL') {
    return mapMenMaterial(payload, context);
  }

  if (normalizedDb === 'LACE_GAYLE') {
    return mapLaceGayle(payload);
  }

  throw new Error(`Unsupported database mapping: ${normalizedDb || 'UNKNOWN'}`);
}
