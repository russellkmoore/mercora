import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/admin-middleware', () => ({
  checkAdminPermissions: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/lib/models', () => ({
  listPromotions: vi.fn(),
  listCouponInstances: vi.fn(),
}));
vi.mock('@/lib/models/mach/couponInstance', () => ({
  createCouponInstance: vi.fn(),
  updateCouponInstance: vi.fn(),
  hardDeleteCouponInstance: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ getDbAsync: vi.fn() }));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/promotions/route';
import { listCouponInstances, listPromotions } from '@/lib/models';

const promotion = {
  id: 'promo_1',
  name: { en: 'Spring sale' },
  description: { en: '' },
  status: 'active',
  rules: { actions: [{ type: 'percentage_discount', value: 10 }], conditions: [] },
  codes: { single_code: 'SPRING' },
  valid_from: '2026-01-01T00:00:00.000Z',
  valid_to: '2026-12-31T00:00:00.000Z',
};

describe('GET /api/promotions coupon fan-out (#87)', () => {
  beforeEach(() => {
    vi.mocked(listPromotions).mockResolvedValue([promotion] as never);
  });

  it('lists every coupon code for a promotion in creation order and sums usage', async () => {
    vi.mocked(listCouponInstances).mockResolvedValue([
      { id: 'c2', promotion_id: 'promo_1', code: 'SPRING-B', usage_count: 3, created_at: '2026-02-01T00:00:00Z' },
      { id: 'c1', promotion_id: 'promo_1', code: 'SPRING-A', usage_count: 2, created_at: '2026-01-15T00:00:00Z' },
      { id: 'c9', promotion_id: 'promo_other', code: 'OTHER', usage_count: 9, created_at: '2026-01-01T00:00:00Z' },
    ] as never);

    const res = await GET(new NextRequest('https://shop.example/api/promotions'));
    const [row] = (await res.json()) as Array<{ code: string; codes: string[]; currentUses: number }>;

    expect(row.codes).toEqual(['SPRING-A', 'SPRING-B']);
    expect(row.code).toBe('SPRING-A');
    expect(row.currentUses).toBe(5);
  });

  it('falls back to the promotion single_code when no coupon instance exists', async () => {
    vi.mocked(listCouponInstances).mockResolvedValue([] as never);

    const res = await GET(new NextRequest('https://shop.example/api/promotions'));
    const [row] = (await res.json()) as Array<{ code: string; codes: string[]; currentUses: number }>;

    expect(row.codes).toEqual(['SPRING']);
    expect(row.code).toBe('SPRING');
    expect(row.currentUses).toBe(0);
  });
});
