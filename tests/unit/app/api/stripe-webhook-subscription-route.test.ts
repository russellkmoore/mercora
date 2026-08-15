import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  constructWebhookEvent: vi.fn(),
  claimWebhookEvent: vi.fn(),
  completeWebhookEvent: vi.fn(),
  failWebhookEvent: vi.fn(),
  handleSubscriptionStripeEvent: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({ constructWebhookEvent: mocks.constructWebhookEvent }));
vi.mock('@/lib/services/order-finalization', () => ({
  PaymentVerificationError: class PaymentVerificationError extends Error {},
  finalizeOrderPayment: vi.fn(),
}));
vi.mock('@/lib/webhooks/processed-events', () => ({
  claimWebhookEvent: mocks.claimWebhookEvent,
  completeWebhookEvent: mocks.completeWebhookEvent,
  failWebhookEvent: mocks.failWebhookEvent,
}));
vi.mock('@/app/api/webhooks/stripe/handlers/refund-handlers', () => ({
  handleChargeRefunded: vi.fn(),
  handleRefundLifecycle: vi.fn(),
}));
vi.mock('@/app/api/webhooks/stripe/handlers/subscription-handlers', () => ({
  handleSubscriptionStripeEvent: mocks.handleSubscriptionStripeEvent,
}));

import { POST } from '@/app/api/webhooks/stripe/route';

function request() {
  return new NextRequest('https://example.test/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': 'signed' },
    body: '{"signed":true}',
  });
}

function subscriptionEvent() {
  return {
    id: 'evt_subscription_route',
    type: 'customer.subscription.updated',
    data: { object: { id: 'sub_route' } },
  };
}

beforeEach(() => {
  mocks.constructWebhookEvent.mockResolvedValue(subscriptionEvent());
  mocks.claimWebhookEvent.mockResolvedValue({
    state: 'acquired',
    claimToken: 'claim_subscription',
    attemptCount: 1,
    leaseExpiresAt: '2026-08-15T07:00:00.000Z',
  });
  mocks.completeWebhookEvent.mockResolvedValue(true);
  mocks.failWebhookEvent.mockResolvedValue(true);
  mocks.handleSubscriptionStripeEvent.mockResolvedValue('handled');
});

describe('Stripe subscription webhook route claim composition', () => {
  it('completes the core claim with the subscription handler outcome', async () => {
    const signedEvent = subscriptionEvent();
    mocks.constructWebhookEvent.mockResolvedValue(signedEvent);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.handleSubscriptionStripeEvent).toHaveBeenCalledWith(signedEvent);
    expect(mocks.completeWebhookEvent).toHaveBeenCalledWith({
      eventId: signedEvent.id,
      claimToken: 'claim_subscription',
      outcome: 'handled',
    });
    expect(mocks.failWebhookEvent).not.toHaveBeenCalled();
  });

  it('fails the core claim when subscription reconciliation throws', async () => {
    const failure = new Error('subscription D1 unavailable');
    mocks.handleSubscriptionStripeEvent.mockRejectedValue(failure);

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(mocks.failWebhookEvent).toHaveBeenCalledWith({
      eventId: 'evt_subscription_route',
      claimToken: 'claim_subscription',
      error: failure,
    });
    expect(mocks.completeWebhookEvent).not.toHaveBeenCalled();
  });

  it('returns retryable without failing a claim after completion ownership is lost', async () => {
    mocks.completeWebhookEvent.mockResolvedValue(false);

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(mocks.handleSubscriptionStripeEvent).toHaveBeenCalledTimes(1);
    expect(mocks.failWebhookEvent).not.toHaveBeenCalled();
  });

  it('does not report success when failure recording also loses the lease', async () => {
    mocks.handleSubscriptionStripeEvent.mockRejectedValue(new Error('subscription retry'));
    mocks.failWebhookEvent.mockResolvedValue(false);

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(mocks.failWebhookEvent).toHaveBeenCalledTimes(1);
    expect(mocks.completeWebhookEvent).not.toHaveBeenCalled();
  });

  it('does not redispatch a subscription event whose core claim is completed', async () => {
    mocks.claimWebhookEvent.mockResolvedValue({ state: 'completed', outcome: 'handled' });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, duplicate: true });
    expect(mocks.handleSubscriptionStripeEvent).not.toHaveBeenCalled();
    expect(mocks.completeWebhookEvent).not.toHaveBeenCalled();
    expect(mocks.failWebhookEvent).not.toHaveBeenCalled();
  });
});
