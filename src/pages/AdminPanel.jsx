import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { getAllViews } from "@/lib/userConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogOut, Trash2, Plus, User, Eye, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { Logger } from "@/lib/logger";

export default function AdminPanel() {
  const navigate = useNavigate();
  const {
    user,
    logout,
    getAllUsers,
    addUser,
    deleteUser,
    resetPassword,
    setUserStatus,
    getAuditLog,
  } = useAuth();
  const [users, setUsers] = useState([]);
  const [allViews, setAllViews] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "" });
  const [selectedUserViews, setSelectedUserViews] = useState({});

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }

    const views = getAllViews();
    setAllViews(views);

    const loadUsers = async () => {
      const currentUsers = await getAllUsers();
      setUsers(currentUsers);

      const selections = {};
      currentUsers.forEach((u) => {
        selections[u.email] = (u.views || []);
      });
      setSelectedUserViews(selections);

      const events = await getAuditLog(50);
      setAuditEvents(events);
    };

    loadUsers();
  }, [user]);

  const handleAddUser = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) {
      alert("Email aur password zaroori hain");
      return;
    }

    try {
      const created = await addUser(
        newUser.username,
        newUser.password,
        selectedUserViews[newUser.username] || [],
        'user',
        ['MEN_MATERIAL', 'LACE_GAYLE'],
      );

      setUsers((prev) => [...prev, created]);
      setNewUser({ username: "", password: "" });
      setShowAddForm(false);
      Logger.info(`User added: ${newUser.username}`);
    } catch (err) {
      alert(err.message);
    }
  };

  const refreshAudit = async () => {
    const events = await getAuditLog(50);
    setAuditEvents(events);
  };

  const handleDeleteUser = async (email) => {
    if (!confirm(`Delete user ${email}?`)) {
      return;
    }

    try {
      await deleteUser(email);
      setUsers((prev) => prev.filter((u) => u.email !== email));
      await refreshAudit();
    } catch (err) {
      alert(err.message);
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
      alert('Password reset successful');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (targetUser) => {
    try {
      const updated = await setUserStatus(targetUser.email, targetUser.disabled === true);
      setUsers((prev) => prev.map((u) => (u.email === targetUser.email ? updated : u)));
      await refreshAudit();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-xs text-muted-foreground mt-0.5">User aur View Management</p>
          </div>
          <div className="flex gap-2">
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
        {/* Add User Form */}
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4" /> Add New User
            </h2>
            <Button
              size="sm"
              variant={showAddForm ? "default" : "outline"}
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus className="h-4 w-4 mr-1" /> Add User
            </Button>
          </div>

          {showAddForm && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <Label className="text-sm mb-1 block">Username</Label>
                <Input
                  placeholder="e.g. user@het.local"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div>
                <Label className="text-sm mb-1 block">Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div>
                <Label className="text-sm mb-2 block">Views Assign Karo</Label>
                <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-2 bg-white rounded border border-border">
                  {allViews.map(view => (
                    <label key={view.viewName} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={(selectedUserViews[newUser.username] || []).includes(view.viewName)}
                        onCheckedChange={(checked) => {
                          const current = selectedUserViews[newUser.username] || [];
                          const updated = checked
                            ? [...current, view.viewName]
                            : current.filter((v) => v !== view.viewName);
                          setSelectedUserViews((prev) => ({ ...prev, [newUser.username]: updated }));
                        }}
                      />
                      <span>{view.viewName}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleAddUser} className="bg-primary">
                  Create User
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Username</TableHead>
                <TableHead className="text-xs font-semibold">Role</TableHead>
                <TableHead className="text-xs font-semibold">Views</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold w-[220px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.email} className="hover:bg-muted/30">
                  <TableCell className="text-sm font-medium">{u.email}</TableCell>
                  <TableCell className="text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                      {u.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md">
                    <div className="flex flex-wrap gap-1">
                      {(u.views || []).slice(0, 3).map(v => (
                        <span key={v} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                          {v}
                        </span>
                      ))}
                      {(u.views || []).length > 3 && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                          +{(u.views || []).length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${u.disabled ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {u.disabled ? 'disabled' : 'enabled'}
                    </span>
                  </TableCell>
                  <TableCell className="flex gap-2">
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
            {allViews.map(view => (
              <div key={view.viewName} className="p-3 rounded-lg bg-muted/40 border border-border text-xs">
                <p className="font-medium">{view.viewName}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {view.database} • {view.columnsList.length} columns
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
