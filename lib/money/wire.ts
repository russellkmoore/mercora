import { Money, type MachMoney } from './money';

/** Convert a persisted Mercora minor-unit value to the public MACH wire shape. */
export function toWireMoney(value: unknown, currency = 'USD'): MachMoney {
  return Money.fromStored(value, currency).toMach();
}

/**
 * Convert a public MACH wire value back to Money.
 *
 * Wire amounts are decimal major units, so reading one with `Money.fromMinor`
 * throws on any price with cents. Clients consuming an API response must come
 * back through here rather than through the stored-value constructors.
 *
 * Returns zero for an absent or malformed value: a price that cannot be parsed
 * should not take down the tree that renders it.
 */
export function fromWireMoney(value: unknown, currency = 'USD'): Money {
  if (!value || typeof value !== 'object') return Money.zero(currency);
  const { amount, currency: valueCurrency } = value as { amount?: unknown; currency?: unknown };
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return Money.zero(currency);
  return Money.fromMajor(amount, typeof valueCurrency === 'string' ? valueCurrency : currency);
}
