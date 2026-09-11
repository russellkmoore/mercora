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
    // D-03: the third item's malformed customization (a smuggled `code`
    // field) previously dropped that line entirely, so this bucket merged
    // to quantity 2. It now flags and survives instead, merging in as a
    // third no-customization line and carrying the flag onto the bucket.
    expect(first.items[0]).toMatchObject({
      quantity: 3,
      price: { amount: 2_500, currency: 'USD' },
      giftCardNoteInvalid: true,
    });
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

  // Ledger #10 (WINDOWS.md, D-03): a link-bearing note used to be dropped
  // silently by migration. It must now survive alongside a valid line.
  it('migrates a mixed valid/invalid persisted state with both lines surviving, flag on the invalid one only', () => {
    const persisted = {
      items: [
        {
          ...base,
          price: 25,
          giftCardCustomization: { recipientEmail: 'ada@example.com' },
        },
        {
          ...base,
          price: 25,
          giftCardCustomization: {
            recipientEmail: 'grace@example.com',
            message: 'see https://example.com/note for the surprise',
          },
        },
      ],
    };

    const result = migrateCartState(persisted) as { items: StableCartItem[] };
    expect(result.items).toHaveLength(2);
    expect(result.items[0].giftCardNoteInvalid).toBeUndefined();
    expect(result.items[1].giftCardNoteInvalid).toBe(true);
    expect(result.items[1]).not.toHaveProperty('giftCardCustomization');
  });

  // IN-02: canonicalLineFacts omits giftCardCustomization for a flagged line
  // (the invalid customization is never carried forward), so two persisted
  // lines for the same product/variant with two *different*, both-invalid
  // gift notes merge into a single flagged line on migration. This is
  // documented, accepted behavior, not a fix: the original note text is
  // unrecoverable either way (the remediation is remove-and-re-add), so
  // there is no data-loss consequence beyond what already exists -- the
  // shopper just sees one combined-quantity flagged line instead of two.
  it('merges two different invalid gift notes for the same product/variant into one flagged line (IN-02)', () => {
    const persisted = {
      items: [
        {
          ...base,
          price: 25,
          giftCardCustomization: {
            recipientEmail: 'ada@example.com',
            message: 'see https://example.com/ada-note for the surprise',
          },
        },
        {
          ...base,
          price: 25,
          giftCardCustomization: {
            recipientEmail: 'grace@example.com',
            message: 'see https://example.com/grace-note for the surprise',
          },
        },
      ],
    };

    const result = migrateCartState(persisted) as { items: StableCartItem[] };
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ quantity: 2, giftCardNoteInvalid: true });
    expect(result.items[0]).not.toHaveProperty('giftCardCustomization');
  });

  it('migrates the mixed valid/invalid persisted state deterministically across two runs', () => {
    const persisted = {
      items: [
        {
          ...base,
          price: 25,
          giftCardCustomization: { recipientEmail: 'ada@example.com' },
        },
        {
          ...base,
          price: 25,
          giftCardCustomization: {
            recipientEmail: 'grace@example.com',
            message: 'see https://example.com/note for the surprise',
          },
        },
      ],
    };

    const first = migrateCartState(persisted) as { items: StableCartItem[] };
    const second = migrateCartState(persisted) as { items: StableCartItem[] };
    expect(first.items.map((item) => item.lineId)).toEqual(second.items.map((item) => item.lineId));
    expect(first.items.map((item) => item.giftCardNoteInvalid)).toEqual(
      second.items.map((item) => item.giftCardNoteInvalid),
    );
  });
});
