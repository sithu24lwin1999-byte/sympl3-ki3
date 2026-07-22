export function calculateTotals(subtotal: number, discountPercent: number, taxPercent = 5) {
  const safeDiscount = Math.min(Math.max(discountPercent, 0), 100);
  const discount = subtotal * safeDiscount / 100;
  const tax = subtotal * Math.max(taxPercent, 0) / 100;
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}

export function stockStatus(stock: number, minimum = 10) {
  return stock <= 0 ? 'Out of Stock' : stock <= minimum ? 'Low Stock' : 'In Stock';
}
