import { sha256Hex } from '@/lib/auth/crypto';
import {
  MAX_REFUND_LINE_IDS,
  MAX_REFUND_TEXT_LENGTH,
  isPositiveSafeInteger,
} from '@/lib/utils/refund-validation';

export interface RefundIdempotencyInput {
  orderId: string;
  type: 'full' | 'partial';
  refundAmount: number;
  /** Monotonic sequence derived from the settled (non-reserved) ledger. */
  settledSequence: number;
  /** Stable order-line ids. Product or variant ids are not sufficient. */
  lineIds?: string[] | null;
}

export type RefundRequestFingerprintInput = Omit<RefundIdempotencyInput, 'settledSequence'>;

function assertBoundedText(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > MAX_REFUND_TEXT_LENGTH) {
    throw new TypeError(`${name} must be a non-empty string of at most ${MAX_REFUND_TEXT_LENGTH} characters`);
  }
}

/** Sort and validate exact stable line ids without changing their spelling. */
export function normalizeRefundLineIds(lineIds: string[] | null | undefined): string[] {
  if (lineIds == null) return [];
  if (!Array.isArray(lineIds) || lineIds.length > MAX_REFUND_LINE_IDS) {
    throw new TypeError(`lineIds must contain at most ${MAX_REFUND_LINE_IDS} entries`);
  }
  const normalized = lineIds.slice();
  for (const lineId of normalized) assertBoundedText(lineId, 'lineId');
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError('lineIds must not contain duplicates');
  }
  normalized.sort();
  return normalized;
}

/** Compatibility helper for callers that need the canonical serialized set. */
export function normalizeRefundItemKeys(lineIds: string[] | null | undefined): string {
  return JSON.stringify(normalizeRefundLineIds(lineIds));
}

/** Derive a bounded deterministic Stripe idempotency key. */
export async function deriveRefundIdempotencyKey(input: RefundIdempotencyInput): Promise<string> {
  assertBoundedText(input.orderId, 'orderId');
  if (input.type !== 'full' && input.type !== 'partial') {
    throw new TypeError('type must be full or partial');
  }
  if (!isPositiveSafeInteger(input.refundAmount)) {
    throw new TypeError('refundAmount must be a positive safe integer');
  }
  if (!Number.isSafeInteger(input.settledSequence) || input.settledSequence < 0) {
    throw new TypeError('settledSequence must be a non-negative safe integer');
  }

  const canonical = JSON.stringify({
    orderId: input.orderId,
    type: input.type,
    amount: input.refundAmount,
    settledSequence: input.settledSequence,
    lineIds: normalizeRefundLineIds(input.lineIds),
  });
  return `refund:${await sha256Hex(canonical)}`;
}

/**
 * Stable operation fingerprint used to recognize retries after settlement.
 *
 * The current refund contract returns whole order lines, so a given line set,
 * type, and amount is one operation for the lifetime of the order. Supporting
 * multiple partial-quantity returns for the same lines would require a distinct
 * client operation id and a versioned fingerprint contract.
 */
export async function deriveRefundRequestFingerprint(
  input: RefundRequestFingerprintInput
): Promise<string> {
  assertBoundedText(input.orderId, 'orderId');
  if (input.type !== 'full' && input.type !== 'partial') {
    throw new TypeError('type must be full or partial');
  }
  if (!isPositiveSafeInteger(input.refundAmount)) {
    throw new TypeError('refundAmount must be a positive safe integer');
  }
  const canonical = JSON.stringify({
    orderId: input.orderId,
    type: input.type,
    amount: input.refundAmount,
    lineIds: normalizeRefundLineIds(input.lineIds),
  });
  return `refund-request:${await sha256Hex(canonical)}`;
}
