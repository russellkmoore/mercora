import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  insertValues: vi.fn(),
  insertFails: false,
  createPaymentIntent: vi.fn(),
  cancelPaymentIntent: vi.fn(),
  priceCheckout: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: null })),
  currentUser: vi.fn(async () => null),
}));
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(async () => null),
  getClientIp: vi.fn(() => 'test'),
}));
vi.mock('@/lib/models/mach/customer', () => ({
  getCustomer: vi.fn(),
  createCustomer: vi.fn(),
}));
vi.mock('@/lib/services/checkout-pricing', () => ({
  priceCheckout: mocks.priceCheckout,
}));
vi.mock('@/lib/stripe', () => ({
  createPaymentIntent: mocks.createPaymentIntent,
  cancelPaymentIntent: mocks.cancelPaymentIntent,
}));
vi.mock('@/lib/db', () => ({
  getDbAsync: vi.fn(async () => ({
    insert: () => ({
      values: async (value: unknown) => {
        mocks.insertValues(value);
        if (mocks.insertFails) throw new Error('D1 unavailable');
      },
    }),
  })),
}));

import { POST } from '@/app/api/payment-intent/route';

const quote = {
  currency: 'USD',
  items: [{
    id: 'line_stable_1',
    product_id: 'prod_1', variant_id: 'var_1', sku: 'SKU-1', quantity: 1,
    unit_price: { amount: 2_000, currency: 'USD' },
    total_price: { amount: 2_000, currency: 'USD' }, product_name: 'Catalog name',
  }],
  subtotal: { amount: 2_000, currency: 'USD' },
  merchandiseDiscount: { amount: 100, currency: 'USD' },
  shippingDiscount: { amount: 0, currency: 'USD' },
  discount: { amount: 100, currency: 'USD' },
  shipping: { amount: 500, currency: 'USD' },
  tax: { amount: 200, currency: 'USD' },
  shippingTax: { amount: 20, currency: 'USD' },
  lineAllocations: [{
    lineId: 'line_stable_1', productId: 'prod_1', variantId: 'var_1', quantity: 1,
    catalogSubtotal: { amount: 2_000, currency: 'USD' },
    merchandiseDiscount: { amount: 100, currency: 'USD' },
    netMerchandise: { amount: 1_900, currency: 'USD' },
    tax: { amount: 180, currency: 'USD' }, promotionCodes: ['SAVE'],
  }],
  tender: { amount: 0, currency: 'USD' },
  total: { amount: 2_600, currency: 'USD' },
  discountCodes: ['SAVE'],
  shippingMethod: { id: 'standard', label: 'Standard' },
  taxSource: 'provider',
};

function request() {
  return new NextRequest('http://localhost/api/payment-intent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      // Deliberately forged legacy money fields: they must be ignored.
      amount: { amount: 1, currency: 'USD' },
      taxAmount: { amount: 0, currency: 'USD' },
      items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 1 }],
      shippingAddress: {
        line1: '1 Main', city: 'Denver', region: 'CO', postal_code: '80202', country: 'us',
        company: 'Buyer LLC', email: ' buyer@example.com ',
        attributes: { injected: 'must be discarded' },
      },
      description: 'attacker-controlled product and order text',
      shippingMethodId: 'standard',
    }),
  });
}

beforeEach(() => {
  mocks.insertFails = false;
  mocks.cancelPaymentIntent.mockResolvedValue(undefined);
  mocks.priceCheckout.mockResolvedValue(quote);
  mocks.createPaymentIntent.mockResolvedValue({
    id: 'pi_authoritative',
    client_secret: 'pi_authoritative_secret_x',
    amount: 2_600,
    currency: 'usd',
  });
});

describe('payment-intent durable authority boundary', () => {
  it('charges and persists only the server quote before returning the client secret', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ amount: 2_600 }));
    expect(mocks.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringMatching(/^Order WEB-GUEST-/),
    }));
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      payment_status: 'pending',
      status: 'pending',
      total_amount: { amount: 2_600, currency: 'USD' },
      items: quote.items,
      extensions: expect.objectContaining({
        checkout_line_allocations: quote.lineAllocations,
        checkout_shipping_tax: quote.shippingTax,
      }),
      shipping_address: expect.objectContaining({
        company: 'Buyer LLC',
        email: 'buyer@example.com',
        country: 'US',
        type: 'shipping',
        status: 'unverified',
      }),
    }));
    expect(mocks.insertValues.mock.calls[0][0].shipping_address).not.toHaveProperty('attributes');
    const body = await response.json() as any;
    expect(body.clientSecret).toBe('pi_authoritative_secret_x');
    expect(body.quote.total).toMatchObject({ amount: 26, currency: 'USD' });
    expect(body.quote.items).toMatchObject([{
      productId: 'prod_1',
      variantId: 'var_1',
      name: 'Catalog name',
      quantity: 1,
      unitPrice: { amount: 20, currency: 'USD' },
      lineTotal: { amount: 20, currency: 'USD' },
    }]);
    expect(JSON.stringify(body)).not.toContain('tenderState');
  });

  it('withholds the client secret and cancels the PI if pending persistence fails', async () => {
    mocks.insertFails = true;
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mocks.cancelPaymentIntent).toHaveBeenCalledWith('pi_authoritative');
    expect(await response.json()).not.toHaveProperty('clientSecret');
  });

  it('rejects a syntactically invalid optional checkout email', async () => {
    const invalid = new NextRequest('http://localhost/api/payment-intent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 1 }],
        shippingAddress: {
          line1: '1 Main', city: 'Denver', region: 'CO', postal_code: '80202',
          country: 'US', email: 'victim@example.com\r\nBcc: attacker@example.com',
        },
        shippingMethodId: 'standard',
      }),
    });

    const response = await POST(invalid);

    expect(response.status).toBe(400);
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled();
  });
});
