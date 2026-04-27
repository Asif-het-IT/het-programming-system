import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { reportRateLimitEvent } from '../services/alertService.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

/**
 * Normalize client IP for rate-limit key generation.
 * Strips IPv4-mapped IPv6 prefix (::ffff:) and falls back through
 * x-forwarded-for → 'unknown' so the keyGenerator never throws.
 */
function normalizeClientIp(req) {
  const raw =
    req.ip ||
    String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown';
  // Remove IPv4-mapped IPv6 prefix so ::ffff:127.0.0.1 → 127.0.0.1
  return raw.replace(/^::ffff:/i, '') || 'unknown';
}

function buildRateLimitKey(req) {
  return ipKeyGenerator(normalizeClientIp(req));
}

function buildLimitHandler(scope) {
  return (req, res) => {
    const resetSeconds = Math.max(1, Math.ceil((req.rateLimit?.resetTime?.getTime?.() || Date.now()) / 1000 - Date.now() / 1000));
    void reportRateLimitEvent({
      scope,
      ip: req.ip,
      path: req.originalUrl,
      user: req.user?.email || null,
    });

    res.setHeader('Retry-After', String(resetSeconds));
    res.status(429).json({
      error: 'Too many requests. Please retry shortly.',
      scope,
      retryAfterSeconds: resetSeconds,
    });
  };
}

export const globalLimiter = rateLimit({
  windowMs: toPositiveInt(process.env.API_RATE_LIMIT_WINDOW_MS, FIFTEEN_MINUTES_MS),
  max: toPositiveInt(process.env.API_RATE_LIMIT_MAX, 2000),
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  keyGenerator: buildRateLimitKey,
  handler: buildLimitHandler('global'),
  skip: (req) => req.path === '/api/health',
});

export const adminReadLimiter = rateLimit({
  windowMs: toPositiveInt(process.env.API_ADMIN_READ_LIMIT_WINDOW_MS, TEN_MINUTES_MS),
  max: toPositiveInt(process.env.API_ADMIN_READ_LIMIT_MAX, 600),
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  keyGenerator: buildRateLimitKey,
  handler: buildLimitHandler('admin-read'),
});

export const adminWriteLimiter = rateLimit({
  windowMs: toPositiveInt(process.env.API_ADMIN_WRITE_LIMIT_WINDOW_MS, TEN_MINUTES_MS),
  max: toPositiveInt(process.env.API_ADMIN_WRITE_LIMIT_MAX, 240),
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  keyGenerator: buildRateLimitKey,
  handler: buildLimitHandler('admin-write'),
});

export const authLimiter = rateLimit({
  windowMs: toPositiveInt(process.env.API_AUTH_LIMIT_WINDOW_MS, TEN_MINUTES_MS),
  max: toPositiveInt(process.env.API_AUTH_LIMIT_MAX, 50),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: buildRateLimitKey,
  handler: buildLimitHandler('auth'),
});
