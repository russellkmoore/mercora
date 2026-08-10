-- Precomputed per-product recommendation lists and configurable PDP defaults.

CREATE TABLE IF NOT EXISTS product_recommendations (
  source_product_id TEXT NOT NULL,
  recommended_product_id TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank >= 0),
  score REAL,
  reason TEXT,
  generated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (source_product_id, recommended_product_id),
  CHECK (source_product_id <> recommended_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_recommendations_source_rank
  ON product_recommendations (source_product_id, rank);

INSERT OR IGNORE INTO admin_settings (key, value, category, description, data_type) VALUES
  ('recommendations.strategy', '"deterministic"', 'recommendations', 'PDP recommendation source: deterministic or ai_batch', 'string'),
  ('recommendations.personalize', 'true', 'recommendations', 'Reserve one recommendation slot for customers with order history', 'boolean'),
  ('recommendations.limit', '3', 'recommendations', 'Number of products shown in the PDP recommendation strip', 'number'),
  ('recommendations.exclude_owned', 'true', 'recommendations', 'Hide products the customer already purchased', 'boolean');
