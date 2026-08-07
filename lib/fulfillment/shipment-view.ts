import { buildTrackingUrl, normalizeLegacyCarrier, sanitizeTrackingNumber } from "./tracking";
import {
  DEFAULT_CARRIER_REGISTRY,
  type Carrier,
  type CarrierRegistry,
} from "./types";

export interface ShipmentView {
  carrier: Carrier | null;
  carrierLabel: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}

/**
 * Build the customer-safe shipment projection from server-owned columns only.
 * Stored extension URLs are never read; the carrier URL is always derived.
 */
export function buildShipmentView(order: {
  shipping_carrier?: string | null;
  tracking_number?: string | null;
}, registry: CarrierRegistry = DEFAULT_CARRIER_REGISTRY): ShipmentView {
  const carrier = normalizeLegacyCarrier(order.shipping_carrier ?? null, registry);
  const trackingNumber = sanitizeTrackingNumber(order.tracking_number ?? null);
  const definition = carrier
    ? registry.definitions.find(({ code }) => code.trim().toLowerCase() === carrier)
    : undefined;
  return {
    carrier,
    carrierLabel: definition?.label ?? null,
    trackingNumber,
    trackingUrl: buildTrackingUrl(carrier, trackingNumber, registry),
  };
}
