import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Banknote, CheckCircle2, CreditCard, Minus, Pause, Play, Plus, Printer, ReceiptText, ScanBarcode, Search, ShoppingBag, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { increment } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge, Button, DataState, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { completeSale, createRecord, deleteRecord, setRecord, updateRecord, useLiveCollection, useLiveCollectionWhere, useLiveDocument } from '@/lib/firestore';
import { calculateTotals } from '@/lib/pos';
import { cn, formatCurrency } from '@/lib/utils';
import type { Branch, Customer, Employee, HeldOrder, Order, OrderChannel, PaymentAccount, PaymentAllocation, PaymentKind, Product, Shift, Shop, ShopSettings } from '@/types';

type CartItem = { product: Product; quantity: number };
type PaymentToken = 'CASH' | 'CARD' | 'CREDIT' | `ACCOUNT:${string}`;

const directPayments: Array<{ kind: 'CASH' | 'CARD' | 'CREDIT'; label: string }> = [
  { kind: 'CASH', label: 'Cash' }, { kind: 'CARD', label: 'Card' }, { kind: 'CREDIT', label: 'Credit' },
];

export default function POSScreen() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const shopId = user?.shopId || '';
  const shop = useLiveDocument<Shop>(shopId ? `shops/${shopId}` : null);
  const settings = useLiveDocument<ShopSettings>(shopId ? `shops/${shopId}/settings/general` : null);
  const { data: products, loading: productsLoading, error: productsError } = useLiveCollection<Product>(shopId ? `shops/${shopId}/products` : null);
  const { data: customers } = useLiveCollection<Customer>(shopId ? `shops/${shopId}/customers` : null, 'updatedAt');
  const { data: paymentAccounts } = useLiveCollection<PaymentAccount>(shopId ? `shops/${shopId}/paymentAccounts` : null, 'createdAt');
  const employeeIsScoped = user?.role === 'EMPLOYEE';
  const employeeOrdersAreScoped = employeeIsScoped && user.permissions?.view !== true;
  const { data: sharedShifts } = useLiveCollection<Shift>(!employeeIsScoped && shopId ? `shops/${shopId}/shifts` : null, 'openedAt');
  const { data: employeeShifts } = useLiveCollectionWhere<Shift>(employeeIsScoped && shopId ? `shops/${shopId}/shifts` : null, 'employeeId', user?.id || null);
  const { data: sharedOrders } = useLiveCollection<Order>(!employeeOrdersAreScoped && shopId ? `shops/${shopId}/orders` : null, 'createdAt');
  const { data: employeeOrders } = useLiveCollectionWhere<Order>(employeeOrdersAreScoped && shopId ? `shops/${shopId}/orders` : null, 'employeeId', user?.id || null);
  const { data: sharedHeld } = useLiveCollection<HeldOrder>(!employeeIsScoped && shopId ? `shops/${shopId}/heldOrders` : null, 'heldAt');
  const { data: employeeHeld } = useLiveCollectionWhere<HeldOrder>(employeeIsScoped && shopId ? `shops/${shopId}/heldOrders` : null, 'employeeId', user?.id || null);
  const employee = useLiveDocument<Employee>(employeeIsScoped && shopId ? `shops/${shopId}/employees/${user?.id}` : null);
  const { data: storedBranches } = useLiveCollection<Branch>(shopId ? `shops/${shopId}/branches` : null, 'createdAt');
  const branches = storedBranches.some(branch => branch.id === 'main') ? storedBranches : [{ id: 'main', name: 'Main Branch' } as Branch, ...storedBranches];
  const [ownerBranchId, setOwnerBranchId] = useState(() => localStorage.getItem('ki3-owner-branch') || 'main');
  const branchId = employeeIsScoped ? employee?.branchId || user?.branchId || 'main' : ownerBranchId;
  const branchName = branches.find(branch => branch.id === branchId)?.name || employee?.branchName || user?.branchName || 'Main Branch';
  const shifts = employeeIsScoped ? employeeShifts : sharedShifts;
  const orders = employeeOrdersAreScoped ? employeeOrders : sharedOrders;
  const heldOrders = employeeIsScoped ? employeeHeld : sharedHeld;
  const activeShift = shifts.find(shift => shift.employeeId === user?.id && shift.status === 'OPEN' && (shift.branchId || 'main') === branchId);
  const canDiscount = user?.role === 'OWNER' || employee?.permissions?.discount === true;

  const [orderType, setOrderType] = useState<OrderChannel>('IN_STORE');
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState('Walk-in');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [notes, setNotes] = useState('');
  const [paymentKind, setPaymentKind] = useState<PaymentKind>('CASH');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [splitFirst, setSplitFirst] = useState<PaymentToken>('CASH');
  const [splitSecond, setSplitSecond] = useState<PaymentToken>('CARD');
  const [splitAmount, setSplitAmount] = useState(0);
  const [resumedHeldId, setResumedHeldId] = useState('');
  const [showHeld, setShowHeld] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const allowNegativeStock = settings?.allowNegativeStock === true;
  const activeAccounts = paymentAccounts.filter(account => account.active && !['CREDIT', 'SPLIT'].includes(account.kind));
  const sellableProducts = products.filter(product => product.active !== false && (orderType === 'ONLINE' ? product.availableOnline !== false : product.availableInStore !== false));
  const categories = useMemo(() => ['All', ...Array.from(new Set(sellableProducts.map(product => product.category)))], [sellableProducts]);
  const filteredProducts = sellableProducts.filter(product => (activeCategory === 'All' || product.category === activeCategory) && `${product.name} ${product.sku} ${product.barcode || ''}`.toLowerCase().includes(search.toLowerCase()));
  const selectedPayment = activeAccounts.find(account => account.id === paymentAccountId);
  const salePrice = (product: Product) => orderType === 'ONLINE' ? product.onlinePrice ?? product.price : product.inStorePrice ?? product.price;
  const subtotal = cart.reduce((sum, item) => sum + salePrice(item.product) * item.quantity, 0);
  const calculated = calculateTotals(subtotal, discountPercent, settings?.taxRate ?? 5);
  const serviceCharge = Math.round((subtotal - calculated.discount) * ((settings?.serviceCharge ?? 0) / 100));
  const grandTotal = calculated.total + serviceCharge + Math.max(0, deliveryCharge);
  const paymentOptions: Array<{ value: PaymentToken; label: string }> = [
    ...directPayments.map(item => ({ value: item.kind as PaymentToken, label: item.label })),
    ...activeAccounts.map(account => ({ value: `ACCOUNT:${account.id}` as PaymentToken, label: account.label })),
  ];

  const stockTracked = (product: Product) => product.itemType !== 'SERVICE' && product.trackStock !== false;
  const quantityAllowed = (product: Product, quantity: number) => allowNegativeStock || !stockTracked(product) || quantity <= product.stock;
  const addToCart = (product: Product) => {
    setCheckoutError('');
    setCart(current => {
      const existing = current.find(item => item.product.id === product.id);
      const requested = (existing?.quantity || 0) + 1;
      if (!quantityAllowed(product, requested)) { setCheckoutError(`${product.name}: only ${product.stock} in stock.`); return current; }
      return existing ? current.map(item => item.product.id === product.id ? { ...item, quantity: requested } : item) : [...current, { product, quantity: 1 }];
    });
  };
  const updateQuantity = (product: Product, delta: number) => setCart(current => current.flatMap(item => {
    if (item.product.id !== product.id) return [item];
    const quantity = item.quantity + delta;
    if (quantity <= 0) return [];
    if (!quantityAllowed(product, quantity)) { setCheckoutError(`${product.name}: only ${product.stock} in stock.`); return [item]; }
    setCheckoutError(''); return [{ ...item, quantity }];
  }));
  const changeOrderType = (type: OrderChannel) => {
    const unavailable = cart.find(item => type === 'ONLINE' ? item.product.availableOnline === false : item.product.availableInStore === false);
    if (unavailable) { setCheckoutError(`${unavailable.product.name} is not available for ${type === 'ONLINE' ? 'online' : 'in-store'} orders.`); return; }
    setCheckoutError(''); setOrderType(type);
  };

  const resetOrder = () => {
    setCart([]); setCustomer('Walk-in'); setCustomerPhone(''); setDiscountPercent(0); setDeliveryCharge(0); setNotes('');
    setPaymentKind('CASH'); setPaymentAccountId(''); setPaymentReference(''); setSplitAmount(0); setResumedHeldId(''); setCheckoutError('');
  };
  const cancelCurrent = () => { if (cart.length && !window.confirm('Cancel and clear this current order?')) return; resetOrder(); };

  const tokenAllocation = (token: PaymentToken, amount: number): PaymentAllocation => {
    if (token.startsWith('ACCOUNT:')) {
      const account = activeAccounts.find(item => item.id === token.slice(8));
      if (!account) throw new Error('Select a valid payment account.');
      return { kind: account.kind as Exclude<PaymentKind, 'SPLIT'>, label: account.label, amount, accountId: account.id, accountNumber: account.accountNumber, reference: paymentReference.trim() };
    }
    return { kind: token as Exclude<PaymentKind, 'SPLIT'>, label: directPayments.find(item => item.kind === token)?.label || token, amount, reference: paymentReference.trim() };
  };
  const paymentAllocations = (): PaymentAllocation[] => paymentKind === 'SPLIT'
    ? [tokenAllocation(splitFirst, splitAmount), tokenAllocation(splitSecond, grandTotal - splitAmount)]
    : [tokenAllocation(paymentAccountId ? `ACCOUNT:${paymentAccountId}` : paymentKind as PaymentToken, grandTotal)];

  const holdOrder = async () => {
    if (!shopId || !user || !cart.length) return;
    setBusy(true); setCheckoutError('');
    try {
      const heldAt = new Date().toISOString();
      const held = { orderNumber: `HOLD-${Date.now().toString().slice(-8)}`, shopId, branchId, branchName, employeeId: user.id, employeeName: user.name, type: orderType, customer: customer || 'Walk-in', customerPhone, discountPercent, deliveryCharge: Math.max(0, deliveryCharge), notes: notes.trim(), items: cart.map(item => ({ productId: item.product.id, name: item.product.name, quantity: item.quantity, price: salePrice(item.product) })), heldAt };
      if (resumedHeldId) await setRecord(`shops/${shopId}/heldOrders`, resumedHeldId, held);
      else await createRecord(`shops/${shopId}/heldOrders`, held);
      await createRecord(`shops/${shopId}/auditLogs`, { shopId, actorId: user.id, actorName: user.name, action: 'ORDER_HELD', detail: `${branchName} · ${cart.length} items`, createdAt: new Date().toISOString() });
      resetOrder(); setShowHeld(true);
    } catch (issue) { setCheckoutError(issue instanceof Error ? issue.message : 'Unable to hold order.'); }
    finally { setBusy(false); }
  };

  const resumeOrder = (held: HeldOrder) => {
    const restored = held.items.flatMap(item => { const product = products.find(candidate => candidate.id === item.productId); return product ? [{ product, quantity: item.quantity }] : []; });
    if (!restored.length) { setCheckoutError('The products in this held order are no longer available.'); return; }
    setCart(restored); setOrderType(held.type); setCustomer(held.customer); setCustomerPhone(held.customerPhone || ''); setDiscountPercent(held.discountPercent); setDeliveryCharge(held.deliveryCharge); setNotes(held.notes || ''); setResumedHeldId(held.id); setShowHeld(false); setCheckoutError(restored.length < held.items.length ? 'Some unavailable products were removed from the held order.' : '');
  };

  const handleCheckout = async () => {
    if (!activeShift) { setCheckoutError('Open a cashier shift before taking payment.'); return; }
    if (!cart.length) return;
    const unavailable = cart.find(item => !quantityAllowed(item.product, item.quantity));
    if (unavailable) { setCheckoutError(`${unavailable.product.name}: requested quantity exceeds stock.`); return; }
    if (paymentKind === 'SPLIT' && (!Number.isFinite(splitAmount) || splitAmount <= 0 || splitAmount >= grandTotal)) { setCheckoutError('Enter a first split amount greater than 0 and less than the total.'); return; }
    if (!['CASH', 'CARD', 'CREDIT', 'SPLIT'].includes(paymentKind) && !selectedPayment) { setCheckoutError('Select an owner-configured payment account.'); return; }
    let payments: PaymentAllocation[];
    try { payments = paymentAllocations(); } catch (issue) { setCheckoutError(issue instanceof Error ? issue.message : 'Invalid payment.'); return; }
    if (payments.some(payment => payment.kind === 'CREDIT') && (!customerPhone.trim() || !customer.trim() || customer === 'Walk-in')) { setCheckoutError('Select a named customer with a phone number for credit sales.'); return; }
    setBusy(true); setCheckoutError('');
    const createdAt = new Date().toISOString();
    const paidAmount = payments.filter(payment => payment.kind !== 'CREDIT').reduce((sum, payment) => sum + payment.amount, 0);
    const order: Omit<Order, 'id'> = {
      orderNumber: `${settings?.invoicePrefix || 'KI3'}-${Date.now().toString().slice(-10)}`, shopId, shopName: shop?.name || 'Shop', branchId, branchName, customer: customer || 'Walk-in', customerPhone,
      items: cart.map(item => ({ productId: item.product.id, name: item.product.name, quantity: item.quantity, price: salePrice(item.product) })),
      subtotal, tax: calculated.tax, serviceCharge, deliveryCharge: Math.max(0, deliveryCharge), discount: calculated.discount, total: grandTotal,
      paymentMethod: paymentKind === 'SPLIT' ? 'Split payment' : payments[0].label, paymentKind, payments,
      paymentAccountId: selectedPayment?.id || '', paymentAccountLabel: selectedPayment?.label || '', paymentAccountNumber: selectedPayment?.accountNumber || '', paymentReference: paymentReference.trim(),
      paidAmount, dueAmount: Math.max(0, grandTotal - paidAmount), notes: notes.trim(), status: 'COMPLETED', type: orderType, employeeId: user?.id, employeeName: user?.name || 'Employee', shiftId: activeShift.id, createdAt, completedAt: createdAt, statusUpdatedAt: createdAt,
    };
    try {
      let id = `OFF-${Date.now()}`;
      if (navigator.onLine) id = await completeSale(shopId, order);
      else {
        const queued: Array<Omit<Order, 'id'>> = JSON.parse(localStorage.getItem('ki3-offline-orders') || '[]');
        localStorage.setItem('ki3-offline-orders', JSON.stringify([...queued, order]));
      }
      if (navigator.onLine && resumedHeldId) await deleteRecord(`shops/${shopId}/heldOrders`, resumedHeldId);
      if (customerPhone) await setRecord(`shops/${shopId}/customers`, customerPhone.replace(/\W/g, ''), {
        name: customer, phone: customerPhone, totalSpent: increment(grandTotal), visits: increment(1),
        loyaltyPoints: increment(Math.floor((grandTotal / 1000) * (settings?.loyaltyPointsPer1000 ?? 0))), updatedAt: new Date().toISOString(),
      }).catch(() => undefined);
      if (navigator.onLine && user) await createRecord(`shops/${shopId}/auditLogs`, { shopId, actorId: user.id, actorName: user.name, action: 'SALE_COMPLETED', detail: `${branchName} · ${id} · ${order.paymentMethod} · ${grandTotal} MMK`, createdAt: new Date().toISOString() });
      setLastOrder({ id, ...order }); setShowReceipt(true); resetOrder();
    } catch (issue) { setCheckoutError(issue instanceof Error ? issue.message : 'Checkout failed.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const sync = async () => {
      const queued: Array<Omit<Order, 'id'>> = JSON.parse(localStorage.getItem('ki3-offline-orders') || '[]');
      if (!queued.length || !shopId) return;
      const remaining = [...queued];
      while (remaining.length) { try { await completeSale(shopId, remaining[0]); remaining.shift(); } catch { break; } }
      localStorage.setItem('ki3-offline-orders', JSON.stringify(remaining));
    };
    window.addEventListener('online', sync); if (navigator.onLine) void sync();
    return () => window.removeEventListener('online', sync);
  }, [shopId]);

  const toggleShift = async () => {
    if (!shopId || !user) return;
    if (activeShift) {
      const closingCash = Number(window.prompt('Closing cash amount', '0'));
      const cashSales = orders.filter(order => order.shiftId === activeShift.id && order.status === 'COMPLETED').reduce((sum, order) => sum + (order.payments || []).filter(payment => payment.kind === 'CASH').reduce((paymentSum, payment) => paymentSum + payment.amount, order.paymentKind === 'CASH' && !order.payments ? order.total : 0), 0);
      const expectedCash = activeShift.openingCash + cashSales;
      if (Number.isFinite(closingCash)) await updateRecord(`shops/${shopId}/shifts`, activeShift.id, { status: 'CLOSED', closingCash, expectedCash, cashDifference: closingCash - expectedCash, closedAt: new Date().toISOString() });
    } else {
      const openingCash = Number(window.prompt('Opening cash amount', '0'));
      if (Number.isFinite(openingCash)) await createRecord(`shops/${shopId}/shifts`, { shopId, branchId, branchName, employeeId: user.id, employeeName: user.name, openingCash, openedAt: new Date().toISOString(), status: 'OPEN' });
    }
  };

  const chooseCustomer = (phone: string) => { const selected = customers.find(item => item.phone === phone); if (selected) { setCustomer(selected.name); setCustomerPhone(selected.phone); } };

  return <div className="h-screen overflow-hidden bg-slate-50 text-slate-900">
    <header className="flex h-16 items-center justify-between border-b bg-white px-3 shadow-sm md:h-20 md:px-6">
      <div className="flex items-center gap-3"><Button variant="ghost" className="px-2" onClick={() => user?.role === 'OWNER' ? navigate('/owner') : logout()}><ArrowLeft className="h-5 w-5 md:mr-2"/><span className="hidden md:inline">Back</span></Button><div><h1 className="font-black md:text-xl">{shop?.name || 'KI3 POS'}</h1><p className="text-xs font-bold text-blue-600">{branchName} · {navigator.onLine ? 'Online' : 'Offline queue'}</p></div></div>
      <div className="flex items-center gap-2">{employeeIsScoped && user?.permissions?.view && <Button variant="outline" className="hidden h-10 px-3 sm:inline-flex" onClick={() => navigate('/owner/orders')}><ShoppingBag className="h-4 w-4 md:mr-2"/><span className="hidden md:inline">Orders</span></Button>}{employeeIsScoped && user?.permissions?.recordExpenses && <Button variant="outline" className="h-10 px-3" onClick={() => navigate('/expenses')}><ReceiptText className="h-4 w-4 md:mr-2"/><span className="hidden md:inline">Expense</span></Button>}<Button variant="outline" className="h-10 px-3" onClick={() => setShowHeld(true)}><Pause className="h-4 w-4 md:mr-2"/><span className="hidden md:inline">Held</span><Badge className="ml-1">{heldOrders.length}</Badge></Button>{user?.role === 'OWNER' && <select disabled={Boolean(activeShift)} value={branchId} onChange={event => { setOwnerBranchId(event.target.value); localStorage.setItem('ki3-owner-branch', event.target.value); }} className="h-10 max-w-32 rounded-xl border px-2 text-xs font-bold">{branches.filter(branch => branch.active !== false).map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>}<Button variant={activeShift ? 'danger' : 'primary'} className="h-10 px-3" onClick={toggleShift}>{activeShift ? 'Close Shift' : 'Open Shift'}</Button></div>
    </header>

    <main className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden md:h-[calc(100vh-5rem)] lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="space-y-3 p-3 md:p-5">
          <div className="grid grid-cols-[auto_1fr_auto] gap-2"><div className="flex rounded-2xl bg-slate-200 p-1"><button onClick={() => changeOrderType('IN_STORE')} className={cn('rounded-xl px-3 py-2 text-xs font-black', orderType === 'IN_STORE' && 'bg-white text-blue-600 shadow')}>In-store</button><button onClick={() => changeOrderType('ONLINE')} className={cn('rounded-xl px-3 py-2 text-xs font-black', orderType === 'ONLINE' && 'bg-white text-blue-600 shadow')}>Online</button></div><div className="relative"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/><Input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { const exact = sellableProducts.find(product => product.barcode === search.trim()); if (exact) { addToCart(exact); setSearch(''); } } }} placeholder="Search name, SKU or barcode" className="h-12 rounded-2xl bg-white pl-11"/></div><button aria-label="Focus barcode scanner" onClick={() => searchRef.current?.focus()} className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white"><ScanBarcode/></button></div>
          <div className="flex gap-2 overflow-x-auto">{categories.map(category => <button key={category} onClick={() => setActiveCategory(category)} className={cn('whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-bold', activeCategory === category ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white')}>{category}</button>)}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 pt-0 md:p-5 md:pt-0"><DataState loading={productsLoading} error={productsError} empty={!productsLoading && !productsError && filteredProducts.length === 0} emptyMessage="No matching products available for this order type."/><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{filteredProducts.map(product => { const unavailable = stockTracked(product) && product.stock <= 0 && !allowNegativeStock; return <motion.button whileTap={{scale:.97}} key={product.id} disabled={unavailable} onClick={() => addToCart(product)} className="overflow-hidden rounded-2xl border bg-white text-left shadow-sm disabled:opacity-50"><div className="relative h-28 bg-slate-100 md:h-36"><img src={product.image} alt={product.name} className="h-full w-full object-cover"/><Badge className="absolute right-2 top-2 bg-white text-slate-700">{product.category}</Badge></div><div className="p-3"><p className="truncate font-bold">{product.name}</p><div className="mt-1 flex items-end justify-between gap-2"><p className="font-black text-blue-600">{formatCurrency(salePrice(product))}</p><p className={cn('text-xs font-bold', product.stock <= 0 ? 'text-red-500' : 'text-slate-400')}>{stockTracked(product) ? `${product.stock} ${product.unit || 'pcs'}` : 'Service'}</p></div></div></motion.button>})}</div></div>
      </section>

      <aside className="flex max-h-[58vh] w-full flex-col border-l bg-white shadow-xl lg:max-h-none lg:w-[460px]">
        <div className="flex items-center justify-between border-b bg-slate-50 p-3"><h2 className="flex items-center font-black"><ShoppingBag className="mr-2 h-5 w-5 text-blue-600"/>{orderType === 'ONLINE' ? 'Online' : 'In-store'} Order</h2><div className="flex gap-1"><Button variant="outline" className="h-9 px-3" disabled={!cart.length || busy} onClick={holdOrder}><Pause className="mr-1 h-4 w-4"/>Hold</Button><Button variant="ghost" className="h-9 px-2 text-red-600" onClick={cancelCurrent}><Trash2 className="h-4 w-4"/></Button></div></div>
        <div className="min-h-24 flex-1 space-y-2 overflow-y-auto p-3">{cart.length === 0 ? <div className="grid h-full place-items-center text-center text-sm text-slate-400"><div><ShoppingBag className="mx-auto mb-2 h-12 w-12 opacity-20"/>Tap a product to start an order.</div></div> : cart.map(item => <div key={item.product.id} className="flex items-center gap-3 rounded-2xl border p-2"><img src={item.product.image} alt="" className="h-12 w-12 rounded-xl object-cover"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.product.name}</p><p className="text-sm font-black text-blue-600">{formatCurrency(salePrice(item.product) * item.quantity)}</p><p className="text-[10px] text-slate-400">Stock {item.product.stock}</p></div><div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1"><button className="grid h-8 w-8 place-items-center rounded-lg bg-white" onClick={() => updateQuantity(item.product, -1)}><Minus className="h-4 w-4"/></button><b>{item.quantity}</b><button className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100 text-blue-700" onClick={() => updateQuantity(item.product, 1)}><Plus className="h-4 w-4"/></button></div></div>)}</div>
        <div className="max-h-[54%] overflow-y-auto border-t bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2"><Input list="pos-customers" value={customer} onChange={event => { const value = event.target.value; setCustomer(value); const selected = customers.find(item => item.name === value); if (selected) setCustomerPhone(selected.phone); }} placeholder="Customer name" className="h-10 bg-white"/><Input list="pos-customer-phones" value={customerPhone} onChange={event => { setCustomerPhone(event.target.value); chooseCustomer(event.target.value); }} placeholder="Customer phone" className="h-10 bg-white"/><datalist id="pos-customers">{customers.map(item => <option key={item.id} value={item.name}>{item.phone}</option>)}</datalist><datalist id="pos-customer-phones">{customers.map(item => <option key={item.id} value={item.phone}>{item.name}</option>)}</datalist><label className="flex items-center justify-between rounded-xl border bg-white px-3 text-xs font-bold">Discount %<Input type="number" min="0" max="100" disabled={!canDiscount} value={discountPercent} onChange={event => setDiscountPercent(Math.min(100, Math.max(0, Number(event.target.value))))} className="h-9 w-20 border-0 text-right"/></label><label className="flex items-center justify-between rounded-xl border bg-white px-3 text-xs font-bold">Delivery<Input type="number" min="0" value={deliveryCharge} onChange={event => setDeliveryCharge(Math.max(0, Number(event.target.value)))} className="h-9 w-24 border-0 text-right"/></label><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Order notes" className="col-span-2 min-h-16 rounded-xl border bg-white p-3 text-sm outline-none"/></div>
          <div className="my-3 space-y-1 text-sm"><TotalRow label="Subtotal" value={subtotal}/><TotalRow label={`Tax (${settings?.taxRate ?? 5}%)`} value={calculated.tax}/><TotalRow label="Discount" value={-calculated.discount}/>{serviceCharge > 0 && <TotalRow label="Service charge" value={serviceCharge}/>} {deliveryCharge > 0 && <TotalRow label="Delivery" value={deliveryCharge}/>}<div className="flex justify-between border-t pt-2 text-xl font-black"><span>Total</span><span className="text-blue-600">{formatCurrency(grandTotal)}</span></div></div>
          <div className="grid grid-cols-4 gap-2">{directPayments.map(item => <div key={item.kind}><PaymentButton label={item.label} active={paymentKind === item.kind} onClick={() => { setPaymentKind(item.kind); setPaymentAccountId(''); }}/></div>) }{activeAccounts.map(account => <div key={account.id}><PaymentButton label={account.label} active={paymentAccountId === account.id} onClick={() => { setPaymentKind(account.kind); setPaymentAccountId(account.id); }}/></div>) }<PaymentButton label="Split" active={paymentKind === 'SPLIT'} onClick={() => { setPaymentKind('SPLIT'); setPaymentAccountId(''); setSplitAmount(Math.floor(grandTotal / 2)); }}/></div>
          {paymentKind === 'SPLIT' && <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-3"><select value={splitFirst} onChange={event => setSplitFirst(event.target.value as PaymentToken)} className="control h-10 bg-white">{paymentOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><Input type="number" min="1" max={grandTotal - 1} value={splitAmount} onChange={event => setSplitAmount(Number(event.target.value))} className="h-10 bg-white"/><select value={splitSecond} onChange={event => setSplitSecond(event.target.value as PaymentToken)} className="control h-10 bg-white">{paymentOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><div className="grid place-items-center rounded-xl bg-white text-sm font-black">{formatCurrency(Math.max(0, grandTotal - splitAmount))}</div></div>}
          {selectedPayment && <AccountDetails account={selectedPayment}/>} {paymentKind === 'SPLIT' && [splitFirst, splitSecond].map(token => token.startsWith('ACCOUNT:') ? activeAccounts.find(account => account.id === token.slice(8)) : undefined).filter((account): account is PaymentAccount => Boolean(account)).map((account, index) => <div key={`${account.id}-${index}`}><AccountDetails account={account}/></div>) }
          {(selectedPayment || paymentKind === 'CARD' || paymentKind === 'SPLIT') && <Input className="mt-2 h-10 bg-white" placeholder="Payment reference / transaction ID" value={paymentReference} onChange={event => setPaymentReference(event.target.value)}/>}
          {allowNegativeStock && <p className="mt-2 rounded-xl bg-amber-100 p-2 text-xs font-bold text-amber-800">Negative stock is enabled by the Shop Owner.</p>}
          {checkoutError && <p role="alert" className="mt-2 rounded-xl bg-red-50 p-2 text-xs font-bold text-red-700">{checkoutError}</p>}
          <Button disabled={!cart.length || busy || !activeShift} onClick={handleCheckout} className="mt-3 h-14 w-full rounded-2xl bg-blue-600 text-base font-black text-white"><Banknote className="mr-2 h-5 w-5"/>{busy ? 'Processing…' : !activeShift ? 'Open Shift to Sell' : `Complete Sale · ${formatCurrency(grandTotal)}`}</Button>
        </div>
      </aside>
    </main>

    <AnimatePresence>{showHeld && <Modal title={`Held Orders (${heldOrders.length})`} close={() => setShowHeld(false)}><div className="max-h-[65vh] space-y-3 overflow-auto">{heldOrders.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No held orders.</p>}{heldOrders.map(held => <div key={held.id} className="rounded-2xl border p-4"><div className="flex justify-between gap-3"><div><p className="font-bold">{held.customer || 'Walk-in'} · {held.items.reduce((sum,item) => sum + item.quantity, 0)} items</p><p className="text-xs text-slate-400">{held.type === 'ONLINE' ? 'Online' : 'In-store'} · {new Date(held.heldAt).toLocaleString()} · {held.employeeName}</p></div><div className="flex gap-1"><Button className="h-9 px-3" onClick={() => resumeOrder(held)}><Play className="mr-1 h-4 w-4"/>Resume</Button><Button variant="outline" className="h-9 px-2 text-red-600" onClick={() => window.confirm('Cancel this held order?') && deleteRecord(`shops/${shopId}/heldOrders`, held.id)}><Trash2 className="h-4 w-4"/></Button></div></div></div>)}</div></Modal>}</AnimatePresence>
    <AnimatePresence>{showReceipt && lastOrder && <Modal title="Payment successful" close={() => setShowReceipt(false)} receipt><Receipt order={lastOrder} shop={shop} settings={settings}/><div className="mt-4 flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setShowReceipt(false)}>New Order</Button><Button className="flex-1 bg-blue-600 text-white" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4"/>Print Receipt</Button></div></Modal>}</AnimatePresence>
  </div>;
}

function PaymentButton({ label, active, onClick }: { label: string; active: boolean; onClick(): void }) { return <button onClick={onClick} className={cn('min-h-14 rounded-xl border bg-white p-1 text-[11px] font-black', active && 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-100')}><CreditCard className="mx-auto mb-1 h-4 w-4"/>{label}</button>; }
function AccountDetails({ account }: { account: PaymentAccount }) { return <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-3"><div><p className="font-bold text-blue-900">{account.label} · {account.accountName}</p><p className="font-mono text-lg font-black text-blue-700">{account.accountNumber}</p>{account.bankName && <p className="text-xs text-blue-700">{account.bankName}</p>}</div>{account.qrCode && <img src={account.qrCode} alt={`${account.label} QR Code`} className="h-28 w-28 rounded-xl border bg-white object-contain p-2"/>}</div>; }
function TotalRow({ label, value }: { label: string; value: number }) { return <div className="flex justify-between font-bold text-slate-500"><span>{label}</span><span>{value < 0 ? '-' : ''}{formatCurrency(Math.abs(value))}</span></div>; }
function Modal({ title, close, children, receipt = false }: { title: string; close(): void; children: ReactNode; receipt?: boolean }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm"><motion.div initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.96}} className={cn('w-full overflow-hidden rounded-3xl bg-white shadow-2xl', receipt ? 'receipt max-w-sm' : 'max-w-2xl')}><div className="flex items-center justify-between border-b bg-slate-50 p-4"><h2 className="flex items-center gap-2 text-lg font-black"><CheckCircle2 className="h-5 w-5 text-emerald-600"/>{title}</h2><button onClick={close}><X/></button></div><div className="p-5">{children}</div></motion.div></div>; }
function Receipt({ order, shop, settings }: { order: Order; shop?: Shop; settings?: ShopSettings }) { return <div><div className="text-center"><h2 className="text-2xl font-black">{shop?.name || 'KI3 POS'}</h2><p className="text-sm text-slate-500">{shop?.address || shop?.phone}</p><p className="mt-1 text-xs text-slate-400">#{settings?.invoicePrefix || 'KI3'}-{order.id} · {new Date(order.createdAt).toLocaleString()}</p><p className="text-xs font-bold text-blue-600">{order.type === 'ONLINE' ? 'Online' : 'In-store'} order</p></div><div className="my-5 space-y-2 border-y border-dashed py-4">{order.items.map(item => <div key={item.productId} className="flex justify-between text-sm"><b>{item.quantity}× {item.name}</b><b>{formatCurrency(item.price * item.quantity)}</b></div>)}</div><div className="space-y-1 text-sm"><TotalRow label="Subtotal" value={order.subtotal}/><TotalRow label="Tax" value={order.tax}/><TotalRow label="Discount" value={-order.discount}/>{Boolean(order.serviceCharge) && <TotalRow label="Service charge" value={order.serviceCharge || 0}/>} {Boolean(order.deliveryCharge) && <TotalRow label="Delivery" value={order.deliveryCharge || 0}/>}<div className="flex justify-between border-t pt-2 text-lg font-black"><span>Total</span><span>{formatCurrency(order.total)}</span></div></div><div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><b>Payment</b>{(order.payments || []).map((payment,index) => <p key={`${payment.kind}-${index}`} className="flex justify-between"><span>{payment.label}</span><span>{formatCurrency(payment.amount)}</span></p>)}{order.notes && <p className="mt-2 border-t pt-2"><b>Notes:</b> {order.notes}</p>}</div></div>; }
