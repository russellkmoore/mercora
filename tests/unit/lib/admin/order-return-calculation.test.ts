import { describe, expect, it } from 'vitest';
import { calculatePartialReturnMinor } from '@/lib/admin/order-return-calculation';

const policy = {
  refundShipping: false,
  refundShippingOnFullReturn: true,
  restockingFeePercent: 0,
  applyRestockingFeeOnPartialReturn: true,
};

const items = [
  { product_id: 'p1', variant_id: 'v1', quantity: 1, unit_price: { amount: 10, currency: 'USD' } },
  { product_id: 'p2', variant_id: 'v2', quantity: 1, unit_price: 10 },
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
    }, ['p1-v1'], policy);

    expect(result).toMatchObject({ subtotal: 1_000, tax: 90, discount: 100, shipping: 0, total: 990 });
  });

  it('keeps documented legacy cents and decimal-major shipping fallbacks', () => {
    const result = calculatePartialReturnMinor({
      currency_code: 'USD',
      items,
      extensions: { subtotal: 2_000, tax_amount: 180, discount_amount: 200, shipping_cost: 5 },
    }, ['p1-v1', 'p2-v2'], policy);

    expect(result).toMatchObject({ subtotal: 2_000, tax: 180, discount: 200, shipping: 500, total: 2_480 });
  });
});
