// lib/models/mach/orders.ts - MACH Alliance Order Operations

import { eq, desc, and, sql } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";
import { orders, order_webhooks } from "@/lib/db/schema/order";
import { Order, CreateOrderRequest, Money, Address, OrderItem } from "@/lib/types";
import { Money as MoneyValue } from '@/lib/money';

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
  const nowIso = new Date().toISOString();
  
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
    created_at: nowIso,
    updated_at: nowIso,
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

/** Owner-scoped order detail lookup; the unscoped row never enters memory. */
export async function getOrderByCustomerAndId(
  customerId: string,
  orderId: string,
): Promise<Order | null> {
  const db = await getDbAsync();
  const [record] = await db.select().from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.customer_id, customerId)))
    .limit(1);
  return record ? hydrateOrder(record) : null;
}

// Update order status
export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<Order | null> {
  const db = await getDbAsync();
  const nowIso = new Date().toISOString();
  
  const [updated] = await db
    .update(orders)
    .set({
      status,
      updated_at: nowIso,
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
  const nowIso = new Date().toISOString();

  const updateData: Partial<typeof orders.$inferInsert> = {
    updated_at: nowIso,
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
    updateData.shipped_at = nowIso;
  }
  
  if (shippingData.delivered_at) {
    updateData.delivered_at = shippingData.delivered_at;
  } else if (shippingData.status === "delivered") {
    updateData.delivered_at = nowIso;
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
  const nowIso = new Date().toISOString();
  
  const [updated] = await db
    .update(orders)
    .set({
      status: "cancelled",
      notes: notes || reason,
      updated_at: nowIso,
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
function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value as T;
  return JSON.parse(value) as T;
}

export function hydrateOrder(orderRecord: typeof orders.$inferSelect): Order {
  return {
    id: orderRecord.id ?? undefined,
    customer_id: orderRecord.customer_id ?? undefined,
    status: orderRecord.status,
    total_amount: MoneyValue.fromStored(orderRecord.total_amount, orderRecord.currency_code).toJSON(),
    currency_code: orderRecord.currency_code,
    shipping_address: parseJson<Address | undefined>(orderRecord.shipping_address, undefined),
    billing_address: parseJson<Address | undefined>(orderRecord.billing_address, undefined),
    items: parseJson<OrderItem[]>(orderRecord.items, []),
    shipping_method: orderRecord.shipping_method ?? undefined,
    shipping_carrier: orderRecord.shipping_carrier ?? undefined,
    payment_method: orderRecord.payment_method ?? undefined,
    payment_status: orderRecord.payment_status ?? 'pending',
    tracking_number: orderRecord.tracking_number ?? undefined,
    shipped_at: orderRecord.shipped_at ?? undefined,
    delivered_at: orderRecord.delivered_at ?? undefined,
    notes: orderRecord.notes ?? undefined,
    external_references: parseJson(orderRecord.external_references, undefined),
    extensions: parseJson(orderRecord.extensions, undefined),
    created_at: orderRecord.created_at ?? undefined,
    updated_at: orderRecord.updated_at ?? undefined,
  };
}

export async function promoteOrderToPaid(args: {
  orderId: string;
  amountReceived: MoneyValue;
}): Promise<{ promoted: boolean; order: Order | null }> {
  const db = await getDbAsync();
  const [current] = await db.select().from(orders).where(eq(orders.id, args.orderId)).limit(1);
  if (!current) return { promoted: false, order: null };
  if (current.payment_status === 'paid') {
    return { promoted: false, order: hydrateOrder(current) };
  }

  const finalizedAt = new Date().toISOString();
  const [updated] = await db
    .update(orders)
    .set({
      status: 'processing',
      payment_status: 'paid',
      total_amount: args.amountReceived.toJSON(),
      // Patch only the finalization marker in SQLite so a concurrent metadata
      // merge cannot be lost between our read and guarded promotion write.
      extensions: sql`json_set(COALESCE(extensions, '{}'), '$.finalized_at', ${finalizedAt})`,
      updated_at: finalizedAt,
    })
    .where(and(
      eq(orders.id, args.orderId),
      eq(orders.status, 'pending'),
      eq(orders.payment_status, 'pending')
    ))
    .returning();

  if (updated) return { promoted: true, order: hydrateOrder(updated) };
  const [winner] = await db.select().from(orders).where(eq(orders.id, args.orderId)).limit(1);
  return { promoted: false, order: winner ? hydrateOrder(winner) : null };
}

/** Atomically append a unique coupon code requiring paid-order reconciliation. */
export async function recordCouponReconciliation(args: {
  orderId: string;
  code: string;
}): Promise<void> {
  const db = await getDbAsync();
  const code = args.code.trim().toUpperCase();
  const nowIso = new Date().toISOString();
  const currentCodes = sql`CASE json_type(extensions, '$.coupon_reconciliation_codes')
    WHEN 'array' THEN json_extract(extensions, '$.coupon_reconciliation_codes')
    ELSE json('[]')
  END`;
  const [updated] = await db
    .update(orders)
    .set({
      extensions: sql`json_set(
        CASE json_type(extensions)
          WHEN 'object' THEN extensions
          ELSE json('{}')
        END,
        '$.coupon_reconciliation_codes',
        CASE WHEN EXISTS (
          SELECT 1 FROM json_each(${currentCodes}) WHERE value = ${code}
        ) THEN ${currentCodes}
        ELSE json_insert(${currentCodes}, '$[#]', ${code}) END
      )`,
      updated_at: nowIso,
    })
    .where(and(eq(orders.id, args.orderId), eq(orders.payment_status, 'paid')))
    .returning({ id: orders.id });
  if (!updated) throw new Error('Paid order coupon reconciliation marker could not be persisted');
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
