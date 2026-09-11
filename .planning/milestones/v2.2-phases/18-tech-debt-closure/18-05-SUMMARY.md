---
phase: 18-tech-debt-closure
plan: 05
subsystem: observability
tags: [telemetry, gift-cards, alerting, vitest]

# Dependency graph
requires:
  - phase: 13-gift-card-flags
    provides: gift-card delivery pipeline (deliverOne, recordDeliveryFailure) and the commerce.telemetry.v1 contract
provides:
  - A non-paging gift_card.delivery_retry telemetry event, registered and structurally kept out of the tail worker's critical list
  - deliverOne's two non-terminal failure branches (post-send-failure, catch) emit the retry event when the outcome is not terminal, and the paging gift_card.delivery_failed event only when it is
  - A source-contract scanner that correctly traces event literals through the caller-supplied recordDeliveryFailure indirection
affects: [19-operator-checklist]

# Actuals (#2632)
actuals:
  tokens: 3940
  tasks: 3
  commits: 4
  plan_head_before: fe90ae677da0d1a52b8a70bae1c9f7f1ae661b85

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Telemetry emit helpers can take the event name as a caller-supplied, narrow-typed field instead of hardcoding it, so one helper can route between a paging and a non-paging severity for the same failure family."
    - "Static source-contract scanners that walk to a literal event name must special-case ConditionalExpression to read whenTrue/whenFalse only -- walking the whole subtree also picks up string literals from the condition itself."

key-files:
  created: []
  modified:
    - lib/observability/telemetry.ts
    - lib/services/gift-card-fulfillment.ts
    - tests/unit/workers/observability-tail-core.test.ts
    - tests/integration/lib/services/gift-card-fulfillment.test.ts
    - tests/unit/observability/instrumentation-source.test.ts

key-decisions:
  - "gift_card.delivery_retry copies gift_card.delivery_note_dropped's shape exactly (warning, sampleRate 1) rather than inventing a new sample rate, per the interface contract."
  - "The absent-code-material branch (deliverOne, first attempt) stays unconditionally critical -- it is terminal on attempt one by construction, not a retry."
  - "Extended the source-contract scanner (tests/unit/observability/instrumentation-source.test.ts) to trace recordDeliveryFailure's event field, since it is outside this plan's files_modified but broke as a direct, mechanical consequence of Task 1's caller-supplied-event refactor."

requirements-completed: [DEBT-04]

coverage:
  - id: D1
    description: "A retryable gift-card delivery failure emits gift_card.delivery_retry (warning), registered in TELEMETRY_EVENTS and structurally absent from TAIL_CRITICAL_EVENTS."
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/unit/workers/observability-tail-core.test.ts#registers gift_card.delivery_retry at warning severity outside the tail critical list"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#escalates a permanently failing delivery to review after the attempt budget, paging once (D-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Only a terminal outcome (needs_review status, exhausted attempt budget, or absent code material) emits the critical, paging gift_card.delivery_failed event -- exactly once per delivery lifecycle, not once per attempt."
    requirement: "DEBT-04"
    verification:
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#escalates a permanently failing delivery to review after the attempt budget, paging once (D-04)"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#moves corrupted retry material to review without rendering or sending a bearer code"
        status: pass
    human_judgment: false
  - id: D3
    description: "A retry envelope still names its provider, attempt number and trigger, and leaks no provider error text, recipient address, or code-shaped string -- an operator can find and attribute a retry without paging."
    requirement: "DEBT-04"
    verification:
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#records a single retryable send failure as a warning, findable but never paging (D-04)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The source-contract scanner's static wiring check still recognizes both gift-card delivery events as reachable from executable producer code, despite the event name now being caller-supplied rather than a literal argument to recordTelemetry."
    verification:
      - kind: unit
        ref: "tests/unit/observability/instrumentation-source.test.ts#wires every critical taxonomy event into executable producer code"
        status: pass
      - kind: unit
        ref: "tests/unit/observability/instrumentation-source.test.ts#keeps every executable producer event in the closed taxonomy"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-09-11
status: complete
---

# Phase 18 Plan 05: Split gift-card delivery-retry telemetry from the paging critical event Summary

**A permanently failing gift-card delivery now pages an operator once, at the eighth and final attempt, instead of eight times for the same not-yet-terminal card.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-11T11:42:00Z (approx.)
- **Completed:** 2026-09-11T11:55:03Z
- **Tasks:** 3 (plus one deviation fix)
- **Files modified:** 5

## Accomplishments
- Registered `gift_card.delivery_retry` as a warning-severity, fully-sampled `TELEMETRY_EVENTS` entry, deliberately kept out of `TAIL_CRITICAL_EVENTS` -- the whole non-paging mechanism is that array membership check in the tail worker's `parseEnvelope`.
- `recordDeliveryFailure` now takes its event name from the caller (narrowed to the two gift-card delivery events), and `deliverOne`'s two non-terminal failure branches choose the warning event when the outcome will be retried and the critical event only when it's terminal (`needs_review` status, or attempt budget exhausted). The absent-code-material branch, already terminal on attempt one, is unchanged.
- Rewrote the attempt-budget escalation integration test to spy on both console channels: exactly one critical envelope (final attempt, non-retryable, recovery trigger) and seven warning envelopes (first carries attempt 1/retryable/request-trigger, the rest carry recovery-trigger with ascending attempt numbers). Added a dedicated single-retry case proving attribution without paging.
- Fixed a source-contract scanner (`tests/unit/observability/instrumentation-source.test.ts`) that broke as a direct, mechanical consequence of the caller-supplied-event refactor: it only recognized event names passed as a literal directly to `recordTelemetry`, so it stopped seeing either gift-card delivery event as "wired."

## Task Commits

Each task was committed atomically:

1. **Task 1: Register the retry event and make the emit helper take an event name** - `ef7fd6f` (feat, tracer)
2. **Task 2: Retryable outcomes record the warning event, terminal outcomes keep paging** - `d0be1cd` (feat)
3. **Task 3: The integration suite proves the split by channel, not by hope** - `5fb5cf4` (test)
4. **Deviation fix: trace event literals through recordDeliveryFailure** - `29658b7` (fix)

_Note: commit types follow the nature of each task's change rather than a strict TDD test-then-feat gate. Tasks 2 and 3 carried `tdd="true"` but the plan itself sequenced production code (Task 2) before the test rewrite (Task 3) -- see Deviations._

## Files Created/Modified
- `lib/observability/telemetry.ts` - New `gift_card.delivery_retry` entry with a comment stating its absence from `TAIL_CRITICAL_EVENTS` is deliberate
- `lib/services/gift-card-fulfillment.ts` - `recordDeliveryFailure` takes a caller-supplied, narrowly-typed event name; the two non-terminal `deliverOne` call sites choose between the two gift-card delivery events based on the terminal signal already computed beside them (`status === 'needs_review'`, `exhausted`)
- `tests/unit/workers/observability-tail-core.test.ts` - Registered-but-never-critical assertion for the new event
- `tests/integration/lib/services/gift-card-fulfillment.test.ts` - Escalation case now asserts by channel (1 critical / 7 warning); new dedicated single-retry attribution case
- `tests/unit/observability/instrumentation-source.test.ts` - Scanner now traces `recordDeliveryFailure`'s `event` property (both branches of a conditional, not its condition)

## Decisions Made
- Copied `gift_card.delivery_note_dropped`'s exact shape (warning, sampleRate 1) for the new event rather than inventing a sample rate, per the plan's interface contract.
- Kept the absent-code-material branch unconditionally critical -- it is terminal on the first attempt by construction, so there is no "retryable" case to distinguish there.
- Extended the source-contract scanner rather than reverting the `recordDeliveryFailure` design: the scanner's assumption (event name is always a literal positional argument to `recordTelemetry`) was the thing invalidated by the plan's own interface contract, not a defect in the interface contract itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Source-contract scanner stopped recognizing gift-card delivery events as wired**
- **Found during:** Task 2/3 verification (`mise exec -- npm test`)
- **Issue:** `tests/unit/observability/instrumentation-source.test.ts`'s `telemetryCalls` walker only collected string literals passed directly as the first argument to `recordTelemetry(...)`. Task 1's refactor of `recordDeliveryFailure` to take the event name from its caller (`recordTelemetry(fields.event, ...)`) meant the literal no longer appeared in that position anywhere in the codebase -- it lives on the `event:` property of `recordDeliveryFailure`'s object-literal argument instead. `gift_card.delivery_failed` failed the "wires every critical taxonomy event into executable producer code" assertion.
- **Fix:** Extended the walker to also trace calls to `recordDeliveryFailure`, reading the literal(s) off its `event` property. A first pass over-collected: reading the whole `event` property subtree also picked up `'needs_review'` from the ternary's *condition* (`status === 'needs_review' ? ... : ...`), which is not an event name and broke the "keeps every executable producer event in the closed taxonomy" assertion. Fixed by special-casing `ConditionalExpression` to read only `whenTrue`/`whenFalse`, never the condition.
- **Files modified:** `tests/unit/observability/instrumentation-source.test.ts`
- **Verification:** `mise exec -- npx vitest run tests/unit/observability/instrumentation-source.test.ts` -- 3/3 pass. Full `mise exec -- npm test` -- 322 files, 2949 tests pass.
- **Committed in:** `29658b7`

---

**Total deviations:** 1 auto-fixed (1 bug, out of `files_modified` but a direct, mechanical consequence of Task 1's sanctioned interface change).
**Impact on plan:** Necessary to keep the source-contract gate accurate. No scope creep -- the fix only teaches the scanner about the new indirection the plan itself introduced.

## Issues Encountered

**Task ordering across Tasks 2 and 3 (informational, not a defect).** Tasks 2 and 3 both carry `tdd="true"`, but the plan sequences production code first (Task 2, files-scoped to `lib/services/gift-card-fulfillment.ts` only) and the test rewrite second (Task 3, files-scoped to the integration test file only). After Task 2's commit and before Task 3's, running Task 2's own stated `<verify>` command (`vitest run ... gift-card-fulfillment.test.ts`) showed exactly one pre-existing failure: the escalation case's stale assertion of 8 critical envelopes (now 1, by design -- 7 moved to the warning channel). This is precisely the assertion Task 3's action names for rewrite, and the field values captured at the time (attempt/trigger/retryable across all 8 attempts) matched Task 3's specification exactly. Both tasks were still committed individually per the plan's task boundaries; the integration suite was fully green (25/25) once Task 3's commit landed.

**Test-isolation gap in the new dedicated case (self-caught, fixed before commit).** The new single-retry test case initially left its delivery row in `pending` status with no further drain. Because `drainGiftCardDeliveries` scans all due rows across the whole D1 database (not scoped to one order) and the suite reuses a single fixed `now` constant across all tests, that stray row was picked up by the next two tests' drain calls, breaking their `{ attempted: 1 }` expectations (`{ attempted: 2 }` instead). Fixed by resolving the delivery to `sent` with a follow-up successful drain at the end of the new case, matching how every other case in the file leaves its rows in a terminal state.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DEBT-04 closed. `deliverOne`'s retry/page split is proven by which console channel each envelope lands on, not by inspection.
- `docs/observability.md` was not updated by this plan (not named in `artifacts_this_phase_produces` or `files_modified`) -- if the observability runbook documents the gift-card critical-event list by name, it should be checked against the new `gift_card.delivery_retry` event in a later phase, but nothing in this plan's scope required that edit.
- No blockers for Phase 19 (Operator Checklist).

---
*Phase: 18-tech-debt-closure*
*Completed: 2026-09-11*

## Self-Check: PASSED
