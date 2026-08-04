import { Money, type StoredMoney } from './money';
import type { CartItem } from '@/lib/types/cartitem';

export function cartItemTotal(item: CartItem): Money {
  return Money.fromStored(item.price).times(item.quantity);
}

export function cartSubtotal(items: CartItem[], currency?: string): Money {
  const resolvedCurrency = currency ?? (items[0] ? Money.fromStored(items[0].price).currency : 'USD');
  return items.reduce((total, item) => total.add(cartItemTotal(item)), Money.zero(resolvedCurrency));
}

export function storedMoney(value: Money): StoredMoney {
  return value.toJSON();
}
