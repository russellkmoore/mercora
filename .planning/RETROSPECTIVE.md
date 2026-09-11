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

## Milestone: v2.1 — Gift Card Product

**Shipped:** 2026-09-10
**Phases:** 4 (9, 10, 11, 12) | **Plans:** 20 | **Tasks:** 30 | **Commits:** 177 over 3 days (2026-09-07 to 2026-09-10)

### What Was Built

- Catalogue product `prod_33` with four denominations, a Workers-AI image, nontaxable classification, seeded as a sentinel block and applied to production by hand.
- Recipient form with server-parity validators, cart identity by recipient + denomination, recipient details on four surfaces, digital-only checkout with a billing step.
- Production enablement: two key rings as Worker secrets via non-echoing pipelines, flags rolled out reconciliation-first behind a blocking-human gate.
- Content aligned to code (article, product copy, Terms §6), knowledge and product vectors upserted, Volt answering gift/present/voucher questions by name.
- One real production purchase proving issuance and delivery; then, from Russell's own checkout, gift-card tender on the payment step with Apply/Remove and hold release.

### What Worked

- **The live proof was the real test.** Every unit and integration suite was green, and the first production purchase still found four defects (fallback tax on a nontaxable line, no email provider chosen, the cron sender without the worker env, a placeholder sender domain). Nothing but a real order through the real cron would have surfaced them.
- **Unattended run with a decision log.** Russell left with "move forward with best assumption decisions"; every unattended change was recorded in STATE.md with alternatives, and he accepted the lot the next day after redeeming the card himself.
- **Read-only tracer before production writes.** Phase 12 opened by proving the remote-binding harness could read D1, R2, Vectorize and AI before any script wrote anything; every later write reused the same harness with count-before/count-after proofs.
- **Three review iterations on the fix commits.** Review found the article promising things the code did not do (scheduled delivery, the note) and the product copy still contradicting the article; the fix loop caught a dead regex and a paging alert on a successful delivery.
- **The owner testing in a browser within the hour.** Two rounds of "nowhere to enter it" and "should not say other tender" reshaped the tender UX the same night.

### What Was Inefficient

- **A field nobody had ever looked at.** The gift-card code entry shipped with the v1 backend, in a box under the order summary that vanished after step 1. Phase 10 assumed it, the article described it from the code, and the deferred browser walkthrough was the only thing that would have caught it — the owner did.
- **Silent failures in the cron.** Every cron tick logged "recovery queues drained" and no `cron.recovery_failed` while every delivery attempt was failing inside a bare `catch {}`. Eight attempts burned before anyone knew. Telemetry now carries a per-delivery failure event.
- **Reservation semantics fought the retry.** A reload minted a new request key, so the first hold blocked the same card for 15 minutes and the server collapsed it into a generic error. Fixed with previous-order release, but the plan's `--resume` rule never matched what a browser does.
- **Scope gate that could only fail.** 12-06's "no code under lib/" assertion was written for a phase that then had to fix production; it failed by design and was overridden with a stronger true statement. Write scope gates as "only these files", not "no files".
- **Shell hazards again.** `noclobber` swallowed one commit message file; `rtk`'s grep rewrite made a live-page check return 0 regardless. Both known from v2.

### Patterns Established

- Production writes from a laptop go through the remote-binding harness or `wrangler d1 execute --file` with read-back before, read-back after, and a restore statement recorded in the SUMMARY.
- Scripted purchases use only the publishable key plus `pm_card_visa`; the client secret is memory-only; proofs read named non-secret columns and never `code_*`.
- Anything reached from the scheduled handler receives the worker `env` explicitly; `getCloudflareContext()` is a request-path convenience only.
- Gift-card tender is applied on the payment step; every re-quote names the previous order so its hold and intent are released; the masked code (`GC-****-…-LMS7`) is the display form.
- Human-facing copy (article, product description, Terms, helper text) is pinned by source-contract tests that assert the claim and reject its inverse.

### Key Lessons

1. Ship one real transaction through production before calling a flow done; test suites cannot see a missing env var, an unpicked provider, or a placeholder domain.
2. A swallowed exception in a cron is worse than a crash: it looks healthy. Log or emit on every per-item failure.
3. Verify UI claims by walking them in a browser, not by reading the component that renders them.
4. Write scope assertions as allowlists so an unavoidable fix does not turn the gate into theatre.
5. Requirements can be wrong: SHOP-07's account clause and the acquisition flag's meaning were both product mistakes, caught only by the owner using the thing.

### Cost Observations

- Model mix: opus for planner, checker, executors touching production, reviewers and fixers; sonnet for the article executor and security audit; orchestrator on the session model. Not measured precisely.
- Sessions: roughly 4 across three days (one long unattended run with compactions, then an interactive night with the owner testing live).
- Notable: the 12-05 purchase plan took about two hours of wall clock because of the tax halt, the email fix chain and three deploys; the four content/tracer plans ran 7–10 minutes each.

---

## Milestone: v2.2 — Operations & Polish

**Shipped:** 2026-09-11
**Phases:** 7 (13–19) | **Plans:** 39 | **Commits:** 499 over 2 days (2026-09-10 to 2026-09-11)

### What Was Built

- Gift-card sell/honor flags that do what their names say, with a cron-measured honor guard so money already taken is never stranded by a flag flip, and one function (`resolveHonorEffective`) owning that decision everywhere it's asked.
- A full gift-card admin panel replacing a five-column read-only queue: search, a merged timeline, disable, once-only reissue, resend, re-queue, release-hold, admin-create, CSR notes, and a confirm-gated code reveal — migration `0024`.
- A shared `AddressForm` used by both the account page and a new in-place modal on subscription product pages; the modal pre-selects the new address and leaves plan/quantity/terms untouched.
- The blog reachable from the header and a configurable home-page articles block, neither hardcoded to template code.
- Saved payment methods via a real Stripe Customer and Customer Session, replacing the Stripe Link box that saved nothing to the store.
- Eight tech-debt items closed, one of them a real production bug (order-confirmation email silently skipped for every digital-only gift-card order, not just subscriptions).
- The deliberately-last human-checkpoint phase: Stripe Tax, a routed support email, and corrected production secrets, each confirmed live rather than assumed done.

### What Worked

- **Two-iteration code review on every phase, every time.** Each phase shipped with at least one real, code-level finding the first pass missed and the second pass caught: a subscription-renewal email regression from a too-literal research suggestion, a checkout panel rendering under both gift-card flags off, an admin page's server render leaking behind a client-only guard, a delivery-alert field silently dropped by a second, independent sanitizer in the tail worker. None of these were style nits — each was a real behavioral gap, found because the reviewer re-derived the claim from source instead of trusting the fix report.
- **Research before guessing on unfamiliar APIs.** Phase 17's Stripe Customer Session mechanics were verified against the installed SDK's own type declarations and a live docs fetch before planning, catching that the roadmap's literal wording ("PaymentIntent with `setup_future_usage`") was actually a documented Stripe integration error when combined with the Customer Session config.
- **Planner-caught hazards that would have been real bugs.** The planner itself flagged, before any code was written, that Phase 18's digital-only email fix needed a union guard (not a replacement) to avoid re-breaking subscription renewals, and that Phase 18's cart-line fix needed the checkout projection to explicitly refuse a flagged line, not silently emit a bare gift card. Both were later independently re-found and fixed by the executors who implemented them — the same defect surfaced twice, from two different vantage points, and got caught both times.
- **Security audits that verified, not summarized.** Every phase's audit re-derived each threat's mitigation from the code at HEAD rather than trusting the plan or the review; one audit found that an earlier phase's own fix (Phase 13's admin layout gate) didn't actually hold once traced through the App Router's rendering model, and registered it as a new threat closed in the very next phase.
- **A live, verified milestone close instead of an assumed one.** All three Phase 19 operator items were confirmed from outside the repo after the fact — a `curl` for the support email, `wrangler secret list` for the secrets — not just marked done because the action was taken.

### What Was Inefficient

- **Verification digest churn from shared files.** Every phase's `covered_files` list included `ROADMAP.md`/`STATE.md`, and every subsequent phase's `phase.complete` call legitimately rewrote those files — so completing phase N kept re-invalidating phases 13..N-1's digests, requiring a final comprehensive re-refresh across all six phases right before milestone close. The fix in the moment worked; a covered-files convention that excludes shared bookkeeping files from the fingerprint would avoid the churn entirely.
- **A regex mismatch produced a false "no overlap" reading mid-close.** Diagnosing the digest staleness, a hand-rolled YAML extraction script tripped on a blank line after `covered_files:` and returned an empty file list, which looked like confirmation that nothing had changed — the opposite of the truth. The tool's own `verification.status` command was right the whole time; the manual diagnostic script was not trustworthy for the same task.
- **Shared, non-worktree parallel execution produced small git-index races.** Several waves ran multiple executors in the same checkout (`workflow.use_worktrees=false`, the v2/v2.1 precedent held), and more than once a sibling's staged file rode along into another executor's commit, or a commit message picked up a stale scratchpad file under `noclobber`. Every instance was self-caught, documented, and harmless (never a lost or duplicated line of code), but it happened often enough this milestone to be a real, recurring cost of the sequencing choice.
- **`init.manager`'s cached view lagged a fresh per-phase check at least once.** A first call reported five phases stale immediately after their digests were confirmed fresh by the direct `verification.status` query; a second call, moments later, agreed. Transient, but cost a diagnostic detour before the real staleness cause (see above) was found.

### Patterns Established

- One function owns a money-adjacent decision everywhere it's asked ("is honor effectively on", "is this order digital-only"), enforced either by every caller importing the same predicate or, where the client genuinely can't (no `fulfillment_type` on client cart items), by a cross-referenced doc comment plus one invariant test pinning the two implementations' agreement.
- A server-side gate is not optional wherever a server component renders data, even inside a route already covered by a client-side guard — the App Router streams a page segment in the RSC payload independent of what the layout mounts.
- New telemetry or correlation fields need updating in every independent sanitizer that touches the payload, not just the producer — the tail worker's own allowlist is a second source of truth that drifts silently if only one side is updated.
- A code-reviewer or security-auditor re-derives every claim from the code at HEAD; a fix report or a prior pass's "closed" verdict is a starting hypothesis, not evidence.
- Locally-generated secrets (random bytes piped straight into `wrangler secret put`, never echoed) are the standard pattern for a new Worker secret; confirm the final state with a read-only `wrangler secret list`, never by trusting the write succeeded.

### Key Lessons

1. A review or audit's job is to independently re-derive the claim, not summarize the artifact that makes the claim — every real finding this milestone came from someone reading the actual code, not the report about the code.
2. When research surfaces a correction to a locked decision or a roadmap's literal wording (Stripe's Customer Session mechanics, a migration-number collision), fold the correction into the context record explicitly rather than silently planning around it — the next reader needs to see both the original wording and why it changed.
3. A verification digest that includes shared bookkeeping files (ROADMAP.md, STATE.md) will churn every time a later phase closes; scope covered_files to what the phase actually implements.
4. Diagnostic scripts written under time pressure need the same skepticism as the code being diagnosed — a broken extraction script produced a confidently wrong answer before the tool's own authoritative check corrected it.
5. Closing a milestone's human-only checkpoint phase the same way as every code phase — verify from the outside, don't just record that the action was taken — caught nothing wrong this time, but the convention is what would have caught it if there had been something.

### Cost Observations

- Model mix: opus for planners, plan-checkers, and executors on money-adjacent or security-sensitive phases (17's saved payment methods ran the full research→plan→execute→review×2→verify→audit chain at that depth); sonnet for most reviewers, security auditors, and routine executors; orchestrator on the session model throughout.
- Sessions: one long autonomous run spanning both days, resumed after at least one context compaction; Phase 17 alone (money/PCI-adjacent) ran with explicitly elevated review depth (ASVS L2) given the sensitivity, mirrored by Phase 18's tech-debt audit and Phase 14's admin/audit-trail work.
- Notable: six of seven phases ran two full code-review iterations before push; every iteration-2 finding was real (not a false positive), which is the signal that the depth was calibrated correctly for this milestone's risk profile, not wasted cycles.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1 | ~8 | 4 | First GSD milestone; map + ingest drove requirements; tracer-then-parallel plan shape |
| v2 | ~6 | 7 | Autonomous run with batched decisions; two inserted phases (6.1 scope, 8.1 debt) plus 8.2 docs; fail-first gates and screenshot diffs |
| v2.1 | ~4 | 4 | Fully unattended run with a decision log; live production proof as the closing phase; owner-in-the-loop UX fixes the same night |
| v2.2 | ~2 | 7 | Two-iteration code review on every phase became standard, not exceptional; security audits verified from source, not from reports; the last phase was a deliberately human-only checkpoint, kept last so code work never waited on a dashboard session |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1 | 233 unit files + Workers + observability suites; +65 tests in the audit's E2E sample | not measured | 1 (`lib/auth/deployment-guard.ts`, no new packages) |
| v2 | 265 unit files (2,187 tests) + Workers (154) + observability suites | not measured | 2 zero-dep scripts (`build-themes.mjs`, `scan-hardcoded-colors.mjs`, `docs-lint.mjs`); Playwright added as a dev dependency for the screenshot harness |
| v2.1 | 288 unit files (2,375 tests) + Workers (157) + observability (3) | not measured | 0 new packages; scratch scripts only |
| v2.2 | 322 unit files (2,958 tests) + Workers (255) + observability (3) | not measured | 0 new packages; two D1 migrations (0024, 0025) |

### Top Lessons (Verified Across Milestones)

1. Verify safety and pin behavior with tests before changing checkout, webhook, or auth code. (v1)
2. Docs cite code; code is the source of truth. (v1, v2)
3. Build the gate first and watch it fail before the sweep it guards. (v2)
4. Verify visual claims by render, not by grep. (v2)
5. One real transaction through production beats every green suite. (v2.1)
6. A cron that swallows per-item errors looks healthy while failing. (v2.1)
7. Review and audit independently re-derive every claim from source; a fix report is a hypothesis, not evidence. (v2.2)
8. A verification digest scoped to shared bookkeeping files (ROADMAP.md, STATE.md) churns every time a later phase closes — scope it to what the phase actually built. (v2.2)
9. A new telemetry field needs updating in every independent sanitizer that touches it, not just the producer. (v2.2)
