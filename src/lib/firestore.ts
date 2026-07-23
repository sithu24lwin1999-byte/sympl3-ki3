import { useEffect, useState } from 'react';
import { addDoc, collection, collectionGroup, deleteDoc, doc, DocumentData, DocumentReference, getDocs, onSnapshot, orderBy, query, runTransaction, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AccountingTransaction, DueCollection, Order, OrderStatus, PaymentAllocation, PaymentKind, PaymentTransaction, Product, Purchase, PurchaseReturn, SalesReturn, StockMovement } from '@/types';
import { stockStatus } from './pos';
import { firestoreSafeId, normalizeSaleOrder, saleLedgerRecords } from './checkout';
import { dataErrorMessage } from './security';

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
    }, issue => { setError(dataErrorMessage(issue)); setLoading(false); });
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
    }, issue => { setError(dataErrorMessage(issue)); setLoading(false); });
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
    }, issue => { setError(dataErrorMessage(issue)); setLoading(false); });
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
      setError(dataErrorMessage(issue));
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
  'auditLogs', 'branches', 'coupons', 'customers', 'dueCollections', 'employees', 'expenseCategories', 'expenses', 'notifications', 'orders',
  'accountingTransactions', 'heldOrders', 'paymentAccounts', 'paymentTransactions', 'products', 'promotions', 'purchaseReturns', 'purchases', 'salesReturns', 'settings', 'shifts',
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
  const normalized = normalizeSaleOrder(shopId, order);
  const orderRef = doc(db, `shops/${shopId}/orders/sale-${firestoreSafeId(normalized.idempotencyKey!)}`);
  const ledger = saleLedgerRecords(normalized, orderRef.id);
  const paymentRef = doc(db, `shops/${shopId}/paymentTransactions/${ledger.paymentTransactionId}`);
  const accountingRef = doc(db, `shops/${shopId}/accountingTransactions/${ledger.accountingTransactionId}`);
  const created = await runTransaction(db, async transaction => {
    const existingOrder = await transaction.get(orderRef);
    if (existingOrder.exists()) {
      if (existingOrder.data().idempotencyKey !== normalized.idempotencyKey) throw new Error('This sale identifier is already in use.');
      return false;
    }
    const productRefs = normalized.items.map(item => doc(db, `shops/${shopId}/products/${item.productId}`));
    const settingsRef = doc(db, `shops/${shopId}/settings/general`);
    const [settingsSnapshot, ...productSnapshots] = await Promise.all([
      transaction.get(settingsRef),
      ...productRefs.map(reference => transaction.get(reference)),
    ]);
    const allowNegativeStock = settingsSnapshot.exists() && settingsSnapshot.data().allowNegativeStock === true;
    for (const [index, item] of normalized.items.entries()) {
      const productRef = productRefs[index];
      const snapshot = productSnapshots[index];
      if (!snapshot.exists()) throw new Error(`${item.name} is no longer available.`);
      const product = snapshot.data() as Product;
      if (product.itemType === 'SERVICE' || product.trackStock === false) continue;
      if (!allowNegativeStock && product.stock < item.quantity) throw new Error(`Not enough stock for ${item.name}. Available: ${product.stock}.`);
      const stock = product.stock - item.quantity;
      const movementRef = doc(db, `shops/${shopId}/stockMovements/sale-${orderRef.id}-${item.productId}`);
      transaction.update(productRef, { stock, status: stockStatus(stock, product.minStock), lastOrderId: orderRef.id, lastMovementId: movementRef.id });
      transaction.set(movementRef, {
        shopId, orderId: orderRef.id, productId: item.productId, productName: item.name, type: 'SALE', quantity: -item.quantity,
        before: product.stock, balance: stock, reason: 'Sales deduction', actorId: normalized.employeeId || '', sourceId: orderRef.id, note: `Order ${orderRef.id}`, createdAt: normalized.createdAt,
      });
    }
    transaction.set(paymentRef, ledger.payment);
    transaction.set(accountingRef, ledger.accounting);
    transaction.set(orderRef, {
      ...normalized,
      paymentTransactionId: paymentRef.id,
      accountingTransactionId: accountingRef.id,
    });
    return true;
  });
  return { id: orderRef.id, created };
}

async function reverseOrder(shopId: string, order: Order, status: 'CANCELLED' | 'REFUNDED', reason: string) {
  await runTransaction(db, async transaction => {
    const orderRef = doc(db, `shops/${shopId}/orders/${order.id}`);
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) throw new Error('Order not found.');
    const current = { id: orderSnapshot.id, ...orderSnapshot.data() } as Order;
    if (current.status === 'CANCELLED' || current.status === 'REFUNDED') throw new Error(`This order is already ${current.status.toLowerCase()}.`);
    if (status === 'REFUNDED' && current.status !== 'COMPLETED') throw new Error('Only a completed order can be refunded.');
    if (status === 'CANCELLED' && current.status === 'COMPLETED') throw new Error('A completed sale must be refunded, not cancelled.');
    const restockItems = current.status === 'COMPLETED' ? current.items : [];
    const productRefs = restockItems.map(item => doc(db, `shops/${shopId}/products/${item.productId}`));
    const customerRef = current.customerPhone ? doc(db, `shops/${shopId}/customers/${current.customerPhone.replace(/\W/g, '')}`) : null;
    const [snapshots, customerSnapshot, shopSnapshot] = await Promise.all([
      Promise.all(productRefs.map(reference => transaction.get(reference))),
      customerRef ? transaction.get(customerRef) : Promise.resolve(null),
      transaction.get(doc(db, `shops/${shopId}`)),
    ]);
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
    if (status === 'REFUNDED') {
      const returnRef = doc(db, `shops/${shopId}/salesReturns/${order.id}`);
      const paymentRef = doc(db, `shops/${shopId}/paymentTransactions/refund-${order.id}`);
      const accountingRef = doc(db, `shops/${shopId}/accountingTransactions/refund-${order.id}`);
      const paidAmount = current.paidAmount ?? Math.max(0, current.total - (current.dueAmount || 0));
      const refundPaymentKind = current.paymentKind || (current.payments && current.payments.length > 1 ? 'SPLIT' : current.payments?.[0]?.kind) || 'CASH';
      const payments = current.payments?.filter(payment => payment.kind !== 'CREDIT') || [{
        kind: (refundPaymentKind === 'SPLIT' || refundPaymentKind === 'CREDIT' ? 'CASH' : refundPaymentKind) as Exclude<PaymentKind, 'SPLIT'>,
        label: current.paymentMethod, amount: paidAmount,
      }];
      const refundKey = `refund-${order.id}`;
      const record: Omit<SalesReturn, 'id'> = {
        shopId, orderId: order.id, orderNumber: current.orderNumber || current.id, customer: current.customer,
        items: current.items, total: current.total, reason, actorId: auth.currentUser?.uid || '', actorName: auth.currentUser?.displayName || 'Shop user', createdAt: now,
      };
      transaction.set(returnRef, record);
      transaction.set(paymentRef, {
        shopId, orderId: order.id, sourceType: 'REFUND', sourceId: returnRef.id, direction: 'OUT', status: 'COMPLETED',
        amount: paidAmount, dueAmount: 0, paymentMethod: current.paymentMethod, paymentKind: refundPaymentKind, payments,
        actorId: auth.currentUser?.uid || '', actorName: auth.currentUser?.displayName || 'Shop user',
        idempotencyKey: refundKey, createdAt: now,
      } satisfies Omit<PaymentTransaction, 'id'>);
      transaction.set(accountingRef, {
        shopId, orderId: order.id, sourceType: 'REFUND', sourceId: returnRef.id, direction: 'DEBIT', account: 'SALES_RETURNS',
        amount: current.total, paidAmount, receivableAmount: current.dueAmount || 0, taxAmount: current.tax,
        costAmount: current.items.reduce((sum, item) => sum + (item.cost || 0) * item.quantity, 0),
        actorId: auth.currentUser?.uid || '', actorName: auth.currentUser?.displayName || 'Shop user',
        idempotencyKey: refundKey, createdAt: now,
      } satisfies Omit<AccountingTransaction, 'id'>);
      if (customerRef && customerSnapshot?.exists() && shopSnapshot.data()?.ownerId === auth.currentUser?.uid && (current.dueAmount || 0) > 0) {
        transaction.update(customerRef, { outstandingCredit: Math.max(0, (customerSnapshot.data().outstandingCredit || 0) - (current.dueAmount || 0)), updatedAt: now });
      }
    }
    transaction.update(orderRef, status === 'REFUNDED'
      ? { status, refundedAt: now, refundReason: reason, refundPaymentTransactionId: `refund-${order.id}`, refundAccountingTransactionId: `refund-${order.id}` }
      : { status, cancelledAt: now, cancelReason: reason });
  });
}

export const refundOrder = (shopId: string, order: Order, reason = '') => reverseOrder(shopId, order, 'REFUNDED', reason);
export const cancelOrder = (shopId: string, order: Order, reason = '') => reverseOrder(shopId, order, 'CANCELLED', reason);

export async function collectOrderDue(shopId: string, orderId: string, input: {
  amount: number;
  paymentKind: Exclude<PaymentKind, 'CREDIT' | 'SPLIT'>;
  paymentMethod: string;
  reference?: string;
  actorId: string;
  actorName: string;
}) {
  const orderRef = doc(db, `shops/${shopId}/orders/${orderId}`);
  const collectionRef = doc(collection(db, `shops/${shopId}/dueCollections`));
  const paymentRef = doc(db, `shops/${shopId}/paymentTransactions/due-${collectionRef.id}`);
  const accountingRef = doc(db, `shops/${shopId}/accountingTransactions/due-${collectionRef.id}`);
  const createdAt = new Date().toISOString();
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error('Order not found.');
    const order = { id: snapshot.id, ...snapshot.data() } as Order;
    if (order.status !== 'COMPLETED') throw new Error('Only completed orders can receive due payments.');
    const due = order.dueAmount ?? (order.paymentKind === 'CREDIT' ? order.total : 0);
    if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > due) throw new Error(`Collection must be between 1 and ${due}.`);
    const paid = order.paidAmount ?? Math.max(0, order.total - due);
    const customerRef = order.customerPhone ? doc(db, `shops/${shopId}/customers/${order.customerPhone.replace(/\W/g, '')}`) : null;
    const customerSnapshot = customerRef ? await transaction.get(customerRef) : null;
    const record: Omit<DueCollection, 'id'> = {
      shopId, orderId, orderNumber: order.orderNumber || order.id, customer: order.customer,
      amount: input.amount, paymentKind: input.paymentKind, paymentMethod: input.paymentMethod,
      reference: input.reference?.trim() || '', actorId: input.actorId, actorName: input.actorName,
      paymentTransactionId: paymentRef.id, accountingTransactionId: accountingRef.id, createdAt,
    };
    transaction.update(orderRef, {
      paidAmount: paid + input.amount, dueAmount: due - input.amount, statusUpdatedAt: createdAt,
      lastDueCollectionId: collectionRef.id, lastDuePaymentTransactionId: paymentRef.id, lastDueAccountingTransactionId: accountingRef.id,
    });
    if (customerRef && customerSnapshot?.exists()) transaction.update(customerRef, { outstandingCredit: Math.max(0, (customerSnapshot.data().outstandingCredit || 0) - input.amount), updatedAt: createdAt });
    const allocation: PaymentAllocation = { kind: input.paymentKind, label: input.paymentMethod, amount: input.amount, reference: input.reference?.trim() || '' };
    transaction.set(paymentRef, {
      shopId, orderId, sourceType: 'DUE_COLLECTION', sourceId: collectionRef.id, direction: 'IN', status: 'COMPLETED',
      amount: input.amount, dueAmount: Math.max(0, due - input.amount), paymentMethod: input.paymentMethod, paymentKind: input.paymentKind,
      payments: [allocation], actorId: input.actorId, actorName: input.actorName, idempotencyKey: `due-${collectionRef.id}`, createdAt,
    } satisfies Omit<PaymentTransaction, 'id'>);
    transaction.set(accountingRef, {
      shopId, orderId, sourceType: 'DUE_COLLECTION', sourceId: collectionRef.id, direction: 'DEBIT', account: 'CASH',
      amount: input.amount, paidAmount: input.amount, receivableAmount: Math.max(0, due - input.amount),
      actorId: input.actorId, actorName: input.actorName, idempotencyKey: `due-${collectionRef.id}`, createdAt,
    } satisfies Omit<AccountingTransaction, 'id'>);
    transaction.set(collectionRef, record);
  });
  return collectionRef.id;
}

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

export async function returnPurchase(shopId: string, purchaseId: string, input: { quantity: number; reason: string; actorId: string; actorName: string }) {
  const purchaseRef = doc(db, `shops/${shopId}/purchases/${purchaseId}`);
  const returnRef = doc(collection(db, `shops/${shopId}/purchaseReturns`));
  const now = new Date().toISOString();
  await runTransaction(db, async transaction => {
    const purchaseSnapshot = await transaction.get(purchaseRef);
    if (!purchaseSnapshot.exists()) throw new Error('Purchase not found.');
    const purchase = { id: purchaseSnapshot.id, ...purchaseSnapshot.data() } as Purchase;
    const alreadyReturned = purchase.returnedQuantity || 0;
    const available = purchase.quantity - alreadyReturned;
    if (!Number.isFinite(input.quantity) || input.quantity <= 0 || input.quantity > available) throw new Error(`Return quantity must be between 1 and ${available}.`);
    const productRef = doc(db, `shops/${shopId}/products/${purchase.productId}`);
    const productSnapshot = await transaction.get(productRef);
    if (!productSnapshot.exists()) throw new Error('Product not found.');
    const product = productSnapshot.data() as Product;
    if (product.itemType === 'SERVICE' || product.trackStock === false) throw new Error('This item does not track stock.');
    if (product.stock < input.quantity) throw new Error(`Only ${product.stock} item(s) are currently available to return.`);
    const stock = product.stock - input.quantity;
    const returnedQuantity = alreadyReturned + input.quantity;
    const movementRef = doc(collection(db, `shops/${shopId}/stockMovements`));
    const record: Omit<PurchaseReturn, 'id'> = {
      shopId, purchaseId, supplierId: purchase.supplierId, supplierName: purchase.supplierName,
      productId: purchase.productId, productName: purchase.productName, quantity: input.quantity,
      unitCost: purchase.unitCost, total: purchase.unitCost * input.quantity, reason: input.reason,
      actorId: input.actorId, actorName: input.actorName, createdAt: now,
    };
    transaction.update(productRef, { stock, status: stockStatus(stock, product.minStock), lastMovementId: movementRef.id, updatedAt: now });
    transaction.update(purchaseRef, { returnedQuantity, returnStatus: returnedQuantity === purchase.quantity ? 'RETURNED' : 'PARTIAL' });
    transaction.set(returnRef, record);
    transaction.set(movementRef, { shopId, productId: purchase.productId, productName: purchase.productName, type: 'PURCHASE_RETURN', quantity: -input.quantity, before: product.stock, balance: stock, reason: input.reason, actorId: input.actorId, actorName: input.actorName, sourceId: returnRef.id, createdAt: now } satisfies Omit<StockMovement, 'id'>);
  });
  return returnRef.id;
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
