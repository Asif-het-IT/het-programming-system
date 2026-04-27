import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getAdminDatabasesRequest,
  detectAdminDatabaseColumnsRequest,
  getViewDefinitionsRequest,
  getAdminFilterValuesRequest,
  createViewDefinitionRequest,
  updateViewDefinitionRequest,
  deleteViewDefinitionRequest,
} from '@/api/enterpriseApi';
import { Eye, Plus, Pencil, Trash2, Search, CheckCircle2, XCircle, RefreshCw, Filter, Layers } from 'lucide-react';

const EMPTY_VIEW_FORM = {
  viewName: '',
  database: '',
  selectedColumns: [],
  filterableColumns: [],
  filterRules: [],
  sortColumn: '',
  sortDirection: 'asc',
  active: true,
};

function toSheetColumnLetter(index) {
  let n = Number(index) + 1;
  if (!Number.isFinite(n) || n <= 0) return '';

  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCodePoint(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function getUiError(error, fallback) {
  return error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback;
}

function buildFilterValueMap(filterRules) {
  const map = {};
  for (const rule of Array.isArray(filterRules) ? filterRules : []) {
    const column = String(rule?.column || '').trim();
    if (!column) continue;
    const raw = rule?.value;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const valueItem of values) {
      const value = String(valueItem ?? '').trim();
      if (!value) continue;
      const current = Array.isArray(map[column]) ? map[column] : [];
      if (!current.includes(value)) {
        map[column] = [...current, value];
      }
    }
  }
  return map;
}

function mergeUniqueColumns(...groups) {
  const out = [];
  const seen = new Set();

  for (const group of groups) {
    for (const raw of Array.isArray(group) ? group : []) {
      const column = String(raw || '').trim();
      if (!column) continue;
      const key = column.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(column);
    }
  }

  return out;
}

export default function AdminViews() {
  const [databases, setDatabases] = useState([]);
  const [views, setViews] = useState([]);
  const [detectedColumns, setDetectedColumns] = useState({});
  const [detectedMetaByDb, setDetectedMetaByDb] = useState({});
  const [form, setForm] = useState(EMPTY_VIEW_FORM);
  const [editingId, setEditingId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [loadError, setLoadError] = useState('');
  const [columnSearch, setColumnSearch] = useState('');
  const [viewSearch, setViewSearch] = useState('');
  const [columnGroup, setColumnGroup] = useState('all');
  const [lastSavedAt, setLastSavedAt] = useState('');
  const [filterValuesByColumn, setFilterValuesByColumn] = useState({});
  const [filterValueOptionsByColumn, setFilterValueOptionsByColumn] = useState({});
  const [filterValueSearchByColumn, setFilterValueSearchByColumn] = useState({});
  const [filterValueLoading, setFilterValueLoading] = useState(false);

  const loadAll = async (forceRefresh = false) => {
    setLoading(true);
    setLoadError('');
    try {
      const [dbPayload, viewPayload] = await Promise.all([
        getAdminDatabasesRequest({ skipCache: forceRefresh }),
        getViewDefinitionsRequest(undefined, { skipCache: forceRefresh }),
      ]);
      setDatabases(Array.isArray(dbPayload?.databases) ? dbPayload.databases : []);
      setViews(Array.isArray(viewPayload?.views) ? viewPayload.views : []);
    } catch (error) {
      const message = getUiError(error, 'Unable to load databases/views right now.');
      setLoadError(message);
      setFeedback({ type: 'error', text: message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // Always refresh metadata on database switch so new columns are picked up automatically.
  useEffect(() => {
    const db = form.database;
    if (!db) return;
    handleDetectColumns(db);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.database]);

  const allColumns = detectedColumns[form.database] || [];
  const basicColumns = useMemo(
    () => allColumns.filter((c) => !c.includes('_') || c.endsWith('_ID') || c.endsWith('_NAME') || c.endsWith('_DATE')),
    [allColumns],
  );

  const advancedColumns = useMemo(
    () => allColumns.filter((c) => !basicColumns.includes(c)),
    [allColumns, basicColumns],
  );

  const groupedColumns = useMemo(() => {
    if (columnGroup === 'basic') return basicColumns;
    if (columnGroup === 'advanced') return advancedColumns;
    return allColumns;
  }, [allColumns, basicColumns, advancedColumns, columnGroup]);

  const filteredColumns = useMemo(() => {
    const q = columnSearch.toLowerCase();
    return q ? groupedColumns.filter((c) => c.toLowerCase().includes(q)) : groupedColumns;
  }, [groupedColumns, columnSearch]);

  const filteredColumnMeta = useMemo(() => {
    const indexByName = new Map(allColumns.map((name, idx) => [name, idx]));
    return filteredColumns.map((name) => {
      const idx = indexByName.get(name) ?? 0;
      return {
        index: idx + 1,
        letter: toSheetColumnLetter(idx),
        name,
      };
    });
  }, [allColumns, filteredColumns]);

  const filteredViews = useMemo(() => {
    const q = viewSearch.toLowerCase();
    return q ? views.filter((v) => v.viewName.toLowerCase().includes(q) || v.database.toLowerCase().includes(q)) : views;
  }, [views, viewSearch]);

  const previewSourceView = useMemo(() => {
    if (!form.database) return '';
    if (editingId && form.viewName) return form.viewName;
    const firstFromDb = views.find((view) => view.database === form.database && view.viewName !== form.viewName);
    return firstFromDb?.viewName || form.viewName || '';
  }, [views, form.database, form.viewName, editingId]);

  useEffect(() => {
    const next = {};
    for (const column of form.filterableColumns || []) {
      next[column] = Array.isArray(filterValuesByColumn[column]) ? filterValuesByColumn[column] : [];
    }
    setFilterValuesByColumn(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(form.filterableColumns || [])]);

  useEffect(() => {
    const loadFilterValues = async () => {
      if (!form.database || !previewSourceView || (form.filterableColumns || []).length === 0) {
        setFilterValueOptionsByColumn({});
        return;
      }

      setFilterValueLoading(true);
      try {
        const entries = await Promise.all(
          (form.filterableColumns || []).map(async (column) => {
            const payload = await getAdminFilterValuesRequest({
              database: form.database,
              view: previewSourceView,
              column,
            });
            const values = Array.isArray(payload?.values) ? payload.values : [];
            return [column, values];
          }),
        );
        setFilterValueOptionsByColumn(Object.fromEntries(entries));
      } catch {
        setFilterValueOptionsByColumn({});
      } finally {
        setFilterValueLoading(false);
      }
    };

    loadFilterValues();
  }, [form.database, form.filterableColumns, previewSourceView]);

  const handleDetectColumns = async (dbName) => {
    if (!dbName) return;
    const db = databases.find((d) => d.name === dbName || d.id === dbName);
    if (!db) return;
    setDetecting(true);
    try {
      const payload = await detectAdminDatabaseColumnsRequest(db.id || db.name);
      const cols = Array.isArray(payload?.columns) ? payload.columns : [];
      const mappedFromViews = views
        .filter((view) => view.database === db.name)
        .flatMap((view) => (Array.isArray(view.selectedColumns) ? view.selectedColumns : []));
      const currentFormColumns = form.database === db.name ? (form.selectedColumns || []) : [];

      setDetectedColumns((prev) => {
        const existing = Array.isArray(prev[db.name]) ? prev[db.name] : [];
        return {
          ...prev,
          [db.name]: mergeUniqueColumns(cols, existing, mappedFromViews, currentFormColumns),
        };
      });
      setDetectedMetaByDb((prev) => ({
        ...prev,
        [db.name]: payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : null,
      }));

      if (cols.length === 0) {
        setFeedback({ type: 'info', text: `No columns detected for ${db.name}. Check sheet config.` });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: getUiError(error, 'Column detection failed') });
    } finally {
      setDetecting(false);
    }
  };

  const toggleColumn = (col, checked) => {
    setForm((prev) => {
      const next = checked
        ? Array.from(new Set([...(prev.selectedColumns || []), col]))
        : (prev.selectedColumns || []).filter((c) => c !== col);
      return {
        ...prev,
        selectedColumns: next,
        filterableColumns: (prev.filterableColumns || []).filter((c) => next.includes(c)),
        filterRules: (prev.filterRules || []).filter((r) => next.includes(r.column)),
        sortColumn: next.includes(prev.sortColumn) ? prev.sortColumn : '',
      };
    });
  };

  const toggleFilterable = (col, checked) => {
    setForm((prev) => {
      if (!(prev.selectedColumns || []).includes(col)) return prev;
      const next = checked
        ? Array.from(new Set([...(prev.filterableColumns || []), col]))
        : (prev.filterableColumns || []).filter((c) => c !== col);
      return { ...prev, filterableColumns: next };
    });

    if (!checked) {
      setFilterValuesByColumn((prev) => {
        const next = { ...prev };
        delete next[col];
        return next;
      });
      setFilterValueSearchByColumn((prev) => {
        const next = { ...prev };
        delete next[col];
        return next;
      });
    }
  };

  const enableAll = () => {
    setForm((prev) => ({
      ...prev,
      selectedColumns: [...allColumns],
      sortColumn: prev.sortColumn && allColumns.includes(prev.sortColumn) ? prev.sortColumn : '',
    }));
  };

  const disableAll = () => {
    setForm((prev) => ({ ...prev, selectedColumns: [], filterableColumns: [], filterRules: [], sortColumn: '' }));
  };

  const resetColumnSelections = () => {
    setColumnSearch('');
    setColumnGroup('all');
    disableAll();
  };

  const resetForm = () => {
    setForm(EMPTY_VIEW_FORM);
    setEditingId('');
    setShowForm(false);
    setColumnSearch('');
    setFilterValuesByColumn({});
    setFilterValueOptionsByColumn({});
    setFilterValueSearchByColumn({});
    setFeedback({ type: '', text: '' });
  };

  const handleEditView = async (view) => {
    setEditingId(view.id || '');
    const nextFilterRules = Array.isArray(view.filterRules) ? view.filterRules : [];
    setForm({
      viewName: view.viewName || '',
      database: view.database || '',
      selectedColumns: Array.isArray(view.selectedColumns) ? view.selectedColumns : [],
      filterableColumns: Array.isArray(view.filterableColumns) ? view.filterableColumns : [],
      filterRules: nextFilterRules,
      sortColumn: view.sort?.column || '',
      sortDirection: view.sort?.direction || 'asc',
      active: view.active !== false,
    });
    setFilterValuesByColumn(buildFilterValueMap(nextFilterRules));
    setFilterValueSearchByColumn({});
    setShowForm(true);
    if (view.database) await handleDetectColumns(view.database);
  };

  const handleSubmit = async () => {
    if (!form.database) return setFeedback({ type: 'error', text: 'Select a database' });
    if (!form.viewName.trim()) return setFeedback({ type: 'error', text: 'View name is required' });
    if ((form.selectedColumns || []).length === 0) return setFeedback({ type: 'error', text: 'Select at least one visible column' });

    const selectedRules = [];
    for (const column of form.filterableColumns || []) {
      const selectedValues = Array.isArray(filterValuesByColumn[column]) ? filterValuesByColumn[column] : [];
      if (selectedValues.length === 0) continue;
      selectedRules.push({
        column,
        operator: 'in',
        value: selectedValues,
      });
    }

    const payload = {
      viewName: form.viewName.trim(),
      database: form.database,
      selectedColumns: form.selectedColumns,
      filterableColumns: form.filterableColumns,
      filterRules: selectedRules,
      sort: { column: form.sortColumn || undefined, direction: form.sortDirection || 'asc' },
      active: form.active,
    };

    try {
      setLoading(true);
      if (editingId) {
        await updateViewDefinitionRequest(editingId, payload);
        setFeedback({ type: 'success', text: `"${form.viewName}" updated` });
      } else {
        await createViewDefinitionRequest(payload);
        setFeedback({ type: 'success', text: `"${form.viewName}" created` });
      }
      setLastSavedAt(new Date().toLocaleTimeString());
      await loadAll(true);
      resetForm();
    } catch (error) {
      setFeedback({ type: 'error', text: getUiError(error, 'Save failed') });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (view) => {
    if (!globalThis.confirm(`Delete view "${view.viewName}"?`)) return;
    try {
      await deleteViewDefinitionRequest(view.id);
      await loadAll(true);
      setFeedback({ type: 'success', text: `"${view.viewName}" deleted` });
    } catch (error) {
      setFeedback({ type: 'error', text: getUiError(error, 'Delete failed') });
    }
  };

  const selectedCount = (form.selectedColumns || []).length;
  const filterableCount = (form.filterableColumns || []).length;
  const detectedMeta = detectedMetaByDb[form.database] || null;

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">View Builder</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and configure dynamic views with column control</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> Create View
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
          <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => setFeedback({ type: '', text: '' })}>✕</button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Form header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {editingId ? `Editing: ${form.viewName || 'View'}` : 'New View'}
            </h2>
            <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>

          <div className="p-6 space-y-5">
            {/* Basic settings */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">View Name *</Label>
                <Input value={form.viewName} onChange={(e) => setForm((p) => ({ ...p, viewName: e.target.value }))} placeholder="e.g. Dubai Active Orders" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Database *</Label>
                <Select
                  value={form.database || 'none'}
                  onValueChange={(v) => {
                    setEditingId('');
                    setForm((p) => ({ ...p, database: v === 'none' ? '' : v, selectedColumns: [], filterableColumns: [], filterRules: [], sortColumn: '' }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select database" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select database</SelectItem>
                    {databases.filter((d) => d.active).map((d) => (
                      <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Sort Column</Label>
                <Select value={form.sortColumn || 'none'} onValueChange={(v) => setForm((p) => ({ ...p, sortColumn: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="No sort" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No sort</SelectItem>
                    {(form.selectedColumns || []).map((col) => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Sort Direction</Label>
                <Select value={form.sortDirection} onValueChange={(v) => setForm((p) => ({ ...p, sortDirection: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending ↑</SelectItem>
                    <SelectItem value="desc">Descending ↓</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => form.database && handleDetectColumns(form.database)}
                disabled={!form.database || detecting}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${detecting ? 'animate-spin' : ''}`} />
                {detecting ? 'Detecting...' : 'Detect Columns'}
              </Button>
              {form.database && (detectedMeta?.detectedSourceRange || databases.find((d) => d.name === form.database)?.dataRange) && (
                <span className="text-xs text-muted-foreground">
                  Source range: <span className="font-medium">{detectedMeta?.detectedSourceRange || databases.find((d) => d.name === form.database)?.dataRange}</span>
                </span>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer ml-auto">
                <Checkbox checked={form.active} onCheckedChange={(v) => setForm((p) => ({ ...p, active: v === true }))} />
                <span>View Active</span>
              </label>
            </div>

            {form.database && detectedMeta ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Detected Source Range</p>
                  <p className="text-xs font-semibold mt-0.5">{detectedMeta.detectedSourceRange || '—'}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Total Columns</p>
                  <p className="text-xs font-semibold mt-0.5">{detectedMeta.totalColumns ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Header Row</p>
                  <p className="text-xs font-semibold mt-0.5">{detectedMeta.headerRow || 1}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Last Column</p>
                  <p className="text-xs font-semibold mt-0.5">{detectedMeta.lastColumn || '—'}</p>
                </div>
              </div>
            ) : null}

            {/* Column Control Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between gap-3 flex-wrap sticky top-0 z-20">
                <div>
                  <p className="text-sm font-semibold">Column Control</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedCount} visible • {filterableCount} filterable
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-md border border-border p-1 bg-background">
                    <button
                      className={`text-[11px] px-2 py-1 rounded ${columnGroup === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                      onClick={() => setColumnGroup('all')}
                    >
                      All ({allColumns.length})
                    </button>
                    <button
                      className={`text-[11px] px-2 py-1 rounded ${columnGroup === 'basic' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                      onClick={() => setColumnGroup('basic')}
                    >
                      Basic ({basicColumns.length})
                    </button>
                    <button
                      className={`text-[11px] px-2 py-1 rounded ${columnGroup === 'advanced' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                      onClick={() => setColumnGroup('advanced')}
                    >
                      Advanced ({advancedColumns.length})
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      placeholder="Search columns..."
                      className="pl-8 h-8 text-xs w-40"
                    />
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={enableAll} disabled={allColumns.length === 0}>
                    Select All
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={resetColumnSelections} disabled={selectedCount === 0 && !columnSearch}>
                    Reset
                  </Button>
                </div>
              </div>

              {allColumns.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {form.database ? 'Click "Detect Columns" to load available columns.' : 'Select a database first.'}
                </div>
              ) : (
                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-20">#</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Column</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Name</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground w-28">
                          <span className="flex items-center justify-center gap-1">Visible</span>
                        </th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground w-28">
                          <span className="flex items-center justify-center gap-1"><Filter className="h-3 w-3" /> Filter</span>
                        </th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-44">Multiple Filter Values</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredColumnMeta.map((meta) => {
                        const col = meta.name;
                        const isVisible = (form.selectedColumns || []).includes(col);
                        const isFilterable = (form.filterableColumns || []).includes(col);
                        const selectedValues = Array.isArray(filterValuesByColumn[col]) ? filterValuesByColumn[col] : [];
                        const allOptions = Array.isArray(filterValueOptionsByColumn[col]) ? filterValueOptionsByColumn[col] : [];
                        const searchText = filterValueSearchByColumn[col] || '';
                        const filteredOptions = searchText
                          ? allOptions.filter((value) => String(value).toLowerCase().includes(searchText.toLowerCase()))
                          : allOptions;
                        return (
                          <tr key={col} className={`transition-colors ${isVisible ? 'hover:bg-primary/5' : 'hover:bg-muted/20 opacity-60'}`}>
                            <td className="px-4 py-2.5 font-medium text-xs">{meta.index}</td>
                            <td className="px-4 py-2.5 font-medium text-sm">
                              {meta.letter}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-sm">
                              <span>{col}</span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <Switch
                                checked={isVisible}
                                onCheckedChange={(v) => toggleColumn(col, v === true)}
                              />
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <Switch
                                checked={isFilterable}
                                disabled={!isVisible}
                                onCheckedChange={(v) => toggleFilterable(col, v === true)}
                              />
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground align-top">
                              {!isFilterable ? (
                                '—'
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap gap-1">
                                    {selectedValues.length === 0 ? (
                                      <span className="text-[10px] text-muted-foreground">No values selected</span>
                                    ) : selectedValues.map((value) => (
                                      <Badge key={`${col}-chip-${value}`} variant="secondary" className="gap-1 pr-1">
                                        <span>{value}</span>
                                        <button
                                          type="button"
                                          className="rounded-full p-0.5 hover:bg-black/10"
                                          onClick={() => {
                                            const nextValues = selectedValues.filter((item) => item !== value);
                                            setFilterValuesByColumn((prev) => ({ ...prev, [col]: nextValues }));
                                          }}
                                          aria-label={`Remove ${value}`}
                                        >
                                          <XCircle className="h-3 w-3" />
                                        </button>
                                      </Badge>
                                    ))}
                                  </div>
                                  <Input
                                    className="h-7 text-xs"
                                    placeholder={filterValueLoading ? 'Loading values...' : 'Search values...'}
                                    value={searchText}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      setFilterValueSearchByColumn((prev) => ({ ...prev, [col]: next }));
                                    }}
                                    disabled={filterValueLoading}
                                  />
                                  <div className="max-h-24 overflow-auto rounded border border-input bg-background px-2 py-1 space-y-1">
                                    {filteredOptions.length === 0 ? (
                                      <p className="text-[10px] text-muted-foreground">No matching values</p>
                                    ) : filteredOptions.map((option) => {
                                      const optionChecked = selectedValues.includes(option);
                                      return (
                                        <label key={`${col}-option-${option}`} className="flex items-center gap-2 text-xs cursor-pointer">
                                          <Checkbox
                                            checked={optionChecked}
                                            onCheckedChange={(checked) => {
                                              const nextValues = checked === true
                                                ? Array.from(new Set([...selectedValues, option]))
                                                : selectedValues.filter((item) => item !== option);
                                              setFilterValuesByColumn((prev) => ({ ...prev, [col]: nextValues }));
                                            }}
                                          />
                                          <span>{option}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="px-4 py-2.5 bg-muted/20 border-t border-border">
                <p className="text-[11px] text-muted-foreground">
                  Visible ON → column shown in dashboard • Filter ON → filter input appears in dashboard (requires Visible ON) • Selected values are persisted as IN-rules.
                </p>
              </div>
            </div>

            {/* Save actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  {selectedCount > 0 ? `${selectedCount} columns visible, ${filterableCount} filterable` : 'No columns selected yet'}
                </span>
                {lastSavedAt && <span className="ml-2 text-emerald-600 dark:text-emerald-400">Last saved at {lastSavedAt}</span>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
                <Button size="sm" onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Saving...' : editingId ? 'Update View' : 'Create View'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Views list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loadError ? (
          <div className="px-5 py-8 text-center border-b border-border">
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <p className="text-xs text-muted-foreground mt-1">No configuration was lost. Retry when the API is ready.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={loadAll}>Retry Loading</Button>
          </div>
        ) : null}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search views..."
            value={viewSearch}
            onChange={(e) => setViewSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
          />
          <Button size="sm" variant="ghost" onClick={loadAll} disabled={loading} className="ml-auto flex-shrink-0 gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {filteredViews.length === 0 ? (
          <div className="px-5 py-12 text-center text-muted-foreground text-sm">
            {loading ? 'Loading views...' : views.length === 0 ? 'No views created yet. Click "Create View" to get started.' : 'No results match your search.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredViews.map((view) => (
              <div key={view.id} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${view.active !== false ? 'bg-sky-100 dark:bg-sky-900/30' : 'bg-muted'}`}>
                      <Eye className={`h-4 w-4 ${view.active !== false ? 'text-sky-700 dark:text-sky-400' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{view.viewName}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${view.active !== false ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'bg-muted text-muted-foreground'}`}>
                          {view.active !== false ? 'active' : 'inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {view.database} • {(view.selectedColumns || []).length} visible columns • {(view.filterableColumns || []).length} filterable
                        {view.sort?.column ? ` • Sorted by ${view.sort.column} ${view.sort.direction}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => handleEditView(view)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleDelete(view)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredViews.length > 0 && (
          <div className="px-5 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">{filteredViews.length} of {views.length} views</p>
          </div>
        )}
      </div>
    </div>
  );
}
