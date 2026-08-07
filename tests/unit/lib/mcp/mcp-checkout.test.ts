import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  priceCheckout: vi.fn(),
  assertInventory: vi.fn(),
  createPaymentIntent: vi.fn(),
  cancelPaymentIntent: vi.fn(),
  inserted: undefined as Record<string, unknown> | undefined,
  insertError: undefined as Error | undefined,
}));

vi.mock('@/lib/services/checkout-pricing', () => ({
  priceCheckout: mocks.priceCheckout,
  MAX_CHECKOUT_LINES: 100,
}));
vi.mock('@/lib/services/inventory-adjustments', () => ({
  assertCheckoutInventoryAvailable: mocks.assertInventory,
}));
vi.mock('@/lib/stripe', () => ({
  createPaymentIntent: mocks.createPaymentIntent,
  cancelPaymentIntent: mocks.cancelPaymentIntent,
}));
vi.mock('@/lib/db', () => ({
  getDbAsync: vi.fn(async () => ({
    insert: () => ({ values: async (value: Record<string, unknown>) => {
      if (mocks.insertError) throw mocks.insertError;
      mocks.inserted = value;
    } }),
  })),
}));

import { createMcpCheckout, normalizeMcpAddress } from '@/lib/mcp/checkout';

const money = (amount: number) => ({ amount, currency: 'USD', centAmount: amount, fractionDigits: 2 });
const quote = {
  currency: 'USD',
  items: [{
    product_id: 'catalog-product',
    variant_id: 'catalog-variant',
    sku: 'SKU-1',
    product_name: 'Catalog Name',
    quantity: 2,
    unit_price: money(1200),
    total_price: money(2400),
  }],
  subtotal: money(2400),
  discount: money(0),
  merchandiseDiscount: money(0),
  shippingDiscount: money(0),
  shipping: money(599),
  tax: money(150),
  shippingTax: money(0),
  lineAllocations: [],
  tender: money(0),
  total: money(3149),
  discountCodes: [],
  shippingMethod: { id: 'standard', label: 'Standard' },
  taxSource: 'configured_fallback' as const,
};

const session = {
  sessionId: 'session-1',
  agentId: 'agent-1',
  userContext: { agentId: 'agent-1' },
  cart: [{
    productId: 'catalog-product',
    variantId: 'catalog-variant',
    name: 'Spoofed Session Name',
    quantity: 2,
    price: money(1),
    primaryImageUrl: '',
  }],
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 60_000).toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inserted = undefined;
  mocks.insertError = undefined;
  mocks.priceCheckout.mockResolvedValue(quote);
  mocks.assertInventory.mockResolvedValue(undefined);
  mocks.createPaymentIntent.mockResolvedValue({
    id: 'pi_mcp_1',
    amount: 3149,
    currency: 'usd',
    client_secret: 'secret',
  });
  mocks.cancelPaymentIntent.mockResolvedValue(undefined);
});

describe('MCP authoritative checkout', () => {
  it('normalizes legacy flat addresses into the MACH shape', () => {
    expect(normalizeMcpAddress({
      street: '1 Main',
      city: 'Denver',
      state: 'CO',
      postal_code: '80202',
      country: 'us',
    })).toMatchObject({ line1: '1 Main', region: 'CO', country: 'US' });
  });

  it('prices by product/variant identity and persists only the canonical quote', async () => {
    const result = await createMcpCheckout({
      agentId: 'agent-1',
      session,
      input: {
        shippingAddress: {
          line1: '1 Main', city: 'Denver', region: 'CO', postal_code: '80202', country: 'US',
        },
        shippingMethodId: 'standard',
      },
    });

    expect(mocks.priceCheckout).toHaveBeenCalledWith(expect.objectContaining({
      items: [{ productId: 'catalog-product', variantId: 'catalog-variant', quantity: 2 }],
    }));
    expect(mocks.inserted?.items).toEqual(quote.items);
    expect(mocks.inserted?.total_amount).toEqual({ amount: 3149, currency: 'USD' });
    expect(mocks.inserted?.extensions).toMatchObject({
      agent_id: 'agent-1',
      mcp_session_id: 'session-1',
      payment_intent_id: 'pi_mcp_1',
    });
    expect(result).toMatchObject({ paymentIntentId: 'pi_mcp_1', clientSecret: 'secret' });
  });

  it('cancels an intent whose provider amount does not match the server quote', async () => {
    mocks.createPaymentIntent.mockResolvedValue({
      id: 'pi_bad', amount: 1, currency: 'usd', client_secret: 'secret',
    });
    await expect(createMcpCheckout({
      agentId: 'agent-1',
      session,
      input: {
        shippingAddress: {
          line1: '1 Main', city: 'Denver', region: 'CO', postal_code: '80202', country: 'US',
        },
        shippingMethodId: 'standard',
      },
    })).rejects.toThrow('invalid intent');
    expect(mocks.cancelPaymentIntent).toHaveBeenCalledWith('pi_bad');
    expect(mocks.inserted).toBeUndefined();
  });

  it('cancels an orphaned intent when pending-order persistence fails', async () => {
    mocks.insertError = new Error('D1 unavailable');
    await expect(createMcpCheckout({
      agentId: 'agent-1',
      session,
      input: {
        shippingAddress: {
          line1: '1 Main', city: 'Denver', region: 'CO', postal_code: '80202', country: 'US',
        },
        shippingMethodId: 'standard',
      },
    })).rejects.toThrow('D1 unavailable');
    expect(mocks.cancelPaymentIntent).toHaveBeenCalledWith('pi_mcp_1');
  });
});
