import React, { useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Input } from '@/components/ui';
import { Save, Globe, Shield, CreditCard, Bell, Database, Loader2, CheckCircle2 } from 'lucide-react';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('General Settings');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [basicPlanPrice, setBasicPlanPrice] = useState('30,000');
  const [premiumPlanPrice, setPremiumPlanPrice] = useState('50,000');
  const [editingPlan, setEditingPlan] = useState<string | null>(null);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupDone, setBackupDone] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  };

  const handleBackup = () => {
    setIsBackingUp(true);
    setTimeout(() => {
      setIsBackingUp(false);
      setBackupDone(true);
      setTimeout(() => setBackupDone(false), 3000);
    }, 1500);
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">System Settings</h1>
          <p className="text-slate-500">Configure global platform preferences and integrations.</p>
        </div>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-2">
          <SettingTab icon={Globe} label="General Settings" active={activeTab === 'General Settings'} onClick={() => setActiveTab('General Settings')} />
          <SettingTab icon={Shield} label="Security & Access" active={activeTab === 'Security & Access'} onClick={() => setActiveTab('Security & Access')} />
          <SettingTab icon={CreditCard} label="Payment Gateways" active={activeTab === 'Payment Gateways'} onClick={() => setActiveTab('Payment Gateways')} />
          <SettingTab icon={Bell} label="Notifications (SMTP/SMS)" active={activeTab === 'Notifications (SMTP/SMS)'} onClick={() => setActiveTab('Notifications (SMTP/SMS)')} />
          <SettingTab icon={Database} label="Backups & Data" active={activeTab === 'Backups & Data'} onClick={() => setActiveTab('Backups & Data')} />
        </div>

        <div className="md:col-span-2 space-y-6">
          {activeTab === 'General Settings' && (
            <>
              <Card className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-6">General Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Platform Name</label>
                    <Input defaultValue="KI3 POS" className="max-w-md bg-white border-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Support Email</label>
                    <Input defaultValue="support@ki3.com" className="max-w-md bg-white border-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Default Currency</label>
                    <select className="flex h-12 w-full max-w-md rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                      <option value="MMK">Myanmar Kyat (MMK)</option>
                      <option value="USD">US Dollar (USD)</option>
                    </select>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Subscription Plans</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <h4 className="font-bold text-slate-900">Basic Plan</h4>
                      <p className="text-xs text-slate-500 mt-1">Single store, limited features</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {editingPlan === 'Basic' ? (
                        <div className="flex items-center gap-2">
                          <Input 
                            value={basicPlanPrice} 
                            onChange={(e) => setBasicPlanPrice(e.target.value)}
                            className="w-24 h-8 text-sm bg-white"
                          />
                          <span className="text-sm font-bold text-slate-500">MMK / mo</span>
                          <Button size="sm" className="h-8 bg-blue-600 text-white hover:bg-blue-700" onClick={() => setEditingPlan(null)}>Save</Button>
                        </div>
                      ) : (
                        <>
                          <span className="font-black text-slate-900">{basicPlanPrice} MMK / mo</span>
                          <Button variant="outline" className="h-8 text-xs" onClick={() => setEditingPlan('Basic')}>Edit</Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <h4 className="font-bold text-slate-900">Premium Plan</h4>
                      <p className="text-xs text-slate-500 mt-1">Unlimited features, priority support</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {editingPlan === 'Premium' ? (
                        <div className="flex items-center gap-2">
                          <Input 
                            value={premiumPlanPrice} 
                            onChange={(e) => setPremiumPlanPrice(e.target.value)}
                            className="w-24 h-8 text-sm bg-white"
                          />
                          <span className="text-sm font-bold text-slate-500">MMK / mo</span>
                          <Button size="sm" className="h-8 bg-blue-600 text-white hover:bg-blue-700" onClick={() => setEditingPlan(null)}>Save</Button>
                        </div>
                      ) : (
                        <>
                          <span className="font-black text-slate-900">{premiumPlanPrice} MMK / mo</span>
                          <Button variant="outline" className="h-8 text-xs" onClick={() => setEditingPlan('Premium')}>Edit</Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}

          {activeTab === 'Security & Access' && (
            <Card className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Security Settings</h3>
              <p className="text-slate-500">Configure password policies, 2FA, and session timeouts here.</p>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Session Timeout (minutes)</label>
                  <Input defaultValue="30" type="number" className="max-w-md bg-white border-slate-200" />
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'Payment Gateways' && (
             <Card className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Payment Integrations</h3>
              <p className="text-slate-500 mb-6">Manage mobile wallets and banking integrations here.</p>
               <div className="mt-4 space-y-4">
                 
                 <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900">KBZ Pay (KPay)</h4>
                        <p className="text-xs text-slate-500 mt-1">Accept payments via KBZ Pay</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">Active</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Merchant Phone Number</label>
                      <Input defaultValue="09-123456789" className="max-w-md bg-white border-slate-200" placeholder="e.g. 09..." />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900">AYA Pay</h4>
                        <p className="text-xs text-slate-500 mt-1">Accept payments via AYA Pay</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">Active</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Merchant Phone Number</label>
                      <Input defaultValue="09-456789123" className="max-w-md bg-white border-slate-200" placeholder="e.g. 09..." />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900">WavePay</h4>
                        <p className="text-xs text-slate-500 mt-1">Accept payments via Wave Money</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">Active</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Merchant Phone Number</label>
                      <Input defaultValue="09-987654321" className="max-w-md bg-white border-slate-200" placeholder="e.g. 09..." />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900">Bank Transfer</h4>
                        <p className="text-xs text-slate-500 mt-1">Accept direct bank transfers</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">Active</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
                        <Input defaultValue="KBZ Bank" className="bg-white border-slate-200" placeholder="e.g. KBZ, CB, AYA" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Account Number</label>
                        <Input defaultValue="1234567890123456" className="bg-white border-slate-200" placeholder="Account Number" />
                      </div>
                    </div>
                  </div>

               </div>
            </Card>
          )}

          {activeTab === 'Notifications (SMTP/SMS)' && (
             <Card className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Notification Settings</h3>
              <p className="text-slate-500">Configure email and SMS delivery services.</p>
               <div className="mt-4 space-y-4">
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">SMTP Host</label>
                    <Input defaultValue="smtp.mailgun.org" className="max-w-md bg-white border-slate-200" />
                  </div>
               </div>
            </Card>
          )}

          {activeTab === 'Backups & Data' && (
             <Card className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Database Backups</h3>
              <p className="text-slate-500">Configure automated backups and data retention policies.</p>
               <div className="mt-4 space-y-4">
                  <Button variant="outline" className="gap-2" onClick={handleBackup} disabled={isBackingUp}>
                    {isBackingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : backupDone ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Database className="w-4 h-4" />}
                    {isBackingUp ? 'Backing up...' : backupDone ? 'Backup Complete' : 'Run Manual Backup'}
                  </Button>
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
