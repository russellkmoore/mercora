import { describe, expect, it } from 'vitest';
import {
  canFulfillInventory,
  isInventoryAvailable,
  isVariantAvailable,
} from '@/lib/inventory/availability';
import {
  assertCheckoutInventoryAvailable,
  stageInventoryAdjustments,
} from '@/lib/services/inventory-adjustments';

describe('shared storefront and checkout availability policy', () => {
  it('treats untracked and backorderable inventory as available', () => {
    expect(isInventoryAvailable(undefined)).toBe(true);
    expect(isInventoryAvailable({ track_inventory: false, quantity: 0 })).toBe(true);
    expect(isInventoryAvailable({
      track_inventory: true,
      quantity: -4,
      allow_backorder: true,
    })).toBe(true);
  });

  it('requires enough integer stock for tracked non-backorderable demand', () => {
    const inventory = { track_inventory: true, quantity: 3, allow_backorder: false };
    expect(canFulfillInventory(inventory, 3)).toBe(true);
    expect(canFulfillInventory(inventory, 4)).toBe(false);
    expect(canFulfillInventory(inventory, 0)).toBe(false);
    expect(canFulfillInventory({ ...inventory, quantity: 3.5 }, 1)).toBe(false);
    expect(isInventoryAvailable({ ...inventory, quantity: 3.5 })).toBe(false);
    expect(isInventoryAvailable({
      track_inventory: true,
      quantity: 3.5,
      allow_backorder: true,
    })).toBe(false);
  });

  it('combines active status with the same inventory policy', () => {
    expect(isVariantAvailable({ status: 'active', inventory: undefined })).toBe(true);
    expect(isVariantAvailable({
      status: 'inactive',
      inventory: { track_inventory: false },
    })).toBe(false);
    expect(isVariantAvailable({
      status: 'active',
      inventory: { track_inventory: true, quantity: 0 },
    })).toBe(false);
  });
});

describe('inventory adjustment input bounds', () => {
  it('rejects malformed quantities before resolving D1', async () => {
    await expect(assertCheckoutInventoryAvailable([{
      product_id: 'product',
      variant_id: 'variant',
      sku: 'SKU',
      quantity: 0,
      unit_price: { amount: 1, currency: 'USD' },
      total_price: { amount: 1, currency: 'USD' },
      product_name: 'Product',
    }])).rejects.toThrow('invalid quantity');
  });

  it('accepts an empty staging batch without resolving D1', async () => {
    await expect(stageInventoryAdjustments([])).resolves.toBeUndefined();
  });

  it('rejects adjustment keys that do not match their domain identity', async () => {
    await expect(stageInventoryAdjustments([{
      adjustmentKey: 'restock:wrong',
      orderId: 'order-1',
      lineId: 'line-1',
      variantId: 'variant-1',
      kind: 'refund_restock',
      quantity: 1,
    }])).rejects.toThrow('identity is invalid');
  });
});
