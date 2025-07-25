import {
  pgTable,
  serial,
  varchar,
  integer,
  jsonb,
  numeric,
  timestamp,
  text,
  pgEnum,
} from "drizzle-orm/pg-core";

import { relations } from "drizzle-orm";

export const orderStatusEnum = pgEnum("order_status", [
  "incomplete",
  "pending",
  "paid",
  "fulfilled",
  "shipped",
  "cancelled",
]);

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),

  email: varchar("email", { length: 255 }).notNull(),

  items: jsonb("items").notNull(), // Array of CartItem
  shippingAddress: jsonb("shipping_address").notNull(),
  billingAddress: jsonb("billing_address"),
  shippingOption: jsonb("shipping_option").notNull(),
  billingInfo: jsonb("billing_info").notNull(),

  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).notNull(),
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),

  status: orderStatusEnum("status").notNull().default("incomplete"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
