import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  refundsCreate: vi.fn(),
  refundsRetrieve: vi.fn(),
  writes: [] as Array<Record<string, unknown>>,
  order: {} as Record<string, any>,
}));

vi.mock('@/lib/auth/unified-auth', () => ({
  PERMISSIONS: { ORDERS_UPDATE: 'orders:update' },
  authenticateRequest: vi.fn(async () => ({ success: true, tokenInfo: { tokenName: 'test' } })),
}));
vi.mock('@/lib/db', () => ({ getDbAsync: vi.fn(async () => ({})) }));
vi.mock('@/lib/stripe', () => ({
  getStripeClient: () => ({
    refunds: { create: mocks.refundsCreate, retrieve: mocks.refundsRetrieve },
  }),
}));
vi.mock('@/lib/payments/refund-ledger-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/payments/refund-ledger-store')>();
  return {
    ...actual,
    mutateRefundLedger: vi.fn(async (_db, _orderId, mutate) => {
      const extensions = mocks.order.extensions;
      const refunds = Array.isArray(extensions.refunds) ? extensions.refunds : [];
      const version = extensions.refunds_version ?? 0;
      const decision = await mutate({
        order: mocks.order,
        extensions,
        refunds,
        version,
        nextVersion: version + 1,
        nowIso: '2026-08-05T22:00:00.000Z',
      });
      if (decision.action === 'write') {
        mocks.order = {
          ...mocks.order,
          ...(decision.columns ?? {}),
          extensions: decision.extensions,
          updated_at: '2026-08-05T22:00:00.000Z',
        };
        mocks.writes.push(decision.extensions);
        return { ok: true, skipped: false, order: mocks.order };
      }
      return { ok: true, skipped: true, order: mocks.order };
    }),
  };
});

import { POST } from '@/app/api/orders/refund/route';
import {
  deriveRefundIdempotencyKey,
  deriveRefundRequestFingerprint,
} from '@/lib/payments/refund-idempotency';

function request(overrides: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/orders/refund', {
    method: 'POST',
    body: JSON.stringify({
      orderId: 'WEB-REFUND-1',
      type: 'partial',
      reason: 'Customer return',
      amount: 400,
      items: ['line-1'],
      notes: '',
      ...overrides,
    }),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  mocks.writes.length = 0;
  mocks.order = {
    id: 'WEB-REFUND-1',
    status: 'processing',
    payment_status: 'paid',
    total_amount: { amount: 1_000, currency: 'USD' },
    currency_code: 'USD',
    items: [{ id: 'line-1', product_id: 'product-1', variant_id: 'variant-1' }],
    external_references: { payment_intent_id: 'pi_refund' },
    extensions: { payment_intent_id: 'pi_refund', refunds: [], refunds_version: 0 },
    updated_at: '2026-08-05T21:00:00.000Z',
  };
  mocks.refundsCreate.mockResolvedValue({
    id: 're_1', amount: 400, status: 'succeeded', payment_intent: 'pi_refund',
  });
  mocks.refundsRetrieve.mockResolvedValue({
    id: 're_1', amount: 400, status: 'succeeded', payment_intent: 'pi_refund',
  });
});

describe('refund route durable ordering', () => {
  it('persists pending before Stripe and forwards the key as SDK options', async () => {
    mocks.refundsCreate.mockImplementation(async (_params, options) => {
      expect(mocks.writes).toHaveLength(1);
      expect((mocks.writes[0].refunds as Array<{ status: string }>)[0].status).toBe('pending');
      expect(options.idempotencyKey).toMatch(/^refund:[a-f0-9]{64}$/);
      return {
        id: 're_1', amount: 400, status: 'succeeded', payment_intent: 'pi_refund',
      };
    });

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_refund', amount: 400 }),
      { idempotencyKey: expect.stringMatching(/^refund:[a-f0-9]{64}$/) }
    );
    expect((mocks.order.extensions.refunds as Array<{ status: string }>)[0].status)
      .toBe('succeeded');
  });

  it('keeps an ambiguous transport failure pending for exact-key retry', async () => {
    mocks.refundsCreate.mockRejectedValue(new Error('connection reset'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((mocks.order.extensions.refunds as Array<{ status: string }>)[0].status)
      .toBe('pending');
    expect(mocks.writes).toHaveLength(1);
  });

  it('returns a settled response retry without calling Stripe twice', async () => {
    const first = await POST(request());
    const retry = await POST(request());
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ success: true, duplicate: true });
    expect(mocks.refundsCreate).toHaveBeenCalledTimes(1);
  });

  it('returns a completed full-refund retry after payment status becomes refunded', async () => {
    mocks.refundsCreate.mockResolvedValue({
      id: 're_full', amount: 1_000, status: 'succeeded', payment_intent: 'pi_refund',
    });
    const fullRequest = request({ type: 'full', amount: undefined, items: [] });
    const first = await POST(fullRequest);
    const retry = await POST(request({ type: 'full', amount: undefined, items: [] }));
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(mocks.order.payment_status).toBe('refunded');
    expect(mocks.refundsCreate).toHaveBeenCalledTimes(1);
  });

  it('returns 202 and retains reserved balance for delayed provider status', async () => {
    mocks.refundsCreate.mockResolvedValue({
      id: 're_pending', amount: 400, status: 'pending', payment_intent: 'pi_refund',
    });
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect((mocks.order.extensions.refunds as Array<{ status: string }>)[0].status)
      .toBe('pending');
  });

  it('retrieves a known delayed refund on retry and preserves requires_action', async () => {
    mocks.refundsCreate.mockResolvedValue({
      id: 're_action', amount: 400, status: 'requires_action', payment_intent: 'pi_refund',
    });
    const first = await POST(request());
    expect(first.status).toBe(202);
    expect(await first.json()).toMatchObject({
      refund: { status: 'requires_action', providerStatus: 'requires_action' },
    });

    mocks.refundsRetrieve.mockResolvedValue({
      id: 're_action', amount: 400, status: 'succeeded', payment_intent: 'pi_refund',
    });
    const retry = await POST(request());
    expect(retry.status).toBe(200);
    expect(mocks.refundsCreate).toHaveBeenCalledTimes(1);
    expect(mocks.refundsRetrieve).toHaveBeenCalledWith('re_action');
  });

  it('blocks an old unresolved create reservation for manual reconciliation', async () => {
    const idempotencyKey = await deriveRefundIdempotencyKey({
      orderId: 'WEB-REFUND-1', type: 'partial', refundAmount: 400,
      settledSequence: 0, lineIds: ['line-1'],
    });
    const requestFingerprint = await deriveRefundRequestFingerprint({
      orderId: 'WEB-REFUND-1', type: 'partial', refundAmount: 400,
      lineIds: ['line-1'],
    });
    mocks.order.extensions.refunds = [{
      id: idempotencyKey,
      idempotency_key: idempotencyKey,
      request_fingerprint: requestFingerprint,
      settled_sequence: 0,
      amount: 400,
      type: 'partial',
      items: ['line-1'],
      status: 'pending',
      requested_at: '2020-01-01T00:00:00.000Z',
    }];
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
    expect(mocks.refundsRetrieve).not.toHaveBeenCalled();
  });

  it('releases an explicit failed result and rejects unknown line ids before Stripe', async () => {
    mocks.refundsCreate.mockResolvedValue({
      id: 're_failed', amount: 400, status: 'failed', payment_intent: 'pi_refund',
    });
    const failed = await POST(request());
    expect(failed.status).toBe(502);
    expect((mocks.order.extensions.refunds as Array<{ status: string }>)[0].status)
      .toBe('failed');

    mocks.order.extensions = { payment_intent_id: 'pi_refund', refunds: [], refunds_version: 0 };
    mocks.refundsCreate.mockClear();
    const invalid = await POST(request({ items: ['unknown-line'] }));
    expect(invalid.status).toBe(400);
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });

  it.each([
    ['amount', { id: 're_wrong', amount: 399, status: 'succeeded', payment_intent: 'pi_refund' }],
    ['PaymentIntent', { id: 're_wrong', amount: 400, status: 'succeeded', payment_intent: 'pi_other' }],
  ])('keeps the reservation pending when Stripe returns the wrong %s', async (_field, result) => {
    mocks.refundsCreate.mockResolvedValue(result);

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: 'Payment provider returned an inconsistent refund',
    });
    expect((mocks.order.extensions.refunds as Array<{ status: string }>)[0].status)
      .toBe('pending');
    expect(mocks.writes).toHaveLength(1);
  });

  it('keeps a known reservation pending when Stripe retrieves a different refund id', async () => {
    mocks.refundsCreate.mockResolvedValue({
      id: 're_expected', amount: 400, status: 'requires_action', payment_intent: 'pi_refund',
    });
    expect((await POST(request())).status).toBe(202);
    mocks.refundsRetrieve.mockResolvedValue({
      id: 're_other', amount: 400, status: 'succeeded', payment_intent: 'pi_refund',
    });

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(mocks.refundsRetrieve).toHaveBeenCalledWith('re_expected');
    expect((mocks.order.extensions.refunds as Array<{ status: string }>)[0].status)
      .toBe('requires_action');
  });

  it('rejects a malformed persisted Stripe refund floor before calling Stripe', async () => {
    mocks.order.extensions.stripe_amount_refunded = '100';

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'Recorded Stripe refund total is invalid',
    });
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
    expect(mocks.refundsRetrieve).not.toHaveBeenCalled();
  });
});
