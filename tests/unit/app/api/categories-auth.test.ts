import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/admin-middleware', () => ({
  checkAdminPermissions: vi.fn().mockResolvedValue({
    success: false,
    error: 'Authentication required. Please sign in.',
  }),
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
import { GET, POST } from '@/app/api/categories/route';
import { DELETE, GET as GET_DETAIL, PUT } from '@/app/api/categories/[id]/route';
import { createCategory, listCategoriesWithRealTimeCounts } from '@/lib/models';
import { deleteCategory, getCategory, updateCategory } from '@/lib/models/mach/category';
import { checkAdminPermissions } from '@/lib/auth/admin-middleware';

const url = 'http://localhost/api/categories';
const params = { params: Promise.resolve({ id: 'category-1' }) };

describe('category mutation authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('denies POST before creating a category', async () => {
    const response = await POST(new NextRequest(url, { method: 'POST' }));
    expect(response.status).toBe(401);
    expect(vi.mocked(createCategory)).not.toHaveBeenCalled();
  });

  it('denies PUT before updating a category', async () => {
    const response = await PUT(new NextRequest(`${url}/category-1`, { method: 'PUT' }), params);
    expect(response.status).toBe(401);
    expect(vi.mocked(updateCategory)).not.toHaveBeenCalled();
  });

  it('denies DELETE before deleting a category', async () => {
    const response = await DELETE(new NextRequest(`${url}/category-1`, { method: 'DELETE' }), params);
    expect(response.status).toBe(401);
    expect(vi.mocked(deleteCategory)).not.toHaveBeenCalled();
  });
});

describe('category read behavior', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps category list GET public', async () => {
    vi.mocked(listCategoriesWithRealTimeCounts).mockResolvedValue([]);

    const response = await GET(new NextRequest(url));

    expect(response.status).toBe(200);
    expect(vi.mocked(checkAdminPermissions)).not.toHaveBeenCalled();
  });

  it('keeps category detail GET public', async () => {
    vi.mocked(getCategory).mockResolvedValue({ id: 'category-1', name: 'Packs' } as never);

    const response = await GET_DETAIL(
      new NextRequest(`${url}/category-1`),
      params
    );

    expect(response.status).toBe(200);
    expect(vi.mocked(checkAdminPermissions)).not.toHaveBeenCalled();
  });
});
