import { describe, expect, it } from 'vitest';

import {
  createCartLineId,
  normalizeCartItemForStore,
  projectCartLineForCheckout,
} from '@/lib/gift-cards/line-identity';

const base = {
  productId: 'product-one',
  variantId: 'variant-2500',
  name: '$25 Gift Card',
  price: { amount: 2_500, currency: 'USD' },
  quantity: 1,
  primaryImageUrl: '',
};

describe('cart line identity', () => {
  it('is stable for identical normalized recipient facts', () => {
    const first = normalizeCartItemForStore({
      ...base,
      lineId: 'caller-controlled',
      giftCardCustomization: { recipientEmail: 'ADA@EXAMPLE.COM' },
    });
    const second = normalizeCartItemForStore({
      ...base,
      giftCardCustomization: { recipientEmail: ' ada@example.com ' },
    });

    expect(first?.lineId).toBe(second?.lineId);
    expect(first?.lineId).not.toBe('caller-controlled');
  });

  it('separates the same variant when canonical recipient facts differ', () => {
    const ada = createCartLineId({
      productId: base.productId,
      variantId: base.variantId,
      giftCardCustomization: { recipientEmail: 'ada@example.com' },
    });
    const grace = createCartLineId({
      productId: base.productId,
      variantId: base.variantId,
      giftCardCustomization: { recipientEmail: 'grace@example.com' },
    });

    expect(ada).not.toBe(grace);
  });

  it('projects only authoritative IDs, quantity, and bounded customization', () => {
    const item = normalizeCartItemForStore({
      ...base,
      giftCardToken: 'must-not-survive',
      giftCardCustomization: {
        recipientEmail: 'recipient@example.com',
        recipientName: 'Recipient',
      },
    });
    expect(item).not.toBeNull();

    expect(projectCartLineForCheckout(item!)).toEqual({
      lineId: item!.lineId,
      productId: base.productId,
      variantId: base.variantId,
      quantity: 1,
      giftCardCustomization: {
        recipientEmail: 'recipient@example.com',
        recipientName: 'Recipient',
      },
    });
    expect(JSON.stringify(item)).not.toContain('must-not-survive');
  });

  it('fails closed for invalid quantities; malformed customization now flags rather than drops (D-03)', () => {
    expect(normalizeCartItemForStore({ ...base, quantity: 1_001 })).toBeNull();
    // Pre-D-03 this returned null (dropped the whole line). Any customization
    // parse failure — not just a rejected note — now flags a surviving line
    // with no customization; a smuggled redemptionToken is stripped exactly
    // as before, it just no longer takes the whole cart line down with it.
    const flagged = normalizeCartItemForStore({
      ...base,
      giftCardCustomization: {
        recipientEmail: 'recipient@example.com',
        redemptionToken: 'secret',
      },
    });
    expect(flagged).not.toBeNull();
    expect(flagged?.giftCardNoteInvalid).toBe(true);
    expect(flagged).not.toHaveProperty('giftCardCustomization');
    expect(JSON.stringify(flagged)).not.toContain('secret');
  });

  // Ledger #10 (WINDOWS.md, D-03): a note containing a link previously
  // deleted the whole line on hydration. It must now survive, flagged.
  it('flags a surviving line rather than dropping it when the note contains a link (ledger #10)', () => {
    const item = normalizeCartItemForStore({
      ...base,
      giftCardCustomization: {
        recipientEmail: 'recipient@example.com',
        message: 'Happy birthday! See https://example.com/cake for details',
      },
    });

    expect(item).not.toBeNull();
    expect(item?.giftCardNoteInvalid).toBe(true);
    expect(item).not.toHaveProperty('giftCardCustomization');
    expect(item?.lineId).toBe(createCartLineId({
      productId: base.productId,
      variantId: base.variantId,
    }));
  });

  it('still drops the line entirely for a bad price, regardless of the note', () => {
    expect(normalizeCartItemForStore({
      ...base,
      price: { amount: Number.NaN, currency: 'USD' },
      giftCardCustomization: { recipientEmail: 'recipient@example.com' },
    })).toBeNull();
  });

  it('carries no giftCardNoteInvalid key at all when the note is valid', () => {
    const item = normalizeCartItemForStore({
      ...base,
      giftCardCustomization: { recipientEmail: 'recipient@example.com' },
    });

    expect(item).not.toBeNull();
    expect(item).not.toHaveProperty('giftCardNoteInvalid');
  });

  it('refuses to project a flagged line into a checkout request', () => {
    const item = normalizeCartItemForStore({
      ...base,
      giftCardCustomization: {
        recipientEmail: 'recipient@example.com',
        message: 'visit www.example.com',
      },
    });

    expect(item).not.toBeNull();
    expect(item?.giftCardNoteInvalid).toBe(true);
    expect(() => projectCartLineForCheckout(item!)).toThrow('Cart contains an invalid line');
  });
});
