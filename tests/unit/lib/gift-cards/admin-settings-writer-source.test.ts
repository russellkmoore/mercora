import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { HONOR_GUARD_SETTING_KEY } from "@/lib/gift-cards/honor-guard";

/**
 * === The honor guard is cron-only: the *write* contract ===
 *
 * Its sibling, `honor-guard-writer-source.test.ts`, greps for the identifiers
 * `writeHonorGuard` and `runGiftCardHonorGuard`. That catches a file that
 * imports the writer. It does not catch a file that writes the row without
 * importing anything — which is exactly what CR-02 was:
 * `POST /api/admin/settings` upserted `admin_settings` through Drizzle with a
 * key taken straight from the request body, and would have passed that scan
 * untouched at any width.
 *
 * So this scans for the thing the contract actually cares about: writes to
 * `admin_settings`, in any form, anywhere a request can reach. Every writer must
 * be listed below, and listing one means saying what it does about the guard key
 * — either it refuses the key explicitly, or it writes a fixed set of literal
 * keys that demonstrably does not include it. A new writer fails this test until
 * its author answers that question.
 */

/** Everything a request can be served from. */
const SCANNED_ROOTS = ["app", "lib", "workers"];

/**
 * Drizzle and raw SQL both count. `db.select().from(admin_settings)` is a read
 * and deliberately absent — this contract is about writes.
 */
const WRITE_PATTERNS = [
  /\.insert\(\s*admin_settings/,
  /\.update\(\s*admin_settings/,
  /\.delete\(\s*admin_settings/,
  /INSERT\s+INTO\s+admin_settings/i,
  /UPDATE\s+admin_settings/i,
  /DELETE\s+FROM\s+admin_settings/i,
];

type Writer =
  /** Takes an arbitrary key, so it must name the guard key to refuse it. */
  | { path: string; refusesGuardKey: true }
  /**
   * Writes a closed set of literal keys. Naming the guard constant would be
   * noise — it cannot write a key it does not contain — so instead the keys
   * themselves are declared here and checked against both the file and the
   * guard key. That is a stronger statement than a mention.
   */
  | { path: string; writesOnlyKeys: string[] };

const ALLOWED_WRITERS: Writer[] = [
  // The guard's own writer. The cron is its only caller.
  { path: join("lib", "gift-cards", "honor-guard.ts"), refusesGuardKey: true },
  // The generic settings writer: arbitrary key from the request body, which is
  // why it has to refuse this one by name (CR-02).
  { path: join("app", "api", "admin", "settings", "route.ts"), refusesGuardKey: true },
  {
    path: join("app", "api", "admin", "recommendations", "settings", "route.ts"),
    writesOnlyKeys: [
      "recommendations.strategy",
      "recommendations.personalize",
      "recommendations.limit",
      "recommendations.exclude_owned",
    ],
  },
];

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...collectSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) files.push(full);
  }
  return files;
}

/** Drops full-line comments so prose about writing cannot be read as a write. */
function stripCommentLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

const root = process.cwd();
const sources = new Map(
  SCANNED_ROOTS
    .flatMap((directory) => collectSourceFiles(join(root, directory)))
    .map((file) => [relative(root, file), readFileSync(file, "utf8")] as const),
);

function writesAdminSettings(source: string): boolean {
  const code = stripCommentLines(source);
  return WRITE_PATTERNS.some((pattern) => pattern.test(code));
}

/** Path comparison in the platform's own separator, so this passes on Windows too. */
const allowedPaths = new Set(ALLOWED_WRITERS.map((writer) => writer.path));
const normalize = (path: string) => path.split("/").join(sep);

describe("admin_settings write contract (D-15, CR-02, WR-16)", () => {
  it("scanned every root, so an empty directory could not fake a pass", () => {
    for (const directory of SCANNED_ROOTS) {
      expect(
        [...sources.keys()].some((file) => file.startsWith(`${directory}${sep}`)),
        directory,
      ).toBe(true);
    }
  });

  it("no file outside the allowlist writes to admin_settings", () => {
    const offenders = [...sources]
      .filter(([file, source]) => !allowedPaths.has(normalize(file)) && writesAdminSettings(source))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  it("every allowlisted writer still writes, so the allowlist cannot rot", () => {
    // An entry that no longer writes anything is dead weight that would silently
    // grant permission to a future edit.
    for (const writer of ALLOWED_WRITERS) {
      const source = sources.get(writer.path);
      expect(source, writer.path).toBeDefined();
      expect(writesAdminSettings(source as string), writer.path).toBe(true);
    }
  });

  it("every writer that takes an arbitrary key names the guard key to refuse it", () => {
    for (const writer of ALLOWED_WRITERS) {
      if (!("refusesGuardKey" in writer)) continue;
      const source = stripCommentLines(sources.get(writer.path) as string);
      // Either the exported constant or the literal — the point is that the file
      // has an opinion about this key rather than passing it through.
      expect(
        source.includes("HONOR_GUARD_SETTING_KEY") || source.includes(HONOR_GUARD_SETTING_KEY),
        writer.path,
      ).toBe(true);
    }
  });

  it("every fixed-key writer writes only the keys it declared, and none is the guard key", () => {
    for (const writer of ALLOWED_WRITERS) {
      if (!("writesOnlyKeys" in writer)) continue;
      const source = sources.get(writer.path) as string;

      for (const key of writer.writesOnlyKeys) {
        // Declared here and present there: the allowlist describes the real file.
        expect(source, `${writer.path} -> ${key}`).toContain(key);
        expect(key).not.toBe(HONOR_GUARD_SETTING_KEY);
      }
      // No arbitrary key reaches the write. If this file ever starts taking a
      // key from a request it must move to the refusesGuardKey tier.
      expect(source.includes("HONOR_GUARD_SETTING_KEY"), writer.path).toBe(false);
    }
  });
});
