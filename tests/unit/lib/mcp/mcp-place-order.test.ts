import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireOwnedSession: vi.fn(),
  getBinding: vi.fn(),
  getOwnedOrder: vi.fn(),
  finalize: vi.fn(),
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
  });
});
