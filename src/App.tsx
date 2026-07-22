import { lazy, ReactNode, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/types';

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
const EmployeeExpenses = lazy(() => import('./pages/EmployeeExpenses'));
const POSScreen = lazy(() => import('./pages/POSScreen'));

function homeFor(role: Role) {
  return role === 'ADMIN' ? '/admin' : role === 'OWNER' ? '/owner' : '/pos';
}

function Protected({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

function LoadingScreen() {
  return <div className="min-h-screen grid place-items-center bg-slate-50 text-blue-600 font-bold">Loading KI3 POS…</div>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <HashRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={user ? <Navigate to={homeFor(user.role)} replace /> : <Login />} />
          <Route path="/admin" element={<Protected roles={['ADMIN']}><AdminDashboard /></Protected>} />
          <Route path="/admin/shops" element={<Protected roles={['ADMIN']}><AdminShops /></Protected>} />
          <Route path="/admin/reports" element={<Protected roles={['ADMIN']}><AdminReports /></Protected>} />
          <Route path="/admin/settings" element={<Protected roles={['ADMIN']}><AdminSettings /></Protected>} />
          <Route path="/owner" element={<Protected roles={['OWNER']}><OwnerDashboard /></Protected>} />
          <Route path="/owner/orders" element={<Protected roles={['OWNER', 'EMPLOYEE']}><OwnerOrders /></Protected>} />
          <Route path="/owner/inventory" element={<Protected roles={['OWNER']}><OwnerInventory /></Protected>} />
          <Route path="/owner/employees" element={<Protected roles={['OWNER']}><OwnerEmployees /></Protected>} />
          <Route path="/owner/settings" element={<Protected roles={['OWNER']}><OwnerSettings /></Protected>} />
          <Route path="/owner/operations" element={<Protected roles={['OWNER']}><OwnerOperations /></Protected>} />
          <Route path="/owner/branches" element={<Protected roles={['OWNER']}><OwnerBranches /></Protected>} />
          <Route path="/expenses" element={<Protected roles={['EMPLOYEE']}><EmployeeExpenses /></Protected>} />
          <Route path="/pos" element={<Protected roles={['OWNER', 'EMPLOYEE']}><POSScreen /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
