import React, { useState } from "react";
import PropTypes from "prop-types";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Table2, Settings, RefreshCw, Users,
  ChevronLeft, ChevronRight, ShieldCheck, Menu, X, BarChart2, Briefcase, Database, Eye
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Data Views", icon: Table2, path: "/views" },
  { label: "Brand Report", icon: BarChart2, path: "/brand-report" },
  { label: "Management Report", icon: Briefcase, path: "/management-report" },
  { label: "Sync Center", icon: RefreshCw, path: "/sync", adminOnly: true },
  { label: "Databases", icon: Database, path: "/databases", adminOnly: true },
  { label: "Access Control", icon: Eye, path: "/access-control", adminOnly: true },
  { label: "User Access", icon: Users, path: "/user-access", adminOnly: true },
  { label: "Settings", icon: Settings, path: "/settings", adminOnly: true },
];

export default function AppSidebar({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isExpanded = !collapsed;

  const visibleNav = NAV.filter(n => !n.adminOnly || isAdmin);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-border transition-all ${collapsed ? "justify-center" : ""}`}>
        <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <span className="text-primary font-bold text-sm">H</span>
        </div>
        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden whitespace-nowrap">
              <p className="text-sm font-bold text-foreground">het</p>
              <p className="text-[10px] text-muted-foreground">Programming Database</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {visibleNav.map(item => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${active
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }
                ${collapsed ? "justify-center" : ""}
              `}
            >
              <item.icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-primary" : ""}`} />
              <AnimatePresence>
                {isExpanded && (
                  <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden whitespace-nowrap">
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className={`p-3 border-t border-border ${collapsed ? "flex justify-center" : ""}`}>
        {isExpanded ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary flex-shrink-0">
              {(user?.full_name || user?.email || "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{user?.full_name || "User"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.role || "user"}</p>
            </div>
            {isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />}
          </div>
        ) : (
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">
            {(user?.full_name || user?.email || "U")[0].toUpperCase()}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="hidden lg:flex items-center justify-center h-8 w-8 rounded-lg bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mx-auto mb-3"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-20 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 h-full w-64 bg-card border-r border-border z-30 lg:hidden"
          >
            <button type="button" onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
            <SidebarContent />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="hidden lg:flex flex-col bg-card border-r border-border flex-shrink-0 overflow-hidden"
      >
        <SidebarContent />
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button type="button" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <p className="text-sm font-bold text-foreground">Programming Database</p>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

AppSidebar.propTypes = {
  children: PropTypes.node.isRequired,
};
