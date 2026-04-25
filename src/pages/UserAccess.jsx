import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useViewManager } from "@/lib/ViewManager";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Trash2, Eye, EyeOff, Shield, UserCheck, Columns, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
const DEFAULT_VIEW = { name: "", description: "", userId: "", fields: [] };

export default function UserAccess() {
  const { addUser, getUsers, deleteUser, updateUserPassword } = useAuth();
  const { listViews, createView, deleteView, assignViewToUser, removeViewFromUser, userMappings, AVAILABLE_FIELDS } = useViewManager();
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddView, setShowAddView] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: "", email: "", password: "", role: "user" });
  const [newView, setNewView] = useState(DEFAULT_VIEW);
  const [showPw, setShowPw] = useState(false);
  const [userError, setUserError] = useState("");
  const [changePwId, setChangePwId] = useState(null);
  const [newPw, setNewPw] = useState("");
  const [viewError, setViewError] = useState("");

  const users = getUsers();
  const views = listViews();
  const customViews = views.filter((v) => !v.is_system);

  const handleAddUser = async () => {
    setUserError("");
    if (!newUser.full_name || !newUser.email || !newUser.password) { setUserError("All fields required"); return; }
    if (users.find(u => u.email === newUser.email)) { setUserError("Email already exists"); return; }
    try {
      await addUser(newUser);
      setNewUser({ full_name: "", email: "", password: "", role: "user" });
      setShowAddUser(false);
    } catch (err) {
      setUserError(err.message || "Could not create user");
    }
  };

  const toggleField = (field) => {
    setNewView(v => ({
      ...v,
      fields: v.fields.includes(field) ? v.fields.filter(c => c !== field) : [...v.fields, field],
    }));
  };

  const handleAddView = async () => {
    setViewError('');
    if (!newView.name || newView.fields.length === 0) {
      setViewError('View name and at least one field are required');
      return;
    }

    try {
      const created = await createView({
        name: newView.name,
        description: newView.description,
        fields: newView.fields,
        filters: {},
        sort_field: '-sr',
        limit: 1000
      });

      if (newView.userId) {
        await assignViewToUser(newView.userId, created.id);
      }

      setShowAddView(false);
      setNewView(DEFAULT_VIEW);
    } catch (err) {
      setViewError(err.message || 'Could not create view');
    }
  };

  const handleRemoveAssignment = (userId, viewId) => {
    try {
      removeViewFromUser(userId, viewId);
    } catch (err) {
      setViewError(err.message || 'Could not remove assignment');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> User Access Management
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage users and their custom data views</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddView(s => !s)} className="text-xs h-8">
              <Columns className="h-3.5 w-3.5 mr-1.5" /> Add View
            </Button>
            <Button size="sm" onClick={() => setShowAddUser(s => !s)} className="text-xs h-8 bg-primary hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add User
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <AnimatePresence>
          {showAddUser && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary" />New User</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowAddUser(false)} className="h-6 w-6"><X className="h-3.5 w-3.5" /></Button>
              </div>
              {userError && <p className="text-xs text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg">{userError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">Full Name</label>
                  <Input value={newUser.full_name} onChange={e => setNewUser(u => ({ ...u, full_name: e.target.value }))} className="h-8 text-xs bg-secondary border-border" placeholder="John Doe" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">Email</label>
                  <Input type="email" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} className="h-8 text-xs bg-secondary border-border" placeholder="john@example.com" />
                </div>
                <div className="relative">
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">Password</label>
                  <Input type={showPw ? "text" : "password"} value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} className="h-8 text-xs bg-secondary border-border pr-8" placeholder="Min 6 chars" />
                  <button onClick={() => setShowPw(s => !s)} className="absolute right-2 top-6 text-muted-foreground">
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">Role</label>
                  <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                    className="h-8 w-full rounded-md border border-border bg-secondary px-2 text-xs text-foreground">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAddUser(false)} className="text-xs h-8">Cancel</Button>
                <Button size="sm" onClick={handleAddUser} className="text-xs h-8 bg-primary hover:bg-primary/90">Create User</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showAddView && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Columns className="h-4 w-4 text-amber-400" />New Custom View</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowAddView(false)} className="h-6 w-6"><X className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">View Name</label>
                  <Input value={newView.name} onChange={e => setNewView(v => ({ ...v, name: e.target.value }))} className="h-8 text-xs bg-secondary border-border" placeholder="e.g. Party Summary" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">Assign to User (email)</label>
                  <Input value={newView.userId} onChange={e => setNewView(v => ({ ...v, userId: e.target.value }))} className="h-8 text-xs bg-secondary border-border" placeholder="user@example.com" />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-medium block mb-1">Description</label>
                <Input value={newView.description} onChange={e => setNewView(v => ({ ...v, description: e.target.value }))} className="h-8 text-xs bg-secondary border-border" placeholder="View purpose" />
              </div>
              {viewError && <p className="text-xs text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg">{viewError}</p>}
              <div>
                <label className="text-[11px] text-muted-foreground font-medium block mb-2">
                  Select Fields ({newView.fields.length} selected)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {Object.entries(AVAILABLE_FIELDS).map(([fieldKey, fieldInfo]) => (
                    <button key={fieldKey} onClick={() => toggleField(fieldKey)}
                      className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${
                        newView.fields.includes(fieldKey)
                          ? "bg-primary/20 text-primary border-primary/40"
                          : "bg-secondary text-muted-foreground border-border hover:border-primary/30"
                      }`}>
                      {fieldInfo.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAddView(false)} className="text-xs h-8">Cancel</Button>
                <Button size="sm" onClick={handleAddView} className="text-xs h-8 bg-primary hover:bg-primary/90">Create View</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Users ({users.length})
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30">
                  {["Name", "Email", "Role", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} className="border-t border-border hover:bg-secondary/40">
                    <td className="px-4 py-3 font-medium text-foreground">{u.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-[10px]">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] px-1.5 py-0 ${u.role === "admin" ? "bg-primary/15 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"}`}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {changePwId === u.id ? (
                          <div className="flex items-center gap-1.5">
                            <Input type="password" placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)}
                              className="h-6 text-[10px] w-32 bg-secondary border-border" />
                            <Button size="sm" className="h-6 text-[10px] px-2 bg-primary hover:bg-primary/90"
                              onClick={async () => {
                                if (newPw) {
                                  try {
                                    await updateUserPassword(u.id, newPw);
                                    setChangePwId(null);
                                    setNewPw("");
                                  } catch (err) {
                                    setUserError(err.message || 'Password update failed');
                                  }
                                }
                              }}>
                              Save
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1" onClick={() => setChangePwId(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground hover:text-foreground px-2"
                            onClick={() => setChangePwId(u.id)}>
                            Change PW
                          </Button>
                        )}
                        {u.id !== "admin_001" && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-rose-400"
                            onClick={() => deleteUser(u.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" /> Custom Views ({customViews.length})
          </h2>
          {customViews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Columns className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">No custom views created yet</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    {["View Name", "Assigned To", "Columns", "Status", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customViews.map((v, i) => (
                    <tr key={v.id} className="border-t border-border hover:bg-secondary/40">
                      <td className="px-4 py-3 font-medium text-foreground">{v.name}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-[10px]">{Object.entries(userMappings).filter(([, ids]) => ids.includes(v.id)).map(([u]) => u).join(', ') || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{(v.fields || []).join(", ") || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                          Active
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground"
                            onClick={() => {
                              Object.entries(userMappings).forEach(([userId, ids]) => {
                                if (ids.includes(v.id)) {
                                  handleRemoveAssignment(userId, v.id);
                                }
                              });
                            }}>
                            Clear Assignments
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-rose-400"
                            onClick={() => deleteView(v.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
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
