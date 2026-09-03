# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1 — Hardening

**Shipped:** 2026-09-02
**Phases:** 4 | **Plans:** 17 | **Tasks:** 46 | **Commits:** 135 over 3 days (2026-08-31 to 2026-09-02)

### What Was Built

- Deployment-posture guard (`lib/auth/deployment-guard.ts`): a development build in the Workers runtime fails closed with 503 across `checkAdminPermissions`, `authenticateRequest`, and `middleware.ts`, with a critical-severity telemetry event.
- Published admin token scrubbed from `docs/` and rotated in production; the old value proven dead with two live 401s.
- Three new closed-taxonomy telemetry events (`auth.deployment_guard_tripped`, `checkout.tax_fallback`, `payment.intent_failed`) and a production web-vitals sink in Analytics Engine.
- Slug routes with `Promise` params and real 404s; allocation sum-exactness tests at 1/2/10/100 lines, which caught and fixed a real over-allocation bug in `allocateDiscount`.
- Dead `checkout.session.completed` webhook branch removed with a regression test pinning the fall-through contract.
- Four ADRs marked Accepted and locked; the ingest re-run confirmed it.
- Runbooks (migrations, deploy vs deploy:ci, Node 24, Stripe events) and reference docs (model id, 19 tools, test/CI description, README index, historical banners) brought in line with the code.
- CI dependency audit gate raised to `high` with a clean production tree; `commerce-observability-tail` wired as a tail consumer.

### What Worked

- **Map and ingest before requirements.** Every v1 requirement cited a file and line from the codebase map or a doc conflict from the ingest. Nothing was speculative, so no requirement was dropped or reshaped during execution.
- **Tracer plan first, then parallel waves.** Phases 1 and 2 opened with a single plan that established the pattern (guard module, taxonomy registration); the follow-on plans copied it. Phases 3 and 4 ran fully parallel because `files_modified` were disjoint.
- **Regression-first mindset paid off twice.** Adding breadth tests (OBS-04) found a real money bug; the code review on Phase 2 found three more (body cap, decline-code detection, dead catch). Verifying safety before touching checkout code, per Russell's profile, is the right default.
- **Audit-open with real acknowledgement.** The close audit's four deferred items were each resolved on their merits (one was a real hygiene gap, the tail consumer) rather than blanket-acknowledged.

### What Was Inefficient

- **Secret rotation blocked on deploy state.** `wrangler secret put` refused because the latest uploaded Worker version was not promoted. Pushing `main` first fixed it, but it cost a retry and a session.
- **The UI plan gate false-positived** on the filename `admin-dashboard-specification.md` in Phase 4; `--skip-ui` was needed for a docs-only phase.
- **Context exhaustion at the end of Phase 4** forced a session break before the close audit. Docs-heavy phases produce large SUMMARY files; the per-plan `one_liner` extraction only worked for 12 of 17 summaries.
- **Dates drifted between local and UTC** across STATE, PROJECT, and the audit (2026-09-02 vs 2026-09-03). Cosmetic but confusing when reconciling the archive.

### Patterns Established

- Status markers as a single `**Status:** Accepted (YYYY-MM-DD)` or `> **Status: Historical (Month YYYY).**` line directly under the H1; the ingest classifier keys on the literal text.
- Denial as a returned discriminated union, never a throw, in auth code (matches `checkAdminPermissions`).
- New telemetry events are registered in both parity files (producer taxonomy and tail worker) in the same commit, with a negative-case test proving the event does not fire on the happy path.
- Runbooks name only the guarded npm scripts for remote migrations; the raw `wrangler d1 migrations apply` form appears only with `--local`.
- Operator follow-ups that need a deploy or the Cloudflare dashboard are recorded in STATE.md Blockers with an `[Operator, next deploy]` tag rather than blocking phase verification.

### Key Lessons

1. Breadth tests on money math are cheap and find real bugs. Add sum-exactness tables whenever a new allocation or rounding path lands.
2. Docs that claim a mechanism must cite the file that implements it. Every v1 doc fix that stuck did so because it pointed at `lib/ai/config.ts`, `app/api/mcp/route.ts`, or the migrate script.
3. Push `main` before any `wrangler secret put`; Cloudflare refuses secret edits when the latest version is unpromoted.
4. Refresh the codebase map before the next code-heavy milestone. v1 changed auth, telemetry, and the webhook route; the 2026-08-31 map no longer describes them.
5. Keep `use_worktrees=false` for this repo until worktree bootstrapping (node_modules, `.dev.vars`) is solved.

### Cost Observations

- Model mix: not tracked in this milestone.
- Sessions: roughly 8 (one per phase for planning and execution, plus review, audit, and close sessions).
- Notable: the docs-only phases (3 and 4) ran fastest per plan (4–20 min); Phase 1's secret rotation and Phase 2's Analytics Engine wiring were the slowest because each touched a live Cloudflare resource.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1 | ~8 | 4 | First GSD milestone; map + ingest drove requirements; tracer-then-parallel plan shape |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1 | 233 unit files + Workers + observability suites; +65 tests in the audit's E2E sample | not measured | 1 (`lib/auth/deployment-guard.ts`, no new packages) |

### Top Lessons (Verified Across Milestones)

1. Verify safety and pin behavior with tests before changing checkout, webhook, or auth code. (v1)
2. Docs cite code; code is the source of truth. (v1)
