import { Money } from '@/lib/money';

interface ReturnItem {
  product_id: string;
  variant_id?: string;
  quantity: number;
  /** Admin order API wire value: MACH decimal-major amount. */
  unit_price: number | { amount: number; currency?: string };
}

interface ReturnOrder {
  currency_code: string;
  items: ReturnItem[];
  extensions?: Record<string, unknown>;
}

interface ReturnPolicy {
  refundShipping: boolean;
  refundShippingOnFullReturn: boolean;
  restockingFeePercent: number;
  applyRestockingFeeOnPartialReturn: boolean;
}

export interface ReturnCalculation {
  subtotal: number;
  tax: number;
  discount: number;
  shipping: number;
  restockingFee: number;
  baseAmount: number;
  total: number;
  policy: {
    shippingRefunded: boolean;
    restockingFeeApplied: boolean;
    restockingFeePercent: number;
  };
}

function wireMajorToMinor(value: ReturnItem['unit_price'], currency: string): number {
  const amount = typeof value === 'number' ? value : value.amount;
  const valueCurrency = typeof value === 'object' ? value.currency ?? currency : currency;
  return Money.fromMajor(amount, valueCurrency).toMinorUnits();
}

function storedMinor(value: unknown, currency: string): number {
  return value === undefined || value === null
    ? 0
    : Money.fromStored(value, currency).toMinorUnits();
}

/** Calculate a partial return entirely in integer minor units. */
export function calculatePartialReturnMinor(
  order: ReturnOrder,
  selectedItemIds: string[],
  policy: ReturnPolicy
): ReturnCalculation {
  const extensions = order.extensions ?? {};
  const calculatedOrderSubtotal = order.items.reduce(
    (total, item) => total + wireMajorToMinor(item.unit_price, order.currency_code) * item.quantity,
    0
  );

  // New checkout keys are protected persisted minor-unit values. Legacy
  // subtotal/tax/discount fields were also stored as cents.
  const configuredSubtotal = storedMinor(
    extensions.checkout_catalog_subtotal ?? extensions.subtotal,
    order.currency_code
  );
  const orderSubtotal = configuredSubtotal > 0 ? configuredSubtotal : calculatedOrderSubtotal;
  const orderTax = storedMinor(
    extensions.checkout_tax ?? extensions.tax_amount ?? extensions.taxAmount,
    order.currency_code
  );
  const orderDiscount = storedMinor(
    extensions.checkout_merchandise_discount ?? extensions.discount_amount ??
      extensions.discountAmount ?? extensions.discount ?? extensions.promotion_discount,
    order.currency_code
  );

  let orderShipping: number;
  if (extensions.checkout_shipping_before_discount !== undefined) {
    orderShipping = Math.max(0,
      storedMinor(extensions.checkout_shipping_before_discount, order.currency_code) -
      storedMinor(extensions.checkout_shipping_discount, order.currency_code)
    );
  } else if (extensions.checkout_shipping !== undefined) {
    orderShipping = storedMinor(extensions.checkout_shipping, order.currency_code);
  } else if (typeof extensions.shipping_cost === 'number') {
    // Historical shipping_cost was decimal-major dollars.
    orderShipping = Money.fromMajor(extensions.shipping_cost, order.currency_code).toMinorUnits();
  } else {
    // Historical shippingCost followed the stored minor-unit convention.
    orderShipping = storedMinor(extensions.shippingCost, order.currency_code);
  }

  const selected = new Set(selectedItemIds);
  const returnItemsSubtotal = order.items
    .filter((item) => selected.has(`${item.product_id}-${item.variant_id || 'default'}`))
    .reduce(
      (total, item) => total + wireMajorToMinor(item.unit_price, order.currency_code) * item.quantity,
      0
    );
  const subtotalRatio = orderSubtotal > 0 ? returnItemsSubtotal / orderSubtotal : 0;
  const returnTax = Math.round(orderTax * subtotalRatio);
  const returnDiscount = Math.round(orderDiscount * subtotalRatio);
  const isFullReturn = selectedItemIds.length === order.items.length;
  const returnShipping = (
    (isFullReturn && policy.refundShippingOnFullReturn) ||
    (!isFullReturn && policy.refundShipping)
  ) ? orderShipping : 0;
  const baseAmount = returnItemsSubtotal + returnTax - returnDiscount + returnShipping;
  const restockingFee = (
    (isFullReturn || policy.applyRestockingFeeOnPartialReturn) &&
    policy.restockingFeePercent > 0
  ) ? Math.round(baseAmount * (policy.restockingFeePercent / 100)) : 0;

  return {
    subtotal: returnItemsSubtotal,
    tax: returnTax,
    discount: returnDiscount,
    shipping: returnShipping,
    restockingFee,
    baseAmount,
    total: Math.max(0, baseAmount - restockingFee),
    policy: {
      shippingRefunded: returnShipping > 0,
      restockingFeeApplied: restockingFee > 0,
      restockingFeePercent: policy.restockingFeePercent,
    },
  };
}
