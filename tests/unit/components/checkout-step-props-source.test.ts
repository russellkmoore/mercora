import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('ProgressBar optional steps prop (D-02, SHOP-06)', () => {
  const bar = readFileSync(join(root, 'components/checkout/ProgressBar.tsx'), 'utf8');

  it('declares a module-level DEFAULT_STEPS const holding the four existing labels in order', () => {
    const match = bar.match(/const DEFAULT_STEPS\s*=\s*\[([\s\S]*?)\]/);
    expect(match).not.toBeNull();
    const body = match ? match[1] : '';
    expect(body).toContain('"Shipping Address"');
    expect(body).toContain('"Shipping Method"');
    expect(body).toContain('"Payment Information"');
    expect(body).toContain('"Order Submitted"');
    const addressIndex = body.indexOf('Shipping Address');
    const methodIndex = body.indexOf('Shipping Method');
    const paymentIndex = body.indexOf('Payment Information');
    const submittedIndex = body.indexOf('Order Submitted');
    expect(addressIndex).toBeLessThan(methodIndex);
    expect(methodIndex).toBeLessThan(paymentIndex);
    expect(paymentIndex).toBeLessThan(submittedIndex);
  });

  it('accepts an optional steps array alongside the required numeric step', () => {
    expect(bar).toContain('steps?: string[]');
    expect(bar).toContain('step: number');
  });

  it('defaults steps to DEFAULT_STEPS in the parameter destructuring', () => {
    expect(bar).toContain('steps = DEFAULT_STEPS');
  });

  it('reads the resolved steps identifier in the fill initialiser and the render map, not a local literal', () => {
    expect(bar).toContain('steps.map(() => 0)');
    expect(bar).toContain('steps.map((label, index) => {');
    expect(bar).not.toMatch(/const steps = \[\s*"Shipping Address"/);
  });

  it('still imports CheckCircle2 from lucide-react and keeps its primary/border token classes', () => {
    expect(bar).toContain('import { CheckCircle2 } from "lucide-react"');
    expect(bar).toContain('text-primary');
    expect(bar).toContain('border-border');
  });
});

describe('ShippingForm optional heading and helperText props (D-01, SHOP-06)', () => {
  const form = readFileSync(join(root, 'components/checkout/ShippingForm.tsx'), 'utf8');

  it('declares optional heading and helperText strings on the Props interface', () => {
    expect(form).toContain('heading?: string');
    expect(form).toContain('helperText?: string');
  });

  it('falls back to the exact string Shipping Address when no heading is passed', () => {
    const match = form.match(/heading\s*=\s*"([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match ? match[1] : '').toBe('Shipping Address');
    // The literal appears exactly once in the file now: as the fallback default.
    expect((form.match(/Shipping Address/g) ?? []).length).toBe(1);
  });

  it('renders the helper paragraph only inside a truthiness guard on helperText', () => {
    expect(form).toMatch(/\{helperText\s*&&/);
  });

  it('gives the helper paragraph text-sm, text-muted-foreground and mb-4', () => {
    const match = form.match(/\{helperText\s*&&[\s\S]{0,400}?<p[^>]*className="([^"]+)"/);
    expect(match).not.toBeNull();
    const classes = match ? match[1] : '';
    expect(classes).toContain('text-sm');
    expect(classes).toContain('text-muted-foreground');
    expect(classes).toContain('mb-4');
  });

  it('keeps all seven required-field names inside the submit-disabled expression', () => {
    const match = form.match(/isSubmitDisabled\s*=[\s\S]*?;/);
    expect(match).not.toBeNull();
    const expr = match ? match[0] : '';
    for (const field of [
      'address.recipient',
      'address.email',
      'address.line1',
      'address.city',
      'address.region',
      'address.postal_code',
      'address.country',
    ]) {
      expect(expr).toContain(field);
    }
  });

  it('still contains the Use Address button text and the three country option values', () => {
    expect(form).toContain('Use Address');
    expect(form).toContain('value="US"');
    expect(form).toContain('value="CA"');
    expect(form).toContain('value="UK"');
  });
});
