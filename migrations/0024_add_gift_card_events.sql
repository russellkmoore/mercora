-- Append-oriented gift-card admin audit log, mirroring 0014_add_order_events.sql.
-- Timestamps here are integer epoch seconds (not text) to match every other
-- gift-card table added in 0022, and the foreign key restricts rather than
-- cascades: an audited card must not be deletable while its history exists.

CREATE TABLE IF NOT EXISTS gift_card_events (
  id           TEXT PRIMARY KEY NOT NULL,
  gift_card_id TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  actor_type   TEXT NOT NULL CHECK (actor_type IN ('admin', 'service', 'system')),
  actor_id     TEXT,
  details      TEXT CHECK (
    details IS NULL OR (json_valid(details) AND json_type(details) = 'object')
  ),
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (gift_card_id) REFERENCES gift_card_accounts(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS gift_card_events_gift_card_id_created_at_idx
  ON gift_card_events (gift_card_id, created_at);

CREATE INDEX IF NOT EXISTS gift_card_events_event_type_created_at_idx
  ON gift_card_events (event_type, created_at);

-- Once-only guarantee for reissue (D-06): the database, not application code,
-- refuses a second reissue of the same gift card.
CREATE UNIQUE INDEX IF NOT EXISTS gift_card_events_reissued_once_idx
  ON gift_card_events (gift_card_id) WHERE event_type = 'reissued';

-- Display/search material only (D-02): the last four characters of the code,
-- already shown in customer email and at checkout via maskGiftCardCode. Rows
-- issued before this migration keep NULL and are never backfilled.
ALTER TABLE gift_card_accounts ADD COLUMN code_suffix TEXT;

CREATE INDEX IF NOT EXISTS gift_card_accounts_code_suffix_idx
  ON gift_card_accounts (code_suffix) WHERE code_suffix IS NOT NULL;
