# Deferred / Out-of-Scope Items — Phase 18

## From 18-03

**Concurrent-edit test noise in `lib/services/gift-card-fulfillment.ts` (out of scope for 18-03)**

- **Observed during:** Task 2 full-suite verification (`npx vitest run` and
  `npx vitest run --config vitest.workers.config.mts`), after task-scoped
  verification had already passed.
- **What's happening:** A sibling plan is mid-flight editing
  `lib/services/gift-card-fulfillment.ts` (splitting the
  `gift_card.delivery_failed` telemetry event into `gift_card.delivery_failed`
  vs a new `gift_card.delivery_retry`, per its inline comments). While that
  edit is uncommitted/in-progress in this shared checkout, two tests fail:
  - `tests/unit/observability/instrumentation-source.test.ts` — "wires every
    critical taxonomy event into executable producer code" (expects
    `gift_card.delivery_failed` to still be wired everywhere it's declared
    critical).
  - `tests/integration/lib/services/gift-card-fulfillment.test.ts` —
    "escalates a permanently failing delivery to review after the attempt
    budget" (expects 8 telemetry log entries, gets 1, because most of that
    run's failures are no longer being reported under the event the test
    still checks for).
- **Not caused by 18-03:** `lib/services/gift-card-fulfillment.ts` is not in
  18-03's `files_modified`. 18-03 only touches `lib/services/order-effects.ts`
  (the gift-card environment passthrough, D-02) and the tax-route deletion
  (D-01). Task-scoped verification for 18-03 — the new source-contract test
  plus both integration suites limited to `order-effects.test.ts` and
  `gift-card-fulfillment.test.ts` — passed cleanly before this sibling edit
  landed; see 18-03-SUMMARY.md for the passing run's output.
- **Action:** None taken by 18-03. Whichever plan owns the
  `gift_card.delivery_retry` split should update
  `tests/unit/observability/instrumentation-source.test.ts`'s critical-event
  wiring list and the delivery-escalation test's expected log count/shape to
  match the new event split before that plan's own commit.
  status: acknowledged
