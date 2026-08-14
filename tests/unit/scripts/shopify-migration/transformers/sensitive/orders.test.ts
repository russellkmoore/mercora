import { describe, expect, it } from "vitest";
import type { ShopifyOrder } from "@/scripts/shopify-migration/lib/types";
import { providerFingerprint } from "@/scripts/shopify-migration/lib/ids";
import { transformHistoricalOrders } from "@/scripts/shopify-migration/transformers/sensitive/orders";

const generatedAt = "2026-08-14T12:00:00.000Z";

function order(overrides: Partial<ShopifyOrder> = {}): ShopifyOrder {
  return {
    id: "order-source-private",
    name: "#1001",
    email: "buyer@example.invalid",
    customer: { id: "customer-source-private" },
    financial_status: "paid",
    fulfillment_status: "fulfilled",
    total_price: "23.49",
    currency: "USD",
    line_items: [{
      id: "line-source-private",
      product_id: "product-source-private",
      variant_id: "variant-source-private",
      title: "Example item",
      sku: "SKU-EXAMPLE",
      quantity: 2,
      price: "10.00",
      total_discount: "1.51",
    }],
    shipping_address: {
      first_name: "Example",
      last_name: "Recipient",
      address1: "1 Example Way",
      city: "Example City",
      province_code: "EX",
      zip: "00000",
      country_code: "US",
    },
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
    ...overrides,
  };
}

function mappings() {
  return {
    customerIds: new Map([[providerFingerprint("shopify", "customer", "customer-source-private"), "user_1234567890"]]),
    productIds: new Map([[providerFingerprint("shopify", "product", "product-source-private"), "product_target"]]),
    variantIds: new Map([[providerFingerprint("shopify", "variant", "variant-source-private"), "variant_target"]]),
  };
}

describe("historical Shopify order transform", () => {
  it("emits deterministic exact Money, OrderItem, address, and timestamp shapes", () => {
    const options = { generatedAt, unresolvedCustomer: "reject" as const, ...mappings() };
    const first = transformHistoricalOrders([order()], options);
    const second = transformHistoricalOrders([order()], options);
    expect(first).toEqual(second);
    expect(first.skipped).toEqual([]);

    const record = first.records[0].order;
    expect(record.id).toMatch(/^shopify_order_[a-f0-9]{24}$/);
    expect(record.customer_id).toBe("user_1234567890");
    expect(record.status).toBe("shipped");
    expect(record.total_amount).toBe(JSON.stringify({ amount: 2349, currency: "USD" }));
    expect(JSON.parse(record.items)).toEqual([{
      id: expect.stringMatching(/^shopify_order_item_/),
      product_id: "product_target",
      variant_id: "variant_target",
      sku: "SKU-EXAMPLE",
      quantity: 2,
      unit_price: { amount: 1000, currency: "USD" },
      total_price: { amount: 1849, currency: "USD" },
      product_name: "Example item",
    }]);
    expect(JSON.parse(record.shipping_address!)).toEqual(expect.objectContaining({
      line1: "1 Example Way",
      city: "Example City",
      region: "EX",
      postal_code: "00000",
      country: "US",
      recipient: "Example Recipient",
      status: "unverified",
    }));
    expect(record.created_at).toBe("2025-01-01T00:00:00.000Z");
    expect(record.updated_at).toBe("2025-01-02T00:00:00.000Z");
  });

  it("marks external history read-only and never Stripe-paid or effect-eligible", () => {
    const result = transformHistoricalOrders([order()], {
      generatedAt,
      unresolvedCustomer: "reject",
      ...mappings(),
    });
    const record = result.records[0].order;
    const extensions = JSON.parse(record.extensions);
    const external = JSON.parse(record.external_references);

    expect(record.payment_status).toBe("pending");
    expect(record.payment_method).toBeNull();
    expect(external).toEqual({ shopify_fingerprint: result.records[0].sourceFingerprint });
    expect(extensions.migration).toMatchObject({ historical: true, read_only: true, imported: true });
    expect(extensions.payment_provenance).toEqual({
      authority: "external_unverified",
      refundable: false,
      paid_effects_eligible: false,
      source_status: "paid",
    });
    expect(JSON.stringify(record)).not.toMatch(/payment_intent_id|checkout_total|checkout_tender|discount_codes/);
    expect(JSON.stringify(record)).not.toContain("order-source-private");
  });

  it("persists identical rows when only the operator run time changes", () => {
    const input = order({ created_at: undefined, updated_at: undefined });
    const options = { unresolvedCustomer: "reject" as const, ...mappings() };
    const first = transformHistoricalOrders([input], { generatedAt, ...options });
    const later = transformHistoricalOrders([input], {
      generatedAt: "2027-08-14T12:00:00.000Z",
      ...options,
    });
    expect(first).toEqual(later);
    expect(first.records[0].order.created_at).toBe("1970-01-01T00:00:00.000Z");
  });

  it("uses conservative payment and fulfillment mappings", () => {
    const result = transformHistoricalOrders([
      order({ id: "refunded", financial_status: "refunded", fulfillment_status: null }),
      order({ id: "voided", financial_status: "voided", cancelled_at: "2025-01-03T00:00:00Z" }),
      order({ id: "partial", financial_status: "partially_paid", fulfillment_status: "partial" }),
    ], { generatedAt, unresolvedCustomer: "reject", ...mappings() });
    expect(result.records.map(({ order: value }) => [value.status, value.payment_status])).toEqual([
      ["refunded", "refunded"],
      ["cancelled", "failed"],
      ["shipped", "pending"],
    ]);
  });

  it("retains missing catalog identities as deterministic historical references", () => {
    const result = transformHistoricalOrders([order()], {
      generatedAt,
      unresolvedCustomer: "guest",
    });
    const item = JSON.parse(result.records[0].order.items)[0];
    expect(item.product_id).toMatch(/^shopify_historical_product_/);
    expect(item.variant_id).toMatch(/^shopify_historical_variant_/);
    expect(result.records[0].order.customer_id).toBeNull();
    expect(result.warnings[0]).toContain("guest history");
  });

  it("skips unsupported currency, invalid quantities, unsafe discounts, and oversized orders", () => {
    const result = transformHistoricalOrders([
      order({ id: "currency", currency: "ZZZ" }),
      order({ id: "quantity", line_items: [{ ...order().line_items[0], quantity: 0 }] }),
      order({ id: "discount", line_items: [{ ...order().line_items[0], total_discount: "99.00" }] }),
      order({ id: "oversized", line_items: Array.from({ length: 501 }, () => order().line_items[0]) }),
    ], { generatedAt, unresolvedCustomer: "reject", ...mappings() });
    expect(result.records).toEqual([]);
    expect(result.skipped.map(({ reason }) => reason)).toEqual([
      "Unsupported migration currency: ZZZ",
      "Order item quantity is invalid",
      "Order item discount exceeds its gross total",
      "Orders require 1-500 line items",
    ]);
    expect(result.skipped.every((entry) => !("record" in entry))).toBe(true);
  });

  it("never persists provisional customer IDs and requires explicit unresolved handling", () => {
    const customerFingerprint = providerFingerprint("shopify", "customer", "customer-source-private");
    const provisional = new Map([
      [customerFingerprint, "shopify_customer_deadbeefdeadbeefdeadbeef"],
    ]);
    const rejected = transformHistoricalOrders([order()], {
      generatedAt,
      unresolvedCustomer: "reject",
      ...mappings(),
      customerIds: provisional,
    });
    const guest = transformHistoricalOrders([order()], {
      generatedAt,
      unresolvedCustomer: "guest",
      ...mappings(),
      customerIds: provisional,
    });

    expect(rejected.records).toEqual([]);
    expect(rejected.skipped[0].reason).toBe("Order customer requires a resolved Clerk user ID");
    expect(guest.records[0].order.customer_id).toBeNull();
    expect(JSON.stringify(guest.records[0])).not.toContain("shopify_customer_deadbeef");
  });

  it("rejects a missing unresolved-customer policy at runtime", () => {
    expect(() => transformHistoricalOrders([order()], {
      generatedAt,
      ...mappings(),
    } as unknown as Parameters<typeof transformHistoricalOrders>[1])).toThrow(
      "unresolvedCustomer must explicitly be reject or guest",
    );
  });
});
