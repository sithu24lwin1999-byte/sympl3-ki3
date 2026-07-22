import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Store, Users, Settings, LogOut, Bell, Search, BarChart3, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';

interface SidebarItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const adminNav: SidebarItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: Store, label: 'Shops (Tenants)', path: '/admin/shops' },
  { icon: BarChart3, label: 'Global Reports', path: '/admin/reports' },
  { icon: Settings, label: 'System Settings', path: '/admin/settings' },
];

const ownerNav: SidebarItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/owner' },
  { icon: Receipt, label: 'Order Monitor', path: '/owner/orders' },
  { icon: Store, label: 'Inventory', path: '/owner/inventory' },
  { icon: Users, label: 'Employees', path: '/owner/employees' },
  { icon: Settings, label: 'Settings', path: '/owner/settings' },
];

export default function DashboardLayout({ children, role }: { children: React.ReactNode, role: 'ADMIN' | 'OWNER' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const navItems = role === 'ADMIN' ? adminNav : ownerNav;
  const { user, logout } = useAuth();
  const [globalSearch, setGlobalSearch] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = globalSearch.trim().toLowerCase();
    if (!query) return;
    const match = navItems.find(item => `${item.label} ${item.path}`.toLowerCase().includes(query));
    navigate(match?.path || (role === 'ADMIN' ? '/admin/shops' : '/owner/inventory'), { state: { search: globalSearch } });
    setGlobalSearch('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111827] flex flex-col shrink-0 hidden lg:flex sticky top-0 h-screen p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-[#3B82F6] rounded-lg flex items-center justify-center">
            <Store className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">KI3 POS</span>
          <Badge className="ml-auto text-[10px] bg-white/10 text-white border-none" variant="default">{role}</Badge>
        </div>
        
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group",
                  active 
                    ? "bg-white/10 text-white" 
                    : "text-slate-400 hover:text-white"
                )}
              >
                <item.icon className={cn("w-5 h-5", active ? "opacity-100" : "opacity-80")} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {role === 'OWNER' && (
          <div className="mt-auto p-4 bg-slate-800/40 rounded-2xl border border-white/5 mb-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Subscription</p>
            <p className="text-white text-xs font-medium mb-2">Premium Plan</p>
            <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden mb-2">
              <div className="w-3/4 h-full bg-[#3B82F6]"></div>
            </div>
            <p className="text-[10px] text-slate-400">12 days remaining</p>
          </div>
        )}

        <div className="pt-4 border-t border-white/5">
          <Button variant="ghost" onClick={logout} className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/10 h-10 px-3">
              <LogOut className="w-5 h-5 mr-3 opacity-80" />
              Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="min-h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 py-3 sticky top-0 z-20 shrink-0">
          <div className="hidden lg:block">
            <h2 className="text-lg font-bold">The Coffee Lab - Mandalay</h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} • {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          
          <div className="flex items-center gap-6 lg:ml-auto">
            <form onSubmit={handleSearch} className="flex items-center bg-slate-100 rounded-full px-4 py-2 gap-3 w-48 md:w-64">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Global Search..." 
                className="bg-transparent border-none outline-none text-sm w-full text-slate-900"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </form>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <button aria-label="Notifications" onClick={() => setShowNotifications(!showNotifications)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 cursor-pointer hover:bg-blue-100">
                  <Bell className="w-5 h-5" />
                </button>
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></span>
                {showNotifications && (
                  <div className="absolute right-0 top-12 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl z-50">
                    <p className="px-2 py-1 text-sm font-bold">Notifications</p>
                    <button onClick={() => { navigate(role === 'ADMIN' ? '/admin/shops' : '/owner/inventory'); setShowNotifications(false); }} className="w-full rounded-xl p-3 text-left hover:bg-slate-50">
                      <p className="text-xs font-bold text-slate-800">Action required</p>
                      <p className="mt-1 text-xs text-slate-500">Review expiring plans and low-stock products.</p>
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 ml-2 border-l border-slate-200 pl-6">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-bold leading-none">{user?.name}</p>
                  <p className="text-[11px] text-slate-400">{user?.role}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-100 overflow-hidden border-2 border-white ring-1 ring-slate-200 flex items-center justify-center text-blue-700 font-bold">
                  {user?.name?.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'KI'}
                </div>
              </div>
            </div>
          </div>
        </header>
        <nav className="lg:hidden flex gap-2 overflow-x-auto px-4 py-2 bg-slate-900">
          {navItems.map(item => <Link key={item.path} to={item.path} className={cn('shrink-0 px-3 py-2 rounded-xl text-xs font-bold', location.pathname === item.path ? 'bg-blue-600 text-white' : 'text-slate-300')}><item.icon className="w-4 h-4 inline mr-1" />{item.label}</Link>)}
          <button onClick={logout} className="shrink-0 px-3 py-2 text-xs font-bold text-red-300">Sign Out</button>
        </nav>
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto h-full flex flex-col">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function Badge({ children, className, variant = 'default' }: any) {
  const variants = {
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  };
  return <span className={cn("px-2 py-0.5 rounded-full font-medium", variants[variant], className)}>{children}</span>;
}
