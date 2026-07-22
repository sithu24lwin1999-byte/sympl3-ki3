import React, { useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, Button, Badge, Input } from '@/components/ui';
import { Search, Plus, Edit, Trash2, ShieldCheck, Mail, Phone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createManagedUser, useAuth } from '@/lib/auth';
import { createRecord, deleteRecord, setRecord, updateRecord, useLiveCollection } from '@/lib/firestore';
import type { Branch, Employee } from '@/types';

export default function OwnerEmployees() {
  const { user } = useAuth();
  const employeesPath = user?.shopId ? `shops/${user.shopId}/employees` : null;
  const [search, setSearch] = useState('');
  const { data: employees, loading, error } = useLiveCollection<Employee>(employeesPath);
  const { data: storedBranches } = useLiveCollection<Branch>(user?.shopId ? `shops/${user.shopId}/branches` : null, 'createdAt');
  const branches = storedBranches.some(branch => branch.id === 'main') ? storedBranches : [{ id: 'main', name: 'Main Branch' } as Branch, ...storedBranches];
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const emptyEmployee = { name: '', role: 'Cashier', email: '', password: '', phone: '', shift: 'Morning', branchId: 'main', permissions: { discount: false, refund: false, editStock: false, viewOrders: true } };
  const [newEmployee, setNewEmployee] = useState(emptyEmployee);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleAddEmployee = async () => {
    if (!newEmployee.name) return;
    if (!employeesPath || !user?.shopId) return;
    setSaving(true); setFormError('');
    try {
      let employeeId = editingId;
      const selectedBranch = branches.find(branch => branch.id === newEmployee.branchId);
      if (!employeeId) employeeId = await createManagedUser({ email: newEmployee.email, password: newEmployee.password, name: newEmployee.name, role: 'EMPLOYEE', shopId: user.shopId, branchId: newEmployee.branchId, branchName: selectedBranch?.name || 'Main Branch' });
    const e = {
      name: newEmployee.name,
      role: newEmployee.role,
      email: newEmployee.email,
      phone: newEmployee.phone,
      status: 'Active',
      shift: newEmployee.shift,
      shopId: user.shopId,
      branchId: newEmployee.branchId,
      branchName: selectedBranch?.name || 'Main Branch',
      permissions: newEmployee.permissions,
      updatedAt: new Date().toISOString(),
    };
    await setRecord(employeesPath, employeeId, e);
    await updateRecord('users', employeeId, { name: e.name, email: e.email.toLowerCase(), branchId: e.branchId, branchName: e.branchName, active: true });
    await createRecord(`shops/${user.shopId}/auditLogs`, { shopId: user.shopId, actorId: user.id, actorName: user.name, action: editingId ? 'EMPLOYEE_UPDATED' : 'EMPLOYEE_CREATED', detail: e.name, createdAt: new Date().toISOString() });
    setShowAddModal(false);
    setEditingId(null);
    setNewEmployee(emptyEmployee);
    } catch (issue) { setFormError(issue instanceof Error ? issue.message : 'Unable to save employee.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this employee?')) return;
    if (employeesPath) await deleteRecord(employeesPath, id);
    await updateRecord('users', id, { active: false });
    if (user?.shopId) await createRecord(`shops/${user.shopId}/auditLogs`, { shopId: user.shopId, actorId: user.id, actorName: user.name, action: 'EMPLOYEE_DISABLED', detail: id, createdAt: new Date().toISOString() });
  };

  const handleEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setNewEmployee({ name: employee.name, role: employee.role, email: employee.email, password: '', phone: employee.phone, shift: employee.shift, branchId: employee.branchId || 'main', permissions: employee.permissions || emptyEmployee.permissions });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingId(null);
    setNewEmployee(emptyEmployee);
  };

  return (
    <DashboardLayout role="OWNER">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Employees</h1>
          <p className="text-slate-500">Manage your staff, permissions, and shifts.</p>
        </div>
        <Button 
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="w-4 h-4" /> Add Employee
        </Button>
      </div>

      <Card className="p-0 overflow-hidden flex flex-col">
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-80">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search employees by name..." 
              className="bg-transparent border-none outline-none text-sm w-full text-slate-900"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Role & Shift</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {!loading && employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase())).map((employee) => (
                <tr key={employee.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm border-2 border-white ring-1 ring-slate-200">
                        {employee.name.charAt(0)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-slate-900">{employee.name}</div>
                        <div className="text-xs text-slate-400">ID: {employee.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap space-y-1">
                    <div className="flex items-center text-xs text-slate-600">
                      <Mail className="w-3.5 h-3.5 mr-2 text-slate-400" /> {employee.email}
                    </div>
                    <div className="flex items-center text-xs text-slate-600">
                      <Phone className="w-3.5 h-3.5 mr-2 text-slate-400" /> {employee.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-sm font-bold text-slate-700">{employee.role}</span>
                    </div>
                    <div className="text-xs text-slate-500">Shift: {employee.shift}</div>
                    <div className="text-xs font-semibold text-blue-600">{employee.branchName || 'Main Branch'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge 
                      className={cn(
                        "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full",
                        employee.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 
                        employee.status === 'Inactive' ? 'bg-red-50 text-red-600' : 
                        'bg-amber-50 text-amber-600'
                      )}
                    >
                      {employee.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg text-blue-600 hover:bg-blue-50 bg-slate-50" onClick={() => handleEdit(employee)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="h-8 w-8 p-0 rounded-lg text-red-600 hover:bg-red-50 bg-slate-50"
                        onClick={() => handleDelete(employee.id)}
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
              <h2 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Employee' : 'Add New Employee'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
                <Input 
                  placeholder="e.g. Min Thein" 
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                  className="bg-white border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Role</label>
                  <select 
                    className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value})}
                  >
                    <option value="Manager">Manager</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Barista">Barista</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Shift</label>
                  <select 
                    className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    value={newEmployee.shift}
                    onChange={(e) => setNewEmployee({...newEmployee, shift: e.target.value})}
                  >
                    <option value="Morning">Morning</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                <Input 
                  placeholder="name@ki3.com" 
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                  className="bg-white border-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Phone</label>
                <Input 
                  placeholder="09-..." 
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                  className="bg-white border-slate-200"
                />
              </div>
              {!editingId && <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Temporary Password</label>
                <Input type="password" minLength={8} value={newEmployee.password} onChange={(e) => setNewEmployee({...newEmployee, password: e.target.value})} className="bg-white border-slate-200" />
              </div>}
              <div><label className="block text-sm font-bold text-slate-700 mb-2">Assigned Branch</label><select value={newEmployee.branchId} onChange={e => setNewEmployee({ ...newEmployee, branchId: e.target.value })} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4">{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Permissions</label>
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3">
                  {([['discount', 'Give discounts'], ['refund', 'Process refunds'], ['editStock', 'Adjust stock'], ['viewOrders', 'View orders']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={newEmployee.permissions[key]} onChange={e => setNewEmployee({ ...newEmployee, permissions: { ...newEmployee.permissions, [key]: e.target.checked } })} />{label}</label>)}
                </div>
              </div>
            </div>

            {formError && <p className="px-6 pb-3 text-sm text-red-600">{formError}</p>}

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
              <Button className="flex-1 bg-white text-slate-700 border-slate-200 hover:bg-slate-100" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddEmployee} disabled={saving || !newEmployee.name.trim() || !newEmployee.email.trim() || (!editingId && newEmployee.password.length < 8)}>
                {saving ? 'Saving…' : editingId ? 'Update Employee' : 'Add Employee'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
