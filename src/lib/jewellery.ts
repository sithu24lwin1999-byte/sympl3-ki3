import type { JewelleryDetails, Product } from '@/types';

export const jewelleryCategories = ['Gold', 'Diamond', 'Ring', 'Necklace', 'Bracelet', 'Earrings', 'Gemstone', 'Silver', 'Repair Service'];

export function isJewelleryProduct(product: Product) {
  return Boolean(product.jewellery);
}

export function jewellerySummary(details?: JewelleryDetails) {
  if (!details) return '';
  const parts = [
    details.metalType?.replaceAll('_', ' '),
    details.purity,
    details.netWeightGram ? `${details.netWeightGram}g net` : details.grossWeightGram ? `${details.grossWeightGram}g gross` : '',
    details.stoneWeightCarat ? `${details.stoneWeightCarat}ct` : '',
    details.certificateNumber ? `Cert ${details.certificateNumber}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

export function jewelleryInventoryValue(products: Product[]) {
  return products.reduce((sum, product) => {
    if (product.active === false || product.itemType === 'SERVICE' || product.trackStock === false) return sum;
    return sum + product.stock * product.cost;
  }, 0);
}

export function jewelleryRetailValue(products: Product[]) {
  return products.reduce((sum, product) => {
    if (product.active === false || product.itemType === 'SERVICE' || product.trackStock === false) return sum;
    return sum + product.stock * product.price;
  }, 0);
}
