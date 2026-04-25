/**
 * viewConfig.js — View definitions + Google Sheet column → entity field mapping
 * IDENTICAL to original, no Base44 dependencies
 */

export function colLetterToIndex(letter) {
  let result = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    result = result * 26 + (upper.charCodeAt(i) - 64);
  }
  return result - 1;
}

export function resolveColumns(headers, columnLetters) {
  return columnLetters
    .map(letter => {
      const idx = colLetterToIndex(letter);
      return { letter, idx, header: headers[idx] || `Col ${letter}` };
    })
    .filter(c => c.idx < headers.length);
}

export function filterRowByColumns(row, allowedKeys) {
  const out = {};
  allowedKeys.forEach(k => { if (k in row) out[k] = row[k]; });
  return out;
}

export const BUILT_IN_VIEWS = [
  {
    id: "summary",
    view_name: "Summary",
    sheet_name: "DATA",
    columns: ["A", "B", "C", "D", "J", "R", "AD"],
    description: "High-level summary view"
  },
  {
    id: "brand_wise",
    view_name: "Brand Wise Report",
    sheet_name: "DATA",
    columns: ["A", "B", "D", "E", "H", "I", "J", "M", "N", "S", "T", "AY"],
    description: "Brand-wise order report"
  },
  {
    id: "management",
    view_name: "Management Report",
    sheet_name: "DATA",
    columns: ["A", "B", "D", "E", "F", "G", "H", "I", "J", "M", "N", "O", "P", "S", "T", "U", "AY"],
    description: "Full management report"
  },
  {
    id: "programming",
    view_name: "Programming View",
    sheet_name: "Sheet1",
    columns: ["A", "B", "C", "D", "E", "H", "J", "K", "L", "M", "N", "Q", "R", "S", "T", "U", "AD", "AK", "AL", "AM", "AN", "AO", "AP", "AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY"],
    description: "Full programming view"
  },
  {
    id: "fazal",
    view_name: "Fazal View",
    sheet_name: "Sheet1",
    columns: ["A", "B", "C", "D", "E", "H", "J", "K", "L", "M", "N", "Q", "R", "S", "T", "U", "AD", "AM", "AN", "AY"],
    description: "Fazal-specific view"
  },
  {
    id: "dua",
    view_name: "Dua View",
    sheet_name: "Sheet1",
    columns: ["A", "B", "C", "D", "E", "H", "J", "K", "L", "M", "N", "Q", "R", "S", "T", "U", "AD", "AM", "AN", "AW", "AX", "AY"],
    description: "Dua-specific view"
  },
  {
    id: "sattar",
    view_name: "Sattar View",
    sheet_name: "Sheet1",
    columns: ["A", "B", "C", "D", "E", "H", "J", "K", "L", "M", "N", "Q", "R", "S", "T", "U", "AD", "AO", "AP", "AY"],
    description: "Sattar-specific view"
  },
  {
    id: "dxb",
    view_name: "Dxb View",
    sheet_name: "Sheet1",
    columns: ["A", "B", "C", "D", "E", "H", "J", "K", "L", "M", "N", "Q", "R", "S", "T", "U", "AD", "AK", "AL", "AY"],
    description: "Dubai-specific view"
  },
  {
    id: "salam",
    view_name: "Salam View",
    sheet_name: "Sheet1",
    columns: ["A", "B", "C", "D", "E", "H", "J", "K", "L", "M", "N", "Q", "R", "S", "T", "U", "AD", "AO", "AP", "AS", "AT", "AY"],
    description: "Salam-specific view"
  },
  {
    id: "world",
    view_name: "World View",
    sheet_name: "Sheet1",
    columns: ["A", "B", "C", "D", "E", "H", "J", "K", "L", "M", "N", "Q", "R", "S", "T", "U", "AD", "AM", "AN", "AQ", "AR", "AY"],
    description: "World-specific view"
  },
  {
    id: "noor",
    view_name: "Noor View",
    sheet_name: "Sheet1",
    columns: ["A", "B", "C", "D", "E", "H", "J", "K", "L", "M", "N", "Q", "R", "S", "T", "U", "AD", "AM", "AN", "AY"],
    description: "Noor-specific view"
  },
  {
    id: "hope",
    view_name: "Hope View",
    sheet_name: "Sheet1",
    columns: ["A", "B", "C", "D", "E", "H", "J", "K", "L", "M", "N", "Q", "R", "S", "T", "U", "AD", "AM", "AN", "AU", "AV", "AY"],
    description: "Hope-specific view"
  },
  {
    id: "fashion_fusion",
    view_name: "Fashion Fusion View",
    sheet_name: "Sheet1",
    columns: ["A", "B", "C", "D", "E", "H", "J", "K", "L", "M", "N", "Q", "R", "S", "T", "U", "AD", "AM", "AN", "AQ", "AR", "AY"],
    description: "Fashion Fusion-specific view"
  }
];

export const SHEET_COL_TO_FIELD = {
  A: "sr",
  B: "category",
  C: "range",
  D: "brand",
  E: "marka",
  F: "party_name",
  G: "consignee",
  H: "contract_date",
  I: "contract_num",
  J: "dsn",
  K: "shades",
  L: "shades_qty",
  M: "per_dsn_qty",
  N: "quantity",
  O: "price_usd",
  P: "amount_usd",
  Q: "per_box",
  R: "total_box",
  S: "delivery_date",
  T: "goods_ready",
  U: "overdue_days",
  V: "reason",
  W: "shipment_arrival",
  X: "documents_received",
  Y: "shipment_received",
  Z: "bl_date",
  AA: "inv_num",
  AB: "inv_date",
  AC: "actual_qty",
  AD: "actual_qty_box",
  AE: "inv_amount_usd",
  AF: "inv_amount_aed",
  AG: "payment_due_date",
  AH: "payment_date",
  AI: "overdue_payment",
  AJ: "remarks",
  AK: "dxb_qty",
  AL: "dxb_arrive_date",
  AM: "kkk_qty",
  AN: "kkk_arrive_date",
  AO: "sss_qty",
  AP: "sss_arrive_date",
  AQ: "ttt_qty",
  AR: "ttt_arrive_date",
  AS: "mmm_qty",
  AT: "mmm_arrive_date",
  AU: "ccc_qty",
  AV: "ccc_arrive_date",
  AW: "lll_qty",
  AX: "lll_arrive_date",
  AY: "shipment_status",
};

export function getFieldsForView(columnLetters) {
  return columnLetters.map(c => SHEET_COL_TO_FIELD[c]).filter(Boolean);
}
