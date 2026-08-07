-- Append-oriented fulfillment audit log. The event vocabulary is deliberately
-- not constrained so stores can add fulfillment integrations without rebuilding
-- the table. Details, when present, must be one JSON object.

CREATE TABLE IF NOT EXISTS order_events (
  id          TEXT PRIMARY KEY NOT NULL,
  order_id    TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  actor_type  TEXT NOT NULL,
  actor_id    TEXT,
  from_status TEXT,
  to_status   TEXT,
  details     TEXT CHECK (
    details IS NULL OR (json_valid(details) AND json_type(details) = 'object')
  ),
  created_at  TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS order_events_order_id_created_at_idx
  ON order_events (order_id, created_at);

CREATE INDEX IF NOT EXISTS order_events_event_type_created_at_idx
  ON order_events (event_type, created_at);
