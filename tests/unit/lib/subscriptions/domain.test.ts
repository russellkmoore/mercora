import { describe, expect, it } from "vitest";
import { Money } from "@/lib/money";
import {
  assertLifecycleSnapshot,
  assertSubscriptionAcquisition,
  assertSubscriptionPlanBinding,
  assertProviderSubscriptionMatchesAcquisition,
  assertVerifiedSubscriptionInvoice,
  canonicalSubscriptionAcquisition,
  decideLifecycleEvent,
  planBindingsEqual,
  toReservedSubscriptionPlanBinding,
  toProviderAcquisitionRequest,
  subscriptionAcquisitionsEqual,
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
    shippingRequired: true,
    active: true,
    ...overrides,
  };
}

function acquisition() {
  return {
    id: "acq_one",
    setupIntentId: "seti_one",
    customerId: "user_one",
    stripeCustomerId: "cus_customer",
    plan: toReservedSubscriptionPlanBinding(plan()),
    quantity: 2,
    shippingAddress: { line1: " 1 Example Way ", city: " Example ", country: "US" },
    consent: {
      termsVersion: "2026-08",
      acceptedAt: "2026-08-01T00:00:00.000Z",
      source: "checkout" as const,
    },
  };
}

describe("subscription domain", () => {
  it("compares every catalog, Money, provider, and cadence binding field", () => {
    expect(planBindingsEqual(plan(), plan())).toBe(true);
    expect(planBindingsEqual(plan(), plan({ variantId: "var_two" }))).toBe(false);
    expect(planBindingsEqual(plan(), plan({ price: Money.fromMinor(2500, "EUR") }))).toBe(false);
    expect(planBindingsEqual(plan(), plan({ cadence: { unit: "month", count: 2 } }))).toBe(false);
    expect(planBindingsEqual(plan(), plan({ shippingRequired: false }))).toBe(false);
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

  it("snapshots only immutable billing facts while the plan is active", () => {
    const reserved = toReservedSubscriptionPlanBinding(plan());
    expect(reserved).not.toHaveProperty("active");
    expect(() => toReservedSubscriptionPlanBinding(plan({ active: false })))
      .toThrow("active plan");
    expect(() => assertSubscriptionAcquisition({
      ...acquisition(),
      plan: reserved,
    })).not.toThrow();
    expect(() => assertSubscriptionPlanBinding({
      ...plan(),
      active: undefined as unknown as boolean,
    })).toThrow("active must be boolean");
  });

  it("requires bounded acquisition identity, consent, and address snapshots", () => {
    const acquisition = {
      id: "acq_one",
      setupIntentId: "seti_one",
      customerId: "user_one",
      stripeCustomerId: "cus_customer",
      plan: toReservedSubscriptionPlanBinding(plan()),
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
      plan: toReservedSubscriptionPlanBinding(plan()),
      quantity: 1,
      shippingAddress: { line1: "", city: "Example", country: "us" },
      consent: {
        termsVersion: "2026-08",
        acceptedAt: "not-a-time",
        source: "checkout",
      },
    })).toThrow();
  });

  it("compares the full canonical acquisition for same-SetupIntent retries", () => {
    const reserved = acquisition();
    expect(subscriptionAcquisitionsEqual(reserved, {
      ...reserved,
      id: "acq_concurrent_loser",
      shippingAddress: { country: "US", city: "Example", line1: "1 Example Way" },
    })).toBe(true);
    for (const changed of [
      { ...reserved, customerId: "user_two" },
      { ...reserved, quantity: 3 },
      {
        ...reserved,
        plan: toReservedSubscriptionPlanBinding(plan({ variantId: "var_two" })),
      },
      { ...reserved, shippingAddress: { ...reserved.shippingAddress, city: "Different" } },
      { ...reserved, consent: { ...reserved.consent, termsVersion: "2026-09" } },
    ]) {
      expect(subscriptionAcquisitionsEqual(reserved, changed)).toBe(false);
    }
    expect(subscriptionAcquisitionsEqual(reserved, {
      ...reserved,
      plan: { ...reserved.plan, shippingRequired: false },
      shippingAddress: undefined,
    })).toBe(false);
    expect(canonicalSubscriptionAcquisition(reserved)).not.toHaveProperty("paymentMethodId");
  });

  it("matches every reserved acquisition field exposed by the provider subscription", () => {
    const reserved = acquisition();
    const provider = {
      acquisitionId: reserved.id,
      planId: reserved.plan.id,
      stripeSubscriptionId: "sub_provider",
      stripeCustomerId: reserved.stripeCustomerId,
      stripePriceId: reserved.plan.stripePriceId,
      price: Money.fromMinor(2500, "USD"),
      cadence: { ...reserved.plan.cadence },
      shippingRequired: true,
      quantity: reserved.quantity,
    };
    expect(() => assertProviderSubscriptionMatchesAcquisition(reserved, provider)).not.toThrow();
    expect(() => assertProviderSubscriptionMatchesAcquisition(
      reserved,
      { ...provider, shippingRequired: undefined },
    )).not.toThrow();

    const mismatches = [
      { ...provider, acquisitionId: "acq_other" },
      { ...provider, planId: "plan_other" },
      { ...provider, stripeCustomerId: "cus_other" },
      { ...provider, stripePriceId: "price_other" },
      { ...provider, price: Money.fromMinor(2501, "USD") },
      { ...provider, price: Money.fromMinor(2500, "EUR") },
      { ...provider, cadence: { unit: "week" as const, count: 1 } },
      { ...provider, cadence: { unit: "month" as const, count: 2 } },
      { ...provider, shippingRequired: false },
      { ...provider, quantity: 1 },
    ];
    for (const mismatch of mismatches) {
      expect(() => assertProviderSubscriptionMatchesAcquisition(reserved, mismatch))
        .toThrow("does not match");
    }
  });

  it("validates the complete authoritative paid-invoice order binding", () => {
    expect(() => assertVerifiedSubscriptionInvoice({
      stripeInvoiceId: "in_renewal",
      stripePaymentIntentId: "pi_renewal",
      paidAmount: Money.fromMinor(2500, "USD"),
      periodStart: 100,
      periodEnd: 200,
      verifiedPaidAt: 201,
    })).not.toThrow();
    expect(() => assertVerifiedSubscriptionInvoice({
      stripeInvoiceId: "in_renewal",
      paidAmount: Money.fromMinor(2500, "USD"),
      periodStart: 200,
      periodEnd: 100,
      verifiedPaidAt: 201,
    })).toThrow("precedes");
    expect(() => assertVerifiedSubscriptionInvoice({
      stripeInvoiceId: "not-an-invoice",
      paidAmount: Money.fromMinor(2500, "USD"),
      verifiedPaidAt: 201,
    })).toThrow("in_");
    expect(() => assertVerifiedSubscriptionInvoice({
      stripeInvoiceId: "in_missing_time",
      paidAmount: Money.fromMinor(2500, "USD"),
      verifiedPaidAt: undefined as unknown as number,
    })).toThrow("verified-paid time");
  });

  it("keeps pause collection separate from active lifecycle status", () => {
    expect(() => assertLifecycleSnapshot({
      status: "active",
      quantity: 1,
      pauseCollection: { behavior: "void", resumesAt: 300 },
      endedAt: 400,
      cancelAtPeriodEnd: false,
    })).not.toThrow();
    expect(() => assertLifecycleSnapshot({
      status: "active",
      quantity: 1,
      pauseCollection: { behavior: "void", extra: true } as never,
      cancelAtPeriodEnd: false,
    })).toThrow("unexpected fields");
    expect(() => assertLifecycleSnapshot({
      status: "active",
      quantity: 1,
      cancelAtPeriodEnd: undefined as unknown as boolean,
    })).toThrow("cancelAtPeriodEnd");
  });

  it("orders lifecycle snapshots monotonically without conflating invoice events", () => {
    const current = { id: "evt_current", createdAt: 200 };
    expect(decideLifecycleEvent(current, { id: "evt_old", createdAt: 199 }))
      .toBe("ignored_stale");
    expect(decideLifecycleEvent(current, current)).toBe("duplicate");
    expect(decideLifecycleEvent(current, { id: "evt_ambiguous", createdAt: 200 }))
      .toBe("refresh_required");
    expect(decideLifecycleEvent(current, { id: "evt_new", createdAt: 201 })).toBe("apply");
    expect(() => decideLifecycleEvent(
      current,
      { id: "evt_missing_time", createdAt: undefined as unknown as number },
    )).toThrow("event timestamp");
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
