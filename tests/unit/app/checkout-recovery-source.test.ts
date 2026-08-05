import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('checkout payment-step recovery policy', () => {
  it('locks discount editing after an authoritative quote or client secret exists', () => {
    const source = readFileSync('components/checkout/CheckoutClient.tsx', 'utf8');
    expect(source).toContain("currentStep === 'shipping' && !authoritativeQuote && !clientSecret");
  });

  it('clears the cart when a redirect payment remains processing', () => {
    const source = readFileSync('app/checkout/success/page.tsx', 'utf8');
    const processing = source.indexOf("paymentIntent.status === 'processing'");
    const phase = source.indexOf("setPhase('processing')", processing);
    const clear = source.indexOf('useCartStore.getState().clearCart()', processing);
    expect(clear).toBeGreaterThan(processing);
    expect(clear).toBeLessThan(phase);
  });
});
