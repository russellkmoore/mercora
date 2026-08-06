import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { orders } from './order';

export const order_effects = sqliteTable(
  'order_effects',
  {
    effect_key: text('effect_key').primaryKey(),
    order_id: text('order_id').notNull().references(() => orders.id),
    effect_type: text('effect_type', {
      enum: ['inventory', 'coupon', 'gift_card', 'subscription', 'confirmation_email'],
    }).notNull(),
    status: text('status', {
      enum: ['pending', 'processing', 'succeeded', 'failed'],
    }).notNull(),
    attempt_count: integer('attempt_count').notNull().default(0),
    claim_token: text('claim_token'),
    lease_expires_at: text('lease_expires_at'),
    next_attempt_at: text('next_attempt_at'),
    last_error: text('last_error'),
    result: text('result'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
    completed_at: text('completed_at'),
  },
  (table) => ({
    retryIdx: index('idx_order_effects_retry')
      .on(table.status, table.next_attempt_at, table.lease_expires_at),
    orderIdx: index('idx_order_effects_order').on(table.order_id),
  })
);

export type OrderEffectRow = typeof order_effects.$inferSelect;
