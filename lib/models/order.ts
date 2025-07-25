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
    .$type<"incomplete" | "pending" | "paid" | "shipped" | "cancelled">()
    .notNull()
    .default("incomplete"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const orderRelations = relations(orders, () => ({}));

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
