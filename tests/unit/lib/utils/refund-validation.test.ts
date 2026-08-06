import { describe, expect, it } from 'vitest';
import {
  assertRefundWithinRemaining,
  classifyRefundStatus,
  computeRefundedTotal,
  hasPendingRefund,
  resolveFullRefundAmount,
} from '@/lib/utils/refund-validation';

describe('refund validation', () => {
  it('classifies current and legacy lifecycle states', () => {
    expect(classifyRefundStatus(undefined)).toBe('legacy');
    expect(classifyRefundStatus('pending')).toBe('reserved');
    expect(classifyRefundStatus('requires_action')).toBe('reserved');
    expect(classifyRefundStatus('succeeded')).toBe('settled');
    expect(classifyRefundStatus('failed')).toBe('released');
    expect(classifyRefundStatus('canceled')).toBe('released');
    expect(classifyRefundStatus('mystery')).toBe('unknown');
  });

  it('counts reserved, settled, and legacy entries but releases failures', () => {
    expect(computeRefundedTotal({ refunds: [
      { amount: 100, status: 'pending' },
      { amount: 200, status: 'requires_action' },
      { amount: 300, status: 'succeeded' },
      { amount: 400 },
      { amount: 500, status: 'failed' },
      { amount: 600, status: 'canceled' },
    ] })).toBe(1_000);
  });

  it('fails closed for malformed, oversized, or overflowing ledgers', () => {
    expect(computeRefundedTotal({ refunds: [{ amount: '100' }] })).toBe(Number.MAX_SAFE_INTEGER);
    expect(computeRefundedTotal({ refunds: [{ amount: 100, status: 'mystery' }] }))
      .toBe(Number.MAX_SAFE_INTEGER);
    expect(computeRefundedTotal({ refunds: [
      { amount: Number.MAX_SAFE_INTEGER },
      { amount: 1 },
    ] })).toBe(Number.MAX_SAFE_INTEGER);
    expect(computeRefundedTotal({ refunds: Array.from({ length: 101 }, () => ({ amount: 1 })) }))
      .toBe(Number.MAX_SAFE_INTEGER);
  });

  it('detects unsettled refunds and enforces cumulative safe-integer amounts', () => {
    expect(hasPendingRefund({ refunds: [{ amount: 1, status: 'requires_action' }] })).toBe(true);
    expect(assertRefundWithinRemaining(1_000, 400, 600)).toEqual({ ok: true });
    expect(assertRefundWithinRemaining(1_000, 400, 601)).toMatchObject({ ok: false });
    expect(assertRefundWithinRemaining(1_000, 0, 1.5)).toMatchObject({ ok: false });
  });

  it('defines full as exactly the remaining refundable amount', () => {
    expect(resolveFullRefundAmount(1_000, 350)).toEqual({ ok: true, amount: 650 });
    expect(resolveFullRefundAmount(1_000, 1_000)).toMatchObject({ ok: false });
  });
});
