import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  acknowledgeAdminAlertRequest,
  getAdminAlertsRequest,
  getAdminAlertSettingsRequest,
  resolveAdminAlertRequest,
  retryAdminAlertSyncRequest,
  sendAdminTestAlertRequest,
  updateAdminAlertSettingsRequest,
} from '@/api/enterpriseApi';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, Siren } from 'lucide-react';

function severityClass(severity) {
  const level = String(severity || '').toLowerCase();
  if (level === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (level === 'warning') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
}

function statusClass(status) {
  const value = String(status || 'open').toLowerCase();
  if (value === 'resolved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (value === 'acknowledged') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300';
  return 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100';
}

function ChannelToggles({ value, onChange }) {
  const channels = value || {};

  const renderToggle = (key, label) => (
    <label key={key} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
      <input
        type="checkbox"
        checked={channels[key] === true}
        onChange={(e) => onChange({ ...channels, [key]: e.target.checked })}
      />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="flex flex-wrap gap-3">
      {renderToggle('adminPanel', 'Admin Panel')}
      {renderToggle('push', 'Push')}
      {renderToggle('email', 'Email')}
      {renderToggle('telegram', 'Telegram')}
    </div>
  );
}

export default function AdminAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [filters, setFilters] = useState({
    q: '',
    severity: '',
    status: '',
    type: '',
  });

  const loadData = async () => {
    setLoading(true);
    setFeedback({ type: '', text: '' });
    try {
      const [alertsRes, settingsRes] = await Promise.all([
        getAdminAlertsRequest({ ...filters, limit: 300 }),
        getAdminAlertSettingsRequest(),
      ]);
      setAlerts(alertsRes.alerts || []);
      setStats(alertsRes.stats || null);
      setSettings(settingsRes.settings || null);
    } catch (error) {
      setFeedback({ type: 'error', text: error?.message || 'Failed to load alerts' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCount = useMemo(() => alerts.length, [alerts]);

  const handleAcknowledge = async (id) => {
    try {
      await acknowledgeAdminAlertRequest(id);
      await loadData();
    } catch (error) {
      setFeedback({ type: 'error', text: error?.message || 'Acknowledge failed' });
    }
  };

  const handleResolve = async (id) => {
    try {
      await resolveAdminAlertRequest(id);
      await loadData();
    } catch (error) {
      setFeedback({ type: 'error', text: error?.message || 'Resolve failed' });
    }
  };

  const handleRetrySync = async (id) => {
    try {
      await retryAdminAlertSyncRequest(id);
      setFeedback({ type: 'success', text: 'Sync retry completed' });
      await loadData();
    } catch (error) {
      setFeedback({ type: 'error', text: error?.message || 'Retry sync failed' });
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      await updateAdminAlertSettingsRequest(settings);
      setFeedback({ type: 'success', text: 'Alert settings saved' });
      await loadData();
    } catch (error) {
      setFeedback({ type: 'error', text: error?.message || 'Failed to save alert settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendTestAlert = async () => {
    try {
      await sendAdminTestAlertRequest({
        type: 'sync_failure',
        severity: 'critical',
        message: 'Manual test alert: monitoring pipeline validation',
        database: 'MEN_MATERIAL',
        view: 'Test View',
        channels: settings?.defaultChannels || undefined,
      });
      setFeedback({ type: 'success', text: 'Test alert sent successfully' });
      await loadData();
    } catch (error) {
      setFeedback({ type: 'error', text: error?.message || 'Failed to send test alert' });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monitoring Alerts</h1>
          <p className="text-muted-foreground text-sm mt-1">Health, sync, security, performance, and isolation alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadData} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={handleSendTestAlert} className="gap-1.5">
            <Siren className="h-3.5 w-3.5" /> Send Test Alert
          </Button>
        </div>
      </div>

      {feedback.text ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${feedback.type === 'error' ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300'}`}>
          {feedback.text}
        </div>
      ) : null}

      <div className="grid md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Alerts</p>
          <p className="text-2xl font-bold mt-1">{stats?.total ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Open</p>
          <p className="text-2xl font-bold mt-1">{stats?.open ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Critical Open</p>
          <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">{stats?.criticalOpen ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Filtered Result</p>
          <p className="text-2xl font-bold mt-1">{filteredCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Filter Alerts</h2>
          <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>Apply</Button>
        </div>
        <div className="grid md:grid-cols-4 gap-2">
          <Input
            placeholder="Search database/view/user/message"
            value={filters.q}
            onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
          />
          <select className="h-9 border border-input rounded-md px-2 text-sm bg-background" value={filters.severity} onChange={(e) => setFilters((p) => ({ ...p, severity: e.target.value }))}>
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <select className="h-9 border border-input rounded-md px-2 text-sm bg-background" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
          <select className="h-9 border border-input rounded-md px-2 text-sm bg-background" value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}>
            <option value="">All Types</option>
            <option value="sync_failure">Sync Failure</option>
            <option value="data_isolation">Data Isolation</option>
            <option value="performance">Performance</option>
            <option value="rate_limit">Rate Limit</option>
            <option value="auth_security">Auth Security</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          <p className="text-sm font-semibold">Alert Queue</p>
        </div>
        {loading ? (
          <div className="p-5 space-y-2">
            {[...Array(4)].map((_, idx) => <div key={idx} className="h-10 rounded bg-muted/50 animate-pulse" />)}
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No alerts found for current filters.</div>
        ) : (
          <div className="divide-y divide-border">
            {alerts.map((alert) => (
              <div key={alert.id} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={severityClass(alert.severity)}>{alert.severity}</Badge>
                      <Badge className={statusClass(alert.status)}>{alert.status}</Badge>
                      <Badge variant="outline">{alert.type}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="font-medium text-sm break-words">{alert.message}</p>
                    <p className="text-xs text-muted-foreground break-words">
                      Module: {alert.sourceModule || '-'} • Database: {alert.database || '-'} • View: {alert.view || '-'} • User: {alert.user || '-'}
                    </p>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View details</summary>
                      <pre className="mt-2 rounded bg-muted/40 p-2 overflow-auto">{JSON.stringify(alert.details || {}, null, 2)}</pre>
                    </details>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleAcknowledge(alert.id)} disabled={alert.status !== 'open'}>Acknowledge</Button>
                    <Button size="sm" variant="outline" onClick={() => handleResolve(alert.id)} disabled={alert.status === 'resolved'}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                    </Button>
                    <Button size="sm" onClick={() => handleRetrySync(alert.id)} disabled={alert.type !== 'sync_failure'}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry Sync
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Alert Rules & Delivery Settings</h2>
        {settings ? (
          <>
            <div className="grid md:grid-cols-4 gap-3">
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">Performance Warning (ms)</span>
                <Input
                  value={settings.performanceWarningMs ?? 3000}
                  onChange={(e) => setSettings((p) => ({ ...p, performanceWarningMs: Number(e.target.value || 0) }))}
                />
              </label>
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">Performance Critical (ms)</span>
                <Input
                  value={settings.performanceCriticalMs ?? 6000}
                  onChange={(e) => setSettings((p) => ({ ...p, performanceCriticalMs: Number(e.target.value || 0) }))}
                />
              </label>
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">Cooldown (minutes)</span>
                <Input
                  value={settings.cooldownMinutes ?? 10}
                  onChange={(e) => setSettings((p) => ({ ...p, cooldownMinutes: Number(e.target.value || 0) }))}
                />
              </label>
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">Alert Emails (comma separated)</span>
                <Input
                  value={(settings.recipients?.emails || []).join(',')}
                  onChange={(e) => {
                    const emails = String(e.target.value || '').split(',').map((x) => x.trim()).filter(Boolean);
                    setSettings((p) => ({ ...p, recipients: { ...(p.recipients || {}), emails } }));
                  }}
                />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Delivery Channels</p>
              <ChannelToggles
                value={settings.defaultChannels}
                onChange={(next) => setSettings((p) => ({ ...p, defaultChannels: next }))}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Enable Alert Types</p>
              <div className="flex flex-wrap gap-3 text-xs">
                {Object.keys(settings.types || {}).map((typeKey) => (
                  <label key={typeKey} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.types?.[typeKey]?.enabled !== false}
                      onChange={(e) => {
                        setSettings((p) => ({
                          ...p,
                          types: {
                            ...(p.types || {}),
                            [typeKey]: {
                              ...(p.types?.[typeKey] || {}),
                              enabled: e.target.checked,
                            },
                          },
                        }));
                      }}
                    />
                    <span>{typeKey}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={savingSettings}>{savingSettings ? 'Saving...' : 'Save Settings'}</Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        )}
      </div>
    </div>
  );
}
