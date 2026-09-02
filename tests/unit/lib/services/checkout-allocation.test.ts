import { describe, expect, it } from 'vitest';
import { allocateDiscount, allocateLargestRemainder } from '@/lib/services/checkout-pricing';
import { Money } from '@/lib/money';

function uniformWeights(n: number): number[] {
  return Array.from({ length: n }, () => 1);
}
function ascendingWeights(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}
/** Deliberately not evenly divisible into any of this file's totals, to force a non-zero remainder. */
function awkwardWeights(n: number): number[] {
  return Array.from({ length: n }, (_, i) => 7 + (i % 5) * 3);
}

function sumMinor(parts: Money[]): number {
  return parts.reduce((sum, part) => sum + part.toMinorUnits(), 0);
}
function zeroExisting(n: number): Money[] {
  return Array.from({ length: n }, () => Money.zero('USD'));
}

interface WeightTableCase {
  lines: number;
  weights: number[];
  totals: number[];
}

// Fixed weight tables at 1, 2, 10, and 100 lines: uniform, ascending, and an
// awkward set that forces a non-zero remainder — with at least two totals each.
const CASES: WeightTableCase[] = [
  { lines: 1, weights: uniformWeights(1), totals: [0, 100] },
  { lines: 1, weights: ascendingWeights(1), totals: [1, 999] },
  { lines: 1, weights: awkwardWeights(1), totals: [50, 12345] },
  { lines: 2, weights: uniformWeights(2), totals: [100, 101] },
  { lines: 2, weights: ascendingWeights(2), totals: [10, 99] },
  { lines: 2, weights: awkwardWeights(2), totals: [7, 1000] },
  { lines: 10, weights: uniformWeights(10), totals: [100, 1000] },
  { lines: 10, weights: ascendingWeights(10), totals: [55, 1234] },
  { lines: 10, weights: awkwardWeights(10), totals: [999, 100000] },
  { lines: 100, weights: uniformWeights(100), totals: [1000, 999999] },
  { lines: 100, weights: ascendingWeights(100), totals: [5050, 123456] },
  { lines: 100, weights: awkwardWeights(100), totals: [12345, 999983] },
];

const FLAT_CASES = CASES.flatMap(({ lines, weights, totals }) =>
  totals.map((total) => ({ lines, weights, total }))
);

describe('allocateLargestRemainder', () => {
  describe('sum exactness across fixed weight tables at 1, 2, 10, and 100 lines', () => {
    it.each(FLAT_CASES)(
      'sums exactly to $total across $lines lines',
      ({ weights, total }) => {
        const parts = allocateLargestRemainder(total, weights);
        expect(parts.length).toBe(weights.length);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      }
    );
  });

  describe('penny edge cases', () => {
    it.each([
      { total: 1, weights: uniformWeights(2) },
      { total: 1, weights: uniformWeights(100) },
      { total: 99, weights: uniformWeights(100) },
      { total: 3, weights: uniformWeights(10) },
    ])('sums exactly for total $total across $weights.length lines with safe-integer parts', ({ total, weights }) => {
      const parts = allocateLargestRemainder(total, weights);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      for (const part of parts) {
        expect(Number.isSafeInteger(part)).toBe(true);
        expect(part).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it('allocates zero to a zero-weight line and still sums exactly', () => {
    const weights = [0, 5, 0, 3];
    const parts = allocateLargestRemainder(97, weights);
    expect(parts[0]).toBe(0);
    expect(parts[2]).toBe(0);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(97);
  });

  it('gives the entire total to a single line', () => {
    expect(allocateLargestRemainder(4321, [7])).toEqual([4321]);
  });

  it('returns all zeros for a total of zero with non-zero weights', () => {
    expect(allocateLargestRemainder(0, [1, 2, 3])).toEqual([0, 0, 0]);
  });

  describe('guards', () => {
    it('throws for a non-integer total', () => {
      expect(() => allocateLargestRemainder(1.5, [1, 1])).toThrow();
    });

    it('throws for a negative total', () => {
      expect(() => allocateLargestRemainder(-1, [1, 1])).toThrow();
    });

    it('throws for a non-integer weight', () => {
      expect(() => allocateLargestRemainder(10, [1.5, 1])).toThrow();
    });

    it('throws for a negative weight', () => {
      expect(() => allocateLargestRemainder(10, [-1, 1])).toThrow();
    });

    it('throws when the weight total is zero but the total is non-zero', () => {
      expect(() => allocateLargestRemainder(10, [0, 0])).toThrow();
    });

    it('returns zeros of the right length when both the weight total and the total are zero', () => {
      expect(allocateLargestRemainder(0, [0, 0, 0])).toEqual([0, 0, 0]);
    });
  });

  it('breaks ties by ascending input index and is deterministic across runs', () => {
    const weights = [5, 5, 5];
    const total = 7;
    const first = allocateLargestRemainder(total, weights);
    const second = allocateLargestRemainder(total, weights);
    expect(first).toEqual([3, 2, 2]);
    expect(second).toEqual(first);
  });
});

describe('allocateDiscount', () => {
  describe('sum exactness at 1, 2, 10, and 100 lines', () => {
    it.each([1, 2, 10, 100])('sums exactly to the applied amount across %i lines', (n) => {
      const lineTotals = Array.from({ length: n }, (_, i) => Money.fromMinor(100 + i, 'USD'));
      const existing = zeroExisting(n);
      const eligible = Array.from({ length: n }, (_, i) => i);
      const amount = Money.fromMinor(50, 'USD');

      allocateDiscount(amount, eligible, lineTotals, existing);

      const availableTotal = eligible.reduce((sum, i) => sum + lineTotals[i].toMinorUnits(), 0);
      const applied = Math.min(amount.toMinorUnits(), availableTotal);
      expect(sumMinor(existing)).toBe(applied);
    });
  });

  it('clamps the applied amount to the available total when amount exceeds it', () => {
    const lineTotals = [Money.fromMinor(30, 'USD'), Money.fromMinor(20, 'USD')];
    const existing = zeroExisting(2);
    allocateDiscount(Money.fromMinor(1000, 'USD'), [0, 1], lineTotals, existing);
    expect(sumMinor(existing)).toBe(50);
  });

  it('mutates nothing for a zero amount', () => {
    const lineTotals = [Money.fromMinor(30, 'USD'), Money.fromMinor(20, 'USD')];
    const existing = zeroExisting(2);
    allocateDiscount(Money.zero('USD'), [0, 1], lineTotals, existing);
    expect(sumMinor(existing)).toBe(0);
  });

  it('reduces the available total and the applied sum when existing already carries prior discounts', () => {
    const lineTotals = [Money.fromMinor(100, 'USD'), Money.fromMinor(100, 'USD')];
    const existing = [Money.fromMinor(80, 'USD'), Money.zero('USD')];
    // available = (100-80) + (100-0) = 120; applied = min(1000, 120) = 120,
    // and the prior 80 on line 0 survives untouched inside the sum.
    allocateDiscount(Money.fromMinor(1000, 'USD'), [0, 1], lineTotals, existing);
    expect(sumMinor(existing)).toBe(200);
  });

  it('leaves ineligible existing entries untouched and lets eligible lines absorb the whole applied amount', () => {
    const lineTotals = [
      Money.fromMinor(100, 'USD'),
      Money.fromMinor(50, 'USD'),
      Money.fromMinor(50, 'USD'),
    ];
    const existing = zeroExisting(3);
    allocateDiscount(Money.fromMinor(40, 'USD'), [0, 2], lineTotals, existing);
    expect(existing[1].toMinorUnits()).toBe(0);
    expect(existing[0].toMinorUnits() + existing[2].toMinorUnits()).toBe(40);
  });

  it('does not mutate lineTotals or eligible, only existing', () => {
    const lineTotals = [Money.fromMinor(100, 'USD'), Money.fromMinor(50, 'USD')];
    const lineTotalsSnapshot = lineTotals.map((m) => m.toMinorUnits());
    const eligible = [0, 1];
    const eligibleSnapshot = [...eligible];
    const existing = zeroExisting(2);

    allocateDiscount(Money.fromMinor(30, 'USD'), eligible, lineTotals, existing);

    expect(lineTotals.map((m) => m.toMinorUnits())).toEqual(lineTotalsSnapshot);
    expect(eligible).toEqual(eligibleSnapshot);
  });
});
