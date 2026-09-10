import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = readFileSync(join(root, 'app/product/[slug]/ProductDisplay.tsx'), 'utf8');

/** Comment lines stripped first so the module doc comment's own prose can't satisfy a pattern match. */
const strippedSource = source
  .split('\n')
  .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
  .join('\n');

/** The whole gift-card conditional: from `product.type === "gift_card" ? (` to the outer `) : available ? (` that starts the non-gift-card branch. */
const OUTER_GIFT_CARD_BLOCK =
  /product\.type === "gift_card" \? \(([\s\S]*?)\n\s*\) : available \? \(\s*<button/;

/** Just the giftCardSalesDisabled notice branch, up to the `) : available ? (` that gates GiftCardRecipientForm. */
const NOTICE_BLOCK = /giftCardSalesDisabled \? \(([\s\S]*?)\)\s*: available \? \(\s*<GiftCardRecipientForm/;

describe('ProductDisplay gift-card unavailable notice source contract (GCF-01, D-07)', () => {
  it('renders the unavailable notice string exactly once', () => {
    const matches = source.match(/Gift cards are not available right now/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('checks giftCardSalesDisabled ahead of the inventory available check inside the gift-card branch', () => {
    const outerMatch = strippedSource.match(OUTER_GIFT_CARD_BLOCK);
    expect(outerMatch).not.toBeNull();
    const block = outerMatch ? outerMatch[1] : '';
    const giftCardSalesDisabledIndex = block.indexOf('giftCardSalesDisabled');
    const inventoryCheckIndex = block.indexOf('available ?');
    expect(giftCardSalesDisabledIndex).toBeGreaterThan(-1);
    expect(inventoryCheckIndex).toBeGreaterThan(-1);
    expect(giftCardSalesDisabledIndex).toBeLessThan(inventoryCheckIndex);
  });

  it('styles the notice with token classes only, no hex colour and no bare Tailwind palette class', () => {
    const noticeMatch = strippedSource.match(NOTICE_BLOCK);
    expect(noticeMatch).not.toBeNull();
    const notice = noticeMatch ? noticeMatch[1] : '';
    const hexColourPattern = /#[0-9a-f]{3,8}/i;
    const paletteClassPattern =
      /\b(?:text|bg)-(?:red|green|blue|amber|yellow|orange|gray|slate|neutral)-\d{2,3}\b/;
    expect(notice).not.toMatch(hexColourPattern);
    expect(notice).not.toMatch(paletteClassPattern);
    expect(notice).toContain('text-warning');
    expect(notice).toContain('text-muted-foreground');
  });
});
