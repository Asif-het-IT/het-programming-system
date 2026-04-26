import webpush from 'web-push';
import { env } from '../config/env.js';
import { removeExpiredSubscriptions } from '../data/pushSubscriptions.js';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  if (!env.webPushPublicKey || !env.webPushPrivateKey) {
    // eslint-disable-next-line no-console
    console.warn('[push] VAPID keys not configured — push notifications disabled');
    return;
  }
  webpush.setVapidDetails(
    env.webPushSubject || 'mailto:admin@example.com',
    env.webPushPublicKey,
    env.webPushPrivateKey,
  );
  vapidConfigured = true;
}

export function isVapidReady() {
  ensureVapid();
  return vapidConfigured;
}

export async function sendPushToSubscriptions(subscriptions, payload) {
  ensureVapid();
  if (!vapidConfigured) {
    return { delivered: 0, failed: 0, expiredEndpoints: [] };
  }

  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payloadStr,
        { TTL: 86400 },
      ),
    ),
  );

  const expiredEndpoints = [];
  let delivered = 0;
  let failed = 0;

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      delivered += 1;
    } else {
      const statusCode = result.reason?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        expiredEndpoints.push(subscriptions[index].endpoint);
      }
      failed += 1;
    }
  });

  if (expiredEndpoints.length > 0) {
    removeExpiredSubscriptions(expiredEndpoints);
  }

  return { delivered, failed, expiredEndpoints };
}
