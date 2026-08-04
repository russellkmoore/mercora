import type { StoredMoney } from '@/lib/money';

export type ShippingOption = {
  id: string;
  label: string;
  /** Persisted minor-unit price, not a decimal display value. */
  cost: StoredMoney;
  estimatedDays: number;
};
