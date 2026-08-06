import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  constructWebhookEvent: vi.fn(),
  finalizeOrderPayment: vi.fn(),
  claimWebhookEvent: vi.fn(),
  completeWebhookEvent: vi.fn(),
  failWebhookEvent: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  constructWebhookEvent: mocks.constructWebhookEvent,
}));

vi.mock('@/lib/services/order-finalization', () => {
  class PaymentVerificationError extends Error {}
  return {
    PaymentVerificationError,
    finalizeOrderPayment: mocks.finalizeOrderPayment,
  };
});

vi.mock('@/lib/webhooks/processed-events', () => ({
  claimWebhookEvent: mocks.claimWebhookEvent,
  completeWebhookEvent: mocks.completeWebhookEvent,
  failWebhookEvent: mocks.failWebhookEvent,
}));

import { POST } from '@/app/api/webhooks/stripe/route';
import { PaymentVerificationError } from '@/lib/services/order-finalization';

function webhookRequest() {
  return new NextRequest('https://example.test/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': 'signed' },
    body: '{}',
  });
}

beforeEach(() => {
  mocks.constructWebhookEvent.mockResolvedValue({
    id: 'evt_payment',
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_1', metadata: { orderId: 'WEB-1' } } },
  });
  mocks.claimWebhookEvent.mockResolvedValue({ state: 'acquired', claimToken: 'claim_1' });
  mocks.completeWebhookEvent.mockResolvedValue(true);
  mocks.failWebhookEvent.mockResolvedValue(true);
});

describe('Stripe webhook retry behavior', () => {
  it('returns 500 for transient finalization failures so Stripe retries', async () => {
    mocks.finalizeOrderPayment.mockRejectedValue(new Error('D1 unavailable'));

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
    expect(mocks.failWebhookEvent).toHaveBeenCalledWith({
      eventId: 'evt_payment',
      claimToken: 'claim_1',
      error: expect.objectContaining({ message: 'D1 unavailable' }),
    });
    expect(mocks.completeWebhookEvent).not.toHaveBeenCalled();
  });

  it('acknowledges permanent payment verification rejection', async () => {
    mocks.finalizeOrderPayment.mockRejectedValue(
      new PaymentVerificationError('payment binding mismatch')
    );

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(mocks.completeWebhookEvent).toHaveBeenCalledWith({
      eventId: 'evt_payment',
      claimToken: 'claim_1',
      outcome: 'permanent_rejection',
    });
    expect(mocks.failWebhookEvent).not.toHaveBeenCalled();
  });

  it('records a signed payment event without an order binding as permanently rejected', async () => {
    mocks.constructWebhookEvent.mockResolvedValue({
      id: 'evt_unbound',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_unbound', metadata: {} } },
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(mocks.finalizeOrderPayment).not.toHaveBeenCalled();
    expect(mocks.completeWebhookEvent).toHaveBeenCalledWith({
      eventId: 'evt_unbound',
      claimToken: 'claim_1',
      outcome: 'permanent_rejection',
    });
  });

  it('acknowledges only terminal completed duplicates', async () => {
    mocks.claimWebhookEvent.mockResolvedValue({
      state: 'completed',
      outcome: 'handled',
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, duplicate: true });
    expect(mocks.finalizeOrderPayment).not.toHaveBeenCalled();
    expect(mocks.completeWebhookEvent).not.toHaveBeenCalled();
  });

  it('returns retryable 503 for an active owner', async () => {
    mocks.claimWebhookEvent.mockResolvedValue({ state: 'busy' });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(mocks.finalizeOrderPayment).not.toHaveBeenCalled();
  });

  it('returns retryable 503 when ownership is lost before completion', async () => {
    mocks.completeWebhookEvent.mockResolvedValue(false);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(mocks.failWebhookEvent).not.toHaveBeenCalled();
  });

  it('returns 500 without dispatch when the durable claim fails', async () => {
    mocks.claimWebhookEvent.mockRejectedValue(new Error('D1 claim unavailable'));

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
    expect(mocks.finalizeOrderPayment).not.toHaveBeenCalled();
  });
});
