import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";

describe("gift-card migration ordering", () => {
  it("preserves a populated 0021 baseline before adding empty gift-card state", async () => {
    const index = env.TEST_MIGRATIONS.findIndex(
      ({ name }) => name === "0022_add_gift_cards.sql",
    );
    expect(index).toBeGreaterThan(0);
    const throughSubscriptions = env.TEST_MIGRATIONS.slice(0, index);
    const giftCards = env.TEST_MIGRATIONS.slice(index, index + 1);
    expect(giftCards.map(({ name }) => name)).toEqual(["0022_add_gift_cards.sql"]);
    await applyD1Migrations(env.DB, throughSubscriptions);

    await env.DB.prepare(`INSERT INTO customers
      (id, type, person, created_at, updated_at)
      VALUES ('gift-baseline-customer', 'person', ?, ?, ?)`)
      .bind(
        JSON.stringify({ email: "baseline@example.test" }),
        "2026-08-15T00:00:00.000Z",
        "2026-08-15T00:00:00.000Z",
      ).run();
    await env.DB.prepare(`INSERT INTO orders
      (id, customer_id, status, total_amount, currency_code, items,
       payment_status, created_at, updated_at)
      VALUES ('gift-baseline-order', 'gift-baseline-customer', 'processing', ?,
       'USD', '[]', 'paid', ?, ?)`)
      .bind(
        JSON.stringify({ amount: 2_500, currency: "USD" }),
        "2026-08-15T00:01:00.000Z",
        "2026-08-15T00:01:00.000Z",
      ).run();
    await env.DB.prepare(`INSERT INTO subscription_provider_customers
      (customer_id, stripe_customer_id) VALUES
      ('gift-baseline-customer', 'cus_gift_baseline')`).run();

    const snapshot = async () => JSON.stringify({
      customer: await env.DB.prepare(
        "SELECT * FROM customers WHERE id = 'gift-baseline-customer'",
      ).first(),
      order: await env.DB.prepare(
        "SELECT * FROM orders WHERE id = 'gift-baseline-order'",
      ).first(),
      providerCustomer: await env.DB.prepare(
        "SELECT * FROM subscription_provider_customers WHERE customer_id = 'gift-baseline-customer'",
      ).first(),
    });
    const before = await snapshot();
    await applyD1Migrations(env.DB, giftCards);
    expect(await snapshot()).toBe(before);

    for (const table of [
      "gift_card_accounts",
      "gift_card_reservations",
      "gift_card_ledger_entries",
      "gift_card_deliveries",
    ]) {
      const row = await env.DB.prepare(`SELECT count(*) AS count FROM ${table}`)
        .first<{ count: number }>();
      expect(row).toEqual({ count: 0 });
    }
  });
});
