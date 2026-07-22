import { useEffect, useState } from 'react';
import { addDoc, collection, collectionGroup, deleteDoc, doc, DocumentData, DocumentReference, getDocs, onSnapshot, orderBy, query, runTransaction, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Order, OrderStatus, Product, StockMovement } from '@/types';
import { stockStatus } from './pos';

export function useLiveCollection<T extends { id: string }>(path: string | null, sortField?: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setData([]); setError(null); setLoading(false); return; }
    setLoading(true);
    const base = collection(db, path);
    const source = sortField ? query(base, orderBy(sortField, 'desc')) : base;
    return onSnapshot(source, snapshot => {
      setData(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as T)));
      setLoading(false);
      setError(null);
    }, issue => { setError(issue.message); setLoading(false); });
  }, [path, sortField]);
  return { data, loading, error };
}

export function useLiveCollectionGroup<T extends { id: string }>(name: string, sortField?: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true);
    const base = collectionGroup(db, name);
    const source = sortField ? query(base, orderBy(sortField, 'desc')) : base;
    return onSnapshot(source, snapshot => {
      setData(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as T)));
      setLoading(false); setError(null);
    }, issue => { setError(issue.message); setLoading(false); });
  }, [name, sortField]);
  return { data, loading, error };
}

export function useLiveCollectionWhere<T extends { id: string }>(path: string | null, field: string, value: string | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!path || value == null) { setData([]); setError(null); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(query(collection(db, path), where(field, '==', value)), snapshot => {
      setData(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as T)));
      setError(null);
      setLoading(false);
    }, issue => { setError(issue.message); setLoading(false); });
  }, [field, path, value]);
  return { data, loading, error };
}

export function useLiveDocument<T>(path: string | null) {
  return useLiveDocumentState<T>(path).data;
}

export function useLiveDocumentState<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setData(null); setError(null); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(doc(db, path), snapshot => {
      setData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null);
      setError(null);
      setLoading(false);
    }, issue => {
      setData(null);
      setError(issue.message);
      setLoading(false);
    });
  }, [path]);
  return { data, loading, error };
}

export const createRecord = (path: string, value: DocumentData) => addDoc(collection(db, path), value);
export const setRecord = (path: string, id: string, value: DocumentData) => setDoc(doc(db, path, id), value, { merge: true });
export const updateRecord = (path: string, id: string, value: DocumentData) => updateDoc(doc(db, path, id), value);
export const deleteRecord = (path: string, id: string) => deleteDoc(doc(db, path, id));

const SHOP_SUBCOLLECTIONS = [
  'auditLogs', 'branches', 'customers', 'employees', 'expenses', 'orders',
  'heldOrders', 'paymentAccounts', 'products', 'purchases', 'settings', 'shifts',
  'stockMovements', 'suppliers',
] as const;

async function deleteInBatches(references: DocumentReference[]) {
  for (let offset = 0; offset < references.length; offset += 450) {
    const batch = writeBatch(db);
    references.slice(offset, offset + 450).forEach(reference => batch.delete(reference));
    await batch.commit();
  }
}

export async function deleteShopCascade(shopId: string) {
  const subcollectionSnapshots = await Promise.all(
    SHOP_SUBCOLLECTIONS.map(name => getDocs(collection(db, `shops/${shopId}/${name}`))),
  );
  const assignedUsers = await getDocs(query(collection(db, 'users'), where('shopId', '==', shopId)));

  await deleteInBatches(subcollectionSnapshots.flatMap(snapshot => snapshot.docs.map(item => item.ref)));
  await deleteInBatches(assignedUsers.docs.map(item => item.ref));
  await deleteDoc(doc(db, 'shops', shopId));
}

export async function completeSale(shopId: string, order: Omit<Order, 'id'>) {
  const orderRef = doc(collection(db, `shops/${shopId}/orders`));
  await runTransaction(db, async transaction => {
    const productRefs = order.items.map(item => doc(db, `shops/${shopId}/products/${item.productId}`));
    const settingsRef = doc(db, `shops/${shopId}/settings/general`);
    const [settingsSnapshot, ...productSnapshots] = await Promise.all([
      transaction.get(settingsRef),
      ...productRefs.map(reference => transaction.get(reference)),
    ]);
    const allowNegativeStock = settingsSnapshot.exists() && settingsSnapshot.data().allowNegativeStock === true;
    for (const [index, item] of order.items.entries()) {
      const productRef = productRefs[index];
      const snapshot = productSnapshots[index];
      if (!snapshot.exists()) throw new Error(`${item.name} is no longer available.`);
      const product = snapshot.data() as Product;
      if (product.itemType === 'SERVICE' || product.trackStock === false) continue;
      if (!allowNegativeStock && product.stock < item.quantity) throw new Error(`Not enough stock for ${item.name}. Available: ${product.stock}.`);
      const stock = product.stock - item.quantity;
      const movementRef = doc(collection(db, `shops/${shopId}/stockMovements`));
      transaction.update(productRef, { stock, status: stockStatus(stock, product.minStock), lastOrderId: orderRef.id, lastMovementId: movementRef.id });
      transaction.set(movementRef, {
        shopId, orderId: orderRef.id, productId: item.productId, productName: item.name, type: 'SALE', quantity: -item.quantity,
        before: product.stock, balance: stock, reason: 'Sales deduction', actorId: order.employeeId || '', sourceId: orderRef.id, note: `Order ${orderRef.id}`, createdAt: order.createdAt,
      });
    }
    transaction.set(orderRef, order);
  });
  return orderRef.id;
}

async function reverseOrder(shopId: string, order: Order, status: 'CANCELLED' | 'REFUNDED', reason: string) {
  await runTransaction(db, async transaction => {
    const orderRef = doc(db, `shops/${shopId}/orders/${order.id}`);
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) throw new Error('Order not found.');
    const current = { id: orderSnapshot.id, ...orderSnapshot.data() } as Order;
    if (current.status === 'CANCELLED' || current.status === 'REFUNDED') throw new Error(`This order is already ${current.status.toLowerCase()}.`);
    if (status === 'REFUNDED' && current.status !== 'COMPLETED') throw new Error('Only a completed order can be refunded.');
    const restockItems = current.status === 'COMPLETED' ? current.items : [];
    const productRefs = restockItems.map(item => doc(db, `shops/${shopId}/products/${item.productId}`));
    const snapshots = await Promise.all(productRefs.map(reference => transaction.get(reference)));
    for (const [index, item] of restockItems.entries()) {
      const productRef = productRefs[index];
      const snapshot = snapshots[index];
      if (snapshot.exists()) {
        const product = snapshot.data() as Product;
        if (product.itemType === 'SERVICE' || product.trackStock === false) continue;
        const stock = product.stock + item.quantity;
        const movementRef = doc(collection(db, `shops/${shopId}/stockMovements`));
        transaction.update(productRef, { stock, status: stockStatus(stock, product.minStock), lastOrderId: order.id, lastMovementId: movementRef.id });
        transaction.set(movementRef, {
          shopId, orderId: order.id, productId: item.productId, productName: item.name, type: status === 'REFUNDED' ? 'REFUND' : 'ADJUSTMENT', quantity: item.quantity,
          before: product.stock, balance: stock, reason: status === 'REFUNDED' ? 'Sales-return restocking' : 'Cancelled-sale restocking', actorId: auth.currentUser?.uid || '', sourceId: order.id, note: `${status === 'REFUNDED' ? 'Refund' : 'Cancellation'} ${order.id}`, createdAt: new Date().toISOString(),
        });
      }
    }
    const now = new Date().toISOString();
    transaction.update(orderRef, status === 'REFUNDED'
      ? { status, refundedAt: now, refundReason: reason }
      : { status, cancelledAt: now, cancelReason: reason });
  });
}

export const refundOrder = (shopId: string, order: Order, reason = '') => reverseOrder(shopId, order, 'REFUNDED', reason);
export const cancelOrder = (shopId: string, order: Order, reason = '') => reverseOrder(shopId, order, 'CANCELLED', reason);

const nextStatuses: Partial<Record<OrderStatus, OrderStatus[]>> = {
  DRAFT: ['PENDING'], HELD: ['PENDING'], PENDING: ['CONFIRMED'], CONFIRMED: ['PREPARING'], PREPARING: ['READY'], READY: ['COMPLETED'],
};

export async function advanceOrderStatus(shopId: string, orderId: string, nextStatus: OrderStatus) {
  const reference = doc(db, `shops/${shopId}/orders/${orderId}`);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('Order not found.');
    const current = snapshot.data() as Order;
    if (!nextStatuses[current.status]?.includes(nextStatus)) throw new Error(`Order cannot move from ${current.status} to ${nextStatus}.`);
    const now = new Date().toISOString();
    const timestampField = nextStatus === 'CONFIRMED' ? { confirmedAt: now }
      : nextStatus === 'PREPARING' ? { preparingAt: now }
      : nextStatus === 'READY' ? { readyAt: now }
      : nextStatus === 'COMPLETED' ? { completedAt: now }
      : {};
    transaction.update(reference, { status: nextStatus, statusUpdatedAt: now, ...timestampField });
  });
}

export async function receivePurchase(shopId: string, input: {
  supplierId?: string; supplierName: string; productId: string; productName: string;
  quantity: number; unitCost: number; createdAt: string; actorId?: string; actorName?: string; reason?: string;
}) {
  const purchaseRef = doc(collection(db, `shops/${shopId}/purchases`));
  await runTransaction(db, async transaction => {
    const productRef = doc(db, `shops/${shopId}/products/${input.productId}`);
    const snapshot = await transaction.get(productRef);
    if (!snapshot.exists()) throw new Error('Product not found.');
    const product = snapshot.data() as Product;
    const stock = product.stock + input.quantity;
    if (product.maxStock !== undefined && stock > product.maxStock) throw new Error(`Receiving exceeds the maximum stock of ${product.maxStock}.`);
    const movementRef = doc(collection(db, `shops/${shopId}/stockMovements`));
    transaction.update(productRef, { stock, cost: input.unitCost, status: stockStatus(stock, product.minStock), supplierId: input.supplierId || '', supplierName: input.supplierName, lastMovementId: movementRef.id, updatedAt: input.createdAt });
    transaction.set(purchaseRef, { ...input, shopId, total: input.quantity * input.unitCost });
    transaction.set(movementRef, {
      shopId, productId: input.productId, productName: input.productName, type: 'PURCHASE', quantity: input.quantity,
      before: product.stock, balance: stock, reason: input.reason || 'Purchase receiving', actorId: input.actorId || '', actorName: input.actorName || '', sourceId: purchaseRef.id, note: input.supplierName, createdAt: input.createdAt,
    });
  });
  return purchaseRef.id;
}

export async function saveInventoryProduct(shopId: string, input: Omit<Product, 'id' | 'shopId' | 'status'> & { stock: number }, actor: { id: string; name: string }, productId?: string) {
  const productRef = productId ? doc(db, `shops/${shopId}/products/${productId}`) : doc(collection(db, `shops/${shopId}/products`));
  const now = new Date().toISOString();
  await runTransaction(db, async transaction => {
    const existing = productId ? await transaction.get(productRef) : null;
    if (productId && !existing?.exists()) throw new Error('Product not found.');
    const previousStock = existing?.data()?.stock as number | undefined;
    const stock = productId ? (previousStock || 0) : Math.max(0, input.stock);
    if (!productId && input.maxStock !== undefined && stock > input.maxStock) throw new Error(`Opening stock exceeds the maximum stock of ${input.maxStock}.`);
    const value = { ...input, stock, shopId, status: stockStatus(stock, input.minStock), updatedAt: now };
    if (!productId && stock > 0 && input.trackStock !== false && input.itemType !== 'SERVICE') {
      const movementRef = doc(collection(db, `shops/${shopId}/stockMovements`));
      transaction.set(productRef, { ...value, lastMovementId: movementRef.id, createdAt: now });
      transaction.set(movementRef, { shopId, productId: productRef.id, productName: input.name, type: 'STOCK_IN', quantity: stock, before: 0, balance: stock, reason: 'Opening stock', actorId: actor.id, actorName: actor.name, sourceId: productRef.id, createdAt: now } satisfies Omit<StockMovement, 'id'>);
    } else transaction.set(productRef, { ...value, ...(productId ? {} : { createdAt: now }) }, { merge: Boolean(productId) });
  });
  return productRef.id;
}

export async function adjustInventoryStock(shopId: string, productId: string, input: { mode: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'COUNT'; quantity: number; reason: string; actorId: string; actorName: string }) {
  const productRef = doc(db, `shops/${shopId}/products/${productId}`);
  const movementRef = doc(collection(db, `shops/${shopId}/stockMovements`));
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(productRef);
    if (!snapshot.exists()) throw new Error('Product not found.');
    const product = snapshot.data() as Product;
    if (product.itemType === 'SERVICE' || product.trackStock === false) throw new Error('Stock tracking is disabled for this item.');
    const before = product.stock;
    const balance = input.mode === 'COUNT' ? input.quantity : input.mode === 'STOCK_IN' ? before + input.quantity : input.mode === 'STOCK_OUT' ? before - input.quantity : before + input.quantity;
    if (!Number.isFinite(balance) || balance < 0) throw new Error('Stock cannot become negative.');
    if (product.maxStock !== undefined && balance > product.maxStock) throw new Error(`Stock cannot exceed the maximum of ${product.maxStock}.`);
    const difference = balance - before;
    if (difference === 0) throw new Error('The stock count did not change.');
    transaction.update(productRef, { stock: balance, status: stockStatus(balance, product.minStock), lastMovementId: movementRef.id, updatedAt: new Date().toISOString() });
    transaction.set(movementRef, { shopId, productId, productName: product.name, type: input.mode, quantity: difference, before, balance, reason: input.reason, actorId: input.actorId, actorName: input.actorName, sourceId: productId, createdAt: new Date().toISOString() } satisfies Omit<StockMovement, 'id'>);
  });
  return movementRef.id;
}
