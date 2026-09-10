import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const cart = readFileSync(join(root, 'components/cart/CartItemCard.tsx'), 'utf8');
const checkout = readFileSync(join(root, 'components/checkout/CheckoutClient.tsx'), 'utf8');
const checkoutPage = readFileSync(join(root, 'app/checkout/page.tsx'), 'utf8');
const checkoutPageClient = readFileSync(join(root, 'app/checkout/CheckoutPageClient.tsx'), 'utf8');

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

  it('renders the apply panel only inside a conditional on the effective honor value', () => {
    const source = withoutComments(checkout);
    expect(source).toMatch(/honorEffective[\s\S]{0,120}?<GiftCardApplyPanel/);
    // Exactly one render site, so there is no second, ungated call site.
    expect((source.match(/<GiftCardApplyPanel/g) ?? []).length).toBe(1);
    expect(source).toMatch(/import GiftCardApplyPanel from/);
    // Sell must not reach this decision: a shopper holding a balance can still
    // redeem after the store stops selling (GCF-01, D-03).
    expect(source).not.toContain('giftCardAcquisition');
  });

  it('takes the honor decision as a prop rather than reading the configured flag', () => {
    // CR-03: the configured flag is not the answer. With honor off and
    // balances outstanding the server keeps accepting codes (D-04), so a panel
    // gated on `commerce.features.giftCardReconciliation` disappears in exactly
    // the state the guard exists for, leaving the shopper nowhere to type.
    const source = withoutComments(checkout);
    expect(source).toContain('honorEffective: boolean');
    expect(source).not.toContain('giftCardReconciliation');
    expect(source).not.toContain('useStoreConfig');
  });

  it('applies the D-10 visibility gate before it asks the money question', () => {
    // CR-05: consulting the guard first rendered the panel with both flags off,
    // because every "we do not know" answer inside the guard is "keep
    // honoring". Order is the fix, so order is what is pinned.
    const source = withoutComments(checkoutPage);
    expect(source).toMatch(/giftCardSurfacesHidden\(flags\)\) return false;[\s\S]{0,200}?resolveHonorEffective\(/);
  });

  it('resolves the effective honor value on the server, once per request', () => {
    const source = withoutComments(checkoutPage);
    // A client component cannot read the guard row, so the page must be a
    // server component that awaits it.
    expect(source).not.toContain("'use client'");
    expect(source).not.toContain('"use client"');
    // One owner of the money decision (D-18): the page calls it, never
    // re-derives it from the guard record.
    expect(source).toMatch(/import \{[^}]*resolveHonorEffective[^}]*\} from ["']@\/lib\/gift-cards\/honor-guard["']/);
    expect(source).toMatch(/await resolveHonorEffective\(/);
    expect(source).not.toContain('balancesMayExist');
    expect(source).not.toContain('readHonorGuard');
    // Per request, not per build: a cached decision could show a stale answer
    // about money in flight.
    expect(source).toMatch(/export const dynamic = ["']force-dynamic["']/);
    // Failure to read the guard means "keep honoring" (D-04): the server would
    // still accept a code typed into the panel.
    expect(source).toMatch(/catch[\s\S]{0,80}?return true/);
  });

  it('keeps the Stripe tree behind the no-SSR dynamic import', () => {
    // Moving the page to the server must not start server-rendering Elements.
    const source = withoutComments(checkoutPageClient);
    expect(source).toMatch(/["']use client["']/);
    expect(source).toMatch(/ssr:\s*false/);
    expect(source).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\(["']@\/components\/checkout\/CheckoutClient["']\)/);
    // The value only passes through; it is never re-derived on the client.
    expect(source).toContain('honorEffective={honorEffective}');
    expect(source).not.toContain('useStoreConfig');
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
