---
phase: 18-tech-debt-closure
plan: 06
subsystem: infra
tags: [migrations, ci-gate, d1, docs]

# Dependency graph
requires: []
provides:
  - "findDuplicateNumbers pure collision-detection rule in scripts/lib/migration-safety.mjs"
  - "check:migrations gate refuses a new migration reusing a number an existing migration already uses"
  - "docs/database-migrations.md records the 0023 duplicate-number collision and the never-rename rule"
affects: [migrations, ci, database-migrations-docs]

# Actuals (#2632)
actuals:
  tokens: 2511
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Collision detection compares an added migration file's number against the FULL migrations/ directory listing, not just the added set, but only fires when at least one side of the collision is newly added — a rule shape that lets an already-applied duplicate (0023) stay permanently silent while a new one is still caught."

key-files:
  created: []
  modified:
    - scripts/lib/migration-safety.mjs
    - scripts/check-migration-safety.mjs
    - tests/unit/scripts/migration-safety.test.ts
    - docs/database-migrations.md

key-decisions:
  - "findDuplicateNumbers compares basenames (not full paths) so a migrations/ path prefix never causes a false self-collision, and treats an unmatched filename (no leading digits+underscore) as having no number rather than throwing."
  - "The CLI wrapper (scripts/check-migration-safety.mjs) does the only filesystem read (readdirSync on migrations/); the shared module stays side-effect free and unit-testable without shelling out, per the plan's D-16 pattern."
  - "Both failure modes (unacknowledged contraction, reused number) are printed in full before the process exits, and the exit code is their union — a change can trip either or both."

patterns-established:
  - "Pattern: pure collision/classification rules live in scripts/lib/*.mjs with no fs/process access; the executable script in scripts/*.mjs does all I/O and calls the pure function."

requirements-completed: [DEBT-07]

coverage:
  - id: D1
    description: "Pure findDuplicateNumbers rule: fires when an added migration file's number collides with any other file (added or pre-existing), stays silent on a collision between two pre-existing files only"
    requirement: DEBT-07
    verification:
      - kind: unit
        ref: "tests/unit/scripts/migration-safety.test.ts#findDuplicateNumbers"
        status: pass
    human_judgment: false
  - id: D2
    description: "check:migrations CLI gate reads the full migrations/ directory, calls findDuplicateNumbers, prints a BLOCKED line per collision, and unions its exit code with the existing contraction check"
    requirement: DEBT-07
    verification:
      - kind: unit
        ref: "tests/unit/scripts/migration-safety.test.ts#findDuplicateNumbers"
        status: pass
      - kind: other
        ref: "npm run check:migrations -- --base origin/main"
        status: pass
    human_judgment: true
    rationale: "This branch adds no migration, so the command above only exercises the early-exit path (no migrations added). The collision-reporting branch inside the CLI wrapper — the readdirSync call, the BLOCKED-line formatting, and the union exit code — is proven only indirectly, through the underlying pure function's unit tests, not by an end-to-end CLI run against a real synthetic collision. A human should confirm the wrapper's output formatting and exit behavior by inspection (or a scratch trial with a temporary duplicate-numbered file) before the next PR relies on it."
  - id: D3
    description: "docs/database-migrations.md gets a new section naming both 0023 filenames, the deterministic apply order, the never-rename rule, and the new gate behavior"
    requirement: DEBT-07
    verification:
      - kind: other
        ref: "npm run docs:lint"
        status: pass
    human_judgment: false

duration: ~20 min
completed: 2026-09-11
status: complete
---

# Phase 18 Plan 06: Migration Number Collision Detection Summary

**A pure `findDuplicateNumbers` rule closes DEBT-07's code half — `check:migrations` now refuses a new migration that reuses an existing number, while the already-applied `0023` pair (both filenames, both in production) stays permanently exempt, and `docs/database-migrations.md` records why neither file is ever renamed.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-11T11:48Z
- **Tasks:** 3/3
- **Files modified:** 4

## Accomplishments
- `findDuplicateNumbers(addedFiles, allFiles)` added to `scripts/lib/migration-safety.mjs`: a pure, side-effect-free rule that reports a collision only when at least one side is a newly added file — never for two pre-existing files sharing a number.
- `scripts/check-migration-safety.mjs` now reads the full `migrations/` directory (not just the added-file diff) and refuses a pull request whose added migration reuses an existing number, printing a `[migration-safety] BLOCKED` line naming the added file, the number, and the colliding filename(s). This runs alongside the existing contraction check; both failure modes print, and the exit code is their union.
- `docs/database-migrations.md` gained a new `## Two migrations share the number 0023` section: names both `0023` filenames, states apply order is deterministic by filename (so nothing is broken today), states the never-rename rule, and notes the new gate behavior.
- 6 new test cases (16 total in the file) cover: new-vs-existing collision, two-new-files colliding with each other, a unique number producing no report, a pre-existing-only pair producing no report, a malformed filename being ignored rather than throwing, and a regression guard built from this repository's real `0023` filenames plus an unrelated added migration, asserting zero reports.

## Task Commits

Each task was committed atomically:

1. **Task 1: A pure collision rule that fires on a new reuse and stays silent on the applied pair** - `ef99515` (feat)
2. **Task 2: The check:migrations gate reads the whole directory and refuses a reused number** - `49dc347` (feat)
3. **Task 3: The migrations doc records the collision and the never-rename rule** - `23f1957` (docs)

_Note: SUMMARY commit follows this file's write, per the parallel-executor protocol (STATE.md/ROADMAP.md are not touched — orchestrator owns those)._

## Files Created/Modified
- `scripts/lib/migration-safety.mjs` - Added `findDuplicateNumbers`, `migrationNumber`, and `basename` helpers beside the existing `inspectMigration`/`summarize` pure functions.
- `scripts/check-migration-safety.mjs` - Reads `migrations/` via `readdirSync`, calls `findDuplicateNumbers`, reports collisions, unions the exit code with the existing contraction check.
- `tests/unit/scripts/migration-safety.test.ts` - New `describe("findDuplicateNumbers", ...)` block, 6 cases.
- `docs/database-migrations.md` - New `## Two migrations share the number 0023` section after the `0024` section; header block and `**Status:**` line unchanged.

## Decisions Made
- Compared filenames (basenames), not full paths, so a `migrations/` prefix present in one argument but not the other can never register as a false self-collision — matches the interface contract's explicit requirement.
- Kept the CLI wrapper as the only place doing filesystem I/O (per D-16 / the plan's `<action>` instructions); the shared module gained no new imports.
- Printed both failure modes (contraction, collision) unconditionally before computing the exit code, rather than short-circuiting on the first one found, so a PR with both problems sees both in one CI run.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. This branch adds no migration file, so `npm run check:migrations -- --base origin/main` only exercises the pre-existing early-exit path — exactly as the plan's `<output>` section anticipated. The new collision-reporting branch is proven by the unit tests (which construct synthetic added/existing file sets directly) rather than by an end-to-end run of the CLI script itself; flagged above as `D2`'s `human_judgment: true` rationale for the verifier.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `.planning/todos/pending/migration-0023-duplicate-number.md` is ready to be closed by the phase gate plan, which owns every planning-document change (per this plan's `<output>` instruction — not touched here).
- No migration file was added or renamed by this plan; `migrations/` is untouched.
- No blockers for the rest of phase 18-tech-debt-closure.

---
*Phase: 18-tech-debt-closure*
*Completed: 2026-09-11*

## Self-Check: PASSED

- `scripts/lib/migration-safety.mjs` - FOUND
- `scripts/check-migration-safety.mjs` - FOUND
- `tests/unit/scripts/migration-safety.test.ts` - FOUND
- `docs/database-migrations.md` - FOUND
- Commits `ef99515`, `49dc347`, `23f1957` - FOUND in `git log --oneline --all --grep="18-06"`
