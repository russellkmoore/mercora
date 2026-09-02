import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  constructWebhookEvent: vi.fn(),
  claimWebhookEvent: vi.fn(),
  completeWebhookEvent: vi.fn(),
  failWebhookEvent: vi.fn(),
  handleChargeRefunded: vi.fn(),
  handleRefundLifecycle: vi.fn(),
  finalizeOrderPayment: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({ constructWebhookEvent: mocks.constructWebhookEvent }));
vi.mock('@/lib/services/order-finalization', () => ({
  PaymentVerificationError: class PaymentVerificationError extends Error {},
  finalizeOrderPayment: mocks.finalizeOrderPayment,
}));
vi.mock('@/lib/webhooks/processed-events', () => ({
  claimWebhookEvent: mocks.claimWebhookEvent,
  completeWebhookEvent: mocks.completeWebhookEvent,
  failWebhookEvent: mocks.failWebhookEvent,
}));
vi.mock('@/app/api/webhooks/stripe/handlers/refund-handlers', () => ({
  handleChargeRefunded: mocks.handleChargeRefunded,
  handleRefundLifecycle: mocks.handleRefundLifecycle,
}));

import { POST } from '@/app/api/webhooks/stripe/route';

const TELEMETRY_MARKER = 'commerce.telemetry.v1';

/** A Stripe payment_intent object carrying four identifiers this test must
 * never find in the serialized telemetry envelope. */
function paymentIntentFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pi_identifier_12345',
    customer: 'cus_identifier_67890',
    metadata: { orderId: 'order_identifier_ABCDE' },
    last_payment_error: {
      code: 'expired_card',
      charge: 'ch_identifier_FGHIJ',
    },
    ...overrides,
  };
}

function request() {
  return new NextRequest('https://example.test/api/webhooks/stripe', {
    method: 'POST', headers: { 'stripe-signature': 'signed' }, body: '{}',
  });
}

function eventFor(paymentIntent: Record<string, unknown>, eventId = 'evt_payment_failed') {
  return {
    id: eventId,
    type: 'payment_intent.payment_failed',
    data: { object: paymentIntent },
  };
}

beforeEach(() => {
  mocks.claimWebhookEvent.mockResolvedValue({ state: 'acquired', claimToken: 'claim-failed' });
  mocks.completeWebhookEvent.mockResolvedValue(true);
  mocks.failWebhookEvent.mockResolvedValue(true);
  mocks.handleChargeRefunded.mockResolvedValue('handled');
  mocks.handleRefundLifecycle.mockResolvedValue('handled');
  mocks.finalizeOrderPayment.mockResolvedValue({ paid: true });
});

describe('Stripe payment_intent.payment_failed webhook', () => {
  it('returns 200 and records the event as handled through completeWebhookEvent', async () => {
    mocks.constructWebhookEvent.mockResolvedValue(eventFor(paymentIntentFixture()));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.completeWebhookEvent).toHaveBeenCalledWith({
      eventId: 'evt_payment_failed',
      claimToken: 'claim-failed',
      outcome: 'handled',
    });
  });

  it('emits exactly one console.warn telemetry envelope for the failed-intent event', async () => {
    mocks.constructWebhookEvent.mockResolvedValue(eventFor(paymentIntentFixture()));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await POST(request());

    expect(warnSpy).toHaveBeenCalledOnce();
    const envelope = JSON.parse(String(warnSpy.mock.calls[0][0]));
    expect(envelope).toMatchObject({
      marker: TELEMETRY_MARKER,
      event: 'payment.intent_failed',
      severity: 'warning',
    });
    warnSpy.mockRestore();
  });

  it('carries exactly the three fields provider, outcome, and reason', async () => {
    mocks.constructWebhookEvent.mockResolvedValue(eventFor(paymentIntentFixture()));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await POST(request());

    const envelope = JSON.parse(String(warnSpy.mock.calls[0][0]));
    expect(Object.keys(envelope.fields).sort()).toEqual(['outcome', 'provider', 'reason']);
    expect(envelope.fields).toMatchObject({ provider: 'stripe', outcome: 'failed' });
    warnSpy.mockRestore();
  });

  it('maps an expired-card decline code to the expired_card reason', async () => {
    mocks.constructWebhookEvent.mockResolvedValue(eventFor(paymentIntentFixture({
      last_payment_error: { code: 'expired_card' },
    })));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await POST(request());

    const envelope = JSON.parse(String(warnSpy.mock.calls[0][0]));
    expect(envelope.fields.reason).toBe('expired_card');
    warnSpy.mockRestore();
  });

  it('maps an unmapped Stripe decline code to other', async () => {
    mocks.constructWebhookEvent.mockResolvedValue(eventFor(paymentIntentFixture({
      last_payment_error: { code: 'processing_error' },
    })));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await POST(request());

    const envelope = JSON.parse(String(warnSpy.mock.calls[0][0]));
    expect(envelope.fields.reason).toBe('other');
    warnSpy.mockRestore();
  });

  it('maps a payment intent with no last_payment_error at all to other', async () => {
    mocks.constructWebhookEvent.mockResolvedValue(eventFor(paymentIntentFixture({
      last_payment_error: undefined,
    })));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await POST(request());

    const envelope = JSON.parse(String(warnSpy.mock.calls[0][0]));
    expect(envelope.fields.reason).toBe('other');
    warnSpy.mockRestore();
  });

  it('never includes the payment intent id, charge id, customer id, or order id in the envelope', async () => {
    const fixture = paymentIntentFixture();
    mocks.constructWebhookEvent.mockResolvedValue(eventFor(fixture));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await POST(request());

    const serialized = String(warnSpy.mock.calls[0][0]);
    expect(serialized).not.toContain(fixture.id);
    expect(serialized).not.toContain(fixture.customer);
    expect(serialized).not.toContain(fixture.metadata.orderId);
    expect(serialized).not.toContain(fixture.last_payment_error.charge);
    warnSpy.mockRestore();
  });

  it('calls no state-changing collaborator beyond the claim/complete pair the POST wrapper performs', async () => {
    mocks.constructWebhookEvent.mockResolvedValue(eventFor(paymentIntentFixture()));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await POST(request());

    expect(mocks.finalizeOrderPayment).not.toHaveBeenCalled();
    expect(mocks.handleChargeRefunded).not.toHaveBeenCalled();
    expect(mocks.handleRefundLifecycle).not.toHaveBeenCalled();
    expect(mocks.claimWebhookEvent).toHaveBeenCalledOnce();
    expect(mocks.completeWebhookEvent).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it('replaying the same event three times yields three telemetry lines and zero state changes', async () => {
    const fixture = paymentIntentFixture();
    mocks.constructWebhookEvent.mockResolvedValue(eventFor(fixture));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const responses = await Promise.all([1, 2, 3].map(async () => {
      const res = await POST(request());
      return res.status;
    }));

    expect(responses).toEqual([200, 200, 200]);
    expect(warnSpy).toHaveBeenCalledTimes(3);
    expect(mocks.finalizeOrderPayment).not.toHaveBeenCalled();
    expect(mocks.handleChargeRefunded).not.toHaveBeenCalled();
    expect(mocks.handleRefundLifecycle).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('still emits telemetry for an intent with no orderId in metadata', async () => {
    mocks.constructWebhookEvent.mockResolvedValue(eventFor(paymentIntentFixture({
      metadata: {},
    })));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(warnSpy).toHaveBeenCalledOnce();
    const envelope = JSON.parse(String(warnSpy.mock.calls[0][0]));
    expect(envelope.event).toBe('payment.intent_failed');
    warnSpy.mockRestore();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
