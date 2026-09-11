---
phase: 13-gift-card-flags
plan: 04
subsystem: payments
tags: [gift-cards, feature-flags, checkout-pricing, payment-intent, vitest, tdd]

# Dependency graph
requires:
  - phase: 13-gift-card-flags
    provides: "13-01's GIFT_CARD_PRODUCT_TYPE constant and the honor-only tender gate this plan's redemption path depends on"
  - phase: 12-gift-card-delivery
    provides: "the gift-card tender error taxonomy and the `code:` response pattern /api/payment-intent already uses"
provides:
  - GiftCardSalesDisabledError — the server-side refusal of a gift-card line while selling is off
  - "priceCheckout's injectable giftCardSalesEnabled dependency, defaulting to a synchronous getStoreConfig() read"
  - "/api/payment-intent's gift_card_sales_disabled response code, distinct from gift_card_unavailable"
  - A cart-line unavailable mark and an honor-gated GiftCardApplyPanel
affects: [13-08, 14-gift-card-admin]

actuals:
  # chars/4 over the realized diff of this plan's six commits (21,407 chars).
  tokens: 5352
  tasks: 3
  # SIX commits belong to this plan (5ce5352, bed9df8, 3c60112, 9f9a7f3,
  # bc647e8, c04bd04) plus this SUMMARY's own docs commit. `git rev-list
  # --count caa3d8e..HEAD` reads 16, not 7: three sibling executors (13-02,
  # 13-03, 13-05) committed onto the same branch concurrently, so the ledger
  # instrument cannot isolate one plan in a shared tree. The measured range is
  # recorded below; the per-plan number is the enumerated hash list.
  commits: 6
plan_head_before: caa3d8efd52a8b78372c623dbece8d0df9f52b96

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A flag the server must not take from the request becomes an injectable dependency with a server-side default, so tests state the flag instead of mutating the environment"
    - "One shopper-facing problem, one response code: a refused sale and a refused code get different codes and different copy"

key-files:
  created:
    - tests/unit/components/gift-card-checkout-gating-source.test.ts
  modified:
    - lib/gift-cards/checkout.ts
    - lib/services/checkout-pricing.ts
    - app/api/payment-intent/route.ts
    - components/cart/CartItemCard.tsx
    - components/checkout/CheckoutClient.tsx
    - tests/unit/lib/services/checkout-pricing.test.ts
    - tests/unit/app/api/payment-intent-authority.test.ts

key-decisions:
  - "GiftCardSalesDisabledError lives in lib/gift-cards/checkout.ts, not capability.ts: capability.ts pulls in the repository and key ring, and the payment-intent test replaces the whole checkout-pricing module with a mock, so the route needs the class from somewhere that test leaves real"
  - "The sell boolean is an injected dependency defaulting to getStoreConfig(), never derived from options.capabilities (which carries capability objects, no raw flags) and never from a resolveRuntimeCommerceCapabilities() round trip that would touch the key ring to answer one boolean"
  - "The rejection sits ahead of the recipient-details check, so a bare gift-card line reports the sale being off rather than a missing recipient email"
  - "The cart mark does not disable the quantity buttons or auto-remove the line — the shopper decides; the server refuses the line either way"
  - "The apply panel is gated on honor, never on sell, so a shopper holding a balance can still redeem after the store stops selling (GCF-01, D-03)"

patterns-established:
  - "Pattern 1: a server-authoritative flag read is injected, not imported at the call site, so the test states the flag and the request can never supply it"
  - "Pattern 2: source-contract tests strip comments before asserting, so a file's own prose can neither satisfy nor violate a contract about what a shopper sees"

requirements-completed: [GCF-01, GCF-03]

coverage:
  - id: D1
    description: "With sell off, priceCheckout refuses a gift-card line with GiftCardSalesDisabledError instead of pricing it"
    requirement: GCF-01
    verification:
      - kind: unit
        ref: "tests/unit/lib/services/checkout-pricing.test.ts#gift-card sales flag (sell) at pricing time > refuses to price a gift-card line while selling is off"
        status: pass
    human_judgment: false
  - id: D2
    description: "With sell off, a gift-card line arriving with a gift-card code is refused as a sale before tender is considered, so the shopper is told the right thing"
    requirement: GCF-01
    verification:
      - kind: unit
        ref: "tests/unit/lib/services/checkout-pricing.test.ts#gift-card sales flag (sell) at pricing time > refuses the sale before considering tender when a gift-card line arrives with a code"
        status: pass
    human_judgment: false
  - id: D3
    description: "With sell off, redemption against a non-gift cart still resolves tender — stopping sales does not strand a paid-for balance"
    requirement: GCF-01
    verification:
      - kind: unit
        ref: "tests/unit/lib/services/checkout-pricing.test.ts#gift-card sales flag (sell) at pricing time > still redeems a gift-card code against a non-gift cart while selling is off"
        status: pass
    human_judgment: false
  - id: D4
    description: "POST /api/payment-intent returns 400 with code gift_card_sales_disabled for a refused sale, distinguishable from the tender error's gift_card_unavailable"
    requirement: GCF-01
    verification:
      - kind: unit
        ref: "tests/unit/app/api/payment-intent-authority.test.ts#names a gift card we have stopped selling instead of the generic pricing error"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/payment-intent-authority.test.ts#tells a stopped sale apart from a code that did not work"
        status: pass
    human_judgment: false
  - id: D5
    description: "A gift-card line already sitting in a saved cart is marked unavailable in the cart drawer while sell is off, in token classes"
    requirement: GCF-01
    verification:
      - kind: unit
        ref: "tests/unit/components/gift-card-checkout-gating-source.test.ts#marks a cart line unavailable only when it is a gift-card line and selling is off"
        status: pass
      - kind: other
        ref: "npm run scan:tokens => [scan-tokens] 0 violations"
        status: pass
    human_judgment: true
    rationale: "The source contract proves the condition and the token class, not that the mark reads clearly beside the line or wraps sanely on a narrow cart drawer — that needs a look"
  - id: D6
    description: "With honor off the checkout payment step renders no gift-card apply panel and no substitute copy"
    requirement: GCF-03
    verification:
      - kind: unit
        ref: "tests/unit/components/gift-card-checkout-gating-source.test.ts#renders the apply panel only inside a conditional on the honor flag"
        status: pass
      - kind: unit
        ref: "tests/unit/components/gift-card-checkout-gating-source.test.ts#says nothing in place of the panel when honoring is off"
        status: pass
    human_judgment: false
  - id: D7
    description: "With sell on and honor on, every pre-existing checkout-pricing, payment-intent and checkout source contract passes unchanged"
    verification:
      - kind: unit
        ref: "mise exec -- npm test => 287 files, 2439 tests passed"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-09-10
status: complete
---

# Phase 13 Plan 04: Checkout Gating Summary

**A gift-card line can no longer be priced or paid for while selling is off — the refusal is a server-side throw in `priceCheckout` with its own `/api/payment-intent` response code, and the cart marks a stale line while the redemption panel keeps following honor.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-10T16:30:39Z
- **Completed:** 2026-09-10T16:40:00Z
- **Tasks:** 3 of 3
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- **The guard that actually holds is on the server.** Plan 13-03 removed the add-to-cart control; this plan makes the browser's cooperation irrelevant. `priceCheckout` now throws `GiftCardSalesDisabledError` for any gift-card line while sell is off, so a hand-crafted POST carrying a gift-card line is refused before pricing, before tender and before any reservation (T-13-12).
- **The flag is injected, never taken from the request.** `giftCardSalesEnabled` joins `PricingDependencies` with a default that reads `getStoreConfig().commerce.features.giftCardAcquisition` synchronously. Nothing in the request body reaches it (T-13-13), and it does not resolve the runtime capability object — which would touch the gift-card key ring to answer one boolean.
- **Two problems, two answers.** `/api/payment-intent` maps the new error to `code: 'gift_card_sales_disabled'` with its own message. "Remove the gift card from your cart" is the right next step for a stale line; "check the code" is the right next step for a bad code. One shared code would have collapsed them (D-16, research assumption A2).
- **Redemption survives the sales stop.** The apply panel is gated on honor, not on sell, and the pricing tests pin that a gift-card code still resolves tender against a non-gift cart while selling is off — the exact GCF-01 case (T-13-15).
- **Thirty-four existing pricing assertions are untouched.** The `dependencies()` helper defaults the new key to sell-on, so all 30 `priceCheckout` calls in that file behave identically; the four new cases inject sell-off explicitly.

## Task Commits

1. **Task 1: priceCheckout rejects a gift-card line while selling is off** (TDD)
   - `5ce5352` test — four failing cases plus the helper default
   - `bed9df8` feat — the error class, the dependency, the hoisted read and the throw
2. **Task 2: /api/payment-intent surfaces a distinct sales-disabled code** (TDD)
   - `3c60112` test — the code assertion and the codes-differ assertion
   - `9f9a7f3` feat — the catch branch and the message constant
3. **Task 3: Cart-line mark and payment-step panel gating** (TDD)
   - `bc647e8` test — the new source contract
   - `c04bd04` feat — the cart mark and the honor-gated panel

## TDD Gate Compliance

Each task ran RED before GREEN, and each RED was verified with
`gsd_run check tdd-red-evidence` — all three returned `RED_EVIDENCE_OK`:

| Task | Target test | Actual RED failure |
|------|-------------|--------------------|
| 1 | `refuses to price a gift-card line while selling is off` | `expected null to be an instance of Error` — `priceCheckout` resolved a quote |
| 2 | `names a gift card we have stopped selling instead of the generic pricing error` | generic 400 with no `code` — the rejection fell through to the fallback |
| 3 | `marks a cart line unavailable only when it is a gift-card line and selling is off` | no such condition in the source |

**One format translation was needed to run the gate at all**, recorded here because it is
not obvious from the verdict: the checker parses `node --test` TAP, and this project runs
vitest. Vitest's TAP reporter indents nested test lines (the checker's regexes anchor at
column 0) and omits the `# tests` / `# pass` / `# fail` summary footer entirely. Each
evidence record therefore carries vitest's own TAP output dedented, with a footer carrying
the counts vitest itself printed. No number was invented; the raw runs are in the scratchpad
(`red-t1.tap`, `red-t2.tap`, `red-t3.tap`).

## Files Created/Modified

- `lib/gift-cards/checkout.ts` — `GiftCardSalesDisabledError`, deliberately here rather than in `capability.ts` so the route can import it without dragging in the repository and key ring
- `lib/services/checkout-pricing.ts` — `giftCardSalesEnabled` on `PricingDependencies` and `defaultDependencies`, read once per cart, with the throw ahead of the recipient-details check
- `app/api/payment-intent/route.ts` — `GIFT_CARD_SALES_DISABLED_MESSAGE` and a catch branch ahead of the tender branch
- `components/cart/CartItemCard.tsx` — the unavailable mark, conditioned on the recipient details plus the sell flag
- `components/checkout/CheckoutClient.tsx` — `GiftCardApplyPanel` wrapped in a conditional on `commerce.features.giftCardReconciliation`
- `tests/unit/lib/services/checkout-pricing.test.ts` — the helper default plus four sell-off cases (34 → 38 tests)
- `tests/unit/app/api/payment-intent-authority.test.ts` — two route cases (13 → 15 tests)
- `tests/unit/components/gift-card-checkout-gating-source.test.ts` — new, four cases

## Decisions Made

- **The gift-card type check reuses 13-01's `GIFT_CARD_PRODUCT_TYPE`** rather than a fifth inline `'gift_card'` literal in the pricing service. The pre-existing literals in that file are left alone; this plan does not own them.
- **The four new pricing cases inject the flag inline** (`dependencies({ giftCardSalesEnabled: vi.fn(() => false), ...catalogue() })`) rather than through a shared sell-off helper. A helper read better but hid the flag each case is about, and the plan's acceptance criterion counts the explicit mentions for exactly that reason.
- **`catalogue()` is a factory, not a shared object**, so the four cases cannot share mock call history.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test-shape rework so each new pricing case names the flag it tests**
- **Found during:** Task 1
- **Issue:** The first draft factored the sell-off dependency into a `sellOffDependencies()` helper. It read well but left only two literal mentions of `giftCardSalesEnabled` in the file, against the plan's acceptance criterion of at least five — and the criterion is right: a reader of one case could not see which flag state it asserted.
- **Fix:** Replaced the helper with a `catalogue()` fixture factory; each case now spreads `giftCardSalesEnabled: vi.fn(() => false)` itself.
- **Files modified:** `tests/unit/lib/services/checkout-pricing.test.ts`
- **Verification:** `grep -c 'giftCardSalesEnabled'` prints 5; 38 tests pass.
- **Committed in:** `bed9df8`

**2. [Rule 1 - Bug] A source-contract assertion counted the module path as a call site**
- **Found during:** Task 3
- **Issue:** The plan's criterion is `grep -c 'GiftCardApplyPanel'` = 2, which counts *lines*. The test counted *occurrences* and saw 3, because `import GiftCardApplyPanel from './GiftCardApplyPanel'` mentions the name twice. The assertion would have failed against a correct implementation.
- **Fix:** Assert exactly one `<GiftCardApplyPanel` render site plus the presence of the import — which is what "no second, ungated call site" actually means.
- **Files modified:** `tests/unit/components/gift-card-checkout-gating-source.test.ts`
- **Verification:** 4 cases pass; `grep -c 'GiftCardApplyPanel' components/checkout/CheckoutClient.tsx` prints 2 as the plan specified.
- **Committed in:** `c04bd04`

### Concurrency artifact (not a code deviation)

**3. A sibling plan's SUMMARY rode along in one of this plan's commits**
- **Found during:** Task 2
- **Issue:** `3c60112` contains `.planning/phases/13-gift-card-flags/13-03-SUMMARY.md` alongside this plan's test file. Four executors share one working tree and one git index in this wave; plan 13-03 had staged its SUMMARY when this plan's `git commit` ran, and `git commit` commits the whole index, not just the paths a preceding `git add` named.
- **Fix:** None applied. The file's content is 13-03's and is correct; un-committing it would delete a sibling's finished artifact from the tree, which is strictly worse than an odd commit boundary.
- **Impact:** Cosmetic. 13-03's own docs commit will have found nothing left to commit for that path.
- **Note for future waves:** `git commit` has no path-scoped form that respects a prior staged state; `git commit -- <paths>` bypasses the index entirely and would have dropped the sibling's staged content instead. In a shared tree the only real fix is one tree per executor.

---

**Total deviations:** 2 auto-fixed (1 × Rule 3, 1 × Rule 1) plus 1 documented concurrency artifact
**Impact on plan:** None on behaviour. Both auto-fixes were to this plan's own new tests, correcting assertions that would have measured the wrong thing. No production code deviated from the plan.

## Issues Encountered

- **`npm run typecheck` failed mid-Task-1** with `Module '@/lib/gift-cards/repository' has no exported member 'sumOutstandingGiftCardBalances'` — a half-landed state from concurrent plan 13-05, in a file this plan never touches. Left alone per the scope boundary; it cleared on its own once 13-05 committed its repository export, and the final typecheck is clean.

## Verification

| Gate | Result |
|------|--------|
| `mise exec -- npm test` | 287 files, 2439 tests passed |
| `npm run typecheck` | clean |
| `npm run lint` | 0 errors (52 pre-existing warnings) |
| `npm run scan:tokens` | 0 violations |
| ADR-CTB-10: `lib/gift-cards/capability.ts` and `repository.ts` | untouched by every commit in this plan — reservation, settlement, release and restore are unchanged |

## User Setup Required

None — no external service configuration required. Both flags are existing
deploy-time `wrangler.jsonc` vars and are currently `"true"`, so this plan's
branches are dead in production today.

## Next Phase Readiness

- `GiftCardSalesDisabledError` and the `gift_card_sales_disabled` code are available to any surface that needs to tell a shopper why a checkout was refused.
- The cart mark is advisory; a shopper who ignores it is still refused by the server, so no follow-up plan needs to force-remove the line.
- Not done here, and not in scope: nothing removes a stale gift-card line automatically, and the checkout client does not yet render the new `code` — it falls into the existing generic error display. If Phase 13's UAT wants the specific copy on screen, that is a small follow-up in the checkout error handler.

---
*Phase: 13-gift-card-flags*
*Completed: 2026-09-10*

## Self-Check: PASSED

All 8 source files and the SUMMARY exist on disk; all 6 task commits resolve in
`git log`. No missing items.
