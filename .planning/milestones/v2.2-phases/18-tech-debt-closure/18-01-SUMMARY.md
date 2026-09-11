---
phase: 18-tech-debt-closure
plan: 01
subsystem: payments
tags: [order-confirmation, email, gift-cards, billing-address, next.js, vitest]

requires: []
provides:
  - "Gift-card-only orders now send a customer confirmation and a merchant notification instead of resolving skipped"
  - "OrderData.addressLabel ('shipping' | 'billing') threaded from order-confirmation service through both email templates and the account order-detail page"
affects: [18-tech-debt-closure remaining plans, any future work touching order-confirmation.ts or lib/utils/email.ts]

actuals:
  tokens: 4703
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "addressLabel union ('shipping' | 'billing') as the single signal carrying which address source was used, consumed identically by both email templates and the account page"

key-files:
  created: []
  modified:
    - lib/services/order-confirmation.ts
    - lib/utils/email.ts
    - app/account/orders/[id]/page.tsx
    - tests/unit/lib/services/order-confirmation.test.ts
    - tests/unit/lib/utils/order-confirmation-email.test.ts
    - tests/unit/lib/utils/merchant-notification.test.ts
    - tests/unit/app/order-detail-gift-card-source.test.ts

key-decisions:
  - "Guard written as a union (subscription flag OR !hasPhysicalCheckoutLines), not a replacement — a subscription renewal's OrderItem carries no fulfillment_type, so hasPhysicalCheckoutLines alone reads it as physical and would silently re-skip renewal emails"
  - "generateOrderStatusUpdateHTML deliberately left unchanged, a documented deviation from D-18 — it renders the required-address OrderStatusUpdateData interface and is reached only from the physical-shipment status path, which a digital-only order never produces"

patterns-established:
  - "addressLabel travels with shippingAddress: present only when shippingAddress is present, 'billing' only when the address was a billing-address fallback"

requirements-completed: [DEBT-06]

coverage:
  - id: D1
    description: "A gift-card-only order sends its confirmation email and merchant notification instead of resolving skipped"
    requirement: "DEBT-06"
    verification:
      - kind: unit
        ref: "tests/unit/lib/services/order-confirmation.test.ts#sends a gift-card-only order confirmation with the billing address and label"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/services/order-confirmation.test.ts#sends the merchant notification for the same gift-card-only order"
        status: pass
    human_judgment: false
  - id: D2
    description: "The confirmation email and merchant notification name the fallback address as a billing address, not a shipping address"
    requirement: "DEBT-06"
    verification:
      - kind: unit
        ref: "tests/unit/lib/utils/order-confirmation-email.test.ts#names the address a billing address when addressLabel is billing, values unchanged"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/utils/merchant-notification.test.ts#labels a billing-labelled payload with order-items and billing-address headings"
        status: pass
    human_judgment: false
  - id: D3
    description: "The account order-detail page shows the billing address under a billing heading when no shipping address exists"
    requirement: "DEBT-06"
    verification:
      - kind: unit
        ref: "tests/unit/app/order-detail-gift-card-source.test.ts#resolves the address from shipping with a nullish fallback to billing"
        status: pass
      - kind: unit
        ref: "tests/unit/app/order-detail-gift-card-source.test.ts#renders the address section heading from a variable, not a hardcoded literal"
        status: pass
    human_judgment: false
  - id: D4
    description: "A digital subscription renewal keeps sending exactly as it does today (no regression from the widened guard)"
    requirement: "DEBT-06"
    verification:
      - kind: unit
        ref: "tests/unit/lib/services/order-confirmation.test.ts#delivers addressless digital renewal payloads to customer and merchant"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every physical-order and addressless-physical-order shape behaves exactly as before (no field renamed, no unwanted fallback)"
    requirement: "DEBT-06"
    verification:
      - kind: unit
        ref: "tests/unit/lib/services/order-confirmation.test.ts (4 pre-existing cases, unmodified)"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-11
status: complete
---

# Phase 18 Plan 01: Digital-Only Order Emails Show the Billing Address Summary

**Gift-card-only orders now send a confirmation email and merchant notification carrying the shopper's billing address, correctly labelled, closing DEBT-06's silent email-skip bug.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-11T11:51:08Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- `buildFulfillmentOrderData` now recognizes a plain gift-card-only order as legitimately addressless (not just a subscription renewal), so `sendOrderConfirmation` and `sendMerchantOrderNotification` send instead of silently resolving `{ success: true, skipped: true }`
- When no `shipping_address` exists on a digital-only order, the service falls back to `order.billing_address` and emits `addressLabel: 'billing'`; a physical order keeps its shipping address and now also carries `addressLabel: 'shipping'`
- Both order emails (`generateOrderConfirmationText`/`HTML`, `sendNewOrderMerchantNotification`) swap their heading/prefix to a billing-address wording only when `addressLabel` is `'billing'` — every other input renders byte-identical to before
- The account order-detail page falls back to the billing address with a matching computed heading, reusing the existing ownership-scoped query — no new PII-exposure path

## Task Commits

Each task was committed atomically (TDD split for tasks 2 and 3):

1. **Task 1: Widen the addressless-digital guard, thread the billing address out of the service** — `cd28a11` (feat)
2. **Task 2: Name the address correctly in both email templates** — `100f114` (test, RED) → `a2ebcd2` (feat, GREEN)
3. **Task 3: Fall back to billing on the account order-detail page** — `919d233` (test, RED) → `70ac30a` (feat, GREEN)

No REFACTOR commits — implementations were minimal on first pass; tests stayed green throughout.

**Plan metadata:** this SUMMARY commit (see below).

## Files Created/Modified
- `lib/services/order-confirmation.ts` — union guard (`subscription_shipping_required === false || !hasPhysicalCheckoutLines(order.items)`), billing-address fallback, `addressLabel` emission
- `lib/utils/email.ts` — `OrderData.addressLabel` field; label-aware heading/prefix in `generateOrderConfirmationText`, `generateOrderConfirmationHTML`, and `sendNewOrderMerchantNotification`
- `app/account/orders/[id]/page.tsx` — `address` falls back to `order.billing_address`; `addressHeading` computed const replaces the hardcoded "Shipping address" literal
- `tests/unit/lib/services/order-confirmation.test.ts` — `giftCardOnlyOrder()` fixture, confirmation + merchant-notification cases for it
- `tests/unit/lib/utils/order-confirmation-email.test.ts` — billing-label case
- `tests/unit/lib/utils/merchant-notification.test.ts` — billing-label and shipping-label cases
- `tests/unit/app/order-detail-gift-card-source.test.ts` — fallback + computed-heading source-contract assertions

## Decisions Made

**The planner-found subscription-renewal hazard (read before trusting the guard):** 18-RESEARCH.md and D-06 both described the fix as *replacing* `extensions.subscription_shipping_required === false` with `!hasPhysicalCheckoutLines(order.items)`. That replacement would have regressed digital subscription renewals: `lib/subscriptions/invoice-service.ts` (lines ~239-248) builds its renewal `OrderItem` with no `fulfillment_type` field at all, and `hasPhysicalCheckoutLines` tests `item.fulfillment_type !== 'digital'` — undefined `!== 'digital'` is `true`, so a digital renewal's line reads as physical. A straight replacement would have sent digital subscription renewals back to being silently skipped, the exact bug this plan exists to fix, on a different order shape. The guard is written as a **union** (`... || ...`) instead, with the existing renewal test (`delivers addressless digital renewal payloads to customer and merchant`) serving as the regression canary — it was left completely unmodified and still passes.

**D-18 deviation, logged deliberately:** `generateOrderStatusUpdateHTML` was NOT given the same billing-label treatment, against D-18's suggestion that all three address-rendering sites change. It renders `OrderStatusUpdateData`, a separate interface whose `shippingAddress` is required (not optional), and it is reached only from `sendOrderStatusUpdateEmail` on the physical-shipment status-update path — a digital-only order (no shipment) never produces a call into it. Extending it would have added an unused branch to code that structurally cannot receive a billing-labelled payload. This is an evidence-backed deviation, not an oversight; `tests/unit/lib/utils/order-status-email-tokens.test.ts` was re-run and passes unmodified, confirming the function's output is byte-identical.

## Deviations from Plan

None beyond the D-18 deviation documented above, which the plan itself anticipated and explicitly required recording rather than silently following D-18's original suggestion.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `addressLabel` is now the shared signal threaded through the order-confirmation service, both email templates, and the account page — later Phase 18 plans touching adjacent order/email code should reuse it rather than re-deriving a "was this a billing fallback" check.
- All verification gates green: `vitest run tests/unit/lib/services tests/unit/lib/utils tests/unit/app/order-detail-gift-card-source.test.ts` (282 tests passed), `npm run lint` (0 errors, pre-existing warnings only, none in touched files), `npm run typecheck` (clean), `npm run scan:tokens` (0 violations).
- No blockers for sibling plans 18-02..18-06 — this plan touched only its declared 7 files.

## Self-Check: PASSED

- `lib/services/order-confirmation.ts` — FOUND
- `lib/utils/email.ts` — FOUND
- `app/account/orders/[id]/page.tsx` — FOUND
- `tests/unit/lib/services/order-confirmation.test.ts` — FOUND
- `tests/unit/lib/utils/order-confirmation-email.test.ts` — FOUND
- `tests/unit/lib/utils/merchant-notification.test.ts` — FOUND
- `tests/unit/app/order-detail-gift-card-source.test.ts` — FOUND
- Commit `cd28a11` — FOUND in `git log --oneline --all`
- Commit `100f114` — FOUND in `git log --oneline --all`
- Commit `a2ebcd2` — FOUND in `git log --oneline --all`
- Commit `919d233` — FOUND in `git log --oneline --all`
- Commit `70ac30a` — FOUND in `git log --oneline --all`
- All 12 acceptance criteria across the 3 tasks re-verified: PASS
- Plan-level `<verification>` re-run: PASS (282/282 tests, lint 0 errors, typecheck clean, scan:tokens 0 violations)

**Note on `actuals.commits` (#3968):** this plan ran in a shared checkout alongside five sibling executors (18-02..18-06) on the same branch, not isolated worktrees. `git rev-list --count <plan_head_before>..HEAD` therefore measures 17 commits — all six plans' interleaved work, not this plan's own cost. The `commits: 5` recorded above is scoped to this plan via `git log --grep "^(feat|test|fix|refactor)\(18-01\):"` against the same base, which is the honest measurement of what this plan itself committed. `plan_head_before: 73ace3c3795ca2a1be7cbaccbf2b4340885af20f` is recorded for reference; do not treat the raw `rev-list` delta as this plan's commit count in this shared-checkout run.

---
*Phase: 18-tech-debt-closure*
*Completed: 2026-09-11*
