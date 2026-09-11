---
phase: 18-tech-debt-closure
plan: 04
subsystem: cart
tags: [cart, gift-cards, zustand, react, vitest, ledger]

requires:
  - phase: 12-content-assistant-live-proof
    provides: parseGiftCardCustomization's URL-like note rejection (the rule whose interaction with cart hydration created ledger entry 10)
provides:
  - "giftCardNoteInvalid flag on CartItem/StableCartItem"
  - "normalizeCartItemForStore surviving a rejected gift note instead of dropping the whole line"
  - "projectCartLineForCheckout refusing a flagged line before it can reach checkout pricing"
  - "CartItemCard advisory warning + remediation copy for a flagged line"
affects: [checkout, gift-cards, cart-migration]

actuals:
  tokens: 3300
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Split try/catch in normalizeCartItemForStore: price failure still nulls the whole line, customization failure flags-and-survives instead"
    - "Flag forwarding through re-normalization: normalizeCartItemForStore seeds giftCardNoteInvalid from the candidate itself so projectCartLineForCheckout's second pass (no customization left to fail on) still sees the flag"

key-files:
  created: []
  modified:
    - lib/types/cartitem.ts
    - lib/gift-cards/line-identity.ts
    - lib/stores/cart-store.ts
    - components/cart/CartItemCard.tsx
    - tests/unit/lib/gift-cards/line-identity.test.ts
    - tests/unit/lib/stores/cart-store-lines.test.ts
    - tests/unit/components/cart-line-source.test.ts
    - .planning/WINDOWS.md

key-decisions:
  - "Deliberate deviation from D-03's literal wording, per the plan's own interface contract: the flagged item does NOT preserve the customization 'as-is'. It carries the flag and no giftCardCustomization key at all, because writing an unvalidated blob into a field typed as validated GiftCardCustomization would be a type lie and would hand every downstream reader (including projectCartLineForCheckout on a second normalization pass) a value that looks trusted. What D-03 actually needs — the line survives, the shopper is told — holds; the note text itself is unrecoverable, which is why the remediation copy is remove-and-re-add."
  - "D-15 confirmed, not assumed: grepped for any client-side gate on giftCardLineUnavailable before adding one for giftCardNoteInvalid. None exists — the flag is advisory-only and the component's own pre-existing comment already says the server refuses the line regardless. No client gate was invented; the real refusal is projectCartLineForCheckout throwing, backstopped by checkout-pricing.ts's own gift-card validation."
  - "Two pre-existing test assertions had to change despite the plan's 'do not change existing cases' instruction, because they directly tested the exact behavior this plan intentionally changes: a malformed-customization item (extra/disallowed key, e.g. a smuggled redemptionToken) used to return null from normalizeCartItemForStore and is now flagged instead. Updated in tests/unit/lib/gift-cards/line-identity.test.ts (the redemptionToken case) and tests/unit/lib/stores/cart-store-lines.test.ts (the secret-stripping migration case, whose merged quantity changes from 2 to 3 because the previously-dropped line now merges in as a third no-customization line). All other pre-existing cases in both files pass unmodified."
  - "normalizeCartItemForStore forwards an already-set giftCardNoteInvalid flag from its input when there is no customization left to (re-)parse. Without this, projectCartLineForCheckout's internal re-normalization of an already-flagged StableCartItem would lose the flag (no customization present to fail on) and let the line through — exactly the security gap Task 1 step 3 exists to close."
  - "Recorded broken-windows entry 12 rather than fixing: lib/checkout/digital-only.ts's isDigitalOnlyCart keys on giftCardCustomization presence, so a cart holding only a flagged (invalid-note) gift-card line is misclassified as not-digital-only. Not fixed here — that file is owned by plan 18-02 (D-05), outside 18-04's files_modified scope. Checkout still refuses the line regardless of which UI step it shows first."

coverage:
  - id: D1
    description: "A persisted cart line with an unparseable gift note survives hydration, flagged, instead of vanishing (ledger entry 10)."
    requirement: "DEBT-03"
    verification:
      - kind: unit
        ref: "tests/unit/lib/gift-cards/line-identity.test.ts#flags a surviving line rather than dropping it when the note contains a link (ledger #10)"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/stores/cart-store-lines.test.ts#migrates a mixed valid/invalid persisted state with both lines surviving, flag on the invalid one only"
        status: pass
    human_judgment: false
  - id: D2
    description: "A flagged line cannot be projected into a checkout request — the client and store both refuse it before pricing."
    requirement: "DEBT-03"
    verification:
      - kind: unit
        ref: "tests/unit/lib/gift-cards/line-identity.test.ts#refuses to project a flagged line into a checkout request"
        status: pass
    human_judgment: false
  - id: D3
    description: "The cart UI shows an actionable, token-styled remediation warning on a flagged line, reusing the existing unavailable-line warning slot exactly."
    requirement: "DEBT-03"
    verification:
      - kind: unit
        ref: "tests/unit/components/cart-line-source.test.ts#invalid-gift-note advisory warning (D-03, ledger #10)"
        status: pass
      - kind: other
        ref: "npm run scan:tokens"
        status: pass
    human_judgment: false
  - id: D4
    description: "Lines that fail for any other reason (bad price, bad quantity, bad identifiers) are still dropped exactly as before."
    requirement: "DEBT-03"
    verification:
      - kind: unit
        ref: "tests/unit/lib/gift-cards/line-identity.test.ts#still drops the line entirely for a bad price, regardless of the note"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-09-11
status: complete
---

# Phase 18 Plan 04: Cart Lines Survive an Invalid Gift Note Summary

**`normalizeCartItemForStore` now flags a rejected gift note instead of deleting the cart line; `projectCartLineForCheckout` refuses to price a flagged line; `CartItemCard` tells the shopper how to fix it — closing broken-windows ledger entry 10.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-09-11T11:41:00Z
- **Completed:** 2026-09-11T12:23:00Z
- **Tasks:** 3
- **Files modified:** 8 (7 plan files + WINDOWS.md)

## Accomplishments
- `CartItem`/`StableCartItem` gained an optional `giftCardNoteInvalid` flag, set only when a stored gift note failed re-validation.
- `normalizeCartItemForStore` splits its former single `try` into two independent failure paths: a bad price still drops the whole line; a rejected gift-card customization now flags-and-survives with no customization carried forward.
- `projectCartLineForCheckout` throws its existing "Cart contains an invalid line" error for a flagged line, closing the security gap where a bare, unvalidated gift-card line could otherwise reach checkout pricing.
- `migrateCartState`'s merge tail carries the flag through both the fresh-push and the same-facts-merge branches.
- `CartItemCard.tsx` renders a second advisory warning, in the exact same slot/classes as the existing `giftCardLineUnavailable` warning, with the D-03 remediation copy.
- Ledger entry 10 marked `fixed` in `.planning/WINDOWS.md`; a new entry 12 recorded (not fixed — out of this plan's file scope) for a related edge case in `lib/checkout/digital-only.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: An unparseable gift note flags its line instead of deleting it, and checkout still refuses it** - `cfe00fd` (feat)
2. **Task 2 RED: failing test for the cart warning** - `43a6e6b` (test)
2. **Task 2 GREEN: cart warning implementation** - `86cdc59` (feat)
3. **Task 3: verification sweep, no production file** - no code commit; findings recorded in this SUMMARY and in `.planning/WINDOWS.md`

**Plan metadata:** committed alongside this SUMMARY.

_Task 2 carried `tdd="true"`: RED then GREEN, no REFACTOR commit — the GREEN implementation needed no cleanup._

## Files Created/Modified
- `lib/types/cartitem.ts` - adds the `giftCardNoteInvalid?: boolean` field with its doc comment
- `lib/gift-cards/line-identity.ts` - split price/customization failure handling; checkout-projection refusal for flagged lines; flag forwarding on re-normalization
- `lib/stores/cart-store.ts` - `migrateCartState`'s merge branch now carries the flag onto the accumulated line
- `components/cart/CartItemCard.tsx` - second advisory flag + warning paragraph, reusing the existing warning's className
- `tests/unit/lib/gift-cards/line-identity.test.ts` - new ledger-#10 regression, bad-price-still-drops case, no-flag-when-valid case, checkout-refusal case; one pre-existing case updated (see Deviations)
- `tests/unit/lib/stores/cart-store-lines.test.ts` - new mixed valid/invalid migration case (single run + determinism); one pre-existing case updated (see Deviations)
- `tests/unit/components/cart-line-source.test.ts` - new source-contract describe block for the flag/warning/no-checkout-gate
- `.planning/WINDOWS.md` - entry 10 marked fixed (closing commit `cfe00fd`); entry 12 recorded for the `digital-only.ts` edge case found during Task 3's collateral search

## Decisions Made
See `key-decisions` in the frontmatter for the full text. In short: the flagged item carries no customization (deviation from D-03's literal "preserved as-is" wording, per the plan's own interface contract); D-15 was confirmed by grep, not assumed, so no new client-side checkout gate was added; two pre-existing test assertions were updated because they directly asserted the old drop-the-line behavior for malformed customizations, which is exactly what this plan changes; the flag is forwarded through re-normalization so `projectCartLineForCheckout`'s second pass doesn't lose it; a related `digital-only.ts` edge case was recorded as ledger entry 12 rather than fixed, since that file belongs to plan 18-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `projectCartLineForCheckout` initially failed to refuse a flagged line**
- **Found during:** Task 1, writing the "refuses to project a flagged line" test
- **Issue:** `projectCartLineForCheckout` re-normalizes the already-stored `StableCartItem`. For a flagged line that stored item carries no `giftCardCustomization`, so the customization try/catch branch never runs on the second pass and `normalized.giftCardNoteInvalid` came back `undefined` — the guard silently let the line through instead of throwing.
- **Fix:** `normalizeCartItemForStore` now seeds `giftCardNoteInvalid` from `candidate.giftCardNoteInvalid === true` before attempting to parse any present customization, so the flag survives a second normalization pass with nothing left to fail on. A valid customization on that pass still clears it.
- **Files modified:** `lib/gift-cards/line-identity.ts`
- **Verification:** `tests/unit/lib/gift-cards/line-identity.test.ts#refuses to project a flagged line into a checkout request` passes.
- **Committed in:** `cfe00fd` (Task 1 commit)

**2. [Rule 1 - Bug, required by the feature itself] Two pre-existing test assertions updated**
- **Found during:** Task 1, first verify run
- **Issue:** `tests/unit/lib/gift-cards/line-identity.test.ts`'s "fails closed for invalid quantities and malformed customization" test, and `tests/unit/lib/stores/cart-store-lines.test.ts`'s "deterministically migrates legacy lines and strips non-cart secrets" test, both used a malformed `giftCardCustomization` (an extra/disallowed key, e.g. a smuggled `redemptionToken`/`code`) as their "this drops the whole line" fixture. That is precisely the behavior D-03 changes: a customization parse failure now flags-and-survives rather than nulling the line.
- **Fix:** Updated both assertions to expect the new, intended behavior (flagged, no customization, secret still stripped) rather than `null`/dropped. All other assertions in both files — quantity failures, price failures, stable-id cases, valid-customization cases — are unchanged.
- **Files modified:** `tests/unit/lib/gift-cards/line-identity.test.ts`, `tests/unit/lib/stores/cart-store-lines.test.ts`
- **Verification:** Both test files pass; `JSON.stringify` assertions confirm the smuggled secret string never appears in output.
- **Committed in:** `cfe00fd` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug in the checkout-refusal path, 1 pair of pre-existing test updates required by the feature's own intended behavior change). **Impact:** Both were necessary for correctness — the first closes a real security gap (T-18-15), the second brings two test assertions in line with the plan's own explicit spec. No scope creep.

## Issues Encountered

**Full-suite run showed one unrelated failure, not caused by this plan.** `mise exec -- npm test` reported `tests/unit/observability/instrumentation-source.test.ts > ... > wires every critical taxonomy event into executable producer code` failing (`gift_card.delivery_failed` not yet wired into `TAIL_CRITICAL_EVENTS` producer code). This is plan 18-05's (DEBT-04) in-flight work in this same shared checkout — confirmed via `git log`/`git status` showing an uncommitted change to `tests/integration/lib/services/gift-card-fulfillment.test.ts` from that plan's commit `d0be1cd` landing concurrently. None of the files this plan touches relate to telemetry. Re-running just this plan's three test files (`line-identity.test.ts`, `cart-store-lines.test.ts`, `cart-line-source.test.ts`) together: 25/25 pass. `npx tsc --noEmit` and `npm run lint` both pass with 0 errors (54 pre-existing warnings, none in this plan's files).

## Repository Search for Other Consumers (Task 3)

Searched for every caller of `normalizeCartItemForStore` and every reader of `giftCardCustomization` that might assume it's always present on a gift-card line:

- `lib/stores/cart-store.ts:159` (`addItem`) also calls `normalizeCartItemForStore`. Traced its only caller, `app/product/[slug]/ProductDisplay.tsx`'s `handleGiftCardAdd`, back to `components/product/GiftCardRecipientForm.tsx`, which already runs `validateGiftCardMessage` (the same `containsUrlLike` rule as `parseGiftCardCustomization`) client-side and disables submit while any field is invalid. An invalid note cannot reach `addItem` through the live UI — this path is unaffected by the D-03 change. No fix needed.
- `lib/checkout/digital-only.ts`'s `isDigitalOnlyCart` keys on `giftCardCustomization` presence to classify a cart as digital-only. A cart holding only a flagged (invalid-note) gift-card line now has no customization, so it would be misclassified as not-digital-only — a UI-only quirk (wrong intermediate checkout step), since `projectCartLineForCheckout` refuses the line regardless of which step shows first. Out of this plan's `files_modified`; recorded as ledger entry 12 instead of fixed (that file belongs to plan 18-02, D-05).
- `lib/gift-cards/checkout.ts`, `lib/services/checkout-pricing.ts`, `components/checkout/OrderConfirmationModal.tsx`, `components/checkout/OrderItemCard.tsx`: all operate on server-validated `OrderItem`s post-checkout, not client `CartItem`s — unaffected by this change.
- No test elsewhere in the repository asserted the old "drop the line" behavior for a customization parse failure, beyond the two updated in this plan (see Deviations).

**Result: none found requiring a fix inside this plan's owned files, beyond the two already listed above.**

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ledger entry 10 closed; DEBT-03 is functionally complete. The phase-gate plan (18-07) owns marking the `DEBT-03` requirement complete via its own `requirements mark-complete` step — not done here, by design (avoids the shared-ID race with sibling plans in this phase).
- New ledger entry 12 (`digital-only.ts` edge case) is open and scoped to plan 18-02 or a future cleanup — not a blocker for this plan or DEBT-03.
- No blockers for the phase-gate plan reading this SUMMARY.

## Self-Check: PASSED

All 7 plan-owned files confirmed present on disk. All 3 task commit hashes (`cfe00fd`, `43a6e6b`, `86cdc59`) confirmed in `git log`. Full acceptance-criteria loop re-run for each task before proceeding to the next; all passed.

---
*Phase: 18-tech-debt-closure*
*Completed: 2026-09-11*
