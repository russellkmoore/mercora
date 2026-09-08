import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = readFileSync(join(root, 'components/checkout/CheckoutClient.tsx'), 'utf8');

describe('CheckoutClient digital-only source contract (D-01, D-02, D-03)', () => {
  it('calls ProgressBar with DIGITAL_CHECKOUT_STEPS only inside an isDigitalOnly branch', () => {
    const match = source.match(/isDigitalOnly\s*\?[\s\S]{0,200}?DIGITAL_CHECKOUT_STEPS/);
    expect(match).not.toBeNull();
  });

  it('passes no steps prop at all on the physical (non-digital) branch', () => {
    const propsBlock = source.match(/const progressBarProps[\s\S]*?;\n/);
    expect(propsBlock).not.toBeNull();
    const body = propsBlock ? propsBlock[0] : '';
    const elseBranch = body.slice(body.indexOf(':'));
    expect(elseBranch).not.toContain('steps:');
  });

  it('maps the digital step index to 0, 1, 2 and keeps the physical mapping at 0, 2, 3', () => {
    expect(source).toMatch(/isDigitalOnly[\s\S]{0,400}?'shipping'\s*\?\s*0\s*:\s*currentStep === 'payment'\s*\?\s*1\s*:\s*2/);
    expect(source).toMatch(/'shipping'\s*\?\s*0\s*:\s*currentStep === 'payment'\s*\?\s*2\s*:\s*3/);
  });

  it('passes ShippingForm the billing heading and helper sentence only on the digital branch', () => {
    const match = source.match(/<ShippingForm[\s\S]*?\/>/);
    expect(match).not.toBeNull();
    const block = match ? match[0] : '';
    expect(block).toMatch(/isDigitalOnly\s*\?\s*\{\s*heading:\s*'Billing details'/);
    expect(block).toContain('Nothing ships — we need this for your receipt and tax.');
  });

  it('switches the outer wrapper heading and the recap-card heading to Billing details on the digital branch', () => {
    const matches = source.match(/\{isDigitalOnly \? 'Billing details' : 'Shipping Address'\}/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('guards the Clerk prefill on the address field currently being empty', () => {
    expect(source).toMatch(/!(?:next|prev)\.recipient/);
    expect(source).toMatch(/!(?:next|prev)\.email/);
  });

  it('reads recipient from fullName and email from primaryEmailAddress.emailAddress', () => {
    expect(source).toContain('user.fullName');
    expect((source.match(/primaryEmailAddress/g) ?? []).length).toBe(1);
  });

  it('gates the prefill effect on isLoaded and isSignedIn', () => {
    expect(source).toMatch(/isLoaded/);
    expect(source).toMatch(/isSignedIn/);
  });

  it('keeps the danger banner unchanged', () => {
    expect(source).toContain('bg-danger/10 border border-danger text-danger px-4 py-3 rounded-lg');
  });

  it('keeps both recap cards on border-l-4 border-success', () => {
    expect((source.match(/border-l-4 border-success/g) ?? []).length).toBe(2);
  });

  it('keeps the physical branch heading literal "Shipping Address" exactly twice', () => {
    expect((source.match(/Shipping Address/g) ?? []).length).toBe(2);
  });
});
