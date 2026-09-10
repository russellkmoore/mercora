import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Source contract for where a shopper enters a gift-card code at checkout.
 *
 * Russell's live check after the first production gift card ("got the email,
 * nowhere to enter it at checkout") found the field: it existed, but as a
 * separate box under the order summary that vanished once the quote was
 * created, and sat below the Continue button on anything narrower than xl.
 * The field now lives inside OrderSummary beside the discount-code input,
 * which is where shoppers look for "a code". These assertions pin that.
 */
const summary = readFileSync('components/checkout/OrderSummary.tsx', 'utf8');
const checkout = readFileSync('components/checkout/CheckoutClient.tsx', 'utf8');
const article = readFileSync('data/r2/knowledge_md/gift-cards.md', 'utf8');

describe('checkout gift-card code field placement', () => {
  it('renders the gift-card input inside OrderSummary next to the discount code', () => {
    expect(summary).toContain('id="gift-card-code"');
    expect(summary).toContain('placeholder="Enter gift card code"');
    expect(summary).toContain('Have a gift card?');
    // Same visibility rule as the discount code: only while the quote can still change.
    expect(summary).toMatch(/\{showDiscountInput && giftCard && \(/);
    // The discount input comes first so the two "code" fields sit together.
    expect(summary.indexOf('<DiscountCodeInput />')).toBeLessThan(summary.indexOf('id="gift-card-code"'));
  });

  it('CheckoutClient no longer renders its own gift-card box and wires the summary instead', () => {
    expect(checkout).not.toContain('id="gift-card-code"');
    expect(checkout).toMatch(/giftCard=\{\{\s*value: giftCardToken,/);
    // Editing the code resets the idempotent request key so the next quote re-reserves.
    expect(checkout).toMatch(/onChange: \(value\) => \{\s*setGiftCardToken\(value\);\s*giftCardRequestKey\.current = undefined;/);
    // The token still travels to the payment-intent request.
    expect(checkout).toContain('giftCardToken: giftCardToken.trim()');
  });

  it('the support article describes the same place', () => {
    expect(article).toMatch(/"Gift card" field/);
    expect(article).toMatch(/order summary|discount code/i);
  });
});
