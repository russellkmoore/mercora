# Phase 4: Reference Documentation Refresh - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

A contributor, human or AI, reading `docs/` gets the current system: the right text model, the right MCP tool count, the real test and CI setup, a complete index, clear labels on historical material, and a dependency baseline that is not overdue. Requirements: REF-01, REF-02, REF-03, REF-04, DEP-01.

In scope: every doc under `docs/` that mentions the old model name (7 files found by grep), the two tool-count lines, the Testing and Key Dependencies sections of `docs/CLAUDE.md`, the two `API_STRUCTURE.md` references, the "mock implementation" note in `docs/api-architecture.md`, `docs/README.md` as the index, historical banners on four documents, the implementation checklist in `docs/mobile-improvements-actionable.md`, `docs/dependency-security.md`, and the audit line in `.github/workflows/ci.yml`.

Out of scope: verifying the feature claims that surround the model name (for example "AI analytics"), the dated "Recent Fixes" and "Current Git Status" sections of `docs/CLAUDE.md`, any code change other than the one CI workflow line, and the mobile performance work the Lighthouse baseline flagged (backlog).

</domain>

<decisions>
## Implementation Decisions

### Model and Tool-Count Sweep (REF-01)
- **The replacement is the exact model id `@cf/openai/gpt-oss-20b`** everywhere "Llama 3.1" or "Llama 3.1 8B" appears in prose. Where a readable name helps a sentence, write "gpt-oss-20b (`@cf/openai/gpt-oss-20b`)". The single source of truth is `lib/ai/config.ts` (line ~29). The acceptance check is `grep -r "Llama 3.1" docs/` returning nothing, plus a broader `grep -ri "llama" docs/` review so no diagram id or class name survives.
- **Mermaid diagram nodes are renamed label and id together.** In `docs/architecture.md` (`LLM[Llama 3.1 8B Instruct]`, `LLM[🧠 Llama 3.1 8B]`) and `docs/ai-pipeline.md` (`LlamaModel[🧠 Llama 3.1 8B]`, its edges, and the `class LlamaModel,LowTemp,Response ai` line), rename the node id (e.g. `LlamaModel` → `TextModel`) and update every reference to it in the same diagram. Each edited diagram gets a grep proving the old id has zero remaining references and the new id has the same number of references the old one had.
- **Tool count reads 19 in both places** (`docs/CLAUDE.md` ~545 and `docs/ROADMAP.md` ~107), and `docs/CLAUDE.md` cites `app/api/mcp/route.ts` once as where the tool list lives (its "Available tools" error string enumerates all 19: search_products, assess_request, get_recommendations, add_to_cart, update_cart, remove_from_cart, get_cart, bulk_add_to_cart, clear_cart, create_payment_intent, place_order, get_order_status, get_shipping_options, validate_payment, create_agent, list_agents, get_agent_details, update_agent_status, rotate_agent_key). The executor re-counts from that string before writing.
- **Scope is every doc the grep finds** (`docs/DEPLOYMENT_SETUP.md`, `docs/architecture.md`, `docs/api-architecture.md`, `docs/README.md`, `docs/ROADMAP.md`, `docs/ai-pipeline.md`, `docs/CLAUDE.md`), not only the files REQUIREMENTS names. Only the model name changes in those sentences; the surrounding feature claims are left as they are.

### CLAUDE.md Test/CI Section and Stale References (REF-02)
- **The Testing section (`docs/CLAUDE.md` ~412–416) is replaced by about ten lines** that name the three vitest suites with their config files and npm scripts (unit via `vitest.config.mts`, Workers via `vitest.workers.config.mts`, observability via `vitest.observability.config.mts`; script names copied from `package.json`), then list the CI gates in the order `.github/workflows/ci.yml` runs them (audit, migration safety, lint, typecheck, cf-typecheck, build). The executor reads both source files and copies names verbatim; nothing is paraphrased from memory. The sentence "No formal testing framework currently configured" is gone.
- **Key Dependencies (`docs/CLAUDE.md` ~37–50) drops every pinned version.** Dependency names stay, followed by one line: versions live in `package.json`.
- **Both `API_STRUCTURE.md` references are repointed to `docs/api-architecture.md`**: the bullet at `docs/CLAUDE.md` ~589 and the tree entry at `docs/STRIPE_INTEGRATION.md` ~115. No doc references `docs/API_STRUCTURE.md` afterwards (`grep -r "API_STRUCTURE" docs/` is empty).
- **`docs/api-architecture.md` ~435 loses "(mock implementation)"** and instead states that Stripe PaymentIntent verification is real, citing `docs/checkout-trust-boundary.md`. The dated sections in `docs/CLAUDE.md` ("Recent Fixes & Issues Resolved (Aug 23, 2025)", "Current Git Status") are left untouched this phase and logged under deferred ideas.

### README Index and Historical Labels (REF-03, REF-04)
- **`docs/README.md` keeps its grouped layout and adds groups for the 15 unlinked files**: "Binding decisions (ADRs)" (checkout-trust-boundary, webhooks-refunds-inventory, database-migrations, subscriptions), "Operations and runbooks" (dependency-security, migration-reservations, shopify-migration, runtime-configuration), "Specs and contracts" (observability, content-publishing, customer-communications, o07-gift-cards-plan), and "Assessments, baselines, and proposals" (mobile-ux-assessment, mobile-testing-automation, mobile-improvements-actionable, mobile-lighthouse-baseline). Each file gets one line with a short description. The acceptance criterion is every file in `docs/` linked, which is 27 today (the Phase 2 Lighthouse baseline doc made it 27, not the 26 REQUIREMENTS was written against); the executor derives the list from `ls docs/*.md` at run time.
- **README status lines become current**: "MCP Server: live at `/api/mcp` with 19 tools" replaces the "🚧 under development" line (~37); the "future AI features" pointer (~66) becomes present tense; Last Updated (~79) becomes the edit date.
- **Historical banners are a blockquote directly under the H1, same shape in all four places**: `> **Status: Historical (September 2025).**` followed by one sentence stating what is true now and where to look. Texts: `docs/admin-dashboard-specification.md` (design document; unbuilt modules are not planned; the shipped admin routes are listed in `.planning/PROJECT.md` and `docs/CLAUDE.md`); the ER diagram section of `docs/architecture.md` (~214–322; predates the variant and ledger model; the current schema is `lib/db/schema/` and `migrations/`); `docs/mobile-ux-assessment.md` (September 2025 snapshot; measurements superseded by `docs/mobile-lighthouse-baseline.md`); `docs/mobile-testing-automation.md` (proposal; Lighthouse CI and Playwright suites are not implemented). For `architecture.md` the banner sits under the `## Database Schema Overview` heading rather than the H1, since only that section is historical.
- **Checklist in `docs/mobile-improvements-actionable.md` (~422–444)**: tick the ten code items (button touch targets, cart item controls, mobile menu animation, category indentation, web vitals hook, analytics API route, root layout integration, product card mobile spacing, form inputs for mobile keyboards, mobile-specific CSS) and the two measurement items Phase 2 completed (Lighthouse audit, performance baseline measurement), each with a short "done, see X" note pointing at the shipped file or `docs/mobile-lighthouse-baseline.md`. The manual device tests, the three "Test ..." flow items, and user acceptance testing stay unticked.

### Dependency Baseline (DEP-01)
- **Both Next-bundled exceptions close as "exit condition met 2026-09-02"** and move to a short "Closed exceptions" subsection of `docs/dependency-security.md` so the history stays readable. Evidence recorded: under Next 16.3.1 and Node 24.18.1, `npm audit --omit=dev` reports 0 findings at every severity; Next no longer bundles Sharp (not resolvable from `node_modules/next`); PostCSS resolves to 8.5.26.
- **CI gate rises to `high`**: `.github/workflows/ci.yml` line ~33 becomes `npm audit --omit=dev --audit-level=high`. The executor runs that exact command locally and records the exit code before committing; this is the only non-doc change in the phase.
- **Next review date is 2026-12-01; owners stay Russell K. Moore and Devon Hillard** as the doc has them.
- **The refreshed doc records the re-run evidence in its status header**: re-run date, Node and npm versions, installed Next and PostCSS versions, and the audit totals. The "Development-only findings" section is refreshed from a full `npm audit` (with dev dependencies) run in the same session so the document is not half-current. If that full run shows dev-only findings, they are listed with severity and package path, not suppressed.

### Claude's Discretion
- Exact wording of banner sentences, README descriptions, the Testing section prose, and the "Closed exceptions" entries.
- Whether the README groups are ordered by audience (contributor first) or by document type.
- Plan split; a sensible shape is one plan for the model/tool-count sweep (REF-01), one for CLAUDE.md, API references, README, and banners (REF-02, REF-03, REF-04), and one for the dependency baseline and CI line (DEP-01), all in one wave since the file sets do not overlap except `docs/CLAUDE.md` and `docs/README.md`, which the planner must assign to a single plan or serialize.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/ai/config.ts` (~line 29) is the source of truth for the model id `@cf/openai/gpt-oss-20b`.
- `app/api/mcp/route.ts` (~line 193) carries the authoritative "Available tools" list of 19 names in its unknown-tool error string.
- `package.json` scripts and `.github/workflows/ci.yml` are the sources for the Testing section; `vitest.config.mts`, `vitest.workers.config.mts`, `vitest.observability.config.mts` exist at the repo root.
- `docs/mobile-lighthouse-baseline.md` (Phase 2) is the current measurement record the mobile docs should point at.
- `docs/dependency-security.md` already has the exception record structure (advisories, package path, why it remains, exposure, compensating controls, exit condition); reuse it for the closed entries.
- Phase 3 established the doc-editing pattern: grep-verified claims, count-based acceptance gates, no `diff <(...)` (a shell function shadows `diff`), tolerant patterns for bold markdown.

### Established Patterns
- Docs describe exactly what code enforces (Phase 1 rule); every factual claim written this phase is grep-checked against its source file first.
- Blockquote-under-heading is the existing convention for document status (the ADR docs now use `**Status:** Accepted (date)` on line 3; the historical banners use the same position with a different label).
- Conventional commits, one commit per task, `docs(04-NN): ...` for planning artifacts; multi-line commit messages via `git commit -F <file>`.

### Integration Points
- `docs/README.md` (index, status lines, Last Updated), `docs/CLAUDE.md` (Testing, Key Dependencies, tool count, model mentions, API_STRUCTURE bullet), `docs/ROADMAP.md` (tool count, model mention), `docs/architecture.md`, `docs/ai-pipeline.md`, `docs/api-architecture.md`, `docs/DEPLOYMENT_SETUP.md`, `docs/STRIPE_INTEGRATION.md`, `docs/admin-dashboard-specification.md`, `docs/mobile-ux-assessment.md`, `docs/mobile-testing-automation.md`, `docs/mobile-improvements-actionable.md`, `docs/dependency-security.md`, `.github/workflows/ci.yml`.
- Phase 3 carry-overs to fold in where the file is already being edited: the code-review Info items (the "No formal testing framework" line is REF-02; a one-line note in `docs/webhooks-refunds-inventory.md` that the runbooks list `payment_intent.payment_failed` as a retained telemetry event on top of the ADR's required set is optional and at Claude's discretion) and the ingest warning W2 (admin dashboard spec label, which is REF-04).

</code_context>

<specifics>
## Specific Ideas

- Banner shape: `> **Status: Historical (September 2025).** <one sentence: what is true now, where to look>` directly under the heading, blank line above and below.
- Testing section shape: three bullets for the suites (name, config file, script), then one ordered list of the six CI gates in `ci.yml` order.
- The DEP-01 status header should read as a dated baseline a reviewer can re-run: command, versions, totals, next review date.

</specifics>

<deferred>
## Deferred Ideas

- The dated "Recent Fixes & Issues Resolved (Aug 23, 2025)" and "Current Git Status" sections in `docs/CLAUDE.md` are stale but outside REF-02; candidate for a later docs pass or deletion.
- Feature claims around the model name ("AI analytics", "real-time business insights") are not verified this phase.
- Mobile performance work (Lighthouse scores 72–80 against the 85 target) stays backlog.
- Optional one-line clarification in `docs/webhooks-refunds-inventory.md` about the retained `payment_intent.payment_failed` telemetry event (Phase 3 code-review Info item).

</deferred>
