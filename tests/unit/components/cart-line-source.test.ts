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

describe('shared gift-card recipient block wiring', () => {
  const card = readFileSync(join(root, 'components/cart/CartItemCard.tsx'), 'utf8');
  const orderItemCard = readFileSync(join(root, 'components/checkout/OrderItemCard.tsx'), 'utf8');

  it('CartItemCard imports GiftCardRecipientBlock and renders it with the inverse tone', () => {
    expect(card).toContain('@/components/gift-cards/GiftCardRecipientBlock');
    expect(card).toContain('<GiftCardRecipientBlock');
    expect(card).toContain('tone="inverse"');
  });

  it('OrderItemCard imports the same component and renders it without an explicit tone prop', () => {
    expect(orderItemCard).toContain('@/components/gift-cards/GiftCardRecipientBlock');
    expect(orderItemCard).toContain('<GiftCardRecipientBlock');
    expect(orderItemCard).not.toContain('tone="inverse"');
    expect(orderItemCard).not.toContain('tone="default"');
  });

  it('neither file still contains its old inline recipient text', () => {
    expect(card).not.toContain('For {item.giftCardCustomization');
    expect(orderItemCard).not.toContain('For {item.giftCardCustomization');
    expect(card).not.toContain('recipientName ||');
    expect(orderItemCard).not.toContain('recipientName ||');
  });

  it('both files still guard the render on item.giftCardCustomization being present', () => {
    expect(card).toContain('item.giftCardCustomization &&');
    expect(orderItemCard).toContain('item?.giftCardCustomization &&');
  });
});
