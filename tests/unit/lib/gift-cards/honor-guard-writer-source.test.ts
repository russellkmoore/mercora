import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The cron is the only writer of the honor-guard record (D-15). A
 * request-path write would let a caller declare that no balances exist and
 * switch honoring off while cards still carry money (T-13-33).
 *
 * **What this file checks is imports, not writes.** It walks `app/`, `lib/` and
 * `workers/` and asserts that nothing outside two allowlisted files *references*
 * `writeHonorGuard` or `runGiftCardHonorGuard`. That catches a caller reaching
 * for the writer; it cannot catch a file that writes the row without importing
 * anything, which is precisely what CR-02 was — `POST /api/admin/settings`
 * upserting `admin_settings` through Drizzle with a key from the request body.
 * The gap between "no request path writes this record" and "no request path
 * imports the writer" is exactly where that bug lived.
 *
 * `admin-settings-writer-source.test.ts` covers the write itself. Keep both:
 * this one names the specific functions, that one names the table.
 *
 * The forbidden list is its own declared array, not inlined into a string
 * the scan itself could match — this file lives under `tests/`, so it is
 * never a candidate the scan walks.
 */
const FORBIDDEN_IDENTIFIERS = ["writeHonorGuard", "runGiftCardHonorGuard"];

/**
 * The two files the contract exists to permit: the module that defines the
 * writer, and the scheduled handler that is the one caller. Everything else
 * under the scanned roots is a request path until proven otherwise.
 */
const ALLOWED_PATHS = [
  join("lib", "gift-cards", "honor-guard.ts"),
  join("lib", "observability", "scheduled.ts"),
];

/** The roots a request can be served from. `workers/` is included so a tail or side worker cannot become a second writer. */
const SCANNED_ROOTS = ["app", "lib", "workers"];

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
  const root = process.cwd();
  const files = SCANNED_ROOTS
    .flatMap((directory) => collectSourceFiles(join(root, directory)))
    .map((file) => relative(root, file))
    .filter((file) => !ALLOWED_PATHS.includes(file));

  it(
    "references no writer or cron entry point under app/, lib/ or workers/, because a " +
      "request-path write would let a caller declare that no balances exist",
    () => {
      const offenders: Array<{ file: string; identifier: string }> = [];
      for (const file of files) {
        const stripped = stripCommentLines(readFileSync(join(root, file), "utf8"));
        for (const identifier of FORBIDDEN_IDENTIFIERS) {
          if (stripped.includes(identifier)) {
            offenders.push({ file, identifier });
          }
        }
      }
      expect(offenders).toEqual([]);
    },
  );

  it("walked files under every scanned root, so an empty directory could not fake a pass", () => {
    for (const directory of SCANNED_ROOTS) {
      expect(files.some((file) => file.startsWith(`${directory}/`)), directory).toBe(true);
    }
  });

  it("each allowlisted file exists and does reference the writer, so the allowlist cannot rot", () => {
    for (const allowed of ALLOWED_PATHS) {
      const source = stripCommentLines(readFileSync(join(root, allowed), "utf8"));
      expect(
        FORBIDDEN_IDENTIFIERS.some((identifier) => source.includes(identifier)),
        allowed,
      ).toBe(true);
    }
  });
});
