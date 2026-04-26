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

export async function getMyViewsRequest() {
  const { data } = await httpClient.get('/my-views');
  return data;
}
