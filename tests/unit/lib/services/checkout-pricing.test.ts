import { describe, expect, it, vi } from 'vitest';
import { mapProviderTaxAllocations, priceCheckout } from '@/lib/services/checkout-pricing';
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
    calculateTax: vi.fn(async (params: any) => ({
      tax_amount_exclusive: 200,
      line_items: {
        data: params.line_items.map((line: any, index: number) => ({
          ...line,
          amount_tax: index === 0 ? 200 : 0,
        })),
        has_more: false,
      },
      shipping_cost: params.shipping_cost
        ? { amount: params.shipping_cost.amount, amount_tax: 0 }
        : null,
    })),
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
      id: expect.stringMatching(/^line_[0-9a-f-]{36}$/),
      product_name: 'Catalog name',
      sku: 'SKU-1',
      unit_price: { amount: 2_000, currency: 'USD' },
      total_price: { amount: 4_000, currency: 'USD' },
    });
    expect(quote.total).toEqual({ amount: 4_700, currency: 'USD' });
    expect(quote.lineAllocations).toEqual([expect.objectContaining({
      lineId: quote.items[0].id,
      catalogSubtotal: { amount: 4_000, currency: 'USD' },
      merchandiseDiscount: { amount: 0, currency: 'USD' },
      tax: { amount: 200, currency: 'USD' },
    })]);
  });

  it('keeps one-time checkout independent from subscription acquisition', async () => {
    const orderPaid = vi.fn();
    const quote = await priceCheckout({
      items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 1 }],
      shippingAddress: address,
      shippingMethodId: 'standard',
    }, {
      dependencies: dependencies() as any,
      capabilities: {
        giftCards: {
          resolveTender: vi.fn(async ({ currency }) => ({ amount: Money.zero(currency) })),
          verifyReservedTender: vi.fn(),
          applyTender: vi.fn(),
        },
        subscriptions: { orderPaid },
      },
    });

    expect(quote.total).toEqual({ amount: 2700, currency: 'USD' });
    expect(orderPaid).not.toHaveBeenCalled();
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

  it('uses the same free-shipping defaults as the public estimator on a fresh install', async () => {
    const quote = await priceCheckout({
      items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 4 }],
      shippingAddress: address,
      shippingMethodId: 'standard',
    }, {
      dependencies: dependencies({
        getProductVariant: vi.fn(async () => ({
          id: 'var_1',
          product_id: 'prod_1',
          sku: 'SKU-1',
          status: 'active',
          option_values: [],
          price: Money.fromMinor(2_000).toJSON(),
        })),
        getSettings: vi.fn(async (category: string) => category === 'shipping'
          ? {}
          : { 'store.tax_rate': 10 }),
      }) as any,
    });

    expect(quote.shipping).toEqual({ amount: 0, currency: 'USD' });
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

  it('persists targeted promotion contribution and out-of-order provider tax by stable line id', async () => {
    const calculateTax = vi.fn(async (params: any) => ({
      tax_amount_exclusive: 155,
      line_items: {
        has_more: false,
        data: [
          { ...params.line_items[1], amount_tax: 100 },
          { ...params.line_items[0], amount_tax: 50 },
        ],
      },
      shipping_cost: { amount: 500, amount_tax: 5 },
    }));
    const deps = dependencies({
      getProduct: vi.fn(async (id: string) => ({
        id,
        name: id,
        status: 'active',
        categories: id === 'prod_target' ? ['target'] : ['other'],
        default_variant_id: `var_${id}`,
        tax_category: 'txcd_99999999',
      })),
      getProductVariant: vi.fn(async (id: string) => ({
        id,
        product_id: id.replace(/^var_/, ''),
        sku: id,
        status: 'active',
        option_values: [],
        price: Money.fromMinor(1_000).toJSON(),
      })),
      validateCouponCode: vi.fn(async () => ({
        canBeUsed: true,
        coupon: { promotion_id: 'promo_target', code: 'TARGET' },
      })),
      getPromotionById: vi.fn(async () => ({
        id: 'promo_target',
        name: 'Targeted',
        type: 'cart',
        status: 'active',
        stackable: true,
        rules: {
          conditions: [{ type: 'product_category', operator: 'in', value: ['target'] }],
          actions: [{ type: 'fixed_discount', value: 500 }],
        },
      })),
      calculateTax,
    });

    const quote = await priceCheckout({
      items: [
        { productId: 'prod_target', quantity: 1 },
        { productId: 'prod_other', quantity: 1 },
      ],
      shippingAddress: address,
      shippingMethodId: 'standard',
      discountCodes: ['TARGET'],
    }, { dependencies: deps as any });

    expect(calculateTax).toHaveBeenCalledWith(expect.objectContaining({
      expand: ['line_items'],
      line_items: [
        expect.objectContaining({ amount: 500, reference: `line:${quote.items[0].id}` }),
        expect.objectContaining({ amount: 1_000, reference: `line:${quote.items[1].id}` }),
      ],
    }));
    expect(quote.lineAllocations).toEqual([
      expect.objectContaining({
        lineId: quote.items[0].id,
        merchandiseDiscount: { amount: 500, currency: 'USD' },
        netMerchandise: { amount: 500, currency: 'USD' },
        tax: { amount: 50, currency: 'USD' },
        promotionCodes: ['TARGET'],
      }),
      expect.objectContaining({
        lineId: quote.items[1].id,
        merchandiseDiscount: { amount: 0, currency: 'USD' },
        tax: { amount: 100, currency: 'USD' },
        promotionCodes: [],
      }),
    ]);
    expect(quote.shippingTax).toEqual({ amount: 5, currency: 'USD' });
    expect(quote.lineAllocations.reduce((sum, line) => sum + line.tax.amount, 0) +
      quote.shippingTax.amount).toBe(quote.tax.amount);
  });

  it.each([
    ['missing lines', { line_items: undefined }],
    ['paginated lines', { line_items: { has_more: true, data: [] } }],
    ['missing count', { line_items: { has_more: false, data: [] } }],
    ['unknown reference', {
      line_items: { has_more: false, data: [{ reference: 'line:other', amount: 100, amount_tax: 5 }] },
    }],
    ['amount mismatch', {
      line_items: { has_more: false, data: [{ reference: 'line:a', amount: 99, amount_tax: 5 }] },
    }],
    ['aggregate mismatch', {
      line_items: { has_more: false, data: [{ reference: 'line:a', amount: 100, amount_tax: 5 }] },
      tax_amount_exclusive: 6,
    }],
    ['shipping mismatch', {
      line_items: { has_more: false, data: [{ reference: 'line:a', amount: 100, amount_tax: 5 }] },
      shipping_cost: { amount: 49, amount_tax: 5 },
      tax_amount_exclusive: 10,
    }],
  ])('rejects provider allocation mismatch: %s', (_name, override) => {
    const valid = Object.assign({
      line_items: {
        has_more: false,
        data: [{ reference: 'line:a', amount: 100, amount_tax: 5 }],
      },
      shipping_cost: { amount: 50, amount_tax: 5 },
      tax_amount_exclusive: 10,
    }, override);
    expect(() => mapProviderTaxAllocations(valid as any, [{ lineId: 'a', amount: 100 }], 50))
      .toThrow();
  });

  it('rejects duplicate provider references even when the line count matches', () => {
    const calculation = {
      line_items: {
        has_more: false,
        data: [
          { reference: 'line:a', amount: 100, amount_tax: 5 },
          { reference: 'line:a', amount: 100, amount_tax: 5 },
        ],
      },
      shipping_cost: null,
      tax_amount_exclusive: 10,
    };
    expect(() => mapProviderTaxAllocations(calculation as any, [
      { lineId: 'a', amount: 100 },
      { lineId: 'b', amount: 100 },
    ], 0)).toThrow('duplicate');
  });

  it('uses largest remainders so fallback line taxes remain integer and sum exactly', async () => {
    const deps = dependencies({
      getProductVariant: vi.fn(async (id: string) => ({
        id,
        product_id: 'prod_1',
        sku: id,
        status: 'active',
        option_values: [],
        price: Money.fromMinor(1).toJSON(),
      })),
      getSettings: vi.fn(async (category: string) => category === 'shipping'
        ? { 'shipping.methods': [{ id: 'standard', label: 'Standard', cost: 0, enabled: true }] }
        : { 'store.tax_rate': 50 }),
      calculateTax: vi.fn(async () => { throw new Error('offline'); }),
    });
    const quote = await priceCheckout({
      items: [
        { productId: 'prod_1', variantId: 'v1', quantity: 1 },
        { productId: 'prod_1', variantId: 'v2', quantity: 1 },
        { productId: 'prod_1', variantId: 'v3', quantity: 1 },
      ],
      shippingAddress: address,
      shippingMethodId: 'standard',
    }, { dependencies: deps as any });

    const taxes = quote.lineAllocations.map((line) => line.tax.amount);
    expect(taxes).toEqual([1, 1, 0]);
    expect(taxes.every((amount) => Number.isSafeInteger(amount) && amount >= 0)).toBe(true);
    expect(taxes.reduce((sum, amount) => sum + amount, 0)).toBe(quote.tax.amount);
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
