import type { Expense, Order } from '@/types';

export function localDateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calculateBranchDailyFinance(branchId: string, date: string, orders: Order[], expenses: Expense[]) {
  const branchOrders = orders.filter(order => localDateKey(order.createdAt) === date && order.status === 'COMPLETED' && (order.branchId || 'main') === branchId);
  const branchExpenses = expenses.filter(expense => localDateKey(expense.createdAt) === date && (expense.branchId || 'main') === branchId);
  const income = branchOrders.reduce((sum, order) => sum + order.total, 0);
  const operating = branchExpenses.filter(expense => expense.type !== 'OWNER_WITHDRAWAL').reduce((sum, expense) => sum + expense.amount, 0);
  const withdrawals = branchExpenses.filter(expense => expense.type === 'OWNER_WITHDRAWAL').reduce((sum, expense) => sum + expense.amount, 0);
  return { orders: branchOrders.length, income, operating, withdrawals, net: income - operating - withdrawals };
}
