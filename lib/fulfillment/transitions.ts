import {
  CARRIERS,
  DEFAULT_CARRIER_REGISTRY,
  type CarrierRegistry,
  type ShipmentInput,
} from "./types";
import {
  MAX_TRACKING_LENGTH,
  normalizeCarrier,
  normalizeLegacyCarrier,
  sanitizeTrackingNumber,
  validateTrackingNumber,
} from "./tracking";

/** The only order fields consulted by the pure transition rules. */
export interface OrderFulfillmentSnapshot {
  status: string;
  payment_status: string | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
  /** True while a refund has been accepted but has not settled. */
  refund_pending: boolean;
}

function isSupplied(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return typeof value !== "string" || value.trim() !== "";
}

export function parseShipmentInput(
  body: unknown,
  registry: CarrierRegistry = DEFAULT_CARRIER_REGISTRY,
): { ok: true; input: ShipmentInput } | { ok: false; error: string } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const raw = body as Record<string, unknown>;
  const hasCarrier = isSupplied(raw.carrier);
  const hasTracking = isSupplied(raw.trackingNumber);

  if (!hasCarrier && !hasTracking) {
    return { ok: true, input: { carrier: null, trackingNumber: null } };
  }
  if (!hasCarrier) return { ok: false, error: "trackingNumber requires a carrier" };
  if (!hasTracking) return { ok: false, error: "carrier requires a trackingNumber" };

  const carrier = normalizeCarrier(raw.carrier, registry);
  if (!carrier) {
    const expected = registry === DEFAULT_CARRIER_REGISTRY
      ? CARRIERS
      : registry.definitions.map(({ code }) => code);
    return { ok: false, error: `Unknown carrier; expected one of: ${expected.join(", ")}` };
  }

  const trackingNumber = validateTrackingNumber(raw.trackingNumber);
  if (!trackingNumber) {
    return {
      ok: false,
      error: `Invalid trackingNumber (must be exactly 1-${MAX_TRACKING_LENGTH} ASCII alphanumeric/hyphen characters with no surrounding spaces)`,
    };
  }

  return { ok: true, input: { carrier, trackingNumber } };
}

export function shipmentDataEqual(a: ShipmentInput, b: ShipmentInput): boolean {
  if (a.carrier !== b.carrier) return false;
  const left = a.trackingNumber?.toUpperCase() ?? null;
  const right = b.trackingNumber?.toUpperCase() ?? null;
  return left === right;
}

export type ShipDecision =
  | { kind: "ship" }
  | { kind: "idempotent" }
  | { kind: "conflict" }
  | {
      kind: "not_fulfillable";
      status: string;
      paymentStatus: string | null;
      refundPending?: true;
    };

export function decideShipment(
  order: OrderFulfillmentSnapshot,
  input: ShipmentInput,
  registry: CarrierRegistry = DEFAULT_CARRIER_REGISTRY,
): ShipDecision {
  if (order.status === "shipped") {
    const stored: ShipmentInput = {
      carrier: normalizeLegacyCarrier(order.shipping_carrier, registry),
      trackingNumber: sanitizeTrackingNumber(order.tracking_number),
    };
    return shipmentDataEqual(stored, input) ? { kind: "idempotent" } : { kind: "conflict" };
  }

  if (order.refund_pending) {
    return {
      kind: "not_fulfillable",
      status: order.status,
      paymentStatus: order.payment_status,
      refundPending: true,
    };
  }

  if (order.status === "processing" && order.payment_status === "paid") {
    return { kind: "ship" };
  }

  return {
    kind: "not_fulfillable",
    status: order.status,
    paymentStatus: order.payment_status,
  };
}

export function canEditTracking(order: OrderFulfillmentSnapshot): boolean {
  return order.status === "shipped";
}
