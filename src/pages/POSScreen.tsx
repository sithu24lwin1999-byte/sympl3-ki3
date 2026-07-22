import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ShoppingBag, CreditCard, Banknote, Trash2, Plus, Minus, ScanBarcode, ArrowLeft, Printer, CheckCircle2, X } from 'lucide-react';
import { Button, Input, Card, Badge } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { completeSale, createRecord, setRecord, updateRecord, useLiveCollection, useLiveDocument } from '@/lib/firestore';
import type { Order, Product, Shift, Shop } from '@/types';
import { calculateTotals } from '@/lib/pos';

export default function POSScreen() {
  const { user, logout } = useAuth();
  const shopId = user?.shopId || '';
  const shop = useLiveDocument<Shop>(shopId ? `shops/${shopId}` : null);
  const { data: products, error: productsError } = useLiveCollection<Product>(shopId ? `shops/${shopId}/products` : null);
  const { data: shifts } = useLiveCollection<Shift>(shopId ? `shops/${shopId}/shifts` : null, 'openedAt');
  const activeShift = shifts.find(shift => shift.employeeId === user?.id && shift.status === 'OPEN');
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [search, setSearch] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'KBZ Pay' | 'Wave Pay'>('Cash');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [customer, setCustomer] = useState('Walk-in');
  const [customerPhone, setCustomerPhone] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map(product => product.category)))], [products]);
  const filteredProducts = products.filter(p =>
    (activeCategory === 'All' || p.category === activeCategory) &&
    `${p.name} ${p.sku} ${p.barcode || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
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

  const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const { discount, tax, total: grandTotal } = calculateTotals(total, discountPercent);

  const handleCheckout = async () => {
    if (!activeShift) { setCheckoutError('Open a cashier shift before taking payment.'); return; }
    setBusy(true); setCheckoutError('');
    const order: Omit<Order, 'id'> = {
      shopId, customer: customer || 'Walk-in', customerPhone,
      items: cart.map(item => ({ productId: item.product.id, name: item.product.name, quantity: item.quantity, price: item.product.price })),
      subtotal: total,
      tax,
      discount,
      total: grandTotal,
      paymentMethod,
      status: 'COMPLETED', type: navigator.onLine ? 'ONLINE' : 'OFFLINE', employeeId: user?.id, shiftId: activeShift.id,
      createdAt: new Date().toISOString(),
    };
    try {
      let id = `OFF-${Date.now()}`;
      if (navigator.onLine) id = await completeSale(shopId, order);
      else {
        const queued = JSON.parse(localStorage.getItem('ki3-offline-orders') || '[]');
        localStorage.setItem('ki3-offline-orders', JSON.stringify([...queued, order]));
      }
      if (customerPhone) await setRecord(`shops/${shopId}/customers`, customerPhone.replace(/\W/g, ''), { name: customer, phone: customerPhone, updatedAt: new Date().toISOString() });
      setLastOrder({ id, ...order, grandTotal }); setShowReceipt(true); setCart([]); setDiscountPercent(0);
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
      if (Number.isFinite(closingCash)) await updateRecord(`shops/${shopId}/shifts`, activeShift.id, { status: 'CLOSED', closingCash, closedAt: new Date().toISOString() });
    } else {
      const openingCash = Number(window.prompt('Opening cash amount', '0'));
      if (Number.isFinite(openingCash)) await createRecord(`shops/${shopId}/shifts`, { shopId, employeeId: user.id, employeeName: user.name, openingCash, openedAt: new Date().toISOString(), status: 'OPEN' });
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
          <h1 className="text-xl font-bold tracking-tight">KI3 POS • {shop?.name || 'Shop'}</h1>
          <Badge className={navigator.onLine ? 'hidden md:inline-flex bg-emerald-100 text-emerald-800 border-none' : 'hidden md:inline-flex bg-amber-100 text-amber-800 border-none'}>{navigator.onLine ? 'Cloud Sync Active' : 'Offline Queue Active'}</Badge>
        </div>
        <div className="flex items-center space-x-4">
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
              <label className="col-span-2 flex items-center justify-between text-xs font-bold text-slate-500">Discount %<Input type="number" min="0" max="100" value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} className="w-24 h-9 bg-white" /></label>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-slate-500 text-sm font-bold uppercase tracking-wider">
                <span>Subtotal</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-sm font-bold uppercase tracking-wider">
                <span>Tax (5%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-sm font-bold uppercase tracking-wider"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>
              <div className="flex justify-between text-slate-900 text-2xl font-black pt-3 border-t border-slate-200">
                <span>Total</span>
                <span className="text-blue-600">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <Button variant="outline" onClick={() => setPaymentMethod('Cash')} className={cn("h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-white hover:border-blue-500 border-slate-200", paymentMethod === 'Cash' && 'border-blue-500 ring-2 ring-blue-100')}>
                <Banknote className="w-6 h-6 text-emerald-600" />
                <span className="text-xs font-bold text-slate-600">Cash</span>
              </Button>
              <Button variant="outline" onClick={() => setPaymentMethod('KBZ Pay')} className={cn("h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-white hover:border-blue-500 border-slate-200", paymentMethod === 'KBZ Pay' && 'border-blue-500 ring-2 ring-blue-100')}>
                <CreditCard className="w-6 h-6 text-blue-600" />
                <span className="text-xs font-bold text-slate-600">KBZ Pay</span>
              </Button>
              <Button variant="outline" onClick={() => setPaymentMethod('Wave Pay')} className={cn("h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-white hover:border-blue-500 border-slate-200", paymentMethod === 'Wave Pay' && 'border-blue-500 ring-2 ring-blue-100')}>
                <CreditCard className="w-6 h-6 text-yellow-500" />
                <span className="text-xs font-bold text-slate-600">Wave Pay</span>
              </Button>
            </div>
            
            <Button 
              className="w-full h-16 text-lg font-bold rounded-2xl shadow-xl shadow-blue-500/30 bg-[#2563EB] hover:bg-blue-700 text-white" 
              disabled={cart.length === 0 || busy || !activeShift}
              onClick={handleCheckout}
            >
              <Banknote className="w-6 h-6 mr-2" /> {busy ? 'Processing…' : `Pay ${formatCurrency(grandTotal)} · ${paymentMethod}`}
            </Button>
            {checkoutError && <p className="mt-2 text-xs font-medium text-red-600">{checkoutError}</p>}
            {productsError && <p className="mt-2 text-xs font-medium text-red-600">{productsError}</p>}
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
                  <p className="text-xs text-slate-400 mt-1">Order #{lastOrder.id}</p>
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
                  <div className="flex justify-between text-lg pt-2">
                    <span className="font-black text-slate-900">Total</span>
                    <span className="font-black text-blue-600">{formatCurrency(lastOrder.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="font-bold text-slate-500">Payment</span>
                    <span className="font-bold text-slate-700">{lastOrder.paymentMethod}</span>
                  </div>
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
