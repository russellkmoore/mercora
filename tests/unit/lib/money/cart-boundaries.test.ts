import { describe, expect, it } from 'vitest';

import { cartItemTotal, cartSubtotal, Money } from '@/lib/money';
import type { CartItem } from '@/lib/types/cartitem';

const item: CartItem = {
  productId: 'product-1',
  variantId: 'variant-1',
  name: 'Example',
  price: { amount: 2999, currency: 'USD' },
  quantity: 2,
  primaryImageUrl: '',
};

describe('cart Money boundaries', () => {
  it('keeps cart prices and totals in integer minor units', () => {
    expect(cartItemTotal(item).toJSON()).toEqual({ amount: 5998, currency: 'USD' });
    expect(cartSubtotal([item, { ...item, variantId: 'variant-2', price: { amount: 101, currency: 'USD' } }]).toJSON())
      .toEqual({ amount: 6200, currency: 'USD' });
  });

  it('converts to decimal only for a MACH response', () => {
    expect(cartSubtotal([item]).toMach()).toEqual({ amount: 59.98, currency: 'USD', precision: 2 });
    expect(Money.fromStored(item.price).format()).toBe('$29.99');
  });
});
