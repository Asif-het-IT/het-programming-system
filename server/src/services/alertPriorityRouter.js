/**
 * Alert Priority Router
 * Routes alerts to delivery channels based on severity and alert type
 * Ensures critical alerts reach all channels while less urgent alerts are routed more conservatively
 */

/**
 * Priority routing rules define which channels should receive alerts by severity
 */
const PRIORITY_ROUTING_RULES = {
  // Critical alerts go to ALL channels
  critical: {
    channels: {
      adminPanel: true,
      console: true,
      telegram: true,
      email: true,
      push: true,
    },
    description: 'All channels - immediate escalation required',
    routing: 'maximum',
  },

  // Warning alerts go to Admin Panel, Email, and Telegram
  warning: {
    channels: {
      adminPanel: true,
      console: true,
      telegram: true,
      email: true,
      push: false, // Push is noisy for warnings
    },
    description: 'Tier 1 channels - admin notification',
    routing: 'standard',
  },

  // Info alerts are limited to Admin Panel and Console
  info: {
    channels: {
      adminPanel: true,
      console: true,
      telegram: false,
      email: false,
      push: false,
    },
    description: 'Internal logging only',
    routing: 'minimal',
  },
};

/**
 * Type-specific routing overrides - certain alert types have special handling
 */
const TYPE_SPECIFIC_ROUTING = {
  // Security events always critical path
  auth_security: {
    minSeverity: 'critical',
    channels: { telegram: true, email: true, push: true, adminPanel: true },
    reason: 'Security-relevant events require immediate notification',
  },

  // Data isolation violations are critical
  data_isolation: {
    minSeverity: 'critical',
    channels: { telegram: true, email: true, push: true, adminPanel: true },
    reason: 'Data access violations require immediate escalation',
  },

  // Sync failures are elevated
  sync_failure: {
    minSeverity: 'warning',
    channels: { email: true, telegram: true, adminPanel: true },
    reason: 'Data sync issues affect system integrity',
  },

  // Performance alerts are routed by severity
  performance: {
    minSeverity: 'info',
    // Uses standard severity routing
    reason: 'Performance issues routed by severity',
  },

  // Rate limits are warnings
  rate_limit: {
    minSeverity: 'warning',
    channels: { email: true, telegram: true, adminPanel: true },
    reason: 'Rate limit events indicate possible attack or misconfiguration',
  },

  sync_delay: {
    minSeverity: 'warning',
    channels: { email: true, telegram: true, adminPanel: true },
    reason: 'Sync delay breaches impact freshness and should notify operators',
  },

  slo_breach: {
    minSeverity: 'warning',
    channels: { email: true, telegram: true, adminPanel: true },
    reason: 'SLO breaches require operational attention',
  },

  incident_escalation: {
    minSeverity: 'critical',
    channels: { telegram: true, email: true, push: true, adminPanel: true },
    reason: 'Unresolved incidents are escalated to all channels',
  },
};

/**
 * Determine which channels should receive this alert
 */
export function determineChannels(alert, userSettings = {}) {
  const severity = String(alert.severity || 'info').toLowerCase();
  const alertType = String(alert.type || 'performance').toLowerCase();

  let channels = { ...PRIORITY_ROUTING_RULES[severity]?.channels };

  // Apply type-specific overrides
  const typeRule = TYPE_SPECIFIC_ROUTING[alertType];
  if (typeRule) {
    // Ensure severity is at least minSeverity
    const severityHierarchy = { info: 1, warning: 2, critical: 3 };
    const currentLevel = severityHierarchy[severity] || 1;
    const minLevel = severityHierarchy[typeRule.minSeverity] || 1;

    if (currentLevel < minLevel) {
      // Upgrade routing for this type
      const upgradedSeverity = typeRule.minSeverity;
      channels = { ...PRIORITY_ROUTING_RULES[upgradedSeverity]?.channels };
    }

    // Apply type-specific channel overrides
    if (typeRule.channels) {
      channels = { ...channels, ...typeRule.channels };
    }
  }

  // Apply user settings overrides
  if (userSettings && typeof userSettings === 'object') {
    channels = { ...channels, ...userSettings };
  }

  return channels;
}

/**
 * Get routing explanation for audit/debugging
 */
export function getRoutingExplanation(alert, appliedChannels) {
  const severity = String(alert.severity || 'info').toLowerCase();
  const alertType = String(alert.type || 'performance').toLowerCase();

  const severityRule = PRIORITY_ROUTING_RULES[severity];
  const typeRule = TYPE_SPECIFIC_ROUTING[alertType];

  const explanations = [];

  if (severityRule) {
    explanations.push(`Severity [${severity}]: ${severityRule.description}`);
  }

  if (typeRule) {
    explanations.push(`Type [${alertType}]: ${typeRule.reason}`);
  }

  const activeChannels = Object.entries(appliedChannels)
    .filter(([_, enabled]) => enabled)
    .map(([channel]) => channel);

  explanations.push(`Routed to: ${activeChannels.join(', ')}`);

  return {
    severity,
    type: alertType,
    baseRouting: severityRule?.routing,
    typeOverride: typeRule?.reason,
    activeChannels,
    explanation: explanations.join(' → '),
  };
}

/**
 * Get all available routing configurations for documentation
 */
export function getRoutingConfiguration() {
  return {
    severityRules: PRIORITY_ROUTING_RULES,
    typeRules: TYPE_SPECIFIC_ROUTING,
    description: 'Alert routing is severity-first with type-specific overrides for security and data integrity events',
  };
}

/**
 * Check if a channel should be active for an alert based on priority routing
 */
export function shouldRouteToChannel(alert, channel, userSettings = {}) {
  const channels = determineChannels(alert, userSettings);
  return Boolean(channels[channel]);
}
