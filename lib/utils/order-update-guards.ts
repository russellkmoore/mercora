/** Fields accepted by the generic order update endpoint. */
export const ORDER_METADATA_FIELDS = [
  'notes',
  'external_references',
  'extensions',
] as const;

/**
 * Extension keys whose value is used by a server-side authorization, money,
 * refund, or fulfillment decision. Generic metadata writers must never change
 * these values. Keep this list in sync with every server reader.
 */
export const SERVER_OWNED_ORDER_EXTENSION_KEYS = [
  'payment_intent_id',
  'email',
  'carrier',
  'trackingUrl',
  'tracking_url',
  'refunds',
  'refunds_version',
  'restockedLineKeys',
  'restockInflightLineKeys',
  'stripe_amount_refunded',
  'agent_id',
  'expected_shipping_cents',
  'expected_tax_cents',
  'checkout_subtotal',
  'checkout_catalog_subtotal',
  'checkout_discount',
  'checkout_merchandise_discount',
  'checkout_shipping',
  'checkout_shipping_before_discount',
  'checkout_shipping_discount',
  'checkout_tax',
  'checkout_tender',
  'checkout_tender_state',
  'checkout_total',
  'tax_source',
  'discount_codes',
  'coupon_reconciliation_codes',
  'finalized_at',
] as const;

const REJECTED_ORDER_FIELDS = new Set([
  'status',
  'payment_status',
  'customer_id',
  'total_amount',
  'currency_code',
  'items',
  'shipping_address',
  'billing_address',
  'shipping_method',
  'payment_method',
  'tracking_number',
  'shipped_at',
  'delivered_at',
  'trackingUrl',
  'tracking_url',
]);

export type GuardResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status: number };

export function validateOrderMetadataUpdate(
  body: Record<string, unknown>
): GuardResult<Record<string, unknown>> {
  for (const key of Object.keys(body)) {
    if (REJECTED_ORDER_FIELDS.has(key)) {
      return {
        ok: false,
        error: `\"${key}\" is server-owned and cannot be changed through the generic order update endpoint`,
        status: 400,
      };
    }
  }

  const unknown = Object.keys(body).filter(
    (key) => key !== 'orderId' && !(ORDER_METADATA_FIELDS as readonly string[]).includes(key)
  );
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Unsupported order update field(s): ${unknown.join(', ')}`,
      status: 400,
    };
  }

  const value = Object.fromEntries(
    ORDER_METADATA_FIELDS
      .filter((key) => body[key] !== undefined)
      .map((key) => [key, body[key]])
  );
  if (Object.keys(value).length === 0) {
    return {
      ok: false,
      error: `No updatable fields provided; accepted fields are ${ORDER_METADATA_FIELDS.join(', ')}`,
      status: 400,
    };
  }
  return { ok: true, value };
}

function parsePlainObject(value: unknown): GuardResult<Record<string, unknown>> {
  if (value === null || value === undefined || value === '') {
    return { ok: true, value: {} };
  }
  if (typeof value === 'string') {
    try {
      return parsePlainObject(JSON.parse(value));
    } catch {
      return { ok: false, error: 'Stored order metadata is corrupt', status: 422 };
    }
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Order metadata must be a JSON object', status: 400 };
  }
  return { ok: true, value: value as Record<string, unknown> };
}

function mergeGuardedObject(
  incoming: unknown,
  current: unknown,
  protectedKeys: readonly string[]
): GuardResult<Record<string, unknown>> {
  const stored = parsePlainObject(current);
  if (!stored.ok) {
    return {
      ok: false,
      error: 'Stored order metadata is corrupt; refusing an update that could discard server-owned values',
      status: 422,
    };
  }

  const overlay = parsePlainObject(incoming);
  if (!overlay.ok) return overlay;

  const clientValues = Object.fromEntries(
    Object.entries(overlay.value).filter(([key]) => !protectedKeys.includes(key))
  );
  const merged = { ...stored.value, ...clientValues };

  // PaymentIntent identity is immutable in both JSON columns. A client cannot
  // introduce it, remove it, or bind an order to a different payment.
  const storedPaymentIntentId = stored.value.payment_intent_id;
  if (typeof storedPaymentIntentId === 'string' && storedPaymentIntentId) {
    merged.payment_intent_id = storedPaymentIntentId;
  } else {
    delete merged.payment_intent_id;
  }
  return { ok: true, value: merged };
}

export function mergeOrderExtensions(
  incoming: unknown,
  current: unknown
): GuardResult<Record<string, unknown>> {
  return mergeGuardedObject(
    incoming,
    current,
    SERVER_OWNED_ORDER_EXTENSION_KEYS
  );
}

export function mergeOrderExternalReferences(
  incoming: unknown,
  current: unknown
): GuardResult<Record<string, unknown>> {
  return mergeGuardedObject(incoming, current, ['payment_intent_id']);
}
