import { afterEach, describe, expect, it } from 'vitest';

import { migrateCartState, useCartStore } from '@/lib/stores/cart-store';
import type { StableCartItem } from '@/lib/types/cartitem';

const base = {
  productId: 'product-one',
  variantId: 'variant-2500',
  name: '$25 Gift Card',
  price: { amount: 2_500, currency: 'USD' },
  quantity: 1,
  primaryImageUrl: '',
};

describe('stable cart lines', () => {
  afterEach(() => useCartStore.setState({ items: [] }));

  it('merges identical facts and separates different recipients', () => {
    const addItem = useCartStore.getState().addItem;
    addItem({
      ...base,
      giftCardCustomization: { recipientEmail: 'ada@example.com' },
    });
    addItem({
      ...base,
      giftCardCustomization: { recipientEmail: ' ADA@example.com ' },
    });
    addItem({
      ...base,
      giftCardCustomization: { recipientEmail: 'grace@example.com' },
    });

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.quantity)).toEqual([2, 1]);
    expect(new Set(items.map((item) => item.lineId)).size).toBe(2);
  });

  it('updates and removes only the addressed stable line', () => {
    const store = useCartStore.getState();
    store.addItem({ ...base, giftCardCustomization: { recipientEmail: 'ada@example.com' } });
    store.addItem({ ...base, giftCardCustomization: { recipientEmail: 'grace@example.com' } });
    const [ada, grace] = useCartStore.getState().items;

    useCartStore.getState().updateQuantity(grace.lineId, 4);
    expect(useCartStore.getState().items.map((item) => item.quantity)).toEqual([1, 4]);
    useCartStore.getState().removeItem(ada.lineId);
    expect(useCartStore.getState().items).toEqual([
      expect.objectContaining({ lineId: grace.lineId, quantity: 4 }),
    ]);
  });

  it('deterministically migrates legacy lines and strips non-cart secrets', () => {
    const legacy = {
      items: [
        { ...base, price: 25, giftCardToken: 'must-not-survive' },
        { ...base, price: 25 },
        {
          ...base,
          price: 25,
          giftCardCustomization: {
            recipientEmail: 'recipient@example.com',
            code: 'must-not-survive',
          },
        },
      ],
    };

    const first = migrateCartState(legacy) as { items: StableCartItem[] };
    const second = migrateCartState(legacy) as { items: StableCartItem[] };
    expect(first.items).toHaveLength(1);
    expect(first.items[0]).toMatchObject({ quantity: 2, price: { amount: 2_500, currency: 'USD' } });
    expect(first.items[0].lineId).toBe(second.items[0].lineId);
    expect(JSON.stringify(first)).not.toContain('must-not-survive');
  });

  it('preserves ordinary one-time cart merging behavior', () => {
    useCartStore.getState().addItem(base);
    useCartStore.getState().addItem(base);
    expect(useCartStore.getState().items).toEqual([
      expect.objectContaining({ variantId: base.variantId, quantity: 2 }),
    ]);
  });
});
