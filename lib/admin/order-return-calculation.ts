import { Money } from '@/lib/money';

interface ReturnItem {
  id?: string;
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
  allocationMethod: 'exact_snapshot' | 'legacy_proportional' | 'legacy_full_order';
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

interface ParsedLineAllocation {
  lineId: string;
  productId: string;
  variantId: string;
  quantity: number;
  catalogSubtotal: number;
  merchandiseDiscount: number;
  netMerchandise: number;
  tax: number;
}

function lineSelectionKey(item: ReturnItem): string {
  return item.id ?? `${item.product_id}-${item.variant_id || 'default'}`;
}

function exactAllocations(order: ReturnOrder): ParsedLineAllocation[] | null {
  const raw = order.extensions?.checkout_line_allocations;
  if (raw === undefined) return null;
  if (!Array.isArray(raw) || raw.length !== order.items.length) {
    throw new Error('Stored checkout line allocations are corrupt');
  }

  const seen = new Set<string>();
  const parsed = raw.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Stored checkout line allocations are corrupt');
    }
    const entry = value as Record<string, unknown>;
    if (
      typeof entry.lineId !== 'string' || !entry.lineId || seen.has(entry.lineId) ||
      typeof entry.productId !== 'string' || !entry.productId ||
      typeof entry.variantId !== 'string' || !entry.variantId ||
      !Number.isSafeInteger(entry.quantity) || Number(entry.quantity) <= 0
    ) {
      throw new Error('Stored checkout line allocations are corrupt');
    }
    seen.add(entry.lineId);
    const catalogSubtotal = storedMinor(entry.catalogSubtotal, order.currency_code);
    const merchandiseDiscount = storedMinor(entry.merchandiseDiscount, order.currency_code);
    const netMerchandise = storedMinor(entry.netMerchandise, order.currency_code);
    const tax = storedMinor(entry.tax, order.currency_code);
    if (
      catalogSubtotal < 0 || merchandiseDiscount < 0 || tax < 0 ||
      merchandiseDiscount > catalogSubtotal ||
      netMerchandise !== catalogSubtotal - merchandiseDiscount ||
      tax > netMerchandise
    ) {
      throw new Error('Stored checkout line allocations are corrupt');
    }
    return {
      lineId: entry.lineId,
      productId: entry.productId,
      variantId: entry.variantId,
      quantity: Number(entry.quantity),
      catalogSubtotal,
      merchandiseDiscount,
      netMerchandise,
      tax,
    };
  });

  const byId = new Map(parsed.map((allocation) => [allocation.lineId, allocation]));
  for (const item of order.items) {
    if (!item.id) throw new Error('Stored checkout line allocations do not match order lines');
    const allocation = byId.get(item.id);
    if (
      !allocation || allocation.productId !== item.product_id ||
      allocation.variantId !== item.variant_id || allocation.quantity !== item.quantity
    ) {
      throw new Error('Stored checkout line allocations do not match order lines');
    }
  }

  const extensions = order.extensions ?? {};
  const snapshotSubtotal = storedMinor(extensions.checkout_catalog_subtotal, order.currency_code);
  const snapshotDiscount = storedMinor(extensions.checkout_merchandise_discount, order.currency_code);
  const snapshotTax = storedMinor(extensions.checkout_tax, order.currency_code);
  const shippingTax = storedMinor(extensions.checkout_shipping_tax, order.currency_code);
  if (
    parsed.reduce((sum, line) => sum + line.catalogSubtotal, 0) !== snapshotSubtotal ||
    parsed.reduce((sum, line) => sum + line.merchandiseDiscount, 0) !== snapshotDiscount ||
    parsed.reduce((sum, line) => sum + line.tax, 0) + shippingTax !== snapshotTax
  ) {
    throw new Error('Stored checkout allocation totals are corrupt');
  }
  return parsed;
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
  const isFullReturn = order.items.length > 0 &&
    order.items.every((item) => selected.has(lineSelectionKey(item)));
  const returnShipping = (
    (isFullReturn && policy.refundShippingOnFullReturn) ||
    (!isFullReturn && policy.refundShipping)
  ) ? orderShipping : 0;
  const allocations = exactAllocations(order);
  let returnItemsSubtotal: number;
  let returnTax: number;
  let returnDiscount: number;
  let allocationMethod: ReturnCalculation['allocationMethod'];
  if (allocations) {
    const selectedAllocations = allocations.filter((line) => selected.has(line.lineId));
    returnItemsSubtotal = selectedAllocations.reduce((sum, line) => sum + line.catalogSubtotal, 0);
    returnDiscount = selectedAllocations.reduce(
      (sum, line) => sum + line.merchandiseDiscount,
      0
    );
    returnTax = selectedAllocations.reduce((sum, line) => sum + line.tax, 0) +
      (returnShipping > 0
        ? storedMinor(extensions.checkout_shipping_tax, order.currency_code)
        : 0);
    allocationMethod = 'exact_snapshot';
  } else {
    returnItemsSubtotal = order.items
      .filter((item) => selected.has(lineSelectionKey(item)))
      .reduce(
        (total, item) => total + wireMajorToMinor(item.unit_price, order.currency_code) * item.quantity,
        0
      );
    const subtotalRatio = orderSubtotal > 0 ? returnItemsSubtotal / orderSubtotal : 0;
    returnTax = isFullReturn ? orderTax : Math.round(orderTax * subtotalRatio);
    returnDiscount = isFullReturn ? orderDiscount : Math.round(orderDiscount * subtotalRatio);
    allocationMethod = isFullReturn ? 'legacy_full_order' : 'legacy_proportional';
  }
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
    allocationMethod,
    policy: {
      shippingRefunded: returnShipping > 0,
      restockingFeeApplied: restockingFee > 0,
      restockingFeePercent: policy.restockingFeePercent,
    },
  };
}
