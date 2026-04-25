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

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    await initUsers();
    const user = await verifyCredentials(req.body.email, req.body.password);

    if (!user) {
      return next({ status: 401, message: 'Invalid credentials' });
    }

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      databases: user.databases,
      views: user.views,
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
      return next({ status: 401, message: 'Invalid refresh token' });
    }

    const accessToken = signAccessToken({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      databases: payload.databases,
      views: payload.views,
    });

    res.json({ accessToken });
  } catch (error) {
    next({ status: 401, message: 'Refresh token expired or invalid' });
  }
});

export default router;
