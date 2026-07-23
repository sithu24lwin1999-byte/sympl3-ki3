import React, { ErrorInfo, lazy, ReactNode, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import AccessDenied from '@/pages/AccessDenied';
import type { AppUser, EmployeePermissions, Role } from '@/types';

const Login = lazy(() => import('./pages/Login'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminShops = lazy(() => import('./pages/AdminShops'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'));
const OwnerInventory = lazy(() => import('./pages/OwnerInventory'));
const OwnerOrders = lazy(() => import('./pages/OwnerOrders'));
const OwnerEmployees = lazy(() => import('./pages/OwnerEmployees'));
const OwnerSettings = lazy(() => import('./pages/OwnerSettings'));
const OwnerOperations = lazy(() => import('./pages/OwnerOperations'));
const OwnerBranches = lazy(() => import('./pages/OwnerBranches'));
const OwnerReports = lazy(() => import('./pages/OwnerReports'));
const OwnerCoreModules = lazy(() => import('./pages/OwnerCoreModules'));
const EmployeeExpenses = lazy(() => import('./pages/EmployeeExpenses'));
const POSScreen = lazy(() => import('./pages/POSScreen'));

function homeFor(user: AppUser) {
  if (user.role === 'ADMIN') return '/admin';
  if (user.role === 'OWNER') return '/owner';
  if (user.permissions?.create) return '/pos';
  if (user.permissions?.view) return '/owner/orders';
  if (user.permissions?.recordExpenses) return '/expenses';
  return '/unauthorized';
}

function Protected({ roles, permission, children }: { roles: Role[]; permission?: keyof EmployeePermissions; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (!roles.includes(user.role) || (user.role === 'EMPLOYEE' && permission && user.permissions?.[permission] !== true)) return <Navigate to="/unauthorized" replace />;
  return children;
}

function LoadingScreen() {
  return <div role="status" className="min-h-screen grid place-items-center bg-slate-50 text-blue-600 font-bold">Loading KI3 POS…</div>;
}

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  declare readonly props: Readonly<{ children: ReactNode }>;
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('KI3 POS rendering failed', { name: error.name, hasComponentStack: Boolean(info.componentStack) });
  }
  render() {
    if (this.state.failed) return <div className="min-h-screen grid place-items-center bg-slate-50 p-6"><div role="alert" className="max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-black text-slate-900">KI3 POS could not load this page</h1><p className="mt-2 text-sm text-slate-500">Check your connection, then reload the application.</p><button onClick={() => window.location.reload()} className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">Reload application</button></div></div>;
    return this.props.children;
  }
}

export default function App() {
  const { user, loading, accessIssue, logout } = useAuth();
  if (loading) return <LoadingScreen />;
  if (accessIssue) return <AccessDenied message={accessIssue.message} onExit={logout} />;
  return (
    <AppErrorBoundary>
      <HashRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={user ? <Navigate to={homeFor(user)} replace /> : <Login />} />
            <Route path="/unauthorized" element={<AccessDenied />} />
            <Route path="/admin" element={<Protected roles={['ADMIN']}><AdminDashboard /></Protected>} />
            <Route path="/admin/shops" element={<Protected roles={['ADMIN']}><AdminShops /></Protected>} />
            <Route path="/admin/reports" element={<Protected roles={['ADMIN']}><AdminReports /></Protected>} />
            <Route path="/admin/settings" element={<Protected roles={['ADMIN']}><AdminSettings /></Protected>} />
            <Route path="/owner" element={<Protected roles={['OWNER']}><OwnerDashboard /></Protected>} />
            <Route path="/owner/orders" element={<Protected roles={['OWNER', 'EMPLOYEE']} permission="view"><OwnerOrders /></Protected>} />
            <Route path="/owner/inventory" element={<Protected roles={['OWNER']}><OwnerInventory /></Protected>} />
            <Route path="/owner/employees" element={<Protected roles={['OWNER']}><OwnerEmployees /></Protected>} />
            <Route path="/owner/settings" element={<Protected roles={['OWNER']}><OwnerSettings /></Protected>} />
            <Route path="/owner/operations" element={<Protected roles={['OWNER']}><OwnerOperations /></Protected>} />
            <Route path="/owner/branches" element={<Protected roles={['OWNER']}><OwnerBranches /></Protected>} />
            <Route path="/owner/reports" element={<Protected roles={['OWNER', 'EMPLOYEE']} permission="accessReports"><OwnerReports /></Protected>} />
            <Route path="/owner/core-modules" element={<Protected roles={['OWNER']}><OwnerCoreModules /></Protected>} />
            <Route path="/expenses" element={<Protected roles={['EMPLOYEE']} permission="recordExpenses"><EmployeeExpenses /></Protected>} />
            <Route path="/pos" element={<Protected roles={['OWNER', 'EMPLOYEE']} permission="create"><POSScreen /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AppErrorBoundary>
  );
}
