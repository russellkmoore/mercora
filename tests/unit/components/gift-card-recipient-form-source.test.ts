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

  it('imports all four per-field validators, not just the email one', () => {
    expect(form).toContain('validateGiftCardRecipientEmail');
    expect(form).toContain('validateGiftCardRecipientName');
    expect(form).toContain('validateGiftCardMessage');
    expect(form).toContain('validateGiftCardDeliveryDate');
  });

  it('gates the Send to myself checkbox on isLoaded and isSignedIn together', () => {
    expect(form).toContain('isLoaded && isSignedIn');
  });

  it('reads the Clerk primary email address and full name for the prefill', () => {
    expect(form).toContain('primaryEmailAddress');
    expect(form).toContain('fullName');
  });

  it('omits an optional customization key unless its trimmed value is non-empty', () => {
    expect(form).toContain('recipientName.trim().length > 0');
    expect(form).toContain('message.trim().length > 0');
    expect(form).toContain('deliveryDate.trim().length > 0');
  });

  it('carries both min and max on the delivery-date input', () => {
    expect(form).toContain('type="date"');
    expect(form).toContain('min={');
    expect(form).toContain('max={');
  });

  it('carries the verbatim delivery-date helper sentence from the Copywriting Contract', () => {
    expect(form).toContain(
      'Leave blank to send as soon as payment completes, or pick a date to send it at the start of that day, UTC.',
    );
  });

  it('never restates a length cap as a raw numeric comparison or maxLength literal', () => {
    // Copy text is allowed to spell out "254"/"100"/"500" (Copywriting Contract wording) and
    // counter denominators ("/100", "/500") are allowed — but validation logic and the
    // Textarea's maxLength must reach the cap through the imported constants, never a literal.
    expect(form).not.toMatch(/\.length\s*[<>]=?\s*(254|100|500)\b/);
    expect(form).not.toMatch(/maxLength=\{?\s*(254|100|500)\s*\}?/);
    expect(form).toContain('GIFT_CARD_RECIPIENT_NAME_MAX_LENGTH');
    expect(form).toContain('GIFT_CARD_MESSAGE_MAX_LENGTH');
  });
});
