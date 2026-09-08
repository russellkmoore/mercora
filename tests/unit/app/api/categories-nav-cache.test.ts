import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}));
vi.mock('@/lib/auth/admin-middleware', () => ({
  checkAdminPermissions: vi.fn().mockResolvedValue({ success: true, userId: 'admin-1' }),
}));
vi.mock('@/lib/models', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  listCategoriesWithRealTimeCounts: vi.fn(),
}));
vi.mock('@/lib/models/mach/category', () => ({
  getCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { POST } from '@/app/api/categories/route';
import { DELETE, PUT } from '@/app/api/categories/[id]/route';
import { createCategory } from '@/lib/models';
import { deleteCategory, updateCategory } from '@/lib/models/mach/category';
import { CATEGORY_NAV_CACHE_TAG, revalidateCategoryNav } from '@/lib/cache-tags';

const url = 'http://localhost/api/categories';
const params = { params: Promise.resolve({ id: 'category-1' }) };
const json = (body: unknown, method: string) =>
  new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('category writes expire the header nav cache', () => {
  beforeEach(() => vi.clearAllMocks());

  it('expires the tag immediately after a create', async () => {
    vi.mocked(createCategory).mockResolvedValue({ id: 'category-1', name: 'Provisions' } as never);
    const response = await POST(json({ name: 'Provisions' }, 'POST'));
    expect(response.status).toBe(201);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(CATEGORY_NAV_CACHE_TAG, { expire: 0 });
  });

  it('expires the tag after an update', async () => {
    vi.mocked(updateCategory).mockResolvedValue({ id: 'category-1', name: 'Provisions' } as never);
    const response = await PUT(json({ name: 'Provisions' }, 'PUT'), params);
    expect(response.status).toBe(200);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
  });

  it('expires the tag after a delete', async () => {
    vi.mocked(deleteCategory).mockResolvedValue(true as never);
    const response = await DELETE(new NextRequest(`${url}/category-1`, { method: 'DELETE' }), params);
    expect(response.status).toBe(200);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
  });

  it('does not expire the tag when the write fails', async () => {
    vi.mocked(createCategory).mockRejectedValue(new Error('D1 unavailable'));
    const response = await POST(json({ name: 'Provisions' }, 'POST'));
    expect(response.status).toBe(500);
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
  });

  it('never lets a revalidation failure fail the write', () => {
    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error('no request store');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => revalidateCategoryNav()).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
