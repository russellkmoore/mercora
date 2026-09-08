import { describe, expect, it } from 'vitest';
import {
  canFulfillInventory,
  isInventoryAvailable,
  isVariantAvailable,
} from '@/lib/inventory/availability';
import {
  assertCheckoutInventoryAvailable,
  stageInventoryAdjustments,
  stagePaidInventoryAdjustments,
} from '@/lib/services/inventory-adjustments';
import { isGiftCardOrderLine } from '@/lib/gift-cards/checkout';
import type { Order, OrderItem } from '@/lib/types/order';

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

// CAT-04: a paid gift-card line is stored value, not catalog stock, and must
// never reach the inventory decrement path. `isGiftCardOrderLine` is the
// predicate `aggregateOrderDemand` uses to skip it (lib/services/inventory-adjustments.ts).
describe('paid-order gift-card skip', () => {
  function giftCardOrderItem(): OrderItem {
    return {
      id: 'line-gift-card',
      product_id: 'prod_33',
      variant_id: 'variant_33',
      sku: 'GC-025',
      quantity: 1,
      unit_price: { amount: 2500, currency: 'USD' },
      total_price: { amount: 2500, currency: 'USD' },
      product_name: 'Voltique Gift Card',
      fulfillment_type: 'digital',
      gift_card: {
        recipientEmail: 'recipient@example.com',
        recipientName: 'Recipient',
      },
    };
  }

  function physicalOrderItem(): OrderItem {
    return {
      id: 'line-physical',
      product_id: 'product-1',
      variant_id: 'variant-physical-1',
      sku: 'TRAIL-1',
      quantity: 2,
      unit_price: { amount: 5900, currency: 'USD' },
      total_price: { amount: 11800, currency: 'USD' },
      product_name: 'Trail Pack',
      fulfillment_type: 'physical',
    };
  }

  /** A hand-written D1 fake — real code path, no module mocking. */
  function fakeDatabase() {
    const boundCalls: unknown[][] = [];
    const database = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => {
          boundCalls.push(args);
          return { sql, args };
        },
      }),
      batch: async (statements: unknown[]) => statements.map(() => ({})),
    };
    return { database, boundCalls };
  }

  it('identifies a gift-card order line only when the digital gift_card field is present', () => {
    expect(isGiftCardOrderLine(giftCardOrderItem())).toBe(true);
    expect(isGiftCardOrderLine({ ...giftCardOrderItem(), gift_card: undefined })).toBe(false);
  });

  it('stages nothing and never resolves a database for a gift-card-only paid order', async () => {
    const order: Order = {
      id: 'order-gift-card-only',
      status: 'processing',
      payment_status: 'paid',
      total_amount: { amount: 2500, currency: 'USD' },
      currency_code: 'USD',
      items: [giftCardOrderItem()],
    };

    // No options bag, no injected database: this resolves only because
    // aggregateOrderDemand's gift-card skip leaves the demand map empty and
    // stageInventoryAdjustments returns before ever calling resolveDatabase.
    await expect(stagePaidInventoryAdjustments(order)).resolves.toBeUndefined();
  });

  it('stages exactly one adjustment for the physical line when a gift-card line and a physical line share an order', async () => {
    const { database, boundCalls } = fakeDatabase();
    const order: Order = {
      id: 'order-mixed',
      status: 'processing',
      payment_status: 'paid',
      total_amount: { amount: 8400, currency: 'USD' },
      currency_code: 'USD',
      items: [giftCardOrderItem(), physicalOrderItem()],
    };

    await stagePaidInventoryAdjustments(order, { database: database as unknown as D1Database });

    expect(boundCalls).toHaveLength(1);
    expect(boundCalls[0]).toContain('variant-physical-1');
    expect(boundCalls[0]).not.toContain('variant_33');
  });

  it('resolves gift-card-only checkout availability without resolving a database', async () => {
    await expect(assertCheckoutInventoryAvailable([giftCardOrderItem()])).resolves.toBeUndefined();
  });
});
