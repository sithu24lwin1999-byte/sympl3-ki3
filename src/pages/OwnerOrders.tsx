import React, { useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Badge } from '@/components/ui';
import { Search, Filter, Clock, CheckCircle2, ChefHat, XCircle } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const initialOrders = [
  { id: 'ORD-0925', customer: 'Walk-in', type: 'Offline', items: 'Iced Americano × 2', total: 8000, status: 'PENDING', time: 'Just now' },
  { id: 'ORD-0924', customer: 'Kyaw Kyaw', type: 'Online', items: 'Caramel Macchiato, Croissant', total: 9500, status: 'PREPARING', time: '5 mins ago' },
  { id: 'ORD-0923', customer: 'Walk-in', type: 'Offline', items: 'Strawberry Cake, Latte', total: 13500, status: 'PREPARING', time: '8 mins ago' },
  { id: 'ORD-0922', customer: 'Su Su', type: 'Online', items: 'Premium Espresso', total: 4500, status: 'COMPLETED', time: '15 mins ago' },
  { id: 'ORD-0921', customer: 'Walk-in', type: 'Offline', items: 'Club Sandwich, Green Tea', total: 12500, status: 'COMPLETED', time: '22 mins ago' },
  { id: 'ORD-0920', customer: 'Zaw Zaw', type: 'Online', items: 'Latte Art × 3', total: 16500, status: 'CANCELLED', time: '1 hour ago' },
];

export default function OwnerOrders() {
  const [filter, setFilter] = useState('ALL');
  const [orders, setOrders] = useState(initialOrders);

  const filteredOrders = orders.filter(o => filter === 'ALL' || o.status === filter);

  const handleUpdateStatus = (id: string, newStatus: string) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  return (
    <DashboardLayout role="OWNER">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Live Order Monitor</h1>
          <p className="text-slate-500">Watch and manage orders in real-time as they come in.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatusCard title="Pending" count={orders.filter(o => o.status === 'PENDING').length} icon={Clock} color="text-amber-600" bg="bg-amber-50" border="border-amber-100" onClick={() => setFilter('PENDING')} active={filter === 'PENDING'} />
        <StatusCard title="Preparing" count={orders.filter(o => o.status === 'PREPARING').length} icon={ChefHat} color="text-blue-600" bg="bg-blue-50" border="border-blue-100" onClick={() => setFilter('PREPARING')} active={filter === 'PREPARING'} />
        <StatusCard title="Completed (Today)" count={orders.filter(o => o.status === 'COMPLETED').length} icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-100" onClick={() => setFilter('COMPLETED')} active={filter === 'COMPLETED'} />
        <StatusCard title="Cancelled" count={orders.filter(o => o.status === 'CANCELLED').length} icon={XCircle} color="text-red-600" bg="bg-red-50" border="border-red-100" onClick={() => setFilter('CANCELLED')} active={filter === 'CANCELLED'} />
      </div>

      <Card className="p-0 overflow-hidden flex flex-col bg-slate-50 border-none shadow-none">
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
             <Button variant={filter === 'ALL' ? 'primary' : 'outline'} className={cn("h-9 px-4 text-xs rounded-full", filter !== 'ALL' && "bg-white border-slate-200 text-slate-600")} onClick={() => setFilter('ALL')}>
               All Orders
             </Button>
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-full px-4 py-2 w-72 shadow-sm">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search by Order ID..." 
              className="bg-transparent border-none outline-none text-sm w-full text-slate-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredOrders.map((order) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={order.id}
                className={cn(
                  "bg-white rounded-3xl p-5 border shadow-sm flex flex-col",
                  order.status === 'PENDING' ? "border-amber-200" :
                  order.status === 'PREPARING' ? "border-blue-200" :
                  order.status === 'COMPLETED' ? "border-slate-100 opacity-60" : "border-red-100 opacity-60"
                )}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-lg text-slate-900">{order.id}</h3>
                    <p className="text-xs text-slate-500 font-medium">{order.type} • {order.time}</p>
                  </div>
                  <Badge 
                    className={cn(
                      "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider",
                      order.status === 'PENDING' ? "bg-amber-100 text-amber-700" :
                      order.status === 'PREPARING' ? "bg-blue-100 text-blue-700" :
                      order.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}
                  >
                    {order.status}
                  </Badge>
                </div>
                
                <div className="flex-1 mb-4 border-t border-b border-slate-50 py-3">
                  <p className="text-sm font-bold text-slate-700 mb-1">Customer: <span className="font-medium text-slate-500">{order.customer}</span></p>
                  <p className="text-sm font-bold text-slate-700">Items: <span className="font-medium text-slate-500">{order.items}</span></p>
                </div>

                <div className="flex justify-between items-center">
                  <p className="font-black text-[#2563EB] text-lg">{formatCurrency(order.total)}</p>
                  
                  {order.status === 'PENDING' && (
                    <Button onClick={() => handleUpdateStatus(order.id, 'PREPARING')} className="h-8 px-4 text-xs bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white rounded-full">Accept</Button>
                  )}
                  {order.status === 'PREPARING' && (
                    <Button onClick={() => handleUpdateStatus(order.id, 'COMPLETED')} className="h-8 px-4 text-xs bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 text-white rounded-full">Complete</Button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Card>
    </DashboardLayout>
  );
}

function StatusCard({ title, count, icon: Icon, color, bg, border, onClick, active }: any) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md",
        bg, border,
        active ? "ring-2 ring-offset-2 ring-blue-500 shadow-md" : "opacity-80 hover:opacity-100"
      )}
    >
      <div className="flex justify-between items-center">
        <div>
          <p className={cn("text-xs font-bold uppercase tracking-wider mb-1", color)}>{title}</p>
          <p className={cn("text-3xl font-black", color)}>{count}</p>
        </div>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-white/50", color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
