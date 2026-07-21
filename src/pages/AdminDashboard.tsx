import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Badge } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import { TrendingUp, Users, Store, Activity, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const revenueData = [
  { name: 'Jan', value: 2400000 },
  { name: 'Feb', value: 3100000 },
  { name: 'Mar', value: 2800000 },
  { name: 'Apr', value: 3900000 },
  { name: 'May', value: 4500000 },
  { name: 'Jun', value: 5200000 },
];

export default function AdminDashboard() {
  const navigate = useNavigate();

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
          <p className="text-2xl font-black text-[#2563EB]">5,200,000 <span className="text-sm">MMK</span></p>
          <div className="mt-2 flex items-center gap-1 text-emerald-500 font-bold text-xs">
            <span>+12.5% vs last month</span>
          </div>
        </Card>
        
        <Card className="p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Active Shops</p>
          <p className="text-2xl font-black">1,248</p>
          <div className="mt-2 flex items-center gap-1 text-emerald-500 font-bold text-xs">
            <span>+4 this week</span>
          </div>
        </Card>
        
        <Card className="p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Users</p>
          <p className="text-2xl font-black">14,290</p>
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
              <button className="px-3 py-1 text-[11px] font-bold bg-white shadow-sm rounded-md text-slate-900">6 Months</button>
              <button className="px-3 py-1 text-[11px] font-bold text-slate-500">1 Year</button>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
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
            {[
              { name: 'City Mart Branch 4', plan: '50000 MMK', status: 'ACTIVE' },
              { name: 'Kyaw Cafe', plan: '30000 MMK', status: 'ACTIVE' },
              { name: 'Mandalay Superstore', plan: '50000 MMK', status: 'EXPIRED' },
              { name: 'Yangon Bakehouse', plan: '30000 MMK', status: 'ACTIVE' },
            ].map((shop, i) => (
              <div 
                key={i} 
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
