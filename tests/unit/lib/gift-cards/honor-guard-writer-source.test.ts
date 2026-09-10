import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The cron is the only writer of the honor-guard record (D-15). A
 * request-path write would let a caller declare that no balances exist and
 * switch honoring off while cards still carry money (T-13-33). This walks
 * every `.ts`/`.tsx` file under `app/` and asserts none of them references
 * the writer or the cron entry point that calls it.
 *
 * The forbidden list is its own declared array, not inlined into a string
 * the scan itself could match — this file lives outside `app/`, so it is
 * never a candidate the scan walks.
 */
const FORBIDDEN_IDENTIFIERS = ["writeHonorGuard", "runGiftCardHonorGuard"];

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

/** Drops full-line comments (`//`, `*`, `/*`) so a doc-comment mention does not trip the scan. */
function stripCommentLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

describe("honor-guard writer contract (D-15, T-13-33)", () => {
  const appDir = join(process.cwd(), "app");
  const files = collectSourceFiles(appDir);

  it(
    "references no writer or cron entry point under app/, because a request-path write " +
      "would let a caller declare that no balances exist",
    () => {
      const offenders: Array<{ file: string; identifier: string }> = [];
      for (const file of files) {
        const stripped = stripCommentLines(readFileSync(file, "utf8"));
        for (const identifier of FORBIDDEN_IDENTIFIERS) {
          if (stripped.includes(identifier)) {
            offenders.push({ file, identifier });
          }
        }
      }
      expect(offenders).toEqual([]);
    },
  );

  it("walked at least one file under app/, so an empty directory could not fake a pass", () => {
    expect(files.length).toBeGreaterThan(0);
  });
});
