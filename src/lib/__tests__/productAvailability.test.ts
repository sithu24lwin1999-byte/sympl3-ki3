import { describe, expect, it } from 'vitest';
import { isProductAvailableForBranch, productBranchLabel } from '../productAvailability';
import type { Product } from '@/types';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  shopId: 'shop-a',
  name: 'Photobooth Service',
  sku: 'PHOTO',
  category: 'Photobooth Services',
  price: 10000,
  cost: 0,
  stock: 0,
  minStock: 0,
  status: 'In Stock',
  image: '',
  itemType: 'SERVICE',
  trackStock: false,
  ...overrides,
});

describe('photobooth product branch availability', () => {
  it('keeps non-photobooth products available to every branch', () => {
    expect(isProductAvailableForBranch(product({ availableBranchIds: ['branch-a'] }), 'branch-b', 'RETAIL')).toBe(true);
  });

  it('treats missing or empty branch assignments as all branches for photobooth shops', () => {
    expect(isProductAvailableForBranch(product(), 'branch-a', 'PHOTOBOOTH')).toBe(true);
    expect(isProductAvailableForBranch(product({ availableBranchIds: [] }), 'branch-a', 'PHOTOBOOTH')).toBe(true);
  });

  it('restricts selected photobooth products to their assigned branches', () => {
    const scoped = product({ availableBranchIds: ['branch-a'] });
    expect(isProductAvailableForBranch(scoped, 'branch-a', 'PHOTOBOOTH')).toBe(true);
    expect(isProductAvailableForBranch(scoped, 'branch-b', 'PHOTOBOOTH')).toBe(false);
  });

  it('shows a readable branch label for owner inventory', () => {
    const names = new Map([['branch-a', 'Downtown'], ['branch-b', 'Mall']]);
    expect(productBranchLabel(product({ availableBranchIds: ['branch-a', 'branch-b'] }), names, 'PHOTOBOOTH')).toBe('Downtown, Mall');
    expect(productBranchLabel(product({ availableBranchIds: [] }), names, 'PHOTOBOOTH')).toBe('All branches');
  });
});
