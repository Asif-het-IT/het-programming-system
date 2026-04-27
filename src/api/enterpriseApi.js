import { httpClient } from './httpClient';

const SUPPORTED_EXPORT_FORMATS = new Set(['excel', 'pdf', 'png']);

export async function loginRequest(payload) {
  const { data } = await httpClient.post('/login', payload);
  return data;
}

export async function getDataRequest(params) {
  const { data } = await httpClient.get('/data', { params });
  return data;
}

export async function getFiltersRequest() {
  const { data } = await httpClient.get('/filters');
  return data;
}

export async function getExportRequest(params) {
  const format = String(params?.format || '').toLowerCase();
  if (!SUPPORTED_EXPORT_FORMATS.has(format)) {
    throw new Error(`Unsupported export format: ${params?.format || 'unknown'}. Use excel, pdf, or png.`);
  }
  const { data } = await httpClient.get('/export', { params: { ...params, format } });
  return data;
}

export async function getUsersRequest(options = {}) {
  const { data } = await httpClient.get('/admin/users', {
    skipCache: options.skipCache,
    cacheTtlMs: options.cacheTtlMs,
  });
  return data;
}

export async function createUserRequest(payload) {
  const { data } = await httpClient.post('/admin/user', payload);
  return data;
}

export async function assignViewRequest(payload) {
  const { data } = await httpClient.put('/admin/assign-view', payload);
  return data;
}

export async function updateUserConfigRequest(email, payload) {
  const { data } = await httpClient.put(`/admin/user/${encodeURIComponent(email)}`, payload);
  return data;
}

export async function deleteUserRequest(email) {
  const { data } = await httpClient.delete(`/admin/user/${encodeURIComponent(email)}`);
  return data;
}

export async function resetPasswordRequest(payload) {
  const { data } = await httpClient.post('/admin/reset-password', payload);
  return data;
}

export async function setUserStatusRequest(payload) {
  const { data } = await httpClient.put('/admin/user-status', payload);
  return data;
}

export async function getAuditLogRequest(limit = 100) {
  const { data } = await httpClient.get('/admin/audit-log', { params: { limit } });
  return data;
}

export async function getAdminViewsRequest(options = {}) {
  const { data } = await httpClient.get('/admin/views', {
    skipCache: options.skipCache,
    cacheTtlMs: options.cacheTtlMs,
  });
  return data;
}

export async function getAdminColumnsRequest(params) {
  const { data } = await httpClient.get('/admin/columns', { params });
  return data;
}

export async function getAdminFilterValuesRequest(params) {
  const { data } = await httpClient.get('/admin/filter-values', { params });
  return data;
}

export async function getAdminDatabasesRequest(options = {}) {
  const { data } = await httpClient.get('/admin/databases', {
    skipCache: options.skipCache,
    cacheTtlMs: options.cacheTtlMs,
  });
  return data;
}

export async function createAdminDatabaseRequest(payload) {
  const { data } = await httpClient.post('/admin/databases', payload);
  return data;
}

export async function updateAdminDatabaseRequest(id, payload) {
  const { data } = await httpClient.put(`/admin/databases/${encodeURIComponent(id)}`, payload);
  return data;
}

export async function deleteAdminDatabaseRequest(id) {
  const { data } = await httpClient.delete(`/admin/databases/${encodeURIComponent(id)}`);
  return data;
}

export async function detectAdminDatabaseColumnsRequest(id) {
  const { data } = await httpClient.post(`/admin/databases/${encodeURIComponent(id)}/detect-columns`);
  return data;
}

export async function getViewDefinitionsRequest(database, options = {}) {
  const { data } = await httpClient.get('/admin/view-definitions', {
    params: database ? { database } : {},
    skipCache: options.skipCache,
    cacheTtlMs: options.cacheTtlMs,
  });
  return data;
}

export async function createViewDefinitionRequest(payload) {
  const { data } = await httpClient.post('/admin/view-definitions', payload);
  return data;
}

export async function updateViewDefinitionRequest(id, payload) {
  const { data } = await httpClient.put(`/admin/view-definitions/${encodeURIComponent(id)}`, payload);
  return data;
}

export async function deleteViewDefinitionRequest(id) {
  const { data } = await httpClient.delete(`/admin/view-definitions/${encodeURIComponent(id)}`);
  return data;
}

export async function getMyViewsRequest() {
  const { data } = await httpClient.get('/my-views');
  return data;
}

// ─── Notification APIs ────────────────────────────────────────────────────────

export async function getNotificationSubscribersRequest() {
  const { data } = await httpClient.get('/admin/notifications/subscribers');
  return data;
}

export async function getNotificationLogsRequest(limit = 50) {
  const { data } = await httpClient.get('/admin/notifications/logs', { params: { limit } });
  return data;
}

export async function getNotificationStatusRequest() {
  const { data } = await httpClient.get('/admin/notifications/status');
  return data;
}

export async function sendNotificationRequest(payload) {
  const { data } = await httpClient.post('/admin/notifications/send', payload);
  return data;
}

// ─── Alerts APIs ──────────────────────────────────────────────────────────────

export async function getAdminAlertsRequest(params = {}) {
  const { data } = await httpClient.get('/admin/alerts', { params });
  return data;
}

export async function updateAdminAlertStatusRequest(id, status) {
  const normalizedStatus = String(status || '').toLowerCase();

  try {
    const { data } = await httpClient.patch(`/admin/alerts/${encodeURIComponent(id)}`, {
      status: normalizedStatus,
    });
    return data;
  } catch (error) {
    // Backward compatibility: existing deployments expose dedicated action routes.
    if (normalizedStatus === 'acknowledged') {
      return acknowledgeAdminAlertRequest(id);
    }
    if (normalizedStatus === 'resolved') {
      return resolveAdminAlertRequest(id);
    }
    throw error;
  }
}

export async function bulkUpdateAdminAlertStatusRequest(ids, status = 'open') {
  const normalizedStatus = String(status || '').toLowerCase();
  const { data } = await httpClient.post('/admin/alerts/bulk', {
    ids,
    status: normalizedStatus,
  });
  return data;
}

export async function acknowledgeAdminAlertRequest(id) {
  const { data } = await httpClient.post(`/admin/alerts/${encodeURIComponent(id)}/acknowledge`);
  return data;
}

export async function resolveAdminAlertRequest(id) {
  const { data } = await httpClient.post(`/admin/alerts/${encodeURIComponent(id)}/resolve`);
  return data;
}

export async function retryAdminAlertSyncRequest(id) {
  const { data } = await httpClient.post(`/admin/alerts/${encodeURIComponent(id)}/retry-sync`);
  return data;
}

export async function getAdminAlertSettingsRequest() {
  const { data } = await httpClient.get('/admin/alert-settings');
  return data;
}

export async function updateAdminAlertSettingsRequest(payload) {
  const { data } = await httpClient.put('/admin/alert-settings', payload);
  return data;
}

export async function sendAdminTestAlertRequest(payload) {
  const { data } = await httpClient.post('/admin/alerts/test', payload);
  return data;
}

// ─── Monitoring APIs ──────────────────────────────────────────────────────────

export async function getMonitoringStatusRequest() {
  const { data } = await httpClient.get('/admin/monitoring/status');
  return data;
}

export async function getMonitoringDashboardRequest() {
  const { data } = await httpClient.get('/admin/monitoring/dashboard');
  return data;
}

export async function getMonitoringChannelsRequest() {
  const { data } = await httpClient.get('/admin/monitoring/channels');
  return data;
}

export async function getMonitoringFrequencyRequest(hours = 24) {
  const { data } = await httpClient.get('/admin/monitoring/frequency', {
    params: { hours },
  });
  return data;
}

export async function getMonitoringFailuresRequest() {
  const { data } = await httpClient.get('/admin/monitoring/failures');
  return data;
}

export async function getMonitoringRetriesRequest() {
  const { data } = await httpClient.get('/admin/monitoring/retries');
  return data;
}

export async function getMonitoringRoutingConfigRequest() {
  const { data } = await httpClient.get('/admin/monitoring/routing-config');
  return data;
}

export async function getMonitoringHealthRequest() {
  const { data } = await httpClient.get('/admin/monitoring/health');
  return data;
}

export async function getMonitoringSloStatusRequest() {
  const { data } = await httpClient.get('/admin/monitoring/slo-status');
  return data;
}

export async function getMonitoringLogsRequest({ limit = 100, database = null, status = null } = {}) {
  const { data } = await httpClient.get('/admin/monitoring/logs', {
    params: { limit, ...(database ? { database } : {}), ...(status ? { status } : {}) },
  });
  return data;
}

export async function getMonitoringPerformanceRequest() {
  const { data } = await httpClient.get('/admin/monitoring/performance');
  return data;
}

export async function getMonitoringLaceGayleViewsRequest() {
  const { data } = await httpClient.get('/admin/monitoring/lace-gayle/views');
  return data;
}

export async function refreshMonitoringRequest(database = null) {
  const { data } = await httpClient.post('/admin/monitoring/refresh', database ? { database } : {});
  return data;
}

export async function forceReloadMonitoringRequest() {
  const { data } = await httpClient.post('/admin/monitoring/force-reload');
  return data;
}

export async function clearMonitoringLogsRequest() {
  const { data } = await httpClient.delete('/admin/monitoring/logs');
  return data;
}
