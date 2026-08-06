import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  constructWebhookEvent: vi.fn(),
  claimWebhookEvent: vi.fn(),
  completeWebhookEvent: vi.fn(),
  failWebhookEvent: vi.fn(),
  handleChargeRefunded: vi.fn(),
  handleRefundLifecycle: vi.fn(),
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
  handleChargeRefunded: mocks.handleChargeRefunded,
  handleRefundLifecycle: mocks.handleRefundLifecycle,
}));

import { POST } from '@/app/api/webhooks/stripe/route';

function request() {
  return new NextRequest('https://example.test/api/webhooks/stripe', {
    method: 'POST', headers: { 'stripe-signature': 'signed' }, body: '{}',
  });
}

beforeEach(() => {
  mocks.claimWebhookEvent.mockResolvedValue({ state: 'acquired', claimToken: 'claim-refund' });
  mocks.completeWebhookEvent.mockResolvedValue(true);
  mocks.failWebhookEvent.mockResolvedValue(true);
  mocks.handleChargeRefunded.mockResolvedValue('handled');
  mocks.handleRefundLifecycle.mockResolvedValue('handled');
});

describe('Stripe refund webhook dispatch', () => {
  it('dispatches charge.refunded to authoritative charge reconciliation', async () => {
    const charge = { id: 'ch_1' };
    mocks.constructWebhookEvent.mockResolvedValue({
      id: 'evt_charge_refunded', type: 'charge.refunded', data: { object: charge },
    });

    expect((await POST(request())).status).toBe(200);
    expect(mocks.handleChargeRefunded).toHaveBeenCalledWith(charge);
    expect(mocks.completeWebhookEvent).toHaveBeenCalledWith({
      eventId: 'evt_charge_refunded', claimToken: 'claim-refund', outcome: 'handled',
    });
  });

  it.each(['refund.updated', 'refund.failed', 'charge.refund.updated'])(
    'dispatches %s to lifecycle reconciliation',
    async (type) => {
      const refund = { id: `re_${type}` };
      mocks.constructWebhookEvent.mockResolvedValue({
        id: `evt_${type}`, type, data: { object: refund },
      });

      expect((await POST(request())).status).toBe(200);
      expect(mocks.handleRefundLifecycle).toHaveBeenCalledWith(refund);
    }
  );

  it('leaves the durable webhook claim retryable when refund reconciliation fails', async () => {
    mocks.constructWebhookEvent.mockResolvedValue({
      id: 'evt_refund_retry', type: 'refund.updated', data: { object: { id: 're_retry' } },
    });
    mocks.handleRefundLifecycle.mockRejectedValue(new Error('D1 unavailable'));

    expect((await POST(request())).status).toBe(500);
    expect(mocks.failWebhookEvent).toHaveBeenCalledWith({
      eventId: 'evt_refund_retry',
      claimToken: 'claim-refund',
      error: expect.objectContaining({ message: 'D1 unavailable' }),
    });
    expect(mocks.completeWebhookEvent).not.toHaveBeenCalled();
  });
});
