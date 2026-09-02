# Phase 3: Decision Lock-In and Operator Runbooks - Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 9 (7 docs + 1 manifest + 1 route)
**Analogs found:** 9 / 9 (all in-repo, self-referential — this phase edits existing files, it creates none)

This phase creates no new files. Every "pattern" below is "how does this exact file
already say the adjacent thing," so the edits stay consistent with the file's own
voice. Analogs are therefore sibling sections within the same file (or the same
doc family) rather than a different file's role/data-flow match.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `docs/checkout-trust-boundary.md` | doc (ADR) | transform (prose correction) | same file's "Scope and schema" section + `docs/webhooks-refunds-inventory.md` status-marker precedent | exact |
| `docs/webhooks-refunds-inventory.md` | doc (ADR) | transform (status marker only) | `docs/checkout-trust-boundary.md` H1 structure | exact |
| `docs/database-migrations.md` | doc (ADR) | transform (status marker only) | `docs/checkout-trust-boundary.md` H1 structure | exact |
| `docs/subscriptions.md` | doc (ADR) | transform (status marker only) | `docs/checkout-trust-boundary.md` H1 structure | exact |
| `gsd-ingest-manifest.yaml` | config | transform (annotate 4 entries) | its own existing `- path: / type: ADR` entry shape (lines 16-23) | exact |
| `docs/CLAUDE.md` | doc (runbook) | transform (command-block replacement) | `docs/DEPLOYMENT_SETUP.md` guarded-command wording + `docs/database-migrations.md` policy text | exact |
| `docs/DEPLOYMENT_SETUP.md` | doc (runbook) | transform (command-block + event-list replacement) | `docs/database-migrations.md` (guarded commands), `docs/webhooks-refunds-inventory.md` (event list) | exact |
| `docs/STRIPE_INTEGRATION.md` | doc (runbook) | transform (event-list replacement) | `docs/webhooks-refunds-inventory.md` "Required Stripe configuration" wording | exact |
| `app/api/webhooks/stripe/route.ts` | route (webhook handler) | event-driven | same file's own `switch (event.type)` shape; `tests/unit/app/api/stripe-webhook-signature.test.ts` for the verify command | exact |

## Pattern Assignments

### `docs/checkout-trust-boundary.md` (ADR doc)

**Analog:** itself, current lines 1-5 and 99-103 — read this session by research.

**Current H1 top** (lines 1-3, no status line yet):
```markdown
# Order and checkout trust boundary

<blank>
<first paragraph>
```

**Status marker to insert** as new line 3 (push existing content down), matching the
locked format decided in CONTEXT.md — copy this exact shape into all four ADR docs,
substituting only the date:
```markdown
# Order and checkout trust boundary

**Status:** Accepted (2026-08-05)

<existing first paragraph>
```

**Text this replaces** (verified current lines 99-103, quoted in RESEARCH.md Code
Examples):
```markdown
## Scope and schema

This boundary does not expose trusted MCP payment operations or start
fulfillment. MCP checkout remains outside the paid inventory boundary until it
performs the same PaymentIntent verification.
```

**Replacement shape** (per CONTEXT.md ADR-01 decision — positive statement first,
then boundary conclusion, then one-sentence supersession note; names must be
grep-verified against `lib/mcp/checkout.ts` and `lib/mcp/tools/order.ts` before
writing):
```markdown
## Scope and schema

MCP `create_payment_intent` and `place_order` use the same shared checkout
pricing service (`lib/services/checkout-pricing.ts`) and the same idempotent
finalizer (`lib/services/order-finalization.ts`) as the storefront
`POST /api/orders` route and the Stripe webhook path. MCP checkout is inside
the paid inventory boundary.

An earlier version of this document stated MCP checkout was outside the
boundary; that was corrected on 2026-09-02 after verifying the code.
```

Do not touch the "U09 adds migrations..." / "U13 must replace..." sentences
elsewhere in this doc — out of scope per CONTEXT.md.

---

### `docs/webhooks-refunds-inventory.md`, `docs/database-migrations.md`, `docs/subscriptions.md` (ADR docs, status-marker-only)

**Analog:** `docs/checkout-trust-boundary.md`'s new status-marker line (same phase,
same file family) — apply verbatim, changing only the date:

| File | Date to insert |
|---|---|
| `docs/webhooks-refunds-inventory.md` | `**Status:** Accepted (2026-08-06)` |
| `docs/database-migrations.md` | `**Status:** Accepted (2026-08-03)` |
| `docs/subscriptions.md` | `**Status:** Accepted (2026-08-14)` |

No other content in these three docs changes.

---

### `gsd-ingest-manifest.yaml` (config, ADR lock annotation)

**Analog:** its own existing entry block, lines 16-23 (read this session):
```yaml
docs:
  # --- ADR: binding decisions ---
  - path: docs/checkout-trust-boundary.md
    type: ADR          # checkout is one server-owned state transition
  - path: docs/webhooks-refunds-inventory.md
    type: ADR          # D1 ledgers + cron are the recovery mechanism, not HTTP
  - path: docs/database-migrations.md
    type: ADR          # migrations are an explicit operator action, never on deploy
  - path: docs/subscriptions.md
    type: ADR          # acquisition off by default; never down-migrate state
```

**Pattern to copy:** the file already uses an inline `#` trailing comment on the
`type:` line to carry rationale — reuse that same comment style for the lock
annotation, adding a `locked: true` key per entry plus a one-line comment with
the lock date (per CONTEXT.md: "minimal... one-line comment giving the lock
date"). Example shape (exact wording is Claude's discretion):
```yaml
  - path: docs/checkout-trust-boundary.md
    type: ADR          # checkout is one server-owned state transition
    locked: true        # locked 2026-09-02 — status marker added Phase 3
```
Apply identically to all four ADR entries. Do not touch SPEC/PRD/DOC entries
below line 23. This file is currently **untracked** (`git status --porcelain`
confirmed by research) — flag for the executor whether to `git add` it.

**Important (research finding, not a pattern but load-bearing):** this `locked:`
field is not read by any GSD tool. It is a human-readable record only. The
actual lock gate is the ADR doc's own `Status: Accepted` line. Do not write
acceptance criteria implying the manifest edit changes ingest behavior.

---

### `docs/CLAUDE.md` (runbook, command-block replacement)

**Analog:** `docs/database-migrations.md`'s already-correct guarded-command
policy language (per CONTEXT.md, this doc is "the binding source" the runbooks
should point at) and `scripts/lib/d1-migrate-plan.mjs:130-144`'s exact guard
names.

**Deploy line replacement** (current, lines 60-63, verified this session by
research):
```markdown
# Deployment
npm run deploy                 # Clean, build, and deploy to Cloudflare
npm run clean                  # Remove build artifacts
npm run preview               # Build and preview locally
```
Add a three-line "Deploy paths" note next to the `npm run deploy` line (content
locked by CONTEXT.md): `npm run deploy` never applies remote migrations;
`npm run deploy:ci` (used by Cloudflare Workers Builds) applies production
migrations before upload.

**Migration Commands block replacement** (current, lines 219-223):
```markdown
**Migration Commands:**
```bash
npx wrangler d1 migrations apply mercora-db --local  # Local
npx wrangler d1 migrations apply mercora-db          # Production
```
```
Replace the production line only with the guarded npm scripts (local line
stays as-is per CONTEXT.md):
```markdown
**Migration Commands:**
```bash
npx wrangler d1 migrations apply mercora-db --local  # Local (dev)

npm run db:migrate:status:preview
npm run db:migrate:apply:preview
npm run db:migrate:status:production
MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1 npm run db:migrate:apply:production
```

See `docs/database-migrations.md` for the binding migration policy.
```

**Database Changes step replacement** (current, lines 456-459):
```markdown
### Database Changes
1. Modify schema in `lib/db/schema/`
2. Generate migration with Drizzle
3. Apply with `wrangler d1 migrations apply`
```
Replace step 3 to point at the guarded scripts, ending with the same
`docs/database-migrations.md` pointer used above.

**Do not add a Node-version line to this file** — confirmed by research
(`grep -n -i "node\.js\|node 1[0-9]\|node 2[0-9]\|nvmrc"` returns zero matches
in `docs/CLAUDE.md`). RUN-01's Node edit is `docs/DEPLOYMENT_SETUP.md:29` only.

---

### `docs/DEPLOYMENT_SETUP.md` (runbook, command-block + event-list + Node line)

**Analog:** same file's own Step 1/Step 4 structure, plus
`docs/webhooks-refunds-inventory.md`'s "Required Stripe configuration" wording
for the event-list group headings.

**Node requirement replacement** (current line 29, verified this session):
```markdown
- **Node.js 18+** and npm/yarn/pnpm
```
Replace with:
```markdown
- **Node.js 24.18.1** (pinned in `.nvmrc` and `engines` in `package.json`) and npm/yarn/pnpm
```

**Step 1: Run Migrations replacement** (current lines 245-252):
```markdown
### **Step 1: Run Migrations**
```bash
# Apply migrations to local database (for development)
npx wrangler d1 migrations apply mercora-db --local

# Apply migrations to production database
npx wrangler d1 migrations apply mercora-db
```
```
Replace the "production database" block with the four guarded npm scripts
(same list as `docs/CLAUDE.md` above), ending with a pointer to
`docs/database-migrations.md`.

**Step 2 Deploy paths note** — insert the same three-line note used in
`docs/CLAUDE.md`, placed at the first `npm run deploy` occurrence (line 282,
verified this session). The two later `npm run deploy` mentions (lines ~330,
~404) stay unchanged — CONTEXT.md explicitly scopes them out.

**Step 4 event list replacement** (current lines 205-211, verified this
session):
```markdown
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
   - `charge.refunded`
   - `refund.updated`
   - `refund.failed`
```
Replace with the two labeled groups from CONTEXT.md's locked final list
(Required / Subscriptions), copying the group-heading style from
`docs/webhooks-refunds-inventory.md`'s existing "Required Stripe configuration"
section (lines 15-23, quoted below) and adding a one-line pointer back to that
doc as the binding source:
```markdown
<!-- docs/webhooks-refunds-inventory.md:15-23, the binding wording to echo -->
Subscribe it to these events:

- `payment_intent.succeeded`
- `charge.refunded`
- `refund.updated`
- `refund.failed`

`charge.refund.updated` is also supported for compatibility with older Stripe
event configurations. `refund.updated` is the preferred lifecycle event.
```

---

### `docs/STRIPE_INTEGRATION.md` (runbook, event-list replacement only)

**Analog:** `docs/DEPLOYMENT_SETUP.md`'s Step 4 list (identical target text,
per CONTEXT.md: "identical in both docs") and `docs/webhooks-refunds-inventory.md`'s
group wording as above.

**Current list to replace** (lines 62-68, verified this session):
```markdown
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
   - `charge.refunded`
   - `refund.updated`
   - `refund.failed`
```
Same two-group replacement as `docs/DEPLOYMENT_SETUP.md` Step 4, byte-for-byte
identical event lists and headings between the two docs. Leave the
`docs/API_STRUCTURE.md` reference at line 99 untouched (Phase 4, REF-02).

---

### `app/api/webhooks/stripe/route.ts` (route, event-driven — dead code removal)

**Analog:** the file's own dispatch `switch (event.type)` shape (lines
213-255) — remove one `case` while every sibling case keeps its existing
shape; `tests/unit/app/api/stripe-webhook-signature.test.ts` (imports `POST`
from this route and mocks `@/lib/stripe`, `@/lib/services/order-finalization`,
`@/lib/webhooks/processed-events`) is the test pattern to run, unmodified.

**Case + function to delete** (verified this session, exact text):
```typescript
// case to remove from the switch, lines 224-227:
  case 'checkout.session.completed':
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    outcome = 'ignored';
    break;

// function to remove, lines 358-380:
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

**Do NOT touch** the adjacent `payment_intent.payment_failed` case (lines
219-222) — it now does real telemetry work (OBS-05, Phase 2) and stays in
scope per CONTEXT.md/RUN-02. Every other case in the switch (subscriptions,
`charge.refunded`, `refund.updated`/`refund.failed`/`charge.refund.updated`,
`default`) is untouched.

**Verify command** (from RESEARCH.md Validation Architecture, copy verbatim):
```bash
npx vitest run tests/unit/app/api/stripe-webhook-signature.test.ts tests/unit/app/api/stripe-webhook-payment-failed.test.ts tests/unit/app/api/stripe-webhook-subscription-route.test.ts tests/unit/app/api/stripe-webhook-refunds.test.ts tests/unit/app/api/stripe-webhook-retry.test.ts
```
Note: `tests/unit/app/api/` also contains `stripe-webhook-subscriptions.test.ts`
(plural, distinct from `-subscription-route.test.ts`) — both exist; running
the full glob `stripe-webhook-*.test.ts` is safer than hand-listing files if
the plan wants maximum coverage.

## Shared Patterns

### ADR status marker (applies to all 4 ADR docs)
**Source:** decision text in CONTEXT.md, no prior in-repo precedent (first use
of this marker convention in this repo).
```markdown
**Status:** Accepted (YYYY-MM-DD)
```
Placed as the first content line after the H1 and one blank line, before the
doc's existing first paragraph. No frontmatter, no footer. Verification grep
must tolerate the `**` markdown (see Pitfall 1 in RESEARCH.md):
```bash
grep -E '^\*\*Status:\*\*\s*Accepted' docs/checkout-trust-boundary.md docs/webhooks-refunds-inventory.md docs/database-migrations.md docs/subscriptions.md
```
Expect exactly 4 matches, one per file.

### Guarded migration commands (applies to `docs/CLAUDE.md` and `docs/DEPLOYMENT_SETUP.md`)
**Source:** `package.json` scripts + `scripts/lib/d1-migrate-plan.mjs:130-144`
(exact env var / flag names, verified this session):
```javascript
export function canApply({ target, flags, environment }) {
  if (target === "local") return { allowed: true };
  if (target === "preview") {
    return flags.includes("--confirm-preview")
      ? { allowed: true }
      : { allowed: false, reason: "Preview apply requires --confirm-preview." };
  }
  return flags.includes("--confirm-production") && environment.MERCORA_ALLOW_PRODUCTION_MIGRATIONS === "1"
    ? { allowed: true }
    : { allowed: false, reason: "Production apply requires --confirm-production and MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1. It is never run by deploy." };
}
```
Both runbooks must show only: `npm run db:migrate:status:preview`,
`npm run db:migrate:apply:preview`, `npm run db:migrate:status:production`,
`MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1 npm run db:migrate:apply:production`,
each block ending with a pointer to `docs/database-migrations.md`.
Post-edit check: `grep -c "wrangler d1 migrations apply mercora-db$" docs/CLAUDE.md docs/DEPLOYMENT_SETUP.md` (no trailing `--local`) must return 0 in both.

### Stripe webhook event list (applies to `docs/DEPLOYMENT_SETUP.md` and `docs/STRIPE_INTEGRATION.md`)
**Source:** `docs/webhooks-refunds-inventory.md:15-23` (binding wording style)
plus the route's dispatch switch (source of truth for which events have
handlers) and `app/api/webhooks/stripe/handlers/subscription-handlers.ts:35-41`
(confirms all 11 subscription events are handled).
Final identical list for both docs, two labeled groups:
- **Required:** `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `refund.updated`, `refund.failed` (+ compatibility note for `charge.refund.updated`)
- **Subscriptions (required once acquisition is enabled):** `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.payment_attempt_required`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.pending_update_applied`, `customer.subscription.pending_update_expired`
`checkout.session.completed` removed from both.

## No Analog Found

None — every file in scope is an edit to an existing tracked file, and every
edit has a same-file or same-doc-family precedent to copy wording/structure
from.

## Metadata

**Analog search scope:** `docs/`, `gsd-ingest-manifest.yaml`, `app/api/webhooks/stripe/route.ts`, `tests/unit/app/api/`, `scripts/lib/d1-migrate-plan.mjs`, `lib/mcp/`, `lib/services/`
**Files scanned:** 9 target files + 4 supporting source/test files (all read directly this session or carried verbatim from RESEARCH.md's direct reads)
**Pattern extraction date:** 2026-09-02
**Tracked-source gate:** all 8 doc/route paths confirmed via `git ls-files` (tracked). `gsd-ingest-manifest.yaml` is confirmed untracked via `git status --porcelain` — this is expected per CONTEXT.md/RESEARCH.md (repo-root config file, not a doc analog target), not a mirror-path violation; no `.gsd/capabilities/` mirror paths were used anywhere in this map.
