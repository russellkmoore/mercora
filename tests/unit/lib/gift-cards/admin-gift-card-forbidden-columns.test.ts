import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { GIFT_CARD_EVENT_FORBIDDEN_DETAIL_KEYS } from "@/lib/gift-cards/events";

/**
 * === D-14/GCA-09: the forbidden-column source contract ===
 *
 * No admin read path — the list projection, the timeline, the event writer,
 * or any route under `app/api/admin/gift-cards/` — may select or echo a
 * gift-card's bearer-code hash, its encrypted delivery material, a claim
 * token, an email idempotency key, or a ledger business key. This is a test,
 * not a habit: it greps the actual source of every file in that surface for
 * the forbidden column names, after stripping full-line comments so prose
 * describing the rule cannot be mistaken for violating it.
 *
 * The forbidden list is imported from `lib/gift-cards/events.ts` — the same
 * array `assertGiftCardEventDetails` enforces at write and read time — so
 * there is one list, not two.
 */

const root = process.cwd();

const CORE_FILES = [
  join("lib", "gift-cards", "presentations.ts"),
  join("lib", "gift-cards", "timeline.ts"),
  join("lib", "gift-cards", "events.ts"),
];

const ROUTE_DIR = join("app", "api", "admin", "gift-cards");

/** Full-line comments only — a doc line naming a forbidden column for prose
 * reasons must not trip the scan; an actual reference in real code must. */
function stripCommentLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

/**
 * `GIFT_CARD_EVENT_FORBIDDEN_DETAIL_KEYS`'s own declaration in `events.ts` is
 * the single canonical inventory of these names — listing them there is the
 * mechanism, not a leak. Stripped before scanning so the contract does not
 * trip on its own source of truth.
 */
function withoutForbiddenListDeclaration(source: string): string {
  return source.replace(
    /export const GIFT_CARD_EVENT_FORBIDDEN_DETAIL_KEYS[\s\S]*?\] as const;/,
    "",
  );
}

function collectRouteFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // Wave 4 creates this directory. Absent today is expected, not a
    // pass-by-omission — see the "tolerates an absent route directory" test.
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...collectRouteFiles(full));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) files.push(full);
  }
  return files;
}

/** D-14's six named columns, plus the general ledger business-key column. */
const FORBIDDEN_COLUMNS: readonly string[] = [
  ...GIFT_CARD_EVENT_FORBIDDEN_DETAIL_KEYS,
  "business_key",
];

interface ScannedFile {
  path: string;
  raw: string;
  scanned: string;
}

const coreEntries: ScannedFile[] = CORE_FILES.map((relPath) => {
  const absolute = join(root, relPath);
  const raw = readFileSync(absolute, "utf8");
  const stripped = stripCommentLines(raw);
  const scanned = relPath.endsWith(join("gift-cards", "events.ts"))
    ? withoutForbiddenListDeclaration(stripped)
    : stripped;
  return { path: relPath, raw, scanned };
});

const routeEntries: ScannedFile[] = collectRouteFiles(join(root, ROUTE_DIR)).map((absolute) => {
  const raw = readFileSync(absolute, "utf8");
  return { path: relative(root, absolute), raw, scanned: stripCommentLines(raw) };
});

const allEntries = [...coreEntries, ...routeEntries];

describe("gift-card admin read paths never carry code material (D-14, GCA-09)", () => {
  it("scanned a non-empty, real file set", () => {
    // The three core modules are hardcoded paths, not a glob — an empty or
    // misconfigured glob pattern can never fake this assertion.
    expect(coreEntries).toHaveLength(3);
    for (const entry of coreEntries) {
      expect(entry.raw.length, `${entry.path} must be readable and non-empty`).toBeGreaterThan(0);
    }
  });

  it.each(FORBIDDEN_COLUMNS)("never references the forbidden column \"%s\"", (column) => {
    for (const entry of allEntries) {
      expect(entry.scanned, `${entry.path} must not reference "${column}"`).not.toContain(column);
    }
  });

  it("still selects the account id — a regression that silently drops it fails too (D-14, RESEARCH Pitfall 6)", () => {
    // Deliberately stricter than a bare `account.id` substring: every
    // WHERE/JOIN predicate in PRESENTATION_SELECT also writes `= account.id`
    // as a foreign-key comparison, which is not the same claim as "id is a
    // selected column". Requiring the trailing comma of a SELECT list entry
    // is what actually proves the id is projected, not merely joined on.
    const presentations = coreEntries.find((entry) => entry.path.endsWith("presentations.ts"));
    expect(presentations).toBeDefined();
    expect(presentations?.scanned).toMatch(/account\.id,/);
  });

  it("tolerates an absent route directory today, but scans it the same way once it exists", () => {
    // Wave 4 creates app/api/admin/gift-cards/. `routeEntries` is `[]` right
    // now — that is expected, not a pass-by-omission, because the
    // forbidden-column loop above already runs over it unconditionally: once
    // the directory exists, any file placed there is scanned by the same
    // assertions with no additional wiring.
    expect(Array.isArray(routeEntries)).toBe(true);
  });
});
