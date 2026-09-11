---
phase: 13-gift-card-flags
plan: 05
subsystem: payments
tags: [gift-cards, feature-flags, d1, admin-settings, telemetry, observability, tdd]

# Dependency graph
requires:
  - phase: 12-gift-card-delivery
    provides: the gift-card ledger, reservations, availableBalanceExpression and the telemetry taxonomy this plan extends
  - phase: 13-gift-card-flags
    provides: "13-01 — honor/sell flag semantics and the capability split that decides who reads this guard"
provides:
  - sumOutstandingGiftCardBalances — the read-only outstanding-money measurement, one batched D1 round trip
  - lib/gift-cards/honor-guard.ts — the gift_cards.honor_guard record, its reader, its cron-only writer, and the staleness rule
  - balancesMayExist / honorIsEffectivelyOn — the cheap request-time answer that never runs a balance query
  - gift_card.honor_disabled_with_balances registered critical in both the producer taxonomy and the tail worker
  - reportHonorDisabledWithBalances — the producer call site plan 13-07's cron tick calls
affects: [13-07, 13-08, 14-gift-card-admin]

actuals:
  tokens: 7117
  tasks: 3
  # This plan's own commits: three task commits plus one deviation fix, plus
  # this SUMMARY's docs commit. `git rev-list --count caa3d8e..HEAD` measures
  # 16 because three sibling executors (13-02, 13-03, 13-04) commit into the
  # same working tree concurrently; 16 is the tree's count, not this plan's.
  commits: 5
  commits_measured_tree_range: 16
plan_head_before: caa3d8efd52a8b78372c623dbece8d0df9f52b96

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Measure once on a schedule, write a small row, read the row at request time — the balance aggregate never runs on the request path (D-06)"
    - "A guard record whose every unreadable state (missing, stale, malformed, wrong-shaped, throwing) resolves to the safe answer, so the unsafe answer needs positive fresh evidence"
    - "Interpolate one shared SQL expression twice in a single statement and bind its placeholder twice, left to right, rather than writing a second expression"

key-files:
  created:
    - lib/gift-cards/honor-guard.ts
    - tests/unit/lib/gift-cards/honor-guard.test.ts
    - tests/integration/lib/gift-cards/honor-guard.test.ts
  modified:
    - lib/gift-cards/repository.ts
    - lib/observability/telemetry.ts
    - workers/observability-tail/src/core.ts

key-decisions:
  - "sumOutstandingGiftCardBalances also returns cardsWithBalance: the plan's action instructs statement A to select a card count, but its written return type lists only three fields — returning the count is the only reading under which the instructed SQL is not dead"
  - "The open-reservation count is deliberately narrower than the reservation clause inside the balance expression: it answers 'is someone mid-checkout right now', not 'does this reservation still hold value'"
  - "readHonorGuard returns null on malformed JSON rather than throwing (unlike readExternalRestockEnabled, the shape it copies) — a corrupt row must fail toward honoring, not take down every request"
  - "The staleness boundary is exclusive: measured exactly HONOR_GUARD_STALE_SECONDS ago is still fresh, and a record measured in the future is not stale"
  - "reportHonorDisabledWithBalances lives in lib/gift-cards/honor-guard.ts, not in the cron file, so this plan can supply the producer call site the source contract requires without editing plan 13-07's scheduled handler"
  - "The alarm's fields carry the open-reservation count, not the stranded money: the closed taxonomy has no money dimension and labelling minor units as `count` would be a lie in the enum"

patterns-established:
  - "Pattern 1: the fail-safe read — every unreadable state of a guard record collapses to the conservative answer, and only a fresh, well-formed, zeroed record can flip it"
  - "Pattern 2: aggregate-over-a-shared-table integration tests isolate by advancing their own clock and disabling leftovers, because append-only ledgers and immutable identity columns make DELETE and back-dating impossible"

requirements-completed: [GCF-02]

coverage:
  - id: D1
    description: "sumOutstandingGiftCardBalances reports the summed available balance across active cards, the count of cards with a balance, the open-reservation count and the currency, in one batched D1 round trip"
    requirement: GCF-02
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard.test.ts#sumOutstandingGiftCardBalances on real D1 > counts the full issued balance of an active card with no reservations"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard.test.ts#sumOutstandingGiftCardBalances on real D1 > subtracts an open reservation and reports it as an open reservation"
        status: pass
    human_judgment: false
  - id: D2
    description: "The measurement reuses availableBalanceExpression rather than a second hand-written balance SQL, and the helper stays module-private"
    requirement: GCF-02
    verification:
      - kind: other
        ref: "grep -c '^export function availableBalanceExpression' lib/gift-cards/repository.ts => no match; grep -nF 'SUM(entry.amount_delta_minor)' lib/gift-cards/repository.ts => unchanged from HEAD (2 pre-existing sites, 0 added)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Released, settled, expired and disabled states each move the outstanding total and the open count the way the ledger says they should"
    requirement: GCF-02
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard.test.ts#sumOutstandingGiftCardBalances on real D1 > returns the balance and clears the open count once the reservation is released"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard.test.ts#sumOutstandingGiftCardBalances on real D1 > lets the redemption ledger entry carry the reduction once a reservation settles"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard.test.ts#sumOutstandingGiftCardBalances on real D1 > ignores a reservation that expired without being released or committed"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard.test.ts#sumOutstandingGiftCardBalances on real D1 > excludes a disabled card from the outstanding total"
        status: pass
    human_judgment: false
  - id: D4
    description: "A missing, stale, malformed, wrong-shaped or unreadable honor-guard record all mean balances may exist, so honoring stays on (D-15, T-13-18)"
    requirement: GCF-02
    verification:
      - kind: unit
        ref: "tests/unit/lib/gift-cards/honor-guard.test.ts#balancesMayExist (11 table cases: null, fresh zero, outstanding, open reservation, 901s stale, 900s boundary, three unreadable shapes, future clock, negative total)"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard.test.ts#honor-guard record on real D1 > reads malformed JSON as null rather than throwing"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard.test.ts#honor-guard record on real D1 > keeps honoring when the guard cannot be read at all"
        status: pass
    human_judgment: false
  - id: D5
    description: "The record round-trips its four fixed fields through admin_settings under the fixed key, category and object data type, and a second write replaces the row instead of colliding on the primary key"
    requirement: GCF-02
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard.test.ts#honor-guard record on real D1 > round-trips the four fields the record is fixed at"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard.test.ts#honor-guard record on real D1 > replaces the previous measurement instead of colliding on the primary key"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard.test.ts#honor-guard record on real D1 > stores the row under the fixed key, category and object data type"
        status: pass
    human_judgment: false
  - id: D6
    description: "honorIsEffectivelyOn answers true on configured honor without touching D1, and the guard module contains no aggregate SQL (D-06, T-13-19)"
    requirement: GCF-02
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard.test.ts#honor-guard record on real D1 > answers honor-on without touching D1 when honor is configured on (a D1 stub that throws on prepare)"
        status: pass
      - kind: other
        ref: "grep -v '^ *[*/]' lib/gift-cards/honor-guard.ts | grep -cF 'SUM(' => 0; same filter for getSettings|getDbAsync|drizzle => 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "gift_card.honor_disabled_with_balances is registered critical at sample rate 1 in the producer taxonomy and present in the tail worker's critical list, with a real producer call site"
    requirement: GCF-02
    verification:
      - kind: unit
        ref: "tests/unit/workers/observability-tail-core.test.ts#observability Tail Worker parser and renderer > keeps the exact producer marker and critical taxonomy synchronized"
        status: pass
      - kind: unit
        ref: "tests/unit/observability/instrumentation-source.test.ts#actionable failure telemetry source contract > wires every critical taxonomy event into executable producer code"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/gift-cards/honor-guard.test.ts#reportHonorDisabledWithBalances > logs a critical envelope naming the event and the open-reservation count"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-10
status: complete
---

# Phase 13 Plan 05: Honor-Guard Measurement Summary

**Stranded gift-card money can now be measured in one D1 round trip, parked in one small `admin_settings` row, read cheaply enough for the request path, and paged on by name — and every way of failing to read it resolves toward honoring the card.**

## Performance

- **Duration:** 12 min
- **Tasks:** 3 of 3
- **Commits:** 4 task commits plus this SUMMARY
- **Files:** 3 created, 3 modified (706 insertions)

## Accomplishments

### Task 1 — the measurement

`sumOutstandingGiftCardBalances(database, nowSeconds)` in `lib/gift-cards/repository.ts` answers
"how much stored value is outstanding right now" with one `database.batch` of two statements.

Statement A sums `availableBalanceExpression('account')` over `gift_card_accounts WHERE status =
'active'`. That expression is the same SQL `readBalance` and migration 0022's reservation guard
trigger already use, so there is still exactly one definition of "available" in the codebase — the
helper stayed module-private and no second balance expression was written. It is interpolated
twice in the statement (once inside the `SUM`, once inside a `CASE` that counts cards with a
positive balance), so `nowSeconds` binds twice, left to right, and the bind call says so inline.

Statement B counts open reservations — `released_at IS NULL AND committed_at IS NULL AND expires_at
> ?`. That is deliberately narrower than the reservation clause inside the balance expression: the
balance clause covers every reservation still holding value, including committed ones awaiting
settlement, while this count is the "someone is mid-checkout right now" signal D-05 asks to report
separately.

Every aggregate is coerced with an explicit fallback to `0`, because D1 returns `null` for
aggregates over an empty table, and `currency` comes back `null` when no active card exists.

### Task 2 — the record

`lib/gift-cards/honor-guard.ts` holds the fixed key (`gift_cards.honor_guard`), the new free-text
category (`gift_cards`, no CHECK constraint, so no migration), the four-field record shape D-15
locks, and a 900-second staleness window — three missed five-minute cron ticks, long enough to ride
out a deploy, short enough that a wedged cron cannot leave a stale zero standing in for real money.

`readHonorGuard` copies the raw-`prepare` shape from `readExternalRestockEnabled` but inverts its
failure behaviour: where the refund handler throws on malformed JSON, this returns `null`. A
corrupt row taking down every request is a worse outcome than honoring a card the store meant to
stop honoring. `writeHonorGuard` upserts on the primary key so a tick never trips over the row it
wrote five minutes ago.

`balancesMayExist` is pure and answers true unless it holds a fresh, well-formed record that reads
zero on both counts. `honorIsEffectivelyOn` short-circuits to true on configured honor without
touching D1 at all — proven by a stub database that throws the moment anything calls `prepare` —
and wraps the read in a try/catch that also answers true. The only way honoring turns off is
positive, fresh evidence that nothing is outstanding.

### Task 3 — the alarm

`gift_card.honor_disabled_with_balances` is registered `{ severity: 'critical', sampleRate: 1 }` in
`TELEMETRY_EVENTS` and added to `TAIL_CRITICAL_EVENTS` in the same commit, which is exactly what
kept the existing parity test from going red. No new dimension was added to `ALLOWED_FIELD_ENUMS`.

`docs/observability.md` does not enumerate critical events by name (checked: `gift_card.delivery_failed`
does not appear in it), so the plan's conditional docs edit did not apply. `npm run docs:lint`
reports 0 violations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A critical event with no producer call site turned a source contract red**

- **Found during:** Task 3, at the plan-level `npm test` run
- **Issue:** `tests/unit/observability/instrumentation-source.test.ts` asserts that every event
  registered `critical` in `TELEMETRY_EVENTS` appears inside a `recordTelemetry(...)` call under
  `app/`, `lib/` or `worker.ts`. The plan defers the emit to 13-07, so registering the event on its
  own left dead taxonomy and 1 failing test out of 2434.
- **Fix:** Added `reportHonorDisabledWithBalances(record, options)` to `lib/gift-cards/honor-guard.ts`
  — this plan's own file, so 13-07's scheduled handler is untouched and gets a one-line call site.
  It uses only dimensions already in the closed taxonomy: `effect_type: 'gift_card'`,
  `trigger: 'scheduled'`, `outcome: 'needs_review'`, `count: <open reservations>`. The stranded
  total is deliberately not in the payload — the taxonomy has no money dimension, and putting minor
  units in `count` would make the enum lie. The amount lives in the guard record and on the admin
  banner (13-08), which is where an operator acts on it.
- **Files modified:** `lib/gift-cards/honor-guard.ts`, `tests/unit/lib/gift-cards/honor-guard.test.ts`
- **Commit:** a270679

**2. [Rule 3 - Blocking] The integration fixtures cannot delete or back-date gift-card rows**

- **Found during:** Task 1, first RED run
- **Issue:** The test file's `beforeEach` cleaned the gift-card tables so each aggregate case would
  start empty. Migration 0022 forbids it: `gift_card_ledger_append_only_delete` aborts any DELETE on
  the ledger, and `gift_card_reservations_identity_immutable` aborts any UPDATE that touches
  `expires_at`, so a reservation cannot be back-dated into expiry either.
- **Fix:** Each case now advances its own clock a day past the last, which expires the previous
  case's reservations, and disables every leftover active account out of the active set — both legal
  transitions under the triggers. The expired-reservation case measures at `now + 601` rather than
  ageing the row. The reasoning is written into the file as a comment so the next person does not
  retry the delete.
- **Files modified:** `tests/integration/lib/gift-cards/honor-guard.test.ts`
- **Commit:** 9d4f57a

### Judgement Calls

**3. `sumOutstandingGiftCardBalances` returns a fourth field the plan's type signature omits**

The plan's action instructs statement A to select `COALESCE(SUM(CASE WHEN <expr> > 0 THEN 1 ELSE 0
END), 0)` as a card count, but the return type it writes out has only `outstandingMinor`,
`openReservations` and `currency`. Under that type the instructed column is computed and thrown
away. The function returns `cardsWithBalance` as well. The three named fields keep exactly the
names and types the plan specifies, so the addition is additive for every downstream caller, and
the `HonorGuardRecord` shape D-15 locks is untouched — the card count is not stored.

**4. Acceptance criterion "`grep -cF 'SUM(entry.amount_delta_minor)'` prints 1" was already 2 at HEAD**

The criterion's intent is "the balance SQL exists in exactly one place — no second hand-written
expression". The literal count was 2 before this plan started: `readBalance` carries its own copy
because it returns the ledger balance and the held amount as separate columns rather than one
difference. `git show HEAD:lib/gift-cards/repository.ts | grep -cF` confirms 2 at the plan's base
commit. This plan added zero occurrences, so the intent holds; the number in the criterion was
written against a wrong baseline.

## Verification

| Gate | Result |
|------|--------|
| `mise exec -- npm test` | 287 files, 2439 tests passed |
| `mise exec -- npm run test:workers` | 28 files, 174 tests passed |
| `mise exec -- npm run test:observability-worker` | 1 file, 3 tests passed |
| `mise exec -- npm run typecheck` | clean |
| `mise exec -- npm run lint` | 0 errors (52 pre-existing warnings, none in this plan's files) |
| `mise exec -- npm run docs:lint` | 0 violations |
| `git status --porcelain migrations/` | empty — no migration added |

## Threat Mitigations

| Threat ID | Disposition | How this plan discharges it |
|-----------|-------------|------------------------------|
| T-13-17 | mitigate | `writeHonorGuard` has no caller in this plan; the cron becomes its only one in 13-07, and 13-08 adds the source-contract test asserting nothing under `app/` imports it |
| T-13-18 | mitigate | Missing, stale, malformed, wrong-shaped and throwing all resolve to "balances may exist" — 11 unit cases and 3 D1 cases pin it |
| T-13-19 | mitigate | The guard module holds no aggregate SQL (grep-pinned) and `honorIsEffectivelyOn` proves it can answer without touching D1 |
| T-13-20 | mitigate | The event is critical at sample rate 1 on both sides of the boundary, with a producer call site the source contract now enforces |
| T-13-21 | accept | The record holds an aggregate total, a count and a currency — no card identity, no code material, no recipient |

## Known Stubs

None. `reportHonorDisabledWithBalances` has no caller yet, which is by design: plan 13-07 owns the
scheduled handler that calls it. The function itself is complete and tested, not a placeholder.

## Threat Flags

None. This plan adds one read-only aggregate, one admin-gated settings row holding no identity
data, and two enum entries. No new network endpoint, auth path, file access pattern or schema
change at a trust boundary.

## Notes for 13-07 and 13-08

- The cron tick calls `sumOutstandingGiftCardBalances(env.DB, nowSeconds)`, writes the four-field
  record with `writeHonorGuard`, and calls `reportHonorDisabledWithBalances(record)` on any tick
  where honor is configured off and `balancesMayExist(record, nowSeconds)` is true.
- Capability resolution calls `honorIsEffectivelyOn(database, configuredHonor, nowSeconds)`. It
  never needs `sumOutstandingGiftCardBalances`.
- The admin page (D-17) can call `sumOutstandingGiftCardBalances` directly for a live number, or
  read the record for the cheap one. `cardsWithBalance` is available for the banner if useful.

## Self-Check: PASSED

All three created files exist on disk and all four task commits resolve in `git log`.
