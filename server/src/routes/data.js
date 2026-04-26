import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { hasPermission } from '../config/rolePermissions.js';
import {
  dataQuerySchema,
  exportQuerySchema,
  dashboardQuerySchema,
  saveEntryQuerySchema,
  saveEntryBodySchema,
} from './schemas.js';
import {
  fetchDataFromGas,
  fetchDashboardFromGas,
  fetchFiltersFromGas,
  fetchExportFromGas,
  fetchViewOutputFromGas,
  fetchViewConfigFromGas,
  saveEntryToGas,
} from '../services/gasClient.js';
import { mapSaveEntryPayload } from '../services/saveEntryMapping.js';
import { resolveViewAlignment } from '../services/viewAlignmentResolver.js';
import { writeAuditEvent } from '../data/auditLog.js';
import { consumeUserWriteQuota, getUserQuotaUsage } from '../data/quotaStore.js';
import { getQualifiedViewName, getViewConfigFromSource, isViewNameMatch } from '../services/viewConfigService.js';
import { alignRecordsToView } from '../services/viewProjectionService.js';
import { getDatabaseByName, listDatabases, listViews, getViewByName } from '../data/databaseRegistry.js';
import { applyFilterRules, applySearch, applySort, paginateRows, projectColumns } from '../services/dynamicViewEngine.js';

const router = Router();

function getControlledWriteAccess(user, database) {
  const quota = getUserQuotaUsage({ email: user.email });

  if (!hasPermission(user, 'data:write')) {
    return {
      allowed: false,
      reason: 'write_permission_denied',
      usage: quota,
    };
  }

  if (user.permissions?.viewOnly === true) {
    return {
      allowed: false,
      reason: 'view_only_mode',
      usage: quota,
    };
  }

  const hasDb = user.databases?.includes('*') || user.databases?.includes(database);
  if (!hasDb) {
    return {
      allowed: false,
      reason: 'database_not_assigned',
      usage: quota,
    };
  }

  return {
    allowed: true,
    reason: null,
    usage: quota,
  };
}

function parseScopedViewToken(value) {
  const raw = String(value || '').trim();
  const sep = raw.indexOf('::');
  if (sep === -1) return null;

  const database = raw.slice(0, sep).trim().toUpperCase();
  const view = raw.slice(sep + 2).trim();
  if (!database || !view) return null;

  return { database, view };
}

function hasAssignedViewForScope(assignedValues, database, view) {
  const values = Array.isArray(assignedValues) ? assignedValues : [];
  const db = String(database || '').trim().toUpperCase();
  const targetView = String(view || '').trim();
  if (!targetView) return false;

  return values.some((value) => {
    const scoped = parseScopedViewToken(value);
    if (scoped) {
      if (scoped.database !== db) return false;
      return scoped.view === targetView || isViewNameMatch(scoped.view, targetView);
    }

    const raw = String(value || '').trim();
    return raw === targetView || isViewNameMatch(raw, targetView);
  });
}

function ensureUserScope(user, database, view) {
  const hasDb = user.databases?.includes('*') || user.databases?.includes(database);
  const hasView = user.views?.includes('*') || hasAssignedViewForScope(user.views, database, view);
  return Boolean(hasDb && hasView);
}

function extractRecordsEnvelope(payload) {
  if (Array.isArray(payload?.data?.records)) {
    return { records: payload.data.records, set: (rows) => { payload.data.records = rows; payload.data.items = rows; payload.data.count = rows.length; } };
  }

  if (Array.isArray(payload?.records)) {
    return { records: payload.records, set: (rows) => { payload.records = rows; payload.items = rows; payload.count = rows.length; } };
  }

  if (Array.isArray(payload?.data?.items)) {
    return { records: payload.data.items, set: (rows) => { payload.data.items = rows; payload.data.records = rows; payload.data.total = rows.length; } };
  }

  if (Array.isArray(payload?.items)) {
    return { records: payload.items, set: (rows) => { payload.items = rows; payload.total = rows.length; } };
  }

  return { records: [], set: (_rows) => {} };
}

function normalizeColumnName(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveColumnAccess(user, database, view) {
  const normalizedView = String(view || '').trim();
  const normalizedDatabase = String(database || '').trim().toUpperCase();
  const scopedViewKey = normalizedView ? `${normalizedDatabase}::${normalizedView}` : '';
  const allowedByViewMap = user?.allowedColumnsByView && typeof user.allowedColumnsByView === 'object'
    ? user.allowedColumnsByView
    : {};

  const allowedByDatabase = user?.allowedColumns && typeof user.allowedColumns === 'object'
    ? user.allowedColumns[database]
    : undefined;

  let allowedByView = allowedByViewMap[scopedViewKey] || allowedByViewMap[normalizedView];
  if (!Array.isArray(allowedByView) && normalizedView) {
    const matched = Object.entries(allowedByViewMap).find(([key]) => {
      const scoped = parseScopedViewToken(key);
      if (scoped) {
        if (scoped.database !== normalizedDatabase) return false;
        return scoped.view === normalizedView || isViewNameMatch(scoped.view, normalizedView);
      }

      return isViewNameMatch(key, normalizedView);
    });
    if (matched) {
      allowedByView = matched[1];
    }
  }

  if (Array.isArray(allowedByView)) {
    return { configured: true, columns: allowedByView };
  }

  if (Array.isArray(allowedByDatabase)) {
    return { configured: true, columns: allowedByDatabase };
  }

  return { configured: false, columns: [] };
}

function applyColumnAccess(records, selectedHeaders, access) {
  if (!access.configured) {
    return {
      selectedHeaders,
      records,
    };
  }

  const allowed = new Set((access.columns || []).map((col) => normalizeColumnName(col)).filter(Boolean));
  const filteredHeaders = (selectedHeaders || []).filter((header) => allowed.has(normalizeColumnName(header)));

  const projected = (records || []).map((row) => {
    const out = {};
    for (const header of filteredHeaders) {
      out[header] = row[header];
    }
    return out;
  });

  return {
    selectedHeaders: filteredHeaders,
    records: projected,
  };
}

function extractTotal(payload, fallbackCount) {
  if (typeof payload?.data?.total === 'number') return payload.data.total;
  if (typeof payload?.total === 'number') return payload.total;
  if (typeof payload?.data?.count === 'number') return payload.data.count;
  if (typeof payload?.count === 'number') return payload.count;
  return fallbackCount;
}

function isLegacyDatabase(database) {
  const db = String(database || '').toUpperCase();
  return db === 'MEN_MATERIAL' || db === 'LACE_GAYLE';
}

async function fetchAllRowsForCustomDatabase(databaseConfig, requester) {
  const pageSize = 1000;
  const maxPages = 50;
  let page = 1;
  let total = null;
  let sourcePayload = null;
  const rows = [];

  while (page <= maxPages) {
    const payload = await fetchDataFromGas({
      database: databaseConfig.name,
      sheetIdOrUrl: databaseConfig.sheetIdOrUrl,
      sheetName: databaseConfig.sheetName,
      dataRange: databaseConfig.dataRange,
      page,
      pageSize,
      requester,
    });

    if (!sourcePayload) {
      sourcePayload = payload;
    }

    const envelope = extractRecordsEnvelope(payload);
    const batch = Array.isArray(envelope.records) ? envelope.records : [];
    rows.push(...batch);

    const reportedTotal = extractTotal(payload, batch.length);
    if (typeof reportedTotal === 'number' && Number.isFinite(reportedTotal)) {
      total = reportedTotal;
    }

    const reachedTotal = typeof total === 'number' ? rows.length >= total : false;
    const reachedLastPage = batch.length < pageSize;
    if (reachedTotal || reachedLastPage) {
      break;
    }

    page += 1;
  }

  return {
    rows,
    total: typeof total === 'number' ? total : rows.length,
    sourcePayload,
  };
}

function getDynamicViewDefinition(database, view) {
  return getViewByName(database, view);
}

router.get('/data', requireAuth, validate(dataQuerySchema, 'query'), async (req, res, next) => {
  try {
    if (!hasPermission(req.user, 'data:read')) {
      return next({ status: 403, message: 'No read permission' });
    }

    const query = req.validatedQuery;
    if (!ensureUserScope(req.user, query.database, query.view)) {
      return next({ status: 403, message: 'No access to requested view' });
    }

    const dbConfig = getDatabaseByName(query.database);
    if (!dbConfig?.active) {
      return next({ status: 404, message: 'Database not found or inactive' });
    }

    const isLegacy = isLegacyDatabase(query.database);

    if (!isLegacy) {
      const dynamicView = getDynamicViewDefinition(query.database, query.view);
      if (!dynamicView?.active) {
        return next({ status: 404, message: 'View not found for selected database' });
      }

      const columnAccess = resolveColumnAccess(req.user, query.database, query.view);
      const fetched = await fetchAllRowsForCustomDatabase(dbConfig, req.user.email);

      let rows = fetched.rows;
      rows = applyFilterRules(rows, dynamicView.filterRules || []);
      rows = applySearch(rows, query.search, dynamicView.selectedColumns);

      const sortColumn = query.sortBy || dynamicView.sort?.column;
      const sortDirection = query.sortOrder || dynamicView.sort?.direction || 'asc';
      rows = applySort(rows, sortColumn, sortDirection);

      const projected = projectColumns(rows, dynamicView.selectedColumns);
      const restricted = applyColumnAccess(projected.rows, projected.headers, columnAccess);
      const paged = paginateRows(restricted.records, query.page, query.pageSize);

      return res.json({
        data: {
          records: paged.records,
          total: paged.total,
          page: paged.page,
          pageSize: paged.pageSize,
        },
        viewAlignment: {
          source: 'dynamic-builder',
          view: dynamicView.viewName,
          selectedHeaders: restricted.selectedHeaders,
          filterRules: dynamicView.filterRules || [],
          rowCount: paged.records.length,
        },
        columnAccess: {
          configured: columnAccess.configured,
          allowedColumns: columnAccess.columns,
          visibleColumns: restricted.selectedHeaders,
        },
        source: {
          fetchedRows: fetched.rows.length,
          fetchedTotal: fetched.total,
        },
      });
    }

    // Resolve view config FIRST so we can pass server-side filter params to GAS.
    // This ensures GAS filters by MARKA_CODE / PRODUCT_CATEGORY before pagination,
    // giving correct totals and page counts instead of client-side over-filtering.
    const viewConfig = await getViewConfigFromSource({
      database: query.database,
      view: query.view,
    });

    let data;

    if (query.database === 'LACE_GAYLE') {
      // LACE_GAYLE data lives in per-view external spreadsheets (not the main DATABASE sheet).
      // view-output fetches directly from the spreadsheet URL configured in Settings.
      data = await fetchViewOutputFromGas({
        database: query.database,
        view: query.view,
        page: query.page,
        pageSize: query.pageSize,
        requester: req.user.email,
      });
    } else {
      // Build GAS-compatible filter params from view config (e.g. MARKA_CODE=BBB, PRODUCT_CATEGORY=Lace)
      const gasFilterParams = {};
      const cols = viewConfig.filterColumns || [];
      const vals = viewConfig.filterValues || [];
      cols.forEach((col, i) => {
        if (col && vals[i] !== undefined && vals[i] !== '') {
          gasFilterParams[col] = vals[i];
        }
      });

      data = await fetchDataFromGas({
        ...query,
        ...gasFilterParams,
        requester: req.user.email,
      });
    }

    const envelope = extractRecordsEnvelope(data);
    // For LACE_GAYLE the data comes from per-outlet external spreadsheets (view-output).
    // Those sheets have no MARKA_CODE/PRODUCT_CATEGORY columns — data is already source-filtered.
    // Only apply column projection, not field-value filtering.
    const alignConfig = query.database === 'LACE_GAYLE'
      ? { ...viewConfig, filterColumns: [], filterValues: [] }
      : viewConfig;
    const aligned = alignRecordsToView(envelope.records, alignConfig);
    const columnAccess = resolveColumnAccess(req.user, query.database, query.view);
    const restricted = applyColumnAccess(aligned.records, aligned.selectedHeaders, columnAccess);
    envelope.set(restricted.records);

    data.viewAlignment = {
      source: 'gas-settings',
      view: viewConfig.view,
      selectedHeaders: restricted.selectedHeaders,
      filterColumns: viewConfig.filterColumns,
      filterValues: viewConfig.filterValues,
      rowCount: restricted.records.length,
    };

    data.columnAccess = {
      configured: columnAccess.configured,
      allowedColumns: columnAccess.columns,
      visibleColumns: restricted.selectedHeaders,
    };

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/filters', requireAuth, async (req, res, next) => {
  try {
    if (!hasPermission(req.user, 'data:read')) {
      return next({ status: 403, message: 'No read permission' });
    }

    const response = await fetchFiltersFromGas({
      requester: req.user.email,
      databases: req.user.databases,
      views: req.user.views,
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard', requireAuth, validate(dashboardQuerySchema, 'query'), async (req, res, next) => {
  try {
    if (!hasPermission(req.user, 'dashboard:read')) {
      return next({ status: 403, message: 'No dashboard permission' });
    }

    const query = req.validatedQuery;
    if (!ensureUserScope(req.user, query.database, query.view)) {
      return next({ status: 403, message: 'No access to requested dashboard view' });
    }

    const response = await fetchDashboardFromGas({
      ...query,
      requester: req.user.email,
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/save-entry', requireAuth, validate(saveEntryQuerySchema, 'query'), validate(saveEntryBodySchema), async (req, res, next) => {
  try {
    if (!hasPermission(req.user, 'data:write')) {
      return next({ status: 403, message: 'No write permission' });
    }

    const query = req.validatedQuery || {};
    const payload = { ...req.body, dryRun: query.dryRun === true };
    const database = query.database;
    const view = query.view;

    if (database && !isLegacyDatabase(database)) {
      return next({ status: 400, message: 'save-entry currently supports legacy mapped databases only' });
    }

    if (query.database && query.view && !ensureUserScope(req.user, query.database, query.view)) {
      return next({ status: 403, message: 'No access to requested write scope' });
    }

    if (!database || !view) {
      return next({ status: 400, message: 'database and view are required for save-entry mapping' });
    }

    let templateRecord = null;
    try {
      const sample = await fetchDataFromGas({
        database,
        view,
        page: 1,
        pageSize: 10,
        requester: req.user.email,
      });

      templateRecord = sample?.data?.records?.[0] || sample?.records?.[0] || null;
    } catch {
      templateRecord = null;
    }

    const mappedResult = mapSaveEntryPayload({
      database,
      payload: req.body || {},
      context: {
        view,
        requester: req.user.email,
        templateRecord,
      },
    });

    const viewConfig = await getViewConfigFromSource({ database, view });

    const templateHeaders = templateRecord ? Object.keys(templateRecord) : [];
    const alignedResult = resolveViewAlignment({
      database,
      view,
      mappedPayload: mappedResult.mapped,
      templateHeaders,
      viewAlignment: {
        columnsList: viewConfig.columnsList,
        filterColumn: viewConfig.filterColumns,
        filterValue: viewConfig.filterValues,
      },
    });

    writeAuditEvent({
      actor: req.user.email,
      action: 'data.save_entry.mapping.validated',
      target: `${database}:${view}`,
      details: {
        dryRun: payload.dryRun === true,
        strategy: mappedResult.metadata?.strategy,
        entryId: mappedResult.metadata?.entryId,
        mappedKeys: Object.keys(alignedResult.alignedPayload || {}),
        alignment: alignedResult.alignment,
      },
    });

    if (!payload) {
      throw new Error('Invalid payload');
    }

    if (payload.dryRun) {
      return res.json({
        dryRun: true,
        validated: true,
        database: database || null,
        view: view || null,
        requester: req.user.email,
        bodyKeys: Object.keys(req.body || {}),
        mappedPayload: alignedResult.alignedPayload,
        mapping: mappedResult.metadata,
        alignment: alignedResult.alignment,
      });
    }

    const access = getControlledWriteAccess(req.user, database);

    if (!access.allowed) {
      writeAuditEvent({
        actor: req.user.email,
        action: 'data.save_entry.write.blocked',
        target: `${database}:${view}`,
        details: {
          reason: access.reason,
          usage: access.usage,
          strategy: mappedResult.metadata?.strategy,
          entryId: mappedResult.metadata?.entryId,
          alignment: alignedResult.alignment,
        },
      });
      return next({ status: 403, message: 'Write not allowed' });
    }

    const writeType = query.writeType === 'test' ? 'test' : 'live';
    const quotaResult = consumeUserWriteQuota({
      email: req.user.email,
      writeType,
      limits: req.user.quota || {},
    });

    if (!quotaResult.allowed) {
      writeAuditEvent({
        actor: req.user.email,
        action: 'data.save_entry.write.blocked',
        target: `${database}:${view}`,
        details: {
          reason: quotaResult.reason || 'quota_limit_reached',
          quota: quotaResult,
          strategy: mappedResult.metadata?.strategy,
          entryId: mappedResult.metadata?.entryId,
          alignment: alignedResult.alignment,
        },
      });
      return next({ status: 403, message: 'Write not allowed' });
    }

    const gasResult = await saveEntryToGas(alignedResult.alignedPayload, {
      database,
      view,
      requester: req.user.email,
    });

    writeAuditEvent({
      actor: req.user.email,
      action: 'data.save_entry.write.success',
      target: `${database}:${view}`,
      details: {
        quota: quotaResult,
        strategy: mappedResult.metadata?.strategy,
        entryId: mappedResult.metadata?.entryId,
        alignment: alignedResult.alignment,
      },
    });

    return res.json({
      dryRun: false,
      written: true,
      database,
      view,
      requester: req.user.email,
      mappedPayload: alignedResult.alignedPayload,
      mapping: mappedResult.metadata,
      alignment: alignedResult.alignment,
      writeControl: {
        mode: 'controlled',
        allowWrite: true,
        writeType,
        dailyWrites: quotaResult.dailyWrites,
        monthlyWrites: quotaResult.monthlyWrites,
        totalWrites: quotaResult.totalWrites,
        remainingDaily: quotaResult.remainingDaily,
        remainingMonthly: quotaResult.remainingMonthly,
        remainingTotal: quotaResult.remainingTotal,
        remainingType: quotaResult.remainingType,
        quotaDay: quotaResult.day,
        quotaMonth: quotaResult.month,
        rollbackReady: true,
      },
      result: gasResult,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export', requireAuth, validate(exportQuerySchema, 'query'), async (req, res, next) => {
  try {
    if (!hasPermission(req.user, 'data:export')) {
      return next({ status: 403, message: 'No export permission' });
    }

    const query = req.validatedQuery;
    if (!ensureUserScope(req.user, query.database, query.view)) {
      return next({ status: 403, message: 'No access to requested export' });
    }

    const dbConfig = getDatabaseByName(query.database);
    if (!dbConfig?.active) {
      return next({ status: 404, message: 'Database not found or inactive' });
    }

    const isLegacy = isLegacyDatabase(query.database);
    const columnAccess = resolveColumnAccess(req.user, query.database, query.view);

    if (!isLegacy) {
      const dynamicView = getDynamicViewDefinition(query.database, query.view);
      if (!dynamicView?.active) {
        return next({ status: 404, message: 'View not found for selected database' });
      }

      const fetched = await fetchAllRowsForCustomDatabase(dbConfig, req.user.email);
      let rows = applyFilterRules(fetched.rows, dynamicView.filterRules || []);
      rows = applySort(rows, dynamicView.sort?.column, dynamicView.sort?.direction || 'asc');
      const projected = projectColumns(rows, dynamicView.selectedColumns);
      const restricted = applyColumnAccess(projected.rows, projected.headers, columnAccess);

      return res.json({
        format: query.format,
        database: query.database,
        view: query.view,
        data: {
          records: restricted.records,
          total: restricted.records.length,
          page: 1,
          pageSize: restricted.records.length,
        },
        columnAccess: {
          configured: columnAccess.configured,
          allowedColumns: columnAccess.columns,
          visibleColumns: restricted.selectedHeaders,
        },
      });
    }

    const exported = await fetchExportFromGas({
      ...query,
      requester: req.user.email,
    });

    if (columnAccess.configured && exported?.downloadUrl) {
      return next({ status: 403, message: 'Restricted export download is not allowed for current column access policy' });
    }

    const envelope = extractRecordsEnvelope(exported);
    if (envelope.records.length > 0) {
      const viewConfig = await getViewConfigFromSource({ database: query.database, view: query.view });
      const alignConfig = query.database === 'LACE_GAYLE'
        ? { ...viewConfig, filterColumns: [], filterValues: [] }
        : viewConfig;

      const aligned = alignRecordsToView(envelope.records, alignConfig);
      const restricted = applyColumnAccess(aligned.records, aligned.selectedHeaders, columnAccess);
      envelope.set(restricted.records);

      exported.columnAccess = {
        configured: columnAccess.configured,
        allowedColumns: columnAccess.columns,
        visibleColumns: restricted.selectedHeaders,
      };
    }

    res.json(exported);
  } catch (error) {
    next(error);
  }
});

router.get('/my-views', requireAuth, async (req, res, next) => {
  try {
    if (!hasPermission(req.user, 'data:read')) {
      return next({ status: 403, message: 'No read permission' });
    }

    let allowedDatabases = [];
    if (req.user.databases?.includes('*')) {
      allowedDatabases = listDatabases({ includeInactive: false }).map((db) => db.name);
    } else if (Array.isArray(req.user.databases)) {
      allowedDatabases = req.user.databases;
    }

    if (allowedDatabases.length === 0) {
      return res.json({ views: [] });
    }

    const legacyDatabases = allowedDatabases.filter((database) => isLegacyDatabase(database));
    const customDatabases = new Set(allowedDatabases.filter((database) => !isLegacyDatabase(database)));

    const responses = await Promise.all(
      legacyDatabases.map((database) => fetchViewConfigFromGas({ database })),
    );

    const assignedAllViews = req.user.views?.includes('*');
    const legacyViews = responses.flatMap((response, index) => {
      const database = legacyDatabases[index];
      const data = response?.data || response || {};
      const configs = Array.isArray(data?.configs) ? data.configs : [];

      return configs
        .filter((config) => {
          const rawViewName = String(config?.view || '').trim();
          const qualifiedViewName = getQualifiedViewName({
            database,
            viewName: rawViewName,
            sheetName: String(config?.sheetName || ''),
          });

          if (!rawViewName) {
            return false;
          }

          if (assignedAllViews) {
            return true;
          }

          return hasAssignedViewForScope(req.user.views, database, rawViewName)
            || hasAssignedViewForScope(req.user.views, database, qualifiedViewName);
        })
        .map((config) => {
          const qualifiedViewName = getQualifiedViewName({
            database,
            viewName: String(config.view).trim(),
            sheetName: String(config.sheetName || ''),
          });

          return {
            database,
            viewName: qualifiedViewName,
            sheetName: String(config.sheetName || ''),
            columnsList: Array.isArray(config.columnsList) ? config.columnsList : [],
            columnAccess: resolveColumnAccess(req.user, database, qualifiedViewName),
          };
        });
    });

    const customViewDefs = listViews({ includeInactive: false })
      .filter((view) => customDatabases.has(view.database));

    const customViews = customViewDefs
      .filter((view) => {
        if (assignedAllViews) return true;
        return hasAssignedViewForScope(req.user.views, view.database, view.viewName);
      })
      .map((view) => ({
        database: view.database,
        viewName: view.viewName,
        sheetName: '',
        columnsList: view.selectedColumns || [],
        columnAccess: resolveColumnAccess(req.user, view.database, view.viewName),
      }));

    const views = [...legacyViews, ...customViews];

    return res.json({ views });
  } catch (error) {
    return next(error);
  }
});

export default router;
