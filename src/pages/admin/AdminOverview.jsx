import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  getAdminDatabasesRequest,
  getViewDefinitionsRequest,
} from '@/api/enterpriseApi';
import { Users, Database, Eye, Activity, AlertCircle, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

function StatCard({ icon: Icon, label, value, subtext, color = 'blue', onClick }) {
  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
    green: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
    purple: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400',
    amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
  };

  return (
    <button
      onClick={onClick}
      className="flex-1 min-w-[160px] rounded-xl border border-border bg-card p-5 text-left hover:shadow-md transition-all hover:border-primary/30 group"
    >
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${colorMap[color]} mb-3`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      <div className="mt-3 flex items-center text-xs text-muted-foreground group-hover:text-primary transition-colors">
        View details <ChevronRight className="h-3 w-3 ml-0.5" />
      </div>
    </button>
  );
}

export default function AdminOverview() {
  const navigate = useNavigate();
  const { getAllUsers, getAuditLog } = useAuth();
  const [data, setData] = useState({ users: [], databases: [], views: [], events: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAllUsers(),
      getAdminDatabasesRequest(),
      getViewDefinitionsRequest(),
      getAuditLog(10),
    ]).then(([users, dbPayload, viewPayload, events]) => {
      if (!cancelled) {
        setData({
          users: users || [],
          databases: dbPayload?.databases || [],
          views: viewPayload?.views || [],
          events: events || [],
        });
        setLoading(false);
      }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [getAllUsers, getAuditLog]);

  const activeUsers = data.users.filter((u) => !u.disabled).length;
  const activeDbs = data.databases.filter((d) => d.active).length;
  const activeViews = data.views.filter((v) => v.active !== false).length;

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">System health at a glance</p>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 animate-pulse h-36" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Users"
            value={data.users.length}
            subtext={`${activeUsers} active`}
            color="blue"
            onClick={() => navigate('/admin/users')}
          />
          <StatCard
            icon={Database}
            label="Databases"
            value={data.databases.length}
            subtext={`${activeDbs} active`}
            color="green"
            onClick={() => navigate('/admin/databases')}
          />
          <StatCard
            icon={Eye}
            label="Views"
            value={data.views.length}
            subtext={`${activeViews} active`}
            color="purple"
            onClick={() => navigate('/admin/views')}
          />
          <StatCard
            icon={Activity}
            label="Audit Events"
            value={data.events.length}
            subtext="last 10 actions"
            color="amber"
            onClick={() => navigate('/admin/audit-logs')}
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold text-sm mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate('/admin/users')} className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Manage Users
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/admin/databases')} className="gap-1.5">
            <Database className="h-3.5 w-3.5" /> Add Database
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/admin/views')} className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Build View
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/admin/monitoring')} className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Monitoring
          </Button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">Recent Activity</h2>
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate('/admin/audit-logs')}>
            View all
          </Button>
        </div>
        {data.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <div className="space-y-2">
            {data.events.slice(0, 8).map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                <div className="mt-0.5 flex-shrink-0">
                  {ev.action.includes('error') || ev.action.includes('blocked')
                    ? <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{ev.action}</p>
                  <p className="text-xs text-muted-foreground">{ev.actor}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                  <Clock className="h-3 w-3" />
                  {new Date(ev.at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Database health */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">Database Status</h2>
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate('/admin/databases')}>
            Manage
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.databases.map((db) => (
            <div key={db.id || db.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className={`h-2 w-2 rounded-full flex-shrink-0 ${db.active ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{db.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{db.sheetName} • {db.dataRange}</p>
              </div>
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${db.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                {db.active ? 'active' : 'inactive'}
              </span>
            </div>
          ))}
          {data.databases.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full">No databases configured yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
