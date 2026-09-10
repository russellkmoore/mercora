import { describe, expect, it } from 'vitest';
import {
  filterListedProducts,
  giftCardSurfacesHidden,
  hidesGiftCardsFromListings,
  isPubliclyVisibleProduct,
} from '@/lib/gift-cards/visibility';

/** The four flag states of D-02, named the way D-01 asks us to talk about them. */
const SELL_ON_HONOR_ON = { giftCardAcquisition: true, giftCardReconciliation: true };
const SELL_OFF_HONOR_ON = { giftCardAcquisition: false, giftCardReconciliation: true };
const SELL_OFF_HONOR_OFF = { giftCardAcquisition: false, giftCardReconciliation: false };
const SELL_ON_HONOR_OFF = { giftCardAcquisition: true, giftCardReconciliation: false };

describe('hidesGiftCardsFromListings', () => {
  const cases: { name: string; features: { giftCardAcquisition: boolean }; expected: boolean }[] = [
    { name: 'sell off, honor on', features: SELL_OFF_HONOR_ON, expected: true },
    { name: 'sell off, honor off', features: SELL_OFF_HONOR_OFF, expected: true },
    { name: 'sell on, honor on', features: SELL_ON_HONOR_ON, expected: false },
    { name: 'sell on, honor off', features: SELL_ON_HONOR_OFF, expected: false },
  ];

  for (const { name, features, expected } of cases) {
    it(`returns ${expected} with ${name}`, () => {
      expect(hidesGiftCardsFromListings(features)).toBe(expected);
    });
  }
});

describe('isPubliclyVisibleProduct', () => {
  const cases: {
    name: string;
    product: { type?: string | null };
    features: { giftCardAcquisition: boolean };
    expected: boolean;
  }[] = [
    {
      name: 'a gift-card product with sell off',
      product: { type: 'gift_card' },
      features: SELL_OFF_HONOR_ON,
      expected: false,
    },
    {
      name: 'a gift-card product with sell on',
      product: { type: 'gift_card' },
      features: SELL_ON_HONOR_ON,
      expected: true,
    },
    {
      name: 'a physical product with sell off',
      product: { type: 'physical' },
      features: SELL_OFF_HONOR_ON,
      expected: true,
    },
    {
      name: 'a physical product with sell on',
      product: { type: 'physical' },
      features: SELL_ON_HONOR_ON,
      expected: true,
    },
    {
      name: 'a product with no type at all and sell off',
      product: {},
      features: SELL_OFF_HONOR_ON,
      expected: true,
    },
    {
      name: 'a product with a null type and sell off',
      product: { type: null },
      features: SELL_OFF_HONOR_ON,
      expected: true,
    },
  ];

  for (const { name, product, features, expected } of cases) {
    it(`returns ${expected} for ${name}`, () => {
      expect(isPubliclyVisibleProduct(product, features)).toBe(expected);
    });
  }

  it('reads the product type, never a slug or an id', () => {
    // A gift card renamed at the slug level is still hidden; a physical product
    // that happens to be slugged "gift-card" is still listed (D-08).
    const renamedGiftCard = { id: 'prod_1', slug: 'holiday-voucher', type: 'gift_card' };
    const impostor = { id: 'gift_card', slug: 'gift-card', type: 'physical' };
    expect(isPubliclyVisibleProduct(renamedGiftCard, SELL_OFF_HONOR_ON)).toBe(false);
    expect(isPubliclyVisibleProduct(impostor, SELL_OFF_HONOR_ON)).toBe(true);
  });
});

describe('filterListedProducts', () => {
  const gift = { id: 'prod_gift', type: 'gift_card' };
  const physical = { id: 'prod_tent', type: 'physical' };

  it('drops the gift card with sell off', () => {
    expect(filterListedProducts([gift, physical], SELL_OFF_HONOR_ON)).toEqual([physical]);
  });

  it('keeps every product with sell on, preserving item identity', () => {
    const result = filterListedProducts([gift, physical], SELL_ON_HONOR_ON);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(gift);
    expect(result[1]).toBe(physical);
  });

  it('returns an empty array for an empty input', () => {
    expect(filterListedProducts([], SELL_OFF_HONOR_ON)).toEqual([]);
  });
});

describe('giftCardSurfacesHidden', () => {
  const cases: { name: string; features: typeof SELL_ON_HONOR_ON; expected: boolean }[] = [
    { name: 'sell off, honor off', features: SELL_OFF_HONOR_OFF, expected: true },
    { name: 'sell off, honor on', features: SELL_OFF_HONOR_ON, expected: false },
    { name: 'sell on, honor on', features: SELL_ON_HONOR_ON, expected: false },
    { name: 'sell on, honor off', features: SELL_ON_HONOR_OFF, expected: false },
  ];

  for (const { name, features, expected } of cases) {
    it(`returns ${expected} with ${name}`, () => {
      expect(giftCardSurfacesHidden(features)).toBe(expected);
    });
  }
});
