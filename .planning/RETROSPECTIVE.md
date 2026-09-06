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

## Milestone: v2 — Themeable Storefront

**Shipped:** 2026-09-05
**Phases:** 7 (5, 6, 6.1, 7, 8, 8.1, 8.2) | **Plans:** 44 | **Tasks:** 125 | **Commits:** 305 over 3 days (2026-09-03 to 2026-09-05)

### What Was Built

- Frozen 23-token contract wired through Tailwind and a server-rendered `data-theme`; the whole storefront swept to token classes with a fail-first scanner (`scan:tokens`, 1,165 → 0 violations) and a screenshot diff harness.
- Theme files in `themes/` validated and code-generated by `scripts/build-themes.mjs`; `getActiveTheme()` per request from D1; admin Appearance page with swatch cards; seven presets with their own display faces.
- Three enumerated layout switches (category, home hero, product gallery) as named server-chosen components, admin-settable, default variants proven verbatim.
- Emails and the crash page follow the admin theme, including cron-drained emails via `order_effects.payload` (migration 0023).
- Docs pruned 28 → 20 with a style contract, claim check, and `docs:lint`; product-neutral README; root `AGENTS.md` for coding assistants.

### What Worked

- **Gate-first, then sweep.** Building `scan:tokens` and proving it failed on the dirty tree before any sweep meant "zero violations" was a real claim. The same shape worked for `docs:lint` in 8.2.
- **Screenshot diffs caught what tests could not.** Four Phase 5 regressions, three invisible light-theme scrims, a `Select` highlight bug, and an RSC serialization bug all surfaced from real renders, not unit tests.
- **Tracer plan per phase.** Each phase opened with one end-to-end slice (one preset through the whole pipeline, one layout switch, one doc retirement) and the follow-on plans copied it. Phase 6.1 shipped four presets with zero mechanism changes because the tracer had proven the pipeline.
- **Autonomous run with batched decisions.** Russell answered grey areas and `human_needed` gates in one question each; the run stopped only where a product call was needed (all six presets, font change, address debt before completing).
- **Closing debt in an inserted phase before completing.** 8.1 closed 8 of 14 audit items in code; the audit then closed on an honest 12-item list rather than a vague one.

### What Was Inefficient

- **Shell aliases fought the executors.** `noclobber` plus interactive `cp`/`rm` caused three wrong-message commits, one amended commit, and one timed-out mutation test. Every executor prompt now carries the `mktemp` + `cat >|` + `/bin/cp -f` recipe; it should live in project config instead.
- **Fonts never reached elements until 6.1.** `--store-font-display` was wired in Phase 6 but no component applied it; the storefront had rendered `system-ui` since v1. A "token declared" check is not a "token rendered" check.
- **Direction-doc scope grew mid-run.** The theme direction doc named six presets and extra properties; three presets became 6.1, the properties became backlog. Discussing the doc before Phase 6 planning would have shaped 6 and 6.1 as one phase.
- **Summaries reference retired paths.** `phase.complete` warned about summaries naming files that later plans deleted; harmless, but noisy.
- **Docs-heavy plans ran long.** 08.2-06's whole-set claim check took about two hours of executor time; splitting the style pass and the claim check would have parallelised.

### Patterns Established

- Theme = one CSS file: `@theme label | industry | synopsis` header comment plus one `[data-theme]` block of 23 hex tokens; anything else fails the validator.
- Literal colours are allowed only under the scanner sentinel comment, and only for polarity-neutral scrims.
- Server pages resolve an enum from D1 and pass it to client displays, which do one typed map lookup to a named component; a repo-wide contract test forbids generic layout props.
- Request-scoped `React.cache` is the only allowed cache for appearance reads; no isolate cache.
- Doc retirement is one atomic commit: delete, inbound links, manifest, changelog line. Locked ADRs are trim-and-link only.
- `AGENTS.md` wraps the Next-generated block; `CLAUDE.md` is a pointer.

### Key Lessons

1. Prove a gate fails before trusting that it passes. Both scanners were built fail-first and both later caught real regressions.
2. A declared token is not a rendered token. Verify by screenshot or computed style, not by grep.
3. Read the user's side documents (the theme direction doc) before planning the phase they describe, not after.
4. Executor environment quirks belong in one shared note fed to every prompt, not rediscovered per phase.
5. Close the code-closable debt in an inserted phase, then audit; the accepted list is short and honest.

### Cost Observations

- Model mix: sonnet for executors, verifiers, reviewers, and the integration checker; the orchestrator on the session model. Not measured precisely.
- Sessions: roughly 6 across three days (one long autonomous run with three context compactions).
- Notable: Phase 5's 12-plan sweep averaged about 56 minutes per plan; Phase 8.2's six docs plans ranged from 15 minutes (AGENTS.md) to about two hours (claim check).

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1 | ~8 | 4 | First GSD milestone; map + ingest drove requirements; tracer-then-parallel plan shape |
| v2 | ~6 | 7 | Autonomous run with batched decisions; two inserted phases (6.1 scope, 8.1 debt) plus 8.2 docs; fail-first gates and screenshot diffs |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1 | 233 unit files + Workers + observability suites; +65 tests in the audit's E2E sample | not measured | 1 (`lib/auth/deployment-guard.ts`, no new packages) |
| v2 | 265 unit files (2,187 tests) + Workers (154) + observability suites | not measured | 2 zero-dep scripts (`build-themes.mjs`, `scan-hardcoded-colors.mjs`, `docs-lint.mjs`); Playwright added as a dev dependency for the screenshot harness |

### Top Lessons (Verified Across Milestones)

1. Verify safety and pin behavior with tests before changing checkout, webhook, or auth code. (v1)
2. Docs cite code; code is the source of truth. (v1, v2)
3. Build the gate first and watch it fail before the sweep it guards. (v2)
4. Verify visual claims by render, not by grep. (v2)
