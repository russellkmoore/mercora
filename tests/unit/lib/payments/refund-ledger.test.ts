import { describe, expect, it } from 'vitest';
import {
  deriveRefundIdempotencyKey,
  deriveRefundRequestFingerprint,
} from '@/lib/payments/refund-idempotency';
import { decideRefundLedgerAction } from '@/lib/payments/refund-ledger';

describe('refund ledger decisions', () => {
  it('reserves cumulative-safe partial and remaining full refunds', async () => {
    await expect(decideRefundLedgerAction(
      [{ amount: 200, status: 'succeeded' }],
      { orderId: 'order-1', type: 'partial', amount: 300, lineIds: ['line-1'], totalAmount: 1_000 }
    )).resolves.toMatchObject({ action: 'reserve', refundAmount: 300, settledSequence: 1 });

    await expect(decideRefundLedgerAction(
      [{ amount: 200, status: 'succeeded' }],
      { orderId: 'order-1', type: 'full', totalAmount: 1_000 }
    )).resolves.toMatchObject({ action: 'reserve', refundAmount: 800 });
  });

  it('counts pending reservations against over-refund', async () => {
    await expect(decideRefundLedgerAction(
      [{ amount: 700, status: 'pending', idempotency_key: 'different' }],
      { orderId: 'order-1', type: 'partial', amount: 301, lineIds: ['line-2'], totalAmount: 1_000 }
    )).resolves.toMatchObject({ action: 'reject', status: 400 });
  });

  it('reconciles only a byte-exact pending idempotency key', async () => {
    const key = await deriveRefundIdempotencyKey({
      orderId: 'order-1', type: 'partial', refundAmount: 250,
      settledSequence: 0, lineIds: ['line-1'],
    });
    const fingerprint = await deriveRefundRequestFingerprint({
      orderId: 'order-1', type: 'partial', refundAmount: 250, lineIds: ['line-1'],
    });
    await expect(decideRefundLedgerAction(
      [{
        amount: 250, status: 'pending', type: 'partial', items: ['line-1'],
        settled_sequence: 0, idempotency_key: key, request_fingerprint: fingerprint,
      }],
      { orderId: 'order-1', type: 'partial', amount: 250, lineIds: ['line-1'], totalAmount: 1_000 }
    )).resolves.toEqual({
      action: 'reconcile', entryIndex: 0, idempotencyKey: key,
      requestFingerprint: fingerprint, refundAmount: 250,
    });

    await expect(decideRefundLedgerAction(
      [{
        amount: 250, status: 'pending', type: 'partial', items: ['line-1'],
        settled_sequence: 0, idempotency_key: 'refund:not-the-key',
        request_fingerprint: fingerprint,
      }],
      { orderId: 'order-1', type: 'partial', amount: 250, lineIds: ['line-1'], totalAmount: 1_000 }
    )).resolves.toMatchObject({ action: 'reject', status: 409 });
  });

  it('retries a pending refund after an unrelated reservation settles', async () => {
    const firstKey = await deriveRefundIdempotencyKey({
      orderId: 'order-1', type: 'partial', refundAmount: 100,
      settledSequence: 0, lineIds: ['line-a'],
    });
    const waitingKey = await deriveRefundIdempotencyKey({
      orderId: 'order-1', type: 'partial', refundAmount: 200,
      settledSequence: 0, lineIds: ['line-b'],
    });
    const firstFingerprint = await deriveRefundRequestFingerprint({
      orderId: 'order-1', type: 'partial', refundAmount: 100, lineIds: ['line-a'],
    });
    const waitingFingerprint = await deriveRefundRequestFingerprint({
      orderId: 'order-1', type: 'partial', refundAmount: 200, lineIds: ['line-b'],
    });
    await expect(decideRefundLedgerAction([
      {
        amount: 100, status: 'succeeded', type: 'partial', items: ['line-a'],
        settled_sequence: 0, idempotency_key: firstKey,
        request_fingerprint: firstFingerprint, stripe_refund_id: 're_first',
      },
      {
        amount: 200, status: 'pending', type: 'partial', items: ['line-b'],
        settled_sequence: 0, idempotency_key: waitingKey,
        request_fingerprint: waitingFingerprint,
      },
    ], {
      orderId: 'order-1', type: 'partial', amount: 200,
      lineIds: ['line-b'], totalAmount: 1_000,
    })).resolves.toMatchObject({ action: 'reconcile', idempotencyKey: waitingKey });
  });

  it('returns an already completed identical request instead of reserving again', async () => {
    const key = await deriveRefundIdempotencyKey({
      orderId: 'order-1', type: 'partial', refundAmount: 250,
      settledSequence: 0, lineIds: ['line-1'],
    });
    const fingerprint = await deriveRefundRequestFingerprint({
      orderId: 'order-1', type: 'partial', refundAmount: 250, lineIds: ['line-1'],
    });
    await expect(decideRefundLedgerAction([{
      amount: 250,
      status: 'succeeded',
      type: 'partial',
      items: ['line-1'],
      settled_sequence: 0,
      idempotency_key: key,
      request_fingerprint: fingerprint,
      stripe_refund_id: 're_complete',
      provider_status: 'succeeded',
    }], {
      orderId: 'order-1', type: 'partial', amount: 250,
      lineIds: ['line-1'], totalAmount: 1_000,
    })).resolves.toMatchObject({
      action: 'completed', stripeRefundId: 're_complete', idempotencyKey: key,
    });
  });

  it('accepts a completed zero-cash refund only after its gift restoration is recorded', async () => {
    const key = await deriveRefundIdempotencyKey({
      orderId: 'order-1', type: 'partial', refundAmount: 250,
      settledSequence: 0, lineIds: ['line-1'],
    });
    const fingerprint = await deriveRefundRequestFingerprint({
      orderId: 'order-1', type: 'partial', refundAmount: 250, lineIds: ['line-1'],
    });
    const entry = {
      amount: 250, status: 'succeeded', type: 'partial' as const, items: ['line-1'],
      settled_sequence: 0, idempotency_key: key, request_fingerprint: fingerprint,
      cash_amount: 0, gift_amount: 250, provider_status: 'not_applicable',
    };
    await expect(decideRefundLedgerAction([entry], {
      orderId: 'order-1', type: 'partial', amount: 250, lineIds: ['line-1'], totalAmount: 1_000,
    })).resolves.toMatchObject({ action: 'reject', status: 409 });
    await expect(decideRefundLedgerAction([{ ...entry, gift_restoration_status: 'succeeded' }], {
      orderId: 'order-1', type: 'partial', amount: 250, lineIds: ['line-1'], totalAmount: 1_000,
    })).resolves.toMatchObject({ action: 'completed', idempotencyKey: key });
  });

  it('rejects a new reservation at the record bound and any provider-floor divergence', async () => {
    const full = Array.from({ length: 100 }, (_, index) => ({
      amount: 1,
      status: 'failed' as const,
      id: `failed-${index}`,
    }));
    await expect(decideRefundLedgerAction(full, {
      orderId: 'order-1', type: 'partial', amount: 1,
      lineIds: ['line-1'], totalAmount: 1_000,
    })).resolves.toMatchObject({ action: 'reject', status: 409 });

    await expect(decideRefundLedgerAction([], {
      orderId: 'order-1', type: 'partial', amount: 1,
      lineIds: ['line-1'], totalAmount: 1_000, stripeRefundedFloor: 100,
    })).resolves.toMatchObject({ action: 'reject', status: 409 });
  });

  it('releases failed entries into a new settled sequence', async () => {
    const decision = await decideRefundLedgerAction(
      [{ amount: 250, status: 'failed', idempotency_key: 'old' }],
      { orderId: 'order-1', type: 'partial', amount: 250, lineIds: ['line-1'], totalAmount: 1_000 }
    );
    expect(decision).toMatchObject({ action: 'reserve', settledSequence: 1 });
  });

  it('uses the Stripe floor only as a reject gate, never a key input', async () => {
    const request = {
      orderId: 'order-1', type: 'full' as const, totalAmount: 1_000,
    };
    const normal = await decideRefundLedgerAction([], request);
    const safeFloor = await decideRefundLedgerAction([], { ...request, stripeRefundedFloor: 0 });
    expect(safeFloor).toEqual(normal);

    await expect(decideRefundLedgerAction([], {
      ...request,
      stripeRefundedFloor: 100,
    })).resolves.toMatchObject({ action: 'reject', status: 409 });
  });

  it('fails closed for malformed stored ledger entries', async () => {
    await expect(decideRefundLedgerAction(
      [{ amount: Number.NaN }],
      { orderId: 'order-1', type: 'partial', amount: 100, lineIds: ['line-1'], totalAmount: 1_000 }
    )).resolves.toMatchObject({ action: 'reject' });
  });
});
