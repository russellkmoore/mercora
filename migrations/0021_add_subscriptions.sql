-- Additive, default-empty subscription foundation.
--
-- Deploy/rollback contract:
-- - Deploy this migration before enabling subscription application code.
-- - Old code ignores these tables; existing catalog, customer, and order rows
--   are not modified.
-- - New code treats empty tables and the disabled capability as normal states.
-- - Roll back by disabling the capability and deploying old code. Do not
--   down-migrate subscription or renewal-order state.
-- - Stripe webhook claims remain in the core processed_webhook_events table
--   introduced by 0008; this migration deliberately creates no dedup table.

-- SQLite requires the parent key of a composite foreign key to be unique.
-- Variant ids are already globally unique, so this additive index cannot reject
-- any valid existing row and lets the database enforce product/variant identity.
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_id_id_unique
  ON product_variants(product_id, id);

CREATE TABLE subscription_plans (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128),
  product_id TEXT NOT NULL CHECK (length(product_id) BETWEEN 1 AND 128),
  variant_id TEXT NOT NULL CHECK (length(variant_id) BETWEEN 1 AND 128),
  currency_code TEXT NOT NULL CHECK (
    length(currency_code) = 3
    AND currency_code = upper(currency_code)
    AND currency_code NOT GLOB '*[^A-Z]*'
  ),
  unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor >= 0),
  stripe_price_id TEXT NOT NULL UNIQUE CHECK (
    length(stripe_price_id) BETWEEN 7 AND 255
    AND stripe_price_id GLOB 'price_*'
  ),
  cadence_unit TEXT NOT NULL CHECK (cadence_unit IN ('day', 'week', 'month', 'year')),
  cadence_count INTEGER NOT NULL CHECK (cadence_count BETWEEN 1 AND 365),
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (product_id, variant_id)
    REFERENCES product_variants(product_id, id) ON DELETE RESTRICT,
  -- Free definitions may be staged while inactive, but subscription
  -- acquisition requires a positive recurring amount.
  CHECK (is_active = 0 OR unit_amount_minor > 0)
);

CREATE INDEX subscription_plans_product_variant_idx
  ON subscription_plans(product_id, variant_id);
CREATE UNIQUE INDEX subscription_plans_active_cadence_unique
  ON subscription_plans(product_id, variant_id, currency_code, cadence_unit, cadence_count)
  WHERE is_active = 1;
CREATE UNIQUE INDEX subscription_plans_binding_unique
  ON subscription_plans(
    id, product_id, variant_id, currency_code, unit_amount_minor,
    stripe_price_id, cadence_unit, cadence_count
  );

-- Durable local identity mapping for Stripe Customers. SetupIntent acquisition
-- resolves this row directly; it must never depend on eventually-consistent
-- provider-side customer search.
CREATE TABLE subscription_provider_customers (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE RESTRICT,
  stripe_customer_id TEXT NOT NULL UNIQUE CHECK (
    length(stripe_customer_id) BETWEEN 5 AND 255
    AND stripe_customer_id GLOB 'cus_*'
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX subscription_provider_customers_pair_unique
  ON subscription_provider_customers(customer_id, stripe_customer_id);

-- A verified SetupIntent is the durable acquisition key. This row exists before
-- provider subscription creation, so route retries converge on one provider
-- idempotency key without storing a payment method or other payment secret.
-- One acquisition represents exactly one plan/variant; a checkout offering
-- multiple subscription lines creates one independently retryable acquisition
-- per line.
CREATE TABLE subscription_acquisitions (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128),
  setup_intent_id TEXT NOT NULL UNIQUE CHECK (
    length(setup_intent_id) BETWEEN 6 AND 255
    AND setup_intent_id GLOB 'seti_*'
  ),
  plan_id TEXT NOT NULL,
  product_id TEXT NOT NULL CHECK (length(product_id) BETWEEN 1 AND 128),
  variant_id TEXT NOT NULL CHECK (length(variant_id) BETWEEN 1 AND 128),
  currency_code TEXT NOT NULL CHECK (
    length(currency_code) = 3
    AND currency_code = upper(currency_code)
    AND currency_code NOT GLOB '*[^A-Z]*'
  ),
  unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor > 0),
  stripe_price_id TEXT NOT NULL CHECK (
    length(stripe_price_id) BETWEEN 7 AND 255
    AND stripe_price_id GLOB 'price_*'
  ),
  cadence_unit TEXT NOT NULL CHECK (cadence_unit IN ('day', 'week', 'month', 'year')),
  cadence_count INTEGER NOT NULL CHECK (cadence_count BETWEEN 1 AND 365),
  customer_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL CHECK (
    length(stripe_customer_id) BETWEEN 5 AND 255
    AND stripe_customer_id GLOB 'cus_*'
  ),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 1000),
  shipping_address TEXT CHECK (
    shipping_address IS NULL OR (
      length(shipping_address) <= 32768
      AND json_valid(shipping_address)
      AND json_type(shipping_address) = 'object'
    )
  ),
  consent_record TEXT NOT NULL CHECK (
    length(consent_record) BETWEEN 2 AND 16384
    AND json_valid(consent_record)
    AND json_type(consent_record) = 'object'
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'provider_created', 'completed', 'failed')
  ),
  stripe_subscription_id TEXT UNIQUE CHECK (
    stripe_subscription_id IS NULL OR (
      length(stripe_subscription_id) BETWEEN 5 AND 255
      AND stripe_subscription_id GLOB 'sub_*'
    )
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (
    plan_id, product_id, variant_id, currency_code, unit_amount_minor,
    stripe_price_id, cadence_unit, cadence_count
  ) REFERENCES subscription_plans(
    id, product_id, variant_id, currency_code, unit_amount_minor,
    stripe_price_id, cadence_unit, cadence_count
  ) ON DELETE RESTRICT,
  FOREIGN KEY (customer_id, stripe_customer_id)
    REFERENCES subscription_provider_customers(customer_id, stripe_customer_id)
    ON DELETE RESTRICT
);

CREATE INDEX subscription_acquisitions_customer_status_idx
  ON subscription_acquisitions(customer_id, status);
CREATE INDEX subscription_acquisitions_plan_idx
  ON subscription_acquisitions(plan_id);
CREATE UNIQUE INDEX subscription_acquisitions_lifecycle_binding_unique
  ON subscription_acquisitions(
    id, plan_id, customer_id, stripe_customer_id, stripe_subscription_id
  );

CREATE TABLE customer_subscriptions (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128),
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL,
  acquisition_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT NOT NULL UNIQUE CHECK (
    length(stripe_subscription_id) BETWEEN 5 AND 255
    AND stripe_subscription_id GLOB 'sub_*'
  ),
  stripe_customer_id TEXT NOT NULL CHECK (
    length(stripe_customer_id) BETWEEN 5 AND 255
    AND stripe_customer_id GLOB 'cus_*'
  ),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 1000),
  status TEXT NOT NULL CHECK (status IN (
    'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due',
    'paused', 'canceled', 'unpaid'
  )),
  shipping_address TEXT CHECK (
    shipping_address IS NULL OR (
      length(shipping_address) <= 32768
      AND json_valid(shipping_address)
      AND json_type(shipping_address) = 'object'
    )
  ),
  consent_record TEXT NOT NULL CHECK (
    length(consent_record) BETWEEN 2 AND 16384
    AND json_valid(consent_record)
    AND json_type(consent_record) = 'object'
  ),
  current_period_start INTEGER CHECK (current_period_start IS NULL OR current_period_start >= 0),
  current_period_end INTEGER CHECK (
    current_period_end IS NULL OR (
      current_period_end >= 0
      AND (current_period_start IS NULL OR current_period_end >= current_period_start)
    )
  ),
  pause_collection TEXT CHECK (
    pause_collection IS NULL OR (
      length(pause_collection) <= 16384
      AND json_valid(pause_collection)
      AND json_type(pause_collection) = 'object'
    )
  ),
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0, 1)),
  cancel_at INTEGER CHECK (cancel_at IS NULL OR cancel_at >= 0),
  canceled_at INTEGER CHECK (canceled_at IS NULL OR canceled_at >= 0),
  ended_at INTEGER CHECK (ended_at IS NULL OR ended_at >= 0),
  -- This cursor orders customer.subscription lifecycle snapshots only. Invoice
  -- events have independent claims and must never advance or block this state.
  latest_lifecycle_event_created_at INTEGER NOT NULL CHECK (latest_lifecycle_event_created_at >= 0),
  latest_lifecycle_event_id TEXT NOT NULL CHECK (length(latest_lifecycle_event_id) BETWEEN 1 AND 255),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (
    acquisition_id, plan_id, customer_id, stripe_customer_id, stripe_subscription_id
  ) REFERENCES subscription_acquisitions(
    id, plan_id, customer_id, stripe_customer_id, stripe_subscription_id
  ) ON DELETE RESTRICT,
  FOREIGN KEY (customer_id, stripe_customer_id)
    REFERENCES subscription_provider_customers(customer_id, stripe_customer_id)
    ON DELETE RESTRICT
);

CREATE INDEX customer_subscriptions_customer_status_idx
  ON customer_subscriptions(customer_id, status);
CREATE INDEX customer_subscriptions_plan_idx
  ON customer_subscriptions(plan_id);

-- Append-only lifecycle audit. Provider-level claim/retry/dedup ownership stays
-- in processed_webhook_events; provider_event_id is intentionally not unique.
CREATE TABLE subscription_events (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128),
  subscription_id TEXT NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  provider_event_id TEXT NOT NULL CHECK (length(provider_event_id) BETWEEN 1 AND 255),
  provider_event_created_at INTEGER NOT NULL CHECK (provider_event_created_at >= 0),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'updated', 'paused', 'resumed', 'canceled', 'renewed',
    'payment_failed', 'payment_recovered', 'skipped'
  )),
  outcome TEXT NOT NULL CHECK (outcome IN (
    'applied', 'duplicate', 'ignored_stale', 'refresh_required', 'failed'
  )),
  details TEXT CHECK (
    details IS NULL OR (
      length(details) <= 32768
      AND json_valid(details)
      AND json_type(details) = 'object'
    )
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX subscription_events_subscription_created_idx
  ON subscription_events(subscription_id, provider_event_created_at, created_at);
CREATE INDEX subscription_events_provider_event_idx
  ON subscription_events(provider_event_id);

-- The provider invoice id is the authoritative idempotency key. A primary key
-- guarantees at most one Mercora renewal order for each Stripe invoice, while
-- the unique order id prevents one order being attributed to two invoices.
CREATE TABLE subscription_invoice_orders (
  stripe_invoice_id TEXT PRIMARY KEY CHECK (
    length(stripe_invoice_id) BETWEEN 4 AND 255
    AND stripe_invoice_id GLOB 'in_*'
  ),
  subscription_id TEXT NOT NULL REFERENCES customer_subscriptions(id) ON DELETE RESTRICT,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  stripe_payment_intent_id TEXT CHECK (
    stripe_payment_intent_id IS NULL OR (
      length(stripe_payment_intent_id) BETWEEN 4 AND 255
      AND stripe_payment_intent_id GLOB 'pi_*'
    )
  ),
  paid_amount_minor INTEGER NOT NULL CHECK (paid_amount_minor >= 0),
  currency_code TEXT NOT NULL CHECK (
    length(currency_code) = 3
    AND currency_code = upper(currency_code)
    AND currency_code NOT GLOB '*[^A-Z]*'
  ),
  period_start INTEGER CHECK (period_start IS NULL OR period_start >= 0),
  period_end INTEGER CHECK (
    period_end IS NULL OR (
      period_end >= 0
      AND (period_start IS NULL OR period_end >= period_start)
    )
  ),
  verified_paid_at INTEGER NOT NULL CHECK (verified_paid_at >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX subscription_invoice_orders_subscription_idx
  ON subscription_invoice_orders(subscription_id, verified_paid_at);
