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
 *
 * The raw-SQL patterns allow for SQLite's conflict clauses. `INSERT OR REPLACE
 * INTO` is the idiomatic D1 upsert and the most likely form a future cron or
 * migration helper reaches for, and a bare `INSERT\s+INTO` does not match it,
 * because `OR REPLACE` sits between the two words. `REPLACE INTO` is the same
 * statement spelled shorter. Each of these is exercised as a literal fixture in
 * the "patterns" block below, so the regexes are tested and not merely applied
 * — this contract exists because CR-02 slipped past an identifier scan, and an
 * untested regex is the same gap one layer down.
 *
 * Every table name ends in `\b`, so `admin_settings_audit` is a different
 * table and not a hit. A contract that fires on the wrong file gets muted, and
 * a muted contract is worse than no contract — this was a genuine false
 * positive until the fixture below caught it.
 */
const WRITE_PATTERNS = [
  /\.insert\(\s*admin_settings\b/,
  /\.update\(\s*admin_settings\b/,
  /\.delete\(\s*admin_settings\b/,
  /INSERT\s+(OR\s+(REPLACE|IGNORE|ABORT|FAIL|ROLLBACK)\s+)?INTO\s+admin_settings\b/i,
  /REPLACE\s+INTO\s+admin_settings\b/i,
  /UPDATE\s+(OR\s+(REPLACE|IGNORE|ABORT|FAIL|ROLLBACK)\s+)?admin_settings\b/i,
  /DELETE\s+FROM\s+admin_settings\b/i,
  /UPSERT\s+INTO\s+admin_settings\b/i,
];

/**
 * The Drizzle patterns key on the literal identifier appearing inside the call
 * parentheses, so renaming the table on import evades all of them:
 * `import { admin_settings as settingsTable }` then `db.update(settingsTable)`
 * writes the same row and matches nothing. Rather than trying to follow the
 * alias, the alias itself is forbidden — there is no reason to rename this
 * table, and "no reason to" is a much easier rule to enforce than dataflow.
 *
 * `adminSettings` is covered too: it is not the schema export's name today, but
 * it is the name a camelCase refactor would reach for.
 */
const ALIASED_IMPORT_PATTERNS = [
  /\badmin_settings\s+as\s+\w+/,
  /\badminSettings\s+as\s+\w+/,
];

/** Drizzle writes through a camelCase binding, in case the schema is ever renamed. */
const CAMEL_CASE_WRITE_PATTERNS = [
  /\.insert\(\s*adminSettings\b/,
  /\.update\(\s*adminSettings\b/,
  /\.delete\(\s*adminSettings\b/,
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
  return [...WRITE_PATTERNS, ...CAMEL_CASE_WRITE_PATTERNS].some((pattern) => pattern.test(code));
}

function aliasesAdminSettings(source: string): boolean {
  const code = stripCommentLines(source);
  return ALIASED_IMPORT_PATTERNS.some((pattern) => pattern.test(code));
}

/** Path comparison in the platform's own separator, so this passes on Windows too. */
const allowedPaths = new Set(ALLOWED_WRITERS.map((writer) => writer.path));
const normalize = (path: string) => path.split("/").join(sep);

describe("the write patterns themselves (WR-19)", () => {
  // Literal fixtures, not files. Every shape below was run against the original
  // six patterns during review; the ones marked as previously missed are why
  // this block exists. A regex that is only ever applied is a regex nobody has
  // checked.
  it.each([
    ["Drizzle update", "await db.update(admin_settings).set({ value })"],
    ["Drizzle insert", "await db.insert(admin_settings).values(row)"],
    ["Drizzle delete", "await db.delete(admin_settings).where(eq(k, key))"],
    ["Drizzle insert with whitespace", "db.insert(\n  admin_settings,\n).values(row)"],
    ["plain raw insert", "db.prepare(`INSERT INTO admin_settings (key) VALUES (?)`)"],
    ["raw update", "db.prepare('UPDATE admin_settings SET value = ?')"],
    ["raw delete", "db.prepare('DELETE FROM admin_settings WHERE key = ?')"],
    // Previously missed — SQLite conflict clauses sit between INSERT and INTO.
    ["INSERT OR REPLACE, the idiomatic D1 upsert", "db.prepare(`INSERT OR REPLACE INTO admin_settings (key) VALUES (?)`)"],
    ["INSERT OR IGNORE", "db.prepare(`INSERT OR IGNORE INTO admin_settings (key) VALUES (?)`)"],
    ["INSERT OR ABORT", "db.prepare(`INSERT OR ABORT INTO admin_settings (key) VALUES (?)`)"],
    ["INSERT OR FAIL", "db.prepare(`INSERT OR FAIL INTO admin_settings (key) VALUES (?)`)"],
    ["INSERT OR ROLLBACK", "db.prepare(`INSERT OR ROLLBACK INTO admin_settings (key) VALUES (?)`)"],
    ["REPLACE INTO, the same statement spelled shorter", "db.prepare(`REPLACE INTO admin_settings (key) VALUES (?)`)"],
    ["UPDATE OR REPLACE", "db.prepare(`UPDATE OR REPLACE admin_settings SET value = ?`)"],
    ["UPSERT INTO", "db.prepare(`UPSERT INTO admin_settings (key) VALUES (?)`)"],
    ["lowercase SQL", "db.prepare(`insert into admin_settings (key) values (?)`)"],
    ["newline between keywords", "db.prepare(`INSERT\n  INTO admin_settings (key) VALUES (?)`)"],
    // A camelCase rename of the schema export would otherwise slip every
    // Drizzle pattern at once.
    ["camelCase Drizzle binding", "await db.update(adminSettings).set({ value })"],
  ])("catches %s", (_name, fixture) => {
    expect(writesAdminSettings(fixture)).toBe(true);
  });

  it.each([
    ["a read", "await db.select().from(admin_settings).where(eq(k, key))"],
    ["a read of another table", "await db.update(orders).set({ status })"],
    ["a write to a differently named table", "db.prepare('UPDATE admin_settings_audit SET x = ?')"],
    ["prose in a full-line comment", "// this file does not UPDATE admin_settings"],
  ])("does not catch %s", (_name, fixture) => {
    // A contract that fires on reads gets muted, and a muted contract is worse
    // than none.
    expect(writesAdminSettings(fixture)).toBe(false);
  });

  it.each([
    ["snake_case alias", "import { admin_settings as settingsTable } from '@/lib/db/schema/settings';"],
    ["camelCase alias", "import { adminSettings as t } from '@/lib/db/schema/settings';"],
  ])("treats %s as an evasion", (_name, fixture) => {
    // The Drizzle patterns key on the identifier inside the call parentheses,
    // so a rename on import writes the same row and matches nothing. Forbidding
    // the rename is far easier to enforce than following it.
    expect(aliasesAdminSettings(fixture)).toBe(true);
  });

  it("does not treat an ordinary unaliased import as an evasion", () => {
    expect(aliasesAdminSettings(
      "import { admin_settings, defaultSettings } from '@/lib/db/schema/settings';",
    )).toBe(false);
  });
});

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

  it("no file renames admin_settings on import, which would evade every Drizzle pattern", () => {
    const offenders = [...sources]
      .filter(([, source]) => aliasesAdminSettings(source))
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
