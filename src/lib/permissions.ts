import type { EmployeePermissions } from '@/types';

export type EmployeeJobRole = 'Cashier' | 'Manager' | 'Accountant' | 'Stock Keeper';

export const permissionLabels: Array<[keyof EmployeePermissions, string]> = [
  ['view', 'View'], ['create', 'Create'], ['edit', 'Edit'], ['delete', 'Delete'], ['export', 'Export'], ['approve', 'Approve'],
  ['refund', 'Refund'], ['discount', 'Discount'], ['viewCost', 'View cost'], ['viewProfit', 'View profit'], ['accessReports', 'Access reports'], ['manageSettings', 'Manage settings'],
];

const base: EmployeePermissions = { view:true,create:false,edit:false,delete:false,export:false,approve:false,refund:false,discount:false,viewCost:false,viewProfit:false,accessReports:false,manageSettings:false,editStock:false,viewOrders:true,recordExpenses:false };

export const rolePermissions: Record<EmployeeJobRole, EmployeePermissions> = {
  Cashier: { ...base, create:true, discount:true },
  Manager: { ...base, create:true, edit:true, delete:true, export:true, approve:true, refund:true, discount:true, viewCost:true, viewProfit:true, accessReports:true, manageSettings:true, editStock:true, recordExpenses:true },
  Accountant: { ...base, export:true, approve:true, viewCost:true, viewProfit:true, accessReports:true, recordExpenses:true },
  'Stock Keeper': { ...base, edit:true, viewCost:true, editStock:true },
};

export function normalizePermissions(value?: Partial<EmployeePermissions>): EmployeePermissions {
  const merged = { ...base, ...value };
  if (value?.view === undefined && value?.viewOrders !== undefined) merged.view = value.viewOrders;
  merged.viewOrders = merged.view;
  return merged;
}
