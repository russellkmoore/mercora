import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  finalizeOrderPayment: vi.fn(),
  getDbAsync: vi.fn(),
  recordTelemetry: vi.fn(),
  capabilities: { giftCards: {}, subscriptions: {} },
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(async () => null),
  getClientIp: vi.fn(() => 'test'),
}));
vi.mock('@/lib/db', () => ({ getDbAsync: mocks.getDbAsync }));
vi.mock('@/lib/services/order-finalization', () => ({
  PaymentVerificationError: class extends Error {},
  finalizeOrderPayment: mocks.finalizeOrderPayment,
}));
vi.mock('@/lib/observability/telemetry', () => ({
  recordTelemetry: mocks.recordTelemetry,
}));
vi.mock('@/lib/commerce/runtime', () => ({
  resolveRuntimeCommerceCapabilities: vi.fn(async () => mocks.capabilities),
}));

import { POST } from '@/app/api/orders/route';

function request(): NextRequest {
  return new NextRequest('https://store.test/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      orderId: 'WEB-GUEST-123-ABCD',
      paymentIntentId: 'pi_authoritative_123',
    }),
  });
}

beforeEach(() => {
  mocks.auth.mockResolvedValue({ userId: null });
});

describe('order finalization telemetry behavior', () => {
  it('reports an infrastructure failure and preserves the generic retry response', async () => {
    const finalizationError = new Error('D1 private detail');
    mocks.finalizeOrderPayment.mockRejectedValue(finalizationError);

    const response = await POST(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to finalize order' });
    expect(mocks.finalizeOrderPayment).toHaveBeenCalledWith({
      orderId: 'WEB-GUEST-123-ABCD',
      paymentIntentId: 'pi_authoritative_123',
      customerId: undefined,
      enforceOwnership: true,
      sendEmail: true,
      capabilities: mocks.capabilities,
    });
    expect(mocks.getDbAsync).not.toHaveBeenCalled();
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'order.finalization_failed',
      {
        operation: 'finalize', outcome: 'failed', retryable: true,
        path: '/api/orders',
      },
      finalizationError,
    );
  });
});
