import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const addressCollection = readFileSync("app/api/account/addresses/route.ts", "utf8");
const addressItem = readFileSync("app/api/account/addresses/[id]/route.ts", "utf8");
const settings = readFileSync("app/api/account/settings/route.ts", "utf8");
const orderModel = readFileSync("lib/models/mach/orders.ts", "utf8");
const compatibility = readFileSync("app/orders/page.tsx", "utf8");

describe("account ownership and mutation contracts", () => {
  it("requires Clerk ownership and same-origin mutation guards", () => {
    for (const source of [addressCollection, addressItem, settings]) {
      expect(source).toContain("await auth()");
      expect(source).toContain("hasSameOrigin(request)");
    }
  });

  it("scopes order detail in the database query", () => {
    expect(orderModel).toMatch(/getOrderByCustomerAndId[\s\S]*eq\(orders\.id, orderId\)[\s\S]*eq\(orders\.customer_id, customerId\)/);
  });

  it("keeps the legacy route as a query-preserving redirect", () => {
    expect(compatibility).toContain("searchParams");
    expect(compatibility).toContain("/account/orders");
    expect(compatibility).not.toContain("getOrdersBy");
  });
});
