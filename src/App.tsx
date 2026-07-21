import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AdminShops from './pages/AdminShops';
import AdminReports from './pages/AdminReports';
import AdminSettings from './pages/AdminSettings';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerInventory from './pages/OwnerInventory';
import OwnerOrders from './pages/OwnerOrders';
import OwnerEmployees from './pages/OwnerEmployees';
import OwnerSettings from './pages/OwnerSettings';
import POSScreen from './pages/POSScreen';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/shops" element={<AdminShops />} />
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        
        {/* Owner Routes */}
        <Route path="/owner" element={<OwnerDashboard />} />
        <Route path="/owner/orders" element={<OwnerOrders />} />
        <Route path="/owner/inventory" element={<OwnerInventory />} />
        <Route path="/owner/employees" element={<OwnerEmployees />} />
        <Route path="/owner/settings" element={<OwnerSettings />} />
        
        {/* Employee POS Route */}
        <Route path="/pos" element={<POSScreen />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
