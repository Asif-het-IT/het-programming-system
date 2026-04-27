import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { BarChart3, PieChart, Database, Clock3 } from 'lucide-react';

function toPercent(value, total) {
  if (!total) return '0.0';
  return ((value / total) * 100).toFixed(1);
}

function parseHourBucket(label) {
  const bucketRegex = /^(\d+)h\s+ago$/i;
  const match = bucketRegex.exec(String(label || ''));
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]);
}

function buildCountMap(items, pickKey, fallback = 'unknown') {
  const map = {};
  for (const item of items || []) {
    const key = String(pickKey(item) || fallback).toLowerCase();
    map[key] = Number(map[key] || 0) + 1;
  }
  return map;
}

function renderBars(entries, total, colorClass) {
  if (!entries.length) {
    return <p className="text-xs text-muted-foreground">No data available.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([label, count]) => (
        <div key={`${label}-${count}`} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium capitalize">{label}</span>
            <span className="text-muted-foreground">{count} ({toPercent(count, total)}%)</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-2 ${colorClass}`}
              style={{ width: `${toPercent(count, total)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function IncidentAnalyticsDashboard({ alerts, stats, dashboard, serverTotal }) {
  const severityBreakdown = useMemo(() => {
    const map = buildCountMap(alerts, (item) => item.severity || 'info', 'info');
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [alerts]);

  const statusBreakdown = useMemo(() => {
    const map = buildCountMap(alerts, (item) => item.status || 'open', 'open');
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [alerts]);

  const typeBreakdown = useMemo(() => {
    const map = buildCountMap(alerts, (item) => item.type || 'unknown');
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [alerts]);

  const databaseBreakdown = useMemo(() => {
    const map = buildCountMap(alerts, (item) => item.database || 'unscoped');
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [alerts]);

  const trendPoints = useMemo(() => {
    const source = dashboard?.trends?.frequency24h || {};
    return Object.entries(source)
      .map(([bucket, value]) => ({
        bucket,
        hour: parseHourBucket(bucket),
        total: Number(value?.total || 0),
        critical: Number(value?.critical || 0),
        warning: Number(value?.warning || 0),
        info: Number(value?.info || 0),
      }))
      .filter((entry) => Number.isFinite(entry.hour))
      .sort((a, b) => b.hour - a.hour)
      .slice(0, 8);
  }, [dashboard]);

  const total = Number(serverTotal || alerts.length || 0);
  const open = Number(stats?.open || 0);
  const acknowledged = Number(stats?.acknowledged || 0);
  const resolved = Number(stats?.resolved || 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Incident Analytics
        </h2>
        <p className="text-xs text-muted-foreground">Live from current filtered dataset</p>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-[11px] text-muted-foreground">Current total</p>
          <p className="text-xl font-bold mt-1">{total}</p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-[11px] text-muted-foreground">Open ratio</p>
          <p className="text-xl font-bold mt-1">{toPercent(open, total)}%</p>
          <p className="text-[11px] text-muted-foreground mt-1">{open} open</p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-[11px] text-muted-foreground">Acknowledged ratio</p>
          <p className="text-xl font-bold mt-1">{toPercent(acknowledged, total)}%</p>
          <p className="text-[11px] text-muted-foreground mt-1">{acknowledged} acknowledged</p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-[11px] text-muted-foreground">Resolved ratio</p>
          <p className="text-xl font-bold mt-1">{toPercent(resolved, total)}%</p>
          <p className="text-[11px] text-muted-foreground mt-1">{resolved} resolved</p>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border p-3 space-y-2">
          <h3 className="text-xs font-semibold flex items-center gap-1.5"><PieChart className="h-3.5 w-3.5" /> Severity Breakdown</h3>
          {renderBars(severityBreakdown, total, 'bg-red-500/80')}
        </div>
        <div className="rounded-lg border border-border p-3 space-y-2">
          <h3 className="text-xs font-semibold flex items-center gap-1.5"><PieChart className="h-3.5 w-3.5" /> Status Breakdown</h3>
          {renderBars(statusBreakdown, total, 'bg-blue-500/80')}
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border p-3 space-y-2">
          <h3 className="text-xs font-semibold flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> Top Databases</h3>
          {renderBars(databaseBreakdown, total, 'bg-emerald-500/80')}
        </div>
        <div className="rounded-lg border border-border p-3 space-y-2">
          <h3 className="text-xs font-semibold flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Top Incident Types</h3>
          {renderBars(typeBreakdown, total, 'bg-violet-500/80')}
        </div>
      </div>

      <div className="rounded-lg border border-border p-3 space-y-2">
        <h3 className="text-xs font-semibold flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> 24h Frequency Trend</h3>
        {trendPoints.length === 0 ? (
          <p className="text-xs text-muted-foreground">No trend points available yet.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Bucket</th>
                  <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground">Total</th>
                  <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground">Critical</th>
                  <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground">Warning</th>
                  <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground">Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {trendPoints.map((point) => (
                  <tr key={point.bucket}>
                    <td className="px-2 py-1.5">{point.bucket}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{point.total}</td>
                    <td className="px-2 py-1.5 text-right">{point.critical}</td>
                    <td className="px-2 py-1.5 text-right">{point.warning}</td>
                    <td className="px-2 py-1.5 text-right">{point.info}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

IncidentAnalyticsDashboard.propTypes = {
  alerts: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    severity: PropTypes.string,
    status: PropTypes.string,
    type: PropTypes.string,
    database: PropTypes.string,
  })),
  stats: PropTypes.shape({
    open: PropTypes.number,
    acknowledged: PropTypes.number,
    resolved: PropTypes.number,
  }),
  dashboard: PropTypes.shape({
    trends: PropTypes.shape({
      frequency24h: PropTypes.object,
    }),
  }),
  serverTotal: PropTypes.number,
};

IncidentAnalyticsDashboard.defaultProps = {
  alerts: [],
  stats: null,
  dashboard: null,
  serverTotal: 0,
};
