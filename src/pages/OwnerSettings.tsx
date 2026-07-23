import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Input, Badge, DataState } from '@/components/ui';
import { Save, Store, Receipt, WalletCards, Plus, Trash2, Loader2, CheckCircle2, Building2, ImagePlus, X } from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { createRecord, deleteRecord, setRecord, useLiveCollection, useLiveDocumentState } from '@/lib/firestore';
import type { BusinessType, PaymentAccount, PaymentKind, Shop, ShopSettings } from '@/types';

const defaults: ShopSettings = {
  businessType: 'RETAIL', taxRate: 5, serviceCharge: 0, invoicePrefix: 'KI3', loyaltyPointsPer1000: 10, allowNegativeStock: false,
  receipt: { header: '', footer: 'Thank you for shopping with us.', showLogo: true, showTax: true, paperWidth: '80mm' },
  printer: { mode: 'BROWSER', copies: 1, autoPrint: false, cashDrawer: false },
};

export default function OwnerSettings() {
  const { user } = useAuth();
  const shopId = user?.shopId || '';
  const { data: shop, loading: shopLoading, error: shopError } = useLiveDocumentState<Shop>(shopId ? `shops/${shopId}` : null);
  const { data: savedSettings, loading: settingsLoading, error: settingsError } = useLiveDocumentState<ShopSettings>(shopId ? `shops/${shopId}/settings/general` : null);
  const { data: accounts, loading: accountsLoading, error: accountsError } = useLiveCollection<PaymentAccount>(shopId ? `shops/${shopId}/paymentAccounts` : null, 'createdAt');
  const [activeTab, setActiveTab] = useState<'Profile' | 'Receipt' | 'Payments'>('Profile');
  const [settings, setSettings] = useState<ShopSettings>(defaults);
  const [profile, setProfile] = useState({ name: '', phone: '', address: '' });
  const [account, setAccount] = useState({ kind: 'KPAY' as Exclude<PaymentKind, 'CASH'>, label: '', accountName: '', accountNumber: '', bankName: '', qrCode: '' });
  const [qrError, setQrError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const dataLoading = shopLoading || settingsLoading || accountsLoading;
  const dataError = shopError || settingsError || accountsError;

  useEffect(() => { if (savedSettings) setSettings({ ...defaults, ...savedSettings, receipt: { ...defaults.receipt!, ...savedSettings.receipt }, printer: { ...defaults.printer!, ...savedSettings.printer } }); }, [savedSettings]);
  useEffect(() => { if (shop) setProfile({ name: shop.name || '', phone: shop.phone || '', address: shop.address || '' }); }, [shop]);

  const save = async () => {
    if (!shopId) return;
    setSaving(true); setSaveError('');
    try {
      await setDoc(doc(db, `shops/${shopId}/settings/general`), { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
      await updateDoc(doc(db, 'shops', shopId), { ...profile, businessType: settings.businessType, updatedAt: new Date().toISOString() });
      if (settings.businessType === 'PHOTOBOOTH') {
        const base = { category: 'Photobooth Services', cost: 0, price: 0, stock: 0, minStock: 0, status: 'In Stock', image: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=400&h=300&fit=crop', shopId, itemType: 'SERVICE', trackStock: false, updatedAt: new Date().toISOString() };
        const [photo, costume] = await Promise.all([getDoc(doc(db, `shops/${shopId}/products/photobooth-service`)), getDoc(doc(db, `shops/${shopId}/products/costume-rental`))]);
        await Promise.all([
          photo.exists() ? Promise.resolve() : setRecord(`shops/${shopId}/products`, 'photobooth-service', { ...base, name: 'Photobooth ရိုက်ကူးခြင်း', sku: 'PHOTO-SERVICE', barcode: '' }),
          costume.exists() ? Promise.resolve() : setRecord(`shops/${shopId}/products`, 'costume-rental', { ...base, name: 'ဝတ်စုံငှားခြင်း', sku: 'COSTUME-RENTAL', barcode: '' }),
        ]);
      }
      await createRecord(`shops/${shopId}/auditLogs`, { shopId, actorId: user!.id, actorName: user!.name, action: 'SETTINGS_UPDATED', detail: activeTab, createdAt: new Date().toISOString() });
      setSaved(true); window.setTimeout(() => setSaved(false), 1800);
    } catch (issue) { setSaveError(issue instanceof Error ? issue.message : 'Unable to save shop settings.'); }
    finally { setSaving(false); }
  };

  const addAccount = async () => {
    if (!shopId || !account.label.trim() || !account.accountNumber.trim()) return;
    setSaveError('');
    try {
      await createRecord(`shops/${shopId}/paymentAccounts`, { ...account, shopId, active: true, createdAt: new Date().toISOString() });
      await createRecord(`shops/${shopId}/auditLogs`, { shopId, actorId: user!.id, actorName: user!.name, action: 'PAYMENT_ACCOUNT_CREATED', detail: account.label, createdAt: new Date().toISOString() });
      setAccount({ kind: 'KPAY', label: '', accountName: '', accountNumber: '', bankName: '', qrCode: '' });
    } catch (issue) { setSaveError(issue instanceof Error ? issue.message : 'Unable to add this payment account.'); }
  };

  const chooseQr = async (file?: File) => {
    if (!file) return;
    setQrError('');
    try {
      const qrCode = await prepareQrCode(file);
      setAccount(current => ({ ...current, qrCode }));
    }
    catch (issue) { setQrError(issue instanceof Error ? issue.message : 'Unable to read QR image.'); }
  };

  const updateAccountQr = async (item: PaymentAccount, file?: File) => {
    if (!file || !shopId) return;
    setQrError('');
    try {
      const qrCode = await prepareQrCode(file);
      await updateDoc(doc(db, `shops/${shopId}/paymentAccounts/${item.id}`), { qrCode, updatedAt: new Date().toISOString() });
    } catch (issue) { setQrError(issue instanceof Error ? issue.message : 'Unable to save QR image.'); }
  };

  return <DashboardLayout role="OWNER">
    <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
      <div><h1 className="text-3xl font-bold tracking-tight mb-2">Shop Settings</h1><p className="text-slate-500">Configure your business, receipts and payment accounts.</p></div>
      <Button onClick={save} disabled={saving} className="gap-2 bg-blue-600 text-white">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}{saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
      </Button>
    </div>
    <DataState loading={dataLoading} error={dataError} />
    {saveError && <p role="alert" className="mb-4 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{saveError}</p>}
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
            <option value="RESTAURANT">Restaurant / Café</option><option value="RETAIL">General Retail</option><option value="FASHION">Fashion & Clothing</option><option value="BAKERY">Bakery</option><option value="PHOTOBOOTH">Photobooth & Costume Rental</option><option value="SERVICE">Customer Service / Service Business</option><option value="OTHER">Other</option>
          </select></div>
          <div><label className="text-sm font-bold">Shop name</label><Input className="mt-2" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></div>
          <div className="grid md:grid-cols-2 gap-4"><div><label className="text-sm font-bold">Phone</label><Input className="mt-2" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></div><div><label className="text-sm font-bold">Owner email</label><Input className="mt-2" value={shop?.ownerEmail || ''} disabled /></div></div>
          <div><label className="text-sm font-bold">Address</label><Input className="mt-2" value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} /></div>
        </Card>}
        {activeTab === 'Receipt' && <Card className="p-6 space-y-5">
          <h3 className="font-bold text-lg">Receipt, Tax & Loyalty</h3>
          <div className="grid md:grid-cols-2 gap-4"><NumberField label="Commercial tax %" value={settings.taxRate} onChange={taxRate => setSettings({ ...settings, taxRate })} /><NumberField label="Service charge %" value={settings.serviceCharge} onChange={serviceCharge => setSettings({ ...settings, serviceCharge })} /></div>
          <label className="flex items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><span><span className="block font-bold text-amber-900">Allow negative stock at checkout</span><span className="mt-1 block text-sm text-amber-700">Employees may sell beyond available stock. Every deduction remains traceable in stock history.</span></span><input type="checkbox" checked={settings.allowNegativeStock} onChange={event => setSettings({ ...settings, allowNegativeStock: event.target.checked })} className="mt-1 h-5 w-5 accent-blue-600" /></label>
          <div><label className="text-sm font-bold">Invoice prefix</label><Input className="mt-2" value={settings.invoicePrefix} onChange={e => setSettings({ ...settings, invoicePrefix: e.target.value.toUpperCase().slice(0, 8) })} /></div>
          <NumberField label="Loyalty points per 1,000 MMK" value={settings.loyaltyPointsPer1000} onChange={loyaltyPointsPer1000 => setSettings({ ...settings, loyaltyPointsPer1000 })} />
          <div className="border-t pt-5"><h4 className="font-bold">Receipt Template</h4><div className="mt-3 grid gap-4 md:grid-cols-2"><div><label className="text-sm font-bold">Header text</label><Input className="mt-2" value={settings.receipt?.header || ''} onChange={event=>setSettings({...settings,receipt:{...settings.receipt!,header:event.target.value}})}/></div><div><label className="text-sm font-bold">Footer text</label><Input className="mt-2" value={settings.receipt?.footer || ''} onChange={event=>setSettings({...settings,receipt:{...settings.receipt!,footer:event.target.value}})}/></div><div><label className="text-sm font-bold">Paper width</label><select className="control mt-2 w-full" value={settings.receipt?.paperWidth||'80mm'} onChange={event=>setSettings({...settings,receipt:{...settings.receipt!,paperWidth:event.target.value as '58mm'|'80mm'}})}><option value="58mm">58 mm</option><option value="80mm">80 mm</option></select></div><div className="flex items-end gap-5 pb-3"><label className="text-sm font-bold"><input type="checkbox" className="mr-2" checked={settings.receipt?.showLogo!==false} onChange={event=>setSettings({...settings,receipt:{...settings.receipt!,showLogo:event.target.checked}})}/>Show logo</label><label className="text-sm font-bold"><input type="checkbox" className="mr-2" checked={settings.receipt?.showTax!==false} onChange={event=>setSettings({...settings,receipt:{...settings.receipt!,showTax:event.target.checked}})}/>Show tax</label></div></div></div>
          <div className="border-t pt-5"><h4 className="font-bold">Printer Settings</h4><div className="mt-3 grid gap-4 md:grid-cols-2"><div><label className="text-sm font-bold">Print mode</label><select className="control mt-2 w-full" value={settings.printer?.mode||'BROWSER'} onChange={event=>setSettings({...settings,printer:{...settings.printer!,mode:event.target.value as 'BROWSER'|'SYSTEM'}})}><option value="BROWSER">Browser print dialog</option><option value="SYSTEM">System printer</option></select></div><NumberField label="Receipt copies" value={settings.printer?.copies||1} onChange={copies=>setSettings({...settings,printer:{...settings.printer!,copies:Math.max(1,Math.min(5,copies))}})}/><label className="text-sm font-bold"><input type="checkbox" className="mr-2" checked={settings.printer?.autoPrint||false} onChange={event=>setSettings({...settings,printer:{...settings.printer!,autoPrint:event.target.checked}})}/>Auto-print after sale</label><label className="text-sm font-bold"><input type="checkbox" className="mr-2" checked={settings.printer?.cashDrawer||false} onChange={event=>setSettings({...settings,printer:{...settings.printer!,cashDrawer:event.target.checked}})}/>Cash drawer integration ready</label></div></div>
        </Card>}
        {activeTab === 'Payments' && <div className="space-y-5">
          <Card className="p-6"><div className="flex items-center gap-3 mb-4"><Building2 className="text-blue-600" /><div><h3 className="font-bold text-lg">KPay, Wave & Bank Accounts</h3><p className="text-sm text-slate-500">Employees see active account details when taking payment. This records payments; it does not transfer money automatically.</p></div></div>
            <div className="grid md:grid-cols-2 gap-3">
              <select value={account.kind} onChange={e => setAccount({ ...account, kind: e.target.value as Exclude<PaymentKind, 'CASH'>, qrCode: ['BANK', 'CARD'].includes(e.target.value) ? '' : account.qrCode })} className="h-12 rounded-2xl border border-slate-200 bg-white px-4"><option value="KPAY">KBZPay / KPay</option><option value="WAVE">WavePay</option><option value="AYAPAY">AYA Pay</option><option value="CBPAY">CB Pay</option><option value="BANK">Bank Transfer</option><option value="CARD">Card Terminal</option></select>
              <Input placeholder="Display label (e.g. Main KPay)" value={account.label} onChange={e => setAccount({ ...account, label: e.target.value })} />
              <Input placeholder="Account holder name" value={account.accountName} onChange={e => setAccount({ ...account, accountName: e.target.value })} />
              <Input placeholder="Account / phone number" value={account.accountNumber} onChange={e => setAccount({ ...account, accountNumber: e.target.value })} />
              {['BANK', 'CARD'].includes(account.kind) && <Input placeholder="Bank / terminal name" value={account.bankName} onChange={e => setAccount({ ...account, bankName: e.target.value })} />}
              {!['BANK', 'CARD'].includes(account.kind) && <div className="rounded-2xl border border-dashed border-blue-300 bg-blue-50 p-3">
                <label className="flex cursor-pointer items-center justify-center gap-2 text-sm font-bold text-blue-700"><ImagePlus className="h-5 w-5" />{account.qrCode ? 'Change QR Code' : 'Upload QR Code'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => { void chooseQr(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
                {account.qrCode && <div className="relative mx-auto mt-3 w-fit"><img src={account.qrCode} alt="Payment QR preview" className="h-36 w-36 rounded-xl border bg-white object-contain p-2" /><button aria-label="Remove QR" onClick={() => setAccount({ ...account, qrCode: '' })} className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white"><X className="h-4 w-4" /></button></div>}
              </div>}
              <Button onClick={addAccount} disabled={!account.label.trim() || !account.accountNumber.trim()} className="gap-2"><Plus className="w-4 h-4" />Add Payment Account</Button>
            </div>
            {qrError && <p className="mt-3 text-sm font-medium text-red-600">{qrError}</p>}
          </Card>
          <div className="grid md:grid-cols-2 gap-4">{accounts.map(item => <Card key={item.id} className="p-5"><div className="flex justify-between gap-3"><div className="min-w-0"><Badge>{item.kind}</Badge><h4 className="font-bold mt-2">{item.label}</h4><p className="text-sm text-slate-500">{item.bankName ? `${item.bankName} • ` : ''}{item.accountName}</p><p className="mt-2 font-mono font-bold text-blue-700">{item.accountNumber}</p>{item.qrCode && <img src={item.qrCode} alt={`${item.label} QR Code`} className="mt-3 h-32 w-32 rounded-xl border bg-white object-contain p-2" />}{!['BANK', 'CARD'].includes(item.kind) && <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700"><ImagePlus className="h-4 w-4" />{item.qrCode ? 'Change QR' : 'Add QR'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => { void updateAccountQr(item, event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>}</div><button aria-label={`Delete ${item.label}`} onClick={() => window.confirm('Delete this payment account?') && deleteRecord(`shops/${shopId}/paymentAccounts`, item.id)} className="self-start text-red-500"><Trash2 className="w-5 h-5" /></button></div></Card>)}</div>
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

function prepareQrCode(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('Choose a PNG, JPG or WebP image.'));
  if (file.size > 8 * 1024 * 1024) return Promise.reject(new Error('QR image must be smaller than 8 MB.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read QR image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Invalid QR image.'));
      image.onload = () => {
        const scale = Math.min(1, 900 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const value = canvas.toDataURL('image/webp', 0.9);
        if (value.length > 700_000) reject(new Error('QR image is still too large. Crop it and try again.'));
        else resolve(value);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
