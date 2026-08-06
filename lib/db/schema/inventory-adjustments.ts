import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { orders } from './order';

export const inventory_adjustments = sqliteTable(
  'inventory_adjustments',
  {
    adjustment_key: text('adjustment_key').primaryKey(),
    order_id: text('order_id').notNull().references(() => orders.id),
    line_id: text('line_id'),
    variant_id: text('variant_id').notNull(),
    kind: text('kind', { enum: ['paid_decrement', 'refund_restock'] }).notNull(),
    quantity: integer('quantity').notNull(),
    status: text('status', {
      enum: ['pending', 'processing', 'succeeded', 'skipped', 'needs_review', 'failed'],
    }).notNull(),
    attempt_count: integer('attempt_count').notNull().default(0),
    claim_token: text('claim_token'),
    lease_expires_at: text('lease_expires_at'),
    next_attempt_at: text('next_attempt_at'),
    result: text('result'),
    last_error: text('last_error'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
    completed_at: text('completed_at'),
  },
  (table) => ({
    retryIdx: index('idx_inventory_adjustments_retry')
      .on(table.status, table.next_attempt_at, table.lease_expires_at),
    orderIdx: index('idx_inventory_adjustments_order').on(table.order_id, table.kind),
  })
);

export type InventoryAdjustmentRow = typeof inventory_adjustments.$inferSelect;
