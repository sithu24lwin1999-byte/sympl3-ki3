import { useEffect, useMemo, useState, type ElementType } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Banknote, Download, FileSpreadsheet, Printer, RefreshCw, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Button, Card, DataState, Input } from '@/components/ui';
import { downloadCsv, downloadExcel } from '@/lib/actions';
import { useAuth } from '@/lib/auth';
import { collectOrderDue, createRecord, useLiveCollection } from '@/lib/firestore';
import { getReportDetails, getServerReportTotals, periodDates, reportBreakdowns, reportRange, type ReportDetails, type ReportPeriod, type ReportTotals } from '@/lib/reporting';
import { formatCurrency } from '@/lib/utils';
import type { Order, PaymentKind, Product } from '@/types';

const emptyTotals: ReportTotals = { sales: 0, orders: 0, initialPaid: 0, due: 0, purchases: 0, purchaseReturns: 0, expenses: 0, dueCollected: 0 };
const emptyDetails: ReportDetails = { orders: [], purchases: [], expenses: [], dueCollections: [] };
const periods: Array<{ value: ReportPeriod; label: string }> = [
  { value: 'DAILY', label: 'Daily' }, { value: 'WEEKLY', label: 'Weekly' }, { value: 'MONTHLY', label: 'Monthly' }, { value: 'YEARLY', label: 'Yearly' }, { value: 'CUSTOM', label: 'Custom' },
];
const paymentOptions: Array<{ kind: Exclude<PaymentKind, 'CREDIT' | 'SPLIT'>; label: string }> = [
  { kind: 'CASH', label: 'Cash' }, { kind: 'BANK', label: 'Bank transfer' }, { kind: 'CARD', label: 'Card' }, { kind: 'KPAY', label: 'KBZPay' }, { kind: 'WAVE', label: 'WavePay' }, { kind: 'AYAPAY', label: 'AYA Pay' }, { kind: 'CBPAY', label: 'CB Pay' },
];

export default function OwnerReports() {
  const { user } = useAuth();
  const shopId = user?.shopId;
  const [period, setPeriod] = useState<ReportPeriod>('MONTHLY');
  const initial = periodDates('MONTHLY');
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [totals, setTotals] = useState(emptyTotals);
  const [details, setDetails] = useState(emptyDetails);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const { data: products } = useLiveCollection<Product>(shopId ? `shops/${shopId}/products` : null);

  useEffect(() => {
    if (period === 'CUSTOM') return;
    const dates = periodDates(period); setStartDate(dates.startDate); setEndDate(dates.endDate);
  }, [period]);
  useEffect(() => {
    if (!shopId) return;
    let active = true; setLoading(true); setError(null);
    try {
      const range = reportRange(startDate, endDate);
      Promise.all([getServerReportTotals(shopId, range), getReportDetails(shopId, range)])
        .then(([nextTotals, nextDetails]) => { if (active) { setTotals(nextTotals); setDetails(nextDetails); } })
        .catch(issue => { if (active) setError(issue instanceof Error ? issue.message : 'Unable to load report.'); })
        .finally(() => { if (active) setLoading(false); });
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'Invalid range.'); setLoading(false); }
    return () => { active = false; };
  }, [endDate, refresh, shopId, startDate]);

  const breakdown = useMemo(() => reportBreakdowns(details, products), [details, products]);
  const cogs = breakdown.products.reduce((sum, item) => sum + item.cost, 0);
  const operatingExpenses = details.expenses.filter(item => item.type !== 'OWNER_WITHDRAWAL').reduce((sum, item) => sum + item.amount, 0);
  const ownerWithdrawals = details.expenses.filter(item => item.type === 'OWNER_WITHDRAWAL').reduce((sum, item) => sum + item.amount, 0);
  const legacyOrders = new Set(details.orders.filter(order => order.initialPaidAmount === undefined).map(order => order.id));
  const legacyReceipts = details.orders.filter(order => legacyOrders.has(order.id)).reduce((sum, order) => sum + (order.paidAmount ?? Math.max(0, order.total - (order.dueAmount || 0))), 0);
  const dueCollectionsOutsideLegacySales = details.dueCollections.filter(item => !legacyOrders.has(item.orderId)).reduce((sum, item) => sum + item.amount, 0);
  const income = totals.initialPaid + legacyReceipts + dueCollectionsOutsideLegacySales;
  const grossProfit = totals.sales - cogs;
  const netProfit = grossProfit - operatingExpenses;
  const netPurchases = totals.purchases - totals.purchaseReturns;
  const outstanding = details.orders.filter(order => (order.dueAmount ?? (order.paymentKind === 'CREDIT' ? order.total : 0)) > 0);
  const reportRows: Array<Array<string | number>> = [
    ['KI3 POS Accounting Report', `${startDate} to ${endDate}`], ['Metric', 'Amount'], ['Sales', totals.sales], ['Income received', income], ['Purchases', totals.purchases], ['Purchase returns', totals.purchaseReturns], ['Net purchases', netPurchases], ['Expenses', totals.expenses], ['Cost of goods', cogs], ['Gross profit', grossProfit], ['Net profit', netProfit], ['Outstanding credit', totals.due], ['Due collected', totals.dueCollected], [],
    ['Orders'], ['Date', 'Order', 'Customer', 'Channel', 'Payment', 'Sales', 'Tax', 'Due'],
    ...details.orders.map(order => [new Date(order.createdAt).toLocaleString(), order.orderNumber || order.id, order.customer, order.type, order.paymentMethod, order.total, order.tax || 0, order.dueAmount || 0]), [],
    ['Purchases'], ['Date', 'Supplier', 'Product', 'Quantity', 'Unit cost', 'Total'], ...details.purchases.map(item => [new Date(item.createdAt).toLocaleString(), item.supplierName, item.productName, item.quantity, item.unitCost, item.total]), [],
    ['Expenses'], ['Date', 'Category', 'Note', 'Type', 'Amount'], ...details.expenses.map(item => [new Date(item.createdAt).toLocaleString(), item.category, item.note, item.type || 'OPERATING', item.amount]), [],
    ['Due Collections'], ['Date', 'Order', 'Customer', 'Payment', 'Reference', 'Amount'], ...details.dueCollections.map(item => [new Date(item.createdAt).toLocaleString(), item.orderNumber, item.customer, item.paymentMethod, item.reference || '', item.amount]),
  ];
  const fileBase = `ki3-accounting-${startDate}-${endDate}`;
  const exportPdf = () => { const pdf = new jsPDF({ orientation: 'landscape' }); pdf.setFontSize(18); pdf.text('KI3 POS Accounting Report', 14, 16); pdf.setFontSize(10); pdf.text(`${startDate} to ${endDate}`, 14, 23); autoTable(pdf, { startY: 29, head: [['Metric', 'Amount (MMK)']], body: [['Sales', totals.sales], ['Income received', income], ['Purchases', totals.purchases], ['Purchase returns', totals.purchaseReturns], ['Net purchases', netPurchases], ['Expenses', totals.expenses], ['Cost of goods', cogs], ['Net profit', netProfit], ['Outstanding credit', totals.due]] }); autoTable(pdf, { head: [['Date', 'Order', 'Customer', 'Channel', 'Payment', 'Sales', 'Tax', 'Due']], body: details.orders.map(order => [new Date(order.createdAt).toLocaleDateString(), order.orderNumber || order.id, order.customer, order.type, order.paymentMethod, order.total, order.tax || 0, order.dueAmount || 0]) }); pdf.save(`${fileBase}.pdf`); };

  return <DashboardLayout role="OWNER"><div className="report-print space-y-7">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><h1 className="text-3xl font-black tracking-tight">Accounting & Reports</h1><p className="mt-2 text-sm text-slate-500">Server-aggregated totals with date-scoped accounting details.</p></div><div className="no-print flex flex-wrap gap-2"><Button variant="outline" onClick={exportPdf}><Download className="mr-2 h-4 w-4"/>PDF</Button><Button variant="outline" onClick={()=>downloadCsv(`${fileBase}.csv`,reportRows)}><Download className="mr-2 h-4 w-4"/>CSV</Button><Button variant="outline" onClick={()=>downloadExcel(`${fileBase}.xls`,reportRows)}><FileSpreadsheet className="mr-2 h-4 w-4"/>Excel</Button><Button variant="outline" onClick={()=>window.print()}><Printer className="mr-2 h-4 w-4"/>Print</Button></div></div>
    <Card className="no-print"><div className="flex flex-wrap items-end gap-3"><div className="flex flex-wrap gap-2">{periods.map(item=><button key={item.value} onClick={()=>setPeriod(item.value)} className={`rounded-xl px-4 py-2 text-sm font-bold ${period===item.value?'bg-blue-600 text-white':'bg-slate-100 text-slate-600'}`}>{item.label}</button>)}</div><label className="text-xs font-bold text-slate-500">From<Input type="date" value={startDate} onChange={event=>{setPeriod('CUSTOM');setStartDate(event.target.value)}} className="mt-1"/></label><label className="text-xs font-bold text-slate-500">To<Input type="date" value={endDate} onChange={event=>{setPeriod('CUSTOM');setEndDate(event.target.value)}} className="mt-1"/></label><Button variant="outline" onClick={()=>setRefresh(value=>value+1)}><RefreshCw className="h-4 w-4"/></Button></div></Card>
    <DataState loading={loading} error={error}/>
    {!loading&&!error&&<>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Sales" value={totals.sales} note={`${totals.orders} completed orders`} icon={TrendingUp}/><Metric title="Income received" value={income} note={`Due collected ${formatCurrency(totals.dueCollected)}`} icon={Banknote}/><Metric title="Purchases & expenses" value={netPurchases+totals.expenses} note={`Returns ${formatCurrency(totals.purchaseReturns)}`} icon={TrendingDown}/><Metric title="Net profit" value={netProfit} note={`Gross profit ${formatCurrency(grossProfit)}`} icon={WalletCards} accent/></div>
      <div className="grid gap-6 xl:grid-cols-2"><ReportTable title="Profit & Loss" rows={[['Sales',totals.sales],['Cost of goods',-cogs],['Gross profit',grossProfit],['Operating expenses',-operatingExpenses],['Net profit',netProfit]]}/><ReportTable title="Cash Flow" rows={[['Sales cash received',Math.max(0,totals.sales-totals.due)],['Due collection received',totals.dueCollected],['Purchases paid',-totals.purchases],['Purchase returns',totals.purchaseReturns],['Expenses paid',-totals.expenses],['Owner withdrawals',-ownerWithdrawals],['Net cash flow',income-netPurchases-totals.expenses]]}/></div>
      <div className="grid gap-6 xl:grid-cols-2"><NamedTable title="Payment-method Totals" rows={breakdown.payments}/><NamedTable title="Online versus In-store" rows={breakdown.channels}/><NamedTable title="Category Performance" rows={breakdown.categories}/><NamedTable title="Employee Sales" rows={breakdown.employees}/></div>
      <Card><h2 className="mb-4 text-lg font-black">Tax Summary & Credit Sales</h2><div className="grid gap-4 sm:grid-cols-3"><Stat label="Tax collected" value={breakdown.tax}/><Stat label="Outstanding credit" value={totals.due}/><Stat label="Due collection" value={totals.dueCollected}/></div></Card>
      <Card><h2 className="mb-4 text-lg font-black">Product Profit</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-400"><th className="py-3">Product</th><th>Qty</th><th>Sales</th><th>Cost</th><th>Profit</th></tr></thead><tbody>{breakdown.products.map(item=><tr key={item.name} className="border-b border-slate-100"><td className="py-3 font-bold">{item.name}</td><td>{item.quantity}</td><td>{formatCurrency(item.sales)}</td><td>{formatCurrency(item.cost)}</td><td className={item.profit<0?'text-red-600':'text-emerald-600'}>{formatCurrency(item.profit)}</td></tr>)}</tbody></table><DataState empty={!breakdown.products.length} emptyMessage="No product sales in this period."/></div></Card>
      {user?.role==='OWNER'&&<DueCollectionPanel orders={outstanding} shopId={shopId!} actor={{id:user.id,name:user.name}} onSaved={()=>setRefresh(value=>value+1)}/>} 
      <Card><h2 className="mb-4 text-lg font-black">Sales Detail</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-400"><th className="py-3">Date</th><th>Order</th><th>Customer</th><th>Employee</th><th>Type</th><th>Total</th><th>Due</th></tr></thead><tbody>{details.orders.map(order=><tr key={order.id} className="border-b border-slate-100"><td className="py-3">{new Date(order.createdAt).toLocaleString()}</td><td className="font-bold">{order.orderNumber||order.id}</td><td>{order.customer}</td><td>{order.employeeName||'—'}</td><td>{order.type}</td><td>{formatCurrency(order.total)}</td><td>{formatCurrency(order.dueAmount||0)}</td></tr>)}</tbody></table><DataState empty={!details.orders.length} emptyMessage="No completed sales in this period."/></div></Card>
    </>}
  </div></DashboardLayout>;
}

function Metric({title,value,note,icon:Icon,accent=false}:{title:string;value:number;note:string;icon:ElementType;accent?:boolean}){return <Card className={accent?'bg-blue-600 text-white':''}><div className="flex justify-between"><p className={`text-xs font-bold uppercase ${accent?'text-blue-100':'text-slate-400'}`}>{title}</p><Icon className="h-5 w-5"/></div><p className="mt-4 text-2xl font-black">{formatCurrency(value)}</p><p className={`mt-2 text-xs ${accent?'text-blue-100':'text-slate-400'}`}>{note}</p></Card>}
function Stat({label,value}:{label:string;value:number}){return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-2 text-xl font-black">{formatCurrency(value)}</p></div>}
function ReportTable({title,rows}:{title:string;rows:Array<[string,number]>}){return <Card><h2 className="mb-3 text-lg font-black">{title}</h2>{rows.map(([label,value])=><div key={label} className="flex justify-between border-b border-slate-100 py-3 text-sm"><span>{label}</span><span className={`font-bold ${value<0?'text-red-600':''}`}>{formatCurrency(value)}</span></div>)}</Card>}
function NamedTable({title,rows}:{title:string;rows:Array<{name:string;value:number}>}){return <Card><h2 className="mb-3 text-lg font-black">{title}</h2>{rows.slice(0,12).map(item=><div key={item.name} className="flex justify-between border-b border-slate-100 py-3 text-sm"><span>{item.name}</span><span className="font-bold">{formatCurrency(item.value)}</span></div>)}<DataState empty={!rows.length} emptyMessage="No records in this period."/></Card>}

function DueCollectionPanel({orders,shopId,actor,onSaved}:{orders:Order[];shopId:string;actor:{id:string;name:string};onSaved:()=>void}){
  const [orderId,setOrderId]=useState(''); const [amount,setAmount]=useState(0); const [kind,setKind]=useState<Exclude<PaymentKind,'CREDIT'|'SPLIT'>>('CASH'); const [reference,setReference]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const selected=orders.find(order=>order.id===orderId); const due=selected?(selected.dueAmount??(selected.paymentKind==='CREDIT'?selected.total:0)):0;
  const submit=async()=>{if(!selected)return;setBusy(true);setMessage('');try{const method=paymentOptions.find(item=>item.kind===kind)?.label||kind;await collectOrderDue(shopId,selected.id,{amount,paymentKind:kind,paymentMethod:method,reference,actorId:actor.id,actorName:actor.name});await createRecord(`shops/${shopId}/auditLogs`,{shopId,actorId:actor.id,actorName:actor.name,action:'DUE_COLLECTED',detail:`${selected.orderNumber||selected.id} · ${amount} MMK · ${method}`,createdAt:new Date().toISOString()});setMessage('Due payment recorded.');setOrderId('');setAmount(0);setReference('');onSaved()}catch(issue){setMessage(issue instanceof Error?issue.message:'Unable to collect due payment.')}finally{setBusy(false)}};
  return <Card className="no-print"><h2 className="text-lg font-black">Due Collection</h2><p className="mt-1 text-sm text-slate-500">Record a customer credit payment and atomically update the order balance.</p><div className="mt-5 grid gap-3 md:grid-cols-5"><select className="control md:col-span-2" value={orderId} onChange={event=>{setOrderId(event.target.value);const order=orders.find(item=>item.id===event.target.value);setAmount(order?(order.dueAmount??order.total):0)}}><option value="">Select outstanding order</option>{orders.map(order=><option key={order.id} value={order.id}>{order.orderNumber||order.id} · {order.customer} · {formatCurrency(order.dueAmount??order.total)}</option>)}</select><Input type="number" min="1" max={due} value={amount||''} onChange={event=>setAmount(Number(event.target.value))} placeholder="Amount"/><select className="control" value={kind} onChange={event=>setKind(event.target.value as typeof kind)}>{paymentOptions.map(item=><option key={item.kind} value={item.kind}>{item.label}</option>)}</select><Input value={reference} onChange={event=>setReference(event.target.value)} placeholder="Reference (optional)"/></div><div className="mt-4 flex items-center gap-3"><Button onClick={submit} disabled={busy||!selected||amount<=0||amount>due}>{busy?'Saving…':'Collect Payment'}</Button>{message&&<p className="text-sm font-medium text-slate-600">{message}</p>}</div></Card>
}
