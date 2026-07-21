import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Store, Users, Settings, LogOut, Bell, Search, BarChart3, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

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
  const navItems = role === 'ADMIN' ? adminNav : ownerNav;

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
          <Link to="/">
            <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/10 h-10 px-3">
              <LogOut className="w-5 h-5 mr-3 opacity-80" />
              Sign Out
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
          <div className="hidden lg:block">
            <h2 className="text-lg font-bold">The Coffee Lab - Mandalay</h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} • {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          
          <div className="flex items-center gap-6 lg:ml-auto">
            <div className="flex items-center bg-slate-100 rounded-full px-4 py-2 gap-3 w-48 md:w-64">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Global Search..." 
                className="bg-transparent border-none outline-none text-sm w-full text-slate-900"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 cursor-pointer">
                  <Bell className="w-5 h-5" />
                </div>
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></span>
              </div>
              <div className="flex items-center gap-3 ml-2 border-l border-slate-200 pl-6">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-bold leading-none">{role === 'ADMIN' ? 'Aung Kyaw' : 'Kyaw Zin'}</p>
                  <p className="text-[11px] text-slate-400">{role === 'ADMIN' ? 'System Admin' : 'Shop Owner'}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-100 overflow-hidden border-2 border-white ring-1 ring-slate-200 flex items-center justify-center text-blue-700 font-bold">
                  {role === 'ADMIN' ? 'AK' : 'KZ'}
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 p-8 overflow-y-auto">
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
