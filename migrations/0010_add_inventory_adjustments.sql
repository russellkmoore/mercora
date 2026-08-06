CREATE TABLE inventory_adjustments (
  adjustment_key TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  line_id TEXT,
  variant_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('paid_decrement','refund_restock')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (
    status IN ('pending','processing','succeeded','skipped','needs_review','failed')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  claim_token TEXT,
  lease_expires_at TEXT,
  next_attempt_at TEXT,
  result TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK (
    (status = 'processing' AND claim_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR status IN ('pending','succeeded','skipped','needs_review','failed')
  )
);

CREATE INDEX idx_inventory_adjustments_retry
  ON inventory_adjustments(status, next_attempt_at, lease_expires_at);
CREATE INDEX idx_inventory_adjustments_order
  ON inventory_adjustments(order_id, kind);
