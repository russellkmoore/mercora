import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('stable cart-line UI projection', () => {
  it('keys and mutates cart rows by lineId', () => {
    const drawer = readFileSync(join(root, 'components/cart/CartDrawer.tsx'), 'utf8');
    const card = readFileSync(join(root, 'components/cart/CartItemCard.tsx'), 'utf8');
    expect(drawer).toContain('key={item.lineId}');
    expect(card).toContain('updateQuantity(item.lineId');
    expect(card).toContain('removeItem(item.lineId)');
    expect(card).not.toContain('removeItem(item.variantId)');
  });

  it('uses the exact safe checkout-line projection', () => {
    const checkout = readFileSync(join(root, 'components/checkout/CheckoutClient.tsx'), 'utf8');
    expect(checkout).toContain('items: items.map(projectCartLineForCheckout)');
    expect(checkout).toContain('giftCardToken: giftCardToken.trim()');
    expect(checkout).toContain('giftCardRequestKey: giftCardRequestKey.current');
  });
});
