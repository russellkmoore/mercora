import { describe, expect, it } from "vitest";
import {
  canApply,
  interpretMigrationList,
  migrationArgs,
  parseWranglerConfig,
  resolveTarget,
  valueAfter,
} from "@/scripts/lib/d1-migrate-plan.mjs";

const config = parseWranglerConfig(`{
  // jsonc comments must not corrupt a URL
  "d1_databases": [{ "binding": "DB", "database_name": "store-db", "database_id": "prod-id", "preview_database_id": "preview-id" }]
}`);

describe("D1 migration plans", () => {
  it("does not treat a positional argument as the value of a missing flag", () => {
    expect(valueAfter(["local", "--apply"], "--target")).toBeUndefined();
    expect(valueAfter(["--target"], "--target")).toBeUndefined();
    expect(valueAfter(["--target", "--apply"], "--target")).toBeUndefined();
    expect(valueAfter(["--target", "preview"], "--target")).toBe("preview");
  });

  it("preserves string contents while removing JSONC trailing commas", () => {
    expect(
      parseWranglerConfig(`{
        "objectText": "keep,}",
        "arrayText": "keep,]",
        "nested": { "enabled": true, },
        "items": ["one",],
      }`),
    ).toEqual({
      objectText: "keep,}",
      arrayText: "keep,]",
      nested: { enabled: true },
      items: ["one"],
    });
  });

  it("sends preview work to the preview database, never production", () => {
    const preview = resolveTarget(config, { target: "preview", environment: undefined });
    expect(migrationArgs(preview, "apply")).toContain("--preview");
    expect(migrationArgs(preview, "apply")).toContain("--remote");
  });

  it("refuses a preview command when no preview database is configured", () => {
    expect(() => resolveTarget({ d1_databases: [{ binding: "DB", database_name: "store-db" }] }, { target: "preview", environment: undefined })).toThrow(
      "preview_database_id",
    );
  });

  it("requires two separate production safeguards", () => {
    expect(canApply({ target: "production", flags: ["--confirm-production"], environment: {} }).allowed).toBe(false);
    expect(
      canApply({
        target: "production",
        flags: ["--confirm-production"],
        environment: { MERCORA_ALLOW_PRODUCTION_MIGRATIONS: "1" },
      }).allowed,
    ).toBe(true);
  });

  it("fails closed when Wrangler status output is not understood", () => {
    expect(interpretMigrationList("unexpected output").status).toBe("unrecognized");
    expect(interpretMigrationList("No migrations to apply!").status).toBe("up-to-date");
    expect(interpretMigrationList("0007_add_orders.sql").pending).toEqual(["0007_add_orders.sql"]);
  });
});
