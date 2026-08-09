-- Existing orders tables retain the CURRENT_TIMESTAMP defaults declared by
-- 0001. SQLite cannot alter a column default in place, so normalize omitted or
-- legacy timestamp values after every insert. New schemas generated from the
-- Drizzle definition use the canonical strftime() default directly.

CREATE TRIGGER orders_normalize_timestamps_after_insert
AFTER INSERT ON orders
WHEN (
  NEW.created_at IS NOT NULL
  AND strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at) IS NOT NULL
  AND NEW.created_at <> strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at)
) OR (
  NEW.updated_at IS NOT NULL
  AND strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at) IS NOT NULL
  AND NEW.updated_at <> strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at)
)
BEGIN
  UPDATE orders
  SET
    created_at = CASE
      WHEN NEW.created_at IS NOT NULL
        AND strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at) IS NOT NULL
      THEN strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at)
      ELSE NEW.created_at
    END,
    updated_at = CASE
      WHEN NEW.updated_at IS NOT NULL
        AND strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at) IS NOT NULL
      THEN strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at)
      ELSE NEW.updated_at
    END
  WHERE id = NEW.id;
END;
