import { describe, expect, it } from 'vitest';
import {
  fromWireProduct,
  toPublicProduct,
  toWireProduct,
} from '@/lib/models/mach/product-serializer';
import type { Product } from '@/lib/types';
import { Money } from '@/lib/money';

/** Same regex lib/services/checkout-pricing.ts applies to a variant's tax_category. */
const CHECKOUT_TAX_CODE = /^txcd_\d{8}$/;

function productFixture(): Product {
  return {
    id: 'product-1',
    name: 'Trail Pack',
    status: 'active',
    external_references: { erp: 'private-erp-id' },
    extensions: { integrationSecret: 'do-not-leak' },
    primary_image: {
      file: { url: 'https://example.com/product.jpg', format: 'jpg' },
      title: 'Front view',
      accessibility: { alt_text: 'A trail pack' },
      metadata: { internalAssetId: 'asset-123' },
      external_references: { dam: 'dam-123' },
      extensions: { signedOrigin: 'secret' },
    },
    variants: [
      {
        id: 'variant-1',
        sku: 'TRAIL-1',
        status: 'active',
        option_values: [],
        price: { amount: 2599, currency: 'USD' },
        compare_at_price: { amount: 2999, currency: 'USD' },
        cost: { amount: 800, currency: 'USD' },
        barcode: '012345678905',
        inventory: { track_inventory: true, quantity: 42 },
        attributes: { color: 'green', material: 'canvas' },
      },
      {
        id: 'variant-2',
        sku: 'TRAIL-HIDDEN',
        status: 'inactive',
        option_values: [],
        price: { amount: 9999, currency: 'USD' },
        inventory: { track_inventory: true, quantity: 5 },
      },
    ],
  };
}

// CAT-02: the Voltique Gift Card (prod_33, variant_33..36 — data/d1/seed.sql
// gift-card block, plan 09-01) must project through toPublicProduct as four
// available, correctly priced denominations. This fixture mirrors the seeded
// shape exactly rather than a convenient variant of it.
function giftCardFixture(): Product {
  const denominations = [
    { id: 'variant_33', sku: 'GC-025', label: '$25', amount: 2500 },
    { id: 'variant_34', sku: 'GC-050', label: '$50', amount: 5000 },
    { id: 'variant_35', sku: 'GC-100', label: '$100', amount: 10000 },
    { id: 'variant_36', sku: 'GC-200', label: '$200', amount: 20000 },
  ];

  return {
    id: 'prod_33',
    name: 'Voltique Gift Card',
    slug: 'gift-card',
    status: 'active',
    type: 'gift_card',
    fulfillment_type: 'digital',
    tax_category: 'txcd_00000000',
    default_variant_id: 'variant_33',
    related_products: [],
    variants: denominations.map(({ id, sku, label, amount }, index) => ({
      id,
      sku,
      status: 'active',
      position: index + 1,
      option_values: [{ option_id: 'amount', value: label }],
      price: { amount, currency: 'USD' },
      tax_category: 'txcd_00000000',
      inventory: { track_inventory: false },
    })),
  };
}

describe('public product serialization', () => {
  it('strips internal fields without mutating the admin representation', () => {
    const product = productFixture();
    const publicProduct = toPublicProduct(product);

    expect(publicProduct).not.toHaveProperty('external_references');
    expect(publicProduct).not.toHaveProperty('extensions');
    expect(publicProduct.primary_image).toMatchObject({
      title: 'Front view',
      accessibility: { alt_text: 'A trail pack' },
    });
    expect(publicProduct.primary_image).not.toHaveProperty('metadata');
    expect(publicProduct.primary_image).not.toHaveProperty('external_references');
    expect(publicProduct.primary_image).not.toHaveProperty('extensions');

    const variant = publicProduct.variants![0];
    expect(variant).not.toHaveProperty('cost');
    expect(variant).not.toHaveProperty('barcode');
    expect(variant).not.toHaveProperty('inventory');
    expect(variant.available_for_sale).toBe(true);
    expect(variant.attributes).toEqual({ color: 'green', material: 'canvas' });
    expect(publicProduct.variants).toHaveLength(1);

    expect(product).toHaveProperty('extensions.integrationSecret', 'do-not-leak');
    expect(product.variants![0]).toHaveProperty('cost.amount', 800);
  });

  it('composes with the MACH money wire serializer', () => {
    const wireProduct = toWireProduct(toPublicProduct(productFixture()));

    expect(wireProduct.variants![0].price).toEqual({
      amount: 25.99,
      currency: 'USD',
      precision: 2,
    });
    expect(wireProduct.variants![0]).not.toHaveProperty('cost');
  });

  it('round-trips wire money for admin UI consumers', () => {
    const wireProduct = toWireProduct(productFixture());
    const storedProduct = fromWireProduct(wireProduct);

    expect(storedProduct.variants![0].price).toEqual({ amount: 2599, currency: 'USD' });
    expect(storedProduct.variants![0].compare_at_price).toEqual({ amount: 2999, currency: 'USD' });
    expect(storedProduct.variants![0].cost).toEqual({ amount: 800, currency: 'USD' });
  });
});

describe('gift-card denomination projection', () => {
  it('projects all four denominations as available for sale', () => {
    const publicProduct = toPublicProduct(giftCardFixture());

    expect(publicProduct.variants).toHaveLength(4);
    expect(publicProduct.variants!.map((variant) => variant.available_for_sale))
      .toEqual([true, true, true, true]);
  });

  it('carries the four minor-unit amounts through unchanged, in order', () => {
    const publicProduct = toPublicProduct(giftCardFixture());

    expect(publicProduct.variants!.map((variant) => variant.price.amount))
      .toEqual([2500, 5000, 10000, 20000]);
  });

  it('renders the four amounts as the dollar strings shown beside each option value', () => {
    const publicProduct = toPublicProduct(giftCardFixture());

    const rendered = publicProduct.variants!.map((variant) =>
      Money.fromMinor(variant.price.amount, variant.price.currency).format());

    expect(rendered).toEqual(['$25.00', '$50.00', '$100.00', '$200.00']);
  });

  it('keeps every projected variant tax code passing the checkout tax-code regex', () => {
    const publicProduct = toPublicProduct(giftCardFixture());

    for (const variant of publicProduct.variants!) {
      expect(variant.tax_category).toBe('txcd_00000000');
      expect(CHECKOUT_TAX_CODE.test(variant.tax_category!)).toBe(true);
    }
  });

  it('strips cost, barcode and inventory from every gift-card variant', () => {
    const publicProduct = toPublicProduct(giftCardFixture());

    for (const variant of publicProduct.variants!) {
      expect(variant).not.toHaveProperty('cost');
      expect(variant).not.toHaveProperty('barcode');
      expect(variant).not.toHaveProperty('inventory');
    }
  });

  it('keeps the product-level type and fulfillment_type intact', () => {
    const publicProduct = toPublicProduct(giftCardFixture());

    expect(publicProduct.type).toBe('gift_card');
    expect(publicProduct.fulfillment_type).toBe('digital');
  });
});
