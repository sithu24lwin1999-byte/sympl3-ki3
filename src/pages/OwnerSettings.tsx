import React, { useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Input } from '@/components/ui';
import { Save, Store, Receipt, Printer, Users, Loader2, CheckCircle2 } from 'lucide-react';

export default function OwnerSettings() {
  const [activeTab, setActiveTab] = useState('Shop Profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  };

  return (
    <DashboardLayout role="OWNER">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Shop Settings</h1>
          <p className="text-slate-500">Manage your shop details, receipts, and configurations.</p>
        </div>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-2">
          <SettingTab icon={Store} label="Shop Profile" active={activeTab === 'Shop Profile'} onClick={() => setActiveTab('Shop Profile')} />
          <SettingTab icon={Receipt} label="Receipt & Taxes" active={activeTab === 'Receipt & Taxes'} onClick={() => setActiveTab('Receipt & Taxes')} />
          <SettingTab icon={Printer} label="Printers & Devices" active={activeTab === 'Printers & Devices'} onClick={() => setActiveTab('Printers & Devices')} />
          <SettingTab icon={Users} label="Customer Loyalty" active={activeTab === 'Customer Loyalty'} onClick={() => setActiveTab('Customer Loyalty')} />
        </div>

        <div className="md:col-span-2 space-y-6">
          {activeTab === 'Shop Profile' && (
            <Card className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Shop Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Shop Name</label>
                  <Input defaultValue="City Mart Branch 4" className="bg-white border-slate-200" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Contact Phone</label>
                    <Input defaultValue="09-123456789" className="bg-white border-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                    <Input defaultValue="branch4@citymart.com" className="bg-white border-slate-200" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Address</label>
                  <Input defaultValue="Mandalay, Myanmar" className="bg-white border-slate-200" />
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'Receipt & Taxes' && (
            <Card className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Tax & Fees</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <h4 className="font-bold text-slate-900">Commercial Tax</h4>
                    <p className="text-xs text-slate-500 mt-1">Automatically applied to all orders</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input defaultValue="5" className="w-20 text-center bg-white border-slate-200" type="number" />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <h4 className="font-bold text-slate-900">Service Charge</h4>
                    <p className="text-xs text-slate-500 mt-1">Optional service fee for dine-in</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input defaultValue="0" className="w-20 text-center bg-white border-slate-200" type="number" />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'Printers & Devices' && (
             <Card className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Printer Configuration</h3>
              <p className="text-slate-500">Connect to network or bluetooth thermal printers.</p>
               <div className="mt-4 space-y-4">
                 <Button variant="outline" className="gap-2" onClick={() => {
                    setIsSaving(true);
                    setTimeout(() => {
                      setIsSaving(false);
                      alert("Searching for printers... No Bluetooth or Network printers found nearby.");
                    }, 1500);
                  }} disabled={isSaving}>
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                   {isSaving ? 'Searching...' : 'Add New Printer'}
                 </Button>
               </div>
            </Card>
          )}

          {activeTab === 'Customer Loyalty' && (
             <Card className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Loyalty Program</h3>
              <p className="text-slate-500">Configure reward points for customers.</p>
               <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Points per 1,000 MMK spent</label>
                    <Input defaultValue="10" type="number" className="max-w-md bg-white border-slate-200" />
                  </div>
               </div>
            </Card>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}

function SettingTab({ icon: Icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${active ? 'bg-white shadow-sm border border-slate-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}
