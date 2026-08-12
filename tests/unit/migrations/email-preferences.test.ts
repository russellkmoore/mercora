import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectMigration } from "@/scripts/lib/migration-safety.mjs";

const migrationPath = "migrations/0018_add_email_preferences.sql";
const migration = readFileSync(migrationPath, "utf8");

describe("0018 email preferences migration", () => {
  it("is the reserved additive O01 migration", () => {
    expect(migrationPath).toContain("0018_");
    expect(inspectMigration(migrationPath, migration).status).toBe("expand");
    expect(migration).not.toMatch(/\b(?:ALTER|DROP|DELETE|UPDATE)\b/i);
  });

  it("uses absence as the populated-baseline eligible state", () => {
    expect(migration).toContain("CREATE TABLE email_preferences");
    expect(migration).not.toMatch(/INSERT\s+INTO\s+email_preferences/i);
    expect(migration).toContain("PRIMARY KEY (email, category)");
    expect(migration).toContain("CREATE TABLE email_deliveries");
    expect(migration).toContain("idempotency_key TEXT PRIMARY KEY");
  });
});
