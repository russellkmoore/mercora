import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
import { DELETE } from "@/app/api/account/payment-methods/[id]/route";

function deleteRequest(id: string, origin: string | null = "http://localhost") {
  const headers: Record<string, string> = {};
  if (origin !== null) headers.origin = origin;
  return new NextRequest(`http://localhost/api/account/payment-methods/${id}`, {
    method: "DELETE",
    headers,
  });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

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
    const body = await response.json() as { error: string };
    expect(body.error).not.toContain("cus_123");
  });
});

describe("DELETE /api/account/payment-methods/[id]", () => {
  it("returns 401 for an anonymous caller and calls neither Stripe nor the binding lookup", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const response = await DELETE(deleteRequest("pm_1"), paramsFor("pm_1"));
    expect(response.status).toBe(401);
    expect(mocks.findStripeCustomerId).not.toHaveBeenCalled();
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(mocks.detach).not.toHaveBeenCalled();
  });

  it("returns 403 on a cross-origin request and calls neither Stripe nor the binding lookup", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    const response = await DELETE(
      deleteRequest("pm_1", "http://evil.example"),
      paramsFor("pm_1"),
    );
    expect(response.status).toBe(403);
    expect(mocks.findStripeCustomerId).not.toHaveBeenCalled();
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(mocks.detach).not.toHaveBeenCalled();
  });

  it("returns 404 when the id is missing or longer than 80 characters, with no Stripe call", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    const longId = "pm_".padEnd(81, "x");
    const response = await DELETE(deleteRequest(longId), paramsFor(longId));
    expect(response.status).toBe(404);
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(mocks.detach).not.toHaveBeenCalled();
  });

  it("returns 404 when the caller has no Stripe customer binding, and never calls detach", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.findStripeCustomerId.mockResolvedValue(undefined);
    const response = await DELETE(deleteRequest("pm_1"), paramsFor("pm_1"));
    expect(response.status).toBe(404);
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(mocks.detach).not.toHaveBeenCalled();
  });

  it("returns 404 when the retrieved payment method belongs to a different Stripe customer, and never calls detach", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.findStripeCustomerId.mockResolvedValue("cus_owner");
    mocks.retrieve.mockResolvedValue({ id: "pm_1", customer: "cus_someone_else" });
    const response = await DELETE(deleteRequest("pm_1"), paramsFor("pm_1"));
    expect(response.status).toBe(404);
    expect(mocks.detach).not.toHaveBeenCalled();
  });

  it("detaches once and returns 200 when the retrieved payment method matches the caller's binding", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.findStripeCustomerId.mockResolvedValue("cus_owner");
    mocks.retrieve.mockResolvedValue({ id: "pm_1", customer: "cus_owner" });
    mocks.detach.mockResolvedValue({ id: "pm_1" });
    const response = await DELETE(deleteRequest("pm_1"), paramsFor("pm_1"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });
    expect(mocks.detach).toHaveBeenCalledTimes(1);
    expect(mocks.detach).toHaveBeenCalledWith("pm_1");
  });

  it("also matches an expanded customer object by its id", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.findStripeCustomerId.mockResolvedValue("cus_owner");
    mocks.retrieve.mockResolvedValue({ id: "pm_1", customer: { id: "cus_owner" } });
    mocks.detach.mockResolvedValue({ id: "pm_1" });
    const response = await DELETE(deleteRequest("pm_1"), paramsFor("pm_1"));
    expect(response.status).toBe(200);
    expect(mocks.detach).toHaveBeenCalledWith("pm_1");
  });

  it("returns 503 without leaking the caught error when retrieve throws", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.findStripeCustomerId.mockResolvedValue("cus_owner");
    mocks.retrieve.mockRejectedValue(new Error("cus_owner secret leak"));
    const response = await DELETE(deleteRequest("pm_1"), paramsFor("pm_1"));
    expect(response.status).toBe(503);
    const body = await response.json() as { error: string };
    expect(body.error).not.toContain("cus_owner");
    expect(mocks.detach).not.toHaveBeenCalled();
  });

  it("returns 503 without leaking the caught error when detach throws", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.findStripeCustomerId.mockResolvedValue("cus_owner");
    mocks.retrieve.mockResolvedValue({ id: "pm_1", customer: "cus_owner" });
    mocks.detach.mockRejectedValue(new Error("cus_owner secret leak"));
    const response = await DELETE(deleteRequest("pm_1"), paramsFor("pm_1"));
    expect(response.status).toBe(503);
    const body = await response.json() as { error: string };
    expect(body.error).not.toContain("cus_owner");
  });
});
