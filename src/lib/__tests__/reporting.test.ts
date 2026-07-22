import { describe, expect, it } from 'vitest';
import { periodDates, reportBreakdowns, reportRange } from '../reporting';

describe('accounting report helpers', () => {
  it('creates daily, weekly, monthly, yearly and custom periods', () => {
    const now = new Date(2026, 6, 23, 12);
    expect(periodDates('DAILY', now)).toEqual({ startDate: '2026-07-23', endDate: '2026-07-23' });
    expect(periodDates('WEEKLY', now).startDate).toBe('2026-07-17');
    expect(periodDates('MONTHLY', now).startDate).toBe('2026-07-01');
    expect(periodDates('YEARLY', now).startDate).toBe('2026-01-01');
    expect(periodDates('CUSTOM', now, { startDate: '2026-02-01', endDate: '2026-02-05' })).toEqual({ startDate: '2026-02-01', endDate: '2026-02-05' });
  });

  it('rejects an inverted date range', () => {
    expect(() => reportRange('2026-07-24', '2026-07-23')).toThrow('valid report date range');
  });

  it('groups sales by payment, product, category, employee and channel', () => {
    const breakdown = reportBreakdowns({
      orders: [{ id: 'o1', shopId: 's1', customer: 'A', items: [{ productId: 'p1', name: 'Shirt', quantity: 2, price: 100, cost: 40 }], subtotal: 200, tax: 10, discount: 0, total: 210, paymentMethod: 'Cash', paymentKind: 'CASH', payments: [{ kind: 'CASH', label: 'Cash', amount: 210 }], status: 'COMPLETED', type: 'IN_STORE', employeeName: 'Mya', createdAt: '2026-07-23T01:00:00.000Z' }],
      purchases: [], expenses: [], dueCollections: [],
    }, [{ id: 'p1', shopId: 's1', name: 'Shirt', sku: 'S1', category: 'Fashion', price: 100, cost: 40, stock: 5, minStock: 1, status: 'In Stock', image: '' }]);
    expect(breakdown.tax).toBe(10);
    expect(breakdown.payments[0]).toEqual({ name: 'Cash', value: 210 });
    expect(breakdown.products[0].profit).toBe(120);
    expect(breakdown.categories[0]).toEqual({ name: 'Fashion', value: 200 });
    expect(breakdown.employees[0]).toEqual({ name: 'Mya', value: 210 });
    expect(breakdown.channels[0]).toEqual({ name: 'In-store', value: 210 });
  });
});
