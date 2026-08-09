import { buildShipmentView } from "@/lib/fulfillment/shipment-view";
import {
  DEFAULT_CARRIER_REGISTRY,
  type CarrierRegistry,
} from "@/lib/fulfillment/types";

export interface GuestOrderProjectionItem {
  name: string;
  quantity: number;
}

/** The complete allowlist for the bearer-token guest status page. */
export interface GuestOrderProjection {
  orderNumber: string;
  placedAt: string | null;
  status: string;
  shippedAt: string | null;
  carrier: string | null;
  carrierLabel: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: GuestOrderProjectionItem[];
}

export interface GuestProjectionOrder {
  id?: string | null;
  created_at?: string | null;
  status: string;
  shipped_at?: string | null;
  shipping_carrier?: string | null;
  tracking_number?: string | null;
  items?: Array<{ product_name?: string; quantity?: number }> | null;
}

/**
 * Project an order into a fresh, minimal object before it reaches a guest page.
 * Financial, address, payment, customer, note, extension, and audit fields are
 * intentionally absent. Shipment values are derived only by the central safe
 * builder; stored extension URLs are never trusted.
 */
export function buildGuestOrderProjection(
  order: GuestProjectionOrder,
  registry: CarrierRegistry = DEFAULT_CARRIER_REGISTRY,
): GuestOrderProjection {
  const shipment = buildShipmentView(order, registry);
  const items = Array.isArray(order.items) ? order.items : [];

  return {
    orderNumber: order.id ?? "",
    placedAt: order.created_at ?? null,
    status: order.status,
    shippedAt: order.shipped_at ?? null,
    carrier: shipment.carrier,
    carrierLabel: shipment.carrierLabel,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
    items: items.map((item) => ({
      name: typeof item?.product_name === "string" ? item.product_name : "Item",
      quantity: typeof item?.quantity === "number" ? item.quantity : 1,
    })),
  };
}
