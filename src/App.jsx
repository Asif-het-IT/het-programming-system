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
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AdminAbout = lazy(() => import('./pages/AdminAbout'));

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
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
        <Route path="/admin/about" element={<ProtectedRoute adminOnly><AdminAbout /></ProtectedRoute>} />
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
