import { describe, expect, it } from 'vitest';
import {
  DIGITAL_CHECKOUT_STEPS,
  DIGITAL_SHIPPING_METHOD_ID,
  isDigitalOnlyCart,
} from '@/lib/checkout/digital-only';
import { hasPhysicalCheckoutLines } from '@/lib/gift-cards/checkout';
import type { OrderItem } from '@/lib/types/order';
import type { GiftCardCustomization } from '@/lib/types/cartitem';

const giftCardCustomization: GiftCardCustomization = {
  recipientEmail: 'friend@example.com',
};

interface Fixture {
  name: string;
  cartItems: { giftCardCustomization?: GiftCardCustomization }[];
  orderItems: OrderItem[];
  expected: boolean;
}

function orderItem(fulfillmentType: 'physical' | 'digital'): OrderItem {
  return {
    product_id: 'prod_x',
    sku: 'SKU-X',
    quantity: 1,
    unit_price: { amount: 1000, currency: 'USD' },
    total_price: { amount: 1000, currency: 'USD' },
    product_name: 'Line item',
    fulfillment_type: fulfillmentType,
  };
}

const fixtures: Fixture[] = [
  {
    name: 'empty cart',
    cartItems: [],
    orderItems: [],
    expected: false,
  },
  {
    name: 'one gift-card line',
    cartItems: [{ giftCardCustomization }],
    orderItems: [orderItem('digital')],
    expected: true,
  },
  {
    name: 'two gift-card lines',
    cartItems: [{ giftCardCustomization }, { giftCardCustomization }],
    orderItems: [orderItem('digital'), orderItem('digital')],
    expected: true,
  },
  {
    name: 'one gift-card line plus one plain line',
    cartItems: [{ giftCardCustomization }, {}],
    orderItems: [orderItem('digital'), orderItem('physical')],
    expected: false,
  },
  {
    name: 'one plain line',
    cartItems: [{}],
    orderItems: [orderItem('physical')],
    expected: false,
  },
];

describe('isDigitalOnlyCart', () => {
  it('returns false for an empty array', () => {
    expect(isDigitalOnlyCart([])).toBe(false);
  });

  it('returns true for one line carrying a customization', () => {
    expect(isDigitalOnlyCart([{ giftCardCustomization }])).toBe(true);
  });

  it('returns true for two lines both carrying customizations', () => {
    expect(isDigitalOnlyCart([{ giftCardCustomization }, { giftCardCustomization }])).toBe(true);
  });

  it('returns false for one line with a customization plus one line without', () => {
    expect(isDigitalOnlyCart([{ giftCardCustomization }, {}])).toBe(false);
  });

  it('returns false for one line without a customization', () => {
    expect(isDigitalOnlyCart([{}])).toBe(false);
  });

  describe('paired invariant against hasPhysicalCheckoutLines', () => {
    // The empty-cart composition is excluded here: hasPhysicalCheckoutLines([])
    // is vacuously false (no items disagree), so its negation is true, while
    // isDigitalOnlyCart([]) is false by design — an empty cart is never
    // digital-only, it hits the empty-cart branch before any step UI renders
    // (must_haves, "empty" truth). The invariant is meaningful only when both
    // signals are evaluated over an actual, non-empty fulfilment mix; the
    // empty-array case is covered on its own above.
    for (const fixture of fixtures.filter((f) => f.cartItems.length > 0)) {
      it(`agrees with the negation of hasPhysicalCheckoutLines for: ${fixture.name}`, () => {
        const clientSignal = isDigitalOnlyCart(fixture.cartItems);
        const serverSignal = !hasPhysicalCheckoutLines(fixture.orderItems);
        expect(clientSignal).toBe(fixture.expected);
        expect(serverSignal).toBe(fixture.expected);
        expect(clientSignal).toBe(serverSignal);
      });
    }
  });
});

describe('DIGITAL_SHIPPING_METHOD_ID', () => {
  it('equals the string digital', () => {
    expect(DIGITAL_SHIPPING_METHOD_ID).toBe('digital');
  });
});

describe('DIGITAL_CHECKOUT_STEPS', () => {
  it('is a three-element array of the Copywriting Contract digital step labels, in order', () => {
    expect(DIGITAL_CHECKOUT_STEPS).toEqual(['Billing details', 'Payment', 'Order Submitted']);
  });
});
