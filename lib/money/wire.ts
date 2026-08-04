import { Money, type MachMoney } from './money';

/** Convert a persisted Mercora minor-unit value to the public MACH wire shape. */
export function toWireMoney(value: unknown, currency = 'USD'): MachMoney {
  return Money.fromStored(value, currency).toMach();
}
