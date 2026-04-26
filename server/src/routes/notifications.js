import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { saveSubscription, removeSubscription, touchSubscription } from '../data/pushSubscriptions.js';
import { env } from '../config/env.js';

const router = Router();

// Return public VAPID key so frontend can subscribe
router.get('/notifications/vapid-public-key', (_req, res) => {
  const key = env.webPushPublicKey || '';
  if (!key) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  return res.json({ publicKey: key });
});

// Subscribe current user
router.post('/notifications/subscribe', requireAuth, (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) {
      return next({ status: 400, message: 'Invalid subscription object' });
    }

    saveSubscription({
      email: req.user.email,
      role: req.user.role,
      subscription,
    });

    return res.json({ subscribed: true });
  } catch (error) {
    return next(error);
  }
});

// Unsubscribe current user's endpoint
router.post('/notifications/unsubscribe', requireAuth, (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return next({ status: 400, message: 'Missing endpoint' });
    }
    removeSubscription(endpoint);
    return res.json({ unsubscribed: true });
  } catch (error) {
    return next(error);
  }
});

// Heartbeat — update lastSeen for an active subscription
router.post('/notifications/heartbeat', requireAuth, (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) touchSubscription(endpoint);
  return res.json({ ok: true });
});

export default router;
