import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { queryAdminOrders } from "@/lib/fulfillment/queries";
import { applyTestMigrations } from "../../helpers/d1";

vi.mock("@opennextjs/cloudflare", async () => {
  const { env: testEnv } = await import("cloudflare:workers");
  return { getCloudflareContext: async () => ({ env: testEnv }) };
});

async function insertSearchOrder(
  id: string,
  shippingAddress: string | null,
  extensions: string | null,
) {
  await env.DB.prepare(`
    INSERT INTO orders (
      id, status, total_amount, currency_code, shipping_address, items,
      payment_status, extensions, created_at, updated_at
    ) VALUES (?, 'processing', ?, 'USD', ?, '[]', 'paid', ?, ?, ?)
  `).bind(
    id,
    JSON.stringify({ amount: 2500, currency: "USD" }),
    shippingAddress,
    extensions,
    "2026-08-06T12:00:00.000Z",
    "2026-08-06T12:00:00.000Z",
  ).run();
}

beforeEach(async () => {
  await applyTestMigrations();
  await env.DB.prepare("DELETE FROM orders WHERE id LIKE 'U14-SEARCH-%'").run();
});

describe("real D1 fulfillment queue search", () => {
  it("returns malformed JSON-mode rows in the default queue without Drizzle parsing them", async () => {
    await env.DB.prepare(`
      INSERT INTO orders (
        id, status, total_amount, currency_code, shipping_address, items,
        payment_status, extensions, created_at, updated_at
      ) VALUES (?, 'processing', ?, 'USD', ?, ?, 'paid', ?, ?, ?)
    `).bind(
      "U14-SEARCH-MALFORMED",
      "{",
      "{",
      "{",
      "{",
      "2026-08-06T12:00:00.000Z",
      "2026-08-06T12:00:00.000Z",
    ).run();

    const defaultQueue = await queryAdminOrders({
      view: "awaiting",
      limit: 20,
      offset: 0,
    });
    const directIdSearch = await queryAdminOrders({
      view: "awaiting",
      q: "u14-search-malformed",
      limit: 20,
      offset: 0,
    });

    expect(defaultQueue.orders).toContainEqual(expect.objectContaining({
      id: "U14-SEARCH-MALFORMED",
      totalAmountRaw: "{",
      customerName: "Guest",
      customerEmail: null,
      itemCount: 0,
      checkoutCatalogSubtotalRaw: null,
    }));
    expect(directIdSearch.orders.map(({ id }) => id)).toEqual(["U14-SEARCH-MALFORMED"]);
    expect(directIdSearch.total).toBe(1);
  });

  it("tolerates malformed/scalar JSON and searches double-encoded legacy objects", async () => {
    await insertSearchOrder("U14-SEARCH-MALFORMED", "{", "{");
    await insertSearchOrder("U14-SEARCH-SCALAR", "17", "null");
    await insertSearchOrder(
      "U14-SEARCH-DOUBLE",
      JSON.stringify(JSON.stringify({ recipient: "Legacy Target" })),
      JSON.stringify(JSON.stringify({ email: "target@example.com" })),
    );

    const byRecipient = await queryAdminOrders({
      view: "awaiting",
      q: "legacy target",
      limit: 20,
      offset: 0,
    });
    const byEmail = await queryAdminOrders({
      view: "awaiting",
      q: "target@example.com",
      limit: 20,
      offset: 0,
    });

    expect(byRecipient.orders.map(({ id }) => id)).toEqual(["U14-SEARCH-DOUBLE"]);
    expect(byEmail.orders.map(({ id }) => id)).toEqual(["U14-SEARCH-DOUBLE"]);
    expect(byRecipient.total).toBe(1);
    expect(byEmail.total).toBe(1);
  });
});
