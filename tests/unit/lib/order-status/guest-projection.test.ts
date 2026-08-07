import { describe, expect, it } from "vitest";
import { buildGuestOrderProjection } from "@/lib/order-status/guest-projection";

const fullOrder = {
  id: "ORD-GUEST-1",
  customer_id: null,
  status: "shipped",
  payment_status: "paid",
  payment_method: "stripe",
  total_amount: { amount: 4200, currency: "USD" },
  currency_code: "USD",
  shipping_address: { line1: "1 Secret St", email: "guest@example.com" },
  billing_address: { line1: "1 Secret St" },
  items: [
    {
      product_id: "p1",
      sku: "SECRET-SKU",
      product_name: "Morning Blend",
      quantity: 2,
      unit_price: { amount: 2100, currency: "USD" },
      total_price: { amount: 4200, currency: "USD" },
    },
  ],
  notes: "INTERNAL: refund requested",
  external_references: { payment_intent_id: "pi_secret" },
  extensions: {
    email: "guest@example.com",
    refunds: [{ amount: 100 }],
    carrier: "ups",
    trackingUrl: "https://evil.example/track",
  },
  shipping_carrier: "ups",
  tracking_number: "1Z999AA10123456784",
  shipped_at: "2026-08-01T12:00:00.000Z",
  created_at: "2026-07-31T12:00:00.000Z",
};

describe("buildGuestOrderProjection", () => {
  it("returns exactly the guest allowlist", () => {
    const projection = buildGuestOrderProjection(fullOrder);

    expect(Object.keys(projection).sort()).toEqual([
      "carrier",
      "carrierLabel",
      "items",
      "orderNumber",
      "placedAt",
      "shippedAt",
      "status",
      "trackingNumber",
      "trackingUrl",
    ]);
    expect(projection.items).toEqual([{ name: "Morning Blend", quantity: 2 }]);
    expect(Object.keys(projection.items[0]).sort()).toEqual(["name", "quantity"]);
  });

  it("structurally drops private order data and values", () => {
    const projection = buildGuestOrderProjection(fullOrder) as unknown as Record<string, unknown>;
    const serialized = JSON.stringify(projection);

    for (const key of [
      "customer_id",
      "shipping_address",
      "billing_address",
      "total_amount",
      "payment_method",
      "payment_status",
      "notes",
      "extensions",
      "external_references",
    ]) {
      expect(projection).not.toHaveProperty(key);
    }
    for (const value of [
      "Secret St",
      "guest@example.com",
      "pi_secret",
      "INTERNAL",
      "SECRET-SKU",
      "evil.example",
    ]) {
      expect(serialized).not.toContain(value);
    }
  });

  it("never falls back to carrier data or URLs stored in extensions", () => {
    const projection = buildGuestOrderProjection({
      ...fullOrder,
      shipping_carrier: null,
      tracking_number: null,
    });

    expect(projection.carrier).toBeNull();
    expect(projection.carrierLabel).toBeNull();
    expect(projection.trackingNumber).toBeNull();
    expect(projection.trackingUrl).toBeNull();
  });

  it("uses the central shipment builder for safe carrier links", () => {
    const projection = buildGuestOrderProjection(fullOrder);

    expect(projection.carrier).toBe("ups");
    expect(projection.carrierLabel).toBe("UPS");
    expect(projection.trackingNumber).toBe("1Z999AA10123456784");
    expect(projection.trackingUrl).toContain("ups.com");
    expect(projection.trackingUrl).not.toContain("evil.example");
  });

  it("tolerates sparse rows without inventing private data", () => {
    expect(buildGuestOrderProjection({ status: "pending" })).toEqual({
      orderNumber: "",
      placedAt: null,
      status: "pending",
      shippedAt: null,
      carrier: null,
      carrierLabel: null,
      trackingNumber: null,
      trackingUrl: null,
      items: [],
    });
  });
});
