import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyTestMigrations } from "../../helpers/d1";
import { Money } from "@/lib/money";
import {
  createSubscriptionRepository,
  SubscriptionAcquisitionConflictError,
} from "@/lib/subscriptions/repository";
import type {
  ProviderSubscriptionBinding,
  SubscriptionAcquisition,
} from "@/lib/subscriptions/domain";

async function seed() {
  await env.DB.prepare(`INSERT INTO products
    (id, name, status, fulfillment_type) VALUES ('prod', 'Tea', 'active', 'physical')`).run();
  await env.DB.prepare(`INSERT INTO product_variants
    (id, product_id, sku, status, option_values, price, shipping_required)
    VALUES ('var', 'prod', 'SKU', 'active', '[]', ?, 1)`)
    .bind(JSON.stringify({ amount: 1250, currency: "USD" })).run();
  await env.DB.prepare(`INSERT INTO customers (id, type, person)
    VALUES ('user_one', 'person', ?)`).bind(JSON.stringify({ email: "one@example.test" })).run();
  await env.DB.prepare(`INSERT INTO subscription_plans
    (id, product_id, variant_id, currency_code, unit_amount_minor,
     stripe_price_id, cadence_unit, cadence_count, is_active)
    VALUES ('plan', 'prod', 'var', 'USD', 1100, 'price_plan', 'month', 1, 1)`).run();
}

function acquisition(overrides: Partial<SubscriptionAcquisition> = {}): SubscriptionAcquisition {
  return {
    id: "acq_one",
    setupIntentId: "seti_one",
    customerId: "user_one",
    stripeCustomerId: "cus_one",
    plan: {
      id: "plan",
      productId: "prod",
      variantId: "var",
      price: Money.fromMinor(1100, "USD"),
      stripePriceId: "price_plan",
      cadence: { unit: "month", count: 1 },
    },
    quantity: 1,
    shippingAddress: { line1: "1 Main", city: "Denver", country: "US" },
    consent: {
      termsVersion: "terms-1",
      acceptedAt: "2026-08-14T00:00:00.000Z",
      source: "checkout",
    },
    ...overrides,
  };
}

function provider(acq: SubscriptionAcquisition): ProviderSubscriptionBinding {
  return {
    acquisitionId: acq.id,
    planId: acq.plan.id,
    stripeSubscriptionId: "sub_one",
    stripeCustomerId: acq.stripeCustomerId,
    stripePriceId: acq.plan.stripePriceId,
    price: acq.plan.price,
    cadence: acq.plan.cadence,
    quantity: acq.quantity,
  };
}

describe("subscription repository on D1", () => {
  beforeAll(async () => {
    await applyTestMigrations();
  });

  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM subscription_events"),
      env.DB.prepare("DELETE FROM subscription_invoice_orders"),
      env.DB.prepare("DELETE FROM customer_subscriptions"),
      env.DB.prepare("DELETE FROM subscription_acquisitions"),
      env.DB.prepare("DELETE FROM subscription_provider_customers"),
      env.DB.prepare("DELETE FROM subscription_plans"),
      env.DB.prepare("DELETE FROM orders WHERE customer_id IN ('user_one', 'user_two')"),
      env.DB.prepare("DELETE FROM product_variants WHERE id = 'var'"),
      env.DB.prepare("DELETE FROM products WHERE id = 'prod'"),
      env.DB.prepare("DELETE FROM customers WHERE id IN ('user_one', 'user_two')"),
    ]);
    await seed();
  });

  it("requires active catalog facts and returns shipping authority", async () => {
    const repo = createSubscriptionRepository(env.DB);
    await expect(repo.findPlanById("plan", "USD")).resolves.toMatchObject({
      id: "plan",
      active: true,
      shippingRequired: true,
    });
    await env.DB.prepare("UPDATE product_variants SET status = 'inactive' WHERE id = 'var'").run();
    await expect(repo.findPlanById("plan", "USD")).resolves.toBeUndefined();
  });

  it("converges provider-customer and identical SetupIntent reservations", async () => {
    const repo = createSubscriptionRepository(env.DB);
    await expect(repo.bindProviderCustomer({ customerId: "user_one", stripeCustomerId: "cus_one" }))
      .resolves.toBe("created");
    await expect(repo.bindProviderCustomer({ customerId: "user_one", stripeCustomerId: "cus_one" }))
      .resolves.toBe("identical");

    const candidate = acquisition();
    const [left, right] = await Promise.all([
      repo.reserveAcquisition(candidate),
      repo.reserveAcquisition(candidate),
    ]);
    expect([left.created, right.created].sort()).toEqual([false, true]);
    await expect(repo.reserveAcquisition(acquisition({ quantity: 2 })))
      .rejects.toBeInstanceOf(SubscriptionAcquisitionConflictError);
  });

  it("does not revive a failed acquisition from a lifecycle event", async () => {
    const repo = createSubscriptionRepository(env.DB);
    await repo.bindProviderCustomer({ customerId: "user_one", stripeCustomerId: "cus_one" });
    const candidate = acquisition();
    await repo.reserveAcquisition(candidate);
    const binding = provider(candidate);
    await repo.recordProviderCreated({ acquisition: candidate, provider: binding });
    await env.DB.prepare("UPDATE subscription_acquisitions SET status = 'failed' WHERE id = 'acq_one'").run();

    await expect(repo.completeAcquisitionFromLifecycleWebhook({
      acquisition: candidate,
      provider: binding,
      lifecycle: { status: "active", quantity: 1, cancelAtPeriodEnd: false },
      lifecycleEvent: { id: "evt_one", createdAt: 10 },
    })).rejects.toBeInstanceOf(SubscriptionAcquisitionConflictError);
    const count = await env.DB.prepare("SELECT count(*) AS count FROM customer_subscriptions")
      .first<{ count: number }>();
    expect(count?.count).toBe(0);
  });

  it("completes only an exact provider-created acquisition and appends audit idempotently", async () => {
    const repo = createSubscriptionRepository(env.DB);
    await repo.bindProviderCustomer({ customerId: "user_one", stripeCustomerId: "cus_one" });
    const candidate = acquisition();
    await repo.reserveAcquisition(candidate);
    const binding = provider(candidate);
    await repo.recordProviderCreated({ acquisition: candidate, provider: binding });
    const completed = await repo.completeAcquisitionFromLifecycleWebhook({
      acquisition: candidate,
      provider: binding,
      lifecycle: { status: "active", quantity: 1, cancelAtPeriodEnd: false },
      lifecycleEvent: { id: "evt_one", createdAt: 10 },
    });
    expect(completed.created).toBe(true);
    await expect(repo.completeAcquisitionFromLifecycleWebhook({
      acquisition: candidate,
      provider: binding,
      lifecycle: { status: "active", quantity: 1, cancelAtPeriodEnd: false },
      lifecycleEvent: { id: "evt_one", createdAt: 10 },
    })).resolves.toEqual({ id: completed.id, created: false });
    const event = {
      id: "subevent_evt_one",
      subscriptionId: completed.id,
      providerEvent: { id: "evt_one", createdAt: 10 },
      eventType: "created" as const,
      outcome: "applied" as const,
      details: { source: "webhook" },
    };
    await expect(repo.recordSubscriptionEvent(event)).resolves.toBe(true);
    await expect(repo.recordSubscriptionEvent(event)).resolves.toBe(false);
  });

  it("does not complete when the deterministic local subscription id is occupied", async () => {
    const repo = createSubscriptionRepository(env.DB);
    await repo.bindProviderCustomer({ customerId: "user_one", stripeCustomerId: "cus_one" });
    const candidate = acquisition();
    const binding = provider(candidate);
    await repo.reserveAcquisition(candidate);
    await repo.recordProviderCreated({ acquisition: candidate, provider: binding });
    await env.DB.prepare(`INSERT INTO customers (id, type, person)
      VALUES ('user_two', 'person', '{}')`).run();
    await env.DB.prepare(`INSERT INTO subscription_provider_customers
      (customer_id, stripe_customer_id) VALUES ('user_two', 'cus_two')`).run();
    await env.DB.prepare(`INSERT INTO subscription_acquisitions
      (id, setup_intent_id, plan_id, product_id, variant_id, currency_code,
       unit_amount_minor, stripe_price_id, cadence_unit, cadence_count,
       customer_id, stripe_customer_id, quantity, consent_record, status,
       stripe_subscription_id)
      VALUES ('other', 'seti_other', 'plan', 'prod', 'var', 'USD', 1100,
       'price_plan', 'month', 1, 'user_two', 'cus_two', 1, ?,
       'provider_created', 'sub_two')`).bind(JSON.stringify(candidate.consent)).run();
    await env.DB.prepare(`INSERT INTO customer_subscriptions
      (id, plan_id, customer_id, acquisition_id, stripe_subscription_id,
       stripe_customer_id, quantity, status, consent_record,
       latest_lifecycle_event_created_at, latest_lifecycle_event_id)
      VALUES ('subscription_acq_one', 'plan', 'user_two', 'other', 'sub_two',
       'cus_two', 1, 'active', ?, 1, 'evt_other')`)
      .bind(JSON.stringify(candidate.consent)).run();

    await expect(repo.completeAcquisitionFromLifecycleWebhook({
      acquisition: candidate,
      provider: binding,
      lifecycle: { status: "active", quantity: 1, cancelAtPeriodEnd: false },
      lifecycleEvent: { id: "evt_one", createdAt: 10 },
    })).rejects.toBeInstanceOf(SubscriptionAcquisitionConflictError);
    const row = await env.DB.prepare("SELECT status FROM subscription_acquisitions WHERE id = 'acq_one'")
      .first<{ status: string }>();
    expect(row?.status).toBe("provider_created");
  });

  it("does not complete when the provider subscription is attached under another local id", async () => {
    const repo = createSubscriptionRepository(env.DB);
    await repo.bindProviderCustomer({ customerId: "user_one", stripeCustomerId: "cus_one" });
    const candidate = acquisition();
    const binding = provider(candidate);
    await repo.reserveAcquisition(candidate);
    await repo.recordProviderCreated({ acquisition: candidate, provider: binding });
    await env.DB.prepare(`INSERT INTO customer_subscriptions
      (id, plan_id, customer_id, acquisition_id, stripe_subscription_id,
       stripe_customer_id, quantity, status, shipping_address, consent_record,
       latest_lifecycle_event_created_at, latest_lifecycle_event_id)
      VALUES ('subscription_other', 'plan', 'user_one', 'acq_one', 'sub_one',
       'cus_one', 1, 'active', ?, ?, 10, 'evt_one')`)
      .bind(JSON.stringify(candidate.shippingAddress), JSON.stringify(candidate.consent)).run();

    await expect(repo.completeAcquisitionFromLifecycleWebhook({
      acquisition: candidate,
      provider: binding,
      lifecycle: { status: "active", quantity: 1, cancelAtPeriodEnd: false },
      lifecycleEvent: { id: "evt_one", createdAt: 10 },
    })).rejects.toBeInstanceOf(SubscriptionAcquisitionConflictError);
    const row = await env.DB.prepare("SELECT status FROM subscription_acquisitions WHERE id = 'acq_one'")
      .first<{ status: string }>();
    expect(row?.status).toBe("provider_created");
  });
});
