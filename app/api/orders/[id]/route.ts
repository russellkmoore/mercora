import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDbAsync } from "@/lib/db";
import { orders } from "@/lib/db/schema/order";
import { eq } from "drizzle-orm";
import type { Order } from "@/lib/types/order";

function hydrateOrder(dbOrder: typeof orders.$inferSelect): Order {
  return {
    id: dbOrder.id,
    customer_id: dbOrder.customer_id || undefined,
    status: dbOrder.status,
    total_amount: typeof dbOrder.total_amount === 'string' ? JSON.parse(dbOrder.total_amount) : { amount: 0, currency: dbOrder.currency_code },
    currency_code: dbOrder.currency_code,
    shipping_address: typeof dbOrder.shipping_address === 'string' ? JSON.parse(dbOrder.shipping_address) : undefined,
    billing_address: typeof dbOrder.billing_address === 'string' ? JSON.parse(dbOrder.billing_address) : undefined,
    items: typeof dbOrder.items === 'string' ? JSON.parse(dbOrder.items) : [],
    shipping_method: dbOrder.shipping_method || undefined,
    payment_method: dbOrder.payment_method || undefined,
    payment_status: dbOrder.payment_status || 'pending',
    tracking_number: dbOrder.tracking_number || undefined,
    shipped_at: dbOrder.shipped_at || undefined,
    delivered_at: dbOrder.delivered_at || undefined,
    notes: dbOrder.notes || undefined,
    external_references: typeof dbOrder.external_references === 'string' ? JSON.parse(dbOrder.external_references) : undefined,
    extensions: typeof dbOrder.extensions === 'string' ? JSON.parse(dbOrder.extensions) : undefined,
    created_at: dbOrder.created_at || undefined,
    updated_at: dbOrder.updated_at || undefined
  };
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    const db = await getDbAsync();
    const orderId = params.id;
    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }
  const result = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!result.length) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    // Optionally, restrict access to the order owner or admin here
    const order = hydrateOrder(result[0]);
    if (order.customer_id && userId && order.customer_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ data: order, meta: { schema: "mach:order" } });
  } catch (error) {
    console.error("Order GET error:", error);
    return NextResponse.json({ error: "Failed to retrieve order" }, { status: 500 });
  }
}
