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

  it("adds gift_card_events and code_suffix without disturbing a populated 0023 baseline", async () => {
    const index = env.TEST_MIGRATIONS.findIndex(
      ({ name }) => name === "0024_add_gift_card_events.sql",
    );
    expect(index).toBeGreaterThan(0);
    const before0024 = env.TEST_MIGRATIONS.slice(0, index);
    const only0024 = env.TEST_MIGRATIONS.slice(index, index + 1);
    expect(only0024.map(({ name }) => name)).toEqual(["0024_add_gift_card_events.sql"]);
    await applyD1Migrations(env.DB, before0024);

    const giftCardId = "gift-events-baseline-card";
    const hash = "e".repeat(64);
    const createdAt = 1_800_000_000;
    await env.DB.prepare(`INSERT INTO gift_card_accounts
      (id, code_hash, code_hash_version, currency_code, status,
       issuance_entry_id, issuance_business_key, issued_amount_minor, created_at)
      VALUES (?, ?, 1, 'USD', 'active', ?, ?, 5000, ?)`)
      .bind(
        giftCardId,
        hash,
        "gift-events-baseline-issuance-entry",
        "gift-events-baseline-issuance-key",
        createdAt,
      ).run();
    await env.DB.prepare(`INSERT INTO gift_card_ledger_entries
      (id, gift_card_id, currency_code, entry_type, amount_delta_minor,
       business_key, created_at)
      VALUES ('gift-events-baseline-issuance-entry', ?, 'USD', 'issuance', 5000,
       'gift-events-baseline-issuance-key', ?)`)
      .bind(giftCardId, createdAt).run();

    // The account snapshot names every pre-0024 column explicitly: 0024 adds
    // `code_suffix` via ALTER TABLE ADD COLUMN, so `SELECT *` would gain a
    // new (NULL) field after the migration even though every existing value
    // is untouched. Naming columns proves the pre-existing data is
    // byte-identical without that new column tripping the comparison.
    const snapshot = async () => JSON.stringify({
      account: await env.DB.prepare(`SELECT
          id, code_hash, code_hash_version, currency_code, status,
          issuance_entry_id, issuance_business_key, issued_amount_minor,
          issued_order_id, issued_line_id, purchaser_customer_id,
          created_at, disabled_at
        FROM gift_card_accounts WHERE id = ?`,
      ).bind(giftCardId).first(),
      ledger: await env.DB.prepare(
        "SELECT * FROM gift_card_ledger_entries WHERE gift_card_id = ?",
      ).bind(giftCardId).first(),
    });
    const before = await snapshot();
    await applyD1Migrations(env.DB, only0024);
    expect(await snapshot()).toBe(before);

    const eventCount = await env.DB.prepare(
      "SELECT count(*) AS count FROM gift_card_events",
    ).first<{ count: number }>();
    expect(eventCount).toEqual({ count: 0 });

    const account = await env.DB.prepare(
      "SELECT code_suffix FROM gift_card_accounts WHERE id = ?",
    ).bind(giftCardId).first<{ code_suffix: string | null }>();
    expect(account?.code_suffix).toBeNull();

    const insertEvent = (
      id: string,
      eventType: string,
      actorType = "admin",
      details: string | null = null,
    ) => env.DB.prepare(`INSERT INTO gift_card_events
        (id, gift_card_id, event_type, actor_type, actor_id, details, created_at)
        VALUES (?, ?, ?, ?, 'admin-user', ?, ?)`)
      .bind(id, giftCardId, eventType, actorType, details, createdAt + 100)
      .run();

    await expect(insertEvent("evt-reissued-1", "reissued")).resolves.toBeDefined();
    await expect(insertEvent("evt-reissued-2", "reissued")).rejects.toThrow();

    await expect(insertEvent("evt-note-1", "note")).resolves.toBeDefined();
    await expect(insertEvent("evt-note-2", "note")).resolves.toBeDefined();

    await expect(insertEvent("evt-bad-actor", "note", "fraud")).rejects.toThrow();

    await expect(
      insertEvent("evt-bad-details", "note", "admin", JSON.stringify(["not", "an", "object"])),
    ).rejects.toThrow();

    await expect(
      env.DB.prepare("DELETE FROM gift_card_accounts WHERE id = ?")
        .bind(giftCardId).run(),
    ).rejects.toThrow();
  });
});
