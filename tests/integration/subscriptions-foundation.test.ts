import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";

function subscriptionMigrationIndex(): number {
  return env.TEST_MIGRATIONS.findIndex(
    ({ name }) => name === "0021_add_subscriptions.sql",
  );
}

async function seedPopulatedBaseline() {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO products (id, name, status, default_variant_id)
    VALUES ('prod-existing', 'Existing product', 'active', 'var-existing')
  `).run();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO product_variants
      (id, product_id, sku, status, option_values, price)
    VALUES ('var-existing', 'prod-existing', 'SKU-EXISTING', 'active', '[]', ?)
  `).bind(JSON.stringify({ amount: 2500, currency: "USD" })).run();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO customers (id, type, person)
    VALUES ('user_existing', 'person', ?)
  `).bind(JSON.stringify({ first_name: "Existing" })).run();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO orders (id, customer_id, total_amount, currency_code, items)
    VALUES ('order-existing', 'user_existing', ?, 'USD', '[]')
  `).bind(JSON.stringify({ amount: 2500, currency: "USD" })).run();
}

async function applyFoundationOnPopulatedBaseline() {
  const index = subscriptionMigrationIndex();
  expect(index).toBeGreaterThan(0);
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(0, index));
  await seedPopulatedBaseline();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(index));
}

async function seedSubscription() {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO subscription_plans
      (id, product_id, variant_id, currency_code, unit_amount_minor,
       stripe_price_id, cadence_unit, cadence_count, is_active)
    VALUES ('plan-monthly', 'prod-existing', 'var-existing', 'USD', 2250,
            'price_monthly', 'month', 1, 1)
  `).run();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO subscription_provider_customers
      (customer_id, stripe_customer_id)
    VALUES ('user_existing', 'cus_one')
  `).run();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO subscription_acquisitions
      (id, setup_intent_id, plan_id, product_id, variant_id, currency_code,
       unit_amount_minor, stripe_price_id, cadence_unit, cadence_count,
       customer_id, stripe_customer_id,
       quantity, shipping_required, shipping_address, consent_record, status, stripe_subscription_id)
    VALUES ('acq-one', 'seti_one', 'plan-monthly', 'prod-existing', 'var-existing',
            'USD', 2250, 'price_monthly', 'month', 1, 'user_existing', 'cus_one',
            1, 1, ?, ?, 'completed', 'sub_one')
  `).bind(
    JSON.stringify({ line1: "1 Example Way", city: "Example", country: "US" }),
    JSON.stringify({ termsVersion: "2026-08", acceptedAt: "2026-08-01T00:00:00.000Z" }),
  ).run();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO customer_subscriptions
      (id, plan_id, customer_id, acquisition_id,
       stripe_subscription_id, stripe_customer_id,
       shipping_required, status, shipping_address, consent_record,
       latest_lifecycle_event_created_at, latest_lifecycle_event_id)
    VALUES ('subscription-one', 'plan-monthly', 'user_existing', 'acq-one', 'sub_one',
            'cus_one', 1, 'active', ?, ?, 100, 'evt_open')
  `).bind(
    JSON.stringify({ line1: "1 Example Way", city: "Example", country: "US" }),
    JSON.stringify({ termsVersion: "2026-08", acceptedAt: "2026-08-01T00:00:00.000Z" }),
  ).run();
}

describe("subscription foundation on real D1", () => {
  it("preserves a populated baseline and starts capability state empty", async () => {
    await applyFoundationOnPopulatedBaseline();

    // Simulate old application code continuing to write only the pre-0021
    // order schema after the additive tables have been deployed.
    await env.DB.prepare(`
      INSERT OR IGNORE INTO orders (id, customer_id, total_amount, currency_code, items)
      VALUES ('old-code-after-0021', 'user_existing', ?, 'USD', '[]')
    `).bind(JSON.stringify({ amount: 100, currency: "USD" })).run();

    const product = await env.DB.prepare(
      "SELECT id FROM products WHERE id = 'prod-existing'",
    ).first<{ id: string }>();
    const counts = await env.DB.prepare(`
      SELECT
        (SELECT count(*) FROM subscription_plans) AS plans,
        (SELECT count(*) FROM subscription_provider_customers) AS provider_customers,
        (SELECT count(*) FROM subscription_acquisitions) AS acquisitions,
        (SELECT count(*) FROM customer_subscriptions) AS subscriptions,
        (SELECT count(*) FROM subscription_events) AS events,
        (SELECT count(*) FROM subscription_invoice_orders) AS invoice_orders
    `).first<Record<string, number>>();

    expect(product?.id).toBe("prod-existing");
    expect(await env.DB.prepare(
      "SELECT id FROM orders WHERE id = 'old-code-after-0021'",
    ).first<{ id: string }>()).toEqual({ id: "old-code-after-0021" });
    expect(counts).toEqual({
      plans: 0,
      provider_customers: 0,
      acquisitions: 0,
      subscriptions: 0,
      events: 0,
      invoice_orders: 0,
    });
  });

  it("rejects plans whose variant belongs to another product", async () => {
    await applyFoundationOnPopulatedBaseline();
    await env.DB.prepare(`
      INSERT OR IGNORE INTO products (id, name, status) VALUES ('prod-other', 'Other', 'active')
    `).run();

    await expect(env.DB.prepare(`
      INSERT INTO subscription_plans
        (id, product_id, variant_id, currency_code, unit_amount_minor,
         stripe_price_id, cadence_unit, cadence_count)
      VALUES ('bad-plan', 'prod-other', 'var-existing', 'USD', 2500,
              'price_wrong_pair', 'month', 1)
    `).run()).rejects.toThrow();
  });

  it("allows only one renewal order for a Stripe invoice", async () => {
    await applyFoundationOnPopulatedBaseline();
    await seedSubscription();
    await env.DB.prepare(`
      INSERT OR IGNORE INTO orders (id, customer_id, total_amount, currency_code, items)
      VALUES ('renewal-one', 'user_existing', ?, 'USD', '[]')
    `).bind(JSON.stringify({ amount: 2250, currency: "USD" })).run();
    await env.DB.prepare(`
      INSERT OR IGNORE INTO orders (id, customer_id, total_amount, currency_code, items)
      VALUES ('renewal-two', 'user_existing', ?, 'USD', '[]')
    `).bind(JSON.stringify({ amount: 2250, currency: "USD" })).run();
    await env.DB.prepare(`
      INSERT INTO subscription_invoice_orders
        (stripe_invoice_id, subscription_id, order_id, paid_amount_minor,
         currency_code, verified_paid_at)
      VALUES ('in_same', 'subscription-one', 'renewal-one', 2250, 'USD', 200)
    `).run();

    await expect(env.DB.prepare(`
      INSERT INTO subscription_invoice_orders
        (stripe_invoice_id, subscription_id, order_id, paid_amount_minor,
         currency_code, verified_paid_at)
      VALUES ('in_same', 'subscription-one', 'renewal-two', 2250, 'USD', 201)
    `).run()).rejects.toThrow();
  });

  it("converges acquisition retries on one verified SetupIntent", async () => {
    await applyFoundationOnPopulatedBaseline();
    await seedSubscription();
    await expect(env.DB.prepare(`
      INSERT INTO subscription_acquisitions
        (id, setup_intent_id, plan_id, product_id, variant_id, currency_code,
         unit_amount_minor, stripe_price_id, cadence_unit, cadence_count,
         customer_id, stripe_customer_id,
         quantity, shipping_required, consent_record)
      VALUES ('acq-retry', 'seti_one', 'plan-monthly', 'prod-existing',
              'var-existing', 'USD', 2250, 'price_monthly', 'month', 1, 'user_existing',
              'cus_one', 0, 1, '{}')
    `).run()).rejects.toThrow();
  });

  it("keeps reserved acquisition billing facts immutable", async () => {
    await applyFoundationOnPopulatedBaseline();
    await seedSubscription();

    await expect(env.DB.prepare(`
      UPDATE subscription_plans
      SET unit_amount_minor = 2300
      WHERE id = 'plan-monthly'
    `).run()).rejects.toThrow();
  });

  it("keeps an exact reserved acquisition usable after plan deactivation", async () => {
    await applyFoundationOnPopulatedBaseline();
    await seedSubscription();
    await env.DB.prepare(`
      INSERT INTO subscription_acquisitions
        (id, setup_intent_id, plan_id, product_id, variant_id, currency_code,
         unit_amount_minor, stripe_price_id, cadence_unit, cadence_count,
         customer_id, stripe_customer_id, quantity, shipping_required, consent_record, status,
         stripe_subscription_id)
      VALUES ('acq-deactivated', 'seti_deactivated', 'plan-monthly', 'prod-existing',
              'var-existing', 'USD', 2250, 'price_monthly', 'month', 1,
              'user_existing', 'cus_one', 1, 0, '{}', 'provider_created',
              'sub_deactivated')
    `).run();
    await env.DB.prepare(`
      UPDATE subscription_plans SET is_active = 0 WHERE id = 'plan-monthly'
    `).run();

    const reserved = await env.DB.prepare(`
      SELECT plan_id, currency_code, unit_amount_minor, stripe_price_id,
             cadence_unit, cadence_count, shipping_required
      FROM subscription_acquisitions WHERE id = 'acq-deactivated'
    `).first<Record<string, string | number>>();
    expect(reserved).toEqual({
      plan_id: "plan-monthly",
      currency_code: "USD",
      unit_amount_minor: 2250,
      stripe_price_id: "price_monthly",
      cadence_unit: "month",
      cadence_count: 1,
      shipping_required: 0,
    });
    await expect(env.DB.prepare(`
      INSERT INTO customer_subscriptions
        (id, plan_id, customer_id, acquisition_id, stripe_subscription_id,
         stripe_customer_id, shipping_required, status, consent_record,
         latest_lifecycle_event_created_at, latest_lifecycle_event_id)
      VALUES ('subscription-deactivated', 'plan-monthly', 'user_existing',
              'acq-deactivated', 'sub_deactivated', 'cus_one', 0, 'active', '{}',
              300, 'evt_deactivated')
    `).run()).resolves.toBeDefined();
  });

  it("cannot attach lifecycle state to a different reserved plan binding", async () => {
    await applyFoundationOnPopulatedBaseline();
    await seedSubscription();
    await env.DB.prepare(`
      INSERT INTO subscription_plans
        (id, product_id, variant_id, currency_code, unit_amount_minor,
         stripe_price_id, cadence_unit, cadence_count, is_active)
      VALUES ('plan-quarterly', 'prod-existing', 'var-existing', 'USD', 6000,
              'price_quarterly', 'month', 3, 1)
    `).run();
    await env.DB.prepare(`
      INSERT INTO subscription_acquisitions
        (id, setup_intent_id, plan_id, product_id, variant_id, currency_code,
         unit_amount_minor, stripe_price_id, cadence_unit, cadence_count,
         customer_id, stripe_customer_id,
         quantity, shipping_required, consent_record, status, stripe_subscription_id)
      VALUES ('acq-binding', 'seti_binding', 'plan-monthly', 'prod-existing',
              'var-existing', 'USD', 2250, 'price_monthly', 'month', 1, 'user_existing',
              'cus_one', 1, 0, '{}', 'provider_created', 'sub_binding')
    `).run();

    await expect(env.DB.prepare(`
      INSERT INTO customer_subscriptions
        (id, plan_id, customer_id, acquisition_id, stripe_subscription_id,
         stripe_customer_id, shipping_required, status, consent_record,
         latest_lifecycle_event_created_at, latest_lifecycle_event_id)
      VALUES ('subscription-bad-binding', 'plan-quarterly', 'user_existing',
              'acq-binding', 'sub_binding', 'cus_one', 0, 'active', '{}', 200,
              'evt_binding')
    `).run()).rejects.toThrow();
  });

  it("enforces one exact local customer to Stripe Customer mapping", async () => {
    await applyFoundationOnPopulatedBaseline();
    await env.DB.prepare(`
      INSERT OR IGNORE INTO customers (id, type, person)
      VALUES ('user_two', 'person', '{}')
    `).run();
    await env.DB.prepare(`
      INSERT OR IGNORE INTO subscription_provider_customers
        (customer_id, stripe_customer_id)
      VALUES ('user_existing', 'cus_one')
    `).run();
    await expect(env.DB.prepare(`
      INSERT INTO subscription_provider_customers
        (customer_id, stripe_customer_id)
      VALUES ('user_two', 'cus_one')
    `).run()).rejects.toThrow();
    await env.DB.prepare(`
      INSERT INTO subscription_provider_customers
        (customer_id, stripe_customer_id)
      VALUES ('user_two', 'cus_two')
    `).run();
    await env.DB.prepare(`
      INSERT OR IGNORE INTO subscription_plans
        (id, product_id, variant_id, currency_code, unit_amount_minor,
         stripe_price_id, cadence_unit, cadence_count)
      VALUES ('plan-pair-check', 'prod-existing', 'var-existing', 'USD', 2500,
              'price_pair_check', 'month', 3)
    `).run();
    await expect(env.DB.prepare(`
      INSERT INTO subscription_acquisitions
        (id, setup_intent_id, plan_id, product_id, variant_id, currency_code,
         unit_amount_minor, stripe_price_id, cadence_unit, cadence_count,
         customer_id, stripe_customer_id,
         quantity, shipping_required, consent_record)
      VALUES ('acq-bad-pair', 'seti_bad_pair', 'plan-pair-check', 'prod-existing',
              'var-existing', 'USD', 2500, 'price_pair_check', 'month', 3,
              'user_existing', 'cus_two', 1, 0, '{}')
    `).run()).rejects.toThrow();
  });

  it("stores pause collection and service end independently of lifecycle status", async () => {
    await applyFoundationOnPopulatedBaseline();
    await seedSubscription();
    await env.DB.prepare(`
      UPDATE customer_subscriptions
      SET pause_collection = ?, ended_at = 300
      WHERE id = 'subscription-one'
    `).bind(JSON.stringify({ behavior: "void" })).run();
    const row = await env.DB.prepare(`
      SELECT status, pause_collection, ended_at FROM customer_subscriptions
      WHERE id = 'subscription-one'
    `).first<{ status: string; pause_collection: string; ended_at: number }>();

    expect(row).toEqual({
      status: "active",
      pause_collection: '{"behavior":"void"}',
      ended_at: 300,
    });
  });

  it("rejects active zero-priced plans but permits inactive staging", async () => {
    await applyFoundationOnPopulatedBaseline();
    await env.DB.prepare(`
      INSERT INTO subscription_plans
        (id, product_id, variant_id, currency_code, unit_amount_minor,
         stripe_price_id, cadence_unit, cadence_count, is_active)
      VALUES ('plan-free-staged', 'prod-existing', 'var-existing', 'USD', 0,
              'price_free_staged', 'year', 1, 0)
    `).run();

    await expect(env.DB.prepare(`
      INSERT INTO subscription_plans
        (id, product_id, variant_id, currency_code, unit_amount_minor,
         stripe_price_id, cadence_unit, cadence_count, is_active)
      VALUES ('plan-free-active', 'prod-existing', 'var-existing', 'USD', 0,
              'price_free_active', 'week', 1, 1)
    `).run()).rejects.toThrow();
  });

  it("constrains JSON snapshots and event audit outcomes", async () => {
    await applyFoundationOnPopulatedBaseline();
    await seedSubscription();

    await expect(env.DB.prepare(`
      INSERT INTO subscription_events
        (id, subscription_id, provider_event_id, provider_event_created_at,
         event_type, outcome, details)
      VALUES ('event-bad', 'subscription-one', 'evt_bad', 101,
              'updated', 'applied', '[]')
    `).run()).rejects.toThrow();
  });
});
