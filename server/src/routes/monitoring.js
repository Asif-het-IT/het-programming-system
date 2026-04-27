/**
 * monitoring.js – Admin-only data source & sync monitoring endpoints.
 *
 * Routes (all prefixed /api/admin/monitoring via app.js):
 *   GET  /status        – data source overview + per-DB runtime state
 *   GET  /logs          – paginated sync event log
 *   GET  /performance   – per-DB performance metrics
 *   POST /refresh       – manual sync: clear cache + warm fetch
 *   POST /force-reload  – full cache wipe + warm all databases
 *   DELETE /logs        – wipe sync log
 */

import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { clearCache, clearCacheByScope, getCacheTtlBounds } from '../services/cache.js';
import { getMonitorState } from '../data/monitorState.js';
import { getSyncLogs, clearSyncLogs } from '../data/syncLog.js';
import { fetchDataFromGas, fetchDashboardFromGas, fetchViewConfigFromGas } from '../services/gasClient.js';
import { writeAuditEvent } from '../data/auditLog.js';
import { getQualifiedViewName, getViewConfigFromSource } from '../services/viewConfigService.js';
import { listDatabases } from '../data/databaseRegistry.js';
import {
  getAlertStats,
  getDeliveryMetrics,
  getAlertFrequency,
  getFailureTracking,
  listAlerts,
} from '../data/alertsStore.js';
import { getRetryStatus } from '../services/channelRetryService.js';
import { getRoutingConfiguration } from '../services/alertPriorityRouter.js';
import { getSloRuntimeStatus, runIncidentEscalationSweep } from '../services/alertService.js';

const router = Router();

// All monitoring routes require an authenticated admin
router.use(requireAuth);
router.use(requirePermission('admin:manage'));

function maskUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(String(url));
    const parts = u.pathname.split('/');
    const masked = parts
      .map((p, i) => (i > 3 && p.length > 8 ? `${p.slice(0, 4)}…${p.slice(-4)}` : p))
      .join('/');
    return `${u.origin}${masked}`;
  } catch {
    return '(configured)';
  }
}

function getLegacyBridgeUrl(databaseName) {
  if (databaseName === 'MEN_MATERIAL') {
    return env.gasBridgeUrlMenMaterial || env.gasBridgeUrl;
  }
  return env.gasBridgeUrlLaceGayle || env.gasBridgeUrl;
}

function getLayerDescription(databaseType, proxyEnabled) {
  if (databaseType !== 'legacy') {
    return 'Browser -> Express API -> Google Apps Script (custom bridge) -> Google Sheets';
  }

  if (proxyEnabled) {
    return 'Browser -> Express API -> Cloudflare Worker -> Google Apps Script -> Google Sheets';
  }

  return 'Browser -> Express API -> Google Apps Script -> Google Sheets';
}

function buildDataSourceConfig() {
  const proxyEnabled = Boolean(env.gasProxyUrl);
  const dbConfigs = listDatabases({ includeInactive: false });

  const databases = Object.fromEntries(dbConfigs.map((db) => ([
    db.name,
    {
      label: db.name,
      description: db.displayName || db.name,
      sourceType: db.type === 'legacy' ? 'Google Sheet' : 'Dynamic Google Sheet',
      sourceSpreadsheetId: db.sheetIdOrUrl || null,
      sourceSheetName: db.sheetName || null,
      gasUrl: db.type === 'legacy' ? maskUrl(getLegacyBridgeUrl(db.name)) : maskUrl(db.bridgeUrl),
      proxyEnabled: db.type === 'legacy' ? proxyEnabled : false,
      cacheTtlMs: env.cacheTtlMs,
      layerDescription: getLayerDescription(db.type, proxyEnabled),
    },
  ])));

  return {
    proxyEnabled,
    proxyUrl: maskUrl(env.gasProxyUrl),
    cacheTtlMs: env.cacheTtlMs,
    cacheTtlBounds: getCacheTtlBounds(),
    databases,
  };
}

function normalizeSheetType(value) {
  const lower = String(value || '').toLowerCase();
  if (lower.includes('lace')) return 'Lace';
  if (lower.includes('gayle')) return 'Gayle';
  return null;
}

function extractFilterValue(config, headerName) {
  const columns = Array.isArray(config?.filterColumns) ? config.filterColumns : [];
  const values = Array.isArray(config?.filterValues) ? config.filterValues : [];
  const index = columns.findIndex((column) => String(column).toUpperCase() === headerName);
  return index >= 0 ? values[index] ?? null : null;
}

// ─── GET /api/admin/monitoring/status ────────────────────────────────────────
router.get('/status', (_req, res) => {
  const config = buildDataSourceConfig();
  const runtimeState = getMonitorState();

  const databases = Object.fromEntries(
    Object.entries(config.databases).map(([db, cfg]) => {
      const rt = runtimeState[db] || {};
      return [db, { ...cfg, ...rt, status: rt.status || 'pending' }];
    }),
  );

  res.json({
    proxyEnabled: config.proxyEnabled,
    proxyUrl: config.proxyUrl,
    cacheTtlMs: env.cacheTtlMs,
    cacheTtlBounds: config.cacheTtlBounds,
    databases,
    architecture: [
      { layer: 'Browser / PWA', icon: 'monitor', enabled: true },
      { layer: 'React Frontend (Vite)', icon: 'layers', enabled: true },
      { layer: 'Express API (Node.js :3001)', icon: 'server', enabled: true },
      { layer: 'Cloudflare Worker (proxy)', icon: 'cloud', enabled: config.proxyEnabled, optional: true },
      { layer: 'Google Apps Script (GAS)', icon: 'code', enabled: true },
      { layer: 'Google Sheets', icon: 'table', enabled: true },
    ],
  });
});

// ─── GET /api/admin/monitoring/logs ──────────────────────────────────────────
router.get('/logs', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  const database = req.query.database || null;
  const status = req.query.status || null;

  let logs = getSyncLogs(1000);
  if (database) logs = logs.filter((l) => l.database === String(database).toUpperCase());
  if (status) logs = logs.filter((l) => l.status === status);

  res.json({ logs: logs.slice(0, limit), total: logs.length });
});

// ─── GET /api/admin/monitoring/performance ────────────────────────────────────
router.get('/performance', (_req, res) => {
  const state = getMonitorState();
  const logs = getSyncLogs(1000);

  const metrics = Object.fromEntries(
    Object.entries(state).map(([db, s]) => {
      const successLogs = logs.filter(
        (l) => l.database === db && l.status === 'success' && typeof l.durationMs === 'number',
      );
      const durations = successLogs.map((l) => l.durationMs);
      const sorted = [...durations].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? null;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? null;
      const totalCalls = s.totalFetches + s.cacheHits;

      return [
        db,
        {
          totalFetches: s.totalFetches,
          totalErrors: s.totalErrors,
          cacheHits: s.cacheHits,
          avgDurationMs: s.avgDurationMs,
          p50DurationMs: p50,
          p95DurationMs: p95,
          lastRecordCount: s.recordCount,
          errorRate: s.totalFetches > 0 ? `${((s.totalErrors / s.totalFetches) * 100).toFixed(1)}%` : '0%',
          cacheHitRate: totalCalls > 0 ? `${((s.cacheHits / totalCalls) * 100).toFixed(1)}%` : '0%',
        },
      ];
    }),
  );

  res.json({ metrics });
});

// ─── GET /api/admin/monitoring/lace-gayle/views ─────────────────────────────
router.get('/lace-gayle/views', async (_req, res, next) => {
  try {
    const response = await fetchViewConfigFromGas({ database: 'LACE_GAYLE' }, { suppressAlerts: true });
    const data = response?.data || response || {};
    const configs = Array.isArray(data?.configs) ? data.configs : [];
    const logs = getSyncLogs(1000).filter((entry) => entry.database === 'LACE_GAYLE' && entry.view);

    const views = await Promise.all(configs
      .filter((config) => config && String(config.view || '').trim())
      .map(async (config) => {
        const qualifiedView = getQualifiedViewName({
          database: 'LACE_GAYLE',
          viewName: String(config.view || '').trim(),
          sheetName: String(config.sheetName || ''),
        });
        const fullConfig = await getViewConfigFromSource({ database: 'LACE_GAYLE', view: qualifiedView });
        const lastLog = logs.find((entry) => String(entry.view || '') === qualifiedView) || null;
        return {
          viewName: qualifiedView,
          rawViewName: String(config.view || '').trim(),
          sheetType: normalizeSheetType(config.sheetName || qualifiedView),
          markaCode: extractFilterValue(config, 'MARKA_CODE'),
          productCategory: extractFilterValue(config, 'PRODUCT_CATEGORY'),
          sourceUrl: fullConfig.url || null,
          sourceSheetName: fullConfig.sheetName || null,
          filterColumns: Array.isArray(config.filterColumns) ? config.filterColumns : [],
          filterValues: Array.isArray(config.filterValues) ? config.filterValues : [],
          lastSyncStatus: lastLog?.status || 'pending',
          lastSyncAt: lastLog?.at || null,
          recordCount: lastLog?.recordCount ?? null,
          lastError: lastLog?.error || null,
        };
      }));

    res.json({ count: views.length, views });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/monitoring/refresh ──────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { database, view } = req.body || {};
  const targets = database
    ? [String(database).toUpperCase()]
    : listDatabases({ includeInactive: false }).map((db) => db.name);

  if (database || view) {
    clearCacheByScope({ database, view });
  } else {
    clearCache();
  }

  const results = {};
  for (const db of targets) {
    try {
      const data = await fetchDataFromGas({ database: db, page: 1, pageSize: 1 }, { suppressAlerts: true });
      const count = data?.data?.total ?? data?.total ?? null;
      results[db] = { status: 'ok', recordCount: count };
    } catch (err) {
      results[db] = { status: 'error', error: String(err.message) };
    }
  }

  writeAuditEvent({
    actor: req.user?.email || 'admin',
    action: 'monitoring.manual_refresh',
    target: targets.join(', '),
    details: { results },
  });

  res.json({ refreshed: targets, results, state: getMonitorState() });
});

// ─── POST /api/admin/monitoring/force-reload ─────────────────────────────────
router.post('/force-reload', async (req, res) => {
  clearCache();

  const databases = listDatabases({ includeInactive: false }).map((db) => db.name);
  const results = {};

  await Promise.allSettled(
    databases.map(async (db) => {
      try {
        const [dataRes] = await Promise.allSettled([
          fetchDataFromGas({ database: db, page: 1, pageSize: 1 }, { suppressAlerts: true }),
          fetchDashboardFromGas({ database: db }, { suppressAlerts: true }),
        ]);
        const count =
          dataRes.value?.data?.total ?? dataRes.value?.total ?? null;
        results[db] = {
          status: dataRes.status === 'fulfilled' ? 'ok' : 'error',
          recordCount: count,
          error: dataRes.status === 'rejected' ? String(dataRes.reason?.message) : null,
        };
      } catch (err) {
        results[db] = { status: 'error', error: String(err.message) };
      }
    }),
  );

  writeAuditEvent({
    actor: req.user?.email || 'admin',
    action: 'monitoring.force_reload',
    target: 'ALL',
    details: { results },
  });

  res.json({ reloaded: databases, results, state: getMonitorState() });
});

// ─── DELETE /api/admin/monitoring/logs ────────────────────────────────────────
router.delete('/logs', (req, res) => {
  clearSyncLogs();
  writeAuditEvent({
    actor: req.user?.email || 'admin',
    action: 'monitoring.logs_cleared',
    target: 'sync-log',
    details: {},
  });
  res.json({ cleared: true });
});

// ─── Alert System Dashboard Monitoring Routes ────────────────────────────────

/**
 * GET /api/admin/monitoring/dashboard
 * Comprehensive dashboard overview with all key metrics
 */
router.get('/dashboard', async (req, res) => {
  try {
    await runIncidentEscalationSweep();
    const stats = getAlertStats();
    const delivery = getDeliveryMetrics();
    const frequency = getAlertFrequency(24);
    const failures = getFailureTracking();
    const slo = getSloRuntimeStatus();

    // Calculate derived metrics
    const criticalityScore = Math.round(
      (stats.criticalOpen / Math.max(1, stats.open)) * 100
    );

    res.json({
      timestamp: new Date().toISOString(),
      alertSystem: {
        totalAlerts: stats.total,
        openAlerts: stats.open,
        acknowledgedAlerts: stats.acknowledged,
        resolvedAlerts: stats.resolved,
        criticalOpen: stats.criticalOpen,
        criticalityScore,
      },
      channels: {
        delivery,
        failureTracking: failures,
        overallSuccessRate: Object.values(delivery).reduce((acc, ch) => acc + ch.successRate, 0) / Object.keys(delivery).length,
      },
      slo,
      trends: {
        frequency24h: frequency,
      },
      recentAlerts: listAlerts({ limit: 5 }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/monitoring/channels
 * Detailed channel delivery metrics and success rates
 */
router.get('/channels', (req, res) => {
  try {
    const delivery = getDeliveryMetrics();

    const channelStatus = Object.entries(delivery).map(([channel, stats]) => {
      let status = 'degraded';
      if (stats.attempts === 0) status = 'inactive';
      else if (stats.successRate >= 95) status = 'healthy';

      return {
        channel,
        totalAttempts: stats.attempts,
        successfulDeliveries: stats.sent,
        failedDeliveries: stats.failed,
        skipped: stats.skipped,
        successRate: `${stats.successRate}%`,
        status,
      };
    });

    res.json({
      timestamp: new Date().toISOString(),
      channels: channelStatus,
      overallHealth: channelStatus.every((ch) => ch.status !== 'degraded') ? 'healthy' : 'degraded',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/monitoring/frequency
 * Alert frequency trends over time
 */
router.get('/frequency', (req, res) => {
  try {
    const hours = Math.min(Number(req.query.hours) || 24, 168); // Max 7 days
    const frequency = getAlertFrequency(hours);

    const timeSeries = Object.entries(frequency)
      .map(([label, data]) => ({
        time: label,
        ...data,
      }))
      .sort((a, b) => {
        const aHours = Number.parseInt(a.time, 10) || 0;
        const bHours = Number.parseInt(b.time, 10) || 0;
        return aHours - bHours;
      });

    res.json({
      timestamp: new Date().toISOString(),
      hoursDisplayed: hours,
      timeSeries,
      totalAlertsInPeriod: timeSeries.reduce((sum, point) => sum + point.total, 0),
      avgAlertsPerHour: (timeSeries.reduce((sum, point) => sum + point.total, 0) / Math.max(1, timeSeries.length)).toFixed(2),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/monitoring/failures
 * Track failures by channel, type, and database
 */
router.get('/failures', (req, res) => {
  try {
    const failures = getFailureTracking();

    res.json({
      timestamp: new Date().toISOString(),
      failureBreakdown: {
        byChannel: Object.entries(failures.byChannel).map(([channel, data]) => ({
          channel,
          failureCount: data.count,
          lastError: data.lastError,
          recentExamples: data.examples,
        })),
        byType: failures.byType,
        byDatabase: failures.byDatabase,
      },
      totalFailures: Object.values(failures.byChannel).reduce((sum, ch) => sum + ch.count, 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/monitoring/retries
 * View current retry queue status
 */
router.get('/retries', (req, res) => {
  try {
    const openAlerts = listAlerts({ status: 'open', limit: 1000 });

    const retryInfo = [];
    for (const alert of openAlerts) {
      const retryStatus = getRetryStatus(alert.id);
      if (retryStatus) {
        retryInfo.push({
          alertId: alert.id,
          message: alert.message,
          type: alert.type,
          retries: retryStatus,
        });
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      pendingRetries: retryInfo.length,
      retries: retryInfo,
      summary: `${retryInfo.length} alerts with pending retries`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/monitoring/routing-config
 * Display the alert routing configuration
 */
router.get('/routing-config', (_req, res) => {
  try {
    const routing = getRoutingConfiguration();
    res.json({
      timestamp: new Date().toISOString(),
      routing,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/monitoring/health
 * Quick health check for alert system
 */
router.get('/health', (_req, res) => {
  try {
    const stats = getAlertStats();
    const delivery = getDeliveryMetrics();
    const failures = getFailureTracking();

    const totalFailures = Object.values(failures.byChannel).reduce((sum, ch) => sum + ch.count, 0);
    const overallSuccessRate = Object.values(delivery).reduce((acc, ch) => acc + ch.successRate, 0) / Object.keys(delivery).length;

    const isHealthy = overallSuccessRate >= 90 && stats.criticalOpen <= 10;

    res.json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      metrics: {
        successRate: `${overallSuccessRate.toFixed(2)}%`,
        totalAlerts: stats.total,
        openCritical: stats.criticalOpen,
        totalFailures,
        channelsOperational: Object.values(delivery).filter((ch) => ch.attempts > 0).length,
      },
      alerts: isHealthy ? [] : [
        ...(overallSuccessRate < 90 ? [`Low success rate: ${overallSuccessRate.toFixed(2)}%`] : []),
        ...(stats.criticalOpen > 10 ? [`High critical alert count: ${stats.criticalOpen}`] : []),
      ],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/monitoring/slo-status
 * Runtime SLO window state and thresholds
 */
router.get('/slo-status', (_req, res) => {
  try {
    res.json(getSloRuntimeStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
