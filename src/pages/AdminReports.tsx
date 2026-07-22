import React, { useMemo, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button } from '@/components/ui';
import { Download, TrendingUp, DollarSign, Package, ShoppingCart, Loader2, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { downloadCsv } from '@/lib/actions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLiveCollection, useLiveCollectionGroup } from '@/lib/firestore';
import type { Order, Shop } from '@/types';

export default function AdminReports() {
  const { data: orders } = useLiveCollectionGroup<Order>('orders', 'createdAt');
  const { data: shops } = useLiveCollection<Shop>('shops');
  const completed = orders.filter(order => order.status === 'COMPLETED');
  const liveMonthlyData = useMemo(() => Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(); date.setMonth(date.getMonth() - (6 - offset));
    const key = date.toISOString().slice(0, 7);
    const rows = completed.filter(order => order.createdAt.startsWith(key));
    return { name: date.toLocaleDateString('en-US', { month: 'short' }), revenue: rows.reduce((sum, order) => sum + order.total, 0), orders: rows.length };
  }), [completed]);
  const grossVolume = completed.reduce((sum, order) => sum + order.total, 0);
  const productCount = completed.reduce((sum, order) => sum + order.items.reduce((count, item) => count + item.quantity, 0), 0);
  const topShops = shops.map(shop => {
    const shopOrders = completed.filter(order => order.shopId === shop.id);
    return { ...shop, sales: shopOrders.reduce((sum, order) => sum + order.total, 0), orders: shopOrders.length };
  }).sort((a, b) => b.sales - a.sales).slice(0, 5);
  const [exportCsvState, setExportCsvState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [exportPdfState, setExportPdfState] = useState<'idle' | 'loading' | 'done'>('idle');

  const handleExportCsv = () => {
    setExportCsvState('loading');
    requestAnimationFrame(() => {
      downloadCsv('ki3-global-report.csv', [
        ['Month', 'Revenue (MMK)', 'Orders'],
        ...liveMonthlyData.map(row => [row.name, row.revenue, row.orders]),
      ]);
      setExportCsvState('done');
      setTimeout(() => setExportCsvState('idle'), 2000);
    });
  };

  const handleExportPdf = () => {
    setExportPdfState('loading');
    requestAnimationFrame(() => {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('KI3 POS - Global Report', 14, 18);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
      autoTable(doc, {
        startY: 32,
        head: [['Month', 'Revenue (MMK)', 'Orders']],
        body: liveMonthlyData.map(row => [row.name, row.revenue.toLocaleString(), row.orders.toLocaleString()]),
      });
      doc.save('ki3-global-report.pdf');
      setExportPdfState('done');
      setTimeout(() => setExportPdfState('idle'), 2000);
    });
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
        <ReportCard title="Gross Volume" value={formatCurrency(grossVolume)} icon={DollarSign} trend="Live" />
        <ReportCard title="Total Orders" value={completed.length.toLocaleString()} icon={ShoppingCart} trend="Live" />
        <ReportCard title="Total Products Sold" value={productCount.toLocaleString()} icon={Package} trend="Live" />
        <ReportCard title="Average Order Value" value={formatCurrency(completed.length ? grossVolume / completed.length : 0)} icon={TrendingUp} trend="Live" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <Card className="p-6">
          <h3 className="font-bold text-slate-800 mb-6">Revenue Overview</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liveMonthlyData}>
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
              <BarChart data={liveMonthlyData}>
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
              {topShops.map(shop => <tr key={shop.id}>
                <td className="py-4 font-bold text-slate-900">{shop.name}</td>
                <td className="py-4 font-medium">{formatCurrency(shop.sales)}</td>
                <td className="py-4 font-medium text-slate-600">{shop.orders}</td>
                <td className="py-4 font-bold text-emerald-500 text-right">Live</td>
              </tr>)}
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
