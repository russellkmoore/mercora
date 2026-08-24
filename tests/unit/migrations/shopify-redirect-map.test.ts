import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectMigration } from "@/scripts/lib/migration-safety.mjs";

const migrationPath = "migrations/0020_add_redirect_map.sql";
const migration = readFileSync(migrationPath, "utf8");

describe("0020 redirect map migration", () => {
  it("is an additive, empty-state-safe migration", () => {
    expect(inspectMigration(migrationPath, migration).status).toBe("expand");
    expect(migration).not.toMatch(/\b(?:ALTER|DROP|DELETE|UPDATE)\b/i);
    expect(migration).not.toMatch(/INSERT\s+INTO\s+redirect_map/i);
  });

  it("constrains internal paths, direct loops, and permanent status codes", () => {
    expect(migration).toContain("source_path TEXT NOT NULL UNIQUE");
    expect(migration).toContain("substr(source_path, 1, 2) != '//'");
    expect(migration).toContain("substr(target_path, 1, 2) != '//'");
    expect(migration).toContain("source_path != target_path");
    expect(migration).toContain("target_path NOT LIKE '/products/%'");
    expect(migration).toContain("status_code IN (301, 308)");
    expect(migration).toContain("length(trim(entity_type)) BETWEEN 1 AND 64");
    expect(migration).toContain("created_at >= 0");
    expect(migration).toContain("redirect_map_source_path_idx");
  });
});
