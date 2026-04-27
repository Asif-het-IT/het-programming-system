import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  getMonitoringStatusRequest,
  getMonitoringDashboardRequest,
  getMonitoringChannelsRequest,
  getMonitoringFrequencyRequest,
  getMonitoringFailuresRequest,
  getMonitoringRetriesRequest,
  getMonitoringRoutingConfigRequest,
  getMonitoringHealthRequest,
  getMonitoringLogsRequest,
  getMonitoringPerformanceRequest,
  getMonitoringLaceGayleViewsRequest,
  refreshMonitoringRequest,
  forceReloadMonitoringRequest,
} from '@/api/enterpriseApi';
import {
  RefreshCw, RotateCcw, Database, Server, Cloud, Monitor, Code, Table2,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle, BellRing, ShieldAlert,
} from 'lucide-react';

function formatMs(v) { return v == null ? '—' : `${v} ms`; }

function getStatusMeta(status) {
  if (status === 'ok') return { card: 'border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', label: 'Active', icon: CheckCircle2, iconClass: 'text-emerald-600' };
  if (status === 'error') return { card: 'border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/20', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', label: 'Error', icon: XCircle, iconClass: 'text-red-600' };
  return { card: 'border-border bg-muted/20', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400', label: 'Pending', icon: AlertCircle, iconClass: 'text-yellow-600' };
}

function getSyncStatusClass(s) {
  if (s === 'success') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (s === 'error') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (s === 'cache_hit') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
}

function getChannelHealthClass(status) {
  if (status === 'healthy') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (status === 'degraded') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return 'bg-muted text-muted-foreground';
}

const ARCH_ICON_MAP = { monitor: Monitor, layers: Database, server: Server, cloud: Cloud, code: Code, table: Table2 };

export default function AdminMonitoring() {
  const [status, setStatus] = useState(null);
  const [alertDashboard, setAlertDashboard] = useState(null);
  const [channelsReport, setChannelsReport] = useState(null);
  const [frequencyReport, setFrequencyReport] = useState(null);
  const [failureReport, setFailureReport] = useState(null);
  const [retryReport, setRetryReport] = useState(null);
  const [routingConfig, setRoutingConfig] = useState(null);
  const [healthReport, setHealthReport] = useState(null);
  const [logs, setLogs] = useState([]);
  const [perf, setPerf] = useState(null);
  const [laceViews, setLaceViews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [debugOpen, setDebugOpen] = useState({});
  const logFilter = { database: '', status: '' };
  const [autoSync, setAutoSync] = useState(false);
  const [autoSyncMin, setAutoSyncMin] = useState(5);
  const [laceSearch, setLaceSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        statusRes,
        dashboardRes,
        channelsRes,
        frequencyRes,
        failuresRes,
        retriesRes,
        routingRes,
        healthRes,
        logsRes,
        perfRes,
        laceRes,
      ] = await Promise.allSettled([
        getMonitoringStatusRequest(),
        getMonitoringDashboardRequest(),
        getMonitoringChannelsRequest(),
        getMonitoringFrequencyRequest(24),
        getMonitoringFailuresRequest(),
        getMonitoringRetriesRequest(),
        getMonitoringRoutingConfigRequest(),
        getMonitoringHealthRequest(),
        getMonitoringLogsRequest({ limit: 100, ...(logFilter.database ? { database: logFilter.database } : {}), ...(logFilter.status ? { status: logFilter.status } : {}) }),
        getMonitoringPerformanceRequest(),
        getMonitoringLaceGayleViewsRequest(),
      ]);
      if (statusRes.status === 'fulfilled') setStatus(statusRes.value);
      if (dashboardRes.status === 'fulfilled') setAlertDashboard(dashboardRes.value);
      if (channelsRes.status === 'fulfilled') setChannelsReport(channelsRes.value);
      if (frequencyRes.status === 'fulfilled') setFrequencyReport(frequencyRes.value);
      if (failuresRes.status === 'fulfilled') setFailureReport(failuresRes.value);
      if (retriesRes.status === 'fulfilled') setRetryReport(retriesRes.value);
      if (routingRes.status === 'fulfilled') setRoutingConfig(routingRes.value);
      if (healthRes.status === 'fulfilled') setHealthReport(healthRes.value);
      if (logsRes.status === 'fulfilled') setLogs(logsRes.value?.logs || []);
      if (perfRes.status === 'fulfilled') setPerf(perfRes.value?.metrics || null);
      if (laceRes.status === 'fulfilled') setLaceViews(laceRes.value?.views || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!autoSync) return;
    const id = setInterval(loadData, autoSyncMin * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync, autoSyncMin]);

  const handleForceReload = async () => {
    setLoading(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await forceReloadMonitoringRequest();
      const errors = Object.entries(res.results || {}).filter(([, v]) => v.status === 'error');
      const errorText = errors
        .map(([db, info]) => `${db}: ${info.error}`)
        .join('; ');
      setFeedback({
        type: errors.length ? 'error' : 'success',
        text: errors.length ? `Reload errors: ${errorText}` : 'Cache cleared and all databases reloaded.',
      });
      await loadData();
    } catch (e) {
      setFeedback({ type: 'error', text: e?.message || 'Force reload failed' });
      setLoading(false);
    }
  };

  const handleRefreshDb = async (db) => {
    setFeedback({ type: '', text: '' });
    try {
      setLoading(true);
      const r = await refreshMonitoringRequest(db);
      const result = r.results?.[db];
      setFeedback({ type: result?.status === 'ok' ? 'success' : 'error', text: result?.status === 'ok' ? `${db} refreshed — ${result.recordCount ?? ''} records` : `${db} error: ${result?.error}` });
      await loadData();
    } catch (e) {
      setFeedback({ type: 'error', text: e?.message || 'Refresh failed' });
      setLoading(false);
    }
  };

  const filteredLaceViews = laceSearch
    ? laceViews.filter((v) => v.viewName.toLowerCase().includes(laceSearch.toLowerCase()) || (v.markaCode || '').toLowerCase().includes(laceSearch.toLowerCase()))
    : laceViews;

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monitoring</h1>
          <p className="text-muted-foreground text-sm mt-1">Data source health, sync logs and performance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <input type="checkbox" className="h-3.5 w-3.5" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
            <span>Auto-refresh every</span>
            <select className="text-xs border border-border rounded px-1 py-0.5 bg-background" value={autoSyncMin} onChange={(e) => setAutoSyncMin(Number(e.target.value))}>
              <option value={1}>1 min</option>
              <option value={2}>2 min</option>
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
            </select>
          </label>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={loading} onClick={handleForceReload}>
            <RotateCcw className="h-3.5 w-3.5" /> Force Reload
          </Button>
        </div>
      </div>

      {/* Feedback */}
      {feedback.text && (
        <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
          feedback.type === 'error' ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400' :
          'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <XCircle className="h-4 w-4 mt-0.5" />}
          <span>{feedback.text}</span>
          <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => setFeedback({ type: '', text: '' })}>✕</button>
        </div>
      )}

      {/* Alert Overview */}
      {alertDashboard?.alertSystem && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Open Alerts</p>
            <p className="text-2xl font-bold mt-1">{alertDashboard.alertSystem.openAlerts ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Critical Open</p>
            <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">{alertDashboard.alertSystem.criticalOpen ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Criticality Score</p>
            <p className="text-2xl font-bold mt-1">{alertDashboard.alertSystem.criticalityScore ?? 0}%</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Delivery Success</p>
            <p className="text-2xl font-bold mt-1">{(alertDashboard.channels?.overallSuccessRate ?? 0).toFixed(2)}%</p>
          </div>
        </div>
      )}

      {/* Alert System Health */}
      {healthReport?.status && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Alert System Health</h2>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${healthReport.status === 'healthy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
              {healthReport.status}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
            <div className="rounded-lg border border-border p-2.5">
              <p className="text-muted-foreground">Success Rate</p>
              <p className="font-semibold mt-1">{healthReport.metrics?.successRate || '—'}</p>
            </div>
            <div className="rounded-lg border border-border p-2.5">
              <p className="text-muted-foreground">Open Critical</p>
              <p className="font-semibold mt-1">{healthReport.metrics?.openCritical ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border p-2.5">
              <p className="text-muted-foreground">Total Failures</p>
              <p className="font-semibold mt-1">{healthReport.metrics?.totalFailures ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border p-2.5">
              <p className="text-muted-foreground">Channels Active</p>
              <p className="font-semibold mt-1">{healthReport.metrics?.channelsOperational ?? 0}</p>
            </div>
          </div>
          {Array.isArray(healthReport.alerts) && healthReport.alerts.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {healthReport.alerts.join(' • ')}
            </div>
          )}
        </div>
      )}

      {/* Channel Delivery */}
      {channelsReport?.channels && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold flex items-center gap-2"><BellRing className="h-4 w-4" /> Channel Delivery</h2>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${channelsReport.overallHealth === 'healthy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{channelsReport.overallHealth}</span>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  {['Channel', 'Attempts', 'Sent', 'Failed', 'Skipped', 'Success', 'Status'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {channelsReport.channels.map((ch) => (
                  <tr key={ch.channel} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{ch.channel}</td>
                    <td className="px-4 py-2.5">{ch.totalAttempts}</td>
                    <td className="px-4 py-2.5">{ch.successfulDeliveries}</td>
                    <td className="px-4 py-2.5">{ch.failedDeliveries}</td>
                    <td className="px-4 py-2.5">{ch.skipped}</td>
                    <td className="px-4 py-2.5">{ch.successRate}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getChannelHealthClass(ch.status)}`}>
                        {ch.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Frequency + Retries */}
      <div className="grid md:grid-cols-2 gap-4">
        {frequencyReport?.timeSeries && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-3">Alert Frequency (24h)</h2>
            <div className="space-y-2 max-h-64 overflow-auto">
              {frequencyReport.timeSeries.slice(-12).map((point) => (
                <div key={point.time} className="rounded-lg border border-border p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{point.time}</span>
                    <span className="font-semibold">{point.total}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">critical {point.critical || 0} • warning {point.warning || 0} • info {point.info || 0}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {retryReport && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-3">Pending Retries</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="rounded-lg border border-border p-2.5 text-xs">
                <p className="text-muted-foreground">Alerts with Retries</p>
                <p className="font-semibold mt-1">{retryReport.pendingRetries ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border p-2.5 text-xs">
                <p className="text-muted-foreground">Routing Rules</p>
                <p className="font-semibold mt-1">{Object.keys(routingConfig?.routing?.severityRules || {}).length}</p>
              </div>
            </div>
            <div className="max-h-52 overflow-auto space-y-2">
              {(retryReport.retries || []).slice(0, 8).map((item) => (
                <div key={item.alertId} className="rounded-lg border border-border p-2 text-xs">
                  <p className="font-medium">{item.type} • {item.alertId}</p>
                  <p className="text-muted-foreground mt-0.5">{item.message}</p>
                </div>
              ))}
              {(retryReport.retries || []).length === 0 && (
                <p className="text-xs text-muted-foreground">No pending retries.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Failure Breakdown */}
      {failureReport?.failureBreakdown?.byChannel && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-3">Failure Breakdown</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {(failureReport.failureBreakdown.byChannel || []).map((channel) => (
              <div key={channel.channel} className="rounded-lg border border-border p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{channel.channel}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${channel.failureCount > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                    {channel.failureCount} failures
                  </span>
                </div>
                {channel.lastError && <p className="text-muted-foreground mt-1 break-all">{channel.lastError}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Architecture */}
      {status?.architecture && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Data Architecture</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {status.architecture.map((node, idx) => {
              const Icon = ARCH_ICON_MAP[node.icon] || Database;
              return (
                <React.Fragment key={node.layer}>
                  <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border ${node.optional && !node.enabled ? 'border-dashed border-muted-foreground/30 text-muted-foreground/40' : 'border-border bg-muted/30'}`}>
                    <Icon className="h-3 w-3" />
                    <span>{node.layer}</span>
                    {node.optional && !node.enabled && <span className="text-[10px] opacity-50">(off)</span>}
                  </div>
                  {idx < status.architecture.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Database cards */}
      {status?.databases && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Database Status</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(status.databases).map(([db, info]) => {
              const meta = getStatusMeta(info.status);
              const StatusIcon = meta.icon;
              return (
                <div key={db} className={`rounded-xl border p-5 space-y-4 ${meta.card}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold flex items-center gap-1.5">
                        <Database className="h-4 w-4" /> {db}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${meta.badge}`}>
                        <StatusIcon className={`h-3 w-3 ${meta.iconClass}`} />
                        {meta.label}
                      </span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleRefreshDb(db)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                    {[
                      ['Source Type', info.sourceType],
                      ['Sheet Name', info.sourceSheetName],
                      ['Records', info.recordCount ?? '—'],
                      ['Last Sync', info.lastSuccessAt ? new Date(info.lastSuccessAt).toLocaleString() : '—'],
                      ['Avg Response', formatMs(info.avgDurationMs)],
                      ['Total Fetches', info.totalFetches ?? 0],
                      ['Cache Hits', info.cacheHits ?? 0],
                      ['Errors', info.totalErrors ?? 0],
                    ].map(([label, val]) => (
                      <React.Fragment key={label}>
                        <span className="text-muted-foreground">{label}</span>
                        <span className={`font-medium ${label === 'Errors' && Number(val) > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{val}</span>
                      </React.Fragment>
                    ))}
                  </div>

                  {info.lastError && (
                    <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-3 text-xs text-red-700 dark:text-red-400">
                      <p className="font-semibold">Last Error</p>
                      <p className="break-all mt-1">{info.lastError}</p>
                      {info.lastErrorAt && <p className="text-red-500/60 mt-1">{new Date(info.lastErrorAt).toLocaleString()}</p>}
                    </div>
                  )}

                  {/* Debug toggle */}
                  <div>
                    <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setDebugOpen((p) => ({ ...p, [db]: !p[db] }))}>
                      {debugOpen[db] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      Debug Info
                    </button>
                    {debugOpen[db] && (
                      <div className="mt-2 rounded-lg bg-muted/50 border border-border p-3 text-xs font-mono space-y-1 break-all">
                        <p><span className="text-muted-foreground">GAS URL: </span>{info.gasUrl || '—'}</p>
                        <p><span className="text-muted-foreground">Proxy: </span>{info.proxyEnabled ? (status.proxyUrl || 'enabled') : 'disabled'}</p>
                        <p><span className="text-muted-foreground">Cache TTL: </span>{info.cacheTtlMs ? `${info.cacheTtlMs / 1000}s` : '—'}</p>
                        <p><span className="text-muted-foreground">Layer: </span>{info.layerDescription || '—'}</p>
                        {perf?.[db] && (
                          <>
                            <p><span className="text-muted-foreground">P50: </span>{formatMs(perf[db].p50DurationMs)}</p>
                            <p><span className="text-muted-foreground">P95: </span>{formatMs(perf[db].p95DurationMs)}</p>
                            <p><span className="text-muted-foreground">Cache hit rate: </span>{perf[db].cacheHitRate}</p>
                            <p><span className="text-muted-foreground">Error rate: </span>{perf[db].errorRate}</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Performance metrics */}
      {perf && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Performance Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(perf).flatMap(([db, m]) => [
              { label: `${db} — Avg`, value: formatMs(m.avgDurationMs) },
              { label: `${db} — P95`, value: formatMs(m.p95DurationMs) },
              { label: `${db} — Cache Hit`, value: m.cacheHitRate },
              { label: `${db} — Error Rate`, value: m.errorRate },
            ]).map((metric) => (
              <div key={metric.label} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground truncate">{metric.label}</p>
                <p className="font-semibold text-sm mt-1">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lace views */}
      {laceViews.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Lace Gayle Views ({laceViews.length})</h2>
            <input
              value={laceSearch}
              onChange={(e) => setLaceSearch(e.target.value)}
              placeholder="Search views..."
              className="border border-border rounded-md px-3 py-1.5 text-xs bg-background w-48"
            />
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  {['View Name', 'Marka Code', 'Category', 'Sheet', 'Records', 'Last Sync'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredLaceViews.map((v) => (
                  <tr key={`${v.viewName}-${v.markaCode || 'na'}-${v.sourceSheetName || 'na'}`} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{v.viewName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{v.markaCode || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{v.productCategory || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{v.sourceSheetName || '—'}</td>
                    <td className="px-4 py-2.5">{v.recordCount ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getSyncStatusClass(v.lastSyncStatus)}`}>
                        {v.lastSyncStatus || 'unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sync logs */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Sync Event Log ({logs.length})</h2>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  {['Time', 'Database', 'Status', 'Duration', 'Records', 'Source'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {logs.map((log, i) => (
                  <tr key={`${log.at}-${i}`} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 whitespace-nowrap">{new Date(log.at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-medium">{log.database}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getSyncStatusClass(log.status)}`}>{log.status}</span>
                    </td>
                    <td className="px-4 py-2.5">{formatMs(log.durationMs)}</td>
                    <td className="px-4 py-2.5">{log.recordCount ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{log.source || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
