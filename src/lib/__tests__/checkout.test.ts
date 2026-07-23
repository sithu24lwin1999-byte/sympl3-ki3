import { describe, expect, it } from 'vitest';
import { firestoreSafeId, normalizeSaleOrder, parseOfflineSales, saleLedgerRecords } from '../checkout';
import type { Order } from '@/types';

const sale = (overrides: Partial<Omit<Order, 'id'>> = {}): Omit<Order, 'id'> => ({
  orderNumber: 'KI3-1001', shopId: 'shop-a', customer: 'Walk-in',
  items: [{ productId: 'product-a', name: 'Tea', quantity: 2, price: 500, cost: 200 }],
  subtotal: 1000, discount: 0, tax: 50, serviceCharge: 0, deliveryCharge: 0, total: 1050,
  paidAmount: 800, dueAmount: 250, initialPaidAmount: 800, paymentMethod: 'Split payment', paymentKind: 'SPLIT',
  payments: [{ kind: 'CASH', label: 'Cash', amount: 800 }, { kind: 'CREDIT', label: 'Credit', amount: 250 }],
  status: 'COMPLETED', type: 'IN_STORE', employeeId: 'employee-a', employeeName: 'Aye Aye',
  createdAt: '2026-07-23T01:00:00.000Z', completedAt: '2026-07-23T01:00:00.000Z',
  ...overrides,
});

describe('atomic checkout records', () => {
  it('normalizes a valid sale and creates balanced ledgers', () => {
    const order = normalizeSaleOrder('shop-a', sale({ idempotencyKey: 'checkout-1001' }));
    const ledgers = saleLedgerRecords(order, 'sale-checkout-1001');
    expect(order.schemaVersion).toBe(2);
    expect(ledgers.payment.amount).toBe(800);
    expect(ledgers.payment.dueAmount).toBe(250);
    expect(ledgers.accounting.amount).toBe(1050);
    expect(ledgers.accounting.costAmount).toBe(400);
  });

  it('rejects mismatched totals and payment allocations', () => {
    expect(() => normalizeSaleOrder('shop-a', sale({ total: 999 }))).toThrow('totals');
    expect(() => normalizeSaleOrder('shop-a', sale({ paidAmount: 700 }))).toThrow('Payment allocations');
  });

  it('rejects cross-tenant and duplicate product input', () => {
    expect(() => normalizeSaleOrder('shop-b', sale())).toThrow('active shop');
    expect(() => normalizeSaleOrder('shop-a', sale({ items: [...sale().items, ...sale().items] }))).toThrow('Duplicate products');
  });

  it('creates a Firestore-safe deterministic identifier', () => {
    expect(firestoreSafeId('checkout/1001.test')).toBe('checkout-1001-test');
    expect(() => firestoreSafeId('x')).toThrow('invalid');
  });

  it('recovers safely from a corrupt offline queue', () => {
    expect(parseOfflineSales('{broken')).toEqual([]);
    expect(parseOfflineSales(JSON.stringify([sale(), null, 'bad']))).toHaveLength(1);
  });
});
