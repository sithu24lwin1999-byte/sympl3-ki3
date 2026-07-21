import React, { useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button } from '@/components/ui';
import { Download, TrendingUp, DollarSign, Package, ShoppingCart, Loader2, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatCurrency } from '@/lib/utils';

const monthlyData = [
  { name: 'Jan', revenue: 4000000, orders: 2400 },
  { name: 'Feb', revenue: 3000000, orders: 1398 },
  { name: 'Mar', revenue: 2000000, orders: 9800 },
  { name: 'Apr', revenue: 2780000, orders: 3908 },
  { name: 'May', revenue: 1890000, orders: 4800 },
  { name: 'Jun', revenue: 2390000, orders: 3800 },
  { name: 'Jul', revenue: 3490000, orders: 4300 },
];

export default function AdminReports() {
  const [exportCsvState, setExportCsvState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [exportPdfState, setExportPdfState] = useState<'idle' | 'loading' | 'done'>('idle');

  const handleExportCsv = () => {
    setExportCsvState('loading');
    setTimeout(() => {
      setExportCsvState('done');
      setTimeout(() => setExportCsvState('idle'), 2000);
    }, 1000);
  };

  const handleExportPdf = () => {
    setExportPdfState('loading');
    setTimeout(() => {
      setExportPdfState('done');
      setTimeout(() => setExportPdfState('idle'), 2000);
    }, 1500);
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Global Reports</h1>
          <p className="text-slate-500">Comprehensive analytics across all tenant shops.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="gap-2 bg-white border-slate-200" 
            onClick={handleExportCsv}
            disabled={exportCsvState !== 'idle'}
          >
            {exportCsvState === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : exportCsvState === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Download className="w-4 h-4" />}
            {exportCsvState === 'loading' ? 'Exporting...' : exportCsvState === 'done' ? 'Exported CSV' : 'Export CSV'}
          </Button>
          <Button 
            variant="outline" 
            className="gap-2 bg-white border-slate-200"
            onClick={handleExportPdf}
            disabled={exportPdfState !== 'idle'}
          >
            {exportPdfState === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : exportPdfState === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Download className="w-4 h-4" />}
            {exportPdfState === 'loading' ? 'Exporting...' : exportPdfState === 'done' ? 'Exported PDF' : 'Export PDF'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <ReportCard title="Gross Volume" value={formatCurrency(125000000)} icon={DollarSign} trend="+15%" />
        <ReportCard title="Total Orders" value="84,592" icon={ShoppingCart} trend="+8%" />
        <ReportCard title="Total Products Sold" value="1.2M" icon={Package} trend="+12%" />
        <ReportCard title="Average Order Value" value={formatCurrency(14500)} icon={TrendingUp} trend="+2%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <Card className="p-6">
          <h3 className="font-bold text-slate-800 mb-6">Revenue Overview</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-slate-800 mb-6">Orders Volume</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }}
                  tickFormatter={(val) => `${val / 1000}k`}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Bar dataKey="orders" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-bold text-slate-800 mb-6">Top Performing Shops</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                <th className="pb-3 font-bold">Shop Name</th>
                <th className="pb-3 font-bold">Total Sales</th>
                <th className="pb-3 font-bold">Total Orders</th>
                <th className="pb-3 font-bold text-right">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <tr>
                <td className="py-4 font-bold text-slate-900">City Mart Branch 4</td>
                <td className="py-4 font-medium">{formatCurrency(45000000)}</td>
                <td className="py-4 font-medium text-slate-600">12,450</td>
                <td className="py-4 font-bold text-emerald-500 text-right">+24%</td>
              </tr>
              <tr>
                <td className="py-4 font-bold text-slate-900">The Coffee Lab</td>
                <td className="py-4 font-medium">{formatCurrency(28000000)}</td>
                <td className="py-4 font-medium text-slate-600">8,200</td>
                <td className="py-4 font-bold text-emerald-500 text-right">+18%</td>
              </tr>
              <tr>
                <td className="py-4 font-bold text-slate-900">Yangon Bakehouse</td>
                <td className="py-4 font-medium">{formatCurrency(19500000)}</td>
                <td className="py-4 font-medium text-slate-600">5,430</td>
                <td className="py-4 font-bold text-emerald-500 text-right">+12%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardLayout>
  );
}

function ReportCard({ title, value, icon: Icon, trend }: any) {
  return (
    <Card className="p-5">
      <div className="flex justify-between items-start mb-4">
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</p>
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
      </div>
      <p className="text-2xl font-black text-slate-900 mb-1">{value}</p>
      <div className="flex items-center gap-1 text-emerald-500 font-bold text-xs">
        <span>{trend} vs last period</span>
      </div>
    </Card>
  );
}
