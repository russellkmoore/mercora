import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  config: vi.fn(),
  getService: vi.fn(),
  listPublic: vi.fn(),
  listAdmin: vi.fn(),
  getAdmin: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  telemetry: vi.fn(),
}));

vi.mock("@/lib/auth/admin-middleware", () => ({ checkAdminPermissions: mocks.auth }));
vi.mock("@/lib/store-config", () => ({ getStoreConfig: mocks.config }));
vi.mock("@/lib/observability/telemetry", () => ({ recordTelemetry: mocks.telemetry }));
vi.mock("@/lib/subscriptions/plan-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/subscriptions/plan-service")>(
    "@/lib/subscriptions/plan-service",
  );
  return { ...actual, getSubscriptionPlanService: mocks.getService };
});

import { GET as publicGet } from "@/app/api/subscription-plans/route";
import {
  GET as adminList,
  POST as adminCreate,
} from "@/app/api/admin/subscription-plans/route";
import {
  GET as adminGet,
  PATCH as adminUpdate,
} from "@/app/api/admin/subscription-plans/[id]/route";
import {
  SubscriptionPlanConflictError,
  SubscriptionPlanNotFoundError,
} from "@/lib/subscriptions/plan-service";
import { SubscriptionPlanPriceUnavailableError } from "@/lib/subscriptions/plan-price-adapter";

const PUBLIC_PLAN = {
  id: "plan_monthly",
  product: { id: "prod_tea", label: "Tea" },
  variant: { id: "var_black", label: "Black" },
  price: { amount: 12.99, currency: "USD", precision: 2 },
  cadence: { unit: "month", count: 1 },
  shippingRequired: true,
};

const ADMIN_PLAN = {
  ...PUBLIC_PLAN,
  unitAmountMinor: 1299,
  stripePriceId: "price_monthly",
  active: true,
  createdAt: "2026-08-15T00:00:00.000Z",
  updatedAt: "2026-08-15T00:00:00.000Z",
};

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`https://store.example${path}`, init);
}

function context(id = "plan_monthly") {
  return { params: Promise.resolve({ id }) };
}

describe("subscription plan routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ success: true, userId: "admin_one" });
    mocks.config.mockReturnValue({
      commerce: {
        subscriptionTermsVersion: "terms-1",
        features: { subscriptionAcquisition: true, subscriptionReconciliation: true },
      },
    });
    mocks.getService.mockResolvedValue({
      listPublic: mocks.listPublic,
      listAdmin: mocks.listAdmin,
      getAdmin: mocks.getAdmin,
      create: mocks.create,
      update: mocks.update,
    });
    mocks.listPublic.mockResolvedValue({ plans: [PUBLIC_PLAN], total: 1, limit: 20, offset: 0 });
    mocks.listAdmin.mockResolvedValue({ plans: [ADMIN_PLAN], total: 1, limit: 20, offset: 0 });
    mocks.getAdmin.mockResolvedValue(ADMIN_PLAN);
    mocks.create.mockResolvedValue(ADMIN_PLAN);
    mocks.update.mockResolvedValue({ ...ADMIN_PLAN, active: false });
  });

  it.each([
    { subscriptionAcquisition: false, subscriptionReconciliation: true, terms: "terms-1" },
    { subscriptionAcquisition: true, subscriptionReconciliation: false, terms: "terms-1" },
    { subscriptionAcquisition: true, subscriptionReconciliation: true, terms: undefined },
  ])("returns an empty public catalog without D1 when sales are disabled: %o", async (gate) => {
    mocks.config.mockReturnValue({
      commerce: {
        subscriptionTermsVersion: gate.terms,
        features: {
          subscriptionAcquisition: gate.subscriptionAcquisition,
          subscriptionReconciliation: gate.subscriptionReconciliation,
        },
      },
    });
    const response = await publicGet(request("/api/subscription-plans?variantId=var_black"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      plans: [], total: 0, meta: { limit: 20, offset: 0 },
    });
    expect(mocks.getService).not.toHaveBeenCalled();
    expect(mocks.listPublic).not.toHaveBeenCalled();
  });

  it("passes exact public filters and returns only the narrow projection", async () => {
    const response = await publicGet(request(
      "/api/subscription-plans?productId=prod_tea&variantId=var_black&limit=10&offset=0",
    ));
    expect(response.status).toBe(200);
    expect(mocks.listPublic).toHaveBeenCalledWith({
      productId: "prod_tea", variantId: "var_black", limit: 10, offset: 0,
    });
    const body = await response.json() as { plans: Array<Record<string, unknown>> };
    expect(body.plans[0]).toEqual(PUBLIC_PLAN);
    expect(body.plans[0]).not.toHaveProperty("stripePriceId");
    expect(body.plans[0]).not.toHaveProperty("unitAmountMinor");
    expect(body.plans[0]).not.toHaveProperty("actorId");
  });

  it("rejects invalid public queries before config or D1", async () => {
    const response = await publicGet(request("/api/subscription-plans?variantId=bad%20id&x=1"));
    expect(response.status).toBe(400);
    expect(mocks.config).not.toHaveBeenCalled();
    expect(mocks.getService).not.toHaveBeenCalled();
  });

  it("authenticates admin reads before parsing or D1", async () => {
    mocks.auth.mockResolvedValue({ success: false, error: "Authentication required." });
    const response = await adminList(request("/api/admin/subscription-plans?limit=999"));
    expect(response.status).toBe(401);
    expect(mocks.getService).not.toHaveBeenCalled();
  });

  it("passes strict admin filters", async () => {
    const response = await adminList(request(
      "/api/admin/subscription-plans?active=false&limit=10&offset=2",
    ));
    expect(response.status).toBe(200);
    expect(mocks.listAdmin).toHaveBeenCalledWith({ active: false, limit: 10, offset: 2 });
  });

  it("requires admin same-origin authorization before reading mutation bodies", async () => {
    mocks.auth.mockResolvedValue({ success: false, error: "Request origin validation failed." });
    const response = await adminCreate(request("/api/admin/subscription-plans", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.example" },
      body: JSON.stringify({ actorEmail: "private@example.test" }),
    }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "forbidden", error: "Request origin validation failed",
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates only a pre-existing Stripe Price binding from an exact body", async () => {
    const body = {
      id: "plan_monthly", productId: "prod_tea", variantId: "var_black",
      currency: "USD", unitAmountMinor: 1299, stripePriceId: "price_monthly",
      cadence: { unit: "month", count: 1 }, active: true,
    };
    const response = await adminCreate(request("/api/admin/subscription-plans", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://store.example" },
      body: JSON.stringify(body),
    }));
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(body);
  });

  it("gets one admin plan and masks not-found details", async () => {
    mocks.getAdmin.mockRejectedValue(new SubscriptionPlanNotFoundError());
    const response = await adminGet(request(
      "/api/admin/subscription-plans/plan_missing",
    ), context("plan_missing"));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "subscription_plan_not_found", error: "Subscription plan not found",
    });
  });

  it("passes the explicit CAS version and maps stale updates to conflict", async () => {
    const updateBody = {
      expectedUpdatedAt: ADMIN_PLAN.updatedAt,
      patch: { active: false },
    };
    const accepted = await adminUpdate(request(
      "/api/admin/subscription-plans/plan_monthly",
      {
        method: "PATCH",
        headers: { "content-type": "application/json", origin: "https://store.example" },
        body: JSON.stringify(updateBody),
      },
    ), context());
    expect(accepted.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      "plan_monthly", { active: false }, ADMIN_PLAN.updatedAt,
    );

    mocks.update.mockRejectedValueOnce(new SubscriptionPlanConflictError("Subscription plan version is stale"));
    const stale = await adminUpdate(request(
      "/api/admin/subscription-plans/plan_monthly",
      {
        method: "PATCH",
        headers: { "content-type": "application/json", origin: "https://store.example" },
        body: JSON.stringify(updateBody),
      },
    ), context());
    expect(stale.status).toBe(409);
  });

  it("bounds bodies and masks unexpected D1 errors with redacted telemetry", async () => {
    const oversized = await adminCreate(request("/api/admin/subscription-plans", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "8193" },
      body: "{}",
    }));
    expect(oversized.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();

    mocks.listAdmin.mockRejectedValue(new Error("SQL contains private@example.test"));
    const failed = await adminList(request("/api/admin/subscription-plans"));
    expect(failed.status).toBe(500);
    const failedBody = await failed.json();
    expect(failedBody).toEqual({
      code: "subscription_plans_read_failed", error: "Failed to load subscription plans",
    });
    expect(mocks.telemetry).toHaveBeenCalledWith(
      "subscription.list_failed",
      expect.objectContaining({ operation: "read", provider: "d1" }),
      expect.any(Error),
    );
    expect(JSON.stringify(failedBody).includes("private@example.test")).toBe(false);
  });

  it("masks provider verification failures and records only bounded Stripe telemetry", async () => {
    mocks.create.mockRejectedValue(new SubscriptionPlanPriceUnavailableError(
      new Error("No such price for private@example.test"),
    ));
    const response = await adminCreate(request("/api/admin/subscription-plans", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://store.example" },
      body: JSON.stringify({
        id: "plan_monthly", productId: "prod_tea", variantId: "var_black",
        currency: "USD", unitAmountMinor: 1299, stripePriceId: "price_monthly",
        cadence: { unit: "month", count: 1 }, active: true,
      }),
    }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({
      code: "subscription_plan_price_unavailable",
      error: "Stripe Price verification is temporarily unavailable",
    });
    expect(JSON.stringify(body)).not.toContain("private@example.test");
    expect(mocks.telemetry).toHaveBeenCalledWith(
      "subscription.action_failed",
      {
        operation: "validate", outcome: "unavailable", provider: "stripe",
        retryable: true, trigger: "request",
      },
      expect.any(SubscriptionPlanPriceUnavailableError),
    );
  });
});
