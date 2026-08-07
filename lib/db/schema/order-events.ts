// lib/db/schema/order-events.ts - Append-oriented fulfillment audit log

import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { orders } from "./order";

/**
 * One immutable audit row per fulfillment action. `details` uses Drizzle JSON
 * mode, so callers pass plain objects rather than pre-stringified JSON.
 */
export const orderEvents = sqliteTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    order_id: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    actor_type: text("actor_type").notNull(),
    actor_id: text("actor_id"),
    from_status: text("from_status"),
    to_status: text("to_status"),
    details: text("details", { mode: "json" }),
    created_at: text("created_at").notNull(),
  },
  (table) => ({
    orderCreatedIdx: index("order_events_order_id_created_at_idx").on(
      table.order_id,
      table.created_at,
    ),
    eventTypeCreatedIdx: index("order_events_event_type_created_at_idx").on(
      table.event_type,
      table.created_at,
    ),
  }),
);

export type OrderEventRow = typeof orderEvents.$inferSelect;
