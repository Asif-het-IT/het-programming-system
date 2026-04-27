import React, { Suspense, lazy } from 'react';
import PropTypes from 'prop-types';
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import HetLogo from '@/components/HetLogo';
import Login from './pages/Login';  // eager — entry point, must not lazy-load

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function lazyWithRetry(importer, key) {
  return lazy(async () => {
    const storageKey = `lazy-reload:${key}`;
    const browserWindow = globalThis.window;
    try {
      const module = await importer();
      if (browserWindow) {
        globalThis.sessionStorage.removeItem(storageKey);
      }
      return module;
    } catch (error) {
      const message = String(error?.message || '');
      const transientChunkFailure = message.includes('Failed to fetch dynamically imported module')
        || message.includes('Importing a module script failed');

      if (transientChunkFailure && browserWindow) {
        const hasReloaded = globalThis.sessionStorage.getItem(storageKey) === '1';
        if (!hasReloaded) {
          globalThis.sessionStorage.setItem(storageKey, '1');
          globalThis.location.reload();
          return new Promise(() => {});
        }
      }

      throw error;
    }
  });
}

const UserDashboard = lazyWithRetry(() => import('./pages/UserDashboard'), 'user-dashboard');
const AdminPanel = lazyWithRetry(() => import('./pages/AdminPanel'), 'admin-panel');
const AdminAbout = lazyWithRetry(() => import('./pages/AdminAbout'), 'admin-about');
const AdminLayout = lazyWithRetry(() => import('./components/AdminLayout'), 'admin-layout');
const AdminOverview = lazyWithRetry(() => import('./pages/admin/AdminOverview'), 'admin-overview');
const AdminDatabases = lazyWithRetry(() => import('./pages/admin/AdminDatabases'), 'admin-databases');
const AdminViews = lazyWithRetry(() => import('./pages/admin/AdminViews'), 'admin-views');
const AdminUsers = lazyWithRetry(() => import('./pages/admin/AdminUsers'), 'admin-users');
const AdminMonitoring = lazyWithRetry(() => import('./pages/admin/AdminMonitoring'), 'admin-monitoring');
const AdminAlerts = lazyWithRetry(() => import('./pages/admin/AdminAlerts'), 'admin-alerts');
const AdminIncidents = lazyWithRetry(() => import('./pages/AdminIncidents'), 'admin-incidents');
const AdminNotifications = lazyWithRetry(() => import('./pages/admin/AdminNotifications'), 'admin-notifications');
const AdminAuditLogs = lazyWithRetry(() => import('./pages/admin/AdminAuditLogs'), 'admin-audit-logs');

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <BrandedLoader />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground">Access Denied</h1>
          <p className="text-sm text-muted-foreground mt-2">Admin ke liye reserved area hai</p>
        </div>
      </div>
    );
  }

  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  adminOnly: PropTypes.bool,
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router future={ROUTER_FUTURE}>
          <AuthProvider>
            <AppContent />
            <Toaster />
          </AuthProvider>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

function AppContent() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <BrandedLoader />;
  }

  return (
    <Suspense
      fallback={<BrandedLoader />}
    >
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
        {/* Legacy admin panel — kept for backward compat */}
        <Route path="/admin/legacy" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
        {/* New modular admin */}
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/admin/overview" replace />} />
          <Route path="overview" element={<AdminOverview />} />
          <Route path="databases" element={<AdminDatabases />} />
          <Route path="views" element={<AdminViews />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="monitoring" element={<AdminMonitoring />} />
          <Route path="alerts" element={<AdminAlerts />} />
          <Route path="incidents" element={<AdminIncidents />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="about" element={<AdminAbout />} />
        </Route>
        <Route path="*" element={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
              <h1 className="text-6xl font-light text-muted-foreground">404</h1>
              <p className="text-muted-foreground mt-4">Page not found</p>
            </div>
          </div>
        } />
      </Routes>
    </Suspense>
  );
}

function BrandedLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <HetLogo size={52} showText title="het Database" subtitle="Loading workspace" />
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    </div>
  );
}
