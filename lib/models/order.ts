// lib/models/order.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDbAsync } from "@/lib/db";
import { sql } from "drizzle-orm";
import { Order } from "../types/order";

export const orders = sqliteTable("orders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => `ORD-${nanoid(8).toUpperCase()}`),
  userId: text("user_id"),
  email: text("email").notNull(),
  items: text("items", { mode: "json" }).notNull(),
  shippingAddress: text("shipping_address", { mode: "json" }),
  billingAddress: text("billing_address", { mode: "json" }),
  shippingOption: text("shipping_option", { mode: "json" }),
  shippingCost: integer("shipping_cost").notNull(),
  billingInfo: text("billing_info", { mode: "json" }),
  taxAmount: integer("tax_amount"),
  total: integer("total"),
  status: text("status")
    .$type<"incomplete" | "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled">()
    .notNull()
    .default("incomplete"),
  
  // Shipping tracking fields
  carrier: text("carrier"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  shippedAt: text("shipped_at"),
  deliveredAt: text("delivered_at"),
  
  // Additional metadata
  cancellationReason: text("cancellation_reason"),
  notes: text("notes"),
  
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const orderRelations = relations(orders, () => ({}));

// Webhook events table for tracking status updates and delivery confirmations
export const orderWebhooks = sqliteTable("order_webhooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  eventType: text("event_type")
    .$type<"status_update" | "tracking_update" | "delivery_confirmation" | "exception">()
    .notNull(),
  payload: text("payload", { mode: "json" }).notNull(), // JSON webhook payload
  source: text("source").notNull(), // 'admin', 'carrier_webhook', 'system'
  processed: integer("processed", { mode: "boolean" }).default(false),
  processedAt: text("processed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Create order
export async function insertOrder(order: Order) {
  const db = await getDbAsync();
  // Omit 'id' if it's a number, so Drizzle can generate it, or convert to string if needed
  const { id, ...rest } = order as any;
  const insertValue =
    typeof id === "number"
      ? rest
      : { ...order, id: typeof id === "string" ? id : undefined };
  const inserted = await db.insert(orders).values(insertValue).returning();
  return inserted[0];
}

// Get all orders for a user
export async function getOrdersByUserId(userId: string) {
  const db = await getDbAsync();
  return db.select().from(orders).where(eq(orders.userId, userId));
}

// Get a specific order by ID
export async function getOrderById(id: string) {
  const db = await getDbAsync();
  return db.select().from(orders).where(eq(orders.id, id)).limit(1);
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
    .set({ status, updatedAt: now })
    .where(eq(orders.id, id));
}

// Update order with shipping information
export async function updateOrderShipping(
  id: string,
  shippingData: {
    status?: (typeof orders.$inferSelect)["status"];
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    shippedAt?: string;
    deliveredAt?: string;
  }
) {
  const db = await getDbAsync();
  const now = new Date().toISOString();
  
  const updateData = {
    ...shippingData,
    updatedAt: now,
  };
  
  // Set shippedAt if status is being changed to shipped and not already set
  if (shippingData.status === "shipped" && !shippingData.shippedAt) {
    updateData.shippedAt = now;
  }
  
  // Set deliveredAt if status is being changed to delivered and not already set
  if (shippingData.status === "delivered" && !shippingData.deliveredAt) {
    updateData.deliveredAt = now;
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
      cancellationReason,
      notes,
      updatedAt: now,
    })
    .where(eq(orders.id, id));
}

// Get orders by status
export async function getOrdersByStatus(status: (typeof orders.$inferSelect)["status"]) {
  const db = await getDbAsync();
  return db.select().from(orders).where(eq(orders.status, status));
}

// Webhook operations
export async function insertOrderWebhook(webhookData: {
  orderId: string;
  eventType: "status_update" | "tracking_update" | "delivery_confirmation" | "exception";
  payload: any;
  source: string;
}) {
  const db = await getDbAsync();
  const inserted = await db.insert(orderWebhooks).values({
    ...webhookData,
    payload: JSON.stringify(webhookData.payload),
  }).returning();
  return inserted[0];
}

export async function getUnprocessedWebhooks() {
  const db = await getDbAsync();
  return db
    .select()
    .from(orderWebhooks)
    .where(eq(orderWebhooks.processed, false));
}

export async function markWebhookProcessed(id: number) {
  const db = await getDbAsync();
  const now = new Date().toISOString();
  
  return db
    .update(orderWebhooks)
    .set({
      processed: true,
      processedAt: now,
    })
    .where(eq(orderWebhooks.id, id));
}
