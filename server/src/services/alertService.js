import { createHash } from 'node:crypto';
import {
  addAlert,
  appendDeliveryStatus,
  findAlertById,
  getAlertSettings,
  getAlertStats,
  getLatestAlertByIncidentKey,
  getLatestAlertBySignature,
  getLatestOpenAlertByIncidentKey,
  incrementAlertOccurrences,
  listAlerts,
  listAlertsWithMeta,
  recordIncidentOccurrence,
  setAlertStatus,
  updateIncidentEscalation,
  updateAlertSettings,
} from '../data/alertsStore.js';
import { writeAuditEvent } from '../data/auditLog.js';
import { deliverAlert } from './alertDelivery.js';
import { env } from '../config/env.js';
import { shouldExcludePath, getPerformanceThreshold, shouldWarningOnly, getSeverityOverride } from '../config/alertNoiseControl.js';
import { determineChannels, getRoutingExplanation } from '../services/alertPriorityRouter.js';
import { handleDeliveryFailure } from '../services/channelRetryService.js';

const slowRequestTracker = new Map();
const authFailureTracker = new Map();
const rateLimitTracker = new Map();
const syncOutcomeTracker = new Map();
const sloBreachTracker = new Map();
// Short-window debounce: suppress duplicate signatures within DEBOUNCE_WINDOW_MS
// to prevent burst noise. Occurrences are tracked on the existing alert.
const DEBOUNCE_WINDOW_MS = 60 * 1000; // 60 seconds
const debounceTracker = new Map();

function nowMs() {
  return Date.now();
}

function toIso(ts = nowMs()) {
  return new Date(ts).toISOString();
}

function normalizeAlertType(value) {
  return String(value || 'sync_failure').trim().toLowerCase();
}

function normalizeSeverity(value) {
  const sev = String(value || '').trim().toLowerCase();
  if (sev === 'critical') return 'critical';
  if (sev === 'warning') return 'warning';
  return 'info';
}

function mergeChannels(typeConfig, settings, overrideChannels) {
  const typeChannels = typeConfig?.channels || undefined;

  if (overrideChannels && typeof overrideChannels === 'object') {
    return {
      adminPanel: true,
      ...settings.defaultChannels,
      ...typeChannels,
      ...overrideChannels,
    };
  }

  return {
    adminPanel: true,
    ...settings.defaultChannels,
    ...typeChannels,
  };
}

function buildSignature({ type, severity, database, view, user, message, sourceModule, signature }) {
  if (signature) return String(signature).toLowerCase();
  return [type, severity, database, view, user, message, sourceModule]
    .map((part) => String(part || '').trim().toLowerCase())
    .join('::');
}

function normalizeHashPart(value) {
  return String(value || '').trim().toLowerCase();
}

function buildErrorSignature({ errorSignature, details, message, sourceModule, signature }) {
  if (errorSignature) return normalizeHashPart(errorSignature);
  if (details?.errorSignature) return normalizeHashPart(details.errorSignature);

  const stableParts = [
    details?.errorCode,
    details?.api,
    details?.layer,
    sourceModule,
    message,
  ].filter(Boolean);

  if (stableParts.length > 0) {
    return stableParts.map(normalizeHashPart).join('::');
  }

  return normalizeHashPart(signature);
}

function buildIncidentKey({ type, database, view, errorSignature }) {
  const raw = [type, database, view, errorSignature]
    .map(normalizeHashPart)
    .join('::');
  return createHash('sha1').update(raw).digest('hex').slice(0, 20);
}

function isCooldownActive(signature, settings, lookup = getLatestAlertBySignature) {
  const latest = lookup(signature);
  if (!latest) return false;

  const cooldownMinutes = Number(settings.cooldownMinutes || 10);
  const cooldownMs = Math.max(1, cooldownMinutes) * 60 * 1000;
  const createdAtMs = new Date(latest.createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) return false;
  return nowMs() - createdAtMs < cooldownMs;
}

function shouldPushCritical(channels, severity) {
  return severity === 'critical' || channels.push;
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function resolveSloSettings(settings) {
  const slo = settings?.slo || {};
  return {
    evaluationWindowMinutes: toPositiveInt(slo.evaluationWindowMinutes, 5),
    apiResponseWarningMs: toPositiveInt(slo.apiResponseWarningMs, 3000),
    apiResponseCriticalMs: toPositiveInt(slo.apiResponseCriticalMs, 6000),
    syncDelayWarningMs: toPositiveInt(slo.syncDelayWarningMs, 10000),
    syncDelayCriticalMs: toPositiveInt(slo.syncDelayCriticalMs, 20000),
    failureRateWarningPct: toPositiveInt(slo.failureRateWarningPct, 10),
    failureRateCriticalPct: toPositiveInt(slo.failureRateCriticalPct, 25),
    failureWarningCount: toPositiveInt(slo.failureWarningCount, 1),
    failureCriticalCount: toPositiveInt(slo.failureCriticalCount, 3),
    escalationUnresolvedMinutes: toPositiveInt(slo.escalationUnresolvedMinutes, 10),
    escalationRepeatMinutes: toPositiveInt(slo.escalationRepeatMinutes, 10),
  };
}

function pushWindowEvent(map, key, windowMs, event) {
  const now = nowMs();
  const current = map.get(key) || [];
  const next = current.filter((item) => now - Number(item.ts || 0) < windowMs);
  next.push({ ...event, ts: now });
  map.set(key, next);
  return next;
}

function shouldEscalateOpenIncident(incident, settings) {
  if (!incident) return false;
  const slo = resolveSloSettings(settings);
  const createdAtMs = new Date(incident.firstSeen || incident.createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) return false;
  const unresolvedMs = nowMs() - createdAtMs;
  const thresholdMs = slo.escalationUnresolvedMinutes * 60 * 1000;
  if (unresolvedMs < thresholdMs) return false;

  const lastEscalatedAtMs = new Date(incident.lastEscalatedAt || 0).getTime();
  if (!Number.isFinite(lastEscalatedAtMs) || lastEscalatedAtMs <= 0) return true;

  const repeatMs = slo.escalationRepeatMinutes * 60 * 1000;
  return nowMs() - lastEscalatedAtMs >= repeatMs;
}

function getAlertRecipients(settings) {
  const staticRecipients = Array.isArray(settings.recipients?.emails) ? settings.recipients.emails : [];
  const envRecipients = String(env.alertEmailTo || '').split(',').map((x) => x.trim()).filter(Boolean);
  return Array.from(new Set([...staticRecipients, ...envRecipients]));
}

async function escalateOpenIncidentIfNeeded(openIncident, settings) {
  if (!shouldEscalateOpenIncident(openIncident, settings)) {
    return null;
  }

  const nextLevel = Number(openIncident.escalationLevel || 0) + 1;
  const escalated = updateIncidentEscalation(openIncident.incidentKey, {
    level: nextLevel,
    reason: 'unresolved_incident',
    at: toIso(),
    triggeredBy: 'slo-escalation-engine',
  });
  if (!escalated) return null;

  const channels = {
    adminPanel: true,
    console: true,
    push: true,
    email: true,
    telegram: true,
  };

  const escalationEnvelope = {
    ...escalated,
    type: 'incident_escalation',
    severity: 'critical',
    message: `[Escalation L${nextLevel}] ${escalated.message}`,
    details: {
      ...escalated.details,
      escalationLevel: nextLevel,
      escalationReason: 'unresolved_incident',
      escalationMode: 'repeated_alert',
    },
  };

  const channelStatus = await deliverAlert(escalationEnvelope, channels, getAlertRecipients(settings));
  appendDeliveryStatus(escalated.id, {
    escalation: {
      level: nextLevel,
      at: toIso(),
      status: 'sent',
      channels: Object.keys(channels),
    },
    escalationDelivery: channelStatus,
  });

  writeAuditEvent({
    actor: 'system',
    action: 'monitoring.alert.escalated',
    target: escalated.id,
    details: {
      incidentKey: escalated.incidentKey,
      escalationLevel: nextLevel,
      occurrences: escalated.occurrences,
    },
  });

  return escalated;
}

export async function runIncidentEscalationSweep() {
  const settings = getAlertSettings();
  const openAlerts = listAlerts({ status: 'open', limit: 1000 });
  const escalated = [];

  for (const alert of openAlerts) {
    const updated = await escalateOpenIncidentIfNeeded(alert, settings);
    if (updated) {
      escalated.push(updated.id);
    }
  }

  return {
    scanned: openAlerts.length,
    escalated,
  };
}

async function writeAlert(alert, channels, recipients) {
  addAlert(alert);

  writeAuditEvent({
    actor: 'system',
    action: 'monitoring.alert.created',
    target: alert.id,
    details: {
      type: alert.type,
      severity: alert.severity,
      database: alert.database,
      view: alert.view,
      user: alert.user,
      message: alert.message,
    },
  });

  // Apply priority-based channel routing
  const routedChannels = determineChannels(alert, channels);
  const routingExplanation = getRoutingExplanation(alert, routedChannels);

  try {
    const channelStatus = await deliverAlert(alert, routedChannels, recipients);
    appendDeliveryStatus(alert.id, {
      ...channelStatus,
      routingLogic: routingExplanation.explanation,
    });

    return {
      ...alert,
      deliveryStatus: channelStatus,
      routingExplanation,
    };
  } catch (error) {
    // Log delivery error and schedule retries
    const failedChannels = Object.entries(routedChannels)
      .filter(([_, enabled]) => enabled)
      .map(([channel]) => channel);

    for (const channel of failedChannels) {
      await handleDeliveryFailure(alert.id, channel, error);
    }

    throw error;
  }
}

export async function createMonitoringAlert(input = {}) {
  const settings = getAlertSettings();
  const type = normalizeAlertType(input.type);
  const severity = normalizeSeverity(input.severity);
  const typeConfig = settings.types?.[type] || { enabled: true };
  if (typeConfig.enabled === false) {
    return { created: false, reason: 'disabled_by_settings' };
  }

  const signature = buildSignature({
    ...input,
    type,
    severity,
  });
  const errorSignature = buildErrorSignature({
    ...input,
    signature,
  });
  const incidentKey = buildIncidentKey({
    type,
    database: input.database,
    view: input.view,
    errorSignature,
  });

  // Debounce: if the same signature fires again within DEBOUNCE_WINDOW_MS,
  // increment the occurrence counter on the existing alert and suppress the new one.
  const lastDebounceTs = debounceTracker.get(incidentKey) || 0;
  if (nowMs() - lastDebounceTs < DEBOUNCE_WINDOW_MS) {
    const groupedAlert = recordIncidentOccurrence(incidentKey, {
      severity,
      message: input.message,
      details: input.details,
      errorSignature,
    });
    if (groupedAlert) {
      return { created: false, reason: 'debounced', signature, incidentKey, alert: groupedAlert };
    }
    incrementAlertOccurrences(signature);
    return { created: false, reason: 'debounced', signature, incidentKey };
  }
  debounceTracker.set(incidentKey, nowMs());

  const openIncident = getLatestOpenAlertByIncidentKey(incidentKey);
  if (openIncident) {
    const groupedAlert = recordIncidentOccurrence(incidentKey, {
      severity,
      message: input.message,
      details: input.details,
      errorSignature,
    });
    await escalateOpenIncidentIfNeeded(groupedAlert || openIncident, settings);
    return { created: false, reason: 'grouped', signature, incidentKey, alert: groupedAlert || openIncident };
  }

  if (isCooldownActive(incidentKey, settings, getLatestAlertByIncidentKey)) {
    return { created: false, reason: 'cooldown', signature, incidentKey };
  }

  const channels = mergeChannels(typeConfig, settings, input.channels);
  if (shouldPushCritical(channels, severity)) {
    channels.push = true;
  }

  const id = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = toIso();

  const alert = {
    id,
    alertId: id,
    type,
    severity,
    sourceModule: input.sourceModule || 'monitoring',
    status: 'open',
    occurrences: 1,
    database: input.database || null,
    view: input.view || null,
    user: input.user || null,
    message: String(input.message || 'Monitoring alert'),
    details: input.details || {},
    signature,
    incidentKey,
    errorSignature,
    firstSeen: createdAt,
    lastSeen: createdAt,
    escalationLevel: 0,
    lastEscalatedAt: null,
    escalationReason: null,
    escalationHistory: [],
    createdAt,
    updatedAt: createdAt,
    acknowledgedAt: null,
    resolvedAt: null,
    acknowledgedBy: null,
    resolvedBy: null,
    deliveryStatus: {
      adminPanel: 'stored',
    },
  };

  const persisted = await writeAlert(alert, channels, getAlertRecipients(settings));
  return { created: true, alert: persisted };
}

function getFailureCountSeverity(failures, slo) {
  if (failures >= slo.failureCriticalCount) return 'critical';
  if (failures >= slo.failureWarningCount) return 'warning';
  return '';
}

function getFailureRateSeverity(failureRate, slo) {
  if (failureRate >= slo.failureRateCriticalPct) return 'critical';
  if (failureRate >= slo.failureRateWarningPct) return 'warning';
  return '';
}

function getDelaySeverity(duration, slo) {
  if (duration >= slo.syncDelayCriticalMs) return 'critical';
  if (duration >= slo.syncDelayWarningMs) return 'warning';
  return '';
}

function shouldDispatchSloBreach(key, minIntervalMs = 60 * 1000) {
  const lastAt = Number(sloBreachTracker.get(key) || 0);
  if (nowMs() - lastAt < minIntervalMs) return false;
  sloBreachTracker.set(key, nowMs());
  return true;
}

export async function reportSyncOperationResult({
  database,
  view,
  api,
  layer,
  durationMs,
  success,
  error,
}) {
  const settings = getAlertSettings();
  const slo = resolveSloSettings(settings);
  const windowMs = slo.evaluationWindowMinutes * 60 * 1000;
  const scopeKey = `${database || 'unknown'}::${layer || 'proxy'}`;
  const events = pushWindowEvent(syncOutcomeTracker, scopeKey, windowMs, {
    ok: success === true,
    durationMs: Number(durationMs || 0),
    api: api || 'records',
  });

  const total = events.length;
  const failures = events.filter((event) => event.ok !== true).length;
  const failureRate = total > 0 ? (failures / total) * 100 : 0;

  const minuteBucket = Math.floor(nowMs() / (60 * 1000));
  const numericDuration = Number(durationMs || 0);
  const failureRatePct = Number(failureRate.toFixed(2));
  const results = {
    failures,
    total,
    failureRate: failureRatePct,
    windowMinutes: slo.evaluationWindowMinutes,
  };

  if (success !== true) {
    const failureSeverity = getFailureCountSeverity(failures, slo);
    if (failureSeverity) {
      const key = `${scopeKey}::sync-failure-threshold::${failureSeverity}`;
      if (shouldDispatchSloBreach(key)) {
        await createMonitoringAlert({
          type: 'sync_failure',
          severity: failureSeverity,
          sourceModule: 'slo-breach-engine',
          database,
          view,
          message: `Sync failures breached threshold: ${failures} failures in ${slo.evaluationWindowMinutes}m`,
          details: {
            api,
            layer,
            error: String(error || ''),
            failures,
            total,
            failureRatePct,
            thresholds: {
              warningCount: slo.failureWarningCount,
              criticalCount: slo.failureCriticalCount,
            },
          },
          signature: `sync_failure_threshold::${scopeKey}::${failureSeverity}::${minuteBucket}`,
        });
      }
    }
  }

  const rateSeverity = getFailureRateSeverity(failureRate, slo);
  if (rateSeverity) {
    const key = `${scopeKey}::failure-rate::${rateSeverity}`;
    if (shouldDispatchSloBreach(key)) {
      await createMonitoringAlert({
        type: 'slo_breach',
        severity: rateSeverity,
        sourceModule: 'slo-breach-engine',
        database,
        view,
        message: `Failure rate SLO breached: ${failureRatePct.toFixed(2)}% in ${slo.evaluationWindowMinutes}m`,
        details: {
          metric: 'failure_rate',
          api,
          layer,
          failures,
          total,
          failureRatePct,
          thresholds: {
            warningPct: slo.failureRateWarningPct,
            criticalPct: slo.failureRateCriticalPct,
          },
        },
        signature: `slo_failure_rate::${scopeKey}::${rateSeverity}::${minuteBucket}`,
      });
    }
  }

  const delaySeverity = getDelaySeverity(numericDuration, slo);
  if (delaySeverity) {
    await createMonitoringAlert({
      type: 'sync_delay',
      severity: delaySeverity,
      sourceModule: 'slo-breach-engine',
      database,
      view,
      message: `Sync delay SLO breached: ${Math.round(numericDuration)} ms`,
      details: {
        metric: 'sync_delay',
        api,
        layer,
        durationMs: numericDuration,
        thresholds: {
          warningMs: slo.syncDelayWarningMs,
          criticalMs: slo.syncDelayCriticalMs,
        },
      },
      signature: `sync_delay::${scopeKey}::${delaySeverity}::${Math.floor(numericDuration / 250)}`,
    });
  }

  return results;
}

export function getSloRuntimeStatus() {
  const settings = getAlertSettings();
  const slo = resolveSloSettings(settings);
  const windowSummaries = syncOutcomeTracker.size;
  const scopes = Array.from(syncOutcomeTracker.entries()).slice(0, 50).map(([scope, events]) => {
    const total = events.length;
    const failures = events.filter((event) => event.ok !== true).length;
    const failureRate = total > 0 ? (failures / total) * 100 : 0;
    const lastEvent = events.at(-1);
    return {
      scope,
      total,
      failures,
      failureRatePct: Number(failureRate.toFixed(2)),
      lastEventAt: lastEvent?.ts ? new Date(lastEvent.ts).toISOString() : null,
    };
  });

  return {
    timestamp: new Date().toISOString(),
    settings: slo,
    scopeCount: windowSummaries,
    scopes,
  };
}

export function getMonitoringAlerts(filters = {}) {
  // Best-effort sweep so unresolved incidents escalate even without new events.
  void runIncidentEscalationSweep();
  const { alerts, total } = listAlertsWithMeta(filters);
  return {
    alerts,
    total,
    stats: getAlertStats(),
  };
}

export function getMonitoringAlertById(alertId) {
  return findAlertById(alertId);
}

function normalizeTargetStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'acknowledged') return 'acknowledged';
  if (value === 'resolved') return 'resolved';
  return 'open';
}

function writeStatusAudit(actor, status, alertId, alert) {
  const actionByStatus = {
    open: 'monitoring.alert.reopened',
    acknowledged: 'monitoring.alert.acknowledged',
    resolved: 'monitoring.alert.resolved',
  };

  writeAuditEvent({
    actor,
    action: actionByStatus[status] || 'monitoring.alert.updated',
    target: alertId,
    details: {
      status,
      type: alert?.type,
      severity: alert?.severity,
    },
  });
}

export function updateMonitoringAlertStatus(alertId, status, actor = 'admin') {
  const normalizedStatus = normalizeTargetStatus(status);
  const alert = setAlertStatus(alertId, normalizedStatus, actor);
  if (!alert) return null;

  writeStatusAudit(actor, normalizedStatus, alertId, alert);
  return alert;
}

export function bulkUpdateMonitoringAlertStatus(alertIds, status = 'open', actor = 'admin') {
  const normalizedStatus = normalizeTargetStatus(status);
  const ids = Array.from(new Set((Array.isArray(alertIds) ? alertIds : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)));

  const updated = [];
  const notFound = [];

  for (const id of ids) {
    const alert = setAlertStatus(id, normalizedStatus, actor);
    if (!alert) {
      notFound.push(id);
      continue;
    }
    writeStatusAudit(actor, normalizedStatus, id, alert);
    updated.push(alert);
  }

  return {
    status: normalizedStatus,
    requested: ids.length,
    updated,
    notFound,
  };
}

export function acknowledgeMonitoringAlert(alertId, actor = 'admin') {
  return updateMonitoringAlertStatus(alertId, 'acknowledged', actor);
}

export function resolveMonitoringAlert(alertId, actor = 'admin') {
  return updateMonitoringAlertStatus(alertId, 'resolved', actor);
}

export function getMonitoringAlertSettings() {
  return getAlertSettings();
}

export function updateMonitoringAlertSettings(nextSettings) {
  const updated = updateAlertSettings(nextSettings);
  writeAuditEvent({
    actor: 'system',
    action: 'monitoring.alert_settings.updated',
    target: 'alerts-settings',
    details: {
      cooldownMinutes: updated.cooldownMinutes,
      warningMs: updated.performanceWarningMs,
      criticalMs: updated.performanceCriticalMs,
    },
  });
  return updated;
}

function trackBurst(map, key, windowMs) {
  const now = nowMs();
  const list = map.get(key) || [];
  const next = list.filter((ts) => now - ts < windowMs);
  next.push(now);
  map.set(key, next);
  return next.length;
}

export async function reportPerformanceEvent({
  database,
  view,
  api,
  layer,
  durationMs,
  rowCount,
  cacheHit,
}) {
  // Check noise control rules — exclude paths that should not trigger alerts
  if (shouldExcludePath(api)) {
    return { created: false, reason: 'excluded_by_noise_control' };
  }

  const settings = getAlertSettings();
  const thresholdMs = getPerformanceThreshold(api);
  const duration = Number(durationMs || 0);

  if (!Number.isFinite(duration) || duration <= thresholdMs) {
    return { created: false, reason: 'below_threshold' };
  }

  // Determine base severity
  const criticalMs = Number(settings.performanceCriticalMs || 6000);
  let severity = duration >= criticalMs ? 'critical' : 'warning';

  // Apply severity overrides from noise control
  const severityOverride = getSeverityOverride(api);
  if (severityOverride) {
    severity = severityOverride;
  }

  // Downgrade to warning for paths that should only warn
  if (shouldWarningOnly(api) && severity === 'critical') {
    severity = 'warning';
  }

  const key = `${database || 'unknown'}::${api || 'unknown'}::${layer || 'app'}`;
  const repeatedCount = trackBurst(slowRequestTracker, key, 5 * 60 * 1000);

  // Escalate to critical when same endpoint has repeated slow requests (>3 in 5 min)
  const effectiveSeverity = (repeatedCount > 3 && severity === 'warning') ? 'critical' : severity;

  const message = repeatedCount > 2
    ? `Repeated slow requests detected (${repeatedCount}) on ${database || 'unknown'} (${Math.round(duration)} ms)`
    : `Slow request detected on ${database || 'unknown'} (${Math.round(duration)} ms)`;

  return createMonitoringAlert({
    type: 'performance',
    severity: effectiveSeverity,
    database,
    view,
    sourceModule: 'performance-monitor',
    message,
    details: {
      api,
      layer,
      durationMs: duration,
      rowCount: Number.isFinite(Number(rowCount)) ? Number(rowCount) : null,
      cacheHit: Boolean(cacheHit),
      repeatedCount,
      escalated: effectiveSeverity !== severity,
      thresholds: {
        warningMs: thresholdMs,
        criticalMs,
      },
    },
    signature: `${key}::${effectiveSeverity}::${Math.floor(duration / 500)}`,
  });
}

export async function reportRateLimitEvent({ scope, ip, path, user }) {
  const settings = getAlertSettings();
  const burstLimit = Number(settings.rateLimitBurstCount || 5);
  const key = `${scope || 'global'}::${ip || 'unknown'}`;
  const count = trackBurst(rateLimitTracker, key, 10 * 60 * 1000);

  if (count < burstLimit) {
    return { created: false, reason: 'below_burst_threshold', count };
  }

  const severity = count >= burstLimit * 2 ? 'critical' : 'warning';

  return createMonitoringAlert({
    type: 'rate_limit',
    severity,
    sourceModule: 'rate-limit',
    user,
    message: `Rate limit threshold exceeded (${count} events in 10 min)`,
    details: {
      scope,
      ip,
      path,
      count,
      threshold: burstLimit,
    },
    signature: `${key}::${Math.floor(count / burstLimit)}`,
  });
}

export async function reportAuthSecurityEvent({ eventType, ip, email, path, reason }) {
  const settings = getAlertSettings();
  const burstLimit = Number(settings.authFailureBurstCount || 5);
  const key = `${eventType || 'auth'}::${ip || 'unknown'}::${email || ''}`;
  const count = trackBurst(authFailureTracker, key, 10 * 60 * 1000);

  if (count < burstLimit) {
    return { created: false, reason: 'below_burst_threshold', count };
  }

  const severity = count >= burstLimit * 2 ? 'critical' : 'warning';

  return createMonitoringAlert({
    type: 'auth_security',
    severity,
    sourceModule: 'auth',
    user: email || null,
    message: `Repeated auth/security failures detected (${count} in 10 min)` ,
    details: {
      eventType,
      ip,
      email,
      path,
      reason,
      count,
      threshold: burstLimit,
    },
    signature: `${key}::${Math.floor(count / burstLimit)}`,
  });
}

export async function reportDataIsolationMismatch({
  database,
  view,
  user,
  mismatchRows,
  mismatchColumns,
  context,
  details,
}) {
  const rows = Number(mismatchRows || 0);
  const cols = Number(mismatchColumns || 0);
  if (rows <= 0 && cols <= 0) {
    return { created: false, reason: 'no_mismatch' };
  }

  const message = `${rows} unauthorized rows and ${cols} unauthorized column mismatches detected`;

  return createMonitoringAlert({
    type: 'data_isolation',
    severity: 'critical',
    sourceModule: 'data-isolation-validator',
    database,
    view,
    user,
    message,
    details: {
      mismatchRows: rows,
      mismatchColumns: cols,
      context,
      ...details,
    },
    signature: `isolation::${database}::${view}::${user || ''}::${context || 'read'}`,
  });
}
