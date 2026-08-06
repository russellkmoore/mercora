import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const processed_webhook_events = sqliteTable(
  'processed_webhook_events',
  {
    event_id: text('event_id').primaryKey(),
    event_type: text('event_type').notNull(),
    status: text('status', { enum: ['processing', 'completed', 'failed'] }).notNull(),
    attempt_count: integer('attempt_count').notNull().default(0),
    claim_token: text('claim_token'),
    claimed_at: text('claimed_at'),
    lease_expires_at: text('lease_expires_at'),
    completed_at: text('completed_at'),
    last_error: text('last_error'),
    outcome: text('outcome'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (table) => ({
    statusLeaseIdx: index('idx_processed_webhook_events_status_lease')
      .on(table.status, table.lease_expires_at),
    completedAtIdx: index('idx_processed_webhook_events_completed_at')
      .on(table.completed_at),
  })
);

export type ProcessedWebhookEventRow = typeof processed_webhook_events.$inferSelect;
