import { ReactNode, useMemo, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Button, Card, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { createRecord, useLiveCollection } from '@/lib/firestore';
import { formatCurrency } from '@/lib/utils';
import type { Branch, Expense, Order } from '@/types';
import { Building2, Plus } from 'lucide-react';
import { calculateBranchDailyFinance } from '@/lib/finance';

export default function OwnerBranches() {
  const { user } = useAuth();
  const shopId = user?.shopId || '';
  const { data: storedBranches } = useLiveCollection<Branch>(shopId ? `shops/${shopId}/branches` : null, 'createdAt');
  const { data: orders } = useLiveCollection<Order>(shopId ? `shops/${shopId}/orders` : null, 'createdAt');
  const { data: expenses } = useLiveCollection<Expense>(shopId ? `shops/${shopId}/expenses` : null, 'createdAt');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [branch, setBranch] = useState({ name: '', phone: '', address: '' });
  const branches = useMemo(() => storedBranches.some(item => item.id === 'main') ? storedBranches : [{ id: 'main', shopId, name: 'Main Branch', active: true, createdAt: '' }, ...storedBranches], [storedBranches, shopId]);

  const rows = branches.map(item => {
    return { branch: item, ...calculateBranchDailyFinance(item.id, date, orders, expenses) };
  });
  const totals = rows.reduce((sum, row) => ({ income: sum.income + row.income, expenses: sum.expenses + row.operating + row.withdrawals, net: sum.net + row.net }), { income: 0, expenses: 0, net: 0 });

  const addBranch = async () => {
    if (!shopId || !branch.name.trim()) return;
    await createRecord(`shops/${shopId}/branches`, { ...branch, name: branch.name.trim(), shopId, active: true, createdAt: new Date().toISOString() });
    await createRecord(`shops/${shopId}/auditLogs`, { shopId, actorId: user!.id, actorName: user!.name, action: 'BRANCH_CREATED', detail: branch.name.trim(), createdAt: new Date().toISOString() });
    setBranch({ name: '', phone: '', address: '' });
  };

  return <DashboardLayout role="OWNER">
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7"><div><h1 className="text-3xl font-bold mb-2">Branches & Daily Finance</h1><p className="text-slate-500">Compare daily income, expenses and owner withdrawals by branch.</p></div><label className="text-sm font-bold">Report date<Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-2 bg-white" /></label></div>
    <div className="grid md:grid-cols-3 gap-4 mb-6"><Summary label="Total Income" value={totals.income} tone="text-emerald-600" /><Summary label="Total Expenses & Withdrawals" value={totals.expenses} tone="text-red-600" /><Summary label="Net Cash" value={totals.net} tone="text-blue-600" /></div>
    <Card className="p-0 overflow-hidden mb-6"><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-slate-50"><Th>Branch</Th><Th>Orders</Th><Th>Income</Th><Th>Operating Expenses</Th><Th>Owner Withdrawals</Th><Th>Net</Th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.branch.id}><Td><span className="font-bold">{row.branch.name}</span><span className="block text-xs text-slate-400">{row.branch.address || 'No address'}</span></Td><Td>{row.orders}</Td><Td>{formatCurrency(row.income)}</Td><Td>{formatCurrency(row.operating)}</Td><Td>{formatCurrency(row.withdrawals)}</Td><Td><span className={row.net < 0 ? 'font-black text-red-600' : 'font-black text-blue-600'}>{formatCurrency(row.net)}</span></Td></tr>)}</tbody></table></div></Card>
    <Card className="p-5"><h3 className="font-bold flex items-center gap-2 mb-4"><Building2 className="w-5 h-5 text-blue-600" />Add Shop Branch</h3><div className="grid md:grid-cols-4 gap-3"><Input placeholder="Branch name" value={branch.name} onChange={e => setBranch({ ...branch, name: e.target.value })} /><Input placeholder="Phone" value={branch.phone} onChange={e => setBranch({ ...branch, phone: e.target.value })} /><Input placeholder="Address" value={branch.address} onChange={e => setBranch({ ...branch, address: e.target.value })} /><Button onClick={addBranch} disabled={!branch.name.trim()}><Plus className="w-4 h-4 mr-2" />Add Branch</Button></div></Card>
  </DashboardLayout>;
}

function Summary({ label, value, tone }: { label: string; value: number; tone: string }) { return <Card className="p-5"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className={`text-2xl font-black mt-2 ${tone}`}>{formatCurrency(value)}</p></Card>; }
function Th({ children }: { children: ReactNode }) { return <th className="px-5 py-4 text-xs font-bold uppercase text-slate-500 whitespace-nowrap">{children}</th>; }
function Td({ children }: { children: ReactNode }) { return <td className="px-5 py-4 text-sm whitespace-nowrap">{children}</td>; }
