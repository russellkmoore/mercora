-- Reviews & Ratings Tables
-- Customer-submitted feedback with moderation workflow support

CREATE TABLE IF NOT EXISTS product_reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  order_item_id TEXT,
  customer_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  title TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'needs_review', 'published', 'suppressed', 'auto_rejected')),
  is_verified INTEGER DEFAULT 1 CHECK (is_verified IN (0, 1)),
  automated_moderation TEXT,
  moderation_notes TEXT,
  admin_response TEXT,
  response_author_id TEXT,
  responded_at TEXT,
  submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS product_reviews_product_idx ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS product_reviews_order_idx ON product_reviews(order_id);
CREATE INDEX IF NOT EXISTS product_reviews_customer_idx ON product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS product_reviews_status_idx ON product_reviews(status);


CREATE TABLE IF NOT EXISTS review_media (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  type TEXT DEFAULT 'image' CHECK (type IN ('image', 'video')),
  url TEXT NOT NULL,
  alt_text TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES product_reviews(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS review_media_review_idx ON review_media(review_id);

CREATE TABLE IF NOT EXISTS review_flags (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  flagged_by TEXT,
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY (review_id) REFERENCES product_reviews(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS review_flags_review_idx ON review_flags(review_id);
CREATE INDEX IF NOT EXISTS review_flags_status_idx ON review_flags(status);
