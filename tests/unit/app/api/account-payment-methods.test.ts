import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findStripeCustomerId: vi.fn(),
  list: vi.fn(),
  retrieve: vi.fn(),
  detach: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));
vi.mock("@/lib/payments/customer-binding", () => ({
  findStripeCustomerId: mocks.findStripeCustomerId,
}));
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    paymentMethods: {
      list: mocks.list,
      retrieve: mocks.retrieve,
      detach: mocks.detach,
    },
  }),
}));

import { GET } from "@/app/api/account/payment-methods/route";

beforeEach(() => {
  mocks.auth.mockReset();
  mocks.findStripeCustomerId.mockReset();
  mocks.list.mockReset();
  mocks.retrieve.mockReset();
  mocks.detach.mockReset();
});

describe("GET /api/account/payment-methods", () => {
  it("returns 401 for an anonymous caller", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.findStripeCustomerId).not.toHaveBeenCalled();
  });

  it("returns an empty list when the caller has no Stripe customer binding", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.findStripeCustomerId.mockResolvedValue(undefined);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ paymentMethods: [] });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("projects only brand, last4, and expiry for a caller with saved cards", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.findStripeCustomerId.mockResolvedValue("cus_123");
    mocks.list.mockResolvedValue({
      data: [
        {
          id: "pm_1",
          customer: "cus_123",
          billing_details: { address: { line1: "1 Main" } },
          card: { brand: "visa", last4: "4242", exp_month: 4, exp_year: 2030, fingerprint: "abc" },
        },
        { id: "pm_no_card", customer: "cus_123", card: null },
      ],
    });
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      paymentMethods: [
        { id: "pm_1", brand: "visa", last4: "4242", expMonth: 4, expYear: 2030 },
      ],
    });
    expect(mocks.list).toHaveBeenCalledWith({ customer: "cus_123", type: "card" });
  });

  it("returns 503 without leaking the caught error when Stripe is unreachable", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.findStripeCustomerId.mockResolvedValue("cus_123");
    mocks.list.mockRejectedValue(new Error("cus_123 secret leak"));
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).not.toContain("cus_123");
  });
});
