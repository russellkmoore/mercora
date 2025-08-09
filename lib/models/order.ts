// lib/models/order.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDbAsync } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Orders Table - Application-specific order management
 * Items are stored as JSON array in the items column
 * Aligned with schema.sql definitions
 */
export const orders = sqliteTable("orders", {
  // Core identification
  id: text("id")
    .primaryKey()
    .$defaultFn(() => `ORD-${nanoid(8).toUpperCase()}`),
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
  
  // Tracking and fulfillment
  tracking_number: text("tracking_number"),
  shipped_at: text("shipped_at"), // ISO 8601 timestamp
  delivered_at: text("delivered_at"), // ISO 8601 timestamp
  
  // Additional metadata
  notes: text("notes"),
  external_references: text("external_references", { mode: "json" }),
  extensions: text("extensions", { mode: "json" }),
  
  // Timestamps
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const orderRelations = relations(orders, () => ({}));

// Order Webhooks Table - For order processing and notifications
export const order_webhooks = sqliteTable("order_webhooks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => `ORW-${nanoid(8).toUpperCase()}`),
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

// CRUD Operations for Orders

// Create order
export async function insertOrder(order: typeof orders.$inferInsert) {
  const db = await getDbAsync();
  const inserted = await db.insert(orders).values(order).returning();
  return inserted[0];
}

// Get all orders for a customer
export async function getOrdersByCustomerId(customerId: string) {
  const db = await getDbAsync();
  return db.select().from(orders).where(eq(orders.customer_id, customerId));
}

// Get a specific order by ID
export async function getOrderById(id: string) {
  const db = await getDbAsync();
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0] || null;
}

// Update order status
export async function updateOrderStatus(
  id: string,
  status: (typeof orders.$inferSelect)["status"]
) {
  const db = await getDbAsync();
  const now = new Date().toISOString();
  return db
    .update(orders)
    .set({ status, updated_at: now })
    .where(eq(orders.id, id));
}

// Update order with shipping information
export async function updateOrderShipping(
  id: string,
  shippingData: {
    status?: (typeof orders.$inferSelect)["status"];
    tracking_number?: string;
    shipped_at?: string;
    delivered_at?: string;
  }
) {
  const db = await getDbAsync();
  const now = new Date().toISOString();
  
  const updateData = {
    ...shippingData,
    updated_at: now,
  };
  
  // Set shipped_at if status is being changed to shipped and not already set
  if (shippingData.status === "shipped" && !shippingData.shipped_at) {
    updateData.shipped_at = now;
  }
  
  // Set delivered_at if status is being changed to delivered and not already set
  if (shippingData.status === "delivered" && !shippingData.delivered_at) {
    updateData.delivered_at = now;
  }
  
  return db
    .update(orders)
    .set(updateData)
    .where(eq(orders.id, id));
}

// Add cancellation information
export async function cancelOrder(
  id: string,
  cancellationReason: string,
  notes?: string
) {
  const db = await getDbAsync();
  const now = new Date().toISOString();
  
  return db
    .update(orders)
    .set({
      status: "cancelled",
      notes,
      updated_at: now,
    })
    .where(eq(orders.id, id));
}

// Get orders by status
export async function getOrdersByStatus(status: (typeof orders.$inferSelect)["status"]) {
  const db = await getDbAsync();
  return db.select().from(orders).where(eq(orders.status, status));
}

// Webhook operations
export async function insertOrderWebhook(webhookData: typeof order_webhooks.$inferInsert) {
  const db = await getDbAsync();
  const inserted = await db.insert(order_webhooks).values(webhookData).returning();
  return inserted[0];
}

export async function getUnprocessedWebhooks() {
  const db = await getDbAsync();
  return db
    .select()
    .from(order_webhooks)
    .where(eq(order_webhooks.status, "pending"));
}

export async function markWebhookProcessed(id: string) {
  const db = await getDbAsync();
  const now = new Date().toISOString();
  
  return db
    .update(order_webhooks)
    .set({
      status: "completed",
      completed_at: now,
      updated_at: now,
    })
    .where(eq(order_webhooks.id, id));
}
