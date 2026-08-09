-- Normalize legacy SQLite CURRENT_TIMESTAMP values to the ISO-8601 UTC format
-- emitted by Date#toISOString(). SQLite compares TEXT byte-wise, so mixing
-- "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS.sssZ" breaks chronological
-- ordering and cursor pagination.
--
-- strftime() returns NULL for an unparseable value. Those rows are deliberately
-- left untouched instead of being destroyed. Comparing against strftime()'s own
-- output is idempotent and avoids D1's 50-byte LIKE/GLOB pattern limit.

UPDATE orders
SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
WHERE created_at IS NOT NULL
  AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL
  AND created_at <> strftime('%Y-%m-%dT%H:%M:%fZ', created_at);

UPDATE orders
SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', updated_at)
WHERE updated_at IS NOT NULL
  AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS NOT NULL
  AND updated_at <> strftime('%Y-%m-%dT%H:%M:%fZ', updated_at);
