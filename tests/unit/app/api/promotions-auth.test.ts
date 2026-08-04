import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/admin-middleware', () => ({
  checkAdminPermissions: vi.fn().mockResolvedValue({
    success: false,
    error: 'Authentication required. Please sign in.',
  }),
}));
vi.mock('@/lib/models', () => ({
  listPromotions: vi.fn(),
  listCouponInstances: vi.fn(),
}));
vi.mock('@/lib/models/mach/couponInstance', () => ({
  createCouponInstance: vi.fn(),
  hardDeleteCouponInstance: vi.fn(),
  updateCouponInstance: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ getDbAsync: vi.fn() }));

import { NextRequest } from 'next/server';
import { DELETE, GET, POST, PUT } from '@/app/api/promotions/route';
import { getDbAsync } from '@/lib/db';
import { listCouponInstances, listPromotions } from '@/lib/models';
import {
  createCouponInstance,
  hardDeleteCouponInstance,
  updateCouponInstance,
} from '@/lib/models/mach/couponInstance';
import { checkAdminPermissions } from '@/lib/auth/admin-middleware';

const url = 'http://localhost/api/promotions';

describe('promotion route authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('denies GET before promotions or coupon codes are read', async () => {
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(401);
    expect(vi.mocked(listPromotions)).not.toHaveBeenCalled();
    expect(vi.mocked(listCouponInstances)).not.toHaveBeenCalled();
  });

  it('denies POST before any database write', async () => {
    const response = await POST(new NextRequest(url, { method: 'POST' }));
    expect(response.status).toBe(401);
    expect(vi.mocked(getDbAsync)).not.toHaveBeenCalled();
    expect(vi.mocked(createCouponInstance)).not.toHaveBeenCalled();
  });

  it('denies PUT before any database write', async () => {
    const response = await PUT(new NextRequest(url, { method: 'PUT' }));
    expect(response.status).toBe(401);
    expect(vi.mocked(getDbAsync)).not.toHaveBeenCalled();
    expect(vi.mocked(updateCouponInstance)).not.toHaveBeenCalled();
  });

  it('denies DELETE before any database write', async () => {
    const response = await DELETE(new NextRequest(`${url}?id=promotion-1`, { method: 'DELETE' }));
    expect(response.status).toBe(401);
    expect(vi.mocked(getDbAsync)).not.toHaveBeenCalled();
    expect(vi.mocked(hardDeleteCouponInstance)).not.toHaveBeenCalled();
  });

  it('allows an authenticated admin to delete a promotion', async () => {
    vi.mocked(checkAdminPermissions).mockResolvedValueOnce({
      success: true,
      userId: 'admin-1',
    });
    vi.mocked(listCouponInstances).mockResolvedValue([]);
    const where = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
    const deleteFrom = vi.fn(() => ({ where }));
    vi.mocked(getDbAsync).mockResolvedValue({ delete: deleteFrom } as never);

    const response = await DELETE(
      new NextRequest(`${url}?id=promotion-1`, { method: 'DELETE' })
    );

    expect(response.status).toBe(200);
    expect(deleteFrom).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });
});
