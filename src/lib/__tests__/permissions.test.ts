import { describe, expect, it } from 'vitest';
import { normalizePermissions, permissionLabels, rolePermissions } from '../permissions';

describe('employee permissions', () => {
  it('exposes every requested configurable permission', () => {
    expect(permissionLabels.map(([key]) => key)).toEqual([
      'view', 'create', 'edit', 'delete', 'export', 'approve',
      'refund', 'discount', 'viewCost', 'viewProfit', 'accessReports', 'manageSettings',
    ]);
  });

  it('provides safe role presets', () => {
    expect(rolePermissions.Cashier.create).toBe(true);
    expect(rolePermissions.Cashier.refund).toBe(false);
    expect(rolePermissions.Manager.manageSettings).toBe(true);
    expect(rolePermissions.Accountant.accessReports).toBe(true);
    expect(rolePermissions['Stock Keeper'].editStock).toBe(true);
  });

  it('migrates the legacy viewOrders permission without expanding other access', () => {
    const normalized = normalizePermissions({ viewOrders: false, refund: true });
    expect(normalized.view).toBe(false);
    expect(normalized.viewOrders).toBe(false);
    expect(normalized.refund).toBe(true);
    expect(normalized.manageSettings).toBe(false);
  });
});
