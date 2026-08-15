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
    id: 'evt_valid',
    type: 'unhandled.test',
    data: { object: {} },
  });
  mocks.claimWebhookEvent.mockResolvedValue({ state: 'acquired', claimToken: 'claim_1' });
  mocks.completeWebhookEvent.mockResolvedValue(true);
  mocks.failWebhookEvent.mockResolvedValue(true);
});

describe('Stripe webhook signature verification', () => {
  it('rejects a missing signature before verification', async () => {
    const response = await POST(request('{}'));

    expect(response.status).toBe(400);
    expect(mocks.constructWebhookEvent).not.toHaveBeenCalled();
    expect(mocks.claimWebhookEvent).not.toHaveBeenCalled();
  });

  it('passes the exact raw body and signature to async verification', async () => {
    const rawBody = '{ "spacing": "must survive" }';
    const response = await POST(request(rawBody, 't=1,v1=signed'));

    expect(response.status).toBe(200);
    const [verifiedBody, verifiedSignature] = mocks.constructWebhookEvent.mock.calls[0];
    expect(verifiedBody).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(verifiedBody)).toBe(rawBody);
    expect(verifiedSignature).toBe('t=1,v1=signed');
    expect(mocks.claimWebhookEvent).toHaveBeenCalledWith({
      eventId: 'evt_valid',
      eventType: 'unhandled.test',
    });
    expect(mocks.completeWebhookEvent).toHaveBeenCalledWith({
      eventId: 'evt_valid',
      claimToken: 'claim_1',
      outcome: 'ignored',
    });
  });

  it('does not decode or normalize raw bytes before signature verification', async () => {
    const rawBody = Uint8Array.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xff, 0x7d]);

    const response = await POST(request(rawBody, 't=1,v1=signed'));

    expect(response.status).toBe(200);
    expect(Array.from(mocks.constructWebhookEvent.mock.calls[0][0] as Uint8Array))
      .toEqual(Array.from(rawBody));
  });

  it('rejects verification failures without dispatching', async () => {
    mocks.constructWebhookEvent.mockRejectedValue(new Error('bad signature'));

    const response = await POST(request('{}', 'invalid'));

    expect(response.status).toBe(400);
    expect(mocks.finalizeOrderPayment).not.toHaveBeenCalled();
    expect(mocks.claimWebhookEvent).not.toHaveBeenCalled();
  });

  it('rejects a missing signature before touching a large request stream', async () => {
    const pulled = vi.fn();
    const canceled = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled();
        controller.enqueue(new Uint8Array(1_048_577));
      },
      cancel: canceled,
    });

    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(pulled).not.toHaveBeenCalled();
    expect(canceled).toHaveBeenCalledOnce();
    expect(mocks.constructWebhookEvent).not.toHaveBeenCalled();
  });

  it('rejects declared oversized bodies before verification', async () => {
    const response = await POST(request('{}', 't=1,v1=signed', {
      'content-length': '1048577',
    }));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: 'Webhook payload was rejected' });
    expect(mocks.constructWebhookEvent).not.toHaveBeenCalled();
    expect(mocks.claimWebhookEvent).not.toHaveBeenCalled();
  });

  it('rejects actual chunked oversized bodies and cancels the stream', async () => {
    const canceled = vi.fn();
    let chunk = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunk += 1;
        if (chunk <= 2) controller.enqueue(new Uint8Array(600_000));
      },
      cancel: canceled,
    });

    const response = await POST(request(body, 't=1,v1=signed'));

    expect(response.status).toBe(413);
    expect(canceled).toHaveBeenCalledOnce();
    expect(mocks.constructWebhookEvent).not.toHaveBeenCalled();
    expect(mocks.claimWebhookEvent).not.toHaveBeenCalled();
  });
});
