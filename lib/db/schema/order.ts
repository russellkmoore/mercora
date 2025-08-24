// lib/db/schema/order.ts - SQLite Order Schema (Application-specific, not MACH Alliance)

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * Orders Table - Application-specific (not defined by MACH Alliance)
 * Stores complete order information with items as JSON array
 * Aligned with schema.sql definitions
 */
export const orders = sqliteTable("orders", {
  // Core identification
  id: text("id").primaryKey(),
  customer_id: text("customer_id"), // References customers table
  
  // Order status and lifecycle
  status: text("status", { 
    enum: ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"] 
  }).default("pending").notNull(),
  
  // Financial information (using JSON for Money objects)
  total_amount: text("total_amount", { mode: "json" }).notNull(), // Money object: {amount: number, currency: string}
  currency_code: text("currency_code", { length: 3 }).notNull(), // ISO 4217
  
  // Addresses (JSON objects)
  shipping_address: text("shipping_address", { mode: "json" }), // Address object
  billing_address: text("billing_address", { mode: "json" }), // Address object
  
  // Order items (JSON array) - This is where all items are stored
  items: text("items", { mode: "json" }).notNull(), // Array of order items
  
  // Shipping and payment
  shipping_method: text("shipping_method"),
  payment_method: text("payment_method"),
  payment_status: text("payment_status", {
    enum: ["pending", "paid", "failed", "refunded"]
  }).default("pending"),
  
  // Additional metadata
  notes: text("notes"),
  external_references: text("external_references", { mode: "json" }),
  extensions: text("extensions", { mode: "json" }),
  
  // Timestamps and tracking
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
  shipped_at: text("shipped_at"), // ISO 8601 timestamp
  delivered_at: text("delivered_at"), // ISO 8601 timestamp
  tracking_number: text("tracking_number"),
});

// Order Webhooks Table - For order processing and notifications
export const order_webhooks = sqliteTable("order_webhooks", {
  id: text("id").primaryKey(),
  order_id: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  webhook_type: text("webhook_type", {
    enum: ["order_created", "order_updated", "payment_completed", "shipment_created", "delivery_confirmed"]
  }).notNull(),
  status: text("status", {
    enum: ["pending", "processing", "completed", "failed", "retrying"]
  }).default("pending"),
  payload: text("payload", { mode: "json" }).notNull(), // JSON webhook payload
  response: text("response", { mode: "json" }), // JSON webhook response
  endpoint_url: text("endpoint_url"),
  attempts: integer("attempts").default(0),
  max_attempts: integer("max_attempts").default(3),
  next_retry_at: text("next_retry_at"),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
  completed_at: text("completed_at")
});

// Relations
export const orderRelations = relations(orders, ({ many }) => ({
  webhooks: many(order_webhooks)
}));

export const orderWebhookRelations = relations(order_webhooks, ({ one }) => ({
  order: one(orders, {
    fields: [order_webhooks.order_id],
    references: [orders.id]
  })
}));
