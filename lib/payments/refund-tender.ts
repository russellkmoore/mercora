/**
 * Deterministic allocation for a refund of a mixed cash/gift-card purchase.
 *
 * The checkout snapshot records the original cash charge and gift tender.
 * Allocation is cumulative (rather than per-request proportional rounding),
 * so independently retried partial refunds can never exceed either tender.
 * Cash is allocated first; once its original charge is exhausted, the
 * remaining refund is restored to the original gift-card redemption.
 */
export interface RefundTenderAllocationInput {
  refundAmount: number;
  cashPaid: number;
  giftTender: number;
  refundedCash: number;
  restoredGift: number;
}

export interface RefundTenderAllocation {
  cashAmount: number;
  giftAmount: number;
}

function amount(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new TypeError(`${label} must be a nonnegative safe integer`);
  }
  return Number(value);
}

/** Split one new refund while preserving the original cash/gift tender caps. */
export function allocateRefundTender(input: RefundTenderAllocationInput): RefundTenderAllocation {
  const refundAmount = amount(input.refundAmount, 'refund amount');
  const cashPaid = amount(input.cashPaid, 'cash paid');
  const giftTender = amount(input.giftTender, 'gift tender');
  const refundedCash = amount(input.refundedCash, 'refunded cash');
  const restoredGift = amount(input.restoredGift, 'restored gift tender');
  if (refundAmount === 0) throw new TypeError('refund amount must be positive');
  if (refundedCash > cashPaid || restoredGift > giftTender) {
    throw new RangeError('recorded refund allocation exceeds its original tender');
  }
  const remainingCash = cashPaid - refundedCash;
  const remainingGift = giftTender - restoredGift;
  if (refundAmount > remainingCash + remainingGift) {
    throw new RangeError('refund exceeds remaining tender allocation');
  }
  const cashAmount = Math.min(refundAmount, remainingCash);
  return { cashAmount, giftAmount: refundAmount - cashAmount };
}
