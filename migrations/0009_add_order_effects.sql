CREATE TABLE order_effects (
  effect_key TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  effect_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','processing','succeeded','failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  claim_token TEXT,
  lease_expires_at TEXT,
  next_attempt_at TEXT,
  last_error TEXT,
  result TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK (
    (status = 'processing' AND claim_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR status IN ('pending','succeeded','failed')
  )
);

CREATE INDEX idx_order_effects_retry
  ON order_effects(status, next_attempt_at, lease_expires_at);
CREATE INDEX idx_order_effects_order ON order_effects(order_id);
