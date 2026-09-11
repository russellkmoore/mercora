import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Stripe Link is hidden in the Payment Element. Its "Save my information for
 * faster checkout" box saves to Link, not to Mercora. Now that this store
 * saves payment methods itself through the Payment Element's Customer
 * Session (D-06, PAY-03), the Link box would offer a second, parallel place
 * a card can live — so Link stays off deliberately (D-12). Re-enabling Link
 * alongside this feature is a separate decision this phase did not make.
 */
describe('PaymentForm wallets', () => {
  it('turns Link off in the Payment Element', () => {
    const source = readFileSync('components/checkout/PaymentForm.tsx', 'utf8');
    const wallets = source.slice(source.indexOf('wallets: {'), source.indexOf('fields: {'));
    expect(wallets).toMatch(/link: 'never'/);
    expect(wallets).toMatch(/applePay: 'auto'/);
    expect(wallets).toMatch(/googlePay: 'auto'/);
  });

  it('explains why Link stays off in terms of the saved-payment-method feature (D-12)', () => {
    const source = readFileSync('components/checkout/PaymentForm.tsx', 'utf8');
    const wallets = source.slice(source.indexOf('wallets: {'), source.indexOf('fields: {'));
    expect(wallets).toContain('this store now saves payment methods itself');
  });
});
