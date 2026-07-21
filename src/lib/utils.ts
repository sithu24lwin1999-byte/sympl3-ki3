import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-MM', {
    style: 'currency',
    currency: 'MMK',
    minimumFractionDigits: 0,
  }).format(amount).replace('MMK', '') + ' Ks';
}
