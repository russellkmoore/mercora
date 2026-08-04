import { describe, expect, it } from 'vitest';

import { Money, toWireMoney } from '@/lib/money';

describe('Money', () => {
  it('stores integer minor units and serializes them stably for persistence', () => {
    const money = Money.fromMinor(2999, 'usd');

    expect(money.toMinorUnits()).toBe(2999);
    expect(money.currency).toBe('USD');
    expect(money.toJSON()).toEqual({ amount: 2999, currency: 'USD' });
    expect(Money.fromStored(JSON.stringify(money)).equals(money)).toBe(true);
  });

  it('rounds major units half-up at the currency precision', () => {
    expect(Money.fromMajor('1.005').toMinorUnits()).toBe(101);
    expect(Money.fromMajor('-1.005').toMinorUnits()).toBe(-101);
    expect(Money.fromMajor('12.3456', 'KWD').toMinorUnits()).toBe(12346);
    expect(Money.fromMajor('12.9', 'JPY').toMinorUnits()).toBe(13);
  });

  it('performs currency-safe arithmetic and comparisons', () => {
    const price = Money.fromMinor(1250);
    const discount = Money.fromMinor(125);

    expect(price.subtract(discount).times(2).toMinorUnits()).toBe(2250);
    expect(price.applyRate('0.0825').toMinorUnits()).toBe(103);
    expect(price.gte(discount)).toBe(true);
    expect(price.equals(Money.fromMinor(1250))).toBe(true);
    expect(Money.zero().isZero()).toBe(true);
    expect(Money.fromMinor(-1).isNegative()).toBe(true);
  });

  it('rejects mixed currencies and unsafe representations', () => {
    const usd = Money.fromMinor(100, 'USD');
    const eur = Money.fromMinor(100, 'EUR');

    expect(() => usd.add(eur)).toThrow('Currency mismatch');
    expect(() => usd.gte(eur)).toThrow('Currency mismatch');
    expect(() => Money.fromMinor(1.5)).toThrow('safe integer');
    expect(() => Money.fromMinor(Number.MAX_SAFE_INTEGER + 1)).toThrow('safe integer');
    expect(() => Money.fromStored({ amount: 'not-a-number', currency: 'USD' })).toThrow('safe integer');
    expect(() => Money.fromMajor('90071992547410')).toThrow('safe integer');
  });

  it('uses decimal major units only at MACH wire boundaries', () => {
    expect(toWireMoney({ amount: 2999, currency: 'usd' })).toEqual({
      amount: 29.99,
      currency: 'USD',
      precision: 2,
    });
    expect(toWireMoney({ amount: 101, currency: 'JPY' })).toEqual({
      amount: 101,
      currency: 'JPY',
      precision: 0,
    });
  });
});
