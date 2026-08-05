import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  constructWebhookEvent: vi.fn(),
  finalizeOrderPayment: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  constructWebhookEvent: mocks.constructWebhookEvent,
}));

vi.mock('@/lib/services/order-finalization', () => ({
  PaymentVerificationError: class PaymentVerificationError extends Error {},
  finalizeOrderPayment: mocks.finalizeOrderPayment,
}));

import { POST } from '@/app/api/webhooks/stripe/route';

function request(body: string, signature?: string) {
  return new NextRequest('https://example.test/api/webhooks/stripe', {
    method: 'POST',
    headers: signature ? { 'stripe-signature': signature } : undefined,
    body,
  });
}

beforeEach(() => {
  mocks.constructWebhookEvent.mockResolvedValue({
    id: 'evt_valid',
    type: 'unhandled.test',
    data: { object: {} },
  });
});

describe('Stripe webhook signature verification', () => {
  it('rejects a missing signature before verification', async () => {
    const response = await POST(request('{}'));

    expect(response.status).toBe(400);
    expect(mocks.constructWebhookEvent).not.toHaveBeenCalled();
  });

  it('passes the exact raw body and signature to async verification', async () => {
    const rawBody = '{ "spacing": "must survive" }';
    const response = await POST(request(rawBody, 't=1,v1=signed'));

    expect(response.status).toBe(200);
    expect(mocks.constructWebhookEvent).toHaveBeenCalledWith(rawBody, 't=1,v1=signed');
  });

  it('rejects verification failures without dispatching', async () => {
    mocks.constructWebhookEvent.mockRejectedValue(new Error('bad signature'));

    const response = await POST(request('{}', 'invalid'));

    expect(response.status).toBe(400);
    expect(mocks.finalizeOrderPayment).not.toHaveBeenCalled();
  });
});
