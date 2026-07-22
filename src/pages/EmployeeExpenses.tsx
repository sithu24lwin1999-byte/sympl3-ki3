import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, CheckCircle2, LogOut, WalletCards } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { createRecord } from '@/lib/firestore';
import { useLiveDocument } from '@/lib/firestore';
import type { Employee } from '@/types';

export default function EmployeeExpenses() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const employee = useLiveDocument<Employee>(user?.shopId && user?.id ? `shops/${user.shopId}/employees/${user.id}` : null);
  const [form, setForm] = useState({ type: 'OPERATING' as 'OPERATING' | 'OWNER_WITHDRAWAL', category: 'Shop Supplies', note: '', amount: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const save = async () => {
    const amount = Number(form.amount); if (!user?.shopId || amount <= 0) return;
    setSaving(true); setMessage(''); setError('');
    try {
      const now = new Date().toISOString();
      const branchId = employee?.branchId || user.branchId || 'main'; const branchName = employee?.branchName || user.branchName || 'Main Branch';
      await createRecord(`shops/${user.shopId}/expenses`, { ...form, amount, shopId: user.shopId, branchId, branchName, actorId: user.id, actorName: user.name, createdAt: now });
      await createRecord(`shops/${user.shopId}/auditLogs`, { shopId: user.shopId, actorId: user.id, actorName: user.name, action: form.type === 'OWNER_WITHDRAWAL' ? 'OWNER_WITHDRAWAL_RECORDED' : 'EXPENSE_RECORDED', detail: `${branchName} · ${form.note || form.category} · ${amount} MMK`, createdAt: now });
      setForm({ type: 'OPERATING', category: 'Shop Supplies', note: '', amount: '' }); setMessage('Expense saved. The shop owner can now see it in the branch report.');
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'Unable to save expense.'); }
    finally { setSaving(false); }
  };

  return <div className="min-h-screen bg-slate-100">
    <header className="bg-white border-b px-4 md:px-8 py-4 flex items-center justify-between"><Button variant="ghost" onClick={() => navigate('/pos')}><ArrowLeft className="w-4 h-4 mr-2" />Back to POS</Button><div className="text-right"><p className="font-bold">{employee?.branchName || user?.branchName || 'Main Branch'}</p><p className="text-xs text-slate-400">{user?.name}</p></div><Button variant="ghost" onClick={logout}><LogOut className="w-4 h-4 mr-2" />Sign Out</Button></header>
    <main className="max-w-xl mx-auto p-5 md:p-10"><Card className="p-6 md:p-8"><div className="flex gap-3 mb-6"><div className="w-12 h-12 bg-blue-100 rounded-2xl grid place-items-center"><WalletCards className="text-blue-600" /></div><div><h1 className="text-2xl font-black">Record Shop Expense</h1><p className="text-sm text-slate-500">Record operating costs or cash taken by the owner.</p></div></div>
      <div className="space-y-4"><div><label className="text-sm font-bold">Expense type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as typeof form.type, category: e.target.value === 'OWNER_WITHDRAWAL' ? 'Owner Withdrawal' : 'Shop Supplies' })} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4"><option value="OPERATING">Operating Expense</option><option value="OWNER_WITHDRAWAL">Money Taken by Owner</option></select></div>
      <div><label className="text-sm font-bold">Category</label><Input className="mt-2" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div><div><label className="text-sm font-bold">Reason / Note</label><Input className="mt-2" placeholder="What was the money used for?" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div><div><label className="text-sm font-bold">Amount (MMK)</label><Input className="mt-2" type="number" min="1" placeholder="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
      {message && <p className="flex gap-2 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700"><CheckCircle2 className="w-5 h-5 shrink-0" />{message}</p>}
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      <Button onClick={save} disabled={saving || Number(form.amount) <= 0} className="w-full h-14 text-base"><Banknote className="w-5 h-5 mr-2" />{saving ? 'Saving…' : 'Save Expense'}</Button></div>
    </Card></main>
  </div>;
}
