---
phase: 18-tech-debt-closure
plan: 03
subsystem: api
tags: [checkout, tax, gift-cards, order-effects, tdd, source-contract-test]

# Dependency graph
requires: []
provides:
  - "app/api/tax/route.ts and its dedicated test deleted; lib/services/checkout-pricing.ts is the only tax path left"
  - "lib/services/order-effects.ts gift-card effect branch passes the runtime's full worker environment through or nothing, never a database-only stand-in"
  - "Source-contract regression test locking the gift-card environment passthrough contract"
affects: [gift-cards, order-effects, checkout-pricing]

# Actuals (#2632)
actuals:
  tokens: 2875
  tasks: 2
  commits: 3
  # NOTE on commits: this plan ran as one of six parallel executors in a
  # SHARED checkout (workflow.use_worktrees: false, no worktree isolation
  # per parallel_execution). The rev-list count between this plan's
  # pre-commit base (23f1957) and current HEAD is 13, but that range
  # includes sibling plans' commits interleaved into the same branch. The
  # `3` reported here is this plan's own commits, verified via
  # `git log --grep="(18-03)"` -> 7a42cf1, 2b8d0f9, 0d5e5c7. See
  # "Deviations from Plan" for a fourth commit (73ace3c) that is NOT
  # tagged 18-03 but contains this plan's Task 1 file deletions.

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-contract test (readFileSync + string assertions on the source file itself) used to pin a construction-shape contract that no runtime test can express — copied from tests/unit/components/cart-line-source.test.ts"

key-files:
  created:
    - tests/unit/lib/services/order-effects-gift-card-env.test.ts
    - .planning/phases/18-tech-debt-closure/deferred-items.md
  modified:
    - lib/services/order-effects.ts
    - tests/unit/app/api/public-route-hardening.test.ts
  deleted:
    - app/api/tax/route.ts
    - tests/unit/api/tax-route.test.ts

key-decisions:
  - "Deleted app/api/tax/route.ts outright rather than redirecting it to checkout-pricing.ts — it had zero non-test callers, so there was nothing to preserve."
  - "Did not remove the calculateTax mock from public-route-hardening.test.ts — it still has a live consumer (the rate-limit table's remaining three routes assert it was never called)."
  - "Task 2 treated as landmine removal, not a bug fix — the two live request-path callers already pass neither field, so the dangerous expression was already resolving to the safe fallback in production. The test locks the contract so a future caller can't reintroduce the database-only object."

patterns-established:
  - "Deferred out-of-scope test failures observed during a parallel same-checkout run go to .planning/phases/<phase>/deferred-items.md rather than being fixed by the plan that happened to notice them."

requirements-completed: [DEBT-01, DEBT-02]

coverage:
  - id: D1
    description: "app/api/tax/route.ts and tests/unit/api/tax-route.test.ts deleted; no reference to the route remains anywhere outside .planning/"
    requirement: DEBT-01
    verification:
      - kind: unit
        ref: "tests/unit/app/api/public-route-hardening.test.ts (6 tests)"
        status: pass
      - kind: other
        ref: "repository-wide grep for 'api/tax' outside tests/ and .planning/ — zero hits"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Gift-card effect branch in lib/services/order-effects.ts passes runtime.giftCardEnvironment through unmodified, with no database-only fallback construction"
    requirement: DEBT-02
    verification:
      - kind: unit
        ref: "tests/unit/lib/services/order-effects-gift-card-env.test.ts (3 tests)"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/services/order-effects.test.ts (run isolated: 38/38 pass alongside gift-card-fulfillment.test.ts before a sibling plan's concurrent edit; see Deviations)"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-11
status: complete
---

# Phase 18 Plan 03: Tax route deletion and gift-card environment landmine removal Summary

**Deleted the orphaned `/api/tax` route (its own hardcoded 7% fallback rate and `txcd_99999999` tax code, diverging from the authoritative pricing service) and closed a latent trap in the gift-card order effect that could have handed the fulfilment service an environment rich enough to disable its own context lookup while carrying neither key ring.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-11T11:44:00Z (approx.)
- **Completed:** 2026-09-11T11:51:33Z
- **Tasks:** 2
- **Files modified:** 4 (2 deleted, 2 modified, 1 created — plus deferred-items.md)

## Accomplishments

- Deleted `app/api/tax/route.ts`, a route with zero non-test callers that hardcoded a 7% fallback tax rate (`FALLBACK_TAX_RATE = 0.07`) and a single Stripe tax code (`txcd_99999999` — "General - Tangible Goods", plus `txcd_92010001` for shipping) with no gift-card exemption, diverging from `lib/services/checkout-pricing.ts`.
- Deleted its dedicated test, `tests/unit/api/tax-route.test.ts`, and repaired `tests/unit/app/api/public-route-hardening.test.ts` down to the three surviving public routes (payment-intent, validate-discount, shipping-options) without adding a "now 404s" assertion the suite doesn't own.
- Simplified the gift-card effect branch in `lib/services/order-effects.ts` from `runtime.giftCardEnvironment ?? (runtime.database ? { DB: runtime.database } : undefined)` to a single property read: `runtime.giftCardEnvironment`.
- Added `tests/unit/lib/services/order-effects-gift-card-env.test.ts`, a source-contract regression test that fails if the database-only fallback ever reappears.

## Task Commits

Each task was committed atomically (TDD commit pattern for Task 2):

1. **Task 1: Delete the orphaned tax route and its two test surfaces** — `7a42cf1` (fix) — see "Deviations from Plan" for the split-commit note on this task's file deletions.
2. **Task 2 RED: failing source-contract test** — `2b8d0f9` (test)
3. **Task 2 GREEN: environment passthrough simplification** — `0d5e5c7` (feat)

No REFACTOR commit — the GREEN implementation was already the minimal, final form (a one-line simplification).

## Files Created/Modified

- `app/api/tax/route.ts` — deleted (215 lines: hardcoded fallback rate, Stripe tax codes, its own request validation)
- `tests/unit/api/tax-route.test.ts` — deleted (its only test, asserting the fallback-rate Money boundary)
- `tests/unit/app/api/public-route-hardening.test.ts` — removed the deleted route's import, its row in the parameterised rate-limit table, and its oversized-cart case; left the `calculateTax` mock wired (still asserted on for the surviving three routes)
- `lib/services/order-effects.ts` — gift-card effect branch now passes `runtime.giftCardEnvironment` straight through, no conditional tail
- `tests/unit/lib/services/order-effects-gift-card-env.test.ts` — new source-contract test (created)
- `.planning/phases/18-tech-debt-closure/deferred-items.md` — new phase-level ledger for out-of-scope findings (created)

## Decisions Made

- No replacement route or redirect written for the deleted tax path — `lib/services/checkout-pricing.ts` was already the authoritative tax calculation and nothing else called `/api/tax`.
- Kept `calculateTax`'s mock declaration and wiring in the hardening test because it still has a live consumer (an assertion that it wasn't called for the three remaining routes), per the plan's explicit "check for a consumer before removing" instruction.
- DEBT-02 is documented as removing a **latent hazard**, not fixing a live bug: both live request-path callers (`lib/services/order-finalization.ts` lines 78-84 and 188-194) already pass neither `giftCardEnvironment` nor `database` into this expression, so it already resolved to `undefined` and `fulfillPaidGiftCards` already fell back correctly to its own Cloudflare context lookup. The cron path (`lib/observability/scheduled.ts:63`) always supplies the complete environment. The removed expression was a trap for a *future* caller that supplied `database` alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking / concurrency artifact] Task 1's file deletions landed in a sibling plan's commit, not this plan's own commit**
- **Found during:** Task 1, immediately after staging `git rm app/api/tax/route.ts tests/unit/api/tax-route.test.ts`
- **Issue:** This plan runs as one of six parallel executors sharing a single git checkout (no worktree isolation; `workflow.use_worktrees: false`). After `git rm` staged the two deletions in the shared index, a sibling plan (18-02) ran a full `git commit -m "..."` with no explicit pathspec, which commits the *entire* staged index — sweeping this plan's staged deletions into its own commit, `73ace3c docs(18-02): cross-reference digital-only predicates and pin to invariant test`. That commit's diff includes `D app/api/tax/route.ts` and `D tests/unit/api/tax-route.test.ts` alongside 18-02's unrelated JSDoc changes.
- **Fix:** No destructive git history rewrite was attempted (rewriting or amending another plan's already-landed commit mid-run is explicitly prohibited and risky for a live parallel execution). The working-tree and repository state is functionally correct — both files are gone, tracked nowhere, referenced nowhere. This plan's own commit `7a42cf1 fix(18-03): delete orphaned tax route, repair hardening test` therefore contains only the remaining, not-yet-swept change: the repair to `tests/unit/app/api/public-route-hardening.test.ts`. The file-deletion content of Task 1 is real and verified (see verification below) but is attributed in git history to commit `73ace3c`, not to an 18-03-tagged commit.
- **Files affected:** `app/api/tax/route.ts`, `tests/unit/api/tax-route.test.ts` (deleted, via `73ace3c`); `tests/unit/app/api/public-route-hardening.test.ts` (modified, via `7a42cf1`)
- **Verification:** `test ! -e app/api/tax/route.ts && test ! -e tests/unit/api/tax-route.test.ts` passes; `npx vitest run tests/unit/app/api/public-route-hardening.test.ts` — 6/6 pass; `npx tsc --noEmit` — clean; repository-wide grep for `api/tax` outside `tests/` and `.planning/` — zero hits.
- **Committed in:** `73ace3c` (deletions, sibling commit) + `7a42cf1` (this plan's own commit, test repair)

---

**Total deviations:** 1 auto-fixed (1 blocking/concurrency). **Impact:** None on correctness — the deletion is real, verified, and referenced nowhere. The only effect is that `git log --grep="(18-03)"` undercounts this plan's actual file changes by one commit's worth of diff (the deletion lives under 18-02's message). Anyone auditing DEBT-01 by commit message alone should also check `73ace3c`.

## Issues Encountered

- **Out-of-scope test failures from a concurrent sibling edit.** Running the full unit suite (`npx vitest run`) and the full workers suite (`npx vitest run --config vitest.workers.config.mts`) after Task 2's GREEN commit showed two failures, both rooted in a sibling plan's in-flight (and since-committed, `d0be1cd feat(18-05)`) edit to `lib/services/gift-card-fulfillment.ts` splitting `gift_card.delivery_failed` into two telemetry events. Neither failing test touches this plan's files (`lib/services/order-effects.ts`, `tests/unit/lib/services/order-effects-gift-card-env.test.ts`). This plan's task-scoped verification — the new source-contract test plus both integration suites limited to `order-effects.test.ts` and `gift-card-fulfillment.test.ts` — passed cleanly (38/38) before the sibling edit landed. Logged to `.planning/phases/18-tech-debt-closure/deferred-items.md` rather than fixed here, per scope boundary (out-of-scope for 18-03, and `gift-card-fulfillment.ts` is not in this plan's `files_modified`). This plan did **not** run `npm run build` per the parallel-execution instruction to leave that to phase-level verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/services/checkout-pricing.ts` remains the sole tax calculation path; nothing in the repository outside `.planning/` still names the deleted `/api/tax` route.
- The gift-card effect's environment contract is now binary (full environment or nothing) and pinned by a regression test; safe for any future caller to rely on.
- No blockers for the rest of Phase 18. The concurrent-edit test noise from 18-05's telemetry-event split (see deferred-items.md) should be verified resolved at phase-level `npm test` once all six plans have merged, since 18-05 has already committed its change.

---
*Phase: 18-tech-debt-closure*
*Completed: 2026-09-11*

## Self-Check: PASSED

- FOUND: tests/unit/lib/services/order-effects-gift-card-env.test.ts
- FOUND: .planning/phases/18-tech-debt-closure/deferred-items.md
- FOUND: .planning/phases/18-tech-debt-closure/18-03-SUMMARY.md
- CONFIRMED DELETED: app/api/tax/route.ts
- CONFIRMED DELETED: tests/unit/api/tax-route.test.ts
- FOUND commits: 7a42cf1, 2b8d0f9, 0d5e5c7, 73ace3c (sibling commit carrying Task 1's deletions)
