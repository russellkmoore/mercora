import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('coupon redemption SQL invariants', () => {
  it('normalizes malformed usage_records before appending the order audit', () => {
    const source = readFileSync('lib/models/mach/couponInstance.ts', 'utf8');
    const start = source.indexOf('export async function redeemCoupon');
    const end = source.indexOf('export async function generateBulkCouponInstances', start);
    const redemption = source.slice(start, end);

    expect(redemption).toContain('CASE json_type(extensions)');
    expect(redemption).toContain("WHEN 'object' THEN extensions");
    expect(redemption).toContain("ELSE json('{}')");
    expect(redemption).toContain("CASE json_type(extensions, '$.usage_records')");
    expect(redemption).toContain("WHEN 'array' THEN json_extract(extensions, '$.usage_records')");
    expect(redemption).toContain("ELSE json('[]')");
    expect(redemption).toContain("COALESCE(usage_count, 0) + 1");
  });
});
