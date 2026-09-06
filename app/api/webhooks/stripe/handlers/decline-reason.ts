/**
 * === Decline Reason Mapper ===
 *
 * Pure allow-list mapper from a Stripe `last_payment_error` shape to a closed,
 * five-value reason enum safe for telemetry.
 *
 * === Why This Exists ===
 * Stripe's `last_payment_error.code` is a union of roughly 200 possible
 * values and `decline_code` is typed as a free-form string, not a union.
 * Forwarding either raw into `commerce.telemetry.v1` would blow the closed
 * taxonomy contract enforced by `ALLOWED_FIELD_ENUMS.reason` in
 * `lib/observability/telemetry.ts`. This module guarantees every possible
 * input collapses to one of five fixed values, never a raw Stripe string.
 *
 * === Usage ===
 * @returns One of `DECLINE_REASONS`, defaulting to `'other'` for any input
 *   that does not match a known Stripe decline code.
 */

/** The closed set of reason values this mapper can ever return. */
export const DECLINE_REASONS: ReadonlySet<string> = new Set([
  'card_declined',
  'insufficient_funds',
  'authentication_required',
  'expired_card',
  'other',
]);

export type DeclineReason =
  | 'card_declined'
  | 'insufficient_funds'
  | 'authentication_required'
  | 'expired_card'
  | 'other';

/**
 * Stripe `code` values that map directly to a reason. `card_declined` is
 * intentionally omitted here — it is handled by the refinement rule in
 * `mapDeclineReason` first, since Stripe sometimes puts the more specific
 * reason in `decline_code` when `code` is this generic value.
 */
const CODE_TO_REASON: Record<string, DeclineReason> = {
  insufficient_funds: 'insufficient_funds',
  authentication_required: 'authentication_required',
  expired_card: 'expired_card',
};

/**
 * Map any shape Stripe can put in `last_payment_error` to a closed,
 * five-value reason enum. Total over all inputs — never throws.
 */
export function mapDeclineReason(error: unknown): DeclineReason {
  if (!error || typeof error !== 'object' || Array.isArray(error)) return 'other';
  const record = error as Record<string, unknown>;
  const code = record.code;
  if (typeof code !== 'string') return 'other';
  if (code === 'card_declined') {
    const declineCode = record.decline_code;
    if (declineCode === 'insufficient_funds') return 'insufficient_funds';
    if (declineCode === 'expired_card') return 'expired_card';
    if (declineCode === 'authentication_required') return 'authentication_required';
    return 'card_declined';
  }
  return CODE_TO_REASON[code] ?? 'other';
}
