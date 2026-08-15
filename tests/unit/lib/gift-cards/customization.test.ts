import { describe, expect, it } from 'vitest';

import {
  GiftCardCustomizationValidationError,
  parseGiftCardCustomization,
} from '@/lib/gift-cards/customization';

describe('gift-card customization', () => {
  it('normalizes the exact public recipient projection', () => {
    expect(parseGiftCardCustomization({
      recipientEmail: '  Recipient@Example.COM ',
      recipientName: '  Ada   Lovelace ',
      message: ' Enjoy this!  \r\n  From us ',
      deliveryDate: '2026-12-24',
    })).toEqual({
      recipientEmail: 'recipient@example.com',
      recipientName: 'Ada Lovelace',
      message: 'Enjoy this!\nFrom us',
      deliveryDate: '2026-12-24',
    });
  });

  it.each([
    { recipientEmail: 'recipient@example.com', code: 'GC-SECRET' },
    { recipientEmail: 'recipient@example.com', token: 'secret' },
    { recipientEmail: 'not-an-email' },
    { recipientEmail: 'recipient@example.com', deliveryDate: '2026-02-29' },
    { recipientEmail: 'recipient@example.com', recipientName: 'x'.repeat(101) },
    { recipientEmail: 'recipient@example.com', message: 'x'.repeat(501) },
    Object.assign(Object.create({}), { recipientEmail: 'recipient@example.com' }),
  ])('rejects malformed, oversized, or extra-key input', (value) => {
    expect(() => parseGiftCardCustomization(value)).toThrow(
      GiftCardCustomizationValidationError,
    );
  });
});
