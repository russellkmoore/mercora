import { describe, expect, it } from 'vitest';
import {
  formatMachMajorCurrency,
  formatStoredOrderCurrency,
} from '@/lib/admin/order-money';

describe('admin order money formatting', () => {
  it('formats API MACH amounts as major units without dividing by 100', () => {
    expect(formatMachMajorCurrency(12.34)).toBe('$12.34');
  });

  it('formats protected extension values from stored minor units', () => {
    expect(formatStoredOrderCurrency({ amount: 1_234, currency: 'USD' })).toBe('$12.34');
  });
});
