import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireOwnedSession: vi.fn(),
  getBinding: vi.fn(),
  getOwnedOrder: vi.fn(),
  finalize: vi.fn(),
  buildDelivery: vi.fn(),
}));

vi.mock('@/lib/mcp/session', () => ({ requireOwnedSession: mocks.requireOwnedSession }));
vi.mock('@/lib/mcp/checkout', () => ({
  getOwnedMcpOrderBinding: mocks.getBinding,
  getOwnedMcpOrder: mocks.getOwnedOrder,
}));
vi.mock('@/lib/services/order-finalization', () => {
  class PaymentVerificationError extends Error {}
  return { finalizeOrderPayment: mocks.finalize, PaymentVerificationError };
});
vi.mock('@/lib/mcp/order-delivery', () => ({
  buildMcpOrderDelivery: mocks.buildDelivery,
}));

import { getOrderStatus, placeOrder } from '@/lib/mcp/tools/order';

const storedMoney = { amount: 2500, currency: 'USD', centAmount: 2500, fractionDigits: 2 };
const paidOrder = {
  id: 'MCP-AGENT1-123456-A1B2C3D4',
  status: 'processing' as const,
  payment_status: 'paid' as const,
  total_amount: storedMoney,
  currency_code: 'USD',
  items: [],
  shipping_address: { line1: '1 Main', city: 'Denver', region: 'CO', country: 'US' },
  shipping_method: 'Standard',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOwnedSession.mockResolvedValue({
    ok: true,
    session: { sessionId: 'session-1', agentId: 'agent-1', cart: [] },
  });
  mocks.getBinding.mockResolvedValue(paidOrder);
  mocks.finalize.mockResolvedValue({ paid: true, promoted: true, order: paidOrder });
  mocks.buildDelivery.mockResolvedValue({
    shipment: {
      carrier: 'ups',
      carrierLabel: 'UPS',
      trackingNumber: '1Z999',
      trackingUrl: 'https://carrier.example/1Z999',
    },
    history: [{
      date: '2026-08-02T00:00:00.000Z',
      status: 'shipped',
      description: 'Package shipped',
    }],
    estimatedDelivery: '3-5 business days',
  });
});

describe('MCP order finalization', () => {
  it('finalizes only the durable order bound to the agent, session, and PaymentIntent', async () => {
    const result = await placeOrder({
      orderId: paidOrder.id,
      paymentIntentId: 'pi_mcp_1',
    }, 'session-1', 'agent-1');

    expect(mocks.getBinding).toHaveBeenCalledWith({
      orderId: paidOrder.id,
      paymentIntentId: 'pi_mcp_1',
      agentId: 'agent-1',
      sessionId: 'session-1',
    });
    expect(mocks.finalize).toHaveBeenCalledWith(expect.objectContaining({
      orderId: paidOrder.id,
      paymentIntentId: 'pi_mcp_1',
    }));
    expect(result.success).toBe(true);
    expect(result.data.total).toMatchObject({ amount: 25, currency: 'USD', precision: 2 });
  });

  it('does not contact finalization when the binding is not owned', async () => {
    mocks.getBinding.mockResolvedValue(null);
    const result = await placeOrder({
      orderId: paidOrder.id,
      paymentIntentId: 'pi_mcp_1',
    }, 'session-1', 'attacker');
    expect(result.error?.code).toBe('PAYMENT_NOT_BOUND');
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it('does not reveal orders belonging to another agent', async () => {
    mocks.getOwnedOrder.mockResolvedValue(null);
    const result = await getOrderStatus(paidOrder.id, 'attacker');
    expect(result.error?.code).toBe('ORDER_NOT_FOUND');
    expect(mocks.buildDelivery).not.toHaveBeenCalled();
  });

  it('returns the configured shipment projection and real event history for its owner', async () => {
    mocks.getOwnedOrder.mockResolvedValue({
      ...paidOrder,
      status: 'shipped',
      shipping_carrier: 'ups',
      tracking_number: '1Z999',
    });
    const result = await getOrderStatus(paidOrder.id, 'agent-1');
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      tracking_number: '1Z999',
      shipment: {
        carrier: 'ups',
        carrier_label: 'UPS',
        tracking_number: '1Z999',
        tracking_url: 'https://carrier.example/1Z999',
      },
      tracking_history: [{ status: 'shipped' }],
    });
  });
});
