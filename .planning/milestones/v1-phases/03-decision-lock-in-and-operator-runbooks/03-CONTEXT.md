# Phase 3: Decision Lock-In and Operator Runbooks - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The four binding-decision docs say what the code does and are marked binding, and the three operator runbooks (`docs/CLAUDE.md`, `docs/DEPLOYMENT_SETUP.md`, `docs/STRIPE_INTEGRATION.md`) describe the migration, deploy, and Stripe webhook procedures the repo actually enforces. Requirements: ADR-01, ADR-02, RUN-01, RUN-02.

In scope: `docs/checkout-trust-boundary.md` (MCP boundary statement plus status marker), `docs/webhooks-refunds-inventory.md`, `docs/database-migrations.md`, `docs/subscriptions.md` (status markers), `gsd-ingest-manifest.yaml` (lock flags), the migration/deploy/Node lines in `docs/CLAUDE.md` and `docs/DEPLOYMENT_SETUP.md`, the webhook event lists in `docs/DEPLOYMENT_SETUP.md` and `docs/STRIPE_INTEGRATION.md`, and one small dead-code removal in `app/api/webhooks/stripe/route.ts`.

Out of scope: every other stale item in these docs (model names, tool counts, `API_STRUCTURE.md` references, README index). Those are Phase 4 (REF-01..04).

</domain>

<decisions>
## Implementation Decisions

### ADR Status Markers and Manifest Lock (ADR-02)
- **Marker placement:** each of the four ADR docs gets one line, `**Status:** Accepted (YYYY-MM-DD)`, directly under the H1 title and before the first paragraph. The ingest classifier (`gsd-doc-classifier`) marks an ADR locked only when it reads the literal `Status: Accepted`; the bold-markdown form still contains that literal. No frontmatter, no footer section.
- **Dates are the first-commit dates of each doc**, when the decisions actually took effect: `checkout-trust-boundary.md` 2026-08-05, `webhooks-refunds-inventory.md` 2026-08-06, `database-migrations.md` 2026-08-03, `subscriptions.md` 2026-08-14. Today (2026-09-02) is only when they were labeled; it goes in the manifest comment, not on the docs.
- **Manifest change is minimal:** add `locked: true` to the four ADR entries in `gsd-ingest-manifest.yaml` with a one-line comment giving the lock date. SPEC, PRD, and DOC entries are untouched; no explicit `locked: false` anywhere.
- **Verification of "no I17 note, no W1 warning" is two-tier.** In-phase, the executor runs a structural check matching the classifier's rule: each ADR file contains `Status: Accepted`, and the manifest has exactly four `locked: true` lines, one per ADR path. The full `/gsd-ingest-docs --manifest gsd-ingest-manifest.yaml` re-run is recorded as a human verification item for Russell, to be done on a throwaway branch because merge mode can write to `.planning/`. The phase does not run the full ingest itself.

### Trust Boundary Correction (ADR-01)
- **Edit scope is the two "remains outside" sentences** in the "Scope and schema" section of `docs/checkout-trust-boundary.md` (currently lines ~101–103). They are replaced by a short paragraph stating that MCP `create_payment_intent` and `place_order` use the shared checkout pricing service and the same idempotent finalizer as the storefront `POST /api/orders` and the Stripe webhook path, and that MCP checkout is inside the paid inventory boundary. Nothing else in the doc moves.
- **Supersession is recorded in one sentence:** an earlier version of this doc stated MCP checkout was outside the boundary; that was corrected on 2026-09-02 after verifying the code. No changelog section.
- **The new text names code:** `lib/services/checkout-pricing.ts`, `lib/services/order-finalization.ts`, and the two MCP tool names. The executor verifies each name against the MCP tool source (grep under `lib/mcp` or wherever the tools are registered) before writing, and adjusts the wording if a name differs. Docs matching code exactly is the standing rule from Phase 1.
- **Other stale lines in the doc stay** (the "U09 adds migrations `0008` through `0011`" and "U13 must replace" sentences). A wider sweep is not ADR-01.

### Migration and Deploy Runbook (RUN-01)
- **Local migration command stays as `npx wrangler d1 migrations apply mercora-db --local`** (harmless; it is what `db:prepare:local` wraps). Remote commands are replaced by the npm scripts only: `npm run db:migrate:status:preview`, `npm run db:migrate:apply:preview`, `npm run db:migrate:status:production`, and `MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1 npm run db:migrate:apply:production`. This applies to `docs/CLAUDE.md` (Migration Commands block ~line 220 and the "Database Changes" step ~line 459) and `docs/DEPLOYMENT_SETUP.md` (Step 1: Run Migrations ~lines 246–252). Each block ends with a pointer to `docs/database-migrations.md` as the binding source. No unguarded production `wrangler d1 migrations apply mercora-db` remains in either doc.
- **Deploy-path distinction appears in two places:** a three-line "Deploy paths" note at the first `npm run deploy` in `docs/DEPLOYMENT_SETUP.md` (Step 2, ~line 282) and next to the `deploy` line in the `docs/CLAUDE.md` command list (~line 61). Content: `npm run deploy` never applies remote migrations; `npm run deploy:ci` (used by Cloudflare Workers Builds) applies production migrations before upload.
- **Node requirement reads "Node.js 24.18.1 (pinned in `.nvmrc` and `engines` in package.json)"** replacing "Node.js 18+" at `docs/DEPLOYMENT_SETUP.md` ~line 29. If `docs/CLAUDE.md` states a Node version anywhere, it gets the same text.
- **The other `npm run deploy` mentions stay** (`docs/DEPLOYMENT_SETUP.md` ~lines 330 and 404). They describe a correct manual deploy; the Q2 clarifier covers them.

### Stripe Webhook Event Lists (RUN-02)
- **Final list, identical in both docs.** Required (core checkout and refunds): `payment_intent.succeeded`, `payment_intent.payment_failed` (handled as telemetry only since Phase 2; subscription deliberately retained), `charge.refunded`, `refund.updated`, `refund.failed`. Subscriptions (required once acquisition is enabled): `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.payment_attempt_required`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.pending_update_applied`, `customer.subscription.pending_update_expired`. A note states `charge.refund.updated` is accepted for compatibility with older Stripe configurations but is not required. `checkout.session.completed` is removed from both lists.
- **The dead `checkout.session.completed` code is removed too:** delete that `case` and the `handleCheckoutCompleted` function from `app/api/webhooks/stripe/route.ts`. The handler body is comments only and the case sets `outcome = 'ignored'`, which is exactly what the `default` branch does, so runtime behavior is unchanged. No file under `tests/`, `lib/`, or `app/` other than the route references it. The existing webhook test suite must still pass.
- **Layout is two labeled groups** in each doc ("Required" and "Subscriptions (required once acquisition is enabled)"), with the same wording in `docs/DEPLOYMENT_SETUP.md` Step 4 (~lines 203–210) and `docs/STRIPE_INTEGRATION.md` section 4 (~lines 60–67).
- **`docs/webhooks-refunds-inventory.md` stays the binding source** for the required set. Both runbooks carry the full list plus a one-line pointer to it. The `API_STRUCTURE.md` reference at `docs/STRIPE_INTEGRATION.md:99` is left for Phase 4 (REF-02).

### Claude's Discretion
- Exact wording of the status line comment in the manifest, the supersession sentence, the "Deploy paths" note, and the group headings.
- Whether the four ADR docs also get a one-line "Binding: changes require a new decision" sentence next to the status marker.
- Plan split (docs-only plans can run in one wave; the route edit and its test run can be its own plan).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json` already defines the guarded scripts: `db:prepare:local`, `db:migrate:status:preview`, `db:migrate:apply:preview`, `db:migrate:status:production`, `db:migrate:apply:production` (via `scripts/d1-migrate.mjs`), `deploy`, `deploy:ci`, and `check:migrations`. `engines.node` is `>=24.18.1 <25`; `.nvmrc` and `.node-version` pin 24.18.1.
- `docs/database-migrations.md` already states the policy ("does not apply remote D1 migrations as part of `npm run deploy`"). The runbooks only need to point at it and stop contradicting it.
- `docs/webhooks-refunds-inventory.md` "Required Stripe configuration" section already lists the required core events and the `charge.refund.updated` compatibility note. Reuse that wording.
- `.planning/phases/02-observability-and-regression-guards/deferred-items.md` "Webhook events" note carries the verified post-Phase-2 dispatch list and the decision that `payment_intent.payment_failed` stays subscribed.

### Established Patterns
- Docs must describe exactly what code enforces (Phase 1 SEC-04 rule). Named placeholders, never literal secrets.
- The webhook route dispatches through one `switch (event.type)` in `app/api/webhooks/stripe/route.ts` (~lines 214–255); unknown events fall to `default: outcome = 'ignored'`. Subscription events all route to `handleSubscriptionStripeEvent(event)`.
- The ingest classifier (`~/.claude/agents/gsd-doc-classifier.md`) sets `locked: true` only for an ADR whose status reads `Accepted`; `Proposed`/`Draft` are not locked. Manifest entries are `- path: ... / type: ADR`.
- Commit convention from prior phases: `docs(03): ...` for planning artifacts, conventional commits for code.

### Integration Points
- `gsd-ingest-manifest.yaml` (repo root, currently untracked in git status; the executor should confirm whether to `git add` it, since ADR-02 requires it to carry the lock flags).
- `app/api/webhooks/stripe/route.ts` dispatch switch and the `handleCheckoutCompleted` function (~line 362).
- `docs/CLAUDE.md` ~lines 61, 219–223, 457–459; `docs/DEPLOYMENT_SETUP.md` ~lines 29, 203–210, 246–252, 282; `docs/STRIPE_INTEGRATION.md` ~lines 60–67.

</code_context>

<specifics>
## Specific Ideas

- Status marker format: `**Status:** Accepted (2026-08-05)` as line 3 of each ADR (after H1 and a blank line).
- The MCP boundary paragraph should read as a positive statement of what is shared, then the boundary conclusion, then the one-sentence correction note.
- The human verification item for ADR-02 should spell out the exact command and the branch safety step so Russell can run it in under a minute.

</specifics>

<deferred>
## Deferred Ideas

- Other stale content in `docs/checkout-trust-boundary.md` (U09/U13 planning sentences) — Phase 4 or backlog.
- `docs/STRIPE_INTEGRATION.md:99` reference to nonexistent `docs/API_STRUCTURE.md` — Phase 4 (REF-02).
- Whether `payment_intent.payment_failed` should eventually do more than emit telemetry — backlog; Phase 2 decided telemetry-only.

</deferred>
