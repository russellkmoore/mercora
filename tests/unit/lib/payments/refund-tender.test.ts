import { describe, expect, it } from 'vitest';
import { allocateRefundTender } from '@/lib/payments/refund-tender';

describe('mixed-tender refund allocation', () => {
  it('allocates cash first, then restores gift value without rounding drift', () => {
    expect(allocateRefundTender({
      refundAmount: 700, cashPaid: 600, giftTender: 400, refundedCash: 0, restoredGift: 0,
    })).toEqual({ cashAmount: 600, giftAmount: 100 });
    expect(allocateRefundTender({
      refundAmount: 300, cashPaid: 600, giftTender: 400, refundedCash: 600, restoredGift: 100,
    })).toEqual({ cashAmount: 0, giftAmount: 300 });
  });

  it('rejects allocations that would exceed an original tender or remaining balance', () => {
    expect(() => allocateRefundTender({
      refundAmount: 1, cashPaid: 100, giftTender: 0, refundedCash: 101, restoredGift: 0,
    })).toThrow(RangeError);
    expect(() => allocateRefundTender({
      refundAmount: 101, cashPaid: 100, giftTender: 0, refundedCash: 0, restoredGift: 0,
    })).toThrow(RangeError);
  });
});
