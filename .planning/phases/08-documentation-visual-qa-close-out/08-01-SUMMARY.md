---
phase: 08-documentation-visual-qa-close-out
plan: 01
subsystem: docs
tags: [drizzle, sqlite, vitest, next-app-router, admin-settings, theming]

requires:
  - phase: 07-layout-switches
    provides: the appearance category (theme + layout settings keys) that has no defaults, which is what makes the empty-category seeding bug reachable
  - phase: 05-token-contract-component-sweep
    provides: the frozen 23-token contract table, copied verbatim from 05-TOKEN-MAP.md
provides:
  - A category-scoped default-seeding guard in the settings GET handler, closing WINDOWS #3
  - A regression test pinning both the scoped and unfiltered seed paths
  - docs/theming.md, opened with its admin-first switching section and the complete 23-token contract table
affects: [08-02, 08-04, 08-05]

actuals:
  tokens: 3300
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "TDD task-level RED/GREEN cycle for a route-handler bug fix, using the vi.hoisted + vi.mock(@/lib/auth/admin-middleware) + vi.mock(@/lib/db) mocking shape already established in tests/unit/app/api/admin-settings-custom-js.test.ts"
    - "Documentation claim-check discipline: every factual claim in docs/theming.md is a grep-able string traceable to the source file it came from (05-TOKEN-MAP.md, lib/themes/tokens.ts, app/admin/settings/appearance/page.tsx)"

key-files:
  created:
    - tests/unit/app/api/admin-settings-empty-category.test.ts
    - docs/theming.md
  modified:
    - app/api/admin/settings/route.ts

key-decisions:
  - "Seed set is computed once (category-filtered defaults, or the whole array when no category is given) and the insert only runs when that set is non-empty — Drizzle's insert().values([]) behavior is never exercised, per the orchestrator's Option B decision and RESEARCH.md's open question."
  - "The post-seed re-select is scoped the same way as the initial read, closing a second, related leak: a filtered request could previously receive every other category's rows back in the response."
  - "docs/theming.md's status line states plainly that this is an in-progress, multi-plan file (sections land across 08-01/08-02/08-04/08-05) rather than a placeholder Draft/Accepted value, so a reader mid-milestone isn't misled about completeness."

patterns-established:
  - "Route-handler bug fixes in this codebase get their permission gate's exact byte range hashed against HEAD in the plan's own <verify> block, so an auth-surface regression fails the plan even if the functional tests all pass."

requirements-completed: []

coverage:
  - id: D1
    description: "Category-filtered settings GET no longer re-seeds the whole defaultSettings table when the filtered result is empty; a category with no defaults (appearance) returns an empty list instead of a 500-risking full re-seed"
    requirement: "DOCS-03"
    verification:
      - kind: unit
        ref: "tests/unit/app/api/admin-settings-empty-category.test.ts#returns an empty list for a category with no defaults, on a partially-seeded table, without inserting"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/admin-settings-empty-category.test.ts#seeds only the requested category's defaults, strictly fewer rows than the full defaults array"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/admin-settings-empty-category.test.ts#seeds the full defaults array unchanged when no category is requested on a genuinely empty table"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/admin-settings-empty-category.test.ts#scopes the post-seed re-select to the requested category, never leaking other categories' rows"
        status: pass
    human_judgment: false
  - id: D2
    description: "The admin permission gate (checkAdminPermissions, 403 on failure) is provably unchanged by the fix"
    verification:
      - kind: unit
        ref: "tests/unit/app/api/admin-settings-empty-category.test.ts#returns 403 and never touches the database when the permission check fails"
        status: pass
      - kind: other
        ref: "sed -n '25,34p' app/api/admin/settings/route.ts | git hash-object --stdin, compared against the pre-fix HEAD's same line range"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/theming.md exists with the admin-first switching section and the complete 23-token contract table, every value traceable by grep to its source file"
    requirement: "DOCS-01"
    verification:
      - kind: other
        ref: "grep loop over all 23 --store-* token stems, the four non-cascade consumer names, the admin route path, single-H1 check, dev-bypass-value absence check, and a table-row-width check — all in the plan's own <verify> blocks"
        status: pass
    human_judgment: true
    rationale: "Prose quality (tone, section order, whether the claim-check method reads well) is a judgment call the verifier should sanity-check by reading the file, even though every factual claim already passes an automated grep."

duration: 6min
completed: 2026-09-05
status: complete
---

# Phase 8 Plan 1: Settings-GET category-seed fix and docs/theming.md tracer Summary

Fixed the category-filtered settings GET seed/re-select leak (WINDOWS #3) with a TDD regression
test, then created `docs/theming.md`'s admin-first switching section and full 23-token contract
table — proving the phase's grep-based claim-check method on real content before eight more
sections get written on top of it.

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-05T15:49:35Z
- **Completed:** 2026-09-05T15:55:54Z
- **Tasks:** 2 completed
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- Closed WINDOWS #3: a category-filtered `GET /api/admin/settings` on a category with no defaults (e.g. `appearance`) now returns an empty list instead of attempting a full-table re-seed that could throw on the `key` primary key.
- Scoped the post-seed re-select to the requested category, closing a second, related leak where a filtered request could receive every other category's rows.
- Created `docs/theming.md` with its two hardest-to-get-right parts: a reader-first admin switching section and the complete, footnoted 23-token contract table, every value grep-traceable to its source.
- Proved the "verify every claim by grep against the source file" method end to end on real content (23 token names, 4 non-cascade consumer names, the admin route, the absence of the dev-bypass literal, and a table-row-width check) — ready for plan 08-02 to reuse on the remaining eight sections.

## Task Commits

Each task was committed atomically (Task 1 followed the RED→GREEN TDD cycle):

1. **Task 1 (RED): add failing regression test** - `babfeb0` (test)
2. **Task 1 (GREEN): scope the seed/re-select to the requested category** - `bb0ea56` (feat)
3. **Task 2: create docs/theming.md** - `3e20550` (docs)

**Plan metadata:** commit to follow (docs: complete plan)

## Files Created/Modified
- `app/api/admin/settings/route.ts` - GET handler's seed branch now computes a category-scoped seed set and skips the insert entirely when it's empty; the re-select is scoped to match. Permission gate and response shapes unchanged.
- `tests/unit/app/api/admin-settings-empty-category.test.ts` - 6 cases covering the empty-category no-insert path, the scoped-seed path (assertions derived from the imported `defaultSettings` array, not a hardcoded count), the unfiltered full-seed path, the already-seeded-category read path, the 403-before-database gate, and the scoped re-select.
- `docs/theming.md` - New file: H1, status line, the admin-first "Switching themes and layouts in the admin" section, and the full 23-token contract table with inverse-set and non-cascade-consumer footnotes. 81 lines.

## Decisions Made
- Seed-set-then-guard: compute the category-scoped (or whole) seed set first, and only call `insert()` when it has at least one row, rather than relying on Drizzle's untested `insert().values([])` behavior.
- Scoped the re-select alongside the seed guard as part of the same fix, since an unscoped re-select after a scoped insert would still leak other categories' rows to the caller.
- `docs/theming.md`'s status line is descriptive of its actual multi-plan-in-progress state rather than a placeholder value, since this file is appended to by three more plans before the phase closes.

## Deviations from Plan

None - plan executed exactly as written. The tracer feedback gate (task-level, per Task 1 being `type="tracer"`) was evaluated per protocol: Task 1's `<verify>` carries only `<automated>` checks and `HUMAN_VERIFY_MODE` is the default `end-of-phase`, so both automated verify blocks were re-run end-to-end (vitest + grep + permission-gate hash + typecheck + lint, then the full `npm test` suite) and passed — expansion into Task 2 proceeded without a checkpoint.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Requirements Note

`DOCS-01` and `DOCS-03` are both declared by sibling plans in this phase (08-02/08-03/08-04/08-05)
that have not yet produced a SUMMARY. Per the shared-ID gate, neither requirement is marked
complete by this plan — `requirements.ready-ids` returned 0/2 ready. They will flip to `Complete`
automatically once every plan declaring them has finished.

## Next Phase Readiness

Ready for plan 08-02, which appends sections 2 through 9 to `docs/theming.md` using the same
grep-verified claim-check method proven here. No blockers.

---
*Phase: 08-documentation-visual-qa-close-out*
*Completed: 2026-09-05*

## Self-Check: PASSED

- `tests/unit/app/api/admin-settings-empty-category.test.ts` — FOUND
- `docs/theming.md` — FOUND
- `app/api/admin/settings/route.ts` — FOUND
- `.planning/phases/08-documentation-visual-qa-close-out/08-01-SUMMARY.md` — FOUND
- Commit `babfeb0` (test) — FOUND in git log
- Commit `bb0ea56` (feat) — FOUND in git log
- Commit `3e20550` (docs) — FOUND in git log
- All 6 cases in the regression test pass; `npm run typecheck` and `npm run lint` exit 0; full `npm test` suite (2136 tests) passes with no regressions
- Permission-gate byte-range hash (lines 25-34) matches pre-fix HEAD
