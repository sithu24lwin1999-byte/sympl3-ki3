import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AlertTriangle, CheckCircle2, CircleDollarSign, CreditCard, DollarSign, Download, Loader2, Package, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Badge, Button, Card, DataState } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { localDateKey } from '@/lib/finance';
import { useLiveCollection, useLiveDocumentState } from '@/lib/firestore';
import { cn, formatCurrency } from '@/lib/utils';
import type { Customer, Expense, Order, Product, Shop } from '@/types';

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];
const completed = (order: Order) => order.status === 'COMPLETED';
const dateOffset = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return localDateKey(date.toISOString()); };

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const shopId = user?.shopId;
  const { data: shop, loading: shopLoading, error: shopError } = useLiveDocumentState<Shop>(shopId ? `shops/${shopId}` : null);
  const { data: orders, loading: ordersLoading, error: ordersError } = useLiveCollection<Order>(shopId ? `shops/${shopId}/orders` : null, 'createdAt');
  const { data: products, loading: productsLoading, error: productsError } = useLiveCollection<Product>(shopId ? `shops/${shopId}/products` : null);
  const { data: expenses, loading: expensesLoading, error: expensesError } = useLiveCollection<Expense>(shopId ? `shops/${shopId}/expenses` : null, 'createdAt');
  const { data: customers, loading: customersLoading, error: customersError } = useLiveCollection<Customer>(shopId ? `shops/${shopId}/customers` : null, 'updatedAt');
  const [exporting, setExporting] = useState<'idle'|'loading'|'done'>('idle');
  const today = localDateKey(new Date().toISOString());
  const month = today.slice(0, 7);
  const todayAllOrders = orders.filter(order => localDateKey(order.createdAt) === today);
  const todayCompleted = todayAllOrders.filter(completed);
  const monthOrders = orders.filter(order => completed(order) && localDateKey(order.createdAt).startsWith(month));
  const monthExpenses = expenses.filter(item => localDateKey(item.createdAt).startsWith(month));
  const todaySales = todayCompleted.reduce((sum, order) => sum + order.total, 0);
  const grossIncome = monthOrders.reduce((sum, order) => sum + order.total, 0);
  const expenseTotal = monthExpenses.filter(item => item.type !== 'OWNER_WITHDRAWAL').reduce((sum, item) => sum + item.amount, 0);
  const productCost = (order: Order) => order.items.reduce((sum, item) => sum + (products.find(product => product.id === item.productId)?.cost || 0) * item.quantity, 0);
  const costOfGoods = monthOrders.reduce((sum, order) => sum + productCost(order), 0);
  const netProfit = grossIncome - costOfGoods - expenseTotal;
  const onlineSales = todayCompleted.filter(order => order.type === 'ONLINE').reduce((sum, order) => sum + order.total, 0);
  const storeSales = todayCompleted.filter(order => order.type === 'IN_STORE' || order.type === 'OFFLINE').reduce((sum, order) => sum + order.total, 0);
  const stockProducts = products.filter(product => product.itemType !== 'SERVICE' && product.trackStock !== false);
  const outOfStock = stockProducts.filter(product => product.stock <= 0).length;
  const lowStock = stockProducts.filter(product => product.stock > 0 && product.stock <= product.minStock).length;
  const recordedCustomerCredit = customers.reduce((sum, customer) => sum + (customer.outstandingCredit || 0), 0);
  const orderCredit = orders.filter(completed).reduce((sum, order) => sum + (order.payments?.filter(payment => payment.kind === 'CREDIT').reduce((paymentSum, payment) => paymentSum + payment.amount, 0) || (order.paymentKind === 'CREDIT' ? order.total : 0)), 0);
  const outstandingCredit = recordedCustomerCredit + orderCredit;
  const loading = shopLoading || ordersLoading || productsLoading || expensesLoading || customersLoading;
  const error = shopError ? `Shop: ${shopError}` : ordersError ? `Orders: ${ordersError}` : productsError ? `Products: ${productsError}` : expensesError ? `Expenses: ${expensesError}` : customersError ? `Customers: ${customersError}` : null;

  const analytics = useMemo(() => {
    const validOrders = orders.filter(completed);
    const salesByHour = Array.from({ length: 24 }, (_, hour) => ({ label: `${String(hour).padStart(2,'0')}:00`, sales: todayCompleted.filter(order => new Date(order.createdAt).getHours() === hour).reduce((sum, order) => sum + order.total, 0) }));
    const daily = Array.from({ length: 14 }, (_, index) => { const key = dateOffset(index - 13); return { label: new Date(`${key}T00:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'}), sales: validOrders.filter(order => localDateKey(order.createdAt) === key).reduce((sum, order) => sum + order.total, 0) }; });
    const weekly = Array.from({ length: 8 }, (_, index) => { const endOffset = (index - 7) * 7; const keys = Array.from({length:7},(_,day)=>dateOffset(endOffset + day)); return { label: `W${index + 1}`, sales: validOrders.filter(order => keys.includes(localDateKey(order.createdAt))).reduce((sum, order) => sum + order.total, 0) }; });
    const monthly = Array.from({ length: 12 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - (11-index)); const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; return { label: date.toLocaleDateString('en-US',{month:'short'}), sales: validOrders.filter(order => localDateKey(order.createdAt).startsWith(key)).reduce((sum, order) => sum + order.total, 0) }; });
    const cutoff = dateOffset(-29);
    const recent = validOrders.filter(order => localDateKey(order.createdAt) >= cutoff);
    const channel = [{ name: 'Online', value: recent.filter(order => order.type === 'ONLINE').reduce((sum,order)=>sum+order.total,0) }, { name: 'In-store', value: recent.filter(order => order.type === 'IN_STORE' || order.type === 'OFFLINE').reduce((sum,order)=>sum+order.total,0) }];
    const productMap = new Map<string,{name:string;quantity:number;sales:number}>();
    recent.forEach(order => order.items.forEach(item => { const current=productMap.get(item.productId)||{name:item.name,quantity:0,sales:0}; current.quantity+=item.quantity; current.sales+=item.quantity*item.price; productMap.set(item.productId,current); }));
    const topProducts = [...productMap.values()].sort((a,b)=>b.quantity-a.quantity).slice(0,7);
    const categoryMap = new Map<string,number>();
    recent.forEach(order => order.items.forEach(item => { const category=products.find(product=>product.id===item.productId)?.category||'Uncategorized'; categoryMap.set(category,(categoryMap.get(category)||0)+item.quantity*item.price); }));
    const topCategories = [...categoryMap].map(([name,sales])=>({name,sales})).sort((a,b)=>b.sales-a.sales).slice(0,7);
    const paymentMap = new Map<string,number>(); recent.forEach(order=>{if(order.payments?.length) order.payments.forEach(payment=>paymentMap.set(payment.label,(paymentMap.get(payment.label)||0)+payment.amount)); else {const method=order.paymentKind||order.paymentMethod||'Unknown';paymentMap.set(method,(paymentMap.get(method)||0)+order.total)}});
    const payments = [...paymentMap].map(([name,value])=>({name,value}));
    return { salesByHour, daily, weekly, monthly, channel, topProducts, topCategories, payments };
  }, [orders, products, today]);

  const exportDaily = () => { setExporting('loading'); const pdf=new jsPDF(); pdf.setFontSize(18); pdf.text(`${shop?.name||'Shop'} - Daily Sales Report`,14,18); pdf.setFontSize(10); pdf.text(`Date: ${today} | Sales: ${formatCurrency(todaySales)} | Orders: ${todayAllOrders.length}`,14,26); autoTable(pdf,{startY:32,head:[['Time','Order','Channel','Payment','Status','Amount']],body:todayAllOrders.map(order=>[new Date(order.createdAt).toLocaleTimeString(),order.id,order.type,order.paymentKind||order.paymentMethod,order.status,formatCurrency(order.total)])}); pdf.save(`daily-report-${today}.pdf`); setExporting('done'); window.setTimeout(()=>setExporting('idle'),2000); };
  const metrics = [
    ['Today’s Sales',formatCurrency(todaySales),`${todayCompleted.length} completed`,DollarSign], ['Today’s Orders',String(todayAllOrders.length),`${todayCompleted.length} completed`,ShoppingCart],
    ['Gross Income',formatCurrency(grossIncome),'Month to date',TrendingUp], ['Net Profit',formatCurrency(netProfit),'After product cost & expenses',CircleDollarSign],
    ['Expenses',formatCurrency(expenseTotal),'Operating · month to date',CreditCard], ['Online Sales',formatCurrency(onlineSales),'Today',ShoppingCart],
    ['In-store Sales',formatCurrency(storeSales),'Today',DollarSign], ['Low-stock Products',String(lowStock),'Needs restocking',AlertTriangle],
    ['Out-of-stock Products',String(outOfStock),'Unavailable products',Package], ['Total Customers',String(customers.length),'Customer directory',Users],
    ['Outstanding Credit',formatCurrency(outstandingCredit),'Customer credit balance',CreditCard],
  ] as const;

  return <DashboardLayout role="OWNER">
    <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8"><div><h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">{shop?.name || 'My Shop'} Dashboard</h1><p className="text-slate-500">Live sales, profitability, stock and customer performance.</p></div><Button variant="outline" className="bg-white" onClick={exportDaily} disabled={exporting!=='idle'}>{exporting==='loading'?<Loader2 className="w-4 h-4 mr-2 animate-spin"/>:exporting==='done'?<CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500"/>:<Download className="w-4 h-4 mr-2"/>}{exporting==='loading'?'Exporting…':exporting==='done'?'Exported':'Export Daily Report'}</Button></div>
    <DataState loading={loading} error={error}/>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">{metrics.map(([label,value,note,Icon],index)=><div key={label}><Metric label={label} value={value} note={note} icon={Icon} accent={index===3}/></div>)}</div>
    <div className="grid lg:grid-cols-2 gap-8 mb-8"><ChartCard title="Sales by Hour (Today)"><BarChart data={analytics.salesByHour}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0"/><XAxis dataKey="label" interval={2}/><YAxis tickFormatter={shortMoney}/><Tooltip formatter={moneyTooltip}/><Bar dataKey="sales" fill="#2563EB" radius={[5,5,0,0]}/></BarChart></ChartCard><ChartCard title="Daily Sales (14 Days)"><AreaChart data={analytics.daily}><defs><linearGradient id="dailySales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={.3}/><stop offset="95%" stopColor="#10B981" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0"/><XAxis dataKey="label"/><YAxis tickFormatter={shortMoney}/><Tooltip formatter={moneyTooltip}/><Area dataKey="sales" stroke="#10B981" strokeWidth={3} fill="url(#dailySales)"/></AreaChart></ChartCard><ChartCard title="Weekly Sales (8 Weeks)"><BarChart data={analytics.weekly}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0"/><XAxis dataKey="label"/><YAxis tickFormatter={shortMoney}/><Tooltip formatter={moneyTooltip}/><Bar dataKey="sales" fill="#8B5CF6" radius={[5,5,0,0]}/></BarChart></ChartCard><ChartCard title="Monthly Sales (12 Months)"><AreaChart data={analytics.monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0"/><XAxis dataKey="label"/><YAxis tickFormatter={shortMoney}/><Tooltip formatter={moneyTooltip}/><Area dataKey="sales" stroke="#2563EB" strokeWidth={3} fill="#DBEAFE"/></AreaChart></ChartCard></div>
    <div className="grid lg:grid-cols-3 gap-8 mb-8"><PieCard title="Online vs In-store (30 Days)" data={analytics.channel}/><PieCard title="Payment Methods (30 Days)" data={analytics.payments}/><ChartCard title="Top-selling Products (30 Days)" compact><BarChart data={analytics.topProducts} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number"/><YAxis dataKey="name" type="category" width={95}/><Tooltip/><Bar dataKey="quantity" fill="#F59E0B" radius={[0,5,5,0]}/></BarChart></ChartCard></div>
    <div className="grid lg:grid-cols-2 gap-8 mb-8"><ChartCard title="Top Categories (30 Days)"><BarChart data={analytics.topCategories}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0"/><XAxis dataKey="name"/><YAxis tickFormatter={shortMoney}/><Tooltip formatter={moneyTooltip}/><Bar dataKey="sales" fill="#06B6D4" radius={[5,5,0,0]}/></BarChart></ChartCard><Card><div className="flex justify-between items-center mb-5"><h3 className="font-bold">Real-time Recent Orders</h3><Button variant="outline" className="h-9 text-xs" onClick={()=>navigate('/owner/orders')}>View All</Button></div><DataState empty={!loading&&orders.length===0} emptyMessage="No orders yet."/><div className="space-y-3">{orders.slice(0,8).map(order=><div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3"><div className="min-w-0"><p className="text-sm font-bold truncate">#{order.id.slice(-6)} · {order.customer||'Walk-in'}</p><p className="text-xs text-slate-400 truncate">{new Date(order.createdAt).toLocaleString()} · {order.type} · {order.paymentKind||order.paymentMethod}</p></div><div className="text-right shrink-0"><p className="text-sm font-bold">{formatCurrency(order.total)}</p><Badge variant={order.status==='COMPLETED'?'success':order.status==='CANCELLED'||order.status==='REFUNDED'?'danger':'warning'}>{order.status}</Badge></div></div>)}</div></Card></div>
  </DashboardLayout>;
}

function Metric({label,value,note,icon:Icon,accent}:{label:string;value:string;note:string;icon:React.ElementType;accent?:boolean}){return <Card className={cn('p-5 h-full',accent&&'bg-blue-600 text-white')}><div className="flex justify-between"><p className={cn('text-xs font-bold uppercase tracking-wider',accent?'text-white/70':'text-slate-400')}>{label}</p><Icon className={cn('w-4 h-4',accent?'text-white':'text-blue-600')}/></div><p className="text-2xl font-black mt-4">{value}</p><p className={cn('text-xs mt-2',accent?'text-white/75':'text-slate-400')}>{note}</p></Card>}
function ChartCard({title,children,compact=false}:{title:string;children:React.ReactElement;compact?:boolean}){return <Card><h3 className="font-bold mb-6">{title}</h3><div className={compact?'h-72':'h-72'}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></Card>}
function PieCard({title,data}:{title:string;data:Array<{name:string;value:number}>}){return <Card><h3 className="font-bold mb-3">{title}</h3>{data.length===0||data.every(item=>item.value===0)?<div className="h-72 grid place-items-center text-sm text-slate-400">No sales data yet.</div>:<div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>{data.map((item,index)=><Cell key={item.name} fill={COLORS[index%COLORS.length]}/>)}</Pie><Tooltip formatter={moneyTooltip}/><Legend/></PieChart></ResponsiveContainer></div>}</Card>}
const shortMoney=(value:number)=>value>=1000000?`${(value/1000000).toFixed(1)}M`:`${Math.round(value/1000)}k`;
const moneyTooltip=(value:number)=>formatCurrency(value);
