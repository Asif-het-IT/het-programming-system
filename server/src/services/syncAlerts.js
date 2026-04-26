import { getSubscriptionsByRole } from '../data/pushSubscriptions.js';
import { sendPushToSubscriptions } from './pushService.js';
import { writeAuditEvent } from '../data/auditLog.js';

const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const recentAlerts = new Map();

function normalizeKeyPart(value) {
  return String(value || '').trim().toLowerCase();
}

function buildAlertKey({ database, view, layer, error }) {
  return [database, view, layer, error].map(normalizeKeyPart).join('::');
}

function shouldAlert(key) {
  const last = recentAlerts.get(key);
  const now = Date.now();
  if (last && now - last < ALERT_COOLDOWN_MS) {
    return false;
  }
  recentAlerts.set(key, now);
  return true;
}

export async function notifySyncFailure({ database, view = '', layer = 'gas', error = '', requestUrl = null }) {
  const key = buildAlertKey({ database, view, layer, error });
  if (!shouldAlert(key)) {
    return { notified: false, reason: 'cooldown' };
  }

  const adminSubs = getSubscriptionsByRole('admin');
  if (adminSubs.length === 0) {
    writeAuditEvent({
      actor: 'system',
      action: 'monitoring.sync_failure.alert.skipped',
      target: database,
      details: { reason: 'no_admin_subscriptions', view, layer, error, requestUrl },
    });
    return { notified: false, reason: 'no-subscribers' };
  }

  const title = `Sync Failure: ${database}`;
  const body = [
    view ? `View: ${view}` : null,
    `Layer: ${layer}`,
    `Error: ${String(error).slice(0, 140)}`,
    'Retry suggestion: check monitoring panel and refresh after verifying GAS/Worker.',
  ].filter(Boolean).join(' | ');

  const result = await sendPushToSubscriptions(adminSubs, {
    title,
    body,
    priority: 'important',
    type: 'sync_failure',
    link: '/admin',
  });

  writeAuditEvent({
    actor: 'system',
    action: 'monitoring.sync_failure.alert.sent',
    target: database,
    details: {
      view,
      layer,
      error: String(error).slice(0, 500),
      requestUrl,
      delivered: result.delivered,
      failed: result.failed,
    },
  });

  return { notified: true, ...result };
}