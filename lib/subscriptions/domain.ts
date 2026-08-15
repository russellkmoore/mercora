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
  active: boolean;
}

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
}

export interface SubscriptionAcquisition {
  /** Stable server key used as the Stripe idempotency key. */
  id: string;
  /** Verified SetupIntent identity; contains no payment-method secret. */
  setupIntentId: string;
  customerId: string;
  stripeCustomerId: string;
  plan: SubscriptionPlanBinding;
  quantity: number;
  shippingAddress?: Address;
  consent: SubscriptionConsent;
}

export type ProviderAcquisitionRequest = SubscriptionAcquisition & {
  idempotencyKey: string;
};

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
  assertEpochSeconds(snapshot.currentPeriodStart, "current period start");
  assertEpochSeconds(snapshot.currentPeriodEnd, "current period end");
  assertEpochSeconds(snapshot.cancelAt, "scheduled cancellation");
  assertEpochSeconds(snapshot.canceledAt, "cancellation time");
  if (snapshot.pauseCollection) {
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
  assertSubscriptionPlanBinding(input.plan);
  if (!input.plan.active) throw new TypeError("subscription acquisition requires an active plan");
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 1000) {
    throw new TypeError("subscription quantity must be between 1 and 1000");
  }
  if (input.shippingAddress) assertShippingAddress(input.shippingAddress);
  assertSubscriptionConsent(input.consent);
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
  assertEpochSeconds(current.createdAt, "current lifecycle event timestamp");
  assertEpochSeconds(incoming.createdAt, "incoming lifecycle event timestamp");

  if (incoming.createdAt < current.createdAt) return "ignored_stale";
  if (incoming.createdAt > current.createdAt) return "apply";
  return incoming.id === current.id ? "duplicate" : "refresh_required";
}
