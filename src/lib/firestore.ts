import { useEffect, useState } from 'react';
import { addDoc, collection, collectionGroup, deleteDoc, doc, DocumentData, onSnapshot, orderBy, query, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
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

export async function completeSale(shopId: string, order: Omit<Order, 'id'>) {
  const orderRef = doc(collection(db, `shops/${shopId}/orders`));
  await runTransaction(db, async transaction => {
    for (const item of order.items) {
      const productRef = doc(db, `shops/${shopId}/products/${item.productId}`);
      const snapshot = await transaction.get(productRef);
      if (!snapshot.exists()) throw new Error(`${item.name} is no longer available.`);
      const product = snapshot.data() as Product;
      if (product.stock < item.quantity) throw new Error(`Not enough stock for ${item.name}.`);
      const stock = product.stock - item.quantity;
      transaction.update(productRef, { stock, status: stockStatus(stock, product.minStock) });
    }
    transaction.set(orderRef, order);
  });
  return orderRef.id;
}

export async function refundOrder(shopId: string, order: Order) {
  await runTransaction(db, async transaction => {
    const orderRef = doc(db, `shops/${shopId}/orders/${order.id}`);
    for (const item of order.items) {
      const productRef = doc(db, `shops/${shopId}/products/${item.productId}`);
      const snapshot = await transaction.get(productRef);
      if (snapshot.exists()) {
        const product = snapshot.data() as Product;
        const stock = product.stock + item.quantity;
        transaction.update(productRef, { stock, status: stockStatus(stock, product.minStock) });
      }
    }
    transaction.update(orderRef, { status: 'REFUNDED', refundedAt: new Date().toISOString() });
  });
}
