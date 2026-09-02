// Characterization test: pins the contract the `default` branch already provides
// for any Stripe event type with no dispatch case, using `checkout.session.completed`
// (the event type removed from the switch in this phase) as the example. This is not
// a test of removed behaviour - it is a regression guard against ever re-adding a case
// for this event type, or changing what an unrecognised event does.
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

vi.mock('@/lib/services/order-finalization', () => ({
  PaymentVerificationError: class PaymentVerificationError extends Error {},
  finalizeOrderPayment: mocks.finalizeOrderPayment,
}));

vi.mock('@/lib/webhooks/processed-events', () => ({
  claimWebhookEvent: mocks.claimWebhookEvent,
  completeWebhookEvent: mocks.completeWebhookEvent,
  failWebhookEvent: mocks.failWebhookEvent,
}));

import { POST } from '@/app/api/webhooks/stripe/route';

function request(body: BodyInit, signature?: string, headers?: Record<string, string>) {
  return new NextRequest('https://example.test/api/webhooks/stripe', {
    method: 'POST',
    headers: { ...(signature ? { 'stripe-signature': signature } : {}), ...headers },
    body,
  });
}

beforeEach(() => {
  mocks.constructWebhookEvent.mockResolvedValue({
    id: 'evt_cs_1',
    type: 'checkout.session.completed',
    data: { object: { metadata: { orderId: 'ord_1' } } },
  });
  mocks.claimWebhookEvent.mockResolvedValue({ state: 'acquired', claimToken: 'claim_1' });
  mocks.completeWebhookEvent.mockResolvedValue(true);
  mocks.failWebhookEvent.mockResolvedValue(true);
});

describe('Stripe webhook unhandled-event contract', () => {
  it('returns HTTP 200 for an event type with no dispatch case', async () => {
    const response = await POST(request('{}', 't=1,v1=signed'));

    expect(response.status).toBe(200);
  });

  it('completes the webhook ledger entry with outcome "ignored"', async () => {
    await POST(request('{}', 't=1,v1=signed'));

    expect(mocks.completeWebhookEvent).toHaveBeenCalledWith({
      eventId: 'evt_cs_1',
      claimToken: 'claim_1',
      outcome: 'ignored',
    });
  });

  it('never calls finalizeOrderPayment on the fall-through path', async () => {
    await POST(request('{}', 't=1,v1=signed'));

    expect(mocks.finalizeOrderPayment).not.toHaveBeenCalled();
  });

  it('still claims the event before dispatch, preserving the idempotency ledger', async () => {
    await POST(request('{}', 't=1,v1=signed'));

    expect(mocks.claimWebhookEvent).toHaveBeenCalledWith({
      eventId: 'evt_cs_1',
      eventType: 'checkout.session.completed',
    });
  });
});
