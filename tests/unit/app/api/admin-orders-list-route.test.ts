import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admin-middleware", () => ({ checkAdminPermissions: vi.fn() }));
vi.mock("@/lib/fulfillment/queries", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fulfillment/queries")>(
    "@/lib/fulfillment/queries",
  );
  return { ...actual, queryAdminOrders: vi.fn() };
});

import { NextRequest } from "next/server";
import { GET } from "@/app/api/admin/orders/route";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { queryAdminOrders } from "@/lib/fulfillment/queries";

const request = (query = "") => new NextRequest(
  `http://localhost/api/admin/orders${query ? `?${query}` : ""}`,
);

const ORDER = {
  id: "WEB-QUEUE-1",
  status: "processing" as const,
  paymentStatus: "paid" as const,
  totalAmountRaw: JSON.stringify({ amount: 2_500, currency: "USD" }),
  currencyCode: "USD",
  customerName: "Ada",
  customerEmail: "private@example.com",
  itemCount: 2,
  notes: "Pack with care",
  checkoutCatalogSubtotalRaw: JSON.stringify({ amount: 2_000, currency: "USD" }),
  checkoutShippingBeforeDiscountRaw: JSON.stringify({ amount: 500, currency: "USD" }),
  checkoutTaxRaw: JSON.stringify({ amount: 100, currency: "USD" }),
  checkoutDiscountRaw: JSON.stringify({ amount: 100, currency: "USD" }),
  shippingCarrier: "ups",
  trackingNumber: "1Z123",
  createdAt: "2026-08-01T10:00:00.000Z",
  shippedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkAdminPermissions).mockResolvedValue({ success: true, userId: "admin_1" });
  vi.mocked(queryAdminOrders).mockResolvedValue({
    orders: [ORDER] as never,
    total: 1,
    counts: { awaiting: 1, shipped: 0, cancelled: 0, all: 1 },
  });
});

describe("GET /api/admin/orders", () => {
  it("requires admin authentication before querying", async () => {
    vi.mocked(checkAdminPermissions).mockResolvedValue({ success: false, error: "no" });
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(queryAdminOrders).not.toHaveBeenCalled();
  });

  it("uses the bounded SQL queue defaults", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(queryAdminOrders).toHaveBeenCalledWith({
      view: "awaiting",
      q: undefined,
      limit: 20,
      offset: 0,
    });
  });

  it.each([
    "view=unknown",
    "view=all&view=shipped",
    "limit=0",
    "limit=101",
    "limit=1.5",
    "offset=-1",
    "offset=1000001",
    "offset=5x",
    `q=${"x".repeat(49)}`,
    `q=${encodeURIComponent("é".repeat(25))}`,
  ])("rejects malformed or out-of-bounds input: %s", async (query) => {
    const response = await GET(request(query));
    expect(response.status).toBe(400);
    expect(queryAdminOrders).not.toHaveBeenCalled();
  });

  it("returns a narrow Money and shipment projection plus configured carrier choices", async () => {
    const response = await GET(request("view=all&q=Ada&limit=1&offset=0"));
    const body = await response.json() as Record<string, unknown> & {
      orders: Array<Record<string, unknown>>;
      carriers: Array<Record<string, unknown>>;
    };
    expect(response.status).toBe(200);
    expect(queryAdminOrders).toHaveBeenCalledWith({ view: "all", q: "ada", limit: 1, offset: 0 });
    expect(body.orders[0]).toMatchObject({
      id: "WEB-QUEUE-1",
      totalAmount: { amount: 25, currency: "USD", precision: 2 },
      customer: { name: "Ada", email: "private@example.com" },
      shipment: {
        carrier: "ups",
        carrierLabel: "UPS",
        trackingNumber: "1Z123",
      },
      notes: "Pack with care",
      pricing: {
        checkout_catalog_subtotal: { amount: 20, currency: "USD", precision: 2 },
        checkout_shipping_before_discount: { amount: 5, currency: "USD", precision: 2 },
        checkout_tax: { amount: 1, currency: "USD", precision: 2 },
        checkout_discount: { amount: 1, currency: "USD", precision: 2 },
      },
    });
    expect(body.orders[0]).not.toHaveProperty("extensions");
    expect(body.orders[0]).not.toHaveProperty("trackingUrl");
    expect(body.carriers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ups", label: "UPS" }),
    ]));
  });

  it("turns malformed, fractional, null, and cross-currency stored money into safe fallbacks", async () => {
    vi.mocked(queryAdminOrders).mockResolvedValue({
      orders: [{
        ...ORDER,
        totalAmountRaw: "not-money",
        checkoutCatalogSubtotalRaw: JSON.stringify({ amount: 12.5, currency: "USD" }),
        checkoutShippingBeforeDiscountRaw: JSON.stringify({ currency: "USD" }),
        checkoutTaxRaw: null,
        checkoutDiscountRaw: JSON.stringify({ amount: 100, currency: "EUR" }),
      }],
      total: 1,
      counts: { awaiting: 1, shipped: 0, cancelled: 0, all: 1 },
    });

    const response = await GET(request());
    const body = await response.json() as {
      orders: Array<{
        totalAmount: unknown;
        pricing: Record<string, unknown>;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.orders[0].totalAmount).toBeNull();
    expect(body.orders[0].pricing).toEqual({
      checkout_catalog_subtotal: null,
      checkout_shipping_before_discount: null,
      checkout_discount: null,
    });
    expect(body.orders[0].pricing).not.toHaveProperty("checkout_tax");
  });

  it("accepts a normalized multibyte search at the exact D1 byte limit", async () => {
    const query = "é".repeat(24);
    const response = await GET(request(`q=${encodeURIComponent(query)}`));

    expect(response.status).toBe(200);
    expect(queryAdminOrders).toHaveBeenCalledWith(expect.objectContaining({ q: query }));
  });

  it("contains query failures behind a structured 500", async () => {
    vi.mocked(queryAdminOrders).mockRejectedValue(new Error("D1 unavailable"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ code: "orders_read_failed" });
  });
});
