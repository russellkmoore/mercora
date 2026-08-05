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
});
