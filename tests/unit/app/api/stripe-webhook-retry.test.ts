import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  finalizeOrderPayment: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({ webhooks: { constructEvent: mocks.constructEvent } }),
  getWebhookSecret: () => 'whsec_test',
}));

vi.mock('@/lib/services/order-finalization', () => {
  class PaymentVerificationError extends Error {}
  return {
    PaymentVerificationError,
    finalizeOrderPayment: mocks.finalizeOrderPayment,
  };
});

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
  mocks.constructEvent.mockReturnValue({
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_1', metadata: { orderId: 'WEB-1' } } },
  });
});

describe('Stripe webhook retry behavior', () => {
  it('returns 500 for transient finalization failures so Stripe retries', async () => {
    mocks.finalizeOrderPayment.mockRejectedValue(new Error('D1 unavailable'));

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
  });

  it('acknowledges permanent payment verification rejection', async () => {
    mocks.finalizeOrderPayment.mockRejectedValue(
      new PaymentVerificationError('payment binding mismatch')
    );

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
  });
});
