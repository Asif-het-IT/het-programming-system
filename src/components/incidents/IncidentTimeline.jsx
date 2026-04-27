import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Badge } from '@/components/ui/badge';

function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
}

function levelClass(level) {
  const value = String(level || '').toLowerCase();
  if (value === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (value === 'warning') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  if (value === 'success') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
}

function buildDeliveryEvents(deliveryStatus, fallbackTime) {
  if (!deliveryStatus || typeof deliveryStatus !== 'object') return [];

  return Object.entries(deliveryStatus).map(([channel, rawValue]) => {
    if (channel === 'routingLogic') {
      return {
        key: `routing-${channel}`,
        at: fallbackTime,
        label: 'Routing decision recorded',
        detail: String(rawValue || ''),
        level: 'info',
      };
    }

    if (rawValue && typeof rawValue === 'object') {
      const status = rawValue.status || rawValue.state || 'processed';
      let level = 'success';
      if (status === 'failed') level = 'critical';
      if (status === 'skipped') level = 'warning';
      const detail = Object.entries(rawValue)
        .filter(([k]) => k !== 'status' && k !== 'state' && k !== 'at')
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join(' | ');

      return {
        key: `delivery-${channel}`,
        at: rawValue.at || fallbackTime,
        label: `${channel} ${status}`,
        detail,
        level,
      };
    }

    return {
      key: `delivery-${channel}`,
      at: fallbackTime,
      label: `${channel} ${String(rawValue)}`,
      detail: '',
      level: String(rawValue).toLowerCase().includes('fail') ? 'critical' : 'success',
    };
  });
}

function buildTimeline(incident) {
  if (!incident) return [];

  const firstSeen = incident.firstSeen || incident.createdAt;
  const lastSeen = incident.lastSeen || incident.updatedAt || incident.createdAt;
  const events = [
    {
      key: 'created',
      at: firstSeen,
      label: `Incident created (${incident.severity || 'info'})`,
      detail: incident.message || 'New incident recorded',
      level: incident.severity || 'info',
    },
  ];

  const occurrences = Number(incident.occurrences || 1);
  if (occurrences > 1) {
    events.push({
      key: 'occurrences',
      at: lastSeen,
      label: `Occurrence +${occurrences - 1}`,
      detail: `Total occurrences: ${occurrences}`,
      level: 'warning',
    });
  }

  const escalationHistory = Array.isArray(incident.escalationHistory) ? incident.escalationHistory : [];
  escalationHistory.forEach((entry, index) => {
    const reason = entry.reason || incident.escalationReason || 'unresolved_incident';
    const triggeredBy = entry.triggeredBy ? ` | by: ${entry.triggeredBy}` : '';
    events.push({
      key: `escalation-${index}`,
      at: entry.at || incident.lastEscalatedAt || lastSeen,
      label: `Escalated to level ${entry.level ?? incident.escalationLevel ?? 0}`,
      detail: `reason: ${reason}${triggeredBy}`,
      level: 'critical',
    });
  });

  buildDeliveryEvents(incident.deliveryStatus, incident.updatedAt || lastSeen).forEach((event) => events.push(event));

  if (incident.acknowledgedAt) {
    events.push({
      key: 'acknowledged',
      at: incident.acknowledgedAt,
      label: 'Incident acknowledged',
      detail: incident.acknowledgedBy ? `by ${incident.acknowledgedBy}` : '',
      level: 'info',
    });
  }

  if (incident.resolvedAt) {
    events.push({
      key: 'resolved',
      at: incident.resolvedAt,
      label: 'Incident resolved',
      detail: incident.resolvedBy ? `by ${incident.resolvedBy}` : '',
      level: 'success',
    });
  }

  return events
    .map((event) => ({
      ...event,
      sortTs: event.at ? new Date(event.at).getTime() : 0,
    }))
    .sort((a, b) => a.sortTs - b.sortTs);
}

export default function IncidentTimeline({ incident }) {
  const timeline = useMemo(() => buildTimeline(incident), [incident]);

  if (!timeline.length) {
    return <div className="text-xs text-muted-foreground">No timeline data available.</div>;
  }

  return (
    <div className="space-y-3">
      {timeline.map((event) => (
        <div key={event.key} className="flex items-start gap-3">
          <div className="mt-2 h-2 w-2 rounded-full bg-primary" />
          <div className="flex-1 pb-3 border-l border-border pl-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">[{formatDateTime(event.at)}]</span>
              <Badge className={levelClass(event.level)}>{event.level}</Badge>
            </div>
            <p className="text-sm font-medium mt-1">{event.label}</p>
            {event.detail ? <p className="text-xs text-muted-foreground mt-1 break-all">{event.detail}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

IncidentTimeline.propTypes = {
  incident: PropTypes.shape({
    severity: PropTypes.string,
    message: PropTypes.string,
    firstSeen: PropTypes.string,
    createdAt: PropTypes.string,
    lastSeen: PropTypes.string,
    updatedAt: PropTypes.string,
    occurrences: PropTypes.number,
    escalationLevel: PropTypes.number,
    escalationReason: PropTypes.string,
    escalationHistory: PropTypes.arrayOf(PropTypes.shape({
      level: PropTypes.number,
      at: PropTypes.string,
      reason: PropTypes.string,
      triggeredBy: PropTypes.string,
    })),
    deliveryStatus: PropTypes.object,
    acknowledgedAt: PropTypes.string,
    acknowledgedBy: PropTypes.string,
    resolvedAt: PropTypes.string,
    resolvedBy: PropTypes.string,
  }),
};

IncidentTimeline.defaultProps = {
  incident: null,
};
