-- Durable, core Stripe webhook idempotency and retry state.
CREATE TABLE processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  claim_token TEXT,
  claimed_at TEXT,
  lease_expires_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  outcome TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (status = 'processing' AND claim_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR status IN ('completed', 'failed')
  )
);

CREATE INDEX idx_processed_webhook_events_status_lease
  ON processed_webhook_events(status, lease_expires_at);

CREATE INDEX idx_processed_webhook_events_completed_at
  ON processed_webhook_events(completed_at);
