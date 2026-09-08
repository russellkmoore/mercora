---
phase: 10-gift-card-purchase-flow
plan: 04
subsystem: storefront-checkout-account
tags: [gift-card, react, rsc, react-tdd]
requires:
  - phase: 10-02
    provides: "GiftCardRecipientBlock.tsx: hook-free, client-directive-free presentational component with tone (default|inverse) and variant (compact|detail) props"
provides:
  - "OrderConfirmationModal.tsx: optional items?: StableCartItem[] prop rendering a bounded, scrollable Order items section with a recipient block under gift-card lines"
  - "app/account/orders/[id]/page.tsx: per-item persisted gift-card block at variant=\"detail\", proving GiftCardRecipientBlock crosses the React Server Component boundary"
affects: [10-05]

actuals:
  tokens: 2951
  tasks: 2
  commits: 4
  plan_head_before: 9feaa2ade5d0529b6bd8ae276646f4384817e455

tech-stack:
  added: []
  patterns:
    - "GiftCardRecipientBlock's RSC-safety (no hooks, no client directive) established in 10-02 is exercised for the first time across the client/server boundary: same component imported unchanged into a 'use client' modal and an async Server Component"
    - "Source-contract test line-counting must match grep -c semantics (matching LINES, not total regex occurrences) when an import statement repeats the same identifier the render site also uses"

key-files:
  created:
    - tests/unit/components/order-confirmation-items-source.test.ts
    - tests/unit/app/order-detail-gift-card-source.test.ts
  modified:
    - components/checkout/OrderConfirmationModal.tsx
    - app/account/orders/[id]/page.tsx

key-decisions:
  - "OrderConfirmationModal's line total uses Money.fromStored(item.price).times(item.quantity) directly (the plan's own explicit import list names only Money, not cartItemTotal), matching cartItemTotal's own implementation exactly so the displayed total is identical to what the cart/checkout order summary shows for the same line"
  - "Account order detail's item row keeps the name/quantity/total pair inside a common inner div (flex justify-between gap-4) for both physical and gift-card items, so the gift-card guard is a clean item.gift_card && <GiftCardRecipientBlock /> append rather than a full row-shape ternary; only the li's own className switches (py-3 alone vs. flex flex-col gap-1 py-3) based on gift_card presence — the visual result for a physical item is unchanged (same classes, same content, same rendered layout), the DOM gains one non-visual wrapping div"

patterns-established:
  - "GiftCardRecipientBlock's variant=\"detail\" (untruncated, whitespace-pre-line, no title attribute) is now consumed by a real caller for the first time (10-02 shipped it unused); the account order page is the reference RSC-safe import site future server-rendered surfaces can copy"

requirements-completed: [SHOP-05]

coverage:
  - id: D1
    description: "OrderConfirmationModal takes an optional items?: StableCartItem[] prop and renders a new Order items section (heading, bounded scroll container) between the existing order-ID block and the footer buttons"
    requirement: "SHOP-05"
    verification:
      - kind: unit
        ref: "tests/unit/components/order-confirmation-items-source.test.ts — prop declaration, heading count, max-h-[60vh]/overflow-y-auto, source-order placement between order-ID block and DialogFooter"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each row echoes OrderItemCard's compact shape (name, quantity x unit price, line total) and renders GiftCardRecipientBlock under any line carrying giftCardCustomization, with no explicit tone/variant so both defaults apply; rows are keyed by lineId"
    requirement: "SHOP-05"
    verification:
      - kind: unit
        ref: "tests/unit/components/order-confirmation-items-source.test.ts — lineId key, GiftCardRecipientBlock import+render count, guard on giftCardCustomization"
        status: pass
    human_judgment: false
  - id: D3
    description: "When items is absent or empty the whole section is omitted (no placeholder, no empty-state message); the modal takes a snapshot and does no fetching of its own"
    requirement: "SHOP-05"
    verification:
      - kind: unit
        ref: "tests/unit/components/order-confirmation-items-source.test.ts — 'omits the whole section when the items list is absent or empty', 'contains no fetch call'"
        status: pass
    human_judgment: false
  - id: D4
    description: "app/account/orders/[id]/page.tsx imports GiftCardRecipientBlock and renders it at variant=\"detail\" under each item carrying a persisted gift_card, proving the shared block is RSC-safe (no hook, no client directive) and crosses the Server Component boundary with no second inline copy"
    requirement: "SHOP-05"
    verification:
      - kind: unit
        ref: "tests/unit/app/order-detail-gift-card-source.test.ts — import+render line count, variant=\"detail\" count, item.gift_card guard, no client-component directive, no lib/gift-cards import"
        status: pass
      - kind: manual
        ref: "mise exec -- npm run build — exits 0, no client-only-hook-in-Server-Component error"
        status: pass
    human_judgment: false
  - id: D5
    description: "Physical item rows render visually unchanged; ownership scoping (Clerk auth, sign-in redirect, id-length guard, notFound, getOrderByCustomerAndId keyed on userId) is untouched; a gift-card item with no persisted gift_card renders as a plain row and nothing throws"
    requirement: "SHOP-05"
    verification:
      - kind: unit
        ref: "tests/unit/app/order-detail-gift-card-source.test.ts — 'keeps the auth call, sign-in redirect, notFound guard, and ownership-scoped load'; tests/unit/app/orders-page-source.test.ts unaffected"
        status: pass
    human_judgment: false
  - id: D6
    description: "No secret value, bearer code or redemption token is rendered on either surface; no new API route, fetch, or lib/ file is touched; no new npm dependency"
    requirement: "SHOP-05"
    verification:
      - kind: other
        ref: "git diff --stat -- lib app/api app/checkout/success migrations package.json package-lock.json is empty; grep -c prod_33 over both edited files is 0; both surfaces render only through GiftCardRecipientBlock's four-field prop type"
        status: pass
    human_judgment: false
  - id: D7
    description: "A shopper who just paid sees each gift card's recipient on the confirmation modal (scrolling, not overflowing, past 6 items) and can reopen the order later to read the full untruncated message under the right item, in a real browser"
    requirement: "SHOP-05"
    verification: []
    human_judgment: true
    rationale: "Plan's own <human-check> item: sign in, open a past order with a gift card, and visually confirm the To/Deliver/message lines, unchanged physical rows, and the 6-item modal scroll behavior. workflow.human_verify_mode is end-of-phase (not per-plan blocking); recorded here for phase-close review rather than gating this plan."

duration: 6min
completed: 2026-09-08
status: complete
---

# Phase 10 Plan 04: Confirmation Modal and Account Detail Gift-Card Surfaces Summary

**Closed the last two of SHOP-05's four gift-card recipient surfaces — a bounded, scrollable items list on the paid-order confirmation modal, and the persisted gift-card block on the account order detail page, proving the shared `GiftCardRecipientBlock` crosses the Server Component boundary.**

## Performance
- Duration: 6 min
- Tasks: 2/2 complete
- Commits: 4 (2 TDD RED, 2 GREEN)
- Files touched: 4 (2 modified, 2 new test files)

## Accomplishments
- **Task 1:** `OrderConfirmationModal.tsx` gained an optional `items?: StableCartItem[]` prop. A new `Order items` section renders between the existing order-ID block and the footer buttons, bounded by `max-h-[60vh] overflow-y-auto`, one row per item keyed by `lineId`, echoing `OrderItemCard`'s compact row shape (name, quantity × unit price, line total via `Money.fromStored(item.price).times(item.quantity)`), with `GiftCardRecipientBlock` rendered under any line carrying `giftCardCustomization` at both defaults (no explicit `tone`/`variant`). The whole section is omitted when `items` is absent or empty — no fetch, no effect, no placeholder text. `app/checkout/success/page.tsx` and every file under `lib/`/`app/api` are untouched; the existing `CheckoutClient.tsx` render site still compiles with no prop change required there.
- **Task 2:** `app/account/orders/[id]/page.tsx` (an async Server Component, no `"use client"`) now imports `GiftCardRecipientBlock` directly and renders it at `variant="detail"` under any item carrying a persisted `gift_card`, guarded by `item.gift_card &&`. Physical items keep the same visual name/quantity/total row (now inside a common inner `flex justify-between gap-4` div, unchanged classes and content); only a gift-card item's `<li>` additionally becomes `flex flex-col gap-1`. The Clerk auth call, sign-in redirect, id-length guard, `notFound`, and the ownership-scoped `getOrderByCustomerAndId(userId, id)` load are byte-identical to before. `mise exec -- npm run build` exits 0, proving the shared block is RSC-safe with no client-only hook.

## Task Commits
1. **Task 1: Order confirmation modal gains an items list**
   - `test(10-04)` `c5ced14` — RED: new source-contract test asserting the optional prop, heading, scroll bound, lineId keys, `GiftCardRecipientBlock` wiring, source order, no-fetch, and empty-list guard. 8/9 assertions fail against the unmodified modal (real per-test failures, module already existed). `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` on the `giftCardCustomization` guard target test.
   - `feat(10-04)` `847b0b7` — GREEN: full implementation. Fixed a test-authoring bug found while confirming GREEN (the `GiftCardRecipientBlock`-count assertion counted every regex match instead of matching lines, disagreeing with the plan's own `grep -c` acceptance criterion). All 22 assertions across this file and the sibling `gift-card-recipient-block-source` test pass; typecheck, lint (0 errors), scan:tokens (0 violations) clean.
2. **Task 2: Account order detail renders the persisted gift-card block**
   - `test(10-04)` `238a5a0` — RED: new source-contract test asserting the import, `variant="detail"`, the `item.gift_card` guard, the preserved id-or-index key, the preserved auth/redirect/notFound/ownership-scoped load, no client directive, no fetch, and no `lib/gift-cards` import. 3/7 assertions fail against the unmodified page. `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` on the `gift_card` guard target test.
   - `feat(10-04)` `4999754` — GREEN: full implementation. All 11 assertions across this file and the sibling `orders-page-source` test pass; full suite (275 files / 2299 tests), typecheck, lint (0 errors), scan:tokens (0 violations), and production build all clean.

## Files Created/Modified
- `components/checkout/OrderConfirmationModal.tsx` — optional `items?: StableCartItem[]` prop; new bounded `Order items` section between the order-ID block and `DialogFooter`
- `app/account/orders/[id]/page.tsx` — item row grows a `GiftCardRecipientBlock` at `variant="detail"` when `item.gift_card` is present; physical rows visually unchanged
- `tests/unit/components/order-confirmation-items-source.test.ts` — new file, 9 assertions
- `tests/unit/app/order-detail-gift-card-source.test.ts` — new file, 7 assertions

## Decisions Made
- **Line total via `Money.fromStored(item.price).times(item.quantity)`, not `cartItemTotal`.** The plan's own action text names only `Money` in the import list for this task; the expression is the exact same calculation `lib/money/cart.ts`'s `cartItemTotal` performs, so the modal's line total is identical to what the cart drawer and checkout order summary already show for the same line.
- **Account page's item row shares one inner `flex justify-between gap-4` div for both physical and gift-card items**, rather than branching the whole row's markup. This keeps the gift-card addition a clean `item.gift_card && <GiftCardRecipientBlock />` append (matching the source contract's guard assertion) and only switches the `<li>`'s own className between `"py-3"` and `"flex flex-col gap-1 py-3"`. A physical item's classes and content are unchanged; the DOM gains one non-visual wrapper div, with no visual difference (same flex classes, now one level deeper).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in own test] Fixed a `GiftCardRecipientBlock` occurrence-count assertion in the Task 1 RED test**
- **Found during:** Task 1, confirming GREEN
- **Issue:** The test counted every regex match of `GiftCardRecipientBlock` in the file (3 — the import line contains the identifier twice, once as the imported name and once as the last path segment), rather than the number of matching lines (2), which is what the plan's own `grep -c` acceptance criterion measures and what "one import, one render" means.
- **Fix:** Changed the assertion to `source.split('\n').filter(line => line.includes(...)).length`, matching `grep -c`'s line-counting semantics.
- **Files modified:** `tests/unit/components/order-confirmation-items-source.test.ts`
- **Commit:** `847b0b7`

No other deviations. Both TDD RED phases produced genuine per-test assertion failures (the target module already existed in both cases, so RED came from real, distinctly-named assertion failures, not a module-load crash).

## Issues Encountered
None beyond the test-authoring fix above.

## User Setup Required
None.

## Next Phase Readiness
Plan 10-05 is the last plan in this phase — it wires `CheckoutClient.tsx` to snapshot the cart store's `items` into local state before each `clearCart()` call and pass that snapshot as `OrderConfirmationModal`'s new `items` prop (the render site's own file was read-only in this plan and stays untouched here). The `<human-check>` item recorded above (coverage D7) is deferred to phase-close review per `workflow.human_verify_mode: end-of-phase`, not blocking this plan.

---
*Phase: 10-gift-card-purchase-flow*
*Completed: 2026-09-08*

## Self-Check: PASSED
- All key files found on disk (2 modified source files, 2 new test files, this SUMMARY)
- `git log --oneline --all --grep="10-04"` finds all 4 plan commits (c5ced14, 847b0b7, 238a5a0, 4999754)
- Re-ran both task acceptance-criteria grep sets: all pass
- Re-ran plan-level `<verification>`: `npm test` 275 files/2299 tests green; lint 0 errors; typecheck clean; scan:tokens 0 violations; `npm run build` exits 0; `git diff --stat -- lib app/api app/checkout/success migrations package.json package-lock.json` empty; account page still contains auth call, sign-in redirect, id-length guard, `notFound`, and `getOrderByCustomerAndId`
