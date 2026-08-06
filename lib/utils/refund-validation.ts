/** Pure, storage-agnostic refund validation and cumulative-money helpers. */

export const MAX_REFUND_RECORDS = 100;
export const MAX_REFUND_LINE_IDS = 100;
export const MAX_REFUND_TEXT_LENGTH = 128;

export type RefundStatus =
  | 'pending'
  | 'requires_action'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type RefundStatusClass = 'reserved' | 'settled' | 'released' | 'legacy' | 'unknown';

export interface RefundRecord {
  id?: string;
  idempotency_key?: string;
  request_fingerprint?: string;
  stripe_refund_id?: string;
  amount?: number;
  status?: RefundStatus | string;
  type?: 'full' | 'partial';
  items?: string[];
  settled_sequence?: number;
  requested_at?: string;
  processed_at?: string;
  provider_status?: string;
  [key: string]: unknown;
}

export interface OrderExtensions {
  refunds?: unknown;
  stripe_amount_refunded?: unknown;
  [key: string]: unknown;
}

/**
 * SQL fragment for the future atomic shipment transition. Keep the JSON
 * validity guard and object-element check: legacy scalar or malformed metadata
 * must not throw or create substring false positives.
 */
export const SHIPMENT_NO_UNSETTLED_REFUNDS_SQL = `NOT EXISTS (
  SELECT 1
  FROM json_each(
    CASE
      WHEN json_valid(COALESCE(orders.extensions, '{}')) = 1
        THEN COALESCE(orders.extensions, '{}')
      ELSE '{}'
    END,
    '$.refunds'
  ) AS refund
  WHERE refund.type = 'object'
    AND json_extract(refund.value, '$.status') IN ('pending', 'requires_action')
)`;

export function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** Classify both current Stripe states and status-less legacy ledger entries. */
export function classifyRefundStatus(status: unknown): RefundStatusClass {
  if (status === undefined || status === null || status === '') return 'legacy';
  if (status === 'pending' || status === 'requires_action') return 'reserved';
  if (status === 'succeeded') return 'settled';
  if (status === 'failed' || status === 'canceled') return 'released';
  return 'unknown';
}

/** Pending and requires-action refunds reserve balance and block fulfillment. */
export function isUnsettledRefund(record: RefundRecord | null | undefined): boolean {
  return classifyRefundStatus(record?.status) === 'reserved';
}

export function hasPendingRefund(extensions: OrderExtensions | null | undefined): boolean {
  const refunds = extensions?.refunds;
  return Array.isArray(refunds) && refunds.some(
    (entry) => entry !== null && typeof entry === 'object' && isUnsettledRefund(entry as RefundRecord)
  );
}

/**
 * Sum balance-reserving ledger entries using positive safe integers only.
 *
 * Oversized ledgers and arithmetic overflow return MAX_SAFE_INTEGER. That is a
 * deliberate fail-closed result: corrupt storage must never open room for an
 * additional refund.
 */
export function computeRefundedTotal(extensions: OrderExtensions | null | undefined): number {
  const refunds = extensions?.refunds;
  if (!Array.isArray(refunds)) return 0;
  if (refunds.length > MAX_REFUND_RECORDS) return Number.MAX_SAFE_INTEGER;

  let total = 0;
  for (const raw of refunds) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return Number.MAX_SAFE_INTEGER;
    }
    const refund = raw as RefundRecord;
    const status = classifyRefundStatus(refund.status);
    if (status === 'released') continue;
    if (status === 'unknown' || !isPositiveSafeInteger(refund.amount)) {
      return Number.MAX_SAFE_INTEGER;
    }
    if (total > Number.MAX_SAFE_INTEGER - refund.amount) return Number.MAX_SAFE_INTEGER;
    total += refund.amount;
  }
  return total;
}

export type RefundAmountResult = { ok: true; amount: number } | { ok: false; error: string };

/** Validate an explicit partial-refund amount against the remaining balance. */
export function assertRefundWithinRemaining(
  totalAmount: number,
  alreadyRefunded: number,
  requestedAmount: number
): { ok: true } | { ok: false; error: string } {
  if (!isPositiveSafeInteger(totalAmount)) {
    return { ok: false, error: 'Order total must be a positive safe integer' };
  }
  if (!Number.isSafeInteger(alreadyRefunded) || alreadyRefunded < 0) {
    return { ok: false, error: 'Recorded refund total is invalid' };
  }
  if (!isPositiveSafeInteger(requestedAmount)) {
    return { ok: false, error: 'Refund amount must be a positive safe integer' };
  }
  if (alreadyRefunded >= totalAmount || requestedAmount > totalAmount - alreadyRefunded) {
    return { ok: false, error: 'Refund exceeds remaining refundable amount' };
  }
  return { ok: true };
}

/** A full refund always means the remaining refundable amount. */
export function resolveFullRefundAmount(
  totalAmount: number,
  alreadyRefunded: number
): RefundAmountResult {
  if (!isPositiveSafeInteger(totalAmount)) {
    return { ok: false, error: 'Order total must be a positive safe integer' };
  }
  if (!Number.isSafeInteger(alreadyRefunded) || alreadyRefunded < 0) {
    return { ok: false, error: 'Recorded refund total is invalid' };
  }
  if (alreadyRefunded >= totalAmount) {
    return { ok: false, error: 'Order is already fully refunded' };
  }
  return { ok: true, amount: totalAmount - alreadyRefunded };
}
