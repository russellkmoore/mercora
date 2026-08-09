import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name: string): string {
  return readFileSync(join(process.cwd(), "migrations", name), "utf8");
}

function withoutLineComments(sql: string): string {
  return sql.replace(/^\s*--.*$/gm, "");
}

describe("fulfillment foundation migrations", () => {
  it("adds a nullable carrier and guards every legacy JSON extraction", () => {
    const sql = migration("0013_add_shipping_carrier.sql");

    expect(sql).toContain("ALTER TABLE orders ADD COLUMN shipping_carrier TEXT");
    expect(sql).toContain("WHEN json_valid(extensions)");
    expect(sql).toContain("WHEN json_valid(json_extract(extensions, '$'))");
    expect(sql).toContain("ELSE trim(shipping_carrier)");
    expect(sql).toContain("WHERE shipping_carrier IS NULL");
  });

  it("constrains event details to an object and cascades order deletion", () => {
    const sql = migration("0014_add_order_events.sql");

    expect(sql).toContain("json_valid(details) AND json_type(details) = 'object'");
    expect(sql).toContain("REFERENCES orders(id) ON DELETE CASCADE");
    expect(sql).toContain("order_events_order_id_created_at_idx");
    expect(sql).toContain("order_events_event_type_created_at_idx");
  });

  it("normalizes both order timestamps without a D1-limited pattern", () => {
    const sql = withoutLineComments(migration("0015_normalize_order_timestamps.sql"));

    expect(sql).toContain("SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)");
    expect(sql).toContain("SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', updated_at)");
    expect(sql).not.toMatch(/\b(?:LIKE|GLOB)\b/i);
  });

  it("normalizes timestamp defaults for inserts into an existing orders table", () => {
    const sql = withoutLineComments(migration("0016_enforce_order_timestamp_format.sql"));

    expect(sql).toContain("CREATE TRIGGER orders_normalize_timestamps_after_insert");
    expect(sql).toContain("AFTER INSERT ON orders");
    expect(sql).toContain("strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at)");
    expect(sql).toContain("strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at)");
  });

  it("keeps every literal LIKE/GLOB pattern within D1's 50-byte limit", () => {
    const sql = withoutLineComments(migration("0013_add_shipping_carrier.sql"));
    const patterns = [...sql.matchAll(/\b(?:LIKE|GLOB)\s+'([^']*)'/gi)].map(
      ([, pattern]) => pattern,
    );

    expect(patterns.length).toBeGreaterThan(0);
    for (const pattern of patterns) {
      expect(Buffer.byteLength(pattern, "utf8")).toBeLessThanOrEqual(50);
    }
  });
});
