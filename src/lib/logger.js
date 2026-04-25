/**
 * Enterprise-grade logging system
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
};

let currentLevel = LOG_LEVELS.INFO;
let logs = [];
const MAX_LOGS = 500;

export const Logger = {
  setLevel: (level) => {
    currentLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  },

  debug: (message, data = {}) => {
    if (LOG_LEVELS.DEBUG >= currentLevel) {
      logEvent('DEBUG', message, data);
    }
  },

  info: (message, data = {}) => {
    if (LOG_LEVELS.INFO >= currentLevel) {
      logEvent('INFO', message, data);
    }
  },

  warn: (message, data = {}) => {
    if (LOG_LEVELS.WARN >= currentLevel) {
      logEvent('WARN', message, data);
      console.warn(`[WARN] ${message}`, data);
    }
  },

  error: (message, error = null, data = {}) => {
    if (LOG_LEVELS.ERROR >= currentLevel) {
      const errorData = {
        ...data,
        message: error?.message,
        stack: error?.stack?.split('\n').slice(0, 5).join('\n')
      };
      logEvent('ERROR', message, errorData);
      console.error(`[ERROR] ${message}`, error, data);
    }
  },

  critical: (message, error = null, data = {}) => {
    if (LOG_LEVELS.CRITICAL >= currentLevel) {
      const errorData = {
        ...data,
        message: error?.message,
        stack: error?.stack
      };
      logEvent('CRITICAL', message, errorData);
      console.error(`[CRITICAL] ${message}`, error, data);
    }
  },

  getLogs: (filter = {}) => {
    let result = [...logs];
    if (filter.level) {
      result = result.filter(l => l.level === filter.level);
    }
    if (filter.since) {
      result = result.filter(l => l.timestamp >= filter.since);
    }
    return result;
  },

  exportLogs: () => {
    return JSON.stringify(logs, null, 2);
  },

  clearLogs: () => {
    logs = [];
  },

  downloadLogs: () => {
    const data = Logger.exportLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

function logEvent(level, message, data = {}) {
  const logEntry = {
    level,
    message,
    data: sanitizeData(data),
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  };

  logs.push(logEntry);

  // Keep max logs
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(-MAX_LOGS);
  }

  // Also store in localStorage for persistence
  try {
    const existing = JSON.parse(localStorage.getItem('progdb_logs') || '[]');
    existing.push(logEntry);
    if (existing.length > 100) {
      existing.shift();
    }
    localStorage.setItem('progdb_logs', JSON.stringify(existing));
  } catch {
    // Ignore localStorage errors
  }
}

function sanitizeData(data) {
  const sanitized = { ...data };
  const sensitiveKeys = ['password', 'token', 'secret', 'api_token', 'authorization'];
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '***REDACTED***';
    }
  });

  return sanitized;
}

// Auto-log performance metrics
export function logPerformanceMetrics() {
  if (typeof window !== 'undefined' && window.performance) {
    try {
      const nav = window.performance.getEntriesByType('navigation')[0];
      if (nav) {
        Logger.info('Page Load Performance', {
          domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
          loadComplete: nav.loadEventEnd - nav.loadEventStart,
          domInteractive: nav.domInteractive - nav.fetchStart
        });
      }
    } catch (err) {
      Logger.debug('Could not log performance metrics', { error: err.message });
    }
  }
}

// Setup global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    Logger.error('Uncaught Error', event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    Logger.error('Unhandled Promise Rejection', event.reason);
  });
}
