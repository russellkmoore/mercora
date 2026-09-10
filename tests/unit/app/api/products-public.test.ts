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
vi.mock('@/lib/store-config', () => ({ getStoreConfig: vi.fn() }));

import { NextRequest } from 'next/server';
import { GET as getProducts } from '@/app/api/products/route';
import { GET as getProductDetail } from '@/app/api/products/[id]/route';
import { checkAdminPermissions } from '@/lib/auth/admin-middleware';
import { getProduct, getProductsByCategory, listProducts } from '@/lib/models/mach/products';
import { getStoreConfig } from '@/lib/store-config';

/** Defaults both gift-card flags on so the existing cases keep passing unchanged. */
function setGiftCardFeatures(
  overrides: Partial<{ giftCardAcquisition: boolean; giftCardReconciliation: boolean }> = {},
) {
  vi.mocked(getStoreConfig).mockReturnValue({
    commerce: {
      features: {
        giftCardAcquisition: true,
        giftCardReconciliation: true,
        ...overrides,
      },
    },
  } as never);
}

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

const giftCardProduct = {
  ...activeProduct,
  id: 'gift-card-product',
  name: 'Gift card',
  type: 'gift_card',
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('public product endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkAdminPermissions).mockResolvedValue({
      success: false,
      error: 'Authentication required. Please sign in.',
    });
    setGiftCardFeatures();
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

  it('omits the gift card from an anonymous listing with sell off (GCF-01, GCF-03, D-14)', async () => {
    setGiftCardFeatures({ giftCardAcquisition: false });
    vi.mocked(listProducts).mockResolvedValue([activeProduct, giftCardProduct] as never);

    const response = await getProducts(new NextRequest('http://localhost/api/products'));
    const body = await response.json() as any;

    expect(body.data.map((product: any) => product.id)).toEqual(['active-product']);
    expect(body.meta.total).toBe(1);
  });

  it('still returns the gift card to an authenticated admin with sell off (D-14)', async () => {
    setGiftCardFeatures({ giftCardAcquisition: false });
    vi.mocked(checkAdminPermissions).mockResolvedValue({ success: true, userId: 'admin-1' });
    vi.mocked(listProducts).mockResolvedValue([activeProduct, giftCardProduct] as never);

    const response = await getProducts(new NextRequest('http://localhost/api/products'));
    const body = await response.json() as any;

    expect(body.data.map((product: any) => product.id).sort()).toEqual(
      ['active-product', 'gift-card-product'].sort()
    );
    expect(body.meta.total).toBe(2);
  });

  it('returns the gift card to an anonymous caller with sell on', async () => {
    setGiftCardFeatures({ giftCardAcquisition: true });
    vi.mocked(listProducts).mockResolvedValue([activeProduct, giftCardProduct] as never);

    const response = await getProducts(new NextRequest('http://localhost/api/products'));
    const body = await response.json() as any;

    expect(body.data.map((product: any) => product.id).sort()).toEqual(
      ['active-product', 'gift-card-product'].sort()
    );
    expect(body.meta.total).toBe(2);
  });
});

describe('public product pagination stays consistent with the visibility filter (WR-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkAdminPermissions).mockResolvedValue({
      success: false,
      error: 'Authentication required. Please sign in.',
    });
  });

  /** Ten active products with the gift card sitting inside the first page. */
  const catalogue = [
    { ...activeProduct, id: 'p0' },
    { ...giftCardProduct, id: 'p1' },
    ...Array.from({ length: 8 }, (_, index) => ({ ...activeProduct, id: `p${index + 2}` })),
  ];

  it('returns a full page and a matching total when a hidden product falls inside it', async () => {
    // The page used to be sliced in SQL and filtered in memory afterwards, so
    // the page holding the gift card came back with limit - 1 items while
    // `total` described the fully filtered set. A client paginating on `total`
    // walked into a hole.
    setGiftCardFeatures({ giftCardAcquisition: false });
    vi.mocked(listProducts).mockResolvedValue(catalogue as never);

    const response = await getProducts(
      new NextRequest('http://localhost/api/products?limit=3&offset=0'),
    );
    const body = await response.json() as { data: Array<{ id: string }>; meta: { total: number } };

    expect(body.data).toHaveLength(3);
    expect(body.data.map((product) => product.id)).toEqual(['p0', 'p2', 'p3']);
    expect(body.meta.total).toBe(9);
  });

  it('walks every page without a gap or a repeat', async () => {
    setGiftCardFeatures({ giftCardAcquisition: false });
    vi.mocked(listProducts).mockResolvedValue(catalogue as never);

    const seen: string[] = [];
    for (let offset = 0; offset < 9; offset += 3) {
      const response = await getProducts(
        new NextRequest(`http://localhost/api/products?limit=3&offset=${offset}`),
      );
      const body = await response.json() as { data: Array<{ id: string }> };
      seen.push(...body.data.map((product) => product.id));
    }

    expect(seen).toEqual(['p0', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
