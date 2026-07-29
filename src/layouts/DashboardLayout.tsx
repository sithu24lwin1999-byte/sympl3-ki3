import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Store, Users, Settings, LogOut, Bell, Search, BarChart3, Receipt, ClipboardList, Building2, ShoppingCart, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useAuth } from '@/lib/auth';
import { useLiveCollection, useLiveDocument } from '@/lib/firestore';
import type { Product, Shop, ShopNotification } from '@/types';
import { daysRemaining, subscriptionState } from '@/lib/subscriptions';
import { translate, useLanguage } from '@/lib/language';

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
  { icon: ClipboardList, label: 'Business Operations', path: '/owner/operations' },
  { icon: Building2, label: 'Branches & Finance', path: '/owner/branches' },
  { icon: BarChart3, label: 'Accounting & Reports', path: '/owner/reports' },
  { icon: Boxes, label: 'Core Modules', path: '/owner/core-modules' },
  { icon: Settings, label: 'Settings', path: '/owner/settings' },
];

export default function DashboardLayout({ children, role }: { children: React.ReactNode, role: 'ADMIN' | 'OWNER' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const t = (label: string) => translate(label, language);
  const effectiveRole = user?.role === 'EMPLOYEE' ? 'EMPLOYEE' : role;
  const employeeNav: SidebarItem[] = [
    ...(user?.permissions?.create ? [{ icon: ShoppingCart, label: 'Point of Sale', path: '/pos' }] : []),
    ...(user?.permissions?.view ? [{ icon: Receipt, label: 'My Orders', path: '/owner/orders' }] : []),
    ...(user?.permissions?.recordExpenses ? [{ icon: ClipboardList, label: 'Record Expense', path: '/expenses' }] : []),
    ...(user?.permissions?.accessReports ? [{ icon: BarChart3, label: 'Reports', path: '/owner/reports' }] : []),
  ];
  const navItems = effectiveRole === 'ADMIN' ? adminNav : effectiveRole === 'EMPLOYEE' ? employeeNav : ownerNav;
  const shop = useLiveDocument<Shop>(user?.shopId ? `shops/${user.shopId}` : null);
  const { data: products } = useLiveCollection<Product>(user?.shopId ? `shops/${user.shopId}/products` : null);
  const { data: shopNotifications } = useLiveCollection<ShopNotification>(user?.shopId ? `shops/${user.shopId}/notifications` : null, 'createdAt');
  const lowStockCount = products.filter(product => product.itemType !== 'SERVICE' && product.trackStock !== false && product.stock <= product.minStock).length;
  const visibleNotifications = shopNotifications.filter(item => item.active && (item.audience === 'ALL' || item.audience === effectiveRole));
  const [globalSearch, setGlobalSearch] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const currentSubscription = shop ? subscriptionState(shop) : null;
  const profilePhoto = user?.role === 'OWNER' ? shop?.ownerPhoto || user?.photo : user?.photo;

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = globalSearch.trim().toLowerCase();
    if (!query) return;
    const match = navItems.find(item => `${item.label} ${item.path}`.toLowerCase().includes(query));
    navigate(match?.path || (effectiveRole === 'ADMIN' ? '/admin/shops' : effectiveRole === 'EMPLOYEE' ? '/pos' : '/owner/inventory'), { state: { search: globalSearch } });
    setGlobalSearch('');
  };

  return (
    <div className="flex min-h-screen overflow-hidden bg-[#f5f4ef] font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[#e5e1d7] bg-white p-5 lg:flex">
        <div className="mb-9 flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#71806a]">
            <Store className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900">KI3 POS</span>
          <Badge className="ml-auto border-none bg-[#eef1e9] text-[10px] text-[#586752]" variant="default">{effectiveRole}</Badge>
        </div>
        
        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-[#eef1e9] text-[#506149]"
                    : "text-slate-500 hover:bg-[#f7f6f2] hover:text-slate-900"
                )}
              >
                <item.icon className={cn("w-5 h-5", active ? "opacity-100" : "opacity-80")} />
                {t(item.label)}
              </Link>
            )
          })}
        </nav>

        {effectiveRole === 'OWNER' && (
          <div className="mt-auto mb-4 rounded-2xl border border-[#e4e1d7] bg-[#faf9f5] p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('Subscription')}</p>
            <p className="mb-2 text-xs font-bold text-slate-800">{shop?.plan || t('Loading plan')}</p>
            <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-[#e4e1d7]">
              <div className="h-full w-3/4 bg-[#809079]"></div>
            </div>
            <p className="text-[10px] text-slate-500">{shop ? `${Math.max(0, daysRemaining(shop.expiry))} days remaining · ${currentSubscription?.replace('_', ' ')}` : t('Loading subscription...')}</p>
          </div>
        )}

        <div className="border-t border-[#e5e1d7] pt-4">
          <Button variant="ghost" onClick={logout} className="h-10 w-full justify-start px-3 text-slate-500 hover:bg-red-50 hover:text-red-600">
              <LogOut className="w-5 h-5 mr-3 opacity-80" />
              {t('Sign Out')}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex min-h-20 shrink-0 items-center justify-between border-b border-[#e5e1d7] bg-white px-4 py-3 md:px-8">
          <div className="hidden lg:block">
            <h2 className="text-lg font-bold">{effectiveRole === 'ADMIN' ? t('KI3 POS Administration') : shop?.name || t('My Shop')}</h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{clock.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} • {clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
          </div>
          
          <div className="flex items-center gap-3 lg:gap-6 lg:ml-auto">
            {effectiveRole === 'OWNER' && currentSubscription && <span className={cn('hidden sm:inline-flex rounded-full px-3 py-1 text-[10px] font-bold', currentSubscription === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : currentSubscription === 'TRIAL' || currentSubscription === 'EXPIRING_SOON' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')}>{currentSubscription.replace('_', ' ')}</span>}
            <LanguageSwitcher compact className="hidden sm:flex" />
            <form onSubmit={handleSearch} className="flex w-32 items-center gap-2 rounded-full border border-[#e7e3da] bg-[#f8f7f3] px-3 py-2 sm:w-48 md:w-64 md:gap-3 md:px-4">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder={t('Global Search...')} 
                className="bg-transparent border-none outline-none text-sm w-full text-slate-900"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </form>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button aria-label="Notifications" onClick={() => setShowNotifications(!showNotifications)} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#f3f2ed] text-slate-600 hover:bg-[#e8eee5] hover:text-[#596b54]">
                  <Bell className="w-5 h-5" />
                </button>
                {lowStockCount + visibleNotifications.length > 0 && <span className="absolute top-0 right-0 min-w-4 h-4 px-1 bg-red-500 border border-white rounded-full text-[9px] text-white grid place-items-center">{lowStockCount + visibleNotifications.length}</span>}
                {showNotifications && (
                  <div className="absolute right-0 top-12 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl z-50">
                    <p className="px-2 py-1 text-sm font-bold">{t('Notifications')}</p>
                    <button onClick={() => { navigate(effectiveRole === 'ADMIN' ? '/admin/shops' : effectiveRole === 'EMPLOYEE' ? '/pos' : '/owner/inventory'); setShowNotifications(false); }} className="w-full rounded-xl p-3 text-left hover:bg-slate-50">
                      <p className="text-xs font-bold text-slate-800">{lowStockCount ? `${lowStockCount} low-stock item${lowStockCount === 1 ? '' : 's'}` : t('All stock levels look good')}</p>
                      <p className="mt-1 text-xs text-slate-500">{effectiveRole === 'ADMIN' ? t('Review tenant plans and shop activity.') : effectiveRole === 'EMPLOYEE' ? t('Return to the point of sale.') : t('Open inventory to review stock levels.')}</p>
                    </button>
                    {visibleNotifications.slice(0,5).map(item=><div key={item.id} className="border-t px-3 py-3"><p className="text-xs font-bold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.message}</p></div>)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 ml-2 border-l border-slate-200 pl-6">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-bold leading-none">{user?.name}</p>
                  <p className="text-[11px] text-slate-400">{user?.role}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#e8eee5] font-bold text-[#596b54] ring-1 ring-[#ddd9ce]">
                  {profilePhoto ? <img src={profilePhoto} alt={`${user?.name || 'User'} profile`} className="h-full w-full object-cover" /> : user?.name?.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'KI'}
                </div>
              </div>
            </div>
          </div>
        </header>
        <nav aria-label="Mobile navigation" className="flex gap-2 overflow-x-auto border-b border-[#e5e1d7] bg-white px-4 py-2 lg:hidden">
          {navItems.map(item => <Link key={item.path} to={item.path} className={cn('shrink-0 rounded-xl px-3 py-2 text-xs font-bold', location.pathname === item.path ? 'bg-[#71806a] text-white' : 'text-slate-500')}><item.icon className="mr-1 inline h-4 w-4" />{t(item.label)}</Link>)}
          <LanguageSwitcher compact className="shrink-0 rounded-xl" />
          <button onClick={logout} className="shrink-0 px-3 py-2 text-xs font-bold text-red-500">{t('Sign Out')}</button>
        </nav>
        <div className="flex-1 overflow-y-auto bg-[#f5f4ef] p-4 md:p-8">
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
    default: 'bg-[#efeee8] text-slate-700',
  };
  return <span className={cn("px-2 py-0.5 rounded-full font-medium", variants[variant], className)}>{children}</span>;
}
