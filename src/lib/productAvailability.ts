import type { BusinessType, Product } from '@/types';

export function isBranchScopedPhotoboothProduct(product: Product, businessType?: BusinessType) {
  return businessType === 'PHOTOBOOTH' && Array.isArray(product.availableBranchIds) && product.availableBranchIds.length > 0;
}

export function isProductAvailableForBranch(product: Product, branchId: string, businessType?: BusinessType) {
  if (!isBranchScopedPhotoboothProduct(product, businessType)) return true;
  return product.availableBranchIds!.includes(branchId || 'main');
}

export function productBranchLabel(product: Product, branchNames: Map<string, string>, businessType?: BusinessType) {
  if (businessType !== 'PHOTOBOOTH') return '';
  if (!isBranchScopedPhotoboothProduct(product, businessType)) return 'All branches';
  return product.availableBranchIds!.map(id => branchNames.get(id) || id).join(', ');
}
