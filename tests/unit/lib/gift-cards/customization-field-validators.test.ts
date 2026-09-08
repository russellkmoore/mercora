import { describe, expect, it } from 'vitest';

import type { GiftCardFieldError } from '@/lib/gift-cards/customization';
import {
  validateGiftCardDeliveryDate,
  validateGiftCardMessage,
  validateGiftCardRecipientEmail,
  validateGiftCardRecipientName,
} from '@/lib/gift-cards/customization';

describe('validateGiftCardRecipientEmail', () => {
  it.each<{ value: string; expected: GiftCardFieldError | null }>([
    { value: '', expected: 'required' },
    { value: '   ', expected: 'required' },
    { value: 'not-an-email', expected: 'invalid_format' },
    { value: '  Recipient@Example.COM ', expected: null },
    { value: `${'x'.repeat(250)}@example.com`, expected: 'too_long' },
    { value: 'recipient\u0000@example.com', expected: 'control_characters' },
    { value: 'a@b.co@d.com', expected: 'invalid_format' },
  ])('validateGiftCardRecipientEmail(%j) -> $expected', ({ value, expected }) => {
    expect(validateGiftCardRecipientEmail(value)).toBe(expected);
  });
});

describe('validateGiftCardRecipientName', () => {
  it.each<{ value: string; expected: GiftCardFieldError | null }>([
    { value: '', expected: null },
    { value: '   ', expected: null },
    { value: '  Ada   Lovelace ', expected: null },
    { value: 'x'.repeat(101), expected: 'too_long' },
    // 101 raw characters that collapse to exactly 100 once the double space folds to one.
    { value: `${'A'.repeat(50)}  ${'B'.repeat(49)}`, expected: null },
    { value: 'Ada\u0000Lovelace', expected: 'control_characters' },
  ])('validateGiftCardRecipientName(%j) -> $expected', ({ value, expected }) => {
    expect(validateGiftCardRecipientName(value)).toBe(expected);
  });
});

describe('validateGiftCardMessage', () => {
  it.each<{ value: string; expected: GiftCardFieldError | null }>([
    { value: '', expected: null },
    { value: 'x'.repeat(501), expected: 'too_long' },
    { value: 'Enjoy\u0000this', expected: 'control_characters' },
    { value: 'Enjoy this!\r\nFrom us', expected: null },
  ])('validateGiftCardMessage(%j) -> $expected', ({ value, expected }) => {
    expect(validateGiftCardMessage(value)).toBe(expected);
  });
});

describe('validateGiftCardDeliveryDate', () => {
  it.each<{ value: string; todayIso?: string; expected: GiftCardFieldError | null }>([
    { value: '', todayIso: '2026-09-08', expected: null },
    { value: '24/12/2026', todayIso: '2026-09-08', expected: 'invalid_format' },
    { value: '2026-02-29', todayIso: '2026-09-08', expected: 'invalid_format' },
    { value: '2026-09-07', todayIso: '2026-09-08', expected: 'out_of_range' },
    { value: '2026-09-08', todayIso: '2026-09-08', expected: null },
    { value: '2027-09-08', todayIso: '2026-09-08', expected: null },
    { value: '2027-09-09', todayIso: '2026-09-08', expected: 'out_of_range' },
  ])('validateGiftCardDeliveryDate(%j, $todayIso) -> $expected', ({ value, todayIso, expected }) => {
    expect(validateGiftCardDeliveryDate(value, todayIso)).toBe(expected);
  });
});
