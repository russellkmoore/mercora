import type { MACHAddress as Address } from '@/lib/types/mach/Address';
import { Money } from '@/lib/money';

const TAX_RATES: Record<string, number> = { CA: 0.0875, NY: 0.08, TX: 0.0625, FL: 0.06 };

/** Pure minor-unit order math shared by non-authoritative MCP projections. */
export function calculateShipping(address: Address, subtotal: Money): Money {
  if (subtotal.gte(Money.fromMajor(100, subtotal.currency))) return Money.zero(subtotal.currency);
  return Money.fromMajor(address?.region === 'AK' || address?.region === 'HI' ? 19.99 : 9.99, subtotal.currency);
}

export function calculateTax(subtotal: Money, address: Address): Money {
  return subtotal.applyRate(TAX_RATES[address?.region ?? ''] ?? 0.05);
}

export function computeOrderTotals(subtotal: Money, address: Address) {
  const shipping = calculateShipping(address, subtotal);
  const tax = calculateTax(subtotal, address);
  return { subtotal, shipping, tax, total: subtotal.add(shipping).add(tax) };
}
