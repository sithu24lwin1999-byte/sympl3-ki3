import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { addDoc, collection, doc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { Search, Plus, MoreVertical, Filter, X } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Badge, Input, TableStateRow } from '@/components/ui';
import { createManagedUser, useAuth } from '@/lib/auth';
import { auth, db } from '@/lib/firebase';
import { useLiveCollection, useLiveCollectionGroup } from '@/lib/firestore';
import { addCalendarMonths, addDays, daysRemaining, renewalPeriod, subscriptionState, todayKey } from '@/lib/subscriptions';
import { formatCurrency } from '@/lib/utils';
import type { AuditLog, BusinessType, Order, Shop, SubscriptionStatus, SubscriptionTransaction } from '@/types';

const plans = [{ name: 'Basic', fee: 30000 }, { name: 'Premium', fee: 50000 }];
const blankShop = () => ({ id: doc(collection(db, 'shops')).id, name: '', businessType: 'RETAIL' as BusinessType, owner: '', ownerEmail: '', password: '', phone: '', plan: 'Basic', monthlyFee: 30000, status: 'TRIAL' as SubscriptionStatus, start: todayKey() });

export default function AdminShops() {
  const location = useLocation();
  const { user } = useAuth();
  const { data: shops, loading, error } = useLiveCollection<Shop>('shops', 'createdAt');
  const { data: transactions } = useLiveCollection<SubscriptionTransaction>('subscriptionTransactions', 'createdAt');
  const { data: orders } = useLiveCollectionGroup<Order>('orders', 'createdAt');
  const { data: auditLogs } = useLiveCollectionGroup<AuditLog>('auditLogs', 'createdAt');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [selected, setSelected] = useState<Shop | null>(null);
  const [renewing, setRenewing] = useState<Shop | null>(null);
  const [newShop, setNewShop] = useState(blankShop);
  const [renewStart, setRenewStart] = useState(todayKey());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => { if (location.state?.openCreateModal) { setShowCreate(true); window.history.replaceState({}, document.title); } }, [location.state]);
  const audit = async (action: string, detail: string) => addDoc(collection(db, 'systemAuditLogs'), { actorId: user?.id, actorName: user?.name || 'Administrator', actorRole: 'ADMIN', action, detail, createdAt: new Date().toISOString() });
  const notify = (value: string) => { setMessage(value); window.setTimeout(() => setMessage(''), 5000); };

  const createShop = async () => {
    const email = newShop.ownerEmail.trim().toLowerCase();
    if (!newShop.name.trim() || !newShop.owner.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || newShop.password.length < 8) { setFormError('Complete all required fields and use a password with at least 8 characters.'); return; }
    setSaving(true); setFormError('');
    try {
      const start = newShop.start;
      const safeExpiry = newShop.status === 'TRIAL' ? addDays(start, 14) : addCalendarMonths(start, 1);
      const ownerId = await createManagedUser({ email, password: newShop.password, name: newShop.owner.trim(), role: 'OWNER', shopId: newShop.id });
      const shop: Omit<Shop, 'id'> = { name: newShop.name.trim(), owner: newShop.owner.trim(), ownerId, ownerEmail: email, phone: newShop.phone.trim(), businessType: newShop.businessType, plan: newShop.plan, monthlyFee: newShop.monthlyFee, status: newShop.status, systemStatus: 'ACTIVE', subscriptionStart: start, expiry: safeExpiry, trialEndsAt: newShop.status === 'TRIAL' ? safeExpiry : undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await setDoc(doc(db, 'shops', newShop.id), { ...shop, expiresAt: Timestamp.fromDate(new Date(`${safeExpiry}T23:59:59Z`)) });
      await setDoc(doc(db, `shops/${newShop.id}/branches/main`), { shopId: newShop.id, name: 'Main Branch', phone: newShop.phone.trim(), active: true, createdAt: new Date().toISOString() });
      await addDoc(collection(db, 'subscriptionTransactions'), { shopId: newShop.id, shopName: newShop.name.trim(), plan: newShop.plan, type: 'INITIAL', status: 'PAID', amount: newShop.status === 'TRIAL' ? 0 : newShop.monthlyFee, currency: 'MMK', periodStart: start, periodEnd: safeExpiry, paidAt: new Date().toISOString(), createdAt: new Date().toISOString(), actorId: user?.id, actorName: user?.name });
      if (newShop.businessType === 'PHOTOBOOTH') {
        const service = { category: 'Photobooth Services', cost: 0, price: 0, stock: 0, minStock: 0, status: 'In Stock', image: '', shopId: newShop.id, itemType: 'SERVICE', trackStock: false, createdAt: new Date().toISOString() };
        await Promise.all([setDoc(doc(db, `shops/${newShop.id}/products/photobooth-service`), { ...service, name: 'Photobooth ရိုက်ကူးခြင်း', sku: 'PHOTO-SERVICE' }), setDoc(doc(db, `shops/${newShop.id}/products/costume-rental`), { ...service, name: 'ဝတ်စုံငှားခြင်း', sku: 'COSTUME-RENTAL' })]);
      }
      await audit('SHOP_CREATED', `${newShop.name} (${newShop.id})`);
      setShowCreate(false); setNewShop(blankShop()); notify('Shop, owner account and initial subscription transaction created.');
    } catch (issue) { setFormError(issue instanceof Error ? issue.message : 'Unable to create shop.'); } finally { setSaving(false); }
  };

  const setState = async (shop: Shop, status: SubscriptionStatus) => {
    if (status === 'ACTIVE' && shop.expiry < todayKey()) { setRenewing(shop); setRenewStart(todayKey()); setActiveMenu(null); return; }
    await updateDoc(doc(db, 'shops', shop.id), { status, systemStatus: status === 'SUSPENDED' ? 'STOPPED' : 'ACTIVE', updatedAt: new Date().toISOString() });
    await audit('SHOP_STATUS_CHANGED', `${shop.id}: ${status}`); setActiveMenu(null); notify(status === 'SUSPENDED' ? 'Shop stopped immediately. Historical data was retained.' : `Shop changed to ${status}.`);
  };
  const extend = async (shop: Shop, explicitStart?: string) => {
    const period = renewalPeriod(shop.expiry, todayKey(), explicitStart);
    await updateDoc(doc(db, 'shops', shop.id), { status: 'ACTIVE', systemStatus: 'ACTIVE', subscriptionStart: period.periodStart, expiry: period.periodEnd, expiresAt: Timestamp.fromDate(new Date(`${period.periodEnd}T23:59:59Z`)), updatedAt: new Date().toISOString() });
    await addDoc(collection(db, 'subscriptionTransactions'), { shopId: shop.id, shopName: shop.name, plan: shop.plan, type: explicitStart ? 'RENEWAL' : 'EXTENSION', status: 'PAID', amount: shop.monthlyFee || 0, currency: 'MMK', periodStart: period.periodStart, periodEnd: period.periodEnd, paidAt: new Date().toISOString(), createdAt: new Date().toISOString(), actorId: user?.id, actorName: user?.name });
    await audit(explicitStart ? 'SUBSCRIPTION_RENEWED' : 'SUBSCRIPTION_EXTENDED', `${shop.id}: ${period.periodStart} to ${period.periodEnd}`); setRenewing(null); setActiveMenu(null); notify(`Subscription extended through ${period.periodEnd}.`);
  };
  const archive = async (shop: Shop) => { if (!window.confirm(`Archive ${shop.name}? Access stops immediately; historical data will be retained.`)) return; await updateDoc(doc(db, 'shops', shop.id), { status: 'CANCELLED', systemStatus: 'ARCHIVED', archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); await audit('SHOP_ARCHIVED', `${shop.name} (${shop.id})`); setActiveMenu(null); notify('Shop archived. Data was retained.'); };
  const edit = async (shop: Shop) => { const name = window.prompt('Shop name', shop.name); if (!name) return; const phone = window.prompt('Contact phone', shop.phone); if (phone === null) return; await updateDoc(doc(db, 'shops', shop.id), { name: name.trim(), phone: phone.trim(), updatedAt: new Date().toISOString() }); await audit('SHOP_EDITED', shop.id); notify('Shop details updated.'); };
  const resetPassword = async (shop: Shop) => { await sendPasswordResetEmail(auth, shop.ownerEmail); await audit('OWNER_PASSWORD_RESET_SENT', `${shop.id}: ${shop.ownerEmail}`); setActiveMenu(null); notify(`Password reset email sent to ${shop.ownerEmail}.`); };
  const requestImpersonation = async (shop: Shop) => { const reason = window.prompt('Reason for audited support access (required)'); if (!reason?.trim()) return; const session = await addDoc(collection(db, 'impersonationSessions'), { adminId: user?.id, targetUserId: shop.ownerId, shopId: shop.id, reason: reason.trim(), status: 'REQUESTED', createdAt: new Date().toISOString() }); await audit('IMPERSONATION_REQUESTED', `${shop.id}; session ${session.id}; reason: ${reason.trim()}`); setActiveMenu(null); notify('Audited impersonation request recorded. No user session was opened.'); };

  const filtered = shops.filter(shop => (statusFilter === 'ALL' || subscriptionState(shop) === statusFilter) && `${shop.name} ${shop.owner} ${shop.ownerEmail} ${shop.id}`.toLowerCase().includes(search.toLowerCase()));
  const lastActivity = (shop: Shop) => orders.filter(order => order.shopId === shop.id).map(order => order.createdAt).sort().at(-1) || shop.updatedAt || shop.createdAt || '—';
  const badge = (state: SubscriptionStatus) => state === 'ACTIVE' ? 'success' : state === 'EXPIRED' || state === 'CANCELLED' ? 'danger' : 'warning';

  return <DashboardLayout role="ADMIN">
    <div className="flex justify-between items-end mb-8"><div><h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Tenant Shops</h1><p className="text-slate-500">Subscriptions, access and tenant lifecycle management.</p></div><Button className="gap-2 bg-blue-600 text-white" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Create New Shop</Button></div>
    {message && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p>}
    <Card className="p-0 overflow-visible relative"><div className="p-4 border-b flex flex-wrap gap-3 justify-between"><div className="flex items-center bg-slate-50 border rounded-xl px-3 py-2 w-96 max-w-full"><Search className="w-4 h-4 text-slate-400 mr-2"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search shop, owner, email or ID…" className="bg-transparent outline-none text-sm w-full"/></div><label className="flex items-center gap-2 border rounded-xl px-4"><Filter className="w-4 h-4"/><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-11 bg-transparent text-sm font-semibold outline-none"><option value="ALL">All statuses</option>{['TRIAL','ACTIVE','EXPIRING_SOON','EXPIRED','SUSPENDED','CANCELLED'].map(value => <option key={value}>{value}</option>)}</select></label></div>
      <div className="overflow-x-auto min-h-[360px]"><table className="w-full text-left min-w-[1500px]"><thead><tr className="bg-slate-50 border-b">{['Shop / ID / Type','Owner / Phone / Email','Plan / Fee','Start / Expiry / Days','Subscription','System','Last Activity','Actions'].map(label => <th key={label} className="px-5 py-4 text-xs font-bold text-slate-500 uppercase">{label}</th>)}</tr></thead><tbody className="divide-y"><TableStateRow columns={8} loading={loading} error={error} empty={!loading && filtered.length === 0} emptyMessage="No shops match the current filters." />{filtered.map(shop => { const state = subscriptionState(shop); return <tr key={shop.id} className="hover:bg-slate-50"><td className="px-5 py-4"><p className="font-bold">{shop.name}</p><p className="text-xs text-slate-400">{shop.id} · {shop.businessType || 'OTHER'}</p></td><td className="px-5 py-4"><p className="font-medium">{shop.owner}</p><p className="text-xs text-slate-500">{shop.phone} · {shop.ownerEmail}</p></td><td className="px-5 py-4"><p>{shop.plan}</p><p className="text-xs text-slate-400">{formatCurrency(shop.monthlyFee || 0)}/mo</p></td><td className="px-5 py-4 text-sm"><p>{shop.subscriptionStart || '—'} → {shop.expiry}</p><p className="text-xs text-slate-400">{daysRemaining(shop.expiry)} days remaining</p></td><td className="px-5 py-4"><Badge variant={badge(state)}>{state.replace('_',' ')}</Badge></td><td className="px-5 py-4 text-sm font-semibold">{shop.systemStatus || 'ACTIVE'}</td><td className="px-5 py-4 text-xs text-slate-500">{lastActivity(shop).replace('T',' ').slice(0,16)}</td><td className="px-5 py-4 text-right relative"><Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setActiveMenu(activeMenu === shop.id ? null : shop.id)}><MoreVertical className="w-4 h-4"/></Button>{activeMenu === shop.id && <div className="absolute right-8 top-10 w-56 bg-white rounded-xl shadow-xl border py-2 z-50 text-left">{[
          ['View details', () => { setSelected(shop); setActiveMenu(null); }], ['Edit shop', () => edit(shop)], ['Renew subscription', () => { setRenewing(shop); setRenewStart(shop.expiry < todayKey() ? todayKey() : shop.expiry); setActiveMenu(null); }], ['Add one month', () => extend(shop)], ['Reset owner password', () => resetPassword(shop)], ['Request impersonation', () => requestImpersonation(shop)]
        ].map(([label, action]) => <button key={label as string} onClick={action as () => void} className="block w-full px-4 py-2 text-sm hover:bg-slate-50">{label as string}</button>)}<div className="border-t my-1"/>{state === 'SUSPENDED' ? <button onClick={() => setState(shop,'ACTIVE')} className="w-full px-4 py-2 text-sm text-emerald-700 text-left">Reactivate</button> : <button onClick={() => setState(shop,'SUSPENDED')} className="w-full px-4 py-2 text-sm text-amber-700 text-left">Stop / Suspend</button>}<button onClick={() => archive(shop)} className="w-full px-4 py-2 text-sm text-red-600 text-left">Archive shop</button></div>}</td></tr>; })}</tbody></table></div><div className="p-4 border-t bg-slate-50 text-sm text-slate-500">Showing {filtered.length} of {shops.length} shops</div>
    </Card>

    {showCreate && <Modal title="Register New Shop" close={() => setShowCreate(false)}><div className="space-y-4"><ReadOnly label="Unique Shop ID" value={newShop.id}/><Field label="Shop Name"><Input value={newShop.name} onChange={e => setNewShop({...newShop,name:e.target.value})}/></Field><Field label="Business Type"><select className="control" value={newShop.businessType} onChange={e => setNewShop({...newShop,businessType:e.target.value as BusinessType})}>{['RETAIL','RESTAURANT','FASHION','BAKERY','PHOTOBOOTH','SERVICE','OTHER'].map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Owner Name"><Input value={newShop.owner} onChange={e => setNewShop({...newShop,owner:e.target.value})}/></Field><Field label="Owner Email"><Input type="email" value={newShop.ownerEmail} onChange={e => setNewShop({...newShop,ownerEmail:e.target.value})}/></Field><Field label="Temporary Password"><Input type="password" value={newShop.password} onChange={e => setNewShop({...newShop,password:e.target.value})}/></Field><Field label="Phone"><Input value={newShop.phone} onChange={e => setNewShop({...newShop,phone:e.target.value})}/></Field><Field label="Plan"><select className="control" value={newShop.plan} onChange={e => { const plan=plans.find(x=>x.name===e.target.value)!; setNewShop({...newShop,plan:plan.name,monthlyFee:plan.fee}); }}>{plans.map(x=><option key={x.name}>{x.name}</option>)}</select></Field><Field label="Initial State"><select className="control" value={newShop.status} onChange={e=>setNewShop({...newShop,status:e.target.value as SubscriptionStatus})}><option value="TRIAL">Trial (14 days)</option><option value="ACTIVE">Active (1 month)</option></select></Field><Field label="Subscription Start"><Input type="date" value={newShop.start} onChange={e=>setNewShop({...newShop,start:e.target.value})}/></Field>{formError&&<p className="text-sm text-red-600">{formError}</p>}<div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={()=>setShowCreate(false)}>Cancel</Button><Button className="flex-1 bg-blue-600 text-white" disabled={saving} onClick={createShop}>{saving?'Creating…':'Create Shop'}</Button></div></div></Modal>}
    {renewing && <Modal title="Renew Subscription" close={()=>setRenewing(null)}><p className="text-sm text-slate-500 mb-4">If the subscription has expired, renewal starts today unless you explicitly choose another date.</p><Field label="Renewal Start Date"><Input type="date" value={renewStart} onChange={e=>setRenewStart(e.target.value)}/></Field><ReadOnly label="New Expiry" value={addCalendarMonths(renewStart,1)}/><ReadOnly label="Amount" value={formatCurrency(renewing.monthlyFee||0)}/><Button className="w-full mt-5 bg-blue-600 text-white" onClick={()=>extend(renewing,renewStart)}>Record Payment & Renew</Button></Modal>}
    {selected && <Modal title={selected.name} close={()=>setSelected(null)}><div className="grid grid-cols-2 gap-3"><ReadOnly label="Shop ID" value={selected.id}/><ReadOnly label="Business Type" value={selected.businessType||'OTHER'}/><ReadOnly label="Owner" value={selected.owner}/><ReadOnly label="Email" value={selected.ownerEmail}/><ReadOnly label="Subscription" value={subscriptionState(selected)}/><ReadOnly label="Expiry" value={selected.expiry}/></div><h3 className="font-bold mt-6 mb-2">Payment History</h3><div className="max-h-36 overflow-auto space-y-2">{transactions.filter(x=>x.shopId===selected.id).map(x=><div key={x.id} className="flex justify-between text-sm border-b pb-2"><span>{x.type} · {x.periodEnd}</span><span>{formatCurrency(x.amount)} · {x.status}</span></div>)}{!transactions.some(x=>x.shopId===selected.id)&&<p className="text-sm text-slate-400">No payments recorded.</p>}</div><h3 className="font-bold mt-6 mb-2">Activity Logs</h3><div className="max-h-36 overflow-auto space-y-2">{auditLogs.filter(x=>x.shopId===selected.id).slice(0,10).map(x=><div key={x.id} className="text-sm border-b pb-2"><p className="font-medium">{x.action}</p><p className="text-xs text-slate-400">{x.detail}</p></div>)}{!auditLogs.some(x=>x.shopId===selected.id)&&<p className="text-sm text-slate-400">No tenant activity recorded.</p>}</div></Modal>}
  </DashboardLayout>;
}

function Modal({ title, close, children }: { title: string; close(): void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] overflow-auto shadow-2xl"><div className="sticky top-0 p-5 bg-slate-50 border-b flex justify-between z-10"><h2 className="text-xl font-bold">{title}</h2><button onClick={close}><X className="w-5 h-5"/></button></div><div className="p-6">{children}</div></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="block text-sm font-bold text-slate-700 mb-2">{label}</span>{children}</label>; }
function ReadOnly({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] uppercase font-bold text-slate-400">{label}</p><p className="text-sm font-semibold break-all">{value}</p></div>; }
