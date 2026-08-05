import { describe, expect, it, vi } from 'vitest';
import { priceCheckout } from '@/lib/services/checkout-pricing';
import { Money } from '@/lib/money';

const address = {
  line1: '1 Main St',
  city: 'Denver',
  region: 'CO',
  postal_code: '80202',
  country: 'US',
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    getProduct: vi.fn(async () => ({
      id: 'prod_1',
      name: 'Catalog name',
      status: 'active',
      categories: ['category-1'],
      tax_category: 'txcd_99999999',
      default_variant_id: 'var_1',
    })),
    getProductVariant: vi.fn(async () => ({
      id: 'var_1',
      product_id: 'prod_1',
      sku: 'SKU-1',
      status: 'active',
      option_values: [],
      price: Money.fromMinor(2_000).toJSON(),
    })),
    validateCouponCode: vi.fn(async () => ({ canBeUsed: false })),
    getPromotionById: vi.fn(),
    getSettings: vi.fn(async (category: string) => category === 'shipping'
      ? {
          'shipping.methods': [{ id: 'standard', label: 'Standard', cost: 5, enabled: true }],
          'shipping.free_methods': [],
        }
      : { 'store.tax_rate': 10 }),
    calculateTax: vi.fn(async () => ({ tax_amount_exclusive: 200 })),
    ...overrides,
  };
}

describe('server-authoritative checkout pricing', () => {
  it('uses catalog identity, name, SKU and price rather than client display or totals', async () => {
    const quote = await priceCheckout({
      items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 2 }],
      shippingAddress: address,
      shippingMethodId: 'standard',
    }, { dependencies: dependencies() as any });

    expect(quote.items[0]).toMatchObject({
      product_name: 'Catalog name',
      sku: 'SKU-1',
      unit_price: { amount: 2_000, currency: 'USD' },
      total_price: { amount: 4_000, currency: 'USD' },
    });
    expect(quote.total).toEqual({ amount: 4_700, currency: 'USD' });
  });

  it('uses the shared enabled shipping defaults on a fresh install', async () => {
    const quote = await priceCheckout({
      items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 1 }],
      shippingAddress: address,
      shippingMethodId: 'standard',
    }, {
      dependencies: dependencies({
        getSettings: vi.fn(async (category: string) => category === 'shipping'
          ? {}
          : { 'store.tax_rate': 10 }),
      }) as any,
    });

    expect(quote.shippingMethod.label).toBe('Standard (5–7 days)');
    expect(quote.shipping).toEqual({ amount: 599, currency: 'USD' });
  });

  it('enforces the configured destination allowlist at authoritative pricing', async () => {
    await expect(priceCheckout({
      items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 1 }],
      shippingAddress: { ...address, country: 'CA' },
      shippingMethodId: 'standard',
    }, { dependencies: dependencies() as any })).rejects.toThrow('not available for CA');

    await expect(priceCheckout({
      items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 1 }],
      shippingAddress: { ...address, country: 'CA' },
      shippingMethodId: 'standard',
    }, {
      dependencies: dependencies({
        getSettings: vi.fn(async (category: string) => category === 'shipping'
          ? {
              'shipping.allowed_countries': ['CA'],
              'shipping.methods': [{ id: 'standard', label: 'Canada', cost: 8, enabled: true }],
            }
          : { 'store.tax_rate': 10 }),
      }) as any,
    })).resolves.toMatchObject({ shippingMethod: { label: 'Canada' } });
  });

  it('rejects oversized public catalog identifiers before lookup', async () => {
    const deps = dependencies();
    await expect(priceCheckout({
      items: [{ productId: 'p'.repeat(129), variantId: 'var_1', quantity: 1 }],
      shippingAddress: address,
      shippingMethodId: 'standard',
    }, { dependencies: deps as any })).rejects.toThrow('line 0 is invalid');
    expect(deps.getProduct).not.toHaveBeenCalled();
  });

  it('fails closed when an exact variant belongs to another product', async () => {
    await expect(priceCheckout({
      items: [{ productId: 'prod_1', variantId: 'var_other', quantity: 1 }],
      shippingAddress: address,
      shippingMethodId: 'standard',
    }, {
      dependencies: dependencies({
        getProductVariant: vi.fn(async () => ({
          id: 'var_other', product_id: 'prod_other', sku: 'X', status: 'active', price: { amount: 1, currency: 'USD' },
        })),
      }) as any,
    })).rejects.toThrow('not available for product');
  });

  it('uses a valid configured tax fallback and rejects a missing fallback', async () => {
    const fallbackDeps = dependencies({ calculateTax: vi.fn(async () => { throw new Error('offline'); }) });
    const quote = await priceCheckout({
      items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 1 }],
      shippingAddress: address,
      shippingMethodId: 'standard',
    }, { dependencies: fallbackDeps as any });
    expect(quote.tax).toEqual({ amount: 200, currency: 'USD' });

    const invalid = dependencies({
      calculateTax: vi.fn(async () => { throw new Error('offline'); }),
      getSettings: vi.fn(async (category: string) => category === 'shipping'
        ? { 'shipping.methods': [{ id: 'standard', label: 'Standard', cost: 5, enabled: true }] }
        : {}),
    });
    await expect(priceCheckout({
      items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 1 }],
      shippingAddress: address,
      shippingMethodId: 'standard',
    }, { dependencies: invalid as any })).rejects.toThrow('store.tax_rate');
  });

  it('does not persist a coupon code whose promotion contributes no discount', async () => {
    const deps = dependencies({
      validateCouponCode: vi.fn(async () => ({
        canBeUsed: true,
        coupon: { promotion_id: 'promo_1', code: 'NOOP' },
      })),
      getPromotionById: vi.fn(async () => ({
        id: 'promo_1',
        name: 'No-op',
        type: 'cart',
        status: 'active',
        stackable: true,
        rules: { actions: [{ type: 'fixed_discount', value: 0 }] },
      })),
    });
    const quote = await priceCheckout({
      items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 1 }],
      shippingAddress: address,
      shippingMethodId: 'standard',
      discountCodes: ['NOOP'],
    }, { dependencies: deps as any });
    expect(quote.discountCodes).toEqual([]);
  });

  it('fails closed when promotion eligibility cannot be proven', async () => {
    const deps = dependencies({
      validateCouponCode: vi.fn(async () => ({
        canBeUsed: true,
        coupon: { promotion_id: 'promo_vip', code: 'VIP' },
      })),
      getPromotionById: vi.fn(async () => ({
        id: 'promo_vip',
        name: 'VIP only',
        type: 'cart',
        status: 'active',
        stackable: true,
        eligibility: { requires_account: true, customer_segments: ['vip'] },
        rules: { actions: [{ type: 'fixed_discount', value: 500 }] },
      })),
    });
    const quote = await priceCheckout({
      items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 1 }],
      shippingAddress: address,
      shippingMethodId: 'standard',
      discountCodes: ['VIP'],
    }, { dependencies: deps as any });
    expect(quote.discount).toEqual({ amount: 0, currency: 'USD' });
    expect(quote.discountCodes).toEqual([]);
  });
});
