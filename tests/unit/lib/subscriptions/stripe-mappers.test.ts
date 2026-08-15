import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { Money } from "@/lib/money";
import {
  mapProviderSubscriptionBinding,
  mapSetupIntentView,
  mapSubscriptionLifecycle,
  mapVerifiedInvoice,
  mapVerifiedSetupIntent,
  normalizeStripeCurrency,
} from "@/lib/subscriptions/stripe-mappers";

function stripeFixture<T>(value: Partial<T>): T {
  return value as T;
}

function setupIntent(overrides: Partial<Stripe.SetupIntent> = {}): Stripe.SetupIntent {
  return stripeFixture<Stripe.SetupIntent>({
    id: "seti_one",
    object: "setup_intent",
    client_secret: "seti_one_secret_example",
    created: 1_800_000_000,
    customer: stripeFixture<Stripe.Customer>({
      id: "cus_one",
      object: "customer",
      livemode: false,
      metadata: { mercora_customer_id: "user_one" },
    }),
    livemode: false,
    metadata: { mercora_customer_id: "user_one" },
    payment_method: "pm_one",
    status: "succeeded",
    usage: "off_session",
    ...overrides,
  });
}

function price(overrides: Partial<Stripe.Price> = {}): Stripe.Price {
  return stripeFixture<Stripe.Price>({
    id: "price_monthly",
    object: "price",
    active: true,
    billing_scheme: "per_unit",
    currency: "usd",
    recurring: {
      interval: "month",
      interval_count: 1,
      meter: null,
      trial_period_days: null,
      usage_type: "licensed",
    },
    unit_amount: 2500,
    unit_amount_decimal: Stripe.Decimal.from("2500"),
    ...overrides,
  });
}

function subscriptionItem(overrides: Partial<Stripe.SubscriptionItem> = {}): Stripe.SubscriptionItem {
  return stripeFixture<Stripe.SubscriptionItem>({
    id: "si_one",
    object: "subscription_item",
    current_period_start: 1_800_000_000,
    current_period_end: 1_802_678_400,
    price: price(),
    quantity: 2,
    subscription: "sub_one",
    ...overrides,
  });
}

function subscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return stripeFixture<Stripe.Subscription>({
    id: "sub_one",
    object: "subscription",
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    currency: "usd",
    customer: "cus_one",
    ended_at: null,
    items: {
      object: "list",
      data: [subscriptionItem()],
      has_more: false,
      url: "/v1/subscription_items?subscription=sub_one",
    },
    metadata: {
      mercora_acquisition_id: "acq_one",
      mercora_plan_id: "plan_one",
    },
    pause_collection: null,
    status: "active",
    ...overrides,
  });
}

function invoiceLine(overrides: Partial<Stripe.InvoiceLineItem> = {}): Stripe.InvoiceLineItem {
  return stripeFixture<Stripe.InvoiceLineItem>({
    id: "il_one",
    object: "line_item",
    amount: 5000,
    currency: "usd",
    invoice: "in_one",
    parent: {
      type: "subscription_item_details",
      invoice_item_details: null,
      subscription_item_details: {
        invoice_item: null,
        proration: false,
        proration_details: null,
        subscription: "sub_one",
        subscription_item: "si_one",
      },
    },
    period: { start: 1_800_000_000, end: 1_802_678_400 },
    pricing: stripeFixture<Stripe.InvoiceLineItem.Pricing>({
      type: "price_details",
      price_details: { price: "price_monthly", product: "prod_one" },
      unit_amount_decimal: Stripe.Decimal.from("2500"),
    }),
    quantity: 2,
    quantity_decimal: Stripe.Decimal.from("2"),
    subscription: "sub_one",
    ...overrides,
  });
}

type InvoiceWithPaid = Stripe.Invoice & { paid: boolean };

function invoice(overrides: Partial<InvoiceWithPaid> = {}): InvoiceWithPaid {
  return stripeFixture<InvoiceWithPaid>({
    id: "in_one",
    object: "invoice",
    amount_paid: 5000,
    amount_remaining: 0,
    billing_reason: "subscription_cycle",
    currency: "usd",
    customer: "cus_one",
    paid: true,
    parent: {
      type: "subscription_details",
      quote_details: null,
      subscription_details: {
        metadata: { mercora_acquisition_id: "acq_one" },
        subscription: "sub_one",
      },
    },
    status: "paid",
    status_transitions: {
      finalized_at: 1_800_000_001,
      marked_uncollectible_at: null,
      paid_at: 1_800_000_002,
      voided_at: null,
    },
    ...overrides,
  });
}

function invoicePayment(
  id: string,
  amount: number,
  payment: Stripe.InvoicePayment.Payment,
  overrides: Partial<Stripe.InvoicePayment> = {},
): Stripe.InvoicePayment {
  return stripeFixture<Stripe.InvoicePayment>({
    id,
    object: "invoice_payment",
    amount_paid: amount,
    amount_requested: amount,
    currency: "usd",
    invoice: "in_one",
    payment,
    status: "paid",
    status_transitions: { canceled_at: null, paid_at: 1_800_000_002 },
    ...overrides,
  });
}

const ownership = {
  expectedStripeCustomerId: "cus_one",
  expectedCustomerId: "user_one",
};

const invoiceExpectation = {
  expectedSubscriptionId: "sub_one",
  expectedStripeCustomerId: "cus_one",
  expectedStripePriceId: "price_monthly",
  expectedUnitPrice: Money.fromMinor(2500, "USD"),
  expectedQuantity: 2,
};

describe("Stripe subscription mappers", () => {
  it("proves SetupIntent ownership, off-session authority, status, mode, and provider time", () => {
    expect(mapSetupIntentView(setupIntent({ status: "requires_payment_method", payment_method: null }), ownership))
      .toMatchObject({
        setupIntentId: "seti_one",
        createdAt: 1_800_000_000,
        stripeCustomerId: "cus_one",
        status: "requires_payment_method",
        livemode: false,
      });
    expect(mapVerifiedSetupIntent(setupIntent(), ownership)).toMatchObject({
      status: "succeeded",
      paymentMethodId: "pm_one",
    });
    expect(() => mapVerifiedSetupIntent(setupIntent({ status: "processing" }), ownership))
      .toThrow("has not succeeded");
    expect(() => mapVerifiedSetupIntent(setupIntent({ customer: "cus_one" }), ownership))
      .toThrow("authoritatively expanded");
    expect(() => mapVerifiedSetupIntent(setupIntent({
      customer: stripeFixture<Stripe.Customer>({
        id: "cus_other",
        object: "customer",
        livemode: false,
        metadata: { mercora_customer_id: "user_one" },
      }),
    }), ownership))
      .toThrow("customer does not match");
    expect(() => mapVerifiedSetupIntent(setupIntent({ usage: "on_session" }), ownership))
      .toThrow("off-session");
    expect(() => mapVerifiedSetupIntent(
      setupIntent({ metadata: { mercora_customer_id: "user_other" } }),
      ownership,
    )).toThrow("Mercora customer");
    expect(() => mapVerifiedSetupIntent(setupIntent(), { ...ownership, expectedLivemode: true }))
      .toThrow("livemode");
  });

  it("maps an exact single licensed subscription even after its Stripe Price is inactive", () => {
    const inactiveItem = subscriptionItem({ price: price({ active: false }) });
    const provider = mapProviderSubscriptionBinding(subscription({
      items: { object: "list", data: [inactiveItem], has_more: false, url: "/items" },
    }));
    expect(provider).toMatchObject({
      acquisitionId: "acq_one",
      planId: "plan_one",
      stripeSubscriptionId: "sub_one",
      stripeCustomerId: "cus_one",
      stripePriceId: "price_monthly",
      cadence: { unit: "month", count: 1 },
      quantity: 2,
    });
    expect(provider.price.equals(Money.fromMinor(2500, "USD"))).toBe(true);
    expect(() => mapProviderSubscriptionBinding(subscription({
      items: { object: "list", data: [subscriptionItem()], has_more: true, url: "/items" },
    }))).toThrow("exactly one");
    expect(() => mapProviderSubscriptionBinding(subscription({
      items: {
        object: "list",
        data: [subscriptionItem({ price: price({ billing_scheme: "tiered" }) })],
        has_more: false,
        url: "/items",
      },
    }))).toThrow("per-unit");
  });

  it("maps item periods and pause collection without rewriting lifecycle status", () => {
    expect(mapSubscriptionLifecycle(subscription({
      status: "active",
      pause_collection: { behavior: "void", resumes_at: 1_800_100_000 },
      cancel_at_period_end: true,
      cancel_at: 1_802_678_400,
      canceled_at: 1_800_010_000,
      ended_at: null,
    }))).toEqual({
      status: "active",
      quantity: 2,
      currentPeriodStart: 1_800_000_000,
      currentPeriodEnd: 1_802_678_400,
      pauseCollection: { behavior: "void", resumesAt: 1_800_100_000 },
      cancelAtPeriodEnd: true,
      cancelAt: 1_802_678_400,
      canceledAt: 1_800_010_000,
    });
    expect(() => mapSubscriptionLifecycle(subscription({
      items: {
        object: "list",
        data: [subscriptionItem({ current_period_start: 10, current_period_end: 9 })],
        has_more: false,
        url: "/items",
      },
    }))).toThrow("reversed");
  });

  it("requires the authoritative paid invoice facts and exact immutable line binding", () => {
    const mapped = mapVerifiedInvoice({
      invoice: invoice(),
      lines: [invoiceLine()],
      payments: [invoicePayment(
        "inpay_one",
        5000,
        { type: "payment_intent", payment_intent: "pi_one" },
      )],
    }, invoiceExpectation);
    expect(mapped.stripePaymentIntentId).toBe("pi_one");
    expect(mapped.paidAmount.equals(Money.fromMinor(5000, "USD"))).toBe(true);

    for (const invalidInvoice of [
      invoice({ paid: false }),
      invoice({ status: "open" }),
      invoice({ amount_remaining: 1 }),
      invoice({ amount_paid: 4999 }),
      invoice({ billing_reason: "subscription_update" }),
    ]) {
      expect(() => mapVerifiedInvoice({
        invoice: invalidInvoice,
        lines: [invoiceLine()],
        payments: [],
      }, invoiceExpectation)).toThrow();
    }
    expect(() => mapVerifiedInvoice({
      invoice: invoice(),
      lines: [invoiceLine({ quantity: 1 })],
      payments: [],
    }, invoiceExpectation)).toThrow("quantity");
    expect(() => mapVerifiedInvoice({
      invoice: invoice(),
      lines: [invoiceLine({ amount: 4999 })],
      payments: [],
    }, invoiceExpectation)).toThrow("amount");
  });

  it("accepts no payment records and omits ambiguous PaymentIntent identity", () => {
    expect(mapVerifiedInvoice({ invoice: invoice(), lines: [invoiceLine()], payments: [] }, invoiceExpectation))
      .not.toHaveProperty("stripePaymentIntentId");

    const mapped = mapVerifiedInvoice({
      invoice: invoice(),
      lines: [invoiceLine()],
      payments: [
        invoicePayment("inpay_one", 2000, { type: "payment_intent", payment_intent: "pi_one" }),
        invoicePayment("inpay_two", 3000, { type: "payment_intent", payment_intent: "pi_two" }),
      ],
    }, invoiceExpectation);
    expect(mapped).not.toHaveProperty("stripePaymentIntentId");
    expect(() => mapVerifiedInvoice({
      invoice: invoice(),
      lines: [invoiceLine()],
      payments: [invoicePayment(
        "inpay_wrong",
        5000,
        { type: "payment_record", payment_record: "pr_one" },
        { invoice: "in_other" },
      )],
    }, invoiceExpectation)).toThrow("another invoice");
  });

  it("normalizes only bounded three-letter currencies", () => {
    expect(normalizeStripeCurrency("usd")).toBe("USD");
    expect(() => normalizeStripeCurrency("USDT")).toThrow("three-letter");
  });
});
