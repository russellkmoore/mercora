import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const product_reviews = sqliteTable(
  'product_reviews',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => `REV-${nanoid(10).toUpperCase()}`),
    product_id: text('product_id').notNull(),
    order_id: text('order_id').notNull(),
    order_item_id: text('order_item_id'),
    customer_id: text('customer_id').notNull(),
    rating: integer('rating').notNull(),
    title: text('title'),
    body: text('body'),
    status: text('status', {
      enum: ['pending', 'needs_review', 'published', 'suppressed', 'auto_rejected']
    })
      .notNull()
      .default('pending'),
    is_verified: integer('is_verified', { mode: 'boolean' }).default(true),
    automated_moderation: text('automated_moderation', { mode: 'json' }),
    moderation_notes: text('moderation_notes'),
    admin_response: text('admin_response'),
    response_author_id: text('response_author_id'),
    responded_at: text('responded_at'),
    submitted_at: text('submitted_at').default(sql`CURRENT_TIMESTAMP`),
    published_at: text('published_at'),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
    metadata: text('metadata', { mode: 'json' })
  },
  (table) => ({
    productIdx: index('product_reviews_product_idx').on(table.product_id),
    orderIdx: index('product_reviews_order_idx').on(table.order_id),
    customerIdx: index('product_reviews_customer_idx').on(table.customer_id),
    statusIdx: index('product_reviews_status_idx').on(table.status)
  })
);

export const review_media = sqliteTable(
  'review_media',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => `RMD-${nanoid(10).toUpperCase()}`),
    review_id: text('review_id')
      .notNull()
      .references(() => product_reviews.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['image', 'video'] }).default('image'),
    url: text('url').notNull(),
    alt_text: text('alt_text'),
    metadata: text('metadata', { mode: 'json' }),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    reviewIdx: index('review_media_review_idx').on(table.review_id)
  })
);

export const review_flags = sqliteTable(
  'review_flags',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => `RFG-${nanoid(10).toUpperCase()}`),
    review_id: text('review_id')
      .notNull()
      .references(() => product_reviews.id, { onDelete: 'cascade' }),
    flagged_by: text('flagged_by'),
    reason: text('reason').notNull(),
    notes: text('notes'),
    status: text('status', { enum: ['open', 'resolved', 'dismissed'] }).default('open'),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    resolved_at: text('resolved_at')
  },
  (table) => ({
    reviewFlagIdx: index('review_flags_review_idx').on(table.review_id),
    statusIdx: index('review_flags_status_idx').on(table.status)
  })
);

export const review_reminders = sqliteTable(
  'review_reminders',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => `RRN-${nanoid(10).toUpperCase()}`),
    order_id: text('order_id').notNull(),
    product_id: text('product_id').notNull(),
    customer_id: text('customer_id'),
    status: text('status', { enum: ['sent', 'failed'] }).notNull().default('sent'),
    error: text('error'),
    sent_at: text('sent_at').default(sql`CURRENT_TIMESTAMP`),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    reminderOrderIdx: index('review_reminders_order_idx').on(table.order_id),
    reminderProductIdx: index('review_reminders_product_idx').on(table.product_id)
  })
);

export type ProductReviewRow = typeof product_reviews.$inferSelect;
export type ReviewMediaRow = typeof review_media.$inferSelect;
export type ReviewFlagRow = typeof review_flags.$inferSelect;
export type ReviewReminderRow = typeof review_reminders.$inferSelect;
