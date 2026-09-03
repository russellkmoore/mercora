# Phase 3: Decision Lock-In and Operator Runbooks - Research

**Researched:** 2026-09-02
**Domain:** Documentation correctness (ADR status/locking, operator runbooks, Stripe webhook config) — no new libraries, no new runtime code beyond one dead-code removal
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**ADR Status Markers and Manifest Lock (ADR-02)**
- Marker placement: each of the four ADR docs gets one line, `**Status:** Accepted (YYYY-MM-DD)`, directly under the H1 title and before the first paragraph. The ingest classifier (`gsd-doc-classifier`) marks an ADR locked only when it reads the literal `Status: Accepted`; the bold-markdown form still contains that literal. No frontmatter, no footer section.
- Dates are the first-commit dates of each doc, when the decisions actually took effect: `checkout-trust-boundary.md` 2026-08-05, `webhooks-refunds-inventory.md` 2026-08-06, `database-migrations.md` 2026-08-03, `subscriptions.md` 2026-08-14. Today (2026-09-02) is only when they were labeled; it goes in the manifest comment, not on the docs.
- Manifest change is minimal: add `locked: true` to the four ADR entries in `gsd-ingest-manifest.yaml` with a one-line comment giving the lock date. SPEC, PRD, and DOC entries are untouched; no explicit `locked: false` anywhere.
- Verification of "no I17 note, no W1 warning" is two-tier. In-phase, the executor runs a structural check matching the classifier's rule: each ADR file contains `Status: Accepted`, and the manifest has exactly four `locked: true` lines, one per ADR path. The full `/gsd-ingest-docs --manifest gsd-ingest-manifest.yaml` re-run is recorded as a human verification item for Russell, to be done on a throwaway branch because merge mode can write to `.planning/`. The phase does not run the full ingest itself.

**Trust Boundary Correction (ADR-01)**
- Edit scope is the two "remains outside" sentences in the "Scope and schema" section of `docs/checkout-trust-boundary.md` (currently lines ~101–103). They are replaced by a short paragraph stating that MCP `create_payment_intent` and `place_order` use the shared checkout pricing service and the same idempotent finalizer as the storefront `POST /api/orders` and the Stripe webhook path, and that MCP checkout is inside the paid inventory boundary. Nothing else in the doc moves.
- Supersession is recorded in one sentence: an earlier version of this doc stated MCP checkout was outside the boundary; that was corrected on 2026-09-02 after verifying the code. No changelog section.
- The new text names code: `lib/services/checkout-pricing.ts`, `lib/services/order-finalization.ts`, and the two MCP tool names. The executor verifies each name against the MCP tool source before writing, and adjusts the wording if a name differs. Docs matching code exactly is the standing rule from Phase 1.
- Other stale lines in the doc stay (the "U09 adds migrations `0008` through `0011`" and "U13 must replace" sentences). A wider sweep is not ADR-01.

**Migration and Deploy Runbook (RUN-01)**
- Local migration command stays as `npx wrangler d1 migrations apply mercora-db --local` (harmless; it is what `db:prepare:local` wraps). Remote commands are replaced by the npm scripts only: `npm run db:migrate:status:preview`, `npm run db:migrate:apply:preview`, `npm run db:migrate:status:production`, and `MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1 npm run db:migrate:apply:production`. This applies to `docs/CLAUDE.md` (Migration Commands block ~line 220 and the "Database Changes" step ~line 459) and `docs/DEPLOYMENT_SETUP.md` (Step 1: Run Migrations ~lines 246–252). Each block ends with a pointer to `docs/database-migrations.md` as the binding source. No unguarded production `wrangler d1 migrations apply mercora-db` remains in either doc.
- Deploy-path distinction appears in two places: a three-line "Deploy paths" note at the first `npm run deploy` in `docs/DEPLOYMENT_SETUP.md` (Step 2, ~line 282) and next to the `deploy` line in the `docs/CLAUDE.md` command list (~line 61). Content: `npm run deploy` never applies remote migrations; `npm run deploy:ci` (used by Cloudflare Workers Builds) applies production migrations before upload.
- Node requirement reads "Node.js 24.18.1 (pinned in `.nvmrc` and `engines` in package.json)" replacing "Node.js 18+" at `docs/DEPLOYMENT_SETUP.md` ~line 29. If `docs/CLAUDE.md` states a Node version anywhere, it gets the same text.
- The other `npm run deploy` mentions stay (`docs/DEPLOYMENT_SETUP.md` ~lines 330 and 404). They describe a correct manual deploy; the Q2 clarifier covers them.

**Stripe Webhook Event Lists (RUN-02)**
- Final list, identical in both docs. Required (core checkout and refunds): `payment_intent.succeeded`, `payment_intent.payment_failed` (handled as telemetry only since Phase 2; subscription deliberately retained), `charge.refunded`, `refund.updated`, `refund.failed`. Subscriptions (required once acquisition is enabled): `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.payment_attempt_required`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.pending_update_applied`, `customer.subscription.pending_update_expired`. A note states `charge.refund.updated` is accepted for compatibility with older Stripe configurations but is not required. `checkout.session.completed` is removed from both lists.
- The dead `checkout.session.completed` code is removed too: delete that `case` and the `handleCheckoutCompleted` function from `app/api/webhooks/stripe/route.ts`. The handler body is comments only and the case sets `outcome = 'ignored'`, which is exactly what the `default` branch does, so runtime behavior is unchanged. No file under `tests/`, `lib/`, or `app/` other than the route references it. The existing webhook test suite must still pass.
- Layout is two labeled groups in each doc ("Required" and "Subscriptions (required once acquisition is enabled)"), with the same wording in `docs/DEPLOYMENT_SETUP.md` Step 4 (~lines 203–210) and `docs/STRIPE_INTEGRATION.md` section 4 (~lines 60–67).
- `docs/webhooks-refunds-inventory.md` stays the binding source for the required set. Both runbooks carry the full list plus a one-line pointer to it. The `API_STRUCTURE.md` reference at `docs/STRIPE_INTEGRATION.md:99` is left for Phase 4 (REF-02).

### Claude's Discretion
- Exact wording of the status line comment in the manifest, the supersession sentence, the "Deploy paths" note, and the group headings.
- Whether the four ADR docs also get a one-line "Binding: changes require a new decision" sentence next to the status marker.
- Plan split (docs-only plans can run in one wave; the route edit and its test run can be its own plan).

### Deferred Ideas (OUT OF SCOPE)
- Other stale content in `docs/checkout-trust-boundary.md` (U09/U13 planning sentences) — Phase 4 or backlog.
- `docs/STRIPE_INTEGRATION.md:99` reference to nonexistent `docs/API_STRUCTURE.md` — Phase 4 (REF-02).
- Whether `payment_intent.payment_failed` should eventually do more than emit telemetry — backlog; Phase 2 decided telemetry-only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| ADR-01 | `docs/checkout-trust-boundary.md` no longer states MCP checkout is outside the paid inventory boundary; states it shares the pricing service and finalizer and is inside the boundary | Verified exact current sentence text (lines 99-103) and verified the shared-service claim against `lib/mcp/checkout.ts` and `lib/mcp/tools/order.ts` import graphs — see Code Examples |
| ADR-02 | Four ADR docs carry `Status: Accepted` with a date; manifest marks all four `locked: true`; re-running ingest produces neither the I17 note nor the W1 warning | Verified the classifier does NOT read the manifest's `locked:` field (major finding); verified exact I17/W1 text in `.planning/INGEST-CONFLICTS.md`; verified all four docs' H1/blank-line structure and first-commit dates; flagged the literal-substring grep pitfall — see Pitfall 1, Pitfall 2, Don't Hand-Roll |
| RUN-01 | Runbooks show only guarded migration commands, the deploy/deploy:ci distinction, and Node 24; no unguarded production migration command remains | Verified exact current text at all cited line numbers in both docs; verified the production gate's exact env var name and flag (`scripts/lib/d1-migrate-plan.mjs:130-144`); verified `docs/CLAUDE.md` has no Node-version line to edit (Pitfall 4) |
| RUN-02 | Webhook event lists match the route's handled events and ADR-WRI-02's required set; `checkout.session.completed` is gone | Verified exact current event lists in both docs; verified the full dispatch switch and confirmed `handleCheckoutCompleted` is dead code identical to `default`; verified all 11 subscription events have handlers; verified no test references the removed code — see Code Examples, Validation Architecture |
</phase_requirements>

## Summary

This phase is documentation-truth work, not feature work. Every claim in scope was verified directly against the tool source (`gsd-doc-classifier.md`, `gsd-doc-synthesizer.md`, `doc-conflict-engine.md`, `ingest-docs.md`) and the application code (MCP tool files, the webhook route, the migration scripts, `package.json`). The four success criteria map cleanly to four independent edit sets: a two-sentence correction in `checkout-trust-boundary.md` (ADR-01), a one-line status marker in four ADR docs plus a manifest annotation (ADR-02), a small set of command-block replacements in two runbooks (RUN-01), and a webhook event-list sync plus one dead-function removal (RUN-02).

The single most important finding is that **`gsd-ingest-manifest.yaml`'s `locked:` field is not read by any part of the ingest pipeline.** The classifier only receives `MANIFEST_TYPE` and `MANIFEST_PRECEDENCE` from the manifest; whether an ADR is `locked: true` is decided exclusively by the classifier reading the document's own status text. Adding `locked: true` lines to the manifest (as ADR-02 literally asks) is a harmless, human-readable annotation but has **zero effect** on whether a future `/gsd-ingest-docs` run reproduces the I17 note or the W1 warning. The only thing that prevents I17 is each ADR doc actually containing a status line the classifier's semantic read recognizes as "Accepted." The only thing that prevents W1 is `checkout-trust-boundary.md`'s text agreeing with the SPEC/PRD sources it currently contradicts (which ADR-01 already does).

A second load-bearing finding: the "I17" and "W1" identifiers in the phase's acceptance criteria are **not** literal codes emitted by any GSD tool — the taxonomy is `[BLOCKER]`/`[WARNING]`/`[INFO]` with no numbering scheme in `doc-conflict-engine.md`. "I17" and "W1" are just this repo's own sequential numbering inside its already-generated `.planning/INGEST-CONFLICTS.md` from the original `/gsd-ingest-docs` run. Both entries were read directly and are quoted below — the planner should write acceptance criteria against those quoted findings, not against an assumed stable code scheme (a second ingest run today would likely renumber both).

**Primary recommendation:** verify by direct string/line inspection (structural checks), not by re-running `/gsd-ingest-docs`, which the user already scoped out of this phase (human-verification item on a throwaway branch).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ADR status/lock correctness | Docs (repo content) | GSD tooling (classifier) | The classifier reads doc content at ingest time; the manifest is a routing hint only, not a lock authority |
| Trust-boundary statement accuracy | Docs (repo content) | API/Backend (`lib/mcp`, `lib/services`) | Docs must describe what the shared services/MCP tools actually do; verified via `lib/mcp/checkout.ts` and `lib/mcp/tools/order.ts` imports |
| Migration/deploy runbook accuracy | Docs (repo content) | Build/CI (`package.json`, `scripts/`) | Docs must mirror the guarded npm scripts and `scripts/lib/d1-migrate-plan.mjs`'s `canApply()` gate, not restate raw `wrangler` commands |
| Stripe webhook event list accuracy | Docs (repo content) | API/Backend (`app/api/webhooks/stripe/route.ts`) | The dispatch `switch` is the source of truth; docs must not list events with no handler |
| Dead webhook code removal | API/Backend | Database/Storage (none touched) | `handleCheckoutCompleted` never mutates order state; removal is behavior-neutral (both branches already set `outcome = 'ignored'`) |

## Standard Stack

Not applicable — this phase adds no dependencies. No `npm install` step, no new libraries. Skip the "Don't Hand-Roll" and "Package Legitimacy Audit" sections' library-vetting purpose; they are noted below as N/A for completeness.

### Package Legitimacy Audit

**N/A — this phase installs no external packages.** No `npm view`/registry check required. If a future plan for this phase introduces a dependency, re-run the Package Legitimacy Gate at that time.

## Architecture Patterns

### System Architecture Diagram

```
docs/*.md (ADR/DOC sources)                     app source of truth
─────────────────────────────                   ────────────────────────────
checkout-trust-boundary.md  ── describes ──►     lib/mcp/checkout.ts
  (ADR-01 edit here)                                → priceCheckout()      [lib/services/checkout-pricing.ts:519]
                                                     → finalizeZeroCashGiftOrder() [lib/services/order-finalization.ts:44]
                                              lib/mcp/tools/order.ts (place_order)
                                                     → finalizeOrderPayment() [lib/services/order-finalization.ts:94]

checkout-trust-boundary.md   ┐
webhooks-refunds-inventory.md├── Status marker + manifest ──►  /gsd-ingest-docs (NOT run in-phase)
database-migrations.md       │   (ADR-02 edit here)                │
subscriptions.md             ┘                                     ▼
                                                    gsd-doc-classifier.md reads doc
                                                    content only (manifest `locked:`
                                                    field is NOT consumed) ──► sets
                                                    classification.locked = true|false

docs/CLAUDE.md, docs/DEPLOYMENT_SETUP.md  ── describes ──►  package.json scripts
  (RUN-01 edits here)                                          → deploy / deploy:ci
                                                                → db:migrate:status/apply:*
                                                          scripts/lib/d1-migrate-plan.mjs
                                                                → canApply() gate (MERCORA_ALLOW_PRODUCTION_MIGRATIONS + --confirm-*)

docs/DEPLOYMENT_SETUP.md, docs/STRIPE_INTEGRATION.md ── describes ──► app/api/webhooks/stripe/route.ts
  (RUN-02 edits here)                                                   → switch(event.type) dispatch (line 214)
                                                                         → handleCheckoutCompleted deleted (line 362)
```

### Recommended Plan Structure (per Claude's Discretion note in CONTEXT.md)

```
Plan A (docs-only, one wave):
  - ADR-01 edit: checkout-trust-boundary.md lines ~101-103
  - ADR-02 edit: 4x Status marker + gsd-ingest-manifest.yaml locked annotations
  - RUN-01 edit: docs/CLAUDE.md + docs/DEPLOYMENT_SETUP.md command/Node/deploy-path blocks
  - RUN-02 doc edit: docs/DEPLOYMENT_SETUP.md + docs/STRIPE_INTEGRATION.md event lists

Plan B (code + test, separate wave — has a verify step the docs-only plan doesn't need):
  - RUN-02 code edit: delete `checkout.session.completed` case + handleCheckoutCompleted() in route.ts
  - Verify: npx vitest run tests/unit/app/api/stripe-webhook-*.test.ts
```

### Anti-Patterns to Avoid
- **Treating the manifest `locked:` field as functional.** It is not read by the classifier or synthesizer (verified: `gsd-doc-classifier.md` lines 163-164, 175, 217, 242-244 only reference `MANIFEST_TYPE`/`MANIFEST_PRECEDENCE`; `ingest-docs.md` lines 99-112 document the manifest YAML shape as `path` + `type` + `precedence` only, no `locked` key). Do not write an acceptance criterion that depends on the manifest's `locked:` value changing ingest behavior.
- **Grepping for the literal substring `"Status: Accepted"` as a stand-in for the classifier's judgment.** The chosen marker format is `**Status:** Accepted (YYYY-MM-DD)` — the literal characters between `Status:` and `Accepted` are `**` + a space, not a single space. A grep for the exact string `Status: Accepted` will **not** match `**Status:** Accepted (...)`. See Pitfall 1.
- **Re-running `/gsd-ingest-docs` in-phase.** CONTEXT.md already scopes this out (merge mode can write to `.planning/`); it is a human-verification item on a throwaway branch, not an in-phase executor step.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Verifying "no I17/no W1" | A custom parser that re-implements classifier semantics | Structural grep/line checks against the four ADR docs + manifest, deferring the full-fidelity check to the human-verification ingest re-run | The classifier's `locked` determination is an LLM semantic read (see `gsd-doc-classifier.md` step `extract_metadata`), not a fixed regex — an in-phase grep can only approximate it, never replace it |

**Key insight:** There is no way to deterministically prove "the classifier will treat this as Accepted" without invoking the classifier. The executor's structural check is a proxy, not a guarantee — CONTEXT.md already accounts for this by making the full ingest re-run a separate human-verification item.

## Common Pitfalls

### Pitfall 1: Literal "Status: Accepted" grep misses the bold-markdown marker
**What goes wrong:** An executor writes `grep -c "Status: Accepted" docs/*.md` to verify all four ADRs, expecting 4 matches, but gets 0 — because the chosen format is `**Status:** Accepted (2026-08-05)`, and the two `**` characters plus placement (`Status:**` then ` Accepted`) means the contiguous substring `Status: Accepted` never appears in the file.
**Why it happens:** CONTEXT.md's decision text says "the bold-markdown form still contains that literal" — this is true only in the loose sense that a human or an LLM reading the line recognizes "status: Accepted" semantically. It is **not** true as an exact-substring claim: `**Status:**` breaks the substring with two asterisks immediately after the colon.
**How to avoid:** Any structural check the executor writes must tolerate the markdown, e.g. `grep -E '^\*\*Status:\*\*\s*Accepted' docs/{checkout-trust-boundary,webhooks-refunds-inventory,database-migrations,subscriptions}.md` (count = 4), or strip `*` characters before comparing. Do not gate the plan's verification step on the bare literal `Status: Accepted`.
**Warning signs:** A verification command that reports 0 matches against docs the executor just edited.

### Pitfall 2: Treating `gsd-ingest-manifest.yaml`'s `locked: true` as load-bearing
**What goes wrong:** A plan task is written as "add `locked: true` to the manifest so the classifier locks the ADR," implying causality that doesn't exist.
**Why it happens:** The requirement text (ADR-02) reads naturally as if the manifest controls locking, and manifests commonly do carry authoritative flags in other systems.
**How to avoid:** Frame the manifest edit as a **human-readable record** (matching CONTEXT.md's own wording: "Manifest change is minimal... with a one-line comment giving the lock date"), separate from the actual gate, which is the ADR doc's own Status line. Both edits are still required by the phase's success criteria — just don't conflate their mechanisms in acceptance-criteria wording.
**Warning signs:** A verify step that only checks the manifest and skips checking the ADR doc content, or vice versa.

### Pitfall 3: `payment_intent.payment_failed` case looks removable but must stay
**What goes wrong:** Seeing "Events with no handler after OBS-05 ... are gone" in the RUN-02 requirement text, an executor might delete the `payment_intent.payment_failed` case along with `checkout.session.completed`.
**Why it happens:** OBS-05 (Phase 2, complete) resolved the previously-empty `handlePaymentFailed` TODO by wiring it to telemetry (`recordTelemetry('payment.intent_failed', ...)` at `app/api/webhooks/stripe/route.ts:347-356`) — it is not empty/dead code anymore, and CONTEXT.md's Phase 3 decision explicitly keeps it in the "Required" webhook list.
**How to avoid:** Only `checkout.session.completed` and its handler `handleCheckoutCompleted` (lines 224-227, 358-380) are dead. `payment_intent.payment_failed` (lines 219-222) stays in both the switch statement and both runbook doc lists.
**Warning signs:** A diff that touches the `payment_intent.payment_failed` case block.

### Pitfall 4: `docs/CLAUDE.md` has no Node-version line to edit
**What goes wrong:** A task is written to "update the Node version line in docs/CLAUDE.md" per RUN-01's phrasing ("If docs/CLAUDE.md states a Node version anywhere, it gets the same text"), but no such line exists.
**Why it happens:** Only `docs/DEPLOYMENT_SETUP.md:29` ("- **Node.js 18+** and npm/yarn/pnpm") states a Node version among the three runbooks; `docs/CLAUDE.md` and `docs/STRIPE_INTEGRATION.md` never mention one (confirmed via `grep -n -i "node\.js\|node 1[0-9]\|node 2[0-9]\|nvmrc"` returning zero matches in either file).
**How to avoid:** RUN-01's Node-version edit is single-file: `docs/DEPLOYMENT_SETUP.md:29` only. Don't create a no-op task for `docs/CLAUDE.md`.
**Warning signs:** A plan task targeting a Node-version string in `docs/CLAUDE.md` that the executor can't find.

## Code Examples

### Verified: `create_payment_intent` uses the shared checkout pricing service
```typescript
// Source: lib/mcp/checkout.ts:7-11 (import), :116-117 (call site) — read this session
import {
  priceCheckout,
  MAX_CHECKOUT_LINES,
  type CheckoutQuote,
} from '@/lib/services/checkout-pricing';
// ...
? await priceCheckout(pricingInput, { capabilities })
```
[VERIFIED: lib/mcp/checkout.ts:7-11,116-117]

### Verified: `place_order` uses the shared idempotent finalizer
```typescript
// Source: lib/mcp/tools/order.ts:1-6 (import), :148 (call site) — read this session
import {
  finalizeOrderPayment,
  PaymentVerificationError,
} from '../../services/order-finalization';
// ...
const result = await finalizeOrderPayment({
```
[VERIFIED: lib/mcp/tools/order.ts:1-6,148]

### Verified: production migration gate (name it exactly)
```javascript
// Source: scripts/lib/d1-migrate-plan.mjs:130-144 — read this session
export function canApply({ target, flags, environment }) {
  if (target === "local") return { allowed: true };
  if (target === "preview") {
    return flags.includes("--confirm-preview")
      ? { allowed: true }
      : { allowed: false, reason: "Preview apply requires --confirm-preview." };
  }
  return flags.includes("--confirm-production") && environment.MERCORA_ALLOW_PRODUCTION_MIGRATIONS === "1"
    ? { allowed: true }
    : {
        allowed: false,
        reason:
          "Production apply requires --confirm-production and MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1. It is never run by deploy.",
      };
}
```
[VERIFIED: scripts/lib/d1-migrate-plan.mjs:130-144] — env var is exactly `MERCORA_ALLOW_PRODUCTION_MIGRATIONS` (equality-checked against the string `"1"`), flags are exactly `--confirm-production` / `--confirm-preview`.

### Verified: webhook dispatch switch and the dead branch to remove
```typescript
// Source: app/api/webhooks/stripe/route.ts:213-255 — read this session
switch (event.type) {
  case 'payment_intent.succeeded':
    outcome = await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
    break;

  case 'payment_intent.payment_failed':
    await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
    outcome = 'handled';
    break;

  case 'checkout.session.completed':               // ← RUN-02 deletes this case
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    outcome = 'ignored';
    break;

  case 'invoice.paid':
  case 'invoice.payment_succeeded':
  case 'invoice.payment_failed':
  case 'invoice.payment_attempt_required':
  case 'customer.subscription.created':
  case 'customer.subscription.updated':
  case 'customer.subscription.deleted':
  case 'customer.subscription.paused':
  case 'customer.subscription.resumed':
  case 'customer.subscription.pending_update_applied':
  case 'customer.subscription.pending_update_expired':
    outcome = await handleSubscriptionStripeEvent(event);
    break;

  case 'charge.refunded':
    outcome = await handleChargeRefunded(event.data.object as Stripe.Charge);
    break;

  case 'refund.updated':
  case 'refund.failed':
  case 'charge.refund.updated':
    outcome = await handleRefundLifecycle(event.data.object as Stripe.Refund);
    break;

  default:
    outcome = 'ignored';
}
```
```typescript
// Source: app/api/webhooks/stripe/route.ts:358-380 — the function RUN-02 deletes, read this session
/**
 * Handle completed checkout session
 * Processes successful checkout completion
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;

  if (!orderId) return;

  try {
    // Handle checkout completion
    // You can add additional logic here:
    // - Final order confirmation
    // - Customer onboarding
    // - Thank you emails

  } catch (error) {
    recordTelemetry('webhook.processing_failed', {
      operation: 'process', outcome: 'failed', provider: 'd1', retryable: true,
      path: '/api/webhooks/stripe', trigger: 'webhook',
    }, error);
  }
}
```
[VERIFIED: app/api/webhooks/stripe/route.ts:213-255,358-380] — body of `handleCheckoutCompleted` is comments only; its `case` sets `outcome = 'ignored'`, identical to the `default` branch (line 254). Removal is behavior-neutral. Also confirmed: no file under `tests/`, `lib/`, or `app/` other than this route references `checkout.session.completed` or `handleCheckoutCompleted` (`grep -rln` across `tests/ lib/ app/` returns only `app/api/webhooks/stripe/route.ts` itself).

### Verified: the two "remains outside" sentences ADR-01 replaces
```markdown
<!-- Source: docs/checkout-trust-boundary.md lines 99-103 — read this session -->
## Scope and schema

This boundary does not expose trusted MCP payment operations or start
fulfillment. MCP checkout remains outside the paid inventory boundary until it
performs the same PaymentIntent verification.
```
[VERIFIED: docs/checkout-trust-boundary.md:99-103]

### Verified: current runbook command blocks RUN-01 replaces
```markdown
<!-- Source: docs/CLAUDE.md lines 60-63 — read this session -->
# Deployment
npm run deploy                 # Clean, build, and deploy to Cloudflare
npm run clean                  # Remove build artifacts
npm run preview               # Build and preview locally
```
```markdown
<!-- Source: docs/CLAUDE.md lines 219-223 — read this session -->
**Migration Commands:**
```bash
npx wrangler d1 migrations apply mercora-db --local  # Local
npx wrangler d1 migrations apply mercora-db          # Production
```
```
```markdown
<!-- Source: docs/CLAUDE.md lines 456-459 — read this session -->
### Database Changes
1. Modify schema in `lib/db/schema/`
2. Generate migration with Drizzle
3. Apply with `wrangler d1 migrations apply`
```
```markdown
<!-- Source: docs/DEPLOYMENT_SETUP.md line 29 — read this session -->
- **Node.js 18+** and npm/yarn/pnpm
```
```markdown
<!-- Source: docs/DEPLOYMENT_SETUP.md lines 245-252 — read this session -->
### **Step 1: Run Migrations**
```bash
# Apply migrations to local database (for development)
npx wrangler d1 migrations apply mercora-db --local

# Apply migrations to production database
npx wrangler d1 migrations apply mercora-db
```
```
```markdown
<!-- Source: docs/DEPLOYMENT_SETUP.md line 282 — read this session, first `npm run deploy` occurrence -->
# Deploy the application first
npm run deploy
```
[VERIFIED: docs/CLAUDE.md:60-63,219-223,456-459 and docs/DEPLOYMENT_SETUP.md:29,245-252,282] — all quoted verbatim. The two later `npm run deploy` mentions that CONTEXT.md says stay unchanged are at `docs/DEPLOYMENT_SETUP.md:330` and `:404` (confirmed by `grep -n`).

### Verified: current Stripe webhook event lists RUN-02 replaces
```markdown
<!-- Source: docs/DEPLOYMENT_SETUP.md lines 205-211 — read this session -->
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
   - `charge.refunded`
   - `refund.updated`
   - `refund.failed`
```
```markdown
<!-- Source: docs/STRIPE_INTEGRATION.md lines 62-68 — read this session -->
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
   - `charge.refunded`
   - `refund.updated`
   - `refund.failed`
```
[VERIFIED: docs/DEPLOYMENT_SETUP.md:205-211, docs/STRIPE_INTEGRATION.md:62-68]

### Verified: `docs/webhooks-refunds-inventory.md`'s binding required-event set (ADR-WRI-02)
```markdown
<!-- Source: docs/webhooks-refunds-inventory.md lines 15-23 — read this session -->
Subscribe it to these events:

- `payment_intent.succeeded`
- `charge.refunded`
- `refund.updated`
- `refund.failed`

`charge.refund.updated` is also supported for compatibility with older Stripe
event configurations. `refund.updated` is the preferred lifecycle event.
```
[VERIFIED: docs/webhooks-refunds-inventory.md:15-23] — this doc does NOT list `payment_intent.payment_failed`; CONTEXT.md's decision to add it to the "Required" group in the two runbooks is a Phase-3-specific addition on top of ADR-WRI-02's base set, justified by OBS-05's telemetry wiring, not a discrepancy to fix in `webhooks-refunds-inventory.md` itself (out of scope — that doc is untouched by RUN-02 per the phase boundary).

### Verified: subscription events are all handled (justifies the "Subscriptions" group list)
```typescript
// Source: app/api/webhooks/stripe/handlers/subscription-handlers.ts:35-41 — read this session
'customer.subscription.created',
'customer.subscription.updated',
'customer.subscription.deleted',
'customer.subscription.paused',
'customer.subscription.resumed',
'customer.subscription.pending_update_applied',
'customer.subscription.pending_update_expired',
```
[VERIFIED: app/api/webhooks/stripe/handlers/subscription-handlers.ts:35-41] plus `invoice.paid`/`invoice.payment_succeeded` handled at line 404, `invoice.payment_failed`/`invoice.payment_attempt_required` at line 407 — all 11 subscription-group events in CONTEXT.md's final list have a confirmed handler.

### Verified: ADR doc top structure (Status marker placement)
```markdown
<!-- All four docs share this shape — read this session -->
# {H1 Title}
                                      ← blank line 2
{first paragraph of prose}           ← line 3, currently
```
Files and confirmed first-commit dates (`git log --follow`, read this session):
| File | H1 line | First-commit date |
|---|---|---|
| `docs/checkout-trust-boundary.md` | 1 | 2026-08-05 |
| `docs/webhooks-refunds-inventory.md` | 1 | 2026-08-06 |
| `docs/database-migrations.md` | 1 | 2026-08-03 |
| `docs/subscriptions.md` | 1 | 2026-08-14 |
[VERIFIED: git log --follow output for all four files, and direct read of lines 1-4 of each]

### Confirmed: manifest is untracked, no `locked:` field currently present
```bash
$ git status --porcelain gsd-ingest-manifest.yaml
?? gsd-ingest-manifest.yaml
```
[VERIFIED: `git status --porcelain` output, and full read of `gsd-ingest-manifest.yaml` — 25 entries, none carry a `locked:` key today]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `npx wrangler d1 migrations apply mercora-db` for production, no guard | `MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1 npm run db:migrate:apply:production` | Already shipped in code (`scripts/lib/d1-migrate-plan.mjs`); docs never caught up | Runbooks currently describe a command that would work but bypasses the intended `canApply()` guard entirely — an operator following the doc literally never sets the env var or `--confirm-production` flag |
| `checkout.session.completed` webhook subscribed, handler is a no-op | Not subscribed; `place_order`'s shared finalizer is the actual order-completion path | Handler has been a no-op since before this milestone | Docs list an event Stripe will still deliver if configured, wasting a webhook slot and confusing operators about which event does the real work |

**Deprecated/outdated:**
- `handleCheckoutCompleted` in `app/api/webhooks/stripe/route.ts:362-380`: dead code, comments-only body, functionally identical to the `default` branch. Superseded by the `place_order` → `finalizeOrderPayment` path.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | The gsd-doc-classifier's semantic read of `**Status:** Accepted (date)` will register as "status reads Accepted" despite the markdown asterisks breaking a literal substring match | Pitfall 1, Anti-Patterns | If wrong, a future `/gsd-ingest-docs` run still produces the I17 note even after this phase's edits; the human-verification ingest re-run (already scoped by CONTEXT.md) is the actual test — this is LOW risk because it's an LLM semantic read, not a regex, but it is not directly re-tested in this session (would require invoking the classifier, out of scope for research) |

**If this table is empty:** N/A — one assumption above; everything else in this research (file contents, line numbers, import graphs, script logic, git dates, test file existence) was read directly this session.

## Open Questions

1. **Will the "Binding: changes require a new decision" sentence (Claude's Discretion in CONTEXT.md) be added?**
   - What we know: CONTEXT.md leaves this to Claude's discretion during planning/execution.
   - What's unclear: Whether the planner should schedule it as a task or leave it out.
   - Recommendation: Non-blocking; the planner can decide per-ADR-doc during plan authoring. No research dependency.

2. **Does a fresh `/gsd-ingest-docs --manifest gsd-ingest-manifest.yaml` run on a throwaway branch actually suppress I17 and W1 after this phase's edits?**
   - What we know: The mechanism is understood (classifier reads doc content; W1's contradiction is resolved by ADR-01's edit; I17's gap is closed once all four docs have a status line the classifier accepts).
   - What's unclear: The classifier is an LLM subagent — its exact judgment on the specific edited text cannot be verified without invoking it, which CONTEXT.md explicitly defers to Russell as a human-verification item.
   - Recommendation: The plan's in-phase verification is the structural check (Pitfall 1's tolerant grep); the full ingest re-run stays a post-phase human-verification checklist item, exactly as CONTEXT.md specifies.

## Environment Availability

Skip — no external dependencies. This phase edits markdown files, a YAML manifest, and removes ~19 lines of dead TypeScript in an existing route file. `vitest`, `npm`, `git`, and `grep` are already confirmed present and in use by prior phases (Phase 1/2 completed using the same toolchain).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | `vitest.config.mts` (unit tests, `tests/unit/**/*.test.ts`) |
| Quick run command | `npx vitest run tests/unit/app/api/stripe-webhook-*.test.ts` |
| Full suite command | `npm test` (equivalent to `vitest run` against `vitest.config.mts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| RUN-02 (code) | `checkout.session.completed` removal doesn't break webhook dispatch; other event handling unchanged | unit | `npx vitest run tests/unit/app/api/stripe-webhook-signature.test.ts tests/unit/app/api/stripe-webhook-payment-failed.test.ts tests/unit/app/api/stripe-webhook-subscription-route.test.ts tests/unit/app/api/stripe-webhook-refunds.test.ts tests/unit/app/api/stripe-webhook-retry.test.ts` | ✅ (all 5 exist, verified this session) |
| ADR-01, ADR-02, RUN-01, RUN-02 (docs) | Structural/manual — no test framework covers prose content | grep / manual read | See Pitfall 1's tolerant grep for Status markers; `grep -c "wrangler d1 migrations apply mercora-db$"` (no guard suffix) should return 0 in both runbooks after RUN-01 | N/A — structural checks, not vitest |

### Sampling Rate
- **Per task commit:** the tolerant grep checks above for docs-only tasks; `npx vitest run tests/unit/app/api/stripe-webhook-*.test.ts` for the code-removal task
- **Per wave merge:** `npm run lint && npm run typecheck` (route.ts edit touches TypeScript; docs-only tasks can skip these but running them is cheap and safe)
- **Phase gate:** `npm test` full suite green before `/gsd-verify-work`; the human-verification ingest re-run (throwaway branch) is a separate, non-blocking post-phase item per CONTEXT.md

### Wave 0 Gaps
None — existing test infrastructure (`tests/unit/app/api/stripe-webhook-*.test.ts`, 5 files) already covers the webhook route's dispatch behavior. No new test files are required for this phase; the docs-only tasks have no corresponding automated test type by design (prose correctness is verified structurally, not via vitest).

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → treated as enabled. This phase touches no authentication, authorization, cryptography, or input-validation surface — it edits documentation and deletes an already-inert code branch. No ASVS category applies beyond the general documentation-accuracy principle already governed by Phase 1's SEC-04 rule ("docs must describe exactly what code enforces").

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Not touched this phase |
| V3 Session Management | No | Not touched this phase |
| V4 Access Control | No | Not touched this phase |
| V5 Input Validation | No | `handleCheckoutCompleted` removal deletes an unreachable-effect branch; no new input path created |
| V6 Cryptography | No | Not touched this phase |

### Known Threat Patterns for {stack}

None applicable — no new attack surface. The one behavioral change (removing the `checkout.session.completed` case) is a net reduction in webhook surface area, not an addition.

## Project Constraints (from CLAUDE.md)

No project-level `./CLAUDE.md` or `./.claude/CLAUDE.md` exists in this repo (checked this session — neither file present). No project-specific skills directory (`.claude/skills/`, `.agents/skills/`) exists either. No additional constraints beyond the user's global CLAUDE.md conventions already reflected in this document's structure (plain commit messages via `-F <file>` for multi-line commits, no unrequested destructive git operations).

## Sources

### Primary (HIGH confidence — direct file reads this session)
- `~/.claude/agents/gsd-doc-classifier.md` — full read; confirmed locked-determination logic and manifest field usage
- `~/.claude/agents/gsd-doc-synthesizer.md` — full read; confirmed BLOCKER/WARNING/INFO taxonomy and manifest field usage
- `~/.claude/gsd-core/references/doc-conflict-engine.md` — full read; confirmed no numbered-code scheme exists
- `~/.claude/gsd-core/workflows/ingest-docs.md` — full read; confirmed manifest YAML schema (`path`/`type`/`precedence` only)
- `lib/mcp/checkout.ts`, `lib/mcp/tools/order.ts`, `lib/services/checkout-pricing.ts`, `lib/services/order-finalization.ts` — import graph and export list confirmed via grep + read
- `app/api/webhooks/stripe/route.ts` — full dispatch switch and `handleCheckoutCompleted` read
- `app/api/webhooks/stripe/handlers/subscription-handlers.ts` — subscription event list confirmed
- `scripts/d1-migrate.mjs`, `scripts/lib/d1-migrate-plan.mjs` — full read; guard logic confirmed
- `package.json`, `.nvmrc` — scripts and Node pin confirmed
- `docs/checkout-trust-boundary.md`, `docs/webhooks-refunds-inventory.md`, `docs/database-migrations.md`, `docs/subscriptions.md`, `docs/CLAUDE.md`, `docs/DEPLOYMENT_SETUP.md`, `docs/STRIPE_INTEGRATION.md` — targeted reads of all cited line ranges
- `.planning/INGEST-CONFLICTS.md`, `.planning/intel/SYNTHESIS.md`, `.planning/intel/decisions.md`, `.planning/intel/classifications/checkout-trust-boundary-nohash00.json` — full/targeted reads confirming W1/I17 exact text and the classifier's own prior note
- `git log --follow` — first-commit dates for the four ADR docs
- `git status --porcelain` — manifest untracked confirmation

### Secondary (MEDIUM confidence)
None — no web/docs-provider lookups were needed for this phase; it is entirely repo-internal verification.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new dependencies
- Architecture: HIGH — every claimed import/call site read directly this session
- Pitfalls: HIGH — Pitfall 1 (literal-string mismatch) and Pitfall 2 (manifest field not read) are both derived from direct tool-source reads, not inference

**Research date:** 2026-09-02
**Valid until:** Until the GSD ingest-docs tooling (`gsd-doc-classifier.md`, `ingest-docs.md`) changes its manifest schema or lock-determination logic, or until the target doc/route files are edited by this phase's own execution (at which point line numbers shift and this research should be treated as historical, not re-verified against post-phase state)
