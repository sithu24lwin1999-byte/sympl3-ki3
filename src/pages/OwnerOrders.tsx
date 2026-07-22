import React, { useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Badge } from '@/components/ui';
import { Search, CheckCircle2, XCircle, RotateCcw, List } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { cancelOrder, createRecord, refundOrder, useLiveCollection } from '@/lib/firestore';
import type { Order } from '@/types';

export default function OwnerOrders() {
  const { user } = useAuth();
  const ordersPath = user?.shopId ? `shops/${user.shopId}/orders` : null;
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [busyOrder, setBusyOrder] = useState('');
  const [actionError, setActionError] = useState('');
  const { data: orders, loading, error } = useLiveCollection<Order>(ordersPath, 'createdAt');

  const filteredOrders = orders.filter(o => (filter === 'ALL' || o.status === filter) && o.id.toLowerCase().includes(search.toLowerCase()));

  const reverse = async (order: Order, action: 'CANCELLED' | 'REFUNDED') => {
    if (!user?.shopId || user.role !== 'OWNER') return;
    const reason = window.prompt(`${action === 'REFUNDED' ? 'Refund' : 'Cancellation'} reason`, '')?.trim();
    if (reason === undefined) return;
    if (!window.confirm(`${action === 'REFUNDED' ? 'Refund' : 'Cancel'} order ${order.id} and restore its stock?`)) return;
    setBusyOrder(order.id); setActionError('');
    try {
      if (action === 'REFUNDED') await refundOrder(user.shopId, order, reason);
      else await cancelOrder(user.shopId, order, reason);
      await createRecord(`shops/${user.shopId}/auditLogs`, {
        shopId: user.shopId, actorId: user.id, actorName: user.name, action: `ORDER_${action}`,
        detail: `${order.id} · ${reason || 'No reason provided'} · ${order.total} MMK`, createdAt: new Date().toISOString(),
      }).catch(() => undefined);
    } catch (issue) { setActionError(issue instanceof Error ? issue.message : `Unable to ${action.toLowerCase()} order.`); }
    finally { setBusyOrder(''); }
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
        <StatusCard title="All Orders" count={orders.length} icon={List} color="text-blue-600" bg="bg-blue-50" border="border-blue-100" onClick={() => setFilter('ALL')} active={filter === 'ALL'} />
        <StatusCard title="Completed" count={orders.filter(o => o.status === 'COMPLETED').length} icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-100" onClick={() => setFilter('COMPLETED')} active={filter === 'COMPLETED'} />
        <StatusCard title="Cancelled" count={orders.filter(o => o.status === 'CANCELLED').length} icon={XCircle} color="text-red-600" bg="bg-red-50" border="border-red-100" onClick={() => setFilter('CANCELLED')} active={filter === 'CANCELLED'} />
        <StatusCard title="Refunded" count={orders.filter(o => o.status === 'REFUNDED').length} icon={RotateCcw} color="text-purple-600" bg="bg-purple-50" border="border-purple-100" onClick={() => setFilter('REFUNDED')} active={filter === 'REFUNDED'} />
      </div>

      <Card className="p-0 overflow-hidden flex flex-col bg-slate-50 border-none shadow-none">
        <div className="flex items-center justify-between mb-4 px-2">
          <p className="text-sm font-bold text-slate-600">{filter === 'ALL' ? 'All Orders' : `${filter.charAt(0)}${filter.slice(1).toLowerCase()} Orders`}</p>
          <div className="flex items-center bg-white border border-slate-200 rounded-full px-4 py-2 w-72 shadow-sm">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search by Order ID..." 
              className="bg-transparent border-none outline-none text-sm w-full text-slate-900"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {!loading && filteredOrders.map((order) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={order.id}
                className={cn(
                  "bg-white rounded-3xl p-5 border shadow-sm flex flex-col",
                  order.status === 'COMPLETED' ? "border-emerald-100" :
                  order.status === 'REFUNDED' ? "border-purple-100 opacity-70" : "border-red-100 opacity-70"
                )}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-lg text-slate-900">{order.id}</h3>
                    <p className="text-xs text-slate-500 font-medium">{order.branchName || 'Main Branch'} • {order.type} • {new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge 
                    className={cn(
                      "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider",
                      order.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600" :
                      order.status === 'REFUNDED' ? "bg-purple-50 text-purple-600" : "bg-red-50 text-red-600"
                    )}
                  >
                    {order.status}
                  </Badge>
                </div>
                
                <div className="flex-1 mb-4 border-t border-b border-slate-50 py-3">
                  <p className="text-sm font-bold text-slate-700 mb-1">Customer: <span className="font-medium text-slate-500">{order.customer}</span></p>
                  <p className="text-sm font-bold text-slate-700">Items: <span className="font-medium text-slate-500">{order.items.map(item => `${item.name} × ${item.quantity}`).join(', ')}</span></p>
                  {(order.cancelReason || order.refundReason) && <p className="mt-2 text-xs font-bold text-slate-500">Reason: {order.cancelReason || order.refundReason}</p>}
                </div>

                <div className="flex justify-between items-center">
                  <p className="font-black text-[#2563EB] text-lg">{formatCurrency(order.total)}</p>
                  
                  {order.status === 'COMPLETED' && user?.role === 'OWNER' && (
                    <div className="flex gap-2"><Button disabled={busyOrder === order.id} variant="outline" onClick={() => reverse(order, 'CANCELLED')} className="h-8 px-3 text-xs text-red-600 rounded-full">Cancel</Button><Button disabled={busyOrder === order.id} variant="outline" onClick={() => reverse(order, 'REFUNDED')} className="h-8 px-3 text-xs text-purple-600 rounded-full">Refund</Button></div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Card>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {actionError && <p className="mt-4 text-sm font-medium text-red-600">{actionError}</p>}
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
