# Deferred Items — Phase 02

Out-of-scope discoveries logged during execution, not fixed by the introducing task.

## RUN-02 hand-off: `payment_intent.payment_failed` webhook event list

- **Found during:** Plan 02-03, Task 3 (recording the D-08 hand-off after Tasks 1-2 landed the
  telemetry-only `handlePaymentFailed`)
- **Symptom:** `docs/DEPLOYMENT_SETUP.md` (~lines 203-210) and `docs/STRIPE_INTEGRATION.md`
  (~lines 60-67) list the Stripe webhook events this endpoint handles. RUN-02 needs those two
  lists brought in line with what `app/api/webhooks/stripe/route.ts`'s dispatch `switch` actually
  handles today, and this plan changed one entry's behavior without changing the subscription.
- **Why out of scope:** `02-CONTEXT.md` places doc edits to `docs/DEPLOYMENT_SETUP.md` and
  `docs/STRIPE_INTEGRATION.md` outside this phase's boundary; they are RUN-02's work in Phase 3.
- **Action:** When RUN-02 updates the two documents, use these four facts instead of
  re-deriving them from the route:
  1. `payment_intent.payment_failed` is now handled as telemetry only. `handlePaymentFailed`
     emits one `payment.intent_failed` event (`commerce.telemetry.v1`, severity `warning`) with
     an allow-listed `reason` and changes no order state, sends no email, and touches no
     inventory or ledger row.
  2. The Stripe subscription to `payment_intent.payment_failed` is deliberately retained — it was
     not removed as part of resolving the empty handler. Both documents' event lists must
     continue to include it.
  3. `checkout.session.completed` is still dispatched by the route today (see the full list
     below) and remains an empty/ignored handler. Deciding what to do with it is RUN-02's own
     call, not a decision this phase makes.
  4. The complete list of event types the dispatch `switch` in
     `app/api/webhooks/stripe/route.ts` handles after this plan, copied from the switch itself so
     Phase 3 has a verified list to diff the docs against:
     `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`,
     `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`,
     `invoice.payment_attempt_required`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `customer.subscription.paused`, `customer.subscription.resumed`,
     `customer.subscription.pending_update_applied`,
     `customer.subscription.pending_update_expired`, `charge.refunded`, `refund.updated`,
     `refund.failed`, `charge.refund.updated` (legacy compatibility alias for `refund.updated`).
- **Status:** resolved
- **Resolution (2026-09-03, milestone close):** Consumed by Phase 3 (RUN-02). Plan 03-02 rewrote the
  event lists in `docs/DEPLOYMENT_SETUP.md` and `docs/STRIPE_INTEGRATION.md` from these four facts
  (`payment_intent.payment_failed` retained and listed under Required; sixteen events in two groups;
  `charge.refund.updated` noted as legacy compatibility in prose), and plan 03-03 removed the dead
  `checkout.session.completed` case, handler, and header bullet from `app/api/webhooks/stripe/route.ts`
  with a regression test for the unhandled-event fall-through. Verified in `03-VERIFICATION.md`
  (truths 8 and 10) and by the milestone integration check.

## `tail_consumers` not wired — telemetry never reaches the tail worker today

- **Found during:** `02-RESEARCH.md` Pitfall 5, carried forward during Plan 02-03
- **Symptom:** The main `mercora` Worker's `wrangler.jsonc` has no `tail_consumers` entry, so the
  deployed `commerce-observability-tail` Worker (which owns the SQLite cooldown Durable Object and
  the email-alerting path) receives nothing from the producer today. The new
  `payment.intent_failed` warning events this plan added will reach the Worker log stream (and
  Analytics Engine, once `COMMERCE_ANALYTICS` is bound) but will not trigger a tail-worker alert
  until `tail_consumers` is separately wired.
- **Why out of scope:** Not named in any OBS-0x requirement or in `02-CONTEXT.md`'s decisions;
  wiring `tail_consumers` is a producer/consumer binding change, not part of resolving the
  `payment_intent.payment_failed` handler.
- **Action:** Not fixed here. Recorded as a candidate for a hygiene pass so it is not
  rediscovered as a surprise bug later — anyone expecting `payment.intent_failed` (or any other
  critical/warning event) to page via the tail worker's alerting today will be wrong until this is
  wired.
- **Status:** resolved
- **Resolution (2026-09-03, milestone close, at Russell's direction):** Wired. The
  `commerce-observability-tail` Worker was configured (unrestricted `ALERT_EMAIL` Send Email binding
  matching the producer's `EMAIL` binding; `ALERT_EMAIL_TO`/`ALERT_EMAIL_FROM` =
  `russell@russellkmoore.me`; `ALERT_SUBJECT_PREFIX` `[voltique]`; `OPERATOR_IDENTITY` "Russell K.
  Moore"; `ENVIRONMENT` production) and deployed with `npx wrangler deploy` from
  `workers/observability-tail/` (version `5ba50573`, 2026-09-03T03:21:33Z, SQLite `AlertCooldown`
  Durable Object migration `v1` applied). The root `wrangler.jsonc` now carries
  `"tail_consumers": [{ "service": "commerce-observability-tail" }]`; `scripts/check-deploy-config.mjs`
  passes. The producer binding takes effect on the next `mercora` deploy (push `main` for Workers
  Builds, or `npm run deploy`). Follow-up after that deploy: trip one warning-severity event and
  confirm an alert email arrives; the tail worker also got a default `workers.dev` route it does not
  need, which can be disabled with `"workers_dev": false` in its config.
