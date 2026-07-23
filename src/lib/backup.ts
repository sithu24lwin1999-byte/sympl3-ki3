import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export interface ShopBackup {
  format: 'KI3_SHOP_BACKUP';
  version: 1;
  shopId: string;
  createdAt: string;
  collections: Record<string, Array<{ id: string; data: Record<string, unknown> }>>;
}

const backupCollections = [
  'branches', 'coupons', 'customers', 'dueCollections', 'expenseCategories', 'expenses', 'heldOrders', 'notifications',
  'orders', 'paymentAccounts', 'products', 'promotions', 'purchaseReturns', 'purchases', 'salesReturns', 'settings',
  'shifts', 'stockMovements', 'suppliers',
] as const;
const restorableCollections = new Set([
  'branches', 'coupons', 'customers', 'expenseCategories', 'expenses', 'heldOrders', 'notifications', 'orders',
  'paymentAccounts', 'products', 'promotions', 'purchases', 'settings', 'shifts', 'suppliers',
]);

export async function createShopBackup(shopId: string): Promise<ShopBackup> {
  const snapshots = await Promise.all(backupCollections.map(name => getDocs(collection(db, `shops/${shopId}/${name}`))));
  const collections = Object.fromEntries(snapshots.map((snapshot, index) => [backupCollections[index], snapshot.docs.map(item => ({ id: item.id, data: item.data() }))]));
  return { format: 'KI3_SHOP_BACKUP', version: 1, shopId, createdAt: new Date().toISOString(), collections };
}

export function parseShopBackup(value: string, expectedShopId: string): ShopBackup {
  const parsed = JSON.parse(value) as Partial<ShopBackup>;
  if (parsed.format !== 'KI3_SHOP_BACKUP' || parsed.version !== 1 || parsed.shopId !== expectedShopId || !parsed.collections) throw new Error('This is not a valid backup for the current shop.');
  return parsed as ShopBackup;
}

export async function restoreShopBackup(backup: ShopBackup) {
  const existingProducts = new Set((await getDocs(collection(db, `shops/${backup.shopId}/products`))).docs.map(item => item.id));
  const records = Object.entries(backup.collections)
    .filter(([name]) => restorableCollections.has(name))
    .flatMap(([name, items]) => items.map(item => {
      if (name !== 'products') return { name, ...item };
      const data = { ...item.data };
      delete data.lastMovementId; delete data.lastOrderId;
      if (existingProducts.has(item.id)) { delete data.stock; delete data.status; }
      else { data.stock = 0; data.status = 'Out of Stock'; }
      return { name, id: item.id, data };
    }));
  for (let offset = 0; offset < records.length; offset += 400) {
    const batch = writeBatch(db);
    records.slice(offset, offset + 400).forEach(item => batch.set(doc(db, `shops/${backup.shopId}/${item.name}/${item.id}`), item.data, { merge: true }));
    await batch.commit();
  }
  return records.length;
}
