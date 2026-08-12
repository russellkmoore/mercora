import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  constructWebhookEvent: vi.fn(),
  finalizeOrderPayment: vi.fn(),
  claimWebhookEvent: vi.fn(),
  completeWebhookEvent: vi.fn(),
  failWebhookEvent: vi.fn(),
  recordTelemetry: vi.fn(),
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
vi.mock('@/lib/observability/telemetry', () => ({
  recordTelemetry: mocks.recordTelemetry,
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
  mocks.finalizeOrderPayment.mockResolvedValue({ paid: true });
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
  it('rejects a missing signature with bounded verification telemetry', async () => {
    const response = await POST(new NextRequest('https://store.test/api/webhooks/stripe', {
      method: 'POST', body: '{}',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Missing stripe-signature header' });
    expect(mocks.constructWebhookEvent).not.toHaveBeenCalled();
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'webhook.signature_rejected',
      {
        operation: 'validate', outcome: 'rejected', provider: 'stripe',
        http_status: 400, path: '/api/webhooks/stripe', trigger: 'webhook',
      },
    );
  });

  it('rejects failed signature verification without exposing the provider error', async () => {
    const verificationError = new Error('signature mismatch: secret detail');
    mocks.constructWebhookEvent.mockRejectedValue(verificationError);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Webhook signature verification failed' });
    expect(mocks.claimWebhookEvent).not.toHaveBeenCalled();
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'webhook.signature_rejected',
      {
        operation: 'validate', outcome: 'rejected', provider: 'stripe',
        http_status: 400, path: '/api/webhooks/stripe', trigger: 'webhook',
      },
      verificationError,
    );
  });

  it('returns 500 for transient finalization failures so Stripe retries', async () => {
    const processingError = new Error('D1 unavailable');
    mocks.finalizeOrderPayment.mockRejectedValue(processingError);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
    expect(mocks.failWebhookEvent).toHaveBeenCalledWith({
      eventId: 'evt_payment',
      claimToken: 'claim_1',
      error: expect.objectContaining({ message: 'D1 unavailable' }),
    });
    expect(mocks.completeWebhookEvent).not.toHaveBeenCalled();
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'webhook.processing_failed',
      {
        operation: 'process', outcome: 'failed', retryable: true,
        path: '/api/webhooks/stripe', trigger: 'webhook',
      },
      processingError,
    );
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
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'webhook.payment_verification_rejected',
      {
        operation: 'validate', outcome: 'rejected', provider: 'stripe',
        path: '/api/webhooks/stripe', trigger: 'webhook',
      },
      expect.any(PaymentVerificationError),
    );
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
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'webhook.payment_verification_rejected',
      {
        operation: 'validate', outcome: 'rejected', provider: 'stripe',
        path: '/api/webhooks/stripe', trigger: 'webhook',
      },
    );
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
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'webhook.ownership_lost',
      {
        operation: 'complete', outcome: 'conflict', provider: 'd1', retryable: true,
        path: '/api/webhooks/stripe', trigger: 'webhook',
      },
    );
  });

  it('returns 500 without dispatch when the durable claim fails', async () => {
    const claimError = new Error('D1 claim unavailable');
    mocks.claimWebhookEvent.mockRejectedValue(claimError);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
    expect(mocks.finalizeOrderPayment).not.toHaveBeenCalled();
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'webhook.claim_failed',
      {
        operation: 'claim', outcome: 'failed', provider: 'd1', retryable: true,
        path: '/api/webhooks/stripe', trigger: 'webhook',
      },
      claimError,
    );
  });

  it('reports durable failure-record errors while preserving the retry response', async () => {
    const processingError = new Error('finalization unavailable');
    const recordError = new Error('failure record unavailable');
    mocks.finalizeOrderPayment.mockRejectedValue(processingError);
    mocks.failWebhookEvent.mockRejectedValue(recordError);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'webhook.failure_record_failed',
      {
        operation: 'record_failure', outcome: 'failed', provider: 'd1', retryable: true,
        path: '/api/webhooks/stripe', trigger: 'webhook',
      },
      recordError,
    );
  });

  it('reports ownership loss while recording a processing failure', async () => {
    const processingError = new Error('finalization unavailable');
    mocks.finalizeOrderPayment.mockRejectedValue(processingError);
    mocks.failWebhookEvent.mockResolvedValue(false);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'webhook.ownership_lost',
      {
        operation: 'record_failure', outcome: 'conflict', provider: 'd1', retryable: true,
        path: '/api/webhooks/stripe', trigger: 'webhook',
      },
    );
  });
});
