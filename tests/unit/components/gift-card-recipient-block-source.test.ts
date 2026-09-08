import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GIFT_CARD_MESSAGE_PREVIEW_LENGTH,
  truncateGiftCardMessage,
} from '@/components/gift-cards/GiftCardRecipientBlock';

const root = process.cwd();
const source = readFileSync(
  join(root, 'components/gift-cards/GiftCardRecipientBlock.tsx'),
  'utf8',
);

describe('truncateGiftCardMessage', () => {
  it('returns a 40-character message unchanged, with no ellipsis', () => {
    const message = 'a'.repeat(40);
    expect(truncateGiftCardMessage(message)).toBe(message);
    expect(truncateGiftCardMessage(message)).not.toContain('…');
  });

  it('returns an exactly-80-code-point message unchanged, with no ellipsis', () => {
    const message = 'a'.repeat(GIFT_CARD_MESSAGE_PREVIEW_LENGTH);
    expect(truncateGiftCardMessage(message)).toBe(message);
    expect(truncateGiftCardMessage(message)).not.toContain('…');
  });

  it('truncates an 81-code-point message to 80 code points plus a single ellipsis', () => {
    const message = 'a'.repeat(81);
    const result = truncateGiftCardMessage(message);
    expect(result).toBe(`${'a'.repeat(80)}…`);
    expect(Array.from(result).length).toBe(81);
  });

  it('never splits an astral character at the boundary into an unpaired surrogate', () => {
    // 80 plain code points, then an astral (surrogate-pair) emoji as the 81st code point,
    // then more trailing text that must be dropped.
    const message = `${'a'.repeat(80)}\u{1F600}extra text past the boundary`;
    const result = truncateGiftCardMessage(message);
    const codePoints = Array.from(result);
    // Round-trips: joining the code points back together reproduces the exact string,
    // which is only possible if no surrogate half was cut.
    expect(codePoints.join('')).toBe(result);
    expect(codePoints.length).toBe(81);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(result)).toBe(false);
    expect(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(result)).toBe(false);
  });

  it('truncates a message built from 100 emoji to 80 whole emoji plus the ellipsis', () => {
    const message = '\u{1F600}'.repeat(100);
    const result = truncateGiftCardMessage(message);
    expect(result).toBe(`${'\u{1F600}'.repeat(80)}…`);
    expect(Array.from(result).length).toBe(81);
  });

  it('preserves newlines inside the retained portion', () => {
    const message = `${'a'.repeat(39)}\n${'b'.repeat(41)}`;
    const result = truncateGiftCardMessage(message);
    expect(result).toContain('\n');
    expect(result).toBe(message);
  });
});

describe('GiftCardRecipientBlock source contract', () => {
  it('opens with no client-component directive and imports nothing from react', () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(false);
    expect(source).not.toMatch(/from ["']react["']/);
  });

  it('carries both tone class pairs', () => {
    expect(source).toContain('text-on-inverse');
    expect(source).toContain('text-muted-on-inverse');
    expect(source).toContain('text-foreground');
    expect(source).toContain('text-muted-foreground');
  });

  it('carries both variant wrapper classes', () => {
    expect(source).toContain('text-xs');
    expect(source).toContain('text-sm');
  });

  it('carries the title attribute wiring for the compact message line', () => {
    expect(source).toContain('title={customization.message}');
  });

  it('preserves newlines only on the detail variant, exactly once in the file', () => {
    const matches = source.match(/whitespace-pre-line/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('renders the detail variant with the raw message, not the truncation helper', () => {
    const detailIndex = source.indexOf('whitespace-pre-line');
    expect(detailIndex).toBeGreaterThan(-1);
    const nearby = source.slice(detailIndex, detailIndex + 200);
    expect(nearby).toContain('customization.message');
    expect(nearby).not.toContain('truncateGiftCardMessage');
  });

  it('never references a bearer code or redemption token field', () => {
    expect(source).not.toContain('recipientCode');
    expect(source).not.toContain('redemptionToken');
  });
});
