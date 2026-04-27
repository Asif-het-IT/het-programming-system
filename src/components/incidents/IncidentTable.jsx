import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, CheckCircle2, RotateCcw } from 'lucide-react';

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

export default function IncidentTable({
  incidents,
  currentPage,
  totalPages,
  pageSize,
  selectedIds,
  allPageSelected,
  onToggleSelectAllPage,
  onToggleIncidentSelection,
  onPageChange,
  onSelectIncident,
  onAcknowledge,
  onResolve,
  onReopen,
  actionLoadingId,
}) {
  const pageStart = incidents.length ? ((currentPage - 1) * pageSize) + 1 : 0;
  const pageEnd = ((currentPage - 1) * pageSize) + incidents.length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold">Incident Queue</h2>
        <div className="text-xs text-muted-foreground">
          Showing {pageStart}-{pageEnd}
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">No incidents found for current filters.</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-xs">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={(event) => onToggleSelectAllPage(event.target.checked)}
                    aria-label="Select all incidents on current page"
                  />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Incident</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Severity</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Occurrences</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">First Seen</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Last Seen</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Scope</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {incidents.map((incident) => (
                <tr key={incident.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(incident.id)}
                      onChange={(event) => onToggleIncidentSelection(incident.id, event.target.checked)}
                      aria-label={`Select incident ${incident.id}`}
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="text-sm font-medium max-w-[280px] truncate">{incident.message || '-'}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {incident.type || 'incident'} {incident.incidentKey ? `• ${incident.incidentKey.slice(0, 12)}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Badge className={severityClass(incident.severity)}>{incident.severity || 'info'}</Badge>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Badge className={statusClass(incident.status)}>{incident.status || 'open'}</Badge>
                  </td>
                  <td className="px-4 py-3 align-top font-medium">{incident.occurrences || 1}</td>
                  <td className="px-4 py-3 align-top">{formatDateTime(incident.firstSeen || incident.createdAt)}</td>
                  <td className="px-4 py-3 align-top">{formatDateTime(incident.lastSeen || incident.updatedAt || incident.createdAt)}</td>
                  <td className="px-4 py-3 align-top">
                    <p>{incident.database || '-'}</p>
                    <p className="text-[11px] text-muted-foreground">{incident.view || '-'}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => onSelectIncident(incident)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => onAcknowledge(incident)}
                        disabled={incident.status !== 'open' || actionLoadingId === incident.id}
                      >
                        Ack
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => onResolve(incident)}
                        disabled={incident.status === 'resolved' || actionLoadingId === incident.id}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => onReopen(incident)}
                        disabled={incident.status === 'open' || actionLoadingId === incident.id}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Re-open
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage <= 1}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground px-1">Page {currentPage} / {totalPages}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

IncidentTable.propTypes = {
  incidents: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    message: PropTypes.string,
    type: PropTypes.string,
    incidentKey: PropTypes.string,
    severity: PropTypes.string,
    status: PropTypes.string,
    occurrences: PropTypes.number,
    firstSeen: PropTypes.string,
    lastSeen: PropTypes.string,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
    database: PropTypes.string,
    view: PropTypes.string,
  })).isRequired,
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  selectedIds: PropTypes.arrayOf(PropTypes.string),
  allPageSelected: PropTypes.bool,
  onToggleSelectAllPage: PropTypes.func.isRequired,
  onToggleIncidentSelection: PropTypes.func.isRequired,
  onPageChange: PropTypes.func.isRequired,
  onSelectIncident: PropTypes.func.isRequired,
  onAcknowledge: PropTypes.func.isRequired,
  onResolve: PropTypes.func.isRequired,
  onReopen: PropTypes.func.isRequired,
  actionLoadingId: PropTypes.string,
};

IncidentTable.defaultProps = {
  selectedIds: [],
  allPageSelected: false,
  actionLoadingId: '',
};
