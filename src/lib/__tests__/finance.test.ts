import { describe, expect, it } from 'vitest';
import { calculateBranchDailyFinance, localDateKey } from '../finance';
import type { Expense, Order } from '@/types';

const order = (overrides: Partial<Order>): Order => ({ id: 'o1', shopId: 'shop', customer: 'Walk-in', items: [], subtotal: 10000, tax: 0, discount: 0, total: 10000, paymentMethod: 'Cash', status: 'COMPLETED', type: 'ONLINE', createdAt: new Date(2026, 6, 22, 12).toISOString(), ...overrides });
const expense = (overrides: Partial<Expense>): Expense => ({ id: 'e1', shopId: 'shop', category: 'General', note: '', amount: 1000, createdAt: new Date(2026, 6, 22, 13).toISOString(), ...overrides });

describe('branch daily finance', () => {
  it('separates operating expenses and owner withdrawals', () => {
    const result = calculateBranchDailyFinance('branch-a', localDateKey(new Date(2026, 6, 22).toISOString()), [order({ branchId: 'branch-a' }), order({ id: 'other', branchId: 'branch-b' })], [expense({ branchId: 'branch-a' }), expense({ id: 'e2', branchId: 'branch-a', type: 'OWNER_WITHDRAWAL', amount: 2000 })]);
    expect(result).toEqual({ orders: 1, income: 10000, operating: 1000, withdrawals: 2000, net: 7000 });
  });
  it('maps legacy records without a branch to the main branch', () => {
    expect(calculateBranchDailyFinance('main', localDateKey(new Date(2026, 6, 22).toISOString()), [order({})], [expense({})]).net).toBe(9000);
  });
});
