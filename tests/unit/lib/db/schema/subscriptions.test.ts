import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import {
  customerSubscriptions,
  subscriptionAcquisitions,
  subscriptionEvents,
  subscriptionInvoiceOrders,
  subscriptionPlans,
  subscriptionProviderCustomers,
} from "@/lib/db/schema/subscriptions";
import { subscriptionPlans as reExportedSubscriptionPlans } from "@/lib/db/schema";
import { product_variants } from "@/lib/db/schema/products";

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
    expect(getTableConfig(subscriptionPlans).indexes.map(({ config }) => config.name)).toContain(
      "subscription_plans_binding_unique",
    );
  });

  it("maps acquisition, consent, address, cancellation, and lifecycle ordering", () => {
    const names = getTableConfig(customerSubscriptions).columns.map(({ name }) => name);
    expect(names).toContain("acquisition_id");
    expect(names).toContain("shipping_address");
    expect(names).toContain("shipping_required");
    expect(names).toContain("consent_record");
    expect(names).toContain("pause_collection");
    expect(names).toContain("cancel_at");
    expect(names).toContain("ended_at");
    expect(names).toContain("latest_lifecycle_event_created_at");
    expect(names).toContain("latest_lifecycle_event_id");
    const uniqueColumns = getTableConfig(customerSubscriptions).columns
      .filter(({ isUnique }) => isUnique)
      .map(({ name }) => name);
    expect(uniqueColumns).toEqual(["acquisition_id", "stripe_subscription_id"]);
  });

  it("maps one exact local customer to one bounded Stripe Customer", () => {
    const config = getTableConfig(subscriptionProviderCustomers);
    expect(config.columns.map(({ name }) => name)).toEqual([
      "customer_id",
      "stripe_customer_id",
      "created_at",
      "updated_at",
    ]);
    expect(config.columns.find(({ name }) => name === "customer_id")?.primary).toBe(true);
    expect(config.columns.find(({ name }) => name === "stripe_customer_id")?.isUnique).toBe(true);
    expect(config.indexes.map(({ config: indexConfig }) => indexConfig.name)).toContain(
      "subscription_provider_customers_pair_unique",
    );
  });

  it("declares the composite product/variant parent key used by plan bindings", () => {
    const indexNames = getTableConfig(product_variants).indexes.map(({ config }) => config.name);
    expect(indexNames).toContain("product_variants_product_id_id_unique");
  });

  it("mirrors bounded provider, JSON, status, and currency checks", () => {
    const checkNames = [
      ...getTableConfig(subscriptionPlans).checks,
      ...getTableConfig(subscriptionProviderCustomers).checks,
      ...getTableConfig(subscriptionAcquisitions).checks,
      ...getTableConfig(customerSubscriptions).checks,
      ...getTableConfig(subscriptionEvents).checks,
      ...getTableConfig(subscriptionInvoiceOrders).checks,
    ].map(({ name }) => name);
    expect(checkNames).toEqual(expect.arrayContaining([
      "subscription_plans_price_id_check",
      "subscription_acquisitions_setup_intent_check",
      "subscription_provider_customers_stripe_id_check",
      "subscription_acquisitions_address_check",
      "subscription_acquisitions_shipping_required_check",
      "subscription_acquisitions_shipping_mode_check",
      "subscription_acquisitions_consent_check",
      "customer_subscriptions_subscription_id_check",
      "customer_subscriptions_pause_check",
      "customer_subscriptions_shipping_required_check",
      "customer_subscriptions_shipping_mode_check",
      "subscription_events_details_check",
      "subscription_invoice_orders_invoice_id_check",
      "subscription_invoice_orders_payment_intent_check",
      "subscription_invoice_orders_currency_check",
    ]));
  });

  it("maps durable SetupIntent acquisition attempts without payment secrets", () => {
    const config = getTableConfig(subscriptionAcquisitions);
    const names = config.columns.map(({ name }) => name);
    expect(names).toEqual([
      "id",
      "setup_intent_id",
      "plan_id",
      "product_id",
      "variant_id",
      "currency_code",
      "unit_amount_minor",
      "stripe_price_id",
      "cadence_unit",
      "cadence_count",
      "customer_id",
      "stripe_customer_id",
      "quantity",
      "shipping_required",
      "shipping_address",
      "consent_record",
      "status",
      "stripe_subscription_id",
      "created_at",
      "updated_at",
    ]);
    expect(names).not.toContain("payment_method_id");
    expect(config.columns.find(({ name }) => name === "setup_intent_id")?.isUnique).toBe(true);
    expect(config.indexes.map(({ config: indexConfig }) => indexConfig.name)).toContain(
      "subscription_acquisitions_lifecycle_binding_unique",
    );
  });

  it("keeps audit provider ids non-unique and cascades only audit deletion", () => {
    const eventConfig = getTableConfig(subscriptionEvents);
    const providerEvent = eventConfig.columns.find(({ name }) => name === "provider_event_id");
    expect(providerEvent?.isUnique).toBe(false);
    expect(eventConfig.foreignKeys[0].onDelete).toBe("cascade");
  });

  it("links lifecycle state through the complete reserved acquisition identity", () => {
    const foreignKeys = getTableConfig(customerSubscriptions).foreignKeys;
    const binding = foreignKeys.find((key) => key.reference().columns.length === 6);
    expect(binding?.reference().columns.map(({ name }) => name)).toEqual([
      "acquisition_id",
      "plan_id",
      "customer_id",
      "stripe_customer_id",
      "stripe_subscription_id",
      "shipping_required",
    ]);
    expect(binding?.reference().foreignColumns.map(({ name }) => name)).toEqual([
      "id",
      "plan_id",
      "customer_id",
      "stripe_customer_id",
      "stripe_subscription_id",
      "shipping_required",
    ]);
  });

  it("uses invoice and order identities as renewal-order uniqueness boundaries", () => {
    const config = getTableConfig(subscriptionInvoiceOrders);
    expect(config.columns.find(({ name }) => name === "stripe_invoice_id")?.primary).toBe(true);
    expect(config.columns.find(({ name }) => name === "order_id")?.isUnique).toBe(true);
    expect(config.foreignKeys.every(({ onDelete }) => onDelete === "restrict")).toBe(true);
  });
});
