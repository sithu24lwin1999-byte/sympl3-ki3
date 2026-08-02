import { describe, expect, it } from 'vitest';
import { jewelleryInventoryValue, jewelleryRetailValue, jewellerySummary } from '../jewellery';
import type { Product } from '@/types';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'j1',
  shopId: 'shop',
  name: 'Diamond Ring',
  sku: 'DIA-RING',
  category: 'Diamond',
  price: 1000,
  cost: 700,
  stock: 2,
  minStock: 1,
  status: 'In Stock',
  image: '',
  jewellery: { metalType: 'WHITE_GOLD', purity: '18K', netWeightGram: 3.4, stoneWeightCarat: 0.5, certificateNumber: 'GIA123' },
  ...overrides,
});

describe('jewellery helpers', () => {
  it('builds a compact jewellery summary', () => {
    expect(jewellerySummary(product().jewellery)).toBe('WHITE GOLD · 18K · 3.4g net · 0.5ct · Cert GIA123');
  });

  it('calculates cost and retail stock values only for tracked active products', () => {
    const products = [
      product(),
      product({ id: 'inactive', active: false, cost: 100, price: 200, stock: 10 }),
      product({ id: 'service', itemType: 'SERVICE', trackStock: false, cost: 100, price: 200, stock: 10 }),
    ];
    expect(jewelleryInventoryValue(products)).toBe(1400);
    expect(jewelleryRetailValue(products)).toBe(2000);
  });
});
