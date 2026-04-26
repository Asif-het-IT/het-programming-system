import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LogOut, Trash2, Plus, User, Eye, KeyRound, ShieldCheck, ShieldOff, PencilLine } from 'lucide-react';

const DATABASES = ['MEN_MATERIAL', 'LACE_GAYLE'];

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
    databases: ['MEN_MATERIAL'],
    views: [],
    permissions: { ...ROLE_DEFAULTS.user },
    quota: { ...DEFAULT_QUOTA },
    allowedColumns: {},
    allowedColumnsByView: {},
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

function findViewDatabase(allViews, viewName) {
  const view = allViews.find((item) => item.viewName === viewName);
  return view ? view.database : null;
}

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
  const [columnDatabase, setColumnDatabase] = useState('');
  const [columnView, setColumnView] = useState('none');
  const [dynamicColumns, setDynamicColumns] = useState([]);

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

  const columnDatabaseViews = useMemo(() => {
    if (!columnDatabase) return [];
    return availableViews.filter((view) => view.database === columnDatabase);
  }, [availableViews, columnDatabase]);

  const loadPageData = async () => {
    try {
      setLoading(true);
      const [currentUsers, viewsPayload, events] = await Promise.all([
        getAllUsers(),
        getAdminViews(),
        getAuditLog(50),
      ]);
      setUsers(currentUsers);
      setAllViews(viewsPayload);
      setAuditEvents(events);
    } catch (error) {
      setFeedback({ type: 'error', text: error?.message || 'Failed to load admin data' });
    } finally {
      setLoading(false);
    }
  };

  const refreshAudit = async () => {
    const events = await getAuditLog(50);
    setAuditEvents(events);
  };

  const openCreateForm = () => {
    setIsCreating(true);
    setEditingEmail('');
    setForm(buildInitialForm());
    setColumnDatabase('MEN_MATERIAL');
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
    setColumnDatabase('');
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

  const clearViewColumnOverride = (viewName) => {
    setForm((prev) => {
      const baseAllowedColumnsByView = prev.allowedColumnsByView && typeof prev.allowedColumnsByView === 'object'
        ? prev.allowedColumnsByView
        : {};
      const next = { ...baseAllowedColumnsByView };
      delete next[viewName];
      return {
        ...prev,
        allowedColumnsByView: next,
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

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Account setup, permissions, scopes and quotas</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="default" onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-1" /> New User
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
          <div className={`rounded-md border px-3 py-2 text-sm ${resolveFeedbackClass(feedback.type)}`}>
            {feedback.text}
          </div>
        ) : null}

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
                {DATABASES.map((database) => (
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
                ) : availableViews.map((view) => (
                  <label key={`${view.database}:${view.viewName}`} className="flex items-center gap-2 text-xs">
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
                        {columnDatabaseViews.map((view) => (
                          <SelectItem key={`${view.database}:${view.viewName}`} value={view.viewName}>{view.viewName}</SelectItem>
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
                      const viewChecked = isViewOverrideActive
                        ? (form.allowedColumnsByView?.[columnView] || []).includes(columnName)
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
                                onCheckedChange={(checked) => toggleViewAllowedColumn(columnView, columnName, checked === true)}
                              />
                              <span>View override</span>
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
                    <Button size="sm" variant="outline" onClick={() => clearViewColumnOverride(columnView)}>
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
            {allViews.map((view) => (
              <div key={`${view.database}:${view.viewName}`} className="p-3 rounded-lg bg-muted/40 border border-border text-xs">
                <p className="font-medium">{view.viewName}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {view.database} • {(view.columnsList || []).length} columns
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
