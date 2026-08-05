import { Money } from '@/lib/money';

/** Admin order API values are public MACH decimal-major amounts. */
export function formatMachMajorCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

/** Protected order extension values retain Mercora's stored minor-unit shape. */
export function formatStoredOrderCurrency(value: unknown, currency = 'USD'): string {
  return Money.fromStored(value, currency).format();
}

/** Historical extensions.shipping_cost values were stored as decimal-major amounts. */
export function formatLegacyShippingCostCurrency(value: number, currency = 'USD'): string {
  return Money.fromMajor(value, currency).format();
}
