---
phase: 03-decision-lock-in-and-operator-runbooks
reviewed: 2026-09-02T22:30:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - app/api/webhooks/stripe/route.ts
  - docs/CLAUDE.md
  - docs/DEPLOYMENT_SETUP.md
  - docs/STRIPE_INTEGRATION.md
  - docs/checkout-trust-boundary.md
  - docs/database-migrations.md
  - docs/subscriptions.md
  - docs/webhooks-refunds-inventory.md
  - gsd-ingest-manifest.yaml
  - tests/unit/app/api/stripe-webhook-unhandled-events.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-09-02T22:30:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found (info-only; no blockers or warnings)

## Summary

This is a documentation-correctness phase plus one dead-code removal. I traced every
claim in the reviewed docs against the actual code and confirmed:

- The `checkout.session.completed` removal in `app/api/webhooks/stripe/route.ts` is
  complete and behavior-neutral: the switch case, the `handleCheckoutCompleted`
  function, and the JSDoc bullet referencing it are all gone; no orphaned import,
  type, or comment remains (`grep -i checkout` on the file returns nothing).
- The webhook event list in `docs/DEPLOYMENT_SETUP.md` and `docs/STRIPE_INTEGRATION.md`
  matches the route's `switch (event.type)` cases exactly (17 event types, including
  all subscription lifecycle events and the three refund-lifecycle events).
- `npm run db:migrate:apply:production` really is gated by both
  `--confirm-production` and `MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1`
  (`scripts/lib/d1-migrate-plan.mjs:137`), matching every doc that describes it.
- `npm run deploy` vs `npm run deploy:ci` descriptions in `docs/CLAUDE.md` match
  `package.json` (`deploy` never runs migrations; `deploy:ci` runs
  `d1-migrate.mjs --target production --apply --confirm-production` first).
- Node version claims (`24.18.1`) match `.nvmrc` and `package.json` `engines`.
- `wrangler.jsonc` `compatibility_date` (`2026-08-01`) matches the example in
  `DEPLOYMENT_SETUP.md`.
- Migration file names/order in `webhooks-refunds-inventory.md` (`0008`–`0011`)
  match the files on disk in `migrations/`.
- The corrected MCP trust-boundary claim in `checkout-trust-boundary.md`
  ("MCP `create_payment_intent` and `place_order` use the same shared checkout
  pricing service ... and the same idempotent finalizer") is accurate:
  `lib/mcp/checkout.ts` imports `priceCheckout` from `checkout-pricing.ts`, and
  `lib/mcp/tools/order.ts` imports `finalizeOrderPayment` from
  `order-finalization.ts`.
- ADR `Status:` markers were added consistently across all four ADR docs, and
  `gsd-ingest-manifest.yaml`'s `locked: true` entries and paths are accurate
  (all listed paths exist on disk).
- `tests/unit/app/api/stripe-webhook-unhandled-events.test.ts` passes and correctly
  characterizes the `default` branch's `ignored` outcome for an event type with no
  dispatch case, using the removed `checkout.session.completed` type as the example
  — appropriately scoped as a regression guard, not a test of removed behavior.

Only two minor, pre-existing documentation staleness items surfaced, both outside
this phase's actual diff (see Info below). No Critical or Warning findings.

## Info

### IN-01: `webhooks-refunds-inventory.md`'s "binding" required-event list omits `payment_intent.payment_failed`

**File:** `docs/webhooks-refunds-inventory.md:17-25`
**Issue:** `docs/DEPLOYMENT_SETUP.md:206-211` and `docs/STRIPE_INTEGRATION.md:63-68`
both list `payment_intent.payment_failed` under "Required" and annotate it
"(telemetry only; the subscription is deliberately retained)", then state
`docs/webhooks-refunds-inventory.md` "is the binding source for the required set."
But `webhooks-refunds-inventory.md`'s own "Subscribe it to these events" list
(lines 19-22) only has `payment_intent.succeeded`, `charge.refunded`,
`refund.updated`, `refund.failed` — it does not mention `payment_intent.payment_failed`
at all. If this doc is truly the binding source, an operator following only this
doc will not subscribe the endpoint to `payment_intent.payment_failed`, silently
losing the decline-reason telemetry signal that `handlePaymentFailed` in
`route.ts:341-350` exists to produce. This predates the current phase's diff (only
a `Status:` marker was added to this file in this phase — see `git diff` on
`docs/webhooks-refunds-inventory.md`), so it is not a regression introduced here,
but it is a real cross-doc inconsistency in files this phase declared "locked" as
ADRs.
**Fix:** Either add `payment_intent.payment_failed` to the "Subscribe it to these
events" list in `webhooks-refunds-inventory.md`, or soften the "binding source for
the required set" claim in the other two docs to scope it explicitly to
refund/inventory events rather than the full required set.

### IN-02: `docs/CLAUDE.md` "Testing" section still says no test framework is configured

**File:** `docs/CLAUDE.md:412-415`
**Issue:** The doc states "**Status**: No formal testing framework currently
configured" and recommends "Consider adding Vitest or Jest," but the repo already
has Vitest configured (`package.json` `test`/`test:workers` scripts,
`vitest.workers.config.mts`) and a growing `tests/unit/` suite, including the new
`tests/unit/app/api/stripe-webhook-unhandled-events.test.ts` added in this same
phase. This section was not touched by this phase's diff (only the Build
Commands/migration sections of `docs/CLAUDE.md` were edited), so it's pre-existing
staleness, not a regression — but it's the kind of doc-vs-code drift this phase's
stated goal (making prose match code) is meant to catch.
**Fix:** Update the Testing section to reflect the current Vitest setup and test
suite, or remove it if `docs/webhooks-refunds-inventory.md`'s "Verification"
section (which already documents `npm test`, `npm run test:workers`,
`npm run typecheck`, `npm run lint`) is meant to be the canonical source.

---

_Reviewed: 2026-09-02T22:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
