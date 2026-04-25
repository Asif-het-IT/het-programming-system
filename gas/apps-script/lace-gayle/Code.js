/**************************************************************
 het Programming System
 V2.6.2 ENTERPRISE SAAS STABLE - DB X RESTORED
 Owner  : Asif Ali
 Brand  : het
 Note   : Search key removed from code logic.
          Sirf ENTRY_ID hidden rakha gaya hai.

 INDEX - 20 SERIALS
 01) Master Config - central settings aur limits
 02) UI Menu + Web App - menu aur deploy helper
 03) Basic Helpers - chhote reusable helpers
 04) Lock + Logs Engine - concurrency aur error log
 05) Sheet Repair + Initialize - safe sheet creation/repair
 06) Setup Readers - Setup driven lists aur mappings
 07) Validation Engine - row/base validations
 08) Entry ID Engine - unique hidden id logic
 09) Compute Engine - row level auto compute
 10) Repair Engine - batch row recompute
 11) Apply Setup Engine - used rows par validations
 12) On Edit Smart Engine - lightweight live processing
 13) On Change Structural Engine - insert/delete safe
 14) Web APIs - bootstrap aur save entry
 15) Completed Move Engine - safe batch move
 16) Reports Engine - dashboard refresh
 17) Multi View Sync Engine - Settings based sync
 18) Trigger + Maintenance Engine - managed triggers
 19) Public Repair Tools - helper manual tools
 20) Compatibility Wrappers - old function aliases
**************************************************************/

/* ============================================================
 01) MASTER CONFIG
 Roman Urdu:
 Yahan app ka poora central config hai. Batch size, timeout,
 sheet names, headers aur field rules yahin define hain.
============================================================ */
const APP = Object.freeze({
  BRAND: 'het',
  OWNER: 'Asif Ali',
  APP_NAME: 'het Programming System',
  VERSION: 'V2.6.2 ENTERPRISE SAAS STABLE DB X RESTORED',
  TZ: Session.getScriptTimeZone() || 'Asia/Dubai',
  DATE_FORMAT: 'dd-MMM-yyyy',
  DATETIME_FORMAT: 'dd-MMM-yyyy hh:mm a',

  BATCH: {
    REPAIR_ROWS: 300,
    PRODUCT_VALIDATION_ROWS: 300,
    SYNC_WRITE_ROWS: 1000,
    THROTTLE_MS: 120,
    PROGRESS_EVERY_ROWS: 1000,
    MAX_RUNTIME_MS: 4.5 * 60 * 1000
  },

  LOCKS: {
    WAIT_MS: 1200,
    EDIT_WAIT_MS: 500,
    RETRIES: 4,
    BACKOFF_MS: 350
  },

  UI_PAGE_SIZE: 50,
  MIN_DB_ROWS: 500,
  LOG_LIMIT: 5000,

  SHEETS: {
    DATABASE: 'Database',
    SETUP: 'Setup',
    SETTINGS: 'Settings',
    COMPLETED: 'Completed',
    REPORTS: 'Reports',
    AUDIT: 'Audit_Log',
    ERROR: 'Error_Log'
  },

  DB_HEADERS: [
    'SR',
    'PROCESS_DATE',
    'PRODUCT_CATEGORY',
    'PRODUCT_NAME',
    'FACTORY',
    'MARKA_CODE',
    'OUTLET_NAME',
    'DESIGN_NO',
    'COLOUR_CODES',
    'COLOUR_COUNT',
    'PCS_PER_COLOUR',
    'TOTAL_ORDER',
    'TOTAL_Received',
    'READY_DATE',
    'Send_To_Tailor',
    'Recevied_From_Tailor',
    'SHIPMENT_TYPE',
    'SHIPMENT_NO',
    'DISPATCH_DATE',
    'ARRIVAL_DATE',
    'STAGE',
    'REMARKS',
    'ENTRY_ID',
    'SEARCH_KEY'
  ],

  OPTIONAL_DB_HEADERS: [],
  HIDDEN_HEADERS: ['ENTRY_ID', 'SEARCH_KEY'],

  INPUT_FIELDS: [
    'PROCESS_DATE',
    'PRODUCT_CATEGORY',
    'PRODUCT_NAME',
    'FACTORY',
    'MARKA_CODE',
    'DESIGN_NO',
    'COLOUR_CODES',
    'COLOUR_COUNT',
    'PCS_PER_COLOUR',
    'TOTAL_Received',
    'READY_DATE',
    'Send_To_Tailor',
    'Recevied_From_Tailor',
    'SHIPMENT_TYPE',
    'SHIPMENT_NO',
    'DISPATCH_DATE',
    'ARRIVAL_DATE',
    'STAGE',
    'REMARKS'
  ],

  COMPUTED_FIELDS: ['SR', 'OUTLET_NAME', 'TOTAL_ORDER', 'ENTRY_ID', 'SEARCH_KEY'],

  DATE_FIELDS: [
    'PROCESS_DATE',
    'READY_DATE',
    'Send_To_Tailor',
    'Recevied_From_Tailor',
    'DISPATCH_DATE',
    'ARRIVAL_DATE'
  ],

  NUMERIC_FIELDS: ['COLOUR_COUNT', 'PCS_PER_COLOUR', 'TOTAL_ORDER', 'TOTAL_Received'],
  PRODUCT_CATEGORIES: ['Lace', 'Gayle'],

  SETTINGS_HEADERS: [
    'NAME',
    'URL',
    'SHEET_NAME',
    'COLUMNS',
    'FILTER_COLUMN',
    'FILTER_VALUE',
    'ACTIVE',
    'START_ROW',
    'NOTES'
  ],

  AUDIT_HEADERS: ['LOG_AT', 'ACTION', 'USER_EMAIL', 'DETAILS_JSON'],
  ERROR_HEADERS: ['LOG_AT', 'FUNCTION_NAME', 'ERROR_MESSAGE', 'STACK', 'CONTEXT_JSON'],

  SETUP_DEFAULTS: {
    A1: 'LACE',
    C1: 'GAYLE',
    E1: 'MARKA_CODE',
    F1: 'OUTLET_NAME',
    I1: 'Factory Name',
    K1: 'SHIPMENT_TYPE',
    M1: 'STAGE'
  },

  COLORS: {
    primary: '#184e7a',
    secondary: '#0b5394',
    success: '#16a34a',
    warning: '#f59e0b',
    danger: '#dc2626',
    neutral: '#6b7280'
  }
});

var APP_MEMO = {};


/* ============================================================
 02) UI MENU + WEB APP (FINAL CLEAN VERSION)
 Roman Urdu:
 Yahan sirf menu aur landing page helper hai.
 API routing Section 14 handle karega.
============================================================ */

function APP_renderLandingPage_() {
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;padding:18px">' +
    `<h2 style="margin:0 0 8px;color:${APP.COLORS.primary}">${APP.APP_NAME}</h2>` +
    `<p style="margin:0 0 8px">Version: ${APP.VERSION}</p>` +
    '<p style="margin:0 0 12px;color:#555">API ready hai. React / Web frontend use kare.</p>' +
    '<p style="margin:0;color:#777">Owner: ' + APP.OWNER + '</p>' +
    '</div>'
  );

  return html
    .setTitle(`${APP.APP_NAME} | ${APP.VERSION}`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('het Programming')
    .addItem('01 - Initialize System', 'APP_initializeSystem')
    .addItem('02 - Apply Setup & Validations', 'APP_applyDatabaseSetup')
    .addItem('03 - Repair Database', 'APP_repairAllRows')
    .addItem('04 - Refresh Reports', 'APP_refreshReports')
    .addItem('05 - Move Completed', 'APP_moveCompleted')
    .addItem('06 - Manual Sync Multi Views', 'APP_runManualSync')
    .addSeparator()
    .addItem('07 - Install Triggers', 'APP_installDailyTriggers')
    .addItem('08 - Trim Logs', 'APP_trimLogs')
    .addItem('09 - Repair Settings Headers', 'APP_repairSettingsHeaders')
    .addItem('09A - Repair Dropdowns Only', 'APP_repairDropdownsOnly')
    .addItem('09B - Clear Runtime Cache', 'APP_clearRuntimeCache')
    .addSeparator()
    .addItem('10 - Open Full Screen App', 'APP_openFullScreenForm')
    .addToUi();
}

function APP_openFullScreenForm() {
  const ui = SpreadsheetApp.getUi();
  const url = ScriptApp.getService().getUrl();

  if (!url) {
    ui.alert(
      'Web app abhi deploy nahi hai.\n\n' +
      'Deploy > New deployment > Web app\n' +
      'Execute as: Me\n' +
      'Who has access: Anyone'
    );
    return;
  }

  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;padding:20px">' +
    `<h2 style="margin:0 0 8px;color:${APP.COLORS.primary}">${APP.APP_NAME}</h2>` +
    `<p style="margin:0 0 10px">${APP.VERSION}</p>` +
    `<p><a href="${url}" target="_blank" style="font-weight:bold">Open Web App</a></p>` +
    '</div>'
  ).setWidth(420).setHeight(220);

  ui.showModalDialog(html, 'Open Web App');
}

/* ============================================================
 03) BASIC HELPERS
 Roman Urdu:
 Ye chhote reusable functions hain. In se code clean aur readable rehta hai.
============================================================ */
function appText_(value) {
  return String(value == null ? '' : value).trim();
}

function appUpper_(value) {
  return appText_(value).toUpperCase();
}

function appLower_(value) {
  return appText_(value).toLowerCase();
}

function appNumber_(value) {
  if (value === '' || value == null) return '';
  const n = Number(String(value).replace(/,/g, '').trim());
  return isNaN(n) ? '' : n;
}

function appNow_() {
  return new Date();
}

function appElapsedMs_(startedAt) {
  return appNow_().getTime() - startedAt.getTime();
}

function appShouldStopForTime_(startedAt) {
  return appElapsedMs_(startedAt) >= APP.BATCH.MAX_RUNTIME_MS;
}

function appUser_() {
  try {
    return Session.getActiveUser().getEmail() || 'system@local';
  } catch (e) {
    return 'system@local';
  }
}

function appGetSS_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function appGetSheet_(name) {
  const sh = appGetSS_().getSheetByName(name);
  if (!sh) throw new Error(`Required sheet missing: ${name}`);
  return sh;
}

function appTryGetSheet_(name) {
  return appGetSS_().getSheetByName(name);
}

function appEnsureSheet_(name) {
  const ss = appGetSS_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function appSafeDate_(value) {
  if (!value) return null;

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value;
  }

  const t = String(value).trim();
  if (!t) return null;

  // Roman Urdu:
  // dd-MMM-yyyy ko explicit parse karte hain taake timezone/UTC issue na aaye.
  const m = t.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mon = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
    }[appUpper_(m[2])];
    const yyyy = Number(m[3]);
    if (mon >= 0) {
      const d1 = new Date(yyyy, mon, dd, 12, 0, 0);
      if (!isNaN(d1.getTime())) return d1;
    }
  }

  // yyyy-mm-dd browser date input format
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d2 = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0);
    if (!isNaN(d2.getTime())) return d2;
  }

  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

function appParseUiDateToDate_(value) {
  if (!value) return null;
  const d = appSafeDate_(value);
  return d || null;
}

function appFormatDate_(value) {
  const d = appSafeDate_(value);
  return d ? Utilities.formatDate(d, APP.TZ, APP.DATE_FORMAT) : '';
}

function appFormatDateTime_(value) {
  const d = appSafeDate_(value);
  return d ? Utilities.formatDate(d, APP.TZ, APP.DATETIME_FORMAT) : '';
}

function appJsonSafe_(obj) {
  try {
    return JSON.stringify(obj || {});
  } catch (e) {
    return JSON.stringify({ error: 'JSON stringify failed', message: String(e) });
  }
}

function appHeaderMap_(sheet, forceRefresh) {
  const key = String(sheet.getSheetId());
  if (!forceRefresh && APP_MEMO.headerMaps && APP_MEMO.headerMaps[key]) {
    return APP_MEMO.headerMaps[key];
  }

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(appText_);
  const map = {};
  headers.forEach(function (h, i) {
    if (h) map[h] = i + 1;
  });

  APP_MEMO.headerMaps = APP_MEMO.headerMaps || {};
  APP_MEMO.headerMaps[key] = map;
  return map;
}

function appClearRuntimeCache_() {
  APP_MEMO.setupCache = null;
  APP_MEMO.headerMaps = {};
}

function APP_clearRuntimeCache() {
  appClearRuntimeCache_();
  SpreadsheetApp.getUi().alert('Runtime cache clear ho gaya. Setup/Header cache next run me fresh read hoga.');
}

function appRequireHeaders_(sheet, requiredHeaders) {
  const map = appHeaderMap_(sheet);
  const missing = requiredHeaders.filter(function (h) { return !map[h]; });
  if (missing.length) {
    throw new Error(`Missing required headers in ${sheet.getName()}: ${missing.join(', ')}`);
  }
  return map;
}

function appGetReceivedFromTailorCol_(map) {
  return map['Recevied_From_Tailor'] || map['Received_From_Tailor'] || 0;
}

function appA1ColumnToNumber_(letters) {
  const s = appUpper_(letters);
  let out = 0;
  for (let i = 0; i < s.length; i++) {
    out = out * 26 + (s.charCodeAt(i) - 64);
  }
  return out;
}

function appUniqueList_(values) {
  const seen = {};
  const out = [];
  (values || []).forEach(function (v) {
    const t = appText_(v);
    const k = appUpper_(t);
    if (!t || seen[k]) return;
    seen[k] = true;
    out.push(t);
  });
  return out;
}

function appParseCsvList_(value) {
  if (value == null || value === '') return [];
  return String(value)
    .split(',')
    .map(function (v) { return appText_(v); })
    .filter(function (v) { return v !== ''; });
}

function appHasAnyValue_(arr) {
  return (arr || []).some(function (v) { return appText_(v) !== ''; });
}

function appHasRowDataByMap_(row, map) {
  return APP.INPUT_FIELDS.some(function (field) {
    return map[field] && appText_(row[map[field] - 1]) !== '';
  });
}

function appBuildEmptyRowBySheet_(sheet) {
  return new Array(Math.max(sheet.getLastColumn(), APP.DB_HEADERS.length)).fill('');
}

function appStyleHeader_(sheet, row, cols) {
  if (!cols) return;
  sheet.getRange(row, 1, 1, cols)
    .setBackground(APP.COLORS.primary)
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
}

function appApplyBanding_(sheet, rows, cols) {
  try {
    sheet.getBandings().forEach(function (b) { b.remove(); });
    const usableRows = Math.max(rows || sheet.getLastRow(), 2);
    const usableCols = Math.max(cols || sheet.getLastColumn(), 1);
    sheet.getRange(1, 1, usableRows, usableCols)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  } catch (e) {
    Logger.log('Banding skipped: ' + e.message);
  }
}

function appEnsureRows_(sheet, minRows) {
  const nowRows = sheet.getMaxRows();
  if (nowRows < minRows) {
    sheet.insertRowsAfter(nowRows, minRows - nowRows);
  }
}

function appSafeHideColumns_(sheet, map, headers) {
  try {
    (headers || []).forEach(function (header) {
      if (map[header]) sheet.hideColumns(map[header]);
    });
  } catch (e) {
    Logger.log('Hide columns skipped: ' + e.message);
  }
}

function appProgressLog_(name, message) {
  Logger.log('[' + name + '] ' + message);
}

function appSetDateFormatsRange_(sheet, map, startRow, numRows) {
  if (numRows <= 0) return;

  APP.DATE_FIELDS.forEach(function (field) {
    if (map[field]) sheet.getRange(startRow, map[field], numRows, 1).setNumberFormat(APP.DATE_FORMAT);
  });

  const recvCol = appGetReceivedFromTailorCol_(map);
  if (recvCol && (!map['Recevied_From_Tailor'] || recvCol !== map['Recevied_From_Tailor'])) {
    sheet.getRange(startRow, recvCol, numRows, 1).setNumberFormat(APP.DATE_FORMAT);
  }
}


/* ============================================================
 04) LOCK + LOGS ENGINE
 Roman Urdu:
 Write operations ke liye safe lock + retry/backoff use ho raha hai.
 Web app me DocumentLock null aa sakta hai, is liye ScriptLock fallback diya gaya hai.
============================================================ */
function appGetBestWriteLock_() {
  try {
    const docLock = LockService.getDocumentLock();
    if (docLock) return docLock;
  } catch (e) {}
  return LockService.getScriptLock();
}

function appRunRead_(name, fn) {
  try {
    return fn();
  } catch (e) {
    appError_(name, e, {});
    throw e;
  }
}

function appRunWrite_(name, fn, waitMs, options) {
  const opts = options || {};
  const wait = waitMs || APP.LOCKS.WAIT_MS;
  const retries = Math.max(APP.LOCKS.RETRIES, 1);
  const lock = appGetBestWriteLock_();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (lock.tryLock(wait)) {
        try {
          return fn();
        } finally {
          try { lock.releaseLock(); } catch (releaseError) {}
        }
      }
    } catch (e) {
      appError_(name, e, { attempt: attempt });
      throw e;
    }

    Utilities.sleep(APP.LOCKS.BACKOFF_MS * attempt);
  }

  const err = new Error(opts.busyMessage || 'System busy, retry in 2 sec');
  if (opts.silentBusy) {
    Logger.log('[' + name + '] ' + err.message);
    return null;
  }
  appError_(name, err, { retries: retries });
  throw err;
}

function appAudit_(action, detailsObj) {
  try {
    const sh = appGetSheet_(APP.SHEETS.AUDIT);
    sh.appendRow([new Date(), action, appUser_(), appJsonSafe_(detailsObj || {})]);
    appTrimOneLogSheet_(sh, APP.LOG_LIMIT);
  } catch (e) {
    Logger.log('AUDIT LOG ERROR: ' + e.message);
  }
}

function appError_(functionName, error, context) {
  try {
    const sh = appGetSheet_(APP.SHEETS.ERROR);
    sh.appendRow([
      new Date(),
      functionName,
      error && error.message ? error.message : String(error),
      error && error.stack ? String(error.stack) : '',
      appJsonSafe_(context || {})
    ]);
    appTrimOneLogSheet_(sh, APP.LOG_LIMIT);
  } catch (e) {
    Logger.log('ERROR LOG FAILURE: ' + e.message);
  }
}

function appTrimOneLogSheet_(sheet, limit) {
  const rows = sheet.getLastRow();
  if (rows <= limit + 1) return;
  sheet.deleteRows(2, rows - limit - 1);
}

function APP_trimLogs() {
  return appRunWrite_('APP_trimLogs', function () {
    [APP.SHEETS.AUDIT, APP.SHEETS.ERROR].forEach(function (name) {
      const sh = appTryGetSheet_(name);
      if (sh) appTrimOneLogSheet_(sh, APP.LOG_LIMIT);
    });
    appAudit_('APP_trimLogs', { status: 'DONE' });
  });
}


/* ============================================================
 05) SHEET REPAIR + INITIALIZE
 Roman Urdu:
 Safe initialize me data delete nahi hota. Sirf missing sheets,
 headers aur hidden columns repair hote hain.
============================================================ */
function APP_initializeSystem() {
  return appRunWrite_('APP_initializeSystem', function () {
    appClearRuntimeCache_();
    appCreateOrRepairSetupSheet_();
    appCreateOrRepairDatabaseSheet_();
    appCreateOrRepairCompletedSheet_();
    appCreateOrRepairSettingsSheet_();
    appCreateOrRepairReportsSheet_();
    appCreateOrRepairAuditSheet_();
    appCreateOrRepairErrorSheet_();

    appAudit_('APP_initializeSystem', { status: 'READY', version: APP.VERSION });

    SpreadsheetApp.getUi().alert(
      APP.APP_NAME + '\n' + APP.VERSION + '\n\n' +
      'System initialize ho gaya hai.\n' +
      'Ab 02 - Apply Setup & Validations aur 03 - Repair Database run karo.'
    );
  });
}

function appCreateOrRepairSetupSheet_() {
  const sh = appEnsureSheet_(APP.SHEETS.SETUP);

  Object.keys(APP.SETUP_DEFAULTS).forEach(function (a1) {
    if (!appText_(sh.getRange(a1).getValue())) {
      sh.getRange(a1).setValue(APP.SETUP_DEFAULTS[a1]);
    }
  });

  if (!appText_(sh.getRange('I2').getValue())) {
    sh.getRange('I2:I4').setValues([['SABA GARMENT'], ['ZATEX'], ['LOCAL']]);
  }

  if (!appText_(sh.getRange('K2').getValue())) {
    sh.getRange('K2:K4').setValues([['By Sea'], ['By Air'], ['LOCAL']]);
  }

  if (!appText_(sh.getRange('M2').getValue())) {
    sh.getRange('M2:M6').setValues([
      ['PROCESS'],
      ['READY'],
      ['ON_THE_WAY'],
      ['DELIVERED'],
      ['COMPLETED']
    ]);
  }

  appStyleHeader_(sh, 1, Math.max(sh.getLastColumn(), 13));
  sh.setFrozenRows(1);
}

function appCreateOrRepairDatabaseSheet_() {
  const sh = appEnsureSheet_(APP.SHEETS.DATABASE);
  const requiredHeaders = APP.DB_HEADERS.concat(APP.OPTIONAL_DB_HEADERS || []);
  const targetCols = requiredHeaders.length;

  if (sh.getMaxColumns() < targetCols) {
    sh.insertColumnsAfter(sh.getMaxColumns(), targetCols - sh.getMaxColumns());
  }

  // Roman Urdu:
  // Header order forcefully stable rakha gaya hai.
  // Ye random insertColumnAfter issue aur column mismatch avoid karta hai.
  sh.getRange(1, 1, 1, targetCols).setValues([requiredHeaders]);

  const widths = [60,120,140,200,160,110,260,130,150,110,110,110,120,120,120,140,140,130,120,120,130,220,170];
  widths.forEach(function (w, i) {
    if (i + 1 <= targetCols) sh.setColumnWidth(i + 1, w);
  });

  appStyleHeader_(sh, 1, targetCols);
  sh.setFrozenRows(1);
  appEnsureRows_(sh, APP.MIN_DB_ROWS);

  const map = appHeaderMap_(sh);
  appSafeHideColumns_(sh, map, APP.HIDDEN_HEADERS);
  appApplyBanding_(sh, sh.getLastRow(), sh.getLastColumn());
}

function appCreateOrRepairCompletedSheet_() {
  const sh = appEnsureSheet_(APP.SHEETS.COMPLETED);
  const targetCols = APP.DB_HEADERS.length;

  if (sh.getMaxColumns() < targetCols) {
    sh.insertColumnsAfter(sh.getMaxColumns(), targetCols - sh.getMaxColumns());
  }

  // Roman Urdu:
  // Completed sheet ka header order forcefully same rakha gaya hai.
  // Is se duplicate/misaligned headers ka risk khatam hota hai.
  sh.getRange(1, 1, 1, targetCols).setValues([APP.DB_HEADERS]);

  const map = appRequireHeaders_(sh, APP.DB_HEADERS);
  appStyleHeader_(sh, 1, targetCols);
  sh.setFrozenRows(1);
  appSafeHideColumns_(sh, map, APP.HIDDEN_HEADERS);
}

function appCreateOrRepairSettingsSheet_() {
  const sh = appEnsureSheet_(APP.SHEETS.SETTINGS);
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1, 1, 1, APP.SETTINGS_HEADERS.length).setValues([APP.SETTINGS_HEADERS]);
  } else {
    const current = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(appText_);
    APP.SETTINGS_HEADERS.forEach(function (header, i) {
      if (!current[i] && sh.getLastRow() === 1) {
        sh.getRange(1, i + 1).setValue(header);
      }
    });
  }
  appStyleHeader_(sh, 1, Math.max(sh.getLastColumn(), APP.SETTINGS_HEADERS.length));
  sh.setFrozenRows(1);
}


function APP_repairSettingsHeaders() {
  return appRunWrite_('APP_repairSettingsHeaders', function () {
    appClearRuntimeCache_();
    appCreateOrRepairSettingsSheet_();
    appAudit_('APP_repairSettingsHeaders', { status: 'DONE' });
    SpreadsheetApp.getUi().alert('Settings headers repair ho gaye.');
  }, APP.LOCKS.WAIT_MS);
}

function appCreateOrRepairReportsSheet_() {
  const sh = appEnsureSheet_(APP.SHEETS.REPORTS);
  if (sh.getLastRow() < 8) appEnsureRows_(sh, 20);

  sh.getRange('A1:H1').merge();
  sh.getRange('A1').setValue(`${APP.APP_NAME} Dashboard`);
  sh.getRange('A1')
    .setBackground(APP.COLORS.secondary)
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(15)
    .setHorizontalAlignment('center');

  sh.getRange('A3:B8').clearContent();
  sh.getRange('D3:E8').clearContent();
  sh.getRange('A3:B8').setValues([
    ['Metric', 'Value'],
    ['Total Rows', ''],
    ['Total Order', ''],
    ['Total Received', ''],
    ['Completed Rows', ''],
    ['Last Refresh', '']
  ]);
  sh.getRange('D3:E8').setValues([
    ['Stage', 'Count'],
    ['PROCESS', ''],
    ['READY', ''],
    ['ON_THE_WAY', ''],
    ['DELIVERED', ''],
    ['COMPLETED', '']
  ]);
  appStyleHeader_(sh, 3, 2);
  sh.getRange('D3:E3').setBackground(APP.COLORS.primary).setFontColor('#ffffff').setFontWeight('bold');
  sh.setFrozenRows(3);
}

function appCreateOrRepairAuditSheet_() {
  const sh = appEnsureSheet_(APP.SHEETS.AUDIT);
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1, 1, 1, APP.AUDIT_HEADERS.length).setValues([APP.AUDIT_HEADERS]);
  }
  appStyleHeader_(sh, 1, APP.AUDIT_HEADERS.length);
  sh.setFrozenRows(1);
}

function appCreateOrRepairErrorSheet_() {
  const sh = appEnsureSheet_(APP.SHEETS.ERROR);
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1, 1, 1, APP.ERROR_HEADERS.length).setValues([APP.ERROR_HEADERS]);
  }
  appStyleHeader_(sh, 1, APP.ERROR_HEADERS.length);
  sh.setFrozenRows(1);
}


/* ============================================================
 06) SETUP READERS
 Roman Urdu:
 Setup sheet driven architecture yahan hai. User Setup update karega,
 system automatically lists aur mappings read karega.
============================================================ */
function appGetSetupSheet_() {
  return appGetSheet_(APP.SHEETS.SETUP);
}

function appReadSetupColumnValuesByHeader_(headerNames, fallbackLetters, extraStripLabels) {
  const sh = appGetSetupSheet_();
  const headerMap = appHeaderMap_(sh);
  let col = 0;

  (headerNames || []).some(function (header) {
    if (headerMap[header]) {
      col = headerMap[header];
      return true;
    }
    return false;
  });

  if (!col && fallbackLetters) col = appA1ColumnToNumber_(fallbackLetters);
  if (!col) return [];

  const lastRow = Math.max(sh.getLastRow(), 1);
  let values = sh.getRange(1, col, lastRow, 1).getValues().flat().map(appText_).filter(Boolean);
  if (!values.length) return [];

  const labelsToStrip = appUniqueList_([].concat(headerNames || [], extraStripLabels || []));
  if (values.length && labelsToStrip.map(appUpper_).indexOf(appUpper_(values[0])) !== -1) {
    values = values.slice(1);
  }

  return appUniqueList_(values);
}

function appReadSetupCache_(forceRefresh) {
  if (!forceRefresh && APP_MEMO.setupCache) return APP_MEMO.setupCache;

  const cache = {
    laceProducts: appReadSetupColumnValuesByHeader_(['LACE'], 'A', []),
    gayleProducts: appReadSetupColumnValuesByHeader_(['GAYLE'], 'C', []),
    factories: appReadSetupColumnValuesByHeader_(['Factory Name', 'FACTORY'], 'I', []),
    shipmentTypes: appReadSetupColumnValuesByHeader_(['SHIPMENT_TYPE'], 'K', []),
    stages: appReadSetupColumnValuesByHeader_(['STAGE'], 'M', ['SHIPMENT_TYPE'])
  };

  const sh = appGetSetupSheet_();
  const headerMap = appHeaderMap_(sh);
  const markaCol = headerMap['MARKA_CODE'] || appA1ColumnToNumber_('E');
  const outletCol = headerMap['OUTLET_NAME'] || appA1ColumnToNumber_('F');
  const locationCol = headerMap['LOCATION'] || 0;
  const lastRow = Math.max(sh.getLastRow(), 1);

  const firstDataRow = (appUpper_(sh.getRange(1, markaCol).getValue()) === 'MARKA_CODE') ? 2 : 1;
  const readRows = Math.max(lastRow - firstDataRow + 1, 0);
  const markaOutletMap = {};
  const outlets = [];

  if (readRows > 0) {
    const rowWidth = Math.max(Math.max(markaCol, outletCol, locationCol || 0), 1);
    const rows = sh.getRange(firstDataRow, 1, readRows, rowWidth).getValues();
    rows.forEach(function (r) {
      const marka = appUpper_(r[markaCol - 1]);
      const outlet = appText_(r[outletCol - 1]);
      const location = locationCol ? appText_(r[locationCol - 1]) : '';
      if (!marka) return;
      markaOutletMap[marka] = outlet;
      outlets.push({ markaCode: marka, outletName: outlet, location: location });
    });
  }

  cache.markaOutletMap = markaOutletMap;
  cache.markaCodes = appUniqueList_(Object.keys(markaOutletMap));
  cache.outlets = outlets;

  APP_MEMO.setupCache = cache;
  return cache;
}

function appGetProductNamesByCategory_(category, cache) {
  const c = cache || appReadSetupCache_();
  const normalized = appUpper_(category);
  if (normalized === 'LACE') return c.laceProducts.slice();
  if (normalized === 'GAYLE') return c.gayleProducts.slice();
  return [];
}

function APP_getFormBootstrap() {
  return appRunRead_('APP_getFormBootstrap', function () {
    const cache = appReadSetupCache_(true);
    return {
      brand: APP.BRAND,
      owner: APP.OWNER,
      appName: APP.APP_NAME,
      version: APP.VERSION,
      dateFormat: APP.DATE_FORMAT,
      productCategories: APP.PRODUCT_CATEGORIES.slice(),
      laceProducts: cache.laceProducts.slice(),
      gayleProducts: cache.gayleProducts.slice(),
      factories: cache.factories.slice(),
      markaCodes: cache.markaCodes.slice(),
      outlets: cache.outlets.slice(),
      shipmentTypes: cache.shipmentTypes.slice(),
      stages: cache.stages.slice()
    };
  });
}


/* ============================================================
 07) VALIDATION ENGINE
 Roman Urdu:
 Yahan base validations aur PRODUCT_NAME dynamic validation build hoti hai.
 Sirf used rows par apply ki jaati hain. Blank category warnings log nahi hoti.
============================================================ */
function appBuildRuleRequireDate_() {
  return SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .setHelpText('Valid date select karo.')
    .build();
}

function appBuildRuleRequireList_(values, helpText) {
  const list = appUniqueList_(values || []);
  if (!list.length) return null;
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(list, true)
    .setAllowInvalid(false)
    .setHelpText(helpText || 'Dropdown list se value select karo.')
    .build();
}

function appBuildRuleRequireNonNegative_() {
  return SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0)
    .setAllowInvalid(false)
    .setHelpText('0 ya us se bara number dalo.')
    .build();
}

function appApplyStaticValidations_(sheet, map, startRow, numRows, cache) {
  if (numRows <= 0) return;

  const dateRule = appBuildRuleRequireDate_();
  APP.DATE_FIELDS.forEach(function (field) {
    if (map[field]) {
      sheet.getRange(startRow, map[field], numRows, 1)
        .setNumberFormat(APP.DATE_FORMAT)
        .setDataValidation(dateRule);
    }
  });

  const recvCol = appGetReceivedFromTailorCol_(map);
  if (recvCol && (!map['Recevied_From_Tailor'] || recvCol !== map['Recevied_From_Tailor'])) {
    sheet.getRange(startRow, recvCol, numRows, 1)
      .setNumberFormat(APP.DATE_FORMAT)
      .setDataValidation(dateRule);
  }

  const categoryRule = appBuildRuleRequireList_(APP.PRODUCT_CATEGORIES, 'Lace ya Gayle select karo.');
  const factoryRule = appBuildRuleRequireList_(cache.factories, 'Factory Setup se select karo.');
  const markaRule = appBuildRuleRequireList_(cache.markaCodes, 'Marka code Setup se select karo.');
  const shipmentRule = appBuildRuleRequireList_(cache.shipmentTypes, 'Shipment type Setup se select karo.');
  const stageRule = appBuildRuleRequireList_(cache.stages, 'Stage Setup se select karo.');
  const numberRule = appBuildRuleRequireNonNegative_();

  if (map['PRODUCT_CATEGORY'] && categoryRule) sheet.getRange(startRow, map['PRODUCT_CATEGORY'], numRows, 1).setDataValidation(categoryRule);
  if (map['FACTORY'] && factoryRule) sheet.getRange(startRow, map['FACTORY'], numRows, 1).setDataValidation(factoryRule);
  if (map['MARKA_CODE'] && markaRule) sheet.getRange(startRow, map['MARKA_CODE'], numRows, 1).setDataValidation(markaRule);
  if (map['SHIPMENT_TYPE'] && shipmentRule) sheet.getRange(startRow, map['SHIPMENT_TYPE'], numRows, 1).setDataValidation(shipmentRule);
  if (map['STAGE'] && stageRule) sheet.getRange(startRow, map['STAGE'], numRows, 1).setDataValidation(stageRule);

  ['COLOUR_COUNT', 'PCS_PER_COLOUR', 'TOTAL_Received'].forEach(function (field) {
    if (map[field]) sheet.getRange(startRow, map[field], numRows, 1).setDataValidation(numberRule);
  });
}

function appApplyProductValidationBatch_(sheet, map, startRow, categories, cache, clearInvalid) {
  if (!map['PRODUCT_NAME'] || !categories.length) return;

  const rules = [];
  const valuesToWrite = [];
  const currentProducts = sheet.getRange(startRow, map['PRODUCT_NAME'], categories.length, 1).getValues().flat();

  categories.forEach(function (cat, i) {
    const options = appGetProductNamesByCategory_(cat, cache);
    const productRule = options.length ? appBuildRuleRequireList_(options, 'Category ke mutabiq product select karo.') : null;
    rules.push([productRule]);

    if (clearInvalid) {
      const current = appText_(currentProducts[i]);
      const validUpper = options.map(appUpper_);
      valuesToWrite.push([(current && validUpper.indexOf(appUpper_(current)) === -1) ? '' : currentProducts[i]]);
    }
  });

  const productRange = sheet.getRange(startRow, map['PRODUCT_NAME'], categories.length, 1);
  productRange.setDataValidations(rules);
  if (clearInvalid) productRange.setValues(valuesToWrite);
}

function appApplyRowSetup_(sheet, row, map, cache, clearInvalidProduct) {
  const c = cache || appReadSetupCache_();
  appApplyStaticValidations_(sheet, map, row, 1, c);
  const category = appText_(sheet.getRange(row, map['PRODUCT_CATEGORY']).getValue());
  appApplyProductValidationBatch_(sheet, map, row, [category], c, !!clearInvalidProduct);
}


/* ============================================================
 08) ENTRY ID ENGINE
 Roman Urdu:
 Search key hata di gayi hai. Sirf hidden ENTRY_ID rakha gaya hai.
 New row ke liye unique id generate hoti hai.
============================================================ */
function appGenerateEntryId_(usedSet) {
  let id = '';
  do {
    id = 'het-' + Utilities.formatDate(new Date(), APP.TZ, 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 8);
  } while (usedSet && usedSet[id]);
  return id;
}

function appGetExistingEntryIdSet_(sheet, map) {
  const out = {};
  const col = map['ENTRY_ID'];
  const lastRow = sheet.getLastRow();
  if (!col || lastRow < 2) return out;
  sheet.getRange(2, col, lastRow - 1, 1).getValues().flat().forEach(function (id) {
    const t = appText_(id);
    if (t) out[t] = true;
  });
  return out;
}

function appEnsureEntryId_(currentValue, seenSet) {
  const current = appText_(currentValue);
  if (current && !seenSet[current]) {
    seenSet[current] = true;
    return current;
  }
  const newId = appGenerateEntryId_(seenSet);
  seenSet[newId] = true;
  return newId;
}


/* ============================================================
 09) COMPUTE ENGINE
 Roman Urdu:
 Row level auto compute yahan hoti hai.
 SR contiguous non-empty rows ke hisaab se generate hota hai.
 OUTLET_NAME, TOTAL_ORDER aur ENTRY_ID bhi yahin nikalte hain.
============================================================ */
function appGetAutoStage_(row, map) {
  if (appSafeDate_(row[map['ARRIVAL_DATE'] - 1])) return 'COMPLETED';
  if (appSafeDate_(row[map['DISPATCH_DATE'] - 1])) return 'ON_THE_WAY';
  if (appSafeDate_(row[map['READY_DATE'] - 1])) return 'READY';
  return appHasRowDataByMap_(row, map) ? 'PROCESS' : '';
}

function appClearComputedFields_(row, map) {
  ['SR', 'OUTLET_NAME', 'TOTAL_ORDER', 'ENTRY_ID', 'SEARCH_KEY'].forEach(function (field) {
    if (map[field]) row[map[field] - 1] = '';
  });
  return row;
}

function appBuildSearchKey_(row, map) {
  const parts = [
    'PRODUCT_NAME',
    'MARKA_CODE',
    'DESIGN_NO',
    'PRODUCT_CATEGORY',
    'FACTORY',
    'OUTLET_NAME',
    'STAGE',
    'SHIPMENT_NO',
    'REMARKS'
  ];

  return parts
    .map(function (field) {
      return map[field] ? appUpper_(row[map[field] - 1]) : '';
    })
    .filter(function (v) { return v !== ''; })
    .join('|');
}

function appComputeOneRow_(rowValues, map, cache, ctx) {
  const row = rowValues.slice();
  const c = cache || appReadSetupCache_();
  const entrySeen = (ctx && ctx.entrySeen) || {};
  const srValue = ctx && typeof ctx.sr === 'number' ? ctx.sr : null;

  if (!appHasRowDataByMap_(row, map)) {
    return appClearComputedFields_(row, map);
  }

  if (srValue != null && map['SR']) row[map['SR'] - 1] = srValue;

  const marka = appUpper_(row[map['MARKA_CODE'] - 1]);
  if (map['OUTLET_NAME']) row[map['OUTLET_NAME'] - 1] = marka ? (c.markaOutletMap[marka] || '') : '';

  const colourCount = appNumber_(row[map['COLOUR_COUNT'] - 1]);
  const pcsPerColour = appNumber_(row[map['PCS_PER_COLOUR'] - 1]);
  row[map['TOTAL_ORDER'] - 1] = (colourCount !== '' && pcsPerColour !== '') ? (Number(colourCount) * Number(pcsPerColour)) : '';

  if (map['ENTRY_ID']) {
    row[map['ENTRY_ID'] - 1] = appEnsureEntryId_(row[map['ENTRY_ID'] - 1], entrySeen);
  }

  const manualStage = map['STAGE'] ? appUpper_(row[map['STAGE'] - 1]) : '';
  const finalStage = manualStage || appGetAutoStage_(row, map);
  if (map['STAGE']) row[map['STAGE'] - 1] = finalStage;

  if (map['SEARCH_KEY']) row[map['SEARCH_KEY'] - 1] = appBuildSearchKey_(row, map);

  return row;
}

function appRecomputeSrColumn_(sheet, map) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || !map['SR']) return 0;

  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const srOut = [];
  let serial = 0;

  values.forEach(function (row) {
    if (appHasRowDataByMap_(row, map)) {
      serial += 1;
      srOut.push([serial]);
    } else {
      srOut.push(['']);
    }
  });

  sheet.getRange(2, map['SR'], srOut.length, 1).setValues(srOut);
  return serial;
}


function appGetNextSerialNo_(sheet, map) {
  if (!map['SR']) return '';
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;

  const values = sheet.getRange(2, map['SR'], lastRow - 1, 1).getValues().flat();
  let maxSr = 0;

  values.forEach(function (v) {
    const n = Number(v);
    if (!isNaN(n) && n > 0 && n > maxSr) maxSr = n;
  });

  return maxSr + 1;
}

function appGetStableSerialForRow_(rowData, map, nextState) {
  const current = map['SR'] ? Number(rowData[map['SR'] - 1]) : 0;
  if (current && !isNaN(current)) return current;

  const next = nextState.nextSerial;
  nextState.nextSerial += 1;
  return next;
}


/* ============================================================
 10) REPAIR ENGINE
 Roman Urdu:
 appRepairRange_ kisi bhi row range ko recompute karta hai.
 APP_repairAllRows full database ko batch mode me repair karta hai.
============================================================ */
function appBuildRepairStateBeforeRow_(sheet, map, beforeRow) {
  const state = { serial: 0, entrySeen: {} };
  if (beforeRow < 2) return state;

  // Roman Urdu:
  // beforeRow exclusive hai. Row 2 se beforeRow-1 tak hi read hoga.
  // Example: current row 5 ke liye beforeRow=5 pass ho to rows 2,3,4 count hongi.
  const numRows = beforeRow - 2;
  if (numRows <= 0) return state;

  const values = sheet.getRange(2, 1, numRows, sheet.getLastColumn()).getValues();
  values.forEach(function (row) {
    if (appHasRowDataByMap_(row, map)) state.serial += 1;
    const id = map['ENTRY_ID'] ? appText_(row[map['ENTRY_ID'] - 1]) : '';
    if (id && !state.entrySeen[id]) state.entrySeen[id] = true;
  });
  return state;
}

function appRepairRange_(sheet, map, startRow, endRow, options) {
  const opts = options || {};
  const lastCol = sheet.getLastColumn();
  const numRows = Math.max(endRow - startRow + 1, 0);
  if (numRows <= 0) return { serial: opts.serial || 0, entrySeen: opts.entrySeen || {} };

  const cache = opts.cache || appReadSetupCache_();
  let baseState = null;
  if (typeof opts.serial !== 'number' || !opts.entrySeen) {
    baseState = appBuildRepairStateBeforeRow_(sheet, map, startRow);
  }

  const state = {
    serial: typeof opts.serial === 'number' ? opts.serial : baseState.serial,
    entrySeen: opts.entrySeen || baseState.entrySeen
  };

  const values = sheet.getRange(startRow, 1, numRows, lastCol).getValues();
  const out = [];

  values.forEach(function (row) {
    if (appHasRowDataByMap_(row, map)) {
      state.serial += 1;
      out.push(appComputeOneRow_(row, map, cache, { sr: state.serial, entrySeen: state.entrySeen }));
    } else {
      out.push(appClearComputedFields_(row.slice(), map));
    }
  });

  sheet.getRange(startRow, 1, out.length, lastCol).setValues(out);
  appSetDateFormatsRange_(sheet, map, startRow, numRows);
  return state;
}

function APP_repairAllRows() {
  return appRunWrite_('APP_repairAllRows', function () {
    const startedAt = appNow_();
    const sh = appGetSheet_(APP.SHEETS.DATABASE);
    const map = appRequireHeaders_(sh, APP.DB_HEADERS);
    const lastRow = sh.getLastRow();
    const cache = appReadSetupCache_(true);

    if (lastRow < 2) {
      appAudit_('APP_repairAllRows', { status: 'EMPTY' });
      return { success: true, rowsProcessed: 0 };
    }

    appApplyStaticValidations_(sh, map, 2, lastRow - 1, cache);
    appSetDateFormatsRange_(sh, map, 2, lastRow - 1);

    let state = { serial: 0, entrySeen: {} };
    for (let start = 2; start <= lastRow; start += APP.BATCH.REPAIR_ROWS) {
      const end = Math.min(start + APP.BATCH.REPAIR_ROWS - 1, lastRow);
      state = appRepairRange_(sh, map, start, end, {
        cache: cache,
        serial: state.serial,
        entrySeen: state.entrySeen
      });

      if (((end - 1) % APP.BATCH.PROGRESS_EVERY_ROWS) === 0 || end === lastRow) {
        appProgressLog_('APP_repairAllRows', 'Processed up to row ' + end);
      }

      Utilities.sleep(APP.BATCH.THROTTLE_MS);
      if (appShouldStopForTime_(startedAt)) {
        throw new Error('Repair stopped due to runtime guard. Batch size kam karo ya function dobara run karo.');
      }
    }

    appApplyBanding_(sh, Math.max(sh.getLastRow(), 2), sh.getLastColumn());
    appSafeHideColumns_(sh, map, APP.HIDDEN_HEADERS);
    appAudit_('APP_repairAllRows', { status: 'DONE', rowsProcessed: lastRow - 1 });
    return { success: true, rowsProcessed: lastRow - 1 };
  });
}


/* ============================================================
 11) APPLY SETUP ENGINE
 Roman Urdu:
 Sirf used rows par validations apply hoti hain. getMaxRows use nahi hota.
 PRODUCT_NAME dynamic rules batch me lagti hain.
============================================================ */
function APP_applyDatabaseSetup() {
  return appRunWrite_('APP_applyDatabaseSetup', function () {
    const startedAt = appNow_();
    const sh = appGetSheet_(APP.SHEETS.DATABASE);
    const map = appRequireHeaders_(sh, APP.DB_HEADERS);
    const cache = appReadSetupCache_(true);
    const lastRow = sh.getLastRow();

    appStyleHeader_(sh, 1, sh.getLastColumn());
    appSafeHideColumns_(sh, map, APP.HIDDEN_HEADERS);
    appEnsureRows_(sh, APP.MIN_DB_ROWS);

    const prepareRows = Math.max(lastRow - 1, APP.MIN_DB_ROWS);

    appApplyStaticValidations_(sh, map, 2, prepareRows, cache);
    appSetDateFormatsRange_(sh, map, 2, prepareRows);

    if (lastRow < 2) {
      appAudit_('APP_applyDatabaseSetup', { status: 'NO_DATA_VALIDATIONS_READY', rowsPrepared: prepareRows });
      return { success: true, rowsPrepared: prepareRows };
    }

    for (let start = 2; start <= lastRow; start += APP.BATCH.PRODUCT_VALIDATION_ROWS) {
      const end = Math.min(start + APP.BATCH.PRODUCT_VALIDATION_ROWS - 1, lastRow);
      const count = end - start + 1;
      const categories = map['PRODUCT_CATEGORY']
        ? sh.getRange(start, map['PRODUCT_CATEGORY'], count, 1).getValues().flat().map(appText_)
        : [];

      appApplyProductValidationBatch_(sh, map, start, categories, cache, false);

      if (((end - 1) % APP.BATCH.PROGRESS_EVERY_ROWS) === 0 || end === lastRow) {
        appProgressLog_('APP_applyDatabaseSetup', 'Prepared validations up to row ' + end);
      }

      Utilities.sleep(APP.BATCH.THROTTLE_MS);
      if (appShouldStopForTime_(startedAt)) {
        throw new Error('Apply setup stopped due to runtime guard. Function dobara run karo.');
      }
    }

    appApplyBanding_(sh, Math.max(lastRow, 2), sh.getLastColumn());
    appAudit_('APP_applyDatabaseSetup', { status: 'DONE', rowsPrepared: lastRow - 1 });
    return { success: true, rowsPrepared: lastRow - 1 };
  });
}



function APP_repairDropdownsOnly() {
  return appRunWrite_('APP_repairDropdownsOnly', function () {
    appClearRuntimeCache_();

    const sh = appGetSheet_(APP.SHEETS.DATABASE);
    const map = appRequireHeaders_(sh, APP.DB_HEADERS);
    const cache = appReadSetupCache_(true);
    const lastRow = sh.getLastRow();

    if (!map['PRODUCT_CATEGORY'] || !map['PRODUCT_NAME']) {
      throw new Error('PRODUCT_CATEGORY / PRODUCT_NAME headers missing.');
    }

    const rowsToPrepare = Math.max(lastRow - 1, APP.MIN_DB_ROWS);
    const startRow = 2;

    appApplyStaticValidations_(sh, map, startRow, rowsToPrepare, cache);
    appSetDateFormatsRange_(sh, map, startRow, rowsToPrepare);

    const existingRows = Math.max(lastRow - 1, 1);
    const categories = sh.getRange(startRow, map['PRODUCT_CATEGORY'], existingRows, 1)
      .getValues()
      .flat()
      .map(appText_);

    appApplyProductValidationBatch_(sh, map, startRow, categories, cache, false);
    appSafeHideColumns_(sh, map, APP.HIDDEN_HEADERS);

    appAudit_('APP_repairDropdownsOnly', { status: 'DONE', preparedRows: rowsToPrepare });
    SpreadsheetApp.getUi().alert('Dropdowns repair ho gaye. Setup sheet se fresh values load ho gayi hain.');
    return { success: true, preparedRows: rowsToPrepare };
  }, APP.LOCKS.WAIT_MS);
}

/* ============================================================
 12) ON EDIT SMART ENGINE
 Roman Urdu:
 Lightweight live processing. Ab single edit + paste/multi-row dono safe hain.
============================================================ */
function onEdit(e) { APP_handleEdit_(e); }

function APP_handleEdit_(e) {
  if (!e || !e.range) return;
  if ('value' in e && 'oldValue' in e && e.value === e.oldValue) return;
  if (e.changeType) return;

  const sh = e.range.getSheet();
  if (sh.getName() !== APP.SHEETS.DATABASE) return;

  const startRow = e.range.getRow();
  const numRows = e.range.getNumRows();
  const startCol = e.range.getColumn();
  const numCols = e.range.getNumColumns();

  if (startRow <= 1) return;

  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('APP_EDIT_RUNNING') === '1') return;

  const lock = appGetBestWriteLock_();
  if (!lock.tryLock(APP.LOCKS.EDIT_WAIT_MS)) return;

  try {
    props.setProperty('APP_EDIT_RUNNING', '1');
    Utilities.sleep(20);

    const map = appRequireHeaders_(sh, APP.DB_HEADERS);
    if (!map['PRODUCT_CATEGORY'] || !map['PRODUCT_NAME']) return;
    const cache = appReadSetupCache_();
    const lastCol = sh.getLastColumn();
    const lastRow = sh.getLastRow();

    const editEndRow = Math.min(startRow + numRows - 1, lastRow);
    const editRows = Math.max(editEndRow - startRow + 1, 1);

    const isSingleCategoryOnlyEdit =
      numRows === 1 &&
      numCols === 1 &&
      startCol === map['PRODUCT_CATEGORY'];

    const categories = sh.getRange(startRow, map['PRODUCT_CATEGORY'], editRows, 1).getValues().flat();

    // Roman Urdu:
    // Single category change par product clear/validate hota hai.
    // Paste/multi-cell edit par existing PRODUCT_NAME preserve hota hai.
    appApplyProductValidationBatch_(
      sh,
      map,
      startRow,
      categories,
      cache,
      isSingleCategoryOnlyEdit
    );

    const editedData = sh.getRange(startRow, 1, editRows, lastCol).getValues();

    // Zero-Recompute SR:
    // Existing SR preserve hota hai; new rows ko max SR + 1 assign hota hai.
    // Neeche wali rows ko touch nahi kiya jata, is liye full SR recompute nahi hota.
    const nextState = { nextSerial: appGetNextSerialNo_(sh, map) };
    const entrySeen = appGetExistingEntryIdSet_(sh, map);
    const output = [];
    const completedRows = [];

    editedData.forEach(function (rowData, idx) {
      if (!appHasRowDataByMap_(rowData, map)) {
        output.push(appClearComputedFields_(rowData, map));
        return;
      }

      const stableSr = appGetStableSerialForRow_(rowData, map, nextState);
      const computed = appComputeOneRow_(rowData, map, cache, {
        sr: stableSr,
        entrySeen: entrySeen
      });

      output.push(computed);

      if (map['STAGE'] && appUpper_(computed[map['STAGE'] - 1]) === 'COMPLETED') {
        completedRows.push(startRow + idx);
      }
    });

    // Single batch write for edited area.
    sh.getRange(startRow, 1, output.length, lastCol).setValues(output);
    appSetDateFormatsRange_(sh, map, startRow, output.length);

    // Move completed after write, reverse/safe logic inside move helper.
    if (completedRows.length) {
      appMoveRowsToCompleted_(completedRows);
    }

  } catch (error) {
    appError_('APP_handleEdit_', error, {
      startRow: startRow,
      numRows: numRows,
      startCol: startCol,
      numCols: numCols
    });
    throw error;
  } finally {
    try { props.deleteProperty('APP_EDIT_RUNNING'); } catch (_) {}
    try { lock.releaseLock(); } catch (_) {}
  }
}


/* ============================================================
 13) ON CHANGE STRUCTURAL ENGINE
 Roman Urdu:
 Row insert/delete mid-sheet yahan handle hota hai. Installable change
 trigger INSERT_ROW / REMOVE_ROW par resequence karta hai.
============================================================ */
function APP_handleChange_(e) {
  if (!e || !e.changeType) return;

  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('APP_EDIT_RUNNING') === '1') return;

  appClearRuntimeCache_();

  const structuralTypes = {
    INSERT_ROW: true,
    REMOVE_ROW: true,
    INSERT_GRID: true,
    REMOVE_GRID: true,
    INSERT_COLUMN: true,
    REMOVE_COLUMN: true
  };
  if (!structuralTypes[e.changeType]) return;

  appRunWrite_('APP_handleChange_', function () {
    const sh = appGetSheet_(APP.SHEETS.DATABASE);
    const map = appRequireHeaders_(sh, APP.DB_HEADERS);
    appRecomputeSrColumn_(sh, map);
    appSafeHideColumns_(sh, map, APP.HIDDEN_HEADERS);
    appProgressLog_('APP_handleChange_', 'Structural change handled: ' + e.changeType);
  }, APP.LOCKS.WAIT_MS, { silentBusy: true });
}

/* ============================================================
 14) WEB APIS - FINAL HYBRID API VERSION
 Roman Urdu:
 React/Express/fetch ke liye JSON API.
 Old Google HTML UI ke liye bhi global functions available rahenge.
============================================================ */

var GAS_API_SECRET = 'Lace & Gayle';

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAction(e) {
  return ((e && e.parameter && (e.parameter.action || e.parameter.api)) || '').trim();
}

function getToken(e) {
  const p = e && e.parameter ? e.parameter : {};
  return String(p.token || '').trim();
}

function isAuthorized(e) {
  return getToken(e) === GAS_API_SECRET;
}

function safeJsonParse_(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Invalid JSON payload');
  }
}

/* ================= API GET ================= */

function doGet(e) {
  try {
    const action = getAction(e);

    if (!action) return APP_renderLandingPage_();

    if (!isAuthorized(e)) {
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }

    if (action === 'records') {
      return jsonResponse({
        success: true,
        data: APP_listEntries(e.parameter || {})
      });
    }

    if (action === 'dashboard') {
      return jsonResponse({
        success: true,
        data: APP_getDashboardData()
      });
    }

    if (action === 'product-names') {
      return jsonResponse({
        success: true,
        data: APP_getFormBootstrap()
      });
    }

    if (action === 'view-config') {
      return jsonResponse({
        success: true,
        data: APP_getViewConfig(e.parameter || {})
      });
    }

    if (action === 'view-output') {
      return jsonResponse({
        success: true,
        data: APP_getViewOutput(e.parameter || {})
      });
    }

    return jsonResponse({ success: false, error: 'Invalid action: ' + action });

  } catch (err) {
    return jsonResponse({
      success: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

/* ================= API POST ================= */

function doPost(e) {
  try {
    if (!isAuthorized(e)) {
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }

    const action = getAction(e);

    if (action === 'save-entry') {
      const body = safeJsonParse_(e && e.postData ? e.postData.contents : '');

      return jsonResponse({
        success: true,
        data: APP_saveEntry(body)
      });
    }

    return jsonResponse({ success: false, error: 'Invalid action: ' + action });

  } catch (err) {
    return jsonResponse({
      success: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

/* ================= RECORDS API ================= */

function APP_listEntries(params) {
  return appRunRead_('APP_listEntries', function () {
    const p = params || {};
    const sh = appGetSheet_(APP.SHEETS.DATABASE);
    const map = appRequireHeaders_(sh, APP.DB_HEADERS);
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();

    if (lastRow < 2) {
      return { total: 0, page: 1, pageSize: APP.UI_PAGE_SIZE, items: [] };
    }

    const q = appLower_(p.q || p.search || '');
    const productCategory = appLower_(p.productCategory || p.PRODUCT_CATEGORY || '');
    const stage = appLower_(p.stage || p.STAGE || '');
    const markaCode = appLower_(p.markaCode || p.MARKA_CODE || '');

    const page = Math.max(Number(p.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(p.pageSize || APP.UI_PAGE_SIZE), 1), 500);

    const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const items = [];

    rows.forEach(function (row, idx) {
      if (!appHasRowDataByMap_(row, map)) return;

      const item = {};
      APP.DB_HEADERS.forEach(function (h) {
        item[h] = map[h] ? row[map[h] - 1] : '';
      });

      item.rowNumber = idx + 2;

      if (productCategory && appLower_(item.PRODUCT_CATEGORY) !== productCategory) return;
      if (stage && appLower_(item.STAGE) !== stage) return;
      if (markaCode && appLower_(item.MARKA_CODE) !== markaCode) return;

      if (q) {
        const searchText = [
          item.PRODUCT_NAME,
          item.MARKA_CODE,
          item.DESIGN_NO,
          item.PRODUCT_CATEGORY,
          item.FACTORY,
          item.OUTLET_NAME,
          item.STAGE,
          item.SHIPMENT_NO,
          item.REMARKS
        ].map(appLower_).join(' ');

        if (searchText.indexOf(q) === -1) return;
      }

      items.push(item);
    });

    const start = (page - 1) * pageSize;

    return {
      total: items.length,
      page: page,
      pageSize: pageSize,
      items: items.slice(start, start + pageSize)
    };
  });
}

function APP_getViewConfig(params) {
  return appRunRead_('APP_getViewConfig', function () {
    function normalizeViewName_(value) {
      return appLower_(value)
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    }

    function resolveRequestedQualifier_(value) {
      const v = appLower_(value);
      if (!v) return '';
      if (v.indexOf(' lace') !== -1 || v.endsWith('lace')) return 'lace';
      if (v.indexOf(' gayle') !== -1 || v.endsWith('gayle')) return 'gayle';
      return '';
    }

    function stripQualifierSuffix_(value) {
      const v = appText_(value);
      return v
        .replace(/\s*-\s*lace\s*$/i, '')
        .replace(/\s*-\s*gayle\s*$/i, '')
        .trim();
    }

    const p = params || {};
    const requestedView = appText_(p.view || '');
    const requestedQualifier = resolveRequestedQualifier_(requestedView);
    const requestedBase = stripQualifierSuffix_(requestedView);
    const requestedBaseNormalized = normalizeViewName_(requestedBase || requestedView);
    const set = appGetSheet_(APP.SHEETS.SETTINGS);
    const totalRows = set.getLastRow();

    if (totalRows < 2) {
      return {
        source: { sheet_name: APP.SHEETS.SETTINGS },
        view: requestedView || null,
        count: 0,
        configs: []
      };
    }

    const rows = set.getRange(2, 1, totalRows - 1, 9).getValues();
    const configs = [];

    rows.forEach(function (cfg) {
      const viewName = appText_(cfg[0]);
      const url = appText_(cfg[1]);
      const sheetName = appText_(cfg[2]);
      const columnsRaw = appText_(cfg[3]);
      const filterColumnRaw = appText_(cfg[4]);
      const filterValueRaw = appText_(cfg[5]);

      if (!viewName && !url && !sheetName && !columnsRaw && !filterColumnRaw && !filterValueRaw) {
        return;
      }

      configs.push({
        view: viewName,
        url: url,
        sheetName: sheetName,
        columnsRaw: columnsRaw,
        columnsList: appParseCsvList_(columnsRaw),
        filterColumns: appParseCsvList_(filterColumnRaw),
        filterValues: appParseCsvList_(filterValueRaw)
      });
    });

    let filtered = configs;

    if (requestedView) {
      filtered = configs.filter(function (c) { return c.view === requestedView; });
    }

    if (requestedView && filtered.length === 0 && requestedBaseNormalized) {
      filtered = configs.filter(function (c) {
        return normalizeViewName_(stripQualifierSuffix_(c.view)) === requestedBaseNormalized;
      });
    }

    if (requestedQualifier && filtered.length > 1) {
      const qualified = filtered.filter(function (c) {
        const sheet = appLower_(c.sheetName);
        const filterValues = Array.isArray(c.filterValues) ? c.filterValues.map(appLower_) : [];
        return sheet.indexOf(requestedQualifier) !== -1 || filterValues.indexOf(requestedQualifier) !== -1;
      });

      if (qualified.length > 0) {
        filtered = qualified;
      }
    }

    return {
      source: {
        spreadsheet_id: appGetSS_().getId(),
        sheet_name: APP.SHEETS.SETTINGS
      },
      view: requestedView || null,
      count: filtered.length,
      configs: filtered
    };
  });
}

function APP_getViewOutput(params) {
  return appRunRead_('APP_getViewOutput', function () {
    const p = params || {};
    const requestedView = appText_(p.view || '');
    if (!requestedView) throw new Error('view is required for view-output');

    const cfgRes = APP_getViewConfig({ view: requestedView });
    const cfg = (cfgRes.configs || [])[0];
    if (!cfg) throw new Error('View config not found in settings: ' + requestedView);
    if (!cfg.url) throw new Error('View config URL is missing for: ' + requestedView);

    const target = SpreadsheetApp.openByUrl(cfg.url);
    const sh = cfg.sheetName ? target.getSheetByName(cfg.sheetName) : target.getSheets()[0];
    if (!sh) throw new Error('Target sheet not found for view: ' + requestedView);

    const values = sh.getDataRange().getValues();
    if (values.length <= 1) {
      return {
        view: requestedView,
        headers: [],
        records: [],
        count: 0,
        config: cfg,
        source: { spreadsheet_id: target.getId(), sheet_name: sh.getName() }
      };
    }

    const headers = values[0].map(appText_);
    const selectedHeaders = headers.slice();

    const rows = [];
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const obj = {};
      let has = false;
      for (let i = 0; i < selectedHeaders.length; i++) {
        const idx = i;
        const key = selectedHeaders[i];
        const val = row[idx];
        if (appText_(val) !== '') has = true;
        obj[key] = val;
      }
      if (has) rows.push(obj);
    }

    return {
      view: requestedView,
      headers: selectedHeaders,
      records: rows,
      count: rows.length,
      config: cfg,
      source: {
        spreadsheet_id: target.getId(),
        sheet_name: sh.getName()
      }
    };
  });
}

/* ================= DASHBOARD API ================= */

function APP_getDashboardData() {
  return appRunRead_('APP_getDashboardData', function () {
    const sh = appGetSheet_(APP.SHEETS.DATABASE);
    const map = appRequireHeaders_(sh, APP.DB_HEADERS);
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();

    const out = {
      totals: { rows: 0, order: 0, received: 0, completed: 0 },
      stageCounts: { PROCESS: 0, READY: 0, ON_THE_WAY: 0, DELIVERED: 0, COMPLETED: 0 },
      byProduct: {},
      byMarka: {},
      byFactory: {},
      recent: []
    };

    if (lastRow < 2) return out;

    const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

    rows.forEach(function (row, idx) {
      if (!appHasRowDataByMap_(row, map)) return;

      const item = {};
      APP.DB_HEADERS.forEach(function (h) {
        item[h] = map[h] ? row[map[h] - 1] : '';
      });

      item.rowNumber = idx + 2;

      const stage = appUpper_(item.STAGE || 'PROCESS');
      const product = appText_(item.PRODUCT_NAME || 'Unknown');
      const marka = appText_(item.MARKA_CODE || 'Unknown');
      const factory = appText_(item.FACTORY || 'Unknown');

      const orderQty = Number(appNumber_(item.TOTAL_ORDER) || 0);
      const receivedQty = Number(appNumber_(item.TOTAL_Received) || 0);

      out.totals.rows += 1;
      out.totals.order += orderQty;
      out.totals.received += receivedQty;
      if (stage === 'COMPLETED') out.totals.completed += 1;

      if (!out.stageCounts.hasOwnProperty(stage)) out.stageCounts[stage] = 0;
      out.stageCounts[stage] += 1;

      out.byProduct[product] = (out.byProduct[product] || 0) + orderQty;
      out.byMarka[marka] = (out.byMarka[marka] || 0) + orderQty;
      out.byFactory[factory] = (out.byFactory[factory] || 0) + orderQty;

      out.recent.push(item);
    });

    out.recent = out.recent.slice(-10).reverse();
    return out;
  });
}

/* ================= SAVE API ================= */

function APP_saveEntry(payload) {
  return appRunWrite_('APP_saveEntry', function () {
    const sh = appGetSheet_(APP.SHEETS.DATABASE);
    const map = appRequireHeaders_(sh, APP.DB_HEADERS);
    const cache = appReadSetupCache_(true);
    const lastCol = sh.getLastColumn();

    const entryId = payload && (payload.ENTRY_ID || payload.entryId || payload.entry_id || '');
    let rowIndex = appFindRowByEntryId_(sh, map, entryId);
    const isNew = !rowIndex;

    let row = rowIndex
      ? sh.getRange(rowIndex, 1, 1, lastCol).getValues()[0]
      : appBuildEmptyRowBySheet_(sh);

    row = appMapPayloadToRow_(payload || {}, row, map);

    const existingSet = appGetExistingEntryIdSet_(sh, map);
    if (rowIndex && map['ENTRY_ID']) {
      delete existingSet[appText_(row[map['ENTRY_ID'] - 1])];
    }

    const stableSr = isNew
      ? appGetNextSerialNo_(sh, map)
      : (Number(row[map['SR'] - 1]) || appGetNextSerialNo_(sh, map));

    row = appComputeOneRow_(row, map, cache, {
      sr: stableSr,
      entrySeen: existingSet
    });

    if (!rowIndex) {
      rowIndex = Math.max(sh.getLastRow() + 1, 2);
    }

    sh.getRange(rowIndex, 1, 1, lastCol).setValues([row]);
    appApplyRowSetup_(sh, rowIndex, map, cache, false);
    appSetDateFormatsRange_(sh, map, rowIndex, 1);

    if (map['STAGE'] && appUpper_(row[map['STAGE'] - 1]) === 'COMPLETED') {
      appMoveRowsToCompleted_([rowIndex]);
    }

    const finalId = map['ENTRY_ID'] ? appText_(row[map['ENTRY_ID'] - 1]) : '';

    appAudit_('APP_saveEntry', {
      status: 'DONE',
      row: rowIndex,
      entryId: finalId,
      isNew: isNew
    });

    return {
      success: true,
      row: rowIndex,
      entryId: finalId,
      message: 'Data saved successfully.'
    };
  });
}

/* ================= SAVE HELPERS ================= */

function appMapPayloadToRow_(payload, row, map) {
  const out = row.slice();
  const skip = {};

  APP.COMPUTED_FIELDS.forEach(function (f) {
    skip[f] = true;
  });

  Object.keys(payload || {}).forEach(function (key) {
    if (!map[key] || skip[key]) return;

    let val = payload[key];

    if (APP.DATE_FIELDS.indexOf(key) !== -1) {
      val = appParseUiDateToDate_(val);
    }

    out[map[key] - 1] = (val == null ? '' : val);
  });

  return out;
}

function appFindRowByEntryId_(sheet, map, entryId) {
  const target = appText_(entryId);
  if (!target || !map['ENTRY_ID']) return 0;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const values = sheet.getRange(2, map['ENTRY_ID'], lastRow - 1, 1).getValues();

  for (let i = 0; i < values.length; i++) {
    if (appText_(values[i][0]) === target) return i + 2;
  }

  return 0;
}

/* ============================================================
 15) COMPLETED MOVE ENGINE
 Roman Urdu:
 COMPLETED rows ko pehle batch me append kiya jata hai, phir reverse
 order me delete kiya jata hai. clearContent bilkul use nahi hota.
============================================================ */
function appDeleteRowsReverseGrouped_(sheet, rowNumbers) {
  if (!rowNumbers || !rowNumbers.length) return;

  const rows = rowNumbers
    .filter(function (r) { return Number(r) > 1; })
    .sort(function (a, b) { return b - a; });

  if (!rows.length) return;

  // Roman Urdu:
  // Pehle groups collect hote hain, phir bottom-to-top delete hota hai.
  // Is se row shifting ki wajah se wrong rows delete nahi hoti.
  const groups = [];
  let top = rows[0];
  let count = 1;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i] === top - count) {
      count++;
    } else {
      groups.push({ start: top - count + 1, count: count });
      top = rows[i];
      count = 1;
    }
  }
  groups.push({ start: top - count + 1, count: count });

  groups.forEach(function (g) {
    sheet.deleteRows(g.start, g.count);
  });
}

function appMapRowToTargetSheet_(sourceRow, sourceMap, targetSheet) {
  const targetMap = appHeaderMap_(targetSheet);
  const targetRow = appBuildEmptyRowBySheet_(targetSheet);

  Object.keys(targetMap).forEach(function (header) {
    if (sourceMap[header]) {
      targetRow[targetMap[header] - 1] = sourceRow[sourceMap[header] - 1];
    }
  });

  return targetRow;
}

function appMoveRowsToCompleted_(rowNumbers) {
  if (!rowNumbers || !rowNumbers.length) return { moved: 0 };

  const db = appGetSheet_(APP.SHEETS.DATABASE);
  const completed = appGetSheet_(APP.SHEETS.COMPLETED);
  const sourceMap = appRequireHeaders_(db, APP.DB_HEADERS);
  const sourceLastCol = db.getLastColumn();
  const compMap = appHeaderMap_(completed);
  const compLastRow = completed.getLastRow();

  const existingCompletedIds = {};
  if (compMap['ENTRY_ID'] && compLastRow > 1) {
    completed.getRange(2, compMap['ENTRY_ID'], compLastRow - 1, 1)
      .getValues()
      .flat()
      .forEach(function (id) {
        const t = appText_(id);
        if (t) existingCompletedIds[t] = true;
      });
  }

  const moveRows = rowNumbers
    .slice()
    .filter(function (r) { return Number(r) > 1; })
    .sort(function (a, b) { return a - b; });

  const batch = [];
  const deleteRows = [];

  moveRows.forEach(function (rowNum) {
    if (rowNum <= 1 || rowNum > db.getLastRow()) {
      appProgressLog_('MoveSkip', 'Row skipped: ' + rowNum);
      return;
    }

    const sourceRow = db.getRange(rowNum, 1, 1, sourceLastCol).getValues()[0];
    const currentId = sourceMap['ENTRY_ID'] ? appText_(sourceRow[sourceMap['ENTRY_ID'] - 1]) : '';

    // Roman Urdu:
    // Same ENTRY_ID already Completed sheet me ho to duplicate move skip hoga.
    if (currentId && existingCompletedIds[currentId]) {
      appProgressLog_('MoveSkipDuplicate', 'Already completed ENTRY_ID skipped: ' + currentId);
      deleteRows.push(rowNum);
      return;
    }

    batch.push(appMapRowToTargetSheet_(sourceRow, sourceMap, completed));
    deleteRows.push(rowNum);
    if (currentId) existingCompletedIds[currentId] = true;
  });

  if (batch.length) {
    const targetStart = Math.max(completed.getLastRow() + 1, 2);
    completed.getRange(targetStart, 1, batch.length, batch[0].length).setValues(batch);
  }

  if (deleteRows.length) {
    appDeleteRowsReverseGrouped_(db, deleteRows);
  }

  const dbMap = appRequireHeaders_(db, APP.DB_HEADERS);
  appRecomputeSrColumn_(db, dbMap);

  return { moved: batch.length, deleted: deleteRows.length };
}

function APP_moveCompleted() {
  return appRunWrite_('APP_moveCompleted', function () {
    const db = appGetSheet_(APP.SHEETS.DATABASE);
    const map = appRequireHeaders_(db, APP.DB_HEADERS);
    const lastRow = db.getLastRow();
    if (lastRow < 2) return { success: true, moved: 0 };

    const stageCol = map['STAGE'];
    const stages = db.getRange(2, stageCol, lastRow - 1, 1).getValues().flat();
    const moveRows = [];
    stages.forEach(function (stage, i) {
      if (appUpper_(stage) === 'COMPLETED') moveRows.push(i + 2);
    });

    const result = appMoveRowsToCompleted_(moveRows);
    appAudit_('APP_moveCompleted', { status: 'DONE', moved: result.moved });
    return { success: true, moved: result.moved };
  });
}


/* ============================================================
 16) REPORTS ENGINE
 Roman Urdu:
 Lightweight dashboard refresh. Data ek martaba read hota hai aur
 summaries Reports sheet me update hoti hain.
============================================================ */
function APP_refreshReports() {
  return appRunWrite_('APP_refreshReports', function () {
    const db = appGetSheet_(APP.SHEETS.DATABASE);
    const rep = appEnsureSheet_(APP.SHEETS.REPORTS);
    const map = appRequireHeaders_(db, APP.DB_HEADERS);
    const lastRow = db.getLastRow();

    appCreateOrRepairReportsSheet_();

    if (lastRow < 2) {
      rep.getRange('B4:B8').clearContent();
      rep.getRange('E4:E8').clearContent();
      return { success: true, rows: 0 };
    }

    const rows = db.getRange(2, 1, lastRow - 1, db.getLastColumn()).getValues();
    let totalRows = 0;
    let totalOrder = 0;
    let totalReceived = 0;
    let completedRows = 0;
    const stageCounts = {
      PROCESS: 0,
      READY: 0,
      ON_THE_WAY: 0,
      DELIVERED: 0,
      COMPLETED: 0
    };

    rows.forEach(function (row) {
      if (!appHasRowDataByMap_(row, map)) return;
      totalRows += 1;
      totalOrder += Number(appNumber_(row[map['TOTAL_ORDER'] - 1]) || 0);
      totalReceived += Number(appNumber_(row[map['TOTAL_Received'] - 1]) || 0);
      const stage = appUpper_(row[map['STAGE'] - 1]);
      if (stageCounts.hasOwnProperty(stage)) stageCounts[stage] += 1;
      if (stage === 'COMPLETED') completedRows += 1;
    });

    rep.getRange('B4:B8').setValues([
      [totalRows],
      [totalOrder],
      [totalReceived],
      [completedRows],
      [appFormatDateTime_(new Date())]
    ]);

    rep.getRange('E4:E8').setValues([
      [stageCounts.PROCESS],
      [stageCounts.READY],
      [stageCounts.ON_THE_WAY],
      [stageCounts.DELIVERED],
      [stageCounts.COMPLETED]
    ]);

    appAudit_('APP_refreshReports', { status: 'DONE', rows: totalRows });
    return { success: true, rows: totalRows };
  });
}


/* ============================================================
17) MULTI VIEW SYNC ENGINE (FINAL FIX - A,B,D SUPPORT)
Roman Urdu:
Ab system column letters (A,B,C) + range (A:X) + header sab support karta hai.
============================================================ */

// 🔹 Column Letter → Index (A=0, B=1...)
function appColumnLetterToIndex_(letter) {
  const t = String(letter || '').trim().toUpperCase();
  if (!t || !/^[A-Z]+$/.test(t)) return -1;

  let n = 0;
  for (let i = 0; i < t.length; i++) {
    n = n * 26 + (t.charCodeAt(i) - 64);
  }
  return n - 1;
}

// 🔹 Advanced Columns Parser (A,B,D OR A:X OR HEADER)
function appParseColumnsRawAdvanced_(colsRaw, headers) {
  const clean = String(colsRaw || '').trim().toUpperCase();
  if (!clean) return [];

  // Range support (A:X)
  const rangeMatch = /^([A-Z]+):([A-Z]+)$/.exec(clean);
  if (rangeMatch) {
    const start = appColumnLetterToIndex_(rangeMatch[1]);
    const end = appColumnLetterToIndex_(rangeMatch[2]);

    if (start !== -1 && end !== -1 && end >= start) {
      const out = [];
      for (let i = start; i <= end; i++) out.push(i);
      return out;
    }
  }

  // Mixed support
  return [...new Set(
    clean.split(',')
      .map(x => x.trim())
      .filter(Boolean)
      .map(token => {
        // Column Letter
        if (/^[A-Z]+$/.test(token)) return appColumnLetterToIndex_(token);

        // Header fallback
        return headers.findIndex(h => appUpper_(h) === token);
      })
      .filter(idx => idx !== -1)
  )];
}

function APP_syncMultiViews() {
  return appRunWrite_('APP_syncMultiViews', function () {

    const db = appGetSheet_(APP.SHEETS.DATABASE);
    const set = appGetSheet_(APP.SHEETS.SETTINGS);

    const dbLastRow = db.getLastRow();
    const dbLastCol = db.getLastColumn();

    if (dbLastRow < 1 || dbLastCol < 1) {
      return { success: true, synced: 0, message: 'Database empty' };
    }

    const dbData = db.getRange(1, 1, dbLastRow, dbLastCol).getValues();
    const headers = (dbData[0] || []).map(appText_);
    const rows = dbData.slice(1);

    const totalRows = set.getLastRow();
    if (totalRows < 2) {
      appAudit_('APP_syncMultiViews', { status: 'NO_SETTINGS', synced: 0 });
      return { success: true, synced: 0, message: 'Settings sheet has no active rows' };
    }

    const settings = set.getRange(2, 1, totalRows - 1, 9).getValues();

    let synced = 0;
    let activeCount = 0;
    let errorCount = 0;
    let matchedTotal = 0;
    const runId = 'sync-' + Utilities.formatDate(new Date(), APP.TZ, 'yyyyMMdd-HHmmss');
    const openedSheets = {};

    settings.forEach(function (cfg, i) {
      try {
        const viewName = appText_(cfg[0]);
        const url = appText_(cfg[1]);
        const sheetName = appText_(cfg[2]);
        const colsRaw = appText_(cfg[3]);
        const filterCols = appParseCsvList_(cfg[4]);
        const filterVals = appParseCsvList_(cfg[5]);
        const active = appUpper_(cfg[6]);
        const startRow = Number(cfg[7] || 1);
        const settingsRow = i + 2;

        if (!viewName && !url && !sheetName && !colsRaw && !cfg[4] && !cfg[5]) {
          return;
        }

        if (active !== 'YES') return;
        activeCount++;

        if (!url) throw new Error('Target URL missing');
        if (!sheetName) throw new Error('Target SHEET_NAME missing');

        const selectedIndexes = appParseColumnsRawAdvanced_(colsRaw, headers);
        if (!selectedIndexes.length) {
          throw new Error('Row ' + settingsRow + ': Invalid column selection');
        }

        const filterIndexes = filterCols.map(function (h) {
          const idx = headers.findIndex(function (x) { return appUpper_(x) === appUpper_(h); });
          if (idx === -1) throw new Error('Filter column missing: ' + h);
          return idx;
        });

        const out = [selectedIndexes.map(function (idx) { return headers[idx]; })];
        let matchedRows = 0;

        rows.forEach(function (row) {
          if (!appHasAnyValue_(row)) return;

          let pass = true;

          for (let f = 0; f < filterIndexes.length; f++) {
            const cell = appLower_(row[filterIndexes[f]]);
            const want = appLower_(filterVals[f] || '');

            // Roman Urdu:
            // Agar filter value blank/missing hai to us filter ko skip karo.
            if (!want) continue;

            if (cell !== want) {
              pass = false;
              break;
            }
          }

          if (pass) {
            matchedRows++;
            out.push(selectedIndexes.map(function (idx) { return row[idx]; }));
          }
        });

        if (!openedSheets[url]) openedSheets[url] = SpreadsheetApp.openByUrl(url);
        const target = openedSheets[url];
        let sh = target.getSheetByName(sheetName);
        if (!sh) sh = target.insertSheet(sheetName);

        const safeStartRow = (startRow > 0 && startRow <= 2) ? 1 : (startRow > 0 ? startRow : 1);
        const clearRows = Math.max(sh.getMaxRows() - safeStartRow + 1, 1);
        const clearCols = Math.max(sh.getMaxColumns(), out[0].length);

        sh.getRange(safeStartRow, 1, clearRows, clearCols).clearContent();
        sh.getRange(safeStartRow, 1, out.length, out[0].length).setValues(out);

        synced++;
        matchedTotal += matchedRows;

      } catch (err) {
        errorCount++;
        appError_('APP_syncMultiViews', err, { settingsRow: i + 2, runId: runId });
      }
    });

    appAudit_('APP_syncMultiViews', {
      runId: runId,
      active: activeCount,
      synced: synced,
      errors: errorCount,
      matched: matchedTotal
    });

    return {
      success: errorCount === 0,
      synced: synced,
      active: activeCount,
      errors: errorCount,
      matched: matchedTotal
    };
  });
}

/* ============================================================
 18) TRIGGER + MAINTENANCE ENGINE
 Roman Urdu:
 Managed installable triggers yahan create hote hain. Duplicate triggers
 pehle delete kiye jate hain phir clean install hoti hai.
============================================================ */
function APP_installDailyTriggers() {
  return appRunWrite_('APP_installDailyTriggers', function () {
    const ss = appGetSS_();

    // Roman Urdu:
    // Sync manual rakha gaya hai. Time-based APP_syncMultiViews triggers delete ho jayenge.
    const handlers = {
      APP_handleChange_: true,
      APP_syncMultiViews: true,
      APP_trimLogs: true
    };

    ScriptApp.getProjectTriggers().forEach(function (tr) {
      if (handlers[tr.getHandlerFunction()]) {
        ScriptApp.deleteTrigger(tr);
      }
    });

    ScriptApp.newTrigger('APP_handleChange_')
      .forSpreadsheet(ss)
      .onChange()
      .create();

    ScriptApp.newTrigger('APP_trimLogs')
      .timeBased()
      .atHour(2)
      .everyDays(1)
      .create();

    appAudit_('APP_installDailyTriggers', { status: 'DONE', syncMode: 'MANUAL_ONLY' });
    SpreadsheetApp.getUi().alert('Triggers installed. Sync manual mode me rahega. Sirf onChange + log trim trigger active hain.');
  });
}

function APP_runManualSync() {
  return APP_syncMultiViews();
}


/* ============================================================
 19) PUBLIC REPAIR TOOLS
 Roman Urdu:
 Manual helper tools. SR logic ab appRecomputeSrColumn_ se unified hai.
============================================================ */
function appResequenceSerialsNoLock_(sh, map) {
  return appRecomputeSrColumn_(sh, map);
}

function APP_resequenceSerials() {
  return appRunWrite_('APP_resequenceSerials', function () {
    const sh = appGetSheet_(APP.SHEETS.DATABASE);
    const map = appRequireHeaders_(sh, APP.DB_HEADERS);
    return appResequenceSerialsNoLock_(sh, map);
  }, APP.LOCKS.WAIT_MS);
}

function APP_refreshCurrentRow(rowNumber) {
  return appRunWrite_('APP_refreshCurrentRow', function () {
    const sh = appGetSheet_(APP.SHEETS.DATABASE);
    const map = appRequireHeaders_(sh, APP.DB_HEADERS);
    const cache = appReadSetupCache_(true);
    const row = Number(rowNumber);
    if (!row || row < 2 || row > sh.getLastRow()) throw new Error('Invalid row number');

    const rowData = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
    const state = appBuildRepairStateBeforeRow_(sh, map, row);

    let computed;
    if (!appHasRowDataByMap_(rowData, map)) {
      computed = appClearComputedFields_(rowData, map);
    } else {
      state.serial += 1;
      computed = appComputeOneRow_(rowData, map, cache, {
        sr: state.serial,
        entrySeen: state.entrySeen
      });
    }

    sh.getRange(row, 1, 1, sh.getLastColumn()).setValues([computed]);
    appSetDateFormatsRange_(sh, map, row, 1);
    appResequenceSerialsNoLock_(sh, map);
    return { success: true, row: row };
  }, APP.LOCKS.WAIT_MS);
}

function APP_debugBootstrap() {
  return APP_getFormBootstrap();
}


/* ============================================================
 20) COMPATIBILITY WRAPPERS
 Roman Urdu:
 Purane function names ke wrappers diye gaye hain taake old menu,
 old HTML ya team habits break na hon.
============================================================ */
function moveCompletedFast() {
  return APP_moveCompleted();
}

function syncMultiViews() {
  return APP_runManualSync();
}

function cleanLogs() {
  return APP_trimLogs();
}

function APP_repairInBatches() {
  return APP_repairAllRows();
}
