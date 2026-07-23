import { useMemo, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Badge, Button, Card, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { createRecord, receivePurchase, useLiveCollection } from '@/lib/firestore';
import { formatCurrency, cn } from '@/lib/utils';
import type { AuditLog, Branch, Customer, Expense, ExpenseCategory, Order, PaymentKind, Product, Purchase, Shift, StockMovement, Supplier } from '@/types';
import { Banknote, Building2, ClipboardList, PackagePlus, Plus, ReceiptText, UserRound, Users } from 'lucide-react';

type Tab = 'PAYMENTS' | 'PURCHASES' | 'EXPENSES' | 'CUSTOMERS' | 'SHIFTS' | 'HISTORY';

export default function OwnerOperations() {
  const { user } = useAuth();
  const shopId = user?.shopId || '';
  const path = (name: string) => shopId ? `shops/${shopId}/${name}` : null;
  const { data: orders } = useLiveCollection<Order>(path('orders'), 'createdAt');
  const { data: suppliers } = useLiveCollection<Supplier>(path('suppliers'), 'createdAt');
  const { data: purchases } = useLiveCollection<Purchase>(path('purchases'), 'createdAt');
  const { data: expenses } = useLiveCollection<Expense>(path('expenses'), 'createdAt');
  const { data: expenseCategories } = useLiveCollection<ExpenseCategory>(path('expenseCategories'), 'createdAt');
  const { data: shifts } = useLiveCollection<Shift>(path('shifts'), 'openedAt');
  const { data: products } = useLiveCollection<Product>(path('products'));
  const { data: movements } = useLiveCollection<StockMovement>(path('stockMovements'), 'createdAt');
  const { data: audits } = useLiveCollection<AuditLog>(path('auditLogs'), 'createdAt');
  const { data: customers } = useLiveCollection<Customer>(path('customers'), 'updatedAt');
  const { data: storedBranches } = useLiveCollection<Branch>(path('branches'), 'createdAt');
  const branches = storedBranches.some(branch => branch.id === 'main') ? storedBranches : [{ id: 'main', name: 'Main Branch' } as Branch, ...storedBranches];
  const [tab, setTab] = useState<Tab>('PAYMENTS');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | PaymentKind>('ALL');
  const [supplier, setSupplier] = useState({ name: '', phone: '', address: '' });
  const [purchase, setPurchase] = useState({ supplierId: '', productId: '', quantity: '1', unitCost: '' });
  const [expense, setExpense] = useState({ branchId: 'main', type: 'OPERATING' as 'OPERATING' | 'OWNER_WITHDRAWAL', category: 'General', note: '', amount: '' });
  const paidOrders = orders.filter(order => order.status === 'COMPLETED');
  const paymentEntries = useMemo(() => paidOrders.flatMap(order => order.payments?.length
    ? order.payments.map(payment => ({ order, kind: payment.kind, label: payment.label, accountNumber: payment.accountNumber || '', reference: payment.reference || order.paymentReference || '', amount: payment.amount }))
    : [{ order, kind: orderPaymentKind(order), label: order.paymentMethod, accountNumber: order.paymentAccountNumber || '', reference: order.paymentReference || '', amount: order.total }]), [paidOrders]);
  const filteredPayments = paymentEntries.filter(entry => paymentFilter === 'ALL' || entry.kind === paymentFilter);
  const paymentTotals = useMemo(() => paymentEntries.reduce<Record<string, number>>((totals, entry) => {
    totals[entry.kind] = (totals[entry.kind] || 0) + entry.amount; return totals;
  }, {}), [paymentEntries]);

  const audit = (action: string, detail: string) => createRecord(`shops/${shopId}/auditLogs`, { shopId, actorId: user!.id, actorName: user!.name, action, detail, createdAt: new Date().toISOString() });
  const addSupplier = async () => {
    if (!supplier.name.trim()) return;
    await createRecord(`shops/${shopId}/suppliers`, { ...supplier, shopId, createdAt: new Date().toISOString() });
    await audit('SUPPLIER_CREATED', supplier.name); setSupplier({ name: '', phone: '', address: '' });
  };
  const addPurchase = async () => {
    const product = products.find(item => item.id === purchase.productId); const selectedSupplier = suppliers.find(item => item.id === purchase.supplierId);
    const quantity = Number(purchase.quantity); const unitCost = Number(purchase.unitCost);
    if (!product || quantity <= 0 || unitCost < 0) return;
    await receivePurchase(shopId, { supplierId: selectedSupplier?.id, supplierName: selectedSupplier?.name || 'Direct Purchase', productId: product.id, productName: product.name, quantity, unitCost, createdAt: new Date().toISOString() });
    await audit('PURCHASE_RECEIVED', `${product.name} × ${quantity}`); setPurchase({ supplierId: '', productId: '', quantity: '1', unitCost: '' });
  };
  const addExpense = async () => {
    const amount = Number(expense.amount); if (amount <= 0) return;
    const selectedBranch = branches.find(branch => branch.id === expense.branchId);
    await createRecord(`shops/${shopId}/expenses`, { ...expense, amount, shopId, branchName: selectedBranch?.name || 'Main Branch', actorId: user!.id, actorName: user!.name, createdAt: new Date().toISOString() });
    await audit(expense.type === 'OWNER_WITHDRAWAL' ? 'OWNER_WITHDRAWAL_RECORDED' : 'EXPENSE_RECORDED', `${selectedBranch?.name || 'Main Branch'} · ${expense.category}: ${formatCurrency(amount)}`); setExpense({ branchId: 'main', type: 'OPERATING', category: 'General', note: '', amount: '' });
  };

  return <DashboardLayout role="OWNER">
    <div className="mb-7"><h1 className="text-3xl font-bold mb-2">Business Operations</h1><p className="text-slate-500">Payments, purchasing, expenses, shifts and activity history in one place.</p></div>
    <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
      <TabButton icon={Banknote} label="Payments" active={tab === 'PAYMENTS'} onClick={() => setTab('PAYMENTS')} />
      <TabButton icon={PackagePlus} label="Suppliers & Purchases" active={tab === 'PURCHASES'} onClick={() => setTab('PURCHASES')} />
      <TabButton icon={ReceiptText} label="Expenses" active={tab === 'EXPENSES'} onClick={() => setTab('EXPENSES')} />
      <TabButton icon={UserRound} label="Customers & Loyalty" active={tab === 'CUSTOMERS'} onClick={() => setTab('CUSTOMERS')} />
      <TabButton icon={Users} label="Shift Reconciliation" active={tab === 'SHIFTS'} onClick={() => setTab('SHIFTS')} />
      <TabButton icon={ClipboardList} label="Stock & Audit" active={tab === 'HISTORY'} onClick={() => setTab('HISTORY')} />
    </div>

    {tab === 'PAYMENTS' && <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">{(['CASH', 'BANK', 'CARD', 'KPAY', 'WAVE', 'AYAPAY', 'CBPAY', 'CREDIT'] as PaymentKind[]).map(kind => <button key={kind} onClick={() => setPaymentFilter(kind)} className={cn('text-left rounded-2xl border bg-white p-4', paymentFilter === kind && 'ring-2 ring-blue-500')}><p className="text-xs font-bold text-slate-400">{kind}</p><p className="text-xl font-black mt-1">{formatCurrency(paymentTotals[kind] || 0)}</p></button>)}</div>
      <Card className="p-0 overflow-hidden"><div className="p-4 flex justify-between"><h3 className="font-bold">Payment Transactions</h3><Button variant="outline" onClick={() => setPaymentFilter('ALL')} className="h-8">Show all</Button></div><DataTable headers={['Date', 'Order', 'Method / Account', 'Reference', 'Amount']} rows={filteredPayments.map(entry => [new Date(entry.order.createdAt).toLocaleString(), entry.order.id, `${entry.label}${entry.accountNumber ? ` • ${entry.accountNumber}` : ''}`, entry.reference || '—', formatCurrency(entry.amount)])} /></Card>
    </>}

    {tab === 'PURCHASES' && <div className="space-y-5">
      <div className="grid lg:grid-cols-2 gap-5"><Card className="p-5 space-y-3"><h3 className="font-bold flex gap-2"><Building2 className="w-5 h-5" />Add Supplier</h3><Input placeholder="Supplier name" value={supplier.name} onChange={e => setSupplier({ ...supplier, name: e.target.value })} /><Input placeholder="Phone" value={supplier.phone} onChange={e => setSupplier({ ...supplier, phone: e.target.value })} /><Input placeholder="Address" value={supplier.address} onChange={e => setSupplier({ ...supplier, address: e.target.value })} /><Button onClick={addSupplier} disabled={!supplier.name.trim()}><Plus className="w-4 h-4 mr-2" />Save Supplier</Button></Card>
      <Card className="p-5 space-y-3"><h3 className="font-bold flex gap-2"><PackagePlus className="w-5 h-5" />Receive Stock Purchase</h3><Select value={purchase.supplierId} onChange={value => setPurchase({ ...purchase, supplierId: value })} options={[['', 'Direct Purchase'], ...suppliers.map(item => [item.id, item.name])]} /><Select value={purchase.productId} onChange={value => setPurchase({ ...purchase, productId: value })} options={[['', 'Select product'], ...products.filter(item => item.itemType !== 'SERVICE').map(item => [item.id, item.name])]} /><div className="grid grid-cols-2 gap-3"><Input type="number" min="1" placeholder="Quantity" value={purchase.quantity} onChange={e => setPurchase({ ...purchase, quantity: e.target.value })} /><Input type="number" min="0" placeholder="Unit cost" value={purchase.unitCost} onChange={e => setPurchase({ ...purchase, unitCost: e.target.value })} /></div><Button onClick={addPurchase} disabled={!purchase.productId || Number(purchase.quantity) <= 0}>Receive & Add Stock</Button></Card></div>
      <Card className="p-0 overflow-hidden"><DataTable headers={['Date', 'Supplier', 'Product', 'Qty', 'Total']} rows={purchases.map(item => [new Date(item.createdAt).toLocaleString(), item.supplierName, item.productName, item.quantity, formatCurrency(item.total)])} /></Card>
    </div>}

    {tab === 'EXPENSES' && <div className="grid lg:grid-cols-3 gap-5"><Card className="p-5 space-y-3"><h3 className="font-bold">Record Expense</h3><Select value={expense.branchId} onChange={branchId => setExpense({ ...expense, branchId })} options={branches.map(branch => [branch.id, branch.name])} /><select value={expense.type} onChange={e => setExpense({ ...expense, type: e.target.value as typeof expense.type })} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4"><option value="OPERATING">Operating Expense</option><option value="OWNER_WITHDRAWAL">Owner Withdrawal</option></select><Select value={expense.category} onChange={category => setExpense({ ...expense, category })} options={[['General','General'],...expenseCategories.filter(item=>item.active).map(item=>[item.name,item.name])]} /><Input placeholder="Note" value={expense.note} onChange={e => setExpense({ ...expense, note: e.target.value })} /><Input type="number" min="0" placeholder="Amount" value={expense.amount} onChange={e => setExpense({ ...expense, amount: e.target.value })} /><Button onClick={addExpense} disabled={Number(expense.amount) <= 0}>Save Expense</Button></Card><Card className="lg:col-span-2 p-0 overflow-hidden"><DataTable headers={['Date', 'Branch', 'Type', 'Category', 'Note', 'Amount']} rows={expenses.map(item => [new Date(item.createdAt).toLocaleString(), item.branchName || 'Main Branch', item.type === 'OWNER_WITHDRAWAL' ? 'Owner Withdrawal' : 'Operating', item.category, item.note || '—', formatCurrency(item.amount)])} /></Card></div>}

    {tab === 'CUSTOMERS' && <Card className="p-0 overflow-hidden"><div className="p-4 font-bold">Customer Directory & Loyalty</div><DataTable headers={['Customer', 'Phone', 'Visits', 'Total Spent', 'Points', 'Last Visit']} rows={customers.map(item => [item.name, item.phone, item.visits || 0, formatCurrency(item.totalSpent || 0), item.loyaltyPoints || 0, new Date(item.updatedAt).toLocaleString()])} /></Card>}

    {tab === 'SHIFTS' && <Card className="p-0 overflow-hidden"><DataTable headers={['Branch', 'Employee', 'Opened', 'Status', 'Opening', 'Expected', 'Closing', 'Difference']} rows={shifts.map(item => [item.branchName || 'Main Branch', item.employeeName, new Date(item.openedAt).toLocaleString(), item.status, formatCurrency(item.openingCash), item.expectedCash == null ? '—' : formatCurrency(item.expectedCash), item.closingCash == null ? '—' : formatCurrency(item.closingCash), item.cashDifference == null ? '—' : formatCurrency(item.cashDifference)])} /></Card>}

    {tab === 'HISTORY' && <div className="grid xl:grid-cols-2 gap-5"><Card className="p-0 overflow-hidden"><div className="p-4 font-bold">Stock Movements</div><DataTable headers={['Date', 'Product', 'Type', 'Change', 'Balance']} rows={movements.map(item => [new Date(item.createdAt).toLocaleString(), item.productName, item.type, item.quantity > 0 ? `+${item.quantity}` : item.quantity, item.balance])} /></Card><Card className="p-0 overflow-hidden"><div className="p-4 font-bold">Audit Log</div><DataTable headers={['Date', 'User', 'Action', 'Detail']} rows={audits.map(item => [new Date(item.createdAt).toLocaleString(), item.actorName, item.action, item.detail])} /></Card></div>}
  </DashboardLayout>;
}

function TabButton({ icon: Icon, label, active, onClick }: { icon: typeof Banknote; label: string; active: boolean; onClick(): void }) { return <button onClick={onClick} className={cn('shrink-0 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold border', active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600')}><Icon className="w-4 h-4" />{label}</button>; }
function Select({ value, onChange, options }: { value: string; onChange(value: string): void; options: string[][] }) { return <select value={value} onChange={e => onChange(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4">{options.map(([key, label]) => <option key={`${key}-${label}`} value={key}>{label}</option>)}</select>; }
function DataTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) { return <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-slate-50">{headers.map(header => <th key={header} className="px-4 py-3 text-xs uppercase text-slate-500">{header}</th>)}</tr></thead><tbody className="divide-y">{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 text-sm whitespace-nowrap">{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="p-8 text-center text-sm text-slate-400">No records yet.</td></tr>}</tbody></table></div>; }
function orderPaymentKind(order: Order): PaymentKind { const method = order.paymentMethod.toLowerCase(); return order.paymentKind || (method.includes('cash') ? 'CASH' : method.includes('wave') ? 'WAVE' : method.includes('kbz') || method.includes('kpay') ? 'KPAY' : 'BANK'); }
