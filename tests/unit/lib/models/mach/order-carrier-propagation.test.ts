import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hydrateOrder } from "@/lib/models/mach/orders";
import { orders } from "@/lib/db/schema/order";

const row: typeof orders.$inferSelect = {
  id: "ORD-CARRIER-1",
  customer_id: "cus_1",
  status: "shipped",
  total_amount: { amount: 2500, currency: "USD" },
  currency_code: "USD",
  shipping_address: null,
  billing_address: null,
  items: [],
  shipping_method: "ground",
  shipping_carrier: "ups",
  payment_method: "card",
  payment_status: "paid",
  notes: null,
  external_references: null,
  extensions: null,
  created_at: "2026-08-06T12:34:56.789Z",
  updated_at: "2026-08-06T12:34:56.789Z",
  shipped_at: "2026-08-06T12:34:56.789Z",
  delivered_at: null,
  tracking_number: "1Z999",
};

describe("shipping carrier propagation", () => {
  it("preserves the typed carrier in the shared order hydrator", () => {
    expect(hydrateOrder(row).shipping_carrier).toBe("ups");
  });

  it.each(["app/api/orders/route.ts", "app/api/orders/[id]/route.ts"])(
    "%s preserves shipping_carrier in its local row hydrator",
    (relativePath) => {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8");
      expect(source).toMatch(
        /shipping_carrier:\s*dbOrder\.shipping_carrier\s*\?\?\s*undefined/,
      );
    },
  );
});
