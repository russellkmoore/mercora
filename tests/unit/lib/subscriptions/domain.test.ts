import { describe, expect, it } from "vitest";
import { Money } from "@/lib/money";
import {
  assertLifecycleSnapshot,
  assertSubscriptionAcquisition,
  assertSubscriptionPlanBinding,
  decideLifecycleEvent,
  planBindingsEqual,
  toProviderAcquisitionRequest,
  type SubscriptionPlanBinding,
} from "@/lib/subscriptions";

function plan(overrides: Partial<SubscriptionPlanBinding> = {}): SubscriptionPlanBinding {
  return {
    id: "plan_monthly",
    productId: "prod_one",
    variantId: "var_one",
    price: Money.fromMinor(2500, "USD"),
    stripePriceId: "price_monthly",
    cadence: { unit: "month", count: 1 },
    active: true,
    ...overrides,
  };
}

describe("subscription domain", () => {
  it("compares every catalog, Money, provider, and cadence binding field", () => {
    expect(planBindingsEqual(plan(), plan())).toBe(true);
    expect(planBindingsEqual(plan(), plan({ variantId: "var_two" }))).toBe(false);
    expect(planBindingsEqual(plan(), plan({ price: Money.fromMinor(2500, "EUR") }))).toBe(false);
    expect(planBindingsEqual(plan(), plan({ cadence: { unit: "month", count: 2 } }))).toBe(false);
  });

  it("permits a zero-price plan only while it is inactive", () => {
    expect(() => assertSubscriptionPlanBinding(plan({
      price: Money.zero("USD"),
      active: false,
    }))).not.toThrow();
    expect(() => assertSubscriptionPlanBinding(plan({
      price: Money.zero("USD"),
      active: true,
    }))).toThrow("positive price");
  });

  it("requires bounded acquisition identity, consent, and address snapshots", () => {
    const acquisition = {
      id: "acq_one",
      setupIntentId: "seti_one",
      customerId: "user_one",
      stripeCustomerId: "cus_customer",
      plan: plan(),
      quantity: 2,
      shippingAddress: { line1: "1 Example Way", city: "Example", country: "US" },
      consent: {
        termsVersion: "2026-08",
        acceptedAt: "2026-08-01T00:00:00.000Z",
        source: "checkout",
      },
    } as const;
    expect(() => assertSubscriptionAcquisition(acquisition)).not.toThrow();
    expect(toProviderAcquisitionRequest(acquisition).idempotencyKey).toBe("acq_one");

    expect(() => assertSubscriptionAcquisition({
      id: "acq_one",
      setupIntentId: "seti_one",
      customerId: "user_one",
      stripeCustomerId: "cus_customer",
      plan: plan(),
      quantity: 1,
      shippingAddress: { line1: "", city: "Example", country: "us" },
      consent: {
        termsVersion: "2026-08",
        acceptedAt: "not-a-time",
        source: "checkout",
      },
    })).toThrow();
  });

  it("keeps pause collection separate from active lifecycle status", () => {
    expect(() => assertLifecycleSnapshot({
      status: "active",
      quantity: 1,
      pauseCollection: { behavior: "void", resumesAt: 300 },
      cancelAtPeriodEnd: false,
    })).not.toThrow();
  });

  it("orders lifecycle snapshots monotonically without conflating invoice events", () => {
    const current = { id: "evt_current", createdAt: 200 };
    expect(decideLifecycleEvent(current, { id: "evt_old", createdAt: 199 }))
      .toBe("ignored_stale");
    expect(decideLifecycleEvent(current, current)).toBe("duplicate");
    expect(decideLifecycleEvent(current, { id: "evt_ambiguous", createdAt: 200 }))
      .toBe("refresh_required");
    expect(decideLifecycleEvent(current, { id: "evt_new", createdAt: 201 })).toBe("apply");
  });

  it("rejects reversed or non-integer provider periods", () => {
    expect(() => assertLifecycleSnapshot({
      status: "active",
      quantity: 1,
      currentPeriodStart: 200,
      currentPeriodEnd: 100,
      cancelAtPeriodEnd: false,
    })).toThrow("precedes");
    expect(() => assertLifecycleSnapshot({
      status: "active",
      quantity: 1,
      currentPeriodStart: 100.5,
      currentPeriodEnd: 200,
      cancelAtPeriodEnd: false,
    })).toThrow("epoch seconds");
  });
});
