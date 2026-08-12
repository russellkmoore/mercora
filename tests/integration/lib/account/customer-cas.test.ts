import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyTestMigrations } from "../../helpers/d1";
import { mutateCustomerAddresses, replaceCustomerAddress } from "@/lib/account/customer";
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

  it("preserves the sole default when PUT attempts to unset it", async () => {
    const database = drizzle(env.DB, { schema });
    const addresses = [
      { id: "address-a", type: "shipping" as const, is_default: true, address: { line1: "1 A St", city: "Denver", country: "US" } },
      { id: "address-b", type: "shipping" as const, is_default: false, address: { line1: "2 B St", city: "Denver", country: "US" } },
    ];
    await env.DB.prepare("UPDATE customers SET addresses = ? WHERE id = ?")
      .bind(JSON.stringify(addresses), customerId).run();

    const updated = await mutateCustomerAddresses(customerId, (current) =>
      replaceCustomerAddress(current, "address-a", { ...current[0], is_default: false }) ?? current,
    database);

    expect(updated.addresses?.filter((entry) => entry.is_default).map((entry) => entry.id))
      .toEqual(["address-a"]);
  });

  it("recomputes the default invariant on every concurrent PUT retry", async () => {
    const database = drizzle(env.DB, { schema });
    const addresses = [
      { id: "address-a", type: "shipping" as const, is_default: true, address: { line1: "1 A St", city: "Denver", country: "US" } },
      { id: "address-b", type: "shipping" as const, is_default: false, address: { line1: "2 B St", city: "Denver", country: "US" } },
    ];
    await env.DB.prepare("UPDATE customers SET addresses = ?, updated_at = ? WHERE id = ?")
      .bind(JSON.stringify(addresses), "2026-08-01T00:00:01.000Z", customerId).run();

    await Promise.all([
      mutateCustomerAddresses(customerId, (current) =>
        replaceCustomerAddress(current, "address-a", { ...current.find((entry) => entry.id === "address-a")!, is_default: false }) ?? current,
      database),
      mutateCustomerAddresses(customerId, (current) =>
        replaceCustomerAddress(current, "address-b", { ...current.find((entry) => entry.id === "address-b")!, is_default: true }) ?? current,
      database),
    ]);

    const row = await env.DB.prepare("SELECT addresses FROM customers WHERE id = ?")
      .bind(customerId).first<{ addresses: string }>();
    const final = JSON.parse(row!.addresses) as Array<{ id: string; is_default?: boolean }>;
    expect(final.filter((entry) => entry.is_default).map((entry) => entry.id)).toEqual(["address-b"]);
  });
});
