import type { ProductInventory, ProductVariant } from '@/lib/types';

export function isInventoryAvailable(inventory: ProductInventory | null | undefined): boolean {
  if (!inventory?.track_inventory) return true;
  const quantity = inventory.quantity ?? 0;
  if (!Number.isSafeInteger(quantity)) return false;
  if (inventory.allow_backorder) return true;
  return quantity > 0;
}

export function canFulfillInventory(
  inventory: ProductInventory | null | undefined,
  requestedQuantity: number
): boolean {
  if (!Number.isSafeInteger(requestedQuantity) || requestedQuantity <= 0) return false;
  if (!inventory?.track_inventory) return true;
  const quantity = inventory.quantity ?? 0;
  if (!Number.isSafeInteger(quantity)) return false;
  return inventory.allow_backorder || quantity >= requestedQuantity;
}

export function isVariantAvailable(variant: Pick<ProductVariant, 'status' | 'inventory'>): boolean {
  return (variant.status == null || variant.status === 'active') &&
    isInventoryAvailable(variant.inventory);
}
