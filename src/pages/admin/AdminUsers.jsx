import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getAdminDatabasesRequest,
  getAdminColumnsRequest,
  getAdminFilterValuesRequest,
  detectAdminDatabaseColumnsRequest,
  getAdminViewsRequest,
} from '@/api/enterpriseApi';
import {
  Plus, Pencil, Trash2, Search, KeyRound, ShieldCheck, ShieldOff,
  CheckCircle2, XCircle, User, Eye, Database as DbIcon, SlidersHorizontal, ArrowLeft, ArrowRight, ListChecks, X,
} from 'lucide-react';

const ROLE_DEFAULTS = {
  admin: { read: true, write: true, export: true, dashboard: true, viewOnly: false },
  manager: { read: true, write: true, export: true, dashboard: true, viewOnly: false },
  user: { read: true, write: false, export: false, dashboard: false, viewOnly: true },
};
const DEFAULT_QUOTA = { dailyWriteLimit: 50, monthlyWriteLimit: 1000, totalWriteLimit: 10000, testWriteLimit: 100, liveWriteLimit: 10000 };

function buildInitialForm() {
  return {
    email: '',
    password: '',
    role: 'user',
    databases: [],
    views: [],
    permissions: { ...ROLE_DEFAULTS.user },
    quota: { ...DEFAULT_QUOTA },
    allowedColumns: {},
    allowedColumnsByView: {},
    allowedFilterColumnsByView: {},
    filterValueRulesByView: {},
  };
}

function buildFormFromUser(u) {
  const role = u.role || 'user';
  return {
    email: u.email, password: '', role,
    databases: Array.isArray(u.databases) ? u.databases : [],
    views: Array.isArray(u.views) ? u.views : [],
    permissions: u.permissions ? { ...ROLE_DEFAULTS[role], ...u.permissions } : { ...ROLE_DEFAULTS[role] },
    quota: u.quota ? { ...DEFAULT_QUOTA, ...u.quota } : { ...DEFAULT_QUOTA },
    allowedColumns: (u.allowedColumns && typeof u.allowedColumns === 'object') ? u.allowedColumns : {},
    allowedColumnsByView: (u.allowedColumnsByView && typeof u.allowedColumnsByView === 'object') ? u.allowedColumnsByView : {},
    allowedFilterColumnsByView: (u.allowedFilterColumnsByView && typeof u.allowedFilterColumnsByView === 'object') ? u.allowedFilterColumnsByView : {},
    filterValueRulesByView: (u.filterValueRulesByView && typeof u.filterValueRulesByView === 'object') ? u.filterValueRulesByView : {},
  };
}

function toSafeNumber(v, fallback) { const n = Number(v); return (Number.isFinite(n) && n >= 0) ? Math.floor(n) : fallback; }
function getUiError(error, fallback) { return error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback; }
function makeScopedViewKey(db, view) {
  const d = String(db || '').trim().toUpperCase();
  const v = String(view || '').trim();
  if (!d || !v) return v;
  return `${d}::${v}`;
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

function buildFilterValueMapFromRuleSet(ruleSet) {
  const cols = Array.isArray(ruleSet?.filterColumns) ? ruleSet.filterColumns : [];
  const vals = Array.isArray(ruleSet?.filterValues) ? ruleSet.filterValues : [];
  const map = {};

  cols.forEach((rawCol, idx) => {
    const col = String(rawCol || '').trim();
    if (!col) return;
    const raw = vals[idx];
    const values = Array.isArray(raw) ? raw : [raw];
    values.forEach((valueItem) => {
      const value = String(valueItem ?? '').trim();
      if (!value) return;
      const current = Array.isArray(map[col]) ? map[col] : [];
      if (!current.includes(value)) {
        map[col] = [...current, value];
      }
    });
  });

  return map;
}

function buildRuleSetFromFilterValueMap(columns, valueMap) {
  const filterColumns = [];
  const filterValues = [];

  (columns || []).forEach((column) => {
    const values = Array.isArray(valueMap?.[column]) ? valueMap[column] : [];
    values.forEach((value) => {
      const safeValue = String(value ?? '').trim();
      if (!safeValue) return;
      filterColumns.push(column);
      filterValues.push(safeValue);
    });
  });

  return { filterColumns, filterValues };
}

function UserRow({ u, onEdit, onDelete, onResetPassword, onToggleStatus }) {
  const permList = Object.entries(u.permissions || {}).filter(([, v]) => v === true).map(([k]) => k).join(', ');
  return (
    <div className="px-5 py-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-primary">{(u.email || 'U')[0].toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{u.email}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : u.role === 'manager' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
              {u.role}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${u.disabled ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
              {u.disabled ? 'disabled' : 'enabled'}
            </span>
          </div>
          <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><DbIcon className="h-3 w-3" />{(u.databases || []).join(', ') || 'None'}</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{(u.views || []).length} views</span>
            {permList && <span>{permList}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => onEdit(u)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {u.role !== 'admin' && (
            <>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => onToggleStatus(u)} title={u.disabled ? 'Enable' : 'Disable'}>
                {u.disabled ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => onResetPassword(u.email)} title="Reset Password">
                <KeyRound className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => onDelete(u.email)} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { getAllUsers, addUser, updateUserConfig, deleteUser, resetPassword, setUserStatus } = useAuth();
  const [users, setUsers] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [allViews, setAllViews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(buildInitialForm());
  const [editingEmail, setEditingEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  // Column access state
  const [columnDatabase, setColumnDatabase] = useState('');
  const [columnView, setColumnView] = useState('none');
  const [dynamicColumns, setDynamicColumns] = useState([]);
  const [columnSearch, setColumnSearch] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [filterValueOptionsByColumn, setFilterValueOptionsByColumn] = useState({});
  const [filterValueLoading, setFilterValueLoading] = useState(false);
  const [filterValueSearchByColumn, setFilterValueSearchByColumn] = useState({});
  const [detectedMetaByDb, setDetectedMetaByDb] = useState({});

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setLoadError('');
    try {
      const [userList, dbPayload, viewPayload] = await Promise.all([
        getAllUsers({ skipCache: forceRefresh }),
        getAdminDatabasesRequest({ skipCache: forceRefresh }),
        getAdminViewsRequest({ skipCache: forceRefresh }),
      ]);
      setUsers(userList || []);
      setDatabases(Array.isArray(dbPayload?.databases) ? dbPayload.databases : []);
      const views = Array.isArray(viewPayload?.views) ? viewPayload.views : [];
      setAllViews(views);
    } catch (error) {
      const retryAfter = Number(error?.response?.data?.retryAfterSeconds || 0);
      const detail = retryAfter > 0
        ? `Server is busy. Retrying after ${retryAfter}s is recommended.`
        : getUiError(error, 'Failed to load users and admin metadata.');
      setLoadError(detail);
      setFeedback({ type: 'error', text: detail });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Load columns when columnDatabase/view changes in form mode
  useEffect(() => {
    if (!(isCreating || editingEmail) || !columnDatabase) { setDynamicColumns([]); return; }
    const dbViews = allViews.filter((v) => v.database === columnDatabase);
    const activeView = columnView === 'none' ? (dbViews[0]?.viewName || '') : columnView;
    if (!activeView) { setDynamicColumns([]); return; }
    getAdminColumnsRequest({ database: columnDatabase, view: activeView }).then((res) => {
      const cols = Array.isArray(res?.columns) ? res.columns : (Array.isArray(res) ? res : []);
      setDynamicColumns(cols);
    }).catch(() => setDynamicColumns([]));
  }, [columnDatabase, columnView, isCreating, editingEmail, allViews]);

  useEffect(() => {
    if (!(isCreating || editingEmail) || !columnDatabase) return;

    detectAdminDatabaseColumnsRequest(columnDatabase)
      .then((res) => {
        setDetectedMetaByDb((prev) => ({
          ...prev,
          [columnDatabase]: res?.metadata && typeof res.metadata === 'object' ? res.metadata : null,
        }));
      })
      .catch(() => {
        setDetectedMetaByDb((prev) => ({ ...prev, [columnDatabase]: null }));
      });
  }, [columnDatabase, isCreating, editingEmail]);

  const availableDatabaseNames = useMemo(() => databases.filter((d) => d.active).map((d) => d.name), [databases]);

  const availableViews = useMemo(() => {
    const dbSet = new Set(form.databases || []);
    return allViews.filter((v) => dbSet.has(v.database));
  }, [allViews, form.databases]);

  const columnDatabaseViews = useMemo(() => {
    if (!columnDatabase) return [];
    return availableViews.filter((v) => v.database === columnDatabase);
  }, [availableViews, columnDatabase]);

  const columnViewScopedKey = useMemo(() => {
    if (columnView === 'none') return '';
    return makeScopedViewKey(columnDatabase, columnView);
  }, [columnDatabase, columnView]);

  const resolvedDynamicColumns = useMemo(() => {
    const key = columnViewScopedKey || columnView;
    const viewColumns = key && columnView !== 'none'
      ? (form.allowedColumnsByView?.[key] || form.allowedColumnsByView?.[columnView] || [])
      : [];
    const filterColumns = key && columnView !== 'none'
      ? (form.allowedFilterColumnsByView?.[key] || form.allowedFilterColumnsByView?.[columnView] || [])
      : [];
    const ruleColumns = key && columnView !== 'none'
      ? Object.keys(buildFilterValueMapFromRuleSet(form.filterValueRulesByView?.[key] || form.filterValueRulesByView?.[columnView] || {}))
      : [];

    return mergeUniqueColumns(
      dynamicColumns,
      form.allowedColumns?.[columnDatabase] || [],
      viewColumns,
      filterColumns,
      ruleColumns,
    );
  }, [
    dynamicColumns,
    form.allowedColumns,
    form.allowedColumnsByView,
    form.allowedFilterColumnsByView,
    form.filterValueRulesByView,
    columnDatabase,
    columnView,
    columnViewScopedKey,
  ]);

  const filteredDynamicColumns = useMemo(() => {
    const q = columnSearch.trim().toLowerCase();
    if (!q) return resolvedDynamicColumns;
    return resolvedDynamicColumns.filter((c) => c.toLowerCase().includes(q));
  }, [resolvedDynamicColumns, columnSearch]);

  const filteredDynamicColumnMeta = useMemo(() => {
    const indexByName = new Map(resolvedDynamicColumns.map((name, idx) => [name, idx]));
    return filteredDynamicColumns.map((name) => {
      const idx = indexByName.get(name) ?? 0;
      return {
        index: idx + 1,
        letter: toSheetColumnLetter(idx),
        name,
      };
    });
  }, [resolvedDynamicColumns, filteredDynamicColumns]);

  const selectedDbColumns = useMemo(() => {
    if (!columnDatabase) return [];
    return form.allowedColumns?.[columnDatabase] || [];
  }, [form.allowedColumns, columnDatabase]);

  const currentViewOverrideColumns = useMemo(() => {
    const key = columnViewScopedKey || columnView;
    if (!key || columnView === 'none') return [];
    return form.allowedColumnsByView?.[key] || form.allowedColumnsByView?.[columnView] || [];
  }, [form.allowedColumnsByView, columnViewScopedKey, columnView]);

  const activeFilterColumns = useMemo(() => {
    const key = columnViewScopedKey || columnView;
    if (!key || columnView === 'none') return [];
    return form.allowedFilterColumnsByView?.[key] || form.allowedFilterColumnsByView?.[columnView] || [];
  }, [form.allowedFilterColumnsByView, columnViewScopedKey, columnView]);

  const currentFilterValueRuleMap = useMemo(() => {
    const key = columnViewScopedKey || columnView;
    if (!key || columnView === 'none') return {};
    const ruleSet = form.filterValueRulesByView?.[key] || form.filterValueRulesByView?.[columnView] || {};
    return buildFilterValueMapFromRuleSet(ruleSet);
  }, [form.filterValueRulesByView, columnViewScopedKey, columnView]);

  const detectedMeta = useMemo(() => {
    if (!columnDatabase) return null;
    return detectedMetaByDb[columnDatabase] || null;
  }, [columnDatabase, detectedMetaByDb]);

  const canContinueStep = useMemo(() => {
    if (currentStep === 1) return (form.databases || []).length > 0;
    if (currentStep === 2) return (form.views || []).length > 0;
    if (currentStep === 3) return !columnDatabase || dynamicColumns.length === 0 || selectedDbColumns.length > 0;
    if (currentStep === 4) return true;
    return true;
  }, [currentStep, form.databases, form.views, columnDatabase, dynamicColumns.length, selectedDbColumns.length]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.email} ${u.role} ${(u.views || []).join(' ')} ${(u.databases || []).join(' ')}`.toLowerCase().includes(q));
  }, [users, search]);

  const openCreate = () => {
    const firstDb = availableDatabaseNames[0] || '';
    setIsCreating(true);
    setEditingEmail('');
    setForm({ ...buildInitialForm(), databases: firstDb ? [firstDb] : [] });
    setColumnDatabase(firstDb);
    setColumnView('none');
    setDynamicColumns([]);
    setShowForm(true);
    setCurrentStep(1);
    setColumnSearch('');
    setFeedback({ type: '', text: '' });
  };

  const openEdit = (u) => {
    setIsCreating(false);
    setEditingEmail(u.email);
    setForm(buildFormFromUser(u));
    setColumnDatabase((Array.isArray(u.databases) && u.databases[0]) || '');
    setColumnView('none');
    setDynamicColumns([]);
    setShowForm(true);
    setCurrentStep(1);
    setColumnSearch('');
    setFeedback({ type: '', text: '' });
  };

  const closeForm = () => {
    setIsCreating(false);
    setEditingEmail('');
    setForm(buildInitialForm());
    setColumnDatabase('');
    setColumnView('none');
    setDynamicColumns([]);
    setShowForm(false);
    setCurrentStep(1);
    setColumnSearch('');
    setFeedback({ type: '', text: '' });
  };

  const toggleDatabase = (db, checked) => {
    const next = checked
      ? Array.from(new Set([...(form.databases || []), db]))
      : (form.databases || []).filter((d) => d !== db);
    setForm((prev) => ({
      ...prev,
      databases: next,
      views: (prev.views || []).filter((name) => {
        const linked = allViews.find((v) => v.viewName === name);
        return linked ? next.includes(linked.database) : true;
      }),
      allowedColumns: Object.fromEntries(Object.entries(prev.allowedColumns || {}).filter(([k]) => next.includes(k))),
    }));
    if (!next.includes(columnDatabase)) { setColumnDatabase(next[0] || ''); setColumnView('none'); }
  };

  const toggleView = (name, checked) => setForm((prev) => ({
    ...prev,
    views: checked ? Array.from(new Set([...(prev.views || []), name])) : (prev.views || []).filter((v) => v !== name),
  }));

  const togglePermission = (key, checked) => setForm((prev) => ({ ...prev, permissions: { ...prev.permissions, [key]: checked } }));
  const applyRoleDefaults = (role) => setForm((prev) => ({ ...prev, role, permissions: { ...ROLE_DEFAULTS[role] } }));

  const toggleAllowedColumn = (db, col, checked) => setForm((prev) => {
    const current = Array.isArray(prev.allowedColumns?.[db]) ? prev.allowedColumns[db] : [];
    return { ...prev, allowedColumns: { ...(prev.allowedColumns || {}), [db]: checked ? Array.from(new Set([...current, col])) : current.filter((c) => c !== col) } };
  });

  const toggleViewAllowedColumn = (viewKey, col, checked) => setForm((prev) => {
    const currentVisible = Array.isArray(prev.allowedColumnsByView?.[viewKey]) ? prev.allowedColumnsByView[viewKey] : [];
    const nextVisible = checked ? Array.from(new Set([...currentVisible, col])) : currentVisible.filter((c) => c !== col);

    const currentFilters = Array.isArray(prev.allowedFilterColumnsByView?.[viewKey]) ? prev.allowedFilterColumnsByView[viewKey] : [];
    const nextFilters = checked ? currentFilters : currentFilters.filter((c) => c !== col);

    const currentRuleSet = prev.filterValueRulesByView?.[viewKey] || {};
    const currentValueMap = buildFilterValueMapFromRuleSet(currentRuleSet);
    if (!checked) {
      delete currentValueMap[col];
    }
    const nextRuleSet = buildRuleSetFromFilterValueMap(nextFilters, currentValueMap);

    return {
      ...prev,
      allowedColumnsByView: { ...(prev.allowedColumnsByView || {}), [viewKey]: nextVisible },
      allowedFilterColumnsByView: { ...(prev.allowedFilterColumnsByView || {}), [viewKey]: nextFilters },
      filterValueRulesByView: { ...(prev.filterValueRulesByView || {}), [viewKey]: nextRuleSet },
    };
  });

  const toggleViewFilterColumn = (viewKey, col, checked) => setForm((prev) => {
    const current = Array.isArray(prev.allowedFilterColumnsByView?.[viewKey]) ? prev.allowedFilterColumnsByView[viewKey] : [];
    const nextAllowed = checked ? Array.from(new Set([...current, col])) : current.filter((c) => c !== col);

    const currentRuleSet = prev.filterValueRulesByView?.[viewKey] || {};
    const valueMap = buildFilterValueMapFromRuleSet(currentRuleSet);
    if (!checked) {
      delete valueMap[col];
    }

    const nextRulesByView = {
      ...(prev.filterValueRulesByView || {}),
      [viewKey]: buildRuleSetFromFilterValueMap(nextAllowed, valueMap),
    };

    return {
      ...prev,
      allowedFilterColumnsByView: { ...(prev.allowedFilterColumnsByView || {}), [viewKey]: nextAllowed },
      filterValueRulesByView: nextRulesByView,
    };
  });

  const setFilterValuesForColumn = (viewKey, column, values) => setForm((prev) => {
    const byView = { ...(prev.filterValueRulesByView || {}) };
    const current = byView[viewKey] || {};
    const allowed = Array.isArray(prev.allowedFilterColumnsByView?.[viewKey]) ? prev.allowedFilterColumnsByView[viewKey] : [];
    const valueMap = buildFilterValueMapFromRuleSet(current);
    valueMap[column] = (values || []).map((value) => String(value ?? '').trim()).filter(Boolean);
    byView[viewKey] = buildRuleSetFromFilterValueMap(allowed, valueMap);
    return { ...prev, filterValueRulesByView: byView };
  });

  useEffect(() => {
    const loadFilterValues = async () => {
      if (!columnDatabase || columnView === 'none' || activeFilterColumns.length === 0) {
        setFilterValueOptionsByColumn({});
        return;
      }

      setFilterValueLoading(true);
      try {
        const entries = await Promise.all(
          activeFilterColumns.map(async (column) => {
            const res = await getAdminFilterValuesRequest({ database: columnDatabase, view: columnView, column });
            return [column, Array.isArray(res?.values) ? res.values : []];
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
  }, [columnDatabase, columnView, activeFilterColumns]);

  const clearViewOverride = (viewKey) => setForm((prev) => {
    const byView = { ...(prev.allowedColumnsByView || {}) };
    const filterByView = { ...(prev.allowedFilterColumnsByView || {}) };
    const valueRulesByView = { ...(prev.filterValueRulesByView || {}) };
    delete byView[viewKey];
    delete filterByView[viewKey];
    delete valueRulesByView[viewKey];
    return {
      ...prev,
      allowedColumnsByView: byView,
      allowedFilterColumnsByView: filterByView,
      filterValueRulesByView: valueRulesByView,
    };
  });

  const handleSubmit = async () => {
    const payload = {
      role: form.role, databases: form.databases, views: form.views, permissions: form.permissions,
      quota: {
        dailyWriteLimit: toSafeNumber(form.quota.dailyWriteLimit, DEFAULT_QUOTA.dailyWriteLimit),
        monthlyWriteLimit: toSafeNumber(form.quota.monthlyWriteLimit, DEFAULT_QUOTA.monthlyWriteLimit),
        totalWriteLimit: toSafeNumber(form.quota.totalWriteLimit, DEFAULT_QUOTA.totalWriteLimit),
        testWriteLimit: toSafeNumber(form.quota.testWriteLimit, DEFAULT_QUOTA.testWriteLimit),
        liveWriteLimit: toSafeNumber(form.quota.liveWriteLimit, DEFAULT_QUOTA.liveWriteLimit),
      },
      allowedColumns: form.allowedColumns || {},
      allowedColumnsByView: form.allowedColumnsByView || {},
      allowedFilterColumnsByView: form.allowedFilterColumnsByView || {},
      filterValueRulesByView: form.filterValueRulesByView || {},
    };

    try {
      setLoading(true);
      if (isCreating) {
        if (!form.email.trim() || !form.password.trim()) return setFeedback({ type: 'error', text: 'Email and password required' });
        await addUser(form.email.trim(), form.password, {
          viewNames: payload.views,
          role: payload.role,
          databases: payload.databases,
          permissions: payload.permissions,
          quota: payload.quota,
          allowedColumns: payload.allowedColumns,
          allowedColumnsByView: payload.allowedColumnsByView,
          allowedFilterColumnsByView: payload.allowedFilterColumnsByView,
          filterValueRulesByView: payload.filterValueRulesByView,
        });
        setFeedback({ type: 'success', text: `User ${form.email} created` });
      } else {
        await updateUserConfig(editingEmail, payload);
        setFeedback({ type: 'success', text: `${editingEmail} updated` });
      }
      await loadData(true);
      closeForm();
    } catch (error) {
      setFeedback({ type: 'error', text: getUiError(error, 'Operation failed') });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (email) => {
    if (!globalThis.confirm(`Delete user ${email}?`)) return;
    try {
      await deleteUser(email);
      setUsers((prev) => prev.filter((u) => u.email !== email));
    } catch (error) {
      setFeedback({ type: 'error', text: getUiError(error, 'Delete failed') });
    }
  };

  const handleResetPassword = async (email) => {
    const pw = globalThis.prompt(`New password for ${email}`);
    if (!pw) return;
    try {
      await resetPassword(email, pw);
      setFeedback({ type: 'success', text: `Password reset for ${email}` });
    } catch (error) {
      setFeedback({ type: 'error', text: getUiError(error, 'Reset failed') });
    }
  };

  const handleToggleStatus = async (u) => {
    try {
      const updated = await setUserStatus(u.email, u.disabled === true);
      setUsers((prev) => prev.map((x) => x.email === u.email ? updated : x));
    } catch (error) {
      setFeedback({ type: 'error', text: getUiError(error, 'Status update failed') });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage user accounts, permissions and data access</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> New User
        </Button>
      </div>

      {/* Feedback */}
      {feedback.text && (
        <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
          feedback.type === 'error' ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400' :
          'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
          <span>{feedback.text}</span>
          <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => setFeedback({ type: '', text: '' })}>✕</button>
        </div>
      )}

      {/* User form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              {isCreating ? 'Create User' : `Editing: ${editingEmail}`}
            </h2>
            <Button size="sm" variant="ghost" onClick={closeForm}>Cancel</Button>
          </div>

          <div className="p-4 md:p-6 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                '1. Select Database',
                '2. Select View',
                '3. Configure Columns',
                '4. Configure Filters',
                '5. Assign to User',
              ].map((label, idx) => {
                const step = idx + 1;
                const isActive = currentStep === step;
                const isDone = currentStep > step;
                return (
                  <button
                    key={label}
                    className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${isActive ? 'border-primary bg-primary/10 text-primary' : isDone ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-border text-muted-foreground hover:bg-muted/40'}`}
                    onClick={() => setCurrentStep(step)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {currentStep === 1 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <DbIcon className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Step 1: Select Database</h3>
                </div>
                <p className="text-xs text-muted-foreground">Choose one or more databases this user can access.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {availableDatabaseNames.map((db) => (
                    <label key={db} className={`flex items-center gap-2 text-xs cursor-pointer p-3 rounded-lg border transition-colors ${(form.databases || []).includes(db) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'}`}>
                      <Checkbox checked={(form.databases || []).includes(db)} onCheckedChange={(v) => toggleDatabase(db, v === true)} />
                      <span className="font-medium">{db}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Step 2: Select View</h3>
                </div>
                <p className="text-xs text-muted-foreground">Pick which views should be assigned from selected databases.</p>
                <div className="max-h-72 overflow-auto rounded-lg border border-border p-3 grid md:grid-cols-2 gap-2">
                  {availableViews.length === 0 ? (
                    <p className="text-xs text-muted-foreground col-span-full">No views available yet. Select databases in Step 1.</p>
                  ) : availableViews.map((v, i) => (
                    <label key={`${v.database}:${v.viewName}:${i}`} className={`flex items-center gap-2 text-xs cursor-pointer p-2 rounded ${form.views.includes(v.viewName) ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                      <Checkbox checked={(form.views || []).includes(v.viewName)} onCheckedChange={(checked) => toggleView(v.viewName, checked === true)} />
                      <span>{v.viewName} <span className="text-muted-foreground">({v.database})</span></span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Step 3: Configure Columns</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium">Database</Label>
                    <Select value={columnDatabase || 'none'} onValueChange={(v) => { setColumnDatabase(v === 'none' ? '' : v); setColumnView('none'); setColumnSearch(''); }}>
                      <SelectTrigger><SelectValue placeholder="Select database" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select database</SelectItem>
                        {(form.databases || []).map((db) => <SelectItem key={db} value={db}>{db}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Find Column</Label>
                    <Input placeholder="Search columns..." value={columnSearch} onChange={(e) => setColumnSearch(e.target.value)} />
                  </div>
                </div>

                {columnDatabase && detectedMeta ? (
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

                {columnDatabase ? (
                  <div className="rounded-lg border border-border overflow-hidden">
                    {dynamicColumns.length === 0 ? (
                      <div className="p-4 text-xs text-muted-foreground text-center">Loading or no columns found for this database.</div>
                    ) : (
                      <div className="max-h-72 overflow-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40 sticky top-0">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">#</th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Column</th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Name</th>
                              <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Visible</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {filteredDynamicColumnMeta.map((meta) => {
                              const col = meta.name;
                              const dbChecked = (form.allowedColumns?.[columnDatabase] || []).includes(col);
                              return (
                                <tr key={col} className={dbChecked ? 'bg-primary/5' : 'hover:bg-muted/20'}>
                                  <td className="px-3 py-2 font-medium">{meta.index}</td>
                                  <td className="px-3 py-2 font-medium">{meta.letter}</td>
                                  <td className="px-3 py-2 font-medium">{col}</td>
                                  <td className="px-3 py-2 text-center">
                                    <Checkbox checked={dbChecked} onCheckedChange={(v) => toggleAllowedColumn(columnDatabase, col, v === true)} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Choose a database first.</p>
                )}
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Step 4: Configure Filters</h3>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-medium">Database</Label>
                    <Select value={columnDatabase || 'none'} onValueChange={(v) => { setColumnDatabase(v === 'none' ? '' : v); setColumnView('none'); setColumnSearch(''); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select database</SelectItem>
                        {(form.databases || []).map((db) => <SelectItem key={db} value={db}>{db}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">View</Label>
                    <Select value={columnView} onValueChange={setColumnView}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select view</SelectItem>
                        {columnDatabaseViews
                          .filter((v) => (form.views || []).includes(v.viewName))
                          .map((v, i) => <SelectItem key={`${v.database}:${v.viewName}:${i}`} value={v.viewName}>{v.viewName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Find Column</Label>
                    <Input placeholder="Search columns..." value={columnSearch} onChange={(e) => setColumnSearch(e.target.value)} />
                  </div>
                </div>

                {columnDatabase && detectedMeta ? (
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

                {columnDatabase && columnView !== 'none' ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="px-3 py-2 border-b border-border bg-muted/30 text-xs text-muted-foreground">
                        Override for {columnView} • {currentViewOverrideColumns.length} view columns selected
                      </div>
                      <div className="max-h-72 overflow-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40 sticky top-0">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">#</th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Column</th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Name</th>
                              <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Visible</th>
                              <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Filter</th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Multiple Filter Values</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {filteredDynamicColumnMeta.map((meta) => {
                              const col = meta.name;
                              const scopedKey = columnViewScopedKey || columnView;
                              const viewChecked = (form.allowedColumnsByView?.[scopedKey] || form.allowedColumnsByView?.[columnView] || []).includes(col);
                              const filterChecked = (form.allowedFilterColumnsByView?.[scopedKey] || form.allowedFilterColumnsByView?.[columnView] || []).includes(col);
                              const selectedValues = Array.isArray(currentFilterValueRuleMap[col]) ? currentFilterValueRuleMap[col] : [];
                              const options = filterValueOptionsByColumn[col] || [];
                              const searchText = filterValueSearchByColumn[col] || '';
                              const filteredOptions = searchText
                                ? options.filter((opt) => String(opt).toLowerCase().includes(searchText.toLowerCase()))
                                : options;

                              return (
                                <tr key={col} className={filterChecked ? 'bg-amber-50 dark:bg-amber-950/20' : 'hover:bg-muted/20'}>
                                  <td className="px-3 py-2 font-medium">{meta.index}</td>
                                  <td className="px-3 py-2 font-medium">{meta.letter}</td>
                                  <td className="px-3 py-2 font-medium">{col}</td>
                                  <td className="px-3 py-2 text-center">
                                    <Checkbox checked={viewChecked} onCheckedChange={(v) => toggleViewAllowedColumn(scopedKey, col, v === true)} />
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <Checkbox checked={filterChecked} disabled={!viewChecked} onCheckedChange={(v) => toggleViewFilterColumn(scopedKey, col, v === true)} />
                                  </td>
                                  <td className="px-3 py-2">
                                    {!filterChecked ? (
                                      <span className="text-muted-foreground">-</span>
                                    ) : (
                                      <div className="space-y-2">
                                        <p className="text-[10px] font-semibold text-muted-foreground">Add Multiple Values</p>
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
                                                  setFilterValuesForColumn(
                                                    scopedKey,
                                                    col,
                                                    selectedValues.filter((item) => item !== value),
                                                  );
                                                }}
                                                aria-label={`Remove ${value}`}
                                              >
                                                <X className="h-3 w-3" />
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
                                              <label key={`${col}-opt-${option}`} className="flex items-center gap-2 text-xs cursor-pointer">
                                                <Checkbox
                                                  checked={optionChecked}
                                                  onCheckedChange={(checked) => {
                                                    const nextValues = checked === true
                                                      ? Array.from(new Set([...selectedValues, option]))
                                                      : selectedValues.filter((item) => item !== option);
                                                    setFilterValuesForColumn(scopedKey, col, nextValues);
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
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs font-semibold">Filter Value Isolation</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Position-based mapping is saved as FILTER_COLUMN[] and FILTER_VALUE[] for this user/view. Multiple values per column are enforced as IN conditions.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Select database + view from Step 1/2 to configure filter overrides.</p>
                )}

                {columnView !== 'none' && (
                  <div className="flex items-center justify-end">
                    <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => clearViewOverride(columnViewScopedKey || columnView)}>
                      Clear Override
                    </Button>
                  </div>
                )}
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Step 5: Assign to User</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Email *</Label>
                    <Input value={form.email} disabled={!isCreating} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="user@company.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Password {!isCreating && '(use Reset button to change)'}</Label>
                    <Input type="password" value={form.password} disabled={!isCreating} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder={isCreating ? 'Min 8 characters' : '—'} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Role</Label>
                  <Select value={form.role} onValueChange={applyRoleDefaults}>
                    <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Permissions</Label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {['read', 'write', 'export', 'dashboard', 'viewOnly'].map((key) => (
                      <label key={key} className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded-lg border border-border hover:bg-muted/30">
                        <Checkbox checked={Boolean(form.permissions?.[key])} onCheckedChange={(v) => togglePermission(key, v === true)} />
                        <span>{key}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Write Quotas</Label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[['dailyWriteLimit', 'Daily'], ['monthlyWriteLimit', 'Monthly'], ['totalWriteLimit', 'Total'], ['testWriteLimit', 'Test'], ['liveWriteLimit', 'Live']].map(([key, label]) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs font-medium">{label}</Label>
                        <Input type="number" min="0" value={form.quota?.[key] ?? 0} onChange={(e) => setForm((p) => ({ ...p, quota: { ...p.quota, [key]: e.target.value } }))} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                Step {currentStep} of 5
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={closeForm}>Cancel</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentStep((s) => Math.max(1, s - 1))} disabled={currentStep === 1} className="gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                {currentStep < 5 ? (
                  <Button size="sm" onClick={() => setCurrentStep((s) => Math.min(5, s + 1))} disabled={!canContinueStep} className="gap-1">
                    Next <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleSubmit} disabled={loading}>
                    {loading ? 'Saving...' : isCreating ? 'Create User' : 'Save Changes'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users, roles, views, databases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
          />
          <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">{filteredUsers.length} users</span>
        </div>

        {loadError ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <p className="text-xs text-muted-foreground mt-1">Your current data is kept intact. Try again in a few seconds.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={loadData}>
              Retry Loading
            </Button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-5 py-12 text-center text-muted-foreground text-sm">
            {loading ? 'Loading users...' : users.length === 0 ? 'No users found.' : 'No results match your search.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredUsers.map((u) => (
              <UserRow
                key={u.email}
                u={u}
                onEdit={openEdit}
                onDelete={handleDeleteUser}
                onResetPassword={handleResetPassword}
                onToggleStatus={handleToggleStatus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
