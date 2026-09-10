import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Source contract for gift-card tender at checkout.
 *
 * History: the field shipped with the v1 backend as a box under the order
 * summary on step 1, which Russell could not find ("nowhere to enter it at
 * checkout"); it moved beside the discount code, then — because a gift card
 * is a form of payment, not a promotion — onto the Payment Information step
 * with its own Apply. Applying re-quotes the order in place; the server
 * releases the previous quote's hold so the same card can be re-applied.
 */
const panel = readFileSync('components/checkout/GiftCardApplyPanel.tsx', 'utf8');
const summary = readFileSync('components/checkout/OrderSummary.tsx', 'utf8');
const checkout = readFileSync('components/checkout/CheckoutClient.tsx', 'utf8');
const route = readFileSync('app/api/payment-intent/route.ts', 'utf8');
const article = readFileSync('data/r2/knowledge_md/gift-cards.md', 'utf8');

describe('gift-card tender on the payment step', () => {
  it('renders the code entry with its own Apply and a Remove once applied', () => {
    expect(panel).toContain('id="gift-card-code"');
    expect(panel).toContain('placeholder="Enter gift card code"');
    expect(panel).toContain('Pay with a gift card');
    expect(panel).toMatch(/onClick=\{onApply\}/);
    expect(panel).toMatch(/aria-label="Remove gift card"/);
    expect(panel).toContain('maskGiftCardCode(appliedCode)');
  });

  it('mounts the panel inside the Payment Information box and remounts Elements per quote', () => {
    const paymentBox = checkout.slice(
      checkout.indexOf('Payment Information</h3>'),
      checkout.indexOf('<PaymentForm'),
    );
    expect(paymentBox).toContain('<GiftCardApplyPanel');
    expect(paymentBox).toMatch(/<StripeProvider key=\{clientSecret\} clientSecret=\{clientSecret\}>/);
    // Neither the summary nor the client renders its own code input any more.
    expect(summary).not.toContain('id="gift-card-code"');
    expect(checkout).not.toContain('id="gift-card-code"');
  });

  it('re-quotes with a fresh request key and names the previous order so its hold is released', () => {
    expect(checkout).toMatch(/giftCardRequestKey: crypto\.randomUUID\(\)/);
    expect(checkout).toMatch(/\.\.\.\(orderId \? \{ previousOrderId: orderId \} : \{\}\)/);
    expect(checkout).toMatch(/const handleApplyGiftCard = \(\) => requoteWithGiftCard\(giftCardToken\)/);
    expect(checkout).toMatch(/const handleRemoveGiftCard = \(\) => requoteWithGiftCard\(''\)/);
    expect(checkout).toContain('setAppliedGiftCard(token)');
  });

  it('the server releases the previous pending checkout and names gift-card failures', () => {
    expect(route).toContain('previousOrderId?: string;');
    expect(route).toMatch(/releaseTender\?\.\(\{\s*state: extensions\.checkout_tender_state, reason: 'checkout re-quoted'/);
    expect(route).toMatch(/previous\.status !== 'pending' \|\| previous\.payment_status !== 'pending'/);
    expect(route).toMatch(/previous\.customer_id && previous\.customer_id !== userId/);
    expect(route).toContain("code: 'gift_card_unavailable'");
  });

  it('labels the applied tender as the gift card, masked to its last group', () => {
    expect(summary).toContain('maskGiftCardCode(giftCardCode)');
    expect(summary).toMatch(/Gift card\{maskedGiftCard \? ` \$\{maskedGiftCard\}` : ''\}/);
    expect(summary).not.toContain('Other tender');
    expect(readFileSync('lib/utils/email.ts', 'utf8')).not.toContain('Other tender');
  });

  it('the support article describes the same place', () => {
    expect(article).toMatch(/Payment Information step/);
    expect(article).toMatch(/Pay with a gift card/);
  });
});
