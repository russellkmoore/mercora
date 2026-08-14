import { getTableColumns } from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { customers } from "@/lib/db/schema/customer";
import { orders } from "@/lib/db/schema/order";
import { product_reviews } from "@/lib/db/schema/reviews";
import type { ShopifyCustomer, ShopifyOrder } from "@/scripts/shopify-migration/lib/types";
import { providerFingerprint } from "@/scripts/shopify-migration/lib/ids";
import {
  materializeCustomers,
  transformCustomers,
} from "@/scripts/shopify-migration/transformers/sensitive/customers";
import { transformHistoricalOrders } from "@/scripts/shopify-migration/transformers/sensitive/orders";
import {
  judgeMeReviewFingerprint,
  transformJudgeMeReviews,
} from "@/scripts/shopify-migration/transformers/sensitive/reviews";

const generatedAt = "2026-08-14T12:00:00.000Z";

function columnNames(table: AnySQLiteTable): string[] {
  return Object.values(getTableColumns(table)).map((column) => column.name).sort();
}

describe("sensitive insert record schema contracts", () => {
  it("emits only current customer columns and deliberately omits unused MACH fields", () => {
    const source: ShopifyCustomer = { id: "customer-source", email: "schema@example.invalid" };
    const [plan] = transformCustomers([source], { generatedAt }).records;
    const [record] = materializeCustomers([plan], new Map([
      [plan.sourceFingerprint, "user_1234567890"],
    ])).records;
    const emitted = Object.keys(record).sort();
    const schema = columnNames(customers);

    expect(emitted.every((column) => schema.includes(column))).toBe(true);
    expect(schema.filter((column) => !emitted.includes(column))).toEqual([
      "authentication",
      "company",
      "contacts",
      "loyalty",
      "segments",
    ]);
  });

  it("matches every fully migrated order column including shipping_carrier", () => {
    const source: ShopifyOrder = {
      id: "order-source",
      customer: { id: "customer-source" },
      currency: "USD",
      total_price: "1.00",
      line_items: [{ title: "Schema item", quantity: 1, price: "1.00" }],
    };
    const fingerprint = providerFingerprint("shopify", "customer", "customer-source");
    const result = transformHistoricalOrders([source], {
      generatedAt,
      unresolvedCustomer: "reject",
      customerIds: new Map([[fingerprint, "user_1234567890"]]),
    });

    expect(Object.keys(result.records[0].order).sort()).toEqual(columnNames(orders));
    expect(result.records[0].order).toHaveProperty("shipping_carrier", null);
  });

  it("matches every current product-review column with real attribution", () => {
    const source = {
      body: "Synthetic schema review",
      rating: 5,
      product_handle: "schema-product",
      reviewer_email: "schema@example.invalid",
    };
    const reviewFingerprint = judgeMeReviewFingerprint(source);
    const productId = "product_target";
    const result = transformJudgeMeReviews([source], {
      generatedAt,
      productIds: new Map([[
        providerFingerprint("shopify", "product_handle", "schema-product"),
        productId,
      ]]),
      reviewAttributions: new Map([[reviewFingerprint, {
        productId,
        orderId: "order_target",
        customerId: "user_1234567890",
      }]]),
    });

    expect(Object.keys(result.records[0].review).sort()).toEqual(columnNames(product_reviews));
  });
});
