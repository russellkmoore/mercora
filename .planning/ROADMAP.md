# Roadmap: Mercora

## Overview

Mercora's commerce core is shipped and live as Voltique. This first GSD milestone is a hardening pass: it removes an exposed credential and makes the admin bypass impossible to open by accident, gives the silent failure modes found in the codebase map telemetry and tests, marks the four ADRs as binding and corrects the operator runbooks that contradict them, and brings the 2025-era reference docs in line with the code. When it ends, `docs/` and the code agree, and feature work from the backlog can resume on a trustworthy base.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Security and Admin-Auth Truth** - Scrub published secrets, rotate the admin token, assert `NODE_ENV` at startup, and make every doc describe admin auth as it actually works (completed 2026-09-02)
- [x] **Phase 2: Observability and Regression Guards** - Give tax fallback and web vitals a real signal, type the slug routes with 404 tests, widen allocation tests, resolve the webhook TODO, and record a Lighthouse baseline (completed 2026-09-02)
- [x] **Phase 3: Decision Lock-In and Operator Runbooks** - Supersede ADR-CTB-15, mark all four ADRs Accepted and locked, and correct the migration, deploy, Node, and webhook runbooks (completed 2026-09-02)
- [ ] **Phase 4: Reference Documentation Refresh** - Right model and tool count everywhere, real test/CI description, complete README index, historical banners, and a refreshed dependency baseline with a higher audit gate

## Phase Details

### Phase 1: Security and Admin-Auth Truth

**Goal**: No credential value lives in the docs, the published admin token is dead, a misbuilt deploy cannot open the admin bypasses, and every doc describes admin authentication as the code enforces it.
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):

  1. A repository-wide search for the previously published admin token and dev-bypass values returns nothing; `docs/CLAUDE.md` and `docs/admin-authentication.md` show placeholders where the values were.
  2. Presenting the previously published token to `/api/admin/vectorize` and `/api/admin/knowledge` on the live site is rejected with 401/403 (or the finding records that the value was never live).
  3. A test shows the Worker fails at startup, or every admin request fails closed, when `NODE_ENV` is `development`, and a production build is unaffected; all CI gates still pass.
  4. `docs/CLAUDE.md`, `docs/DEPLOYMENT_SETUP.md`, and `docs/admin-authentication.md` agree that production admin auth is enforced through Clerk role, an active `adminUsers` table row, or the bearer token, that the only bypass is the `x-dev-admin` header under `NODE_ENV=development`, and no query-string bypass is described anywhere.

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Deployment guard tracer: taxonomy event, `lib/auth/deployment-guard.ts`, wired into `checkAdminPermissions` with tests (SEC-03)
- [x] 01-03-PLAN.md — Credential scrub and doc truth across the three admin-auth documents (SEC-01, SEC-04)
- [x] 01-04-PLAN.md — Rotate `ADMIN_VECTORIZE_TOKEN` and prove the published value is dead on the live site (SEC-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Guard completion: `authenticateRequest`, `middleware.ts` 503 at the edge, and the operator documentation (SEC-03, SEC-04)

### Phase 2: Observability and Regression Guards

**Goal**: The silent failure modes the codebase map found become visible to an operator, and the regressions it found have tests that would catch them if they came back.
**Depends on**: Nothing technical (independent of Phase 1; ordered second by urgency)
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, MOB-01
**Success Criteria** (what must be TRUE):

  1. When Stripe Tax fails and the flat fallback rate is applied, an operator can see a `commerce.telemetry.v1` event for it whose payload contains no address or order identifier, and `npm test` includes a test proving it fires only on fallback.
  2. An operator can query mobile LCP, INP, and CLS by route template from real production traffic; the vitals route no longer returns `ok` while discarding the payload.
  3. Visiting `/category/<unknown>` and `/product/<unknown>` returns HTTP 404; both routes await `Promise`-typed `params`; tests cover the unknown-slug path; allocation tests fail if discount or tax allocation ever stops summing to the total across 1, 2, 10, and 100 lines.
  4. No `TODO` remains in `app/api/webhooks/stripe/route.ts`; `payment_intent.payment_failed` is either handled with a recorded outcome or no longer subscribed, and the choice is written down for the runbook update in Phase 3.
  5. A Lighthouse mobile baseline for the home, category, product, and checkout routes is recorded in `docs/` with scores compared against the PRD target of 85.

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Tracer: register the phase taxonomy in both parity files, emit `checkout.tax_fallback` at the flat-rate fallback site, export the two allocation functions (OBS-01, OBS-04)
- [x] 02-05-PLAN.md — Lighthouse mobile baseline for four live routes, median of three, recorded in `docs/mobile-lighthouse-baseline.md` (MOB-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Web-vitals sink: `WEB_VITALS` Analytics Engine binding, bounded route-template mapper, rewritten vitals route that writes five fields and always answers 200 (OBS-02)
- [x] 02-03-PLAN.md — Failed-payment telemetry: closed decline-reason mapper, telemetry-only `handlePaymentFailed`, RUN-02 hand-off note (OBS-05)
- [x] 02-04-PLAN.md — Slug pages typed with `Promise` params and real 404s, plus allocation sum-exactness tables at 1/2/10/100 lines (OBS-03, OBS-04)

### Phase 3: Decision Lock-In and Operator Runbooks

**Goal**: The binding decisions state what the code does and are marked binding, and the runbooks an operator follows for migrations, deploys, and Stripe webhooks are correct.
**Depends on**: Phase 2 (RUN-02 needs OBS-05's decision on `payment_intent.payment_failed`)
**Requirements**: ADR-01, ADR-02, RUN-01, RUN-02
**Success Criteria** (what must be TRUE):

  1. `docs/checkout-trust-boundary.md` states that MCP `create_payment_intent` and `place_order` share the storefront's pricing service and idempotent finalizer and are inside the paid inventory boundary; the "remains outside" sentence is gone.
  2. All four ADR docs show `Status: Accepted` with a date, `gsd-ingest-manifest.yaml` marks them `locked: true`, and re-running `/gsd-ingest-docs` produces no I17 lock-status note and no W1 warning.
  3. An operator following `docs/CLAUDE.md` or `docs/DEPLOYMENT_SETUP.md` finds only the guarded `db:migrate:*` commands, the `deploy` versus `deploy:ci` distinction, and Node 24; no unguarded production `wrangler d1 migrations apply` remains in either doc.
  4. The Stripe webhook event lists in `docs/DEPLOYMENT_SETUP.md` and `docs/STRIPE_INTEGRATION.md` match the events the route handles and ADR-WRI-02's required set; `checkout.session.completed` is gone.

**Plans**: 3/3 plans executed

Plans:
**Wave 1** *(all three run in parallel — no shared files)*

- [x] 03-01-PLAN.md — ADR truth and lock-in: trust-boundary correction, four dated status markers, manifest lock flags (ADR-01, ADR-02)
- [x] 03-02-PLAN.md — Operator runbooks: guarded migration commands, deploy vs deploy:ci, Node 24, and the synced Stripe event lists (RUN-01, RUN-02)
- [x] 03-03-PLAN.md — Dead webhook branch removed from the Stripe route, plus a regression test pinning the unhandled-event contract (RUN-02)

### Phase 4: Reference Documentation Refresh

**Goal**: A contributor, human or AI, reading `docs/` gets the current system: the right model, the right tool count, the real test and CI setup, a complete index, clear labels on historical material, and a dependency baseline that is not overdue.
**Depends on**: Phase 3 (README index and `CLAUDE.md` reference the ADR status and corrected runbooks)
**Requirements**: REF-01, REF-02, REF-03, REF-04, DEP-01
**Success Criteria** (what must be TRUE):

  1. `grep -r "Llama 3.1" docs/` returns nothing; every model mention names `@cf/openai/gpt-oss-20b`; the MCP tool count reads 19 in `docs/CLAUDE.md` and `docs/ROADMAP.md`.
  2. `docs/CLAUDE.md` describes the vitest suites and CI gates and points to `package.json` for versions; no doc references `docs/API_STRUCTURE.md`; `docs/api-architecture.md` has no "mock implementation" note.
  3. `docs/README.md` links all 26 docs, says the MCP server is live at `/api/mcp`, and shows a 2026 Last Updated date.
  4. `docs/admin-dashboard-specification.md`, the ER diagram in `docs/architecture.md`, `docs/mobile-ux-assessment.md`, and `docs/mobile-testing-automation.md` carry historical or proposal banners, and the checklist in `docs/mobile-improvements-actionable.md` shows the code items complete.
  5. CI's `npm audit` gate runs at `--audit-level=high` (or `docs/dependency-security.md` records a bounded exception with owner and exit condition), and the document's next-review date is in the future.

**Plans**: 4/5 plans executed

Plans:
**Wave 1** *(all five run in one wave — `files_modified` are disjoint across 14 files)*

- [x] 04-01-PLAN.md — Model name and tool count in the three docs no other plan touches: `DEPLOYMENT_SETUP.md`, `ai-pipeline.md` (mermaid node id rename), `ROADMAP.md` (REF-01)
- [x] 04-02-PLAN.md — `CLAUDE.md` test/CI section, unpinned dependencies, tool count and the two missing tool names, plus the `api-architecture.md` payment note and both stale doc references (REF-01, REF-02)
- [x] 04-03-PLAN.md — `README.md` index: four new groups linking all 15 unlinked docs, current status lines, 2026 date (REF-01, REF-03)
- [x] 04-04-PLAN.md — Four `Status: Historical` banners, the `architecture.md` ER-diagram label and model names, and 12 ticked checklist items with evidence (REF-01, REF-04)
- [ ] 04-05-PLAN.md — CI audit gate raised to `high` (proven locally first) and the refreshed dependency baseline with both exceptions closed (DEP-01)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security and Admin-Auth Truth | 4/4 | Complete    | 2026-09-02 |
| 2. Observability and Regression Guards | 5/5 | Complete    | 2026-09-02 |
| 3. Decision Lock-In and Operator Runbooks | 3/3 | Complete    | 2026-09-02 |
| 4. Reference Documentation Refresh | 4/5 | In Progress|  |

---
*Roadmap created: 2026-09-01 from doc ingest (26 docs) and codebase map (2026-08-31)*
