import { describe, expect, it, vi } from "vitest";
import StripeServer, { type Stripe as StripeNamespace } from "stripe";
import {
  createLazyStripePlanPriceVerifier,
  createStripePlanPriceVerifier,
  SubscriptionPlanPriceMismatchError,
  SubscriptionPlanPriceUnavailableError,
} from "@/lib/subscriptions/plan-price-adapter";

type StripePrice = StripeNamespace.Price;

function price(overrides: Partial<StripePrice> = {}): StripePrice {
  return {
    id: "price_monthly",
    object: "price",
    active: true,
    billing_scheme: "per_unit",
    created: 1,
    currency: "usd",
    custom_unit_amount: null,
    livemode: false,
    lookup_key: null,
    metadata: {},
    nickname: null,
    product: "prod_stripe",
    recurring: {
      interval: "month",
      interval_count: 1,
      meter: null,
      trial_period_days: null,
      usage_type: "licensed",
    },
    tax_behavior: "unspecified",
    tiers_mode: null,
    transform_quantity: null,
    type: "recurring",
    unit_amount: 1299,
    unit_amount_decimal: StripeServer.Decimal.from("1299"),
    ...overrides,
  };
}

const EXPECTED = {
  stripePriceId: "price_monthly",
  currency: "USD",
  unitAmountMinor: 1299,
  cadence: { unit: "month" as const, count: 1 },
  requireActive: true,
};

const MISMATCHES: Partial<StripePrice>[] = [
  { id: "price_other" },
  { currency: "eur" },
  { unit_amount: 9999, unit_amount_decimal: StripeServer.Decimal.from("9999") },
  { unit_amount: 1299, unit_amount_decimal: StripeServer.Decimal.from("1299.5") },
  { billing_scheme: "tiered" },
  { type: "one_time", recurring: null },
  { recurring: { ...price().recurring!, usage_type: "metered" } },
  { recurring: { ...price().recurring!, interval: "year" } },
  { recurring: { ...price().recurring!, interval_count: 2 } },
  { transform_quantity: { divide_by: 2, round: "up" } },
  { custom_unit_amount: { minimum: 1, maximum: 2000, preset: 1299 } },
];

describe("Stripe plan Price verifier", () => {
  it("accepts only an exact active licensed recurring integer Price", async () => {
    const retrieve = vi.fn(async () => price());
    const verifier = createStripePlanPriceVerifier({ prices: { retrieve } });
    await expect(verifier.verify(EXPECTED)).resolves.toBeUndefined();
    expect(retrieve).toHaveBeenCalledWith("price_monthly");
  });

  it.each(MISMATCHES)("rejects mismatched billing authority: %o", async (override) => {
    const verifier = createStripePlanPriceVerifier({
      prices: { retrieve: async () => price(override) },
    });
    await expect(verifier.verify(EXPECTED)).rejects.toBeInstanceOf(SubscriptionPlanPriceMismatchError);
  });

  it("rejects an inactive Price when activating but permits exact inactive staging", async () => {
    const verifier = createStripePlanPriceVerifier({
      prices: { retrieve: async () => price({ active: false }) },
    });
    await expect(verifier.verify(EXPECTED)).rejects.toBeInstanceOf(SubscriptionPlanPriceMismatchError);
    await expect(verifier.verify({ ...EXPECTED, requireActive: false })).resolves.toBeUndefined();
  });

  it("wraps provider read failures without exposing the provider message", async () => {
    const verifier = createStripePlanPriceVerifier({
      prices: { retrieve: async () => { throw new Error("secret provider response"); } },
    });
    const failure = verifier.verify(EXPECTED);
    await expect(failure).rejects.toBeInstanceOf(SubscriptionPlanPriceUnavailableError);
    await expect(failure).rejects.not.toThrow(/secret provider response/);
  });

  it("classifies a definitive missing Stripe Price as an operator mismatch", async () => {
    const verifier = createStripePlanPriceVerifier({
      prices: {
        retrieve: async () => {
          throw {
            type: "StripeInvalidRequestError",
            statusCode: 404,
            code: "resource_missing",
            message: "No such price: price_secret_identifier",
          };
        },
      },
    });
    const failure = verifier.verify(EXPECTED);
    await expect(failure).rejects.toBeInstanceOf(SubscriptionPlanPriceMismatchError);
    await expect(failure).rejects.not.toThrow(/price_secret_identifier/);
  });

  it("does not resolve the provider factory until verification and caches it thereafter", async () => {
    const retrieve = vi.fn(async () => price());
    const getClient = vi.fn(async () => ({ prices: { retrieve } }));
    const verifier = createLazyStripePlanPriceVerifier(getClient);
    expect(getClient).not.toHaveBeenCalled();
    expect(retrieve).not.toHaveBeenCalled();
    await verifier.verify(EXPECTED);
    await verifier.verify(EXPECTED);
    expect(getClient).toHaveBeenCalledTimes(1);
    expect(retrieve).toHaveBeenCalledTimes(2);
  });
});
