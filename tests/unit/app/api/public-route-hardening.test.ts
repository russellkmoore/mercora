import { beforeEach, describe, expect, it, vi } from "vitest";

const enforceRateLimit = vi.fn();
const createPaymentIntent = vi.fn();
const calculateTax = vi.fn();
const listPromotions = vi.fn();
const listCouponInstances = vi.fn();
const getSettings = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => enforceRateLimit(...args),
  getClientIp: () => "1.2.3.4",
}));

vi.mock("@/lib/stripe", () => ({
  createPaymentIntent: (...args: unknown[]) => createPaymentIntent(...args),
  calculateTax: (...args: unknown[]) => calculateTax(...args),
  formatAmountForStripe: (value: { amount: number }) => value.amount,
  formatAmountFromStripe: (value: number) => ({ amount: value, currency: "USD" }),
}));

vi.mock("@/lib/models", () => ({
  listPromotions: (...args: unknown[]) => listPromotions(...args),
  listCouponInstances: (...args: unknown[]) => listCouponInstances(...args),
}));

vi.mock("@/lib/utils/settings", () => ({
  getSettings: (...args: unknown[]) => getSettings(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { POST as createPayment } from "@/app/api/payment-intent/route";
import { POST as calculateTaxes } from "@/app/api/tax/route";
import { POST as validateDiscount } from "@/app/api/validate-discount/route";
import { POST as getShippingOptions } from "@/app/api/shipping-options/route";

const cartItem = {
  productId: "product-1",
  variantId: "variant-1",
  name: "Example",
  price: { amount: 1000, currency: "USD" },
  quantity: 1,
  primaryImageUrl: "",
};

function request(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  enforceRateLimit.mockResolvedValue(null);
});

describe("public route rate limiting", () => {
  it.each([
    ["payment-intent", createPayment, "/api/payment-intent"],
    ["tax", calculateTaxes, "/api/tax"],
    ["validate-discount", validateDiscount, "/api/validate-discount"],
    ["shipping-options", getShippingOptions, "/api/shipping-options"],
  ])("rejects %s before external or database work", async (prefix, handler, path) => {
    enforceRateLimit.mockResolvedValue(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );

    const response = await handler(request(path, {}));

    expect(response.status).toBe(429);
    expect(enforceRateLimit).toHaveBeenCalledWith(
      "PUBLIC_RATE_LIMITER",
      `${prefix}:1.2.3.4`
    );
    expect(createPaymentIntent).not.toHaveBeenCalled();
    expect(calculateTax).not.toHaveBeenCalled();
    expect(listPromotions).not.toHaveBeenCalled();
    expect(listCouponInstances).not.toHaveBeenCalled();
    expect(getSettings).not.toHaveBeenCalled();
  });
});

describe("public route request bounds", () => {
  it("rejects oversized tax carts before Stripe", async () => {
    const response = await calculateTaxes(
      request("/api/tax", { items: Array.from({ length: 101 }, () => cartItem) })
    );

    expect(response.status).toBe(400);
    expect(calculateTax).not.toHaveBeenCalled();
  });

  it("rejects oversized shipping carts before database settings", async () => {
    const response = await getShippingOptions(
      request("/api/shipping-options", {
        address: { country: "US", postal_code: "80202" },
        items: Array.from({ length: 101 }, () => cartItem),
      })
    );

    expect(response.status).toBe(400);
    expect(getSettings).not.toHaveBeenCalled();
  });

  it("rejects oversized discount carts before promotion lookups", async () => {
    const discountItem = {
      productId: "product-1",
      categories: [],
      quantity: 1,
      price: 1000,
    };
    const response = await validateDiscount(
      request("/api/validate-discount", {
        code: "SAVE",
        cartItems: Array.from({ length: 101 }, () => discountItem),
      })
    );

    expect(response.status).toBe(400);
    expect(listCouponInstances).not.toHaveBeenCalled();
  });

  it("rejects oversized payment strings before Stripe", async () => {
    const response = await createPayment(
      request("/api/payment-intent", {
        amount: { amount: 1000, currency: "USD" },
        taxAmount: { amount: 0, currency: "USD" },
        shippingAddress: {
          line1: "1 Main St",
          city: "Denver",
          region: "CO",
          postal_code: "80202",
        },
        orderId: "x".repeat(129),
      })
    );

    expect(response.status).toBe(400);
    expect(createPaymentIntent).not.toHaveBeenCalled();
  });
});
