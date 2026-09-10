---
phase: 10-gift-card-purchase-flow
plan: 05
subsystem: storefront-checkout
tags: [gift-card, checkout, react, react-tdd, clerk]
requires:
  - phase: 10-03
    provides: "ProgressBar steps? prop, ShippingForm heading?/helperText? props"
  - phase: 10-04
    provides: "OrderConfirmationModal items?: StableCartItem[] prop"
provides:
  - "lib/checkout/digital-only.ts: isDigitalOnlyCart, DIGITAL_SHIPPING_METHOD_ID, DIGITAL_CHECKOUT_STEPS — the single module defining the digital-only fulfilment-mix contract"
  - "CheckoutClient.tsx: full digital-only step machine (Billing details -> Payment -> Order Submitted, no shipping-options fetch, no shipping-method panel), Clerk name/email prefill, and a confirmedItems snapshot feeding the confirmation modal"
affects: [11-production-flags, 12-post-purchase-surfaces]

actuals:
  tokens: 8061
  tasks: 3
  commits: 8
  plan_head_before: 6b1587791da80be590e0a89d9f9995d65f8e5f07

tech-stack:
  added: []
  patterns:
    - "One module (lib/checkout/digital-only.ts) holds every literal that defines a derived UI mode (predicate, id, step labels) rather than scattering them as inline literals across the step machine — the assumption-delta 'promote' decision made concrete"
    - "A ternary that yields a whole props object (progressBarProps) instead of two independent ternaries, so an array and its paired index can never drift apart (RESEARCH Pitfall 4)"
    - "An optional addressOverride parameter on a function that otherwise reads from a store-closure value, used specifically to avoid a same-tick stale-read hazard when the store write and the dependent network call happen in the same handler"

key-files:
  created:
    - lib/checkout/digital-only.ts
    - tests/unit/lib/checkout/digital-only.test.ts
    - tests/unit/components/checkout-digital-only-source.test.ts
  modified:
    - components/checkout/CheckoutClient.tsx
    - .planning/phases/10-gift-card-purchase-flow/10-VALIDATION.md

key-decisions:
  - "Excluded the empty-cart composition from the isDigitalOnlyCart / hasPhysicalCheckoutLines paired-invariant test loop, keeping it only as a standalone assertion. hasPhysicalCheckoutLines([]) is vacuously false (no items to disagree with), so its negation is true, while isDigitalOnlyCart([]) is false by design (must_haves: an empty cart is never digital-only, it hits the empty-cart branch first) — the two signals genuinely cannot agree on a composition with nothing in it, so asserting agreement there would test a contradiction, not a real invariant."
  - "createPaymentIntent takes an explicit addressOverride parameter rather than always reading the destructured shippingAddress store value, because the digital branch calls setShippingAddress and createPaymentIntent inside the same handler tick — without the parameter, the posted body would carry the previous render's address (or none on first submit), not what the shopper just typed (T-10-14, planner-found hazard)."
  - "Clerk prefill (isLoaded/isSignedIn-gated, empty-field-guarded) is not gated on isDigitalOnly — a signed-in shopper's own name and email are equally correct to prefill on a physical checkout, and the empty guard makes it harmless either way, matching the plan's own instruction to keep the effect unconditional on fulfilment mix."

patterns-established:
  - "The digital-only fulfilment mix (isDigitalOnlyCart) is now the one client-side predicate every step-machine branch, the progress bar, and the address-panel copy all read from — future digital product types extend this module's predicate, not the component."

requirements-completed: [SHOP-05, SHOP-06]

coverage:
  - id: D1
    description: "isDigitalOnlyCart is true only for a non-empty cart whose every line carries a giftCardCustomization; false for empty, mixed, and all-physical carts. Verified against the server's hasPhysicalCheckoutLines over matching OrderItem fixtures for every non-empty composition (the assumption-delta invariant test)."
    requirement: "SHOP-06"
    verification:
      - kind: unit
        ref: "tests/unit/lib/checkout/digital-only.test.ts — 11 assertions covering the five compositions plus the paired invariant, DIGITAL_SHIPPING_METHOD_ID, DIGITAL_CHECKOUT_STEPS"
        status: pass
    human_judgment: false
  - id: D2
    description: "A digital-only cart's Billing details submit calls createPaymentIntent directly with the digital method id and the shopper's just-submitted address, skipping /api/shipping-options and never populating shipping-options state; the physical path (fetch call, store write, shipping-options render guard) is byte-identical to before."
    requirement: "SHOP-06"
    verification:
      - kind: unit
        ref: "tests/unit/lib/checkout/digital-only.test.ts (DIGITAL_SHIPPING_METHOD_ID); acceptance criteria: grep -c '/api/shipping-options' returns 1 (no second call site), git diff --stat over app/api lib/services lib/stores lib/gift-cards is empty"
        status: pass
    human_judgment: false
  - id: D3
    description: "The address posted on the digital path is passed explicitly into createPaymentIntent (addressOverride) rather than read back from the shippingAddress store closure in the same render tick, so a stale or empty address can never be posted (T-10-14)."
    requirement: "SHOP-06"
    verification:
      - kind: unit
        ref: "typecheck passes with createPaymentIntent's second parameter optional (would fail at the physical-path call site in handleShippingSelected if it were made required)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ProgressBar receives DIGITAL_CHECKOUT_STEPS and a 0/1/2 step index together (one ternary, progressBarProps) on the digital branch; the physical branch keeps the existing 0/2/3 mapping with no steps prop passed at all."
    requirement: "SHOP-06"
    verification:
      - kind: unit
        ref: "tests/unit/components/checkout-digital-only-source.test.ts — ProgressBar wiring, index-mapping, and no-steps-prop-on-physical-branch assertions"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Billing details panel (outer h3 + ShippingForm heading/helperText) and the post-submit recap card heading both read 'Billing details' with the honest 'nothing ships' helper line on the digital branch only; ShippingForm's seven-field required gate, the Use Address button, and the full-address recap are unchanged; the physical branch's 'Shipping Address' labels survive verbatim."
    requirement: "SHOP-06"
    verification:
      - kind: unit
        ref: "tests/unit/components/checkout-digital-only-source.test.ts — heading/helper assertions; acceptance criteria greps for Billing details (>=2), Nothing ships (1), Shipping Address (2), border-l-4 border-success (2)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A signed-in shopper's recipient/email fields prefill once from Clerk's fullName and primaryEmailAddress.emailAddress, each only when the field is currently empty, so the effect can seed a blank form but never overwrite typed input; a guest sees an entirely blank form (D-03)."
    requirement: "SHOP-06"
    verification:
      - kind: unit
        ref: "tests/unit/components/checkout-digital-only-source.test.ts — isLoaded/isSignedIn gating, empty-field guard, single-line primaryEmailAddress read assertions"
        status: pass
    human_judgment: false
  - id: D7
    description: "CheckoutClient snapshots the destructured items value into confirmedItems immediately before each of the two clearCart() calls (the noCash branch and handlePaymentSuccess), and passes confirmedItems to OrderConfirmationModal as its items prop, so the confirmation shows what was bought after the cart is gone (D-11, SHOP-05)."
    requirement: "SHOP-05"
    verification:
      - kind: unit
        ref: "tests/unit/components/checkout-digital-only-source.test.ts — confirmedItems declaration, snapshot-precedes-clear ordering (both sites), source (not store-read), items={confirmedItems} prop assertions"
        status: pass
    human_judgment: false
  - id: D8
    description: "No server contract, pricing path, migration, docs file, or npm dependency was touched; no template code keys off a product id or slug; no client-side tax special-casing."
    requirement: "SHOP-06"
    verification:
      - kind: other
        ref: "git diff --stat -- app/api lib/services lib/stores lib/gift-cards docs migrations package.json package-lock.json is empty; git diff -- components/checkout/OrderSummary.tsx is empty; grep -c prod_33 over both edited files is 0"
        status: pass
    human_judgment: false
  - id: D9
    description: "The full CI gate order passes locally against the completed tree, and 10-VALIDATION.md is filled with real re-run commands and marked validated."
    requirement: "SHOP-05"
    verification:
      - kind: other
        ref: "lint (0 errors), typecheck, cf-typecheck (types up to date), scan:tokens (0 violations), npm test (277 files/2326 tests), test:workers (27/154), test:observability-worker (1/3), docs:lint (0 violations), build all pass; 10-VALIDATION.md's 12-row map re-run (14 files/127 tests) and set to status: validated, nyquist_compliant: true"
        status: pass
    human_judgment: false
  - id: D10
    description: "With only a gift card in the cart at /checkout, the bar shows exactly three steps, the panel is headed Billing details with the nothing-ships helper, Use Address stays disabled until every field is filled, submitting goes straight to Payment with no shipping-method panel, and at 360px 'Billing details' does not wrap; adding a physical item restores all four steps and the shipping-method panel."
    verification: []
    human_judgment: true
    rationale: "Plan's own <human-check> item (Task 2). workflow.human_verify_mode is end-of-phase (not per-plan blocking); recorded here for phase-close review rather than gating this plan. Source-contract tests prove the wiring (D4/D5 above); this item is the live-browser visual confirmation of that wiring."
  - id: D11
    description: "Buying a gift card end to end in Stripe test mode shows the confirmation modal listing the item with its recipient block under the order-ID block, and the same order under Account then Orders shows the full gift message; a mixed cart's physical flow is unaffected."
    verification: []
    human_judgment: true
    rationale: "Plan's own <human-check> item (Task 3), requiring a real Stripe test-mode payment against the local dev server. workflow.human_verify_mode is end-of-phase; recorded here for phase-close review. Source-contract tests prove the snapshot wiring (D7 above) and the confirmation-modal rendering (10-04); this item is the live end-to-end payment confirmation."

duration: 14min
completed: 2026-09-08
status: complete
---

# Phase 10 Plan 05: Digital-Only Checkout Step Machine and Confirmation Snapshot Summary

**An all-digital cart now walks Billing details -> Payment -> Confirmation with no shipping step at all; the confirmation modal shows what was just bought, snapshotted before the cart is cleared.**

## Performance
- Duration: 14 min
- Tasks: 3/3 complete
- Commits: 8 (3 TDD RED, 3 GREEN, 1 docs, 1 self-check fix)
- Files touched: 5 (2 modified, 3 new test/lib files)

## Accomplishments
- **Task 1:** `lib/checkout/digital-only.ts` is the single module holding the three facts that define a digital checkout — `isDigitalOnlyCart` (true only for a non-empty cart whose every line carries a `giftCardCustomization`), `DIGITAL_SHIPPING_METHOD_ID` (`"digital"`, echoing the server-owned pricing method id), and `DIGITAL_CHECKOUT_STEPS`. `CheckoutClient.tsx` computes `isDigitalOnly` once and gives `handleAddressSubmit` a digital branch that builds the same `Address` the store write already builds, saves it, and calls `createPaymentIntent` directly with a synthetic digital shipping option and that address — skipping `/api/shipping-options` entirely. `createPaymentIntent` gained an optional `addressOverride` parameter so the digital path posts the address the shopper just typed, not a stale same-tick closure read (T-10-14). The invariant test pairs `isDigitalOnlyCart` against the server's `hasPhysicalCheckoutLines` for every non-empty fulfilment-mix composition.
- **Task 2:** The step machine now reads `isDigitalOnly` throughout: `ProgressBar` gets `DIGITAL_CHECKOUT_STEPS` and a 0/1/2 index (one ternary yielding both, so they can't drift apart) on the digital branch, nothing on the physical branch (0/2/3 unchanged). The address panel's heading and `ShippingForm`'s `heading`/`helperText` props switch to "Billing details" and the honest "Nothing ships" copy; the recap card's heading matches. A signed-in shopper's name and email prefill from Clerk (`useUser`, `isLoaded`/`isSignedIn`-gated, empty-field-guarded so typed input is never overwritten), unconditional on fulfilment mix per the plan's own instruction.
- **Task 3:** `CheckoutClient` gained a `confirmedItems` state, snapshotted from the destructured `items` value immediately before each of the two `clearCart()` calls (the no-cash branch and `handlePaymentSuccess`), and passed to `OrderConfirmationModal` as its `items` prop. The full CI gate order (lint, typecheck, cf-typecheck, scan:tokens, `test`, `test:workers`, `test:observability-worker`, docs:lint, build) passes locally, and `10-VALIDATION.md` is filled with real re-run commands (12 rows, 14 files / 127 tests) and marked `status: validated`, `nyquist_compliant: true`.

## Task Commits
1. **Task 1: Derive the fulfilment mix, and take the digital cart straight to payment**
   - `test(10-05)` `c886882` — RED: `tests/unit/lib/checkout/digital-only.test.ts` against a minimal RED stub of `lib/checkout/digital-only.ts` (empty predicate/id/array, needed so the test file loads without a module-resolution crash). 7/12 assertions fail on real per-test mismatches. `gsd_run check tdd-red-evidence` -> `RED_EVIDENCE_OK` on the `DIGITAL_SHIPPING_METHOD_ID` target test.
   - `feat(10-05)` `597eeb8` — GREEN: full implementation of `digital-only.ts` and the `CheckoutClient.tsx` wiring described above. 11/11 tests pass (one invariant case fixed, see Deviations); typecheck and lint (0 errors) clean; fenced files (`app/api`, `lib/services`, `lib/stores`, `lib/gift-cards`, `OrderSummary.tsx`) untouched.
2. **Task 2: Relabel the step for a digital cart, shift the index, and prefill from Clerk**
   - `test(10-05)` `8240fa4` — RED: `tests/unit/components/checkout-digital-only-source.test.ts` against Task 1's source. 9/11 assertions fail (the step machine wasn't wired yet). `gsd_run check tdd-red-evidence` -> `RED_EVIDENCE_OK` on the ProgressBar/`DIGITAL_CHECKOUT_STEPS` wiring target test.
   - `feat(10-05)` `381a602` — GREEN: full implementation. 11/11 tests pass (two acceptance-criteria-driven fixes, see Deviations); typecheck, lint (0 errors), scan:tokens (0 violations) clean.
3. **Task 3: Snapshot the cart for the confirmation modal, then run the phase gate**
   - `test(10-05)` `55b1ff4` — RED: extended the same source-contract file with a `confirmedItems` describe block against Task 2's source. 4/16 assertions fail (no `confirmedItems` state existed yet). `gsd_run check tdd-red-evidence` -> `RED_EVIDENCE_OK` on the `confirmedItems` declaration target test.
   - `feat(10-05)` `d6adaac` — GREEN: `confirmedItems` state, both snapshot calls, and the modal prop wired. 16/16 tests pass; full phase gate (lint, typecheck, cf-typecheck, scan:tokens, `test`, `test:workers`, `test:observability-worker`, docs:lint, build) all green.
   - `docs(10-05)` `a38af73` — `10-VALIDATION.md` filled and marked `validated`.
   - `fix(10-05)` `3c90723` — self-check fix: a comment in the digital branch spelled out the literal `/api/shipping-options` path, pushing the plan's acceptance-criterion grep count to 2. Reworded the comment; no behavior change. Full CI gate (`test`, `scan:tokens`, `build`) re-run clean after the fix (see Deviations).

## Files Created/Modified
- `lib/checkout/digital-only.ts` — new; `isDigitalOnlyCart`, `DIGITAL_SHIPPING_METHOD_ID`, `DIGITAL_CHECKOUT_STEPS`
- `components/checkout/CheckoutClient.tsx` — digital-only step machine, `addressOverride` param, Clerk prefill effect, `confirmedItems` snapshot
- `tests/unit/lib/checkout/digital-only.test.ts` — new, 11 assertions
- `tests/unit/components/checkout-digital-only-source.test.ts` — new, 16 assertions
- `.planning/phases/10-gift-card-purchase-flow/10-VALIDATION.md` — filled, `status: validated`

## Decisions Made
- **Excluded the empty-cart composition from the paired-invariant test loop.** `hasPhysicalCheckoutLines([])` is vacuously `false` (no items to disagree with), so its negation is `true`, while `isDigitalOnlyCart([])` is `false` by design — an empty cart hits the empty-cart branch before any step UI renders, per the plan's own must_haves. The invariant is meaningful only over an actual, non-empty fulfilment mix; the empty-array case stays covered by its own standalone assertion.
- **`createPaymentIntent` takes an explicit `addressOverride` parameter.** The digital branch calls `setShippingAddress` and `createPaymentIntent` inside the same handler tick, so reading the destructured `shippingAddress` store value would post the previous render's address (or nothing, on first submit) rather than what the shopper just typed (T-10-14, planner-found hazard, not weakened or worked around — fixed at the source).
- **Clerk prefill is unconditional on `isDigitalOnly`.** A signed-in shopper's own name and email are equally correct to prefill on a physical checkout; the empty-field guard makes running the effect on every render harmless either way, matching the plan's explicit instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in own test] Removed the empty-cart composition from the Task 1 paired-invariant loop**
- **Found during:** Task 1, confirming GREEN
- **Issue:** My own RED test asserted the paired invariant (`isDigitalOnlyCart` vs. the negation of `hasPhysicalCheckoutLines`) for all five compositions the plan's behavior block lists, including the empty array. That assertion is mathematically impossible to satisfy: `hasPhysicalCheckoutLines([])` is vacuously `false`, so its negation is `true`, while `isDigitalOnlyCart([])` is correctly `false` per the plan's own must_haves ("An empty cart hits the existing empty-cart branch before any step UI renders, and the digital-only helper returns false for an empty list").
- **Fix:** Restricted the paired-invariant `describe` block to the four non-empty compositions (`fixtures.filter((f) => f.cartItems.length > 0)`), with a comment explaining why, and kept the standalone `isDigitalOnlyCart([]) === false` assertion outside the loop.
- **Files modified:** `tests/unit/lib/checkout/digital-only.test.ts`
- **Commit:** `597eeb8`

**2. [Rule 1 - Bug] Restructured the Clerk-email prefill to a single `primaryEmailAddress` occurrence line**
- **Found during:** Task 2, confirming GREEN
- **Issue:** The plan's acceptance criteria require `grep -c "primaryEmailAddress" components/checkout/CheckoutClient.tsx` to return exactly 1 (matching lines, not total occurrences). My first implementation read `user.primaryEmailAddress?.emailAddress` in the guard condition and `user.primaryEmailAddress.emailAddress` again in the assignment — two separate matching lines.
- **Fix:** Hoisted the read into a single `const clerkEmail = user.primaryEmailAddress?.emailAddress;` line, then guarded and assigned from that local — one occurrence, same behavior.
- **Files modified:** `components/checkout/CheckoutClient.tsx`
- **Commit:** `381a602`

**3. [Rule 1 - Bug] Renamed the pre-existing "Shipping Address Section" JSX comment**
- **Found during:** Task 2, confirming GREEN
- **Issue:** The plan's acceptance criteria require `grep -c "Shipping Address" components/checkout/CheckoutClient.tsx` to return exactly 2 (the outer wrapper heading and the recap heading, both now conditional ternaries). The pre-existing `{/* Shipping Address Section */}` comment above the panel was a third matching line, pushing the count to 3.
- **Fix:** Renamed the comment to `{/* Address Section */}` — a cosmetic, non-functional change with no effect on rendered output.
- **Files modified:** `components/checkout/CheckoutClient.tsx`
- **Commit:** `381a602`

**4. [Rule 1 - Bug] Removed a duplicated "Nothing ships" comment phrase**
- **Found during:** Task 2, confirming GREEN
- **Issue:** The plan's acceptance criteria require `grep -c "Nothing ships" components/checkout/CheckoutClient.tsx` to return exactly 1 (the rendered helper string). An explanatory code comment I wrote above the digital branch also began "// Nothing ships:", pushing the count to 2.
- **Fix:** Reworded the comment to "A digital-only cart has nothing to ship: ..." — same explanation, no duplicate literal.
- **Files modified:** `components/checkout/CheckoutClient.tsx`
- **Commit:** `381a602`

**5. [Rule 1 - Bug] Removed the blank line between the second `setConfirmedItems` snapshot and its `clearCart()` call**
- **Found during:** Task 3, confirming GREEN
- **Issue:** The plan's acceptance criteria require `grep -B2 "clearCart()" ... | grep -c "setConfirmedItems"` to return 2 (one match per clear site, from the 2 lines immediately preceding each `clearCart()`). In `handlePaymentSuccess` I had left a blank line and a separate comment between `setConfirmedItems(items);` and `clearCart();`, so the `-B2` window around that site's `clearCart()` captured the blank line and comment instead of the snapshot call.
- **Fix:** Removed the blank line and comment, matching the tight `// comment` + `setConfirmedItems(items);` + `clearCart();` shape already used at the first site.
- **Files modified:** `components/checkout/CheckoutClient.tsx`
- **Commit:** `d6adaac`

**6. [Rule 1 - Bug] Removed a duplicate `/api/shipping-options` literal from a comment**
- **Found during:** Task 3, final self-check re-run of every task's acceptance criteria before writing this SUMMARY
- **Issue:** The plan's Task 1 acceptance criteria require `grep -c "/api/shipping-options" components/checkout/CheckoutClient.tsx` to return exactly 1 (the single physical-path fetch, no second call site added). The digital branch's explanatory comment also spelled out the literal endpoint path, pushing the count to 2. This slipped past Task 1's own acceptance-criteria check because that specific grep wasn't re-verified until the final Task 3 self-check swept every criterion again.
- **Fix:** Reworded the comment to describe the lookup being skipped without repeating the literal path string; no behavior change.
- **Files modified:** `components/checkout/CheckoutClient.tsx`
- **Commit:** `3c90723`

No other deviations. All three TDD RED phases produced genuine per-test assertion failures (module-load stubs and existing-but-incomplete source, never a crash); all fixes above were self-authored test/comment/acceptance-criteria alignment issues found while confirming GREEN, not implementation bugs.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None.

## Next Phase Readiness
This was the last plan in Phase 10. Both `<human-check>` items recorded above (D10, D11) are deferred to phase-close review per `workflow.human_verify_mode: end-of-phase` — a live-browser 360px label check and a real Stripe test-mode gift-card purchase, both against wiring already proven correct by source-contract tests in this plan and 10-04. Phase 11 (production flags and key secrets) and Phase 12 (support article, Volt re-index, Terms, live paid-order proof SHOP-07) are unblocked; nothing in this plan touched `lib/gift-cards/`, `app/api/`, `lib/services/`, `lib/stores/cart-store.ts`, `lib/models/`, `migrations/`, or `lib/db/schema/`.

---
*Phase: 10-gift-card-purchase-flow*
*Completed: 2026-09-08*

## Self-Check: PASSED

- All key files exist on disk (verified via `[ -f ... ]` for `lib/checkout/digital-only.ts`, both new test files, `components/checkout/CheckoutClient.tsx`, `10-VALIDATION.md`, and this SUMMARY).
- `git log --oneline --all --grep="10-05"` returns 7 matching commits (an 8th, `3c90723`, uses `fix(10-05):` and was independently confirmed present via `git log --oneline`).
- All three tasks' acceptance criteria re-run clean against the final tree (`isDigitalOnlyCart`/`DIGITAL_SHIPPING_METHOD_ID`/`DIGITAL_CHECKOUT_STEPS` export counts, `/api/shipping-options` count of 1, `Billing details`/`Nothing ships`/`primaryEmailAddress`/`Shipping Address`/`border-l-4 border-success` counts, `confirmedItems`/`clearCart()`/`setConfirmedItems`-precedes-clear/`items={confirmedItems}` counts, `nyquist_compliant: true` count of 1, and every fenced-directory diff empty).
- The plan's overall `<verification>` block re-run clean: full CI gate order (`lint`, `typecheck`, `cf-typecheck`, `scan:tokens`, `test` [277/2326], `test:workers` [27/154], `test:observability-worker` [1/3], `docs:lint`, `build`) all pass; `git diff --stat` over the fenced paths and `docs/` is empty; `10-VALIDATION.md` shows every row green with `wave_0_complete: true` and `nyquist_compliant: true`.
