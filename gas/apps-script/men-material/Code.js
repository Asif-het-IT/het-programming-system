/********************************************************************
  Smart-Serial + Completed-Mover + Multi-View Sync (SINGLE SCRIPT)
  Author : (het) Asif Ali
  Version: V4.0 - FINAL (Updated)
---------------------------------------------------------------------
  Features (ALL LOGICS PRESERVED):
  1) LAST Remarks = "Completed" → row Completed sheet me move
  2) Smart Serial → Column B filled ho to hi Column A me SR
  3) Old + New data par auto rebuild
  4) Multi-View sync from "settings" sheet
  5) Cache + Lock for speed & safety
  6) Manual menu support
  7) Auto formulas applied row-level for N, P, R, U columns
  8) SYNC ONLY DATA (NO formatting/borders/colors) ✅
********************************************************************/

/* ================= GLOBAL CACHE & LOCK ================= */
const CACHE = CacheService.getScriptCache();
const LOCK  = LockService.getScriptLock();

let SERIAL_COL = 0;      // Column A
let TRIGGER_COL = 1;     // Column B
let REMARKS_COL = -1;    // LAST Remarks

/* ================= UTILS ================= */
function indexToColumn(i){
  let c='',n=i+1;
  while(n>0){ c=String.fromCharCode(65+(n-1)%26)+c; n=Math.floor((n-1)/26); }
  return c;
}

/* ================= COLUMN DETECTION ================= */
function detectColumns(headers){
  SERIAL_COL  = headers.findIndex(h=>/serial|s\.?no/i.test(String(h)));
  if(SERIAL_COL===-1) SERIAL_COL=0;

  TRIGGER_COL = headers.findIndex(h=>/trigger|action/i.test(String(h)));
  if(TRIGGER_COL===-1) TRIGGER_COL=1;

  REMARKS_COL = -1;
  for(let i=headers.length-1;i>=0;i--){
    if(/remarks|comment/i.test(String(headers[i]))){ REMARKS_COL=i; break; }
  }
  if(REMARKS_COL===-1) REMARKS_COL=headers.length-1;

  CACHE.put('cols',JSON.stringify({
    SERIAL_COL,TRIGGER_COL,REMARKS_COL,headerCount:headers.length
  }),21600);
}

function loadCachedColumns(sheet){
  const c=CACHE.get('cols');
  if(!c) return false;
  const d=JSON.parse(c);
  const h=sheet.getRange(1,1,1,d.headerCount).getValues()[0];
  if(h.length!==d.headerCount) return false;
  SERIAL_COL=d.SERIAL_COL; TRIGGER_COL=d.TRIGGER_COL; REMARKS_COL=d.REMARKS_COL;
  return true;
}

/* ================= SMART SERIAL ================= */
function applySmartSerial(values){
  let sr=1;
  for(let r=1;r<values.length;r++){
    const v=String(values[r][TRIGGER_COL]||'').trim();
    values[r][SERIAL_COL]=v?sr++:'';
  }
  return values;
}

/* ================= COMPLETED MOVER ================= */
/**
 * NOTE: Completed mover abhi formatting preserve karta hai (aapka original logic).
 * User ne sirf SYNC data-only bola tha, completed move ke liye restriction nahi di.
 * Agar aap chaho to moveCompleted ko bhi data-only bana dunga.
 */
function moveCompleted(){
  const ss=SpreadsheetApp.getActive();
  const db=ss.getSheetByName('Database');
  if(!db) return;

  let comp=ss.getSheetByName('Completed');
  if(!comp) comp=ss.insertSheet('Completed');

  const rng=db.getDataRange();
  const vals=rng.getValues();
  if(vals.length<=1) return;

  if(!loadCachedColumns(db)) detectColumns(vals[0]);

  const fmts={
    n:rng.getNumberFormats(), b:rng.getBackgrounds(),
    fw:rng.getFontWeights(), fs:rng.getFontStyles(), fc:rng.getFontColors()
  };

  const keep=[vals[0]], move=[];
  const keepFmt={n:[fmts.n[0]],b:[fmts.b[0]],fw:[fmts.fw[0]],fs:[fmts.fs[0]],fc:[fmts.fc[0]]};

  for(let r=1;r<vals.length;r++){
    const remark=String(vals[r][REMARKS_COL]||'').trim().toLowerCase();
    if(remark==='completed') {
      move.push({row:vals[r],fmt:{
        n:fmts.n[r],b:fmts.b[r],fw:fmts.fw[r],fs:fmts.fs[r],fc:fmts.fc[r]
      }});
    } else {
      keep.push(vals[r]);
      keepFmt.n.push(fmts.n[r]); keepFmt.b.push(fmts.b[r]);
      keepFmt.fw.push(fmts.fw[r]); keepFmt.fs.push(fmts.fs[r]); keepFmt.fc.push(fmts.fc[r]);
    }
  }

  if(move.length){
    if(comp.getLastRow()===0){
      comp.getRange(1,1,1,vals[0].length).setValues([vals[0]]);
    }
    let sr=comp.getLastRow();
    const mVals=[],mN=[],mB=[],mFW=[],mFS=[],mFC=[];
    move.forEach((o,i)=>{
      const r=o.row.slice(); r[SERIAL_COL]=sr+i;
      mVals.push(r); mN.push(o.fmt.n); mB.push(o.fmt.b);
      mFW.push(o.fmt.fw); mFS.push(o.fmt.fs); mFC.push(o.fmt.fc);
    });
    const st=comp.getLastRow()+1;
    comp.getRange(st,1,mVals.length,mVals[0].length).setValues(mVals)
      .setNumberFormats(mN).setBackgrounds(mB)
      .setFontWeights(mFW).setFontStyles(mFS).setFontColors(mFC);
  }

  const finalVals=applySmartSerial(keep);
  db.clearContents();
  db.getRange(1,1,finalVals.length,finalVals[0].length).setValues(finalVals)
    .setNumberFormats(keepFmt.n).setBackgrounds(keepFmt.b)
    .setFontWeights(keepFmt.fw).setFontStyles(keepFmt.fs).setFontColors(keepFmt.fc);
}

/* ================= MAIN ENGINE (SYNC DATA ONLY) ================= */
function refreshAllViewsPro(){
  if(!LOCK.tryLock(10000)) return;
  try{
    const ss=SpreadsheetApp.getActive();
    const db=ss.getSheetByName('Database');
    const set=ss.getSheetByName('settings');
    if(!db||!set) return;

    // 1) Move completed first
    moveCompleted();

    // 2) Reload Database data after move
    const data=db.getDataRange().getValues();
    if(data.length<=1) return;

    const headers=data[0], rows=data.slice(1);
    if(!loadCachedColumns(db)) detectColumns(headers);

    // Column letter -> index map (A,B,C...)
    const colMap={}; headers.forEach((_,i)=>colMap[indexToColumn(i)]=i);

    const settings=set.getDataRange().getValues();

    for(let i=1;i<settings.length;i++){
      try{
        const [name,url,sheetName,colsRaw,filterCol,filterCond]=settings[i];
        if(!url||!colsRaw) continue;

        // columns list
        const cols=[...new Set(String(colsRaw).split(',').map(c=>c.trim().toUpperCase()).filter(Boolean))];

        // resolve each col token:
        // - if token is a letter (A,B,AA...) => colMap
        // - else treat as header name match
        const idx = cols
          .map(c => {
            if(colMap[c] !== undefined) return colMap[c];
            const hi = headers.findIndex(h => String(h).trim().toUpperCase() === c);
            return hi;
          })
          .filter(n => n !== -1); // ✅ guard missing columns

        if(idx.length===0) continue;

        // Optional filter column index (by header name)
        let f = -1;
        if(filterCol){
          f = headers.findIndex(h => String(h).trim().toLowerCase() === String(filterCol).trim().toLowerCase());
        }

        // build output
        const out = [ idx.map(j => headers[j]) ];
        for(const r of rows){
          if(f !== -1 && String(filterCond||'') !== ''){
            if(String(r[f]) !== String(filterCond)) continue;
          }
          out.push(idx.map(j => r[j] ?? ''));
        }

        // open target spreadsheet
        const tss=SpreadsheetApp.openByUrl(url);

        // Write to destination sheet (DATA ONLY)
        let ts = sheetName ? tss.getSheetByName(sheetName) : null;
        if(!ts) ts = tss.getSheets()[0];

        // Clear ONLY contents (no format/borders/colors disturb)
        // Also clear old extra area (starting row 5)
        const startRow = 5;
        const lastRow = ts.getLastRow();
        const lastCol = ts.getLastColumn();
        if(lastRow >= startRow && lastCol > 0){
          ts.getRange(startRow,1,lastRow-startRow+1,lastCol).clearContent();
        }

        // Write data at row 5
        ts.getRange(startRow,1,out.length,out[0].length).setValues(out);

        // Freeze top 5 rows as per your logic
        ts.setFrozenRows(5);

      }catch(e){
        // silent by design (your original behavior)
      }
    }

  }finally{
    LOCK.releaseLock();
  }
}

/* ================= MENU ================= */
function onOpen(){
  SpreadsheetApp.getUi().createMenu('het Tools')
    .addItem('Run Completed + Sync','refreshAllViewsPro')
    .addToUi();
}

/********************************************************************
  Row-Level Formulas - Auto Apply on Edit
********************************************************************/
function applyFormulasOnEdit(e) {
  const sh = e.range.getSheet();
  if(sh.getName() !== 'Database' || e.range.getRow() <= 1) return;

  const row = e.range.getRow();
  const COL_N = 14; // N
  const COL_P = 16; // P
  const COL_R = 18; // R
  const COL_U = 21; // U

  // N : Quantity
  sh.getRange(row, COL_N).setFormulaR1C1(`=IF(OR(RC[-4]="",RC[-1]=""),"",RC[-4]*RC[-1])`);
  // P : Amount USD
  sh.getRange(row, COL_P).setFormulaR1C1(`=IF(OR(RC[-2]="",RC[-1]=""),"",RC[-2]*RC[-1])`);
  // R : Total Box
  sh.getRange(row, COL_R).setFormulaR1C1(`=IF(OR(RC[-4]="",RC[-1]=""),"",RC[-4]*1.0936/RC[-1])`);
  // U : Over Due if any
  sh.getRange(row, COL_U).setFormulaR1C1(`=IF(OR(RC[-1]="",RC[-2]=""),"",DAYS360(RC[-1],RC[-2]))`);
}

/* ================= SINGLE onEdit (FINAL) ================= */
/**
 * FIXED: Ab duplicate onEdit nahi hai.
 * 1) Row formulas apply
 * 2) Agar Remarks="Completed" ya Trigger/Action column edit ho => refreshAllViewsPro()
 */
function onEdit(e){
  const sh = e.range.getSheet();
  if(sh.getName() !== 'Database' || e.range.getRow() <= 1) return;

  // 1) Apply formulas on edited row
  applyFormulasOnEdit(e);

  // 2) Detect/load columns
  if(!loadCachedColumns(sh)){
    detectColumns(sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]);
  }

  // 3) Trigger sync conditions
  const col = e.range.getColumn() - 1;
  const val = String(e.value || '').trim().toLowerCase();

  if((col === REMARKS_COL && val === 'completed') || col === TRIGGER_COL){
    Utilities.sleep(150);
    refreshAllViewsPro();
  }
}


/***************************************************************
 BRIDGE API LAYER (SAFE APPEND - DO NOT TOUCH EXISTING LOGIC)
 Non-intrusive layer for cPanel PHP bridge contract
***************************************************************/

/* ===== Bridge config ===== */
const BRIDGE = {
  TIMEZONE: Session.getScriptTimeZone() || 'Asia/Dubai',

  // Default working source mappings
  SOURCES: {
    primary_database: {
      spreadsheetId: '12S3pUeOsetXZBfEx9B2YwLaHxp1684ZD5whuLxBzFiE',
      sheetName: 'Database'
    },
    database: {
      spreadsheetId: '12S3pUeOsetXZBfEx9B2YwLaHxp1684ZD5whuLxBzFiE',
      sheetName: 'Database'
    },
    men_material_master_database: {
      spreadsheetId: '12S3pUeOsetXZBfEx9B2YwLaHxp1684ZD5whuLxBzFiE',
      sheetName: 'Database'
    }
  },

  DEFAULT_SOURCE_KEY: 'primary_database'
};

/* ===== Required entry points ===== */
function doGet(e) {
  return BRIDGE_handleRequest_('GET', e);
}

function doPost(e) {
  return BRIDGE_handleRequest_('POST', e);
}

/* ===== Main router ===== */
function BRIDGE_handleRequest_(method, e) {
  const route = BRIDGE_getRoute_(e);
  const body = BRIDGE_parseBody_(e);

  try {
    BRIDGE_validateToken_(e, body);

    if (method === 'GET' && route === 'dashboard') {
      return BRIDGE_json_(200, { data: BRIDGE_dashboard_(e) });
    }

    if (method === 'GET' && route === 'records') {
      return BRIDGE_json_(200, { data: BRIDGE_records_(e) });
    }

    if (method === 'GET' && route === 'product-names') {
      return BRIDGE_json_(200, { data: BRIDGE_productNames_(e) });
    }

    if (method === 'GET' && route === 'view-config') {
      return BRIDGE_json_(200, { data: BRIDGE_viewConfig_(e) });
    }

    if (method === 'GET' && route === 'view-output') {
      return BRIDGE_json_(200, { data: BRIDGE_viewOutput_(e) });
    }

    if (method === 'POST' && route === 'save-entry') {
      return BRIDGE_json_(200, { data: BRIDGE_saveEntry_(e, body) });
    }

    return BRIDGE_json_(404, {
      error: 'Unknown endpoint',
      data: {
        route: route,
        allowed_routes: ['dashboard', 'records', 'product-names', 'view-config', 'view-output', 'save-entry']
      }
    });

  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    const status = msg === 'Unauthorized API token.' ? 401 : 500;

    return BRIDGE_json_(status, {
      error: msg,
      data: { route: route || '' }
    });
  }
}

/* ===== Route + token ===== */
function BRIDGE_getRoute_(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const api = String(p.api || '').trim().toLowerCase();
  if (api) return api;

  const pathInfo = (e && e.pathInfo) ? String(e.pathInfo).replace(/^\/+|\/+$/g, '').toLowerCase() : '';
  return pathInfo;
}

function BRIDGE_readToken_(e, body) {
  const p = (e && e.parameter) ? e.parameter : {};
  body = body || {};
  return String(p.token || body.token || '').trim();
}

function BRIDGE_validateToken_(e, body) {
  const provided = BRIDGE_readToken_(e, body);
  const expected = String(
    PropertiesService.getScriptProperties().getProperty('API_TOKEN') || ''
  ).trim();

  if (!expected) {
    throw new Error('Bridge token is not configured.');
  }

  if (!provided || provided !== expected) {
    throw new Error('Unauthorized API token.');
  }
}

/* ===== JSON response shape expected by PHP ===== */
function BRIDGE_json_(status, payload) {
  payload = payload || {};
  const out = {
    ok: status >= 200 && status < 300,
    status: status,
    timestamp: Utilities.formatDate(new Date(), BRIDGE.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"),
    data: payload.data || {},
    error: payload.error || null
  };
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ===== Source resolution by sheet_key ===== */
function BRIDGE_resolveSource_(sheetKey) {
  const key = String(sheetKey || BRIDGE.DEFAULT_SOURCE_KEY).trim().toLowerCase();
  const source = BRIDGE.SOURCES[key] || BRIDGE.SOURCES[BRIDGE.DEFAULT_SOURCE_KEY];
  if (!source) throw new Error('No source mapping found.');

  return {
    sheetKey: key || BRIDGE.DEFAULT_SOURCE_KEY,
    spreadsheetId: source.spreadsheetId,
    sheetName: source.sheetName
  };
}

function BRIDGE_openSourceSheet_(sheetKey) {
  const src = BRIDGE_resolveSource_(sheetKey);
  const ss = SpreadsheetApp.openById(src.spreadsheetId);
  const sh = ss.getSheetByName(src.sheetName);
  if (!sh) throw new Error('Source sheet not found: ' + src.sheetName);

  return { ss: ss, sh: sh, src: src };
}

/* ===== Parse body ===== */
function BRIDGE_parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    const x = JSON.parse(e.postData.contents);
    return (x && typeof x === 'object') ? x : {};
  } catch (_err) {
    return {};
  }
}

/* ===== Helpers ===== */
function BRIDGE_text_(v) {
  return String(v == null ? '' : v).trim();
}

function BRIDGE_num_(v) {
  if (v === '' || v == null) return 0;
  const n = Number(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
}

function BRIDGE_parseCsv_(value) {
  return String(value == null ? '' : value)
    .split(',')
    .map(function (x) { return x.trim(); })
    .filter(function (x) { return x !== ''; });
}

function BRIDGE_letterToIndex_(token) {
  const t = String(token || '').trim().toUpperCase();
  if (!/^[A-Z]+$/.test(t)) return -1;

  let n = 0;
  for (let i = 0; i < t.length; i++) {
    n = n * 26 + (t.charCodeAt(i) - 64);
  }
  return n - 1;
}

function BRIDGE_expandRangeToken_(token) {
  const parts = String(token || '').split(':').map(function (x) { return x.trim().toUpperCase(); });
  if (parts.length !== 2) return [token];

  const start = BRIDGE_letterToIndex_(parts[0]);
  const end = BRIDGE_letterToIndex_(parts[1]);
  if (start < 0 || end < 0) return [token];

  const out = [];
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  for (let i = lo; i <= hi; i++) {
    let num = i + 1;
    let letter = '';
    while (num > 0) {
      const rem = (num - 1) % 26;
      letter = String.fromCharCode(65 + rem) + letter;
      num = Math.floor((num - 1) / 26);
    }
    out.push(letter);
  }
  return out;
}

function BRIDGE_parseColumnsAdvanced_(raw, headers) {
  const sourceHeaders = Array.isArray(headers) ? headers : [];
  const tokens = BRIDGE_parseCsv_(raw)
    .map(function (token) { return token.toUpperCase(); })
    .reduce(function (acc, token) {
      if (token.indexOf(':') !== -1) {
        return acc.concat(BRIDGE_expandRangeToken_(token));
      }
      acc.push(token);
      return acc;
    }, []);

  const indexes = [];
  for (let i = 0; i < tokens.length; i++) {
    const idx = BRIDGE_letterToIndex_(tokens[i]);
    if (idx >= 0 && idx < sourceHeaders.length) {
      indexes.push(idx);
    }
  }

  return indexes.filter(function (v, i, a) { return a.indexOf(v) === i; });
}

function BRIDGE_readSettingsRows_() {
  const set = SpreadsheetApp.getActive().getSheetByName('settings');
  if (!set) return [];

  const rows = set.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const viewName = BRIDGE_text_(row[0]);
    const url = BRIDGE_text_(row[1]);
    const sheetName = BRIDGE_text_(row[2]);
    const columnsRaw = BRIDGE_text_(row[3]);
    const filterRaw = BRIDGE_text_(row[4]);
    const filterValueRaw = BRIDGE_text_(row[5]);

    if (!viewName && !url && !sheetName && !columnsRaw && !filterRaw && !filterValueRaw) {
      continue;
    }

    out.push({
      view: viewName,
      url: url,
      sheetName: sheetName,
      columnsRaw: columnsRaw,
      columnsList: BRIDGE_parseCsv_(columnsRaw),
      filterColumns: BRIDGE_parseCsv_(filterRaw),
      filterValues: BRIDGE_parseCsv_(filterValueRaw)
    });
  }

  return out;
}

function BRIDGE_viewConfig_(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const requestedView = BRIDGE_text_(p.view);
  const configs = BRIDGE_readSettingsRows_();

  const filtered = requestedView
    ? configs.filter(function (cfg) { return cfg.view === requestedView; })
    : configs;

  return {
    source: {
      spreadsheet_id: SpreadsheetApp.getActive().getId(),
      sheet_name: 'settings'
    },
    view: requestedView || null,
    count: filtered.length,
    configs: filtered
  };
}

function BRIDGE_viewOutput_(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const requestedView = BRIDGE_text_(p.view);
  if (!requestedView) {
    throw new Error('view is required for view-output');
  }

  const configs = BRIDGE_readSettingsRows_();
  const cfg = configs.find(function (x) { return x.view === requestedView; });
  if (!cfg) {
    throw new Error('View config not found in settings: ' + requestedView);
  }

  const recordsRes = BRIDGE_records_({ parameter: { view: cfg.view } });
  const sourceRows = Array.isArray(recordsRes.records) ? recordsRes.records : [];
  const sourceHeaders = sourceRows.length ? Object.keys(sourceRows[0]) : [];

  const selectedIndexes = BRIDGE_parseColumnsAdvanced_((cfg.columnsList || []).join(','), sourceHeaders);
  const selectedHeaders = selectedIndexes.length
    ? selectedIndexes.map(function (i) { return sourceHeaders[i]; })
    : sourceHeaders.slice();

  const rows = sourceRows.map(function (srcRow) {
    const out = {};
    for (let i = 0; i < selectedHeaders.length; i++) {
      const key = selectedHeaders[i];
      out[key] = srcRow[key];
    }
    return out;
  }).filter(function (row) {
    for (let i = 0; i < selectedHeaders.length; i++) {
      if (BRIDGE_text_(row[selectedHeaders[i]]) !== '') return true;
    }
    return false;
  });

  return {
    view: requestedView,
    headers: selectedHeaders,
    records: rows,
    count: rows.length,
    config: cfg,
    source: recordsRes.source || null
  };
}

function BRIDGE_toObjects_(sh) {
  const rng = sh.getDataRange();
  const vals = rng.getValues();
  if (vals.length <= 1) return { headers: vals[0] || [], rows: [] };

  const headers = vals[0].map(h => BRIDGE_text_(h));
  const rows = [];

  for (let r = 1; r < vals.length; r++) {
    const row = vals[r];
    let has = false;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const k = headers[c];
      if (!k) continue;
      const v = row[c];
      if (v !== '' && v != null) has = true;
      obj[k] = v instanceof Date
        ? Utilities.formatDate(v, BRIDGE.TIMEZONE, 'yyyy-MM-dd')
        : v;
    }
    if (has) rows.push(obj);
  }

  return { headers: headers, rows: rows };
}

function BRIDGE_findHeader_(headers, regex) {
  for (let i = 0; i < headers.length; i++) {
    if (regex.test(String(headers[i] || ''))) return headers[i];
  }
  return '';
}

function BRIDGE_applyFilters_(rows, headers, params) {
  const marka = BRIDGE_text_(params.marka).toUpperCase();
  const status = BRIDGE_text_(params.status).toUpperCase();
  const search = BRIDGE_text_(params.search).toUpperCase();
  const view = BRIDGE_text_(params.view);

  const markaKey = BRIDGE_findHeader_(headers, /^marka([_\s-]*code)?$/i) || 'Marka';
  const stageKey = BRIDGE_findHeader_(headers, /^(stage|status|remarks)$/i) || 'Remarks';

  let out = rows.slice();

  if (view) {
    try {
      const set = SpreadsheetApp.getActive().getSheetByName('settings');
      if (set) {
        const svals = set.getDataRange().getValues();
        for (let i = 1; i < svals.length; i++) {
          const name = BRIDGE_text_(svals[i][0]);
          const filterCol = BRIDGE_text_(svals[i][4]);
          const filterCond = BRIDGE_text_(svals[i][5]);
          if (name && name === view && filterCol && filterCond) {
            out = out.filter(r => BRIDGE_text_(r[filterCol]) === filterCond);
            break;
          }
        }
      }
    } catch (_ignore) {}
  }

  if (marka) {
    out = out.filter(r => BRIDGE_text_(r[markaKey]).toUpperCase() === marka);
  }

  if (status) {
    out = out.filter(r => BRIDGE_text_(r[stageKey]).toUpperCase() === status);
  }

  if (search) {
    out = out.filter(r => {
      for (const k in r) {
        if (BRIDGE_text_(r[k]).toUpperCase().indexOf(search) !== -1) return true;
      }
      return false;
    });
  }

  return { rows: out, markaKey: markaKey, stageKey: stageKey };
}

/* ===== api=records ===== */
function BRIDGE_records_(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const sheetKey = BRIDGE_text_(p.sheet_key || BRIDGE.DEFAULT_SOURCE_KEY);

  const opened = BRIDGE_openSourceSheet_(sheetKey);
  const parsed = BRIDGE_toObjects_(opened.sh);
  const filtered = BRIDGE_applyFilters_(parsed.rows, parsed.headers, p);

  return {
    source: {
      sheet_key: opened.src.sheetKey,
      spreadsheet_id: opened.src.spreadsheetId,
      sheet_name: opened.src.sheetName
    },
    filters: {
      view: BRIDGE_text_(p.view),
      marka: BRIDGE_text_(p.marka),
      status: BRIDGE_text_(p.status),
      search: BRIDGE_text_(p.search)
    },
    count: filtered.rows.length,
    records: filtered.rows,
    items: filtered.rows
  };
}

/* ===== api=dashboard ===== */
function BRIDGE_dashboard_(e) {
  const rec = BRIDGE_records_(e);

  const byStage = {};
  const byMarka = {};
  let totalOrder = 0;

  for (let i = 0; i < rec.records.length; i++) {
    const row = rec.records[i];
    const stage = BRIDGE_text_(row.STAGE || row.STATUS || row.Remarks || 'UNKNOWN');
    const marka = BRIDGE_text_(row.MARKA_CODE || row.Marka || 'UNKNOWN');
    const order = BRIDGE_num_(row.TOTAL_ORDER || row.Quantity);

    byStage[stage] = (byStage[stage] || 0) + 1;
    byMarka[marka] = (byMarka[marka] || 0) + 1;
    totalOrder += order;
  }

  return {
    source: rec.source,
    filters: rec.filters,
    summary: {
      total_rows: rec.count,
      total_order: totalOrder,
      by_stage: byStage,
      by_marka: byMarka
    }
  };
}

/* ===== api=product-names ===== */
function BRIDGE_productNames_(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const category = BRIDGE_text_(p.category).toUpperCase();
  const sheetKey = BRIDGE_text_(p.sheet_key || BRIDGE.DEFAULT_SOURCE_KEY);

  const opened = BRIDGE_openSourceSheet_(sheetKey);
  const parsed = BRIDGE_toObjects_(opened.sh);

  const catKey = BRIDGE_findHeader_(parsed.headers, /^product[_\s-]*category$/i) || 'Category';
  const nameKey = BRIDGE_findHeader_(parsed.headers, /^product[_\s-]*name$/i) || 'Brand';

  const uniq = {};
  parsed.rows.forEach(r => {
    const c = BRIDGE_text_(r[catKey]).toUpperCase();
    const n = BRIDGE_text_(r[nameKey]);
    if (!n) return;
    if (category && c !== category) return;
    uniq[n] = true;
  });

  const items = Object.keys(uniq).sort();

  return {
    source: {
      sheet_key: opened.src.sheetKey,
      spreadsheet_id: opened.src.spreadsheetId,
      sheet_name: opened.src.sheetName
    },
    category: category,
    count: items.length,
    items: items
  };
}

/* ===== api=save-entry ===== */
function BRIDGE_saveEntry_(e, body) {
  body = body || {};
  const p = (e && e.parameter) ? e.parameter : {};

  const requestedSheetKey = BRIDGE_text_(
    body.sheet_key || p.sheet_key || BRIDGE.DEFAULT_SOURCE_KEY
  );
  const opened = BRIDGE_openSourceSheet_(requestedSheetKey);
  const sh = opened.sh;

  let record = {};
  if (body.record && typeof body.record === 'object') {
    record = body.record;
  } else {
    record = Object.assign({}, body);
  }

  delete record.api;
  delete record.token;
  delete record.sheet_key;
  delete record.record;

  const lastCol = sh.getLastColumn();
  if (lastCol < 1) throw new Error('Source sheet header missing.');

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => BRIDGE_text_(h));
  const row = headers.map(h => (record[h] != null ? record[h] : ''));

  const l = LockService.getScriptLock();
  l.waitLock(30000);
  try {
    sh.appendRow(row);
  } finally {
    l.releaseLock();
  }

  return {
    saved: true,
    source: {
      sheet_key: opened.src.sheetKey,
      spreadsheet_id: opened.src.spreadsheetId,
      sheet_name: opened.src.sheetName
    },
    appended_row_number: sh.getLastRow(),
    record: record
  };
}

/* ===== Run once manually to set production token in Script Properties ===== */
function BRIDGE_setToken() {
  PropertiesService.getScriptProperties().setProperty(
    'API_TOKEN',
    'lgp_live_prod_G7k9mQ2xR8vT1nY4pL6sD3fH0jK5wZcB9uN2eM7a'
  );
}

