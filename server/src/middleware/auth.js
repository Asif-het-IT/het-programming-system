import { verifyAccessToken } from '../utils/jwt.js';
import { hasPermission } from '../config/rolePermissions.js';
import { reportAuthSecurityEvent } from '../services/alertService.js';

export function requireAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return next({ status: 401, message: 'Missing bearer token' });
    }

    const payload = verifyAccessToken(token);
    req.user = payload;
    return next();
  } catch {
    void reportAuthSecurityEvent({
      eventType: 'invalid_token',
      ip: req.ip,
      email: null,
      path: req.originalUrl,
      reason: 'Invalid or expired token',
    });
    return next({ status: 401, message: 'Invalid or expired token' });
  }
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user || req.user.role !== role) {
      return next({ status: 403, message: 'Forbidden' });
    }

    return next();
  };
}

export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!req.user) {
      return next({ status: 401, message: 'Unauthorized' });
    }

    if (!hasPermission(req.user, permission)) {
      if (String(permission || '').startsWith('admin:')) {
        void reportAuthSecurityEvent({
          eventType: 'unauthorized_admin_access',
          ip: req.ip,
          email: req.user?.email || null,
          path: req.originalUrl,
          reason: `Missing permission: ${permission}`,
        });
      }
      return next({ status: 403, message: 'Forbidden' });
    }

    return next();
  };
}
