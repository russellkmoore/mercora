/**
 * Payment Customer Binding Schema
 *
 * Drizzle ORM definition for `payment_customers` (migration 0025), the
 * durable customer <-> Stripe-customer binding checkout saved-card storage
 * stands on (Phase 17, PAY-01). Modeled byte-for-byte on the existing
 * `subscription_provider_customers` table shape
 * (lib/db/schema/subscriptions.ts) but kept as its own table, its own
 * migration, its own module — see D-02 in
 * .planning/phases/17-saved-payment-methods/17-CONTEXT.md for why this is
 * deliberately not shared with the subscriptions binding.
 */

import { sql } from "drizzle-orm";
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { customers } from "./customer";

const isoNow = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const paymentCustomers = sqliteTable("payment_customers", {
  customerId: text("customer_id").primaryKey().references(() => customers.id, { onDelete: "restrict" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  createdAt: text("created_at").notNull().default(isoNow),
  updatedAt: text("updated_at").notNull().default(isoNow),
}, (table) => [
  check("payment_customers_stripe_id_check", sql`
    length(${table.stripeCustomerId}) BETWEEN 5 AND 255
    AND ${table.stripeCustomerId} GLOB 'cus_*'
  `),
]);
