import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, ShieldAlert, Activity, Siren } from 'lucide-react';
import {
  bulkUpdateAdminAlertStatusRequest,
  getAdminAlertsRequest,
  getMonitoringChannelsRequest,
  getMonitoringDashboardRequest,
  getMonitoringHealthRequest,
  getMonitoringRetriesRequest,
  getMonitoringSloStatusRequest,
  updateAdminAlertStatusRequest,
} from '@/api/enterpriseApi';
import IncidentFilters from '@/components/incidents/IncidentFilters';
import IncidentTable from '@/components/incidents/IncidentTable';
import IncidentDetailsModal from '@/components/incidents/IncidentDetailsModal';
import IncidentAnalyticsDashboard from '@/components/incidents/IncidentAnalyticsDashboard';

const DEFAULT_FILTERS = {
  search: '',
  severity: '',
  status: '',
  database: '',
  timeRange: 'all',
};

const PAGE_SIZE = 12;

function retainSelectedIds(previous, alerts) {
  const existing = new Set((alerts || []).map((item) => item.id));
  return (previous || []).filter((id) => existing.has(id));
}

function buildServerQuery(filters) {
  return {
    severity: filters.severity || undefined,
    status: filters.status || undefined,
    database: filters.database || undefined,
    timeRange: filters.timeRange || undefined,
    search: filters.search || undefined,
    limit: 20000,
  };
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

StatCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  hint: PropTypes.string.isRequired,
};

export default function AdminIncidents() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [health, setHealth] = useState(null);
  const [channels, setChannels] = useState(null);
  const [retries, setRetries] = useState(null);
  const [sloStatus, setSloStatus] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [selectedIncidentIds, setSelectedIncidentIds] = useState([]);
  const [serverTotal, setServerTotal] = useState(0);

  const loadData = async (nextFilters = filters) => {
    setLoading(true);
    setFeedback({ type: '', text: '' });

    try {
      const alertQuery = buildServerQuery(nextFilters);
      const [alertsRes, dashboardRes, healthRes, channelsRes, retriesRes, sloRes] = await Promise.allSettled([
        getAdminAlertsRequest(alertQuery),
        getMonitoringDashboardRequest(),
        getMonitoringHealthRequest(),
        getMonitoringChannelsRequest(),
        getMonitoringRetriesRequest(),
        getMonitoringSloStatusRequest(),
      ]);

      if (alertsRes.status === 'fulfilled') {
        const serverAlerts = Array.isArray(alertsRes.value?.alerts) ? alertsRes.value.alerts : [];
        setAlerts(serverAlerts);
        setSelectedIncidentIds((previous) => retainSelectedIds(previous, serverAlerts));
        setServerTotal(Number(alertsRes.value?.total || serverAlerts.length || 0));
        setStats(alertsRes.value?.stats || null);
      }
      if (dashboardRes.status === 'fulfilled') setDashboard(dashboardRes.value || null);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value || null);
      if (channelsRes.status === 'fulfilled') setChannels(channelsRes.value || null);
      if (retriesRes.status === 'fulfilled') setRetries(retriesRes.value || null);
      if (sloRes.status === 'fulfilled') setSloStatus(sloRes.value || null);

      if (alertsRes.status === 'rejected') {
        setFeedback({ type: 'error', text: alertsRes.reason?.message || 'Failed to load incidents' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      loadData(filters);
    }, 200);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const databases = useMemo(() => {
    const unique = new Set(alerts.map((item) => item.database).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [alerts]);

  const totalPages = Math.max(1, Math.ceil(alerts.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedIncidents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return alerts.slice(start, start + PAGE_SIZE);
  }, [alerts, currentPage]);

  const selectedIncident = useMemo(
    () => alerts.find((item) => item.id === selectedIncidentId) || null,
    [alerts, selectedIncidentId],
  );

  const updateIncidentInState = (updatedIncident) => {
    setAlerts((previous) => previous.map((item) => (item.id === updatedIncident.id ? updatedIncident : item)));
  };

  const updateIncidentsInState = (updatedIncidents) => {
    const updates = new Map((Array.isArray(updatedIncidents) ? updatedIncidents : []).map((item) => [item.id, item]));
    if (updates.size === 0) return;
    setAlerts((previous) => previous.map((item) => updates.get(item.id) || item));
  };

  const statusLabel = (status) => {
    if (status === 'acknowledged') return 'acknowledged';
    if (status === 'resolved') return 'resolved';
    return 're-opened';
  };

  const handleStatusChange = async (incident, status) => {
    if (!incident?.id) return;

    try {
      setActionLoadingId(incident.id);
      const response = await updateAdminAlertStatusRequest(incident.id, status);
      const updatedIncident = response?.alert;

      if (updatedIncident?.id) {
        updateIncidentInState(updatedIncident);
      } else {
        await loadData(filters);
      }

      setFeedback({
        type: 'success',
        text: `Incident ${statusLabel(status)} successfully.`,
      });
    } catch (error) {
      setFeedback({ type: 'error', text: error?.message || 'Incident action failed' });
    } finally {
      setActionLoadingId('');
    }
  };

  const handleBulkStatusChange = async (status) => {
    if (selectedIncidentIds.length === 0) return;

    try {
      setBulkActionLoading(true);
      const response = await bulkUpdateAdminAlertStatusRequest(selectedIncidentIds, status);
      const updatedIncidents = Array.isArray(response?.updated) ? response.updated : [];
      updateIncidentsInState(updatedIncidents);

      const updatedCount = updatedIncidents.length;
      const missingCount = Array.isArray(response?.notFound) ? response.notFound.length : 0;
      setSelectedIncidentIds([]);

      if (missingCount > 0) {
        await loadData(filters);
      }

      const missingSuffix = missingCount > 0 ? `, ${missingCount} missing` : '';
      setFeedback({
        type: 'success',
        text: `Bulk ${statusLabel(status)} complete: ${updatedCount} updated${missingSuffix}.`,
      });
    } catch (error) {
      setFeedback({ type: 'error', text: error?.message || 'Bulk incident action failed' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const allPageSelected = pagedIncidents.length > 0
    && pagedIncidents.every((incident) => selectedIncidentIds.includes(incident.id));

  const toggleSelectAllPage = (checked) => {
    setSelectedIncidentIds((previous) => {
      const pageIds = pagedIncidents.map((item) => item.id);
      if (checked) {
        return Array.from(new Set([...previous, ...pageIds]));
      }
      return previous.filter((id) => !pageIds.includes(id));
    });
  };

  const toggleIncidentSelection = (incidentId, checked) => {
    setSelectedIncidentIds((previous) => {
      if (checked) return Array.from(new Set([...previous, incidentId]));
      return previous.filter((id) => id !== incidentId);
    });
  };

  const onFilterChange = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setCurrentPage(1);
  };

  const openIncidents = stats?.open ?? dashboard?.alertSystem?.openAlerts ?? 0;
  const criticalOpen = stats?.criticalOpen ?? dashboard?.alertSystem?.criticalOpen ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incident Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Timeline, escalation history, filtering, and admin actions for active and historical incidents.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {feedback.text ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${feedback.type === 'error' ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300'}`}>
          {feedback.text}
        </div>
      ) : null}

      <div className="grid xl:grid-cols-5 md:grid-cols-3 gap-3">
        <StatCard icon={Siren} label="Open Incidents" value={openIncidents} hint="Requires attention" />
        <StatCard icon={AlertCircle} label="Critical Open" value={criticalOpen} hint="Immediate escalation" />
        <StatCard
          icon={Activity}
          label="SLO Window"
          value={`${sloStatus?.settings?.evaluationWindowMinutes ?? '-'}m`}
          hint="Breach evaluation interval"
        />
        <StatCard
          icon={ShieldAlert}
          label="Health"
          value={health?.status || '-'}
          hint={`${health?.metrics?.successRate || '-'} delivery success`}
        />
        <StatCard
          icon={RefreshCw}
          label="Pending Retries"
          value={retries?.pendingRetries ?? 0}
          hint={channels?.overallHealth ? `Channels: ${channels.overallHealth}` : 'Retry queue'}
        />
      </div>

      <IncidentFilters
        filters={filters}
        databases={databases}
        total={serverTotal}
        onChange={onFilterChange}
        onReset={() => {
          setFilters(DEFAULT_FILTERS);
          setCurrentPage(1);
        }}
      />

      <IncidentAnalyticsDashboard
        alerts={alerts}
        stats={stats}
        dashboard={dashboard}
        serverTotal={serverTotal}
      />

      <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          {selectedIncidentIds.length} selected
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedIncidentIds.length === 0 || bulkActionLoading}
            onClick={() => handleBulkStatusChange('acknowledged')}
          >
            Bulk Acknowledge
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={selectedIncidentIds.length === 0 || bulkActionLoading}
            onClick={() => handleBulkStatusChange('resolved')}
          >
            Bulk Resolve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedIncidentIds.length === 0 || bulkActionLoading}
            onClick={() => handleBulkStatusChange('open')}
          >
            Bulk Re-open
          </Button>
        </div>
      </div>

      <IncidentTable
        incidents={pagedIncidents}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        selectedIds={selectedIncidentIds}
        allPageSelected={allPageSelected}
        onToggleSelectAllPage={toggleSelectAllPage}
        onToggleIncidentSelection={toggleIncidentSelection}
        actionLoadingId={actionLoadingId}
        onPageChange={setCurrentPage}
        onSelectIncident={(incident) => setSelectedIncidentId(incident.id)}
        onAcknowledge={(incident) => handleStatusChange(incident, 'acknowledged')}
        onResolve={(incident) => handleStatusChange(incident, 'resolved')}
        onReopen={(incident) => handleStatusChange(incident, 'open')}
      />

      <IncidentDetailsModal
        open={Boolean(selectedIncidentId)}
        incident={selectedIncident}
        actionLoading={Boolean(actionLoadingId)}
        onOpenChange={(open) => {
          if (!open) setSelectedIncidentId('');
        }}
        onAcknowledge={(incident) => handleStatusChange(incident, 'acknowledged')}
        onResolve={(incident) => handleStatusChange(incident, 'resolved')}
        onReopen={(incident) => handleStatusChange(incident, 'open')}
      />
    </div>
  );
}
