import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollText, RefreshCw, Search, CheckCircle2, AlertCircle, Info, ShieldAlert, Filter } from 'lucide-react';

const ACTION_CATEGORY_MAP = {
  'user.': { icon: CheckCircle2, class: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  'data.save_entry.write.success': { icon: CheckCircle2, class: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  'data.save_entry.write.blocked': { icon: ShieldAlert, class: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  'error': { icon: AlertCircle, class: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
};

function getEventMeta(action) {
  const key = Object.keys(ACTION_CATEGORY_MAP).find((k) => action.includes(k));
  return key ? ACTION_CATEGORY_MAP[key] : { icon: Info, class: 'text-muted-foreground', bg: 'bg-muted/30' };
}

export default function AdminAuditLogs() {
  const { getAuditLog } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(100);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAuditLog(limit);
      setEvents(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [limit]);

  const actionCategories = useMemo(() => {
    const cats = new Set(events.map((e) => e.action.split('.')[0]));
    return ['all', ...Array.from(cats)];
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      const matchSearch = !search || `${ev.actor} ${ev.action} ${ev.target || ''} ${ev.id}`.toLowerCase().includes(search.toLowerCase());
      const matchAction = actionFilter === 'all' || ev.action.startsWith(actionFilter);
      return matchSearch && matchAction;
    });
  }, [events, search, actionFilter]);

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground text-sm mt-1">Track all administrative actions and system events</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="w-28 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">Last 50</SelectItem>
              <SelectItem value="100">Last 100</SelectItem>
              <SelectItem value="250">Last 250</SelectItem>
              <SelectItem value="500">Last 500</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, actors, targets..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex gap-1 flex-wrap">
            {actionCategories.slice(0, 8).map((cat) => (
              <button
                key={cat}
                onClick={() => setActionFilter(cat)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${actionFilter === cat ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted/60 text-muted-foreground'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Events', value: events.length, color: 'text-foreground' },
          { label: 'Filtered', value: filtered.length, color: 'text-foreground' },
          { label: 'Write Success', value: events.filter((e) => e.action === 'data.save_entry.write.success').length, color: 'text-emerald-600' },
          { label: 'Blocked', value: events.filter((e) => e.action.includes('blocked')).length, color: 'text-amber-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Log table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-muted-foreground text-sm">
            {loading ? 'Loading events...' : 'No events match your filters.'}
          </div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0 z-10">
                <tr>
                  {['Time', 'Actor', 'Action', 'Target', 'Details'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((ev) => {
                  const meta = getEventMeta(ev.action);
                  const Icon = meta.icon;
                  return (
                    <tr key={ev.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{new Date(ev.at).toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-medium">{ev.actor}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.bg}`}>
                          <Icon className={`h-2.5 w-2.5 ${meta.class}`} />
                          <span className={meta.class}>{ev.action}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">{ev.target || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">
                        {ev.details ? JSON.stringify(ev.details).slice(0, 80) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground">{filtered.length} of {events.length} events</p>
        </div>
      </div>
    </div>
  );
}
