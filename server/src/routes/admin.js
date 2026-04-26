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

const router = Router();

function extractRows(payload) {
  if (Array.isArray(payload?.data?.records)) return payload.data.records;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

router.use(requireAuth, requirePermission('admin:manage'));

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
    const databases = ['MEN_MATERIAL', 'LACE_GAYLE'];
    const results = await Promise.all(databases.map(async (database) => {
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

    const views = results.flat();
    return res.json({ count: views.length, views });
  } catch (error) {
    return next(error);
  }
});

router.get('/columns', validate(adminColumnsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { database, view } = req.validatedQuery;
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

export default router;
