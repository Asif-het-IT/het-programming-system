/**
 * Channel Retry Service
 * Implements exponential backoff retry logic for failed alert deliveries
 * Tracks retry attempts and manages retry scheduling
 */

import { appendDeliveryStatus, findAlertById } from '../data/alertsStore.js';

const RETRY_CONFIG = {
  telegram: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  email: {
    maxRetries: 5,
    initialDelayMs: 2000,
    maxDelayMs: 60000,
    backoffMultiplier: 1.5,
  },
  push: {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  },
};

const retryQueues = new Map(); // alertId -> { channel -> retryState }

function calculateBackoffDelay(attemptCount, channelConfig) {
  const delayMs = Math.min(
    channelConfig.initialDelayMs * Math.pow(channelConfig.backoffMultiplier, attemptCount - 1),
    channelConfig.maxDelayMs,
  );
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delayMs;
  return Math.floor(delayMs + jitter);
}

/**
 * Track a delivery failure and schedule retry if applicable
 */
export async function handleDeliveryFailure(alertId, channel, error) {
  if (!RETRY_CONFIG[channel]) return { retryScheduled: false };

  const alert = findAlertById(alertId);
  if (!alert) return { retryScheduled: false };

  const config = RETRY_CONFIG[channel];
  const queueKey = alertId;
  const queue = retryQueues.get(queueKey) || {};
  const channelRetry = queue[channel] || { attempts: 0, lastError: null };

  channelRetry.attempts += 1;
  channelRetry.lastError = error?.message || String(error);

  if (channelRetry.attempts > config.maxRetries) {
    // Max retries exceeded, mark as permanently failed
    appendDeliveryStatus(alertId, {
      [channel]: {
        status: 'failed_permanent',
        reason: 'max_retries_exceeded',
        attempts: channelRetry.attempts,
        lastError: channelRetry.lastError,
      },
    });

    queue[channel] = undefined;
    if (Object.values(queue).every((v) => !v)) {
      retryQueues.delete(queueKey);
    }

    return { retryScheduled: false, maxRetriesExceeded: true };
  }

  const delayMs = calculateBackoffDelay(channelRetry.attempts, config);
  const retryAt = Date.now() + delayMs;

  // Schedule retry
  const timeoutHandle = setTimeout(
    () => retryDelivery(alertId, channel),
    delayMs,
  );

  channelRetry.nextRetryAt = retryAt;
  channelRetry.timeoutHandle = timeoutHandle;

  queue[channel] = channelRetry;
  retryQueues.set(queueKey, queue);

  // Update delivery status to show retry scheduled
  appendDeliveryStatus(alertId, {
    [channel]: {
      status: 'retry_scheduled',
      attempts: channelRetry.attempts,
      nextRetryAt: new Date(retryAt).toISOString(),
      lastError: channelRetry.lastError,
    },
  });

  return { retryScheduled: true, delayMs, attempts: channelRetry.attempts };
}

/**
 * Retry a failed delivery
 */
async function retryDelivery(alertId, channel) {
  const alert = findAlertById(alertId);
  if (!alert) return;

  // Import here to avoid circular dependency
  const { deliverAlert } = await import('./alertDelivery.js');

  try {
    const result = await deliverAlert(alert, { [channel]: true }, alert.recipients || []);
    const channelResult = result[channel];

    if (channelResult?.status === 'sent') {
      // Success! Update delivery status
      appendDeliveryStatus(alertId, {
        [channel]: {
          ...channelResult,
          retryCount: retryQueues.get(alertId)?.[channel]?.attempts || 0,
        },
      });

      // Clean up retry queue
      const queue = retryQueues.get(alertId);
      if (queue) {
        queue[channel] = undefined;
        if (Object.values(queue).every((v) => !v)) {
          retryQueues.delete(alertId);
        }
      }
    } else {
      // Retry failed, reschedule
      await handleDeliveryFailure(alertId, channel, new Error(channelResult?.reason || 'Unknown error'));
    }
  } catch (error) {
    await handleDeliveryFailure(alertId, channel, error);
  }
}

/**
 * Cancel retry for a channel
 */
export function cancelRetry(alertId, channel) {
  const queue = retryQueues.get(alertId);
  if (!queue || !queue[channel]) return;

  clearTimeout(queue[channel].timeoutHandle);
  queue[channel] = undefined;

  if (Object.values(queue).every((v) => !v)) {
    retryQueues.delete(alertId);
  }
}

/**
 * Get retry status for an alert
 */
export function getRetryStatus(alertId) {
  const queue = retryQueues.get(alertId);
  if (!queue) return null;

  const status = {};
  for (const [channel, retry] of Object.entries(queue)) {
    if (retry) {
      status[channel] = {
        attempts: retry.attempts,
        nextRetryAt: retry.nextRetryAt ? new Date(retry.nextRetryAt).toISOString() : null,
        lastError: retry.lastError,
      };
    }
  }

  return Object.keys(status).length > 0 ? status : null;
}

/**
 * Get retry config for monitoring
 */
export function getRetryConfig() {
  return RETRY_CONFIG;
}
