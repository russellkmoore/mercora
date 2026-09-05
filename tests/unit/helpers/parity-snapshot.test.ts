import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readParitySnapshot } from "./parity-snapshot";

const UPDATE_SNAPSHOTS_FLAG = "UPDATE_SNAPSHOTS";

describe("readParitySnapshot", () => {
  let tmpDir: string;
  let savedFlag: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "parity-snapshot-test-"));
    savedFlag = process.env[UPDATE_SNAPSHOTS_FLAG];
    delete process.env[UPDATE_SNAPSHOTS_FLAG];
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (savedFlag === undefined) {
      delete process.env[UPDATE_SNAPSHOTS_FLAG];
    } else {
      process.env[UPDATE_SNAPSHOTS_FLAG] = savedFlag;
    }
  });

  it("returns an existing file's contents unchanged", () => {
    const path = join(tmpDir, "existing.html");
    writeFileSync(path, "<div>hello</div>", "utf8");

    expect(readParitySnapshot(path)).toBe("<div>hello</div>");
  });

  it("returns an existing but empty file's contents as empty, not treated as missing", () => {
    const path = join(tmpDir, "empty.html");
    writeFileSync(path, "", "utf8");

    expect(readParitySnapshot(path)).toBe("");
  });

  it("throws naming the path and the opt-in flag when the file is missing, and creates no file", () => {
    const path = join(tmpDir, "missing.html");

    expect(() => readParitySnapshot(path)).toThrowError(
      new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*${UPDATE_SNAPSHOTS_FLAG}`, "s"),
    );
    expect(existsSync(path)).toBe(false);
  });

  it("with the opt-in flag set and content supplied, creates the parent directory and writes the content", () => {
    process.env[UPDATE_SNAPSHOTS_FLAG] = "1";
    const path = join(tmpDir, "nested", "dir", "written.html");

    const result = readParitySnapshot(path, "<section>fresh</section>");

    expect(result).toBe("<section>fresh</section>");
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf8")).toBe("<section>fresh</section>");
  });

  it("with the opt-in flag set but no content supplied, throws rather than writing an empty baseline", () => {
    process.env[UPDATE_SNAPSHOTS_FLAG] = "1";
    const path = join(tmpDir, "no-content.html");

    expect(() => readParitySnapshot(path)).toThrowError();
    expect(existsSync(path)).toBe(false);
  });
});
