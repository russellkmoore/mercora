---
phase: 15-subscription-address-in-place
plan: 02
subsystem: subscriptions
tags: [react, next.js, radix-dialog, subscriptions, account-addresses]

# Dependency graph
requires:
  - phase: 15-subscription-address-in-place plan 01
    provides: "components/account/AddressForm.tsx and lib/account/address-client.ts saveAddress, consumed verbatim by AddAddressDialog"
provides:
  - "components/subscriptions/acquisition-client.ts: ADD_NEW_ADDRESS_VALUE, nextAddressSelection"
  - "components/subscriptions/AddAddressDialog.tsx: the token-class modal wrapping the shared AddressForm, locked to shipping"
  - "components/subscriptions/SubscriptionAcquisitionPanel.tsx: sentinel-driven address select, post-save refresh/pre-select/reset"
affects: [15-subscription-address-in-place plan 03 (phase-level gate: package.json/package-lock.json unmodified)]

# Actuals (#2632)
actuals:
  tokens: 4030
  tasks: 3
  commits: 4
  plan_head_before: 06108da3785a1a6b7df75974874d5cdb3e14896f

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A pure selection helper (nextAddressSelection) centralizes a rule used at two call sites (initial load, post-save) so both stay in sync by construction rather than by duplicated inline logic."
    - "Marker comments (// address-save-region:start / :end) scope a source-contract test to exactly one function body, so a whole-file substring negative doesn't false-positive on setters that legitimately appear elsewhere in the file."

key-files:
  created:
    - components/subscriptions/AddAddressDialog.tsx
    - .planning/phases/15-subscription-address-in-place/tdd-evidence/15-02-task1-red.json
  modified:
    - components/subscriptions/acquisition-client.ts
    - components/subscriptions/SubscriptionAcquisitionPanel.tsx
    - tests/unit/components/subscriptions/acquisition-client.test.ts
    - tests/unit/components/subscriptions/product-acquisition-source.test.ts
    - tests/unit/components/account/address-form-source.test.ts

key-decisions:
  - "The empty-string placeholder option's label changes based on visibleAddresses.length (\"Add an address to continue\" vs \"Select an address\") rather than being removed for the empty case, keeping the select's option list shape identical (placeholder + saved + sentinel) regardless of how many addresses exist."
  - "AddAddressDialog is rendered unconditionally inside the signed-in, no-setup branch (not nested inside the shippingRequired conditional) -- it can only ever open because the sentinel option only exists inside the shippingRequired select, but keeping the dialog's own mount outside that conditional avoids remounting it (and losing in-flight form state) if shippingRequired ever toggled within a session."
  - "handleAddressSaved is a hoisted function declaration (not a useCallback) placed once, after the facts memo -- referenced by the JSX below it and by the onSaved prop, with no dependency-array staleness risk since it closes over component-scope values freshly on every render."

patterns-established:
  - "Second consumer of AddressForm (AddAddressDialog) follows the exact prop contract published by 15-01: mode/lockType/submitLabel/onSaved/onCancel, no field markup of its own -- any third surface should do the same."

requirements-completed: [SUB-01, SUB-03]

coverage:
  - id: D1
    description: "nextAddressSelection(addresses, preferredId) and ADD_NEW_ADDRESS_VALUE in acquisition-client.ts: single selection rule used by both the load effect and the post-save handler; never returns the sentinel."
    requirement: SUB-03
    verification:
      - kind: unit
        ref: "tests/unit/components/subscriptions/acquisition-client.test.ts#nextAddressSelection (6 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The shipping-address select always offers \"Add a new address…\", is disabled only while loading (never for an empty list), and the sentinel option opens AddAddressDialog without writing addressId or touching the previously selected value; the navigating \"Manage addresses\" link and empty-state paragraph are removed."
    requirement: SUB-01
    verification:
      - kind: unit
        ref: "tests/unit/components/subscriptions/product-acquisition-source.test.ts#uses Clerk and Stripe Elements without persisting or logging provider secrets (extended with SUB-01 assertions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AddAddressDialog wraps the shared AddressForm (mode=create, lockType=shipping) in token-class Dialog/DialogContent/DialogHeader markup matching OrderConfirmationModal's structure, with no field markup or gsd:scan-ignore sentinel of its own."
    requirement: SUB-01
    verification:
      - kind: unit
        ref: "tests/unit/components/account/address-form-source.test.ts#SUB-01/SUB-03 source contract: the subscription-PDP modal is the second AddressForm consumer (4 tests)"
        status: pass
      - kind: other
        ref: "npm run scan:tokens"
        status: pass
    human_judgment: false
  - id: D4
    description: "After a successful save, handleAddressSaved (the address-save-region) re-fetches through fetchSavedAddressesForPlan, re-scopes addressesOwner to the current owner, pre-selects the saved address via nextAddressSelection, resets setup/checkoutError/completedOwner, and never touches selectedPlanId, quantityText, or accepted."
    requirement: SUB-03
    verification:
      - kind: unit
        ref: "tests/unit/components/subscriptions/product-acquisition-source.test.ts#region-scoped SUB-03 assertions"
        status: pass
    human_judgment: true
    rationale: "The region-scoped source contract proves the handler's static shape (which setters it calls and doesn't call) deterministically, but the actual async refresh-then-select flow -- clicking the sentinel, saving in the modal, watching the list refresh and the new address become selected while the plan/quantity/terms controls visibly hold their values -- has no render/behavior test in this repo (vitest runs in node environment, no jsdom, same constraint 15-01 documented). A human should click through this flow once on a shipping-required subscription product page before it is fully trusted."

# Metrics
duration: ~25min
completed: 2026-09-10
status: complete
---

# Phase 15 Plan 02: Address In Place on the Subscription Panel Summary

**Replaced the subscription panel's "manage addresses" navigation link with a sentinel-driven select option that opens a token-class modal (the shared `AddressForm` locked to shipping); saving refreshes the list, pre-selects the new address, and leaves plan, quantity, and terms acceptance untouched.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-10T23:00:00Z (approx)
- **Completed:** 2026-09-10T23:22:00Z (approx)
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- `nextAddressSelection` + `ADD_NEW_ADDRESS_VALUE` in `acquisition-client.ts`: the single, unit-tested selection rule now used at both the address-load effect and the post-save handler, guaranteeing the sentinel can never become the stored `addressId`.
- `AddAddressDialog.tsx`: a new token-class modal (`bg-surface-elevated`, `text-foreground`, `text-muted-foreground`) that renders the shared `AddressForm` from plan 15-01 with `mode="create"` and `lockType="shipping"` -- no field markup of its own, no `gsd:scan-ignore` sentinel.
- `SubscriptionAcquisitionPanel.tsx`: the shipping-address select is disabled only while loading (never for an empty list), always offers "Add a new address…", and choosing it opens the modal without disturbing the current selection. The "Manage addresses" navigation link and empty-state paragraph are gone.
- `handleAddressSaved`, bounded by `// address-save-region:start/:end` markers, refreshes the list through the same `fetchSavedAddressesForPlan` validation path used on load, re-scopes `addressesOwner`, pre-selects the saved address, and resets exactly `setup`/`checkoutError`/`completedOwner` -- plan, quantity, and terms acceptance are untouched.
- SUB-01 and SUB-03 are now pinned by source contracts: the navigating link and the old two-clause disable expression are asserted absent, and the post-save region is asserted to contain the three resets and the selection call while containing none of the plan/quantity/terms setters.

## Task Commits

Each task was committed atomically; Task 1 (`tdd="true"`) produced a RED commit and a GREEN commit:

1. **Task 1 RED: failing test for `nextAddressSelection`** - `54705c4` (test)
1. **Task 1 GREEN: implement `nextAddressSelection`** - `75907b9` (feat)
2. **Task 2: the modal and the panel wiring** - `ba75198` (feat)
3. **Task 3: SUB-01 and SUB-03 source contracts** - `26c8e26` (test)

_No REFACTOR commit for Task 1 -- the GREEN implementation needed no cleanup._

**Plan metadata:** committed separately as `docs(15-02): complete Address In Place on the Subscription Panel plan`.

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed the full RED → GREEN cycle:

- **RED:** Six behaviour cases were added to `tests/unit/components/subscriptions/acquisition-client.test.ts` first (preferredId hit, default fallback, first-entry fallback, empty list, sentinel-as-preferredId rejection, and an ID_PATTERN-collision proof through the public surface), targeting `nextAddressSelection` before it existed. Run against the unmodified `acquisition-client.ts`, all six failed with `TypeError: nextAddressSelection is not a function` (exit 1). Classified `RED_EVIDENCE_OK` by `gsd-tools check tdd-red-evidence` (evidence persisted at `.planning/phases/15-subscription-address-in-place/tdd-evidence/15-02-task1-red.json`; target test: `nextAddressSelection > returns preferredId when an entry in the list has that id`).
- **GREEN:** `ADD_NEW_ADDRESS_VALUE` and `nextAddressSelection` were added to `acquisition-client.ts` exactly as specified. All 25 tests in the file went green; typecheck and lint stayed clean.
- **REFACTOR:** not needed -- the minimal implementation required no follow-up commit.

**Note on tooling:** the same vitest `tap-flat` trailer gap documented in plan 15-01's summary applies here -- the `# tests`/`# pass`/`# fail` trailer was computed from the real `ok`/`not ok` line counts (19 pass, 6 fail, 25 total) and appended before validation.

## Files Created/Modified

- `components/subscriptions/AddAddressDialog.tsx` -- new. Token-class modal wrapping the shared `AddressForm`, locked to shipping.
- `components/subscriptions/acquisition-client.ts` -- modified. Adds `ADD_NEW_ADDRESS_VALUE` and `nextAddressSelection`.
- `components/subscriptions/SubscriptionAcquisitionPanel.tsx` -- modified. Sentinel option, dialog wiring, post-save refresh/pre-select/reset, removed navigation link.
- `tests/unit/components/subscriptions/acquisition-client.test.ts` -- modified. `nextAddressSelection` behaviour cases (6 tests).
- `tests/unit/components/subscriptions/product-acquisition-source.test.ts` -- modified. SUB-01 + SUB-03 source contract additions.
- `tests/unit/components/account/address-form-source.test.ts` -- modified. Second-consumer half of the one-form contract for `AddAddressDialog`.

## Decisions Made

- The placeholder option's copy is conditional (`"Add an address to continue"` when the list is empty, `"Select an address"` otherwise) rather than swapping the whole option list, so the select's structural shape (placeholder + saved entries + sentinel) is identical in every state -- this is also what makes "the select is enabled whenever the list is not loading, regardless of count" trivially true rather than a special case.
- `AddAddressDialog` is mounted unconditionally in the signed-in/no-setup branch rather than nested inside the `shippingRequired` conditional, so a mid-session `shippingRequired` change (a plan switch) cannot unmount the dialog while it is open and discard in-progress form input.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SUB-01 and SUB-03 are fully implemented and pinned by automated source contracts; `npm run lint && npm run typecheck && npm run scan:tokens` are all clean, and the full suite (`npm test`) passes at 308 files / 2774 tests.
- `git diff --quiet -- app/api components/checkout migrations` is clean -- no API, checkout, or migration surface was touched, matching the plan's threat-model boundary.
- Plan 15-03's phase-level gate (package.json/package-lock.json unmodified across the phase) is satisfied: this plan installed nothing, reusing the already-present Radix dialog primitive.
- A human should click through the modal flow once on a live shipping-required subscription product page (open the select with zero and with existing addresses, save a new one, confirm the list refreshes and the new address is pre-selected while quantity/terms/plan stay put) before this is fully trusted -- see D4's `human_judgment: true` rationale above.

---
*Phase: 15-subscription-address-in-place*
*Completed: 2026-09-10*

## Self-Check: PASSED

- FOUND: components/subscriptions/AddAddressDialog.tsx
- FOUND: components/subscriptions/acquisition-client.ts
- FOUND: components/subscriptions/SubscriptionAcquisitionPanel.tsx
- FOUND: tests/unit/components/subscriptions/acquisition-client.test.ts
- FOUND: tests/unit/components/subscriptions/product-acquisition-source.test.ts
- FOUND: tests/unit/components/account/address-form-source.test.ts
- FOUND: 54705c4 (test(15-02): add failing test for nextAddressSelection)
- FOUND: 75907b9 (feat(15-02): implement nextAddressSelection)
- FOUND: ba75198 (feat(15-02): add-address modal and shipping-select wiring)
- FOUND: 26c8e26 (test(15-02): pin SUB-01/SUB-03 source contracts)
- Re-ran plan `<verification>`: `npm run lint && npm run typecheck && npm run scan:tokens` -- 0 errors, 0 violations; `mise exec -- npx vitest run tests/unit/components/subscriptions tests/unit/components/account tests/unit/app/account-security-source.test.ts` -- 59/59 pass; `git diff --quiet -- app/api components/checkout migrations` -- clean.
- Full suite: `npm test` -- 308 files / 2774 tests passed.
- Commit ledger: `plan_head_before=06108da3785a1a6b7df75974874d5cdb3e14896f`, `git rev-list --count 06108da..HEAD` = 4, matching `commits: 4` in frontmatter.
