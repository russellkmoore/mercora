import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDbAsync } from "@/lib/db";
import { orders } from "@/lib/db/schema/order";
import { eq } from "drizzle-orm";
import type { Order } from "@/lib/types/order";
import { authenticateRequest, PERMISSIONS } from '@/lib/auth/unified-auth';
import { Money } from '@/lib/money';
import { toAdminOrder, toCustomerOrder } from '@/lib/models/mach/order-serializer';

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value as T;
  return JSON.parse(value) as T;
}

function hydrateOrder(dbOrder: typeof orders.$inferSelect): Order {
  return {
    id: dbOrder.id,
    customer_id: dbOrder.customer_id || undefined,
    status: dbOrder.status,
    total_amount: Money.fromStored(dbOrder.total_amount, dbOrder.currency_code).toJSON(),
    currency_code: dbOrder.currency_code,
    shipping_address: parseJson(dbOrder.shipping_address, undefined),
    billing_address: parseJson(dbOrder.billing_address, undefined),
    items: parseJson(dbOrder.items, []),
    shipping_method: dbOrder.shipping_method || undefined,
    shipping_carrier: dbOrder.shipping_carrier ?? undefined,
    payment_method: dbOrder.payment_method || undefined,
    payment_status: dbOrder.payment_status || 'pending',
    tracking_number: dbOrder.tracking_number || undefined,
    shipped_at: dbOrder.shipped_at || undefined,
    delivered_at: dbOrder.delivered_at || undefined,
    notes: dbOrder.notes || undefined,
    external_references: parseJson(dbOrder.external_references, undefined),
    extensions: parseJson(dbOrder.extensions, undefined),
    created_at: dbOrder.created_at || undefined,
    updated_at: dbOrder.updated_at || undefined
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    const db = await getDbAsync();
    const { id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }
    const result = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!result.length) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const order = hydrateOrder(result[0]);
    let isAdmin = false;
    if (!userId || order.customer_id !== userId) {
      const admin = await authenticateRequest(request, PERMISSIONS.ORDERS_READ, {
        updateLastUsed: false,
      });
      if (!admin.success) {
        // The order id alone is not a guest receipt credential.
        return admin.response!;
      }
      isAdmin = true;
    }
    return NextResponse.json({
      data: isAdmin ? toAdminOrder(order) : toCustomerOrder(order),
      meta: { schema: "mach:order" },
    });
  } catch (error) {
    console.error("Order GET error:", error);
    return NextResponse.json({ error: "Failed to retrieve order" }, { status: 500 });
  }
}
