import { describe, expect, it } from 'vitest';
import { calculatePartialReturnMinor } from '@/lib/admin/order-return-calculation';

const policy = {
  refundShipping: false,
  refundShippingOnFullReturn: true,
  restockingFeePercent: 0,
  applyRestockingFeeOnPartialReturn: true,
};

const items = [
  { id: 'line-1', product_id: 'p1', variant_id: 'v1', quantity: 1, unit_price: { amount: 10, currency: 'USD' } },
  { id: 'line-2', product_id: 'p2', variant_id: 'v2', quantity: 1, unit_price: 10 },
];

describe('admin partial-return calculation', () => {
  it('converts MACH-major item prices once and uses canonical stored minor breakdowns', () => {
    const result = calculatePartialReturnMinor({
      currency_code: 'USD',
      items,
      extensions: {
        checkout_catalog_subtotal: { amount: 2_000, currency: 'USD' },
        checkout_merchandise_discount: { amount: 200, currency: 'USD' },
        checkout_tax: { amount: 180, currency: 'USD' },
        checkout_shipping_before_discount: { amount: 500, currency: 'USD' },
        checkout_shipping_discount: { amount: 100, currency: 'USD' },
      },
    }, ['line-1'], policy);

    expect(result).toMatchObject({
      subtotal: 1_000,
      tax: 90,
      discount: 100,
      shipping: 0,
      total: 990,
      allocationMethod: 'legacy_proportional',
    });
  });

  it('keeps documented legacy cents and decimal-major shipping fallbacks', () => {
    const result = calculatePartialReturnMinor({
      currency_code: 'USD',
      items,
      extensions: { subtotal: 2_000, tax_amount: 180, discount_amount: 200, shipping_cost: 5 },
    }, ['line-1', 'line-2'], policy);

    expect(result).toMatchObject({
      subtotal: 2_000,
      tax: 180,
      discount: 200,
      shipping: 500,
      total: 2_480,
      allocationMethod: 'legacy_full_order',
    });
  });

  it('sums exact targeted discount and provider tax snapshots by stable line id', () => {
    const result = calculatePartialReturnMinor({
      currency_code: 'USD',
      items,
      extensions: {
        checkout_catalog_subtotal: { amount: 2_000, currency: 'USD' },
        checkout_merchandise_discount: { amount: 500, currency: 'USD' },
        checkout_tax: { amount: 165, currency: 'USD' },
        checkout_shipping_tax: { amount: 15, currency: 'USD' },
        checkout_shipping_before_discount: { amount: 500, currency: 'USD' },
        checkout_shipping_discount: { amount: 0, currency: 'USD' },
        checkout_line_allocations: [
          {
            lineId: 'line-1', productId: 'p1', variantId: 'v1', quantity: 1,
            catalogSubtotal: { amount: 1_000, currency: 'USD' },
            merchandiseDiscount: { amount: 500, currency: 'USD' },
            netMerchandise: { amount: 500, currency: 'USD' },
            tax: { amount: 50, currency: 'USD' }, promotionCodes: ['TARGET'],
          },
          {
            lineId: 'line-2', productId: 'p2', variantId: 'v2', quantity: 1,
            catalogSubtotal: { amount: 1_000, currency: 'USD' },
            merchandiseDiscount: { amount: 0, currency: 'USD' },
            netMerchandise: { amount: 1_000, currency: 'USD' },
            tax: { amount: 100, currency: 'USD' }, promotionCodes: [],
          },
        ],
      },
    }, ['line-1'], policy);

    expect(result).toMatchObject({
      subtotal: 1_000,
      tax: 50,
      discount: 500,
      shipping: 0,
      total: 550,
      allocationMethod: 'exact_snapshot',
    });
  });

  it('includes separately allocated shipping tax only when shipping is refunded', () => {
    const exactOrder = {
      currency_code: 'USD',
      items,
      extensions: {
        checkout_catalog_subtotal: { amount: 2_000, currency: 'USD' },
        checkout_merchandise_discount: { amount: 0, currency: 'USD' },
        checkout_tax: { amount: 215, currency: 'USD' },
        checkout_shipping_tax: { amount: 15, currency: 'USD' },
        checkout_shipping_before_discount: { amount: 500, currency: 'USD' },
        checkout_shipping_discount: { amount: 0, currency: 'USD' },
        checkout_line_allocations: items.map((item) => ({
          lineId: item.id,
          productId: item.product_id,
          variantId: item.variant_id,
          quantity: item.quantity,
          catalogSubtotal: { amount: 1_000, currency: 'USD' },
          merchandiseDiscount: { amount: 0, currency: 'USD' },
          netMerchandise: { amount: 1_000, currency: 'USD' },
          tax: { amount: 100, currency: 'USD' },
          promotionCodes: [],
        })),
      },
    };

    expect(calculatePartialReturnMinor(exactOrder, ['line-1', 'line-2'], policy))
      .toMatchObject({ tax: 215, shipping: 500, total: 2_715 });
  });

  it('rejects a present but internally inconsistent exact snapshot', () => {
    expect(() => calculatePartialReturnMinor({
      currency_code: 'USD',
      items: [items[0]],
      extensions: {
        checkout_catalog_subtotal: { amount: 1_000, currency: 'USD' },
        checkout_merchandise_discount: { amount: 500, currency: 'USD' },
        checkout_tax: { amount: 50, currency: 'USD' },
        checkout_shipping_tax: { amount: 0, currency: 'USD' },
        checkout_line_allocations: [{
          lineId: 'line-1', productId: 'p1', variantId: 'v1', quantity: 1,
          catalogSubtotal: { amount: 1_000, currency: 'USD' },
          merchandiseDiscount: { amount: 500, currency: 'USD' },
          netMerchandise: { amount: 501, currency: 'USD' },
          tax: { amount: 50, currency: 'USD' }, promotionCodes: [],
        }],
      },
    }, ['line-1'], policy)).toThrow('corrupt');
  });
});
