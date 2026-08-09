import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "@/lib/types/order";

const mocks = vi.hoisted(() => ({
  listEvents: vi.fn(),
  getRegistry: vi.fn(),
}));

vi.mock("@/lib/fulfillment/service", () => ({
  listRecentTrackingEventSummaries: mocks.listEvents,
}));
vi.mock("@/lib/fulfillment/carrier-config", () => ({
  getCarrierRegistry: mocks.getRegistry,
}));

import { buildMcpOrderDelivery, describeOrderDelivery } from "@/lib/mcp/order-delivery";

const order = {
  id: "MCP-AGENT-1-ABCDEF12",
  status: "shipped",
  total_amount: { amount: 2_500, currency: "USD" },
  currency_code: "USD",
  items: [],
  payment_status: "paid",
  shipping_carrier: "ups",
  tracking_number: "1Z999",
  shipping_method: "standard",
  shipping_address: { line1: "1 Main", city: "Denver", region: "CO", country: "US" },
  created_at: "2026-08-01T00:00:00.000Z",
  shipped_at: "2026-08-02T00:00:00.000Z",
  delivered_at: undefined,
} as Order;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRegistry.mockReturnValue({
    definitions: [{
      code: "ups",
      label: "UPS",
      trackingUrl: (tracking: string) => `https://carrier.example/${tracking}`,
    }],
  });
  mocks.listEvents.mockResolvedValue([
    { id: "track", eventType: "tracking_updated", createdAt: "2026-08-03T00:00:00.000Z" },
    { id: "ship", eventType: "shipment_created", createdAt: "2026-08-02T00:00:00.000Z" },
  ]);
});

describe("MCP order delivery projection", () => {
  it("combines the runtime carrier projection with bounded real event history", async () => {
    const delivery = await buildMcpOrderDelivery(order);

    expect(mocks.listEvents).toHaveBeenCalledWith(order.id, 100);
    expect(delivery.shipment).toEqual({
      carrier: "ups",
      carrierLabel: "UPS",
      trackingNumber: "1Z999",
      trackingUrl: "https://carrier.example/1Z999",
    });
    expect(delivery.history).toEqual([
      {
        date: "2026-08-01T00:00:00.000Z",
        status: "order_confirmed",
        description: "Order received and processing",
      },
      {
        date: "2026-08-02T00:00:00.000Z",
        status: "shipped",
        description: "Package shipped",
      },
      {
        date: "2026-08-03T00:00:00.000Z",
        status: "tracking_updated",
        description: "Tracking information updated",
      },
    ]);
  });

  it("falls back to the real shipped marker for legacy rows and ignores bad event dates", async () => {
    mocks.listEvents.mockResolvedValue([
      { id: "bad", eventType: "tracking_updated", createdAt: "not-a-date" },
    ]);
    const delivery = await buildMcpOrderDelivery(order);
    expect(delivery.history.map(({ status }) => status)).toEqual([
      "order_confirmed",
      "shipped",
    ]);
  });

  it("describes terminal delivery states rather than promising a future estimate", () => {
    expect(describeOrderDelivery({ ...order, status: "delivered" })).toBe("Delivered");
    expect(describeOrderDelivery({ ...order, status: "cancelled" })).toBe("Cancelled");
    expect(describeOrderDelivery({ ...order, status: "refunded" })).toBe("Refunded");
  });
});
