import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.resolve(__dirname, '../../storage');
const storePath = path.join(storageDir, 'alerts.json');

const DEFAULT_SETTINGS = {
  cooldownMinutes: 10,
  performanceWarningMs: 3000,
  performanceCriticalMs: 6000,
  rateLimitBurstCount: 5,
  authFailureBurstCount: 5,
  strictExportBlockOnIsolationMismatch: true,
  slo: {
    evaluationWindowMinutes: 5,
    apiResponseWarningMs: 3000,
    apiResponseCriticalMs: 6000,
    syncDelayWarningMs: 10000,
    syncDelayCriticalMs: 20000,
    failureRateWarningPct: 10,
    failureRateCriticalPct: 25,
    failureWarningCount: 1,
    failureCriticalCount: 3,
    escalationUnresolvedMinutes: 10,
    escalationRepeatMinutes: 10,
  },
  recipients: {
    emails: [],
  },
  defaultChannels: {
    adminPanel: true,
    push: true,
    email: false,
    telegram: false,
  },
  types: {
    sync_failure: { enabled: true },
    data_isolation: { enabled: true },
    performance: { enabled: true },
    rate_limit: { enabled: true },
    auth_security: { enabled: true },
  },
};

function ensureStorageDir() {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
}

function createEmptyStore() {
  return {
    alerts: [],
    settings: DEFAULT_SETTINGS,
  };
}

function mergeSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    recipients: {
      ...DEFAULT_SETTINGS.recipients,
      ...settings.recipients,
      emails: Array.isArray(settings?.recipients?.emails)
        ? settings.recipients.emails.map((x) => String(x || '').trim()).filter(Boolean)
        : DEFAULT_SETTINGS.recipients.emails,
    },
    defaultChannels: {
      ...DEFAULT_SETTINGS.defaultChannels,
      ...settings.defaultChannels,
    },
    slo: {
      ...DEFAULT_SETTINGS.slo,
      ...settings.slo,
    },
    types: {
      ...DEFAULT_SETTINGS.types,
      ...settings.types,
    },
  };
}

function readStore() {
  if (!fs.existsSync(storePath)) {
    return createEmptyStore();
  }

  try {
    const raw = fs.readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      alerts: Array.isArray(parsed?.alerts) ? parsed.alerts : [],
      settings: mergeSettings(parsed?.settings || {}),
    };
  } catch {
    return createEmptyStore();
  }
}

function writeStore(store) {
  ensureStorageDir();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'acknowledged') return 'acknowledged';
  if (value === 'resolved') return 'resolved';
  return 'open';
}

function normalizeIncidentKey(incidentKey) {
  return String(incidentKey || '').trim().toLowerCase();
}

function severityRank(severity) {
  const normalized = String(severity || '').trim().toLowerCase();
  if (normalized === 'critical') return 3;
  if (normalized === 'warning') return 2;
  return 1;
}

export function getAlertSettings() {
  const store = readStore();
  return mergeSettings(store.settings || {});
}

export function updateAlertSettings(nextSettings = {}) {
  const store = readStore();
  store.settings = mergeSettings(nextSettings);
  writeStore(store);
  return store.settings;
}

export function listAlerts({
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
  limit = 200,
} = {}) {
  return listAlertsWithMeta({
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
  }).alerts;
}

function parseTimestamp(value) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function resolveTimeWindow({ timeRange, from, to, startTime, endTime, customFrom, customTo }) {
  const normalized = String(timeRange || '').trim().toLowerCase();
  const map = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  if (normalized && normalized !== 'all' && normalized !== 'custom' && map[normalized]) {
    return {
      fromTs: Date.now() - map[normalized],
      toTs: null,
    };
  }

  const resolvedFrom = parseTimestamp(from) ?? parseTimestamp(startTime) ?? parseTimestamp(customFrom);
  const resolvedTo = parseTimestamp(to) ?? parseTimestamp(endTime) ?? parseTimestamp(customTo);
  if (normalized === 'custom' || resolvedFrom || resolvedTo) {
    return {
      fromTs: resolvedFrom,
      toTs: resolvedTo,
    };
  }

  return { fromTs: null, toTs: null };
}

function buildSearchText(item) {
  const details = item?.details && typeof item.details === 'object' ? item.details : {};
  const errorDetails = [
    details.errorCode,
    details.api,
    details.message,
    details.error,
    details.fingerprint,
    details.errorSignature,
    details.errorFingerprint,
  ].map((v) => String(v || '').toLowerCase());

  const text = [
    item.message,
    item.type,
    item.database,
    item.view,
    item.errorSignature,
    item.signature,
    item.fingerprint,
    item.errorFingerprint,
    ...errorDetails,
    JSON.stringify(details || {}).toLowerCase(),
  ];

  return text.map((v) => String(v || '').toLowerCase()).join(' ');
}

function matchesTimeWindow(item, fromTs, toTs) {
  if (!fromTs && !toTs) return true;
  const createdTs = parseTimestamp(item.createdAt);
  const lastSeenTs = parseTimestamp(item.lastSeen) || parseTimestamp(item.updatedAt) || createdTs;

  if (!createdTs && !lastSeenTs) return false;

  const candidateTs = Math.max(createdTs || 0, lastSeenTs || 0);
  if (fromTs && candidateTs < fromTs) return false;
  if (toTs && candidateTs > toTs) return false;
  return true;
}

export function listAlertsWithMeta({
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
  limit = 200,
} = {}) {
  const store = readStore();
  const normalizedStatus = status ? normalizeStatus(status) : '';
  const normalizedSeverity = String(severity || '').toLowerCase();
  const normalizedType = String(type || '').toLowerCase();
  const normalizedDatabase = String(database || '').trim().toLowerCase();
  const normalizedSource = String(sourceModule || '').toLowerCase();
  const normalizedSearch = String(search || q || '').trim().toLowerCase();
  const { fromTs, toTs } = resolveTimeWindow({
    timeRange,
    from,
    to,
    startTime,
    endTime,
    customFrom,
    customTo,
  });

  let items = [...store.alerts];
  if (normalizedStatus) {
    items = items.filter((item) => normalizeStatus(item.status) === normalizedStatus);
  }
  if (normalizedSeverity) {
    items = items.filter((item) => String(item.severity || '').toLowerCase() === normalizedSeverity);
  }
  if (normalizedType) {
    items = items.filter((item) => String(item.type || '').toLowerCase() === normalizedType);
  }
  if (normalizedDatabase) {
    items = items.filter((item) => String(item.database || '').trim().toLowerCase() === normalizedDatabase);
  }
  if (normalizedSource) {
    items = items.filter((item) => String(item.sourceModule || '').toLowerCase() === normalizedSource);
  }
  if (fromTs || toTs) {
    items = items.filter((item) => matchesTimeWindow(item, fromTs, toTs));
  }
  if (normalizedSearch) {
    items = items.filter((item) => buildSearchText(item).includes(normalizedSearch));
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 20000));
  return {
    alerts: items.slice(0, safeLimit),
    total: items.length,
  };
}

export function findAlertById(alertId) {
  const store = readStore();
  return store.alerts.find((item) => item.id === alertId) || null;
}

export function getLatestAlertBySignature(signature) {
  const normalized = String(signature || '').trim().toLowerCase();
  if (!normalized) return null;
  const store = readStore();
  return store.alerts.find((item) => String(item.signature || '').trim().toLowerCase() === normalized) || null;
}

export function getLatestAlertByIncidentKey(incidentKey) {
  const normalized = normalizeIncidentKey(incidentKey);
  if (!normalized) return null;
  const store = readStore();
  return store.alerts.find((item) => normalizeIncidentKey(item.incidentKey) === normalized) || null;
}

export function getLatestOpenAlertByIncidentKey(incidentKey) {
  const normalized = normalizeIncidentKey(incidentKey);
  if (!normalized) return null;
  const store = readStore();
  return store.alerts.find(
    (item) => normalizeIncidentKey(item.incidentKey) === normalized && normalizeStatus(item.status) === 'open',
  ) || null;
}

export function addAlert(alert) {
  const store = readStore();
  store.alerts.unshift(alert);
  if (store.alerts.length > 3000) {
    store.alerts = store.alerts.slice(0, 3000);
  }
  writeStore(store);
  return alert;
}

export function setAlertStatus(alertId, status, actor = 'system') {
  const store = readStore();
  const normalizedStatus = normalizeStatus(status);
  const now = nowIso();
  const idx = store.alerts.findIndex((item) => item.id === alertId);
  if (idx === -1) return null;

  const current = store.alerts[idx];
  const next = {
    ...current,
    status: normalizedStatus,
    updatedAt: now,
  };

  if (normalizedStatus === 'acknowledged' && !next.acknowledgedAt) {
    next.acknowledgedAt = now;
    next.acknowledgedBy = actor;
  }

  if (normalizedStatus === 'resolved') {
    if (!next.acknowledgedAt) {
      next.acknowledgedAt = now;
      next.acknowledgedBy = actor;
    }
    next.resolvedAt = now;
    next.resolvedBy = actor;
  }

  store.alerts[idx] = next;
  writeStore(store);
  return next;
}

export function appendDeliveryStatus(alertId, updates = {}) {
  const store = readStore();
  const idx = store.alerts.findIndex((item) => item.id === alertId);
  if (idx === -1) return null;

  const current = store.alerts[idx];
  const deliveryStatus = {
    ...current.deliveryStatus,
    ...updates,
  };

  const next = {
    ...current,
    deliveryStatus,
    updatedAt: nowIso(),
  };

  store.alerts[idx] = next;
  writeStore(store);
  return next;
}

/**
 * Increment the occurrence counter on the most recent alert matching the given
 * signature. Used by the debounce mechanism to track suppressed duplicates.
 */
export function incrementAlertOccurrences(signature) {
  const normalized = String(signature || '').trim().toLowerCase();
  if (!normalized) return null;
  const store = readStore();
  const idx = store.alerts.findIndex(
    (item) => String(item.signature || '').trim().toLowerCase() === normalized,
  );
  if (idx === -1) return null;
  const current = store.alerts[idx];
  const occurrences = Number(current.occurrences || 1) + 1;
  store.alerts[idx] = { ...current, occurrences, updatedAt: nowIso() };
  writeStore(store);
  return store.alerts[idx];
}

export function recordIncidentOccurrence(incidentKey, updates = {}) {
  const normalized = normalizeIncidentKey(incidentKey);
  if (!normalized) return null;

  const store = readStore();
  const idx = store.alerts.findIndex(
    (item) => normalizeIncidentKey(item.incidentKey) === normalized && normalizeStatus(item.status) === 'open',
  );
  if (idx === -1) return null;

  const current = store.alerts[idx];
  const now = nowIso();
  const nextSeverity = severityRank(updates.severity) > severityRank(current.severity)
    ? String(updates.severity || current.severity).toLowerCase()
    : current.severity;

  store.alerts[idx] = {
    ...current,
    severity: nextSeverity,
    occurrences: Number(current.occurrences || 1) + 1,
    lastSeen: now,
    updatedAt: now,
    message: updates.message || current.message,
    details: updates.details ? { ...current.details, ...updates.details } : current.details,
    errorSignature: updates.errorSignature || current.errorSignature || null,
    escalationLevel: Number(current.escalationLevel || 0),
    escalationHistory: Array.isArray(current.escalationHistory) ? current.escalationHistory : [],
  };

  writeStore(store);
  return store.alerts[idx];
}

export function updateIncidentEscalation(incidentKey, escalation = {}) {
  const normalized = normalizeIncidentKey(incidentKey);
  if (!normalized) return null;

  const store = readStore();
  const idx = store.alerts.findIndex(
    (item) => normalizeIncidentKey(item.incidentKey) === normalized && normalizeStatus(item.status) === 'open',
  );
  if (idx === -1) return null;

  const current = store.alerts[idx];
  const now = nowIso();
  const level = Math.max(0, Number(escalation.level ?? Number(current.escalationLevel || 0)));
  const history = Array.isArray(current.escalationHistory) ? [...current.escalationHistory] : [];
  history.push({
    level,
    at: escalation.at || now,
    reason: escalation.reason || 'unresolved_incident',
    triggeredBy: escalation.triggeredBy || 'system',
  });

  store.alerts[idx] = {
    ...current,
    escalationLevel: level,
    lastEscalatedAt: escalation.at || now,
    escalationReason: escalation.reason || 'unresolved_incident',
    escalationHistory: history,
    updatedAt: now,
  };

  writeStore(store);
  return store.alerts[idx];
}

export function getAlertStats() {
  const store = readStore();
  const summary = {
    total: store.alerts.length,
    open: 0,
    acknowledged: 0,
    resolved: 0,
    criticalOpen: 0,
  };

  for (const item of store.alerts) {
    const status = normalizeStatus(item.status);
    if (status === 'open') summary.open += 1;
    if (status === 'acknowledged') summary.acknowledged += 1;
    if (status === 'resolved') summary.resolved += 1;
    if (status === 'open' && String(item.severity || '').toLowerCase() === 'critical') {
      summary.criticalOpen += 1;
    }
  }

  return summary;
}

function createChannelMetricsSeed() {
  return {
    adminPanel: { attempts: 0, sent: 0, failed: 0, skipped: 0 },
    console: { attempts: 0, sent: 0, failed: 0, skipped: 0 },
    telegram: { attempts: 0, sent: 0, failed: 0, skipped: 0 },
    email: { attempts: 0, sent: 0, failed: 0, skipped: 0 },
    push: { attempts: 0, sent: 0, failed: 0, skipped: 0 },
  };
}

function ensureChannelMetric(metrics, channel) {
  if (!metrics[channel]) {
    metrics[channel] = { attempts: 0, sent: 0, failed: 0, skipped: 0 };
  }
  return metrics[channel];
}

function applyDeliveryStatus(metric, status) {
  metric.attempts += 1;

  if (typeof status === 'object' && status?.status) {
    if (status.status === 'sent') metric.sent += 1;
    else if (status.status === 'skipped') metric.skipped += 1;
    else if (status.status === 'error' || status.status === 'failed_permanent') {
      metric.failed += 1;
    }
    return;
  }

  if (status === 'logged' || status === 'stored') {
    metric.sent += 1;
  }
}

function normalizeSuccessRates(metrics) {
  const withRates = {};
  for (const [channel, stats] of Object.entries(metrics)) {
    const successRate = stats.attempts > 0 ? ((stats.sent / stats.attempts) * 100).toFixed(2) : 0;
    withRates[channel] = {
      ...stats,
      successRate: Number.parseFloat(successRate),
    };
  }
  return withRates;
}

/**
 * Get delivery channel metrics for monitoring dashboard
 */
export function getDeliveryMetrics() {
  const store = readStore();
  const metrics = createChannelMetricsSeed();

  for (const alert of store.alerts) {
    const delivery = alert.deliveryStatus || {};
    for (const [channel, status] of Object.entries(delivery)) {
      const metric = ensureChannelMetric(metrics, channel);
      applyDeliveryStatus(metric, status);
    }
  }

  return normalizeSuccessRates(metrics);
}

/**
 * Get alert frequency for last N hours
 */
export function getAlertFrequency(hoursBack = 24) {
  const store = readStore();
  const now = Date.now();
  const windowMs = hoursBack * 60 * 60 * 1000;
  const buckets = {};

  for (const alert of store.alerts) {
    const createdMs = new Date(alert.createdAt).getTime();
    if (!Number.isFinite(createdMs)) continue;
    if (now - createdMs > windowMs) continue;

    const hourAgo = Math.floor((now - createdMs) / (60 * 60 * 1000));
    const label = `${hourAgo}h ago`;
    if (!buckets[label]) {
      buckets[label] = { critical: 0, warning: 0, info: 0, total: 0 };
    }

    const severity = String(alert.severity || 'info').toLowerCase();
    buckets[label][severity] += 1;
    buckets[label].total += 1;
  }

  return buckets;
}

function createFailureSeed() {
  return {
    byChannel: {},
    byType: {},
    byDatabase: {},
  };
}

function isDeliveryFailure(status) {
  return typeof status === 'object' && (status.status === 'error' || status.status === 'failed_permanent');
}

function collectFailureChannels(delivery) {
  return Object.entries(delivery || {})
    .filter(([, status]) => isDeliveryFailure(status))
    .map(([channel, status]) => ({ channel, status }));
}

function addFailureExample(target, alert) {
  if (target.examples.length >= 3) return;
  target.examples.push({
    alertId: alert.id,
    message: alert.message,
    timestamp: alert.createdAt,
  });
}

function incrementFailureType(target, type, hasFailures) {
  if (!hasFailures) return;
  if (!target.byType[type]) target.byType[type] = 0;
  target.byType[type] += 1;
}

function incrementFailureDatabase(target, database, hasFailures) {
  if (!database) return;
  if (!target.byDatabase[database]) target.byDatabase[database] = 0;
  if (hasFailures) target.byDatabase[database] += 1;
}

function accumulateChannelFailures(target, alert, channelFailures) {
  for (const { channel, status } of channelFailures) {
    if (!target.byChannel[channel]) {
      target.byChannel[channel] = { count: 0, lastError: null, examples: [] };
    }
    target.byChannel[channel].count += 1;
    target.byChannel[channel].lastError = status.reason || status.error;
    addFailureExample(target.byChannel[channel], alert);
  }
}

function processAlertFailureAggregate(target, alert) {
  const delivery = alert.deliveryStatus || {};
  const channelFailures = collectFailureChannels(delivery);
  const hasFailures = channelFailures.length > 0;
  const type = String(alert.type || 'unknown').toLowerCase();

  accumulateChannelFailures(target, alert, channelFailures);
  incrementFailureType(target, type, hasFailures);
  incrementFailureDatabase(target, alert.database, hasFailures);
}

/**
 * Get failure tracking by channel
 */
export function getFailureTracking() {
  const store = readStore();
  const failures = createFailureSeed();

  for (const alert of store.alerts) {
    processAlertFailureAggregate(failures, alert);
  }

  return failures;
}
