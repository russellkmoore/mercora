---
phase: 08-documentation-visual-qa-close-out
plan: 05
subsystem: docs
tags: [codebase-docs, theming, close-out, requirements, gate-suite]

requires:
  - phase: 08-01
    provides: "docs/theming.md's tracer sections and the settings-GET fix, both read to keep the codebase docs and known-limits record consistent with the finished document"
  - phase: 08-04
    provides: "08-QA-MATRIX.md's judgement design, 46-row findings table and close-out rollup — the zero-defect result this plan carries into docs/theming.md's known-limits section"
provides:
  - "Targeted theme/layout additions to ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md — a future planner reading .planning/codebase/ now learns the theming system exists"
  - "docs/theming.md's known-limits section confirmed complete (all six close-out items) plus an explicit zero-unresolved-QA-findings statement"
  - ".planning/STATE.md's Blockers/Concerns gained a Phase 8 carry-over group; the settings-GET bug (WINDOWS #3) marked closed in STATE.md's own record"
  - "DOCS-01, DOCS-02, DOCS-03 all Complete — the milestone's three requirements are fully marked, DOCS-03 via gsd-tools requirements mark-complete"
  - "A green full gate suite (lint, typecheck, scan:tokens 0/2, build:themes:check fresh, 260 files/2136 tests, production build) recorded with real numbers, closing v2 Themeable Storefront"
affects: []

actuals:
  tokens: 6400
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Codebase-doc refresh by splice, not regeneration: every addition to ARCHITECTURE.md/STRUCTURE.md/CONVENTIONS.md/TESTING.md lands in a named existing section (or one new section appended at the end), with a verify step asserting the three out-of-scope docs are untouched and capping deleted-line count on the largest edit."
    - "Milestone close-out record duplicated across two locations by design (docs/theming.md known-limits + STATE.md Blockers/Concerns), each pointing at the other and at the underlying ledger (WINDOWS.md) or backlog note, so no carry-over is readable from only one file."

key-files:
  created: []
  modified:
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/STRUCTURE.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/TESTING.md
    - docs/theming.md
    - .planning/STATE.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The four codebase documents' theme/layout coverage was genuinely absent, not stale — Task 1/2 additions are pure splices into named sections (layers, abstractions, component responsibilities, directory tree/purposes/key files/where-to-add, constants-and-configuration, test-file-organization), with only the testing document's unit-test count line an actual correction (233/1701 -> 260/2136, measured this session via `npm test`, not carried forward)."
  - "STACK.md, INTEGRATIONS.md, CONCERNS.md were read and grepped for theme-adjacent claims (found only unrelated `@clerk/themes` mentions) and left untouched — no false claim existed to justify an edit, matching D-06's scope sentence and the plan's own out-of-scope verify check."
  - "docs/theming.md's known-limits table already carried all six close-out items from plans 08-02/08-04; this plan's only addition was one explicit sentence stating the Phase 8 QA pass (46/46 findings clean) has no unresolved item to add — an absent statement would have read as an omission, not confirmation."
  - "STATE.md's Phase 8 carry-over group repeats the same six items already tracked (WINDOWS.md, todos/pending/*) rather than only linking to them, per D-08's instruction that both docs/theming.md and STATE.md carry the record; the one status change made to an existing line (not a new bullet) is the Phase 6 settings-GET entry, now annotated closed at 08-01."
  - "DOCS-01 and DOCS-02 were already Complete (marked by 08-02/08-04); this plan only needed `requirements ready-ids` + `mark-complete` for DOCS-03, since it is the only requirement this plan's frontmatter declares."

patterns-established: []

requirements-completed: [DOCS-03]

coverage:
  - id: D1
    description: "ARCHITECTURE.md and STRUCTURE.md name the theme/layout resolvers, the three-tier fallback, the data-theme attribute, the token contract and layout-variant abstractions, and every new directory/component/script — all pointing at docs/theming.md rather than restating it"
    requirement: "DOCS-03"
    verification:
      - kind: other
        ref: "Task 1's own <verify> — grep loop over both files for getActiveTheme/getLayoutSettings/data-theme/docs/theming.md and the nine structure-doc strings (themes/, lib/themes/, lib/layout/, components/layout/, ThemePresetGrid.tsx, LayoutSwitches.tsx, build-themes.mjs, scan-hardcoded-colors.mjs, screenshot-routes.mjs)"
        status: pass
      - kind: other
        ref: "Task 1's second <verify> — STACK.md/INTEGRATIONS.md/CONCERNS.md untouched (git diff empty) and ARCHITECTURE.md's deleted-line count 0 (< 40 threshold)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CONVENTIONS.md states the token-class rule (storefront classes, admin path exclusion, scanner sentinel pair, manual-review registry); TESTING.md names both gates honestly (manifest-check runs in CI, scanner does not), describes the screenshot harness, and carries a measured unit-test count (260 files / 2136 tests, replacing the stale 233/1701)"
    requirement: "DOCS-03"
    verification:
      - kind: other
        ref: "Task 2's own <verify> — grep loop for scan:tokens/scan-hardcoded-colors/docs/theming.md in CONVENTIONS.md and build:themes:check/scan:tokens/screenshot:routes in TESTING.md, plus a negative grep confirming the stale count string is gone"
        status: pass
      - kind: unit
        ref: "mise exec -- npm test — 260 files / 2136 tests passed, the exact figure now recorded in TESTING.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/theming.md's known-limits section carries all six close-out items D-08 names, plus an explicit sentence that the Phase 8 QA pass found zero unresolved findings"
    requirement: "DOCS-03"
    verification:
      - kind: other
        ref: "Task 3's own <verify> — grep for NEXT_PUBLIC_THEME_DEFAULT, both backlog note filenames, and scan:tokens in docs/theming.md; test -f on both cited backlog notes"
        status: pass
    human_judgment: true
    rationale: "Whether the known-limits table (already written by 08-02/08-04) is genuinely complete and whether the added sentence reads as confirmation rather than an afterthought is a prose-quality judgment the verifier should sanity-check by reading the section."
  - id: D4
    description: "STATE.md's Blockers/Concerns carries the same six items grouped as Carried out of Phase 8, with the settings-GET item's existing Phase 6 line annotated closed at 08-01 (one status change, no deletions)"
    requirement: "DOCS-03"
    verification:
      - kind: other
        ref: "Task 3's own <verify> — grep for NEXT_PUBLIC_THEME_DEFAULT and 'Phase 8' in STATE.md"
        status: pass
    human_judgment: false
  - id: D5
    description: "DOCS-03 (and, transitively, all three phase requirements DOCS-01/02/03) marked Complete via gsd-tools requirements ready-ids + mark-complete, never by hand-editing REQUIREMENTS.md"
    requirement: "DOCS-03"
    verification:
      - kind: other
        ref: "gsd-tools requirements ready-ids reported 1/1 ready; gsd-tools requirements mark-complete DOCS-03 returned marked_complete: [\"DOCS-03\"], write_set_complete: true; REQUIREMENTS.md's checkbox and traceability rows both flipped"
        status: pass
    human_judgment: false
  - id: D6
    description: "The whole gate suite is green in one pass: linter, typechecker, token scanner at 0 violations with 2 manual-review rows, theme-manifest freshness, full test suite, and a real production build"
    requirement: "DOCS-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run lint (0 errors, 52 pre-existing warnings), npm run typecheck (clean), npm run scan:tokens (0 violations, 2 MANUAL-REVIEW rows), npm run build:themes:check ('fresh' for 7 themes), npm test (260 files / 2136 tests passed), npm run build (completed, all routes emitted) — all run this session, in Task 3"
        status: pass
    human_judgment: false
  - id: D7
    description: "No theme file, layout variant component, contract token, or variant enum changed anywhere in this plan"
    requirement: "DOCS-03"
    verification:
      - kind: other
        ref: "Task 3's own <verify> — token-count-per-theme-file (23 each, all seven files) and variant-enum-membership greps over lib/layout/variants.ts, both clean; git diff --name-only across the whole phase touches no file under themes/, lib/layout/variants.ts, app/, or components/"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-05
status: complete
---

# Phase 8 Plan 5: Codebase-Docs Refresh and Milestone Close-out Summary

Spliced theme/layout coverage into all four mapped codebase documents (the theming system had zero
prior mentions there), confirmed the milestone's close-out record is complete in both places D-08
names, marked the last requirement ready through the repository's own tooling, and closed v2
Themeable Storefront on a fully green gate suite measured in this session.

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-05T17:52Z (approx.)
- **Completed:** 2026-09-05T18:37Z (approx.)
- **Tasks:** 3 completed
- **Files modified:** 7 (`.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`,
  `TESTING.md`, `docs/theming.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`)

## Accomplishments

- **ARCHITECTURE.md**: added a Theme & Layout Resolution layer entry (both resolver modules, the
  three-tier fallback, the `data-theme` attribute, the four non-cascade consumers, never cached),
  a Token Contract and a Layout Variants abstraction, and two Component Responsibilities rows for
  the admin appearance surface and the storefront variant components — every addition pointing at
  `docs/theming.md` rather than restating its tables.
- **STRUCTURE.md**: added the root `themes/` directory, `lib/themes/`, `lib/layout/`,
  `components/layout/`, the two admin appearance components, and the three theme/QA scripts to the
  directory tree, the directory-purposes section, the key-file-locations section, and a new
  five-step "New Theme" recipe in "Where to Add New Code" that points at `docs/theming.md` for the
  full version.
- **CONVENTIONS.md**: added a Styling and Colour Tokens section stating the token-class rule as a
  rule — storefront classes only, admin excluded by path (a decision, not an oversight), a
  polarity-neutral literal gets the scanner's `gsd:scan-ignore-start`/`-end` sentinel pair with a
  written reason, and a whole-file exception only through the scanner's named manual-review
  registry.
- **TESTING.md**: added a Theme and Layout Gates section stating plainly which of the two gates
  runs in CI (`build:themes:check`) and which does not (`scan:tokens`, a local convention), and
  described the screenshot harness as a manual, gitignored capture tool. Corrected the stale unit
  test count (`233 files / 1701 tests`, carried forward since before this milestone) to the real
  number measured by running `npm test` this session: `260 files / 2136 tests`.
- Verified `docs/theming.md`'s known-limits section already carried all six close-out items from
  plans 08-02/08-04 (Workers Build variable, admin walkthrough, deferred direction-doc properties
  with both backlog notes, the two image-URL resolvers, the self-writing parity snapshots, and
  `scan:tokens` not wired into CI) and added one explicit sentence: the Phase 8 QA pass found zero
  unresolved findings, so there is nothing new to add from that source.
- Added a "Carried out of Phase 8" group to `.planning/STATE.md`'s Blockers/Concerns with the same
  six items, and made the plan's one permitted status change: annotated the existing Phase 6
  settings-GET line as closed at plan 08-01, without deleting any earlier phase's carried item.
- Marked `DOCS-03` complete via `gsd-tools requirements ready-ids` (1/1 ready) then
  `requirements mark-complete DOCS-03` — no hand-edit to `REQUIREMENTS.md`. `DOCS-01` and `DOCS-02`
  were already `Complete` from plans 08-02 and 08-04; all three of the phase's requirements are now
  `Complete`.
- Ran the full gate suite in one pass and recorded the real numbers: `npm run lint` (0 errors, 52
  pre-existing warnings), `npm run typecheck` (clean), `npm run scan:tokens` (0 violations, 2
  `MANUAL-REVIEW` rows), `npm run build:themes:check` (fresh for all 7 themes), `npm test` (260
  files / 2136 tests, all passing), `npm run build` (completed, every route emitted). No theme
  file, contract token, layout component, or variant enum was touched anywhere in this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Architecture + structure doc additions** - `692e527` (docs)
2. **Task 2: Conventions + testing doc additions** - `8eacb20` (docs)
3. **Task 3: Known limits, state, requirements, gate suite** - `6dbbb5b` (docs)

**Plan metadata:** committed separately after this SUMMARY.

## Files Created/Modified

- `.planning/codebase/ARCHITECTURE.md` - Theme & Layout Resolution layer, Token Contract and
  Layout Variants abstractions, two new Component Responsibilities rows. Splice only — 0 deleted
  lines.
- `.planning/codebase/STRUCTURE.md` - Root `themes/` directory, `lib/themes/`, `lib/layout/`,
  `components/layout/`, two admin components, three scripts, added across the tree, purposes,
  key-file-locations and where-to-add-new-code sections.
- `.planning/codebase/CONVENTIONS.md` - New Styling and Colour Tokens section (token-class rule,
  admin exclusion, sentinel pair, manual-review registry).
- `.planning/codebase/TESTING.md` - New Theme and Layout Gates section; unit-test count corrected
  to a number measured this session.
- `docs/theming.md` - One sentence added to the already-complete known-limits section, confirming
  zero unresolved QA findings.
- `.planning/STATE.md` - New Phase 8 blockers/concerns carry-over group; one existing line (Phase 6
  settings-GET item) annotated closed.
- `.planning/REQUIREMENTS.md` - `DOCS-03` flipped to `Complete` via tooling (checkbox +
  traceability table row).

## Decisions Made

- The four codebase documents' theme/layout material was genuinely absent (a gap, not staleness);
  every addition is a splice into a named existing section, with only the testing document's
  unit-test count an actual correction of stale content.
- `STACK.md`, `INTEGRATIONS.md`, `CONCERNS.md` were read and grepped for theme-adjacent claims
  (only unrelated `@clerk/themes` mentions found) and left untouched — no false claim existed to
  justify editing them, per D-06's scope sentence.
- `docs/theming.md`'s known-limits table needed no new row, only an explicit statement that the QA
  pass added nothing — an absent statement would have read as an omission rather than a result.
- `STATE.md`'s Phase 8 group repeats the same six items rather than only cross-referencing them,
  per D-08's instruction that both `docs/theming.md` and `STATE.md` carry the record; the one
  status change is an annotation on the existing Phase 6 line, not a new bullet or a deletion.

## Deviations from Plan

None - plan executed exactly as written. Every acceptance criterion and every `<verify>` block
passed on the first attempt; no Rule 1-3 auto-fix, no Rule 4 architectural question, no auth gate.

## Issues Encountered

None. The production build, full test suite, token scanner, and theme-manifest check were all run
fresh in this session rather than assumed from an earlier plan's numbers.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

This is the last plan of the last phase of milestone v2 Themeable Storefront. All three phase
requirements (`DOCS-01`, `DOCS-02`, `DOCS-03`) are `Complete`. The full gate suite is green with
numbers measured in this session, not carried forward. `.planning/WINDOWS.md` has 2 open items
(#2 admin walkthrough, #4 the sub-pixel screenshot variance), both already carried forward with
their own where-to-pick-up notes in `docs/theming.md`'s known-limits section and `STATE.md`'s
Blockers/Concerns — neither blocks milestone close. Suggested next step:
`/gsd-complete-milestone`.

---
*Phase: 08-documentation-visual-qa-close-out*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`
- FOUND: `docs/theming.md`, `.planning/STATE.md`
- FOUND: `.planning/phases/08-documentation-visual-qa-close-out/08-05-SUMMARY.md`
- FOUND commits: `692e527` (Task 1), `8eacb20` (Task 2), `6dbbb5b` (Task 3), `c5e3078` (plan metadata)
- Re-ran all Task 1-3 `<verify>` blocks: architecture/structure string checks pass; out-of-scope
  docs (STACK/INTEGRATIONS/CONCERNS) untouched; architecture deleted-line count 0 (< 40); testing
  stale-count string gone, measured count `260 files / 2136 tests` present; known-limits and STATE
  string checks pass; both cited backlog notes exist; per-theme token count 23 for all seven theme
  files; layout enum members unchanged.
- Re-ran the plan-level gate suite: `npm run lint` (0 errors), `npm run typecheck` (clean),
  `npm run scan:tokens` (0 violations, 2 `MANUAL-REVIEW` rows), `npm run build:themes:check`
  (fresh for 7 themes), `npm test` (260 files / 2136 tests passing), `npm run build` (succeeded,
  all routes emitted).
- `DOCS-01`, `DOCS-02`, `DOCS-03` all `Complete` in `.planning/REQUIREMENTS.md`.
- Working tree clean of unintended changes: only the pre-existing, pre-session
  `docs/voltique-theme-direction.md` modification and pre-existing untracked files remain;
  nothing under `themes/`, `lib/layout/variants.ts`, `app/`, or `components/` was touched.
