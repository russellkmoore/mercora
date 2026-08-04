import { describe, expect, it } from 'vitest';
import { toPublicProduct, toWireProduct } from '@/lib/models/mach/product-serializer';
import type { Product } from '@/lib/types';

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
        option_values: [],
        price: { amount: 2599, currency: 'USD' },
        compare_at_price: { amount: 2999, currency: 'USD' },
        cost: { amount: 800, currency: 'USD' },
        barcode: '012345678905',
        inventory: { track_inventory: true, quantity: 42 },
        attributes: { color: 'green', material: 'canvas' },
      },
    ],
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
    expect(variant.attributes).toEqual({ color: 'green', material: 'canvas' });

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
});
