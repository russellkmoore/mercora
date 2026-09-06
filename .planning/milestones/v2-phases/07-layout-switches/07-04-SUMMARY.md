---
phase: 07-layout-switches
plan: 04
subsystem: admin-ui
tags: [layout-switches, admin-settings, radiogroup, roving-tabindex, lucide-react]

# Dependency graph
requires:
  - phase: 07-01
    provides: "lib/layout/variants.ts (CATEGORY_LAYOUTS/HOME_HEROES/PRODUCT_GALLERIES, DEFAULT_LAYOUTS) and lib/layout/settings.ts (LAYOUT_SETTING_KEYS) — the single source of truth this island reads its option lists and setting keys from"
provides:
  - "components/admin/LayoutSwitches.tsx — the independent admin client island for the three layout switches (three radiogroups, one Save, one fetch)"
  - "extractLayoutSelections() — per-switch allow-list extraction, exported and directly tested"
  - "The Appearance page (app/admin/settings/appearance/page.tsx) now hosts both ThemePresetGrid and LayoutSwitches"
affects: [07-05]

# Actuals (#2632)
actuals:
  tokens: 7180
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A single local table (group label, setting key, icon+label options) drives three independent radiogroups' ARIA wiring and roving tabindex from one keyboard handler, rather than three copy-pasted blocks — mirrors ThemePresetGrid's pattern, applied per-group instead of per-manifest-entry"
    - "extractOne<T extends string>(rows, key, allowed, fallback) — a single generic helper implementing the allow-list-and-fallback extraction, called once per switch so each switch's enum membership check stays fully isolated from the others (no cross-switch acceptance)"

key-files:
  created:
    - components/admin/LayoutSwitches.tsx
    - tests/unit/app/admin-layout-switches-source.test.ts
  modified:
    - app/admin/settings/appearance/page.tsx

key-decisions:
  - "Icon substitution per the plan's own verified correction: lucide-react@1.31.0's type declarations (dist/lucide-react.d.ts, checked directly this session) show AlignCenter and SplitSquareHorizontal are now deprecated aliases re-exporting TextAlignCenter and SquareSplitHorizontal respectively — both alias names still resolve at compile time, but per the plan's explicit instruction the primary names (TextAlignCenter, SquareSplitHorizontal) were used instead of the two names 07-UI-SPEC.md's icon table originally listed (AlignCenter, SplitSquareHorizontal). The other six icon names in that table (LayoutGrid, Columns2, LayoutList, GalleryHorizontal, PanelLeft, PanelTop) are unaliased and used as written."
  - "The whole 'Layout' section (h2 heading, subtitle, three radiogroups, Save button, load-failure banner) lives entirely inside LayoutSwitches.tsx, not split across the page — Task 1's own test file needed to assert the heading/subtitle copy against LayoutSwitches.tsx's source before Task 2 ever touches page.tsx, which only made sense if that copy already lived in the island. app/admin/settings/appearance/page.tsx's Task 2 change is therefore a two-line addition (import + <LayoutSwitches /> render, plus a <Separator />), matching the plan's 'change nothing else on the page' instruction."
  - "Imported LAYOUT_SETTING_KEYS directly from lib/layout/settings.ts into the client component, per the interfaces block's first option, rather than pre-emptively moving it to lib/layout/variants.ts. A real npm run build (Task 2) is the arbiter the interfaces block names, and it passed clean — settings.ts's server-only getSettings()/recordTelemetry imports are tree-shaken out of the client bundle because getLayoutSettings() itself is never referenced from client code, the same reasoning that already lets ThemePresetGrid.tsx import constants from lib/themes/active-theme.ts (also marked server-only) without issue. No move was needed."
  - "Save always posts all three keys in one request (never a partial subset of just the changed ones), matching D-12's 'saving the three keys together' framing literally — the dirty-check only gates whether Save is enabled, not which keys are included in the POST body."

patterns-established:
  - "Cross-switch isolation by construction: extractOne() is called once per switch with that switch's own enum array, so a stored value that happens to be a member of a different switch's enum (e.g. 'left', valid only for productGallery) is structurally incapable of being accepted for categoryLayout or homeHero — there is no shared lookup table a wrong value could hit."

requirements-completed: []  # LAYOUT-01/02/03 also declared by 07-05 (not yet executed); requirements.ready-ids reported 0/3 ready — will flip to Complete once every declaring plan has a SUMMARY.

coverage:
  - id: D1
    description: "LayoutSwitches renders three independent radiogroups (category layout, home hero, product gallery), each with an accessible name matching its group label and exactly as many options as its own enum has members — no group can render with zero options"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "tests/unit/app/admin-layout-switches-source.test.ts (LayoutSwitchesContent — rendered behavior: radiogroup/radio counts, accessible names, per-group option counts against CATEGORY_LAYOUTS/HOME_HEROES/PRODUCT_GALLERIES.length)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each group's saved value is the checked radio with Save disabled when nothing is pending; selecting one group's option never moves the other two groups' checked options; Save enables only once a pending value diverges from saved and disables again once it matches"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "tests/unit/app/admin-layout-switches-source.test.ts (checked-option, cross-group isolation, and Save-enabled/disabled rows)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Loading state renders all options with Save disabled; error state shows the theme grid's exact load-failure banner copy with Save disabled; saving state disables Save and shows the in-progress label"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "tests/unit/app/admin-layout-switches-source.test.ts (loading/error/saving rows)"
        status: pass
    human_judgment: false
  - id: D4
    description: "extractLayoutSelections() resolves each of the three stored values against its own enum by array membership, falling back to that switch's default for an absent row, unparseable value, wrong-type value, or a value outside its own enum — and a value valid for one switch is rejected for another (cross-switch isolation, T-07-14)"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "tests/unit/app/admin-layout-switches-source.test.ts (extractLayoutSelections() describe block, 6 tests including the cross-switch-isolation case)"
        status: pass
    human_judgment: false
  - id: D5
    description: "nextRovingIndex wraps forwards past the last index and backwards past the first, verified for a group of two options and a group of three"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "tests/unit/app/admin-layout-switches-source.test.ts (nextRovingIndex() describe block)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Save posts one request with exactly three updates under the appearance category to the existing POST /api/admin/settings — no new API route added — and sets the saved values from the endpoint's own response body, never the optimistic pending state"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "tests/unit/app/admin-layout-switches-source.test.ts (LayoutSwitches source wiring describe block)"
        status: pass
      - kind: integration
        ref: "live dev-server probe: one POST wrote appearance.category_layout/home_hero/product_gallery in a single request (response updated: 3), GET read-back confirmed all three stored values"
        status: pass
    human_judgment: false
  - id: D7
    description: "The Appearance page hosts LayoutSwitches below ThemePresetGrid (unmodified, byte-for-byte) inside the existing page wrapper, with the page's existing heading/subtitle/metadata unchanged"
    requirement: "LAYOUT-01, LAYOUT-02, LAYOUT-03"
    verification:
      - kind: unit
        ref: "tests/unit/app/admin-layout-switches-source.test.ts (Appearance page wiring describe block)"
        status: pass
      - kind: other
        ref: "git diff --name-only -- components/admin/ThemePresetGrid.tsx (empty) and git status --porcelain -- app/api/ (empty)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The values written through the admin write path are the values the three storefront routes actually serve: the category, home, and product routes each rendered exactly the posted data-* attribute after the POST, with no restart in between, and all three were restored to their defaults and confirmed before the server stopped"
    requirement: "LAYOUT-01, LAYOUT-02, LAYOUT-03"
    verification:
      - kind: integration
        ref: "live dev-server probe: data-category-layout=\"grid-2\" (1), data-home-hero=\"split\" (1), data-product-gallery=\"top\" (1); restore POST to grid-3/minimal/left confirmed via a second read of each route"
        status: pass
    human_judgment: false
  - id: D9
    description: "A real admin, in a real browser with a real Clerk session, confirms the visual selection ring, the toast copy, Save's disabled/in-progress states, and arrow-key roving-tabindex behavior scoped correctly per group"
    verification: []
    human_judgment: true
    rationale: "No local Clerk session exists in this environment (carried from Phase 6), so the admin page itself cannot be loaded and clicked through here — the same limitation Phase 6 recorded for ThemePresetGrid's own browser walkthrough. Outstanding, tracked below."

# Metrics
duration: 25min
completed: 2026-09-05
status: complete
---

# Phase 7 Plan 4: LayoutSwitches Admin Island — Three Radiogroups, One Save, One Fetch Summary

**An independent `components/admin/LayoutSwitches.tsx` island gives an admin a real place to set all three layout switches, saving them together through the existing guarded settings endpoint — proven end to end with a live write that flipped all three storefront routes and then restored their defaults.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-05T08:44:00Z (approx.)
- **Completed:** 2026-09-05T08:49:00Z
- **Tasks:** 2 completed
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Built `components/admin/LayoutSwitches.tsx` as a structural copy of `ThemePresetGrid.tsx`'s shape: an exported `extractLayoutSelections()` (per-switch allow-list extraction against `CATEGORY_LAYOUTS`/`HOME_HEROES`/`PRODUCT_GALLERIES`, never object indexing), an exported `nextRovingIndex()` (copied verbatim), a pure `LayoutSwitchesContent` view, and a stateful `LayoutSwitches` wrapper — all three radiogroups driven from one local table (`SWITCH_GROUPS`) so a future fourth switch is a data change, not new markup or a new keyboard handler.
- Each group is its own `role="radiogroup"` with roving tabindex scoped to that group only (arrow keys never jump between groups), matching `ThemePresetGrid`'s exact semantics, applied three times independently.
- Save posts one request with all three keys (`appearance.category_layout`, `appearance.home_hero`, `appearance.product_gallery`) under the `appearance` category to the existing `POST /api/admin/settings` — no new API route, verified by a working-tree check that nothing appeared under `app/api/`. On success the saved values are read back from the endpoint's own response body, never the optimistic pending state.
- Made the plan's verified icon substitution: `lucide-react@1.31.0` no longer exports `AlignCenter`/`SplitSquareHorizontal` as primary names (both are now deprecated aliases for `TextAlignCenter`/`SquareSplitHorizontal` per the package's own type declarations) — used the two primary names in their place; the other six icons in the UI-SPEC's table were used as written.
- Hosted the island on `app/admin/settings/appearance/page.tsx` below `ThemePresetGrid` (with a `<Separator />` between them), inside the existing wrapper, with the page's existing heading, subtitle and metadata untouched — a two-line addition since the section's own heading/subtitle copy lives inside `LayoutSwitches.tsx` itself.
- Proved the write path end to end on a real dev server: one POST wrote all three keys to non-default values in a single request (`updated: 3`); a GET read-back confirmed all three; the category, home and product routes each served their matching `data-*` attribute exactly once with no restart in between; all three values were then restored to their defaults and confirmed before the server was stopped.
- 26 tests across `tests/unit/app/admin-layout-switches-source.test.ts` cover every behavior row: render counts against the real enum arrays (no hardcoded counts), checked-option/cross-group-isolation/Save-enabled-disabled combinations, loading/error/saving states, the extraction helper's absent/unparseable/wrong-type/out-of-enum/cross-switch-rejection cases, `nextRovingIndex`'s wrap-around for groups of two and three, the endpoint/route/copy source contract, and the Appearance page's own wiring.
- Full suite green: `npm run lint` (0 errors, 52 pre-existing unrelated warnings), `npm run typecheck`, `npm test` (2077/2077), `npm run build` (`/admin/settings/appearance` present in the route manifest), `npm run scan:tokens` (0 violations, exactly 2 manual-review rows, unchanged from before this plan).

## Task Commits

Each task was committed atomically:

1. **Task 1: The LayoutSwitches island — three radiogroups, one save, one fetch** - `f2d09fe` (feat)
2. **Task 2: Host the Layout section on the Appearance page and prove the three-key save end to end** - `27f4ff4` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/admin/LayoutSwitches.tsx` - the independent admin client island (extraction helper, roving-index helper, pure content view, stateful wrapper)
- `tests/unit/app/admin-layout-switches-source.test.ts` - 26 tests covering render behavior, extraction, roving-index math, and source-contract wiring for both the island and the page
- `app/admin/settings/appearance/page.tsx` - now renders `<LayoutSwitches />` below `<ThemePresetGrid />`

## Decisions Made

- **Icon substitution**: used `TextAlignCenter`/`SquareSplitHorizontal` (the primary lucide-react 1.31.0 export names) in place of `AlignCenter`/`SplitSquareHorizontal` (now deprecated aliases for the same icons), per the plan's own verified correction to the UI-SPEC table.
- **Whole section lives in the island**: the `<h2>Layout</h2>` heading, subtitle, three groups, and Save button all render from inside `LayoutSwitches.tsx` — `page.tsx`'s change is just the import and render call, matching "change nothing else on the page."
- **Direct import of `LAYOUT_SETTING_KEYS` from `lib/layout/settings.ts`** into the client component worked without moving it to `variants.ts` — confirmed via a real `npm run build`, the arbiter the interfaces block named. Server-only imports inside `settings.ts` are tree-shaken since `getLayoutSettings()` itself is never referenced from client code, mirroring `ThemePresetGrid.tsx`'s existing precedent of importing constants from the also-server-only-marked `active-theme.ts`.
- **Save always posts all three keys**, never a partial subset of just the changed ones, matching D-12's "saving the three keys together" literally.

## Deviations from Plan

None - plan executed exactly as written, including its own flagged icon-name correction and its own flagged interfaces-block contingency (which resolved to "no move needed" after a real build).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `components/admin/ThemePresetGrid.tsx` is byte-for-byte unchanged, confirmed by `git diff --name-only`.
- LAYOUT-01, LAYOUT-02, and LAYOUT-03 are NOT yet marked complete in `REQUIREMENTS.md` — all three are also declared by sibling plan 07-05 (not yet executed), so the shared-ID gate correctly held them back (`requirements.ready-ids` reported 0/3 ready). They will flip to Complete once every plan declaring them has a SUMMARY.
- The stored `appearance.*` D1 values are at their defaults (`grid-3`/`minimal`/`left`) — no manual cleanup needed before the next plan runs.
- **Outstanding human check (carried, not a blocker for this plan's own completion)**: a real browser walkthrough with a Clerk admin session — confirming the visual selection ring, the exact toast text, Save's disabled/"Saving…" states, and arrow-key roving-tabindex behavior scoped per group — has not been run in this environment, identically to Phase 6's own recorded gap for `ThemePresetGrid`. Recommended before `/gsd-verify-work` closes this phase.

---
*Phase: 07-layout-switches*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: components/admin/LayoutSwitches.tsx
- FOUND: tests/unit/app/admin-layout-switches-source.test.ts
- FOUND: app/admin/settings/appearance/page.tsx contains `<LayoutSwitches`
- FOUND commit: f2d09fe
- FOUND commit: 27f4ff4
- Re-ran plan-level verification: `npx vitest run tests/unit/app/admin-layout-switches-source.test.ts` (26/26 pass), `npm run typecheck` (exit 0), `npm run lint` (0 errors, 52 pre-existing unrelated warnings), `npm test` (2077/2077), `npm run build` (exit 0, `/admin/settings/appearance` present in route manifest), `npm run scan:tokens` (0 violations, 2 manual-review rows), `git diff --name-only -- components/admin/ThemePresetGrid.tsx` (empty), `git status --porcelain -- app/api/` (empty), live dev-server probe (three-key POST → `updated: 3`, GET read-back confirmed, three storefront routes each served their matching attribute exactly once, all three restored to defaults and confirmed, server stopped).
