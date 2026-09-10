import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * === One owner for the honor decision (D-18) ===
 *
 * "Is honoring effectively on?" was once answered in four files with three
 * different preconditions, and the disagreement shipped a real bug: the
 * checkout page consulted the guard without the sell flag and offered a
 * redemption input on a store where gift cards do not exist. `resolveHonorEffective`
 * is now the single owner, and this pins that — because "we consolidated it"
 * decays the moment someone adds a surface and reaches for whichever helper
 * autocomplete offers first. A fifth caller had already appeared
 * (`/api/admin/gift-cards`) before anything checked.
 *
 * The three internals below are still exported — they are the guard's own
 * building blocks and its tests use them — so the contract is about *callers*,
 * not about visibility.
 */

/** Everything a request can be served from. */
const SCANNED_ROOTS = ["app", "lib", "workers"];

/**
 * The building blocks of the decision. Calling one of these outside the owner
 * means re-deriving the decision with your own preconditions, which is exactly
 * the shape that produced CR-05.
 */
const INTERNALS = ["honorIsEffectivelyOn", "balancesMayExist", "readHonorGuard"];

/** Where the decision lives. It may use its own internals, obviously. */
const OWNER = join("lib", "gift-cards", "honor-guard.ts");

/**
 * One exception, and it is not a money decision.
 *
 * `/admin/gift-cards` reads the guard record to *display* it — the banner names
 * the outstanding total and the reservation count. It cannot get that from
 * `resolveHonorEffective`, which returns a boolean and deliberately declines to
 * read the record at all in sell-on/honor-off. Reusing the decision as the
 * display signal is precisely what WR-17 was: the banner told an operator the
 * store owed nothing while the record in the same file said otherwise.
 *
 * So the page may read and interpret the record. It may not call
 * `honorIsEffectivelyOn` — that one *is* the decision.
 */
const BANNER_READER = join("app", "admin", "gift-cards", "page.tsx");
const BANNER_READER_ALLOWED = ["balancesMayExist", "readHonorGuard"];

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...collectSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) files.push(full);
  }
  return files;
}

/** Drops full-line comments so prose naming a function is not read as a call. */
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
    .map((file) => [relative(root, file), stripCommentLines(readFileSync(file, "utf8"))] as const),
);

function allowedIn(file: string): string[] {
  if (file === OWNER) return INTERNALS;
  if (file === BANNER_READER) return BANNER_READER_ALLOWED;
  return [];
}

describe("honor decision ownership (D-18, WR-18)", () => {
  it("scanned every root, so an empty directory could not fake a pass", () => {
    for (const directory of SCANNED_ROOTS) {
      expect(
        [...sources.keys()].some((file) => file.startsWith(`${directory}${sep}`)),
        directory,
      ).toBe(true);
    }
  });

  it("nothing outside the owner re-derives the decision from its internals", () => {
    const offenders: Array<{ file: string; identifier: string }> = [];
    for (const [file, source] of sources) {
      const allowed = allowedIn(file);
      for (const identifier of INTERNALS) {
        if (allowed.includes(identifier)) continue;
        if (source.includes(identifier)) offenders.push({ file, identifier });
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the owner exists and exports the decision the rest of the tree must use", () => {
    const owner = sources.get(OWNER);
    expect(owner, OWNER).toBeDefined();
    expect(owner).toContain("export async function resolveHonorEffective");
  });

  it("the banner reader still reads the record, so its exemption is not dead weight", () => {
    // An exemption nobody uses is permission left lying around for a future
    // edit to pick up.
    const page = sources.get(BANNER_READER);
    expect(page, BANNER_READER).toBeDefined();
    for (const identifier of BANNER_READER_ALLOWED) {
      expect(page, `${BANNER_READER} -> ${identifier}`).toContain(identifier);
    }
    // It reads the record for display; it does not decide with it.
    expect(page).not.toContain("honorIsEffectivelyOn");
    // And it still asks the owner for the decision it does make.
    expect(page).toContain("resolveHonorEffective");
  });

  it("every surface that asks the money question asks the owner", () => {
    // Named rather than discovered: a call site that quietly stops asking is a
    // regression this list will catch, which a "find all callers" scan cannot.
    const askers = [
      join("lib", "commerce", "runtime.ts"),
      join("app", "checkout", "page.tsx"),
      join("app", "api", "gift-cards", "balance", "route.ts"),
      join("app", "admin", "gift-cards", "page.tsx"),
      join("app", "api", "admin", "gift-cards", "route.ts"),
      // Plan 14-06: the card detail and timeline routes make the same
      // existence decision the list route does.
      join("app", "api", "admin", "gift-cards", "[id]", "route.ts"),
      join("app", "api", "admin", "gift-cards", "[id]", "events", "route.ts"),
      // Plan 14-08 adds the detail page path here once it exists.
    ];
    for (const file of askers) {
      expect(sources.get(file), file).toContain("resolveHonorEffective");
    }
  });
});
