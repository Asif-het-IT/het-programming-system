import { createMonitoringAlert } from './alertService.js';


export async function notifySyncFailure({ database, view = '', layer = 'gas', error = '', requestUrl = null }) {
  const response = await createMonitoringAlert({
    type: 'sync_failure',
    severity: 'critical',
    sourceModule: 'sync-monitor',
    database,
    view,
    message: `Data sync failed on ${database || 'UNKNOWN'} (${layer})`,
    details: {
      layer,
      error: String(error || ''),
      requestUrl,
    },
    signature: `sync_failure::${database}::${view}::${layer}::${String(error || '').slice(0, 120)}`,
    channels: {
      push: true,
      email: true,
      telegram: true,
    },
  });

  return {
    notified: response.created === true,
    reason: response.reason || null,
    alertId: response.alert?.id || null,
  };
}