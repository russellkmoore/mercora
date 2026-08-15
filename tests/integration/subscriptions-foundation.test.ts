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
    INSERT OR IGNORE INTO customer_subscriptions
      (id, plan_id, customer_id, source_order_id,
       stripe_subscription_id, stripe_customer_id,
       status, shipping_address, consent_record,
       latest_lifecycle_event_created_at, latest_lifecycle_event_id)
    VALUES ('subscription-one', 'plan-monthly', 'user_existing', 'order-existing', 'sub_one',
            'cus_one', 'active', ?, ?, 100, 'evt_open')
  `).bind(
    JSON.stringify({ line1: "1 Example Way", city: "Example", country: "US" }),
    JSON.stringify({ termsVersion: "2026-08", acceptedAt: "2026-08-01T00:00:00.000Z" }),
  ).run();
}

describe("subscription foundation on real D1", () => {
  it("preserves a populated baseline and starts capability state empty", async () => {
    await applyFoundationOnPopulatedBaseline();

    const product = await env.DB.prepare(
      "SELECT id FROM products WHERE id = 'prod-existing'",
    ).first<{ id: string }>();
    const counts = await env.DB.prepare(`
      SELECT
        (SELECT count(*) FROM subscription_plans) AS plans,
        (SELECT count(*) FROM customer_subscriptions) AS subscriptions,
        (SELECT count(*) FROM subscription_events) AS events,
        (SELECT count(*) FROM subscription_invoice_orders) AS invoice_orders
    `).first<Record<string, number>>();

    expect(product?.id).toBe("prod-existing");
    expect(counts).toEqual({ plans: 0, subscriptions: 0, events: 0, invoice_orders: 0 });
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

  it("allows only one acquired subscription for a paid source order", async () => {
    await applyFoundationOnPopulatedBaseline();
    await seedSubscription();

    await expect(env.DB.prepare(`
      INSERT INTO customer_subscriptions
        (id, plan_id, customer_id, source_order_id,
         stripe_subscription_id, stripe_customer_id, status, consent_record,
         latest_lifecycle_event_created_at, latest_lifecycle_event_id)
      VALUES ('subscription-retry', 'plan-monthly', 'user_existing', 'order-existing',
              'sub_retry', 'cus_one', 'active', '{}', 101, 'evt_retry')
    `).run()).rejects.toThrow();
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
