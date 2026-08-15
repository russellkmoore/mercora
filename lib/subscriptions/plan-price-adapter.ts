import type Stripe from "stripe";
import type { SubscriptionPlanCadence } from "./plan-service";

export interface SubscriptionPlanPriceExpectation {
  stripePriceId: string;
  currency: string;
  unitAmountMinor: number;
  cadence: SubscriptionPlanCadence;
  requireActive: boolean;
}

export interface SubscriptionPlanPriceVerifier {
  verify(expectation: SubscriptionPlanPriceExpectation): Promise<void>;
}

export class SubscriptionPlanPriceMismatchError extends Error {
  constructor() {
    super("Stripe Price does not match the subscription plan binding");
    this.name = "SubscriptionPlanPriceMismatchError";
  }
}

export class SubscriptionPlanPriceUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Stripe Price verification is temporarily unavailable", { cause });
    this.name = "SubscriptionPlanPriceUnavailableError";
  }
}

export interface StripePlanPriceClient {
  prices: {
    retrieve(id: string): PromiseLike<Stripe.Price>;
  };
}

function matchesIntegerAmount(price: Stripe.Price, expected: number): boolean {
  if (!Number.isSafeInteger(price.unit_amount) || price.unit_amount !== expected) return false;
  const decimal = price.unit_amount_decimal?.toString();
  if (decimal === undefined || !/^(0|[1-9]\d*)$/.test(decimal)) {
    return false;
  }
  const integer = Number(decimal);
  return Number.isSafeInteger(integer) && integer === expected;
}

function isMissingStripePrice(error: unknown): boolean {
  try {
    if (!error || typeof error !== "object") return false;
    const candidate = error as {
      type?: unknown;
      statusCode?: unknown;
      code?: unknown;
      raw?: { code?: unknown };
    };
    return candidate.type === "StripeInvalidRequestError"
      && candidate.statusCode === 404
      && (candidate.code === "resource_missing" || candidate.raw?.code === "resource_missing");
  } catch {
    return false;
  }
}

function matchesExpectation(price: Stripe.Price, expected: SubscriptionPlanPriceExpectation): boolean {
  return price.id === expected.stripePriceId
    && price.object === "price"
    && (price as Stripe.Price & { deleted?: boolean }).deleted !== true
    && typeof price.active === "boolean"
    && (!expected.requireActive || price.active === true)
    && price.billing_scheme === "per_unit"
    && price.type === "recurring"
    && price.currency === expected.currency.toLowerCase()
    && matchesIntegerAmount(price, expected.unitAmountMinor)
    && price.custom_unit_amount === null
    && price.transform_quantity === null
    && price.recurring !== null
    && price.recurring.usage_type === "licensed"
    && price.recurring.interval === expected.cadence.unit
    && price.recurring.interval_count === expected.cadence.count;
}

/** Read-only Stripe v22 verifier for pre-existing Price bindings. */
export function createStripePlanPriceVerifier(
  client: StripePlanPriceClient,
): SubscriptionPlanPriceVerifier {
  return {
    async verify(expectation) {
      let price: Stripe.Price;
      try {
        price = await client.prices.retrieve(expectation.stripePriceId);
      } catch (error) {
        if (isMissingStripePrice(error)) throw new SubscriptionPlanPriceMismatchError();
        throw new SubscriptionPlanPriceUnavailableError(error);
      }
      let matches = false;
      try { matches = matchesExpectation(price, expectation); } catch { matches = false; }
      if (!matches) {
        throw new SubscriptionPlanPriceMismatchError();
      }
    },
  };
}

/** Defers Stripe SDK/config resolution until a write actually needs verification. */
export function createLazyStripePlanPriceVerifier(
  getClient: () => StripePlanPriceClient | PromiseLike<StripePlanPriceClient>,
): SubscriptionPlanPriceVerifier {
  let verifier: Promise<SubscriptionPlanPriceVerifier> | undefined;
  return {
    async verify(expectation) {
      verifier ??= Promise.resolve().then(getClient).then(createStripePlanPriceVerifier);
      try {
        await (await verifier).verify(expectation);
      } catch (error) {
        if (error instanceof SubscriptionPlanPriceMismatchError ||
            error instanceof SubscriptionPlanPriceUnavailableError) throw error;
        throw new SubscriptionPlanPriceUnavailableError(error);
      }
    },
  };
}
