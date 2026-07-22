import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Badge } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import { ShoppingCart, DollarSign, Package, AlertCircle, Sparkles, TrendingUp, TrendingDown, Loader2, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/lib/auth';
import { useLiveCollection, useLiveDocument } from '@/lib/firestore';
import type { Order, Product, Shop } from '@/types';

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const shopId = user?.shopId;
  const shop = useLiveDocument<Shop>(shopId ? `shops/${shopId}` : null);
  const { data: orders } = useLiveCollection<Order>(shopId ? `shops/${shopId}/orders` : null, 'createdAt');
  const { data: products } = useLiveCollection<Product>(shopId ? `shops/${shopId}/products` : null);
  const [isExporting, setIsExporting] = useState<'idle' | 'loading' | 'done'>('idle');
  const [salesRange, setSalesRange] = useState<'today' | 'weekly'>('today');
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(order => order.createdAt.startsWith(today) && order.status === 'COMPLETED');
  const revenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const lowStock = products.filter(product => product.stock <= product.minStock).length;
  const profit = todayOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => {
    const product = products.find(candidate => candidate.id === item.productId);
    return itemSum + ((item.price - (product?.cost || 0)) * item.quantity);
  }, 0), 0);
  const liveSales = useMemo(() => {
    if (salesRange === 'today') return Array.from({ length: 13 }, (_, index) => {
      const hour = index + 8;
      return { time: `${String(hour).padStart(2, '0')}:00`, sales: todayOrders.filter(order => new Date(order.createdAt).getHours() === hour).reduce((sum, order) => sum + order.total, 0) };
    });
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(); date.setDate(date.getDate() - (6 - offset));
      const key = date.toISOString().slice(0, 10);
      return { time: date.toLocaleDateString('en-US', { weekday: 'short' }), sales: orders.filter(order => order.createdAt.startsWith(key) && order.status === 'COMPLETED').reduce((sum, order) => sum + order.total, 0) };
    });
  }, [orders, salesRange, todayOrders]);

  const handleExport = () => {
    setIsExporting('loading');
    
    // Generate PDF
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Daily Sales Report', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Shop: ${shop?.name || 'My Shop'}`, 14, 36);

    const tableData = liveSales.map(row => [row.time, formatCurrency(row.sales)]);
    
    autoTable(doc, {
      startY: 45,
      head: [['Time', 'Sales (MMK)']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }
    });

    // Save PDF
    doc.save(`daily_report_${new Date().toISOString().split('T')[0]}.pdf`);

    setTimeout(() => {
      setIsExporting('done');
      setTimeout(() => setIsExporting('idle'), 2000);
    }, 500);
  };

  return (
    <DashboardLayout role="OWNER">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">My Shop Dashboard</h1>
          <p className="text-slate-500">{shop?.name || 'My Shop'} • Subscription {shop?.status || 'Loading'}</p>
        </div>
        <Button 
          variant="outline" 
          className="gap-2 bg-white border-slate-200"
          onClick={handleExport}
          disabled={isExporting !== 'idle'}
        >
          {isExporting === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : isExporting === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : null}
          {isExporting === 'loading' ? 'Exporting...' : isExporting === 'done' ? 'Exported' : 'Export Daily Report'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Today's Revenue</p>
          <p className="text-2xl font-black text-[#2563EB]">{formatCurrency(revenue)}</p>
          <div className="mt-2 flex items-center gap-1 text-emerald-500 font-bold text-xs">
            <span>+12.5% vs yesterday</span>
          </div>
        </Card>
        
        <Card className="p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Orders</p>
          <p className="text-2xl font-black">{todayOrders.length}</p>
          <div className="mt-2 flex items-center gap-1 text-emerald-500 font-bold text-xs">
            <span>24 Online / 118 Offline</span>
          </div>
        </Card>
        
        <Card className="p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Low Stock Items</p>
          <p className="text-2xl font-black text-orange-500">{lowStock}</p>
          <div className="mt-2 flex items-center gap-1 text-slate-400 font-bold text-xs">
            <span>Critical: Coffee Beans</span>
          </div>
        </Card>

        <div className="bg-[#2563EB] p-5 rounded-3xl shadow-lg shadow-blue-200">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Net Profit</p>
          <p className="text-2xl font-black text-white">{formatCurrency(profit)}</p>
          <div className="mt-2 flex items-center gap-1 text-white/90 font-bold text-xs">
            <span>Higher than target</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-800">Sales by Hour (Today)</h3>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button onClick={() => setSalesRange('today')} className={cn("px-3 py-1 text-[11px] font-bold rounded-md", salesRange === 'today' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}>Today</button>
              <button onClick={() => setSalesRange('weekly')} className={cn("px-3 py-1 text-[11px] font-bold rounded-md", salesRange === 'weekly' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}>Weekly</button>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={liveSales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }}
                  tickFormatter={(val) => `${val / 1000}k`}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="sales" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col">
          <h3 className="font-bold text-slate-800 mb-6">Live Order Monitor</h3>
          <div className="space-y-4 flex-1">
            {orders.slice(0, 3).map((order) => (
              <div 
                key={order.id}
                className={cn(
                  "p-3 rounded-2xl border flex items-center justify-between",
                  order.status === 'PREPARING' ? "bg-blue-50 border-blue-100" : 
                  order.status === 'COMPLETED' ? "bg-white border-slate-100 opacity-60" : "bg-white border-slate-100"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                    order.status === 'PREPARING' ? "bg-blue-200 text-blue-700" : "bg-slate-100 text-slate-700"
                  )}>#{order.id.slice(-3)}</div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{order.items.map(item => `${item.name} × ${item.quantity}`).join(', ')}</p>
                    <p className="text-[10px] text-slate-400">{new Date(order.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-1 rounded-full",
                  order.status === 'PREPARING' ? "text-blue-600 bg-white border border-blue-200" :
                  order.status === 'COMPLETED' ? "text-emerald-600 bg-emerald-50" : "text-slate-500 bg-slate-50"
                )}>
                  {order.status}
                </span>
              </div>
            ))}
            
            <div className="pt-4 mt-auto">
              <button 
                onClick={() => navigate('/owner/orders')}
                className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold transition-colors border border-slate-100"
              >
                View All Real-time Orders
              </button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
