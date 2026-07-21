import React, { useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Badge, Input } from '@/components/ui';
import { Search, Plus, Filter, Edit, Trash2, X, Image as ImageIcon } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

const initialInventory = [
  { id: 'P001', name: 'Premium Espresso', sku: 'BEV-001', category: 'Beverage', price: 4500, cost: 1500, stock: 124, status: 'In Stock', image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=100&h=100&fit=crop' },
  { id: 'P002', name: 'Latte Art', sku: 'BEV-002', category: 'Beverage', price: 5500, cost: 1800, stock: 85, status: 'In Stock', image: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=100&h=100&fit=crop' },
  { id: 'P003', name: 'Strawberry Cake', sku: 'BAK-001', category: 'Bakery', price: 8000, cost: 3000, stock: 45, status: 'In Stock', image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=100&h=100&fit=crop' },
  { id: 'P004', name: 'Croissant', sku: 'BAK-002', category: 'Bakery', price: 3500, cost: 1200, stock: 30, status: 'In Stock', image: 'https://images.unsplash.com/photo-1555507036-ab1e4006aaeb?w=100&h=100&fit=crop' },
  { id: 'P005', name: 'Coffee Beans (1kg)', sku: 'RAW-001', category: 'Raw Material', price: 25000, cost: 18000, stock: 20, status: 'In Stock', image: 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=100&h=100&fit=crop' },
];

export default function OwnerInventory() {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState(initialInventory);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', sku: '', category: 'Beverage', price: '', cost: '', stock: '', image: '' });

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

  const handleAddProduct = () => {
    if (!newProduct.name) return;
    const stock = parseInt(newProduct.stock) || 0;
    const p = {
      id: 'P00' + (products.length + 1),
      name: newProduct.name,
      sku: newProduct.sku,
      category: newProduct.category,
      price: parseFloat(newProduct.price) || 0,
      cost: parseFloat(newProduct.cost) || 0,
      stock: stock,
      status: stock > 10 ? 'In Stock' : stock > 0 ? 'Low Stock' : 'Out of Stock',
      image: newProduct.image || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=100&h=100&fit=crop'
    };
    setProducts([p, ...products]);
    setShowAddModal(false);
    setNewProduct({ name: '', sku: '', category: 'Beverage', price: '', cost: '', stock: '', image: '' });
  };

  const handleDelete = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  return (
    <DashboardLayout role="OWNER">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Inventory Management</h1>
          <p className="text-slate-500">Manage your products, track stock levels, and update pricing.</p>
        </div>
        <Button 
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="w-4 h-4" /> Add Product
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
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-white">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search products by name or SKU..." 
              className="bg-transparent border-none outline-none text-sm w-full text-slate-900"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50">
              <Filter className="w-4 h-4" /> Category
            </Button>
            <Button variant="outline" className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50">
              <Filter className="w-4 h-4" /> Status
            </Button>
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
              {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())).map((product) => (
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
                    <span className="text-sm font-bold text-slate-700">{product.stock} units</span>
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
                      <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg text-blue-600 hover:bg-blue-50 bg-slate-50">
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
              <h2 className="text-xl font-bold text-slate-900">Add New Product</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200">
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
                <label className="block text-sm font-bold text-slate-700 mb-2">Product Name</label>
                <Input 
                  placeholder="e.g. Caramel Macchiato" 
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  className="bg-white border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                  <label className="block text-sm font-bold text-slate-700 mb-2">Category</label>
                  <select 
                    className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                  >
                    <option value="Beverage">Beverage</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Raw Material">Raw Material</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
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
                    className="bg-white border-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
              <Button className="flex-1 bg-white text-slate-700 border-slate-200 hover:bg-slate-100" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddProduct}>
                Save Product
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
