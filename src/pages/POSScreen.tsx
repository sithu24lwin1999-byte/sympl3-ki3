import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingBag, CreditCard, Banknote, Trash2, Plus, Minus, ScanBarcode, ArrowLeft, Printer, CheckCircle2, X } from 'lucide-react';
import { Button, Input, Card, Badge } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_PRODUCTS = [
  { id: '1', name: 'Premium Espresso', price: 4500, category: 'Beverage', image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=300&h=300&fit=crop' },
  { id: '2', name: 'Latte Art', price: 5500, category: 'Beverage', image: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=300&h=300&fit=crop' },
  { id: '3', name: 'Strawberry Cake', price: 8000, category: 'Bakery', image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=300&h=300&fit=crop' },
  { id: '4', name: 'Croissant', price: 3500, category: 'Bakery', image: 'https://images.unsplash.com/photo-1555507036-ab1e4006aaeb?w=300&h=300&fit=crop' },
  { id: '5', name: 'Iced Americano', price: 4000, category: 'Beverage', image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba1?w=300&h=300&fit=crop' },
  { id: '6', name: 'Club Sandwich', price: 6500, category: 'Food', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300&h=300&fit=crop' },
  { id: '7', name: 'Green Tea Frappe', price: 6000, category: 'Beverage', image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=300&h=300&fit=crop' },
  { id: '8', name: 'Chocolate Muffin', price: 3000, category: 'Bakery', image: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=300&h=300&fit=crop' },
];

const CATEGORIES = ['All', 'Beverage', 'Bakery', 'Food'];

export default function POSScreen() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState<{product: any, quantity: number}[]>([]);
  const [search, setSearch] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);

  const filteredProducts = MOCK_PRODUCTS.filter(p => 
    (activeCategory === 'All' || p.category === activeCategory) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: any) => {
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
  const tax = total * 0.05; // 5% commercial tax
  const grandTotal = total + tax;

  const handleCheckout = () => {
    setLastOrder({
      items: [...cart],
      total,
      tax,
      grandTotal,
      time: new Date().toLocaleTimeString(),
      id: 'ORD-' + Math.floor(1000 + Math.random() * 9000)
    });
    setShowReceipt(true);
    setCart([]);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans overflow-hidden text-slate-900">
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-10 relative">
        <div className="flex items-center space-x-6">
          <Link to="/">
            <Button variant="ghost" className="px-3">
              <ArrowLeft className="w-5 h-5 mr-2" /> Back
            </Button>
          </Link>
          <div className="w-px h-8 bg-slate-200" />
          <h1 className="text-xl font-bold tracking-tight">KI3 POS • City Mart</h1>
          <Badge className="hidden md:inline-flex bg-blue-100 text-blue-800 border-none">Offline Mode Active</Badge>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right mr-4 hidden md:block">
            <p className="text-sm font-bold">Cashier: Kyaw Zin</p>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
            <ScanBarcode className="w-6 h-6 text-slate-600" />
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Products */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-6 pb-2 shrink-0 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input 
                placeholder="Search products by name or barcode..." 
                className="pl-12 h-14 text-lg bg-white border-slate-200 shadow-sm rounded-full focus-visible:ring-blue-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
              {CATEGORIES.map(cat => (
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
        <div className="w-[420px] bg-white border-l border-slate-200 flex flex-col shrink-0 z-10 shadow-xl">
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
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-slate-500 text-sm font-bold uppercase tracking-wider">
                <span>Subtotal</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-sm font-bold uppercase tracking-wider">
                <span>Tax (5%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-slate-900 text-2xl font-black pt-3 border-t border-slate-200">
                <span>Total</span>
                <span className="text-blue-600">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <Button variant="outline" className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-white hover:border-blue-500 border-slate-200">
                <CreditCard className="w-6 h-6 text-blue-600" />
                <span className="text-xs font-bold text-slate-600">KBZ Pay</span>
              </Button>
              <Button variant="outline" className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-white hover:border-blue-500 border-slate-200">
                <CreditCard className="w-6 h-6 text-yellow-500" />
                <span className="text-xs font-bold text-slate-600">Wave Pay</span>
              </Button>
            </div>
            
            <Button 
              className="w-full h-16 text-lg font-bold rounded-2xl shadow-xl shadow-blue-500/30 bg-[#2563EB] hover:bg-blue-700 text-white" 
              disabled={cart.length === 0}
              onClick={handleCheckout}
            >
              <Banknote className="w-6 h-6 mr-2" /> Pay {formatCurrency(grandTotal)}
            </Button>
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
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
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
                  <h2 className="text-2xl font-black text-slate-900">City Mart</h2>
                  <p className="text-sm text-slate-500 font-medium">Branch 4 • Mandalay</p>
                  <p className="text-xs text-slate-400 mt-1">Order #{lastOrder.id}</p>
                  <p className="text-xs text-slate-400">{lastOrder.time}</p>
                </div>

                <div className="space-y-3 mb-6 border-y border-dashed border-slate-300 py-4">
                  {lastOrder.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="font-bold text-slate-700">{item.quantity}x {item.product.name}</span>
                      <span className="font-bold text-slate-900">{formatCurrency(item.product.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-500">Subtotal</span>
                    <span className="font-bold text-slate-700">{formatCurrency(lastOrder.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-500">Tax (5%)</span>
                    <span className="font-bold text-slate-700">{formatCurrency(lastOrder.tax)}</span>
                  </div>
                  <div className="flex justify-between text-lg pt-2">
                    <span className="font-black text-slate-900">Total</span>
                    <span className="font-black text-blue-600">{formatCurrency(lastOrder.grandTotal)}</span>
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
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowReceipt(false)}>
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

