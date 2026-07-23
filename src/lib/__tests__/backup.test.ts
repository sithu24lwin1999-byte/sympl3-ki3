import { describe, expect, it } from 'vitest';
import { parseShopBackup } from '../backup';

describe('shop backup validation', () => {
  const backup = { format: 'KI3_SHOP_BACKUP', version: 1, shopId: 'shop-a', createdAt: '2026-07-23T00:00:00.000Z', collections: { customers: [] } };

  it('accepts a versioned backup for the current tenant', () => {
    expect(parseShopBackup(JSON.stringify(backup), 'shop-a').shopId).toBe('shop-a');
  });

  it('rejects cross-tenant and unknown backup files', () => {
    expect(() => parseShopBackup(JSON.stringify(backup), 'shop-b')).toThrow('current shop');
    expect(() => parseShopBackup('{}', 'shop-a')).toThrow('valid backup');
  });
});
