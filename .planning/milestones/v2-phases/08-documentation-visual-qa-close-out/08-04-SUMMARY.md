---
phase: 08-documentation-visual-qa-close-out
plan: 04
subsystem: testing
tags: [visual-qa, theming, layout-variants, judgement, screenshot-review]

requires:
  - phase: 08-03
    provides: "08-QA-MATRIX.md's 21 label subsections and 21-row coverage grid (672 rows), the evidence this plan judges"
  - phase: 08-02
    provides: "docs/theming.md sections 0-9, including the gates/screenshot-harness section this plan appends a subsection under"
provides:
  - "08-QA-MATRIX.md's Judgement Design, 46-row findings table, Visual QA Summary (7x3), and close-out rollup"
  - "docs/theming.md's copied QA summary subsection, linking the QA record as full evidence"
  - "WINDOWS #3 (settings-GET empty-category bug) marked fixed via gsd-tools windows fixed, citing plan 08-01"
affects: ["08-05 (codebase-docs refresh and phase close-out, reads this plan's close-out rollup for still-open items)"]

actuals:
  tokens: 9700
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Judgement-by-factorisation: combination-dependent criteria (overflow, anatomy) judged once across all three packed layouts at one reference preset; preset-dependent criteria (legibility, scrim, display face) judged once across all seven presets at one reference combination; one named cross-term (light presets under the full-bleed hero) checked separately — an explicit, stated planner assumption rather than an exhaustive 21-run re-inspection"

key-files:
  created: []
  modified:
    - .planning/phases/08-documentation-visual-qa-close-out/08-QA-MATRIX.md
    - docs/theming.md
    - .planning/WINDOWS.md

key-decisions:
  - "Combination-axis criteria (overflow/clipping, anatomy match) were judged once at volt-dark across all three packed combinations, not once per preset, because no layout-variant component reads a theme token to decide its own geometry — re-judging the identical DOM/CSS output under a second preset would not be a new fact. Stated explicitly as a planner assumption in the Judgement Design, not silently assumed."
  - "Preset-axis criteria (legibility, scrim darkness, display face) were judged once at combination A across all seven presets, plus a targeted cross-check of the four light presets under combination C's full-bleed hero — the one cell where the two axes genuinely interact (a literal, non-token scrim over a light preset's own surface)."
  - "A screen-reader/accessibility-tree pass over the rendered cells is explicitly recorded as inherited-and-open, not silently decided either way — matching the identical gap Phase 6 and Phase 6.1 both flagged and deferred."
  - "The settings-GET empty-category bug (WINDOWS #3), already fixed at plan 08-01, is marked fixed in the ledger via `gsd-tools windows fixed 3` as part of this plan's close-out rollup, rather than left for a later plan to notice."
  - "Zero defects were found across all 46 findings rows; nothing required a fix, so no candidate for a token/theme-file/variant-enum change ever arose to flag as unresolved-for-a-future-milestone."

patterns-established:
  - "Visual QA summary tables are copied verbatim between the phase's own evidence record and the published doc, with the copy carrying an added linking sentence back to the source rather than a re-derivation — 'copy it, don't rewrite it, because two versions of the same table drift.'"

requirements-completed: [DOCS-02]

coverage:
  - id: D1
    description: "The judgement design is stated in the record before any verdict, names all six D-04 criteria, states which task judges each and against which cells, labels the criteria factorisation an explicit planner assumption, and records the accessibility-tree question as inherited/open"
    requirement: "DOCS-02"
    verification:
      - kind: other
        ref: "grep for 'Judgement design' heading position (before first findings row), all-six-criteria mention, and the ⚠ inherited a11y phrasing — task 1's own <verify> block"
        status: pass
    human_judgment: false
  - id: D2
    description: "Criterion 1 (renders without error) proved mechanically across all 21 runs / 672 rows: 588/588 non-MISSING cells confirmed present with non-zero size, 84 MISSING rows each carrying a reason, zero error annotations"
    requirement: "DOCS-02"
    verification:
      - kind: other
        ref: "test -s over every unique captured path in 08-QA-MATRIX.md, cross-checked against 08-03-SUMMARY.md's own 588-captured/84-MISSING totals"
        status: pass
    human_judgment: false
  - id: D3
    description: "Combination-dependent criteria (overflow/clipping, anatomy match) judged across all three packed combinations at volt-dark: 13 cells inspected, all rendering correctly against their variant's documented anatomy with no overflow"
    requirement: "DOCS-02"
    verification:
      - kind: other
        ref: "13 findings rows (F2-F14) in 08-QA-MATRIX.md, each citing a real capture path and a source-file citation; task 1's own <verify> block asserts row count >= 13"
        status: pass
    human_judgment: true
    rationale: "Whether a rendered screenshot genuinely matches its variant's documented anatomy (column count, hero shape, gallery orientation) and shows no overflow is a visual judgement made by inspecting each PNG, not something a command asserts on its own — the verifier should spot-check a sample of the cited captures against the findings text."
  - id: D4
    description: "Preset-dependent criteria (legibility, scrim darkness, display face) judged across all seven presets at combination A, plus the four light-preset cross-check at combination C: 32 findings rows, all clean, zero defects"
    requirement: "DOCS-02"
    verification:
      - kind: other
        ref: "32 findings rows (F15-F46) in 08-QA-MATRIX.md, each citing a real capture path, a theme-file/component citation, and a specific visual observation; task 2's own <verify> block asserts all seven preset names present, all four light-preset cross-check labels present, and a cumulative row count >= 38"
        status: pass
    human_judgment: true
    rationale: "Contrast, scrim darkness, and display-face rendering are read from the actual pixels of each screenshot, not computed — the verifier should spot-check a sample against the cited captures, particularly the display-face rows (do the loaded webfonts genuinely look distinct from the fallback stack) and the scrim rows (does the backdrop genuinely read darker than resting)."
  - id: D5
    description: "A preset-by-combination summary table (7x3) exists in 08-QA-MATRIX.md above the findings table and is copied verbatim (same rows, same cell text) into docs/theming.md under the gates section, with a link back to the QA record as full evidence"
    requirement: "DOCS-02"
    verification:
      - kind: other
        ref: "diff of the table block between 08-QA-MATRIX.md and docs/theming.md (rows and by-design paragraph byte-identical); grep for all seven preset names and the QA-record filename link in docs/theming.md — task 3's own <verify> block"
        status: pass
    human_judgment: false
  - id: D6
    description: "The close-out rollup names the settings-GET item as closed by plan 08-01 and cites it; the broken-windows ledger shows that item fixed via the repository's own tooling (not a hand edit)"
    requirement: "DOCS-02"
    verification:
      - kind: other
        ref: "grep '^fixed_count: 2$' and '^| 3 |.*| fixed |' in .planning/WINDOWS.md, produced by `gsd-tools windows fixed 3` — task 3's own <verify> block"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every relative path newly cited in docs/theming.md resolves on disk; no theme file, contract token, or variant enum changed anywhere in this plan"
    requirement: "DOCS-02"
    verification:
      - kind: other
        ref: "backtick-quoted-path link-check over docs/theming.md (32 paths, 0 broken); token-count-per-theme-file (23 each) and variant-enum-membership greps over lib/layout/variants.ts — task 2/3's own <verify> blocks"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-05
status: complete
---

# Phase 8 Plan 4: Visual QA Judgement Pass Summary

**Judged all 21 harness runs against the six D-04 pass criteria via a stated combination/preset factorisation, found zero defects across 46 findings, and published the resulting 7x3 summary table into both the QA record and docs/theming.md.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-05T16:53Z (approx.)
- **Completed:** 2026-09-05T17:48Z (approx.)
- **Tasks:** 3 completed
- **Files modified:** 3 (`08-QA-MATRIX.md`, `docs/theming.md`, `.planning/WINDOWS.md`)

## Accomplishments

- Wrote the Judgement Design section into `08-QA-MATRIX.md` before any verdict: named all six
  D-04 criteria, stated which task judges each and against which cells, and labelled the
  combination/preset factorisation an explicit planner assumption rather than a proven property.
  Recorded the screen-reader/accessibility-tree question as inherited and open, matching Phase 6
  and Phase 6.1's own identical, deferred flag.
- Ran the mechanical pass for criterion 1 (renders without error) across all 21 runs / 672 rows:
  588/588 non-`MISSING` cells confirmed present on disk with non-zero size, 84 `MISSING` rows each
  carrying their own reason, zero error annotations — matching `08-03-SUMMARY.md`'s measured
  totals exactly.
- Judged the two combination-dependent criteria (overflow/clipping, layout-anatomy match) across
  all three packed layout combinations at `volt-dark` — 13 real cells inspected by viewing the
  actual PNGs, all rendering correctly against their variant's documented anatomy, no overflow at
  either viewport.
- Judged the three preset-dependent criteria (legibility, scrim darkness, display-face rendering)
  across all seven presets at combination A, plus a targeted cross-check of the four light presets
  under combination C's full-bleed hero (the one cell where the two axes genuinely interact) — 32
  more findings, every one clean.
- Zero defects found across 46 findings rows; nothing needed fixing, so no code, theme file,
  contract token, or variant enum was ever touched.
- Published the 7x3 preset-by-combination summary table above the findings table in
  `08-QA-MATRIX.md`, then copied it verbatim into `docs/theming.md` as a new subsection under the
  gates/screenshot-harness section, linked back to the QA record as full evidence.
- Closed the close-out rollup: marked the settings-GET empty-category bug (WINDOWS #3, already
  fixed at plan 08-01) fixed in the ledger via `gsd-tools windows fixed 3`; carried WINDOWS #2 and
  #4 forward unchanged; restated the four Phase 5 screenshot-coverage gaps, the inherited a11y
  question, the untested long-product-name overflow risk, and the fixture's broken product image
  as still-open items with where to pick each one up.

## Task Commits

Each task was committed atomically:

1. **Task 1: State the judgement design, then judge the combination-dependent criteria across A, B and C** - `a63506c` (docs)
2. **Task 2: Judge the preset-dependent criteria across all seven presets, plus the light-preset cross-check** - `28be5ef` (docs)
3. **Task 3: Publish the preset-by-combination summary and close the QA record** - `fc5a3d7` (docs)

**Plan metadata:** committed separately after this SUMMARY.

## Files Created/Modified

- `.planning/phases/08-documentation-visual-qa-close-out/08-QA-MATRIX.md` - gained the Judgement
  Design section, a 46-row findings table (F1-F46), the Visual QA Summary (7x3 table), and the
  close-out rollup.
- `docs/theming.md` - gained a new "Phase 8 visual QA summary" subsection under "The two gates and
  the screenshot harness", copying the summary table verbatim and linking the QA record.
- `.planning/WINDOWS.md` - item 3 (settings-GET empty-category bug) marked `fixed`, via
  `gsd-tools windows fixed 3`, citing plan 08-01 as the closing plan.

## Decisions Made

- Combination-axis criteria (overflow/clipping, anatomy match) judged once at `volt-dark` across
  all three packed combinations, not re-judged per preset — no layout-variant component reads a
  theme token to decide its own geometry, so a second preset's identical DOM/CSS output would not
  be a new fact. Recorded as an explicit planner assumption, not a silent shortcut.
- Preset-axis criteria (legibility, scrim, display face) judged once at combination A across all
  seven presets, plus the light-preset cross-check at combination C — the one cell where the two
  axes genuinely interact.
- The accessibility-tree/screen-reader question is recorded as inherited and open, not silently
  closed either way, matching Phase 6/6.1's own precedent.
- WINDOWS #3 marked fixed via the repository's own tooling (`gsd-tools windows fixed 3`) rather
  than a hand edit to the ledger file, per the plan's explicit instruction.

## Deviations from Plan

None - plan executed exactly as written. No code was touched (zero defects found across all 46
findings), so no deviation-rule fix was ever triggered.

## Issues Encountered

None. All screenshots needed for judgement were already captured by plan 08-03 and present on
disk; no dev server was started or restarted during this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `08-QA-MATRIX.md` is complete: judgement design, 46-row findings table, 7x3 summary table, and
  close-out rollup all present, with every verdict citing the capture path it was judged from.
- `docs/theming.md` now carries the QA summary as a linked subsection; the theming document's
  claim/link check was re-run and passes (32/32 paths resolve).
- DOCS-02 is now ready to mark complete (`requirements ready-ids` reports 1/1 ready) — the
  evidence half (plan 08-03) and the judgement half (this plan) are both done.
- WINDOWS #3 is closed. WINDOWS #2 and #4 remain open, carried forward with their own
  where-to-pick-up notes in the close-out rollup, for whoever next has the missing environment
  (a real Clerk session, or a future capture to re-check S-07-01 against).
- Plan 08-05 (codebase-docs refresh and phase close-out) can now read this plan's close-out
  rollup directly for the still-open items it needs to fold into `.planning/STATE.md` and the
  milestone close-out record.

---
*Phase: 08-documentation-visual-qa-close-out*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: `.planning/phases/08-documentation-visual-qa-close-out/08-QA-MATRIX.md`
- FOUND: `docs/theming.md`
- FOUND: `.planning/WINDOWS.md`
- FOUND commit: `a63506c` (task 1)
- FOUND commit: `28be5ef` (task 2)
- FOUND commit: `fc5a3d7` (task 3)
- Re-ran plan-level verification: Judgement Design section precedes the first findings row (F1);
  50 "Leave it"/"Fixed" line matches in `08-QA-MATRIX.md` (46 genuine findings rows plus 4 prose
  mentions of the two literals); all seven preset names present in `docs/theming.md`'s copied
  summary; all four light-preset cross-check labels (`phase-08-c-luxe/clinical/atelier/market`)
  present in `08-QA-MATRIX.md`; `scan:tokens` reports 0 violations; `build-themes --check` reports
  fresh; `.planning/WINDOWS.md` `fixed_count: 2` with row 3 marked `fixed`; no file under
  `themes/`, `lib/layout/variants.ts`, `app/`, or `components/` touched since the phase's prior
  commit (`574015b`).
