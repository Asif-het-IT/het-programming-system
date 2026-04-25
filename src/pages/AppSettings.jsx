import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { motion } from "framer-motion";
import { Settings, User, Lock, LogOut, Eye, EyeOff, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AppSettings() {
  const { user, logout, updateUserPassword } = useAuth();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleChangePw = () => {
    setPwError("");
    setPwSuccess(false);
    if (!currentPw || !newPw || !confirmPw) { setPwError("All fields required"); return; }
    if (newPw !== confirmPw) { setPwError("New passwords do not match"); return; }
    if (newPw.length < 6) { setPwError("Password must be at least 6 characters"); return; }

    const ok = updateUserPassword(user.id, newPw, currentPw);
    if (ok === false) { setPwError("Current password is incorrect"); return; }
    setPwSuccess(true);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setTimeout(() => setPwSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" /> Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Account and application settings</p>
      </div>

      <div className="p-6 max-w-xl space-y-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Profile
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium block mb-1">Full Name</p>
              <div className="h-8 px-3 rounded-md border border-border bg-secondary flex items-center text-xs text-foreground">{user?.full_name || "—"}</div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium block mb-1">Email</p>
              <div className="h-8 px-3 rounded-md border border-border bg-secondary flex items-center text-xs text-muted-foreground font-mono">{user?.email || "—"}</div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium block mb-1">Role</p>
              <div className="h-8 px-3 rounded-md border border-border bg-secondary flex items-center">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${user?.role === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{user?.role || "—"}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" /> Change Password
          </h2>

          {pwError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg border border-rose-500/20">{pwError}</div>
          )}
          {pwSuccess && (
            <div className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> Password changed successfully
            </div>
          )}

          <div className="space-y-3">
            {[
              { key: "current", label: "Current Password", value: currentPw, set: setCurrentPw },
              { key: "new", label: "New Password", value: newPw, set: setNewPw },
              { key: "confirm", label: "Confirm New Password", value: confirmPw, set: setConfirmPw },
            ].map(({ key, label, value, set }) => (
              <div key={key} className="relative">
                <label htmlFor={`password-${key}`} className="text-[11px] text-muted-foreground font-medium block mb-1">{label}</label>
                <Input
                  id={`password-${key}`}
                  type={showPw ? "text" : "password"}
                  value={value}
                  onChange={e => set(e.target.value)}
                  className="h-8 text-xs bg-secondary border-border pr-8"
                  placeholder="••••••••"
                />
                {key === "current" && (
                  <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-2 top-6 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            ))}
          </div>
          <Button size="sm" onClick={handleChangePw} className="text-xs h-8 bg-primary hover:bg-primary/90">
            Update Password
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <LogOut className="h-4 w-4 text-rose-400" /> Sign Out
          </h2>
          <p className="text-xs text-muted-foreground mb-3">You will be redirected to the login page.</p>
          <Button variant="outline" size="sm" onClick={logout} className="text-xs h-8 border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
            <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign Out
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
