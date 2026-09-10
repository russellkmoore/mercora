import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Stripe Link is hidden in the Payment Element. Its "Save my information for
 * faster checkout" box saves to Link, not to Mercora, and the store has no
 * saved-payment-method feature (Russell, 2026-09-10). Re-enable only together
 * with a real saved-payment-methods feature.
 */
describe('PaymentForm wallets', () => {
  it('turns Link off in the Payment Element', () => {
    const source = readFileSync('components/checkout/PaymentForm.tsx', 'utf8');
    const wallets = source.slice(source.indexOf('wallets: {'), source.indexOf('fields: {'));
    expect(wallets).toMatch(/link: 'never'/);
    expect(wallets).toMatch(/applePay: 'auto'/);
    expect(wallets).toMatch(/googlePay: 'auto'/);
  });
});
