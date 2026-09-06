---
phase: 07-layout-switches
plan: 02
subsystem: layout
tags: [layout-switches, home-hero, product-image-resolution, scrim-exception, rsc-boundary]

# Dependency graph
requires:
  - phase: 07-01
    provides: "HOME_HEROES enum, DEFAULT_LAYOUTS.homeHero, getLayoutSettings() and the resolved-enum-value-as-prop pattern proven on the category switch"
provides:
  - "components/layout/home/HomeHeroMinimal.tsx — verbatim extraction of today's home hero, proven by a source-level parity test against a frozen pre-extraction recording"
  - "components/layout/home/HomeHeroSplit.tsx and HomeHeroFullBleed.tsx — the two new hero layouts, both sourcing their image through the shared resolveProductImageSrc helper, both delegating to HomeHeroMinimal when there is no featured product"
  - "components/layout/home/home-hero-map.ts — HOME_HERO_MAP, the exhaustiveness-checked lookup map from HomeHero to its named component"
  - "app/page.tsx resolving and rendering the hero switch server-side, featured-products grid and revalidate export untouched"
  - "The phase's one literal-colour exception (the full-bleed scrim), fenced with the scan-hardcoded-colors.mjs region sentinel"
affects: [07-03, 07-04, 07-05]

# Actuals (#2632)
actuals:
  tokens: 6300
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-level (not render-level) pre/post-extraction parity test: the pre-extraction JSX is frozen into a committed .txt recording via a git-HEAD read, then a test asserts every recorded line survives in the extracted component's source in order, with the one intentionally-changed line (the tag that gained the data attribute) checked by remainder match instead of exact match. Used because, unlike the category display, the pre-extraction home hero was never a standalone renderable unit a render-level parity test could target."
    - "Delegation-as-empty-state: a variant handed no data renders a sibling default variant's own markup (including its data attribute) rather than a placeholder or a null render — makes the empty case observable in the same markup diff the populated case is."
    - "Home hero's map lookup stays entirely server-side (no client-component boundary to cross), unlike the category switch's map, which 07-01 had to move client-side after an RSC serialization failure. HOME_HERO_MAP still lives in its own module (mirroring category-layout-map.ts) purely for test isolation, not because of any RSC constraint."

key-files:
  created:
    - components/layout/home/HomeHeroMinimal.tsx
    - components/layout/home/HomeHeroSplit.tsx
    - components/layout/home/HomeHeroFullBleed.tsx
    - components/layout/home/home-hero-map.ts
    - tests/unit/components/layout/home/home-hero-variants.test.ts
    - tests/unit/components/layout/home/__snapshots__/home-hero-minimal-preextraction.txt
  modified:
    - app/page.tsx

key-decisions:
  - "Added components/layout/home/home-hero-map.ts even though the plan's files_modified frontmatter list doesn't enumerate it — mirrors category-layout-map.ts's precedent (07-01) so the map's key/enum equality and every-member-renders invariants can be tested directly, without importing app/page.tsx's own data-fetching dependencies. A small, low-risk addition, not an architectural change."
  - "The two non-default hero variants delegate to HomeHeroMinimal (rendering its full markup, including its own data-home-hero=\"minimal\" attribute) when there is no featured product, per UI-SPEC — this supersedes 07-RESEARCH.md's own assumption A1, which recommended a placeholder image instead."
  - "HomeHeroSplit/HomeHeroFullBleed resolve their image exclusively through lib/utils/product-image.ts's resolveProductImageSrc — the same helper ProductCard already uses — never ProductDisplay's narrower local getMediaUrl(), per RESEARCH's Anti-Patterns guidance."
  - "The full-bleed scrim and its two overlaid text lines are fenced with scan-hardcoded-colors.mjs's inline gsd:scan-ignore-start/-end sentinel and a written reason; the CTA button sits on lines outside the region so it stays scanned and fully token-driven (bg-primary text-on-primary)."

patterns-established:
  - "Source-level (not render-level) verbatim-extraction parity test, for a hero/section block that was never a standalone renderable unit prior to extraction."

requirements-completed: []  # LAYOUT-02 and LAYOUT-04 are also declared by sibling plans 07-03/07-04, not yet executed — requirements.ready-ids reported 0/2 ready; will be marked complete once every declaring plan has a SUMMARY.

coverage:
  - id: D1
    description: "HomeHeroMinimal is a provably verbatim extraction of today's home hero — every recorded line of the pre-extraction hero section survives in the extracted component's source, in order, with only the data-attribute-bearing tag's remainder checked (character for character) instead of an exact match"
    requirement: LAYOUT-02
    verification:
      - kind: unit
        ref: "tests/unit/components/layout/home/home-hero-variants.test.ts (source parity: recording non-empty, every line present in order)"
        status: pass
    human_judgment: false
  - id: D2
    description: "HomeHeroSplit and HomeHeroFullBleed each render the reused-verbatim copy, an image resolved through resolveProductImageSrc, the CTA, and their own data-home-hero attribute when handed a featured product; both delegate fully to HomeHeroMinimal (including its attribute and copy) when handed null; both still render an image element on the shared resolver's placeholder path when the product has no image data"
    requirement: LAYOUT-02
    verification:
      - kind: unit
        ref: "tests/unit/components/layout/home/home-hero-variants.test.ts (per-variant populated/delegation/no-image-data rows, 3 variants x 3 rows)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Neither new hero variant's source references the settings/layout-settings modules or a store-config field for its image, and neither uses a raw-HTML sink"
    requirement: LAYOUT-02
    verification:
      - kind: unit
        ref: "tests/unit/components/layout/home/home-hero-variants.test.ts (source-contract rows per variant)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The full-bleed scrim and its two overlaid text lines are fenced by exactly one scan-hardcoded-colors.mjs region-start/region-end sentinel pair, with a written reason; the CTA stays outside the region on token classes; scan:tokens stays at 0 violations with the same 2 pre-existing manual-review rows; the scanner script itself is unmodified"
    requirement: LAYOUT-02
    verification:
      - kind: unit
        ref: "tests/unit/components/layout/home/home-hero-variants.test.ts (sentinel-count and CTA-outside-region rows)"
        status: pass
      - kind: other
        ref: "npm run scan:tokens"
        status: pass
    human_judgment: false
  - id: D5
    description: "app/page.tsx resolves homeHero via getLayoutSettings() awaited directly in the page body (never inside Suspense), renders the resolved component from HOME_HERO_MAP, contains no comparison of the resolved value against any hero member name literal, and leaves the featured-products grid's markup/order/priority flag byte-for-byte unchanged"
    requirement: LAYOUT-04
    verification:
      - kind: unit
        ref: "tests/unit/components/layout/home/home-hero-variants.test.ts (HOME_HERO_MAP key/enum equality + every-member-renders, app/page.tsx source-contract rows)"
        status: pass
      - kind: integration
        ref: "live dev-server probe: POST appearance.home_hero=split, then full-bleed, then minimal — each data-home-hero attribute count prints exactly 1 with no restart between them; stored value restored to the default before stopping the server"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-05
status: complete
---

# Phase 7 Plan 2: Home Hero Switch — Verbatim Extraction, Split and Full-Bleed Variants, Live Wiring Summary

**Three named home-hero components (a proven-verbatim `minimal`, a new `split`, and a new `full-bleed` with the phase's one fenced literal-colour scrim), resolved server-side from a stored enum value via `HOME_HERO_MAP`, with a live dev-server probe proving the switch flips the served markup with no restart.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-05T08:00:00Z (approx.)
- **Completed:** 2026-09-05T08:20:13Z
- **Tasks:** 3 completed
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- Froze `app/page.tsx`'s pre-extraction hero section (read at HEAD, unmodified, original indentation) into a committed recording, then extracted `HomeHeroMinimal.tsx` as a byte-for-byte match — the only permitted difference is the new `data-home-hero="minimal"` attribute on the section's opening tag, proven by a source-level parity test (this hero was never a standalone renderable unit, so the parity check reads both files' source directly rather than diffing rendered markup, unlike the category display's own render-level parity test).
- Built `HomeHeroSplit.tsx` (copy left / image right at `lg`, natural DOM-order stacking below it) and `HomeHeroFullBleed.tsx` (fixed-height band reusing the category page's own hero-height scale, image behind a scrim, copy overlaid) — both resolving their image exclusively through `resolveProductImageSrc` (the same helper `ProductCard` already uses), both delegating fully to `HomeHeroMinimal` (including its own data attribute and copy) when there is no featured product. This delegation choice supersedes `07-RESEARCH.md`'s own assumption A1, which had recommended a placeholder image instead — the UI-SPEC's explicit decision took precedence.
- Fenced the full-bleed scrim and its two overlaid text lines (`bg-black/50`, `text-white`, `text-white/80` — literal, theme-independent colours; no token pair guarantees a dark backdrop across every theme polarity) with exactly one `scan-hardcoded-colors.mjs` region-sentinel pair carrying a written reason. The CTA button sits on lines outside the region, stays fully token-driven (`bg-primary text-on-primary`), and the scan still reports 0 violations with the same two pre-existing manual-review rows (`lib/utils/image-placeholders.ts`, `lib/types/mach/Promotion.ts`) — the scanner script itself was never touched.
- Built `HOME_HERO_MAP` (its own small module, mirroring the category switch's `category-layout-map.ts` precedent for testability) and wired `app/page.tsx`: `getLayoutSettings()` is awaited directly in the page body, above the returned tree, never inside Suspense; the resolved component renders with the first featured product or `null`. The featured-products grid and the already-inert `revalidate = 3600` export are untouched — no unrelated cleanup mixed into this file's edit.
- Proved the switch live: with the dev server running, POSTing `appearance.home_hero: "split"`, then `"full-bleed"`, then `"minimal"` via the dev-bypass header each changed the served `/` route's `data-home-hero` attribute — each count printed exactly 1, with no server restart between any of the three requests. The stored value was left at the default (`minimal`) before stopping the server.
- Full suite green after Task 3: `vitest` 2025/2025 (up from 2006 before this plan — 19 new tests), `npm run typecheck`, `npm run lint` (0 errors, the same 52 pre-existing unrelated warnings), `npm run build` (home route emits `ƒ`, dynamic, as expected), `npm run scan:tokens` (0 violations, 2 manual-review rows).

## Task Commits

Each task was committed atomically:

1. **Task 1: Record the pre-extraction hero block and extract the centred-text hero verbatim** - `c6ef42d` (test)
2. **Task 2: The split and full-bleed heroes, their image source, and the scrim exception** - `e720b7c` (feat)
3. **Task 3: Wire the home page to the hero switch and prove it on a real server** - `e4e07b1` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/layout/home/HomeHeroMinimal.tsx` - verbatim extraction of today's home hero
- `components/layout/home/HomeHeroSplit.tsx` - copy-left/image-right hero, delegates to minimal when empty
- `components/layout/home/HomeHeroFullBleed.tsx` - full-width band hero with the fenced scrim exception
- `components/layout/home/home-hero-map.ts` - `HOME_HERO_MAP`, the exhaustiveness-checked lookup map
- `app/page.tsx` - resolves `homeHero` via `getLayoutSettings()`, renders the resolved hero component
- `tests/unit/components/layout/home/home-hero-variants.test.ts` - 19 tests (parity, per-variant render/delegation/source-contract, map/enum equality, page source-contract, sentinel checks)
- `tests/unit/components/layout/home/__snapshots__/home-hero-minimal-preextraction.txt` - the frozen pre-extraction recording

## Decisions Made

- **Delegation, not a placeholder image, for the empty-featured-products case** — the UI-SPEC's explicit decision supersedes RESEARCH assumption A1; recorded because it's a documented supersession of a research recommendation, not an implicit pick.
- **Added `home-hero-map.ts` as a new, small module** not enumerated in the plan's `files_modified` frontmatter — mirrors the category switch's own `category-layout-map.ts` precedent from 07-01, keeping the map directly testable without importing the page's data-fetching code. Low-risk, additive, no architectural change.
- **Image resolution exclusively via `resolveProductImageSrc`**, never `ProductDisplay`'s narrower local `getMediaUrl()` — matches RESEARCH's explicit guidance for this genuinely new image surface.

## Deviations from Plan

None - plan executed exactly as written. (The `home-hero-map.ts` addition above is a minor scope note, not a deviation from any must-have truth, prohibition, or task instruction — no task text says the map must be inline in `app/page.tsx`, and the map/enum-equality behavior row implies a directly-importable module the same way it did for the category switch.)

## Issues Encountered

None. Unlike 07-01's category switch, the home hero's map lookup never crosses a server-to-client-component boundary — `app/page.tsx` is a server component end to end, so no RSC serialization issue was hit or needed working around.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `components/layout/home/HomeHeroMinimal.tsx`, `HomeHeroSplit.tsx`, `HomeHeroFullBleed.tsx`, and `home-hero-map.ts` are stable; plan 07-05's screenshot diff should compare against the `phase-07-pre-extraction-volt-dark` baseline 07-01 recorded (the default `minimal` hero should be pixel-identical; `split`/`full-bleed` are new intentional captures).
- LAYOUT-02 and LAYOUT-04 are NOT yet marked complete in `REQUIREMENTS.md` — both are also declared by sibling plans 07-03/07-04 (still unexecuted), so the shared-ID gate correctly held them back (`requirements.ready-ids` reported 0/2 ready). They will flip to Complete once every declaring plan has a SUMMARY.
- The stored `appearance.home_hero` D1 value is at its default (`minimal`) — no manual cleanup needed before the next plan runs.
- Plan 07-03 (product gallery) is the one remaining case where resolution (server) and rendering (client component, image-selection state) split across the RSC boundary — it should expect the same constraint 07-01 hit on the category switch, not the home hero's simpler all-server-side shape this plan used.

---
*Phase: 07-layout-switches*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: components/layout/home/HomeHeroMinimal.tsx
- FOUND: components/layout/home/HomeHeroSplit.tsx
- FOUND: components/layout/home/HomeHeroFullBleed.tsx
- FOUND: components/layout/home/home-hero-map.ts
- FOUND: tests/unit/components/layout/home/home-hero-variants.test.ts
- FOUND: tests/unit/components/layout/home/__snapshots__/home-hero-minimal-preextraction.txt
- FOUND: app/page.tsx (modified, verified via git diff)
- FOUND commit: c6ef42d
- FOUND commit: e720b7c
- FOUND commit: e4e07b1
- Re-ran plan-level verification: vitest tests/unit/components/layout/home/ (19/19), npm run scan:tokens (0 violations, 2 manual-review rows: image-placeholders.ts, Promotion.ts), npm run typecheck (exit 0), npm run lint (0 errors, 52 pre-existing unrelated warnings), npm test (2025/2025), npm run build (exit 0, home route emits ƒ), live dev-server probe (data-home-hero flips split→1, full-bleed→1, minimal→1, no restart, stored value restored to default)
