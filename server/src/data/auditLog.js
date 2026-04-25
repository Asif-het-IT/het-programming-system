import { recordAuditEventForDailyReport } from './auditReports.js';

const auditEvents = [];

export function writeAuditEvent(event) {
  const normalizedEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...event,
  };

  auditEvents.unshift(normalizedEvent);

  // Keep daily reporting pipeline always-on for governance visibility.
  recordAuditEventForDailyReport(normalizedEvent);

  if (auditEvents.length > 1000) {
    auditEvents.length = 1000;
  }
}

export function listAuditEvents(limit = 200) {
  return auditEvents.slice(0, Math.max(1, Math.min(limit, 1000)));
}
