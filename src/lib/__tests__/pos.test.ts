import { describe, expect, it } from 'vitest';
import { calculateTotals, stockStatus } from '../pos';

describe('POS calculations', () => {
  it('applies discount and tax deterministically', () => {
    expect(calculateTotals(10000, 10, 5)).toEqual({ subtotal: 10000, discount: 1000, tax: 500, total: 9500 });
  });
  it('clamps invalid discounts', () => {
    expect(calculateTotals(10000, 120).total).toBe(500);
  });
  it('derives stock status', () => {
    expect(stockStatus(0)).toBe('Out of Stock');
    expect(stockStatus(5)).toBe('Low Stock');
    expect(stockStatus(20)).toBe('In Stock');
  });
});
