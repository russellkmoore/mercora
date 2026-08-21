-- Additive, default-empty gift-card account, ledger, reservation, and delivery state.
--
-- Deploy/rollback contract:
-- - Apply this migration before deploying gift-card-aware application code.
-- - Keep acquisition and reconciliation capabilities disabled until code-hash
--   secrets and the production capability factory are configured.
-- - Old code ignores these tables; new code with both capabilities disabled
--   must not read them.
-- - After the first accepted tender, rollback disables new acquisition but
--   retains reconciliation until every committed hold and paid effect settles.
-- - Never down-migrate balances, reservations, ledger entries, or delivery state.

CREATE TABLE gift_card_accounts (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128),
  code_hash TEXT NOT NULL CHECK (
    length(code_hash) = 64
    AND code_hash = lower(code_hash)
    AND code_hash NOT GLOB '*[^0-9a-f]*'
  ),
  code_hash_version INTEGER NOT NULL CHECK (
    code_hash_version BETWEEN 1 AND 9007199254740991
  ),
  currency_code TEXT NOT NULL CHECK (
    length(currency_code) = 3
    AND currency_code = upper(currency_code)
    AND currency_code NOT GLOB '*[^A-Z]*'
  ),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  issuance_entry_id TEXT NOT NULL UNIQUE CHECK (length(issuance_entry_id) BETWEEN 1 AND 128),
  issuance_business_key TEXT NOT NULL UNIQUE CHECK (
    length(issuance_business_key) BETWEEN 1 AND 256
  ),
  issued_amount_minor INTEGER NOT NULL CHECK (
    issued_amount_minor BETWEEN 1 AND 9007199254740991
  ),
  issued_order_id TEXT REFERENCES orders(id) ON DELETE RESTRICT,
  issued_line_id TEXT CHECK (
    issued_line_id IS NULL OR length(issued_line_id) BETWEEN 1 AND 128
  ),
  purchaser_customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at BETWEEN 0 AND 9007199254740991),
  disabled_at INTEGER CHECK (disabled_at BETWEEN 0 AND 9007199254740991),
  CHECK (
    (status = 'active' AND disabled_at IS NULL)
    OR (status = 'disabled' AND disabled_at IS NOT NULL)
  ),
  CHECK (
    (issued_order_id IS NULL AND issued_line_id IS NULL)
    OR (issued_order_id IS NOT NULL AND issued_line_id IS NOT NULL)
  ),
  UNIQUE (id, currency_code),
  UNIQUE (code_hash_version, code_hash)
);

CREATE INDEX gift_card_accounts_status_idx
  ON gift_card_accounts(status, currency_code);
CREATE INDEX gift_card_accounts_order_idx
  ON gift_card_accounts(issued_order_id, issued_line_id);

-- The bearer lookup, denomination, issuance provenance, and creation clock are
-- an immutable financial snapshot. Only the one-way active -> disabled state
-- transition is mutable after issuance.
CREATE TRIGGER gift_card_accounts_identity_immutable
BEFORE UPDATE ON gift_card_accounts
FOR EACH ROW
WHEN NOT (
  NEW.id IS OLD.id
  AND NEW.code_hash IS OLD.code_hash
  AND NEW.code_hash_version IS OLD.code_hash_version
  AND NEW.currency_code IS OLD.currency_code
  AND NEW.issuance_entry_id IS OLD.issuance_entry_id
  AND NEW.issuance_business_key IS OLD.issuance_business_key
  AND NEW.issued_amount_minor IS OLD.issued_amount_minor
  AND NEW.issued_order_id IS OLD.issued_order_id
  AND NEW.issued_line_id IS OLD.issued_line_id
  AND NEW.purchaser_customer_id IS OLD.purchaser_customer_id
  AND NEW.created_at IS OLD.created_at
)
BEGIN
  SELECT RAISE(ABORT, 'gift-card account identity is immutable');
END;

CREATE TRIGGER gift_card_accounts_status_transition_guard
BEFORE UPDATE ON gift_card_accounts
FOR EACH ROW
WHEN NOT (
  (
    OLD.status = 'active'
    AND OLD.disabled_at IS NULL
    AND (
      (NEW.status = 'active' AND NEW.disabled_at IS NULL)
      OR (
        NEW.status = 'disabled'
        AND NEW.disabled_at IS NOT NULL
        AND NEW.disabled_at >= OLD.created_at
      )
    )
  )
  OR (
    OLD.status = 'disabled'
    AND NEW.status = 'disabled'
    AND NEW.disabled_at IS OLD.disabled_at
  )
)
BEGIN
  SELECT RAISE(ABORT, 'gift-card account status transition is invalid');
END;

CREATE TABLE gift_card_reservations (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128),
  gift_card_id TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  request_key TEXT NOT NULL UNIQUE CHECK (length(request_key) BETWEEN 8 AND 256),
  quote_fingerprint TEXT NOT NULL CHECK (
    length(quote_fingerprint) = 64
    AND quote_fingerprint = lower(quote_fingerprint)
    AND quote_fingerprint NOT GLOB '*[^0-9a-f]*'
  ),
  requested_amount_minor INTEGER NOT NULL CHECK (
    requested_amount_minor BETWEEN 1 AND 9007199254740991
  ),
  amount_minor INTEGER NOT NULL CHECK (
    amount_minor BETWEEN 1 AND requested_amount_minor
  ),
  reserved_at INTEGER NOT NULL CHECK (reserved_at BETWEEN 0 AND 9007199254740991),
  expires_at INTEGER NOT NULL CHECK (
    expires_at BETWEEN 1 AND 9007199254740991
    AND expires_at > reserved_at
  ),
  committed_order_id TEXT REFERENCES orders(id) ON DELETE RESTRICT,
  committed_at INTEGER CHECK (committed_at BETWEEN 0 AND 9007199254740991),
  released_at INTEGER CHECK (released_at BETWEEN 0 AND 9007199254740991),
  release_reason TEXT CHECK (
    release_reason IS NULL OR length(release_reason) BETWEEN 1 AND 200
  ),
  FOREIGN KEY (gift_card_id, currency_code)
    REFERENCES gift_card_accounts(id, currency_code) ON DELETE RESTRICT,
  CHECK (
    (committed_order_id IS NULL AND committed_at IS NULL)
    OR (committed_order_id IS NOT NULL AND committed_at IS NOT NULL)
  ),
  CHECK (
    (released_at IS NULL AND release_reason IS NULL)
    OR (released_at IS NOT NULL AND release_reason IS NOT NULL)
  ),
  CHECK (committed_at IS NULL OR released_at IS NULL)
);

CREATE INDEX gift_card_reservations_account_idx
  ON gift_card_reservations(gift_card_id, released_at, committed_at, expires_at);
CREATE INDEX gift_card_reservations_order_idx
  ON gift_card_reservations(committed_order_id);

-- Quote and hold facts are immutable. Mutations may only move an open hold to
-- exactly one terminal state, or replay that already-durable transition.
CREATE TRIGGER gift_card_reservations_identity_immutable
BEFORE UPDATE ON gift_card_reservations
FOR EACH ROW
WHEN NOT (
  NEW.id IS OLD.id
  AND NEW.gift_card_id IS OLD.gift_card_id
  AND NEW.currency_code IS OLD.currency_code
  AND NEW.request_key IS OLD.request_key
  AND NEW.quote_fingerprint IS OLD.quote_fingerprint
  AND NEW.requested_amount_minor IS OLD.requested_amount_minor
  AND NEW.amount_minor IS OLD.amount_minor
  AND NEW.reserved_at IS OLD.reserved_at
  AND NEW.expires_at IS OLD.expires_at
)
BEGIN
  SELECT RAISE(ABORT, 'gift-card reservation identity is immutable');
END;

CREATE TRIGGER gift_card_reservations_transition_guard
BEFORE UPDATE ON gift_card_reservations
FOR EACH ROW
WHEN NOT (
  (
    NEW.committed_order_id IS OLD.committed_order_id
    AND NEW.committed_at IS OLD.committed_at
    AND NEW.released_at IS OLD.released_at
    AND NEW.release_reason IS OLD.release_reason
  )
  OR (
    OLD.committed_order_id IS NULL
    AND OLD.committed_at IS NULL
    AND OLD.released_at IS NULL
    AND OLD.release_reason IS NULL
    AND NEW.committed_order_id IS NOT NULL
    AND NEW.committed_at IS NOT NULL
    AND NEW.committed_at >= OLD.reserved_at
    AND NEW.released_at IS NULL
    AND NEW.release_reason IS NULL
  )
  OR (
    OLD.committed_order_id IS NULL
    AND OLD.committed_at IS NULL
    AND OLD.released_at IS NULL
    AND OLD.release_reason IS NULL
    AND NEW.committed_order_id IS NULL
    AND NEW.committed_at IS NULL
    AND NEW.released_at IS NOT NULL
    AND NEW.released_at >= OLD.reserved_at
    AND NEW.release_reason IS NOT NULL
  )
)
BEGIN
  SELECT RAISE(ABORT, 'gift-card reservation transition is invalid');
END;

CREATE TABLE gift_card_ledger_entries (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128),
  gift_card_id TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (
    entry_type IN ('issuance', 'redemption', 'restoration', 'adjustment')
  ),
  amount_delta_minor INTEGER NOT NULL CHECK (
    amount_delta_minor BETWEEN -9007199254740991 AND 9007199254740991
    AND amount_delta_minor <> 0
  ),
  business_key TEXT NOT NULL UNIQUE CHECK (length(business_key) BETWEEN 1 AND 256),
  order_id TEXT REFERENCES orders(id) ON DELETE RESTRICT,
  reservation_id TEXT REFERENCES gift_card_reservations(id) ON DELETE RESTRICT,
  related_entry_id TEXT REFERENCES gift_card_ledger_entries(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at BETWEEN 0 AND 9007199254740991),
  FOREIGN KEY (gift_card_id, currency_code)
    REFERENCES gift_card_accounts(id, currency_code) ON DELETE RESTRICT,
  CHECK (
    (entry_type IN ('issuance', 'restoration') AND amount_delta_minor > 0)
    OR (entry_type = 'redemption' AND amount_delta_minor < 0)
    OR entry_type = 'adjustment'
  ),
  CHECK (
    (entry_type = 'redemption' AND reservation_id IS NOT NULL AND order_id IS NOT NULL)
    OR (entry_type <> 'redemption' AND reservation_id IS NULL)
  ),
  CHECK (
    (entry_type = 'restoration' AND order_id IS NOT NULL AND related_entry_id IS NOT NULL)
    OR entry_type <> 'restoration'
  )
);

CREATE UNIQUE INDEX gift_card_ledger_issuance_unique
  ON gift_card_ledger_entries(gift_card_id) WHERE entry_type = 'issuance';
CREATE UNIQUE INDEX gift_card_ledger_reservation_unique
  ON gift_card_ledger_entries(reservation_id) WHERE reservation_id IS NOT NULL;
CREATE INDEX gift_card_ledger_account_idx
  ON gift_card_ledger_entries(gift_card_id, created_at, id);
CREATE INDEX gift_card_ledger_order_idx
  ON gift_card_ledger_entries(order_id, entry_type);

-- Defense in depth for every writer, including future admin/import tooling.
-- A single SQLite INSERT sees and changes one serialized database snapshot.
CREATE TRIGGER gift_card_ledger_balance_guard
BEFORE INSERT ON gift_card_ledger_entries
FOR EACH ROW
WHEN (
  COALESCE((
    SELECT SUM(amount_delta_minor)
    FROM gift_card_ledger_entries
    WHERE gift_card_id = NEW.gift_card_id
  ), 0) + NEW.amount_delta_minor
) NOT BETWEEN 0 AND 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'gift-card ledger balance would be invalid');
END;

CREATE TRIGGER gift_card_ledger_issuance_guard
BEFORE INSERT ON gift_card_ledger_entries
FOR EACH ROW
WHEN NEW.entry_type = 'issuance' AND NOT EXISTS (
  SELECT 1
  FROM gift_card_accounts account
  WHERE account.id = NEW.gift_card_id
    AND account.currency_code = NEW.currency_code
    AND account.issuance_entry_id = NEW.id
    AND account.issuance_business_key = NEW.business_key
    AND account.issued_amount_minor = NEW.amount_delta_minor
    AND account.issued_order_id IS NEW.order_id
    AND account.created_at = NEW.created_at
)
BEGIN
  SELECT RAISE(ABORT, 'gift-card issuance conflicts with its account snapshot');
END;

CREATE TRIGGER gift_card_ledger_redemption_guard
BEFORE INSERT ON gift_card_ledger_entries
FOR EACH ROW
WHEN NEW.entry_type = 'redemption' AND NOT EXISTS (
  SELECT 1
  FROM gift_card_reservations reservation
  WHERE reservation.id = NEW.reservation_id
    AND reservation.gift_card_id = NEW.gift_card_id
    AND reservation.currency_code = NEW.currency_code
    AND reservation.committed_order_id = NEW.order_id
    AND reservation.committed_at IS NOT NULL
    AND reservation.released_at IS NULL
    AND NEW.amount_delta_minor = -reservation.amount_minor
)
BEGIN
  SELECT RAISE(ABORT, 'gift-card redemption conflicts with its committed reservation');
END;

-- A restoration is attributed to the original order and redemption. Its
-- cumulative positive entries may never restore more than that redemption.
-- Concurrent INSERTs serialize through SQLite and each sees prior winners.
CREATE TRIGGER gift_card_ledger_restoration_guard
BEFORE INSERT ON gift_card_ledger_entries
FOR EACH ROW
WHEN NEW.entry_type = 'restoration' AND NOT EXISTS (
  SELECT 1
  FROM gift_card_ledger_entries redemption
  WHERE redemption.id = NEW.related_entry_id
    AND redemption.entry_type = 'redemption'
    AND redemption.gift_card_id = NEW.gift_card_id
    AND redemption.currency_code = NEW.currency_code
    AND redemption.order_id = NEW.order_id
    AND NEW.amount_delta_minor <= (
      -redemption.amount_delta_minor
      - COALESCE((
        SELECT SUM(restoration.amount_delta_minor)
        FROM gift_card_ledger_entries restoration
        WHERE restoration.entry_type = 'restoration'
          AND restoration.related_entry_id = redemption.id
      ), 0)
    )
)
BEGIN
  SELECT RAISE(ABORT, 'gift-card restoration conflicts with its redemption');
END;

CREATE TRIGGER gift_card_ledger_append_only_update
BEFORE UPDATE ON gift_card_ledger_entries
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'gift-card ledger is append-only');
END;

CREATE TRIGGER gift_card_ledger_append_only_delete
BEFORE DELETE ON gift_card_ledger_entries
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'gift-card ledger is append-only');
END;

-- Reservations are accepted only while the account is active and their exact
-- amount fits the ledger-derived balance after all unresolved holds.
CREATE TRIGGER gift_card_reservations_balance_guard
BEFORE INSERT ON gift_card_reservations
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM gift_card_accounts account
  WHERE account.id = NEW.gift_card_id
    AND account.currency_code = NEW.currency_code
    AND account.status = 'active'
    AND NEW.amount_minor <= (
      COALESCE((
        SELECT SUM(entry.amount_delta_minor)
        FROM gift_card_ledger_entries entry
        WHERE entry.gift_card_id = account.id
      ), 0)
      - COALESCE((
        SELECT SUM(reservation.amount_minor)
        FROM gift_card_reservations reservation
        WHERE reservation.gift_card_id = account.id
          AND reservation.released_at IS NULL
          AND (
            reservation.committed_at IS NOT NULL
            OR reservation.expires_at > NEW.reserved_at
          )
          AND NOT EXISTS (
            SELECT 1
            FROM gift_card_ledger_entries settlement
            WHERE settlement.reservation_id = reservation.id
              AND settlement.entry_type = 'redemption'
          )
      ), 0)
    )
)
BEGIN
  SELECT RAISE(ABORT, 'gift-card reservation exceeds available balance');
END;

CREATE TABLE gift_card_deliveries (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128),
  gift_card_id TEXT NOT NULL UNIQUE REFERENCES gift_card_accounts(id) ON DELETE RESTRICT,
  order_id TEXT REFERENCES orders(id) ON DELETE RESTRICT,
  order_line_id TEXT CHECK (
    order_line_id IS NULL OR length(order_line_id) BETWEEN 1 AND 128
  ),
  recipient_email TEXT NOT NULL CHECK (length(recipient_email) BETWEEN 3 AND 320),
  recipient_name TEXT CHECK (
    recipient_name IS NULL OR length(recipient_name) BETWEEN 1 AND 200
  ),
  email_idempotency_key TEXT NOT NULL UNIQUE CHECK (
    length(email_idempotency_key) BETWEEN 1 AND 256
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'sent', 'needs_review')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (
    attempt_count BETWEEN 0 AND 9007199254740991
  ),
  deliver_after INTEGER NOT NULL DEFAULT 0 CHECK (
    deliver_after BETWEEN 0 AND 9007199254740991
  ),
  claim_token TEXT,
  lease_expires_at INTEGER CHECK (lease_expires_at BETWEEN 0 AND 9007199254740991),
  code_ciphertext TEXT CHECK (
    code_ciphertext IS NULL OR length(code_ciphertext) BETWEEN 1 AND 4096
  ),
  code_nonce TEXT CHECK (code_nonce IS NULL OR length(code_nonce) BETWEEN 1 AND 256),
  code_key_version INTEGER CHECK (
    code_key_version BETWEEN 1 AND 9007199254740991
  ),
  created_at INTEGER NOT NULL CHECK (created_at BETWEEN 0 AND 9007199254740991),
  updated_at INTEGER NOT NULL CHECK (updated_at BETWEEN 0 AND 9007199254740991),
  completed_at INTEGER CHECK (completed_at BETWEEN 0 AND 9007199254740991),
  CHECK (
    (order_id IS NULL AND order_line_id IS NULL)
    OR (order_id IS NOT NULL AND order_line_id IS NOT NULL)
  ),
  CHECK (
    (code_ciphertext IS NULL AND code_nonce IS NULL AND code_key_version IS NULL)
    OR (code_ciphertext IS NOT NULL AND code_nonce IS NOT NULL AND code_key_version IS NOT NULL)
  ),
  CHECK (
    (status = 'processing' AND claim_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'processing' AND claim_token IS NULL AND lease_expires_at IS NULL)
  ),
  CHECK (
    (status IN ('sent', 'needs_review') AND completed_at IS NOT NULL)
    OR (status IN ('pending', 'processing') AND completed_at IS NULL)
  )
);

CREATE INDEX gift_card_deliveries_retry_idx
  ON gift_card_deliveries(status, deliver_after, lease_expires_at, updated_at);
