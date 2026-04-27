import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import HetLogo from '@/components/HetLogo';
import ThemeToggle from '@/components/ThemeToggle';
import {
  LayoutDashboard,
  Database,
  Eye,
  Users,
  Activity,
  Siren,
  ShieldAlert,
  Bell,
  ScrollText,
  Info,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { to: '/admin/overview',       label: 'Overview',       icon: LayoutDashboard },
  { to: '/admin/databases',      label: 'Databases',      icon: Database },
  { to: '/admin/views',          label: 'Views',          icon: Eye },
  { to: '/admin/users',          label: 'Users',          icon: Users },
  { to: '/admin/monitoring',     label: 'Monitoring',     icon: Activity },
  { to: '/admin/alerts',         label: 'Alerts',         icon: Siren },
  { to: '/admin/incidents',      label: 'Incidents',      icon: ShieldAlert },
  { to: '/admin/notifications',  label: 'Notifications',  icon: Bell },
  { to: '/admin/audit-logs',     label: 'Audit Logs',     icon: ScrollText },
  { to: '/admin/about',          label: 'About',          icon: Info },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!globalThis.document) return undefined;
    const body = globalThis.document.body;
    const previousOverflow = body.style.overflow;
    if (mobileSidebarOpen) {
      body.style.overflow = 'hidden';
    }

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [mobileSidebarOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col w-60 bg-card border-r border-border
          transition-transform duration-200 ease-in-out
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex
        `}
      >
        {/* Logo area */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
          <HetLogo size={28} />
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">HET Database</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Admin Console</p>
          </div>
          <button
            className="ml-auto lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">
            Main
          </p>
          {NAV_ITEMS.slice(0, 4).map(({ to, label, icon: Icon }) => (
            <SidebarLink key={to} to={to} icon={Icon} label={label} onClick={() => setMobileSidebarOpen(false)} />
          ))}

          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mt-4 mb-1">
            System
          </p>
          {NAV_ITEMS.slice(4).map(({ to, label, icon: Icon }) => (
            <SidebarLink key={to} to={to} icon={Icon} label={label} onClick={() => setMobileSidebarOpen(false)} />
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">
                {(user?.email || 'A')[0].toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{user?.email}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close mobile menu overlay"
        />
      )}

      {/* ── Main content area ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Breadcrumb / page title injected via outlet context if needed */}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => navigate('/dashboard')}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors group
        ${isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
          <span className="flex-1 truncate">{label}</span>
          {isActive && <ChevronRight className="h-3 w-3 text-primary/60" />}
        </>
      )}
    </NavLink>
  );
}

SidebarLink.propTypes = {
  to: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func,
};

SidebarLink.defaultProps = {
  onClick: undefined,
};
