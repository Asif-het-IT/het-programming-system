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
  saveEntryToGas,
} from '../services/gasClient.js';
import { mapSaveEntryPayload } from '../services/saveEntryMapping.js';
import { resolveViewAlignment } from '../services/viewAlignmentResolver.js';
import { writeAuditEvent } from '../data/auditLog.js';
import { consumeUserWriteQuota, getUserQuotaUsage } from '../data/quotaStore.js';
import { getViewConfigFromSource } from '../services/viewConfigService.js';
import { alignRecordsToView } from '../services/viewProjectionService.js';

const router = Router();

const CONTROLLED_WRITE = {
  ALLOW_WRITE: true,
  ALLOWED_USERS: ['admin@het.local'],
  ALLOWED_DATABASES: ['MEN_MATERIAL'],
  MAX_TEST_WRITES: 5,
};

function getControlledWriteAccess(email, role, database) {
  const quota = getUserQuotaUsage({ email });
  const isWriteEnabled = CONTROLLED_WRITE.ALLOW_WRITE === true;
  const canWriteByRole = hasPermission({ role }, 'data:write');
  const isUserAllowed = CONTROLLED_WRITE.ALLOWED_USERS.includes(email);
  const isDatabaseAllowed = CONTROLLED_WRITE.ALLOWED_DATABASES.includes(database);
  const hasWriteQuota = quota.writes < CONTROLLED_WRITE.MAX_TEST_WRITES;

  let reason = null;
  if (!isWriteEnabled) {
    reason = 'write_switch_disabled';
  } else if (!canWriteByRole) {
    reason = 'role_write_not_allowed';
  } else if (!isUserAllowed) {
    reason = 'user_not_allowed';
  } else if (!isDatabaseAllowed) {
    reason = 'database_not_allowed';
  } else if (!hasWriteQuota) {
    reason = 'max_test_writes_reached';
  }

  return {
    allowed: reason === null,
    reason,
    controlledWriteCount: quota.writes,
    maxTestWrites: CONTROLLED_WRITE.MAX_TEST_WRITES,
  };
}

function ensureUserScope(user, database, view) {
  const hasDb = user.databases?.includes('*') || user.databases?.includes(database);
  const hasView = user.views?.includes('*') || user.views?.includes(view);
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

router.get('/data', requireAuth, validate(dataQuerySchema, 'query'), async (req, res, next) => {
  try {
    if (!hasPermission(req.user, 'data:read')) {
      return next({ status: 403, message: 'No read permission' });
    }

    const query = req.validatedQuery;
    if (!ensureUserScope(req.user, query.database, query.view)) {
      return next({ status: 403, message: 'No access to requested view' });
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
    envelope.set(aligned.records);

    data.viewAlignment = {
      source: 'gas-settings',
      view: viewConfig.view,
      selectedHeaders: aligned.selectedHeaders,
      filterColumns: viewConfig.filterColumns,
      filterValues: viewConfig.filterValues,
      rowCount: aligned.count,
    };

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/filters', requireAuth, async (req, res, next) => {
  try {
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
    if (!hasPermission(req.user, 'data:read')) {
      return next({ status: 403, message: 'No read permission' });
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

    const access = getControlledWriteAccess(req.user.email, req.user.role, database);

    if (!access.allowed) {
      writeAuditEvent({
        actor: req.user.email,
        action: 'data.save_entry.write.blocked',
        target: `${database}:${view}`,
        details: {
          reason: access.reason,
          controlledWriteCount: access.controlledWriteCount,
          maxTestWrites: access.maxTestWrites,
          strategy: mappedResult.metadata?.strategy,
          entryId: mappedResult.metadata?.entryId,
          alignment: alignedResult.alignment,
        },
      });
      return next({ status: 403, message: 'Write not allowed' });
    }

    const quotaResult = consumeUserWriteQuota({
      email: req.user.email,
      limit: CONTROLLED_WRITE.MAX_TEST_WRITES,
    });

    if (!quotaResult.allowed) {
      writeAuditEvent({
        actor: req.user.email,
        action: 'data.save_entry.write.blocked',
        target: `${database}:${view}`,
        details: {
          reason: 'max_test_writes_reached',
          controlledWriteCount: quotaResult.used,
          maxTestWrites: quotaResult.limit,
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
        controlledWriteCount: quotaResult.used,
        maxTestWrites: CONTROLLED_WRITE.MAX_TEST_WRITES,
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
        allowWrite: CONTROLLED_WRITE.ALLOW_WRITE,
        controlledWriteCount: quotaResult.used,
        maxTestWrites: CONTROLLED_WRITE.MAX_TEST_WRITES,
        remainingWrites: quotaResult.remaining,
        quotaDay: quotaResult.day,
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
    if (!hasPermission(req.user, 'data:read')) {
      return next({ status: 403, message: 'No read permission' });
    }

    const query = req.validatedQuery;
    if (!ensureUserScope(req.user, query.database, query.view)) {
      return next({ status: 403, message: 'No access to requested export' });
    }

    const exported = await fetchExportFromGas({
      ...query,
      requester: req.user.email,
    });

    res.json(exported);
  } catch (error) {
    next(error);
  }
});

export default router;
