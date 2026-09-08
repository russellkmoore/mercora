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
