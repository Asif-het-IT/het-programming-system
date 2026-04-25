/**
 * Google Sheets Bridge Sync Service
 * Uses fetch() only — no Base44 dependency
 * Replaced: base44.entities.Order → localDB.Order
 */
import { localDB } from "@/api/localDB";
import { mapSourceRecordToUnified } from "@/config/columnMapping";
import { Logger } from "@/lib/logger";

const SYNC_LOCKS = new Set();
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRIES = 2;

export function mapRowToOrder(headerRow, row, databaseType = 'GAYLE_LACE') {
  const obj = {};
  headerRow.forEach((h, i) => {
    const key = String(h || "").trim();
    if (key) obj[key] = row[i] ?? "";
  });

  const unified = mapSourceRecordToUnified(obj, databaseType);

  return {
    sr: parseNum(obj["SR"]),
    category: unified.category || obj["Category"] || obj["PRODUCT_CATEGORY"] || "",
    range: obj["Range"] || "",
    brand: unified.brand || obj["Brand"] || obj["PRODUCT_NAME"] || "",
    marka: unified.marka || obj["Marka"] || obj["MARKA_CODE"] || "",
    party_name: unified.party_name || obj["Party Name"] || obj["OUTLET_NAME"] || "",
    consignee: obj["Consignee"] || "",
    contract_date: obj["Contarct Date"] || obj["Contract Date"] || "",
    contract_num: obj["Contarct Num"] || obj["Contract Num"] || "",
    dsn: parseNum(obj["DSN"]),
    shades: parseNum(obj["Shades"]),
    shades_qty: parseNum(obj["Shades Qty"]),
    per_dsn_qty: parseNum(obj["Per Dsn Qty"]),
    quantity: parseNum(unified.quantity || obj["Quantity"] || obj["TOTAL_ORDER"]),
    price_usd: parseNum(obj["Price Usd"]),
    amount_usd: parseNum(obj["Amount In Usd"]),
    per_box: parseNum(obj["Per Box"]),
    total_box: parseNum(obj["Total Box"]),
    delivery_date: obj["Delivery Date / Contract"] || "",
    goods_ready: obj["Goods Ready"] || "",
    overdue_days: parseNum(obj["Over Due if any"]),
    shipment_arrival: obj["Shipment Arrival"] || "",
    inv_num: obj["Inv Num"] || "",
    inv_date: obj["Inv. Date"] || "",
    actual_qty: parseNum(obj["Actual Qty"]),
    actual_qty_box: parseNum(obj["Actual Qty Box"]),
    inv_amount_usd: parseNum(obj["Inv Amount USD"]),
    inv_amount_aed: parseNum(obj["Inv Amount AED"]),
    payment_due_date: obj["Paymnet Due Date"] || obj["Payment Due Date"] || "",
    payment_date: obj["Payment date"] || "",
    dxb_qty: parseNum(obj["Dxb Qty"]),
    kkk_qty: parseNum(obj["KKK Qty"]),
    sss_qty: parseNum(obj["SSS Qty"]),
    ttt_qty: parseNum(obj["TTT Qty"]),
    mmm_qty: parseNum(obj["MMM Qty"]),
    ccc_qty: parseNum(obj["CCC Qty"]),
    lll_qty: parseNum(obj["LLL Qty"]),
    status: unified.status || obj["STAGE"] || obj["STAGE NIG"] || obj["STAGE SSS"] || "",
    shipment_status: unified.shipment_status || obj["Remarks"] || obj["Shipment Status"] || obj["STAGE"] || "",
  };
}

function parseNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").replace(/[^0-9.-]/g, "").trim());
  return Number.isNaN(n) ? 0 : n;
}

async function fetchWithRetry(url, options = {}, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = {}) {
  let lastError = null;
  let attemptsUsed = 0;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    attemptsUsed = attempt + 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return { response, attemptsUsed };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      if (attempt === retries) {
        break;
      }

      const backoffMs = 300 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError || new Error('Sync request failed');
}

export async function syncFromBridge(config) {
  const {
    bridge_url,
    api_token,
    sheet_key = "primary_database",
    database_id = 'db_default',
    database_type = 'GAYLE_LACE'
  } = config;
  const lockKey = database_id || 'db_default';

  if (SYNC_LOCKS.has(lockKey)) {
    throw new Error(`Sync already running for database ${lockKey}`);
  }

  SYNC_LOCKS.add(lockKey);

  try {
  const syncStartedAt = Date.now();
  let parsedUrl;
  try {
    parsedUrl = new URL(bridge_url);
  } catch {
    throw new Error('Invalid bridge URL');
  }

  // Never send token in query params.
  parsedUrl.searchParams.delete('token');
  parsedUrl.searchParams.set('api', 'records');
  parsedUrl.searchParams.set('sheet_key', sheet_key);

  const requestHeaders = {};
  if (api_token) {
    requestHeaders.Authorization = `Bearer ${api_token}`;
  }

  const { response: res, attemptsUsed } = await fetchWithRetry(parsedUrl.toString(), { headers: requestHeaders });

  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Bridge API error");

  const records = json.data?.records || json.data?.items || [];
  if (!records.length) {
    await localDB.Order.replaceByField('database_id', database_id, []);
    Logger.info('Sync completed with empty payload', {
      database_id,
      database_type,
      count: 0,
      duration_ms: Date.now() - syncStartedAt,
      attempts_used: attemptsUsed
    });
    return { count: 0 };
  }

  const headers = Object.keys(records[0]);

  const mappedOrders = records
    .filter(r => Object.values(r).some(v => v !== "" && v !== null))
    .map(r => {
      const row = headers.map(h => r[h]);
      return {
        ...mapRowToOrder(headers, row, database_type),
        database_id,
        database_type
      };
    })
    .filter(o => o.brand || o.sr);

  // Replace active DB dataset in one write path.
  await localDB.Order.replaceByField('database_id', database_id, mappedOrders);

  Logger.info('Sync completed', {
    database_id,
    database_type,
    count: mappedOrders.length,
    duration_ms: Date.now() - syncStartedAt,
    attempts_used: attemptsUsed
  });

  return { count: mappedOrders.length };
  } finally {
    SYNC_LOCKS.delete(lockKey);
  }
}
