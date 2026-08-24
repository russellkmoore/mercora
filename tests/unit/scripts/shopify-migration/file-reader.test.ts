import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";
import { readCsvFile, readJsonFile, resolveInputFile } from "@/scripts/shopify-migration/lib/file-reader";

const roots: string[] = [];
function root(): string {
  const value = mkdtempSync(join(tmpdir(), "mercora-shopify-reader-"));
  roots.push(value);
  return value;
}

afterEach(() => {
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("bounded migration file readers", () => {
  it("reads bounded CSV and JSON array wrappers", () => {
    const input = root();
    writeFileSync(join(input, "rows.csv"), "id,title\n1,Example Product\n", "utf8");
    writeFileSync(join(input, "rows.json"), JSON.stringify({ products: [{ id: 1 }] }), "utf8");
    expect(readCsvFile(input, "rows.csv")).toEqual([{ id: "1", title: "Example Product" }]);
    expect(readJsonFile(input, "rows.json")).toEqual([{ id: 1 }]);
  });

  it("rejects traversal, absolute paths, and symlink escapes", () => {
    const input = root();
    const outside = root();
    writeFileSync(join(outside, "secret.csv"), "email\ncustomer@example.test\n", "utf8");
    symlinkSync(join(outside, "secret.csv"), join(input, "link.csv"));
    expect(() => resolveInputFile(input, "../secret.csv")).toThrow(/escapes/);
    expect(() => resolveInputFile(input, join(outside, "secret.csv"))).toThrow(/relative/);
    expect(() => resolveInputFile(input, "link.csv")).toThrow(/symlink escapes/);
  });

  it("rejects oversized files and excessive record counts", () => {
    const input = root();
    writeFileSync(join(input, "large.json"), JSON.stringify([{ id: 1 }, { id: 2 }]), "utf8");
    expect(() => readJsonFile(input, "large.json", { maxBytes: 5 })).toThrow(/byte limit/);
    expect(() => readJsonFile(input, "large.json", { maxRecords: 1 })).toThrow(/more than 1 records/);
  });

  it("rejects duplicate CSV headings and oversized records", () => {
    const input = root();
    writeFileSync(join(input, "duplicate.csv"), "id,id\n1,2\n", "utf8");
    writeFileSync(join(input, "record.csv"), `id\n${"x".repeat(20)}\n`, "utf8");
    expect(() => readCsvFile(input, "duplicate.csv")).toThrow(/duplicate/);
    expect(() => readCsvFile(input, "record.csv", { maxRecordBytes: 10 })).toThrow();
  });
});
