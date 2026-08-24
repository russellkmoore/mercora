import type Stripe from "stripe";
import { Money } from "@/lib/money";
import {
  assertLifecycleSnapshot,
  assertVerifiedSubscriptionInvoice,
  type ProviderSubscriptionBinding,
  type SubscriptionLifecycleSnapshot,
  type VerifiedSubscriptionInvoice,
} from "./domain";

const SETUP_INTENT_STATUSES = new Set([
  "canceled",
  "processing",
  "requires_action",
  "requires_confirmation",
  "requires_payment_method",
  "succeeded",
]);

const SUBSCRIPTION_STATUSES = new Set([
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "paused",
  "trialing",
  "unpaid",
]);

const CADENCE_UNITS = new Set(["day", "week", "month", "year"]);
const PAUSE_BEHAVIORS = new Set(["keep_as_draft", "mark_uncollectible", "void"]);
const FULFILLABLE_BILLING_REASONS = new Set(["subscription_create", "subscription_cycle"]);

function fail(message: string): never {
  throw new Error(`Invalid Stripe subscription data: ${message}`);
}

function assertBoundedString(
  value: unknown,
  label: string,
  { prefix, maxLength = 255 }: { prefix?: string; maxLength?: number } = {},
): asserts value is string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > maxLength
    || value.trim() !== value
    || (prefix !== undefined && (!value.startsWith(prefix) || value.length <= prefix.length))
  ) {
    fail(`${label} is invalid`);
  }
}

function assertSafeNonnegativeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail(`${label} must be a nonnegative safe integer`);
  }
}

function assertSafePositiveInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    fail(`${label} must be a positive safe integer`);
  }
}

function expandableId(
  value: string | { id: string; deleted?: unknown } | null | undefined,
  label: string,
  prefix: string,
): string {
  if (value === null || value === undefined) fail(`${label} is missing`);
  if (typeof value === "object" && "deleted" in value && value.deleted === true) {
    fail(`${label} is deleted`);
  }
  const id = typeof value === "string" ? value : value.id;
  assertBoundedString(id, label, { prefix });
  return id;
}

/** Normalize Stripe's lowercase currency without accepting arbitrary labels. */
export function normalizeStripeCurrency(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z]{3}$/.test(value)) {
    fail("currency must be a three-letter ISO 4217 code");
  }
  return value.toUpperCase();
}

function integerDecimal(value: unknown, label: string): number {
  let serialized = value;
  if (typeof value === "object" && value !== null) {
    const toString = Reflect.get(value, "toString");
    if (typeof toString !== "function") fail(`${label} is not serializable`);
    try {
      serialized = Reflect.apply(toString, value, []);
    } catch {
      fail(`${label} is not serializable`);
    }
  }
  if (typeof serialized !== "string" || !/^\d+(?:\.0+)?$/.test(serialized)) {
    fail(`${label} must be an integer decimal string`);
  }
  const parsed = Number(serialized);
  assertSafeNonnegativeInteger(parsed, label);
  return parsed;
}

function unknownProperty(value: object, key: string): unknown {
  return Reflect.get(value, key);
}

export interface StripeSetupIntentView {
  setupIntentId: string;
  clientSecret: string | null;
  /** Provider-authored epoch seconds, stable across idempotent retries. */
  createdAt: number;
  stripeCustomerId: string;
  status:
    | "canceled"
    | "processing"
    | "requires_action"
    | "requires_confirmation"
    | "requires_payment_method"
    | "succeeded";
  paymentMethodId?: string;
  livemode: boolean;
}

export interface VerifiedStripeSetupIntent extends StripeSetupIntentView {
  status: "succeeded";
  paymentMethodId: string;
}

export interface SetupIntentOwnershipExpectation {
  expectedStripeCustomerId: string;
  expectedCustomerId: string;
  expectedLivemode?: boolean;
}

/** Map an authoritative SetupIntent while proving both provider and Mercora ownership. */
export function mapSetupIntentView(
  setupIntent: Stripe.SetupIntent,
  expectation: SetupIntentOwnershipExpectation,
): StripeSetupIntentView {
  assertBoundedString(setupIntent.id, "SetupIntent id", { prefix: "seti_" });
  assertBoundedString(expectation.expectedStripeCustomerId, "expected customer id", { prefix: "cus_" });
  assertBoundedString(expectation.expectedCustomerId, "expected Mercora customer id", { maxLength: 128 });

  const stripeCustomerId = expandableId(setupIntent.customer, "SetupIntent customer", "cus_");
  if (stripeCustomerId !== expectation.expectedStripeCustomerId) {
    fail("SetupIntent customer does not match the authenticated provider customer");
  }
  if (setupIntent.metadata?.mercora_customer_id !== expectation.expectedCustomerId) {
    fail("SetupIntent metadata does not match the authenticated Mercora customer");
  }
  if (!SETUP_INTENT_STATUSES.has(setupIntent.status)) fail("SetupIntent status is unsupported");
  if (setupIntent.usage !== "off_session") fail("SetupIntent is not authorized for off-session use");
  if (typeof setupIntent.livemode !== "boolean") fail("SetupIntent livemode is invalid");
  if (
    expectation.expectedLivemode !== undefined
    && setupIntent.livemode !== expectation.expectedLivemode
  ) {
    fail("SetupIntent livemode does not match the configured Stripe mode");
  }
  if (setupIntent.client_secret !== null) {
    assertBoundedString(setupIntent.client_secret, "SetupIntent client secret", { maxLength: 500 });
  }
  assertSafeNonnegativeInteger(setupIntent.created, "SetupIntent creation time");

  const paymentMethodId = setupIntent.payment_method === null
    ? undefined
    : expandableId(setupIntent.payment_method, "SetupIntent payment method", "pm_");

  return {
    setupIntentId: setupIntent.id,
    clientSecret: setupIntent.client_secret,
    createdAt: setupIntent.created,
    stripeCustomerId,
    status: setupIntent.status as StripeSetupIntentView["status"],
    ...(paymentMethodId === undefined ? {} : { paymentMethodId }),
    livemode: setupIntent.livemode,
  };
}

export function mapVerifiedSetupIntent(
  setupIntent: Stripe.SetupIntent,
  expectation: SetupIntentOwnershipExpectation,
): VerifiedStripeSetupIntent {
  if (setupIntent.customer === null || typeof setupIntent.customer === "string") {
    fail("verified SetupIntent customer must be authoritatively expanded");
  }
  if ("deleted" in setupIntent.customer) fail("verified SetupIntent customer is deleted");
  if (setupIntent.customer.metadata.mercora_customer_id !== expectation.expectedCustomerId) {
    fail("expanded Stripe customer metadata does not match the authenticated Mercora customer");
  }
  const mapped = mapSetupIntentView(setupIntent, expectation);
  if (mapped.status !== "succeeded") fail("SetupIntent has not succeeded");
  if (mapped.paymentMethodId === undefined) fail("succeeded SetupIntent has no payment method");
  return { ...mapped, status: "succeeded", paymentMethodId: mapped.paymentMethodId };
}

function soleSubscriptionItem(subscription: Stripe.Subscription): Stripe.SubscriptionItem {
  if (subscription.items.has_more || subscription.items.data.length !== 1) {
    fail("subscription must contain exactly one fully retrieved item");
  }
  const item = subscription.items.data[0];
  if (!item) fail("subscription item is missing");
  if (item.deleted !== undefined) fail("subscription item is deleted");
  return item;
}

function mapSubscriptionPrice(item: Stripe.SubscriptionItem): {
  stripePriceId: string;
  price: Money;
  cadence: ProviderSubscriptionBinding["cadence"];
} {
  const price = item.price;
  assertBoundedString(price.id, "subscription price id", { prefix: "price_" });
  if (price.billing_scheme !== "per_unit") fail("subscription price is not per-unit");
  assertSafeNonnegativeInteger(price.unit_amount, "subscription price unit amount");
  if (price.unit_amount_decimal !== null) {
    const decimalAmount = integerDecimal(price.unit_amount_decimal, "subscription price unit amount decimal");
    if (decimalAmount !== price.unit_amount) fail("subscription price amount representations disagree");
  }
  if (price.recurring === null) fail("subscription price is not recurring");
  if (!CADENCE_UNITS.has(price.recurring.interval)) fail("subscription cadence is unsupported");
  assertSafePositiveInteger(price.recurring.interval_count, "subscription cadence count");
  if (price.recurring.interval_count > 365) fail("subscription cadence count exceeds the supported bound");
  if (price.recurring.usage_type !== "licensed") fail("metered subscription prices are unsupported");

  return {
    stripePriceId: price.id,
    price: Money.fromMinor(price.unit_amount, normalizeStripeCurrency(price.currency)),
    cadence: {
      unit: price.recurring.interval as ProviderSubscriptionBinding["cadence"]["unit"],
      count: price.recurring.interval_count,
    },
  };
}

/** Map the immutable binding stamped into and returned by a Stripe subscription. */
export function mapProviderSubscriptionBinding(
  subscription: Stripe.Subscription,
): ProviderSubscriptionBinding {
  assertBoundedString(subscription.id, "subscription id", { prefix: "sub_" });
  const stripeCustomerId = expandableId(subscription.customer, "subscription customer", "cus_");
  const item = soleSubscriptionItem(subscription);
  assertSafePositiveInteger(item.quantity, "subscription quantity");
  if (item.quantity > 1000) fail("subscription quantity exceeds the supported bound");

  const acquisitionId = subscription.metadata?.mercora_acquisition_id;
  const planId = subscription.metadata?.mercora_plan_id;
  const bindingVersion = subscription.metadata?.mercora_binding_version;
  const shippingRequiredValue = subscription.metadata?.mercora_shipping_required;
  assertBoundedString(acquisitionId, "subscription acquisition metadata", { maxLength: 128 });
  assertBoundedString(planId, "subscription plan metadata", { maxLength: 128 });
  let shippingRequired: boolean | undefined;
  if (bindingVersion === undefined && shippingRequiredValue === undefined) {
    shippingRequired = undefined;
  } else if (bindingVersion === "2"
    && (shippingRequiredValue === "true" || shippingRequiredValue === "false")) {
    shippingRequired = shippingRequiredValue === "true";
  } else {
    fail("subscription shipping metadata is invalid");
  }
  const mappedPrice = mapSubscriptionPrice(item);
  if (normalizeStripeCurrency(subscription.currency) !== mappedPrice.price.currency) {
    fail("subscription and price currencies disagree");
  }

  return {
    acquisitionId,
    planId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId,
    stripePriceId: mappedPrice.stripePriceId,
    price: mappedPrice.price,
    cadence: mappedPrice.cadence,
    ...(shippingRequired === undefined ? {} : { shippingRequired }),
    quantity: item.quantity,
  };
}

/** Map lifecycle state; pause_collection deliberately does not alter Stripe status. */
export function mapSubscriptionLifecycle(
  subscription: Stripe.Subscription,
): SubscriptionLifecycleSnapshot {
  assertBoundedString(subscription.id, "subscription id", { prefix: "sub_" });
  if (!SUBSCRIPTION_STATUSES.has(subscription.status)) fail("subscription status is unsupported");
  const item = soleSubscriptionItem(subscription);
  assertSafePositiveInteger(item.quantity, "subscription quantity");
  if (item.quantity > 1000) fail("subscription quantity exceeds the supported bound");
  assertSafeNonnegativeInteger(item.current_period_start, "subscription item period start");
  assertSafeNonnegativeInteger(item.current_period_end, "subscription item period end");
  if (item.current_period_end < item.current_period_start) fail("subscription item period is reversed");
  if (typeof subscription.cancel_at_period_end !== "boolean") {
    fail("subscription cancel_at_period_end is invalid");
  }

  const optionalEpoch = (value: number | null, label: string): number | undefined => {
    if (value === null) return undefined;
    assertSafeNonnegativeInteger(value, label);
    return value;
  };
  const pauseCollection = subscription.pause_collection === null
    ? undefined
    : (() => {
        if (!PAUSE_BEHAVIORS.has(subscription.pause_collection.behavior)) {
          fail("subscription pause behavior is unsupported");
        }
        const resumesAt = optionalEpoch(
          subscription.pause_collection.resumes_at,
          "subscription pause resume time",
        );
        return {
          behavior: subscription.pause_collection.behavior as NonNullable<
            SubscriptionLifecycleSnapshot["pauseCollection"]
          >["behavior"],
          ...(resumesAt === undefined ? {} : { resumesAt }),
        };
      })();
  const cancelAt = optionalEpoch(subscription.cancel_at, "scheduled cancellation");
  const canceledAt = optionalEpoch(subscription.canceled_at, "cancellation time");
  const endedAt = optionalEpoch(subscription.ended_at, "service end time");

  const snapshot: SubscriptionLifecycleSnapshot = {
    status: subscription.status as SubscriptionLifecycleSnapshot["status"],
    quantity: item.quantity,
    currentPeriodStart: item.current_period_start,
    currentPeriodEnd: item.current_period_end,
    ...(pauseCollection === undefined ? {} : { pauseCollection }),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    ...(cancelAt === undefined ? {} : { cancelAt }),
    ...(canceledAt === undefined ? {} : { canceledAt }),
    ...(endedAt === undefined ? {} : { endedAt }),
  };
  assertLifecycleSnapshot(snapshot);
  return snapshot;
}

export interface VerifiedInvoiceExpectation {
  expectedSubscriptionId: string;
  expectedStripeCustomerId: string;
  expectedStripePriceId: string;
  expectedUnitPrice: Money;
  expectedQuantity: number;
}

export interface StripeInvoiceEvidence {
  invoice: Stripe.Invoice;
  lines: readonly Stripe.InvoiceLineItem[];
  payments: readonly Stripe.InvoicePayment[];
}

function assertInvoiceLine(
  invoice: Stripe.Invoice,
  line: Stripe.InvoiceLineItem,
  expectation: VerifiedInvoiceExpectation,
): void {
  if (line.invoice !== invoice.id) fail("invoice line belongs to another invoice");
  if (normalizeStripeCurrency(line.currency) !== expectation.expectedUnitPrice.currency) {
    fail("invoice line currency does not match the reserved plan");
  }
  if (line.quantity !== expectation.expectedQuantity) fail("invoice line quantity does not match the subscription");
  if (integerDecimal(line.quantity_decimal, "invoice line quantity decimal") !== expectation.expectedQuantity) {
    fail("invoice line quantity representations disagree");
  }
  if (line.amount !== expectation.expectedUnitPrice.times(expectation.expectedQuantity).toMinorUnits()) {
    fail("invoice line amount does not match the reserved plan");
  }
  if (line.subscription === null) fail("invoice line subscription is missing");
  if (expandableId(line.subscription, "invoice line subscription", "sub_") !== expectation.expectedSubscriptionId) {
    fail("invoice line belongs to another subscription");
  }
  if (line.parent?.type !== "subscription_item_details") {
    fail("invoice line is not a subscription item");
  }
  const details = line.parent.subscription_item_details;
  if (details === null || details.proration || details.subscription !== expectation.expectedSubscriptionId) {
    fail("invoice line subscription details are not an exact non-proration match");
  }
  if (line.pricing?.type !== "price_details" || line.pricing.price_details === undefined) {
    fail("invoice line price details are missing");
  }
  const stripePriceId = expandableId(
    line.pricing.price_details.price,
    "invoice line price",
    "price_",
  );
  if (stripePriceId !== expectation.expectedStripePriceId) fail("invoice line price does not match the plan");
  if (
    integerDecimal(line.pricing.unit_amount_decimal, "invoice line unit amount")
    !== expectation.expectedUnitPrice.toMinorUnits()
  ) {
    fail("invoice line unit amount does not match the reserved plan");
  }
  assertSafeNonnegativeInteger(line.period.start, "invoice line period start");
  assertSafeNonnegativeInteger(line.period.end, "invoice line period end");
  if (line.period.end < line.period.start) fail("invoice line period is reversed");
}

/** Convert fully retrieved invoice evidence into a domain invoice, or fail closed. */
export function mapVerifiedInvoice(
  evidence: StripeInvoiceEvidence,
  expectation: VerifiedInvoiceExpectation,
): VerifiedSubscriptionInvoice {
  const { invoice, lines, payments } = evidence;
  assertBoundedString(invoice.id, "invoice id", { prefix: "in_" });
  assertBoundedString(expectation.expectedSubscriptionId, "expected subscription id", { prefix: "sub_" });
  assertBoundedString(expectation.expectedStripeCustomerId, "expected customer id", { prefix: "cus_" });
  assertBoundedString(expectation.expectedStripePriceId, "expected price id", { prefix: "price_" });
  if (!(expectation.expectedUnitPrice instanceof Money) || expectation.expectedUnitPrice.isNegative()) {
    fail("expected unit price is invalid");
  }
  assertSafePositiveInteger(expectation.expectedQuantity, "expected quantity");
  if (expectation.expectedQuantity > 1000) fail("expected quantity exceeds the supported bound");

  if (!FULFILLABLE_BILLING_REASONS.has(invoice.billing_reason ?? "")) {
    fail("invoice billing reason is not fulfillable");
  }
  if (invoice.parent?.type !== "subscription_details" || invoice.parent.subscription_details === null) {
    fail("invoice parent is not a subscription");
  }
  if (
    expandableId(
      invoice.parent.subscription_details.subscription,
      "invoice parent subscription",
      "sub_",
    ) !== expectation.expectedSubscriptionId
  ) {
    fail("invoice parent belongs to another subscription");
  }
  if (
    expandableId(invoice.customer, "invoice customer", "cus_")
    !== expectation.expectedStripeCustomerId
  ) {
    fail("invoice customer does not match the subscription owner");
  }
  if (normalizeStripeCurrency(invoice.currency) !== expectation.expectedUnitPrice.currency) {
    fail("invoice currency does not match the reserved plan");
  }

  const expectedPaidAmount = expectation.expectedUnitPrice.times(expectation.expectedQuantity);
  if (
    unknownProperty(invoice, "paid") !== true
    || invoice.status !== "paid"
    || invoice.amount_remaining !== 0
  ) {
    fail("invoice is not authoritatively paid");
  }
  if (invoice.amount_paid !== expectedPaidAmount.toMinorUnits()) {
    fail("invoice paid amount does not match the reserved plan");
  }
  assertSafeNonnegativeInteger(invoice.status_transitions.paid_at, "invoice paid time");
  if (lines.length !== 1) fail("invoice must contain exactly one fully retrieved line");
  const line = lines[0];
  if (!line) fail("invoice line is missing");
  assertInvoiceLine(invoice, line, expectation);

  let paidPaymentTotal = 0;
  let paidPaymentCount = 0;
  const paymentIntentIds = new Set<string>();
  for (const payment of payments) {
    if (payment.status !== "paid") continue;
    paidPaymentCount += 1;
    if (expandableId(payment.invoice, "invoice payment invoice", "in_") !== invoice.id) {
      fail("invoice payment belongs to another invoice");
    }
    if (normalizeStripeCurrency(payment.currency) !== expectation.expectedUnitPrice.currency) {
      fail("invoice payment currency does not match the invoice");
    }
    assertSafeNonnegativeInteger(payment.amount_paid, "invoice payment paid amount");
    assertSafeNonnegativeInteger(payment.status_transitions.paid_at, "invoice payment paid time");
    paidPaymentTotal += payment.amount_paid;
    assertSafeNonnegativeInteger(paidPaymentTotal, "invoice payment paid total");
    if (payment.payment.type === "payment_intent" && payment.payment.payment_intent !== undefined) {
      paymentIntentIds.add(expandableId(
        payment.payment.payment_intent,
        "invoice PaymentIntent",
        "pi_",
      ));
    }
  }
  if (paidPaymentCount > 0 && paidPaymentTotal !== invoice.amount_paid) {
    fail("invoice paid payments do not sum to the invoice amount");
  }
  const [unambiguousPaymentIntentId] = paymentIntentIds;

  const mapped: VerifiedSubscriptionInvoice = {
    stripeInvoiceId: invoice.id,
    ...(paymentIntentIds.size === 1
      ? { stripePaymentIntentId: unambiguousPaymentIntentId }
      : {}),
    paidAmount: expectedPaidAmount,
    periodStart: line.period.start,
    periodEnd: line.period.end,
    verifiedPaidAt: invoice.status_transitions.paid_at,
  };
  assertVerifiedSubscriptionInvoice(mapped);
  return mapped;
}
