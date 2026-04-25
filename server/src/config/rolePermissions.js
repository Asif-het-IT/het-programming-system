const ROLE_PERMISSIONS = {
  admin: ['data:read', 'data:write', 'admin:manage', 'audit:read', 'report:read'],
  manager: ['data:read', 'data:write', 'audit:read', 'report:read'],
  user: ['data:read'],
};

export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[String(role || 'user').toLowerCase()] || ROLE_PERMISSIONS.user;
}

export function hasPermission(user, permission) {
  const perms = getRolePermissions(user?.role);
  return perms.includes(permission);
}