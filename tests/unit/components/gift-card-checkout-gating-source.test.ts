import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const cart = readFileSync(join(root, 'components/cart/CartItemCard.tsx'), 'utf8');
const checkout = readFileSync(join(root, 'components/checkout/CheckoutClient.tsx'), 'utf8');

/**
 * Comments are not behaviour. Every assertion below runs against the stripped
 * source so a prose explanation in a code comment can never satisfy — or
 * violate — a contract about what a shopper sees.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('gift-card checkout gating source contract (GCF-01, GCF-03, D-09, D-16)', () => {
  it('reads the flags in the cart line through the public store config, not a new env var', () => {
    // D-11: the client never gets its own NEXT_PUBLIC_ variable for this.
    expect(cart).toMatch(/import \{[^}]*useStoreConfig[^}]*\} from ["']@\/lib\/store["']/);
    expect(cart).toContain('useStoreConfig()');
    expect(cart).not.toContain('NEXT_PUBLIC_STORE_FEATURE');
  });

  it('marks a cart line unavailable only when it is a gift-card line and selling is off', () => {
    const source = withoutComments(cart);
    // Both halves in one condition: the recipient details are what identify a
    // gift-card line on a StableCartItem, and sell is what makes it stale.
    expect(source).toMatch(/giftCardCustomization[\s\S]{0,160}?giftCardAcquisition/);
    expect(source).toContain('text-warning');
    // Honor governs redemption, not what sits in a cart.
    expect(source).not.toContain('giftCardReconciliation');
  });

  it('renders the apply panel only inside a conditional on the honor flag', () => {
    const source = withoutComments(checkout);
    expect(source).toMatch(/import \{[^}]*useStoreConfig[^}]*\} from ["']@\/lib\/store["']/);
    expect(source).toMatch(/giftCardReconciliation[\s\S]{0,120}?<GiftCardApplyPanel/);
    // Exactly one render site, so there is no second, ungated call site.
    expect((source.match(/<GiftCardApplyPanel/g) ?? []).length).toBe(1);
    expect(source).toMatch(/import GiftCardApplyPanel from/);
    // Sell must not reach this decision: a shopper holding a balance can still
    // redeem after the store stops selling (GCF-01, D-03).
    expect(source).not.toContain('giftCardAcquisition');
  });

  it('says nothing in place of the panel when honoring is off', () => {
    // D-16: the panel is absent, not replaced by an apology or a dead input.
    const source = withoutComments(checkout);
    const forbidden = [
      'gift cards are not',
      "gift cards aren't",
      'gift card redemption',
      'not accepting gift cards',
      'gift cards are unavailable',
      'gift cards are currently',
      'cannot be redeemed',
    ];
    for (const phrase of forbidden) {
      expect(source.toLowerCase()).not.toContain(phrase);
    }
    expect(source).not.toMatch(/gift cards?[^<>{}]{0,40}(unavailable|disabled|turned off|right now)/i);
  });
});
