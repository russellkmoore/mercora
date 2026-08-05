import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('admin order quick-edit contract', () => {
  it('sends only notes through the metadata-only generic order PUT', () => {
    const source = readFileSync('app/admin/orders/page.tsx', 'utf8');
    const start = source.indexOf('const updateOrderNotes');
    const end = source.indexOf('const toggleOrderExpansion', start);
    const updateSection = source.slice(start, end);

    expect(updateSection).toContain('body: JSON.stringify({');
    expect(updateSection).toContain('orderId,\n          notes');
    expect(updateSection).not.toContain('tracking_number');
    expect(updateSection).not.toContain('shipped_at');
    expect(updateSection).not.toContain('delivered_at');
    expect(updateSection).not.toContain('updates.status');
  });

  it('prefers canonical stored checkout breakdown fields in both admin views', () => {
    for (const path of ['app/admin/orders/page.tsx', 'app/admin/orders/[id]/page.tsx']) {
      const source = readFileSync(path, 'utf8');
      expect(source).toContain('checkout_catalog_subtotal');
      expect(source).toContain('checkout_shipping_before_discount');
      expect(source).toContain('checkout_tax');
      expect(source).toContain('checkout_discount');
      expect(source).toContain('formatStoredCurrency');
    }
  });

  it('posts the minor-unit partial-return calculation without another factor of 100', () => {
    const source = readFileSync('app/admin/orders/[id]/page.tsx', 'utf8');
    expect(source).toContain('amount: returnCalculation.total');
    expect(source).not.toContain('returnCalculation.total * 100');
    expect(source).toContain('calculatePartialReturnMinor(order, selectedItemIds, refundPolicy)');
  });
});
