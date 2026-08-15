import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "migrations", "0021_add_subscriptions.sql"),
  "utf8",
);
const statements = sql.replace(/^\s*--.*$/gm, "");

describe("subscription foundation migration", () => {
  it("is additive and reuses the core webhook claim ledger", () => {
    expect(sql).toContain("CREATE TABLE subscription_plans");
    expect(sql).toContain("CREATE TABLE subscription_provider_customers");
    expect(sql).toContain("CREATE TABLE subscription_acquisitions");
    expect(sql).toContain("CREATE TABLE customer_subscriptions");
    expect(sql).toContain("CREATE TABLE subscription_events");
    expect(sql).toContain("CREATE TABLE subscription_invoice_orders");
    expect(sql).not.toMatch(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?processed_webhook_events/i);
    expect(statements).not.toMatch(/^\s*(?:DROP|DELETE|UPDATE)\b/im);
  });

  it("binds plans to an exact variant, currency, Stripe price, and cadence", () => {
    expect(sql).toContain("FOREIGN KEY (product_id, variant_id)");
    expect(sql).toContain("REFERENCES product_variants(product_id, id)");
    expect(sql).toContain("stripe_price_id TEXT NOT NULL UNIQUE");
    expect(sql).toContain("currency_code TEXT NOT NULL");
    expect(sql).toContain("cadence_unit TEXT NOT NULL");
    expect(sql).toContain("cadence_count INTEGER NOT NULL");
    expect(sql).toContain("subscription_plans_active_cadence_unique");
  });

  it("records consent, address snapshots, monotonic provider state, and invoice identity", () => {
    expect(sql).toContain("shipping_address TEXT CHECK");
    expect(sql).toContain("consent_record TEXT NOT NULL CHECK");
    expect(sql).toContain("setup_intent_id TEXT NOT NULL UNIQUE CHECK");
    expect(sql).toContain("subscription_plans_binding_unique");
    expect(sql).toContain("unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor > 0)");
    expect(sql).toContain("acquisition_id TEXT NOT NULL UNIQUE");
    expect(sql).toContain("pause_collection TEXT CHECK");
    expect(sql).toContain("cancel_at INTEGER CHECK");
    expect(sql).toContain("ended_at INTEGER CHECK");
    expect(sql).toContain("latest_lifecycle_event_created_at INTEGER NOT NULL");
    expect(sql).toContain("latest_lifecycle_event_id TEXT NOT NULL");
    expect(sql).toContain("stripe_invoice_id TEXT PRIMARY KEY");
    expect(sql).toContain("order_id TEXT NOT NULL UNIQUE REFERENCES orders(id)");
    expect(sql).toContain("verified_paid_at INTEGER NOT NULL");
  });

  it("permits free plan definitions only while they are inactive", () => {
    expect(sql).toContain("CHECK (is_active = 0 OR unit_amount_minor > 0)");
  });
});
