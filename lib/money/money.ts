import Big from 'big.js';
import { getPrecision } from './currencies';

/** Decimal major-unit representation used only at MACH/HTTP boundaries. */
export interface MachMoney { amount: number; currency: string; precision: number; }
/** Integer minor-unit representation stored by Mercora. */
export interface StoredMoney { amount: number; currency: string; }

function assertSafeMinorUnits(amount: number): void {
  if (!Number.isSafeInteger(amount)) throw new RangeError(`Money minor units must be a safe integer, got ${amount}`);
}

function parseStoredAmount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) {
    throw new TypeError('Stored money amount must be an integer');
  }
  return Number(value);
}

function asSafeInteger(value: Big): number {
  const amount = Number(value.toFixed(0));
  assertSafeMinorUnits(amount);
  return amount;
}

/** Immutable, currency-aware monetary value held as integer minor units. */
export class Money {
  readonly #minor: number;
  readonly #currency: string;

  private constructor(minorUnits: number, currency: string) {
    assertSafeMinorUnits(minorUnits);
    if (!currency || typeof currency !== 'string') throw new TypeError('Money currency must be a non-empty ISO 4217 code');
    this.#minor = minorUnits;
    this.#currency = currency.toUpperCase();
  }

  static fromMinor(minorUnits: number, currency = 'USD'): Money { return new Money(minorUnits, currency); }

  /** Convert a decimal major-unit amount using explicit half-up rounding. */
  static fromMajor(major: number | string, currency = 'USD'): Money {
    if (typeof major === 'number' && !Number.isFinite(major)) throw new TypeError(`Money major amount must be finite, got ${major}`);
    const precision = getPrecision(currency);
    let minor: Big;
    try {
      minor = Big(major).times(Big(10).pow(precision)).round(0, Big.roundHalfUp);
    } catch (error) {
      throw new TypeError(`Money major amount is invalid: ${String(major)}`, { cause: error });
    }
    return new Money(asSafeInteger(minor), currency);
  }

  static zero(currency = 'USD'): Money { return new Money(0, currency); }

  /** Parse Mercora's persisted minor-unit shape, including legacy JSON columns. */
  static fromStored(value: unknown, defaultCurrency = 'USD'): Money {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('{')) {
        try { return Money.fromStored(JSON.parse(trimmed), defaultCurrency); }
        catch (error) { throw new TypeError('Stored money JSON is invalid', { cause: error }); }
      }
      return Money.fromMinor(parseStoredAmount(trimmed), defaultCurrency);
    }
    if (typeof value === 'number') return Money.fromMinor(value, defaultCurrency);
    if (value && typeof value === 'object' && 'amount' in value) {
      const stored = value as { amount: unknown; currency?: unknown };
      return Money.fromMinor(parseStoredAmount(stored.amount), typeof stored.currency === 'string' ? stored.currency : defaultCurrency);
    }
    throw new TypeError('Stored money must be a number or an { amount, currency } object');
  }

  #assertSameCurrency(other: Money): void {
    if (this.#currency !== other.#currency) throw new Error(`Currency mismatch: ${this.#currency} vs ${other.#currency}`);
  }
  add(other: Money): Money { this.#assertSameCurrency(other); return new Money(this.#minor + other.#minor, this.#currency); }
  subtract(other: Money): Money { this.#assertSameCurrency(other); return new Money(this.#minor - other.#minor, this.#currency); }
  negate(): Money { return new Money(-this.#minor, this.#currency); }
  times(quantity: number): Money {
    if (!Number.isSafeInteger(quantity)) throw new TypeError(`Money quantity must be a safe integer, got ${quantity}`);
    return new Money(this.#minor * quantity, this.#currency);
  }
  /** Apply a decimal rate and round the resulting minor units half-up. */
  applyRate(rate: number | string): Money {
    if (typeof rate === 'number' && !Number.isFinite(rate)) throw new TypeError(`Money rate must be finite, got ${rate}`);
    let minor: Big;
    try { minor = Big(this.#minor).times(rate).round(0, Big.roundHalfUp); }
    catch (error) { throw new TypeError(`Money rate is invalid: ${String(rate)}`, { cause: error }); }
    return new Money(asSafeInteger(minor), this.#currency);
  }
  equals(other: Money): boolean { return this.#currency === other.#currency && this.#minor === other.#minor; }
  gte(other: Money): boolean { this.#assertSameCurrency(other); return this.#minor >= other.#minor; }
  gt(other: Money): boolean { this.#assertSameCurrency(other); return this.#minor > other.#minor; }
  lte(other: Money): boolean { this.#assertSameCurrency(other); return this.#minor <= other.#minor; }
  lt(other: Money): boolean { this.#assertSameCurrency(other); return this.#minor < other.#minor; }
  isZero(): boolean { return this.#minor === 0; }
  isNegative(): boolean { return this.#minor < 0; }
  /** Serialize as decimal major units for MACH-compatible HTTP/MCP output. */
  toMach(): MachMoney {
    const precision = getPrecision(this.#currency);
    return { amount: Number(Big(this.#minor).div(Big(10).pow(precision)).toFixed(precision)), currency: this.#currency, precision };
  }
  format(locale = 'en-US'): string { return new Intl.NumberFormat(locale, { style: 'currency', currency: this.#currency }).format(this.toMach().amount); }
  get currency(): string { return this.#currency; }
  toMinorUnits(): number { return this.#minor; }
  toJSON(): StoredMoney { return { amount: this.#minor, currency: this.#currency }; }
}
