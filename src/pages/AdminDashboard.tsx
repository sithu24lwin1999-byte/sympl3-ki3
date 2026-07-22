import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Badge } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import { TrendingUp, Users, Store, Activity, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLiveCollection, useLiveCollectionGroup } from '@/lib/firestore';
import type { AppUser, Order, Shop } from '@/types';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data: shops } = useLiveCollection<Shop>('shops', 'createdAt');
  const { data: users } = useLiveCollection<AppUser>('users');
  const { data: orders } = useLiveCollectionGroup<Order>('orders', 'createdAt');
  const [revenueRange, setRevenueRange] = useState<'6m' | '1y'>('6m');
  const chartData = useMemo(() => {
    const months = revenueRange === '6m' ? 6 : 12;
    return Array.from({ length: months }, (_, offset) => {
      const date = new Date(); date.setMonth(date.getMonth() - (months - 1 - offset));
      const key = date.toISOString().slice(0, 7);
      return { name: date.toLocaleDateString('en-US', { month: 'short' }), value: orders.filter(order => order.createdAt.startsWith(key) && order.status === 'COMPLETED').reduce((sum, order) => sum + order.total, 0) };
    });
  }, [orders, revenueRange]);
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthlyRevenue = orders.filter(order => order.createdAt.startsWith(monthKey) && order.status === 'COMPLETED').reduce((sum, order) => sum + order.total, 0);

  return (
    <DashboardLayout role="ADMIN">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">Platform Overview</h1>
          <p className="text-gray-500 dark:text-gray-400">Welcome back, Admin. Here's what's happening on KI3 POS today.</p>
        </div>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => navigate('/admin/shops', { state: { openCreateModal: true } })}>
          <Plus className="w-4 h-4" /> New Tenant Shop
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Monthly Revenue</p>
          <p className="text-2xl font-black text-[#2563EB]">{formatCurrency(monthlyRevenue)}</p>
          <div className="mt-2 flex items-center gap-1 text-emerald-500 font-bold text-xs">
            <span>+12.5% vs last month</span>
          </div>
        </Card>
        
        <Card className="p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Active Shops</p>
          <p className="text-2xl font-black">{shops.filter(shop => shop.status === 'ACTIVE').length}</p>
          <div className="mt-2 flex items-center gap-1 text-emerald-500 font-bold text-xs">
            <span>+4 this week</span>
          </div>
        </Card>
        
        <Card className="p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Users</p>
          <p className="text-2xl font-black">{users.length}</p>
          <div className="mt-2 flex items-center gap-1 text-emerald-500 font-bold text-xs">
            <span>+120 this week</span>
          </div>
        </Card>

        <div className="bg-[#2563EB] p-5 rounded-3xl shadow-lg shadow-blue-200">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">System Health</p>
          <p className="text-2xl font-black text-white">99.99<span className="text-sm opacity-80">%</span></p>
          <div className="mt-2 flex items-center gap-1 text-white/90 font-bold text-xs">
            <span>Operational</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-800">Revenue Growth (Monthly)</h3>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button onClick={() => setRevenueRange('6m')} className={cn("px-3 py-1 text-[11px] font-bold rounded-md", revenueRange === '6m' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}>6 Months</button>
              <button onClick={() => setRevenueRange('1y')} className={cn("px-3 py-1 text-[11px] font-bold rounded-md", revenueRange === '1y' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}>1 Year</button>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }}
                  tickFormatter={(val) => `${val / 1000000}M`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col">
          <h3 className="font-bold text-slate-800 mb-6">Recent Subscriptions</h3>
          <div className="space-y-4 flex-1">
            {shops.slice(0, 4).map((shop) => (
              <div 
                key={shop.id}
                className={cn(
                  "p-3 rounded-2xl border flex items-center justify-between",
                  shop.status === 'ACTIVE' ? "bg-white border-slate-100" : "bg-white border-slate-100 opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs">
                    {shop.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{shop.name}</p>
                    <p className="text-[10px] text-slate-400">{shop.plan}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-1 rounded-full",
                  shop.status === 'ACTIVE' ? "text-emerald-600 bg-emerald-50" : "text-slate-500 bg-slate-50"
                )}>
                  {shop.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

    </DashboardLayout>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendColor = 'text-gray-500' }: any) {
  return (
    <Card className="p-6 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
      <div>
        <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{value}</h3>
        <p className={`text-sm ${trendColor}`}>{trend}</p>
      </div>
    </Card>
  );
}
