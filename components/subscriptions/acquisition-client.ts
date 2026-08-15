import type { Stripe, StripeElements, SetupIntent } from "@stripe/stripe-js";
import type { Address } from "@/lib/types";

export interface PublicSubscriptionPlan {
  id: string;
  product: { id: string; label: string };
  variant: { id: string; label: string };
  price: { amount: number; currency: string; precision: number };
  cadence: { unit: "day" | "week" | "month" | "year"; count: number };
  shippingRequired: boolean;
}

export interface SavedSubscriptionAddress {
  id?: string;
  label?: string;
  is_default?: boolean;
  address: Address;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function plainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function validPlan(value: unknown, variantId: string): value is PublicSubscriptionPlan {
  if (!plainRecord(value) || !plainRecord(value.product) || !plainRecord(value.variant)
    || !plainRecord(value.price) || !plainRecord(value.cadence)) return false;
  return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 128
    && value.variant.id === variantId
    && typeof value.product.id === "string" && typeof value.product.label === "string"
    && typeof value.variant.label === "string"
    && typeof value.price.amount === "number" && Number.isFinite(value.price.amount)
    && value.price.amount > 0 && typeof value.price.currency === "string"
    && /^[A-Z]{3}$/.test(value.price.currency)
    && Number.isSafeInteger(value.price.precision)
    && ["day", "week", "month", "year"].includes(String(value.cadence.unit))
    && Number.isSafeInteger(value.cadence.count) && Number(value.cadence.count) > 0
    && typeof value.shippingRequired === "boolean";
}

export async function fetchSubscriptionPlans(
  fetcher: FetchLike,
  variantId: string,
  signal?: AbortSignal,
): Promise<PublicSubscriptionPlan[]> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(variantId)) return [];
  const query = new URLSearchParams({ variantId, limit: "100", offset: "0" });
  const response = await fetcher(`/api/subscription-plans?${query}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Subscription options could not be loaded");
  const payload: unknown = await response.json();
  if (!plainRecord(payload) || !Array.isArray(payload.plans) || payload.plans.length > 100) {
    throw new Error("Subscription options were invalid");
  }
  return payload.plans.filter((plan) => validPlan(plan, variantId));
}

export async function fetchSavedAddressesForPlan(
  fetcher: FetchLike,
  plan: Pick<PublicSubscriptionPlan, "shippingRequired">,
  signal?: AbortSignal,
): Promise<SavedSubscriptionAddress[]> {
  if (!plan.shippingRequired) return [];
  const response = await fetcher("/api/account/addresses", {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Saved addresses could not be loaded");
  const payload: unknown = await response.json();
  if (!plainRecord(payload) || !Array.isArray(payload.addresses) || payload.addresses.length > 25) {
    throw new Error("Saved addresses were invalid");
  }
  return payload.addresses.filter((entry): entry is SavedSubscriptionAddress => {
    if (!plainRecord(entry) || !plainRecord(entry.address)) return false;
    return (entry.id === undefined || typeof entry.id === "string")
      && typeof entry.address.country === "string"
      && (typeof entry.address.line1 === "string" || plainRecord(entry.address.line1))
      && (typeof entry.address.city === "string" || plainRecord(entry.address.city));
  });
}

export function shippingAddressFromSaved(value: SavedSubscriptionAddress): Address {
  const address = value.address;
  const localized = (
    entry: string | Record<string, string> | undefined,
    label: string,
    max: number,
    required = true,
  ) => {
    const text = typeof entry === "string"
      ? entry
      : entry && Object.values(entry).find((candidate) => candidate.trim().length > 0);
    if (!text?.trim()) {
      if (required) throw new Error(`Saved address ${label} is invalid`);
      return undefined;
    }
    const normalized = text.trim();
    if (normalized.length > max) throw new Error(`Saved address ${label} is invalid`);
    return normalized;
  };
  const optional = (entry: string | undefined, label: string, max: number) => {
    if (entry === undefined || entry === "") return undefined;
    return localized(entry, label, max, false);
  };
  const line2 = localized(address.line2, "line2", 256, false);
  const region = optional(address.region, "region", 128);
  const postalCode = optional(address.postal_code, "postal code", 32);
  const company = optional(address.company, "company", 200);
  const recipient = optional(address.recipient, "recipient", 200);
  const phone = optional(address.phone, "phone", 40);
  const email = optional(address.email, "email", 320);
  const instructions = localized(address.delivery_instructions, "delivery instructions", 500, false);
  const country = address.country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error("Saved address is invalid");
  }
  return {
    line1: localized(address.line1, "line1", 256)!,
    ...(line2 === undefined ? {} : { line2 }),
    city: localized(address.city, "city", 128)!,
    ...(region === undefined ? {} : { region }),
    ...(postalCode === undefined ? {} : { postal_code: postalCode }),
    country,
    ...(company === undefined ? {} : { company }),
    ...(recipient === undefined ? {} : { recipient }),
    ...(phone === undefined ? {} : { phone }),
    ...(email === undefined ? {} : { email }),
    ...(instructions === undefined ? {} : { delivery_instructions: instructions }),
  };
}

export interface SetupAttemptInput {
  planId: string;
  quantity: number;
  shippingAddress?: Address;
  termsVersion: string;
  idempotencyKey: string;
}

export async function createSubscriptionSetupAttempt(
  fetcher: FetchLike,
  input: SetupAttemptInput,
): Promise<{ acquisitionId: string; setupIntentId: string; clientSecret: string }> {
  const response = await fetcher("/api/setup-intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      planId: input.planId,
      quantity: input.quantity,
      ...(input.shippingAddress === undefined ? {} : { shippingAddress: input.shippingAddress }),
      consent: { termsVersion: input.termsVersion, accepted: true },
    }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !plainRecord(payload)
    || typeof payload.acquisitionId !== "string"
    || typeof payload.setupIntentId !== "string" || !payload.setupIntentId.startsWith("seti_")
    || typeof payload.clientSecret !== "string" || payload.clientSecret.length < 1) {
    throw new Error("Secure subscription setup could not be started");
  }
  return {
    acquisitionId: payload.acquisitionId,
    setupIntentId: payload.setupIntentId,
    clientSecret: payload.clientSecret,
  };
}

export interface FinalizedSubscriptionSummary {
  id: string;
  planId: string;
  quantity: number;
  status:
    | "pending" | "provider_created" | "incomplete" | "incomplete_expired"
    | "trialing" | "active" | "past_due" | "paused" | "canceled" | "unpaid";
}

export async function confirmSetupAndFinalize(args: {
  stripe: Pick<Stripe, "confirmSetup">;
  elements: StripeElements;
  fetcher: FetchLike;
  returnUrl: string;
}): Promise<{ setupIntent: SetupIntent; subscription: FinalizedSubscriptionSummary }> {
  const confirmed = await args.stripe.confirmSetup({
    elements: args.elements,
    confirmParams: { return_url: args.returnUrl },
    redirect: "if_required",
  });
  if (confirmed.error) {
    throw new Error(confirmed.error.message || "Payment method setup was not completed");
  }
  if (!confirmed.setupIntent || confirmed.setupIntent.status !== "succeeded") {
    throw new Error("Payment method setup requires additional action");
  }
  const response = await args.fetcher("/api/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setupIntentId: confirmed.setupIntent.id }),
  });
  const payload: unknown = await response.json().catch(() => null);
  const subscription = plainRecord(payload) && plainRecord(payload.subscription)
    ? payload.subscription
    : undefined;
  const statuses = new Set([
    "pending", "provider_created", "incomplete", "incomplete_expired", "trialing",
    "active", "past_due", "paused", "canceled", "unpaid",
  ]);
  if (response.status !== 202 || !subscription
    || typeof subscription.id !== "string" || subscription.id.length < 1 || subscription.id.length > 128
    || subscription.id.trim() !== subscription.id
    || typeof subscription.planId !== "string" || subscription.planId.length < 1
    || subscription.planId.length > 128 || subscription.planId.trim() !== subscription.planId
    || !Number.isSafeInteger(subscription.quantity) || Number(subscription.quantity) < 1
    || Number(subscription.quantity) > 1000
    || typeof subscription.status !== "string" || !statuses.has(subscription.status)) {
    throw new Error("Subscription finalization is temporarily unavailable");
  }
  return {
    setupIntent: confirmed.setupIntent,
    subscription: subscription as unknown as FinalizedSubscriptionSummary,
  };
}

export function attemptFactsKey(args: {
  planId: string;
  quantity: number;
  shippingAddress?: Address;
  termsVersion: string;
}): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (plainRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, canonical(entry)]),
      );
    }
    return value;
  };
  return JSON.stringify(canonical({
    planId: args.planId,
    quantity: args.quantity,
    shippingAddress: args.shippingAddress ?? null,
    termsVersion: args.termsVersion,
  }));
}
