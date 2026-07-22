import React, { useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Badge, Input } from '@/components/ui';
import { Search, Plus, Filter, Edit, Trash2, X, Image as ImageIcon } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { createRecord, deleteRecord, setRecord, useLiveCollection } from '@/lib/firestore';
import type { Product } from '@/types';

export default function OwnerInventory() {
  const { user } = useAuth();
  const inventoryPath = user?.shopId ? `shops/${user.shopId}/products` : null;
  const [search, setSearch] = useState('');
  const { data: products, loading, error } = useLiveCollection<Product>(inventoryPath);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const emptyItem = { name: '', sku: '', barcode: '', category: 'General', price: '', cost: '', stock: '', minStock: '10', image: '', itemType: 'PRODUCT' as 'PRODUCT' | 'SERVICE', trackStock: true };
  const [newProduct, setNewProduct] = useState(emptyItem);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name) return;
    const stock = parseInt(newProduct.stock) || 0;
    const p = {
      name: newProduct.name,
      sku: newProduct.sku,
      barcode: newProduct.barcode,
      category: newProduct.category,
      price: parseFloat(newProduct.price) || 0,
      cost: parseFloat(newProduct.cost) || 0,
      stock: stock,
      minStock: parseInt(newProduct.minStock) || 0,
      status: newProduct.itemType === 'SERVICE' || !newProduct.trackStock ? 'In Stock' : stock > (parseInt(newProduct.minStock) || 0) ? 'In Stock' : stock > 0 ? 'Low Stock' : 'Out of Stock',
      image: newProduct.image || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=100&h=100&fit=crop',
      shopId: user!.shopId!,
      itemType: newProduct.itemType,
      trackStock: newProduct.itemType === 'SERVICE' ? false : newProduct.trackStock,
      updatedAt: new Date().toISOString(),
    };
    if (!inventoryPath) return;
    const now = new Date().toISOString();
    let productId = editingId || '';
    if (editingId) {
      const previous = products.find(item => item.id === editingId);
      await setRecord(inventoryPath, editingId, p);
      const difference = stock - (previous?.stock || 0);
      if (difference && p.trackStock) await createRecord(`shops/${user!.shopId}/stockMovements`, { shopId: user!.shopId, productId: editingId, productName: p.name, type: 'ADJUSTMENT', quantity: difference, balance: stock, note: 'Manual inventory edit', createdAt: now });
    } else {
      const created = await createRecord(inventoryPath, { ...p, createdAt: now }); productId = created.id;
      if (stock > 0 && p.trackStock) await createRecord(`shops/${user!.shopId}/stockMovements`, { shopId: user!.shopId, productId, productName: p.name, type: 'ADJUSTMENT', quantity: stock, balance: stock, note: 'Opening stock', createdAt: now });
    }
    await createRecord(`shops/${user!.shopId}/auditLogs`, { shopId: user!.shopId, actorId: user!.id, actorName: user!.name, action: editingId ? 'ITEM_UPDATED' : 'ITEM_CREATED', detail: p.name, createdAt: now });
    setShowAddModal(false);
    setEditingId(null);
    setNewProduct(emptyItem);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this product?')) return;
    const product = products.find(item => item.id === id);
    if (inventoryPath) await deleteRecord(inventoryPath, id);
    if (user?.shopId) await createRecord(`shops/${user.shopId}/auditLogs`, { shopId: user.shopId, actorId: user.id, actorName: user.name, action: 'ITEM_DELETED', detail: product?.name || id, createdAt: new Date().toISOString() });
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setNewProduct({
      name: product.name, sku: product.sku, barcode: product.barcode || '', category: product.category,
      price: String(product.price), cost: String(product.cost), stock: String(product.stock), minStock: String(product.minStock), image: product.image,
      itemType: product.itemType || 'PRODUCT', trackStock: product.trackStock !== false,
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingId(null);
    setNewProduct(emptyItem);
  };

  const filteredProducts = products.filter(p =>
    (categoryFilter === 'All' || p.category === categoryFilter) &&
    (statusFilter === 'All' || p.status === statusFilter) &&
    (`${p.name} ${p.sku} ${p.barcode || ''}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <DashboardLayout role="OWNER">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Products & Services</h1>
          <p className="text-slate-500">Manage retail products, food items, fashion stock and service items.</p>
        </div>
        <Button 
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Products</p>
            <p className="text-xl font-black text-slate-900 mt-1">{products.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">In Stock</p>
            <p className="text-xl font-black text-slate-900 mt-1">{products.filter(p => p.stock > 10).length}</p>
          </div>
        </div>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Low Stock</p>
            <p className="text-xl font-black text-amber-700 mt-1">{products.filter(p => p.stock > 0 && p.stock <= 10).length}</p>
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Out of Stock</p>
            <p className="text-xl font-black text-red-700 mt-1">{products.filter(p => p.stock === 0).length}</p>
          </div>
        </div>
      </div>

      <Card className="p-0 overflow-hidden flex flex-col">
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-white">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              type="text" 
            placeholder="Search name, SKU or barcode..."
              className="bg-transparent border-none outline-none text-sm w-full text-slate-900"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-11 rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none">
              <option>All</option>{Array.from(new Set(products.map(product => product.category))).map(category => <option key={category}>{category}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-11 rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none">
              <option>All</option><option>In Stock</option><option>Low Stock</option><option>Out of Stock</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">SKU & Category</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Price / Cost</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {!loading && filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img src={product.image} alt={product.name} className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                      <div className="ml-4">
                        <div className="text-sm font-bold text-slate-900">{product.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{product.sku}</div>
                    <div className="text-xs text-slate-500">{product.category}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-blue-600">{formatCurrency(product.price)}</div>
                    <div className="text-xs text-slate-500">Cost: {formatCurrency(product.cost)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-slate-700">{product.itemType === 'SERVICE' || product.trackStock === false ? 'Not tracked' : `${product.stock} units`}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge 
                      className={cn(
                        "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full",
                        product.status === 'In Stock' ? 'bg-emerald-50 text-emerald-600' : 
                        product.status === 'Out of Stock' ? 'bg-red-50 text-red-600' : 
                        'bg-amber-50 text-amber-600'
                      )}
                    >
                      {product.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg text-blue-600 hover:bg-blue-50 bg-slate-50" onClick={() => handleEdit(product)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="h-8 w-8 p-0 rounded-lg text-red-600 hover:bg-red-50 bg-slate-50"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 bg-slate-50 flex justify-between items-center border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Item' : 'Add Product or Service'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 mb-2 relative group overflow-hidden">
                {newProduct.image ? (
                  <img src={newProduct.image} alt="Preview" className="w-full h-32 object-cover rounded-xl" />
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-sm font-bold text-slate-500">Upload Product Photo</p>
                    <p className="text-xs text-slate-400">Click to browse (JPG, PNG)</p>
                  </>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Item Type</label>
                <select className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4" value={newProduct.itemType} onChange={e => setNewProduct({ ...newProduct, itemType: e.target.value as 'PRODUCT' | 'SERVICE', trackStock: e.target.value !== 'SERVICE' })}><option value="PRODUCT">Physical Product / Food</option><option value="SERVICE">Service</option></select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Product Name</label>
                <Input 
                  placeholder="e.g. Caramel Macchiato" 
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  className="bg-white border-slate-200"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">SKU</label>
                  <Input 
                    placeholder="BEV-003" 
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                    className="bg-white border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Barcode</label>
                  <Input placeholder="Scan / type" value={newProduct.barcode} onChange={e => setNewProduct({ ...newProduct, barcode: e.target.value })} className="bg-white border-slate-200" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Category</label>
                  <Input placeholder="Food, Clothing, Service..." value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Price</label>
                  <Input 
                    placeholder="0" type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                    className="bg-white border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Cost</label>
                  <Input 
                    placeholder="0" type="number"
                    value={newProduct.cost}
                    onChange={(e) => setNewProduct({...newProduct, cost: e.target.value})}
                    className="bg-white border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Stock</label>
                  <Input 
                    placeholder="0" type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                    disabled={newProduct.itemType === 'SERVICE' || !newProduct.trackStock}
                    className="bg-white border-slate-200"
                  />
                </div>
                <div><label className="block text-sm font-bold text-slate-700 mb-2">Low stock alert</label><Input type="number" min="0" value={newProduct.minStock} onChange={e => setNewProduct({ ...newProduct, minStock: e.target.value })} disabled={newProduct.itemType === 'SERVICE' || !newProduct.trackStock} /></div>
              </div>
              {newProduct.itemType === 'PRODUCT' && <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={newProduct.trackStock} onChange={e => setNewProduct({ ...newProduct, trackStock: e.target.checked })} /> Track stock for this item</label>}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
              <Button className="flex-1 bg-white text-slate-700 border-slate-200 hover:bg-slate-100" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddProduct} disabled={!newProduct.name.trim()}>
                {editingId ? 'Update Product' : 'Save Product'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
