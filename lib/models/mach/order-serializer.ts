import type { MachMoney } from '@/lib/money';
import { toWireMoney } from '@/lib/money';
import type { Order } from '@/lib/types/order';

type WireOrderItem = Omit<Order['items'][number], 'unit_price' | 'total_price'> & {
  unit_price: MachMoney;
  total_price: MachMoney;
};

export type WireOrder = Omit<Order, 'total_amount' | 'items'> & {
  total_amount: MachMoney;
  items: WireOrderItem[];
};

/** Serialize an authenticated admin/service order with full metadata. */
export function toAdminOrder(order: Order): WireOrder {
  return {
    ...order,
    total_amount: toWireMoney(order.total_amount),
    items: order.items.map((item) => ({
      ...item,
      unit_price: toWireMoney(item.unit_price),
      total_price: toWireMoney(item.total_price),
    })),
  };
}

/**
 * Customer projection. Ownership authorizes receipt data, not payment/refund/
 * fulfillment bindings or opaque capability state.
 */
export function toCustomerOrder(order: Order): WireOrder {
  const admin = toAdminOrder(order);
  const {
    external_references: _externalReferences,
    extensions: _extensions,
    notes: _notes,
    ...customer
  } = admin;
  return customer;
}
