import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkAdminPermissions: vi.fn(),
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  getProductsByCategory: vi.fn(),
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategoryFromIndex: vi.fn(),
  listCategoriesWithRealTimeCounts: vi.fn(),
  getCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock('@/lib/auth/admin-middleware', () => ({
  checkAdminPermissions: mocks.checkAdminPermissions,
}));
vi.mock('@/lib/models/mach/products', () => ({
  listProducts: mocks.listProducts,
  createProduct: mocks.createProduct,
  getProductsByCategory: mocks.getProductsByCategory,
  getProduct: mocks.getProduct,
  updateProduct: mocks.updateProduct,
  deleteProduct: mocks.deleteProduct,
}));
vi.mock('@/lib/models', () => ({
  listCategories: mocks.listCategories,
  createCategory: mocks.createCategory,
  updateCategory: mocks.updateCategoryFromIndex,
  listCategoriesWithRealTimeCounts: mocks.listCategoriesWithRealTimeCounts,
}));
vi.mock('@/lib/models/mach/category', () => ({
  getCategory: mocks.getCategory,
  updateCategory: mocks.updateCategory,
  deleteCategory: mocks.deleteCategory,
}));

import { NextRequest } from 'next/server';
import { POST as CREATE_PRODUCT } from '@/app/api/products/route';
import { PUT as UPDATE_PRODUCT } from '@/app/api/products/[id]/route';
import { POST as CREATE_CATEGORY } from '@/app/api/categories/route';
import { PUT as UPDATE_CATEGORY } from '@/app/api/categories/[id]/route';

function jsonRequest(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('catalog mutation error responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: 'admin-1' });
  });

  afterEach(() => vi.unstubAllEnvs());

  it('preserves the exact product-create model validation error as a 400', async () => {
    mocks.createProduct.mockRejectedValue(new Error('Invalid product data provided'));

    const response = await CREATE_PRODUCT(jsonRequest(
      'http://localhost/api/products',
      'POST',
      { name: 'Invalid model product' }
    ));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Validation failed',
      message: 'Invalid product data provided',
    });
  });

  it('masks arbitrary product-create failures in production', async () => {
    mocks.createProduct.mockRejectedValue(new Error('SQLITE secret product failure'));

    const response = await CREATE_PRODUCT(jsonRequest(
      'http://localhost/api/products',
      'POST',
      { name: 'Valid request shape' }
    ));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to create product' });
    expect(JSON.stringify(body)).not.toContain('SQLITE secret');
  });

  it('includes arbitrary product-create detail in development only', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    mocks.createProduct.mockRejectedValue(new Error('local product diagnostic'));

    const response = await CREATE_PRODUCT(jsonRequest(
      'http://localhost/api/products',
      'POST',
      { name: 'Valid request shape' }
    ));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to create product',
      details: 'local product diagnostic',
    });
  });

  it('treats arbitrary product-update exceptions as generic 500s', async () => {
    mocks.updateProduct.mockRejectedValue(new Error('driver DSN product update'));

    const response = await UPDATE_PRODUCT(
      jsonRequest('http://localhost/api/products/prod-1', 'PUT', { name: 'Updated' }),
      { params: Promise.resolve({ id: 'prod-1' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to update product' });
    expect(JSON.stringify(body)).not.toContain('driver DSN');
  });

  it('preserves category model validation prefixes as a 400 on create', async () => {
    mocks.createCategory.mockRejectedValue(
      new Error('Category validation failed: slug must contain only lowercase letters')
    );

    const response = await CREATE_CATEGORY(jsonRequest(
      'http://localhost/api/categories',
      'POST',
      { name: 'Category' }
    ));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Validation failed',
      message: 'Category validation failed: slug must contain only lowercase letters',
    });
  });

  it('preserves category model validation prefixes as a 400 on update', async () => {
    mocks.updateCategory.mockRejectedValue(
      new Error('Category validation failed: position must be a positive integer')
    );

    const response = await UPDATE_CATEGORY(
      jsonRequest('http://localhost/api/categories/cat-1', 'PUT', { position: -1 }),
      { params: Promise.resolve({ id: 'cat-1' }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: 'Category validation failed: position must be a positive integer',
    });
  });

  it('masks arbitrary category-update failures in production', async () => {
    mocks.updateCategory.mockRejectedValue(new Error('database password category update'));

    const response = await UPDATE_CATEGORY(
      jsonRequest('http://localhost/api/categories/cat-1', 'PUT', { name: 'Updated' }),
      { params: Promise.resolve({ id: 'cat-1' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to update category' });
    expect(JSON.stringify(body)).not.toContain('database password');
  });
});
