-- Add review reminder tracking table to prevent duplicate emails
CREATE TABLE IF NOT EXISTS review_reminders (
  id TEXT PRIMARY KEY DEFAULT ('RRN-' || upper(hex(randomblob(5)))),
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  sent_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS review_reminders_order_idx ON review_reminders (order_id);
CREATE INDEX IF NOT EXISTS review_reminders_product_idx ON review_reminders (product_id);
