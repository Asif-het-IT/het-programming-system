import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  acknowledgeMonitoringAlert,
  bulkUpdateMonitoringAlertStatus,
  createMonitoringAlert,
  getMonitoringAlertById,
  getMonitoringAlerts,
  getMonitoringAlertSettings,
  resolveMonitoringAlert,
  updateMonitoringAlertStatus,
  updateMonitoringAlertSettings,
} from '../services/alertService.js';
import { fetchDataFromGas } from '../services/gasClient.js';

const router = Router();

router.use(requireAuth);
router.use(requirePermission('admin:manage'));

router.get('/alerts', (req, res) => {
  const {
    status,
    severity,
    type,
    q,
    search,
    database,
    timeRange,
    from,
    to,
    startTime,
    endTime,
    customFrom,
    customTo,
    sourceModule,
  } = req.query || {};
  const limit = Number(req.query?.limit || 200);
  const result = getMonitoringAlerts({
    status,
    severity,
    type,
    q,
    search,
    database,
    timeRange,
    from,
    to,
    startTime,
    endTime,
    customFrom,
    customTo,
    sourceModule,
    limit,
  });
  res.json(result);
});

router.post('/alerts/bulk', (req, res, next) => {
  const body = req.body || {};
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const status = String(body.status || '').trim().toLowerCase();

  if (ids.length === 0) {
    return next({ status: 400, message: 'ids must be a non-empty array' });
  }

  if (!['open', 'acknowledged', 'resolved'].includes(status)) {
    return next({ status: 400, message: 'status must be open, acknowledged, or resolved' });
  }

  const result = bulkUpdateMonitoringAlertStatus(ids, status, req.user?.email || 'admin');
  return res.json(result);
});

router.patch('/alerts/:id', (req, res, next) => {
  const status = String(req.body?.status || '').trim().toLowerCase();
  if (!['open', 'acknowledged', 'resolved'].includes(status)) {
    return next({ status: 400, message: 'status must be open, acknowledged, or resolved' });
  }

  const alert = updateMonitoringAlertStatus(req.params.id, status, req.user?.email || 'admin');
  if (!alert) {
    return next({ status: 404, message: 'Alert not found' });
  }
  return res.json({ alert });
});

router.post('/alerts/:id/acknowledge', (req, res, next) => {
  const alert = acknowledgeMonitoringAlert(req.params.id, req.user?.email || 'admin');
  if (!alert) {
    return next({ status: 404, message: 'Alert not found' });
  }
  return res.json({ alert });
});

router.post('/alerts/:id/resolve', (req, res, next) => {
  const alert = resolveMonitoringAlert(req.params.id, req.user?.email || 'admin');
  if (!alert) {
    return next({ status: 404, message: 'Alert not found' });
  }
  return res.json({ alert });
});

router.post('/alerts/:id/retry-sync', async (req, res, next) => {
  try {
    const alert = getMonitoringAlertById(req.params.id);
    if (!alert) {
      return next({ status: 404, message: 'Alert not found' });
    }

    if (!alert.database) {
      return next({ status: 400, message: 'This alert is not linked to a database sync operation' });
    }

    const result = await fetchDataFromGas({
      database: alert.database,
      view: alert.view || undefined,
      page: 1,
      pageSize: 1,
      requester: req.user?.email,
    }, { suppressAlerts: true });

    const resolved = resolveMonitoringAlert(req.params.id, req.user?.email || 'admin');
    return res.json({
      retried: true,
      alert: resolved,
      result: {
        success: true,
        sampleCount: result?.data?.count ?? result?.count ?? null,
      },
    });
  } catch (error) {
    return next({ status: 500, message: error?.message || 'Retry sync failed' });
  }
});

router.get('/alert-settings', (_req, res) => {
  res.json({ settings: getMonitoringAlertSettings() });
});

router.put('/alert-settings', (req, res) => {
  const settings = updateMonitoringAlertSettings(req.body || {});
  res.json({ settings });
});

router.post('/alerts/test', async (req, res, next) => {
  try {
    const body = req.body || {};
    const response = await createMonitoringAlert({
      type: body.type || 'sync_failure',
      severity: body.severity || 'critical',
      message: body.message || 'Manual test alert from admin panel',
      database: body.database || 'MEN_MATERIAL',
      view: body.view || 'Test View',
      user: body.user || req.user?.email,
      sourceModule: 'admin-alert-test',
      details: body.details
        ? { note: 'manual test', ...body.details }
        : { note: 'manual test' },
      channels: body.channels,
      signature: body.signature || `manual-test::${Date.now()}`,
    });

    if (!response.created) {
      return res.status(202).json(response);
    }

    return res.status(201).json(response);
  } catch (error) {
    return next(error);
  }
});

export default router;
