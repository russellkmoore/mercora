---
phase: 08-documentation-visual-qa-close-out
fixed_at: 2026-09-05T10:21:00Z
review_path: .planning/phases/08-documentation-visual-qa-close-out/08-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-09-05T10:21:00Z
**Source review:** .planning/phases/08-documentation-visual-qa-close-out/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (Critical + Warning; IN-01 is Info and out of scope for this fix pass)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Unfiltered settings load never seeds categories that haven't been touched yet, once any row exists

**Files modified:** `app/api/admin/settings/route.ts`, `tests/unit/app/api/admin-settings-empty-category.test.ts`
**Commit:** `361b76d`
**Applied fix:** Replaced the `settings.length === 0` seeding gate with a "which default keys are
absent" check: an unconditional, unfiltered read of every existing `admin_settings.key` builds a
`Set`, and `missingDefaults` is computed by filtering `defaultSettings` (scoped to the requested
category, or the full table when unfiltered) against that set. This means a category-scoped call
(e.g. `?category=refund`) seeding only its own defaults no longer permanently starves every other
category once any row exists anywhere in the table — a later unfiltered load still picks up
`system`, `store`, `shipping`, `promotions`, and `recommendations` defaults that were never
inserted. It also incidentally fixes the case where a category picks up newly-added default keys
after having been seeded once already. The re-select after seeding was widened from "only when the
scope was originally empty" to "whenever anything was actually seeded, or the scope was originally
empty" so the response always reflects the post-seed state.

### WR-02: Concurrent cold-start requests can race on the seed insert and 500 instead of degrading gracefully

**Files modified:** `app/api/admin/settings/route.ts` (same commit as WR-01 — the two fixes land in
the same seeding block and could not be split into separate hunks without leaving the file in an
inconsistent intermediate state)
**Commit:** `361b76d`
**Applied fix:** Verified `onConflictDoNothing()` is supported by this project's installed
`drizzle-orm` (present in `node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.ts`) and
added it to the seed insert: `db.insert(admin_settings).values(missingDefaults).onConflictDoNothing()`.
Wrapped the insert in a `try/catch` per the review's fallback suggestion as well, so even if the
D1 runtime driver's conflict-handling ever diverges from the type-level contract, a constraint
violation from a losing concurrent insert is swallowed and the handler falls through to the
re-select rather than surfacing a 500.

**Test changes:** Extended `tests/unit/app/api/admin-settings-empty-category.test.ts`:
- Added a case where a partially-seeded category (one key present, rest missing) only inserts the
  still-missing keys for that category.
- Added a case where an unfiltered load, on a table seeded with only one category's defaults,
  inserts every other category's missing defaults.
- Added a case asserting `onConflictDoNothing()` is invoked on the seed insert.
- Updated the existing 6 cases' mocks to account for the new unconditional existing-keys read
  (previously category-scoped requests never touched the unfiltered code path; now they always do,
  once, for the existing-keys check) — all 6 original cases still pass with their original
  assertions intact except one (`"scopes the post-seed re-select..."`) whose assertion that
  `unfilteredMock` is "never called" was updated to "called exactly once," since that invariant is
  now intentionally false by design (WR-01's fix requires an unfiltered existing-keys read even for
  category-scoped requests).
- Fixed a pre-existing-shape TypeScript inference issue in the `insertValues` mock
  (`vi.fn(() => (...))` narrowed `Parameters` to `[]`, breaking `mock.calls[0][0]` indexing in an
  already-existing assertion) by using `vi.fn().mockReturnValue(...)` instead, preserving the
  original loose typing.

**Verification performed:**
- `mise exec -- npx vitest run tests/unit/app/api/admin-settings-empty-category.test.ts` — 9/9 pass
  (6 original + 3 new).
- `mise exec -- npx vitest run tests/unit/app/api` — 12 files / 100 tests pass (no regressions in
  sibling admin API tests, including `admin-settings-custom-js.test.ts` which only exercises
  `POST` and is unaffected).
- `mise exec -- npm run typecheck` — clean.
- `mise exec -- npx eslint app/api/admin/settings/route.ts tests/unit/app/api/admin-settings-empty-category.test.ts` — clean.
- `mise exec -- npm run scan:tokens` — 0 violations (2 pre-existing MANUAL-REVIEW entries,
  unrelated to this change).
- Ran directly in the main checkout — `workflow.use_worktrees` is `false` in
  `.planning/config.json`, so no isolated worktree was created for this fix pass; results are
  reproducible from the current working tree as-is.

## Skipped Issues

None in scope. IN-01 (unused `isSuperAdminActor` mock setup in the test file) was intentionally
excluded — `fix_scope` for this run is `critical_warning`, and IN-01 is an Info-severity finding.

---

_Fixed: 2026-09-05T10:21:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
