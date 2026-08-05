import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/admin-middleware', () => ({
  checkAdminPermissions: vi.fn().mockResolvedValue({
    success: false,
    error: 'Authentication required. Please sign in.',
  }),
}));
vi.mock('@/lib/models/mach/products', () => ({
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  getProductsByCategory: vi.fn(),
  getProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/products/route';
import { DELETE, PUT } from '@/app/api/products/[id]/route';
import { createProduct, deleteProduct, updateProduct } from '@/lib/models/mach/products';
import { checkAdminPermissions } from '@/lib/auth/admin-middleware';

const url = 'http://localhost/api/products';
const params = { params: Promise.resolve({ id: 'product-1' }) };

describe('product mutation authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('denies POST before parsing input or creating a product', async () => {
    const response = await POST(new NextRequest(url, { method: 'POST' }));
    expect(response.status).toBe(401);
    expect(vi.mocked(createProduct)).not.toHaveBeenCalled();
  });

  it('denies PUT before updating a product', async () => {
    const response = await PUT(new NextRequest(`${url}/product-1`, { method: 'PUT' }), params);
    expect(response.status).toBe(401);
    expect(vi.mocked(updateProduct)).not.toHaveBeenCalled();
  });

  it('denies DELETE before deleting a product', async () => {
    const response = await DELETE(new NextRequest(`${url}/product-1`, { method: 'DELETE' }), params);
    expect(response.status).toBe(401);
    expect(vi.mocked(deleteProduct)).not.toHaveBeenCalled();
  });

  it('allows an authenticated admin to create a product', async () => {
    vi.mocked(checkAdminPermissions).mockResolvedValueOnce({
      success: true,
      userId: 'admin-1',
    });
    vi.mocked(createProduct).mockResolvedValue({
      id: 'product-1',
      name: 'Trail Pack',
      status: 'active',
    });

    const response = await POST(new NextRequest(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Trail Pack' }),
    }));

    expect(response.status).toBe(201);
    expect(vi.mocked(createProduct)).toHaveBeenCalledWith({ name: 'Trail Pack' });
  });
});
