import { collection, count, getAggregateFromServer, getDocs, query, sum, where } from 'firebase/firestore';
import { db } from './firebase';
import type { DueCollection, Expense, Order, Product, Purchase } from '@/types';

export type ReportPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
export interface ReportRange { startDate: string; endDate: string; startIso: string; endIso: string }
export interface ReportTotals { sales: number; orders: number; initialPaid: number; due: number; purchases: number; purchaseReturns: number; expenses: number; dueCollected: number }
export interface ReportDetails { orders: Order[]; purchases: Purchase[]; expenses: Expense[]; dueCollections: DueCollection[] }

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function periodDates(period: ReportPeriod, now = new Date(), custom?: { startDate: string; endDate: string }) {
  if (period === 'CUSTOM' && custom?.startDate && custom.endDate) return custom;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  if (period === 'WEEKLY') start.setDate(end.getDate() - 6);
  if (period === 'MONTHLY') start.setDate(1);
  if (period === 'YEARLY') { start.setMonth(0); start.setDate(1); }
  return { startDate: localDate(start), endDate: localDate(end) };
}

export function reportRange(startDate: string, endDate: string): ReportRange {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw new Error('Choose a valid report date range.');
  return { startDate, endDate, startIso: start.toISOString(), endIso: end.toISOString() };
}

const rangeQuery = (path: string, startIso: string, endIso: string) => query(collection(db, path), where('createdAt', '>=', startIso), where('createdAt', '<=', endIso));
const completedOrdersQuery = (shopId: string, startIso: string, endIso: string) => query(collection(db, `shops/${shopId}/orders`), where('status', '==', 'COMPLETED'), where('createdAt', '>=', startIso), where('createdAt', '<=', endIso));

export async function getServerReportTotals(shopId: string, range: ReportRange): Promise<ReportTotals> {
  const [orders, purchases, purchaseReturns, expenses, dueCollections] = await Promise.all([
    getAggregateFromServer(completedOrdersQuery(shopId, range.startIso, range.endIso), { sales: sum('total'), orders: count(), initialPaid: sum('initialPaidAmount'), due: sum('dueAmount') }),
    getAggregateFromServer(rangeQuery(`shops/${shopId}/purchases`, range.startIso, range.endIso), { total: sum('total') }),
    getAggregateFromServer(rangeQuery(`shops/${shopId}/purchaseReturns`, range.startIso, range.endIso), { total: sum('total') }),
    getAggregateFromServer(rangeQuery(`shops/${shopId}/expenses`, range.startIso, range.endIso), { total: sum('amount') }),
    getAggregateFromServer(rangeQuery(`shops/${shopId}/dueCollections`, range.startIso, range.endIso), { total: sum('amount') }),
  ]);
  return { sales: orders.data().sales, orders: orders.data().orders, initialPaid: orders.data().initialPaid, due: orders.data().due, purchases: purchases.data().total, purchaseReturns: purchaseReturns.data().total, expenses: expenses.data().total, dueCollected: dueCollections.data().total };
}

const mapped = <T extends { id: string }>(snapshot: Awaited<ReturnType<typeof getDocs>>) => snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Record<string, unknown>) } as T));
export async function getReportDetails(shopId: string, range: ReportRange): Promise<ReportDetails> {
  const [orders, purchases, expenses, dueCollections] = await Promise.all([
    getDocs(completedOrdersQuery(shopId, range.startIso, range.endIso)),
    getDocs(rangeQuery(`shops/${shopId}/purchases`, range.startIso, range.endIso)),
    getDocs(rangeQuery(`shops/${shopId}/expenses`, range.startIso, range.endIso)),
    getDocs(rangeQuery(`shops/${shopId}/dueCollections`, range.startIso, range.endIso)),
  ]);
  return { orders: mapped<Order>(orders), purchases: mapped<Purchase>(purchases), expenses: mapped<Expense>(expenses), dueCollections: mapped<DueCollection>(dueCollections) };
}

export function reportBreakdowns(details: ReportDetails, products: Product[]) {
  const productById = new Map(products.map(product => [product.id, product]));
  const payments = new Map<string, number>();
  const productProfit = new Map<string, { name: string; quantity: number; sales: number; cost: number; profit: number }>();
  const categories = new Map<string, number>();
  const employees = new Map<string, number>();
  const channels = new Map<string, number>();
  let tax = 0;
  for (const order of details.orders) {
    tax += order.tax || 0;
    employees.set(order.employeeName || 'Unassigned', (employees.get(order.employeeName || 'Unassigned') || 0) + order.total);
    const channel = order.type === 'ONLINE' ? 'Online' : 'In-store';
    channels.set(channel, (channels.get(channel) || 0) + order.total);
    const allocations = order.payments?.length ? order.payments : [{ label: order.paymentMethod || order.paymentKind || 'Unknown', amount: order.total }];
    allocations.forEach(payment => payments.set(payment.label, (payments.get(payment.label) || 0) + payment.amount));
    order.items.forEach(item => {
      const current = productProfit.get(item.productId) || { name: item.name, quantity: 0, sales: 0, cost: 0, profit: 0 };
      const lineSales = item.price * item.quantity;
      const lineCost = (item.cost ?? productById.get(item.productId)?.cost ?? 0) * item.quantity;
      current.quantity += item.quantity; current.sales += lineSales; current.cost += lineCost; current.profit += lineSales - lineCost;
      productProfit.set(item.productId, current);
      const category = productById.get(item.productId)?.category || 'Uncategorized';
      categories.set(category, (categories.get(category) || 0) + lineSales);
    });
  }
  const rows = (map: Map<string, number>) => [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  return { tax, payments: rows(payments), products: [...productProfit.values()].sort((a, b) => b.profit - a.profit), categories: rows(categories), employees: rows(employees), channels: rows(channels) };
}
