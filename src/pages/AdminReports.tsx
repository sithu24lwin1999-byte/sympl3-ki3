import React, { useMemo } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, DataState, TableStateRow } from '@/components/ui';
import { Download, DollarSign, CalendarClock, ReceiptText, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { downloadCsv, downloadExcel } from '@/lib/actions';
import { monthlyRecurringRevenue, paidSubscriptionRevenue, subscriptionState, todayKey } from '@/lib/subscriptions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLiveCollection, useLiveCollectionGroup } from '@/lib/firestore';
import type { Order, Shop, SubscriptionTransaction } from '@/types';

export default function AdminReports() {
  const { data: transactions, loading: transactionsLoading, error: transactionsError } = useLiveCollection<SubscriptionTransaction>('subscriptionTransactions', 'createdAt');
  const { data: shops, loading: shopsLoading, error: shopsError } = useLiveCollection<Shop>('shops');
  const { data: orders, loading: ordersLoading, error: ordersError } = useLiveCollectionGroup<Order>('orders', 'createdAt');
  const today = todayKey();
  const rows: Array<Array<string | number>> = [['Date','Shop ID','Shop','Plan','Type','Period Start','Period End','Status','Amount MMK','Method','Reference'], ...transactions.map(item => [item.paidAt || item.createdAt, item.shopId, item.shopName, item.plan, item.type, item.periodStart, item.periodEnd, item.status, item.amount, item.paymentMethod || '', item.reference || ''])];
  const monthly = useMemo(() => Array.from({ length: 12 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - (11-index)); const key = date.toISOString().slice(0,7); return { name: date.toLocaleDateString('en-US',{month:'short'}), revenue: transactions.filter(x=>x.status==='PAID'&&(x.paidAt||x.createdAt).startsWith(key)).reduce((sum,x)=>sum+x.amount,0) }; }), [transactions]);
  const byPlan = shops.reduce<Record<string, number>>((result, shop) => { result[shop.plan]=(result[shop.plan]||0)+(shop.monthlyFee||0); return result; }, {});
  const planData = Object.entries(byPlan).map(([name,revenue])=>({name,revenue}));
  const paid = paidSubscriptionRevenue(transactions);
  const outstanding = transactions.filter(x=>x.status==='OUTSTANDING').reduce((sum,x)=>sum+x.amount,0);
  const renewals = transactions.filter(x=>x.type==='RENEWAL'||x.type==='EXTENSION').length;
  const mrr = monthlyRecurringRevenue(shops,today);
  const systemSales = orders.filter(x=>x.status==='COMPLETED').reduce((sum,x)=>sum+x.total,0);
  const active = shops.filter(x=>['TRIAL','ACTIVE','EXPIRING_SOON'].includes(subscriptionState(x,today))).length;
  const expired = shops.filter(x=>['EXPIRED','SUSPENDED','CANCELLED'].includes(subscriptionState(x,today))).length;
  const loading=transactionsLoading||shopsLoading||ordersLoading; const error=transactionsError?`Subscriptions: ${transactionsError}`:shopsError?`Shops: ${shopsError}`:ordersError?`Orders: ${ordersError}`:null;
  const exportPdf=()=>{ const pdf=new jsPDF({orientation:'landscape'}); pdf.text('KI3 POS Subscription Financial Report',14,16); pdf.text(`Generated ${new Date().toLocaleString()} | Paid ${formatCurrency(paid)} | Outstanding ${formatCurrency(outstanding)}`,14,23); autoTable(pdf,{startY:28,head:[rows[0].map(String)],body:rows.slice(1).map(row=>row.map(String))}); pdf.save('ki3-subscription-report.pdf'); };

  return <DashboardLayout role="ADMIN">
    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 mb-8"><div><h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Financial Reports</h1><p className="text-slate-500">Subscriptions, renewals, payments and tenant system sales.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>downloadCsv('ki3-subscriptions.csv',rows)}><Download className="w-4 h-4 mr-2"/>CSV</Button><Button variant="outline" onClick={()=>downloadExcel('ki3-subscriptions.xls',rows)}><Download className="w-4 h-4 mr-2"/>Excel</Button><Button variant="outline" onClick={exportPdf}><Download className="w-4 h-4 mr-2"/>PDF</Button></div></div>
    <DataState loading={loading} error={error}/>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8"><ReportCard title="Subscription Income" value={formatCurrency(paid)} icon={DollarSign}/><ReportCard title="Outstanding Payments" value={formatCurrency(outstanding)} icon={ReceiptText}/><ReportCard title="Monthly Recurring Revenue" value={formatCurrency(mrr)} icon={TrendingUp}/><ReportCard title="Renewals Recorded" value={renewals.toLocaleString()} icon={CalendarClock}/><ReportCard title="Total System Sales" value={formatCurrency(systemSales)} icon={DollarSign}/><ReportCard title="Active / Trial" value={active.toLocaleString()} icon={TrendingUp}/><ReportCard title="Inactive / Expired" value={expired.toLocaleString()} icon={CalendarClock}/><ReportCard title="Transactions" value={transactions.length.toLocaleString()} icon={ReceiptText}/></div>
    <div className="grid lg:grid-cols-2 gap-8 mb-8"><Card><h3 className="font-bold mb-6">Subscription Revenue by Period</h3><div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthly}><defs><linearGradient id="income" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={.3}/><stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis tickFormatter={x=>`${x/1000}k`}/><Tooltip formatter={(value:number)=>formatCurrency(value)}/><Area dataKey="revenue" stroke="#2563EB" fill="url(#income)"/></AreaChart></ResponsiveContainer></div></Card><Card><h3 className="font-bold mb-6">Recurring Revenue by Plan</h3><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={planData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis tickFormatter={x=>`${x/1000}k`}/><Tooltip formatter={(value:number)=>formatCurrency(value)}/><Bar dataKey="revenue" fill="#10B981" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></Card></div>
    <Card><h3 className="font-bold mb-6">Payment History</h3><div className="overflow-x-auto"><table className="w-full text-left min-w-[900px]"><thead><tr className="border-b text-xs uppercase text-slate-500">{['Date','Shop','Plan','Period','Type','Status','Amount'].map(x=><th key={x} className="pb-3">{x}</th>)}</tr></thead><tbody className="divide-y"><TableStateRow columns={7} loading={loading} error={error} empty={!loading&&transactions.length===0} emptyMessage="No subscription payments recorded."/>{transactions.map(x=><tr key={x.id}><td className="py-4 text-xs">{(x.paidAt||x.createdAt).slice(0,10)}</td><td className="font-bold">{x.shopName}</td><td>{x.plan}</td><td className="text-sm">{x.periodStart} → {x.periodEnd}</td><td>{x.type}</td><td>{x.status}</td><td className="font-bold">{formatCurrency(x.amount)}</td></tr>)}</tbody></table></div></Card>
  </DashboardLayout>;
}
function ReportCard({title,value,icon:Icon}:{title:string;value:string;icon:React.ElementType}){return <Card className="p-5"><div className="flex justify-between"><p className="text-xs font-bold uppercase text-slate-500">{title}</p><Icon className="w-4 h-4 text-blue-600"/></div><p className="text-2xl font-black mt-4">{value}</p></Card>}
