import { httpClient } from './httpClient';

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
  const { data } = await httpClient.get('/export', { params });
  return data;
}

export async function getUsersRequest() {
  const { data } = await httpClient.get('/admin/users');
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

export async function getAdminViewsRequest() {
  const { data } = await httpClient.get('/admin/views');
  return data;
}

export async function getAdminColumnsRequest(params) {
  const { data } = await httpClient.get('/admin/columns', { params });
  return data;
}

export async function getAdminDatabasesRequest() {
  const { data } = await httpClient.get('/admin/databases');
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

export async function getViewDefinitionsRequest(database) {
  const { data } = await httpClient.get('/admin/view-definitions', {
    params: database ? { database } : {},
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

// ─── Monitoring APIs ──────────────────────────────────────────────────────────

export async function getMonitoringStatusRequest() {
  const { data } = await httpClient.get('/admin/monitoring/status');
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
