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
    <div className={cn("page-shell flex min-h-screen overflow-hidden bg-[#f7f1e7] font-sans text-[#1d1a16]", effectiveRole === 'OWNER' && 'owner-shell', effectiveRole === 'EMPLOYEE' && 'employee-shell', effectiveRole === 'ADMIN' && 'admin-shell')}>
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[#ddcdbc] bg-[#ebe1d2]/95 p-5 shadow-[10px_0_34px_rgb(70_54_36_/_6%)] lg:flex">
        <div className="mb-9 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5f6f52] shadow-lg shadow-[#5f6f52]/20">
            <Store className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-[#2b241c]">KI3 POS</span>
          <Badge className="ml-auto border-none bg-[#fffdf8] text-[10px] text-[#6c5137]" variant="default">{effectiveRole}</Badge>
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
                    ? "bg-[#fffdf8] text-[#5f6f52] shadow-sm ring-1 ring-[#dfd0bc]"
                    : "text-[#7b6b58] hover:bg-[#f6ecdf] hover:text-[#2b241c]"
                )}
              >
                <item.icon className={cn("w-5 h-5", active ? "opacity-100" : "opacity-80")} />
                {t(item.label)}
              </Link>
            )
          })}
        </nav>

        {effectiveRole === 'OWNER' && (
          <div className="mt-auto mb-4 rounded-3xl border border-[#dfd0bc] bg-[#fffdf8] p-4 shadow-sm">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#a39582]">{t('Subscription')}</p>
            <p className="mb-2 text-xs font-bold text-[#2b241c]">{shop?.plan || t('Loading plan')}</p>
            <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-[#e8dac8]">
              <div className="h-full w-3/4 bg-[#a8663f]"></div>
            </div>
            <p className="text-[10px] text-[#736756]">{shop ? `${Math.max(0, daysRemaining(shop.expiry))} days remaining · ${currentSubscription?.replace('_', ' ')}` : t('Loading subscription...')}</p>
          </div>
        )}

        <div className="border-t border-[#ddcdbc] pt-4">
          <Button variant="ghost" onClick={logout} className="h-10 w-full justify-start px-3 text-[#7b6b58] hover:bg-red-50 hover:text-red-600">
              <LogOut className="w-5 h-5 mr-3 opacity-80" />
              {t('Sign Out')}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex min-h-20 shrink-0 items-center justify-between border-b border-[#dfd0bc] bg-[#fffdf8]/95 px-4 py-3 shadow-sm md:px-8">
          <div className="hidden lg:block">
            <h2 className="text-lg font-bold">{effectiveRole === 'ADMIN' ? t('KI3 POS Administration') : shop?.name || t('My Shop')}</h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{clock.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} • {clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
          </div>
          
          <div className="flex items-center gap-3 lg:gap-6 lg:ml-auto">
            {effectiveRole === 'OWNER' && currentSubscription && <span className={cn('hidden sm:inline-flex rounded-full px-3 py-1 text-[10px] font-bold', currentSubscription === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : currentSubscription === 'TRIAL' || currentSubscription === 'EXPIRING_SOON' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')}>{currentSubscription.replace('_', ' ')}</span>}
            <LanguageSwitcher compact className="hidden sm:flex" />
            <form onSubmit={handleSearch} className="flex w-32 items-center gap-2 rounded-full border border-[#dfd0bc] bg-[#fbf4ea] px-3 py-2 shadow-inner sm:w-48 md:w-64 md:gap-3 md:px-4">
              <Search className="w-4 h-4 text-[#a39582]" />
              <input 
                type="text" 
                placeholder={t('Global Search...')} 
                className="bg-transparent border-none outline-none text-sm w-full text-[#2b241c]"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </form>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button aria-label="Notifications" onClick={() => setShowNotifications(!showNotifications)} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#f1e8dc] text-[#736756] hover:bg-[#ebe1d2] hover:text-[#5f6f52]">
                  <Bell className="w-5 h-5" />
                </button>
                {lowStockCount + visibleNotifications.length > 0 && <span className="absolute top-0 right-0 min-w-4 h-4 px-1 bg-red-500 border border-white rounded-full text-[9px] text-white grid place-items-center">{lowStockCount + visibleNotifications.length}</span>}
                {showNotifications && (
                  <div className="absolute right-0 top-12 w-72 rounded-2xl border border-[#dfd0bc] bg-[#fffdf8] p-3 shadow-xl z-50">
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
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-[#fffdf8] bg-[#efe4d5] font-bold text-[#6c5137] ring-1 ring-[#dfd0bc]">
                  {profilePhoto ? <img src={profilePhoto} alt={`${user?.name || 'User'} profile`} className="h-full w-full object-cover" /> : user?.name?.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'KI'}
                </div>
              </div>
            </div>
          </div>
        </header>
        <nav aria-label="Mobile navigation" className="flex gap-2 overflow-x-auto border-b border-[#dfd0bc] bg-[#fffdf8] px-4 py-2 lg:hidden">
          {navItems.map(item => <Link key={item.path} to={item.path} className={cn('shrink-0 rounded-xl px-3 py-2 text-xs font-bold', location.pathname === item.path ? 'bg-[#5f6f52] text-white' : 'text-[#7b6b58]')}><item.icon className="mr-1 inline h-4 w-4" />{t(item.label)}</Link>)}
          <LanguageSwitcher compact className="shrink-0 rounded-xl" />
          <button onClick={logout} className="shrink-0 px-3 py-2 text-xs font-bold text-red-500">{t('Sign Out')}</button>
        </nav>
        <div className="relative flex-1 overflow-y-auto bg-transparent p-4 md:p-8">
          <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function Badge({ children, className, variant = 'default' }: any) {
  const variants = {
    default: 'bg-[#efe4d5] text-[#6c5137]',
  };
  return <span className={cn("px-2 py-0.5 rounded-full font-medium", variants[variant], className)}>{children}</span>;
}
