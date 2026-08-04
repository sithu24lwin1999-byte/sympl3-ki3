import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, DataState } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLiveCollection, useLiveCollectionGroup } from '@/lib/firestore';
import { monthlyRecurringRevenue, paidSubscriptionRevenue, subscriptionState, todayKey } from '@/lib/subscriptions';
import type { AppUser, Order, Shop, SubscriptionTransaction } from '@/types';

function Metric({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return <Card className={cn('group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-xl', accent && 'border-[#caa27d] bg-[#f4e5d5]')}>
    <div className="absolute right-4 top-4 h-12 w-12 rounded-full bg-[#d4a373]/10 transition group-hover:bg-[#d4a373]/20" />
    <p className={cn('mb-2 text-xs font-semibold uppercase tracking-[0.18em]', accent ? 'text-[#865036]' : 'text-[#8a7b68]')}>{label}</p>
    <p className="relative text-2xl font-black text-[#1d1a16]">{value}</p>
  </Card>;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data: shops, loading: shopsLoading, error: shopsError } = useLiveCollection<Shop>('shops', 'createdAt');
  const { data: users, loading: usersLoading, error: usersError } = useLiveCollection<AppUser>('users');
  const { data: orders, loading: ordersLoading, error: ordersError } = useLiveCollectionGroup<Order>('orders', 'createdAt');
  const { data: transactions, loading: transactionLoading, error: transactionError } = useLiveCollection<SubscriptionTransaction>('subscriptionTransactions', 'createdAt');
  const [range, setRange] = useState<'6m' | '1y'>('6m');
  const now = new Date();
  const today = todayKey(now);
  const monthKey = today.slice(0, 7);
  const states = shops.map(shop => ({ shop, state: subscriptionState(shop, today) }));
  const activeShops = states.filter(({ state }) => ['ACTIVE', 'EXPIRING_SOON', 'TRIAL'].includes(state)).length;
  const systemSales = orders.filter(order => order.status === 'COMPLETED').reduce((sum, order) => sum + order.total, 0);
  const metrics = [
    ['Total shops', shops.length], ['Active shops', activeShops], ['Suspended shops', states.filter(x => x.state === 'SUSPENDED').length],
    ['Expired shops', states.filter(x => x.state === 'EXPIRED').length], ['Trial shops', states.filter(x => x.state === 'TRIAL').length],
    ['New shops this month', shops.filter(shop => shop.createdAt?.startsWith(monthKey)).length],
    ['Monthly subscription revenue', formatCurrency(transactions.filter(item => item.status === 'PAID' && (item.paidAt || item.createdAt).startsWith(monthKey)).reduce((sum, item) => sum + item.amount, 0))],
    ['Total subscription revenue', formatCurrency(paidSubscriptionRevenue(transactions))],
    ['Renewals due today', shops.filter(shop => shop.expiry === today).length],
    ['Upcoming expirations (7 days)', states.filter(({ shop, state }) => state === 'EXPIRING_SOON' && shop.expiry > today).length],
    ['Total users', users.length], ['Total orders', orders.length], ['Total system sales', formatCurrency(systemSales)],
    ['Monthly recurring revenue', formatCurrency(monthlyRecurringRevenue(shops, today))],
  ] as const;
  const chartData = useMemo(() => {
    const count = range === '6m' ? 6 : 12;
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
      const key = date.toISOString().slice(0, 7);
      return { name: date.toLocaleDateString('en-US', { month: 'short' }), value: transactions.filter(item => item.status === 'PAID' && (item.paidAt || item.createdAt).startsWith(key)).reduce((sum, item) => sum + item.amount, 0) };
    });
  }, [transactions, range]);
  const upcoming = [...states].filter(({ state }) => ['EXPIRING_SOON', 'EXPIRED'].includes(state)).sort((a, b) => a.shop.expiry.localeCompare(b.shop.expiry)).slice(0, 6);
  const loading = shopsLoading || usersLoading || ordersLoading || transactionLoading;
  const error = shopsError ? `Shops: ${shopsError}` : usersError ? `Users: ${usersError}` : ordersError ? `Orders: ${ordersError}` : transactionError ? `Subscriptions: ${transactionError}` : null;

  return <DashboardLayout role="ADMIN">
    <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8">
      <div><p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-[#a8663f]">System command center</p><h1 className="text-3xl font-bold tracking-tight text-[#1d1a16] mb-2">Platform Overview</h1><p className="text-[#736756]">Live tenant, subscription and system performance.</p></div>
      <Button className="gap-2" onClick={() => navigate('/admin/shops', { state: { openCreateModal: true } })}><Plus className="w-4 h-4" /> New Tenant Shop</Button>
    </div>
    <DataState loading={loading} error={error} />
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
      {metrics.map(([label, value], index) => <div key={label}><Metric label={label} value={value} accent={index === 6} /></div>)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Card className="lg:col-span-2">
        <div className="flex items-center justify-between mb-8"><h3 className="font-bold text-[#1d1a16]">Subscription Income</h3><div className="flex rounded-xl bg-[#efe4d5] p-1"><button onClick={() => setRange('6m')} className={cn('px-3 py-1 text-xs font-bold rounded-lg text-[#736756]', range === '6m' && 'bg-[#fffdf8] text-[#48543f] shadow-sm')}>6 Months</button><button onClick={() => setRange('1y')} className={cn('px-3 py-1 text-xs font-bold rounded-lg text-[#736756]', range === '1y' && 'bg-[#fffdf8] text-[#48543f] shadow-sm')}>1 Year</button></div></div>
        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="subscriptionRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a8663f" stopOpacity={0.30}/><stop offset="95%" stopColor="#a8663f" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7d8c5"/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={value => `${value / 1000}k`}/><Tooltip formatter={(value: number) => formatCurrency(value)}/><Area type="monotone" dataKey="value" stroke="#865036" strokeWidth={3} fill="url(#subscriptionRevenue)" /></AreaChart></ResponsiveContainer></div>
      </Card>
      <Card><h3 className="font-bold text-[#1d1a16] mb-5">Renewal Attention</h3><DataState empty={!loading && upcoming.length === 0} emptyMessage="No renewals require attention." /><div className="space-y-3">{upcoming.map(({ shop, state }) => <button key={shop.id} onClick={() => navigate('/admin/shops')} className="w-full p-3 rounded-2xl border border-[#eadbc8] bg-[#fffaf2] flex items-center justify-between text-left hover:bg-[#f4e5d5]"><div><p className="text-sm font-bold text-[#1d1a16]">{shop.name}</p><p className="text-xs text-[#8a7b68]">{shop.expiry} · {shop.plan}</p></div><span className={cn('text-[10px] font-bold px-2 py-1 rounded-full', state === 'EXPIRED' ? 'bg-red-50 text-red-600' : 'bg-[#fbedd2] text-[#865036]')}>{state.replace('_', ' ')}</span></button>)}</div></Card>
    </div>
  </DashboardLayout>;
}
