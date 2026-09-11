import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";

describe("payment-customers migration ordering", () => {
  it("adds payment_customers without disturbing a populated 0024 baseline", async () => {
    const index = env.TEST_MIGRATIONS.findIndex(
      ({ name }) => name === "0025_add_payment_customers.sql",
    );
    expect(index).toBeGreaterThan(0);
    const before0025 = env.TEST_MIGRATIONS.slice(0, index);
    const only0025 = env.TEST_MIGRATIONS.slice(index, index + 1);
    expect(only0025.map(({ name }) => name)).toEqual(["0025_add_payment_customers.sql"]);
    await applyD1Migrations(env.DB, before0025);

    await env.DB.prepare(`INSERT INTO customers
      (id, type, person, created_at, updated_at)
      VALUES ('payment-baseline-customer', 'person', ?, ?, ?)`)
      .bind(
        JSON.stringify({ email: "baseline@example.test" }),
        "2026-09-11T00:00:00.000Z",
        "2026-09-11T00:00:00.000Z",
      ).run();
    await env.DB.prepare(`INSERT INTO subscription_provider_customers
      (customer_id, stripe_customer_id) VALUES
      ('payment-baseline-customer', 'cus_payment_baseline')`).run();

    const snapshot = async () => JSON.stringify({
      customer: await env.DB.prepare(
        "SELECT id, type, person, created_at, updated_at FROM customers WHERE id = 'payment-baseline-customer'",
      ).first(),
      providerCustomer: await env.DB.prepare(
        "SELECT customer_id, stripe_customer_id FROM subscription_provider_customers WHERE customer_id = 'payment-baseline-customer'",
      ).first(),
    });
    const before = await snapshot();
    await applyD1Migrations(env.DB, only0025);
    expect(await snapshot()).toBe(before);

    const row = await env.DB.prepare(
      "SELECT count(*) AS count FROM payment_customers",
    ).first<{ count: number }>();
    expect(row).toEqual({ count: 0 });
  });

  it("rejects a non-cus_-prefixed or too-short stripe_customer_id, and refuses to orphan a binding", async () => {
    const index = env.TEST_MIGRATIONS.findIndex(
      ({ name }) => name === "0025_add_payment_customers.sql",
    );
    expect(index).toBeGreaterThan(0);
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(0, index + 1));

    await env.DB.prepare(`INSERT INTO customers
      (id, type, person, created_at, updated_at)
      VALUES ('payment-constraint-customer', 'person', ?, ?, ?)`)
      .bind(
        JSON.stringify({ email: "constraint@example.test" }),
        "2026-09-11T00:00:00.000Z",
        "2026-09-11T00:00:00.000Z",
      ).run();

    await expect(
      env.DB.prepare(`INSERT INTO payment_customers
        (customer_id, stripe_customer_id) VALUES ('payment-constraint-customer', 'pm_not_a_customer_id')`)
        .run(),
    ).rejects.toThrow();

    await expect(
      env.DB.prepare(`INSERT INTO payment_customers
        (customer_id, stripe_customer_id) VALUES ('payment-constraint-customer', 'cus')`)
        .run(),
    ).rejects.toThrow();

    await env.DB.prepare(`INSERT INTO payment_customers
      (customer_id, stripe_customer_id) VALUES ('payment-constraint-customer', 'cus_valid_binding_id')`)
      .run();

    await expect(
      env.DB.prepare("DELETE FROM customers WHERE id = 'payment-constraint-customer'").run(),
    ).rejects.toThrow();
  });
});
