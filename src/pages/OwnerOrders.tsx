import { useMemo, useState, type ReactNode } from 'react';
import { Activity, CheckCircle2, ChevronRight, Clock3, Eye, PackageCheck, RotateCcw, Search, ShoppingBag, X, XCircle } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Badge, Button, Card, DataState } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { advanceOrderStatus, cancelOrder, createRecord, deleteRecord, refundOrder, useLiveCollection, useLiveCollectionWhere, useLiveDocument } from '@/lib/firestore';
import { cn, formatCurrency } from '@/lib/utils';
import type { Employee, HeldOrder, Order, OrderStatus, Shop } from '@/types';

const statuses: OrderStatus[] = ['DRAFT', 'HELD', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'REFUNDED'];
const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = { DRAFT: 'PENDING', HELD: 'PENDING', PENDING: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'READY', READY: 'COMPLETED' };
type MonitorOrder = Order & { source: 'ORDER' | 'HELD' };

export default function OwnerOrders() {
  const { user } = useAuth();
  const shopId = user?.shopId || '';
  const { data: orders, loading, error } = useLiveCollection<Order>(shopId ? `shops/${shopId}/orders` : null, 'createdAt');
  const { data: heldOrders, loading: heldLoading, error: heldError } = useLiveCollection<HeldOrder>(user?.role === 'OWNER' && shopId ? `shops/${shopId}/heldOrders` : null, 'heldAt');
  const { data: ownHeld, loading: ownHeldLoading, error: ownHeldError } = useLiveCollectionWhere<HeldOrder>(user?.role === 'EMPLOYEE' && shopId ? `shops/${shopId}/heldOrders` : null, 'employeeId', user?.id || null);
  const { data: employees } = useLiveCollection<Employee>(user?.role === 'OWNER' && shopId ? `shops/${shopId}/employees` : null);
  const shop = useLiveDocument<Shop>(shopId ? `shops/${shopId}` : null);
  const [filter, setFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MonitorOrder | null>(null);
  const [busyOrder, setBusyOrder] = useState('');
  const [actionError, setActionError] = useState('');
  const visibleHeld = user?.role === 'OWNER' ? heldOrders : ownHeld;

  const monitored = useMemo<MonitorOrder[]>(() => {
    const regular = orders.map(order => ({ ...order, employeeName: order.employeeName || employees.find(employee => employee.id === order.employeeId)?.name || 'Unknown', source: 'ORDER' as const }));
    const held = visibleHeld.map(item => {
      const subtotal = item.items.reduce((sum, line) => sum + line.price * line.quantity, 0);
      const discount = subtotal * Math.min(100, Math.max(0, item.discountPercent)) / 100;
      const total = subtotal - discount + (item.deliveryCharge || 0);
      return {
        id: item.id, orderNumber: item.orderNumber || `HOLD-${item.id.slice(-6).toUpperCase()}`, shopId: item.shopId, shopName: shop?.name || 'Shop', branchId: item.branchId, branchName: item.branchName,
        employeeId: item.employeeId, employeeName: item.employeeName, customer: item.customer, customerPhone: item.customerPhone, type: item.type, items: item.items,
        subtotal, discount, tax: 0, serviceCharge: 0, deliveryCharge: item.deliveryCharge || 0, total, paidAmount: 0, dueAmount: total,
        paymentMethod: 'Not paid', status: 'HELD' as const, notes: item.notes, createdAt: item.heldAt, source: 'HELD' as const,
      };
    });
    return [...regular, ...held].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [employees, orders, shop?.name, visibleHeld]);

  const filtered = monitored.filter(order => {
    const text = `${order.orderNumber || order.id} ${order.id} ${order.customer} ${order.employeeName || ''} ${order.customerPhone || ''}`.toLowerCase();
    return (filter === 'ALL' || order.status === filter) && text.includes(search.toLowerCase());
  });
  const liveSelected = selected ? monitored.find(order => order.source === selected.source && order.id === selected.id) || selected : null;
  const activeCount = monitored.filter(order => ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].includes(order.status)).length;
  const dueTotal = monitored.filter(order => !['CANCELLED', 'REFUNDED'].includes(order.status)).reduce((sum, order) => sum + dueAmount(order), 0);
  const canApprove = user?.role === 'OWNER' || user?.permissions?.approve === true;
  const canRefund = user?.role === 'OWNER' || user?.permissions?.refund === true;

  const audit = async (action: string, detail: string) => {
    if (!user || !shopId) return;
    await createRecord(`shops/${shopId}/auditLogs`, { shopId, actorId: user.id, actorName: user.name, action, detail, createdAt: new Date().toISOString() }).catch(() => undefined);
  };
  const advance = async (order: MonitorOrder) => {
    const next = nextStatus[order.status];
    if (!next || order.source !== 'ORDER' || !canApprove) return;
    if (!window.confirm(`Move ${displayNumber(order)} to ${statusLabel(next)}?`)) return;
    setBusyOrder(order.id); setActionError('');
    try { await advanceOrderStatus(shopId, order.id, next); await audit('ORDER_STATUS_CHANGED', `${displayNumber(order)} · ${order.status} → ${next}`); }
    catch (issue) { setActionError(issue instanceof Error ? issue.message : 'Unable to update order status.'); }
    finally { setBusyOrder(''); }
  };
  const reverse = async (order: MonitorOrder, action: 'CANCELLED' | 'REFUNDED') => {
    if (!shopId || order.source !== 'ORDER' || (action === 'REFUNDED' && !canRefund) || (action === 'CANCELLED' && user?.role !== 'OWNER' && !canRefund)) return;
    const reason = window.prompt(`${action === 'REFUNDED' ? 'Refund' : 'Cancellation'} reason`, '')?.trim();
    if (reason === undefined || !window.confirm(`${action === 'REFUNDED' ? 'Refund' : 'Cancel'} ${displayNumber(order)}?`)) return;
    setBusyOrder(order.id); setActionError('');
    try { action === 'REFUNDED' ? await refundOrder(shopId, order, reason) : await cancelOrder(shopId, order, reason); await audit(`ORDER_${action}`, `${displayNumber(order)} · ${reason || 'No reason'} · ${order.total} MMK`); }
    catch (issue) { setActionError(issue instanceof Error ? issue.message : `Unable to ${action.toLowerCase()} order.`); }
    finally { setBusyOrder(''); }
  };
  const cancelHeld = async (order: MonitorOrder) => {
    if (!window.confirm(`Cancel held order ${displayNumber(order)}?`)) return;
    try { await deleteRecord(`shops/${shopId}/heldOrders`, order.id); setSelected(null); await audit('HELD_ORDER_CANCELLED', displayNumber(order)); }
    catch (issue) { setActionError(issue instanceof Error ? issue.message : 'Unable to cancel held order.'); }
  };

  return <DashboardLayout role="OWNER">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2"><h1 className="text-3xl font-black">Orders</h1><Badge className="bg-emerald-100 text-emerald-700"><span className="mr-1 h-2 w-2 animate-pulse rounded-full bg-emerald-500"/>Live</Badge></div><p className="mt-2 text-slate-500">Incoming and historical orders update automatically in real time.</p></div><div className="rounded-2xl border bg-white px-4 py-3 text-right"><p className="text-xs font-bold uppercase text-slate-400">Outstanding due</p><p className="text-xl font-black text-amber-600">{formatCurrency(dueTotal)}</p></div></div>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="All orders" value={monitored.length} icon={<ShoppingBag/>}/><Metric label="Incoming / active" value={activeCount} icon={<Activity/>} accent="blue"/><Metric label="Ready" value={monitored.filter(order => order.status === 'READY').length} icon={<PackageCheck/>} accent="amber"/><Metric label="Completed" value={monitored.filter(order => order.status === 'COMPLETED').length} icon={<CheckCircle2/>} accent="green"/></div>
    <Card className="overflow-hidden p-0"><div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center"><div className="relative min-w-64 flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search order, customer or employee…" className="h-11 w-full rounded-xl border bg-slate-50 pl-11 pr-3 text-sm outline-none"/></div><div className="flex gap-2 overflow-x-auto">{(['ALL', ...statuses] as const).map(status => <button key={status} onClick={() => setFilter(status)} className={cn('whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold', filter === status ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white text-slate-600')}>{status === 'ALL' ? 'All' : statusLabel(status)} ({status === 'ALL' ? monitored.length : monitored.filter(order => order.status === status).length})</button>)}</div></div>
      <DataState loading={loading || heldLoading || ownHeldLoading} error={error || heldError || ownHeldError} empty={!loading && filtered.length === 0} emptyMessage="No orders match this filter."/>
      {filtered.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left"><thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">{['Order','Shop / Branch','Employee','Customer','Type','Total','Paid','Due','Status','Created','Action'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y">{filtered.map(order => <tr key={`${order.source}-${order.id}`} className={cn('hover:bg-blue-50/40', ['PENDING','CONFIRMED','PREPARING','READY'].includes(order.status) && 'bg-amber-50/30')}><td className="px-4 py-3"><p className="font-black">{displayNumber(order)}</p><p className="text-xs text-slate-400">{order.id}</p></td><td className="px-4 py-3"><p className="font-bold">{order.shopName || shop?.name || 'Shop'}</p><p className="text-xs text-slate-400">{order.branchName || 'Main Branch'}</p></td><td className="px-4 py-3 text-sm font-medium">{order.employeeName || 'Unknown'}</td><td className="px-4 py-3"><p className="text-sm font-bold">{order.customer || 'Walk-in'}</p><p className="text-xs text-slate-400">{order.customerPhone || '—'}</p></td><td className="px-4 py-3 text-sm">{order.type === 'ONLINE' ? 'Online' : 'In-store'}</td><td className="px-4 py-3 font-black">{formatCurrency(order.total)}</td><td className="px-4 py-3 font-bold text-emerald-600">{formatCurrency(paidAmount(order))}</td><td className="px-4 py-3 font-bold text-amber-600">{formatCurrency(dueAmount(order))}</td><td className="px-4 py-3"><OrderBadge status={order.status}/></td><td className="px-4 py-3 text-xs text-slate-500">{new Date(order.createdAt).toLocaleString()}</td><td className="px-4 py-3"><Button variant="outline" className="h-9 px-3" onClick={() => setSelected(order)}><Eye className="mr-1 h-4 w-4"/>View</Button></td></tr>)}</tbody></table></div>}
    </Card>
    {actionError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{actionError}</p>}
    {liveSelected && (
      <OrderModal order={liveSelected} close={() => setSelected(null)} busy={busyOrder === liveSelected.id} canApprove={canApprove} canRefund={canRefund} canCancel={user?.role === 'OWNER' || liveSelected.source === 'HELD' || (liveSelected.status === 'COMPLETED' && canRefund)} onAdvance={() => advance(liveSelected)} onCancel={() => liveSelected.source === 'HELD' ? cancelHeld(liveSelected) : reverse(liveSelected, 'CANCELLED')} onRefund={() => reverse(liveSelected, 'REFUNDED')}/>
    )}
  </DashboardLayout>;
}

function OrderModal({ order, close, busy, canApprove, canRefund, canCancel, onAdvance, onCancel, onRefund }: { order: MonitorOrder; close(): void; busy: boolean; canApprove: boolean; canRefund: boolean; canCancel: boolean; onAdvance(): void; onCancel(): void; onRefund(): void }) {
  const next = nextStatus[order.status];
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/55 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5"><div><p className="text-xs font-bold uppercase text-slate-400">Order details</p><h2 className="text-2xl font-black">{displayNumber(order)}</h2></div><button onClick={close} className="rounded-full bg-slate-100 p-2"><X/></button></div><div className="space-y-5 p-5"><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Info label="Shop" value={order.shopName || 'Shop'}/><Info label="Employee" value={order.employeeName || 'Unknown'}/><Info label="Customer" value={`${order.customer || 'Walk-in'}${order.customerPhone ? ` · ${order.customerPhone}` : ''}`}/><Info label="Order type" value={order.type === 'ONLINE' ? 'Online' : 'In-store'}/></div><div className="overflow-hidden rounded-2xl border"><table className="w-full"><thead><tr className="bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-3">Item</th><th className="p-3">Price</th><th className="p-3">Qty</th><th className="p-3 text-right">Amount</th></tr></thead><tbody className="divide-y">{order.items.map((item,index) => <tr key={`${item.productId}-${index}`}><td className="p-3 font-bold">{item.name}</td><td className="p-3">{formatCurrency(item.price)}</td><td className="p-3">{item.quantity}</td><td className="p-3 text-right font-bold">{formatCurrency(item.price * item.quantity)}</td></tr>)}</tbody></table></div><div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><h3 className="mb-3 font-black">Payment</h3><Info label="Method" value={order.paymentMethod || 'Not selected'}/><div className="mt-2 grid grid-cols-2 gap-2"><Info label="Paid" value={formatCurrency(paidAmount(order))}/><Info label="Due" value={formatCurrency(dueAmount(order))}/></div>{order.payments?.map((payment,index) => <p key={`${payment.kind}-${index}`} className="mt-2 flex justify-between text-sm"><span>{payment.label}</span><b>{formatCurrency(payment.amount)}</b></p>)}</div><div className="space-y-2 rounded-2xl bg-slate-50 p-4"><Amount label="Subtotal" value={order.subtotal}/><Amount label="Discount" value={-order.discount}/><Amount label="Tax" value={order.tax}/><Amount label="Service charge" value={order.serviceCharge || 0}/><Amount label="Delivery charge" value={order.deliveryCharge || 0}/><div className="flex justify-between border-t pt-2 text-lg font-black"><span>Total</span><span>{formatCurrency(order.total)}</span></div></div></div>{order.notes && <div className="rounded-2xl border p-4"><p className="text-xs font-bold uppercase text-slate-400">Notes</p><p className="mt-1 text-sm">{order.notes}</p></div>}<div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Info label="Status" value={statusLabel(order.status)}/><Info label="Created" value={new Date(order.createdAt).toLocaleString()}/><Info label="Completed" value={order.completedAt ? new Date(order.completedAt).toLocaleString() : '—'}/><Info label="Last update" value={order.statusUpdatedAt ? new Date(order.statusUpdatedAt).toLocaleString() : '—'}/></div>{(order.cancelReason || order.refundReason) && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">Reason: {order.cancelReason || order.refundReason}</p>}<div className="flex flex-wrap justify-end gap-2 border-t pt-4">{next && order.source === 'ORDER' && canApprove && <Button disabled={busy} className="bg-blue-600 text-white" onClick={onAdvance}>{statusLabel(next)}<ChevronRight className="ml-1 h-4 w-4"/></Button>}{!['CANCELLED','REFUNDED'].includes(order.status) && canCancel && <Button disabled={busy} variant="outline" className="text-red-600" onClick={onCancel}><XCircle className="mr-1 h-4 w-4"/>Cancel</Button>}{order.status === 'COMPLETED' && canRefund && <Button disabled={busy} variant="outline" className="text-purple-600" onClick={onRefund}><RotateCcw className="mr-1 h-4 w-4"/>Refund</Button>}</div></div></div></div>;
}

function paidAmount(order: Order) { return order.paidAmount ?? (order.paymentKind === 'CREDIT' ? 0 : order.status === 'COMPLETED' ? order.total : 0); }
function dueAmount(order: Order) { return order.dueAmount ?? Math.max(0, order.total - paidAmount(order)); }
function displayNumber(order: Order) { return order.orderNumber || `#${order.id.slice(-8).toUpperCase()}`; }
function statusLabel(status: OrderStatus) { return status.charAt(0) + status.slice(1).toLowerCase(); }
function OrderBadge({ status }: { status: OrderStatus }) { const styles: Record<OrderStatus,string> = { DRAFT:'bg-slate-100 text-slate-600', HELD:'bg-indigo-100 text-indigo-700', PENDING:'bg-amber-100 text-amber-700', CONFIRMED:'bg-blue-100 text-blue-700', PREPARING:'bg-orange-100 text-orange-700', READY:'bg-cyan-100 text-cyan-700', COMPLETED:'bg-emerald-100 text-emerald-700', CANCELLED:'bg-red-100 text-red-700', REFUNDED:'bg-purple-100 text-purple-700' }; return <Badge className={styles[status]}>{statusLabel(status)}</Badge>; }
function Metric({ label, value, icon, accent = 'slate' }: { label: string; value: number; icon: ReactNode; accent?: 'slate'|'blue'|'amber'|'green' }) { const styles={slate:'bg-slate-100 text-slate-700',blue:'bg-blue-100 text-blue-700',amber:'bg-amber-100 text-amber-700',green:'bg-emerald-100 text-emerald-700'}; return <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div><div className={cn('grid h-10 w-10 place-items-center rounded-xl [&>svg]:h-5 [&>svg]:w-5',styles[accent])}>{icon}</div></div></Card>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>; }
function Amount({ label, value }: { label: string; value: number }) { return <div className="flex justify-between text-sm"><span className="text-slate-500">{label}</span><b>{value < 0 ? '-' : ''}{formatCurrency(Math.abs(value))}</b></div>; }
