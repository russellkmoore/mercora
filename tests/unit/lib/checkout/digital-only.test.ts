import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DIGITAL_CHECKOUT_STEPS,
  DIGITAL_SHIPPING_METHOD_ID,
  isDigitalOnlyCart,
} from '@/lib/checkout/digital-only';
import { hasPhysicalCheckoutLines } from '@/lib/gift-cards/checkout';
import type { OrderItem } from '@/lib/types/order';
import type { GiftCardCustomization } from '@/lib/types/cartitem';

const root = process.cwd();

// Pinned to the fixture array below as it exists after 18-07 (WR-02): 5
// non-empty-cart fixtures, covering both expected outcomes. If a future
// edit drops fixtures below this floor, the paired-invariant loop could
// silently stop exercising a composition (or run zero times) while the
// suite stays green — this assertion turns that into a red test instead.
const MIN_NON_EMPTY_CART_FIXTURES = 5;

const giftCardCustomization: GiftCardCustomization = {
  recipientEmail: 'friend@example.com',
};

interface Fixture {
  name: string;
  cartItems: { giftCardCustomization?: GiftCardCustomization; giftCardNoteInvalid?: boolean }[];
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
  {
    // WR-02: a DEBT-03-flagged line lost its giftCardCustomization on load
    // (the invalid customization is not carried forward), but it is still a
    // gift-card/digital line -- checkout refuses it either way, so both
    // signals must agree the cart is digital-only until the line is removed.
    name: 'one flagged (invalid-note) gift-card line, no customization',
    cartItems: [{ giftCardNoteInvalid: true }],
    orderItems: [orderItem('digital')],
    expected: true,
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

  it('returns true for one flagged (invalid-note) line carrying no customization (WR-02)', () => {
    expect(isDigitalOnlyCart([{ giftCardNoteInvalid: true }])).toBe(true);
  });

  it('returns false for a plain line even when giftCardNoteInvalid is absent (WR-02 control)', () => {
    expect(isDigitalOnlyCart([{ giftCardNoteInvalid: false }])).toBe(false);
  });

  describe('paired invariant against hasPhysicalCheckoutLines', () => {
    // The empty-cart composition is excluded here: hasPhysicalCheckoutLines([])
    // is vacuously false (no items disagree), so its negation is true, while
    // isDigitalOnlyCart([]) is false by design — an empty cart is never
    // digital-only, it hits the empty-cart branch before any step UI renders
    // (must_haves, "empty" truth). The invariant is meaningful only when both
    // signals are evaluated over an actual, non-empty fulfilment mix; the
    // empty-array case is covered on its own above.
    const nonEmptyCartFixtures = fixtures.filter((f) => f.cartItems.length > 0);

    it('the fixture list has not been hollowed out below the pinned floor', () => {
      expect(nonEmptyCartFixtures.length).toBeGreaterThanOrEqual(MIN_NON_EMPTY_CART_FIXTURES);
      expect(nonEmptyCartFixtures.some((f) => f.expected === true)).toBe(true);
      expect(nonEmptyCartFixtures.some((f) => f.expected === false)).toBe(true);
    });

    for (const fixture of nonEmptyCartFixtures) {
      it(`agrees with the negation of hasPhysicalCheckoutLines for: ${fixture.name}`, () => {
        const clientSignal = isDigitalOnlyCart(fixture.cartItems);
        const serverSignal = !hasPhysicalCheckoutLines(fixture.orderItems);
        expect(clientSignal).toBe(fixture.expected);
        expect(serverSignal).toBe(fixture.expected);
        expect(clientSignal).toBe(serverSignal);
      });
    }
  });

  describe('cross-reference source contract (D-05)', () => {
    it('lib/checkout/digital-only.ts names the invariant test and the server-side predicate', () => {
      const source = readFileSync(join(root, 'lib/checkout/digital-only.ts'), 'utf8');
      expect(source).toContain('tests/unit/lib/checkout/digital-only.test.ts');
      expect(source).toContain('hasPhysicalCheckoutLines');
    });

    it('lib/gift-cards/checkout.ts names the invariant test and the client-side predicate', () => {
      const source = readFileSync(join(root, 'lib/gift-cards/checkout.ts'), 'utf8');
      expect(source).toContain('tests/unit/lib/checkout/digital-only.test.ts');
      expect(source).toContain('isDigitalOnlyCart');
    });
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
