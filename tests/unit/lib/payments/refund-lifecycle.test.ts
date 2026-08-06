import { describe, expect, it } from 'vitest';
import { decideRefundLifecycle } from '@/lib/payments/refund-lifecycle';

const base = {
  chargeAmountRefunded: 400,
  totalAmount: 1_000,
  orderLineIds: ['line-a', 'line-b'],
  externalRestockEnabled: false,
  nowIso: '2026-08-06T20:00:00.000Z',
};

describe('refund lifecycle decisions', () => {
  it('settles a local reservation and selects only its returned lines', () => {
    const decision = decideRefundLifecycle({
      ...base,
      mode: 'charge',
      refunds: [{
        idempotency_key: 'request-1', amount: 400, type: 'partial',
        items: ['line-b'], status: 'pending',
      }],
      providerRefunds: [{
        id: 're_local', amount: 400, status: 'succeeded',
        paymentIntentId: 'pi_1', requestId: 'request-1',
      }],
    });

    expect(decision.refunds[0]).toMatchObject({
      status: 'succeeded', stripe_refund_id: 're_local',
    });
    expect(decision.restockLineIds).toEqual(['line-b']);
    expect(decision.fullyRefunded).toBe(false);
  });

  it('records a Dashboard partial refund without guessing returned lines', () => {
    const decision = decideRefundLifecycle({
      ...base,
      mode: 'charge',
      refunds: [],
      providerRefunds: [{
        id: 're_external', amount: 400, status: 'succeeded', paymentIntentId: 'pi_1',
      }],
    });

    expect(decision.refunds).toEqual([
      expect.objectContaining({
        stripe_refund_id: 're_external', source: 'stripe_dashboard', status: 'succeeded',
      }),
    ]);
    expect(decision.restockLineIds).toEqual([]);
  });

  it('restocks all outstanding lines for an explicitly enabled full Dashboard refund', () => {
    const decision = decideRefundLifecycle({
      ...base,
      chargeAmountRefunded: 1_000,
      externalRestockEnabled: true,
      mode: 'charge',
      refunds: [],
      providerRefunds: [{
        id: 're_external_full', amount: 1_000, status: 'succeeded', paymentIntentId: 'pi_1',
      }],
    });

    expect(decision.fullyRefunded).toBe(true);
    expect(decision.restockLineIds).toEqual(['line-a', 'line-b']);
  });

  it('never appends an unknown refund from a lifecycle-only event', () => {
    const decision = decideRefundLifecycle({
      ...base,
      mode: 'lifecycle',
      targetRefundId: 're_unknown',
      refunds: [],
      providerRefunds: [{
        id: 're_unknown', amount: 400, status: 'succeeded', paymentIntentId: 'pi_1',
      }],
    });

    expect(decision.matchedTarget).toBe(false);
    expect(decision.refunds).toEqual([]);
    expect(decision.stripeAmountRefunded).toBe(400);
  });

  it('releases failed reservations and withholds completion effects while unsettled', () => {
    const failed = decideRefundLifecycle({
      ...base,
      chargeAmountRefunded: 0,
      mode: 'lifecycle',
      targetRefundId: 're_failed',
      refunds: [{
        stripe_refund_id: 're_failed', amount: 400, type: 'partial',
        items: ['line-a'], status: 'pending',
      }],
      providerRefunds: [{
        id: 're_failed', amount: 400, status: 'failed', paymentIntentId: 'pi_1',
      }],
    });
    expect(failed.refunds[0]).toMatchObject({ status: 'failed' });
    expect(failed.restockLineIds).toEqual([]);

    const pending = decideRefundLifecycle({
      ...base,
      chargeAmountRefunded: 0,
      mode: 'lifecycle',
      targetRefundId: 're_pending',
      refunds: [{
        stripe_refund_id: 're_pending', amount: 400, type: 'partial',
        items: ['line-a'], status: 'pending',
      }],
      providerRefunds: [{
        id: 're_pending', amount: 400, status: 'requires_action', paymentIntentId: 'pi_1',
      }],
    });
    expect(pending.refunds[0]).toMatchObject({ status: 'requires_action' });
    expect(pending.fullyRefunded).toBe(false);
  });

  it('fails closed on incomplete provider lists and amount conflicts', () => {
    expect(() => decideRefundLifecycle({
      ...base,
      mode: 'charge',
      refunds: [],
      providerRefunds: [],
    })).toThrow('does not match');

    expect(() => decideRefundLifecycle({
      ...base,
      mode: 'charge',
      refunds: [{ stripe_refund_id: 're_1', amount: 500, status: 'pending' }],
      providerRefunds: [{
        id: 're_1', amount: 400, status: 'succeeded', paymentIntentId: 'pi_1',
      }],
    })).toThrow('amount conflicts');
  });
});
