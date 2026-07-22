import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { Save, Store, Receipt, WalletCards, Plus, Trash2, Loader2, CheckCircle2, Building2 } from 'lucide-react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { createRecord, deleteRecord, useLiveCollection, useLiveDocument } from '@/lib/firestore';
import type { BusinessType, PaymentAccount, PaymentKind, Shop, ShopSettings } from '@/types';

const defaults: ShopSettings = { businessType: 'RETAIL', taxRate: 5, serviceCharge: 0, invoicePrefix: 'KI3', loyaltyPointsPer1000: 10 };

export default function OwnerSettings() {
  const { user } = useAuth();
  const shopId = user?.shopId || '';
  const shop = useLiveDocument<Shop>(shopId ? `shops/${shopId}` : null);
  const savedSettings = useLiveDocument<ShopSettings>(shopId ? `shops/${shopId}/settings/general` : null);
  const { data: accounts } = useLiveCollection<PaymentAccount>(shopId ? `shops/${shopId}/paymentAccounts` : null, 'createdAt');
  const [activeTab, setActiveTab] = useState<'Profile' | 'Receipt' | 'Payments'>('Profile');
  const [settings, setSettings] = useState<ShopSettings>(defaults);
  const [profile, setProfile] = useState({ name: '', phone: '', address: '' });
  const [account, setAccount] = useState({ kind: 'KPAY' as Exclude<PaymentKind, 'CASH'>, label: '', accountName: '', accountNumber: '', bankName: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (savedSettings) setSettings({ ...defaults, ...savedSettings }); }, [savedSettings]);
  useEffect(() => { if (shop) setProfile({ name: shop.name || '', phone: shop.phone || '', address: shop.address || '' }); }, [shop]);

  const save = async () => {
    if (!shopId) return;
    setSaving(true);
    await setDoc(doc(db, `shops/${shopId}/settings/general`), { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
    await updateDoc(doc(db, 'shops', shopId), { ...profile, businessType: settings.businessType, updatedAt: new Date().toISOString() });
    await createRecord(`shops/${shopId}/auditLogs`, { shopId, actorId: user!.id, actorName: user!.name, action: 'SETTINGS_UPDATED', detail: activeTab, createdAt: new Date().toISOString() });
    setSaving(false); setSaved(true); window.setTimeout(() => setSaved(false), 1800);
  };

  const addAccount = async () => {
    if (!shopId || !account.label.trim() || !account.accountNumber.trim()) return;
    await createRecord(`shops/${shopId}/paymentAccounts`, { ...account, shopId, active: true, createdAt: new Date().toISOString() });
    await createRecord(`shops/${shopId}/auditLogs`, { shopId, actorId: user!.id, actorName: user!.name, action: 'PAYMENT_ACCOUNT_CREATED', detail: account.label, createdAt: new Date().toISOString() });
    setAccount({ kind: 'KPAY', label: '', accountName: '', accountNumber: '', bankName: '' });
  };

  return <DashboardLayout role="OWNER">
    <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
      <div><h1 className="text-3xl font-bold tracking-tight mb-2">Shop Settings</h1><p className="text-slate-500">Configure your business, receipts and payment accounts.</p></div>
      <Button onClick={save} disabled={saving} className="gap-2 bg-blue-600 text-white">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}{saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
      </Button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="space-y-2">
        <Tab icon={Store} label="Shop Profile" active={activeTab === 'Profile'} onClick={() => setActiveTab('Profile')} />
        <Tab icon={Receipt} label="Receipt & Taxes" active={activeTab === 'Receipt'} onClick={() => setActiveTab('Receipt')} />
        <Tab icon={WalletCards} label="Payment Accounts" active={activeTab === 'Payments'} onClick={() => setActiveTab('Payments')} />
      </div>
      <div className="md:col-span-3">
        {activeTab === 'Profile' && <Card className="p-6 space-y-5">
          <h3 className="font-bold text-lg">Business Profile</h3>
          <div><label className="text-sm font-bold">Business type</label><select value={settings.businessType} onChange={e => setSettings({ ...settings, businessType: e.target.value as BusinessType })} className="mt-2 flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4">
            <option value="RESTAURANT">Restaurant / Café</option><option value="RETAIL">General Retail</option><option value="FASHION">Fashion & Clothing</option><option value="BAKERY">Bakery</option><option value="SERVICE">Customer Service / Service Business</option><option value="OTHER">Other</option>
          </select></div>
          <div><label className="text-sm font-bold">Shop name</label><Input className="mt-2" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></div>
          <div className="grid md:grid-cols-2 gap-4"><div><label className="text-sm font-bold">Phone</label><Input className="mt-2" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></div><div><label className="text-sm font-bold">Owner email</label><Input className="mt-2" value={shop?.ownerEmail || ''} disabled /></div></div>
          <div><label className="text-sm font-bold">Address</label><Input className="mt-2" value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} /></div>
        </Card>}
        {activeTab === 'Receipt' && <Card className="p-6 space-y-5">
          <h3 className="font-bold text-lg">Receipt, Tax & Loyalty</h3>
          <div className="grid md:grid-cols-2 gap-4"><NumberField label="Commercial tax %" value={settings.taxRate} onChange={taxRate => setSettings({ ...settings, taxRate })} /><NumberField label="Service charge %" value={settings.serviceCharge} onChange={serviceCharge => setSettings({ ...settings, serviceCharge })} /></div>
          <div><label className="text-sm font-bold">Invoice prefix</label><Input className="mt-2" value={settings.invoicePrefix} onChange={e => setSettings({ ...settings, invoicePrefix: e.target.value.toUpperCase().slice(0, 8) })} /></div>
          <NumberField label="Loyalty points per 1,000 MMK" value={settings.loyaltyPointsPer1000} onChange={loyaltyPointsPer1000 => setSettings({ ...settings, loyaltyPointsPer1000 })} />
        </Card>}
        {activeTab === 'Payments' && <div className="space-y-5">
          <Card className="p-6"><div className="flex items-center gap-3 mb-4"><Building2 className="text-blue-600" /><div><h3 className="font-bold text-lg">KPay, Wave & Bank Accounts</h3><p className="text-sm text-slate-500">Employees see active account details when taking payment. This records payments; it does not transfer money automatically.</p></div></div>
            <div className="grid md:grid-cols-2 gap-3">
              <select value={account.kind} onChange={e => setAccount({ ...account, kind: e.target.value as Exclude<PaymentKind, 'CASH'> })} className="h-12 rounded-2xl border border-slate-200 bg-white px-4"><option value="KPAY">KBZPay / KPay</option><option value="WAVE">Wave Money</option><option value="BANK">Bank Transfer</option></select>
              <Input placeholder="Display label (e.g. Main KPay)" value={account.label} onChange={e => setAccount({ ...account, label: e.target.value })} />
              <Input placeholder="Account holder name" value={account.accountName} onChange={e => setAccount({ ...account, accountName: e.target.value })} />
              <Input placeholder="Account / phone number" value={account.accountNumber} onChange={e => setAccount({ ...account, accountNumber: e.target.value })} />
              {account.kind === 'BANK' && <Input placeholder="Bank name" value={account.bankName} onChange={e => setAccount({ ...account, bankName: e.target.value })} />}
              <Button onClick={addAccount} disabled={!account.label.trim() || !account.accountNumber.trim()} className="gap-2"><Plus className="w-4 h-4" />Add Payment Account</Button>
            </div>
          </Card>
          <div className="grid md:grid-cols-2 gap-4">{accounts.map(item => <Card key={item.id} className="p-5"><div className="flex justify-between gap-3"><div><Badge>{item.kind}</Badge><h4 className="font-bold mt-2">{item.label}</h4><p className="text-sm text-slate-500">{item.bankName ? `${item.bankName} • ` : ''}{item.accountName}</p><p className="mt-2 font-mono font-bold text-blue-700">{item.accountNumber}</p></div><button aria-label={`Delete ${item.label}`} onClick={() => window.confirm('Delete this payment account?') && deleteRecord(`shops/${shopId}/paymentAccounts`, item.id)} className="text-red-500"><Trash2 className="w-5 h-5" /></button></div></Card>)}</div>
        </div>}
      </div>
    </div>
  </DashboardLayout>;
}

function Tab({ icon: Icon, label, active, onClick }: { icon: typeof Store; label: string; active: boolean; onClick(): void }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${active ? 'bg-white shadow-sm border text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}><Icon className="w-5 h-5" />{label}</button>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) {
  return <div><label className="text-sm font-bold">{label}</label><Input className="mt-2" type="number" min="0" value={value} onChange={e => onChange(Math.max(0, Number(e.target.value)))} /></div>;
}
