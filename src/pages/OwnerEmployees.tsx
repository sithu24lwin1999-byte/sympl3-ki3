import React, { useState } from 'react';
import { Activity, Download, Edit, ImagePlus, KeyRound, Mail, Phone, Plus, Power, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Badge, Button, Card, Input, TableStateRow } from '@/components/ui';
import { createManagedUser, updateManagedUser, useAuth } from '@/lib/auth';
import { downloadCsv } from '@/lib/actions';
import { createRecord, setRecord, useLiveCollection } from '@/lib/firestore';
import { prepareProfileImage } from '@/lib/imageUpload';
import { normalizePermissions, permissionLabels, rolePermissions, type EmployeeJobRole } from '@/lib/permissions';
import { cn, formatCurrency } from '@/lib/utils';
import type { AuditLog, Branch, Employee, EmployeePermissions, Order } from '@/types';

type EmployeeForm = {
  name: string;
  role: EmployeeJobRole;
  email: string;
  password: string;
  phone: string;
  shift: string;
  branchId: string;
  photo: string;
  permissions: EmployeePermissions;
};

const emptyForm = (): EmployeeForm => ({
  name: '',
  role: 'Cashier',
  email: '',
  password: '',
  phone: '',
  shift: 'Morning',
  branchId: 'main',
  photo: '',
  permissions: { ...rolePermissions.Cashier },
});

export default function OwnerEmployees() {
  const { user, resetPassword } = useAuth();
  const shopId = user?.shopId;
  const employeesPath = shopId ? `shops/${shopId}/employees` : null;
  const { data: employees, loading, error } = useLiveCollection<Employee>(employeesPath);
  const { data: orders } = useLiveCollection<Order>(shopId ? `shops/${shopId}/orders` : null, 'createdAt');
  const { data: logs } = useLiveCollection<AuditLog>(shopId ? `shops/${shopId}/auditLogs` : null, 'createdAt');
  const { data: storedBranches } = useLiveCollection<Branch>(shopId ? `shops/${shopId}/branches` : null, 'createdAt');
  const branches = storedBranches.some(branch => branch.id === 'main') ? storedBranches : [{ id: 'main', name: 'Main Branch' } as Branch, ...storedBranches];

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [details, setDetails] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [photoError, setPhotoError] = useState('');

  const notify = (value: string) => { setMessage(value); window.setTimeout(() => setMessage(''), 4500); };
  const filtered = employees.filter(employee => (
    (roleFilter === 'ALL' || employee.role === roleFilter) &&
    (statusFilter === 'ALL' || employee.status === statusFilter) &&
    `${employee.name} ${employee.email} ${employee.phone} ${employee.role}`.toLowerCase().includes(search.toLowerCase())
  ));
  const employeeOrders = (id: string) => orders.filter(order => order.employeeId === id);
  const employeeSales = (id: string) => employeeOrders(id).filter(order => order.status === 'COMPLETED').reduce((sum, order) => sum + order.total, 0);

  const choosePhoto = async (file?: File) => {
    if (!file) return;
    setPhotoError('');
    try {
      const photo = await prepareProfileImage(file);
      setForm(current => ({ ...current, photo }));
    } catch (issue) { setPhotoError(issue instanceof Error ? issue.message : 'Unable to save employee photo.'); }
  };

  const saveEmployee = async () => {
    if (!employeesPath || !shopId || !user) return;
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (!editing && form.password.length < 8)) {
      setFormError('Enter a name, valid email and temporary password of at least 8 characters.');
      return;
    }
    setSaving(true); setFormError('');
    try {
      const branch = branches.find(item => item.id === form.branchId);
      const branchName = branch?.name || 'Main Branch';
      let id = editing?.id;
      if (!id) {
        id = await createManagedUser({
          email,
          password: form.password,
          name: form.name.trim(),
          role: 'EMPLOYEE',
          shopId,
          branchId: form.branchId,
          branchName,
          phone: form.phone,
          shift: form.shift,
          jobTitle: form.role,
          photo: form.photo,
          permissions: form.permissions,
        });
      }
      const record = {
        name: form.name.trim(),
        role: form.role,
        email,
        phone: form.phone.trim(),
        photo: form.photo,
        status: editing?.status || 'Active',
        shift: form.shift,
        shopId,
        branchId: form.branchId,
        branchName,
        permissions: form.permissions,
        updatedAt: new Date().toISOString(),
      };
      if (editing) {
        await updateManagedUser({
          uid: id,
          name: record.name,
          email,
          jobTitle: record.role,
          branchId: record.branchId,
          branchName: record.branchName,
          phone: record.phone,
          shift: record.shift,
          photo: record.photo,
          permissions: record.permissions,
          active: editing.status !== 'Inactive',
        });
      } else {
        await setRecord(employeesPath, id, record);
      }
      setShowForm(false); setEditing(null); setForm(emptyForm()); setPhotoError('');
      notify(editing ? 'Employee account updated.' : 'Employee account created.');
    } catch (issue) { setFormError(issue instanceof Error ? issue.message : 'Unable to save employee.'); }
    finally { setSaving(false); }
  };

  const editEmployee = (employee: Employee) => {
    setEditing(employee);
    setPhotoError('');
    setForm({
      name: employee.name,
      role: (['Cashier', 'Manager', 'Accountant', 'Stock Keeper'].includes(employee.role) ? employee.role : 'Cashier') as EmployeeJobRole,
      email: employee.email,
      password: '',
      phone: employee.phone,
      shift: employee.shift,
      branchId: employee.branchId || 'main',
      photo: employee.photo || '',
      permissions: normalizePermissions(employee.permissions),
    });
    setShowForm(true);
  };

  const setActive = async (employee: Employee, active: boolean) => {
    if (!window.confirm(`${active ? 'Reactivate' : 'Suspend'} ${employee.name}?`)) return;
    await updateManagedUser({
      uid: employee.id,
      name: employee.name,
      email: employee.email,
      jobTitle: employee.role,
      branchId: employee.branchId,
      branchName: employee.branchName,
      phone: employee.phone,
      shift: employee.shift,
      photo: employee.photo || '',
      permissions: normalizePermissions(employee.permissions),
      active,
    });
    notify(active ? 'Employee account reactivated.' : 'Employee account suspended immediately.');
  };

  const sendReset = async (employee: Employee) => {
    try {
      await resetPassword(employee.email);
      if (shopId && user) await createRecord(`shops/${shopId}/auditLogs`, { shopId, actorId: user.id, actorName: user.name, action: 'EMPLOYEE_PASSWORD_RESET_SENT', detail: `${employee.name} (${employee.id})`, createdAt: new Date().toISOString() });
      notify(`Password reset email sent to ${employee.email}.`);
    } catch (issue) { setFormError(issue instanceof Error ? issue.message : 'Unable to send password reset email.'); }
  };

  const changeRole = (role: EmployeeJobRole) => setForm({ ...form, role, permissions: { ...rolePermissions[role] } });
  const changePermission = (key: keyof EmployeePermissions, value: boolean) => setForm({ ...form, permissions: { ...form.permissions, [key]: value, ...(key === 'view' ? { viewOrders: value } : {}) } });
  const exportSales = (employee: Employee) => downloadCsv(`employee-sales-${employee.name.replace(/\W+/g, '-')}.csv`, [['Date', 'Order ID', 'Branch', 'Status', 'Payment', 'Amount MMK'], ...employeeOrders(employee.id).map(order => [order.createdAt, order.id, order.branchName || 'Main Branch', order.status, order.paymentKind || order.paymentMethod, order.total])]);

  return <DashboardLayout role="OWNER">
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h1 className="text-3xl font-bold tracking-tight">Employee Management</h1><p className="mt-2 text-slate-500">Accounts, roles, granular permissions, performance and activity.</p></div><Button className="bg-blue-600 text-white" onClick={() => { setEditing(null); setForm(emptyForm()); setPhotoError(''); setShowForm(true); }}><Plus className="mr-2 h-4 w-4" />Create Employee</Button></div>
    {message && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
    {formError && !showForm && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{formError}</p>}
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{(['Cashier', 'Manager', 'Accountant', 'Stock Keeper'] as EmployeeJobRole[]).map(role => <div key={role} className="rounded-2xl border bg-white p-4"><p className="text-xs font-bold uppercase text-slate-400">{role}s</p><p className="mt-1 text-2xl font-black">{employees.filter(item => item.role === role && item.status === 'Active').length}</p></div>)}</div>
    <Card className="overflow-hidden p-0"><div className="flex flex-wrap gap-3 border-b p-4"><div className="flex min-w-64 flex-1 items-center rounded-xl border bg-slate-50 px-3"><Search className="mr-2 h-4 w-4 text-slate-400" /><input className="h-11 w-full bg-transparent text-sm outline-none" placeholder="Search employee, email or phone…" value={search} onChange={event => setSearch(event.target.value)} /></div><select className="control" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="ALL">All roles</option>{Object.keys(rolePermissions).map(role => <option key={role}>{role}</option>)}</select><select className="control" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option>Active</option><option>Inactive</option><option>On Leave</option></select></div><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left"><thead><tr className="border-b bg-slate-50">{['Employee', 'Contact', 'Role / Branch', 'Permissions', 'Sales', 'Status', 'Actions'].map(label => <th key={label} className="px-4 py-4 text-xs uppercase text-slate-500">{label}</th>)}</tr></thead><tbody className="divide-y"><TableStateRow columns={7} loading={loading} error={error} empty={!loading && filtered.length === 0} emptyMessage="No employees match the selected filters." />{filtered.map(employee => <tr key={employee.id} className="hover:bg-slate-50"><td className="px-4 py-4"><div className="flex items-center gap-3"><Avatar name={employee.name} photo={employee.photo} /><div><p className="font-bold">{employee.name}</p><p className="text-xs text-slate-400">{employee.id}</p></div></div></td><td className="px-4 py-4 text-xs"><p className="flex gap-2"><Mail className="w-3" />{employee.email}</p><p className="mt-1 flex gap-2"><Phone className="w-3" />{employee.phone || '—'}</p></td><td className="px-4 py-4"><p className="flex gap-2 font-bold"><ShieldCheck className="w-4 text-indigo-500" />{employee.role}</p><p className="mt-1 text-xs text-blue-600">{employee.branchName || 'Main Branch'} · {employee.shift}</p></td><td className="px-4 py-4"><p className="max-w-52 text-xs text-slate-500">{permissionLabels.filter(([key]) => normalizePermissions(employee.permissions)[key]).map(([, label]) => label).join(', ') || 'No actions'}</p></td><td className="px-4 py-4"><p className="font-bold">{formatCurrency(employeeSales(employee.id))}</p><p className="text-xs text-slate-400">{employeeOrders(employee.id).length} orders</p></td><td className="px-4 py-4"><Badge variant={employee.status === 'Active' ? 'success' : employee.status === 'Inactive' ? 'danger' : 'warning'}>{employee.status}</Badge></td><td className="px-4 py-4"><div className="flex gap-1"><IconButton title="View sales & activity" click={() => setDetails(employee)}><Activity /></IconButton><IconButton title="Edit" click={() => editEmployee(employee)}><Edit /></IconButton><IconButton title="Reset password" click={() => sendReset(employee)}><KeyRound /></IconButton><IconButton title={employee.status === 'Inactive' ? 'Reactivate' : 'Suspend'} click={() => setActive(employee, employee.status === 'Inactive')} danger={employee.status !== 'Inactive'}><Power /></IconButton></div></td></tr>)}</tbody></table></div></Card>

    {showForm && <Modal title={editing ? 'Edit Employee' : 'Create Employee'} close={() => setShowForm(false)} wide>
      <PhotoPicker name={form.name || 'Employee'} photo={form.photo} error={photoError} onChoose={choosePhoto} onRemove={() => setForm({ ...form, photo: '' })} />
      <div className="grid gap-4 md:grid-cols-2"><Field label="Full Name"><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field><Field label="Role Preset"><select className="control w-full" value={form.role} onChange={event => changeRole(event.target.value as EmployeeJobRole)}>{Object.keys(rolePermissions).map(role => <option key={role}>{role}</option>)}</select></Field><Field label="Email"><Input type="email" disabled={Boolean(editing)} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field><Field label="Phone"><Input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field>{!editing && <Field label="Temporary Password"><Input type="password" minLength={8} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></Field>}<Field label="Shift"><select className="control w-full" value={form.shift} onChange={event => setForm({ ...form, shift: event.target.value })}><option>Morning</option><option>Evening</option><option>Night</option></select></Field><Field label="Assigned Branch"><select className="control w-full" value={form.branchId} onChange={event => setForm({ ...form, branchId: event.target.value })}>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field></div>
      <h3 className="mb-3 mt-6 font-bold">Action Permissions</h3><div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">{permissionLabels.map(([permissionKey, label]) => <React.Fragment key={String(permissionKey)}><PermissionToggle label={label} checked={form.permissions[permissionKey]} set={value => changePermission(permissionKey, value)} /></React.Fragment>)}</div>
      <h3 className="mb-3 mt-6 font-bold">Operational Access</h3><div className="grid gap-2 sm:grid-cols-2"><PermissionToggle label="Adjust inventory stock" checked={form.permissions.editStock} set={value => changePermission('editStock', value)} /><PermissionToggle label="Record expenses" checked={form.permissions.recordExpenses} set={value => changePermission('recordExpenses', value)} /></div>
      {formError && <p className="mt-4 text-sm text-red-600">{formError}</p>}<Button className="mt-6 w-full bg-blue-600 text-white" disabled={saving} onClick={saveEmployee}>{saving ? 'Saving…' : editing ? 'Update Employee' : 'Create Account'}</Button>
    </Modal>}

    {details && <Modal title={`${details.name} · Performance`} close={() => setDetails(null)} wide><div className="mb-5 flex items-center gap-4"><Avatar name={details.name} photo={details.photo} size="lg" /><div><h3 className="text-xl font-black">{details.name}</h3><p className="text-sm text-slate-500">{details.role} · {details.branchName || 'Main Branch'}</p></div></div><div className="grid gap-3 sm:grid-cols-3"><Stat label="Completed Sales" value={formatCurrency(employeeSales(details.id))} /><Stat label="All Orders" value={String(employeeOrders(details.id).length)} /><Stat label="Activity Events" value={String(logs.filter(log => log.actorId === details.id).length)} /></div><div className="mt-6 flex items-center justify-between"><h3 className="font-bold">Recent Sales</h3><Button variant="outline" className="h-9" onClick={() => exportSales(details)}><Download className="mr-2 h-4 w-4" />Export CSV</Button></div><div className="mt-2 max-h-56 overflow-auto divide-y">{employeeOrders(details.id).slice(0, 12).map(order => <div key={order.id} className="flex justify-between py-3 text-sm"><span>{new Date(order.createdAt).toLocaleString()} · {order.branchName || 'Main Branch'} · {order.status}</span><b>{formatCurrency(order.total)}</b></div>)}{employeeOrders(details.id).length === 0 && <p className="py-4 text-sm text-slate-400">No sales recorded.</p>}</div><h3 className="mt-6 font-bold">Activity Logs</h3><div className="mt-2 max-h-56 overflow-auto divide-y">{logs.filter(log => log.actorId === details.id).slice(0, 15).map(log => <div key={log.id} className="py-3"><p className="text-sm font-bold">{log.action}</p><p className="text-xs text-slate-400">{log.detail} · {new Date(log.createdAt).toLocaleString()}</p></div>)}{!logs.some(log => log.actorId === details.id) && <p className="py-4 text-sm text-slate-400">No activity recorded.</p>}</div></Modal>}
  </DashboardLayout>;
}

function Avatar({ name, photo, size = 'md' }: { name: string; photo?: string; size?: 'md' | 'lg' }) {
  const className = size === 'lg' ? 'h-16 w-16 text-xl' : 'h-10 w-10 text-sm';
  return <div className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full bg-blue-100 font-bold text-blue-700', className)}>{photo ? <img src={photo} alt={`${name} profile`} className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}</div>;
}

function PhotoPicker({ name, photo, error, onChoose, onRemove }: { name: string; photo: string; error: string; onChoose(file?: File): void; onRemove(): void }) {
  return <div className="mb-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4"><span className="mb-3 block text-sm font-bold text-slate-700">Employee photo</span><div className="flex flex-wrap items-center gap-4"><Avatar name={name} photo={photo} size="lg" /><div className="space-y-2"><div className="flex flex-wrap gap-2"><label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><ImagePlus className="mr-2 h-4 w-4" />{photo ? 'Change Photo' : 'Upload Photo'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => { void onChoose(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>{photo && <button type="button" onClick={onRemove} className="inline-flex min-h-11 items-center rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 className="mr-2 h-4 w-4" />Remove</button>}</div><p className="text-xs text-slate-500">PNG, JPG or WebP · maximum file size 3 MB.</p>{error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}</div></div></div>;
}

function Modal({ title, close, children, wide = false }: { title: string; close(): void; children: React.ReactNode; wide?: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"><div className={cn('max-h-[92vh] w-full overflow-auto rounded-3xl bg-white', wide ? 'max-w-3xl' : 'max-w-xl')}><div className="sticky top-0 z-10 flex justify-between border-b bg-slate-50 p-5"><h2 className="text-xl font-bold">{title}</h2><button onClick={close}><X /></button></div><div className="p-6">{children}</div></div></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span>{children}</label>; }
function PermissionToggle({ label, checked, set }: { label: string; checked: boolean; set(value: boolean): void }) { return <label className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm font-semibold"><span>{label}</span><input type="checkbox" checked={checked} onChange={event => set(event.target.checked)} className="h-5 w-5 accent-blue-600" /></label>; }
function IconButton({ title, click, children, danger = false }: { title: string; click(): void; children: React.ReactElement; danger?: boolean }) { return <button title={title} onClick={click} className={cn('grid h-9 w-9 place-items-center rounded-lg bg-slate-100', danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600')}>{React.cloneElement(children, { className: 'h-4 w-4' } as React.HTMLAttributes<HTMLElement>)}</button>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }
