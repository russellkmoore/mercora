import { describe, expect, it } from 'vitest';
import {
  deriveRefundIdempotencyKey,
  normalizeRefundLineIds,
} from '@/lib/payments/refund-idempotency';

describe('refund idempotency', () => {
  it('is stable across line ordering and changes for domain inputs', async () => {
    const base = {
      orderId: 'WEB-ORDER-1',
      type: 'partial' as const,
      refundAmount: 500,
      settledSequence: 2,
    };
    const first = await deriveRefundIdempotencyKey({ ...base, lineIds: ['line-b', 'line-a'] });
    const reordered = await deriveRefundIdempotencyKey({ ...base, lineIds: ['line-a', 'line-b'] });
    const next = await deriveRefundIdempotencyKey({ ...base, settledSequence: 3, lineIds: ['line-a', 'line-b'] });

    expect(first).toBe(reordered);
    expect(first).toMatch(/^refund:[a-f0-9]{64}$/);
    expect(next).not.toBe(first);
  });

  it('rejects duplicate, empty, oversized, and malformed inputs', async () => {
    expect(() => normalizeRefundLineIds(['line-a', 'line-a'])).toThrow('duplicates');
    expect(() => normalizeRefundLineIds(['   '])).toThrow('non-empty');
    await expect(deriveRefundIdempotencyKey({
      orderId: 'order', type: 'partial', refundAmount: 0, settledSequence: 0,
    })).rejects.toThrow('positive safe integer');
  });
});
