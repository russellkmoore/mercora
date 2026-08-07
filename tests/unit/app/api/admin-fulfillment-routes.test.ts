import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkAdminPermissions: vi.fn(),
  shipOrder: vi.fn(),
  updateTracking: vi.fn(),
  sendInitialShippingEmail: vi.fn(),
  listRecentOrderEvents: vi.fn(),
  getOrderById: vi.fn(),
  parseShipmentInput: vi.fn(),
  toAdminOrder: vi.fn((order) => order),
  buildShipmentView: vi.fn((order) => ({
    carrier: order.shipping_carrier ?? null,
    carrierLabel: order.shipping_carrier?.toUpperCase() ?? null,
    trackingNumber: order.tracking_number ?? null,
    trackingUrl: null,
  })),
}));

vi.mock("@/lib/auth/admin-middleware", () => ({
  checkAdminPermissions: mocks.checkAdminPermissions,
}));
vi.mock("@/lib/fulfillment/service", () => ({
  shipOrder: mocks.shipOrder,
  updateTracking: mocks.updateTracking,
  listRecentOrderEvents: mocks.listRecentOrderEvents,
}));
vi.mock("@/lib/fulfillment/shipping-email", () => ({
  sendInitialShippingEmail: mocks.sendInitialShippingEmail,
}));
vi.mock("@/lib/fulfillment/transitions", () => ({
  parseShipmentInput: mocks.parseShipmentInput,
}));
vi.mock("@/lib/fulfillment/shipment-view", () => ({
  buildShipmentView: mocks.buildShipmentView,
}));
vi.mock("@/lib/models/mach/order-serializer", () => ({
  toAdminOrder: mocks.toAdminOrder,
}));
vi.mock("@/lib/models/mach/orders", () => ({
  getOrderById: mocks.getOrderById,
}));
vi.mock("@/lib/db", () => ({ getDbAsync: vi.fn() }));

import { POST as ship } from "@/app/api/admin/orders/[id]/ship/route";
import { PATCH as tracking } from "@/app/api/admin/orders/[id]/tracking/route";
import { GET as events } from "@/app/api/admin/orders/[id]/events/route";

const context = { params: Promise.resolve({ id: "ORD-1" }) };
const shippedOrder = {
  id: "ORD-1",
  status: "shipped",
  payment_status: "paid",
  shipping_carrier: "ups",
  tracking_number: "1Z123",
  total_amount: { amount: 1000, currency: "USD" },
  items: [],
};

beforeEach(() => {
  mocks.checkAdminPermissions.mockResolvedValue({
    success: true,
    userId: "user_admin",
    isServiceToken: false,
  });
  mocks.parseShipmentInput.mockReturnValue({
    ok: true,
    input: { carrier: "ups", trackingNumber: "1Z123" },
  });
  mocks.getOrderById.mockResolvedValue(shippedOrder);
  mocks.sendInitialShippingEmail.mockResolvedValue({
    attempted: true,
    success: true,
    eventId: "email-event-1",
  });
});

describe("admin ship route", () => {
  it("distinguishes invalid JSON from an intentionally empty shipment", async () => {
    const response = await ship(
      new NextRequest("https://store.test/api/admin/orders/ORD-1/ship", {
        method: "POST",
        body: "{broken",
      }),
      context,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_json" });
    expect(mocks.shipOrder).not.toHaveBeenCalled();
  });

  it("rejects declared and actual request bodies larger than 4 KiB", async () => {
    const declared = await ship(
      new NextRequest("https://store.test/api/admin/orders/ORD-1/ship", {
        method: "POST",
        headers: { "content-length": "4097" },
        body: "{}",
      }),
      context,
    );
    expect(declared.status).toBe(413);
    expect(await declared.json()).toMatchObject({ code: "request_too_large" });

    const actual = await ship(
      new NextRequest("https://store.test/api/admin/orders/ORD-1/ship", {
        method: "POST",
        body: JSON.stringify({ trackingNumber: "é".repeat(2_100) }),
      }),
      context,
    );
    expect(actual.status).toBe(413);
    expect(await actual.json()).toMatchObject({ code: "request_too_large" });
    expect(mocks.shipOrder).not.toHaveBeenCalled();
  });

  it("returns 201 for a CAS win and 200 for an identical retry", async () => {
    mocks.shipOrder
      .mockResolvedValueOnce({ outcome: "shipped", order: shippedOrder, eventId: "evt-1" })
      .mockResolvedValueOnce({ outcome: "already_shipped", order: shippedOrder });
    const request = () => new NextRequest("https://store.test/api/admin/orders/ORD-1/ship", {
      method: "POST",
      body: JSON.stringify({ carrier: "ups", trackingNumber: "1Z123" }),
    });

    const created = await ship(request(), context);
    const retry = await ship(request(), context);
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      eventId: "evt-1",
      email: { attempted: true, success: true },
    });
    expect(mocks.sendInitialShippingEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendInitialShippingEmail).toHaveBeenCalledWith(
      "ORD-1",
      { type: "admin", id: "user_admin" },
    );
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({
      idempotent: true,
      eventId: null,
      email: { attempted: false },
    });
  });

  it("keeps a committed shipment successful when the email seam throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.shipOrder.mockResolvedValue({
      outcome: "shipped",
      order: shippedOrder,
      eventId: "evt-committed",
    });
    mocks.sendInitialShippingEmail.mockRejectedValue(new Error("transport unavailable"));

    const response = await ship(
      new NextRequest("https://store.test/api/admin/orders/ORD-1/ship", {
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      eventId: "evt-committed",
      email: { attempted: false, success: false, error: "shipping_email_failed" },
    });
  });

  it("returns a structured refund hold", async () => {
    mocks.shipOrder.mockResolvedValue({
      outcome: "not_fulfillable",
      status: "processing",
      paymentStatus: "paid",
      refundPending: true,
    });
    const response = await ship(new NextRequest(
      "https://store.test/api/admin/orders/ORD-1/ship",
      { method: "POST" },
    ), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "refund_pending",
      refundPending: true,
      status: "processing",
    });
  });
});

describe("admin tracking route", () => {
  it("rejects bodies larger than 4 KiB before parsing shipment input", async () => {
    const response = await tracking(new NextRequest(
      "https://store.test/api/admin/orders/ORD-1/tracking",
      {
        method: "PATCH",
        headers: { "content-length": "99999" },
        body: "{}",
      },
    ), context);
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "request_too_large" });
    expect(mocks.parseShipmentInput).not.toHaveBeenCalled();
  });

  it("requires a complete pair even though untracked shipment creation is valid", async () => {
    mocks.parseShipmentInput.mockReturnValue({
      ok: true,
      input: { carrier: null, trackingNumber: null },
    });
    const response = await tracking(new NextRequest(
      "https://store.test/api/admin/orders/ORD-1/tracking",
      { method: "PATCH" },
    ), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_tracking" });
  });

  it("returns a retryable value-CAS conflict with the current pair", async () => {
    mocks.updateTracking.mockResolvedValue({ outcome: "conflict", order: shippedOrder });
    const response = await tracking(new NextRequest(
      "https://store.test/api/admin/orders/ORD-1/tracking",
      {
        method: "PATCH",
        body: JSON.stringify({ carrier: "fedex", trackingNumber: "222" }),
      },
    ), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "tracking_conflict",
      tracking: { carrier: "ups", trackingNumber: "1Z123" },
    });
  });
});

describe("admin events route", () => {
  it("validates the bound and returns the newest bounded page oldest-first", async () => {
    mocks.listRecentOrderEvents.mockResolvedValue([
      {
        id: "new",
        event_type: "tracking_updated",
        actor_type: "system",
        actor_id: null,
        from_status: null,
        to_status: null,
        details: {},
        created_at: "2026-08-06T12:01:00.000Z",
      },
      {
        id: "old",
        event_type: "shipment_created",
        actor_type: "system",
        actor_id: null,
        from_status: "processing",
        to_status: "shipped",
        details: {},
        created_at: "2026-08-06T12:00:00.000Z",
      },
    ]);
    const response = await events(new NextRequest(
      "https://store.test/api/admin/orders/ORD-1/events?limit=2",
    ), context);
    expect(response.status).toBe(200);
    expect(mocks.listRecentOrderEvents).toHaveBeenCalledWith("ORD-1", 2);
    const payload = await response.json() as { events: Array<{ id: string }> };
    expect(payload.events.map((event) => event.id)).toEqual([
      "old",
      "new",
    ]);
  });

  it("rejects non-positive limits before reading the order", async () => {
    const response = await events(new NextRequest(
      "https://store.test/api/admin/orders/ORD-1/events?limit=0",
    ), context);
    expect(response.status).toBe(400);
    expect(mocks.getOrderById).not.toHaveBeenCalled();
  });
});
