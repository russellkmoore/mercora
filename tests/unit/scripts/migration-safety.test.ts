import { describe, expect, it } from "vitest";
import {
  acknowledgement,
  findDuplicateNumbers,
  inspectMigration,
  stripSqlComments,
  summarize,
} from "@/scripts/lib/migration-safety.mjs";

describe("stripSqlComments", () => {
  it("removes line and block comments", () => {
    expect(stripSqlComments("SELECT 1; -- DROP TABLE orders\n")).not.toMatch(/DROP/);
    expect(stripSqlComments("/* DROP TABLE orders */ SELECT 1;")).not.toMatch(/DROP/);
  });

  it("preserves statement text that merely contains a comment marker", () => {
    const sql = "UPDATE t SET note = 'a--b';";
    expect(stripSqlComments(sql)).toContain("'a--b'");
  });

  it("keeps doubled quotes inside a string literal", () => {
    const sql = "UPDATE t SET note = 'it''s -- fine'; DROP TABLE t;";
    expect(stripSqlComments(sql)).toContain("DROP TABLE t");
  });
});

describe("acknowledgement", () => {
  it("requires a reason", () => {
    expect(acknowledgement("-- migration-safety: acknowledged")).toBeNull();
    expect(acknowledgement("-- migration-safety: acknowledged reader shipped in 1.4"))
      .toBe("reader shipped in 1.4");
  });

  it("returns null when absent", () => {
    expect(acknowledgement("DROP TABLE orders;")).toBeNull();
  });
});

describe("inspectMigration", () => {
  it("treats additive migrations as expand", () => {
    const report = inspectMigration(
      "migrations/0018_add_thing.sql",
      "ALTER TABLE orders ADD COLUMN thing TEXT;\nCREATE TABLE x (id TEXT PRIMARY KEY);",
    );
    expect(report.status).toBe("expand");
  });

  it("blocks unacknowledged contractions", () => {
    const report = inspectMigration(
      "migrations/0019_drop_api_key.sql",
      "ALTER TABLE mcp_agents DROP COLUMN api_key;",
    );
    expect(report.status).toBe("contract");
    expect(report.contractions).toContain("DROP COLUMN");
  });

  it("does not flag a pattern named only in a comment", () => {
    const report = inspectMigration(
      "migrations/0020_notes.sql",
      "-- A later migration may DROP TABLE mcp_agents.\nCREATE TABLE y (id TEXT PRIMARY KEY);",
    );
    expect(report.status).toBe("expand");
  });

  it("allows an acknowledged contraction", () => {
    const report = inspectMigration(
      "migrations/0021_cleanup.sql",
      "-- migration-safety: acknowledged reader shipped in 1.4\nDELETE FROM mcp_agents WHERE agent_id = 'demo';",
    );
    expect(report.status).toBe("acknowledged");
    expect(report.reason).toBe("reader shipped in 1.4");
  });
});

describe("findDuplicateNumbers", () => {
  it("reports an added file that reuses an existing file's number", () => {
    const reports = findDuplicateNumbers(
      ["migrations/0030_new_thing.sql"],
      ["migrations/0030_existing_thing.sql", "migrations/0030_new_thing.sql"],
    );
    expect(reports).toEqual([
      {
        file: "migrations/0030_new_thing.sql",
        number: "0030",
        collidesWith: ["0030_existing_thing.sql"],
      },
    ]);
  });

  it("reports two added files that collide with each other", () => {
    const added = ["migrations/0031_a.sql", "migrations/0031_b.sql"];
    const allFiles = [...added];
    const reports = findDuplicateNumbers(added, allFiles);
    expect(reports).toHaveLength(2);
    expect(reports.find((r) => r.file === "migrations/0031_a.sql")?.collidesWith).toEqual([
      "0031_b.sql",
    ]);
    expect(reports.find((r) => r.file === "migrations/0031_b.sql")?.collidesWith).toEqual([
      "0031_a.sql",
    ]);
  });

  it("produces no report for an added file whose number nobody else uses", () => {
    const reports = findDuplicateNumbers(
      ["migrations/0032_unique.sql"],
      ["migrations/0001_initial_schema.sql", "migrations/0032_unique.sql"],
    );
    expect(reports).toEqual([]);
  });

  it("produces no report for two pre-existing files sharing a number when nothing was added", () => {
    const reports = findDuplicateNumbers(
      [],
      ["migrations/0023_add_order_effects_payload.sql", "migrations/0023_normalize_tax_category_codes.sql"],
    );
    expect(reports).toEqual([]);
  });

  it("ignores a filename with no leading number instead of throwing", () => {
    expect(() =>
      findDuplicateNumbers(["migrations/README.md"], ["migrations/README.md", "migrations/0001_initial_schema.sql"]),
    ).not.toThrow();
    expect(findDuplicateNumbers(["migrations/README.md"], ["migrations/README.md"])).toEqual([]);
  });

  it("stays silent on this repository's real 0023 pair when an unrelated migration is added", () => {
    const allFiles = [
      "migrations/0023_add_order_effects_payload.sql",
      "migrations/0023_normalize_tax_category_codes.sql",
      "migrations/0025_add_payment_customers.sql",
      "migrations/0026_add_unrelated_thing.sql",
    ];
    const reports = findDuplicateNumbers(["migrations/0026_add_unrelated_thing.sql"], allFiles);
    expect(reports).toEqual([]);
  });
});

describe("summarize", () => {
  it("blocks only unacknowledged contractions", () => {
    const { blocked, acknowledged, expand } = summarize([
      inspectMigration("a.sql", "CREATE TABLE a (id TEXT);"),
      inspectMigration("b.sql", "DROP TABLE b;"),
      inspectMigration("c.sql", "-- migration-safety: acknowledged shipped earlier\nDROP TABLE c;"),
    ]);
    const names = (reports: { file: string }[]) => reports.map(({ file }) => file);
    expect(names(expand)).toEqual(["a.sql"]);
    expect(names(blocked)).toEqual(["b.sql"]);
    expect(names(acknowledged)).toEqual(["c.sql"]);
  });
});
