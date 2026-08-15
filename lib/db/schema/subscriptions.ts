import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { Address } from "@/lib/types";
import { customers } from "./customer";
import { orders } from "./order";
import { product_variants } from "./products";

export type SubscriptionCadenceUnit = "day" | "week" | "month" | "year";
export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "unpaid";
export type SubscriptionEventType =
  | "created"
  | "updated"
  | "paused"
  | "resumed"
  | "canceled"
  | "renewed"
  | "payment_failed"
  | "payment_recovered"
  | "skipped";
export type SubscriptionEventOutcome =
  | "applied"
  | "duplicate"
  | "ignored_stale"
  | "refresh_required"
  | "failed";

export interface SubscriptionConsentRecord {
  termsVersion: string;
  acceptedAt: string;
  source: "checkout" | "admin" | "migration";
}

const isoNow = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const subscriptionPlans = sqliteTable("subscription_plans", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  variantId: text("variant_id").notNull(),
  currencyCode: text("currency_code").notNull(),
  unitAmountMinor: integer("unit_amount_minor").notNull(),
  stripePriceId: text("stripe_price_id").notNull().unique(),
  cadenceUnit: text("cadence_unit", {
    enum: ["day", "week", "month", "year"],
  }).notNull(),
  cadenceCount: integer("cadence_count").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(isoNow),
  updatedAt: text("updated_at").notNull().default(isoNow),
}, (table) => [
  foreignKey({
    columns: [table.productId, table.variantId],
    foreignColumns: [product_variants.product_id, product_variants.id],
  }).onDelete("restrict"),
  index("subscription_plans_product_variant_idx").on(table.productId, table.variantId),
  uniqueIndex("subscription_plans_active_cadence_unique")
    .on(table.productId, table.variantId, table.currencyCode, table.cadenceUnit, table.cadenceCount)
    .where(sql`${table.isActive} = 1`),
  check("subscription_plans_currency_check", sql`
    length(${table.currencyCode}) = 3
    AND ${table.currencyCode} = upper(${table.currencyCode})
    AND ${table.currencyCode} NOT GLOB '*[^A-Z]*'
  `),
  check("subscription_plans_amount_check", sql`
    ${table.unitAmountMinor} >= 0
    AND (${table.isActive} = 0 OR ${table.unitAmountMinor} > 0)
  `),
  check("subscription_plans_cadence_count_check", sql`${table.cadenceCount} BETWEEN 1 AND 365`),
]);

export const customerSubscriptions = sqliteTable("customer_subscriptions", {
  id: text("id").primaryKey(),
  planId: text("plan_id").notNull().references(() => subscriptionPlans.id, { onDelete: "restrict" }),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
  sourceOrderId: text("source_order_id").notNull().unique().references(() => orders.id, { onDelete: "restrict" }),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  status: text("status", {
    enum: [
      "incomplete",
      "incomplete_expired",
      "trialing",
      "active",
      "past_due",
      "paused",
      "canceled",
      "unpaid",
    ],
  }).notNull(),
  shippingAddress: text("shipping_address", { mode: "json" }).$type<Address>(),
  consentRecord: text("consent_record", { mode: "json" }).$type<SubscriptionConsentRecord>().notNull(),
  currentPeriodStart: integer("current_period_start"),
  currentPeriodEnd: integer("current_period_end"),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
  cancelAt: integer("cancel_at"),
  canceledAt: integer("canceled_at"),
  latestLifecycleEventCreatedAt: integer("latest_lifecycle_event_created_at").notNull(),
  latestLifecycleEventId: text("latest_lifecycle_event_id").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(isoNow),
  updatedAt: text("updated_at").notNull().default(isoNow),
}, (table) => [
  index("customer_subscriptions_customer_status_idx").on(table.customerId, table.status),
  index("customer_subscriptions_plan_idx").on(table.planId),
  check("customer_subscriptions_quantity_check", sql`${table.quantity} BETWEEN 1 AND 1000`),
  check("customer_subscriptions_period_check", sql`
    (${table.currentPeriodStart} IS NULL OR ${table.currentPeriodStart} >= 0)
    AND (${table.currentPeriodEnd} IS NULL OR (
      ${table.currentPeriodEnd} >= 0
      AND (${table.currentPeriodStart} IS NULL OR ${table.currentPeriodEnd} >= ${table.currentPeriodStart})
    ))
  `),
  check("customer_subscriptions_cancel_at_check", sql`${table.cancelAt} IS NULL OR ${table.cancelAt} >= 0`),
  check("customer_subscriptions_canceled_at_check", sql`${table.canceledAt} IS NULL OR ${table.canceledAt} >= 0`),
  check("customer_subscriptions_event_created_check", sql`${table.latestLifecycleEventCreatedAt} >= 0`),
  check("customer_subscriptions_version_check", sql`${table.version} >= 1`),
]);

export const subscriptionEvents = sqliteTable("subscription_events", {
  id: text("id").primaryKey(),
  subscriptionId: text("subscription_id").notNull().references(
    () => customerSubscriptions.id,
    { onDelete: "cascade" },
  ),
  providerEventId: text("provider_event_id").notNull(),
  providerEventCreatedAt: integer("provider_event_created_at").notNull(),
  eventType: text("event_type", {
    enum: [
      "created",
      "updated",
      "paused",
      "resumed",
      "canceled",
      "renewed",
      "payment_failed",
      "payment_recovered",
      "skipped",
    ],
  }).notNull(),
  outcome: text("outcome", {
    enum: ["applied", "duplicate", "ignored_stale", "refresh_required", "failed"],
  }).notNull(),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: text("created_at").notNull().default(isoNow),
}, (table) => [
  index("subscription_events_subscription_created_idx").on(
    table.subscriptionId,
    table.providerEventCreatedAt,
    table.createdAt,
  ),
  index("subscription_events_provider_event_idx").on(table.providerEventId),
  check("subscription_events_created_check", sql`${table.providerEventCreatedAt} >= 0`),
]);

export const subscriptionInvoiceOrders = sqliteTable("subscription_invoice_orders", {
  stripeInvoiceId: text("stripe_invoice_id").primaryKey(),
  subscriptionId: text("subscription_id").notNull().references(
    () => customerSubscriptions.id,
    { onDelete: "restrict" },
  ),
  orderId: text("order_id").notNull().unique().references(() => orders.id, { onDelete: "restrict" }),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paidAmountMinor: integer("paid_amount_minor").notNull(),
  currencyCode: text("currency_code").notNull(),
  periodStart: integer("period_start"),
  periodEnd: integer("period_end"),
  verifiedPaidAt: integer("verified_paid_at").notNull(),
  createdAt: text("created_at").notNull().default(isoNow),
}, (table) => [
  index("subscription_invoice_orders_subscription_idx").on(
    table.subscriptionId,
    table.verifiedPaidAt,
  ),
  check("subscription_invoice_orders_amount_check", sql`${table.paidAmountMinor} >= 0`),
  check("subscription_invoice_orders_verified_check", sql`${table.verifiedPaidAt} >= 0`),
  check("subscription_invoice_orders_period_check", sql`
    (${table.periodStart} IS NULL OR ${table.periodStart} >= 0)
    AND (${table.periodEnd} IS NULL OR (
      ${table.periodEnd} >= 0
      AND (${table.periodStart} IS NULL OR ${table.periodEnd} >= ${table.periodStart})
    ))
  `),
]);

export type SubscriptionPlanRow = typeof subscriptionPlans.$inferSelect;
export type SubscriptionPlanInsert = typeof subscriptionPlans.$inferInsert;
export type CustomerSubscriptionRow = typeof customerSubscriptions.$inferSelect;
export type CustomerSubscriptionInsert = typeof customerSubscriptions.$inferInsert;
export type SubscriptionEventRow = typeof subscriptionEvents.$inferSelect;
export type SubscriptionEventInsert = typeof subscriptionEvents.$inferInsert;
export type SubscriptionInvoiceOrderRow = typeof subscriptionInvoiceOrders.$inferSelect;
export type SubscriptionInvoiceOrderInsert = typeof subscriptionInvoiceOrders.$inferInsert;
