import React, { useState } from "react";
import { localDB } from "@/api/localDB";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { syncFromBridge } from "@/lib/syncService";
import { useDatabaseManager } from "@/lib/DatabaseManager";
import { formatDatabaseLabel } from "@/config/columnMapping";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Plus, Trash2, CheckCircle, XCircle, Clock, Zap, Database, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

function maskBridgeUrl(url = '') {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', '***');
    }
    return parsed.toString();
  } catch {
    return String(url).replace(/([?&]token=)[^&]+/i, '$1***');
  }
}

function fmtDate(v) {
  if (!v) return "—";
  try { return format(new Date(v), "dd MMM yy, HH:mm"); } catch { return String(v); }
}

const DEFAULT_CONFIG = {
  name: "",
  bridge_url: "",
  api_token: "",
  sheet_id: "",
  tab_name: "Sheet1",
  header_row: 1,
  data_start_row: 2,
  is_active: true,
};

const LOADING_CONFIG_KEYS = ["sync-config-1", "sync-config-2"];

export default function SyncCenter() {
  const { activeDatabase, updateDatabase } = useDatabaseManager();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formConfig, setFormConfig] = useState(DEFAULT_CONFIG);
  const [syncingId, setSyncingId] = useState(null);

  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ["sync-configs"],
    queryFn: () => localDB.SyncConfig.list("-created_date"),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["sync-logs"],
    queryFn: () => localDB.SyncLog.list("-created_date", 20),
    refetchInterval: 10000,
  });

  const { data: orderCount = 0 } = useQuery({
    queryKey: ["orders-count"],
    queryFn: () => localDB.Order.count(),
    refetchInterval: 15000,
  });

  const createMut = useMutation({
    mutationFn: (data) => {
      if (editingId) {
        return localDB.SyncConfig.update(editingId, data);
      }
      return localDB.SyncConfig.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sync-configs"] });
      setShowAdd(false);
      setEditingId(null);
      setFormConfig(DEFAULT_CONFIG);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => localDB.SyncConfig.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync-configs"] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => localDB.SyncConfig.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync-configs"] }),
  });

  const runSync = async (config) => {
    const targetConfig = {
      ...config,
      bridge_url: activeDatabase?.bridge_url || config.bridge_url,
      api_token: activeDatabase?.api_token || config.api_token,
      sheet_id: activeDatabase?.sheet_id || config.sheet_id,
      tab_name: activeDatabase?.tab_name || config.tab_name,
      sheet_key: activeDatabase?.sheet_key || 'primary_database',
      database_id: activeDatabase?.id || 'db_default',
      database_type: activeDatabase?.type || 'GAYLE_LACE'
    };

    setSyncingId(config.id);
    const logEntry = await localDB.SyncLog.create({
      config_id: config.id,
      config_name: config.name,
      status: "running",
      started_at: new Date().toISOString(),
    });

    try {
      const result = await syncFromBridge(targetConfig);

      if (activeDatabase?.id) {
        updateDatabase(activeDatabase.id, {
          record_count: result.count,
          last_synced: new Date().toISOString(),
          status: 'connected'
        });
      }

      await localDB.SyncLog.update(logEntry.id, {
        status: "success",
        records_synced: result.count,
        finished_at: new Date().toISOString(),
        message: `Synced ${result.count} records successfully`,
      });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders-count"] });
    } catch (err) {
      if (activeDatabase?.id) {
        updateDatabase(activeDatabase.id, {
          status: 'error'
        });
      }

      await localDB.SyncLog.update(logEntry.id, {
        status: "error",
        finished_at: new Date().toISOString(),
        message: String(err.message || err),
      });
    } finally {
      setSyncingId(null);
      qc.invalidateQueries({ queryKey: ["sync-logs"] });
    }
  };

  const handleAdd = () => {
    if (!formConfig.name || !formConfig.bridge_url) return;
    createMut.mutate(formConfig);
  };

  const handleEdit = (config) => {
    setEditingId(config.id);
    setFormConfig(config);
    setShowAdd(true);
  };

  const handleCancel = () => {
    setShowAdd(false);
    setEditingId(null);
    setFormConfig(DEFAULT_CONFIG);
  };

  const statusIcon = (s) => {
    if (s === "success") return <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />;
    if (s === "error") return <XCircle className="h-3.5 w-3.5 text-rose-400" />;
    if (s === "running") return <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />;
    return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const statusTextClass = (status) => {
    if (status === "success") return "text-emerald-400";
    if (status === "error") return "text-rose-400";
    return "text-primary";
  };

  let saveButtonLabel = "Save Config";
  if (createMut.isPending) {
    saveButtonLabel = "Saving...";
  } else if (editingId) {
    saveButtonLabel = "Update Config";
  }

  let configListContent;
  if (configsLoading) {
    configListContent = LOADING_CONFIG_KEYS.map((key) => (
      <div key={key} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
    ));
  } else if (configs.length === 0) {
    configListContent = (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-sm text-muted-foreground">No sync configurations yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Add your Google Apps Script bridge URL to get started</p>
      </div>
    );
  } else {
    configListContent = configs.map(config => (
      <motion.div key={config.id} layout className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${config.is_active ? "bg-emerald-400" : "bg-muted"}`} />
            <div>
              <p className="text-sm font-semibold text-foreground">{config.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-xs">{maskBridgeUrl(config.bridge_url)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              onClick={() => toggleMut.mutate({ id: config.id, is_active: !config.is_active })}
              className={`text-[11px] h-7 px-2 ${config.is_active ? "text-emerald-400" : "text-muted-foreground"}`}
            >
              {config.is_active ? "Active" : "Inactive"}
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => handleEdit(config)}
              className="text-xs h-7 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              Edit
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={syncingId === config.id}
              onClick={() => runSync(config)}
              className="text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
            >
              {syncingId === config.id
                ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Syncing...</>
                : <><RefreshCw className="h-3 w-3 mr-1" />Sync Now</>}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-400"
              onClick={() => deleteMut.mutate(config.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    ));
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Sync Center
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Google Apps Script bridge · Auto-replace sync</p>
            <p className="text-xs text-primary mt-1">Active Database: {formatDatabaseLabel(activeDatabase)}</p>
          </div>
          <Button size="sm" onClick={() => setShowAdd(s => !s)} className="text-xs h-8 bg-primary hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Config
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] text-muted-foreground">Total Records</p>
            <p className="text-2xl font-bold font-mono text-primary mt-0.5">{orderCount.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] text-muted-foreground">Active Configs</p>
            <p className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">{configs.filter(c => c.is_active).length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] text-muted-foreground">Last Sync</p>
            <p className="text-sm font-mono text-muted-foreground mt-0.5">
              {logs[0] ? fmtDate(logs[0].finished_at || logs[0].started_at) : "Never"}
            </p>
          </div>
        </div>

        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" /> {editingId ? "Edit Config" : "New Sync Configuration"}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "name", label: "Config Name", placeholder: "e.g. Main Sheet Sync" },
                  { key: "bridge_url", label: "Apps Script URL", placeholder: "https://script.google.com/..." },
                  { key: "api_token", label: "API Token", placeholder: "Paste your API token" },
                  { key: "sheet_id", label: "Sheet ID (optional)", placeholder: "Google Sheet ID" },
                  { key: "tab_name", label: "Tab Name", placeholder: "Sheet1" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label htmlFor={`sync-config-${key}`} className="text-[11px] text-muted-foreground font-medium block mb-1">{label}</label>
                    <Input
                      id={`sync-config-${key}`}
                      placeholder={placeholder}
                      type={key === "api_token" ? "password" : "text"}
                      value={formConfig[key]}
                      onChange={e => setFormConfig(c => ({ ...c, [key]: e.target.value }))}
                      className="h-8 text-xs bg-secondary border-border"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={handleCancel} className="text-xs h-8">Cancel</Button>
                <Button size="sm" onClick={handleAdd} disabled={createMut.isPending || !formConfig.name || !formConfig.bridge_url}
                  className="text-xs h-8 bg-primary hover:bg-primary/90">
                  {saveButtonLabel}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" /> Sync Configurations
          </h2>
          {configListContent}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Sync History (last 20)
          </h2>
          {logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">No sync logs yet</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    {["Status", "Config", "Started", "Finished", "Records", "Message"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id || `${log.config_name || 'config'}-${log.started_at || ''}-${log.status || 'unknown'}`} className="border-t border-border hover:bg-secondary/40">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {statusIcon(log.status)}
                          <span className={statusTextClass(log.status)}>
                            {log.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{log.config_name || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap font-mono text-[10px]">{fmtDate(log.started_at)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap font-mono text-[10px]">{fmtDate(log.finished_at)}</td>
                      <td className="px-4 py-2.5 font-mono text-foreground">{log.records_synced ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-[10px] max-w-xs truncate">{log.message || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
