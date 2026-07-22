import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ShoppingBag, CreditCard, Banknote, Trash2, Plus, Minus, ScanBarcode, ArrowLeft, Printer, CheckCircle2, X, ReceiptText } from 'lucide-react';
import { Button, Input, Card, Badge, DataState } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { completeSale, createRecord, setRecord, updateRecord, useLiveCollection, useLiveCollectionWhere, useLiveDocument } from '@/lib/firestore';
import type { Branch, Employee, Order, PaymentAccount, PaymentKind, Product, Shift, Shop, ShopSettings } from '@/types';
import { calculateTotals } from '@/lib/pos';
import { increment } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function POSScreen() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const shopId = user?.shopId || '';
  const shop = useLiveDocument<Shop>(shopId ? `shops/${shopId}` : null);
  const { data: products, loading: productsLoading, error: productsError } = useLiveCollection<Product>(shopId ? `shops/${shopId}/products` : null);
  const employeeIsScoped = user?.role === 'EMPLOYEE';
  const employeeOrdersAreScoped = employeeIsScoped && user.permissions?.view !== true;
  const { data: sharedShifts } = useLiveCollection<Shift>(!employeeIsScoped && shopId ? `shops/${shopId}/shifts` : null, 'openedAt');
  const { data: employeeShifts } = useLiveCollectionWhere<Shift>(employeeIsScoped && shopId ? `shops/${shopId}/shifts` : null, 'employeeId', user?.id || null);
  const shifts = employeeIsScoped ? employeeShifts : sharedShifts;
  const { data: sharedOrders } = useLiveCollection<Order>(!employeeOrdersAreScoped && shopId ? `shops/${shopId}/orders` : null, 'createdAt');
  const { data: employeeOrders } = useLiveCollectionWhere<Order>(employeeOrdersAreScoped && shopId ? `shops/${shopId}/orders` : null, 'employeeId', user?.id || null);
  const orders = employeeOrdersAreScoped ? employeeOrders : sharedOrders;
  const { data: paymentAccounts } = useLiveCollection<PaymentAccount>(shopId ? `shops/${shopId}/paymentAccounts` : null, 'createdAt');
  const settings = useLiveDocument<ShopSettings>(shopId ? `shops/${shopId}/settings/general` : null);
  const employee = useLiveDocument<Employee>(user?.role === 'EMPLOYEE' && shopId ? `shops/${shopId}/employees/${user.id}` : null);
  const { data: storedBranches } = useLiveCollection<Branch>(shopId ? `shops/${shopId}/branches` : null, 'createdAt');
  const branches = storedBranches.some(branch => branch.id === 'main') ? storedBranches : [{ id: 'main', name: 'Main Branch' } as Branch, ...storedBranches];
  const [ownerBranchId, setOwnerBranchId] = useState(() => localStorage.getItem('ki3-owner-branch') || 'main');
  const branchId = user?.role === 'EMPLOYEE' ? employee?.branchId || user.branchId || 'main' : ownerBranchId;
  const branchName = branches.find(branch => branch.id === branchId)?.name || employee?.branchName || user?.branchName || 'Main Branch';
  const canDiscount = user?.role === 'OWNER' || employee?.permissions?.discount === true;
  const activeShift = shifts.find(shift => shift.employeeId === user?.id && shift.status === 'OPEN' && (shift.branchId || 'main') === branchId);
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [search, setSearch] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [paymentKind, setPaymentKind] = useState<PaymentKind>('CASH');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [customer, setCustomer] = useState('Walk-in');
  const [customerPhone, setCustomerPhone] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const sellableProducts = products.filter(product => product.active !== false && product.availableInStore !== false);
  const categories = useMemo(() => ['All', ...Array.from(new Set(sellableProducts.map(product => product.category)))], [sellableProducts]);
  const filteredProducts = sellableProducts.filter(p =>
    (activeCategory === 'All' || p.category === activeCategory) &&
    `${p.name} ${p.sku} ${p.barcode || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: Product) => {
    if (product.itemType !== 'SERVICE' && product.trackStock !== false && product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const salePrice = (product: Product) => product.inStorePrice ?? product.price;
  const total = cart.reduce((sum, item) => sum + (salePrice(item.product) * item.quantity), 0);
  const calculated = calculateTotals(total, discountPercent, settings?.taxRate ?? 5);
  const { discount, tax } = calculated;
  const serviceCharge = Math.round((total - discount) * ((settings?.serviceCharge ?? 0) / 100));
  const grandTotal = calculated.total + serviceCharge;
  const selectedPayment = paymentAccounts.find(account => account.id === paymentAccountId);

  const handleCheckout = async () => {
    if (!activeShift) { setCheckoutError('Open a cashier shift before taking payment.'); return; }
    setBusy(true); setCheckoutError('');
    const order: Omit<Order, 'id'> = {
      shopId, branchId, branchName, customer: customer || 'Walk-in', customerPhone,
      items: cart.map(item => ({ productId: item.product.id, name: item.product.name, quantity: item.quantity, price: salePrice(item.product) })),
      subtotal: total,
      tax,
      serviceCharge,
      discount,
      total: grandTotal,
      paymentMethod: paymentKind === 'CASH' ? 'Cash' : selectedPayment?.label || paymentKind,
      paymentKind,
      paymentAccountId: selectedPayment?.id || '',
      paymentAccountLabel: selectedPayment?.label || '',
      paymentAccountNumber: selectedPayment?.accountNumber || '',
      paymentReference: paymentReference.trim(),
      status: 'COMPLETED', type: 'OFFLINE', employeeId: user?.id, shiftId: activeShift.id,
      createdAt: new Date().toISOString(),
    };
    try {
      let id = `OFF-${Date.now()}`;
      if (navigator.onLine) id = await completeSale(shopId, order);
      else {
        const queued = JSON.parse(localStorage.getItem('ki3-offline-orders') || '[]');
        localStorage.setItem('ki3-offline-orders', JSON.stringify([...queued, order]));
      }
      if (customerPhone) await setRecord(`shops/${shopId}/customers`, customerPhone.replace(/\W/g, ''), {
        name: customer, phone: customerPhone, totalSpent: increment(grandTotal), visits: increment(1),
        loyaltyPoints: increment(Math.floor((grandTotal / 1000) * (settings?.loyaltyPointsPer1000 ?? 0))), updatedAt: new Date().toISOString(),
      });
      if (navigator.onLine && user) await createRecord(`shops/${shopId}/auditLogs`, { shopId, actorId: user.id, actorName: user.name, action: 'SALE_COMPLETED', detail: `${branchName} · ${id} · ${order.paymentMethod} · ${grandTotal} MMK`, createdAt: new Date().toISOString() });
      setLastOrder({ id, ...order, grandTotal }); setShowReceipt(true); setCart([]); setDiscountPercent(0); setPaymentReference('');
    } catch (issue) { setCheckoutError(issue instanceof Error ? issue.message : 'Checkout failed.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const sync = async () => {
      const queued: Array<Omit<Order, 'id'>> = JSON.parse(localStorage.getItem('ki3-offline-orders') || '[]');
      if (!queued.length || !shopId) return;
      const remaining = [...queued];
      while (remaining.length) {
        try { await completeSale(shopId, remaining[0]); remaining.shift(); }
        catch { break; }
      }
      localStorage.setItem('ki3-offline-orders', JSON.stringify(remaining));
    };
    window.addEventListener('online', sync); if (navigator.onLine) sync();
    return () => window.removeEventListener('online', sync);
  }, [shopId]);

  const toggleShift = async () => {
    if (!shopId || !user) return;
    if (activeShift) {
      const closingCash = Number(window.prompt('Closing cash amount', '0'));
      const shiftCashSales = orders.filter(order => order.shiftId === activeShift.id && order.status === 'COMPLETED' && (order.paymentKind === 'CASH' || order.paymentMethod === 'Cash')).reduce((sum, order) => sum + order.total, 0);
      const expectedCash = activeShift.openingCash + shiftCashSales;
      if (Number.isFinite(closingCash)) {
        await updateRecord(`shops/${shopId}/shifts`, activeShift.id, { status: 'CLOSED', closingCash, expectedCash, cashDifference: closingCash - expectedCash, closedAt: new Date().toISOString() });
        await createRecord(`shops/${shopId}/auditLogs`, { shopId, actorId: user.id, actorName: user.name, action: 'SHIFT_CLOSED', detail: `Difference ${closingCash - expectedCash} MMK`, createdAt: new Date().toISOString() });
      }
    } else {
      const openingCash = Number(window.prompt('Opening cash amount', '0'));
      if (Number.isFinite(openingCash)) {
        await createRecord(`shops/${shopId}/shifts`, { shopId, branchId, branchName, employeeId: user.id, employeeName: user.name, openingCash, openedAt: new Date().toISOString(), status: 'OPEN' });
        await createRecord(`shops/${shopId}/auditLogs`, { shopId, actorId: user.id, actorName: user.name, action: 'SHIFT_OPENED', detail: `Opening cash ${openingCash} MMK`, createdAt: new Date().toISOString() });
      }
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans overflow-hidden text-slate-900">
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-10 relative">
        <div className="flex items-center space-x-6">
          <button onClick={logout}>
            <Button variant="ghost" className="px-3">
              <ArrowLeft className="w-5 h-5 mr-2" /> Back
            </Button>
          </button>
          <div className="w-px h-8 bg-slate-200" />
          <div><h1 className="text-xl font-bold tracking-tight">KI3 POS • {shop?.name || 'Shop'}</h1><p className="text-xs font-bold text-blue-600">{branchName}</p></div>
          <Badge className={navigator.onLine ? 'hidden md:inline-flex bg-emerald-100 text-emerald-800 border-none' : 'hidden md:inline-flex bg-amber-100 text-amber-800 border-none'}>{navigator.onLine ? 'Cloud Sync Active' : 'Offline Queue Active'}</Badge>
        </div>
        <div className="flex items-center space-x-4">
          {user?.role === 'OWNER' && <select aria-label="Active branch" disabled={Boolean(activeShift)} value={branchId} onChange={event => { setOwnerBranchId(event.target.value); localStorage.setItem('ki3-owner-branch', event.target.value); }} className="h-10 max-w-36 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{branches.filter(branch => branch.active !== false).map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>}
          {user?.role === 'EMPLOYEE' && user.permissions?.recordExpenses === true && <Button variant="outline" onClick={() => navigate('/expenses')} className="h-10 px-3"><ReceiptText className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">Expense</span></Button>}
          <div className="text-right mr-4 hidden md:block">
            <p className="text-sm font-bold">Cashier: {user?.name}</p>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <button aria-label="Scan barcode" onClick={() => searchRef.current?.focus()} className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center hover:bg-blue-100">
            <ScanBarcode className="w-6 h-6 text-slate-600" />
          </button>
          <Button variant={activeShift ? 'danger' : 'primary'} onClick={toggleShift} className="hidden md:inline-flex h-10 px-3">{activeShift ? 'Close Shift' : 'Open Shift'}</Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel: Products */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-6 pb-2 shrink-0 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input 
                ref={searchRef}
                placeholder="Search products by name or barcode..." 
                className="pl-12 h-14 text-lg bg-white border-slate-200 shadow-sm rounded-full focus-visible:ring-blue-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const exact = products.find(product => product.barcode && product.barcode === search.trim());
                  if (exact) { e.preventDefault(); addToCart(exact); setSearch(''); }
                }}
              />
            </div>
            
            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all border",
                    activeCategory === cat 
                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20" 
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              <div className="col-span-full"><DataState loading={productsLoading} error={productsError} empty={!productsLoading && !productsError && filteredProducts.length === 0} emptyMessage={search || activeCategory !== 'All' ? 'No products match your search.' : 'No products or services are available.'} /></div>
              {filteredProducts.map(product => (
                <motion.div
                  key={product.id}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => addToCart(product)}
                  className="bg-white rounded-3xl overflow-hidden cursor-pointer shadow-sm border border-slate-100 hover:border-blue-500 transition-colors"
                >
                  <div className="h-40 w-full bg-slate-100 relative">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-800 shadow-sm tracking-wide uppercase">
                      {product.category}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 line-clamp-1 mb-1">{product.name}</h3>
                    <p className="text-[#2563EB] font-black">{formatCurrency(product.price)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Cart */}
        <div className="w-full lg:w-[420px] max-h-[52vh] lg:max-h-none bg-white border-l border-slate-200 flex flex-col shrink-0 z-10 shadow-xl">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h2 className="text-xl font-bold flex items-center">
              <ShoppingBag className="w-5 h-5 mr-3 text-blue-600" />
              Current Order
            </h2>
            <Button variant="ghost" className="text-red-500 p-2 h-auto" onClick={() => setCart([])}>
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <AnimatePresence>
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <ShoppingBag className="w-16 h-16 mb-4 opacity-20" />
                  <p className="font-medium">Cart is empty. Select products to begin.</p>
                </div>
              ) : (
                cart.map(item => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={item.product.id} 
                    className="flex p-3 rounded-2xl bg-white border border-slate-100 items-center shadow-sm"
                  >
                    <img src={item.product.image} className="w-14 h-14 rounded-xl object-cover mr-4" />
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{item.product.name}</h4>
                      <p className="text-blue-600 text-sm font-black">{formatCurrency(item.product.price)}</p>
                    </div>
                    <div className="flex items-center space-x-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-100">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-4 text-center font-bold text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 hover:bg-blue-200">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200 shrink-0">
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name" className="h-10 bg-white" />
              <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone (optional)" className="h-10 bg-white" />
              <label className="col-span-2 flex items-center justify-between text-xs font-bold text-slate-500">Discount %{!canDiscount && <span className="font-normal">Owner permission required</span>}<Input type="number" min="0" max="100" value={discountPercent} disabled={!canDiscount} onChange={e => setDiscountPercent(Number(e.target.value))} className="w-24 h-9 bg-white" /></label>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-slate-500 text-sm font-bold uppercase tracking-wider">
                <span>Subtotal</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-sm font-bold uppercase tracking-wider">
                <span>Tax ({settings?.taxRate ?? 5}%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-sm font-bold uppercase tracking-wider"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>
              {serviceCharge > 0 && <div className="flex justify-between text-slate-500 text-sm font-bold uppercase tracking-wider"><span>Service charge</span><span>{formatCurrency(serviceCharge)}</span></div>}
              <div className="flex justify-between text-slate-900 text-2xl font-black pt-3 border-t border-slate-200">
                <span>Total</span>
                <span className="text-blue-600">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <Button variant="outline" onClick={() => { setPaymentKind('CASH'); setPaymentAccountId(''); }} className={cn("h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-white hover:border-blue-500 border-slate-200", paymentKind === 'CASH' && 'border-blue-500 ring-2 ring-blue-100')}>
                <Banknote className="w-6 h-6 text-emerald-600" />
                <span className="text-xs font-bold text-slate-600">Cash</span>
              </Button>
              {paymentAccounts.filter(account => account.active).map(account => <Button key={account.id} variant="outline" onClick={() => { setPaymentKind(account.kind); setPaymentAccountId(account.id); }} className={cn("h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-white border-slate-200", paymentAccountId === account.id && 'border-blue-500 ring-2 ring-blue-100')}><CreditCard className={cn('w-6 h-6', account.kind === 'WAVE' ? 'text-yellow-500' : 'text-blue-600')} /><span className="text-[11px] font-bold text-slate-600 line-clamp-1">{account.label}</span></Button>)}
            </div>
            {paymentKind !== 'CASH' && <div className="mb-3 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm">
              {selectedPayment ? <div className={cn('gap-3', selectedPayment.qrCode && 'grid grid-cols-[1fr_auto] items-center')}><div><p className="font-bold text-blue-900">{selectedPayment.label} · {selectedPayment.accountName}</p><p className="font-mono text-lg font-black text-blue-700">{selectedPayment.accountNumber}</p>{selectedPayment.bankName && <p className="text-blue-700">{selectedPayment.bankName}</p>}<Input className="mt-2 h-9 bg-white" placeholder="Payment reference / transaction ID" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} /></div>{selectedPayment.qrCode && <div className="text-center"><img src={selectedPayment.qrCode} alt={`${selectedPayment.label} payment QR Code`} className="h-36 w-36 rounded-xl border border-blue-200 bg-white object-contain p-2" /><p className="mt-1 text-[10px] font-bold text-blue-700">Customer Scan QR</p></div>}</div> : <p className="text-amber-700 font-bold">Select an owner-configured payment account.</p>}
            </div>}
            
            <Button 
              className="w-full h-16 text-lg font-bold rounded-2xl shadow-xl shadow-blue-500/30 bg-[#2563EB] hover:bg-blue-700 text-white" 
              disabled={cart.length === 0 || busy || !activeShift || (paymentKind !== 'CASH' && !selectedPayment)}
              onClick={handleCheckout}
            >
              <Banknote className="w-6 h-6 mr-2" /> {busy ? 'Processing…' : `Pay ${formatCurrency(grandTotal)} · ${paymentKind === 'CASH' ? 'Cash' : selectedPayment?.label || paymentKind}`}
            </Button>
            {checkoutError && <p className="mt-2 text-xs font-medium text-red-600">{checkoutError}</p>}
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceipt && lastOrder && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="receipt bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-6 bg-slate-50 flex justify-between items-center border-b border-slate-200">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="font-bold text-lg">Payment Success</span>
                </div>
                <button onClick={() => setShowReceipt(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 pb-4">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-black text-slate-900">{shop?.name || 'KI3 POS'}</h2>
                  <p className="text-sm text-slate-500 font-medium">{shop?.address || shop?.phone}</p>
                  <p className="text-xs text-slate-400 mt-1">Invoice #{settings?.invoicePrefix || 'KI3'}-{lastOrder.id}</p>
                  <p className="text-xs text-slate-400">{new Date(lastOrder.createdAt).toLocaleString()}</p>
                </div>

                <div className="space-y-3 mb-6 border-y border-dashed border-slate-300 py-4">
                  {lastOrder.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="font-bold text-slate-700">{item.quantity}x {item.name}</span>
                      <span className="font-bold text-slate-900">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-500">Subtotal</span>
                    <span className="font-bold text-slate-700">{formatCurrency(lastOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-500">Tax (5%)</span>
                    <span className="font-bold text-slate-700">{formatCurrency(lastOrder.tax)}</span>
                  </div>
                  <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Discount</span><span className="font-bold text-slate-700">-{formatCurrency(lastOrder.discount)}</span></div>
                  {lastOrder.serviceCharge > 0 && <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Service charge</span><span className="font-bold text-slate-700">{formatCurrency(lastOrder.serviceCharge)}</span></div>}
                  <div className="flex justify-between text-lg pt-2">
                    <span className="font-black text-slate-900">Total</span>
                    <span className="font-black text-blue-600">{formatCurrency(lastOrder.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="font-bold text-slate-500">Payment</span>
                    <span className="font-bold text-slate-700">{lastOrder.paymentMethod}{lastOrder.paymentAccountNumber ? ` · ${lastOrder.paymentAccountNumber}` : ''}</span>
                  </div>
                  {lastOrder.paymentReference && <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Reference</span><span className="font-bold text-slate-700">{lastOrder.paymentReference}</span></div>}
                </div>

                <div className="flex justify-center mb-4">
                  <div className="w-48 h-12 bg-slate-100 flex items-center justify-center font-mono text-sm tracking-[0.2em] text-slate-600 rounded-lg">
                    ||||| ||| || ||||
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
                <Button className="flex-1 bg-white text-slate-700 border-slate-200 hover:bg-slate-100" variant="outline" onClick={() => setShowReceipt(false)}>
                  New Order
                </Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-2" /> Print Receipt
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
