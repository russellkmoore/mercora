---
phase: 13-gift-card-flags
plan: 03
subsystem: storefront
tags: [gift-cards, feature-flags, nextjs, vitest, source-contract]

# Dependency graph
requires:
  - phase: 13-01
    provides: "lib/gift-cards/visibility.ts (GIFT_CARD_PRODUCT_TYPE, giftCardSurfacesHidden) — the shared predicates this plan's page-level branch imports rather than re-deriving"
provides:
  - "app/product/[slug]/page.tsx 404s a gift-card product when both sell and honor are off, keyed on the stored product's catalog type (D-10)"
  - "app/product/[slug]/ProductDisplay.tsx renders a truthful unavailable notice, in token classes, when sell is off and honor is on (D-07)"
  - "A prop-driven contract (giftCardSalesDisabled) between the server page and the client display component, distinct from the pre-existing inventory-availability boolean"
affects: [13-08, 14-gift-card-admin]

actuals:
  tokens: 2610
  tasks: 2
  commits: 2
plan_head_before: 760541f

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-computed flag-state prop passed into a client component, never re-derived client-side (D-11 applied to the product page specifically)"
    - "Source-contract test with an index-ordering assertion to pin which of two nested ternary branches is checked first"

key-files:
  created:
    - tests/unit/components/gift-card-unavailable-source.test.ts
  modified:
    - app/product/[slug]/page.tsx
    - app/product/[slug]/ProductDisplay.tsx
    - tests/unit/app/product-slug-page.test.ts

key-decisions:
  - "The both-off 404 and the sell-off notice-prop computation both key on storedProduct.type === GIFT_CARD_PRODUCT_TYPE, imported from lib/gift-cards/visibility.ts, never a slug literal — matches D-08 and the plan's own prohibition"
  - "giftCardSalesDisabled defaults to false in ProductDisplayProps so every non-gift caller (and any test that doesn't pass it) is unaffected"
  - "The notice branch is nested inside the existing gift-card ternary, checked before the inventory `available` check, rather than replacing that check — available still gates GiftCardRecipientForm for the sell-on case exactly as before"

patterns-established:
  - "Pattern: a source-contract test that extracts a specific nested-ternary block by regex and asserts index-of-substring ordering, to pin which condition short-circuits first without needing a DOM render"

requirements-completed: [GCF-01, GCF-03]

coverage:
  - id: D1
    description: "With sell off and honor on, GET /product/gift-card renders 200 with the unavailable notice and no recipient form and no add-to-cart control"
    requirement: GCF-01
    verification:
      - kind: unit
        ref: "tests/unit/app/product-slug-page.test.ts#gift-card flag states (GCF-01, GCF-03, D-07, D-10) > passes giftCardSalesDisabled=true to ProductDisplay with sell off and honor on"
        status: pass
      - kind: unit
        ref: "tests/unit/components/gift-card-unavailable-source.test.ts#ProductDisplay gift-card unavailable notice source contract (GCF-01, D-07) > checks giftCardSalesDisabled ahead of the inventory available check inside the gift-card branch"
        status: pass
    human_judgment: false
  - id: D2
    description: "With both flags off, GET /product/gift-card calls notFound()"
    requirement: GCF-03
    verification:
      - kind: unit
        ref: "tests/unit/app/product-slug-page.test.ts#gift-card flag states (GCF-01, GCF-03, D-07, D-10) > throws NEXT_NOT_FOUND for the gift-card product with both flags off"
        status: pass
    human_judgment: false
  - id: D3
    description: "With sell on, the gift-card product page renders the recipient form exactly as it does today"
    verification:
      - kind: unit
        ref: "tests/unit/app/product-slug-page.test.ts#gift-card flag states (GCF-01, GCF-03, D-07, D-10) > passes giftCardSalesDisabled=false to ProductDisplay with sell on and honor on"
        status: pass
    human_judgment: false
  - id: D4
    description: "A non-gift product page is unaffected in every flag state"
    verification:
      - kind: unit
        ref: "tests/unit/app/product-slug-page.test.ts#gift-card flag states (GCF-01, GCF-03, D-07, D-10) > leaves a non-gift product unaffected with both flags off"
        status: pass
    human_judgment: false
  - id: D5
    description: "The notice uses only token classes — no hardcoded palette"
    verification:
      - kind: unit
        ref: "tests/unit/components/gift-card-unavailable-source.test.ts#ProductDisplay gift-card unavailable notice source contract (GCF-01, D-07) > styles the notice with token classes only, no hex colour and no bare Tailwind palette class"
        status: pass
      - kind: other
        ref: "npm run scan:tokens => 0 violations"
        status: pass
    human_judgment: false

# Metrics
duration: ~10min
completed: 2026-09-10
status: complete
---

# Phase 13 Plan 03: Gift-Card Product Page States Summary

**`/product/gift-card` now 404s when both flags are off and shows a truthful "not available right now" notice — in token classes, ahead of the inventory check — when only selling is off, with the flag state computed server-side and passed to `ProductDisplay` as a prop rather than re-derived client-side.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-10 (approximate — session start marker not captured)
- **Completed:** 2026-09-10T16:35:00Z
- **Tasks:** 2 of 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `app/product/[slug]/page.tsx` now branches on the fetched product's catalog type (`GIFT_CARD_PRODUCT_TYPE`, never the slug): calls `notFound()` when `giftCardSurfacesHidden` says both flags are off, and otherwise computes `giftCardSalesDisabled` from the negation of `giftCardAcquisition` and passes it to `ProductDisplay` alongside the existing `subscription` prop.
- `ProductDisplay.tsx` gained a `giftCardSalesDisabled?: boolean` prop (default `false`) checked ahead of the pre-existing inventory `available` check inside the gift-card branch. When true, it renders "Gift cards are not available right now" / "Any gift card you already own still works at checkout." in `text-warning` / `text-muted-foreground` token classes, replacing `GiftCardRecipientForm`.
- Four new cases in `tests/unit/app/product-slug-page.test.ts` pin all four required page states: sell-on/honor-on (prop false), sell-off/honor-on (prop true), both-off (404), and a non-gift product untouched by any flag state. The store-config mock's `commerce.features` became a `vi.hoisted` mutable object so each case can set its own flag combination and `beforeEach` resets it to both-on for the pre-existing seven cases.
- New `tests/unit/components/gift-card-unavailable-source.test.ts` pins the notice string appears exactly once, that `giftCardSalesDisabled` is checked before the inventory `available` ternary inside the gift-card branch, and that the notice's class strings contain no hex colour and no bare Tailwind palette class. Verified by hand that flipping the branch order makes the ordering assertion fail (and the token assertion fail too, since its regex anchors on the correct block shape), then restored the file to its exact committed state.

## Task Commits

1. **Task 1: Product page branches on the two flags** - `736cb5b` (feat)
2. **Task 2: Product page and notice tests** - `f4a6db3` (test)

**Plan metadata:** commit pending (this SUMMARY, no STATE.md/ROADMAP.md/REQUIREMENTS.md edits per orchestrator instruction — those are owned by the wave coordinator).

## Files Created/Modified

- `app/product/[slug]/page.tsx` — imports `GIFT_CARD_PRODUCT_TYPE`/`giftCardSurfacesHidden` from `lib/gift-cards/visibility.ts`; 404s on both-off for a gift-card product; computes and passes `giftCardSalesDisabled`.
- `app/product/[slug]/ProductDisplay.tsx` — new `giftCardSalesDisabled` prop, destructured with a `false` default, checked ahead of `available` in the gift-card ternary; renders the unavailable notice in token classes.
- `tests/unit/app/product-slug-page.test.ts` — store-config mock's `commerce.features` is now a `vi.hoisted` mutable object carrying both gift-card booleans (default both-on, reset in `beforeEach`); four new cases plus a `findProductDisplayProps` tree-walking helper.
- `tests/unit/components/gift-card-unavailable-source.test.ts` — new source-contract test, three assertions (notice-string count, branch ordering, token discipline).

## Decisions Made

- Reused `GIFT_CARD_PRODUCT_TYPE` and `giftCardSurfacesHidden` from 13-01's `lib/gift-cards/visibility.ts` rather than writing a local `'gift_card'` literal comparison or a new predicate — keeps the both-off gate identical to every other wave-2 surface plan's gate.
- Kept `ProductDisplay`'s existing `product.type === "gift_card"` literal comparison (not the imported constant) since it was pre-existing code the plan's `<action>` did not ask to touch, and the acceptance criteria only required the new prop's ordering and the notice string — not a refactor of the outer type check.
- Nested the new notice branch inside the existing gift-card ternary (rather than hoisting it above `product.type === "gift_card" ? (`) so the non-gift-card branch (`available ? <button>Add to Cart</button> : <p>Coming soon</p>`) stays completely untouched, matching the plan's "do not change the non-gift branches" instruction.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria (grep counts, typecheck, scan:tokens, lint, full test suite) passed without needing an auto-fix.

### Process note (no code impact)

Task 1 is `tdd="true"` but its `<files>` list only source files and its `<action>`/`<verify>` never mention writing or running a test — the plan structures RED/GREEN across the two tasks at the plan level (Task 1 implements, Task 2 pins with tests), rather than within Task 1 itself. This mirrors 13-01's noted TDD-commit-split pattern. I followed the plan's task boundaries literally: Task 1 committed as `feat` with only source files staged, Task 2 committed as `test` with only test files staged. I additionally hand-verified the ordering assertion's discriminating power (flip-and-restore, documented above) since that's the closest equivalent to a RED proof available once the source already exists.

## Issues Encountered

None. `plan_head_before` (`760541f`) and the `commits: 2` count above are read directly from `git log --oneline --all | grep '(13-03)'` rather than a persisted single-repo ledger file, because this plan runs on the shared `main` branch alongside three concurrent executors (13-02, 13-04, 13-05) interleaving their own commits — a `git rev-list --count <base>..HEAD` measurement would have counted their commits too, not just this plan's.

## User Setup Required

None — no external service configuration, no new environment variable, no migration. Production runs with sell on, so neither the notice branch nor the 404 branch fires today.

## Next Phase Readiness

The product-page half of GCF-01 and GCF-03 is complete and independently verified. Nothing here blocks 13-08 (docs) or the admin surfaces in later plans — this plan touched only the product detail page and its own tests.

---
*Phase: 13-gift-card-flags*
*Completed: 2026-09-10*

## Self-Check: PASSED

All five files verified present on disk and both task commits (`736cb5b`, `f4a6db3`) verified in `git log`.
