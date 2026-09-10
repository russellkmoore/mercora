import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  insertValues: vi.fn(),
  insertError: null as Error | null,
  createPaymentIntent: vi.fn(),
  cancelPaymentIntent: vi.fn(),
  priceCheckout: vi.fn(),
  assertCheckoutInventoryAvailable: vi.fn(),
  recordTelemetry: vi.fn(),
  auth: vi.fn(),
  currentUser: vi.fn(),
  getCustomer: vi.fn(),
  createCustomer: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
}));
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(async () => null),
  getClientIp: vi.fn(() => 'test'),
}));
vi.mock('@/lib/models/mach/customer', () => ({
  getCustomer: mocks.getCustomer,
  createCustomer: mocks.createCustomer,
}));
vi.mock('@/lib/services/checkout-pricing', () => ({
  priceCheckout: mocks.priceCheckout,
}));
vi.mock('@/lib/stripe', () => ({
  createPaymentIntent: mocks.createPaymentIntent,
  cancelPaymentIntent: mocks.cancelPaymentIntent,
}));
vi.mock('@/lib/services/inventory-adjustments', () => {
  class InventoryUnavailableError extends Error {
    constructor(public readonly variantIds: string[]) {
      super('inventory unavailable');
    }
  }
  return {
    InventoryUnavailableError,
    assertCheckoutInventoryAvailable: mocks.assertCheckoutInventoryAvailable,
  };
});
vi.mock('@/lib/db', () => ({
  getDbAsync: vi.fn(async () => ({
    insert: () => ({
      values: async (value: unknown) => {
        mocks.insertValues(value);
        if (mocks.insertError) throw mocks.insertError;
      },
    }),
  })),
}));
vi.mock('@/lib/observability/telemetry', () => ({
  recordTelemetry: mocks.recordTelemetry,
}));
const requoteMocks = vi.hoisted(() => ({
  getOrderById: vi.fn(),
  releaseTender: vi.fn(),
}));
vi.mock('@/lib/models/mach/orders', () => ({
  getOrderById: requoteMocks.getOrderById,
}));
vi.mock('@/lib/commerce/runtime', () => ({
  resolveRuntimeCommerceCapabilities: vi.fn(async () => ({
    giftCards: {
      resolveTender: vi.fn(),
      verifyReservedTender: vi.fn(),
      applyTender: vi.fn(),
      releaseTender: requoteMocks.releaseTender,
    },
    subscriptions: { orderPaid: vi.fn() },
  })),
}));

import { POST } from '@/app/api/payment-intent/route';
import { GiftCardTenderUnavailableError } from '@/lib/gift-cards/capability';
import { GiftCardSalesDisabledError } from '@/lib/gift-cards/checkout';

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
  mocks.insertError = null;
  mocks.cancelPaymentIntent.mockClear();
  mocks.createPaymentIntent.mockClear();
  requoteMocks.getOrderById.mockReset();
  requoteMocks.releaseTender.mockReset();
  mocks.auth.mockResolvedValue({ userId: null });
  mocks.currentUser.mockResolvedValue(null);
  mocks.getCustomer.mockResolvedValue(null);
  mocks.createCustomer.mockResolvedValue(undefined);
  mocks.cancelPaymentIntent.mockResolvedValue(undefined);
  mocks.priceCheckout.mockResolvedValue(quote);
  mocks.assertCheckoutInventoryAvailable.mockResolvedValue(undefined);
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
    const persistenceError = new Error('D1 unavailable');
    mocks.insertError = persistenceError;
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mocks.cancelPaymentIntent).toHaveBeenCalledWith('pi_authoritative');
    expect(await response.json()).not.toHaveProperty('clientSecret');
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'payment.order_persist_failed',
      {
        operation: 'persist', outcome: 'failed', provider: 'd1', retryable: true,
        path: '/api/payment-intent',
      },
      persistenceError,
    );
  });

  it('reports provider creation failure without changing the retryable response', async () => {
    const providerError = new Error('Stripe unavailable');
    mocks.createPaymentIntent.mockRejectedValue(providerError);

    const response = await POST(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'Payment provider is unavailable' });
    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'payment.intent_create_failed',
      {
        operation: 'create', outcome: 'failed', provider: 'stripe', retryable: true,
        path: '/api/payment-intent',
      },
      providerError,
    );
  });

  it('reports inventory infrastructure failure before creating a provider intent', async () => {
    const inventoryError = new Error('D1 inventory unavailable');
    mocks.assertCheckoutInventoryAvailable.mockRejectedValue(inventoryError);

    const response = await POST(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'Inventory is temporarily unavailable' });
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'payment.inventory_check_failed',
      {
        operation: 'validate', outcome: 'failed', provider: 'd1', retryable: true,
        path: '/api/payment-intent',
      },
      inventoryError,
    );
  });

  it('reports authenticated customer preparation failure before creating an intent', async () => {
    const customerError = new Error('D1 customer unavailable');
    mocks.auth.mockResolvedValue({ userId: 'user_123' });
    mocks.getCustomer.mockRejectedValue(customerError);

    const response = await POST(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'Could not prepare authenticated checkout' });
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'payment.customer_prepare_failed',
      {
        operation: 'persist', outcome: 'failed', provider: 'd1', retryable: true,
        path: '/api/payment-intent',
      },
      customerError,
    );
  });

  it('rejects and cancels an invalid provider intent without persisting it', async () => {
    mocks.createPaymentIntent.mockResolvedValue({
      id: 'pi_invalid', client_secret: 'pi_invalid_secret', amount: 2_599, currency: 'usd',
    });

    const response = await POST(request());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'Payment provider returned an invalid intent' });
    expect(mocks.cancelPaymentIntent).toHaveBeenCalledWith('pi_invalid');
    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'payment.intent_invalid',
      {
        operation: 'validate', outcome: 'invalid', provider: 'stripe',
        http_status: 502, path: '/api/payment-intent',
      },
    );
  });

  it('reports cancellation failure for an invalid intent and preserves the 502 response', async () => {
    const cancelError = new Error('Stripe cancellation unavailable');
    mocks.createPaymentIntent.mockResolvedValue({
      id: 'pi_invalid', client_secret: null, amount: 2_600, currency: 'usd',
    });
    mocks.cancelPaymentIntent.mockRejectedValue(cancelError);

    const response = await POST(request());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'Payment provider returned an invalid intent' });
    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'payment.intent_cancel_failed',
      {
        operation: 'process', outcome: 'failed', provider: 'stripe', retryable: true,
        path: '/api/payment-intent',
      },
      cancelError,
    );
  });

  it('reports cancellation failure after persistence fails and still withholds the secret', async () => {
    const cancelError = new Error('Stripe cancellation unavailable');
    mocks.insertError = new Error('D1 unavailable');
    mocks.cancelPaymentIntent.mockRejectedValue(cancelError);

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('clientSecret');
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'payment.intent_cancel_failed',
      {
        operation: 'process', outcome: 'failed', provider: 'stripe', retryable: true,
        path: '/api/payment-intent',
      },
      cancelError,
    );
  });

  it('returns 409 before creating a PaymentIntent when aggregate stock is unavailable', async () => {
    const { InventoryUnavailableError } = await import('@/lib/services/inventory-adjustments');
    mocks.assertCheckoutInventoryAvailable.mockRejectedValue(
      new InventoryUnavailableError(['var_1'])
    );

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(mocks.assertCheckoutInventoryAvailable).toHaveBeenCalledWith(quote.items);
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
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
  it('releases the previous pending checkout and cancels its intent when re-quoting', async () => {
    requoteMocks.getOrderById.mockResolvedValue({
      id: 'WEB-GUEST-previous', status: 'pending', payment_status: 'pending', customer_id: null,
      extensions: { payment_intent_id: 'pi_previous', checkout_tender_state: { v: 1, reservationId: 'gift_reservation_x' } },
    });
    requoteMocks.releaseTender.mockResolvedValue(undefined);
    const body = JSON.parse(await request().text()) as Record<string, unknown>;
    const res = await POST(new NextRequest('http://localhost/api/payment-intent', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, previousOrderId: 'WEB-GUEST-previous' }),
    }));
    expect(res.status).toBe(200);
    expect(requoteMocks.releaseTender).toHaveBeenCalledWith({
      state: { v: 1, reservationId: 'gift_reservation_x' }, reason: 'checkout re-quoted',
    });
    expect(mocks.cancelPaymentIntent).toHaveBeenCalledWith('pi_previous');
    // The new quote still goes through the same authority path.
    expect(mocks.createPaymentIntent).toHaveBeenCalledTimes(1);
  });

  it('leaves a paid or foreign previous order alone', async () => {
    requoteMocks.getOrderById.mockResolvedValue({
      id: 'WEB-GUEST-paid', status: 'paid', payment_status: 'paid', customer_id: null,
      extensions: { payment_intent_id: 'pi_paid', checkout_tender_state: { v: 1, reservationId: 'r' } },
    });
    const body = JSON.parse(await request().text()) as Record<string, unknown>;
    const res = await POST(new NextRequest('http://localhost/api/payment-intent', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, previousOrderId: 'WEB-GUEST-paid' }),
    }));
    expect(res.status).toBe(200);
    expect(requoteMocks.releaseTender).not.toHaveBeenCalled();
    expect(mocks.cancelPaymentIntent).not.toHaveBeenCalled();

    requoteMocks.getOrderById.mockResolvedValue({
      id: 'WEB-other', status: 'pending', payment_status: 'pending', customer_id: 'user_someone_else',
      extensions: { payment_intent_id: 'pi_other', checkout_tender_state: { v: 1, reservationId: 'r2' } },
    });
    await POST(new NextRequest('http://localhost/api/payment-intent', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, previousOrderId: 'WEB-other' }),
    }));
    expect(requoteMocks.releaseTender).not.toHaveBeenCalled();
    expect(mocks.cancelPaymentIntent).not.toHaveBeenCalled();
  });

  it('names a gift card that cannot be applied instead of the generic pricing error', async () => {
    mocks.priceCheckout.mockRejectedValueOnce(new GiftCardTenderUnavailableError());
    const body = JSON.parse(await request().text()) as Record<string, unknown>;
    const res = await POST(new NextRequest('http://localhost/api/payment-intent', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, giftCardToken: 'GC-0000', giftCardRequestKey: 'req-1' }),
    }));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string; code?: string };
    expect(json.code).toBe('gift_card_unavailable');
    expect(json.error).toMatch(/gift card couldn't be applied/i);
    expect(json.error).not.toContain('Checkout details are invalid');
  });

  it('names a gift card we have stopped selling instead of the generic pricing error', async () => {
    mocks.priceCheckout.mockRejectedValueOnce(new GiftCardSalesDisabledError());
    const res = await POST(request());

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string; code?: string };
    expect(json.code).toBe('gift_card_sales_disabled');
    expect(json.error).not.toContain('Checkout details are invalid');
  });

  it('tells a stopped sale apart from a code that did not work', async () => {
    // Two different problems, two different things to tell the shopper: remove
    // the line, or check the code. One shared code would collapse them.
    mocks.priceCheckout.mockRejectedValueOnce(new GiftCardSalesDisabledError());
    const sale = await (await POST(request())).json() as { error: string; code?: string };

    mocks.priceCheckout.mockRejectedValueOnce(new GiftCardTenderUnavailableError());
    const tender = await (await POST(request())).json() as { error: string; code?: string };

    expect(sale.code).toBe('gift_card_sales_disabled');
    expect(sale.code).not.toBe(tender.code);
    expect(sale.error).not.toBe(tender.error);
    expect(tender.code).toBe('gift_card_unavailable');
  });
});
