import type Stripe from "stripe";
import {
  assertProviderSubscriptionMatchesAcquisition,
  assertSubscriptionAcquisition,
  type ProviderAcquisitionRequest,
  type ProviderSubscriptionBinding,
  type SubscriptionLifecycleSnapshot,
  type VerifiedSubscriptionInvoice,
} from "./domain";
import type { SubscriptionProvider } from "./ports";
import {
  mapProviderSubscriptionBinding,
  mapSetupIntentView,
  mapSubscriptionLifecycle,
  mapVerifiedInvoice,
  mapVerifiedSetupIntent,
  type SetupIntentOwnershipExpectation,
  type StripeSetupIntentView,
  type VerifiedInvoiceExpectation,
  type VerifiedStripeSetupIntent,
} from "./stripe-mappers";

interface StripePage<T> {
  data: T[];
  has_more: boolean;
}

type StripePromise<T> = PromiseLike<T>;

/** The smallest Stripe v22 surface used by subscription orchestration. */
export interface StripeSubscriptionClient {
  customers: {
    create(
      params: Stripe.CustomerCreateParams,
      options?: Stripe.RequestOptions,
    ): StripePromise<Stripe.Customer>;
    retrieve(id: string): StripePromise<Stripe.Customer | Stripe.DeletedCustomer>;
  };
  setupIntents: {
    create(
      params?: Stripe.SetupIntentCreateParams,
      options?: Stripe.RequestOptions,
    ): StripePromise<Stripe.SetupIntent>;
    retrieve(
      id: string,
      params?: Stripe.SetupIntentRetrieveParams,
    ): StripePromise<Stripe.SetupIntent>;
  };
  subscriptions: {
    create(
      params: Stripe.SubscriptionCreateParams,
      options?: Stripe.RequestOptions,
    ): StripePromise<Stripe.Subscription>;
    retrieve(id: string): StripePromise<Stripe.Subscription>;
    update(
      id: string,
      params?: Stripe.SubscriptionUpdateParams,
      options?: Stripe.RequestOptions,
    ): StripePromise<Stripe.Subscription>;
    cancel(
      id: string,
      params?: Stripe.SubscriptionCancelParams,
      options?: Stripe.RequestOptions,
    ): StripePromise<Stripe.Subscription>;
  };
  invoices: {
    retrieve(id: string): StripePromise<Stripe.Invoice>;
    listLineItems(
      id: string,
      params?: Stripe.InvoiceListLineItemsParams,
    ): StripePromise<StripePage<Stripe.InvoiceLineItem>>;
  };
  invoicePayments: {
    list(params?: Stripe.InvoicePaymentListParams): StripePromise<StripePage<Stripe.InvoicePayment>>;
  };
}

export interface CreateProviderCustomerRequest {
  customerId: string;
  email?: string;
  name?: string;
  idempotencyKey: string;
}

export interface ProviderCustomerBinding {
  customerId: string;
  stripeCustomerId: string;
  livemode: boolean;
}

export interface CreateStripeSetupIntentRequest {
  customerId: string;
  stripeCustomerId: string;
  idempotencyKey: string;
  expectedLivemode?: boolean;
}

export type RetrieveVerifiedSetupIntentRequest = SetupIntentOwnershipExpectation & {
  setupIntentId: string;
};

export type RetrieveVerifiedInvoiceRequest = VerifiedInvoiceExpectation & {
  stripeInvoiceId: string;
};

export interface AuthoritativeStripeSubscription {
  binding: ProviderSubscriptionBinding;
  snapshot: SubscriptionLifecycleSnapshot;
}

const MAX_PROVIDER_ID_LENGTH = 255;
const STRIPE_PAGE_SIZE = 100;
const MAX_STRIPE_PAGES = 10;
const MAX_STRIPE_ITEMS = STRIPE_PAGE_SIZE * MAX_STRIPE_PAGES;
const PAUSE_COLLECTION_BEHAVIOR = "void" as const;

function invalid(message: string): never {
  throw new Error(`Invalid Stripe subscription request: ${message}`);
}

function boundedString(
  value: unknown,
  label: string,
  { prefix, maxLength = MAX_PROVIDER_ID_LENGTH }: { prefix?: string; maxLength?: number } = {},
): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > maxLength
    || value.trim() !== value
    || (prefix !== undefined && (!value.startsWith(prefix) || value.length <= prefix.length))
  ) {
    invalid(`${label} is invalid`);
  }
  return value;
}

function optionalBoundedString(value: string | undefined, label: string, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  return boundedString(value, label, { maxLength });
}

function expandableId(
  value: string | { id: string; deleted?: unknown },
  label: string,
  prefix: string,
): string {
  if (typeof value === "object" && "deleted" in value && value.deleted === true) {
    invalid(`${label} is deleted`);
  }
  return boundedString(typeof value === "string" ? value : value.id, label, { prefix });
}

async function retrieveAllPages<T extends { id: string }>(
  label: string,
  fetchPage: (startingAfter: string | undefined) => StripePromise<StripePage<T>>,
): Promise<T[]> {
  const all: T[] = [];
  const seen = new Set<string>();
  let startingAfter: string | undefined;

  for (let pageNumber = 0; pageNumber < MAX_STRIPE_PAGES; pageNumber += 1) {
    const page = await fetchPage(startingAfter);
    if (!Array.isArray(page.data) || typeof page.has_more !== "boolean") {
      invalid(`${label} page is malformed`);
    }
    if (page.data.length > STRIPE_PAGE_SIZE) invalid(`${label} page exceeds the requested bound`);

    for (const item of page.data) {
      const id = boundedString(item.id, `${label} item id`);
      if (seen.has(id)) invalid(`${label} pagination repeated an item`);
      seen.add(id);
      all.push(item);
      if (all.length > MAX_STRIPE_ITEMS) invalid(`${label} exceeds the total item bound`);
    }
    if (!page.has_more) return all;
    const last = page.data.at(-1);
    if (last === undefined || last.id === startingAfter) invalid(`${label} pagination did not advance`);
    startingAfter = last.id;
  }

  invalid(`${label} exceeds ${MAX_STRIPE_PAGES} pages`);
}

function mapProviderCustomer(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
  expectedCustomerId: string,
): ProviderCustomerBinding {
  const customerId = boundedString(expectedCustomerId, "Mercora customer id", { maxLength: 128 });
  if ("deleted" in customer) invalid("Stripe customer is deleted");
  const stripeCustomerId = boundedString(customer.id, "Stripe customer id", { prefix: "cus_" });
  if (customer.metadata.mercora_customer_id !== customerId) {
    invalid("Stripe customer metadata does not match the Mercora customer");
  }
  if (typeof customer.livemode !== "boolean") invalid("Stripe customer livemode is invalid");
  return { customerId, stripeCustomerId, livemode: customer.livemode };
}

export class StripeSubscriptionAdapter implements SubscriptionProvider {
  readonly #client: StripeSubscriptionClient;

  constructor(client: StripeSubscriptionClient) {
    this.#client = client;
  }

  async createProviderCustomer(
    request: CreateProviderCustomerRequest,
  ): Promise<ProviderCustomerBinding> {
    const customerId = boundedString(request.customerId, "Mercora customer id", { maxLength: 128 });
    const idempotencyKey = boundedString(request.idempotencyKey, "customer idempotency key", {
      maxLength: 255,
    });
    const email = optionalBoundedString(request.email, "customer email", 320);
    const name = optionalBoundedString(request.name, "customer name", 200);
    const customer = await this.#client.customers.create({
      metadata: { mercora_customer_id: customerId },
      ...(email === undefined ? {} : { email }),
      ...(name === undefined ? {} : { name }),
    }, { idempotencyKey });
    return mapProviderCustomer(customer, customerId);
  }

  async retrieveProviderCustomer(args: {
    customerId: string;
    stripeCustomerId: string;
    expectedLivemode?: boolean;
  }): Promise<ProviderCustomerBinding> {
    const stripeCustomerId = boundedString(args.stripeCustomerId, "Stripe customer id", {
      prefix: "cus_",
    });
    const mapped = mapProviderCustomer(
      await this.#client.customers.retrieve(stripeCustomerId),
      args.customerId,
    );
    if (args.expectedLivemode !== undefined && mapped.livemode !== args.expectedLivemode) {
      invalid("Stripe customer livemode does not match the configured Stripe mode");
    }
    return mapped;
  }

  async createSetupIntent(
    request: CreateStripeSetupIntentRequest,
  ): Promise<StripeSetupIntentView> {
    const customerId = boundedString(request.customerId, "Mercora customer id", { maxLength: 128 });
    const stripeCustomerId = boundedString(request.stripeCustomerId, "Stripe customer id", {
      prefix: "cus_",
    });
    const idempotencyKey = boundedString(request.idempotencyKey, "SetupIntent idempotency key", {
      maxLength: 255,
    });
    const setupIntent = await this.#client.setupIntents.create({
      customer: stripeCustomerId,
      metadata: { mercora_customer_id: customerId },
      payment_method_types: ["card"],
      usage: "off_session",
    }, { idempotencyKey });
    const mapped = mapSetupIntentView(setupIntent, {
      expectedStripeCustomerId: stripeCustomerId,
      expectedCustomerId: customerId,
      ...(request.expectedLivemode === undefined
        ? {}
        : { expectedLivemode: request.expectedLivemode }),
    });
    if (mapped.clientSecret === null) invalid("new SetupIntent has no client secret");
    return mapped;
  }

  async retrieveVerifiedSetupIntent(
    request: RetrieveVerifiedSetupIntentRequest,
  ): Promise<VerifiedStripeSetupIntent> {
    const setupIntentId = boundedString(request.setupIntentId, "SetupIntent id", { prefix: "seti_" });
    const setupIntent = await this.#client.setupIntents.retrieve(setupIntentId, {
      expand: ["customer"],
    });
    return mapVerifiedSetupIntent(setupIntent, request);
  }

  async createSubscription(
    request: ProviderAcquisitionRequest,
  ): Promise<ProviderSubscriptionBinding> {
    assertSubscriptionAcquisition(request);
    const idempotencyKey = boundedString(request.idempotencyKey, "subscription idempotency key", {
      maxLength: 255,
    });
    if (idempotencyKey !== request.id) invalid("subscription idempotency key must equal acquisition id");
    const setupIntent = await this.retrieveVerifiedSetupIntent({
      setupIntentId: request.setupIntentId,
      expectedStripeCustomerId: request.stripeCustomerId,
      expectedCustomerId: request.customerId,
    });
    const subscription = await this.#client.subscriptions.create({
      customer: request.stripeCustomerId,
      default_payment_method: setupIntent.paymentMethodId,
      items: [{ price: request.plan.stripePriceId, quantity: request.quantity }],
      metadata: {
        mercora_acquisition_id: request.id,
        mercora_plan_id: request.plan.id,
        mercora_setup_intent_id: request.setupIntentId,
        mercora_binding_version: "2",
        mercora_shipping_required: request.plan.shippingRequired ? "true" : "false",
      },
      collection_method: "charge_automatically",
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["items.data.price"],
    }, { idempotencyKey });
    const mapped = mapProviderSubscriptionBinding(subscription);
    assertProviderSubscriptionMatchesAcquisition(request, mapped);
    return mapped;
  }

  async retrieveProviderSubscriptionBinding(
    stripeSubscriptionId: string,
  ): Promise<ProviderSubscriptionBinding> {
    const id = boundedString(stripeSubscriptionId, "subscription id", { prefix: "sub_" });
    return mapProviderSubscriptionBinding(await this.#client.subscriptions.retrieve(id));
  }

  /** One provider read validates immutable identity and mutable lifecycle together. */
  async retrieveAuthoritativeLifecycle(
    stripeSubscriptionId: string,
  ): Promise<AuthoritativeStripeSubscription> {
    const id = boundedString(stripeSubscriptionId, "subscription id", { prefix: "sub_" });
    const subscription = await this.#client.subscriptions.retrieve(id);
    return {
      binding: mapProviderSubscriptionBinding(subscription),
      snapshot: mapSubscriptionLifecycle(subscription),
    };
  }

  async retrieveLifecycle(
    stripeSubscriptionId: string,
  ): Promise<SubscriptionLifecycleSnapshot> {
    const id = boundedString(stripeSubscriptionId, "subscription id", { prefix: "sub_" });
    return mapSubscriptionLifecycle(await this.#client.subscriptions.retrieve(id));
  }

  async pauseCollection(
    request: { stripeSubscriptionId: string; behavior: "void"; idempotencyKey: string },
  ): Promise<SubscriptionLifecycleSnapshot> {
    const id = boundedString(request.stripeSubscriptionId, "subscription id", { prefix: "sub_" });
    const idempotencyKey = boundedString(request.idempotencyKey, "pause idempotency key");
    if (request.behavior !== PAUSE_COLLECTION_BEHAVIOR) invalid("pause collection behavior is unsupported");
    const updated = await this.#client.subscriptions.update(id, {
      pause_collection: { behavior: PAUSE_COLLECTION_BEHAVIOR },
    }, { idempotencyKey });
    return mapSubscriptionLifecycle(updated);
  }

  async resumeCollection(
    request: { stripeSubscriptionId: string; idempotencyKey: string },
  ): Promise<SubscriptionLifecycleSnapshot> {
    const id = boundedString(request.stripeSubscriptionId, "subscription id", { prefix: "sub_" });
    const idempotencyKey = boundedString(request.idempotencyKey, "resume idempotency key");
    const updated = await this.#client.subscriptions.update(
      id,
      { pause_collection: "" },
      { idempotencyKey },
    );
    return mapSubscriptionLifecycle(updated);
  }

  async cancelAtPeriodEnd(
    stripeSubscriptionId: string,
    idempotencyKey: string,
  ): Promise<SubscriptionLifecycleSnapshot> {
    const id = boundedString(stripeSubscriptionId, "subscription id", { prefix: "sub_" });
    const key = boundedString(idempotencyKey, "cancel idempotency key");
    const updated = await this.#client.subscriptions.update(
      id,
      { cancel_at_period_end: true },
      { idempotencyKey: key },
    );
    return mapSubscriptionLifecycle(updated);
  }

  async cancelSubscription(request: {
    stripeSubscriptionId: string;
    mode: "period_end" | "immediate";
    idempotencyKey: string;
  }): Promise<SubscriptionLifecycleSnapshot> {
    const id = boundedString(request.stripeSubscriptionId, "subscription id", { prefix: "sub_" });
    const idempotencyKey = boundedString(request.idempotencyKey, "cancel idempotency key");
    if (request.mode === "period_end") return this.cancelAtPeriodEnd(id, idempotencyKey);
    if (request.mode !== "immediate") invalid("subscription cancellation mode is unsupported");
    const canceled = await this.#client.subscriptions.cancel(id, {
      invoice_now: false,
      prorate: false,
    }, { idempotencyKey });
    return mapSubscriptionLifecycle(canceled);
  }

  async retrieveVerifiedInvoice(
    request: RetrieveVerifiedInvoiceRequest,
  ): Promise<VerifiedSubscriptionInvoice> {
    const stripeInvoiceId = boundedString(request.stripeInvoiceId, "invoice id", { prefix: "in_" });
    const invoice = await this.#client.invoices.retrieve(stripeInvoiceId);
    const lines = await retrieveAllPages(
      "invoice lines",
      (startingAfter) => this.#client.invoices.listLineItems(stripeInvoiceId, {
        limit: STRIPE_PAGE_SIZE,
        ...(startingAfter === undefined ? {} : { starting_after: startingAfter }),
      }),
    );
    const payments = await retrieveAllPages(
      "invoice payments",
      (startingAfter) => this.#client.invoicePayments.list({
        invoice: stripeInvoiceId,
        limit: STRIPE_PAGE_SIZE,
        ...(startingAfter === undefined ? {} : { starting_after: startingAfter }),
      }),
    );
    return mapVerifiedInvoice({ invoice, lines, payments }, request);
  }
}

export function createStripeSubscriptionAdapter(
  client: StripeSubscriptionClient,
): StripeSubscriptionAdapter {
  return new StripeSubscriptionAdapter(client);
}
