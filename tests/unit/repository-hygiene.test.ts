import { execFileSync, spawnSync } from "node:child_process";
import { basename, extname } from "node:path";
import { describe, expect, it } from "vitest";

const allowedArtifactOwners = ["migrations/", "data/d1/", "tests/fixtures/"];

function isDumpOrExport(path: string): boolean {
  if (allowedArtifactOwners.some((prefix) => path.startsWith(prefix))) return false;

  const file = basename(path).toLowerCase();
  const extension = extname(file);
  const namedArtifact = /(?:^|[-_.])(?:db|database)?[-_.]?(?:dump|export)(?:[-_.]|$)/.test(file);
  const databaseFile = [".db", ".sqlite", ".sqlite3"].includes(extension);
  return namedArtifact || databaseFile;
}

describe("repository database-artifact boundary", () => {
  it("detects artifacts by name or database extension while honoring owners", () => {
    expect(isDumpOrExport("mercora-db-dump.sql")).toBe(true);
    expect(isDumpOrExport("exports/catalog-export.json")).toBe(true);
    expect(isDumpOrExport("scratch/local.sqlite")).toBe(true);
    expect(isDumpOrExport("scripts/query.sql")).toBe(false);
    expect(isDumpOrExport("tests/fixtures/catalog.db")).toBe(false);
    expect(isDumpOrExport("migrations/customer-export.sql")).toBe(false);
    expect(isDumpOrExport("data/d1/snapshot.sqlite3")).toBe(false);
  });

  it("ignores artifacts outside explicit repository owners", () => {
    const isIgnored = (path: string) =>
      spawnSync("git", ["check-ignore", "--no-index", "-q", path]).status === 0;

    expect(isIgnored("scratch/mercora-db-dump.sql")).toBe(true);
    expect(isIgnored("scratch/catalog.sqlite")).toBe(true);
    expect(isIgnored("scripts/query.sql")).toBe(false);
    expect(isIgnored("tests/fixtures/catalog.db")).toBe(false);
    expect(isIgnored("migrations/customer-export.sql")).toBe(false);
    expect(isIgnored("data/d1/snapshot.sqlite3")).toBe(false);
  });

  it("tracks no database dump or export outside explicit artifact owners", () => {
    const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
      .split("\0")
      .filter(Boolean);

    expect(tracked.filter(isDumpOrExport)).toEqual([]);
  });
});
