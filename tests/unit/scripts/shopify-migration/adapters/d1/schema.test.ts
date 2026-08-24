import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import {
  D1_PREFLIGHT_SQL,
  D1_TARGET_COLUMN_COUNT,
} from "@/scripts/shopify-migration/adapters/d1/runner";

function migratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  const migrationRoot = join(process.cwd(), "migrations");
  const migrations = readdirSync(migrationRoot).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  migrations.forEach((name) => database.exec(readFileSync(join(migrationRoot, name), "utf8")));
  database.exec(`
    CREATE TABLE d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const insert = database.prepare("INSERT INTO d1_migrations (name, applied_at) VALUES (?, 'test')");
  migrations.forEach((name) => insert.run(name));
  return database;
}

function preflight(database: DatabaseSync): Record<string, unknown> {
  return database.prepare(D1_PREFLIGHT_SQL).get() as Record<string, unknown>;
}

describe("D1 schema preflight contract", () => {
  it("matches the real migrated schema's emitted column contracts", () => {
    const database = migratedDatabase();
    expect(preflight(database)).toMatchObject({
      target_column_count: D1_TARGET_COLUMN_COUNT,
      compatible_target_column_count: D1_TARGET_COLUMN_COUNT,
      incompatible_additive_column_count: 0,
    });
    database.close();
  });

  it("permits compatible additive columns and detects incompatible additions or changed targets", () => {
    const database = migratedDatabase();
    database.exec(`
      ALTER TABLE categories ADD COLUMN optional_extra TEXT;
      ALTER TABLE products ADD COLUMN defaulted_extra TEXT NOT NULL DEFAULT 'safe';
    `);
    expect(preflight(database)).toMatchObject({
      compatible_target_column_count: D1_TARGET_COLUMN_COUNT,
      incompatible_additive_column_count: 0,
    });

    database.exec("ALTER TABLE inventory ADD COLUMN required_extra TEXT NOT NULL");
    expect(preflight(database)).toMatchObject({ incompatible_additive_column_count: 1 });

    database.exec("ALTER TABLE orders ADD COLUMN null_default_extra TEXT NOT NULL DEFAULT NULL");
    expect(preflight(database)).toMatchObject({ incompatible_additive_column_count: 2 });

    database.exec("ALTER TABLE categories RENAME COLUMN name TO incompatible_name");
    expect(preflight(database)).toMatchObject({
      compatible_target_column_count: D1_TARGET_COLUMN_COUNT - 1,
      incompatible_additive_column_count: 3,
    });
    database.close();
  });
});
