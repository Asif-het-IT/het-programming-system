import { env } from '../config/env.js';
import { getSubscriptionsByRole } from '../data/pushSubscriptions.js';
import { sendPushToSubscriptions } from './pushService.js';

let cachedTransport = null;

async function getMailTransport() {
  if (cachedTransport) return cachedTransport;
  if (!env.emailAlertsEnabled) return null;
  if (!env.smtpHost || !env.smtpPort || !env.smtpUser || !env.smtpPass) return null;

  try {
    const mod = await import('nodemailer');
    const nodemailer = mod.default || mod;
    cachedTransport = nodemailer.createTransport({
      host: env.smtpHost,
      port: Number(env.smtpPort),
      secure: Number(env.smtpPort) === 465,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
    return cachedTransport;
  } catch {
    return null;
  }
}

function normalizeSeverity(value) {
  const severity = String(value || '').toLowerCase();
  if (severity === 'critical') return 'CRITICAL';
  if (severity === 'warning') return 'WARNING';
  return 'INFO';
}

function formatTelegramMessage(alert) {
  const lines = [
    '\ud83d\udea8 het Database Alert',
    '',
    `Severity: ${normalizeSeverity(alert.severity)}`,
    `Type: ${alert.type}`,
    `Database: ${alert.database || '-'}`,
    `View: ${alert.view || '-'}`,
    `User: ${alert.user || '-'}`,
    `Message: ${alert.message}`,
    `Time: ${new Date(alert.createdAt).toLocaleString()}`,
  ];
  return lines.join('\n');
}

function formatEmailHtml(alert) {
  const detailBlock = `<pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto">${JSON.stringify(alert.details || {}, null, 2)}</pre>`;
  return `
    <h2>het Database Alert</h2>
    <p><strong>Severity:</strong> ${normalizeSeverity(alert.severity)}</p>
    <p><strong>Type:</strong> ${alert.type}</p>
    <p><strong>Database:</strong> ${alert.database || '-'}</p>
    <p><strong>View:</strong> ${alert.view || '-'}</p>
    <p><strong>User:</strong> ${alert.user || '-'}</p>
    <p><strong>Message:</strong> ${alert.message}</p>
    <p><strong>Timestamp:</strong> ${new Date(alert.createdAt).toLocaleString()}</p>
    <p><strong>Suggested action:</strong> Review /admin/alerts and acknowledge, then resolve after remediation.</p>
    <h3>Details</h3>
    ${detailBlock}
  `;
}

async function deliverPush(alert) {
  const subscriptions = getSubscriptionsByRole('admin');
  if (subscriptions.length === 0) {
    return { status: 'skipped', reason: 'no_admin_subscriptions' };
  }

  const payload = {
    title: `[${normalizeSeverity(alert.severity)}] ${alert.type}`,
    body: alert.message,
    priority: alert.severity === 'critical' ? 'important' : 'normal',
    type: 'monitoring_alert',
    link: '/admin/alerts',
    alertId: alert.id,
  };

  const result = await sendPushToSubscriptions(subscriptions, payload);
  return {
    status: 'sent',
    recipientCount: subscriptions.length,
    delivered: result.delivered,
    failed: result.failed,
  };
}

async function deliverTelegram(alert) {
  if (!env.telegramAlertsEnabled) {
    return { status: 'skipped', reason: 'disabled' };
  }
  if (!env.telegramBotToken || !env.telegramChatId) {
    return { status: 'skipped', reason: 'missing_telegram_config' };
  }

  const endpoint = `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.telegramChatId,
      text: formatTelegramMessage(alert),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { status: 'error', reason: `telegram_http_${response.status}`, response: text.slice(0, 300) };
  }

  return { status: 'sent' };
}

async function deliverEmail(alert, recipients = []) {
  if (!env.emailAlertsEnabled) {
    return { status: 'skipped', reason: 'disabled' };
  }

  const to = Array.isArray(recipients) ? recipients.filter(Boolean) : [];
  if (to.length === 0) {
    return { status: 'skipped', reason: 'no_recipients' };
  }

  const transport = await getMailTransport();
  if (!transport) {
    return { status: 'skipped', reason: 'smtp_not_ready' };
  }

  await transport.sendMail({
    from: env.smtpUser,
    to: to.join(','),
    subject: `[${normalizeSeverity(alert.severity)}] het Database Alert - ${alert.type}`,
    text: `${alert.message}\n\nDetails:\n${JSON.stringify(alert.details || {}, null, 2)}`,
    html: formatEmailHtml(alert),
  });

  return { status: 'sent', recipientCount: to.length };
}

/**
 * Console delivery channel — always active.
 * Writes a structured JSON line to stdout so any log aggregator (systemd journal,
 * PM2 log, CloudWatch, Splunk, etc.) captures every alert as an external event.
 */
function deliverConsole(alert) {
  const line = JSON.stringify({
    channel: 'console',
    alertId: alert.id,
    severity: alert.severity,
    type: alert.type,
    database: alert.database || null,
    message: alert.message,
    createdAt: alert.createdAt,
  });
  process.stdout.write(`[ALERT] ${line}\n`);
  return { status: 'logged' };
}

export async function deliverAlert(alert, channels, recipients = []) {
  const selected = channels || {};
  const status = {
    adminPanel: 'stored',
  };

  // Console channel is always active — provides a guaranteed external delivery path.
  try {
    status.console = deliverConsole(alert);
  } catch (error) {
    status.console = { status: 'error', reason: String(error?.message || error) };
  }

  if (selected.push) {
    try {
      status.push = await deliverPush(alert);
    } catch (error) {
      status.push = { status: 'error', reason: String(error?.message || error) };
    }
  }

  if (selected.telegram) {
    try {
      status.telegram = await deliverTelegram(alert);
    } catch (error) {
      status.telegram = { status: 'error', reason: String(error?.message || error) };
    }
  }

  if (selected.email) {
    try {
      status.email = await deliverEmail(alert, recipients);
    } catch (error) {
      status.email = { status: 'error', reason: String(error?.message || error) };
    }
  }

  return status;
}
