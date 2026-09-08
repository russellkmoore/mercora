import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = readFileSync(
  join(root, 'components/checkout/OrderConfirmationModal.tsx'),
  'utf8',
);

describe('OrderConfirmationModal items source contract', () => {
  it('declares an optional items prop typed as StableCartItem[]', () => {
    const matches = source.match(/items\?:\s*StableCartItem\[\]/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('renders the Order items heading exactly once', () => {
    const matches = source.match(/Order items/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('bounds the items list with max-h-[60vh] and overflow-y-auto', () => {
    expect((source.match(/max-h-\[60vh\]/g) ?? []).length).toBe(1);
    expect(source).toContain('overflow-y-auto');
  });

  it('keys each row by lineId', () => {
    expect(source).toContain('key={item.lineId}');
  });

  it('imports and renders GiftCardRecipientBlock on exactly two lines (import + render)', () => {
    const matchingLines = source.split('\n').filter((line) => line.includes('GiftCardRecipientBlock'));
    expect(matchingLines.length).toBe(2);
  });

  it('guards the GiftCardRecipientBlock render on giftCardCustomization', () => {
    const renderIndex = source.lastIndexOf('GiftCardRecipientBlock');
    const before = source.slice(0, renderIndex);
    expect(before).toMatch(/giftCardCustomization\s*&&/);
  });

  it('places the items section after the order-ID block and before the DialogFooter', () => {
    const orderIdIndex = source.indexOf('Your order ID is');
    const footerIndex = source.indexOf('<DialogFooter');
    const headingIndex = source.indexOf('Order items');
    expect(orderIdIndex).toBeGreaterThan(-1);
    expect(footerIndex).toBeGreaterThan(-1);
    expect(headingIndex).toBeGreaterThan(orderIdIndex);
    expect(headingIndex).toBeLessThan(footerIndex);
  });

  it('contains no fetch call', () => {
    expect(source).not.toMatch(/fetch\(/);
  });

  it('omits the whole section when the items list is absent or empty (guarded, no placeholder text)', () => {
    expect(source).not.toMatch(/no items/i);
    expect(source).toMatch(/items\s*&&\s*items\.length\s*>\s*0/);
  });
});
