const ROLE_PERMISSIONS = {
  admin: ['data:read', 'data:write', 'data:export', 'dashboard:read', 'admin:manage', 'audit:read', 'report:read'],
  manager: ['data:read', 'data:write', 'data:export', 'dashboard:read', 'audit:read', 'report:read'],
  user: ['data:read'],
};

const USER_PERMISSION_MAP = {
  read: 'data:read',
  write: 'data:write',
  export: 'data:export',
  dashboard: 'dashboard:read',
};

export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[String(role || 'user').toLowerCase()] || ROLE_PERMISSIONS.user;
}

export function hasPermission(user, permission) {
  const rolePerms = getRolePermissions(user?.role);
  const userPermissions = user?.permissions && typeof user.permissions === 'object' ? user.permissions : null;

  if (permission === 'data:write' || permission === 'data:export') {
    if (userPermissions?.viewOnly === true) {
      return false;
    }
  }

  if (userPermissions) {
    const key = Object.keys(USER_PERMISSION_MAP).find((k) => USER_PERMISSION_MAP[k] === permission);
    if (key && typeof userPermissions[key] === 'boolean') {
      return userPermissions[key];
    }
  }

  return rolePerms.includes(permission);
}