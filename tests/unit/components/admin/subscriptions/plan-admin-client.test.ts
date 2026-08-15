import { describe, expect, it, vi } from "vitest";
import {
  AdminSubscriptionPlanApiError,
  createAdminSubscriptionPlan,
  getAdminSubscriptionPlan,
  listAdminSubscriptionPlans,
  parseAdminSubscriptionPlan,
  updateAdminSubscriptionPlan,
  type FetchLike,
} from "@/components/admin/subscriptions/plan-admin-client";

const plan = {
  id: "plan_one",
  product: { id: "prod_one", label: "Tea" },
  variant: { id: "var_one", label: "Large" },
  price: { amount: 12.5, currency: "USD", precision: 2 },
  cadence: { unit: "month", count: 1 },
  shippingRequired: true,
  unitAmountMinor: 1250,
  stripePriceId: "price_abc123",
  active: true,
  createdAt: "2026-08-15T00:00:00.000Z",
  updatedAt: "2026-08-15T00:00:01.000Z",
} as const;

const write = {
  id: "plan_one",
  productId: "prod_one",
  variantId: "var_one",
  currency: "USD",
  unitAmountMinor: 1250,
  stripePriceId: "price_abc123",
  cadence: { unit: "month" as const, count: 1 },
  active: true,
};

describe("admin subscription plan client", () => {
  it("strictly parses bounded admin plan projections", () => {
    expect(parseAdminSubscriptionPlan(plan)).toEqual(plan);
    expect(() => parseAdminSubscriptionPlan({ ...plan, providerSecret: "hidden" }))
      .toThrow("invalid");
    expect(() => parseAdminSubscriptionPlan({
      ...plan,
      product: { ...plan.product, label: "x".repeat(513) },
    })).toThrow("invalid");
  });

  it("lists active and inactive pages with exact server pagination", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      plans: [plan], total: 21, meta: { limit: 20, offset: 20 },
    }), { status: 200 })) as unknown as FetchLike;
    await expect(listAdminSubscriptionPlans(fetcher, {
      filter: "inactive", limit: 20, offset: 20,
    })).resolves.toMatchObject({ plans: [plan], total: 21, limit: 20, offset: 20 });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/admin/subscription-plans?limit=20&offset=20&active=false",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("rejects oversized declared and streamed response bodies", async () => {
    const declared = vi.fn(async () => new Response("{}", {
      status: 200,
      headers: { "Content-Length": "131073" },
    })) as unknown as FetchLike;
    await expect(listAdminSubscriptionPlans(declared, {
      filter: "all", limit: 20, offset: 0,
    })).rejects.toThrow("too large");

    const actual = vi.fn(async () => new Response("x".repeat(131_073), { status: 200 })) as unknown as FetchLike;
    await expect(listAdminSubscriptionPlans(actual, {
      filter: "all", limit: 20, offset: 0,
    })).rejects.toThrow("too large");
  });

  it("loads a bounded detail and creates an exact manual binding", async () => {
    const detail = vi.fn(async () => new Response(JSON.stringify({ plan }), { status: 200 })) as unknown as FetchLike;
    await expect(getAdminSubscriptionPlan(detail, "plan_one")).resolves.toEqual(plan);
    expect(detail).toHaveBeenCalledWith("/api/admin/subscription-plans/plan_one", {
      method: "GET", cache: "no-store",
    });

    const create = vi.fn(async () => new Response(JSON.stringify({ plan }), { status: 201 })) as unknown as FetchLike;
    await createAdminSubscriptionPlan(create, write);
    const [, init] = (create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual(write);
    expect(init.method).toBe("POST");
  });

  it("PATCHes full edits and deactivation with the server version", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      plan: { ...plan, active: false, updatedAt: "2026-08-15T00:00:02.000Z" },
    }), { status: 200 })) as unknown as FetchLike;
    const current = { id: plan.id, updatedAt: plan.updatedAt };
    await updateAdminSubscriptionPlan(fetcher, current, {
      productId: write.productId,
      variantId: write.variantId,
      currency: write.currency,
      unitAmountMinor: write.unitAmountMinor,
      stripePriceId: write.stripePriceId,
      cadence: write.cadence,
      active: false,
    });
    let body = JSON.parse(String((fetcher as ReturnType<typeof vi.fn>).mock.calls[0][1].body));
    expect(body.expectedUpdatedAt).toBe(plan.updatedAt);
    expect(body.patch).not.toHaveProperty("id");

    await updateAdminSubscriptionPlan(fetcher, current, { active: false });
    body = JSON.parse(String((fetcher as ReturnType<typeof vi.fn>).mock.calls[1][1].body));
    expect(body).toEqual({ expectedUpdatedAt: plan.updatedAt, patch: { active: false } });
  });

  it.each([
    [409, "subscription_plan_conflict", "changed or conflicts"],
    [409, "subscription_plan_price_mismatch", "does not match"],
    [503, "subscription_plan_price_unavailable", "temporarily unavailable"],
  ])("maps %s %s without exposing provider details", async (status, code, message) => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      code, error: "raw provider account details",
    }), { status })) as unknown as FetchLike;
    const error = await createAdminSubscriptionPlan(fetcher, write).catch((cause) => cause);
    expect(error).toBeInstanceOf(AdminSubscriptionPlanApiError);
    expect((error as Error).message).toContain(message);
    expect((error as Error).message).not.toContain("raw provider");
  });
});
