import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { Money } from "@/lib/money";
import {
  createStripeSubscriptionAdapter,
  type StripeSubscriptionClient,
} from "@/lib/subscriptions/stripe-provider";
import { toReservedSubscriptionPlanBinding } from "@/lib/subscriptions";

function stripeFixture<T>(value: Partial<T>): T {
  return value as T;
}

function customer(overrides: Partial<Stripe.Customer> = {}): Stripe.Customer {
  return stripeFixture<Stripe.Customer>({
    id: "cus_one",
    object: "customer",
    livemode: false,
    metadata: { mercora_customer_id: "user_one" },
    ...overrides,
  });
}

function setupIntent(overrides: Partial<Stripe.SetupIntent> = {}): Stripe.SetupIntent {
  return stripeFixture<Stripe.SetupIntent>({
    id: "seti_one",
    object: "setup_intent",
    client_secret: "seti_one_secret_example",
    created: 1_800_000_000,
    customer: customer(),
    livemode: false,
    metadata: { mercora_customer_id: "user_one" },
    payment_method: "pm_one",
    status: "succeeded",
    usage: "off_session",
    ...overrides,
  });
}

function subscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  const price = stripeFixture<Stripe.Price>({
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
  });
  const item = stripeFixture<Stripe.SubscriptionItem>({
    id: "si_one",
    object: "subscription_item",
    current_period_start: 1_800_000_000,
    current_period_end: 1_802_678_400,
    price,
    quantity: 2,
    subscription: "sub_one",
  });
  return stripeFixture<Stripe.Subscription>({
    id: "sub_one",
    object: "subscription",
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    currency: "usd",
    customer: "cus_one",
    ended_at: null,
    items: { object: "list", data: [item], has_more: false, url: "/items" },
    metadata: {
      mercora_acquisition_id: "acq_one",
      mercora_plan_id: "plan_one",
      mercora_binding_version: "2",
      mercora_shipping_required: "true",
    },
    pause_collection: null,
    status: "active",
    ...overrides,
  });
}

function invoiceLine(id = "il_one"): Stripe.InvoiceLineItem {
  return stripeFixture<Stripe.InvoiceLineItem>({
    id,
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
  });
}

function invoice(): Stripe.Invoice {
  return stripeFixture<Stripe.Invoice & { paid: boolean }>({
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
      subscription_details: { metadata: null, subscription: "sub_one" },
    },
    status: "paid",
    status_transitions: {
      finalized_at: 1_800_000_001,
      marked_uncollectible_at: null,
      paid_at: 1_800_000_002,
      voided_at: null,
    },
  });
}

function invoicePayment(args: {
  id: string;
  status: "open" | "paid";
  amountPaid: number | null;
  paymentIntentId?: string;
}): Stripe.InvoicePayment {
  return stripeFixture<Stripe.InvoicePayment>({
    id: args.id,
    object: "invoice_payment",
    amount_paid: args.amountPaid,
    amount_requested: 5000,
    currency: "usd",
    invoice: "in_one",
    payment: args.paymentIntentId === undefined
      ? { type: "payment_record", payment_record: "pr_one" }
      : { type: "payment_intent", payment_intent: args.paymentIntentId },
    status: args.status,
    status_transitions: {
      canceled_at: null,
      paid_at: args.status === "paid" ? 1_800_000_002 : null,
    },
  });
}

function makeClient() {
  const mocks = {
    customerCreate: vi.fn(async () => customer()),
    customerRetrieve: vi.fn(async () => customer()),
    setupIntentCreate: vi.fn(async () => setupIntent({
      customer: "cus_one",
      payment_method: null,
      status: "requires_payment_method",
    })),
    setupIntentRetrieve: vi.fn(async () => setupIntent()),
    subscriptionCreate: vi.fn(async () => subscription()),
    subscriptionRetrieve: vi.fn(async () => subscription()),
    subscriptionUpdate: vi.fn(async () => subscription()),
    subscriptionCancel: vi.fn(async () => subscription({
      status: "canceled",
      canceled_at: 1_800_000_100,
      ended_at: 1_800_000_100,
    })),
    invoiceRetrieve: vi.fn(async () => invoice()),
    lineList: vi.fn(async () => ({ data: [invoiceLine()], has_more: false })),
    paymentList: vi.fn(async (): Promise<{
      data: Stripe.InvoicePayment[];
      has_more: boolean;
    }> => ({ data: [], has_more: false })),
  };
  const client: StripeSubscriptionClient = {
    customers: { create: mocks.customerCreate, retrieve: mocks.customerRetrieve },
    setupIntents: { create: mocks.setupIntentCreate, retrieve: mocks.setupIntentRetrieve },
    subscriptions: {
      create: mocks.subscriptionCreate,
      retrieve: mocks.subscriptionRetrieve,
      update: mocks.subscriptionUpdate,
      cancel: mocks.subscriptionCancel,
    },
    invoices: { retrieve: mocks.invoiceRetrieve, listLineItems: mocks.lineList },
    invoicePayments: { list: mocks.paymentList },
  };
  return { adapter: createStripeSubscriptionAdapter(client), mocks };
}

function acquisition() {
  return {
    id: "acq_one",
    idempotencyKey: "acq_one",
    setupIntentId: "seti_one",
    customerId: "user_one",
    stripeCustomerId: "cus_one",
    plan: toReservedSubscriptionPlanBinding({
      id: "plan_one",
      productId: "prod_one",
      variantId: "var_one",
      price: Money.fromMinor(2500, "USD"),
      stripePriceId: "price_monthly",
      cadence: { unit: "month" as const, count: 1 },
      shippingRequired: true,
      active: true,
    }),
    quantity: 2,
    shippingAddress: { line1: "1 Main", city: "Denver", country: "US" },
    consent: {
      termsVersion: "2026-08",
      acceptedAt: "2026-08-14T00:00:00.000Z",
      source: "checkout" as const,
    },
  };
}

describe("Stripe subscription adapter", () => {
  it("creates and revalidates provider customers with trusted metadata", async () => {
    const { adapter, mocks } = makeClient();
    await expect(adapter.createProviderCustomer({
      customerId: "user_one",
      email: "customer@example.com",
      name: "Customer",
      idempotencyKey: "customer_user_one",
    })).resolves.toMatchObject({ customerId: "user_one", stripeCustomerId: "cus_one" });
    expect(mocks.customerCreate).toHaveBeenCalledWith({
      metadata: { mercora_customer_id: "user_one" },
      email: "customer@example.com",
      name: "Customer",
    }, { idempotencyKey: "customer_user_one" });
    await expect(adapter.retrieveProviderCustomer({
      customerId: "user_one",
      stripeCustomerId: "cus_one",
      expectedLivemode: false,
    })).resolves.toMatchObject({ stripeCustomerId: "cus_one", livemode: false });
  });

  it("creates off-session SetupIntents and expands live customer ownership on verification", async () => {
    const { adapter, mocks } = makeClient();
    await expect(adapter.createSetupIntent({
      customerId: "user_one",
      stripeCustomerId: "cus_one",
      idempotencyKey: "setup_user_one",
    })).resolves.toMatchObject({
      setupIntentId: "seti_one",
      createdAt: 1_800_000_000,
      stripeCustomerId: "cus_one",
      status: "requires_payment_method",
    });
    expect(mocks.setupIntentCreate).toHaveBeenCalledWith({
      customer: "cus_one",
      metadata: { mercora_customer_id: "user_one" },
      payment_method_types: ["card"],
      usage: "off_session",
    }, { idempotencyKey: "setup_user_one" });
    await expect(adapter.retrieveVerifiedSetupIntent({
      setupIntentId: "seti_one",
      expectedStripeCustomerId: "cus_one",
      expectedCustomerId: "user_one",
    })).resolves.toMatchObject({ status: "succeeded", paymentMethodId: "pm_one" });
    expect(mocks.setupIntentRetrieve).toHaveBeenCalledWith("seti_one", { expand: ["customer"] });
  });

  it("creates one exact subscription with the durable acquisition idempotency key", async () => {
    const { adapter, mocks } = makeClient();
    await expect(adapter.createSubscription(acquisition())).resolves.toMatchObject({
      acquisitionId: "acq_one",
      stripeSubscriptionId: "sub_one",
      stripePriceId: "price_monthly",
      quantity: 2,
    });
    expect(mocks.subscriptionCreate).toHaveBeenCalledWith(expect.objectContaining({
      customer: "cus_one",
      default_payment_method: "pm_one",
      items: [{ price: "price_monthly", quantity: 2 }],
      payment_behavior: "default_incomplete",
      metadata: expect.objectContaining({
        mercora_acquisition_id: "acq_one",
        mercora_plan_id: "plan_one",
        mercora_binding_version: "2",
        mercora_shipping_required: "true",
      }),
    }), { idempotencyKey: "acq_one" });
  });

  it("maps binding and lifecycle from one authoritative subscription read", async () => {
    const { adapter, mocks } = makeClient();
    await expect(adapter.retrieveAuthoritativeLifecycle("sub_one")).resolves.toMatchObject({
      binding: { stripeSubscriptionId: "sub_one", acquisitionId: "acq_one" },
      snapshot: { status: "active", quantity: 2 },
    });
    expect(mocks.subscriptionRetrieve).toHaveBeenCalledTimes(1);
  });

  it("uses fixed pause/resume and explicit cancellation policies", async () => {
    const { adapter, mocks } = makeClient();
    await adapter.pauseCollection({
      stripeSubscriptionId: "sub_one", behavior: "void", idempotencyKey: "pause_one",
    });
    await adapter.resumeCollection({ stripeSubscriptionId: "sub_one", idempotencyKey: "resume_one" });
    await adapter.cancelSubscription({
      stripeSubscriptionId: "sub_one", mode: "period_end", idempotencyKey: "cancel_period_one",
    });
    await adapter.cancelSubscription({
      stripeSubscriptionId: "sub_one", mode: "immediate", idempotencyKey: "cancel_now_one",
    });
    expect(mocks.subscriptionUpdate).toHaveBeenNthCalledWith(1, "sub_one", {
      pause_collection: { behavior: "void" },
    }, { idempotencyKey: "pause_one" });
    expect(mocks.subscriptionUpdate).toHaveBeenNthCalledWith(
      2,
      "sub_one",
      { pause_collection: "" },
      { idempotencyKey: "resume_one" },
    );
    expect(mocks.subscriptionUpdate).toHaveBeenNthCalledWith(
      3,
      "sub_one",
      { cancel_at_period_end: true },
      { idempotencyKey: "cancel_period_one" },
    );
    expect(mocks.subscriptionCancel).toHaveBeenCalledWith("sub_one", {
      invoice_now: false,
      prorate: false,
    }, { idempotencyKey: "cancel_now_one" });
  });

  it("fully paginates invoice evidence before rejecting an extra line", async () => {
    const { adapter, mocks } = makeClient();
    mocks.lineList
      .mockResolvedValueOnce({ data: [invoiceLine("il_one")], has_more: true })
      .mockResolvedValueOnce({ data: [invoiceLine("il_two")], has_more: false });
    await expect(adapter.retrieveVerifiedInvoice({
      stripeInvoiceId: "in_one",
      expectedSubscriptionId: "sub_one",
      expectedStripeCustomerId: "cus_one",
      expectedStripePriceId: "price_monthly",
      expectedUnitPrice: Money.fromMinor(2500, "USD"),
      expectedQuantity: 2,
    })).rejects.toThrow("exactly one fully retrieved line");
    expect(mocks.lineList).toHaveBeenNthCalledWith(1, "in_one", { limit: 100 });
    expect(mocks.lineList).toHaveBeenNthCalledWith(2, "in_one", {
      limit: 100,
      starting_after: "il_one",
    });
  });

  it("fully paginates InvoicePayments and returns only an unambiguous PaymentIntent", async () => {
    const { adapter, mocks } = makeClient();
    mocks.paymentList
      .mockResolvedValueOnce({
        data: [invoicePayment({ id: "inpay_open", status: "open", amountPaid: null })],
        has_more: true,
      })
      .mockResolvedValueOnce({
        data: [invoicePayment({
          id: "inpay_paid",
          status: "paid",
          amountPaid: 5000,
          paymentIntentId: "pi_one",
        })],
        has_more: false,
      });
    await expect(adapter.retrieveVerifiedInvoice({
      stripeInvoiceId: "in_one",
      expectedSubscriptionId: "sub_one",
      expectedStripeCustomerId: "cus_one",
      expectedStripePriceId: "price_monthly",
      expectedUnitPrice: Money.fromMinor(2500, "USD"),
      expectedQuantity: 2,
    })).resolves.toMatchObject({ stripeInvoiceId: "in_one", stripePaymentIntentId: "pi_one" });
    expect(mocks.paymentList).toHaveBeenNthCalledWith(1, { invoice: "in_one", limit: 100 });
    expect(mocks.paymentList).toHaveBeenNthCalledWith(2, {
      invoice: "in_one",
      limit: 100,
      starting_after: "inpay_open",
    });
  });
});
