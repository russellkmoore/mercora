import { describe, expect, it } from 'vitest';

import { toWireProduct } from '@/lib/models/mach/product-serializer';

describe('Money wire boundaries', () => {
  it('keeps stored product values in minor units while projecting decimal MACH money', () => {
    const product = {
      id: 'product-1',
      name: 'Example',
      variants: [{
        id: 'variant-1',
        product_id: 'product-1',
        sku: 'SKU-1',
        option_values: [],
        price: { amount: 2999, currency: 'USD' },
        compare_at_price: { amount: 3499, currency: 'USD' },
      }],
    };

    const wire = toWireProduct(product);

    expect(product.variants[0].price).toEqual({ amount: 2999, currency: 'USD' });
    expect(wire.variants?.[0].price).toEqual({ amount: 29.99, currency: 'USD', precision: 2 });
    expect(wire.variants?.[0].compare_at_price).toEqual({ amount: 34.99, currency: 'USD', precision: 2 });
  });
});
