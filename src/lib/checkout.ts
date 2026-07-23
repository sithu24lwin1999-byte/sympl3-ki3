import type { AccountingTransaction, Order, PaymentAllocation, PaymentTransaction } from '@/types';

export const SALE_SCHEMA_VERSION = 2;
const MAX_MONEY = 100_000_000_000;
const MAX_ITEMS = 200;
const MONEY_TOLERANCE = 0.01;

function isMoney(value: number) {
  return Number.isFinite(value) && value >= 0 && value < MAX_MONEY;
}

function almostEqual(left: number, right: number) {
  return Math.abs(left - right) <= MONEY_TOLERANCE;
}

export function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function firestoreSafeId(value: string) {
  const safe = value.trim().replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 128);
  if (safe.length < 8) throw new Error('The sale idempotency key is invalid.');
  return safe;
}

export function parseOfflineSales(value: string | null): Array<Omit<Order, 'id'>> {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is Omit<Order, 'id'> => Boolean(item && typeof item === 'object')) : [];
  } catch {
    return [];
  }
}

export function normalizeSaleOrder(shopId: string, input: Omit<Order, 'id'>): Omit<Order, 'id'> {
  if (!shopId || input.shopId !== shopId) throw new Error('The sale does not belong to the active shop.');
  if (input.status !== 'COMPLETED') throw new Error('Only completed sales can use the checkout transaction.');
  if (!input.employeeId || !input.employeeName?.trim()) throw new Error('A cashier is required to complete this sale.');
  if (!input.customer.trim() || input.customer.length > 200 || input.customerPhone && input.customerPhone.length > 40 || input.notes && input.notes.length > 2_000 || !input.paymentMethod.trim() || input.paymentMethod.length > 120) {
    throw new Error('The sale contains invalid customer, note or payment details.');
  }
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > MAX_ITEMS) throw new Error(`A sale must contain between 1 and ${MAX_ITEMS} items.`);
  if (new Set(input.items.map(item => item.productId)).size !== input.items.length) throw new Error('Duplicate products must be combined into one order line.');
  for (const item of input.items) {
    if (!item.productId || !item.name.trim() || item.name.length > 200 || !Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100_000 || !isMoney(item.price) || (item.cost !== undefined && !isMoney(item.cost))) {
      throw new Error('The sale contains an invalid product, quantity or price.');
    }
  }
  const money = [input.subtotal, input.discount, input.tax, input.serviceCharge || 0, input.deliveryCharge || 0, input.total, input.paidAmount ?? 0, input.dueAmount ?? 0];
  if (money.some(value => !isMoney(value))) throw new Error('The sale contains an invalid monetary amount.');
  const calculatedSubtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const calculatedTotal = input.subtotal - input.discount + input.tax + (input.serviceCharge || 0) + (input.deliveryCharge || 0);
  if (!almostEqual(input.subtotal, calculatedSubtotal) || !almostEqual(input.total, calculatedTotal)) throw new Error('The sale totals do not match its order lines.');
  const payments = input.payments || [];
  if (!payments.length || payments.some(payment => !payment.label.trim() || payment.label.length > 120 || !isMoney(payment.amount) || payment.reference && payment.reference.length > 200 || payment.accountNumber && payment.accountNumber.length > 100)) {
    throw new Error('At least one valid payment allocation is required.');
  }
  const allocated = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const paid = payments.filter(payment => payment.kind !== 'CREDIT').reduce((sum, payment) => sum + payment.amount, 0);
  const due = payments.filter(payment => payment.kind === 'CREDIT').reduce((sum, payment) => sum + payment.amount, 0);
  if (!almostEqual(allocated, input.total) || !almostEqual(paid, input.paidAmount ?? 0) || !almostEqual(due, input.dueAmount ?? 0) || !almostEqual(paid + due, input.total)) {
    throw new Error('Payment allocations, paid amount and due amount must equal the sale total.');
  }
  if (!input.createdAt || Number.isNaN(Date.parse(input.createdAt))) throw new Error('The sale date is invalid.');
  const idempotencyKey = input.idempotencyKey || input.orderNumber || createIdempotencyKey();
  const paymentKind = input.paymentKind || (payments.length > 1 ? 'SPLIT' : payments[0].kind);
  firestoreSafeId(idempotencyKey);
  return { ...input, paymentKind, schemaVersion: SALE_SCHEMA_VERSION, idempotencyKey };
}

export function saleLedgerRecords(order: Omit<Order, 'id'>, orderId: string) {
  const paymentTransactionId = `sale-${orderId}`;
  const accountingTransactionId = `sale-${orderId}`;
  const payments = order.payments as PaymentAllocation[];
  const paidAmount = order.paidAmount || 0;
  const dueAmount = order.dueAmount || 0;
  const actorId = order.employeeId || '';
  const actorName = order.employeeName || 'Shop user';
  const idempotencyKey = order.idempotencyKey as string;
  const payment: Omit<PaymentTransaction, 'id'> = {
    shopId: order.shopId, orderId, sourceType: 'SALE', sourceId: orderId, direction: 'IN', status: 'COMPLETED',
    amount: paidAmount, dueAmount, paymentMethod: order.paymentMethod, paymentKind: order.paymentKind, payments,
    actorId, actorName, idempotencyKey, createdAt: order.createdAt,
  };
  const accounting: Omit<AccountingTransaction, 'id'> = {
    shopId: order.shopId, orderId, sourceType: 'SALE', sourceId: orderId, direction: 'CREDIT', account: 'SALES',
    amount: order.total, paidAmount, receivableAmount: dueAmount, taxAmount: order.tax,
    costAmount: order.items.reduce((sum, item) => sum + (item.cost || 0) * item.quantity, 0),
    actorId, actorName, idempotencyKey, createdAt: order.createdAt,
  };
  return { paymentTransactionId, accountingTransactionId, payment, accounting };
}
