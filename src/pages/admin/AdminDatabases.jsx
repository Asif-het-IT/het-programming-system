import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getAdminDatabasesRequest,
  createAdminDatabaseRequest,
  updateAdminDatabaseRequest,
  deleteAdminDatabaseRequest,
  detectAdminDatabaseColumnsRequest,
} from '@/api/enterpriseApi';
import { Database, Plus, Pencil, Trash2, Search, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

const EMPTY_FORM = {
  name: '',
  displayName: '',
  sheetIdOrUrl: '',
  sheetName: 'Database',
  dataRange: 'A:AZ',
  primaryKey: '',
  bridgeUrl: '',
  apiToken: '',
  active: true,
};

function getUiError(error, fallback) {
  return error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback;
}

export default function AdminDatabases() {
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [detectedMetaByDb, setDetectedMetaByDb] = useState({});
  const [formDetectedMeta, setFormDetectedMeta] = useState(null);
  const [editingId, setEditingId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  const loadDatabases = async (forceRefresh = false) => {
    setLoading(true);
    setLoadError('');
    try {
      const payload = await getAdminDatabasesRequest({ skipCache: forceRefresh });
      setDatabases(Array.isArray(payload?.databases) ? payload.databases : []);
    } catch (error) {
      const message = getUiError(error, 'Unable to load databases right now.');
      setLoadError(message);
      setFeedback({ type: 'error', text: message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDatabases(); }, []);

  const filtered = databases.filter((db) =>
    !search || db.name.toLowerCase().includes(search.toLowerCase()) || (db.displayName || '').toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormDetectedMeta(null);
    setEditingId('');
    setShowForm(false);
    setFeedback({ type: '', text: '' });
  };

  const handleEdit = (db) => {
    setEditingId(db.id || db.name);
    setForm({
      name: db.name || '',
      displayName: db.displayName || '',
      sheetIdOrUrl: db.sheetIdOrUrl || '',
      sheetName: db.sheetName || 'Database',
      dataRange: db.dataRange || 'A:AZ',
      primaryKey: db.primaryKey || '',
      bridgeUrl: db.bridgeUrl || '',
      apiToken: '',
      active: db.active !== false,
    });
    setFormDetectedMeta(null);
    setShowForm(true);
    setFeedback({ type: 'info', text: `Editing: ${db.name}` });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFeedback({ type: 'error', text: 'Database name is required' });
      return;
    }
    try {
      setLoading(true);
      if (editingId) {
        await updateAdminDatabaseRequest(editingId, form);
        setFeedback({ type: 'success', text: `${form.name} updated successfully` });
      } else {
        await createAdminDatabaseRequest(form);
        setFeedback({ type: 'success', text: `${form.name} registered successfully` });
      }
      await loadDatabases(true);
      resetForm();
      setShowForm(false);
    } catch (error) {
      setFeedback({ type: 'error', text: getUiError(error, 'Operation failed') });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (db) => {
    try {
      await updateAdminDatabaseRequest(db.id || db.name, { active: !db.active });
      await loadDatabases(true);
    } catch (error) {
      setFeedback({ type: 'error', text: getUiError(error, 'Status update failed') });
    }
  };

  const handleDelete = async (db) => {
    if (!globalThis.confirm(`Delete database "${db.name}"? This cannot be undone.`)) return;
    try {
      await deleteAdminDatabaseRequest(db.id || db.name);
      await loadDatabases(true);
      setFeedback({ type: 'success', text: `${db.name} deleted` });
    } catch (error) {
      setFeedback({ type: 'error', text: getUiError(error, 'Delete failed') });
    }
  };

  const handleDetectColumns = async (db) => {
    try {
      const payload = await detectAdminDatabaseColumnsRequest(db.id || db.name);
      const count = Array.isArray(payload?.columns) ? payload.columns.length : 0;
      const metadata = payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : null;
      if (metadata) {
        setDetectedMetaByDb((prev) => ({ ...prev, [db.name]: metadata }));
        const autoRange = metadata.lastColumn ? `A:${metadata.lastColumn}` : '';
        if (editingId && form.name === db.name && autoRange) {
          setForm((prev) => ({ ...prev, dataRange: autoRange }));
          setFormDetectedMeta(metadata);
        }
      }
      setFeedback({ type: 'success', text: `${db.name}: ${count} columns detected` });
    } catch (error) {
      setFeedback({ type: 'error', text: getUiError(error, 'Column detection failed') });
    }
  };

  useEffect(() => {
    if (!showForm || !editingId || !form.name) return;
    const metadata = detectedMetaByDb[form.name] || null;
    if (metadata) {
      setFormDetectedMeta(metadata);
      if (metadata.lastColumn) {
        setForm((prev) => ({ ...prev, dataRange: `A:${metadata.lastColumn}` }));
      }
    }
  }, [showForm, editingId, form.name, detectedMetaByDb]);

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Databases</h1>
          <p className="text-muted-foreground text-sm mt-1">Register and manage Google Sheet data sources</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Database
        </Button>
      </div>

      {/* Feedback */}
      {feedback.text && (
        <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
          feedback.type === 'error' ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400' :
          feedback.type === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' :
          'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
          <span>{feedback.text}</span>
          <button className="ml-auto text-inherit opacity-60 hover:opacity-100" onClick={() => setFeedback({ type: '', text: '' })}>✕</button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              {editingId ? 'Edit Database' : 'Register New Database'}
            </h2>
            <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Database Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value.toUpperCase() }))}
                placeholder="SALES_TRACKER"
                disabled={!!editingId}
              />
              <p className="text-[11px] text-muted-foreground">Uppercase identifier, no spaces</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Display Name</Label>
              <Input value={form.displayName} onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))} placeholder="Sales Tracker" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sheet Name</Label>
              <Input value={form.sheetName} onChange={(e) => setForm((p) => ({ ...p, sheetName: e.target.value }))} placeholder="Database" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">Auto Source Range</p>
              {editingId ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleDetectColumns({ id: editingId, name: form.name })}
                >
                  Detect Now
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Manual data range removed. System auto-detects range and column boundaries.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded border border-border bg-background px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Source Range</p>
                <p className="text-xs font-semibold mt-0.5">{(formDetectedMeta?.detectedSourceRange || form.dataRange) || 'Pending detection'}</p>
              </div>
              <div className="rounded border border-border bg-background px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Total Columns</p>
                <p className="text-xs font-semibold mt-0.5">{formDetectedMeta?.totalColumns ?? '—'}</p>
              </div>
              <div className="rounded border border-border bg-background px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Header Row</p>
                <p className="text-xs font-semibold mt-0.5">{formDetectedMeta?.headerRow ?? '—'}</p>
              </div>
              <div className="rounded border border-border bg-background px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Last Column</p>
                <p className="text-xs font-semibold mt-0.5">{formDetectedMeta?.lastColumn || '—'}</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Google Sheet ID / URL *</Label>
              <Input value={form.sheetIdOrUrl} onChange={(e) => setForm((p) => ({ ...p, sheetIdOrUrl: e.target.value }))} placeholder="Sheet ID or full URL" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Primary Key Column</Label>
              <Input value={form.primaryKey} onChange={(e) => setForm((p) => ({ ...p, primaryKey: e.target.value }))} placeholder="ENTRY_ID (optional)" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Bridge URL (GAS)</Label>
              <Input value={form.bridgeUrl} onChange={(e) => setForm((p) => ({ ...p, bridgeUrl: e.target.value }))} placeholder="https://script.google.com/..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">API Token</Label>
              <Input type="password" value={form.apiToken} onChange={(e) => setForm((p) => ({ ...p, apiToken: e.target.value }))} placeholder="Secret token" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={form.active} onCheckedChange={(v) => setForm((p) => ({ ...p, active: v === true }))} />
              <span>Active</span>
            </label>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Saving...' : editingId ? 'Update Database' : 'Register Database'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search + list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loadError ? (
          <div className="px-5 py-8 text-center border-b border-border">
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <p className="text-xs text-muted-foreground mt-1">Retry in a few seconds. Existing configs remain safe.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={loadDatabases}>Retry Loading</Button>
          </div>
        ) : null}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search databases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
          />
          <Button size="sm" variant="ghost" onClick={loadDatabases} disabled={loading} className="ml-auto flex-shrink-0 gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-muted-foreground text-sm">
            {loading ? 'Loading databases...' : databases.length === 0 ? 'No databases registered yet. Click "Add Database" to get started.' : 'No results match your search.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((db) => (
              <div key={db.id || db.name} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${db.active ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'}`}>
                      <Database className={`h-4 w-4 ${db.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{db.name}</span>
                        {db.displayName && <span className="text-xs text-muted-foreground">({db.displayName})</span>}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${db.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                          {db.active ? 'active' : 'inactive'}
                        </span>
                        {db.type === 'legacy' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">legacy</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Sheet: {db.sheetName} • Range: {db.dataRange}
                        {db.primaryKey ? ` • PK: ${db.primaryKey}` : ''}
                      </p>
                      {detectedMetaByDb[db.name] ? (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Auto: {detectedMetaByDb[db.name]?.detectedSourceRange || `A:${detectedMetaByDb[db.name]?.lastColumn || 'AZ'}`} • {detectedMetaByDb[db.name]?.totalColumns ?? 0} columns • header {detectedMetaByDb[db.name]?.headerRow ?? 1} • last {detectedMetaByDb[db.name]?.lastColumn || '—'}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => handleDetectColumns(db)}>
                      <Search className="h-3 w-3" /> Detect
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => handleToggleActive(db)}>
                      {db.active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleEdit(db)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {db.type !== 'legacy' && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleDelete(db)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">{filtered.length} of {databases.length} databases</p>
          </div>
        )}
      </div>
    </div>
  );
}
