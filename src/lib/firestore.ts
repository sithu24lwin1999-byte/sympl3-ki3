import { useEffect, useState } from 'react';
import { addDoc, collection, collectionGroup, deleteDoc, doc, DocumentData, DocumentReference, getDocs, onSnapshot, orderBy, query, runTransaction, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Order, Product } from '@/types';
import { stockStatus } from './pos';

export function useLiveCollection<T extends { id: string }>(path: string | null, sortField?: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setData([]); setLoading(false); return; }
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
    const base = collectionGroup(db, name);
    const source = sortField ? query(base, orderBy(sortField, 'desc')) : base;
    return onSnapshot(source, snapshot => {
      setData(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as T)));
      setLoading(false); setError(null);
    }, issue => { setError(issue.message); setLoading(false); });
  }, [name, sortField]);
  return { data, loading, error };
}

export function useLiveDocument<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!path) { setData(null); return; }
    return onSnapshot(doc(db, path), snapshot => setData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null));
  }, [path]);
  return data;
}

export const createRecord = (path: string, value: DocumentData) => addDoc(collection(db, path), value);
export const setRecord = (path: string, id: string, value: DocumentData) => setDoc(doc(db, path, id), value, { merge: true });
export const updateRecord = (path: string, id: string, value: DocumentData) => updateDoc(doc(db, path, id), value);
export const deleteRecord = (path: string, id: string) => deleteDoc(doc(db, path, id));

const SHOP_SUBCOLLECTIONS = [
  'auditLogs', 'branches', 'customers', 'employees', 'expenses', 'orders',
  'paymentAccounts', 'products', 'purchases', 'settings', 'shifts',
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
    for (const item of order.items) {
      const productRef = doc(db, `shops/${shopId}/products/${item.productId}`);
      const snapshot = await transaction.get(productRef);
      if (!snapshot.exists()) throw new Error(`${item.name} is no longer available.`);
      const product = snapshot.data() as Product;
      if (product.itemType === 'SERVICE' || product.trackStock === false) continue;
      if (product.stock < item.quantity) throw new Error(`Not enough stock for ${item.name}.`);
      const stock = product.stock - item.quantity;
      transaction.update(productRef, { stock, status: stockStatus(stock, product.minStock) });
      transaction.set(doc(collection(db, `shops/${shopId}/stockMovements`)), {
        shopId, productId: item.productId, productName: item.name, type: 'SALE', quantity: -item.quantity,
        balance: stock, note: `Order ${orderRef.id}`, createdAt: order.createdAt,
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
    if (current.status !== 'COMPLETED') throw new Error(`This order is already ${current.status.toLowerCase()}.`);
    for (const item of current.items) {
      const productRef = doc(db, `shops/${shopId}/products/${item.productId}`);
      const snapshot = await transaction.get(productRef);
      if (snapshot.exists()) {
        const product = snapshot.data() as Product;
        if (product.itemType === 'SERVICE' || product.trackStock === false) continue;
        const stock = product.stock + item.quantity;
        transaction.update(productRef, { stock, status: stockStatus(stock, product.minStock) });
        transaction.set(doc(collection(db, `shops/${shopId}/stockMovements`)), {
          shopId, productId: item.productId, productName: item.name, type: status === 'REFUNDED' ? 'REFUND' : 'ADJUSTMENT', quantity: item.quantity,
          balance: stock, note: `${status === 'REFUNDED' ? 'Refund' : 'Cancellation'} ${order.id}`, createdAt: new Date().toISOString(),
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

export async function receivePurchase(shopId: string, input: {
  supplierId?: string; supplierName: string; productId: string; productName: string;
  quantity: number; unitCost: number; createdAt: string;
}) {
  const purchaseRef = doc(collection(db, `shops/${shopId}/purchases`));
  await runTransaction(db, async transaction => {
    const productRef = doc(db, `shops/${shopId}/products/${input.productId}`);
    const snapshot = await transaction.get(productRef);
    if (!snapshot.exists()) throw new Error('Product not found.');
    const product = snapshot.data() as Product;
    const stock = product.stock + input.quantity;
    transaction.update(productRef, { stock, cost: input.unitCost, status: stockStatus(stock, product.minStock), updatedAt: input.createdAt });
    transaction.set(purchaseRef, { ...input, shopId, total: input.quantity * input.unitCost });
    transaction.set(doc(collection(db, `shops/${shopId}/stockMovements`)), {
      shopId, productId: input.productId, productName: input.productName, type: 'PURCHASE', quantity: input.quantity,
      balance: stock, note: input.supplierName, createdAt: input.createdAt,
    });
  });
  return purchaseRef.id;
}
