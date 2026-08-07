import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/models/mach/orders", () => ({ getOrderById: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "CF-Connecting-IP": "192.0.2.10" })),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import GuestOrderStatusPage, { dynamic, metadata } from "@/app/order-status/[id]/page";
import { getOrderById } from "@/lib/models/mach/orders";
import { createOrderStatusToken } from "@/lib/order-status/token";

const ORDER_ID = "ORD-GUEST-123";
const SECRET = "guest-page-test-secret-0123456789abcdef";
const order = {
  id: ORDER_ID,
  customer_id: "customer-secret",
  status: "shipped",
  payment_status: "paid",
  payment_method: "pi_secret_123",
  total_amount: { amount: 4200, currency: "USD" },
  currency_code: "USD",
  shipping_address: { line1: "1 Secret Street", email: "guest@example.test" },
  billing_address: { line1: "1 Secret Street" },
  items: [{ product_name: "Widget", quantity: 2, sku: "PRIVATE-SKU" }],
  notes: "internal note",
  extensions: { email: "guest@example.test", trackingUrl: "https://attacker.example" },
  shipping_carrier: "ups",
  tracking_number: "1Z999AA10123456784",
  shipped_at: "2026-08-05T12:00:00.000Z",
  created_at: "2026-08-01T12:00:00.000Z",
} as never;

function collectText(node: unknown, output: string[] = []): string[] {
  if (node == null || typeof node === "boolean") return output;
  if (typeof node === "string" || typeof node === "number") {
    output.push(String(node));
    return output;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, output);
    return output;
  }
  if (typeof node === "object") {
    const props = (node as { props?: Record<string, unknown> }).props;
    if (props) collectText(props.children, output);
  }
  return output;
}

function render(token?: string, id = ORDER_ID) {
  return GuestOrderStatusPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(token ? { token } : {}),
  });
}

beforeEach(() => {
  process.env.ORDER_STATUS_SECRET = SECRET;
  process.env.NEXT_PUBLIC_STORE_NAME = "Example Store";
  process.env.STORE_SUPPORT_EMAIL = "help@example.test";
  vi.mocked(getOrderById).mockResolvedValue(order);
});

afterEach(() => {
  delete process.env.ORDER_STATUS_SECRET;
  delete process.env.NEXT_PUBLIC_STORE_NAME;
  delete process.env.STORE_SUPPORT_EMAIL;
});

describe("guest order-status page", () => {
  it("rejects missing, invalid, expired, and unknown-order links identically", async () => {
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getOrderById).not.toHaveBeenCalled();

    await expect(render("invalid-token")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getOrderById).not.toHaveBeenCalled();

    const token = (await createOrderStatusToken(ORDER_ID))!;
    vi.mocked(getOrderById).mockResolvedValue(null);
    await expect(render(token)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("verifies order binding before looking up an order", async () => {
    const token = (await createOrderStatusToken("ORD-OTHER"))!;
    await expect(render(token)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getOrderById).not.toHaveBeenCalled();
  });

  it("renders only the guest projection with runtime branding", async () => {
    const token = (await createOrderStatusToken(ORDER_ID))!;
    const text = collectText(await render(token)).join(" ");

    for (const expected of [
      "Example Store order status",
      ORDER_ID,
      "shipped",
      "Widget",
      "UPS",
      "1Z999AA10123456784",
      "help@example.test",
    ]) {
      expect(text).toContain(expected);
    }
    for (const forbidden of [
      "Secret Street",
      "guest@example.test",
      "customer-secret",
      "pi_secret_123",
      "internal note",
      "PRIVATE-SKU",
      "attacker.example",
      "4200",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("is dynamic, noindex, and no-referrer", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.robots).toMatchObject({ index: false, follow: false, nocache: true });
    expect(metadata.referrer).toBe("no-referrer");
  });
});
