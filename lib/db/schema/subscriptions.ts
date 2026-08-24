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
export type SubscriptionAcquisitionStatus =
  | "pending"
  | "provider_created"
  | "completed"
  | "failed";

export interface SubscriptionConsentRecord {
  termsVersion: string;
  acceptedAt: string;
  source: "checkout" | "admin" | "migration";
}

export interface SubscriptionPauseCollection {
  behavior: "keep_as_draft" | "mark_uncollectible" | "void";
  resumesAt?: number;
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
  uniqueIndex("subscription_plans_binding_unique").on(
    table.id,
    table.productId,
    table.variantId,
    table.currencyCode,
    table.unitAmountMinor,
    table.stripePriceId,
    table.cadenceUnit,
    table.cadenceCount,
  ),
  check("subscription_plans_currency_check", sql`
    length(${table.currencyCode}) = 3
    AND ${table.currencyCode} = upper(${table.currencyCode})
    AND ${table.currencyCode} NOT GLOB '*[^A-Z]*'
  `),
  check("subscription_plans_amount_check", sql`
    ${table.unitAmountMinor} >= 0
    AND (${table.isActive} = 0 OR ${table.unitAmountMinor} > 0)
  `),
  check("subscription_plans_id_check", sql`length(${table.id}) BETWEEN 1 AND 128`),
  check("subscription_plans_product_id_check", sql`length(${table.productId}) BETWEEN 1 AND 128`),
  check("subscription_plans_variant_id_check", sql`length(${table.variantId}) BETWEEN 1 AND 128`),
  check("subscription_plans_price_id_check", sql`
    length(${table.stripePriceId}) BETWEEN 7 AND 255
    AND ${table.stripePriceId} GLOB 'price_*'
  `),
  check("subscription_plans_cadence_unit_check", sql`
    ${table.cadenceUnit} IN ('day', 'week', 'month', 'year')
  `),
  check("subscription_plans_active_check", sql`${table.isActive} IN (0, 1)`),
  check("subscription_plans_cadence_count_check", sql`${table.cadenceCount} BETWEEN 1 AND 365`),
]);

export const subscriptionProviderCustomers = sqliteTable("subscription_provider_customers", {
  customerId: text("customer_id").primaryKey().references(() => customers.id, { onDelete: "restrict" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  createdAt: text("created_at").notNull().default(isoNow),
  updatedAt: text("updated_at").notNull().default(isoNow),
}, (table) => [
  uniqueIndex("subscription_provider_customers_pair_unique")
    .on(table.customerId, table.stripeCustomerId),
  check("subscription_provider_customers_stripe_id_check", sql`
    length(${table.stripeCustomerId}) BETWEEN 5 AND 255
    AND ${table.stripeCustomerId} GLOB 'cus_*'
  `),
]);

export const subscriptionAcquisitions = sqliteTable("subscription_acquisitions", {
  id: text("id").primaryKey(),
  setupIntentId: text("setup_intent_id").notNull().unique(),
  planId: text("plan_id").notNull(),
  productId: text("product_id").notNull(),
  variantId: text("variant_id").notNull(),
  currencyCode: text("currency_code").notNull(),
  unitAmountMinor: integer("unit_amount_minor").notNull(),
  stripePriceId: text("stripe_price_id").notNull(),
  cadenceUnit: text("cadence_unit", { enum: ["day", "week", "month", "year"] }).notNull(),
  cadenceCount: integer("cadence_count").notNull(),
  customerId: text("customer_id").notNull(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  shippingRequired: integer("shipping_required", { mode: "boolean" }).notNull(),
  shippingAddress: text("shipping_address", { mode: "json" }).$type<Address>(),
  consentRecord: text("consent_record", { mode: "json" }).$type<SubscriptionConsentRecord>().notNull(),
  status: text("status", {
    enum: ["pending", "provider_created", "completed", "failed"],
  }).notNull().default("pending"),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  createdAt: text("created_at").notNull().default(isoNow),
  updatedAt: text("updated_at").notNull().default(isoNow),
}, (table) => [
  foreignKey({
    columns: [
      table.planId,
      table.productId,
      table.variantId,
      table.currencyCode,
      table.unitAmountMinor,
      table.stripePriceId,
      table.cadenceUnit,
      table.cadenceCount,
    ],
    foreignColumns: [
      subscriptionPlans.id,
      subscriptionPlans.productId,
      subscriptionPlans.variantId,
      subscriptionPlans.currencyCode,
      subscriptionPlans.unitAmountMinor,
      subscriptionPlans.stripePriceId,
      subscriptionPlans.cadenceUnit,
      subscriptionPlans.cadenceCount,
    ],
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.customerId, table.stripeCustomerId],
    foreignColumns: [
      subscriptionProviderCustomers.customerId,
      subscriptionProviderCustomers.stripeCustomerId,
    ],
  }).onDelete("restrict"),
  index("subscription_acquisitions_customer_status_idx").on(table.customerId, table.status),
  index("subscription_acquisitions_plan_idx").on(table.planId),
  uniqueIndex("subscription_acquisitions_lifecycle_binding_unique").on(
    table.id,
    table.planId,
    table.customerId,
    table.stripeCustomerId,
    table.stripeSubscriptionId,
    table.shippingRequired,
  ),
  check("subscription_acquisitions_id_check", sql`length(${table.id}) BETWEEN 1 AND 128`),
  check("subscription_acquisitions_setup_intent_check", sql`
    length(${table.setupIntentId}) BETWEEN 6 AND 255
    AND ${table.setupIntentId} GLOB 'seti_*'
  `),
  check("subscription_acquisitions_product_check", sql`length(${table.productId}) BETWEEN 1 AND 128`),
  check("subscription_acquisitions_variant_check", sql`length(${table.variantId}) BETWEEN 1 AND 128`),
  check("subscription_acquisitions_currency_check", sql`
    length(${table.currencyCode}) = 3
    AND ${table.currencyCode} = upper(${table.currencyCode})
    AND ${table.currencyCode} NOT GLOB '*[^A-Z]*'
  `),
  check("subscription_acquisitions_amount_check", sql`${table.unitAmountMinor} > 0`),
  check("subscription_acquisitions_price_check", sql`
    length(${table.stripePriceId}) BETWEEN 7 AND 255
    AND ${table.stripePriceId} GLOB 'price_*'
  `),
  check("subscription_acquisitions_cadence_check", sql`
    ${table.cadenceUnit} IN ('day', 'week', 'month', 'year')
    AND ${table.cadenceCount} BETWEEN 1 AND 365
  `),
  check("subscription_acquisitions_customer_check", sql`
    length(${table.stripeCustomerId}) BETWEEN 5 AND 255
    AND ${table.stripeCustomerId} GLOB 'cus_*'
  `),
  check("subscription_acquisitions_quantity_check", sql`${table.quantity} BETWEEN 1 AND 1000`),
  check("subscription_acquisitions_shipping_required_check", sql`
    ${table.shippingRequired} IN (0, 1)
  `),
  check("subscription_acquisitions_address_check", sql`
    ${table.shippingAddress} IS NULL OR (
      length(${table.shippingAddress}) <= 32768
      AND json_valid(${table.shippingAddress})
      AND json_type(${table.shippingAddress}) = 'object'
    )
  `),
  check("subscription_acquisitions_shipping_mode_check", sql`
    (${table.shippingRequired} = 1 AND ${table.shippingAddress} IS NOT NULL)
    OR (${table.shippingRequired} = 0 AND ${table.shippingAddress} IS NULL)
  `),
  check("subscription_acquisitions_consent_check", sql`
    length(${table.consentRecord}) BETWEEN 2 AND 16384
    AND json_valid(${table.consentRecord})
    AND json_type(${table.consentRecord}) = 'object'
  `),
  check("subscription_acquisitions_status_check", sql`
    ${table.status} IN ('pending', 'provider_created', 'completed', 'failed')
  `),
  check("subscription_acquisitions_subscription_check", sql`
    ${table.stripeSubscriptionId} IS NULL OR (
      length(${table.stripeSubscriptionId}) BETWEEN 5 AND 255
      AND ${table.stripeSubscriptionId} GLOB 'sub_*'
    )
  `),
]);

export const customerSubscriptions = sqliteTable("customer_subscriptions", {
  id: text("id").primaryKey(),
  planId: text("plan_id").notNull().references(() => subscriptionPlans.id, { onDelete: "restrict" }),
  customerId: text("customer_id").notNull(),
  acquisitionId: text("acquisition_id").notNull().unique(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  shippingRequired: integer("shipping_required", { mode: "boolean" }).notNull(),
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
  pauseCollection: text("pause_collection", { mode: "json" }).$type<SubscriptionPauseCollection>(),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
  cancelAt: integer("cancel_at"),
  canceledAt: integer("canceled_at"),
  endedAt: integer("ended_at"),
  latestLifecycleEventCreatedAt: integer("latest_lifecycle_event_created_at").notNull(),
  latestLifecycleEventId: text("latest_lifecycle_event_id").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(isoNow),
  updatedAt: text("updated_at").notNull().default(isoNow),
}, (table) => [
  foreignKey({
    columns: [
      table.acquisitionId,
      table.planId,
      table.customerId,
      table.stripeCustomerId,
      table.stripeSubscriptionId,
      table.shippingRequired,
    ],
    foreignColumns: [
      subscriptionAcquisitions.id,
      subscriptionAcquisitions.planId,
      subscriptionAcquisitions.customerId,
      subscriptionAcquisitions.stripeCustomerId,
      subscriptionAcquisitions.stripeSubscriptionId,
      subscriptionAcquisitions.shippingRequired,
    ],
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.customerId, table.stripeCustomerId],
    foreignColumns: [
      subscriptionProviderCustomers.customerId,
      subscriptionProviderCustomers.stripeCustomerId,
    ],
  }).onDelete("restrict"),
  index("customer_subscriptions_customer_status_idx").on(table.customerId, table.status),
  index("customer_subscriptions_plan_idx").on(table.planId),
  check("customer_subscriptions_quantity_check", sql`${table.quantity} BETWEEN 1 AND 1000`),
  check("customer_subscriptions_shipping_required_check", sql`
    ${table.shippingRequired} IN (0, 1)
  `),
  check("customer_subscriptions_id_check", sql`length(${table.id}) BETWEEN 1 AND 128`),
  check("customer_subscriptions_subscription_id_check", sql`
    length(${table.stripeSubscriptionId}) BETWEEN 5 AND 255
    AND ${table.stripeSubscriptionId} GLOB 'sub_*'
  `),
  check("customer_subscriptions_customer_id_check", sql`
    length(${table.stripeCustomerId}) BETWEEN 5 AND 255
    AND ${table.stripeCustomerId} GLOB 'cus_*'
  `),
  check("customer_subscriptions_status_check", sql`
    ${table.status} IN (
      'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due',
      'paused', 'canceled', 'unpaid'
    )
  `),
  check("customer_subscriptions_address_check", sql`
    ${table.shippingAddress} IS NULL OR (
      length(${table.shippingAddress}) <= 32768
      AND json_valid(${table.shippingAddress})
      AND json_type(${table.shippingAddress}) = 'object'
    )
  `),
  check("customer_subscriptions_shipping_mode_check", sql`
    (${table.shippingRequired} = 1 AND ${table.shippingAddress} IS NOT NULL)
    OR (${table.shippingRequired} = 0 AND ${table.shippingAddress} IS NULL)
  `),
  check("customer_subscriptions_consent_check", sql`
    length(${table.consentRecord}) BETWEEN 2 AND 16384
    AND json_valid(${table.consentRecord})
    AND json_type(${table.consentRecord}) = 'object'
  `),
  check("customer_subscriptions_period_check", sql`
    (${table.currentPeriodStart} IS NULL OR ${table.currentPeriodStart} >= 0)
    AND (${table.currentPeriodEnd} IS NULL OR (
      ${table.currentPeriodEnd} >= 0
      AND (${table.currentPeriodStart} IS NULL OR ${table.currentPeriodEnd} >= ${table.currentPeriodStart})
    ))
  `),
  check("customer_subscriptions_pause_check", sql`
    ${table.pauseCollection} IS NULL OR (
      length(${table.pauseCollection}) <= 16384
      AND json_valid(${table.pauseCollection})
      AND json_type(${table.pauseCollection}) = 'object'
    )
  `),
  check("customer_subscriptions_cancel_period_check", sql`${table.cancelAtPeriodEnd} IN (0, 1)`),
  check("customer_subscriptions_cancel_at_check", sql`${table.cancelAt} IS NULL OR ${table.cancelAt} >= 0`),
  check("customer_subscriptions_canceled_at_check", sql`${table.canceledAt} IS NULL OR ${table.canceledAt} >= 0`),
  check("customer_subscriptions_ended_at_check", sql`${table.endedAt} IS NULL OR ${table.endedAt} >= 0`),
  check("customer_subscriptions_event_created_check", sql`${table.latestLifecycleEventCreatedAt} >= 0`),
  check("customer_subscriptions_event_id_check", sql`
    length(${table.latestLifecycleEventId}) BETWEEN 1 AND 255
  `),
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
  check("subscription_events_id_check", sql`length(${table.id}) BETWEEN 1 AND 128`),
  check("subscription_events_provider_id_check", sql`
    length(${table.providerEventId}) BETWEEN 1 AND 255
  `),
  check("subscription_events_type_check", sql`
    ${table.eventType} IN (
      'created', 'updated', 'paused', 'resumed', 'canceled', 'renewed',
      'payment_failed', 'payment_recovered', 'skipped'
    )
  `),
  check("subscription_events_outcome_check", sql`
    ${table.outcome} IN (
      'applied', 'duplicate', 'ignored_stale', 'refresh_required', 'failed'
    )
  `),
  check("subscription_events_details_check", sql`
    ${table.details} IS NULL OR (
      length(${table.details}) <= 32768
      AND json_valid(${table.details})
      AND json_type(${table.details}) = 'object'
    )
  `),
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
  check("subscription_invoice_orders_invoice_id_check", sql`
    length(${table.stripeInvoiceId}) BETWEEN 4 AND 255
    AND ${table.stripeInvoiceId} GLOB 'in_*'
  `),
  check("subscription_invoice_orders_payment_intent_check", sql`
    ${table.stripePaymentIntentId} IS NULL OR (
      length(${table.stripePaymentIntentId}) BETWEEN 4 AND 255
      AND ${table.stripePaymentIntentId} GLOB 'pi_*'
    )
  `),
  check("subscription_invoice_orders_currency_check", sql`
    length(${table.currencyCode}) = 3
    AND ${table.currencyCode} = upper(${table.currencyCode})
    AND ${table.currencyCode} NOT GLOB '*[^A-Z]*'
  `),
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
export type SubscriptionProviderCustomerRow = typeof subscriptionProviderCustomers.$inferSelect;
export type SubscriptionProviderCustomerInsert = typeof subscriptionProviderCustomers.$inferInsert;
export type SubscriptionAcquisitionRow = typeof subscriptionAcquisitions.$inferSelect;
export type SubscriptionAcquisitionInsert = typeof subscriptionAcquisitions.$inferInsert;
export type CustomerSubscriptionRow = typeof customerSubscriptions.$inferSelect;
export type CustomerSubscriptionInsert = typeof customerSubscriptions.$inferInsert;
export type SubscriptionEventRow = typeof subscriptionEvents.$inferSelect;
export type SubscriptionEventInsert = typeof subscriptionEvents.$inferInsert;
export type SubscriptionInvoiceOrderRow = typeof subscriptionInvoiceOrders.$inferSelect;
export type SubscriptionInvoiceOrderInsert = typeof subscriptionInvoiceOrders.$inferInsert;
