import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * sell=off is enforced on the MCP path — `priceCheckout` merges its default
 * dependencies first, so `giftCardSalesEnabled` applies whether or not a caller
 * passes an override. What was missing was the *shape* of the refusal: the
 * throw happened outside the try block's instanceof mapping, so an agent got
 * 'CHECKOUT_FAILED' where a browser client gets `gift_card_sales_disabled`.
 * An agent cannot branch on that, and will retry a checkout that can never
 * succeed while the card is still in the cart (D-16, WR-10).
 */

const mocks = vi.hoisted(() => ({
  requireOwnedSession: vi.fn(),
  createMcpCheckout: vi.fn(),
}));

vi.mock('@/lib/mcp/session', () => ({ requireOwnedSession: mocks.requireOwnedSession }));
vi.mock('@/lib/mcp/checkout', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/mcp/checkout')>()),
  createMcpCheckout: mocks.createMcpCheckout,
}));

import { createAgentPaymentIntent } from '@/lib/mcp/tools/payment';
import {
  GIFT_CARD_SALES_DISABLED_MESSAGE,
  GiftCardSalesDisabledError,
} from '@/lib/gift-cards/checkout';

const request = {
  shippingAddress: { line1: '1 Test Way', city: 'Denver', country: 'US' },
  shippingMethodId: 'standard',
} as never;

async function callWith(error: Error) {
  mocks.createMcpCheckout.mockRejectedValue(error);
  return createAgentPaymentIntent(request, 'session_1', 'agent_1');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.requireOwnedSession.mockResolvedValue({
    ok: true,
    session: { sessionId: 'session_1', cart: [{ productId: 'p1', quantity: 1 }] },
  });
});

describe('MCP checkout surfaces a stopped gift-card sale as a structured error (WR-10)', () => {
  it('returns a distinct code an agent can branch on', async () => {
    const response = await callWith(new GiftCardSalesDisabledError());

    expect(response.success).toBe(false);
    expect(response.error).toEqual({
      code: 'GIFT_CARD_SALES_DISABLED',
      message: GIFT_CARD_SALES_DISABLED_MESSAGE,
    });
  });

  it('tells the agent the one action that clears the state', async () => {
    // "Retry checkout" alone is a loop: the card is still in the cart.
    const response = await callWith(new GiftCardSalesDisabledError());

    expect(response.metadata.next_actions?.[0]).toMatch(/remove the gift-card line/i);
  });

  it('still reports an ordinary failure as CHECKOUT_FAILED', async () => {
    // The new branch must be the specific case, not a catch-all.
    const response = await callWith(new Error('Stripe is down'));

    expect(response.error?.code).toBe('CHECKOUT_FAILED');
  });

  it('says the same thing the browser client is told about the same state', async () => {
    // One message, one definition — the constant lives beside the error class
    // so /api/payment-intent and the agent path cannot drift apart.
    const response = await callWith(new GiftCardSalesDisabledError());

    expect(response.error?.message).toContain('Remove the gift card from your cart');
  });
});
