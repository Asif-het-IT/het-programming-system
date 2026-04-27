import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { loginSchema, refreshSchema } from './schemas.js';
import {
  initUsers,
  verifyCredentials,
  hasRefreshToken,
  upsertRefreshToken,
} from '../data/users.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { reportAuthSecurityEvent } from '../services/alertService.js';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    await initUsers();
    const user = await verifyCredentials(req.body.email, req.body.password);

    if (!user) {
      void reportAuthSecurityEvent({
        eventType: 'failed_login',
        ip: req.ip,
        email: req.body?.email || null,
        path: req.originalUrl,
        reason: 'Invalid credentials',
      });
      return next({ status: 401, message: 'Invalid credentials' });
    }

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      databases: user.databases,
      views: user.views,
      permissions: user.permissions,
      quota: user.quota,
      allowedColumns: user.allowedColumns,
      allowedColumnsByView: user.allowedColumnsByView,
      allowedFilterColumnsByView: user.allowedFilterColumnsByView,
      filterValueRulesByView: user.filterValueRulesByView,
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);
    upsertRefreshToken(user.id, refreshToken);

    res.json({ user, accessToken, refreshToken });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', authLimiter, validate(refreshSchema), async (req, res, next) => {
  try {
    const payload = verifyRefreshToken(req.body.refreshToken);

    if (!hasRefreshToken(payload.sub, req.body.refreshToken)) {
      void reportAuthSecurityEvent({
        eventType: 'invalid_refresh_token',
        ip: req.ip,
        email: payload.email || null,
        path: req.originalUrl,
        reason: 'Refresh token not found in active session store',
      });
      return next({ status: 401, message: 'Invalid refresh token' });
    }

    const accessToken = signAccessToken({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      databases: payload.databases,
      views: payload.views,
      permissions: payload.permissions,
      quota: payload.quota,
      allowedColumns: payload.allowedColumns,
      allowedColumnsByView: payload.allowedColumnsByView,
      allowedFilterColumnsByView: payload.allowedFilterColumnsByView,
      filterValueRulesByView: payload.filterValueRulesByView,
    });

    res.json({ accessToken });
  } catch {
    void reportAuthSecurityEvent({
      eventType: 'invalid_refresh_token',
      ip: req.ip,
      email: req.body?.email || null,
      path: req.originalUrl,
      reason: 'Refresh token expired or invalid',
    });
    next({ status: 401, message: 'Refresh token expired or invalid' });
  }
});

export default router;
