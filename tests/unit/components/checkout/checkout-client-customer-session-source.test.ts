import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Source-contract test in the style of
 * tests/unit/app/account-security-source.test.ts: reads the two files
 * directly rather than mounting them, since CheckoutClient.tsx pulls in the
 * full checkout tree (cart store, Clerk, Stripe Elements) that this contract
 * doesn't need to exercise to prove the prop is threaded correctly (D-06,
 * D-07).
 */
const checkoutClient = readFileSync('components/checkout/CheckoutClient.tsx', 'utf8');
const stripeProvider = readFileSync('components/checkout/StripeProvider.tsx', 'utf8');

describe('CheckoutClient Customer Session threading (D-06, D-07)', () => {
  it('names customerSessionClientSecret in the /api/payment-intent response type', () => {
    expect(checkoutClient).toMatch(/customerSessionClientSecret\?:\s*string/);
  });

  it('sets the Customer Session secret in the same branch as the client secret', () => {
    const setClientSecretIndex = checkoutClient.indexOf('setClientSecret(data.clientSecret)');
    const setCustomerSessionIndex = checkoutClient.indexOf(
      'setCustomerSessionClientSecret(data.customerSessionClientSecret'
    );
    expect(setClientSecretIndex).toBeGreaterThan(-1);
    expect(setCustomerSessionIndex).toBeGreaterThan(-1);
    // Both calls live in the same else-branch: no more than a few lines apart.
    const between = checkoutClient.slice(
      Math.min(setClientSecretIndex, setCustomerSessionIndex),
      Math.max(setClientSecretIndex, setCustomerSessionIndex) + 80
    );
    expect(between).not.toContain('};'); // still inside the same block, no function boundary crossed
  });

  it('passes customerSessionClientSecret as a prop on the StripeProvider mount', () => {
    const mountIndex = checkoutClient.indexOf('<StripeProvider');
    const closeIndex = checkoutClient.indexOf('>', checkoutClient.indexOf('<PaymentForm', mountIndex));
    const mountBlock = checkoutClient.slice(mountIndex, closeIndex);
    expect(mountBlock).toContain('customerSessionClientSecret=');
  });

  it('keeps the existing key={clientSecret} remount', () => {
    expect(checkoutClient).toContain('key={clientSecret}');
  });

  it('pins StripeProviderProps to declare the same prop CheckoutClient passes', () => {
    expect(stripeProvider).toMatch(/customerSessionClientSecret\?:\s*string/);
  });
});
