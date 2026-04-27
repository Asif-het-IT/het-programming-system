import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import HetLogo from '@/components/HetLogo';
import { LogOut, Trash2, Plus, User, Eye, KeyRound, ShieldCheck, ShieldOff, PencilLine, Bell, Send, Activity, RefreshCw, RotateCcw, Database, Server, Cloud, Monitor, Code, Table2, ChevronDown, ChevronUp, Trash } from 'lucide-react';
import {
  getNotificationSubscribersRequest,
  getNotificationLogsRequest,
  getNotificationStatusRequest,
  sendNotificationRequest,
  getMonitoringStatusRequest,
  getMonitoringLogsRequest,
  getMonitoringPerformanceRequest,
  getMonitoringLaceGayleViewsRequest,
  refreshMonitoringRequest,
  forceReloadMonitoringRequest,
  clearMonitoringLogsRequest,
  getAdminDatabasesRequest,
  createAdminDatabaseRequest,
  updateAdminDatabaseRequest,
  deleteAdminDatabaseRequest,
  detectAdminDatabaseColumnsRequest,
  getViewDefinitionsRequest,
  createViewDefinitionRequest,
  deleteViewDefinitionRequest,
} from '@/api/enterpriseApi';

function getUiError(error, fallbackMessage) {
  const message = error?.response?.data?.error || error?.response?.data?.message || error?.message || fallbackMessage;
  const detail = error?.response?.data
    ? JSON.stringify(error.response.data, null, 2)
    : (error?.stack || String(error?.message || 'unknown_error'));
  return { message, detail };
}

const ROLE_DEFAULTS = {
  admin: { read: true, write: true, export: true, dashboard: true, viewOnly: false },
  manager: { read: true, write: true, export: true, dashboard: true, viewOnly: false },
  user: { read: true, write: false, export: false, dashboard: false, viewOnly: true },
};

const DEFAULT_QUOTA = {
  dailyWriteLimit: 50,
  monthlyWriteLimit: 1000,
  totalWriteLimit: 10000,
  testWriteLimit: 100,
  liveWriteLimit: 10000,
};

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
  };
}

function buildFormFromUser(user) {
  const role = user.role || 'user';
  const permissions = user.permissions
    ? { ...ROLE_DEFAULTS[role], ...user.permissions }
    : { ...ROLE_DEFAULTS[role] };
  const quota = user.quota
    ? { ...DEFAULT_QUOTA, ...user.quota }
    : { ...DEFAULT_QUOTA };

  return {
    email: user.email,
    password: '',
    role,
    databases: Array.isArray(user.databases) ? user.databases : [],
    views: Array.isArray(user.views) ? user.views : [],
    permissions,
    quota,
    allowedColumns: user.allowedColumns && typeof user.allowedColumns === 'object' ? user.allowedColumns : {},
    allowedColumnsByView: user.allowedColumnsByView && typeof user.allowedColumnsByView === 'object' ? user.allowedColumnsByView : {},
    allowedFilterColumnsByView: user.allowedFilterColumnsByView && typeof user.allowedFilterColumnsByView === 'object' ? user.allowedFilterColumnsByView : {},
  };
}

function toSafeNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function resolveFeedbackClass(type) {
  if (type === 'error') return 'border-red-300 bg-red-50 text-red-700';
  if (type === 'success') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  return 'border-slate-300 bg-slate-50 text-slate-700';
}

function formatMs(value) {
  return value == null ? '—' : `${value} ms`;
}

function pluralizeSubscribers(count) {
  return count === 1 ? 'subscriber' : 'subscribers';
}

function formatReloadErrors(errors) {
  const details = errors.map(([db, info]) => `${db}: ${info.error}`).join('; ');
  return `Reload errors: ${details}`;
}

function getMonitorStatusMeta(status) {
  if (status === 'error') {
    return {
      cardClass: 'border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/20',
      badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
      label: '✗ Error',
    };
  }

  if (status === 'ok') {
    return {
      cardClass: 'border-green-400 dark:border-green-700 bg-green-50 dark:bg-green-950/20',
      badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
      label: '✓ Active',
    };
  }

  return {
    cardClass: 'border-border bg-muted/30',
    badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
    label: '⏳ Pending',
  };
}

function getSyncStatusClass(status) {
  if (status === 'success') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (status === 'error') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (status === 'cache_hit') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
}

function findViewDatabase(allViews, viewName) {
  const view = allViews.find((item) => item.viewName === viewName);
  return view ? view.database : null;
}

function makeScopedViewKey(database, viewName) {
  const db = String(database || '').trim().toUpperCase();
  const view = String(viewName || '').trim();
  if (!db || !view) return view;
  return `${db}::${view}`;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export default function AdminPanel() {
  const navigate = useNavigate();
  const {
    user,
    logout,
    getAllUsers,
    addUser,
    updateUserConfig,
    deleteUser,
    resetPassword,
    setUserStatus,
    getAuditLog,
    getAdminViews,
    getAdminColumns,
  } = useAuth();
  const [users, setUsers] = useState([]);
  const [allViews, setAllViews] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingEmail, setEditingEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(buildInitialForm());
  const [feedback, setFeedback] = useState({ type: 'info', text: '' });

  // Notification panel state
  const [notifSubscribers, setNotifSubscribers] = useState([]);
  const [notifLogs, setNotifLogs] = useState([]);
  const [notifVapidReady, setNotifVapidReady] = useState(false);
  const [notifForm, setNotifForm] = useState({
    title: '',
    body: '',
    link: '',
    priority: 'normal',
    type: 'admin_announcement',
    target: 'all',
    targetEmail: '',
    targetRole: 'user',
    targetDatabases: [],
    targetViews: [],
  });
  const [notifSending, setNotifSending] = useState(false);
  const [notifFeedback, setNotifFeedback] = useState({ type: 'info', text: '' });

  // Monitoring panel state
  const [monStatus, setMonStatus] = useState(null);
  const [monLogs, setMonLogs] = useState([]);
  const [monPerf, setMonPerf] = useState(null);
  const [monLoading, setMonLoading] = useState(false);
  const [monFeedback, setMonFeedback] = useState({ type: 'info', text: '' });
  const [monDebugOpen, setMonDebugOpen] = useState({});
  const [monLogFilter, setMonLogFilter] = useState({ database: '', status: '' });
  const [monLaceViews, setMonLaceViews] = useState([]);
  const [monViewSearch, setMonViewSearch] = useState('');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncIntervalMin, setAutoSyncIntervalMin] = useState(5);

  const [columnDatabase, setColumnDatabase] = useState('');
  const [columnView, setColumnView] = useState('none');
  const [dynamicColumns, setDynamicColumns] = useState([]);
  const [adminDatabases, setAdminDatabases] = useState([]);
  const [viewDefinitions, setViewDefinitions] = useState([]);
  const [detectedColumns, setDetectedColumns] = useState({});
  const [dbBuilderForm, setDbBuilderForm] = useState({
    name: '',
    displayName: '',
    sheetIdOrUrl: '',
    sheetName: 'Database',
    dataRange: 'A:AZ',
    primaryKey: '',
    bridgeUrl: '',
    apiToken: '',
    active: true,
  });
  const [editingDatabaseId, setEditingDatabaseId] = useState('');
  const [viewBuilderForm, setViewBuilderForm] = useState({
    viewName: '',
    database: '',
    selectedColumns: [],
    filterableColumns: [],
    filterRules: [],
    sortColumn: '',
    sortDirection: 'asc',
    active: true,
  });
  const [editingViewDefinitionId, setEditingViewDefinitionId] = useState('');
  const [viewColumnSearch, setViewColumnSearch] = useState('');
  const [adminDebugEnabled, setAdminDebugEnabled] = useState(false);
  const [adminDebugDetail, setAdminDebugDetail] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    loadPageData();
  }, [user, navigate]);

  const visibleUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) => {
      const haystack = `${u.email} ${u.role} ${(u.views || []).join(' ')} ${(u.databases || []).join(' ')}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [users, searchTerm]);

  const availableViews = useMemo(() => {
    const dbSet = new Set(form.databases || []);
    return allViews.filter((view) => dbSet.has(view.database));
  }, [allViews, form.databases]);

  const availableDatabaseNames = useMemo(() => {
    return (adminDatabases || []).filter((db) => db.active).map((db) => db.name);
  }, [adminDatabases]);

  const selectedBuilderColumns = useMemo(() => {
    return detectedColumns[viewBuilderForm.database] || [];
  }, [detectedColumns, viewBuilderForm.database]);

  const filteredBuilderColumns = useMemo(() => {
    const search = String(viewColumnSearch || '').trim().toLowerCase();
    if (!search) return selectedBuilderColumns;
    return selectedBuilderColumns.filter((column) => String(column).toLowerCase().includes(search));
  }, [selectedBuilderColumns, viewColumnSearch]);

  const selectedViewColumns = useMemo(() => viewBuilderForm.selectedColumns || [], [viewBuilderForm.selectedColumns]);
  const selectedFilterableColumns = useMemo(() => viewBuilderForm.filterableColumns || [], [viewBuilderForm.filterableColumns]);

  const selectedBuilderDatabaseConfig = useMemo(() => {
    return adminDatabases.find((db) => db.name === viewBuilderForm.database) || null;
  }, [adminDatabases, viewBuilderForm.database]);

  useEffect(() => {
    const dbName = viewBuilderForm.database;
    if (!dbName) return;
    if (Array.isArray(detectedColumns[dbName]) && detectedColumns[dbName].length > 0) return;
    handleDetectColumns(dbName);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewBuilderForm.database]);

  const columnDatabaseViews = useMemo(() => {
    if (!columnDatabase) return [];
    return availableViews.filter((view) => view.database === columnDatabase);
  }, [availableViews, columnDatabase]);

  const columnViewScopedKey = useMemo(() => {
    if (columnView === 'none') return '';
    return makeScopedViewKey(columnDatabase, columnView);
  }, [columnDatabase, columnView]);

  const loadPageData = async () => {
    try {
      setLoading(true);
      const [currentUsers, viewsPayload, events, dbPayload, viewDefPayload] = await Promise.all([
        getAllUsers(),
        getAdminViews(),
        getAuditLog(50),
        getAdminDatabasesRequest(),
        getViewDefinitionsRequest(),
      ]);
      setUsers(currentUsers);
      setAllViews(viewsPayload);
      setAuditEvents(events);
      setAdminDatabases(Array.isArray(dbPayload?.databases) ? dbPayload.databases : []);
      setViewDefinitions(Array.isArray(viewDefPayload?.views) ? viewDefPayload.views : []);
    } catch (error) {
      const uiError = getUiError(error, 'Failed to load admin data');
      setFeedback({ type: 'error', text: uiError.message });
      setAdminDebugDetail(uiError.detail);
    } finally {
      setLoading(false);
    }
  };

  const loadNotificationData = async () => {
    try {
      const [status, subs, logs] = await Promise.all([
        getNotificationStatusRequest(),
        getNotificationSubscribersRequest(),
        getNotificationLogsRequest(50),
      ]);
      setNotifVapidReady(Boolean(status?.vapidReady));
      setNotifSubscribers(subs?.subscribers || []);
      setNotifLogs(logs?.logs || []);
    } catch {
      // non-critical — don't break admin panel
    }
  };

  const loadMonitoringData = async () => {
    setMonLoading(true);
    try {
      const [statusRes, logsRes, perfRes, laceViewsRes] = await Promise.allSettled([
        getMonitoringStatusRequest(),
        getMonitoringLogsRequest({ limit: 100, ...(monLogFilter.database ? { database: monLogFilter.database } : {}), ...(monLogFilter.status ? { status: monLogFilter.status } : {}) }),
        getMonitoringPerformanceRequest(),
        getMonitoringLaceGayleViewsRequest(),
      ]);
      if (statusRes.status === 'fulfilled') setMonStatus(statusRes.value);
      if (logsRes.status === 'fulfilled') setMonLogs(logsRes.value?.logs || []);
      if (perfRes.status === 'fulfilled') setMonPerf(perfRes.value?.metrics || null);
      if (laceViewsRes.status === 'fulfilled') setMonLaceViews(laceViewsRes.value?.views || []);
    } catch {
      // non-critical
    } finally {
      setMonLoading(false);
    }
  };

  // Auto-sync effect
  React.useEffect(() => {
    if (!autoSyncEnabled) return;
    const id = setInterval(() => {
      loadMonitoringData();
    }, autoSyncIntervalMin * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncEnabled, autoSyncIntervalMin]);

  useEffect(() => {
    loadNotificationData();
    loadMonitoringData();
  }, []);

  const refreshAudit = async () => {
    const events = await getAuditLog(50);
    setAuditEvents(events);
  };

  const openCreateForm = () => {
    const firstDatabase = availableDatabaseNames[0] || '';
    setIsCreating(true);
    setEditingEmail('');
    setForm({ ...buildInitialForm(), databases: firstDatabase ? [firstDatabase] : [] });
    setColumnDatabase(firstDatabase);
    setColumnView('none');
    setDynamicColumns([]);
    setFeedback({ type: 'info', text: '' });
  };

  const openEditForm = (targetUser) => {
    setIsCreating(false);
    setEditingEmail(targetUser.email);
    setForm(buildFormFromUser(targetUser));
    setColumnDatabase((Array.isArray(targetUser.databases) && targetUser.databases[0]) || '');
    setColumnView('none');
    setDynamicColumns([]);
    setFeedback({ type: 'info', text: '' });
  };

  const clearForm = () => {
    setIsCreating(false);
    setEditingEmail('');
    setForm(buildInitialForm());
    setColumnDatabase(availableDatabaseNames[0] || '');
    setColumnView('none');
    setDynamicColumns([]);
  };

  const toggleDatabase = (database, checked) => {
    const nextDatabases = checked
      ? Array.from(new Set([...(form.databases || []), database]))
      : (form.databases || []).filter((d) => d !== database);

    setForm((prev) => ({
      ...prev,
      databases: nextDatabases,
      views: (prev.views || []).filter((name) => {
        const linkedDatabase = findViewDatabase(allViews, name);
        return linkedDatabase ? nextDatabases.includes(linkedDatabase) : true;
      }),
      allowedColumns: Object.fromEntries(
        Object.entries(prev.allowedColumns || {}).filter(([databaseKey]) => nextDatabases.includes(databaseKey)),
      ),
    }));

    if (!nextDatabases.includes(columnDatabase)) {
      setColumnDatabase(nextDatabases[0] || '');
      setColumnView('none');
      setDynamicColumns([]);
    }
  };

  useEffect(() => {
    if (!columnDatabase && (form.databases || []).length > 0) {
      setColumnDatabase(form.databases[0]);
    }
  }, [form.databases, columnDatabase]);

  useEffect(() => {
    const loadColumns = async () => {
      if (!columnDatabase) {
        setDynamicColumns([]);
        return;
      }

      const activeView = columnView === 'none'
        ? (columnDatabaseViews[0]?.viewName || '')
        : columnView;

      if (!activeView) {
        setDynamicColumns([]);
        return;
      }

      try {
        const columns = await getAdminColumns(columnDatabase, activeView);
        setDynamicColumns(columns);
      } catch {
        setDynamicColumns([]);
      }
    };

    if (isCreating || editingEmail) {
      loadColumns();
    }
  }, [columnDatabase, columnView, columnDatabaseViews, getAdminColumns, isCreating, editingEmail]);

  const toggleAllowedColumn = (database, columnName, checked) => {
    setForm((prev) => {
      const baseAllowedColumns = prev.allowedColumns && typeof prev.allowedColumns === 'object' ? prev.allowedColumns : {};
      const current = Array.isArray(prev.allowedColumns?.[database]) ? prev.allowedColumns[database] : [];
      const next = checked
        ? Array.from(new Set([...current, columnName]))
        : current.filter((item) => item !== columnName);

      return {
        ...prev,
        allowedColumns: {
          ...baseAllowedColumns,
          [database]: next,
        },
      };
    });
  };

  const toggleViewAllowedColumn = (viewName, columnName, checked) => {
    setForm((prev) => {
      const baseAllowedColumnsByView = prev.allowedColumnsByView && typeof prev.allowedColumnsByView === 'object'
        ? prev.allowedColumnsByView
        : {};
      const current = Array.isArray(prev.allowedColumnsByView?.[viewName]) ? prev.allowedColumnsByView[viewName] : [];
      const next = checked
        ? Array.from(new Set([...current, columnName]))
        : current.filter((item) => item !== columnName);

      return {
        ...prev,
        allowedColumnsByView: {
          ...baseAllowedColumnsByView,
          [viewName]: next,
        },
      };
    });
  };

  const toggleViewFilterAllowedColumn = (viewName, columnName, checked) => {
    setForm((prev) => {
      const baseAllowedFilterColumnsByView = prev.allowedFilterColumnsByView && typeof prev.allowedFilterColumnsByView === 'object'
        ? prev.allowedFilterColumnsByView
        : {};
      const current = Array.isArray(prev.allowedFilterColumnsByView?.[viewName]) ? prev.allowedFilterColumnsByView[viewName] : [];
      const next = checked
        ? Array.from(new Set([...current, columnName]))
        : current.filter((item) => item !== columnName);

      return {
        ...prev,
        allowedFilterColumnsByView: {
          ...baseAllowedFilterColumnsByView,
          [viewName]: next,
        },
      };
    });
  };

  const clearViewColumnOverride = (viewName) => {
    setForm((prev) => {
      const baseAllowedColumnsByView = prev.allowedColumnsByView && typeof prev.allowedColumnsByView === 'object'
        ? prev.allowedColumnsByView
        : {};
      const next = { ...baseAllowedColumnsByView };
      delete next[viewName];
      const baseAllowedFilterColumnsByView = prev.allowedFilterColumnsByView && typeof prev.allowedFilterColumnsByView === 'object'
        ? prev.allowedFilterColumnsByView
        : {};
      const nextFilter = { ...baseAllowedFilterColumnsByView };
      delete nextFilter[viewName];
      return {
        ...prev,
        allowedColumnsByView: next,
        allowedFilterColumnsByView: nextFilter,
      };
    });
  };

  const toggleView = (viewName, checked) => {
    setForm((prev) => {
      const current = prev.views || [];
      return {
        ...prev,
        views: checked
          ? Array.from(new Set([...current, viewName]))
          : current.filter((item) => item !== viewName),
      };
    });
  };

  const togglePermission = (key, checked) => {
    setForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: checked,
      },
    }));
  };

  const applyRoleDefaults = (role) => {
    setForm((prev) => ({
      ...prev,
      role,
      permissions: { ...ROLE_DEFAULTS[role] },
    }));
  };

  const submitForm = async () => {
    try {
      setLoading(true);
      const payload = {
        role: form.role,
        databases: form.databases,
        views: form.views,
        permissions: form.permissions,
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
      };

      if (isCreating) {
        if (!form.email.trim() || !form.password.trim()) {
          setFeedback({ type: 'error', text: 'Email and password are required for creating user' });
          setLoading(false);
          return;
        }

        await addUser(
          form.email.trim(),
          form.password,
          {
            viewNames: payload.views,
            role: payload.role,
            databases: payload.databases,
            permissions: payload.permissions,
            quota: payload.quota,
            allowedColumns: payload.allowedColumns,
            allowedColumnsByView: payload.allowedColumnsByView,
            allowedFilterColumnsByView: payload.allowedFilterColumnsByView,
          },
        );
        setFeedback({ type: 'success', text: 'User created successfully' });
      } else if (editingEmail) {
        await updateUserConfig(editingEmail, payload);
        setFeedback({ type: 'success', text: 'User configuration updated' });
      }

      await loadPageData();
      clearForm();
    } catch (error) {
      setFeedback({ type: 'error', text: error?.message || 'Operation failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (email) => {
    if (!confirm(`Delete user ${email}?`)) {
      return;
    }

    try {
      await deleteUser(email);
      setUsers((prev) => prev.filter((u) => u.email !== email));
      await refreshAudit();
      setFeedback({ type: 'success', text: `Deleted ${email}` });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleResetPassword = async (email) => {
    const nextPassword = prompt(`Enter new password for ${email}`);
    if (!nextPassword) {
      return;
    }

    try {
      await resetPassword(email, nextPassword);
      await refreshAudit();
      setFeedback({ type: 'success', text: `Password reset: ${email}` });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleToggleStatus = async (targetUser) => {
    try {
      const updated = await setUserStatus(targetUser.email, targetUser.disabled === true);
      setUsers((prev) => prev.map((u) => (u.email === targetUser.email ? updated : u)));
      await refreshAudit();
      setFeedback({ type: 'success', text: `Status updated: ${targetUser.email}` });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleDetectColumns = async (databaseName) => {
    const db = adminDatabases.find((item) => item.name === databaseName || item.id === databaseName);
    if (!db) return;

    try {
      const payload = await detectAdminDatabaseColumnsRequest(db.id || db.name);
      setDetectedColumns((prev) => ({
        ...prev,
        [db.name]: Array.isArray(payload?.columns) ? payload.columns : [],
      }));
      setFeedback({ type: 'success', text: `Columns detected for ${db.name}` });
      setAdminDebugDetail('');
    } catch (error) {
      const uiError = getUiError(error, 'Column detection failed');
      setFeedback({ type: 'error', text: uiError.message });
      setAdminDebugDetail(uiError.detail);
    }
  };

  const handleCreateDatabase = async () => {
    try {
      if (!dbBuilderForm.name.trim()) {
        setFeedback({ type: 'error', text: 'Database name is required' });
        return;
      }

      if (editingDatabaseId) {
        await updateAdminDatabaseRequest(editingDatabaseId, dbBuilderForm);
      } else {
        await createAdminDatabaseRequest(dbBuilderForm);
      }
      const dbPayload = await getAdminDatabasesRequest();
      setAdminDatabases(Array.isArray(dbPayload?.databases) ? dbPayload.databases : []);
      setDbBuilderForm({
        name: '',
        displayName: '',
        sheetIdOrUrl: '',
        sheetName: 'Database',
        dataRange: 'A:AZ',
        primaryKey: '',
        bridgeUrl: '',
        apiToken: '',
        active: true,
      });
      setEditingDatabaseId('');
      setFeedback({ type: 'success', text: editingDatabaseId ? 'Database updated successfully' : 'Database registered successfully' });
      setAdminDebugDetail('');
    } catch (error) {
      const uiError = getUiError(error, 'Unable to create database');
      setFeedback({ type: 'error', text: uiError.message });
      setAdminDebugDetail(uiError.detail);
    }
  };

  const handleEditDatabase = (database) => {
    setEditingDatabaseId(database.id || database.name);
    setDbBuilderForm({
      name: database.name || '',
      displayName: database.displayName || '',
      sheetIdOrUrl: database.sheetIdOrUrl || '',
      sheetName: database.sheetName || 'Database',
      dataRange: database.dataRange || 'A:AZ',
      primaryKey: database.primaryKey || '',
      bridgeUrl: database.bridgeUrl || '',
      apiToken: '',
      active: database.active !== false,
    });
    setFeedback({ type: 'info', text: `Editing database: ${database.name}` });
  };

  const handleToggleDatabaseActive = async (database) => {
    try {
      await updateAdminDatabaseRequest(database.id || database.name, { active: !database.active });
      const dbPayload = await getAdminDatabasesRequest();
      setAdminDatabases(Array.isArray(dbPayload?.databases) ? dbPayload.databases : []);
      setFeedback({ type: 'success', text: `${database.name} ${database.active ? 'deactivated' : 'activated'}` });
      setAdminDebugDetail('');
    } catch (error) {
      const uiError = getUiError(error, 'Unable to update database status');
      setFeedback({ type: 'error', text: uiError.message });
      setAdminDebugDetail(uiError.detail);
    }
  };

  const handleDeleteDatabase = async (database) => {
    if (!confirm(`Delete database ${database.name}?`)) return;
    try {
      await deleteAdminDatabaseRequest(database.id || database.name);
      const [dbPayload, viewPayload] = await Promise.all([getAdminDatabasesRequest(), getViewDefinitionsRequest()]);
      setAdminDatabases(Array.isArray(dbPayload?.databases) ? dbPayload.databases : []);
      setViewDefinitions(Array.isArray(viewPayload?.views) ? viewPayload.views : []);
      setFeedback({ type: 'success', text: `Database ${database.name} deleted` });
      setAdminDebugDetail('');
    } catch (error) {
      const uiError = getUiError(error, 'Unable to delete database');
      setFeedback({ type: 'error', text: uiError.message });
      setAdminDebugDetail(uiError.detail);
    }
  };

  const toggleViewBuilderColumn = (column, checked) => {
    setViewBuilderForm((prev) => {
      const nextColumns = checked
        ? Array.from(new Set([...(prev.selectedColumns || []), column]))
        : (prev.selectedColumns || []).filter((item) => item !== column);

      const nextFilterRules = (prev.filterRules || []).filter((rule) => nextColumns.includes(rule.column));
      const nextFilterable = (prev.filterableColumns || []).filter((item) => nextColumns.includes(item));
      return {
        ...prev,
        selectedColumns: nextColumns,
        filterableColumns: nextFilterable,
        filterRules: nextFilterRules,
        sortColumn: nextColumns.includes(prev.sortColumn) ? prev.sortColumn : '',
      };
    });
  };

  const selectVisibleColumns = () => {
    if (selectedBuilderColumns.length === 0) return;
    setViewBuilderForm((prev) => {
      const nextColumns = Array.from(new Set([...(prev.selectedColumns || []), ...selectedBuilderColumns]));
      return {
        ...prev,
        selectedColumns: nextColumns,
        sortColumn: nextColumns.includes(prev.sortColumn) ? prev.sortColumn : '',
      };
    });
  };

  const clearVisibleColumns = () => {
    setViewBuilderForm((prev) => {
      return {
        ...prev,
        selectedColumns: [],
        filterableColumns: [],
        filterRules: [],
        sortColumn: '',
      };
    });
  };

  const toggleViewFilterableColumn = (column, checked) => {
    setViewBuilderForm((prev) => {
      if (!(prev.selectedColumns || []).includes(column)) {
        return prev;
      }

      const nextFilterable = checked
        ? Array.from(new Set([...(prev.filterableColumns || []), column]))
        : (prev.filterableColumns || []).filter((item) => item !== column);

      return {
        ...prev,
        filterableColumns: nextFilterable,
      };
    });
  };

  const handleCreateViewDefinition = async () => {
    try {
      if (!viewBuilderForm.database) {
        setFeedback({ type: 'error', text: 'Select a database for the view' });
        return;
      }

      if (!viewBuilderForm.viewName.trim()) {
        setFeedback({ type: 'error', text: 'View name is required' });
        return;
      }

      if ((viewBuilderForm.selectedColumns || []).length === 0) {
        setFeedback({ type: 'error', text: 'Select at least one visible column' });
        return;
      }

      const sanitizedRules = (viewBuilderForm.filterRules || [])
        .filter((rule) => rule.column && String(rule.value || '').trim() !== '');
      const payload = {
        viewName: viewBuilderForm.viewName,
        database: viewBuilderForm.database,
        selectedColumns: viewBuilderForm.selectedColumns,
        filterableColumns: viewBuilderForm.filterableColumns,
        filterRules: sanitizedRules,
        sort: {
          column: viewBuilderForm.sortColumn || undefined,
          direction: viewBuilderForm.sortDirection || 'asc',
        },
        active: viewBuilderForm.active,
      };

      if (editingViewDefinitionId) {
        await updateViewDefinitionRequest(editingViewDefinitionId, payload);
      } else {
        await createViewDefinitionRequest(payload);
      }

      const [viewsPayload, adminViewsPayload] = await Promise.all([getViewDefinitionsRequest(), getAdminViews()]);
      setViewDefinitions(Array.isArray(viewsPayload?.views) ? viewsPayload.views : []);
      setAllViews(Array.isArray(adminViewsPayload) ? adminViewsPayload : []);

      setViewBuilderForm({
        viewName: '',
        database: viewBuilderForm.database,
        selectedColumns: [],
        filterableColumns: [],
        filterRules: [],
        sortColumn: '',
        sortDirection: 'asc',
        active: true,
      });
      setEditingViewDefinitionId('');
      setFeedback({ type: 'success', text: editingViewDefinitionId ? 'Dynamic view updated successfully' : 'Dynamic view created successfully' });
      setAdminDebugDetail('');
    } catch (error) {
      const uiError = getUiError(error, 'Unable to create dynamic view');
      setFeedback({ type: 'error', text: uiError.message });
      setAdminDebugDetail(uiError.detail);
    }
  };

  const handleEditViewDefinition = async (view) => {
    setEditingViewDefinitionId(view.id || '');
    setViewBuilderForm({
      viewName: view.viewName || '',
      database: view.database || '',
      selectedColumns: Array.isArray(view.selectedColumns) ? view.selectedColumns : [],
      filterableColumns: Array.isArray(view.filterableColumns) ? view.filterableColumns : [],
      filterRules: Array.isArray(view.filterRules) ? view.filterRules : [],
      sortColumn: view.sort?.column || '',
      sortDirection: view.sort?.direction || 'asc',
      active: view.active !== false,
    });
    if (view.database) {
      await handleDetectColumns(view.database);
    }
    setFeedback({ type: 'info', text: `Editing view: ${view.viewName}` });
  };

  const handleDeleteViewDefinition = async (id) => {
    if (!confirm('Delete this view definition?')) return;
    try {
      await deleteViewDefinitionRequest(id);
      const [viewsPayload, adminViewsPayload] = await Promise.all([getViewDefinitionsRequest(), getAdminViews()]);
      setViewDefinitions(Array.isArray(viewsPayload?.views) ? viewsPayload.views : []);
      setAllViews(Array.isArray(adminViewsPayload) ? adminViewsPayload : []);
      setFeedback({ type: 'success', text: 'View definition deleted' });
      setAdminDebugDetail('');
    } catch (error) {
      const uiError = getUiError(error, 'Unable to delete view definition');
      setFeedback({ type: 'error', text: uiError.message });
      setAdminDebugDetail(uiError.detail);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <HetLogo size={34} />
            <div>
              <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Account setup, permissions, scopes and quotas</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="default" onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-1" /> New User
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/about')}>
              About / System Info
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={() => { logout(); navigate("/"); }}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {feedback.text ? (
          <div className={`rounded-md border px-3 py-2 text-sm space-y-2 ${resolveFeedbackClass(feedback.type)}`}>
            <p>{feedback.text}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={loadPageData}>
                Retry Load
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdminDebugEnabled((prev) => !prev)}>
                {adminDebugEnabled ? 'Hide Debug' : 'Show Debug'}
              </Button>
            </div>
            {adminDebugEnabled && adminDebugDetail ? (
              <pre className="text-[11px] leading-4 max-h-40 overflow-auto rounded border border-slate-300 bg-white/70 p-2 whitespace-pre-wrap">{adminDebugDetail}</pre>
            ) : null}
          </div>
        ) : null}

        <div className="border border-border rounded-lg p-4 bg-card space-y-4">
          <h2 className="font-semibold text-sm">Dynamic Database Builder (Plug & Play Google Sheets)</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Database Name</Label>
              <Input value={dbBuilderForm.name} onChange={(e) => setDbBuilderForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="e.g. SALES_TRACKER" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Display Name</Label>
              <Input value={dbBuilderForm.displayName} onChange={(e) => setDbBuilderForm((prev) => ({ ...prev, displayName: e.target.value }))} placeholder="e.g. Sales Tracker" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Sheet Name</Label>
              <Input value={dbBuilderForm.sheetName} onChange={(e) => setDbBuilderForm((prev) => ({ ...prev, sheetName: e.target.value }))} placeholder="Database" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Data Range</Label>
              <Input value={dbBuilderForm.dataRange} onChange={(e) => setDbBuilderForm((prev) => ({ ...prev, dataRange: e.target.value }))} placeholder="A:AZ (continuous only)" />
              <p className="text-[11px] text-muted-foreground mt-1">Use continuous range only (for example A:H or A:AZ). Select specific columns in View Builder.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs mb-1 block">Google Sheet ID / URL</Label>
              <Input value={dbBuilderForm.sheetIdOrUrl} onChange={(e) => setDbBuilderForm((prev) => ({ ...prev, sheetIdOrUrl: e.target.value }))} placeholder="Sheet ID or full URL" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Bridge URL</Label>
              <Input value={dbBuilderForm.bridgeUrl} onChange={(e) => setDbBuilderForm((prev) => ({ ...prev, bridgeUrl: e.target.value }))} placeholder="https://script.google.com/..." />
            </div>
            <div>
              <Label className="text-xs mb-1 block">API Token</Label>
              <Input type="password" value={dbBuilderForm.apiToken} onChange={(e) => setDbBuilderForm((prev) => ({ ...prev, apiToken: e.target.value }))} placeholder="secret token" />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div>
              <Label className="text-xs mb-1 block">Primary Key (optional)</Label>
              <Input value={dbBuilderForm.primaryKey} onChange={(e) => setDbBuilderForm((prev) => ({ ...prev, primaryKey: e.target.value }))} placeholder="ENTRY_ID" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={dbBuilderForm.active} onCheckedChange={(checked) => setDbBuilderForm((prev) => ({ ...prev, active: checked === true }))} />
              <span>Active</span>
            </label>
            <div className="flex justify-end">
              <div className="flex gap-2">
                {editingDatabaseId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingDatabaseId('');
                      setDbBuilderForm({
                        name: '',
                        displayName: '',
                        sheetIdOrUrl: '',
                        sheetName: 'Database',
                        dataRange: 'A:AZ',
                        primaryKey: '',
                        bridgeUrl: '',
                        apiToken: '',
                        active: true,
                      });
                    }}
                  >
                    Cancel Edit
                  </Button>
                ) : null}
                <Button size="sm" onClick={handleCreateDatabase}>{editingDatabaseId ? 'Update Database' : 'Add Database'}</Button>
              </div>
            </div>
          </div>

          <div className="rounded border border-border p-3">
            <p className="text-xs font-medium mb-2">Registered Databases ({adminDatabases.length})</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
              {adminDatabases.map((db) => (
                <div key={db.id || db.name} className="rounded border border-border p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{db.name}</span>
                    <span className={`px-2 py-0.5 rounded ${db.active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {db.active ? 'active' : 'inactive'}
                    </span>
                  </div>
                  <p className="text-muted-foreground truncate">{db.sheetName} • {db.dataRange}</p>
                  <div className="flex gap-1 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDetectColumns(db.id || db.name)}>
                      Detect Columns
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleToggleDatabaseActive(db)}>
                      {db.active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleEditDatabase(db)}>
                      Edit
                    </Button>
                    {db.type !== 'legacy' && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => handleDeleteDatabase(db)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg p-4 bg-card space-y-4">
          <h2 className="font-semibold text-sm">Dynamic View Builder</h2>
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs mb-1 block">View Name</Label>
              <Input value={viewBuilderForm.viewName} onChange={(e) => setViewBuilderForm((prev) => ({ ...prev, viewName: e.target.value }))} placeholder="e.g. Dubai Active Orders" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Database</Label>
              <Select
                value={viewBuilderForm.database || 'none'}
                onValueChange={(value) => {
                  setEditingViewDefinitionId('');
                  setViewBuilderForm((prev) => ({
                    ...prev,
                    database: value === 'none' ? '' : value,
                    selectedColumns: [],
                    filterableColumns: [],
                    filterRules: [],
                    sortColumn: '',
                  }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select database</SelectItem>
                  {adminDatabases.filter((db) => db.active).map((db) => (
                    <SelectItem key={db.name} value={db.name}>{db.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Sort Column</Label>
              <Select value={viewBuilderForm.sortColumn || 'none'} onValueChange={(value) => setViewBuilderForm((prev) => ({ ...prev, sortColumn: value === 'none' ? '' : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No sort</SelectItem>
                  {selectedViewColumns.map((column) => (
                    <SelectItem key={`sort-${column}`} value={column}>{column}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Sort Direction</Label>
              <Select value={viewBuilderForm.sortDirection} onValueChange={(value) => setViewBuilderForm((prev) => ({ ...prev, sortDirection: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">asc</SelectItem>
                  <SelectItem value="desc">desc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => viewBuilderForm.database && handleDetectColumns(viewBuilderForm.database)}
              disabled={!viewBuilderForm.database}
            >
              Detect Columns
            </Button>
            <div className="text-[11px] text-muted-foreground flex items-center">
              Source Range: {selectedBuilderDatabaseConfig?.dataRange || '—'}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={viewBuilderForm.active} onCheckedChange={(checked) => setViewBuilderForm((prev) => ({ ...prev, active: checked === true }))} />
              <span>View Active</span>
            </label>
          </div>

          <div className="rounded border border-border p-3">
            <p className="text-xs font-medium mb-2">Column Control Panel (Visibility + Filter Toggles)</p>
            <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center">
              <Input
                value={viewColumnSearch}
                onChange={(e) => setViewColumnSearch(e.target.value)}
                className="h-8 text-xs"
                placeholder="Search columns"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={selectVisibleColumns}
                  disabled={selectedBuilderColumns.length === 0}
                >
                  Enable All Visible
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={clearVisibleColumns}
                  disabled={(viewBuilderForm.selectedColumns || []).length === 0}
                >
                  Disable All
                </Button>
              </div>
            </div>
            <div className="max-h-80 overflow-auto rounded border border-border">
              {selectedBuilderColumns.length === 0 ? (
                <p className="text-xs text-muted-foreground">No detected columns yet. Click Detect Columns.</p>
              ) : null}
              {selectedBuilderColumns.length > 0 && filteredBuilderColumns.length === 0 ? (
                <p className="text-xs text-muted-foreground">No columns matched your search.</p>
              ) : null}
              {selectedBuilderColumns.length > 0 && filteredBuilderColumns.length > 0
                ? (
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Column</th>
                        <th className="text-center px-3 py-2">Visible</th>
                        <th className="text-center px-3 py-2">Filter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBuilderColumns.map((column) => {
                        const isVisible = selectedViewColumns.includes(column);
                        const isFilterable = selectedFilterableColumns.includes(column);
                        return (
                          <tr key={`toggle-row-${column}`} className="border-t border-border">
                            <td className="px-3 py-2 font-medium">{column}</td>
                            <td className="px-3 py-2 text-center">
                              <Switch
                                checked={isVisible}
                                onCheckedChange={(checked) => toggleViewBuilderColumn(column, checked === true)}
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Switch
                                checked={isFilterable}
                                disabled={!isVisible}
                                onCheckedChange={(checked) => toggleViewFilterableColumn(column, checked === true)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
                : null}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Visible ON controls dashboard columns. Filter ON controls which filter inputs appear in dashboard.</p>
          </div>

          <div className="flex justify-end">
            <div className="flex gap-2">
              {editingViewDefinitionId ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingViewDefinitionId('');
                    setViewBuilderForm((prev) => ({
                      ...prev,
                      viewName: '',
                      selectedColumns: [],
                      filterableColumns: [],
                      filterRules: [],
                      sortColumn: '',
                      sortDirection: 'asc',
                      active: true,
                    }));
                  }}
                >
                  Cancel Edit
                </Button>
              ) : null}
              <Button size="sm" onClick={handleCreateViewDefinition}>
                {editingViewDefinitionId ? 'Update Dynamic View' : 'Create Dynamic View'}
              </Button>
            </div>
          </div>

          <div className="rounded border border-border p-3">
            <p className="text-xs font-medium mb-2">Configured Dynamic Views ({viewDefinitions.length})</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
              {viewDefinitions.map((view) => (
                <div key={view.id} className="rounded border border-border p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{view.viewName}</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => handleEditViewDefinition(view)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-red-600" onClick={() => handleDeleteViewDefinition(view.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-1">{view.database}</p>
                  <p className="text-muted-foreground">Columns: {(view.selectedColumns || []).length} • Filterable: {(view.filterableColumns || []).length}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {(isCreating || editingEmail) && (
          <div className="border border-border rounded-lg p-4 bg-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" /> {isCreating ? 'Create User' : `Edit User: ${editingEmail}`}
              </h2>
              <Button size="sm" variant="ghost" onClick={clearForm}>Close</Button>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm mb-1 block">Email</Label>
                <Input value={form.email} disabled={!isCreating} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
              </div>
              <div>
                <Label className="text-sm mb-1 block">Password {isCreating ? '' : '(optional, use reset button below table)'}</Label>
                <Input type="password" value={form.password} disabled={!isCreating} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="text-sm mb-1 block">Role</Label>
              <Select value={form.role} onValueChange={applyRoleDefaults}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="manager">manager</SelectItem>
                  <SelectItem value="user">user</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Databases</Label>
              <div className="grid sm:grid-cols-2 gap-3">
                {availableDatabaseNames.map((database) => (
                  <label key={database} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={(form.databases || []).includes(database)} onCheckedChange={(checked) => toggleDatabase(database, checked === true)} />
                    <span>{database}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Views (dynamic from GAS settings)</Label>
              <div className="max-h-44 overflow-auto rounded border border-border p-3 grid md:grid-cols-2 gap-2">
                {availableViews.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No views available for selected database(s).</p>
                ) : availableViews.map((view, idx) => (
                  <label key={`${view.database}:${view.viewName}:${idx}`} className="flex items-center gap-2 text-xs">
                    <Checkbox checked={(form.views || []).includes(view.viewName)} onCheckedChange={(checked) => toggleView(view.viewName, checked === true)} />
                    <span>{view.viewName} ({view.database})</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Permissions</Label>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 text-sm">
                {['read', 'write', 'export', 'dashboard', 'viewOnly'].map((key) => (
                  <label key={key} className="flex items-center gap-2">
                    <Checkbox checked={Boolean(form.permissions?.[key])} onCheckedChange={(checked) => togglePermission(key, checked === true)} />
                    <span>{key}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Column Access / Field Visibility</Label>
              <div className="space-y-3 rounded border border-border p-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">Database</Label>
                    <Select value={columnDatabase || 'none'} onValueChange={(value) => {
                      if (value === 'none') {
                        setColumnDatabase('');
                        setColumnView('none');
                        return;
                      }
                      setColumnDatabase(value);
                      setColumnView('none');
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select database</SelectItem>
                        {(form.databases || []).map((database) => (
                          <SelectItem key={database} value={database}>{database}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">View Override (Optional)</Label>
                    <Select value={columnView} onValueChange={setColumnView}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Use database-level only</SelectItem>
                        {columnDatabaseViews.map((view, idx) => (
                          <SelectItem key={`${view.database}:${view.viewName}:${idx}`} value={view.viewName}>{view.viewName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {columnDatabase ? (
                  <div className="max-h-48 overflow-auto rounded border border-border p-2 grid md:grid-cols-2 gap-2">
                    {dynamicColumns.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No dynamic columns found for selected database/view.</p>
                    ) : dynamicColumns.map((columnName) => {
                      const dbChecked = (form.allowedColumns?.[columnDatabase] || []).includes(columnName);
                      let isViewOverrideActive = true;
                      if (columnView === 'none') {
                        isViewOverrideActive = false;
                      }
                      const scopedViewKey = columnViewScopedKey || columnView;
                      const viewChecked = isViewOverrideActive
                        ? ((form.allowedColumnsByView?.[scopedViewKey] || form.allowedColumnsByView?.[columnView] || []).includes(columnName))
                        : false;
                      const viewFilterChecked = isViewOverrideActive
                        ? ((form.allowedFilterColumnsByView?.[scopedViewKey] || form.allowedFilterColumnsByView?.[columnView] || []).includes(columnName))
                        : false;

                      return (
                        <div key={columnName} className="rounded border border-border p-2">
                          <p className="text-xs font-medium truncate">{columnName}</p>
                          <label className="flex items-center gap-2 text-xs mt-1">
                            <Checkbox
                              checked={dbChecked}
                              onCheckedChange={(checked) => toggleAllowedColumn(columnDatabase, columnName, checked === true)}
                            />
                            <span>Database-level</span>
                          </label>
                          {isViewOverrideActive && (
                            <label className="flex items-center gap-2 text-xs mt-1">
                              <Checkbox
                                checked={viewChecked}
                                onCheckedChange={(checked) => toggleViewAllowedColumn(scopedViewKey, columnName, checked === true)}
                              />
                              <span>View override</span>
                            </label>
                          )}
                          {isViewOverrideActive && (
                            <label className="flex items-center gap-2 text-xs mt-1">
                              <Checkbox
                                checked={viewFilterChecked}
                                disabled={!viewChecked}
                                onCheckedChange={(checked) => toggleViewFilterAllowedColumn(scopedViewKey, columnName, checked === true)}
                              />
                              <span>Filter override</span>
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Select a database to configure field visibility.</p>
                )}

                {columnView !== 'none' && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Override active for: {columnView}</span>
                    <Button size="sm" variant="outline" onClick={() => clearViewColumnOverride(columnViewScopedKey || columnView)}>
                      Clear Override
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Write Quotas</Label>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  ['dailyWriteLimit', 'Daily'],
                  ['monthlyWriteLimit', 'Monthly'],
                  ['totalWriteLimit', 'Total'],
                  ['testWriteLimit', 'Test'],
                  ['liveWriteLimit', 'Live'],
                ].map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-xs mb-1 block">{label}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.quota?.[key] ?? 0}
                      onChange={(e) => setForm((prev) => ({
                        ...prev,
                        quota: { ...prev.quota, [key]: e.target.value },
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={submitForm} disabled={loading}>{isCreating ? 'Create User' : 'Save Changes'}</Button>
              <Button size="sm" variant="outline" onClick={clearForm}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Users</h2>
            <Input placeholder="Search users, roles, views, databases" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Username</TableHead>
                <TableHead className="text-xs font-semibold">Role</TableHead>
                <TableHead className="text-xs font-semibold">Databases</TableHead>
                <TableHead className="text-xs font-semibold">Views</TableHead>
                <TableHead className="text-xs font-semibold">Permissions</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold w-[220px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.map((u) => (
                <TableRow key={u.email} className="hover:bg-muted/30">
                  <TableCell className="text-sm font-medium">{u.email}</TableCell>
                  <TableCell className="text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                      {u.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{(u.databases || []).join(', ') || 'None'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md">
                    <div className="flex flex-wrap gap-1">
                      {(u.views || []).slice(0, 2).map((v) => (
                        <span key={v} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                          {v}
                        </span>
                      ))}
                      {(u.views || []).length > 2 && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                          +{(u.views || []).length - 2}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {Object.entries(u.permissions || {})
                      .filter(([, enabled]) => enabled === true)
                      .map(([key]) => key)
                      .join(', ') || 'None'}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${u.disabled ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {u.disabled ? 'disabled' : 'enabled'}
                    </span>
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditForm(u)}
                      className="h-8 px-2"
                    >
                      <PencilLine className="h-4 w-4" />
                    </Button>
                    {u.role !== 'admin' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(u)}
                          className="h-8 px-2"
                        >
                          {u.disabled ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResetPassword(u.email)}
                          className="h-8 px-2"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {u.role !== 'admin' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteUser(u.email)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="border border-border rounded-lg p-4 bg-card">
          <h3 className="font-semibold text-sm mb-3">Audit Log (Latest 50)</h3>
          <div className="max-h-64 overflow-auto rounded border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Actor</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                  <TableHead className="text-xs">Target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-xs text-muted-foreground">No admin actions logged yet.</TableCell>
                  </TableRow>
                ) : (
                  auditEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(event.at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{event.actor}</TableCell>
                      <TableCell className="text-xs">{event.action}</TableCell>
                      <TableCell className="text-xs">{event.target}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* All Views Reference */}
        <div className="border border-border rounded-lg p-4 bg-card">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4" /> Available Views ({allViews.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allViews.map((view, idx) => (
              <div key={`${view.database}:${view.viewName}:${idx}`} className="p-3 rounded-lg bg-muted/40 border border-border text-xs">
                <p className="font-medium">{view.viewName}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {view.database} • {(view.columnsList || []).length} columns
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Push Notifications Panel */}
        <div className="border border-border rounded-lg p-4 bg-card space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Bell className="h-4 w-4" /> Push Notifications
            </h3>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${notifVapidReady ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                {notifVapidReady ? 'VAPID ready' : 'VAPID not configured'}
              </span>
              <span className="text-xs text-muted-foreground">{notifSubscribers.length} {pluralizeSubscribers(notifSubscribers.length)}</span>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={loadNotificationData}>Refresh</Button>
            </div>
          </div>

          {/* Send Notification Form */}
          <div className="rounded-md border border-border p-4 bg-muted/20 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Send Notification</p>

            {notifFeedback.text && (
              <p className={`text-xs px-3 py-2 rounded ${notifFeedback.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                {notifFeedback.text}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Title *</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="Notification title"
                  value={notifForm.title}
                  onChange={(e) => setNotifForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <Select value={notifForm.priority} onValueChange={(v) => setNotifForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Message *</Label>
              <Input
                className="h-8 text-sm"
                placeholder="Notification message body"
                value={notifForm.body}
                onChange={(e) => setNotifForm((f) => ({ ...f, body: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Link (optional)</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="/dashboard"
                  value={notifForm.link}
                  onChange={(e) => setNotifForm((f) => ({ ...f, link: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Send To</Label>
                <Select value={notifForm.target} onValueChange={(v) => setNotifForm((f) => ({ ...f, target: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subscribers</SelectItem>
                    <SelectItem value="email">Specific email</SelectItem>
                    <SelectItem value="role">By role</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {notifForm.target === 'email' && (
              <div className="space-y-1">
                <Label className="text-xs">Target Email</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="user@example.com"
                  value={notifForm.targetEmail}
                  onChange={(e) => setNotifForm((f) => ({ ...f, targetEmail: e.target.value }))}
                />
              </div>
            )}

            {notifForm.target === 'role' && (
              <div className="space-y-1">
                <Label className="text-xs">Target Role</Label>
                <Select value={notifForm.targetRole} onValueChange={(v) => setNotifForm((f) => ({ ...f, targetRole: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              size="sm"
              className="gap-2"
              disabled={notifSending || !notifForm.title.trim() || !notifForm.body.trim()}
              onClick={async () => {
                setNotifSending(true);
                setNotifFeedback({ type: 'info', text: '' });
                try {
                  const payload = {
                    title: notifForm.title.trim(),
                    body: notifForm.body.trim(),
                    priority: notifForm.priority,
                    type: notifForm.type,
                    target: notifForm.target,
                    ...(notifForm.link.trim() ? { link: notifForm.link.trim() } : {}),
                    ...(notifForm.target === 'email' ? { targetEmail: notifForm.targetEmail } : {}),
                    ...(notifForm.target === 'role' ? { targetRole: notifForm.targetRole } : {}),
                  };
                  const result = await sendNotificationRequest(payload);
                  setNotifFeedback({
                    type: 'success',
                    text: `Sent to ${result.recipientCount} subscriber(s). Delivered: ${result.delivered}, Failed: ${result.failed}`,
                  });
                  setNotifForm((f) => ({ ...f, title: '', body: '', link: '' }));
                  await loadNotificationData();
                } catch (err) {
                  setNotifFeedback({ type: 'error', text: err?.response?.data?.error || err?.message || 'Send failed' });
                } finally {
                  setNotifSending(false);
                }
              }}
            >
              <Send className="h-4 w-4" />
              {notifSending ? 'Sending...' : 'Send Notification'}
            </Button>
          </div>

          {/* Notification Log */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Notification History</p>
            <div className="overflow-auto max-h-64 rounded border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Time</TableHead>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs">Target</TableHead>
                    <TableHead className="text-xs">Priority</TableHead>
                    <TableHead className="text-xs">Sent / Failed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-xs text-muted-foreground">No notifications sent yet.</TableCell>
                    </TableRow>
                  ) : (
                    notifLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(log.sentAt || log.at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{log.title}</TableCell>
                        <TableCell className="text-xs">{log.target}</TableCell>
                        <TableCell className="text-xs capitalize">{log.priority}</TableCell>
                        <TableCell className="text-xs">{log.delivered} / {log.failed}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Subscribers List */}
          {notifSubscribers.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Active Subscribers</p>
              <div className="overflow-auto max-h-48 rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="text-xs">Subscribed</TableHead>
                      <TableHead className="text-xs">Last Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifSubscribers.map((sub) => (
                      <TableRow key={`${sub.email}-${sub.subscribedAt}`}>
                        <TableCell className="text-xs">{sub.email}</TableCell>
                        <TableCell className="text-xs capitalize">{sub.role}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(sub.subscribedAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{sub.lastSeen ? new Date(sub.lastSeen).toLocaleDateString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* ── Data Sources & Sync Monitoring ────────────────────────────────── */}
        <div className="border border-border rounded-lg p-4 bg-card space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" /> Data Sources &amp; Sync Monitoring
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Auto-sync toggle */}
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5"
                  checked={autoSyncEnabled}
                  onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                />
                <span>Auto-refresh every</span>
                <select
                  className="text-xs border border-border rounded px-1 py-0.5 bg-background"
                  value={autoSyncIntervalMin}
                  onChange={(e) => setAutoSyncIntervalMin(Number(e.target.value))}
                >
                  <option value={1}>1 min</option>
                  <option value={2}>2 min</option>
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                </select>
              </label>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={loadMonitoringData} disabled={monLoading}>
                <RefreshCw className={`h-3.5 w-3.5 ${monLoading ? 'animate-spin' : ''}`} />
                {monLoading ? 'Loading…' : 'Refresh'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-7"
                disabled={monLoading}
                onClick={async () => {
                  setMonLoading(true);
                  setMonFeedback({ type: 'info', text: '' });
                  try {
                    const res = await forceReloadMonitoringRequest();
                    const errors = Object.entries(res.results || {}).filter(([, v]) => v.status === 'error');
                    setMonFeedback({
                      type: errors.length ? 'error' : 'success',
                      text: errors.length
                        ? formatReloadErrors(errors)
                        : 'Cache cleared and all databases reloaded.',
                    });
                    await loadMonitoringData();
                  } catch (e) {
                    setMonFeedback({ type: 'error', text: e?.message || 'Force reload failed' });
                    setMonLoading(false);
                  }
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Force Reload
              </Button>
            </div>
          </div>

          {monFeedback.text && (
            <p className={`text-xs px-3 py-2 rounded ${monFeedback.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
              {monFeedback.text}
            </p>
          )}

          {/* Architecture Flow */}
          {monStatus?.architecture && (
            <div className="rounded-md border border-border p-3 bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Data Architecture</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {monStatus.architecture.map((node, idx) => (
                  <React.Fragment key={node.layer}>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${node.optional && !node.enabled ? 'border-dashed border-muted-foreground/40 text-muted-foreground/50' : 'border-border bg-card text-foreground'}`}>
                      {node.icon === 'monitor' && <Monitor className="h-3 w-3" />}
                      {node.icon === 'layers' && <Database className="h-3 w-3" />}
                      {node.icon === 'server' && <Server className="h-3 w-3" />}
                      {node.icon === 'cloud' && <Cloud className="h-3 w-3" />}
                      {node.icon === 'code' && <Code className="h-3 w-3" />}
                      {node.icon === 'table' && <Table2 className="h-3 w-3" />}
                      <span>{node.layer}</span>
                      {node.optional && !node.enabled && <span className="text-[10px] ml-1 opacity-60">(disabled)</span>}
                    </div>
                    {idx < monStatus.architecture.length - 1 && (
                      <span className="text-muted-foreground text-xs">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Per-database cards */}
          {monStatus?.databases && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(monStatus.databases).map(([db, info]) => {
                const statusMeta = getMonitorStatusMeta(info.status);
                return (
                <div key={db} className={`rounded-lg border p-4 space-y-3 ${statusMeta.cardClass}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-1.5">
                        <Database className="h-4 w-4" /> {db}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.badgeClass}`}>
                        {statusMeta.label}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs px-2"
                        onClick={async () => {
                          setMonFeedback({ type: 'info', text: '' });
                          try {
                            setMonLoading(true);
                            const r = await refreshMonitoringRequest(db);
                            const dbResult = r.results?.[db];
                            setMonFeedback({
                              type: dbResult?.status === 'ok' ? 'success' : 'error',
                              text: dbResult?.status === 'ok'
                                ? `${db} refreshed. ${dbResult.recordCount ?? ''} records.`
                                : `${db} error: ${dbResult?.error}`,
                            });
                            await loadMonitoringData();
                          } catch (e) {
                            setMonFeedback({ type: 'error', text: e?.message || 'Refresh failed' });
                            setMonLoading(false);
                          }
                        }}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="text-muted-foreground">Source Type</div>
                    <div className="font-medium">{info.sourceType || '—'}</div>
                    <div className="text-muted-foreground">Sheet ID</div>
                    <div className="font-medium break-all">{info.sourceSpreadsheetId || '—'}</div>
                    <div className="text-muted-foreground">Sheet Name</div>
                    <div className="font-medium">{info.sourceSheetName || '—'}</div>
                    {info.filterTypes && (
                      <>
                        <div className="text-muted-foreground">Filter Type</div>
                        <div className="font-medium">{info.filterTypes.join(', ')}</div>
                      </>
                    )}
                    <div className="text-muted-foreground">Records</div>
                    <div className="font-medium">{info.recordCount ?? '—'}</div>
                    <div className="text-muted-foreground">Last Sync</div>
                    <div className="font-medium">{info.lastSuccessAt ? new Date(info.lastSuccessAt).toLocaleString() : '—'}</div>
                    <div className="text-muted-foreground">Avg Response</div>
                    <div className="font-medium">{formatMs(info.avgDurationMs)}</div>
                    <div className="text-muted-foreground">Total Fetches</div>
                    <div className="font-medium">{info.totalFetches ?? 0}</div>
                    <div className="text-muted-foreground">Cache Hits</div>
                    <div className="font-medium">{info.cacheHits ?? 0}</div>
                    <div className="text-muted-foreground">Errors</div>
                    <div className={`font-medium ${(info.totalErrors ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{info.totalErrors ?? 0}</div>
                  </div>

                  {/* Error detail */}
                  {info.lastError && (
                    <div className="rounded bg-red-100 dark:bg-red-900/30 p-2 text-xs text-red-700 dark:text-red-400 space-y-1">
                      <p className="font-medium">Last Error</p>
                      <p className="break-all">{info.lastError}</p>
                      {info.lastErrorAt && <p className="text-red-500/70">{new Date(info.lastErrorAt).toLocaleString()}</p>}
                    </div>
                  )}

                  {/* Expandable debug info */}
                  <div>
                    <button
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setMonDebugOpen((prev) => ({ ...prev, [db]: !prev[db] }))}
                    >
                      {monDebugOpen[db] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      API Debug Info
                    </button>
                    {monDebugOpen[db] && (
                      <div className="mt-2 rounded bg-muted/50 border border-border p-2 text-xs space-y-1 font-mono break-all">
                        <p><span className="text-muted-foreground">GAS URL: </span>{info.gasUrl || '—'}</p>
                        <p><span className="text-muted-foreground">Proxy: </span>{info.proxyEnabled ? (monStatus.proxyUrl || 'enabled') : 'disabled (direct)'}</p>
                        <p><span className="text-muted-foreground">Cache TTL: </span>{info.cacheTtlMs ? `${info.cacheTtlMs / 1000}s` : '—'}</p>
                        <p><span className="text-muted-foreground">Layer: </span>{info.layerDescription || '—'}</p>
                        {monPerf?.[db] && (
                          <>
                            <p><span className="text-muted-foreground">P50 latency: </span>{formatMs(monPerf[db].p50DurationMs)}</p>
                            <p><span className="text-muted-foreground">P95 latency: </span>{formatMs(monPerf[db].p95DurationMs)}</p>
                            <p><span className="text-muted-foreground">Error rate: </span>{monPerf[db].errorRate}</p>
                            <p><span className="text-muted-foreground">Cache hit rate: </span>{monPerf[db].cacheHitRate}</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          )}

          {/* Performance Metrics Row */}
          {monPerf && (
            <div className="rounded-md border border-border p-3 bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Performance Metrics</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(monPerf).flatMap(([db, m]) => [
                  { label: `${db} — Avg`, value: formatMs(m.avgDurationMs) },
                  { label: `${db} — P95`, value: formatMs(m.p95DurationMs) },
                  { label: `${db} — Cache Hit`, value: m.cacheHitRate },
                  { label: `${db} — Error Rate`, value: m.errorRate },
                ]).map((metric) => (
                  <div key={metric.label} className="bg-card border border-border rounded p-2.5">
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="font-semibold text-sm mt-0.5">{metric.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync Logs Table */}
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sync Event Log</p>
              <div className="flex items-center gap-2">
                <select
                  className="text-xs border border-border rounded px-1.5 py-0.5 bg-background"
                  value={monLogFilter.database}
                  onChange={(e) => setMonLogFilter((f) => ({ ...f, database: e.target.value }))}
                >
                  <option value="">All Databases</option>
                  <option value="MEN_MATERIAL">MEN_MATERIAL</option>
                  <option value="LACE_GAYLE">LACE_GAYLE</option>
                </select>
                <select
                  className="text-xs border border-border rounded px-1.5 py-0.5 bg-background"
                  value={monLogFilter.status}
                  onChange={(e) => setMonLogFilter((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="">All Status</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                  <option value="cache_hit">Cache Hit</option>
                </select>
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2 gap-1" onClick={loadMonitoringData}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-2 gap-1 text-red-500 hover:text-red-600"
                  title="Clear logs"
                  onClick={async () => {
                    if (!confirm('Clear all sync logs?')) return;
                    await clearMonitoringLogsRequest();
                    await loadMonitoringData();
                  }}
                >
                  <Trash className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="overflow-auto max-h-64 rounded border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs whitespace-nowrap">Time</TableHead>
                    <TableHead className="text-xs">Database</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Duration</TableHead>
                    <TableHead className="text-xs">Records</TableHead>
                    <TableHead className="text-xs">Layer</TableHead>
                    <TableHead className="text-xs">Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-xs text-muted-foreground">
                        No sync events yet. Sync logs appear here after the first data fetch.
                      </TableCell>
                    </TableRow>
                  ) : (
                    monLogs
                      .filter((l) => {
                        const dbMatch = !monLogFilter.database || l.database === monLogFilter.database;
                        const statusMatch = !monLogFilter.status || l.status === monLogFilter.status;
                        return dbMatch && statusMatch;
                      })
                      .slice(0, 100)
                      .map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(log.at).toLocaleTimeString()}</TableCell>
                          <TableCell className="text-xs">{log.database}</TableCell>
                          <TableCell className="text-xs font-mono text-[11px]">{log.action}</TableCell>
                          <TableCell className="text-xs">
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getSyncStatusClass(log.status)}`}>
                              {log.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{formatMs(log.durationMs)}</TableCell>
                          <TableCell className="text-xs">{log.recordCount ?? '—'}</TableCell>
                          <TableCell className="text-xs">{log.layer || '—'}</TableCell>
                          <TableCell className="text-xs text-red-600 dark:text-red-400 max-w-[200px] truncate" title={log.error || ''}>
                            {log.error || ''}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* LACE_GAYLE per-view details */}
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">LACE_GAYLE Per-View Monitoring</p>
              <Input
                className="h-8 w-full md:w-72 text-sm"
                placeholder="Search outlet, MARKA_CODE, PRODUCT_CATEGORY"
                value={monViewSearch}
                onChange={(e) => setMonViewSearch(e.target.value)}
              />
            </div>
            <div className="overflow-auto max-h-72 rounded border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">View</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">MARKA_CODE</TableHead>
                    <TableHead className="text-xs">PRODUCT_CATEGORY</TableHead>
                    <TableHead className="text-xs">Sheet</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Records</TableHead>
                    <TableHead className="text-xs">Last Sync</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monLaceViews
                    .filter((view) => {
                      const q = monViewSearch.trim().toLowerCase();
                      if (!q) return true;
                      return [
                        view.viewName,
                        view.sheetType,
                        view.markaCode,
                        view.productCategory,
                        view.sourceSheetName,
                      ].some((value) => String(value || '').toLowerCase().includes(q));
                    })
                    .slice(0, 120)
                    .map((view) => (
                      <TableRow key={view.viewName}>
                        <TableCell className="text-xs min-w-[220px]">
                          <div>
                            <p className="font-medium">{view.viewName}</p>
                            {view.sourceUrl && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-[260px]" title={view.sourceUrl}>{view.sourceUrl}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{view.sheetType || '—'}</TableCell>
                        <TableCell className="text-xs">{view.markaCode || '—'}</TableCell>
                        <TableCell className="text-xs">{view.productCategory || '—'}</TableCell>
                        <TableCell className="text-xs">{view.sourceSheetName || '—'}</TableCell>
                        <TableCell className="text-xs">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getSyncStatusClass(view.lastSyncStatus)}`}>
                            {view.lastSyncStatus}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{view.recordCount ?? '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{view.lastSyncAt ? new Date(view.lastSyncAt).toLocaleString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  {monLaceViews.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-xs text-muted-foreground">No LACE_GAYLE per-view sync metadata yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

