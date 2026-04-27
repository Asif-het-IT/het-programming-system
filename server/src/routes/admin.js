import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createUserSchema,
  assignViewSchema,
  updateUserSchema,
  resetPasswordSchema,
  userStatusSchema,
  auditQuerySchema,
  dailyAuditReportQuerySchema,
  verifyViewAlignmentQuerySchema,
  gasViewsQuerySchema,
  adminColumnsQuerySchema,
  adminFilterValuesQuerySchema,
  createDatabaseSchema,
  updateDatabaseSchema,
  createViewDefinitionSchema,
  updateViewDefinitionSchema,
} from './schemas.js';
import {
  listUsers,
  createUser,
  assignView,
  updateUser,
  deleteUser,
  resetUserPassword,
  setUserStatus,
} from '../data/users.js';
import { listAuditEvents, writeAuditEvent } from '../data/auditLog.js';
import { getDailyAuditReport, listDailyAuditReports } from '../data/auditReports.js';
import { fetchDataFromGas, fetchViewOutputFromGas, fetchViewConfigFromGas } from '../services/gasClient.js';
import { getQualifiedViewName, getViewConfigFromSource } from '../services/viewConfigService.js';
import { alignRecordsToView, compareViewOutputs } from '../services/viewProjectionService.js';
import {
  getAllSubscriptions,
  getSubscriptionsByEmail,
  getSubscriptionsByRole,
  getSubscriptionsByEmails,
} from '../data/pushSubscriptions.js';
import { logNotification, getNotificationLogs } from '../data/notificationLog.js';
import { sendPushToSubscriptions, isVapidReady } from '../services/pushService.js';
import {
  listDatabases,
  createDatabase,
  updateDatabaseById,
  deleteDatabaseById,
  listViews,
  createView,
  updateView,
  deleteView,
  getDatabaseById,
  getDatabaseByName,
  getViewByName,
} from '../data/databaseRegistry.js';

const router = Router();

function extractRows(payload) {
  if (Array.isArray(payload?.data?.records)) return payload.data.records;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function extractTotalRows(payload) {
  const candidates = [
    payload?.data?.totalRows,
    payload?.data?.total,
    payload?.totalRows,
    payload?.total,
    payload?.pagination?.total,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
  }

  return null;
}

function toSheetColumnLetter(index) {
  let n = Number(index) + 1;
  if (!Number.isFinite(n) || n <= 0) return '';

  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCodePoint(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function fromSheetColumnLetter(letter) {
  const raw = String(letter || '').trim().toUpperCase();
  if (!raw || /[^A-Z]/.test(raw)) return -1;

  let out = 0;
  for (const ch of raw) {
    out = (out * 26) + (ch.codePointAt(0) - 64);
  }

  return out - 1;
}

function extractRangeEndColumn(dataRange) {
  const raw = String(dataRange || '').trim().toUpperCase();
  if (!raw) return '';

  const parts = raw.split(':');
  const lastPart = parts.at(-1) || '';
  const match = /[A-Z]+/.exec(lastPart);
  return match ? match[0] : '';
}

function extractHeaderCells(payload) {
  const candidates = [
    payload?.data?.headers,
    payload?.headers,
    payload?.data?.meta?.headers,
    payload?.meta?.headers,
    payload?.data?.source?.headers,
    payload?.source?.headers,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }
  }

  return [];
}

function getColumnsFromRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const firstRow = rows.find((row) => row && typeof row === 'object');
  return firstRow ? Object.keys(firstRow) : [];
}

function findLastNonEmptyHeaderIndex(headerCells, fallbackColumns) {
  const headers = Array.isArray(headerCells) ? headerCells : [];
  for (let i = headers.length - 1; i >= 0; i -= 1) {
    if (String(headers[i] ?? '').trim()) return i;
  }

  const safeFallback = Array.isArray(fallbackColumns) ? fallbackColumns : [];
  return safeFallback.length > 0 ? safeFallback.length - 1 : -1;
}

function buildRangeMetadata(payload, lastHeaderIndex, totalColumns) {
  const headerRow = 1;
  const safeLastIndex = Number.isFinite(lastHeaderIndex) ? Math.floor(lastHeaderIndex) : -1;
  const safeTotalColumns = Number.isFinite(totalColumns) ? Math.max(0, Math.floor(totalColumns)) : 0;
  const lastColumn = safeLastIndex >= 0 ? toSheetColumnLetter(safeLastIndex) : '';
  const totalRows = extractTotalRows(payload);

  let detectedSourceRange = '';
  if (lastColumn) {
    if (Number.isFinite(totalRows) && totalRows > 0) {
      detectedSourceRange = `A1:${lastColumn}${totalRows + headerRow}`;
    } else {
      detectedSourceRange = `A:${lastColumn}`;
    }
  }

  return {
    detectedSourceRange,
    totalColumns: safeTotalColumns,
    headerRow,
    lastColumn,
    totalRows,
  };
}

function detectColumnsAndMetadata(payload, fallbackColumns = []) {
  const rows = extractRows(payload);
  const rowColumns = getColumnsFromRows(rows);
  const providedFallback = Array.isArray(fallbackColumns) ? fallbackColumns : [];
  const columns = (rowColumns.length > 0 ? rowColumns : providedFallback)
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  const headerCells = extractHeaderCells(payload);
  const lastHeaderIndex = findLastNonEmptyHeaderIndex(headerCells, columns);
  const totalColumns = Number.isFinite(lastHeaderIndex) && lastHeaderIndex >= 0
    ? lastHeaderIndex + 1
    : columns.length;

  return {
    columns,
    metadata: buildRangeMetadata(payload, lastHeaderIndex, totalColumns),
  };
}

function extractUniqueValues(rows, column, limit = 500) {
  const normalizedColumn = String(column || '').trim();
  if (!normalizedColumn) return [];

  const seen = new Set();
  const values = [];
  for (const row of rows || []) {
    const raw = row?.[normalizedColumn];
    const value = String(raw == null ? '' : raw).trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(value);
    if (values.length >= limit) break;
  }

  return values;
}

function isLegacyDatabase(database) {
  const db = String(database || '').toUpperCase();
  return db === 'MEN_MATERIAL' || db === 'LACE_GAYLE';
}

async function fetchCustomDatabaseSample(databaseName, requester, pageSize = 200) {
  const payload = await fetchCustomDatabaseSamplePayload(databaseName, requester, pageSize);
  return extractRows(payload);
}

async function fetchCustomDatabaseSamplePayload(databaseName, requester, pageSize = 200, options = {}) {
  const db = getDatabaseByName(databaseName);
  if (!db) throw new Error('Database not found');
  if (!db.active) throw new Error('Database is inactive');

  const { dataRange, useConfiguredRange = true } = options;
  const resolvedDataRange = dataRange || (useConfiguredRange ? db.dataRange : '');

  const requestPayload = {
    database: db.name,
    sheetIdOrUrl: db.sheetIdOrUrl,
    sheetName: db.sheetName,
    page: 1,
    pageSize,
    requester,
  };

  if (resolvedDataRange) {
    requestPayload.dataRange = resolvedDataRange;
  }

  return fetchDataFromGas(requestPayload);
}

router.use(requireAuth, requirePermission('admin:manage'));

function resolveDatabaseByIdentifier(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  return getDatabaseById(raw) || getDatabaseByName(raw);
}

router.get('/databases', (_req, res) => {
  res.json({ databases: listDatabases() });
});

router.post('/databases', validate(createDatabaseSchema), (req, res, next) => {
  try {
    const database = createDatabase(req.body);
    writeAuditEvent({
      actor: req.user?.email,
      action: 'admin.database.create',
      target: database.name,
      details: {
        sheetName: database.sheetName,
        dataRange: database.dataRange,
        active: database.active,
      },
    });
    res.status(201).json({ database });
  } catch (error) {
    next({ status: 400, message: error.message });
  }
});

router.put('/databases/:id', validate(updateDatabaseSchema), (req, res, next) => {
  try {
    const target = resolveDatabaseByIdentifier(req.params.id);
    if (!target) return next({ status: 404, message: 'Database not found' });

    const database = updateDatabaseById(target.id, req.body);
    writeAuditEvent({
      actor: req.user?.email,
      action: 'admin.database.update',
      target: database.name,
      details: {
        sheetName: database.sheetName,
        dataRange: database.dataRange,
        active: database.active,
      },
    });
    res.json({ database });
  } catch (error) {
    next({ status: 400, message: error.message });
  }
});

router.delete('/databases/:id', (req, res, next) => {
  try {
    const target = resolveDatabaseByIdentifier(req.params.id);
    if (!target) return next({ status: 404, message: 'Database not found' });

    const removed = deleteDatabaseById(target.id);
    writeAuditEvent({
      actor: req.user?.email,
      action: 'admin.database.delete',
      target: removed.name,
      details: {},
    });
    res.json({ database: removed });
  } catch (error) {
    next({ status: 400, message: error.message });
  }
});

router.post('/databases/:id/detect-columns', async (req, res, next) => {
  try {
    const db = resolveDatabaseByIdentifier(req.params.id);
    if (!db) return next({ status: 404, message: 'Database not found' });
    const dbName = db.name;

    let payload = null;
    let columns = [];
    let metadata = null;

    if (isLegacyDatabase(dbName)) {
      const response = await fetchViewConfigFromGas({ database: dbName });
      const configs = Array.isArray(response?.data?.configs) ? response.data.configs : [];
      const firstView = configs[0]?.view;
      const fallbackColumns = Array.isArray(configs[0]?.columnsList) ? configs[0].columnsList : [];

      // Prefer unprojected records for schema discovery so detection reflects full
      // sheet headers rather than a view's columnsList projection.
      try {
        payload = await fetchDataFromGas({
          database: dbName,
          page: 1,
          pageSize: 2,
          dataRange: 'A:ZZZ',
          requester: req.user?.email,
        });
      } catch {
        // Fallback for legacy bridge variants that require a view context.
        if (firstView) {
          payload = dbName === 'LACE_GAYLE'
            ? await fetchViewOutputFromGas({ database: dbName, view: firstView, page: 1, pageSize: 1, requester: req.user?.email })
            : await fetchDataFromGas({ database: dbName, view: firstView, page: 1, pageSize: 1, requester: req.user?.email });
        }
      }

      const detected = detectColumnsAndMetadata(payload, fallbackColumns);
      columns = detected.columns;
      metadata = detected.metadata;
    } else {
      // Force a wide discovery range so detection is not limited by a stale configured dataRange.
      payload = await fetchCustomDatabaseSamplePayload(dbName, req.user?.email, 2, {
        dataRange: 'A:ZZZ',
        useConfiguredRange: false,
      });
      const detected = detectColumnsAndMetadata(payload);
      columns = detected.columns;
      metadata = detected.metadata;
    }

    const currentEndColumn = extractRangeEndColumn(db.dataRange);
    const currentEndIndex = fromSheetColumnLetter(currentEndColumn);
    const detectedEndIndex = fromSheetColumnLetter(metadata?.lastColumn);

    let autoUpdated = false;
    let database = db;
    if (detectedEndIndex > currentEndIndex && metadata?.lastColumn) {
      database = updateDatabaseById(db.id, { dataRange: `A:${metadata.lastColumn}` });
      autoUpdated = true;

      writeAuditEvent({
        actor: req.user?.email,
        action: 'admin.database.auto_expand_range',
        target: db.name,
        details: {
          previousRange: db.dataRange,
          nextRange: `A:${metadata.lastColumn}`,
          lastColumn: metadata.lastColumn,
        },
      });
    }

    res.json({
      database: dbName,
      count: columns.length,
      columns,
      metadata,
      autoUpdated,
      savedRange: database.dataRange,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/view-definitions', (req, res) => {
  const database = req.query.database ? String(req.query.database).trim().toUpperCase() : undefined;
  res.json({ views: listViews({ database }) });
});

router.post('/view-definitions', validate(createViewDefinitionSchema), (req, res, next) => {
  try {
    const selectedSet = new Set(req.body.selectedColumns || []);
    const invalidFilterable = (req.body.filterableColumns || []).find((column) => !selectedSet.has(column));
    if (invalidFilterable) {
      return next({ status: 400, message: `Filterable column must be part of selected columns: ${invalidFilterable}` });
    }
    const invalidRule = (req.body.filterRules || []).find((rule) => !selectedSet.has(rule.column));
    if (invalidRule) {
      return next({ status: 400, message: `Filter column must be part of selected columns: ${invalidRule.column}` });
    }
    if (req.body.sort?.column && !selectedSet.has(req.body.sort.column)) {
      return next({ status: 400, message: `Sort column must be part of selected columns: ${req.body.sort.column}` });
    }

    const view = createView(req.body);
    writeAuditEvent({
      actor: req.user?.email,
      action: 'admin.view_definition.create',
      target: `${view.database}:${view.viewName}`,
      details: {
        columns: view.selectedColumns.length,
        filters: view.filterRules.length,
      },
    });
    res.status(201).json({ view });
  } catch (error) {
    next({ status: 400, message: error.message });
  }
});

router.put('/view-definitions/:id', validate(updateViewDefinitionSchema), (req, res, next) => {
  try {
    const current = listViews().find((item) => item.id === req.params.id);
    if (!current) return next({ status: 404, message: 'View not found' });

    const selectedColumns = req.body.selectedColumns || current.selectedColumns || [];
    const selectedSet = new Set(selectedColumns);
    const filterableColumns = req.body.filterableColumns || current.filterableColumns || [];
    const invalidFilterable = filterableColumns.find((column) => !selectedSet.has(column));
    if (invalidFilterable) {
      return next({ status: 400, message: `Filterable column must be part of selected columns: ${invalidFilterable}` });
    }
    const rules = req.body.filterRules || current.filterRules || [];
    const invalidRule = rules.find((rule) => !selectedSet.has(rule.column));
    if (invalidRule) {
      return next({ status: 400, message: `Filter column must be part of selected columns: ${invalidRule.column}` });
    }
    const sortColumn = req.body.sort?.column ?? current.sort?.column;
    if (sortColumn && !selectedSet.has(sortColumn)) {
      return next({ status: 400, message: `Sort column must be part of selected columns: ${sortColumn}` });
    }

    const view = updateView(req.params.id, req.body);
    writeAuditEvent({
      actor: req.user?.email,
      action: 'admin.view_definition.update',
      target: `${view.database}:${view.viewName}`,
      details: {
        columns: view.selectedColumns.length,
        filters: view.filterRules.length,
      },
    });
    res.json({ view });
  } catch (error) {
    next({ status: 400, message: error.message });
  }
});

router.delete('/view-definitions/:id', (req, res, next) => {
  try {
    const view = deleteView(req.params.id);
    writeAuditEvent({
      actor: req.user?.email,
      action: 'admin.view_definition.delete',
      target: `${view.database}:${view.viewName}`,
      details: {},
    });
    res.json({ view });
  } catch (error) {
    next({ status: 400, message: error.message });
  }
});

router.get('/users', (_req, res) => {
  res.json({ users: listUsers() });
});

router.post('/user', validate(createUserSchema), (req, res, next) => {
  try {
    const actor = req.user?.email;
    const user = createUser(req.body);
    writeAuditEvent({
      actor,
      action: 'admin.user.create',
      target: user.email,
      details: {
        role: user.role,
        databases: user.databases,
        viewsCount: user.views?.length || 0,
      },
    });
    res.status(201).json({ user });
  } catch (error) {
    next({ status: 400, message: error.message });
  }
});

router.put('/assign-view', validate(assignViewSchema), (req, res, next) => {
  try {
    const actor = req.user?.email;
    const updated = assignView(req.body.email, req.body);
    writeAuditEvent({
      actor,
      action: 'admin.user.assign_view',
      target: updated.email,
      details: {
        databases: updated.databases,
        viewsCount: updated.views?.length || 0,
        permissions: updated.permissions,
        quota: updated.quota,
      },
    });
    res.json({ user: updated });
  } catch (error) {
    next({ status: 400, message: error.message });
  }
});

router.put('/user/:email', validate(updateUserSchema), (req, res, next) => {
  try {
    const actor = req.user?.email;
    const updated = updateUser(req.params.email, req.body);
    writeAuditEvent({
      actor,
      action: 'admin.user.update',
      target: updated.email,
      details: {
        role: updated.role,
        databases: updated.databases,
        viewsCount: updated.views?.length || 0,
        permissions: updated.permissions,
        quota: updated.quota,
        allowedColumns: updated.allowedColumns,
        allowedColumnsByView: updated.allowedColumnsByView,
        allowedFilterColumnsByView: updated.allowedFilterColumnsByView,
        filterValueRulesByView: updated.filterValueRulesByView,
      },
    });
    res.json({ user: updated });
  } catch (error) {
    next({ status: 400, message: error.message });
  }
});

router.delete('/user/:email', (req, res, next) => {
  try {
    const actor = req.user?.email;
    const removed = deleteUser(req.params.email);
    writeAuditEvent({
      actor,
      action: 'admin.user.delete',
      target: removed.email,
      details: { role: removed.role },
    });
    res.json({ user: removed });
  } catch (error) {
    next({ status: 400, message: error.message });
  }
});

router.post('/reset-password', validate(resetPasswordSchema), (req, res, next) => {
  try {
    const actor = req.user?.email;
    const updated = resetUserPassword(req.body.email, req.body.newPassword);
    writeAuditEvent({
      actor,
      action: 'admin.user.reset_password',
      target: updated.email,
      details: {},
    });
    res.json({ user: updated });
  } catch (error) {
    next({ status: 400, message: error.message });
  }
});

router.put('/user-status', validate(userStatusSchema), (req, res, next) => {
  try {
    const actor = req.user?.email;
    const updated = setUserStatus(req.body.email, req.body.enabled);
    writeAuditEvent({
      actor,
      action: req.body.enabled ? 'admin.user.enable' : 'admin.user.disable',
      target: updated.email,
      details: { enabled: req.body.enabled },
    });
    res.json({ user: updated });
  } catch (error) {
    next({ status: 400, message: error.message });
  }
});

router.get('/audit-log', validate(auditQuerySchema, 'query'), (req, res) => {
  const events = listAuditEvents(req.validatedQuery.limit);
  res.json({ events });
});

router.get('/audit-report/daily', validate(dailyAuditReportQuerySchema, 'query'), (req, res) => {
  const { day, limit } = req.validatedQuery;

  if (day) {
    return res.json({ report: getDailyAuditReport(day) });
  }

  return res.json({ reports: listDailyAuditReports(limit) });
});

router.get('/verify-view-alignment', validate(verifyViewAlignmentQuerySchema, 'query'), async (req, res, next) => {
  try {
    const query = req.validatedQuery;
    const viewConfig = await getViewConfigFromSource({
      database: query.database,
      view: query.view,
    });

    let webData;
    if (query.database === 'LACE_GAYLE') {
      // LACE_GAYLE data lives in per-outlet external spreadsheets, use view-output for both sides
      webData = await fetchViewOutputFromGas({
        database: query.database,
        view: query.view,
        page: query.page,
        pageSize: query.pageSize,
        requester: req.user?.email,
      });
    } else {
      // Build GAS filter params from view config for MEN_MATERIAL
      const gasFilterParams = {};
      const cols = viewConfig.filterColumns || [];
      const vals = viewConfig.filterValues || [];
      cols.forEach((col, i) => {
        if (col && vals[i] !== undefined && vals[i] !== '') gasFilterParams[col] = vals[i];
      });
      webData = await fetchDataFromGas({
        database: query.database,
        view: query.view,
        page: query.page,
        pageSize: query.pageSize,
        ...gasFilterParams,
        requester: req.user?.email,
      });
    }

    let webRows = [];
    if (Array.isArray(webData?.data?.records)) {
      webRows = webData.data.records;
    } else if (Array.isArray(webData?.records)) {
      webRows = webData.records;
    } else if (Array.isArray(webData?.data?.items)) {
      webRows = webData.data.items;
    } else if (Array.isArray(webData?.items)) {
      webRows = webData.items;
    }

    // For LACE_GAYLE external sheets, skip field filtering (no MARKA_CODE/PRODUCT_CATEGORY columns)
    const alignConfig = query.database === 'LACE_GAYLE'
      ? { ...viewConfig, filterColumns: [], filterValues: [] }
      : viewConfig;
    const alignedWeb = alignRecordsToView(webRows, alignConfig);

    const targetData = await fetchViewOutputFromGas({
      database: query.database,
      view: query.view,
      page: query.page,
      pageSize: query.pageSize,
      requester: req.user?.email,
    });

    let targetRows = [];
    if (Array.isArray(targetData?.data?.records)) {
      targetRows = targetData.data.records;
    } else if (Array.isArray(targetData?.records)) {
      targetRows = targetData.records;
    } else if (Array.isArray(targetData?.data?.items)) {
      targetRows = targetData.data.items;
    } else if (Array.isArray(targetData?.items)) {
      targetRows = targetData.items;
    }

    const comparison = compareViewOutputs(
      alignedWeb.records,
      targetRows,
      alignedWeb.selectedHeaders,
    );

    writeAuditEvent({
      actor: req.user?.email,
      action: 'admin.verify_view_alignment',
      target: `${query.database}:${query.view}`,
      details: {
        match: comparison.match,
        mismatchCount: comparison.mismatchCount,
        webCount: comparison.webCount,
        targetCount: comparison.targetCount,
      },
    });

    return res.json({
      database: query.database,
      view: query.view,
      source: 'gas-settings',
      config: viewConfig,
      selectedHeaders: alignedWeb.selectedHeaders,
      comparison,
    });
  } catch (error) {
    return next(error);
  }
});

// List all view names available in the GAS Settings sheet for a given database.
// Used by the admin panel to populate the view-assignment dropdown dynamically.
router.get('/gas-views', validate(gasViewsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { database } = req.validatedQuery;

    if (!isLegacyDatabase(database)) {
      const dynamicViews = listViews({ database, includeInactive: false }).map((view) => ({
        view: view.viewName,
        sheetName: '',
        filterColumns: (view.filterRules || []).map((rule) => rule.column),
        filterValues: (view.filterRules || []).map((rule) => rule.value),
        columnsList: view.selectedColumns || [],
      }));
      return res.json({ database, count: dynamicViews.length, views: dynamicViews });
    }

    const response = await fetchViewConfigFromGas({ database });
    const data = response?.data || response || {};
    const configs = Array.isArray(data?.configs) ? data.configs : [];

    const views = configs
      .filter((c) => c && String(c.view || '').trim())
      .map((c) => ({
        view: String(c.view).trim(),
        sheetName: String(c.sheetName || ''),
        filterColumns: Array.isArray(c.filterColumns) ? c.filterColumns : [],
        filterValues: Array.isArray(c.filterValues) ? c.filterValues : [],
        columnsList: Array.isArray(c.columnsList) ? c.columnsList : [],
      }));

    return res.json({ database, count: views.length, views });
  } catch (error) {
    return next(error);
  }
});

router.get('/views', async (req, res, next) => {
  try {
    const databases = listDatabases({ includeInactive: false }).map((db) => db.name);
    const legacy = databases.filter((database) => isLegacyDatabase(database));
    const custom = new Set(databases.filter((database) => !isLegacyDatabase(database)));

    const results = await Promise.all(legacy.map(async (database) => {
      const response = await fetchViewConfigFromGas({ database });
      const data = response?.data || response || {};
      const configs = Array.isArray(data?.configs) ? data.configs : [];

      return configs
        .filter((c) => c && String(c.view || '').trim())
        .map((c) => ({
          database,
          viewName: getQualifiedViewName({
            database,
            viewName: String(c.view).trim(),
            sheetName: String(c.sheetName || ''),
          }),
          sheetName: String(c.sheetName || ''),
          filterColumns: Array.isArray(c.filterColumns) ? c.filterColumns : [],
          filterValues: Array.isArray(c.filterValues) ? c.filterValues : [],
          columnsList: Array.isArray(c.columnsList) ? c.columnsList : [],
        }));
    }));

    const customViews = listViews({ includeInactive: false })
      .filter((view) => custom.has(view.database))
      .map((view) => ({
        database: view.database,
        viewName: view.viewName,
        sheetName: '',
        filterColumns: (view.filterRules || []).map((rule) => rule.column),
        filterValues: (view.filterRules || []).map((rule) => rule.value),
        columnsList: view.selectedColumns || [],
      }));

    const views = [...results.flat(), ...customViews];
    return res.json({ count: views.length, views });
  } catch (error) {
    return next(error);
  }
});

router.get('/columns', validate(adminColumnsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { database, view } = req.validatedQuery;

    if (!isLegacyDatabase(database)) {
      const dynamicView = getViewByName(database, view);
      if (!dynamicView) {
        return next({ status: 404, message: 'View not found for selected database' });
      }

      return res.json({
        database,
        view,
        count: (dynamicView.selectedColumns || []).length,
        columns: dynamicView.selectedColumns || [],
      });
    }

    let payload;

    if (database === 'LACE_GAYLE') {
      payload = await fetchViewOutputFromGas({
        database,
        view,
        page: 1,
        pageSize: 1,
        requester: req.user?.email,
      });
    } else {
      const viewConfig = await getViewConfigFromSource({ database, view });
      const gasFilterParams = {};
      const cols = viewConfig.filterColumns || [];
      const vals = viewConfig.filterValues || [];
      cols.forEach((col, i) => {
        if (col && vals[i] !== undefined && vals[i] !== '') {
          gasFilterParams[col] = vals[i];
        }
      });

      payload = await fetchDataFromGas({
        database,
        view,
        page: 1,
        pageSize: 1,
        ...gasFilterParams,
        requester: req.user?.email,
      });
    }

    const rows = extractRows(payload);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return res.json({ database, view, count: columns.length, columns });
  } catch (error) {
    return next(error);
  }
});

router.get('/filter-values', validate(adminFilterValuesQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { database, view, column } = req.validatedQuery;
    let rows = [];

    if (!isLegacyDatabase(database)) {
      rows = await fetchCustomDatabaseSample(database, req.user?.email, 2000);
    } else if (database === 'LACE_GAYLE') {
      const payload = await fetchViewOutputFromGas({
        database,
        view,
        page: 1,
        pageSize: 1000,
        requester: req.user?.email,
      });
      rows = extractRows(payload);
    } else {
      const viewConfig = await getViewConfigFromSource({ database, view });
      const gasFilterParams = {};
      const cols = viewConfig.filterColumns || [];
      const vals = viewConfig.filterValues || [];
      cols.forEach((col, i) => {
        if (col && vals[i] !== undefined && vals[i] !== '') {
          gasFilterParams[col] = vals[i];
        }
      });

      const payload = await fetchDataFromGas({
        database,
        view,
        page: 1,
        pageSize: 1000,
        ...gasFilterParams,
        requester: req.user?.email,
      });
      rows = extractRows(payload);
    }

    const values = extractUniqueValues(rows, column, 300);
    return res.json({ database, view, column, count: values.length, values });
  } catch (error) {
    return next(error);
  }
});

// ─── Admin: Notification System ──────────────────────────────────────────────

router.get('/notifications/subscribers', (_req, res) => {
  const subs = getAllSubscriptions();
  const safe = subs.map(({ email, role, subscribedAt, lastSeen }) => ({
    email, role, subscribedAt, lastSeen,
  }));
  return res.json({ count: safe.length, subscribers: safe });
});

router.get('/notifications/logs', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  return res.json({ logs: getNotificationLogs(limit) });
});

router.get('/notifications/status', (_req, res) => {
  return res.json({ vapidReady: isVapidReady(), subscribed: getAllSubscriptions().length });
});

router.post('/notifications/send', async (req, res, next) => {
  try {
    const { title, body, link, priority, type, target, targetEmail, targetRole, targetDatabases, targetViews } = req.body;

    if (!title || !body) {
      return next({ status: 400, message: 'title and body are required' });
    }

    const payload = JSON.stringify({
      title: String(title).slice(0, 200),
      body: String(body).slice(0, 500),
      link: link || '/dashboard',
      priority: priority || 'normal',
      type: type || 'admin_announcement',
      sentAt: new Date().toISOString(),
    });

    let subscriptions = [];

    if (target === 'all') {
      subscriptions = getAllSubscriptions();
    } else if (target === 'email' && targetEmail) {
      subscriptions = getSubscriptionsByEmail(targetEmail);
    } else if (target === 'role' && targetRole) {
      subscriptions = getSubscriptionsByRole(targetRole);
    } else if (target === 'database' && Array.isArray(targetDatabases) && targetDatabases.length) {
      const dbSet = new Set(targetDatabases);
      const all = listUsers();
      const emails = all.filter((u) => u.databases?.some((d) => dbSet.has(d))).map((u) => u.email);
      subscriptions = getSubscriptionsByEmails(emails);
    } else if (target === 'view' && Array.isArray(targetViews) && targetViews.length) {
      const viewSet = new Set(targetViews);
      const all = listUsers();
      const emails = all.filter((u) => u.views?.some((v) => viewSet.has(v))).map((u) => u.email);
      subscriptions = getSubscriptionsByEmails(emails);
    } else {
      return next({ status: 400, message: 'Invalid target specification' });
    }

    const { delivered, failed } = await sendPushToSubscriptions(subscriptions, payload);

    logNotification({
      actor: req.user.email,
      target: target || 'custom',
      title,
      body,
      priority,
      type,
      recipientCount: subscriptions.length,
      delivered,
      failed,
    });

    writeAuditEvent({
      actor: req.user.email,
      action: 'admin.notification.send',
      target: target || 'custom',
      details: { title, recipientCount: subscriptions.length, delivered, failed },
    });

    return res.json({ sent: true, recipientCount: subscriptions.length, delivered, failed });
  } catch (error) {
    return next(error);
  }
});

export default router;
