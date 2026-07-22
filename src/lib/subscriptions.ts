import type { Shop, SubscriptionStatus, SubscriptionTransaction } from '@/types';

export const DEFAULT_EXPIRING_SOON_DAYS = 7;

export function todayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Yangon' });
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addCalendarMonths(value: string, months: number) {
  const source = parseDate(value);
  const day = source.getUTCDate();
  const target = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return dateKey(target);
}

export function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

export function daysRemaining(expiry: string, today = todayKey()) {
  return Math.ceil((parseDate(expiry).getTime() - parseDate(today).getTime()) / 86_400_000);
}

export function subscriptionState(shop: Pick<Shop, 'status' | 'expiry' | 'systemStatus'>, today = todayKey(), expiringSoonDays = DEFAULT_EXPIRING_SOON_DAYS): SubscriptionStatus {
  if (shop.systemStatus === 'ARCHIVED' || shop.status === 'CANCELLED') return 'CANCELLED';
  if (shop.systemStatus === 'STOPPED' || shop.status === 'SUSPENDED') return 'SUSPENDED';
  if (shop.expiry < today || shop.status === 'EXPIRED') return 'EXPIRED';
  if (shop.status === 'TRIAL') return 'TRIAL';
  if (daysRemaining(shop.expiry, today) <= expiringSoonDays) return 'EXPIRING_SOON';
  return 'ACTIVE';
}

export function renewalPeriod(currentExpiry: string, renewalDate = todayKey(), explicitStart?: string) {
  const periodStart = explicitStart || (currentExpiry >= renewalDate ? currentExpiry : renewalDate);
  return { periodStart, periodEnd: addCalendarMonths(periodStart, 1) };
}

export function paidSubscriptionRevenue(transactions: SubscriptionTransaction[]) {
  return transactions.filter(item => item.status === 'PAID').reduce((sum, item) => sum + item.amount, 0);
}

export function monthlyRecurringRevenue(shops: Shop[], today = todayKey()) {
  return shops.filter(shop => ['ACTIVE', 'EXPIRING_SOON'].includes(subscriptionState(shop, today))).reduce((sum, shop) => sum + (shop.monthlyFee || 0), 0);
}
