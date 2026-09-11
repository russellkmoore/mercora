---
phase: 17-saved-payment-methods
plan: 01
subsystem: payments
tags: [stripe, d1, drizzle, tdd, payment-customers]

requires:
  - phase: 09-gift-card-catalogue
    provides: migrations up through 0024_add_gift_card_events.sql
provides:
  - "payment_customers table (migration 0025) binding one Mercora customer to one Stripe customer"
  - "lib/payments/customer-binding.ts: ensureStripeCustomer, ensureStripeCustomerForShopper, findStripeCustomerId"
affects: [17-02, 17-04, saved-payment-methods, checkout, account-payment-methods]

actuals:
  tokens: 6476
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "D1 idempotent-binding table: PRIMARY KEY on the Mercora-side id, UNIQUE + GLOB CHECK on the provider id, INSERT OR IGNORE + re-read-on-conflict"
    - "Find-or-create/conflict-reconciliation against Stripe, mirrored (not imported) from lib/subscriptions/acquisition-service.ts per D-02/D-03"

key-files:
  created:
    - migrations/0025_add_payment_customers.sql
    - lib/db/schema/payments.ts
    - lib/payments/customer-binding.ts
    - tests/unit/lib/payments/customer-binding.test.ts
    - tests/integration/payment-customers-migration.test.ts
    - tests/integration/payment-customer-binding.test.ts
  modified:
    - lib/db/schema/index.ts
    - tests/integration/d1-harness.test.ts

key-decisions:
  - "stableId's join separator was copied verbatim from lib/subscriptions/acquisition-service.ts (a NUL character, via the literal \\u0000 escape sequence) rather than from 17-RESEARCH.md's incorrect space-joined transcription, per the plan's explicit warning."
  - "Task 2's RED-phase test file doubles as Task 3's base unit-test file (TDD requires the test before the implementation); Task 3 extended it in place rather than re-creating it, since the module and its six core behaviors already existed at that point."

requirements-completed: [PAY-01]

coverage:
  - id: D1
    description: "payment_customers table exists, is expand-only, rejects a non-cus_-prefixed or too-short stripe_customer_id, and refuses to orphan a binding on customer delete"
    requirement: PAY-01
    verification:
      - kind: integration
        ref: "tests/integration/payment-customers-migration.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "ensureStripeCustomer's idempotent find-or-create/conflict-reconciliation algorithm covers all six specified behaviors"
    requirement: PAY-01
    verification:
      - kind: unit
        ref: "tests/unit/lib/payments/customer-binding.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two concurrent binds for the same shopper converge on one Stripe customer id, proven against real D1"
    requirement: PAY-01
    verification:
      - kind: integration
        ref: "tests/integration/payment-customer-binding.test.ts"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-11
status: complete
---

# Phase 17 Plan 01: Payment Customer Binding Summary

**`payment_customers` migration plus `lib/payments/customer-binding.ts`'s idempotent find-or-create/conflict-reconciliation algorithm against real Stripe and D1 semantics, mirroring `establishProviderCustomer` without importing from `lib/subscriptions/`.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-11T10:11:00Z
- **Completed:** 2026-09-11T11:06:00Z
- **Tasks:** 3
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- Expand-only migration `0025_add_payment_customers.sql`: `payment_customers` table binding exactly one `customers.id` to exactly one `cus_`-prefixed Stripe customer id, with a table-level `CHECK` refusing a malformed provider id at the database and `ON DELETE RESTRICT` refusing to orphan a binding.
- `lib/db/schema/payments.ts` exports `paymentCustomers`, re-exported from `lib/db/schema/index.ts`.
- `lib/payments/customer-binding.ts` implements `ensureStripeCustomer` (injectable core), `ensureStripeCustomerForShopper` and `findStripeCustomerId` (request-scoped wrappers), plus `PaymentCustomerBinding`, `PaymentCustomerConflictError`, and `createPaymentCustomerRepository` — exactly the six names in the plan's interface contract, importing nothing from `lib/subscriptions/`.
- Full RED → GREEN TDD cycle for Task 2, with RED evidence persisted at `.planning/phases/17-saved-payment-methods/tdd-evidence/17-01-task2-red.json` and verified `RED_EVIDENCE_OK` by `gsd-tools check tdd-red-evidence`.
- Real-D1 integration proof that two concurrent binds for the same shopper converge on one Stripe customer id, and that a losing bind never overwrites the winning row.

## Task Commits

Each task was committed atomically (Task 2 followed the TDD RED → GREEN pattern):

1. **Task 1: Migration 0025 and the paymentCustomers Drizzle export** - `e13e07d` (feat)
2. **Task 2 RED: failing test for ensureStripeCustomer** - `f6078f9` (test)
3. **Task 2 GREEN: implement ensureStripeCustomer** - `acaba19` (feat)
4. **Task 3: call-shape assertions, real-D1 race proof, migration-list fix** - `1ef810a` (test)

**Plan metadata:** committed alongside this SUMMARY.

_Task 2 produced no separate REFACTOR commit — the GREEN implementation needed no cleanup._

## Files Created/Modified

- `migrations/0025_add_payment_customers.sql` - expand-only table, modeled on `subscription_provider_customers`
- `lib/db/schema/payments.ts` - `paymentCustomers` Drizzle export
- `lib/db/schema/index.ts` - re-exports the new schema module
- `lib/payments/customer-binding.ts` - the six-export module plans 17-02/17-04 depend on
- `tests/unit/lib/payments/customer-binding.test.ts` - 8 tests covering all six behaviors plus call-shape and module-surface assertions
- `tests/integration/payment-customers-migration.test.ts` - migration-ordering plus three constraint assertions
- `tests/integration/payment-customer-binding.test.ts` - real-D1 find-or-create and conflict proof
- `tests/integration/d1-harness.test.ts` - added `0025_add_payment_customers.sql` to the hardcoded migration-sequence assertion

## Decisions Made

- Copied `stableId`'s NUL-character join separator verbatim from `lib/subscriptions/acquisition-service.ts`'s real source rather than from 17-RESEARCH.md's incorrect space-joined transcription, per the plan's explicit instruction. Verified byte-for-byte in the final commit (the escape-sequence text is present, zero raw NUL bytes in the file).
- `email`/`name` over the 320/200-character bounds are silently dropped (not sent to Stripe) rather than throwing, matching the plan's explicit instruction — a deliberate deviation from the stricter `boundedString` (throws) pattern in `lib/subscriptions/stripe-provider.ts`, since this module has no caller-facing validation error path to report through.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated `tests/integration/d1-harness.test.ts`'s hardcoded migration-sequence assertion**
- **Found during:** Task 3, running the plan's `npm run test:workers` verify command
- **Issue:** `d1-harness.test.ts` asserts the exact ordered list of every applied migration by name; adding `0025_add_payment_customers.sql` in Task 1 broke this pre-existing, unrelated-looking test (same pattern this repo has hit at every prior migration: 0022, 0023, 0024).
- **Fix:** Appended `'0025_add_payment_customers.sql'` to the expected array.
- **Files modified:** `tests/integration/d1-harness.test.ts`
- **Verification:** `mise exec -- npm run test:workers` — 33 files / 253 tests passed
- **Committed in:** `1ef810a` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, mechanical and directly caused by Task 1's migration).
**Impact on plan:** No scope creep — the fix is the same one-line pattern every prior migration in this repo has required.

## Tooling Note

A build-time transformation in this session's tool chain corrupted the intended ASCII space characters in one early draft of `stableId`'s doc comment and join call into raw NUL bytes (`\x00`) instead of leaving plain text or the intended escape-sequence text. This was caught via `python3`/`perl` byte-level inspection (`od -c`, `perl -0777 -ne '... /\x00/g ...'`) before committing, and corrected with a direct Python file rewrite (bypassing the same tool path) so the committed source contains the literal 6-character escape-sequence text — matching `lib/subscriptions/acquisition-service.ts`'s real source — with zero raw NUL bytes. Verified post-commit via `git show HEAD:lib/payments/customer-binding.ts | python3 -c "..."`. Functionally the raw-NUL and escape-sequence forms are identical once parsed by the JS/TS lexer (both are the code point U+0000), so no behavior was ever at risk — this is a source-hygiene note, not a correctness deviation, and is logged here so a future executor recognizes the pattern if it recurs.

## Issues Encountered

None beyond the tooling note above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/payments/customer-binding.ts`'s `ensureStripeCustomerForShopper` and `findStripeCustomerId` are ready for plan 17-02 (checkout wiring) and plan 17-04 (account payment-methods routes) to import verbatim, per the published interface contract. Neither of those plans should modify this module.
- `payment_customers` is live in the schema and migration history; no backfill needed (starts empty).
- No blockers.

---
*Phase: 17-saved-payment-methods*
*Completed: 2026-09-11*

## Self-Check: PASSED

- FOUND: migrations/0025_add_payment_customers.sql
- FOUND: lib/db/schema/payments.ts
- FOUND: lib/payments/customer-binding.ts
- FOUND: tests/unit/lib/payments/customer-binding.test.ts
- FOUND: tests/integration/payment-customers-migration.test.ts
- FOUND: tests/integration/payment-customer-binding.test.ts
- FOUND: e13e07d (git log)
- FOUND: f6078f9 (git log)
- FOUND: acaba19 (git log)
- FOUND: 1ef810a (git log)
- `mise exec -- npx vitest run tests/unit/lib/payments/customer-binding.test.ts` - 8/8 passed
- `mise exec -- npm run test:workers` - 33 files / 253 tests passed
- `mise exec -- npm test` - 318 files / 2881 tests passed
- `mise exec -- npm run lint` - 0 errors (54 pre-existing, unrelated warnings)
- `mise exec -- npm run typecheck` - clean
- `mise exec -- npm run check:migrations -- --base origin/main` - 0025 classified expand-only
