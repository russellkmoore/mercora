import { describe, expect, it } from 'vitest';
import { generateGiftCardCode, maskGiftCardCode } from '@/lib/gift-cards/code';

describe('maskGiftCardCode', () => {
  it('hides every group but the last', () => {
    const code = generateGiftCardCode();
    const masked = maskGiftCardCode(code);
    expect(masked).toMatch(/^GC(-\*{4}){6}-[A-Z0-9]{4}$/);
    expect(masked?.slice(-4)).toBe(code.slice(-4));
    expect(masked).not.toContain(code.slice(3, 7));
  });

  it('accepts lower-case input and returns null for anything malformed', () => {
    const code = generateGiftCardCode();
    expect(maskGiftCardCode(code.toLowerCase())).toBe(maskGiftCardCode(code));
    expect(maskGiftCardCode('GC-1234')).toBeNull();
    expect(maskGiftCardCode('')).toBeNull();
    expect(maskGiftCardCode(undefined)).toBeNull();
    expect(maskGiftCardCode('<script>')).toBeNull();
  });
});
