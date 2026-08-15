import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import {
  customerSubscriptions,
  subscriptionEvents,
  subscriptionInvoiceOrders,
  subscriptionPlans,
} from "@/lib/db/schema/subscriptions";
import { subscriptionPlans as reExportedSubscriptionPlans } from "@/lib/db/schema";

describe("subscription Drizzle schema", () => {
  it("maps the complete subscription plan binding", () => {
    expect(getTableConfig(subscriptionPlans).columns.map(({ name }) => name)).toEqual([
      "id",
      "product_id",
      "variant_id",
      "currency_code",
      "unit_amount_minor",
      "stripe_price_id",
      "cadence_unit",
      "cadence_count",
      "is_active",
      "created_at",
      "updated_at",
    ]);
    expect(reExportedSubscriptionPlans).toBe(subscriptionPlans);
  });

  it("maps acquisition, consent, address, cancellation, and lifecycle ordering", () => {
    const names = getTableConfig(customerSubscriptions).columns.map(({ name }) => name);
    expect(names).toContain("source_order_id");
    expect(names).toContain("shipping_address");
    expect(names).toContain("consent_record");
    expect(names).toContain("cancel_at");
    expect(names).toContain("latest_lifecycle_event_created_at");
    expect(names).toContain("latest_lifecycle_event_id");
    const uniqueColumns = getTableConfig(customerSubscriptions).columns
      .filter(({ isUnique }) => isUnique)
      .map(({ name }) => name);
    expect(uniqueColumns).toEqual(["source_order_id", "stripe_subscription_id"]);
  });

  it("keeps audit provider ids non-unique and cascades only audit deletion", () => {
    const eventConfig = getTableConfig(subscriptionEvents);
    const providerEvent = eventConfig.columns.find(({ name }) => name === "provider_event_id");
    expect(providerEvent?.isUnique).toBe(false);
    expect(eventConfig.foreignKeys[0].onDelete).toBe("cascade");
  });

  it("uses invoice and order identities as renewal-order uniqueness boundaries", () => {
    const config = getTableConfig(subscriptionInvoiceOrders);
    expect(config.columns.find(({ name }) => name === "stripe_invoice_id")?.primary).toBe(true);
    expect(config.columns.find(({ name }) => name === "order_id")?.isUnique).toBe(true);
    expect(config.foreignKeys.every(({ onDelete }) => onDelete === "restrict")).toBe(true);
  });
});
