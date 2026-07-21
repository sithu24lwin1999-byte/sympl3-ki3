import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Badge } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import { ShoppingCart, DollarSign, Package, AlertCircle, Sparkles, TrendingUp, TrendingDown, Loader2, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const hourlySales = [
  { time: '08:00', sales: 45000 },
  { time: '10:00', sales: 120000 },
  { time: '12:00', sales: 350000 },
  { time: '14:00', sales: 280000 },
  { time: '16:00', sales: 190000 },
  { time: '18:00', sales: 420000 },
  { time: '20:00', sales: 310000 },
];

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState<'idle' | 'loading' | 'done'>('idle');

  const handleExport = () => {
    setIsExporting('loading');
    
    // Generate PDF
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Daily Sales Report', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text('Shop: City Mart Branch 4', 14, 36);

    const tableData = hourlySales.map(row => [row.time, formatCurrency(row.sales)]);
    
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
          <p className="text-slate-500">City Mart Branch 4 • Subscription Active (24 days left)</p>
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
          <p className="text-2xl font-black text-[#2563EB]">1,850,000 <span className="text-sm">MMK</span></p>
          <div className="mt-2 flex items-center gap-1 text-emerald-500 font-bold text-xs">
            <span>+12.5% vs yesterday</span>
          </div>
        </Card>
        
        <Card className="p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Orders</p>
          <p className="text-2xl font-black">142</p>
          <div className="mt-2 flex items-center gap-1 text-emerald-500 font-bold text-xs">
            <span>24 Online / 118 Offline</span>
          </div>
        </Card>
        
        <Card className="p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Low Stock Items</p>
          <p className="text-2xl font-black text-orange-500">08</p>
          <div className="mt-2 flex items-center gap-1 text-slate-400 font-bold text-xs">
            <span>Critical: Coffee Beans</span>
          </div>
        </Card>

        <div className="bg-[#2563EB] p-5 rounded-3xl shadow-lg shadow-blue-200">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Net Profit</p>
          <p className="text-2xl font-black text-white">420,000 <span className="text-sm opacity-80">MMK</span></p>
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
              <button className="px-3 py-1 text-[11px] font-bold bg-white shadow-sm rounded-md text-slate-900">Today</button>
              <button className="px-3 py-1 text-[11px] font-bold text-slate-500">Weekly</button>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlySales}>
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
            {[
              { id: '89', name: 'Iced Americano × 2', time: 'Kitchen • 2 mins ago', status: 'PREPARING' },
              { id: '88', name: 'Caramel Macchiato', time: 'Online • 5 mins ago', status: 'READY' },
              { id: '87', name: 'Double Espresso', time: 'Takeaway • 12 mins ago', status: 'COMPLETED' },
            ].map((order, i) => (
              <div 
                key={i} 
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
                  )}>#{order.id}</div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{order.name}</p>
                    <p className="text-[10px] text-slate-400">{order.time}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-1 rounded-full",
                  order.status === 'PREPARING' ? "text-blue-600 bg-white border border-blue-200" :
                  order.status === 'READY' ? "text-emerald-600 bg-emerald-50" : "text-slate-500 bg-slate-50"
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

