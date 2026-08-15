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

const MAX_ACQUISITION_RESPONSE_BYTES = 131_072;
const MAX_REDIRECT_URL_BYTES = 8_192;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SETUP_INTENT_PATTERN = /^seti_[A-Za-z0-9]{1,123}$/;
const CLIENT_SECRET_PATTERN = /^seti_[A-Za-z0-9]{1,123}_secret_[A-Za-z0-9]{1,384}$/;
const PLAN_KEYS = new Set(["id", "product", "variant", "price", "cadence", "shippingRequired"]);
const FINAL_STATUSES = new Set([
  "pending", "provider_created", "incomplete", "incomplete_expired", "trialing",
  "active", "past_due", "paused", "canceled", "unpaid",
]);

function plainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function boundedText(value: unknown, maxBytes: number): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0
    && new TextEncoder().encode(value).byteLength <= maxBytes
    && !/[\u0000-\u001f\u007f]/.test(value);
}

async function boundedJson(response: Response): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (declared !== null
    && (!/^\d+$/.test(declared) || Number(declared) > MAX_ACQUISITION_RESPONSE_BYTES)) {
    throw new Error("Subscription response was too large");
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteLength = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_ACQUISITION_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Subscription response was too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // Preserve the safe parse error even if the upstream stream cannot be canceled.
    }
    if (error instanceof Error && error.message === "Subscription response was too large") throw error;
    throw new Error("Subscription response was invalid");
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function amountMinorUnits(amount: number, precision: number): bigint | null {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(precision)
    || precision < 0 || precision > 4) return null;
  const fixed = amount.toFixed(precision);
  if (Number(fixed) !== amount) return null;
  const digits = fixed.replace(".", "");
  if (!/^\d+$/.test(digits)) return null;
  const minor = BigInt(digits);
  return minor > BigInt(0) && minor <= BigInt(Number.MAX_SAFE_INTEGER) ? minor : null;
}

export function recurringTotal(plan: PublicSubscriptionPlan, quantity: number): {
  amount: number;
  formatted: string;
} | null {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000
    || !/^[A-Z]{3}$/.test(plan.price.currency)) return null;
  const unitMinor = amountMinorUnits(plan.price.amount, plan.price.precision);
  if (unitMinor === null) return null;
  const totalMinor = unitMinor * BigInt(quantity);
  if (totalMinor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const scale = 10 ** plan.price.precision;
  const amount = Number(totalMinor) / scale;
  if (!Number.isFinite(amount)) return null;
  try {
    return {
      amount,
      formatted: new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: plan.price.currency,
        minimumFractionDigits: plan.price.precision,
        maximumFractionDigits: plan.price.precision,
      }).format(amount),
    };
  } catch {
    return null;
  }
}

function validPlan(value: unknown, variantId: string): value is PublicSubscriptionPlan {
  if (!plainRecord(value) || !plainRecord(value.product) || !plainRecord(value.variant)
    || !plainRecord(value.price) || !plainRecord(value.cadence)
    || !exactKeys(value, PLAN_KEYS)
    || !exactKeys(value.product, new Set(["id", "label"]))
    || !exactKeys(value.variant, new Set(["id", "label"]))
    || !exactKeys(value.price, new Set(["amount", "currency", "precision"]))
    || !exactKeys(value.cadence, new Set(["unit", "count"]))) return false;
  const structurallyValid = typeof value.id === "string" && ID_PATTERN.test(value.id)
    && value.variant.id === variantId
    && typeof value.product.id === "string" && ID_PATTERN.test(value.product.id)
    && boundedText(value.product.label, 512)
    && boundedText(value.variant.label, 512)
    && typeof value.price.amount === "number" && Number.isFinite(value.price.amount)
    && value.price.amount > 0 && typeof value.price.currency === "string"
    && /^[A-Z]{3}$/.test(value.price.currency)
    && Number.isSafeInteger(value.price.precision) && Number(value.price.precision) >= 0
    && Number(value.price.precision) <= 4
    && ["day", "week", "month", "year"].includes(String(value.cadence.unit))
    && Number.isSafeInteger(value.cadence.count) && Number(value.cadence.count) > 0
    && Number(value.cadence.count) <= 365
    && typeof value.shippingRequired === "boolean";
  return structurallyValid
    && recurringTotal(value as unknown as PublicSubscriptionPlan, 1) !== null;
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
  const payload = await boundedJson(response);
  if (!plainRecord(payload) || !exactKeys(payload, new Set(["plans", "total", "meta"]))
    || !Array.isArray(payload.plans) || payload.plans.length > 100
    || !Number.isSafeInteger(payload.total) || Number(payload.total) < 0
    || !plainRecord(payload.meta) || !exactKeys(payload.meta, new Set(["limit", "offset"]))
    || payload.meta.limit !== 100 || payload.meta.offset !== 0) {
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
  const payload = await boundedJson(response);
  if (!plainRecord(payload) || !Array.isArray(payload.addresses) || payload.addresses.length > 25) {
    throw new Error("Saved addresses were invalid");
  }
  return payload.addresses.filter((entry): entry is SavedSubscriptionAddress => {
    if (!plainRecord(entry) || !plainRecord(entry.address)) return false;
    const shapeValid = typeof entry.id === "string" && ID_PATTERN.test(entry.id)
      && (entry.label === undefined || boundedText(entry.label, 256))
      && (entry.is_default === undefined || typeof entry.is_default === "boolean")
      && typeof entry.address.country === "string"
      && (typeof entry.address.line1 === "string" || plainRecord(entry.address.line1))
      && (typeof entry.address.city === "string" || plainRecord(entry.address.city));
    if (!shapeValid) return false;
    try {
      shippingAddressFromSaved(entry as unknown as SavedSubscriptionAddress);
      return true;
    } catch {
      return false;
    }
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
  signal?: AbortSignal,
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
    signal,
  });
  const payload = await boundedJson(response);
  if (!response.ok || !plainRecord(payload)
    || !exactKeys(payload, new Set(["acquisitionId", "setupIntentId", "clientSecret"]))
    || typeof payload.acquisitionId !== "string" || !ID_PATTERN.test(payload.acquisitionId)
    || typeof payload.setupIntentId !== "string" || !SETUP_INTENT_PATTERN.test(payload.setupIntentId)
    || typeof payload.clientSecret !== "string" || !CLIENT_SECRET_PATTERN.test(payload.clientSecret)) {
    throw new Error("Secure subscription setup could not be started");
  }
  return {
    acquisitionId: payload.acquisitionId,
    setupIntentId: payload.setupIntentId,
    clientSecret: payload.clientSecret,
  };
}

export async function createOwnerBoundSubscriptionSetupAttempt(
  fetcher: FetchLike,
  input: SetupAttemptInput,
  ownerId: string,
  currentOwner: () => string | null,
  signal?: AbortSignal,
): Promise<({ acquisitionId: string; setupIntentId: string; clientSecret: string; ownerId: string }) | null> {
  if (!ID_PATTERN.test(ownerId) || currentOwner() !== ownerId) return null;
  const result = await createSubscriptionSetupAttempt(fetcher, input, signal);
  if (signal?.aborted || currentOwner() !== ownerId) return null;
  return { ...result, ownerId };
}

export interface FinalizedSubscriptionSummary {
  id: string;
  planId: string;
  quantity: number;
  status:
    | "pending" | "provider_created" | "incomplete" | "incomplete_expired"
    | "trialing" | "active" | "past_due" | "paused" | "canceled" | "unpaid";
}

function parseFinalizedSubscription(payload: unknown): FinalizedSubscriptionSummary | null {
  const subscription = plainRecord(payload) && exactKeys(payload, new Set(["subscription"]))
    && plainRecord(payload.subscription) ? payload.subscription : undefined;
  if (!subscription || !exactKeys(subscription, new Set(["id", "planId", "quantity", "status"]))
    || typeof subscription.id !== "string" || !ID_PATTERN.test(subscription.id)
    || typeof subscription.planId !== "string" || !ID_PATTERN.test(subscription.planId)
    || !Number.isSafeInteger(subscription.quantity) || Number(subscription.quantity) < 1
    || Number(subscription.quantity) > 1000
    || typeof subscription.status !== "string" || !FINAL_STATUSES.has(subscription.status)) return null;
  return subscription as unknown as FinalizedSubscriptionSummary;
}

export async function finalizeSubscriptionSetup(
  fetcher: FetchLike,
  setupIntentId: string,
  signal?: AbortSignal,
): Promise<FinalizedSubscriptionSummary> {
  if (!SETUP_INTENT_PATTERN.test(setupIntentId)) {
    throw new Error("Subscription finalization is temporarily unavailable");
  }
  const response = await fetcher("/api/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setupIntentId }),
    signal,
  });
  const subscription = parseFinalizedSubscription(await boundedJson(response));
  if (response.status !== 202 || subscription === null) {
    throw new Error("Subscription finalization is temporarily unavailable");
  }
  return subscription;
}

export async function confirmSetupAndFinalize(args: {
  stripe: Pick<Stripe, "confirmSetup">;
  elements: StripeElements;
  fetcher: FetchLike;
  returnUrl: string;
  signal?: AbortSignal;
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
  if (args.signal?.aborted) throw new DOMException("Subscription setup was canceled", "AbortError");
  const subscription = await finalizeSubscriptionSetup(
    args.fetcher,
    confirmed.setupIntent.id,
    args.signal,
  );
  return {
    setupIntent: confirmed.setupIntent,
    subscription,
  };
}

export type StripeSetupRedirect =
  | { kind: "none" }
  | { kind: "success"; setupIntentId: string; cleanUrl: string }
  | { kind: "failure"; cleanUrl: string }
  | { kind: "malformed"; cleanUrl?: string };

export function parseStripeSetupRedirect(currentUrl: string, expectedOrigin: string): StripeSetupRedirect {
  let url: URL;
  try {
    url = new URL(currentUrl);
  } catch {
    return { kind: "malformed" };
  }
  if (url.origin !== expectedOrigin) return { kind: "malformed" };
  const redirectKeys = ["setup_intent", "setup_intent_client_secret", "redirect_status"] as const;
  const hasRedirect = redirectKeys.some((key) => url.searchParams.has(key));
  if (!hasRedirect) return { kind: "none" };
  const values = Object.fromEntries(redirectKeys.map((key) => [key, url.searchParams.getAll(key)]));
  for (const key of redirectKeys) url.searchParams.delete(key);
  const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
  if (new TextEncoder().encode(currentUrl).byteLength > MAX_REDIRECT_URL_BYTES
    || values.setup_intent.length !== 1 || values.redirect_status.length !== 1
    || values.setup_intent_client_secret.length > 1
    || !SETUP_INTENT_PATTERN.test(values.setup_intent[0] ?? "")) {
    return { kind: "malformed", cleanUrl };
  }
  if (values.redirect_status[0] !== "succeeded") return { kind: "failure", cleanUrl };
  return { kind: "success", setupIntentId: values.setup_intent[0], cleanUrl };
}

export async function completeStripeSetupRedirect(args: {
  fetcher: FetchLike;
  redirect: StripeSetupRedirect;
  ownerId: string | null;
  currentOwner: () => string | null;
  signal?: AbortSignal;
}): Promise<FinalizedSubscriptionSummary | null> {
  if (args.ownerId === null || args.currentOwner() !== args.ownerId || args.redirect.kind === "none") {
    return null;
  }
  if (args.redirect.kind === "failure") throw new Error("Payment method setup was not completed");
  if (args.redirect.kind === "malformed") throw new Error("Payment method setup return was invalid");
  const result = await finalizeSubscriptionSetup(args.fetcher, args.redirect.setupIntentId, args.signal);
  if (args.signal?.aborted || args.currentOwner() !== args.ownerId) return null;
  return result;
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
