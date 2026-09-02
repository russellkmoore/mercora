---
phase: 03-decision-lock-in-and-operator-runbooks
plan: 02
subsystem: docs
tags: [runbook, migrations, deploy, stripe-webhooks, node]

# Dependency graph
requires:
  - phase: 03-decision-lock-in-and-operator-runbooks
    provides: "Plan 1's locked ADR docs (docs/database-migrations.md, docs/webhooks-refunds-inventory.md) as the binding sources this plan points runbooks at"
provides:
  - "docs/DEPLOYMENT_SETUP.md and docs/CLAUDE.md carry only guarded db:migrate:* commands for remote migrations, with a deploy-paths note distinguishing npm run deploy from npm run deploy:ci"
  - "docs/DEPLOYMENT_SETUP.md requires Node.js 24.18.1 (.nvmrc / package.json engines), replacing the stale Node 18+ prerequisite"
  - "docs/DEPLOYMENT_SETUP.md and docs/STRIPE_INTEGRATION.md carry byte-identical sixteen-event Stripe webhook lists in Required/Subscriptions groups, dropping checkout.session.completed"
affects: [03-03]

# Actuals (#2632)
actuals:
  tokens: 4200
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deploy-paths note: a three-line **Deploy paths:** block placed directly above/near the first npm run deploy mention in an operator-facing doc, kept byte-identical across docs that both describe deploy"
    - "Webhook event list: two labelled bold-heading groups (Required, Subscriptions), three-space-indented backtick bullets, followed by a compatibility sentence for charge.refund.updated and a pointer to docs/webhooks-refunds-inventory.md"

key-files:
  created: []
  modified:
    - docs/DEPLOYMENT_SETUP.md
    - docs/CLAUDE.md
    - docs/STRIPE_INTEGRATION.md

key-decisions:
  - "Task 1 (tracer) took docs/DEPLOYMENT_SETUP.md through all four corrections (Node prerequisite, migration commands, deploy-paths note, webhook event list) and proved every acceptance gate before touching docs/CLAUDE.md or docs/STRIPE_INTEGRATION.md, per plan structure."
  - "No Node-version line added to docs/CLAUDE.md, matching the plan's explicit instruction — that file states no Node version today and RUN-01's Node edit is DEPLOYMENT_SETUP.md only."
  - "docs/STRIPE_INTEGRATION.md's numbered lead-in text ('Select events to listen for:' vs 'Select events:') was left as the pre-existing difference between the two files; only the bullets, group headings, and the two prose sentences were mirrored byte-identical."

patterns-established:
  - "Pattern 3: runbook migration commands must route through the guarded npm db:migrate:* scripts, never a bare wrangler d1 migrations apply against anything but --local, and must point at docs/database-migrations.md as the binding source."

requirements-completed: [RUN-01, RUN-02]

coverage:
  - id: D1
    description: "An operator reading docs/CLAUDE.md or docs/DEPLOYMENT_SETUP.md finds only guarded remote migration commands, each block pointing at docs/database-migrations.md; both runbooks state the npm run deploy vs deploy:ci distinction; docs/DEPLOYMENT_SETUP.md requires Node.js 24.18.1."
    requirement: "RUN-01"
    verification:
      - kind: other
        ref: "grep checks in Task 1, Task 2, and plan-level <verification> — unguarded wrangler line count, guarded script names present, single deploy-paths note, database-migrations.md pointer counts, Node 24.18.1 / .nvmrc present and Node 18 absent"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Stripe webhook event lists in docs/DEPLOYMENT_SETUP.md and docs/STRIPE_INTEGRATION.md are identical, carry the sixteen handled events in two labelled groups (Required, Subscriptions), keep charge.refund.updated in the compatibility sentence only, and drop checkout.session.completed entirely."
    requirement: "RUN-02"
    verification:
      - kind: other
        ref: "grep checks in Task 1, Task 3, and plan-level <verification> — 16-bullet count in both files, string-equality of the two bullet blocks, checkout.session.completed absent, charge.refund.updated absent from bullets, group headings and pointer present, npm run lint clean"
        status: pass
    human_judgment: false
---

# Phase 3 Plan 2: Operator Runbook Corrections Summary

**Rewrote the migration, deploy-path, Node prerequisite, and Stripe webhook sections of three operator runbooks to match the guarded scripts and dispatch switch the repository actually enforces.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3 completed
- **Files modified:** 3

## Accomplishments

- `docs/DEPLOYMENT_SETUP.md`: Node prerequisite corrected to 24.18.1 (`.nvmrc` / `engines`); Step 1 migration block replaced with the guarded `db:migrate:*` scripts for preview/production (local unchanged) plus a pointer to `docs/database-migrations.md`; a single deploy-paths note added above Step 2's `npm run deploy`; Step 4 webhook list replaced with the sixteen handled events in Required/Subscriptions groups.
- `docs/CLAUDE.md`: `npm run deploy:ci` added to the command list with an identical deploy-paths note; the Migration Commands block and Database Changes step 3 both replaced with the guarded scripts and a pointer to `docs/database-migrations.md`.
- `docs/STRIPE_INTEGRATION.md`: section 4 event list mirrored byte-identical from `docs/DEPLOYMENT_SETUP.md` (same groups, same 16 events, same order), leaving the file's own lead-in wording and its out-of-scope `API_STRUCTURE.md` reference untouched.

## Final sixteen-event list (as written, identical in both files)

**Required** (core checkout and refunds):
- `payment_intent.succeeded`
- `payment_intent.payment_failed` (telemetry only; the subscription is deliberately retained)
- `charge.refunded`
- `refund.updated`
- `refund.failed`

**Subscriptions** (required once acquisition is enabled):
- `invoice.paid`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `invoice.payment_attempt_required`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `customer.subscription.pending_update_applied`
- `customer.subscription.pending_update_expired`

`charge.refund.updated` is documented only in the compatibility prose sentence (never as a Required bullet). `checkout.session.completed` no longer appears in either list.

Every one of the sixteen names was cross-checked against the `switch (event.type)` block in `app/api/webhooks/stripe/route.ts:213-264` before committing — each has a live case. `checkout.session.completed` also has a case today (`handleCheckoutCompleted`, outcome `ignored`); Plan 03 removes that dead branch from the route to match the docs.

## Exact deploy-paths wording (identical in both docs/CLAUDE.md and docs/DEPLOYMENT_SETUP.md)

```
**Deploy paths:** `npm run deploy` builds and uploads the Worker and never applies remote migrations.
`npm run deploy:ci` (used by Cloudflare Workers Builds) applies production migrations before upload.
Apply migrations yourself with the guarded `db:migrate:*` scripts; `docs/database-migrations.md` is the binding source.
```

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end runbook correction on DEPLOYMENT_SETUP.md (tracer)** - `7f58c64` (docs)
2. **Task 2: Apply migration/deploy-path corrections to docs/CLAUDE.md** - `f5007d7` (docs)
3. **Task 3: Mirror webhook event list into docs/STRIPE_INTEGRATION.md** - `a97a776` (docs)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `docs/DEPLOYMENT_SETUP.md` - Node prerequisite, guarded migration commands, deploy-paths note, corrected webhook event list
- `docs/CLAUDE.md` - `deploy:ci` command entry + deploy-paths note, guarded Migration Commands block, guarded Database Changes step 3
- `docs/STRIPE_INTEGRATION.md` - section 4 webhook event list mirrored byte-identical from `docs/DEPLOYMENT_SETUP.md`

## Decisions Made

See `key-decisions` in frontmatter — no Node-version line added to `docs/CLAUDE.md` (out of this plan's scope per the plan text), and `docs/STRIPE_INTEGRATION.md`'s own lead-in sentence text was preserved rather than mirrored.

## Deviations from Plan

None - plan executed exactly as written. The tracer task (Task 1) passed all nine acceptance-criteria gates and the tracer feedback gate (re-running the full `<verify>` block) on the first attempt; Tasks 2 and 3 applied the proven corrections without further fixes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This plan edits only documentation files; no code, secrets, or infrastructure changed.

## Next Phase Readiness

Plan 03 (webhook route correction: removing the dead `checkout.session.completed` branch from `app/api/webhooks/stripe/route.ts`) can proceed — the documented event set it must match is now locked in both `docs/DEPLOYMENT_SETUP.md` and `docs/STRIPE_INTEGRATION.md`, and the dispatch switch was cross-checked against all sixteen names during this plan (no case is missing). No blockers.

---
*Phase: 03-decision-lock-in-and-operator-runbooks*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: docs/DEPLOYMENT_SETUP.md
- FOUND: docs/CLAUDE.md
- FOUND: docs/STRIPE_INTEGRATION.md
- FOUND commit: 7f58c64
- FOUND commit: f5007d7
- FOUND commit: a97a776
- All plan-level `<verification>` commands re-run and passed (unguarded migration line count 0, 16-bullet count matches in both files, checkout.session.completed count 0 in both files, deploy-paths note count 1 in both files, `npm run lint` exit 0 with 0 errors).
