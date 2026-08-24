import type { Address } from "@/lib/types";
import { Money } from "@/lib/money";

export const SUBSCRIPTION_STATUSES = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
  "unpaid",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type SubscriptionCadenceUnit = "day" | "week" | "month" | "year";

export interface SubscriptionCadence {
  unit: SubscriptionCadenceUnit;
  count: number;
}

/** Immutable identity of one recurring provider price and catalog variant. */
export interface SubscriptionPlanBinding {
  id: string;
  productId: string;
  variantId: string;
  price: Money;
  stripePriceId: string;
  cadence: SubscriptionCadence;
  shippingRequired: boolean;
  active: boolean;
}

/** Immutable plan facts copied into an acquisition while the live plan is active. */
export type ReservedSubscriptionPlanBinding = Omit<SubscriptionPlanBinding, "active">;

export interface SubscriptionConsent {
  termsVersion: string;
  acceptedAt: string;
  source: "checkout" | "admin" | "migration";
}

export interface LifecycleEventCursor {
  id: string;
  createdAt: number;
}

export type LifecycleEventDecision =
  | "apply"
  | "duplicate"
  | "ignored_stale"
  | "refresh_required";

export interface SubscriptionLifecycleSnapshot {
  status: SubscriptionStatus;
  quantity: number;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  pauseCollection?: {
    behavior: "keep_as_draft" | "mark_uncollectible" | "void";
    resumesAt?: number;
  };
  cancelAtPeriodEnd: boolean;
  cancelAt?: number;
  canceledAt?: number;
  /** Actual end of service; distinct from when cancellation was requested. */
  endedAt?: number;
}

export interface SubscriptionAcquisition {
  /** Stable server key used as the Stripe idempotency key. */
  id: string;
  /** Verified SetupIntent identity; contains no payment-method secret. */
  setupIntentId: string;
  customerId: string;
  stripeCustomerId: string;
  plan: ReservedSubscriptionPlanBinding;
  quantity: number;
  shippingAddress?: Address;
  consent: SubscriptionConsent;
}

export type ProviderAcquisitionRequest = SubscriptionAcquisition & {
  idempotencyKey: string;
};

/** Exact signed/provider subscription fields compared to the reserved acquisition. */
export interface ProviderSubscriptionBinding {
  acquisitionId: string;
  planId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  price: Money;
  cadence: SubscriptionCadence;
  /** Versioned Stripe metadata; absent only for legacy provider bindings. */
  shippingRequired?: boolean;
  quantity: number;
}

export interface VerifiedSubscriptionInvoice {
  stripeInvoiceId: string;
  stripePaymentIntentId?: string;
  paidAmount: Money;
  periodStart?: number;
  periodEnd?: number;
  verifiedPaidAt: number;
}

function assertBoundedId(value: string, label: string, maxLength = 255): void {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength || value.trim() !== value) {
    throw new TypeError(`${label} must be a non-empty bounded identifier`);
  }
}

function assertProviderId(value: string, prefix: string, label: string): void {
  assertBoundedId(value, label);
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    throw new TypeError(`${label} must be a ${prefix} identifier`);
  }
}

function assertEpochSeconds(value: number | undefined, label: string): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
    throw new TypeError(`${label} must be nonnegative integer epoch seconds`);
  }
}

function assertRequiredEpochSeconds(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${label} must be nonnegative integer epoch seconds`);
  }
}

function assertIsoTimestamp(value: string, label: string): void {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new TypeError(`${label} must be a canonical ISO UTC timestamp`);
  }
}

export function assertSubscriptionPlanBinding(plan: SubscriptionPlanBinding): void {
  assertBoundedId(plan.id, "plan id", 128);
  assertBoundedId(plan.productId, "product id", 128);
  assertBoundedId(plan.variantId, "variant id", 128);
  assertProviderId(plan.stripePriceId, "price_", "Stripe price id");
  if (typeof plan.active !== "boolean") {
    throw new TypeError("subscription plan active must be boolean");
  }
  if (typeof plan.shippingRequired !== "boolean") {
    throw new TypeError("subscription plan shippingRequired must be boolean");
  }
  if (!(plan.price instanceof Money) || plan.price.isNegative()) {
    throw new TypeError("subscription price must be nonnegative Money");
  }
  if (plan.active && plan.price.isZero()) {
    throw new TypeError("active subscription plans require a positive price");
  }
  if (!["day", "week", "month", "year"].includes(plan.cadence.unit)) {
    throw new TypeError("subscription cadence unit is invalid");
  }
  if (!Number.isSafeInteger(plan.cadence.count) || plan.cadence.count < 1 || plan.cadence.count > 365) {
    throw new TypeError("subscription cadence count must be between 1 and 365");
  }
}

export function assertReservedSubscriptionPlanBinding(
  plan: ReservedSubscriptionPlanBinding,
): void {
  assertSubscriptionPlanBinding({ ...plan, active: true });
}

/** Snapshot a currently active plan before reserving a durable acquisition. */
export function toReservedSubscriptionPlanBinding(
  plan: SubscriptionPlanBinding,
): ReservedSubscriptionPlanBinding {
  assertSubscriptionPlanBinding(plan);
  if (!plan.active) throw new TypeError("subscription acquisition requires an active plan");
  const { active: _active, ...reserved } = plan;
  return reserved;
}

export function planBindingsEqual(
  left: SubscriptionPlanBinding,
  right: SubscriptionPlanBinding,
): boolean {
  assertSubscriptionPlanBinding(left);
  assertSubscriptionPlanBinding(right);
  return left.id === right.id
    && left.productId === right.productId
    && left.variantId === right.variantId
    && left.price.equals(right.price)
    && left.stripePriceId === right.stripePriceId
    && left.cadence.unit === right.cadence.unit
    && left.cadence.count === right.cadence.count
    && left.shippingRequired === right.shippingRequired
    && left.active === right.active;
}

export function assertSubscriptionConsent(consent: SubscriptionConsent): void {
  assertBoundedId(consent.termsVersion, "subscription terms version", 200);
  assertIsoTimestamp(consent.acceptedAt, "subscription consent acceptedAt");
  if (!["checkout", "admin", "migration"].includes(consent.source)) {
    throw new TypeError("subscription consent source is invalid");
  }
}

export function assertShippingAddress(address: Address): void {
  const localizedPresent = (value: string | Record<string, string>): boolean => {
    if (typeof value === "string") return value.trim().length > 0;
    return Object.values(value).some((entry) => entry.trim().length > 0);
  };
  if (!localizedPresent(address.line1) || !localizedPresent(address.city)) {
    throw new TypeError("subscription shipping address requires line1 and city");
  }
  if (!/^[A-Z]{2}$/.test(address.country)) {
    throw new TypeError("subscription shipping address requires an uppercase ISO country code");
  }
}

export function assertLifecycleSnapshot(snapshot: SubscriptionLifecycleSnapshot): void {
  if (!SUBSCRIPTION_STATUSES.includes(snapshot.status)) {
    throw new TypeError("subscription status is invalid");
  }
  if (!Number.isSafeInteger(snapshot.quantity) || snapshot.quantity < 1 || snapshot.quantity > 1000) {
    throw new TypeError("subscription quantity must be between 1 and 1000");
  }
  if (typeof snapshot.cancelAtPeriodEnd !== "boolean") {
    throw new TypeError("subscription cancelAtPeriodEnd must be boolean");
  }
  assertEpochSeconds(snapshot.currentPeriodStart, "current period start");
  assertEpochSeconds(snapshot.currentPeriodEnd, "current period end");
  assertEpochSeconds(snapshot.cancelAt, "scheduled cancellation");
  assertEpochSeconds(snapshot.canceledAt, "cancellation time");
  assertEpochSeconds(snapshot.endedAt, "service end time");
  if (snapshot.pauseCollection) {
    const unexpectedKeys = Object.keys(snapshot.pauseCollection)
      .filter((key) => key !== "behavior" && key !== "resumesAt");
    if (unexpectedKeys.length > 0) {
      throw new TypeError("subscription pause collection contains unexpected fields");
    }
    if (!["keep_as_draft", "mark_uncollectible", "void"].includes(
      snapshot.pauseCollection.behavior,
    )) {
      throw new TypeError("subscription pause collection behavior is invalid");
    }
    assertEpochSeconds(snapshot.pauseCollection.resumesAt, "pause resume time");
  }
  if (
    snapshot.currentPeriodStart !== undefined
    && snapshot.currentPeriodEnd !== undefined
    && snapshot.currentPeriodEnd < snapshot.currentPeriodStart
  ) {
    throw new TypeError("subscription current period end precedes its start");
  }
}

export function assertSubscriptionAcquisition(input: SubscriptionAcquisition): void {
  assertBoundedId(input.id, "subscription acquisition id", 128);
  assertProviderId(input.setupIntentId, "seti_", "SetupIntent id");
  assertBoundedId(input.customerId, "customer id", 128);
  assertProviderId(input.stripeCustomerId, "cus_", "Stripe customer id");
  assertReservedSubscriptionPlanBinding(input.plan);
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 1000) {
    throw new TypeError("subscription quantity must be between 1 and 1000");
  }
  if (input.shippingAddress) {
    assertShippingAddress({
      ...input.shippingAddress,
      country: input.shippingAddress.country.toUpperCase(),
    });
  }
  if (input.plan.shippingRequired !== (input.shippingAddress !== undefined)) {
    throw new TypeError("subscription shipping address must match its immutable shipping mode");
  }
  assertSubscriptionConsent(input.consent);
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  throw new TypeError("subscription snapshot contains an unsupported value");
}

export function normalizedSubscriptionAddress(address: Address | undefined): unknown {
  if (!address) return undefined;
  assertShippingAddress({ ...address, country: address.country.toUpperCase() });
  return canonicalize({ ...address, country: address.country.toUpperCase() });
}

export function canonicalSubscriptionAcquisition(input: SubscriptionAcquisition): unknown {
  assertSubscriptionAcquisition(input);
  return canonicalize({
    setupIntentId: input.setupIntentId,
    customerId: input.customerId,
    stripeCustomerId: input.stripeCustomerId,
    plan: {
      id: input.plan.id,
      productId: input.plan.productId,
      variantId: input.plan.variantId,
      price: input.plan.price.toJSON(),
      stripePriceId: input.plan.stripePriceId,
      cadence: input.plan.cadence,
      shippingRequired: input.plan.shippingRequired,
    },
    quantity: input.quantity,
    shippingAddress: normalizedSubscriptionAddress(input.shippingAddress),
    consent: input.consent,
  });
}

/** Same-SetupIntent retries may converge only when every reserved fact matches. */
export function subscriptionAcquisitionsEqual(
  left: SubscriptionAcquisition,
  right: SubscriptionAcquisition,
): boolean {
  return JSON.stringify(canonicalSubscriptionAcquisition(left))
    === JSON.stringify(canonicalSubscriptionAcquisition(right));
}

export function assertProviderSubscriptionMatchesAcquisition(
  acquisition: SubscriptionAcquisition,
  provider: ProviderSubscriptionBinding,
): void {
  assertSubscriptionAcquisition(acquisition);
  assertBoundedId(provider.acquisitionId, "provider acquisition id", 128);
  assertBoundedId(provider.planId, "provider plan id", 128);
  assertProviderId(provider.stripeSubscriptionId, "sub_", "Stripe subscription id");
  assertProviderId(provider.stripeCustomerId, "cus_", "Stripe customer id");
  assertProviderId(provider.stripePriceId, "price_", "Stripe price id");
  if (!(provider.price instanceof Money) || provider.price.isNegative()) {
    throw new TypeError("provider subscription price must be nonnegative Money");
  }
  if (!Number.isSafeInteger(provider.quantity) || provider.quantity < 1 || provider.quantity > 1000) {
    throw new TypeError("provider subscription quantity must be between 1 and 1000");
  }
  if (provider.shippingRequired !== undefined && typeof provider.shippingRequired !== "boolean") {
    throw new TypeError("provider subscription shippingRequired must be boolean when present");
  }
  if (!Number.isSafeInteger(provider.cadence.count) || provider.cadence.count < 1 || provider.cadence.count > 365) {
    throw new TypeError("provider subscription cadence count must be between 1 and 365");
  }
  if (!["day", "week", "month", "year"].includes(provider.cadence.unit)) {
    throw new TypeError("provider subscription cadence unit is invalid");
  }

  const exact = provider.acquisitionId === acquisition.id
    && provider.planId === acquisition.plan.id
    && provider.stripeCustomerId === acquisition.stripeCustomerId
    && provider.stripePriceId === acquisition.plan.stripePriceId
    && provider.price.equals(acquisition.plan.price)
    && provider.cadence.unit === acquisition.plan.cadence.unit
    && provider.cadence.count === acquisition.plan.cadence.count
    && (provider.shippingRequired === undefined
      || provider.shippingRequired === acquisition.plan.shippingRequired)
    && provider.quantity === acquisition.quantity;
  if (!exact) throw new Error("Provider subscription does not match the reserved acquisition");
}

export function assertVerifiedSubscriptionInvoice(
  invoice: VerifiedSubscriptionInvoice,
): void {
  assertProviderId(invoice.stripeInvoiceId, "in_", "Stripe invoice id");
  if (invoice.stripePaymentIntentId !== undefined) {
    assertProviderId(invoice.stripePaymentIntentId, "pi_", "Stripe PaymentIntent id");
  }
  if (!(invoice.paidAmount instanceof Money) || invoice.paidAmount.isNegative()) {
    throw new TypeError("verified subscription invoice amount must be nonnegative Money");
  }
  assertEpochSeconds(invoice.periodStart, "invoice period start");
  assertEpochSeconds(invoice.periodEnd, "invoice period end");
  assertRequiredEpochSeconds(invoice.verifiedPaidAt, "invoice verified-paid time");
  if (
    invoice.periodStart !== undefined
    && invoice.periodEnd !== undefined
    && invoice.periodEnd < invoice.periodStart
  ) {
    throw new TypeError("verified subscription invoice period end precedes its start");
  }
}

/** Provider idempotency must always be derived from the durable acquisition row. */
export function toProviderAcquisitionRequest(
  input: SubscriptionAcquisition,
): ProviderAcquisitionRequest {
  assertSubscriptionAcquisition(input);
  return { ...input, idempotencyKey: input.id };
}

/**
 * Decide whether an incoming customer.subscription lifecycle snapshot can
 * advance persisted state. Invoice events deliberately do not use this cursor.
 * Equal timestamps with different ids are ambiguous and require an
 * authoritative provider refresh instead of last-delivery-wins mutation.
 */
export function decideLifecycleEvent(
  current: LifecycleEventCursor,
  incoming: LifecycleEventCursor,
): LifecycleEventDecision {
  assertBoundedId(current.id, "current lifecycle event id");
  assertBoundedId(incoming.id, "incoming lifecycle event id");
  assertRequiredEpochSeconds(current.createdAt, "current lifecycle event timestamp");
  assertRequiredEpochSeconds(incoming.createdAt, "incoming lifecycle event timestamp");

  if (incoming.createdAt < current.createdAt) return "ignored_stale";
  if (incoming.createdAt > current.createdAt) return "apply";
  return incoming.id === current.id ? "duplicate" : "refresh_required";
}
