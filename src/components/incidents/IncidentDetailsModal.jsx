import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import IncidentTimeline from '@/components/incidents/IncidentTimeline';

function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
}

function severityClass(severity) {
  const level = String(severity || '').toLowerCase();
  if (level === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (level === 'warning') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
}

function statusClass(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'resolved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (value === 'acknowledged') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
  return 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100';
}

function JsonBlock({ value }) {
  return (
    <pre className="text-xs rounded-lg border border-border bg-muted/40 p-3 overflow-auto max-h-56">{JSON.stringify(value || {}, null, 2)}</pre>
  );
}

JsonBlock.propTypes = {
  value: PropTypes.any,
};

JsonBlock.defaultProps = {
  value: null,
};

export default function IncidentDetailsModal({
  open,
  incident,
  onOpenChange,
  onAcknowledge,
  onResolve,
  onReopen,
  actionLoading,
}) {
  if (!incident) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl" />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Incident Details
            <Badge className={severityClass(incident.severity)}>{incident.severity || 'info'}</Badge>
            <Badge className={statusClass(incident.status)}>{incident.status || 'open'}</Badge>
          </DialogTitle>
          <DialogDescription className="break-all">{incident.message || '-'}</DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-border p-3 bg-muted/20">
            <p className="text-muted-foreground">Database / View</p>
            <p className="font-medium mt-1">{incident.database || '-'} / {incident.view || '-'}</p>
          </div>
          <div className="rounded-lg border border-border p-3 bg-muted/20">
            <p className="text-muted-foreground">Occurrences</p>
            <p className="font-medium mt-1">{incident.occurrences || 1}</p>
          </div>
          <div className="rounded-lg border border-border p-3 bg-muted/20">
            <p className="text-muted-foreground">First seen</p>
            <p className="font-medium mt-1">{formatDateTime(incident.firstSeen || incident.createdAt)}</p>
          </div>
          <div className="rounded-lg border border-border p-3 bg-muted/20">
            <p className="text-muted-foreground">Last seen</p>
            <p className="font-medium mt-1">{formatDateTime(incident.lastSeen || incident.updatedAt || incident.createdAt)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold">Timeline</h3>
          <IncidentTimeline incident={incident} />
        </div>

        <div className="grid lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border p-4 space-y-2">
            <h3 className="text-sm font-semibold">Escalation History</h3>
            {Array.isArray(incident.escalationHistory) && incident.escalationHistory.length > 0 ? (
              <div className="space-y-2">
                {incident.escalationHistory.map((entry, index) => (
                  <div key={`${entry.at || 'escalation'}-${index}`} className="rounded-lg border border-border p-2 text-xs">
                    <p className="font-medium">Level {entry.level ?? 0}</p>
                    <p className="text-muted-foreground mt-0.5">{formatDateTime(entry.at)}</p>
                    <p className="text-muted-foreground mt-1">{entry.reason || 'unresolved_incident'} {entry.triggeredBy ? `| by ${entry.triggeredBy}` : ''}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No escalation entries recorded.</p>
            )}
          </div>

          <div className="rounded-xl border border-border p-4 space-y-2">
            <h3 className="text-sm font-semibold">Occurrence Log</h3>
            <div className="space-y-2 text-xs">
              <div className="rounded-lg border border-border p-2">
                <p className="font-medium">Created</p>
                <p className="text-muted-foreground">{formatDateTime(incident.createdAt)}</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="font-medium">Last updated</p>
                <p className="text-muted-foreground">{formatDateTime(incident.updatedAt || incident.lastSeen || incident.createdAt)}</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="font-medium">Total occurrences</p>
                <p className="text-muted-foreground">{incident.occurrences || 1}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border p-4 space-y-2">
            <h3 className="text-sm font-semibold">Channel Delivery Logs</h3>
            <JsonBlock value={incident.deliveryStatus} />
          </div>
          <div className="rounded-xl border border-border p-4 space-y-2">
            <h3 className="text-sm font-semibold">Error Details</h3>
            <JsonBlock value={incident.details} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onReopen(incident)}
            disabled={incident.status === 'open' || actionLoading}
          >
            Re-open
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onAcknowledge(incident)}
            disabled={incident.status !== 'open' || actionLoading}
          >
            Acknowledge
          </Button>
          <Button
            type="button"
            onClick={() => onResolve(incident)}
            disabled={incident.status === 'resolved' || actionLoading}
          >
            Resolve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

IncidentDetailsModal.propTypes = {
  open: PropTypes.bool.isRequired,
  incident: PropTypes.shape({
    id: PropTypes.string,
    severity: PropTypes.string,
    status: PropTypes.string,
    message: PropTypes.string,
    database: PropTypes.string,
    view: PropTypes.string,
    occurrences: PropTypes.number,
    firstSeen: PropTypes.string,
    lastSeen: PropTypes.string,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
    escalationHistory: PropTypes.arrayOf(PropTypes.shape({
      level: PropTypes.number,
      at: PropTypes.string,
      reason: PropTypes.string,
      triggeredBy: PropTypes.string,
    })),
    deliveryStatus: PropTypes.object,
    details: PropTypes.any,
  }),
  onOpenChange: PropTypes.func.isRequired,
  onAcknowledge: PropTypes.func.isRequired,
  onResolve: PropTypes.func.isRequired,
  onReopen: PropTypes.func.isRequired,
  actionLoading: PropTypes.bool,
};

IncidentDetailsModal.defaultProps = {
  incident: null,
  actionLoading: false,
};
