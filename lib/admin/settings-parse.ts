/**
 * === Admin settings row parsing (pure) ===
 *
 * `admin_settings.value` is JSON for every row the app writes, but not
 * necessarily for legacy rows that predate that convention or that arrive from
 * an import, which can hold bare strings:
 *
 *   currency = USD
 *   store_name = Acme
 *   social_instagram = https://instagram.com/acme
 *
 * The admin settings page used to call `JSON.parse(setting.value)` unguarded
 * inside a `forEach`. The first non-JSON row threw, the loop aborted, the outer
 * `catch` swallowed it, and NOTHING loaded — every field silently kept its
 * hardcoded default. Because the page then saves every category from that same
 * state, one click of Save wrote those defaults over every stored setting.
 * Nothing errored, and the page looked normal throughout, because the defaults
 * are plausible values.
 *
 * So: a row that is not JSON is not corrupt, it is a bare string, and it must
 * never be able to take the whole page down with it.
 */

/**
 * One `admin_settings.value` as a usable value. JSON when the row holds JSON,
 * the raw string when it doesn't (the legacy shape), and `undefined` only for a
 * genuinely absent value — never a throw.
 */
export function parseSettingValue(raw: unknown): unknown {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== 'string') return raw;

  try {
    return JSON.parse(raw);
  } catch {
    // A bare legacy string ("USD", "https://instagram.com/acme"). Returning it
    // as-is is what the row means; the alternative that shipped was losing every
    // other row alongside it.
    return raw;
  }
}

export interface SettingRow {
  key?: unknown;
  value?: unknown;
  category?: unknown;
}

export interface ParsedSettings {
  /** key → parsed value, for every row that had a usable key. */
  values: Map<string, unknown>;
  /** Keys whose value was not JSON, for logging. Not an error condition. */
  nonJsonKeys: string[];
}

/**
 * Parse a settings payload row by row. A bad row is recorded, never thrown, so
 * the caller always receives every OTHER row.
 */
export function parseSettingRows(rows: unknown): ParsedSettings {
  const values = new Map<string, unknown>();
  const nonJsonKeys: string[] = [];

  if (!Array.isArray(rows)) return { values, nonJsonKeys };

  for (const row of rows as SettingRow[]) {
    if (!row || typeof row !== 'object') continue;
    const key = typeof row.key === 'string' ? row.key : null;
    if (!key) continue;

    const parsed = parseSettingValue(row.value);
    if (typeof row.value === 'string' && typeof parsed === 'string' && parsed === row.value) {
      // Round-tripped unchanged, i.e. it did not parse as JSON. A JSON string
      // row ('"USD"') parses to 'USD' and is NOT flagged, which is correct —
      // only genuinely non-JSON rows land here.
      try {
        JSON.parse(row.value);
      } catch {
        nonJsonKeys.push(key);
      }
    }
    values.set(key, parsed);
  }

  return { values, nonJsonKeys };
}
