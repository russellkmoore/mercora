import { getCarrierRegistry } from "@/lib/fulfillment/carrier-config";
import {
  listRecentTrackingEventSummaries,
  type TrackingEventSummary,
} from "@/lib/fulfillment/service";
import { buildShipmentView, type ShipmentView } from "@/lib/fulfillment/shipment-view";
import type { Order } from "@/lib/types/order";
import type { MCPTrackingEvent } from "./types";

export interface McpOrderDelivery {
  shipment: ShipmentView;
  history: MCPTrackingEvent[];
  estimatedDelivery: string;
}

function canonicalTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

/** Human-readable delivery state derived only from persisted order fields. */
export function describeOrderDelivery(order: Pick<
  Order,
  "status" | "shipping_address" | "shipping_method"
>): string {
  if (order.status === "delivered") return "Delivered";
  if (order.status === "cancelled") return "Cancelled";
  if (order.status === "refunded") return "Refunded";
  if (order.shipping_method === "expedited" || order.shipping_method === "overnight") {
    return "1-2 business days";
  }
  if (order.shipping_address?.region === "AK" || order.shipping_address?.region === "HI") {
    return "5-7 business days";
  }
  return "3-5 business days";
}

function eventHistory(
  order: Order,
  events: readonly TrackingEventSummary[],
): MCPTrackingEvent[] {
  const history: MCPTrackingEvent[] = [];
  const createdAt = canonicalTimestamp(order.created_at);
  if (createdAt) {
    history.push({
      date: createdAt,
      status: "order_confirmed",
      description: "Order received and processing",
    });
  }

  let hasShipmentEvent = false;
  for (const event of [...events].reverse()) {
    const createdAt = canonicalTimestamp(event.createdAt);
    if (!createdAt) continue;
    if (event.eventType === "shipment_created") {
      hasShipmentEvent = true;
      history.push({
        date: createdAt,
        status: "shipped",
        description: "Package shipped",
      });
    } else {
      history.push({
        date: createdAt,
        status: "tracking_updated",
        description: "Tracking information updated",
      });
    }
  }

  // Legacy shipped orders may predate the audit table. Keep their real marker
  // visible without inventing a fulfillment event.
  const shippedAt = canonicalTimestamp(order.shipped_at);
  if (!hasShipmentEvent && shippedAt) {
    history.push({
      date: shippedAt,
      status: "shipped",
      description: "Package shipped",
    });
  }
  const deliveredAt = canonicalTimestamp(order.delivered_at);
  if (deliveredAt) {
    history.push({
      date: deliveredAt,
      status: "delivered",
      description: "Package delivered",
    });
  }

  return history.sort((left, right) => left.date.localeCompare(right.date));
}

/** Build one bounded, customer-safe MCP delivery projection for an owned order. */
export async function buildMcpOrderDelivery(order: Order): Promise<McpOrderDelivery> {
  const events = await listRecentTrackingEventSummaries(order.id!, 100);
  return {
    shipment: buildShipmentView(order, getCarrierRegistry()),
    history: eventHistory(order, events),
    estimatedDelivery: describeOrderDelivery(order),
  };
}
