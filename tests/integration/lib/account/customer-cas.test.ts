import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyTestMigrations } from "../../helpers/d1";
import { mutateCustomerAddresses } from "@/lib/account/customer";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";

const customerId = "O01-CAS-CUSTOMER";

beforeEach(async () => {
  await applyTestMigrations();
  await env.DB.prepare("DELETE FROM customers WHERE id = ?").bind(customerId).run();
  await env.DB.prepare(`
    INSERT INTO customers (id, type, person, addresses, created_at, updated_at)
    VALUES (?, 'person', ?, '[]', ?, ?)
  `).bind(
    customerId,
    JSON.stringify({ email: "account@example.com" }),
    "2026-08-01T00:00:00.000Z",
    "2026-08-01T00:00:00.000Z",
  ).run();
});

describe("customer address compare-and-swap in real D1", () => {
  it("preserves concurrent edits and selects one default atomically", async () => {
    const database = drizzle(env.DB, { schema });
    await Promise.all([
      mutateCustomerAddresses(customerId, (addresses) => [...addresses.map((entry) => ({ ...entry, is_default: false })), {
        id: "address-a", type: "shipping", is_default: true,
        address: { line1: "1 A St", city: "Denver", country: "US" },
      }], database),
      mutateCustomerAddresses(customerId, (addresses) => [...addresses.map((entry) => ({ ...entry, is_default: false })), {
        id: "address-b", type: "shipping", is_default: true,
        address: { line1: "2 B St", city: "Denver", country: "US" },
      }], database),
    ]);

    const row = await env.DB.prepare("SELECT addresses FROM customers WHERE id = ?")
      .bind(customerId).first<{ addresses: string }>();
    const addresses = JSON.parse(row!.addresses) as Array<{ id: string; is_default?: boolean }>;
    expect(addresses.map(({ id }) => id).sort()).toEqual(["address-a", "address-b"]);
    expect(addresses.filter((entry) => entry.is_default)).toHaveLength(1);
  });
});
