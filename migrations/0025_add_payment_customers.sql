-- payment_customers binds one Mercora customer to exactly one Stripe Customer
-- for checkout saved-card storage (Phase 17, PAY-01). Modeled byte-for-byte
-- on subscription_provider_customers (lib/db/schema/subscriptions.ts) but
-- kept as its own table: subscriptions and checkout each mint their own
-- Stripe Customer today (D-02). A shopper who both subscribes and saves a
-- card at checkout ends up with two separate Stripe Customer objects;
-- consolidating onto one shared table is a Phase 18 tech-debt item, not this
-- one. Expand-only: adds a table, changes nothing else.

CREATE TABLE IF NOT EXISTS payment_customers (
  customer_id        TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE RESTRICT,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(stripe_customer_id) BETWEEN 5 AND 255 AND stripe_customer_id GLOB 'cus_*')
);
