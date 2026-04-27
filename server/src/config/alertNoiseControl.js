/**
 * Alert Noise Control Configuration
 * Defines which endpoints and patterns should be excluded from triggering alerts
 * to prevent alert fatigue and focus on real issues.
 */

export const NOISE_CONTROL_CONFIG = {
  // Paths that should be completely excluded from all monitoring
  excludedPaths: [
    /retry-sync/i,           // Internal sync retry endpoints
    /\/alerts\//i,           // Alert management endpoints themselves
    /healthz/i,              // Health check endpoints
    /health/i,               // Health probe endpoints
    /heartbeat/i,            // Heartbeat/keepalive endpoints
    /ping/i,                 // Ping endpoints
    /metrics/i,              // Metrics collection endpoints
    /favicon/i,              // Static assets
    /static\//i,             // Static file serving
    /\.js$/i,                // JavaScript file requests
    /\.css$/i,               // CSS file requests
    /\.png$/i,               // Image requests
    /\.jpg$/i,
    /\.gif$/i,
    /\.woff/i,               // Font files
  ],

  // Performance thresholds by route pattern
  // Allows fine-grained control over when performance alerts trigger
  performanceThresholdsByPattern: {
    // High-volume data endpoints get higher thresholds
    '/api/data': 5000,
    '/api/views': 4000,
    '/api/exports': 8000,
    
    // Batch operations get higher thresholds
    '/api/batch': 10000,
    '/api/sync': 15000,
    
    // Authentication operations should be fast
    '/api/auth': 1000,
    '/api/login': 2000,
    
    // Default for unlisted endpoints
    'default': 3000,
  },

  // Routes that should only generate warnings, never critical
  warningOnlyPaths: [
    /external-api/i,         // Calls to external APIs may be slow due to network
    /third-party/i,
    /webhook/i,              // Webhooks may have variable latency
  ],

  // Rate limit exceptions - paths that should have higher limits
  rateLimitExceptions: {
    '/api/auth/login': { limit: 3, windowMs: 15 * 60 * 1000 },  // 3 attempts per 15 min
    '/api/data/download': { limit: 10, windowMs: 60 * 60 * 1000 }, // 10 downloads per hour
  },

  // Alert grouping rules - combine related alerts to reduce noise
  alertGrouping: {
    enabled: true,
    // Group similar alerts within this window
    windowMs: 5 * 60 * 1000, // 5 minutes
    // Maximum number of similar alerts to show before grouping
    groupThreshold: 3,
  },

  // Severity downgrade rules - reduce alert severity in certain contexts
  severityDowngrades: {
    // Performance alerts on specific paths are warnings, not critical
    '/api/data/export': 'warning',
    '/api/reports/generate': 'warning',
  },
};

/**
 * Check if a path should be excluded from alert generation
 */
export function shouldExcludePath(path) {
  const normalizedPath = String(path || '').toLowerCase().trim();
  return NOISE_CONTROL_CONFIG.excludedPaths.some((pattern) => pattern.test(normalizedPath));
}

/**
 * Get performance threshold for a specific path
 */
export function getPerformanceThreshold(path) {
  const normalizedPath = String(path || '').toLowerCase().trim();
  
  // Check for exact pattern matches
  for (const [pattern, threshold] of Object.entries(
    NOISE_CONTROL_CONFIG.performanceThresholdsByPattern
  )) {
    if (pattern === 'default') continue;
    if (normalizedPath.includes(pattern)) {
      return threshold;
    }
  }
  
  return NOISE_CONTROL_CONFIG.performanceThresholdsByPattern.default || 3000;
}

/**
 * Check if a path should only generate warnings
 */
export function shouldWarningOnly(path) {
  const normalizedPath = String(path || '').toLowerCase().trim();
  return NOISE_CONTROL_CONFIG.warningOnlyPaths.some((pattern) => pattern.test(normalizedPath));
}

/**
 * Get severity override for a path (if any)
 */
export function getSeverityOverride(path) {
  const normalizedPath = String(path || '').toLowerCase().trim();
  for (const [pattern, severity] of Object.entries(NOISE_CONTROL_CONFIG.severityDowngrades)) {
    if (normalizedPath.includes(pattern)) {
      return severity;
    }
  }
  return null;
}
