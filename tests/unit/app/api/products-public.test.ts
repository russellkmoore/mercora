import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/admin-middleware', () => ({ checkAdminPermissions: vi.fn() }));
vi.mock('@/lib/models/mach/products', () => ({
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  getProductsByCategory: vi.fn(),
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

import { NextRequest } from 'next/server';
import { GET as getProducts } from '@/app/api/products/route';
import { GET as getProductDetail } from '@/app/api/products/[id]/route';
import { checkAdminPermissions } from '@/lib/auth/admin-middleware';
import { getProduct, getProductsByCategory, listProducts } from '@/lib/models/mach/products';

const activeProduct = {
  id: 'active-product',
  name: 'Active product',
  status: 'active',
  external_references: { erp: 'internal-id' },
  extensions: { secret: 'internal-value' },
  variants: [
    {
      id: 'active-variant',
      sku: 'ACTIVE-1',
      option_values: [],
      price: { amount: 2500, currency: 'USD' },
      cost: { amount: 700, currency: 'USD' },
      barcode: '012345678905',
      inventory: { track_inventory: true, quantity: 10 },
      attributes: { color: 'blue' },
    },
  ],
};

const inactiveProduct = {
  ...activeProduct,
  id: 'inactive-product',
  name: 'Inactive product',
  status: 'inactive',
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('public product endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkAdminPermissions).mockResolvedValue({
      success: false,
      error: 'Authentication required. Please sign in.',
    });
  });

  it('keeps list GET public but returns active products only with public fields', async () => {
    vi.mocked(listProducts).mockResolvedValue([activeProduct, inactiveProduct] as never);

    const response = await getProducts(
      new NextRequest('http://localhost/api/products?status=inactive')
    );
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body.data.map((product: any) => product.id)).toEqual(['active-product']);
    expect(body.meta.total).toBe(1);
    expect(body.data[0].variants[0].attributes).toEqual({ color: 'blue' });
    expect(JSON.stringify(body)).not.toMatch(/cost|barcode|inventory|external_references|secret/);
    for (const [options] of vi.mocked(listProducts).mock.calls) {
      expect(options?.status).toEqual(['active']);
    }
  });

  it('points the last link at the final populated page for exact multiples', async () => {
    const twentyProducts = Array.from({ length: 20 }, (_, index) => ({
      ...activeProduct,
      id: `active-product-${index}`,
    }));
    vi.mocked(listProducts).mockResolvedValue(twentyProducts as never);

    const response = await getProducts(
      new NextRequest('http://localhost/api/products?limit=20&offset=0')
    );
    const body = await response.json() as any;

    expect(body.meta.total).toBe(20);
    expect(body.links.last).toBe('/api/products?limit=20&offset=0');
  });

  it('preserves category filters in pagination links', async () => {
    const categoryProducts = Array.from({ length: 21 }, (_, index) => ({
      ...activeProduct,
      id: `category-product-${index}`,
    }));
    vi.mocked(getProductsByCategory).mockResolvedValue(categoryProducts as never);

    const response = await getProducts(
      new NextRequest('http://localhost/api/products?category=trail%20gear&limit=20')
    );
    const body = await response.json() as any;

    expect(body.data).toHaveLength(20);
    expect(body.links.next).toBe('/api/products?limit=20&offset=20&category=trail+gear');
    expect(body.links.last).toBe('/api/products?limit=20&offset=20&category=trail+gear');
  });

  it('returns a projected active detail to a public caller', async () => {
    vi.mocked(getProduct).mockResolvedValue(activeProduct as never);

    const response = await getProductDetail(
      new NextRequest('http://localhost/api/products/active-product'),
      params('active-product')
    );
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body.data.id).toBe('active-product');
    expect(body.data.variants[0].attributes).toEqual({ color: 'blue' });
    expect(JSON.stringify(body)).not.toMatch(/cost|barcode|inventory|external_references|secret/);
  });

  it('returns 404 for an inactive detail to a public caller', async () => {
    vi.mocked(getProduct).mockResolvedValue(inactiveProduct as never);

    const response = await getProductDetail(
      new NextRequest('http://localhost/api/products/inactive-product'),
      params('inactive-product')
    );

    expect(response.status).toBe(404);
  });

  it('returns the full representation and non-active records only to an authenticated admin', async () => {
    vi.mocked(checkAdminPermissions).mockResolvedValue({ success: true, userId: 'admin-1' });
    vi.mocked(getProduct).mockResolvedValue(inactiveProduct as never);

    const response = await getProductDetail(
      new NextRequest('http://localhost/api/products/inactive-product'),
      params('inactive-product')
    );
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body.data.status).toBe('inactive');
    expect(body.data.variants[0]).toHaveProperty('cost');
    expect(body.data.variants[0]).toHaveProperty('inventory');
    expect(body.data).toHaveProperty('extensions.secret', 'internal-value');
  });
});
