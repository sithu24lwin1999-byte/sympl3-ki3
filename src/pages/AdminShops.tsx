import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Badge, Input } from '@/components/ui';
import { Search, Plus, MoreVertical, Filter, X, CheckCircle2 } from 'lucide-react';
import { createManagedUser } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { deleteRecord, updateRecord, useLiveCollection } from '@/lib/firestore';
import { collection, doc, setDoc } from 'firebase/firestore';
import type { BusinessType, Shop } from '@/types';

export default function AdminShops() {
  const location = useLocation();
  const { data: shops, loading, error } = useLiveCollection<Shop>('shops', 'createdAt');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.openCreateModal) {
      setShowCreateModal(true);
      // Clear the state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title)
    }
  }, [location.state]);

  const [newShop, setNewShop] = useState({ name: '', businessType: 'RETAIL' as BusinessType, owner: '', ownerEmail: '', password: '', phone: '', plan: '30000 MMK' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleCreateShop = async () => {
    const cleaned = {
      ...newShop,
      name: newShop.name.trim(), owner: newShop.owner.trim(), ownerEmail: newShop.ownerEmail.trim().toLowerCase(), phone: newShop.phone.trim(),
    };
    if (!cleaned.name) { setFormError('Shop name is required.'); return; }
    if (!cleaned.owner) { setFormError('Owner name is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.ownerEmail)) { setFormError('Enter a valid owner email address.'); return; }
    if (cleaned.password.length < 8) { setFormError('Temporary password must contain at least 8 characters.'); return; }
    setSaving(true); setFormError('');
    try {
      const shopRef = doc(collection(db, 'shops'));
      const ownerId = await createManagedUser({ email: cleaned.ownerEmail, password: cleaned.password, name: cleaned.owner, role: 'OWNER', shopId: shopRef.id });
      const { password: _password, ...shopData } = cleaned;
      await setDoc(shopRef, { ...shopData, ownerId, ownerEmail: cleaned.ownerEmail, status: 'ACTIVE', expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10), createdAt: new Date().toISOString() });
      await setDoc(doc(db, `shops/${shopRef.id}/branches/main`), { shopId: shopRef.id, name: 'Main Branch', phone: cleaned.phone, active: true, createdAt: new Date().toISOString() });
      if (cleaned.businessType === 'PHOTOBOOTH') {
        const service = { category: 'Photobooth Services', cost: 0, price: 0, stock: 0, minStock: 0, status: 'In Stock', image: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=400&h=300&fit=crop', shopId: shopRef.id, itemType: 'SERVICE', trackStock: false, createdAt: new Date().toISOString() };
        await Promise.all([
          setDoc(doc(db, `shops/${shopRef.id}/products/photobooth-service`), { ...service, name: 'Photobooth ရိုက်ကူးခြင်း', sku: 'PHOTO-SERVICE', barcode: '' }),
          setDoc(doc(db, `shops/${shopRef.id}/products/costume-rental`), { ...service, name: 'ဝတ်စုံငှားခြင်း', sku: 'COSTUME-RENTAL', barcode: '' }),
        ]);
      }
      setShowCreateModal(false);
      setNewShop({ name: '', businessType: 'RETAIL', owner: '', ownerEmail: '', password: '', phone: '', plan: '30000 MMK' });
    } catch (issue) { setFormError(issue instanceof Error ? issue.message : 'Unable to create shop.'); }
    finally { setSaving(false); }
  };

  const changeStatus = async (id: string, newStatus: string) => {
    await updateRecord('shops', id, { status: newStatus });
    setActiveMenu(null);
  };

  const deleteShop = async (id: string) => {
    if (!window.confirm('Delete this shop?')) return;
    await deleteRecord('shops', id);
    setActiveMenu(null);
  };

  const filteredShops = shops.filter(s =>
    (statusFilter === 'ALL' || s.status === statusFilter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.owner.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <DashboardLayout role="ADMIN">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Tenant Shops</h1>
          <p className="text-slate-500">Manage all registered shops on the KI3 POS platform.</p>
        </div>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" /> Create New Shop
        </Button>
      </div>

      <Card className="p-0 overflow-visible flex flex-col z-10 relative">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white rounded-t-3xl">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-80">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search shops by name or owner..." 
              className="bg-transparent border-none outline-none text-sm w-full text-slate-900"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 border-2 border-slate-200 rounded-2xl px-4 text-slate-600 bg-white">
            <Filter className="w-4 h-4" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-11 bg-transparent text-sm font-semibold outline-none">
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </label>
        </div>

        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Shop Details</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Owner Contact</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Expiry Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {!loading && filteredShops.map((shop) => (
                <tr key={shop.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm border border-slate-200">
                        {shop.name.charAt(0)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-slate-900">{shop.name}</div>
                        <div className="text-xs text-slate-400">ID: {shop.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{shop.owner}</div>
                    <div className="text-xs text-slate-500">{shop.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-700">{shop.plan}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge 
                      variant={shop.status === 'ACTIVE' ? 'success' : shop.status === 'EXPIRED' ? 'danger' : 'warning'}
                      className={
                        shop.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 
                        shop.status === 'EXPIRED' ? 'bg-red-50 text-red-600' : 
                        'bg-amber-50 text-amber-600'
                      }
                    >
                      {shop.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {shop.expiry}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                    <Button 
                      variant="ghost" 
                      className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      onClick={() => setActiveMenu(activeMenu === shop.id ? null : shop.id)}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                    
                    {activeMenu === shop.id && (
                      <div className="absolute right-8 top-10 w-40 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50 text-left flex flex-col">
                        <button onClick={() => changeStatus(shop.id, 'ACTIVE')} className="block w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">Set Active</button>
                        <button onClick={() => changeStatus(shop.id, 'SUSPENDED')} className="block w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">Suspend</button>
                        <button onClick={() => changeStatus(shop.id, 'EXPIRED')} className="block w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">Set Expired</button>
                        <div className="h-px bg-slate-100 my-1 w-full"></div>
                        <button onClick={() => deleteShop(shop.id)} className="block w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left font-medium">Delete Shop</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-sm text-slate-500">
          <div>Showing 1 to {filteredShops.length} of {shops.length} entries</div>
          <div className="flex gap-1">
            <Button variant="outline" className="h-8 px-3 text-xs bg-white border-slate-200" disabled>Previous</Button>
            <Button variant="outline" className="h-8 px-3 text-xs bg-blue-50 text-blue-600 border-blue-200">1</Button>
            <Button variant="outline" className="h-8 px-3 text-xs bg-white border-slate-200" disabled>Next</Button>
          </div>
        </div>
      </Card>

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 bg-slate-50 flex justify-between items-center border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Register New Shop</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Shop Name</label>
                <Input 
                  placeholder="e.g. City Mart" 
                  value={newShop.name}
                  onChange={(e) => setNewShop({...newShop, name: e.target.value})}
                  className="bg-white border-slate-200"
                />
              </div>
              <div><label className="block text-sm font-bold text-slate-700 mb-2">Business Type</label><select value={newShop.businessType} onChange={e => setNewShop({ ...newShop, businessType: e.target.value as BusinessType })} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4"><option value="RETAIL">General Retail</option><option value="RESTAURANT">Restaurant / Café</option><option value="FASHION">Fashion & Clothing</option><option value="BAKERY">Bakery</option><option value="PHOTOBOOTH">Photobooth & Costume Rental</option><option value="SERVICE">Service Business</option><option value="OTHER">Other</option></select></div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Owner Email</label>
                <Input type="email" value={newShop.ownerEmail} onChange={(e) => setNewShop({...newShop, ownerEmail: e.target.value})} className="bg-white border-slate-200" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Temporary Password</label>
                <Input type="password" minLength={8} value={newShop.password} onChange={(e) => setNewShop({...newShop, password: e.target.value})} className="bg-white border-slate-200" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Owner Name</label>
                <Input 
                  placeholder="Owner's full name" 
                  value={newShop.owner}
                  onChange={(e) => setNewShop({...newShop, owner: e.target.value})}
                  className="bg-white border-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Contact Phone</label>
                <Input 
                  placeholder="e.g. 09..." 
                  value={newShop.phone}
                  onChange={(e) => setNewShop({...newShop, phone: e.target.value})}
                  className="bg-white border-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Subscription Plan</label>
                <select 
                  className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  value={newShop.plan}
                  onChange={(e) => setNewShop({...newShop, plan: e.target.value})}
                >
                  <option value="30000 MMK">Basic (30,000 MMK)</option>
                  <option value="50000 MMK">Premium (50,000 MMK)</option>
                </select>
              </div>
            </div>

            {formError && <p className="px-6 pb-3 text-sm text-red-600">{formError}</p>}

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
              <Button className="flex-1 bg-white text-slate-700 border-slate-200 hover:bg-slate-100" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreateShop} disabled={saving || !newShop.name.trim() || !newShop.owner.trim() || !newShop.ownerEmail.trim() || newShop.password.length < 8}>
                {saving ? 'Creating…' : 'Create Shop'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
