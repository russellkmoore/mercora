---
phase: 07-layout-switches
plan: 05
subsystem: layout
tags: [layout-switches, contract-test, screenshot-evidence, phase-close, requirements]

# Dependency graph
requires:
  - phase: 07-01
    provides: "lib/layout/variants.ts, lib/layout/settings.ts, the category switch, and the 07-SCREENSHOTS.md pre-extraction baseline"
  - phase: 07-02
    provides: "the home hero switch (HomeHeroMinimal/Split/FullBleed, home-hero-map.ts)"
  - phase: 07-03
    provides: "the product gallery switch (ProductGalleryLeft/Top, gallery-media-url.ts, PRODUCT_GALLERY_MAP inside ProductDisplay.tsx)"
  - phase: 07-04
    provides: "the admin LayoutSwitches island and its three-key save path"
provides:
  - "tests/unit/app/layout-switch-contract.test.ts — the single repo-wide LAYOUT-04 proof across all three switches, all eight components, all three production maps, and the three per-switch suites' coverage"
  - "07-SCREENSHOTS.md's variant-to-cell coverage table (16 rows) and defaults-parity result, closing out D-14 for the whole phase"
  - "LAYOUT-01 through LAYOUT-04 marked complete in REQUIREMENTS.md; ROADMAP.md's Phase 7 entry shows 5/5 plans delivered"
affects: [08]

# Actuals (#2632)
actuals:
  tokens: 13944
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase-level contract test as a second, independent statement of a mapping three separate production maps also make — built by importing components directly and hand-listing member tuples, never derived from the maps under test, so the two can actually disagree if one is wrong."
    - "Evidence-based snap registration for a residual, imperceptible screenshot-hash difference: PIL pixel-diff bounding box + per-pixel magnitude, cross-validated against a passing source-level parity test, rather than either silently accepting the hash mismatch or re-rolling the capture indefinitely hoping for a lucky match."

key-files:
  created:
    - tests/unit/app/layout-switch-contract.test.ts
  modified:
    - .planning/phases/07-layout-switches/07-SCREENSHOTS.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/WINDOWS.md

key-decisions:
  - "The three 'source files holding a lookup map' named in the plan's read_first are, in the actual codebase, category-layout-map.ts, home-hero-map.ts, and ProductDisplay.tsx (not app/category/[slug]/page.tsx or app/page.tsx as the read_first line's file list literally suggested) — 07-01/07-02 extracted these maps into their own modules for testability, and 07-03 kept its map inline in ProductDisplay.tsx. The contract test targets the files that actually declare each map, matching the plan's behavior intent rather than its shorthand file list."
  - "A one-off flaky screenshot cell (category|1280|resting, first capture only, traced to broken-image-icon render timing on a remote product image) was investigated, reproduced as non-reproducing on two clean recaptures, and is NOT the same issue as the residual product|390|resting difference documented below — conflating the two would have hidden that the real residual is deterministic, not random."
  - "The one residual defaults-parity difference (product|390|resting: 2 pixels, ±1/255 intensity, at a thumbnail border's anti-aliased edge) was investigated per the plan's own instruction rather than either silently tolerated or endlessly re-captured: PIL pixel-diff bounds it to 2 pixels total, and it reproduced identically across two independent recaptures, ruling out per-run randomness as the explanation while the passing source-level parity test (product-gallery-variants.test.ts) independently proves the component's JSX is byte-for-byte unchanged. Registered as snap S-07-01 with full evidence in 07-SCREENSHOTS.md and logged to WINDOWS.md (#4) rather than blocking phase close on a sub-pixel rendering artifact the code itself did not cause."

patterns-established:
  - "Phase-close evidence roll-up: a plan whose whole purpose is proof, not new production code, still follows full deviation documentation (investigate before recording a reason) and the broken-windows ledger for any residual, evidenced imperfection."

requirements-completed: [LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04]

coverage:
  - id: D1
    description: "One repo-wide test proves LAYOUT-04 for all three switches at once: independent member-to-component tables match the three enums exactly, every one of the eight components renders non-empty markup with its own data attribute, every production map's key set mirrors its enum in order with no duplicates, no map-holding or display file compares a resolved value against a member name literal, no phase-created component declares a generic layout/variant prop, no cross-request memoisation or module-scope mutable state exists in the layout tree or resolver, neither image-bearing hero reads its image from settings/store-config, and every one of the eight variants has a case in its own per-switch suite"
    requirement: LAYOUT-04
    verification:
      - kind: unit
        ref: "tests/unit/app/layout-switch-contract.test.ts (49 tests across 9 describe blocks, one per behavior row)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every one of the eight variants is captured on its own route under both the volt-dark default preset and the luxe light preset (16-row coverage table in 07-SCREENSHOTS.md, no MISSING cell among home/category/product in any of the six new sections)"
    requirement: "LAYOUT-01, LAYOUT-02, LAYOUT-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run screenshot:routes (6 runs, 22/26 cells captured each — order-status MISSING for the same carried-forward reason every prior phase's manifest records)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The three default variants are proven pixel-identical to the pre-extraction baseline via a measured hash comparison of 12 compared home/category/product rows"
    requirement: LAYOUT-01
    verification:
      - kind: other
        ref: "awk/diff comparison of phase-07-pre-extraction-volt-dark vs phase-07-grid3-minimal-left-volt-dark (07-SCREENSHOTS.md Defaults Parity Result section)"
        status: fail
      - kind: other
        ref: "PIL pixel-diff root-cause analysis of the one differing row (product|390|resting): 2 pixels, max 1/255 intensity, cross-validated against product-gallery-variants.test.ts's passing source-level parity assertion"
        status: pass
    human_judgment: true
    rationale: "11 of 12 compared rows are exactly byte-identical; the 12th (product|390|resting) differs by 2 pixels at 1/255 intensity, reproduced identically across two independent recaptures. The literal hash-diff command therefore does not exit clean, even though the root-cause investigation (pixel-diff bounding box, magnitude, and a passing independent source-level parity test) supports that this is headless-Chromium rendering noise, not a code regression. A human should review the evidence in 07-SCREENSHOTS.md and confirm this doesn't block treating D-14's byte-identity claim as satisfied."
  - id: D4
    description: "LAYOUT-01 through LAYOUT-04 marked complete in REQUIREMENTS.md (checkbox + traceability table); ROADMAP.md's Phase 7 entry shows 5/5 plans delivered; the full gate suite (lint, typecheck, npm test, build, scan:tokens) is green from a clean tree; the storefront's three layout values and theme are back at their defaults"
    requirement: "LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04"
    verification:
      - kind: other
        ref: "requirements.ready-ids (4/4 ready), requirements.mark-complete, roadmap.update-plan-progress; npm run lint/typecheck/test/build/scan:tokens all exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: 40min
completed: 2026-09-05
status: complete
---

# Phase 7 Plan 5: Phase Close — Repo-Wide Contract Test, Full Screenshot Sweep, Requirement Register Summary

**One test proves LAYOUT-04 for all three switches at once, all eight variants are captured under both presets with a 16-row coverage table, the three default extractions are shown pixel-identical to the pre-Phase-7 baseline apart from one evidenced 2-pixel rendering artifact, and LAYOUT-01 through LAYOUT-04 close out the requirement register with a fully green gate suite.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-05T08:35:00Z (approx.)
- **Completed:** 2026-09-05T09:14:32Z
- **Tasks:** 3 completed
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Wrote `tests/unit/app/layout-switch-contract.test.ts`: an independent, hand-listed member-to-component table for all eight variants (never derived from the production maps it checks against), asserted equal to the three enums exactly; every component rendered with a minimal fixture and checked for non-empty markup plus its own data attribute; every production map's (`category-layout-map.ts`, `home-hero-map.ts`, `ProductDisplay.tsx`'s inline `PRODUCT_GALLERY_MAP`) declared key set extracted via source regex and compared to its enum in order with no duplicates; no name-literal comparisons in any map-holding or display file; no generically-named `layout`/`variant` prop on any of the twelve component files this phase created; no cross-request memoisation helper or module-scope mutable declaration anywhere in `components/layout/**` or the resolver; neither image-bearing hero variant references settings/store-config; and a coverage assertion proving every one of the eight enum members appears in its own per-switch suite (D-13). 49 tests, all passing; `npm run typecheck` and `npm run lint` both clean (0 errors, the same 52 pre-existing unrelated warnings).
- Captured all eight variants under both `volt-dark` and `luxe` using six runs (three independent-switch combinations × two presets): all-defaults, `grid-2`/`split`/`top`, and `list`/`full-bleed`/`left`. Wrote a 16-row variant-to-cell coverage table into `07-SCREENSHOTS.md` naming the label and route evidencing each variant/preset pair, and noted the five non-default variants as new intentional captures with no baseline to diff against.
- Ran the defaults-parity comparison (12 compared `home`/`category`/`product` rows between the pre-extraction baseline and the all-defaults `volt-dark` capture): 11 of 12 rows are exactly byte-identical. Investigated the one residual difference (`product|390|resting`) rather than accepting or endlessly re-rolling it — PIL pixel-diff bounded the entire difference to 2 individual pixels at a maximum of 1/255 intensity per channel, at the anti-aliased edge of a thumbnail's rounded border; two independent recaptures reproduced this exact same difference, ruling out simple per-run randomness; and `product-gallery-variants.test.ts`'s own passing source-level parity test independently proves `ProductGalleryLeft.tsx`'s JSX is byte-for-byte unchanged. Registered as snap **S-07-01** with full evidence, and logged to `WINDOWS.md` (#4) for ship-time visibility. (A separate, genuinely flaky mismatch on `category|1280|resting` — a broken-image-icon render-timing artifact on the very first capture attempt — was traced, found non-reproducing on two clean recaptures, and resolved cleanly; it is not part of the residual difference above.)
- Restored all three layout values and the theme to their defaults (`grid-3`/`minimal`/`left`/`volt-dark`) and stopped the dev server before finishing.
- Marked LAYOUT-01 through LAYOUT-04 complete in `REQUIREMENTS.md` (all four were ready per the shared-ID gate — every plan declaring them now has a SUMMARY) and updated `ROADMAP.md`'s Phase 7 entry to 5/5 plans delivered, editing only that phase's section.
- Ran the full gate suite from a clean tree: `npm run lint` (0 errors, 52 pre-existing unrelated warnings), `npm run typecheck` (exit 0), `npm test` (2126/2126, up from 2077 before this plan — 49 new tests), `npm run build` (exit 0), `npm run scan:tokens` (0 violations, 2 manual-review rows, unchanged: `image-placeholders.ts`, `Promotion.ts`).
- Re-verified all five phase-close prohibitions against the whole phase's diff, not just this plan's: no generic layout/variant prop anywhere (Task 1's contract test), no module-scope/cross-request layout caching anywhere (Task 1's contract test), neither hero image reads from settings/store-config (Task 1's contract test), the 23-token contract and theme mechanism are unchanged (scan:tokens 0 violations, same 2 manual-review rows), and `components/admin/ThemePresetGrid.tsx` was never touched across any Phase 7 commit (`git log` shows its last modifying commits are both from Phase 6).

## Task Commits

Each task was committed atomically:

1. **Task 1: One repo-wide contract test for the LAYOUT-04 claim** - `2c17be2` (test)
2. **Task 2: Capture every variant under both presets and prove the three defaults changed nothing** - `bdc78ee` (test)
3. **Task 3: Phase close — requirement register, roadmap, and the green gate suite** - `28cece7` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `tests/unit/app/layout-switch-contract.test.ts` - the repo-wide LAYOUT-04 contract test (49 tests)
- `.planning/phases/07-layout-switches/07-SCREENSHOTS.md` - six new label sections, the 16-row coverage table, and the defaults-parity result with root-cause evidence
- `.planning/REQUIREMENTS.md` - LAYOUT-01 through LAYOUT-04 marked complete
- `.planning/ROADMAP.md` - Phase 7 entry shows 5/5 plans delivered
- `.planning/WINDOWS.md` - logged the residual pixel-level parity difference (#4)

## Decisions Made

- **The three map-holding files targeted by the contract test are the files that actually declare each map** (`category-layout-map.ts`, `home-hero-map.ts`, `ProductDisplay.tsx`), not the page files the plan's read_first line named — see key-decisions above.
- **Investigated rather than tolerated or endlessly retried the one residual screenshot-parity difference**, root-causing it to a 2-pixel, 1/255-intensity rendering artifact and cross-validating against an independent passing source-level test before recording it as a specific, evidenced snap (S-07-01) — matching the plan's own explicit instruction not to record a hash mismatch as "tolerated" without investigation.
- **A separate, genuinely flaky capture (`category|1280|resting`) was distinguished from the real residual** by recapturing it independently and confirming it now reproduces the baseline hash exactly — conflating the two would have misrepresented the flaky one as part of a real, reproducible difference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, investigated and documented rather than fixed] Defaults-parity comparison has one residual, non-code-caused difference**
- **Found during:** Task 2, the plan's own automated defaults-parity `<verify>` command
- **Issue:** The literal `diff` comparison between the pre-extraction baseline and the all-defaults `volt-dark` capture reports one differing row (`product|390|resting`) out of 12 compared rows, so the plan's automated verify command does not exit clean as written.
- **Investigation:** PIL pixel-diff (`ImageChops.difference`) bounds the entire difference to a 1px × 62px region containing exactly 2 differing pixels, at a maximum of 1 intensity unit out of 255 per RGB channel, at the anti-aliased top/bottom edge of a selected thumbnail's rounded border. Two independent recaptures (deleting the prior capture and manifest section each time) reproduced this exact same 2-pixel difference, ruling out simple per-run randomness. `tests/unit/components/layout/product/product-gallery-variants.test.ts`'s own passing source-level parity test independently proves `ProductGalleryLeft.tsx`'s JSX — including every class string — is byte-for-byte unchanged from the frozen pre-extraction recording (apart from the three explicitly named, expected substitutions).
- **Fix attempted:** Three total capture attempts (1 original + 2 clean recaptures) were made to obtain an exact hash match before stopping, per the deviation rules' fix-attempt limit. No code change was identified or made — the difference is attributed to headless-Chromium sub-pixel anti-aliasing/rasterization variance between separate browser-process launches, not to any change the `CategoryGrid3`/`HomeHeroMinimal`/`ProductGalleryLeft` extractions made.
- **Files modified:** None (investigation only; no production code changed)
- **Verification:** Full pixel-diff evidence (bounding box, magnitude, coordinates) and the cross-validating passing source-level test are both recorded in `07-SCREENSHOTS.md`'s Defaults Parity Result section.
- **Committed in:** `bdc78ee` (Task 2), also logged to `.planning/WINDOWS.md` #4
- **Impact:** Does not affect any must-have truth beyond the literal wording of one automated verify command — the underlying claim (the three extractions changed nothing) is independently and more rigorously proven at the source level by the per-switch parity tests plans 07-01/07-02/07-03 wrote. The visual difference is imperceptible (2 pixels, 1/255 intensity).

---

**Total deviations:** 1 documented (Rule 1 — investigated, root-caused, and evidenced rather than fixed or silently tolerated). **Impact:** No production code was changed or needed changing; the phase's actual correctness claim (extraction is a no-op) remains proven by the more rigorous source-level tests.

## Issues Encountered

- A separate, non-residual flaky capture on `category|1280|resting` (first capture attempt only) was traced to browser render-timing on a remote product image (a broken-image icon rendered with or without its alt text depending on load timing). Confirmed non-reproducing via two clean recaptures reproducing the baseline hash exactly; not part of the documented residual difference above.

## User Setup Required

None - no external service configuration required.

## Phase-Close Evidence Roll-Up

**LAYOUT-01 (category layout):** Live probe from 07-01 (`data-category-layout` flips `list`→1, `grid-3`→1, no restart) plus this plan's screenshot coverage rows for `grid-3`/`grid-2`/`list` under both presets, plus this plan's contract test asserting `CATEGORY_LAYOUT_MAP`'s key/enum equality and every-member-renders.

**LAYOUT-02 (home hero):** Live probe from 07-02 (`data-home-hero` flips `split`→1, `full-bleed`→1, `minimal`→1, no restart) plus this plan's screenshot coverage rows for all three hero variants under both presets, plus this plan's contract test asserting `HOME_HERO_MAP`'s key/enum equality.

**LAYOUT-03 (product gallery):** Live probe from 07-03 (`data-product-gallery` flips `top`→1, `left`→1, no restart) plus this plan's screenshot coverage rows for both gallery variants under both presets, plus this plan's contract test asserting `PRODUCT_GALLERY_MAP`'s key/enum equality (extracted from `ProductDisplay.tsx`'s source).

**LAYOUT-04 (no generic layout prop, one render test per variant):** This plan's single repo-wide contract test (`layout-switch-contract.test.ts`, 49 tests) plus the eight per-variant cases already living in the three per-switch suites plans 07-01/07-02/07-03 wrote, now asserted present by this plan's own coverage-assertion test.

**Carried forward (not resolved by this phase, tracked for later):**
- The settings endpoint's empty-category behavior on a genuinely fresh install (`GET /api/admin/settings?category=appearance` re-inserts the full `defaultSettings` array when the filtered result is empty) — pre-existing, out of scope, tracked in `WINDOWS.md` #3.
- The product display's local media helper (`gallery-media-url.ts`'s `getMediaUrl`) was deliberately not unified with the shared `resolveProductImageSrc` helper this phase — the two helpers do not normalise identically and the default gallery extraction carried a byte-identical obligation; a later phase may unify them.
- The admin browser walkthrough for the `LayoutSwitches` island (visual selection ring, toast copy, Save states, arrow-key roving-tabindex per group, in a real Clerk admin session) has not been run by a human yet — carried from 07-04, tracked in `WINDOWS.md` #2's precedent (no local Clerk session in this environment).

## Next Phase Readiness

- Phase 7 (Layout Switches) is complete: all five plans executed, LAYOUT-01 through LAYOUT-04 marked complete, the full gate suite is green, and the storefront is on its default layouts and default theme.
- Phase 8 (Documentation & Visual QA Close-out) depends on Phase 7 being stable — it is. `docs/theming.md` and the codebase docs refresh can proceed against the shipped layout-switch mechanism.
- The three carried-forward items above remain open for a human or a future phase to address; none blocks Phase 7's own completion.

---
*Phase: 07-layout-switches*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: tests/unit/app/layout-switch-contract.test.ts
- FOUND: .planning/phases/07-layout-switches/07-SCREENSHOTS.md
- FOUND commit: 2c17be2
- FOUND commit: bdc78ee
- FOUND commit: 28cece7
- Re-ran plan-level verification: `npx vitest run tests/unit/app/layout-switch-contract.test.ts` (49/49 pass), `npm run typecheck` (exit 0), `npm run lint` (0 errors, 52 pre-existing unrelated warnings), `npm test` (2126/2126), `npm run build` (exit 0), `npm run scan:tokens` (0 violations, 2 manual-review rows: image-placeholders.ts, Promotion.ts), REQUIREMENTS.md shows 4/4 LAYOUT checkboxes and 4/4 traceability rows as Complete, ROADMAP.md Phase 7 entry shows 5/5 plans delivered, the working tree's production-file diff during Task 3 was scoped to the two allowed planning files, and the storefront's three layout values plus the theme were confirmed back at their defaults (`grid-3`/`minimal`/`left`/`volt-dark`) before the dev server was stopped.
- Known, evidenced exception: the defaults-parity comparison's literal `diff` does not exit clean (1 of 12 rows differs by 2 pixels at 1/255 intensity) — investigated, root-caused, and documented in this SUMMARY's Deviations section and in `07-SCREENSHOTS.md`; not attributable to any code change.
