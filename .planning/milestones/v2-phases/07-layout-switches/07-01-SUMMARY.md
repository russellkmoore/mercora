---
phase: 07-layout-switches
plan: 01
subsystem: layout
tags: [layout-switches, category-grid, admin-settings, telemetry, rsc-boundary]

# Dependency graph
requires:
  - phase: 06-02
    provides: "getActiveTheme() as the structural sibling getLayoutSettings() mirrors — same fallback chain, same telemetry-only-on-unknown rule"
provides:
  - "lib/layout/variants.ts — CATEGORY_LAYOUTS/HOME_HEROES/PRODUCT_GALLERIES, their union types, DEFAULT_LAYOUTS (single source of truth for all three switches)"
  - "lib/layout/settings.ts — getLayoutSettings(), LAYOUT_SETTING_KEYS (per-request resolver, never throws, no cross-request memoisation)"
  - "layout.unknown_selection registered in TELEMETRY_EVENTS (warning, sampleRate 1), verified absent from the tail Worker's critical-only list"
  - "Three category variant components (CategoryGrid3/CategoryGrid2/CategoryList) and CATEGORY_LAYOUT_MAP, the exhaustiveness-checked lookup map"
  - "The resolved-enum-not-resolved-component prop pattern for a server-page-resolves/client-component-renders layout switch, forced by an RSC serialization constraint discovered live"
affects: [07-02, 07-03, 07-04, 07-05]

# Actuals (#2632)
actuals:
  tokens: 13300
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A second, independent per-request D1 resolver (getLayoutSettings) structurally mirroring an existing one (getActiveTheme), accepting a second small category-scoped read rather than sharing a memoised helper"
    - "A resolved enum value (never a component reference) crosses the server-to-client-component prop boundary; the exhaustive Record<Enum, ComponentType> lookup map lives in its own module and is imported by whichever side of the boundary actually needs to instantiate the component"

key-files:
  created:
    - lib/layout/variants.ts
    - lib/layout/settings.ts
    - components/layout/category/CategoryGrid3.tsx
    - components/layout/category/CategoryGrid2.tsx
    - components/layout/category/CategoryList.tsx
    - components/layout/category/category-layout-map.ts
    - tests/unit/lib/layout/variants.test.ts
    - tests/unit/lib/layout/settings.test.ts
    - tests/unit/components/layout/category/fixtures.ts
    - tests/unit/components/layout/category/category-grid3-parity.test.ts
    - tests/unit/components/layout/category/category-variants.test.ts
    - tests/unit/components/layout/category/__snapshots__/category-display-grid3.html
    - .planning/phases/07-layout-switches/07-SCREENSHOTS.md
  modified:
    - lib/observability/telemetry.ts
    - tests/unit/workers/observability-tail-core.test.ts
    - app/category/[slug]/page.tsx
    - app/category/[slug]/CategoryDisplay.tsx

key-decisions:
  - "Passing the resolved variant COMPONENT from the server category page into the client CategoryDisplay (the plan's literal instruction) crashes at runtime: React Server Components cannot serialize a function/component reference across the server-to-client-component prop boundary. Discovered live during the Task 3 dev-server probe (\"Functions cannot be passed directly to Client Components\"). Fixed by passing the resolved enum value instead, typed to CategoryLayout (never a bare string), and moving the CATEGORY_LAYOUT_MAP lookup inside CategoryDisplay itself — still a single map access, no if/switch branch on the enum anywhere in the file."
  - "Accepted two D1 reads per request for getLayoutSettings() (RESEARCH Pitfall 1) rather than sharing a memoised readAppearance() helper with getActiveTheme() — keeps the new resolver fully independent of the frozen theme-resolver test suite; the extra read is the same per-request D1 cost the project already accepts for theme resolution."
  - "Promoted the enum member name to primary identity per the plan's flagged planner decision: each switch's identity is its enum member name, and today's rendering (grid-3/minimal/left) is demoted to whichever member DEFAULT_LAYOUTS lists — no page, component, or test special-cases the default beyond reading it from that object."

patterns-established:
  - "Server-resolved-enum, client-side-map-lookup boundary: when a variant must re-render on client-side state changes (e.g. a sort toggle) but its selection was resolved server-side from D1, the server page passes the typed enum value (never the component), and the SAME shared, exhaustive lookup map is imported and applied on whichever side actually instantiates the component."

requirements-completed: []  # LAYOUT-01 and LAYOUT-04 are also declared by sibling plans 07-02/07-03/07-04, not yet executed — requirements.ready-ids reported 0/2 ready; will be marked complete once every declaring plan has a SUMMARY.

coverage:
  - id: D1
    description: "The three layout enumerations, their union types, and DEFAULT_LAYOUTS live in lib/layout/variants.ts as the single source every switch, page, and test reads from"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "tests/unit/lib/layout/variants.test.ts (6 tests: no duplicates, distinctness per enum, defaults membership, D-04 reproduction)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getLayoutSettings() resolves all three switches from one category-scoped D1 read, validates each stored value against its own enum by array membership (never object indexing), and never throws"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "tests/unit/lib/layout/settings.test.ts (19 tests covering every behavior row including prototype-member/constructor tampering, settings-read rejection, no cross-call memoisation, and cross-switch isolation)"
        status: pass
    human_judgment: false
  - id: D3
    description: "layout.unknown_selection is registered at warning severity, sample rate 1, and is structurally absent from the tail Worker's critical-only event list, with a passing cross-file parity test"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "tests/unit/workers/observability-tail-core.test.ts#registers layout.unknown_selection at warning severity outside the tail critical list"
        status: pass
      - kind: other
        ref: "npm run test:observability-worker"
        status: pass
    human_judgment: false
  - id: D4
    description: "The category page resolves categoryLayout via getLayoutSettings() and CategoryDisplay renders the matching variant through CATEGORY_LAYOUT_MAP without ever comparing the enum to a string literal"
    requirement: LAYOUT-04
    verification:
      - kind: unit
        ref: "tests/unit/components/layout/category/category-variants.test.ts (source-contract tests: no === /switch on categoryLayout, prop typed to CategoryLayout not string)"
        status: pass
      - kind: integration
        ref: "live dev-server probe: POST appearance.category_layout=list then grid-3, both data-category-layout attribute counts print exactly 1 with no restart"
        status: pass
    human_judgment: false
  - id: D5
    description: "CategoryGrid3 is a byte-identical extraction of the pre-Phase-7 CategoryDisplay products section, apart from the one new data-category-layout attribute"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "tests/unit/components/layout/category/category-grid3-parity.test.ts (asserts stripped markup equals the committed pre-extraction recording, and the attribute occurs exactly once)"
        status: pass
    human_judgment: false
  - id: D6
    description: "All three category variants render correctly for populated and empty product arrays, and CategoryList carries ProductCard's per-field fallbacks (no-rating, no-price, unavailable) unchanged"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "tests/unit/components/layout/category/category-variants.test.ts (per-variant order/empty-state tests, CategoryList fallback tests, map key/enum equality and every-member-renders)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The whole-tree token scan stays at 0 violations and exactly 2 manual-review rows after the three new variant files"
    requirement: LAYOUT-01
    verification:
      - kind: other
        ref: "npm run scan:tokens"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-09-05
status: complete
---

# Phase 7 Plan 1: Layout Switch Tracer — Enumerations, Resolver, and the Category Grid Switch Summary

**A per-request `getLayoutSettings()` resolver (mirroring `getActiveTheme()`) and three category-grid variants prove the whole layout-switch mechanism end to end — including a real RSC serialization bug the plan's own architecture hit and had to be fixed live.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-05T07:53:00Z (approx.)
- **Completed:** 2026-09-05T08:08:13Z
- **Tasks:** 3 completed
- **Files modified:** 17 (13 created, 4 modified)

## Accomplishments

- Froze the pre-extraction evidence before touching any production code: `07-SCREENSHOTS.md`'s `phase-07-pre-extraction-volt-dark` label (22/26 cells captured, the 4 `order-status` cells MISSING for the same carried-forward reason every prior phase's manifest records) and a byte-for-byte recording of `CategoryDisplay`'s products section, rendered from a deterministic three-product fixture with no date-derived or random values.
- Built `lib/layout/variants.ts` (the three enums, their union types, `DEFAULT_LAYOUTS`) and `lib/layout/settings.ts` (`getLayoutSettings()`), a structural sibling of `getActiveTheme()`: one category-scoped D1 read, per-switch enum-membership validation (never object indexing — closes the object-prototype-member tampering threat T-07-01), silent fallback on absent/empty/null, exactly one `layout.unknown_selection` telemetry call on anything else, and never throws. 25 unit tests across both modules cover every behavior row including prototype-member and constructor-name tampering attempts, settings-read rejection, no memoisation across sequential calls, and cross-switch isolation (a value valid for one switch's enum is never returned by another).
- Registered `layout.unknown_selection` in `TELEMETRY_EVENTS` (warning, sample rate 1) and extended the tail-worker parity test to assert it stays outside `TAIL_CRITICAL_EVENTS`.
- Extracted `CategoryGrid3` (byte-identical to the Task 1 recording once the one new `data-category-layout` attribute is stripped), plus two new variants `CategoryGrid2` (two columns, larger gaps) and `CategoryList` (image-left row, `ProductCard`'s data contract and fallbacks ported unchanged). Rewired `app/category/[slug]/page.tsx` to resolve `categoryLayout` via `getLayoutSettings()`.
- **Hit and fixed a real bug the plan's stated architecture couldn't avoid:** passing the resolved variant *component* from the server page into the client `CategoryDisplay` crashes at runtime — React Server Components refuse to serialize a function/component reference across that boundary. The dev-server live probe caught this immediately (`Functions cannot be passed directly to Client Components`). Fixed by passing the resolved *enum value* (typed `CategoryLayout`, never a bare string) and moving the `CATEGORY_LAYOUT_MAP` lookup inside `CategoryDisplay` itself — still one map access, no branching, no comparison against a variant name literal anywhere in the file (asserted in a source-contract test).
- Proved the switch live: with the dev server running, POSTing `appearance.category_layout: "list"` then `"grid-3"` to the existing settings endpoint (dev-bypass header) changed the served category route's `data-category-layout` attribute both times, with no restart in between; the stored value was restored to the default (`grid-3`) before stopping the server.

## Task Commits

Each task was committed atomically:

1. **Task 1: Freeze the pre-extraction evidence — volt-dark route baseline and the CategoryDisplay recording** - `750c065` (test)
2. **Task 2: The enumerations, getLayoutSettings, and the layout unknown-selection event** - `a4b7738` (feat)
3. **Task 3: Three category variants, the resolved-component boundary, and a live switch on a real server** - `83ac368` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `lib/layout/variants.ts` - the three enums, union types, `DEFAULT_LAYOUTS`
- `lib/layout/settings.ts` - `getLayoutSettings()`, `LAYOUT_SETTING_KEYS`
- `lib/observability/telemetry.ts` - registers `layout.unknown_selection`
- `components/layout/category/CategoryGrid3.tsx` - verbatim default extraction
- `components/layout/category/CategoryGrid2.tsx` - two-column variant
- `components/layout/category/CategoryList.tsx` - one-row-per-product variant
- `components/layout/category/category-layout-map.ts` - the exhaustiveness-checked lookup map
- `app/category/[slug]/page.tsx` - resolves `categoryLayout`, passes it to `CategoryDisplay`
- `app/category/[slug]/CategoryDisplay.tsx` - takes `categoryLayout` (typed enum), does the map lookup, renders the resolved variant
- `tests/unit/lib/layout/variants.test.ts`, `settings.test.ts` - 25 tests
- `tests/unit/components/layout/category/fixtures.ts` - deterministic product fixture
- `tests/unit/components/layout/category/category-grid3-parity.test.ts` - byte-identity gate
- `tests/unit/components/layout/category/category-variants.test.ts` - 12 tests (order/empty/fallbacks/map/source-contract)
- `tests/unit/components/layout/category/__snapshots__/category-display-grid3.html` - the frozen recording
- `tests/unit/workers/observability-tail-core.test.ts` - extended parity test
- `.planning/phases/07-layout-switches/07-SCREENSHOTS.md` - phase screenshot manifest

## Decisions Made

- **RSC component-as-prop does not work; fixed to enum-value-as-prop with the map lookup moved client-side.** See key-decisions above — full rationale and the exact error text are recorded there since this is the plan's own flagged assumption proving wrong under a real request, not a design preference.
- **Accepted two D1 reads per request** for `getLayoutSettings()` rather than building a shared memoised `readAppearance()` helper — keeps this resolver's test suite fully independent of `getActiveTheme()`'s frozen one, matching RESEARCH Pitfall 1's first resolution.
- **Enum member name promoted to primary identity**, per the plan's flagged planner decision — no code treats `grid-3` as special beyond `DEFAULT_LAYOUTS` naming it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's server-resolves-component / client-renders-it-as-a-prop architecture does not work — React Server Components cannot serialize a function reference into a Client Component prop**
- **Found during:** Task 3, live dev-server probe (the very check the plan itself specifies to prove the switch works)
- **Issue:** `app/category/[slug]/page.tsx` (a server component) resolved `CATEGORY_LAYOUT_MAP[categoryLayout]` and passed the resulting component reference as a `variant` prop into `CategoryDisplay` (`"use client"`). The dev server logged `Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server"` on every request to `/category/[slug]`, and the live probe's `data-category-layout` attribute count came back `0` instead of `1` — the page rendered with no product markup at all.
- **Fix:** Moved the map lookup itself into `CategoryDisplay`. The server page now resolves and passes only the *enum value* `categoryLayout: CategoryLayout` (never a bare string — still the specific narrow union, satisfying LAYOUT-04's anti-generic-prop rule). `CategoryDisplay` imports the same shared, exhaustive `CATEGORY_LAYOUT_MAP` from its own module (`components/layout/category/category-layout-map.ts`, extracted from the page for this reason) and does `CATEGORY_LAYOUT_MAP[categoryLayout]` — a single map access, still no `if`/`switch` branch on the enum anywhere. This is necessary regardless of which switch is being resolved, because the chosen variant must re-render on every client-side sort-toggle change (the products it receives are the client-sorted array), so the variant component itself must execute inside the client component's render tree, not be frozen as server-rendered output handed down as `children`.
- **Files modified:** `app/category/[slug]/page.tsx`, `app/category/[slug]/CategoryDisplay.tsx`, `components/layout/category/category-layout-map.ts` (new), plus the two test files asserting the new prop shape
- **Verification:** Live probe re-run after the fix: both `data-category-layout="list"` and `data-category-layout="grid-3"` counts print exactly 1 with no server restart between them; no RSC error in the dev server log; full `npm test` (2006/2006), `npm run build`, `npm run typecheck`, `npm run lint` (0 errors) all pass after the fix.
- **Committed in:** `83ac368` (part of Task 3's own commit — the bug was caught and fixed before the task's acceptance criteria were declared met, not after)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a bug in the plan's own stated architecture, not an implementation mistake). **Impact:** Necessary for LAYOUT-04's core claim (a resolved variant, never an enum string, decides what renders) to actually hold at runtime; the fix preserves every must-have truth in the plan (no branching on the enum name, no generic `layout` prop, single exhaustive map) while working within React Server Components' real constraints. Plans 07-02 and 07-03 (home hero, product gallery) should follow the enum-value-as-prop pattern established here, not the plan's original component-as-prop wording, for any variant selection that crosses a server-to-client-component boundary.

## Issues Encountered

None beyond the deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/layout/variants.ts` and `lib/layout/settings.ts` are the frozen contracts plans 07-02, 07-03, and 07-04 must import unchanged (per this plan's own `<interfaces>` block) — do not rename `CATEGORY_LAYOUTS`/`HOME_HEROES`/`PRODUCT_GALLERIES`/`DEFAULT_LAYOUTS`/`LAYOUT_SETTING_KEYS`/`getLayoutSettings`.
- **The resolved-enum-value-as-prop pattern (not resolved-component-as-prop) is the one to follow for the home hero and product gallery switches too**, wherever the variant renders inside a client component. The product gallery case (D-08) is explicitly a client component already (image-selection state), so plan 07-03 should expect the same RSC constraint and design for it from the start rather than rediscovering it.
- `layout.unknown_selection` is live in production telemetry as soon as this deploys; the tail Worker correctly ignores it by design, matching `theme.unknown_selection`'s precedent.
- LAYOUT-01 and LAYOUT-04 are NOT yet marked complete in `REQUIREMENTS.md` — both are also declared by sibling plans 07-02/07-03/07-04 (still unexecuted), so the shared-ID gate correctly held them back (`requirements.ready-ids` reported 0/2 ready). They will flip to Complete once every plan declaring them has a SUMMARY.
- The stored `appearance.category_layout` D1 value is at its default (`grid-3`) — no manual cleanup needed before the next plan runs.

---
*Phase: 07-layout-switches*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: lib/layout/variants.ts
- FOUND: lib/layout/settings.ts
- FOUND: components/layout/category/CategoryGrid3.tsx
- FOUND: components/layout/category/CategoryGrid2.tsx
- FOUND: components/layout/category/CategoryList.tsx
- FOUND: components/layout/category/category-layout-map.ts
- FOUND: tests/unit/lib/layout/variants.test.ts
- FOUND: tests/unit/lib/layout/settings.test.ts
- FOUND: tests/unit/components/layout/category/fixtures.ts
- FOUND: tests/unit/components/layout/category/category-grid3-parity.test.ts
- FOUND: tests/unit/components/layout/category/category-variants.test.ts
- FOUND: tests/unit/components/layout/category/__snapshots__/category-display-grid3.html
- FOUND: .planning/phases/07-layout-switches/07-SCREENSHOTS.md
- FOUND commit: 750c065
- FOUND commit: a4b7738
- FOUND commit: 83ac368
- Re-ran plan-level verification: vitest tests/unit/lib/layout/ (25/25), tests/unit/components/layout/category/ (17/17), tests/unit/workers/observability-tail-core.test.ts (13/13), npm run test:observability-worker (3/3), npm run typecheck (exit 0), npm run lint (0 errors, 52 pre-existing unrelated warnings), npm test (2006/2006), npm run build (exit 0), npm run scan:tokens (0 violations, 2 manual-review rows), live dev-server probe (data-category-layout flips list→1, grid-3→1, no restart, stored value restored to default)
