---
phase: 13-gift-card-flags
plan: 07
subsystem: payments
tags: [gift-cards, feature-flags, cron, capabilities, d1, telemetry, tdd]

# Dependency graph
requires:
  - phase: 13-gift-card-flags
    provides: "13-01 — the honor/sell capability split and the sell-without-honor throw this plan must not defeat"
  - phase: 13-gift-card-flags
    provides: "13-05 — the honor-guard record, writeHonorGuard, balancesMayExist, honorIsEffectivelyOn, reportHonorDisabledWithBalances and sumOutstandingGiftCardBalances"
provides:
  - runGiftCardHonorGuard — the cron's entry point and the sole writer of the guard record
  - the five-minute tick measures, stores, alarms, and resolves capabilities from the measured honor value
  - resolveRuntimeCommerceCapabilities widens honoring from the guard record, only while selling is off
  - tests/integration/lib/gift-cards/honor-guard-cron.test.ts — the cron tick against real D1
affects: [13-08, 14-gift-card-admin]

actuals:
  tokens: 4996
  tasks: 2
  # This plan's own commits: two RED test commits, two GREEN implementation
  # commits, one added coverage commit, plus this SUMMARY's docs commit.
  # `git rev-list --count 172774d..HEAD` measures 10 because executors 13-06
  # and 13-08 commit into the same working tree concurrently; 10 is the
  # tree's count, not this plan's.
  commits: 6
  commits_measured_tree_range: 10
plan_head_before: 172774dcebbf15c3ab5ffa24446378622c5f6113

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Resolve capabilities lazily inside the promise chain that produces the value they depend on, so the expensive boundary is never built on a tick that does not need it"
    - "Bind a widening override to the negation of the flag whose invalid pairing must still throw, so the override cannot rescue a misconfiguration"
    - "Degrade a scheduled measurement to the configured flags in a `.catch` that returns, so a failed measurement never subtracts a promise from `waitUntil`"

key-files:
  created:
    - tests/unit/lib/commerce/runtime-honor-override.test.ts
    - tests/integration/lib/gift-cards/honor-guard-cron.test.ts
  modified:
    - lib/gift-cards/honor-guard.ts
    - lib/observability/scheduled.ts
    - lib/commerce/runtime.ts
    - tests/unit/worker-cron-routing.test.ts

key-decisions:
  - "The cron calls reportHonorDisabledWithBalances (written by 13-05) rather than emitting its own recordTelemetry line — 13-05 had already created the producer call site to satisfy the instrumentation source contract, so a second emit would have duplicated the alarm and the dimension set"
  - "The guard-failure log passes error.message, not the exception object: lib/observability/scheduled.ts is an instrumented boundary, and tests/unit/observability/instrumentation-source.test.ts forbids raw exception console logging there"
  - "runtime.ts adds its own `.catch(() => true)` on honorIsEffectivelyOn even though that function already catches internally — the plan's behaviour list demands honoring on a failed read, and repeating it at the call site keeps that direction true if the internal guarantee is ever refactored"
  - "HONOR_GUARD_DEFAULT_CURRENCY is a module-local 'USD' rather than an import of storeDefaults — honor-guard.ts is loaded by request-path capability resolution and should not pull in the store-config graph for one fallback string"
  - "A cron integration test was added beyond the plan's task list: the routing test mocks the honor-guard module whole, so nothing exercised the measure/store/alarm tick that two must_have truths describe"

patterns-established:
  - "Pattern 1: the short-circuit that is the safety property — `honor || (!sell && await guard())` is not an optimisation; the `!sell` term is what keeps GCF-04 throwing, and a test asserts the guard spy is never called in the sell-on state"
  - "Pattern 2: prove an alarm repeats, not merely that it fires — the integration test runs two consecutive ticks and asserts one envelope from each, because 'pages every tick' and 'pages once' are indistinguishable from a single call"

requirements-completed: [GCF-02, GCF-04]

coverage:
  - id: D1
    description: "Every five-minute cron tick measures outstanding gift-card value and writes the honor-guard record (D-05, D-15)"
    requirement: GCF-02
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard-cron.test.ts#runGiftCardHonorGuard on real D1 > measures the outstanding balance and stores it under the guard key"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard-cron.test.ts#runGiftCardHonorGuard on real D1 > writes the measurement under the fixed key rather than a second row"
        status: pass
      - kind: unit
        ref: "tests/unit/worker-cron-routing.test.ts#Worker scheduled routing behavior > measures outstanding gift-card value on every five-minute tick"
        status: pass
    human_judgment: false
  - id: D2
    description: "With honor configured off and outstanding value present, each tick emits gift_card.honor_disabled_with_balances (GCF-02, D-05)"
    requirement: GCF-02
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard-cron.test.ts#runGiftCardHonorGuard on real D1 > keeps honoring and pages on every tick while honoring is off with money outstanding"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/honor-guard-cron.test.ts#runGiftCardHonorGuard on real D1 > stops honoring and stays quiet once the measurement is fresh and empty"
        status: pass
    human_judgment: false
  - id: D3
    description: "With honor configured off and value outstanding, gift-card tender resolution still works on the request path (GCF-02, D-04)"
    requirement: GCF-02
    verification:
      - kind: unit
        ref: "tests/unit/lib/commerce/runtime-honor-override.test.ts#runtime honor override > keeps honoring while the guard says balances may still exist"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/commerce/runtime-honor-override.test.ts#runtime honor override > keeps honoring when the guard read fails outright"
        status: pass
      - kind: unit
        ref: "tests/unit/worker-cron-routing.test.ts#Worker scheduled routing behavior > keeps honoring on the drained capabilities while the guard finds outstanding value"
        status: pass
    human_judgment: false
  - id: D4
    description: "With sell on and honor off, capability resolution still throws — the guard never rescues an invalid configuration (GCF-04, D-02)"
    requirement: GCF-04
    verification:
      - kind: unit
        ref: "tests/unit/lib/commerce/runtime-honor-override.test.ts#runtime honor override > still refuses to sell cards it cannot honor, whatever the guard would say"
        status: pass
    human_judgment: false
  - id: D5
    description: "No request path runs the balance query; the request path reads one settings row and only when honor is configured off (D-06)"
    requirement: GCF-02
    verification:
      - kind: unit
        ref: "tests/unit/lib/commerce/runtime-honor-override.test.ts#runtime honor override > never reads the guard while honoring is configured on"
        status: pass
      - kind: other
        ref: "grep -v '^ *[*/]' lib/commerce/runtime.ts | grep -c 'sumOutstanding' => 0; grep -c 'await honorIsEffectivelyOn' lib/commerce/runtime.ts => 1"
        status: pass
    human_judgment: false
  - id: D6
    description: "A guard failure degrades to the configured flags without stopping the recovery drains, and waitUntil still receives exactly one promise (T-13-29)"
    requirement: GCF-02
    verification:
      - kind: unit
        ref: "tests/unit/worker-cron-routing.test.ts#Worker scheduled routing behavior > drains the recovery queues even when the honor measurement fails"
        status: pass
      - kind: other
        ref: "grep -c 'waitUntil' lib/observability/scheduled.ts => 3 (one per cron branch, unchanged)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The gift-card delivery drain stays on the configured honor flag, so the two pre-existing cron cases pass unchanged"
    requirement: GCF-02
    verification:
      - kind: unit
        ref: "tests/unit/worker-cron-routing.test.ts#Worker scheduled routing behavior > retries encrypted gift-card delivery under reconciliation even when acquisition is disabled"
        status: pass
      - kind: unit
        ref: "tests/unit/worker-cron-routing.test.ts#Worker scheduled routing behavior > does not open the gift-card retry boundary while reconciliation is disabled"
        status: pass
    human_judgment: false

status: complete

# Metrics
duration_minutes: 12
completed: 2026-09-10
---

# Phase 13 Plan 07: Honor Guard Runtime Wiring Summary

Honoring now survives a careless flag flip: the five-minute cron measures outstanding gift-card
value, stores it, and pages on every tick while honoring is off with money still out there, and
capability resolution widens honoring from that one row — but only while selling is off, so selling
cards the store cannot redeem still refuses to start.

## What Was Built

**Task 1 — the cron measures, stores and alarms.** `runGiftCardHonorGuard` in
`lib/gift-cards/honor-guard.ts` is the cron's entry point and the only writer of the guard record.
One tick runs `sumOutstandingGiftCardBalances`, builds the four-field record, upserts it, computes
`honorEffective` as `configuredHonor || balancesMayExist(record, now)`, and — only when honoring is
configured off and came out effectively on — calls 13-05's `reportHonorDisabledWithBalances`.

The five-minute branch of `handleScheduled` was restructured into a single promise chain: the guard
runs first, a `.catch` degrades a failed measurement to the configured flags, and the three existing
drains run in the `.then`. `runtimeCapabilities` gained a second parameter for the effective honor
value and its call site moved inside that `.then` — it cannot resolve before the value it depends on
exists, and resolving it lazily also leaves the gift-card key ring untouched on a tick where honoring
is genuinely off. The handler still hands `waitUntil` exactly one promise.

The delivery drain was deliberately left on the configured honor flag. Delivery is the acquisition
side of the feature; D-04 covers redemption, settlement and refunds.

**Task 2 — the request-path override.** `resolveRuntimeCommerceCapabilities` now splits the two
gift-card flag reads into named locals and computes the effective honor value as:

```
honorsGiftCards || (!sellsGiftCards && await honorIsEffectivelyOn(env.DB, false, now).catch(() => true))
```

The `!sellsGiftCards` term is the safety property, not a detail. JavaScript's `&&` short-circuits, so
with selling on the guard is never consulted at all and `resolveCommerceCapabilities` throws exactly
as it did before. A test asserts both the throw and that the guard spy was never called — the second
assertion is the one that would catch a future refactor that widened honoring first and checked sell
second.

## How To Verify

```bash
mise exec -- npm test
mise exec -- npm run test:workers
mise exec -- npm run test:observability-worker
mise exec -- npm run typecheck && mise exec -- npm run lint
```

All green: 2465 unit tests across 289 files, 178 worker integration tests across 29 files, 3
observability-worker tests, `tsc --noEmit` clean, lint 0 errors (52 pre-existing warnings, none in
files this plan touched).

## TDD Gate Compliance

Both tasks ran RED → GREEN. RED evidence was validated with
`gsd-tools check tdd-red-evidence` before any production edit.

| Task | RED (target test failing) | Verdict | GREEN |
|------|---------------------------|---------|-------|
| 1 | `worker-cron-routing.test.ts > measures outstanding gift-card value on every five-minute tick` — guard spy called 0 times | `RED_EVIDENCE_OK` (exit 1, 9 tests, 6 pass, 3 fail) | commit `97f6416` |
| 2 | `runtime-honor-override.test.ts > keeps honoring while the guard says balances may still exist` — guard spy called 0 times | `RED_EVIDENCE_OK` (exit 1, 5 tests, 3 pass, 2 fail) | commit `3fa8b5c` |

In both tasks some new cases passed at RED. That is expected and intended: they describe behaviour
that must be *preserved* (honoring configured on resolves as today; sell-on/honor-off still throws),
and a case that guards against regression has nothing to fail against before the change.

No REFACTOR commit — neither implementation had cleanup worth a separate commit.

`vitest` does not emit node:test summary comments, so the RED records were built from the `tap-flat`
reporter's output with the `# tests / # pass / # fail` lines derived programmatically from the
emitted `ok` / `not ok` lines. The counts are read off the real run; none were typed by hand.

## Deviations from Plan

### 1. [Rule 3 — Blocking] The guard-failure log had to drop the raw exception

- **Found during:** Task 1, after GREEN
- **Issue:** The plan says the guard's `.catch` "logs a console warning". Written the obvious way —
  `console.warn('[cron] gift-card honor guard unavailable', error)` — it failed
  `tests/unit/observability/instrumentation-source.test.ts`, which forbids
  `console.warn(..., error)` / `console.error(..., error)` in any file that also calls
  `recordTelemetry`. `lib/observability/scheduled.ts` is such a file.
- **Fix:** Log the derived message instead:
  `error instanceof Error ? error.message : String(error)`. This matches what the rest of the
  codebase already does at instrumented boundaries — `scheduled.ts` line 81 logs `controller.cron`,
  `recommendations/cron.ts` logs a JSON object, `telemetry.ts` logs its serialized envelope. None of
  them dump an exception object. Renaming the catch parameter to dodge the AST check was rejected: it
  would satisfy the matcher while defeating the contract.
- **Files modified:** `lib/observability/scheduled.ts`
- **Commit:** `97f6416`

### 2. [Rule 2 — Missing critical functionality] The alarm had no test

- **Found during:** Task 1 verification against `must_haves.truths`
- **Issue:** Truth 2 says "with honor configured off and outstanding value present, each tick emits
  `gift_card.honor_disabled_with_balances`". The plan's Task 1 test instructions mock
  `@/lib/gift-cards/honor-guard` whole, which is right for a routing test but means nothing exercised
  the tick's own measure/store/alarm logic. 13-05's unit test covers
  `reportHonorDisabledWithBalances` in isolation, but not the condition that decides whether to call
  it — the code this plan wrote.
- **Fix:** Added `tests/integration/lib/gift-cards/honor-guard-cron.test.ts`, four cases running
  `runGiftCardHonorGuard` against migrated D1. The alarm case runs two consecutive ticks and asserts
  one envelope from each, because "pages every tick" and "pages once" look identical from a single
  call. 13-CONTEXT's Claude's Discretion section asks for exactly this ("one integration test on the
  cron alarm").
- **Files modified:** `tests/integration/lib/gift-cards/honor-guard-cron.test.ts` (new)
- **Commit:** `8d4225b`

### 3. [Discretion] The alarm reuses 13-05's producer call site

- **Found during:** Task 1, before implementation
- **Issue:** The plan's action text instructs a `recordTelemetry('gift_card.honor_disabled_with_balances', ...)`
  call with a specific dimension set (`operation: 'read'`, `outcome: 'degraded'`, `provider: 'd1'`,
  `retryable: false`, …). 13-05 had already shipped `reportHonorDisabledWithBalances` in the same
  module, with a narrower dimension set (`effect_type`, `trigger`, `outcome: 'needs_review'`,
  `count`), specifically so the instrumentation source contract would find a producer call site
  before this plan ran.
- **Fix:** Call `reportHonorDisabledWithBalances(record)`. Writing a second emit would have duplicated
  the alarm on every tick and left two dimension sets for one event. The plan's own prohibition — "no
  new telemetry event beyond the one registered in plan 13-05" — points the same way.
- **Files modified:** `lib/gift-cards/honor-guard.ts`
- **Commit:** `97f6416`

### 4. [Discretion] `runtime.ts` repeats the fail-safe catch

- **Found during:** Task 2
- **Issue:** The plan's action text describes plain `await honorIsEffectivelyOn(...)`, but its
  behaviour list requires "the guard read throwing: honoring resolves as enabled". A bare `await` on
  a rejecting promise propagates and would reject the whole resolution.
- **Fix:** `.catch(() => true)` at the call site. `honorIsEffectivelyOn` already catches internally,
  so in production this line never runs — it exists so the stated fail-safe direction stays true at
  the call site if that internal guarantee is ever refactored away. A test pins it.
- **Files modified:** `lib/commerce/runtime.ts`
- **Commit:** `3fa8b5c`

### 5. [Discretion] `'USD'` is a module-local constant, not a `storeDefaults` import

The plan says "defaulting a null currency to the store's default of `'USD'`". `storeDefaults.commerce.currency`
is that value, but `lib/gift-cards/honor-guard.ts` is loaded by request-path capability resolution,
and importing `lib/store-config.ts` for one fallback string would pull the whole store-config graph
onto that path. Declared `HONOR_GUARD_DEFAULT_CURRENCY` locally with a comment naming the source.
The fallback only ever applies when there are no active cards at all.

## Concurrent-Executor Note (not a deviation)

Mid-run, `mise exec -- npm test` reported 2 failures in `tests/unit/docs/gift-card-flag-docs.test.ts`
— an untracked file belonging to executor 13-06, carrying an explicit comment: "RED evidence (13-06
task 2): intentionally inverted assertion." Out of scope, not caused by this plan (it imports
`resolveCommerceCapabilities` from `lib/commerce/capabilities.ts`, which this plan does not touch),
and left alone. The final full run after 13-06 reached GREEN shows 289/289 files passing.

## Known Stubs

None. Scanned all six files this plan created or modified for hardcoded empty values, placeholder
text, `TODO`/`FIXME` markers and skipped tests — no matches.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or trust-boundary schema change. The
one new surface — a guard record influencing tender resolution — is the mitigation the plan's threat
register already specifies (T-13-26 through T-13-30), and each disposition has a test:

| Threat | Mitigation verified by |
|--------|------------------------|
| T-13-26 (override elevating privilege) | `runtime-honor-override.test.ts > still refuses to sell cards it cannot honor, whatever the guard would say` — asserts both the throw and that the guard was never consulted |
| T-13-27 (forged record influencing tender) | `runGiftCardHonorGuard` is the sole writer, called only from `handleScheduled`; a forged record can only widen honoring, never authorise a redemption |
| T-13-28 (stranded balances under honor=off) | `honor-guard-cron.test.ts > keeps honoring and pages on every tick…` plus 13-05's fail-safe read cases |
| T-13-29 (guard failure stopping recovery) | `worker-cron-routing.test.ts > drains the recovery queues even when the honor measurement fails` |
| T-13-30 (telemetry disclosure) | Alarm carries only `effect_type`, `trigger`, `outcome` and the open-reservation count — no card identity, no code material, no money total |

## Self-Check: PASSED

Files verified present:
- `lib/gift-cards/honor-guard.ts` FOUND
- `lib/observability/scheduled.ts` FOUND
- `lib/commerce/runtime.ts` FOUND
- `tests/unit/worker-cron-routing.test.ts` FOUND
- `tests/unit/lib/commerce/runtime-honor-override.test.ts` FOUND
- `tests/integration/lib/gift-cards/honor-guard-cron.test.ts` FOUND

Commits verified in history: `89ad128` FOUND, `97f6416` FOUND, `89ed034` FOUND, `3fa8b5c` FOUND,
`8d4225b` FOUND.
