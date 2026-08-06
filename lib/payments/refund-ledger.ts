import {
  deriveRefundIdempotencyKey,
  deriveRefundRequestFingerprint,
  normalizeRefundLineIds,
} from '@/lib/payments/refund-idempotency';
import {
  MAX_REFUND_RECORDS,
  assertRefundWithinRemaining,
  classifyRefundStatus,
  computeRefundedTotal,
  isPositiveSafeInteger,
  resolveFullRefundAmount,
  type RefundRecord,
} from '@/lib/utils/refund-validation';

export interface RefundLedgerRequest {
  orderId: string;
  type: 'full' | 'partial';
  amount?: number;
  lineIds?: string[];
  totalAmount: number;
  /** Provider-observed cumulative truth. Reject-only; never a hash input. */
  stripeRefundedFloor?: number;
}

export type RefundLedgerDecision =
  | {
      action: 'completed';
      entryIndex: number;
      idempotencyKey: string;
      requestFingerprint: string;
      refundAmount: number;
      stripeRefundId: string;
      providerStatus: string;
    }
  | {
      action: 'reconcile';
      entryIndex: number;
      idempotencyKey: string;
      requestFingerprint: string;
      refundAmount: number;
      stripeRefundId?: string;
      requestedAt?: string;
    }
  | {
      action: 'reserve';
      idempotencyKey: string;
      requestFingerprint: string;
      refundAmount: number;
      settledSequence: number;
    }
  | {
      action: 'reject';
      status: 400 | 409;
      error: string;
    };

function isReserved(record: RefundRecord): boolean {
  return classifyRefundStatus(record.status) === 'reserved';
}

function reject(error: string, status: 400 | 409 = 400): RefundLedgerDecision {
  return { action: 'reject', status, error };
}

/**
 * Reconcile an exact pending reservation or decide a new atomic reservation.
 * Pure apart from Workers-compatible Web Crypto used for the deterministic key.
 */
export async function decideRefundLedgerAction(
  refunds: RefundRecord[],
  request: RefundLedgerRequest
): Promise<RefundLedgerDecision> {
  if (!Array.isArray(refunds) || refunds.length > MAX_REFUND_RECORDS) {
    return reject('Refund ledger is invalid or exceeds its supported size', 409);
  }
  if (!isPositiveSafeInteger(request.totalAmount)) {
    return reject('Order total must be a positive safe integer');
  }

  // Failed/canceled entries remain part of the monotonic sequence even though
  // they release money. Only currently reserved entries are omitted so a retry
  // reproduces the key stored by its own pending reservation.
  const settledBaseline = refunds.filter((entry) => !isReserved(entry));
  const settledSequence = settledBaseline.length;
  const allRefunded = computeRefundedTotal({ refunds });
  if (!Number.isSafeInteger(allRefunded)) {
    return reject('Refund ledger arithmetic is invalid', 409);
  }

  // Re-derive each pending entry's key from its stored immutable sequence and
  // exact request fields. This remains stable if an unrelated pending refund
  // settles between the original attempt and its retry.
  let requestLines: string[];
  try {
    requestLines = normalizeRefundLineIds(request.lineIds);
  } catch (error) {
    return reject(error instanceof Error ? error.message : 'Invalid refund request');
  }
  const matching: Array<{
    entryIndex: number;
    key: string;
    fingerprint: string;
    amount: number;
    status: 'reserved' | 'settled';
    stripeRefundId?: string;
    providerStatus?: string;
    requestedAt?: string;
  }> = [];
  for (const [entryIndex, entry] of refunds.entries()) {
    const status = classifyRefundStatus(entry.status);
    if ((status !== 'reserved' && status !== 'settled') ||
        entry.type !== request.type || !isPositiveSafeInteger(entry.amount)) {
      continue;
    }
    if (request.type === 'partial' && entry.amount !== request.amount) continue;
    let entryLines: string[];
    try {
      entryLines = normalizeRefundLineIds(entry.items);
    } catch {
      return reject('Pending refund reservation has invalid line ids', 409);
    }
    if (JSON.stringify(entryLines) !== JSON.stringify(requestLines)) continue;
    if (typeof entry.request_fingerprint !== 'string' ||
        typeof entry.idempotency_key !== 'string') {
      return reject('Refund entry has invalid retry identity', 409);
    }
    const fingerprint = await deriveRefundRequestFingerprint({
      orderId: request.orderId,
      type: request.type,
      refundAmount: entry.amount,
      lineIds: entryLines,
    });
    if (fingerprint !== entry.request_fingerprint) {
      return reject('Refund entry fingerprint is inconsistent', 409);
    }
    if (!Number.isSafeInteger(entry.settled_sequence) || Number(entry.settled_sequence) < 0) {
      return reject('Refund entry has invalid idempotency sequence', 409);
    }
    const key = await deriveRefundIdempotencyKey({
      orderId: request.orderId,
      type: request.type,
      refundAmount: entry.amount,
      settledSequence: Number(entry.settled_sequence),
      lineIds: entryLines,
    });
    if (key !== entry.idempotency_key) {
      return reject('Refund entry idempotency key is inconsistent', 409);
    }
    matching.push({
      entryIndex,
      key,
      fingerprint,
      amount: entry.amount,
      status,
      ...(typeof entry.stripe_refund_id === 'string'
        ? { stripeRefundId: entry.stripe_refund_id }
        : {}),
      ...(typeof entry.provider_status === 'string'
        ? { providerStatus: entry.provider_status }
        : {}),
      ...(typeof entry.requested_at === 'string' ? { requestedAt: entry.requested_at } : {}),
    });
  }
  if (matching.length > 1) {
    return reject('Multiple ledger entries match this refund request', 409);
  }
  if (matching.length === 1) {
    const match = matching[0];
    if (match.status === 'settled') {
      if (!match.stripeRefundId) return reject('Settled refund is missing its Stripe id', 409);
      return {
        action: 'completed',
        entryIndex: match.entryIndex,
        idempotencyKey: match.key,
        requestFingerprint: match.fingerprint,
        refundAmount: match.amount,
        stripeRefundId: match.stripeRefundId,
        providerStatus: match.providerStatus ?? 'succeeded',
      };
    }
    return {
      action: 'reconcile',
      entryIndex: match.entryIndex,
      idempotencyKey: match.key,
      requestFingerprint: match.fingerprint,
      refundAmount: match.amount,
      ...(match.stripeRefundId ? { stripeRefundId: match.stripeRefundId } : {}),
      ...(match.requestedAt ? { requestedAt: match.requestedAt } : {}),
    };
  }

  if (refunds.length >= MAX_REFUND_RECORDS) {
    return reject('Refund ledger has reached its supported size', 409);
  }

  let refundAmount: number;
  if (request.type === 'full') {
    const result = resolveFullRefundAmount(request.totalAmount, allRefunded);
    if (!result.ok) return reject(result.error);
    refundAmount = result.amount;
  } else {
    if (request.amount === undefined) return reject('Partial refunds require an amount');
    const result = assertRefundWithinRemaining(request.totalAmount, allRefunded, request.amount);
    if (!result.ok) return reject(result.error);
    refundAmount = request.amount;
  }

  // Fail closed when Stripe knows about more money than the local ledger. This
  // is deliberately after amount resolution and never changes amount/sequence.
  const floor = request.stripeRefundedFloor;
  if (floor !== undefined) {
    if (!Number.isSafeInteger(floor) || floor < 0) {
      return reject('Stripe refunded amount is invalid', 409);
    }
    if (floor > allRefunded) {
      return reject(
        'Stripe reports more refunded than the local ledger; reconcile before refunding again',
        409
      );
    }
  }

  try {
    const idempotencyKey = await deriveRefundIdempotencyKey({
      orderId: request.orderId,
      type: request.type,
      refundAmount,
      settledSequence,
      lineIds: request.lineIds,
    });
    const requestFingerprint = await deriveRefundRequestFingerprint({
      orderId: request.orderId,
      type: request.type,
      refundAmount,
      lineIds: request.lineIds,
    });
    return {
      action: 'reserve', idempotencyKey, requestFingerprint, refundAmount, settledSequence,
    };
  } catch (error) {
    return reject(error instanceof Error ? error.message : 'Invalid refund request');
  }
}
