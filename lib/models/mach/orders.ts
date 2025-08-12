// lib/models/mach/orders.ts - MACH Alliance Order Operations

import { eq, desc, and, sql } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";
import { orders, order_webhooks } from "@/lib/db/schema/order";
import { Order, CreateOrderRequest, Money, Address, OrderItem } from "@/lib/types";

/**
 * MACH Alliance Order Operations
 * 
 * These functions provide MACH-compliant order management operations:
 * - Create orders with proper financial modeling
 * - Retrieve orders by customer or order ID
 * - Update order status and shipping information
 * - Handle webhooks and notifications
 */

// Create a new order
export async function createOrder(orderData: CreateOrderRequest): Promise<Order> {
  const db = await getDbAsync();
  
  // Generate order ID
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  
  // Prepare order record
  const orderRecord = {
    id: orderId,
    customer_id: orderData.customer_id,
    status: "pending" as const,
    total_amount: JSON.stringify(orderData.total_amount),
    currency_code: orderData.currency_code,
    shipping_address: orderData.shipping_address ? JSON.stringify(orderData.shipping_address) : null,
    billing_address: orderData.billing_address ? JSON.stringify(orderData.billing_address) : null,
    items: JSON.stringify(orderData.items),
    shipping_method: orderData.shipping_method,
    payment_method: orderData.payment_method,
    payment_status: "pending" as const,
    notes: orderData.notes,
    external_references: orderData.external_references ? JSON.stringify(orderData.external_references) : null,
    extensions: orderData.extensions ? JSON.stringify(orderData.extensions) : null,
  };
  
  const [newOrder] = await db.insert(orders).values(orderRecord).returning();
  
  // Items are stored as a JSON array in the orders table per schema; no separate order_items table logic needed.
  
  return hydrateOrder(newOrder);
}

// Get orders for a specific customer
export async function getOrdersByCustomer(customerId: string): Promise<Order[]> {
  const db = await getDbAsync();
  
  const orderRecords = await db
    .select()
    .from(orders)
    .where(eq(orders.customer_id, customerId))
    .orderBy(desc(orders.created_at));
  
  return orderRecords.map(hydrateOrder);
}

// Get a specific order by ID
export async function getOrderById(orderId: string): Promise<Order | null> {
  const db = await getDbAsync();
  
  const orderRecords = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  
  if (orderRecords.length === 0) {
    return null;
  }
  
  return hydrateOrder(orderRecords[0]);
}

// Update order status
export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<Order | null> {
  const db = await getDbAsync();
  
  const [updated] = await db
    .update(orders)
    .set({
      status,
      updated_at: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(orders.id, orderId))
    .returning();
  
  if (!updated) {
    return null;
  }
  
  return hydrateOrder(updated);
}

// Update order with shipping information
export async function updateOrderShipping(
  orderId: string,
  shippingData: {
    status?: Order['status'];
    tracking_number?: string;
    shipped_at?: string;
    delivered_at?: string;
  }
): Promise<Order | null> {
  const db = await getDbAsync();
  
  const updateData: any = {
    updated_at: sql`CURRENT_TIMESTAMP`,
  };
  
  if (shippingData.status) {
    updateData.status = shippingData.status;
  }
  
  if (shippingData.tracking_number) {
    updateData.tracking_number = shippingData.tracking_number;
  }
  
  if (shippingData.shipped_at) {
    updateData.shipped_at = shippingData.shipped_at;
  } else if (shippingData.status === "shipped") {
    updateData.shipped_at = new Date().toISOString();
  }
  
  if (shippingData.delivered_at) {
    updateData.delivered_at = shippingData.delivered_at;
  } else if (shippingData.status === "delivered") {
    updateData.delivered_at = new Date().toISOString();
  }
  
  const [updated] = await db
    .update(orders)
    .set(updateData)
    .where(eq(orders.id, orderId))
    .returning();
  
  if (!updated) {
    return null;
  }
  
  return hydrateOrder(updated);
}

// Cancel order
export async function cancelOrder(
  orderId: string, 
  reason: string, 
  notes?: string
): Promise<Order | null> {
  const db = await getDbAsync();
  
  const [updated] = await db
    .update(orders)
    .set({
      status: "cancelled",
      notes: notes || reason,
      updated_at: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(orders.id, orderId))
    .returning();
  
  if (!updated) {
    return null;
  }
  
  return hydrateOrder(updated);
}

// Get orders by status
export async function getOrdersByStatus(status: Order['status']): Promise<Order[]> {
  const db = await getDbAsync();
  
  const orderRecords = await db
    .select()
    .from(orders)
    .where(eq(orders.status, status))
    .orderBy(desc(orders.created_at));
  
  return orderRecords.map(hydrateOrder);
}

// Items are always accessed via the items field on the order record (JSON array).

// Utility function to convert database record to Order type
function hydrateOrder(orderRecord: typeof orders.$inferSelect): Order {
  return {
    id: orderRecord.id ?? undefined,
    customer_id: orderRecord.customer_id ?? undefined,
    status: orderRecord.status,
    total_amount: JSON.parse(orderRecord.total_amount as string) as Money,
    currency_code: orderRecord.currency_code,
    shipping_address: orderRecord.shipping_address 
      ? JSON.parse(orderRecord.shipping_address as string) as Address
      : undefined,
    billing_address: orderRecord.billing_address
      ? JSON.parse(orderRecord.billing_address as string) as Address
      : undefined,
    items: JSON.parse(orderRecord.items as string) as OrderItem[],
    shipping_method: orderRecord.shipping_method ?? undefined,
    payment_method: orderRecord.payment_method ?? undefined,
    payment_status: orderRecord.payment_status ?? 'pending',
    tracking_number: orderRecord.tracking_number ?? undefined,
    shipped_at: orderRecord.shipped_at ?? undefined,
    delivered_at: orderRecord.delivered_at ?? undefined,
    notes: orderRecord.notes ?? undefined,
    external_references: orderRecord.external_references
      ? JSON.parse(orderRecord.external_references as string)
      : undefined,
    extensions: orderRecord.extensions
      ? JSON.parse(orderRecord.extensions as string)
      : undefined,
    created_at: orderRecord.created_at ?? undefined,
    updated_at: orderRecord.updated_at ?? undefined,
  };
}

// Webhook operations
export async function createOrderWebhook(
  orderId: string,
  webhookType: "order_created" | "order_updated" | "payment_completed" | "shipment_created" | "delivery_confirmed",
  payload: Record<string, any>
): Promise<void> {
  const db = await getDbAsync();
  
  await db.insert(order_webhooks).values({
    id: `wh_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    order_id: orderId,
    webhook_type: webhookType,
    status: "pending",
    payload: JSON.stringify(payload),
    attempts: 0,
    max_attempts: 3,
  });
}

export async function getPendingWebhooks() {
  const db = await getDbAsync();
  
  return db
    .select()
    .from(order_webhooks)
    .where(eq(order_webhooks.status, "pending"));
}

export async function markWebhookCompleted(webhookId: string): Promise<void> {
  const db = await getDbAsync();
  
  await db
    .update(order_webhooks)
    .set({
      status: "completed",
      completed_at: sql`CURRENT_TIMESTAMP`,
      updated_at: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(order_webhooks.id, webhookId));
}

// Legacy support functions for backward compatibility
export async function getOrdersByUserId(userId: string): Promise<Order[]> {
  // In MACH architecture, userId maps to customer_id
  return getOrdersByCustomer(userId);
}
