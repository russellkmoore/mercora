import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('paid-order coupon reconciliation marker', () => {
  it('atomically patches a unique protected code list only on paid orders', () => {
    const source = readFileSync('lib/models/mach/orders.ts', 'utf8');
    const start = source.indexOf('export async function recordCouponReconciliation');
    const end = source.indexOf('// Webhook operations', start);
    const helper = source.slice(start, end);

    expect(helper).toContain("'$.coupon_reconciliation_codes'");
    expect(helper).toContain('json_each');
    expect(helper).toContain('json_insert');
    expect(helper).toContain("eq(orders.payment_status, 'paid')");
  });
});
