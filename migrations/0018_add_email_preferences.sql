-- O01 reservation: email preference and suppression state.
--
-- Absence of a row preserves the populated-baseline behavior: the recipient
-- has not opted out of an eligible non-transactional email category.
CREATE TABLE email_preferences (
  email TEXT NOT NULL COLLATE NOCASE,
  category TEXT NOT NULL,
  suppressed_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'unsubscribe',
  PRIMARY KEY (email, category),
  CHECK (length(email) BETWEEN 3 AND 254),
  CHECK (category IN ('all_non_transactional', 'review_reminders')),
  CHECK (source IN ('unsubscribe', 'account'))
);

CREATE INDEX idx_email_preferences_category_email
  ON email_preferences(category, email);

-- Provider-neutral idempotency state. The application claims a stable key
-- before any provider call, so retries and concurrent requests share one
-- delivery decision regardless of the configured provider.
CREATE TABLE email_deliveries (
  idempotency_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('cloudflare', 'resend')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
  claim_token TEXT,
  lease_expires_at TEXT,
  provider_message_id TEXT,
  error_code TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK (length(idempotency_key) BETWEEN 1 AND 256),
  CHECK (
    (status = 'processing' AND claim_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR status IN ('pending', 'succeeded', 'failed')
  )
);

CREATE INDEX idx_email_deliveries_retry
  ON email_deliveries(status, lease_expires_at, updated_at);
