import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('GiftCardRecipientForm source contract', () => {
  const form = readFileSync(
    join(root, 'components/product/GiftCardRecipientForm.tsx'),
    'utf8',
  );
  const productDisplay = readFileSync(
    join(root, 'app/product/[slug]/ProductDisplay.tsx'),
    'utf8',
  );

  it('is a client component that imports the shared email validator', () => {
    expect(form).toContain('"use client"');
    expect(form).toContain('validateGiftCardRecipientEmail');
    expect(form).toContain('@/lib/gift-cards/customization');
  });

  it('carries the literal heading, label and alert-role error contract', () => {
    expect(form).toContain('Recipient details');
    expect(form).toContain('Recipient email');
    expect(form).toContain('role="alert"');
  });

  it('is wired into ProductDisplay on the product.type gift_card branch', () => {
    expect(productDisplay).toContain('product.type === "gift_card"');
    expect(productDisplay).toContain('GiftCardRecipientForm');
  });

  it('never keys off the gift card product id or url slug', () => {
    expect(form).not.toContain('prod_33');
    expect(form).not.toContain('product.slug');
    expect(productDisplay).not.toContain('prod_33');
    expect(productDisplay).not.toContain('product.slug');
  });
});
