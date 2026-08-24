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

  it('fails closed for invalid quantities and malformed customization', () => {
    expect(normalizeCartItemForStore({ ...base, quantity: 1_001 })).toBeNull();
    expect(normalizeCartItemForStore({
      ...base,
      giftCardCustomization: {
        recipientEmail: 'recipient@example.com',
        redemptionToken: 'secret',
      },
    })).toBeNull();
  });
});
