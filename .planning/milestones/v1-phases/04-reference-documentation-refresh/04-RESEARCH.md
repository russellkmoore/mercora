# Phase 4: Reference Documentation Refresh - Research

**Researched:** 2026-09-02
**Domain:** Documentation accuracy verification (docs-only phase, one CI config line)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Model and Tool-Count Sweep (REF-01)**
- The replacement is the exact model id `@cf/openai/gpt-oss-20b` everywhere "Llama 3.1" or "Llama 3.1 8B" appears in prose. Where a readable name helps a sentence, write "gpt-oss-20b (`@cf/openai/gpt-oss-20b`)". The single source of truth is `lib/ai/config.ts` (line ~29). The acceptance check is `grep -r "Llama 3.1" docs/` returning nothing, plus a broader `grep -ri "llama" docs/` review so no diagram id or class name survives.
- Mermaid diagram nodes are renamed label and id together. In `docs/architecture.md` (`LLM[Llama 3.1 8B Instruct]`, `LLM[🧠 Llama 3.1 8B]`) and `docs/ai-pipeline.md` (`LlamaModel[🧠 Llama 3.1 8B]`, its edges, and the `class LlamaModel,LowTemp,Response ai` line), rename the node id (e.g. `LlamaModel` → `TextModel`) and update every reference to it in the same diagram. Each edited diagram gets a grep proving the old id has zero remaining references and the new id has the same number of references the old one had.
- Tool count reads 19 in both places (`docs/CLAUDE.md` ~545 and `docs/ROADMAP.md` ~107), and `docs/CLAUDE.md` cites `app/api/mcp/route.ts` once as where the tool list lives (its "Available tools" error string enumerates all 19: search_products, assess_request, get_recommendations, add_to_cart, update_cart, remove_from_cart, get_cart, bulk_add_to_cart, clear_cart, create_payment_intent, place_order, get_order_status, get_shipping_options, validate_payment, create_agent, list_agents, get_agent_details, update_agent_status, rotate_agent_key). The executor re-counts from that string before writing.
- Scope is every doc the grep finds (`docs/DEPLOYMENT_SETUP.md`, `docs/architecture.md`, `docs/api-architecture.md`, `docs/README.md`, `docs/ROADMAP.md`, `docs/ai-pipeline.md`, `docs/CLAUDE.md`), not only the files REQUIREMENTS names. Only the model name changes in those sentences; the surrounding feature claims are left as they are.

**CLAUDE.md Test/CI Section and Stale References (REF-02)**
- The Testing section (`docs/CLAUDE.md` ~412–416) is replaced by about ten lines that name the three vitest suites with their config files and npm scripts (unit via `vitest.config.mts`, Workers via `vitest.workers.config.mts`, observability via `vitest.observability.config.mts`; script names copied from `package.json`), then list the CI gates in the order `.github/workflows/ci.yml` runs them (audit, migration safety, lint, typecheck, cf-typecheck, build). The executor reads both source files and copies names verbatim; nothing is paraphrased from memory. The sentence "No formal testing framework currently configured" is gone.
- Key Dependencies (`docs/CLAUDE.md` ~37–50) drops every pinned version. Dependency names stay, followed by one line: versions live in `package.json`.
- Both `API_STRUCTURE.md` references are repointed to `docs/api-architecture.md`: the bullet at `docs/CLAUDE.md` ~589 and the tree entry at `docs/STRIPE_INTEGRATION.md` ~115. No doc references `docs/API_STRUCTURE.md` afterwards (`grep -r "API_STRUCTURE" docs/` is empty).
- `docs/api-architecture.md` ~435 loses "(mock implementation)" and instead states that Stripe PaymentIntent verification is real, citing `docs/checkout-trust-boundary.md`. The dated sections in `docs/CLAUDE.md` ("Recent Fixes & Issues Resolved (Aug 23, 2025)", "Current Git Status") are left untouched this phase and logged under deferred ideas.

**README Index and Historical Labels (REF-03, REF-04)**
- `docs/README.md` keeps its grouped layout and adds groups for the 15 unlinked files: "Binding decisions (ADRs)" (checkout-trust-boundary, webhooks-refunds-inventory, database-migrations, subscriptions), "Operations and runbooks" (dependency-security, migration-reservations, shopify-migration, runtime-configuration), "Specs and contracts" (observability, content-publishing, customer-communications, o07-gift-cards-plan), and "Assessments, baselines, and proposals" (mobile-ux-assessment, mobile-testing-automation, mobile-improvements-actionable, mobile-lighthouse-baseline). Each file gets one line with a short description. The acceptance criterion is every file in `docs/` linked, which is 27 today (the Phase 2 Lighthouse baseline doc made it 27, not the 26 REQUIREMENTS was written against); the executor derives the list from `ls docs/*.md` at run time.
- README status lines become current: "MCP Server: live at `/api/mcp` with 19 tools" replaces the "🚧 under development" line (~37); the "future AI features" pointer (~66) becomes present tense; Last Updated (~79) becomes the edit date.
- Historical banners are a blockquote directly under the H1, same shape in all four places: `> **Status: Historical (September 2025).**` followed by one sentence stating what is true now and where to look. Texts: `docs/admin-dashboard-specification.md` (design document; unbuilt modules are not planned; the shipped admin routes are listed in `.planning/PROJECT.md` and `docs/CLAUDE.md`); the ER diagram section of `docs/architecture.md` (~214–322; predates the variant and ledger model; the current schema is `lib/db/schema/` and `migrations/`); `docs/mobile-ux-assessment.md` (September 2025 snapshot; measurements superseded by `docs/mobile-lighthouse-baseline.md`); `docs/mobile-testing-automation.md` (proposal; Lighthouse CI and Playwright suites are not implemented). For `architecture.md` the banner sits under the `## Database Schema Overview` heading rather than the H1, since only that section is historical.
- Checklist in `docs/mobile-improvements-actionable.md` (~422–444): tick the ten code items (button touch targets, cart item controls, mobile menu animation, category indentation, web vitals hook, analytics API route, root layout integration, product card mobile spacing, form inputs for mobile keyboards, mobile-specific CSS) and the two measurement items Phase 2 completed (Lighthouse audit, performance baseline measurement), each with a short "done, see X" note pointing at the shipped file or `docs/mobile-lighthouse-baseline.md`. The manual device tests, the three "Test ..." flow items, and user acceptance testing stay unticked.

**Dependency Baseline (DEP-01)**
- Both Next-bundled exceptions close as "exit condition met 2026-09-02" and move to a short "Closed exceptions" subsection of `docs/dependency-security.md` so the history stays readable. Evidence recorded: under Next 16.3.1 and Node 24.18.1, `npm audit --omit=dev` reports 0 findings at every severity; Next no longer bundles Sharp (not resolvable from `node_modules/next`); PostCSS resolves to 8.5.26.
- CI gate rises to `high`: `.github/workflows/ci.yml` line ~33 becomes `npm audit --omit=dev --audit-level=high`. The executor runs that exact command locally and records the exit code before committing; this is the only non-doc change in the phase.
- Next review date is 2026-12-01; owners stay Russell K. Moore and Devon Hillard as the doc has them.
- The refreshed doc records the re-run evidence in its status header: re-run date, Node and npm versions, installed Next and PostCSS versions, and the audit totals. The "Development-only findings" section is refreshed from a full `npm audit` (with dev dependencies) run in the same session so the document is not half-current. If that full run shows dev-only findings, they are listed with severity and package path, not suppressed.

### Claude's Discretion
- Exact wording of banner sentences, README descriptions, the Testing section prose, and the "Closed exceptions" entries.
- Whether the README groups are ordered by audience (contributor first) or by document type.
- Plan split; a sensible shape is one plan for the model/tool-count sweep (REF-01), one for CLAUDE.md, API references, README, and banners (REF-02, REF-03, REF-04), and one for the dependency baseline and CI line (DEP-01), all in one wave since the file sets do not overlap except `docs/CLAUDE.md` and `docs/README.md`, which the planner must assign to a single plan or serialize.

### Deferred Ideas (OUT OF SCOPE)
- The dated "Recent Fixes & Issues Resolved (Aug 23, 2025)" and "Current Git Status" sections in `docs/CLAUDE.md` are stale but outside REF-02; candidate for a later docs pass or deletion.
- Feature claims around the model name ("AI analytics", "real-time business insights") are not verified this phase.
- Mobile performance work (Lighthouse scores 72–80 against the 85 target) stays backlog.
- Optional one-line clarification in `docs/webhooks-refunds-inventory.md` about the retained `payment_intent.payment_failed` telemetry event (Phase 3 code-review Info item).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REF-01 | Model name + tool count sweep across 7 docs | Exact grep hits, mermaid node ids, and the 19-tool enumeration verified below (`## REF-01 Verified Facts`) |
| REF-02 | CLAUDE.md Testing/CI section, Key Dependencies, API_STRUCTURE references, mock-implementation note | Exact npm scripts, CI step order, and both `API_STRUCTURE.md` reference sites verified below (`## REF-02 Verified Facts`) |
| REF-03 | README.md complete index + status lines | Exact unlinked-file list (15), one-line descriptions sourced from each doc's H1/opening paragraph, exact status-line line numbers (`## REF-03 Verified Facts`) |
| REF-04 | Historical/proposal banners + checklist ticks | ER diagram gap vs. `lib/db/schema/`, and file:line citation for each of the 10 shipped checklist items (`## REF-04 Verified Facts`) |
| DEP-01 | Dependency baseline refresh + CI gate raise | Fresh `npm audit` runs (prod and full), Sharp/PostCSS resolution facts, and a **correction** to one orchestrator-supplied fact (`## DEP-01 Verified Facts`) |
</phase_requirements>

## Summary

This is a pure documentation-verification phase (plus one CI config line). There is no new library, framework, or package to research — the work is: read the authoritative source (code, config, `package.json`, `package-lock.json` state), then edit `docs/` to match it exactly. Every claim below was verified this session by reading the cited file or running the cited command; none rests on training knowledge about this specific codebase.

Two corrections to the orchestrator-supplied facts surfaced during verification, both favorable to the plan:

1. **`require('sharp')` DOES resolve** (contrary to the orchestrator's stated fact) — it resolves from a top-level hoisted `node_modules/sharp` at version `0.35.3`, declared as a direct dependency of `next@16.3.1` (not bundled inside `next`'s own `node_modules`, which — as stated — contains only `postcss`). This is *better* evidence for closing the Sharp exception: 0.35.3 satisfies the exception's own exit condition ("Sharp 0.35 or newer"), and `npm audit --omit=dev` still reports 0 findings.
2. **A shell hook intercepts bare `grep`/`find`** in this environment (rtk, per user's global CLAUDE.md) and returns unreliable counts/garbled multi-file output for some invocations (a `grep -n ... | wc -l` on `case '` arms returned 59, not the correct 19). Absolute-path invocation (`/usr/bin/grep`, `/usr/bin/find`) bypasses the hook and returns correct results, confirmed side-by-side. This must be documented for the executor — see Validation Architecture.

**Primary recommendation:** Treat this phase as a source-of-truth copy exercise, not a rewrite. For every fact written into `docs/`, the executor should already have the exact source line open (this RESEARCH.md provides those lines) rather than re-deriving it from memory or from the doc being replaced.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Model name / tool count accuracy | Documentation | Application code (`lib/ai/config.ts`, `app/api/mcp/route.ts`) as source of truth | Docs must mirror code; code is never edited for REF-01 |
| Test/CI description accuracy | Documentation | CI config (`.github/workflows/ci.yml`), `package.json` | Docs describe what CI already enforces; no CI behavior changes for REF-02 |
| Documentation index completeness | Documentation | — | Pure docs-tier concern; README is the index artifact |
| Historical/proposal labeling | Documentation | Database schema (`lib/db/schema/`) as source of truth for the ER-diagram claim | Banner content must be falsifiable against current schema, not asserted |
| Dependency vulnerability gate | Build / CI | Documentation (`docs/dependency-security.md`) | The CI audit-level line is the one non-doc code change; the doc must match the gate it describes |

## Standard Stack

Not applicable — this phase installs no new packages and introduces no new library dependency. See `## Package Legitimacy Audit` below for the explicit N/A disposition.

## Package Legitimacy Audit

**N/A — this phase installs no external packages.** The only non-documentation change is one line in `.github/workflows/ci.yml` (`--audit-level=critical` → `--audit-level=high`), which raises an existing gate; it does not add a dependency. The Package Legitimacy Gate protocol is not applicable and was not run.

## REF-01 Verified Facts

### Model name occurrences

`grep -rni "llama" docs/` (run via `/usr/bin/grep` — see Validation Architecture for why) returns exactly these 14 lines in 7 files, confirming the orchestrator's count exactly:

```
docs/DEPLOYMENT_SETUP.md:14:- **AI Platform**: Cloudflare AI (Llama 3.1 8B + BGE embeddings)
docs/architecture.md:28:        LLM[Llama 3.1 8B Instruct]
docs/architecture.md:103:    Prompt --> LLM[🧠 Llama 3.1 8B]
docs/api-architecture.md:263:        API->>AI: Generate response (Llama 3.1)
docs/README.md:42:- **AI**: Cloudflare AI (Llama 3.1 8B + BGE embeddings)
docs/ROADMAP.md:55:- ✅ **AI-Powered Analytics**: Real-time business insights using Llama 3.1 8B
docs/ai-pipeline.md:41:        API->>AI: Generate response with Llama 3.1 8B
docs/ai-pipeline.md:170:        LlamaModel[🧠 Llama 3.1 8B]
docs/ai-pipeline.md:200:    FinalPrompt --> LlamaModel
docs/ai-pipeline.md:201:    LlamaModel --> LowTemp
docs/ai-pipeline.md:235:    class LlamaModel,LowTemp,Response ai
docs/CLAUDE.md:33:- **AI**: Cloudflare AI (Llama 3.1 8B + BGE embeddings)
docs/CLAUDE.md:158:- **AI Analytics**: Real-time business intelligence using Llama 3.1 8B
docs/CLAUDE.md:172:- Natural language insights using Llama 3.1 8B
docs/CLAUDE.md:357:User Query → BGE Embeddings → Vector Search → Context → Llama 3.1 → Response + Products
```

No case-insensitive "llama" hits exist outside these 14 lines/7 files — the broader `grep -ri` sweep the decision asks for surfaces nothing new. `[VERIFIED: /usr/bin/grep -rni "llama" docs/, this session]`

**Mermaid node ids to rename in `docs/ai-pipeline.md`:** the id `LlamaModel` appears 3 times as a node/edge reference (lines 170, 200, 201) plus once more in the `class` statement (line 235) — 4 total references to the id `LlamaModel` in that file. Renaming to (for example) `TextModel` means the post-edit grep for `TextModel` should also return exactly 4 hits in that file, and `grep LlamaModel docs/ai-pipeline.md` must return 0.

`docs/architecture.md` has two independent `LLM[...]` node definitions (lines 28 and 103) — these are **not** the same node id referenced twice; each is its own subgraph's terminal label (`LLM[Llama 3.1 8B Instruct]` at line 28 in "AI Services Layer", `LLM[🧠 Llama 3.1 8B]` at line 103 in a separate flow diagram under "Data Flow Architecture"). Both use the literal id `LLM` (not `Llama`), so no id rename is needed there — only the bracketed label text changes. `[VERIFIED: docs/architecture.md:28,103 read this session]`

### Model id source of truth

```typescript
// lib/ai/config.ts:25-33
/**
 * Primary text generation model used for conversational AI, analytics, and content generation
 */
export const TEXT_GENERATION_MODEL = {
  model: "@cf/openai/gpt-oss-20b",
  temperature: 0.3,
  maxTokens: 512,
  description: "GPT-OSS-20B - OpenAI's powerful reasoning model for agentic tasks and versatile developer use cases"
} as const satisfies AIModelConfig;
```
`[VERIFIED: lib/ai/config.ts:25-33, read this session]`

### Tool count

`app/api/mcp/route.ts:103-181` contains exactly 19 `case '...':` arms (confirmed via `/usr/bin/grep -n "case '" app/api/mcp/route.ts | wc -l` → `19`, and by listing each line):

```
103:      case 'search_products':
107:      case 'assess_request':
111:      case 'get_recommendations':
115:      case 'add_to_cart':
119:      case 'update_cart':
123:      case 'remove_from_cart':
127:      case 'get_cart':
131:      case 'bulk_add_to_cart':
135:      case 'clear_cart':
139:      case 'place_order':
143:      case 'create_payment_intent':
147:      case 'get_order_status':
151:      case 'get_shipping_options':
155:      case 'validate_payment':
159:      case 'create_agent':
163:      case 'list_agents':
167:      case 'get_agent_details':
171:      case 'update_agent_status':
181:      case 'rotate_agent_key':
```

Line 193's "Available tools" error string enumerates the identical 19 names in the identical order:

```typescript
// app/api/mcp/route.ts:193
`Unknown tool: ${tool}. Available tools: search_products, assess_request, get_recommendations, add_to_cart, update_cart, remove_from_cart, get_cart, bulk_add_to_cart, clear_cart, create_payment_intent, place_order, get_order_status, get_shipping_options, validate_payment, create_agent, list_agents, get_agent_details, update_agent_status, rotate_agent_key`,
```
`[VERIFIED: app/api/mcp/route.ts:103-181,193, read this session]`

Current stale count locations (both say "17"):

```
docs/CLAUDE.md:545:✅ **Complete Tool Set**: 17 MCP tools covering all commerce operations
docs/ROADMAP.md:107:- ✅ **MCP Server Implementation**: Production-ready Model Context Protocol server with 17 tools
```
`[VERIFIED: /usr/bin/grep, this session]`

## REF-02 Verified Facts

### npm test scripts (verbatim from `package.json`)

```json
"test": "vitest run",
"test:workers": "vitest run --config vitest.workers.config.mts",
"test:observability-worker": "vitest run --config vitest.observability.config.mts",
"test:watch": "vitest",
```
`[VERIFIED: package.json:16-19, read this session]`

Config file mapping — `npm test` (bare `vitest run`) resolves `vitest.config.mts` by Vitest's default discovery (confirmed present at repo root, 600B); this config sets `test.include: ["tests/unit/**/*.test.ts"]`. `npm run test:workers` and `npm run test:observability-worker` explicitly pass `--config` to their respective files (both present at repo root). `[VERIFIED: vitest.config.mts:1-21, vitest.workers.config.mts and vitest.observability.config.mts confirmed present via /usr/bin/ls, read this session]`

### CI gate order (verbatim, `.github/workflows/ci.yml`)

The **full** step sequence, in file order, is:

```yaml
# .github/workflows/ci.yml
- name: Audit production dependencies      # line 32-33
  run: npm audit --omit=dev --audit-level=critical
- name: Check migration safety             # line 35-37, PR events only
  run: npm run check:migrations -- --base ${{ github.event.pull_request.base.sha }}
- name: Lint                               # line 39-40
  run: npm run lint
- name: Typecheck                          # line 42-43
  run: npm run typecheck
- name: Check Cloudflare binding types      # line 45-46
  run: npm run cf-typecheck
- name: Test                               # line 48-49
  run: npm test
- name: Test Workers integration            # line 51-52
  run: npm run test:workers
- name: Test observability Durable Object   # line 54-55
  run: npm run test:observability-worker
- name: Build                              # line 57-58
  run: npm run build
```
`[VERIFIED: .github/workflows/ci.yml:1-62, read this session]`

**Note for the executor/planner:** CONTEXT.md's locked decision describes the ordered CI-gates list as "(audit, migration safety, lint, typecheck, cf-typecheck, build)" — six items — which **omits** the three `npm test`/`test:workers`/`test:observability-worker` steps from that specific list. That is consistent with the Testing section's own shape (three suite bullets first, covering the test steps, then the six-item ordered list of the remaining non-test gates in their exact ci.yml order: audit → migration safety → lint → typecheck → cf-typecheck → build). The six-item order matches ci.yml exactly once the three test steps are excluded, so no conflict — but the prose must make clear the tests run *between* cf-typecheck and build in the real pipeline, not merely "elsewhere." `[ASSUMED: reconciliation of CONTEXT.md wording with the file — the six-item list's intent, not verified against a stated rationale]`

CI reads Node version from `.nvmrc` (contents: `24.18.1`), matching `package.json`'s `"engines": { "node": ">=24.18.1 <25" }`. `[VERIFIED: .nvmrc and package.json:6-8, read this session]`

### API_STRUCTURE.md references (both sites)

```
docs/STRIPE_INTEGRATION.md:115:    └── API_STRUCTURE.md          # Clean API architecture
docs/CLAUDE.md:589:- `docs/API_STRUCTURE.md` - **NEW**: Clean API architecture (eliminates redundancy)
```
No file `docs/API_STRUCTURE.md` exists (confirmed absent from the `docs/` listing below). `[VERIFIED: full docs/ directory listing, this session — see REF-03 file list]`

### "mock implementation" note

```
docs/api-architecture.md:433-436 (inside a `note right of PaymentProcessing` mermaid block):
    note right of PaymentProcessing
        Stripe integration
        (mock implementation)
    end note
```
`docs/checkout-trust-boundary.md` (the doc REF-02's decision says to cite) states, among its accepted invariants: PaymentIntent creation and server-side retrieval for finalization are real Stripe API calls tied to the idempotent finalizer, not mocked — lines 16-22 describe Mercora creating the PaymentIntent and the finalizer retrieving it "server-side" before finalizing. `[VERIFIED: docs/api-architecture.md:433-436 and docs/checkout-trust-boundary.md:16-22, read this session]`

## REF-03 Verified Facts

### Complete `docs/` file list (27 files, confirmed via `find` this session)

```
admin-authentication.md            [linked]
admin-dashboard-specification.md   [linked]
ai-pipeline.md                     [linked]
api-architecture.md                [linked]
architecture.md                    [linked]
checkout-trust-boundary.md         [linked]
CLAUDE.md                          [linked]
content-publishing.md              [UNLINKED]
customer-communications.md         [UNLINKED]
database-migrations.md             [UNLINKED]
dependency-security.md             [UNLINKED]
DEPLOYMENT_SETUP.md                [linked]
mcp-server-specification.md        [linked]
migration-reservations.md          [UNLINKED]
mobile-improvements-actionable.md  [UNLINKED]
mobile-lighthouse-baseline.md      [UNLINKED]
mobile-testing-automation.md       [UNLINKED]
mobile-ux-assessment.md            [UNLINKED]
o07-gift-cards-plan.md             [UNLINKED]
observability.md                   [UNLINKED]
README.md                          [self — index]
ROADMAP.md                         [linked]
runtime-configuration.md           [UNLINKED]
shopify-migration.md               [UNLINKED]
STRIPE_INTEGRATION.md              [linked]
subscriptions.md                   [UNLINKED]
webhooks-refunds-inventory.md      [UNLINKED]
```
`[VERIFIED: find /Users/rmoore/Workspaces/mercora/docs -maxdepth 1 -name "*.md", this session]`

11 files are linked from `docs/README.md`, 15 are unlinked, README.md is the index itself (11+15+1=27). This matches CONTEXT.md's "12 of 27" framing (11 actually-linked + README itself counted as covered) and its unlinked list exactly, word for word.

**Discrepancy to flag for the planner:** CONTEXT.md's proposed "Binding decisions (ADRs)" README group lists 4 files — `checkout-trust-boundary`, `webhooks-refunds-inventory`, `database-migrations`, `subscriptions` — but `checkout-trust-boundary.md` is **already linked** under "Technical Architecture" (`docs/README.md:17`). Only 3 of the 4 named ADR-group members are actually among the 15 unlinked files. This is consistent (16 named across all 4 groups − 1 already-linked = 15 new links needed), so the acceptance criterion ("every file in `docs/` linked") is unaffected either way — but the executor should decide whether to also cross-list `checkout-trust-boundary.md` under the new ADR group (harmless duplication, matches the "these are the four ADRs" framing) or leave it where it is and only add the other 3. `[ASSUMED: no stated preference in CONTEXT.md — flagged as Open Question below]`

### One-line source material for each of the 15 unlinked docs (H1 + opening paragraph, verbatim)

| File | H1 | Opening material (verbatim, for the executor to paraphrase into one line) |
|------|----|----|
| `content-publishing.md` | Content publishing | "Mercora provides store-neutral CMS pages and Blog publishing. Migration `0019` adds the Blog tables and neutral page-template registrations without seeding merchant posts, pages, images, or copy." |
| `customer-communications.md` | Customer accounts and communications | "Mercora provides authenticated account navigation, owner-scoped order history, saved addresses, and basic profile settings without requiring an email provider." |
| `database-migrations.md` | Database migrations | **Status:** Accepted (2026-08-03). "Mercora does not apply remote D1 migrations as part of `npm run deploy`. Schema changes are an explicit operator action..." |
| `dependency-security.md` | Dependency Security Baseline | Status header: no critical findings, two owned upstream exceptions, baseline/owners/next-review fields (this doc is rewritten by DEP-01 in this same phase — description should reflect the post-refresh state). |
| `migration-reservations.md` | Migration reservations | "The optional platform pass assigns migration numbers from the current Mercora ledger. Reservations prevent parallel feature branches from reusing a number." |
| `mobile-improvements-actionable.md` | Mobile UX Improvements - Actionable Implementation Guide | "Implementation Priority: High-impact mobile optimizations for immediate deployment... Focus: Touch targets, performance, user flow optimization." |
| `mobile-lighthouse-baseline.md` | Mobile Lighthouse Baseline | "Status: Baseline recorded; all four measured routes fail the PRD target. Measurement date: 2026-09-02. Measured by: GSD executor (Phase 2, plan 02-05, MOB-01)." |
| `mobile-testing-automation.md` | Mobile Testing Automation Setup | "Setup Guide: Automated mobile testing and performance monitoring for Mercora. Updated: September 2, 2025." — proposal, not implemented (see REF-04). |
| `mobile-ux-assessment.md` | Mobile UX Assessment - Mercora Platform | "Assessment Date: September 2, 2025. Platform: Mercora AI-Powered eCommerce. Scope: Complete mobile user experience evaluation." — snapshot, superseded (see REF-04). |
| `o07-gift-cards-plan.md` | O07 Gift Cards: Completion Plan | "O07 provides generic stored-value gift cards for Mercora, stacked on `agent/o06-subscriptions`. The branch currently contains the security and ledger foundation..." |
| `observability.md` | Privacy-safe commerce observability | "Mercora emits a versioned, bounded telemetry envelope for actionable commerce failures. Telemetry is always best effort..." |
| `runtime-configuration.md` | Runtime configuration | "Mercora has neutral demo defaults in `lib/store-config.ts`. A storefront can override public, non-secret values without editing components." |
| `shopify-migration.md` | Shopify migration toolkit | "The operator-only Shopify migration toolkit imports catalog, content, media, customers, historical orders, and optionally Judge.me reviews into Mercora. It defaults to a local dry run." |
| `subscriptions.md` | Subscriptions | **Status:** Accepted (2026-08-14). "New subscription acquisition is optional and disabled by default. Migration `0021` is additive..." |
| `webhooks-refunds-inventory.md` | Webhooks, refunds, and inventory operations | **Status:** Accepted (2026-08-06). "Mercora treats Stripe, order state, and variant inventory as a set of durable, retryable transitions." |

`[VERIFIED: head -8 of each file, read this session]`

### README status-line locations (exact, matching CONTEXT.md's `~` line numbers)

```
docs/README.md:37:- 🚧 **MCP Server**: Under development for agentic commerce
docs/README.md:66:- Review [mcp-server-specification.md] for future AI features
docs/README.md:79:**Last Updated**: September 1, 2025
```
`[VERIFIED: docs/README.md:1-91, read this session]`

## REF-04 Verified Facts

### ER diagram gap (`docs/architecture.md` `## Database Schema Overview`, lines 214-321)

The mermaid `erDiagram` block (lines 217-321) declares 9 entities: `PRODUCTS`, `PRODUCT_PRICES`, `PRODUCT_SALE_PRICES`, `PRODUCT_INVENTORY`, `PRODUCT_IMAGES`, `PRODUCT_TAGS`, `PRODUCT_USE_CASES`, `PRODUCT_ATTRIBUTES`, `ORDERS`, `ORDER_ITEMS`, `CHAT_SESSIONS`. The section ends at line 321 (```` ``` ````); the next `##` heading ("Component Architecture") starts at line 323.

Cross-checked against `lib/db/schema/` (29 files, listed via `find` this session), the diagram is missing entities for tables that exist in the real schema, concretely:

- **`product_variants`** — `export const product_variants = sqliteTable('product_variants', {...})` at `lib/db/schema/products.ts:49`. No variant entity anywhere in the diagram.
- **`order_effects`** — `export const order_effects = sqliteTable(...)` at `lib/db/schema/order-effects.ts:4`. This is the order ledger table; absent from the diagram.
- **`orderEvents`** (table name `order_events`, inferred from filename convention; not read past the export line) — `export const orderEvents = sqliteTable(...)` at `lib/db/schema/order-events.ts:10`. Also absent.
- **`order_webhooks`** — `export const order_webhooks = sqliteTable("order_webhooks", {...})` at `lib/db/schema/order.ts:56`. Absent.
- Entire gift-card ledger subsystem (`gift_card_accounts`, `gift_card_reservations`, `gift_card_ledger_entries`, `gift_card_deliveries` — `lib/db/schema/gift-cards.ts:28,77,129,183`), subscriptions, blog/CMS, promotions, coupons, admin users, and analytics tables — none appear in the diagram, all postdate it.
- Conversely, `CHAT_SESSIONS` appears **in** the diagram but has **no** corresponding schema file among the 29 files in `lib/db/schema/` — `/usr/bin/grep -rn "chat_sessions\|chatSessions\|ChatSessions" lib/db/schema/` returns zero matches. The diagram references an entity that no longer exists in the current schema.

`[VERIFIED: lib/db/schema/products.ts:49, lib/db/schema/order-effects.ts:4, lib/db/schema/order-events.ts:10, lib/db/schema/order.ts:56, lib/db/schema/gift-cards.ts:28,77,129,183, all read this session; grep for chat_sessions returned no hits]`

This gives the banner concrete content: *"predates the variant model (`product_variants`) and the order ledger tables (`order_effects`, `order_events`, `order_webhooks`); the current schema also includes gift cards, subscriptions, CMS/blog, promotions, and admin-user tables not shown here. The diagrammed `CHAT_SESSIONS` entity has no corresponding table in the current schema."*

### Checklist (`docs/mobile-improvements-actionable.md`, lines 419-444)

17 checkbox items total across four `###` week groups (confirmed: 5 + 4 + 4 + 4 = 17). The 12 to tick and the file:line evidence for each ("done, see X"):

| Line | Checklist item | Evidence file:line |
|------|-----------------|---------------------|
| 422 | Update button component touch targets | `components/ui/button.tsx:74-78` — `default: "h-11 ..."`, `sm: "h-10 ..."`, `lg: "h-12 ..."`, `icon: "size-11"` |
| 423 | Optimize cart item controls | `components/cart/CartItemCard.tsx:39,50` — `className="h-10 w-10 p-0 text-base touch-manipulation ..."` |
| 424 | Improve mobile menu animation | `components/HeaderClient.tsx:429` — `duration-300! data-[state=closed]:duration-200! data-[state=open]:duration-300!` |
| 426 | Update category indentation | `components/HeaderClient.tsx:192,310` — `getIndentationClass` function (line 192), applied at line 310 |
| 429 | Create web vitals hook | `lib/hooks/useWebVitals.ts` (confirmed present) |
| 430 | Add analytics API route | `app/api/analytics/vitals/route.ts` (confirmed present) |
| 431 | Integrate into root layout | `app/layout.tsx:54,176` — `import WebVitals from "@/components/analytics/WebVitals"` (54), `<WebVitals />` (176) |
| 435 | Update product card mobile spacing | `components/ProductCard.tsx:125,142,143,146` — `touch-manipulation` (125), `space-y-3` (142), `line-clamp-2` (143, 146) |
| 436 | Optimize form inputs for mobile keyboards | `components/checkout/ShippingForm.tsx:57,67-68,77,86` — `autoComplete="name"`, `autoComplete="email" inputMode="email"`, `autoComplete="address-line1"`, `autoComplete="address-line2"` |
| 437 | Add mobile-specific CSS | `app/globals.css:132,136` — `.touch-manipulation` (132), `.mobile-scroll` (136) |
| 442 | Run Lighthouse audit | `docs/mobile-lighthouse-baseline.md` (Phase 2, MOB-01) |
| 443 | Performance baseline measurement | `docs/mobile-lighthouse-baseline.md` (same doc — measurement date 2026-09-02) |

Lines that stay **unticked** (per the locked decision): 425 ("Test mobile navigation flow"), 432 ("Test vitals tracking"), 438 ("Test checkout flow on mobile"), 441 ("Manual test on iPhone/Android"), 444 ("User acceptance testing").

`[VERIFIED: all file:line citations above read this session — components/ui/button.tsx, components/cart/CartItemCard.tsx, components/HeaderClient.tsx, lib/hooks/useWebVitals.ts (existence), app/api/analytics/vitals/route.ts (existence), app/layout.tsx, components/ProductCard.tsx, components/checkout/ShippingForm.tsx, app/globals.css]`

### Admin dashboard spec / mobile-testing-automation proposal confirmation

`docs/admin-dashboard-specification.md:1` H1 is "Voltique Admin Dashboard - Technical Specification" — no existing status marker. `docs/mobile-testing-automation.md` proposes npm scripts (`lighthouse:mobile`, `test:mobile`, `monitor:mobile`, `report:mobile`) that **do not exist** in `package.json`'s scripts block (cross-checked against the full scripts list read this session), and `.github/workflows/` contains only `ci.yml` — no Lighthouse CI or Playwright workflow file exists. This confirms the doc is aspirational, supporting the "proposal; not implemented" banner text. `[VERIFIED: package.json scripts block and .github/workflows/ directory listing, this session]`

## DEP-01 Verified Facts

### Fresh audit runs (this session, Node 24.18.1, npm 11.16.0)

```
$ npm audit --omit=dev
found 0 vulnerabilities
```

```
$ npm audit --omit=dev --audit-level=high
found 0 vulnerabilities
$ echo $?
0
```

```
$ npm audit   (full tree, including devDependencies)
# npm audit report
esbuild  <=0.24.2 — moderate — GHSA-67mh-4wv8-2f99
  reached via @esbuild-kit/core-utils → @esbuild-kit/esm-loader → drizzle-kit (0.19.0 - 1.0.0-beta.1-fd8bfcc)
  fix available via `npm audit fix --force` (installs drizzle-kit@0.18.1, a breaking change)
qs  2.2.5 - 6.15.3 — moderate — GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g
  fix available via `npm audit fix`
5 moderate severity vulnerabilities
```

`npm audit --json` metadata confirms: `{ "info": 0, "low": 0, "moderate": 5, "high": 0, "critical": 0, "total": 5 }`, all 5 inside `devDependencies` (`prod: 272, dev: 874, optional: 283`). `npm ls qs` traces the qs finding to `@opennextjs/cloudflare@1.20.2 → @opennextjs/aws@4.1.0 → express@5.2.1 → qs@6.15.3` (also via `body-parser@2.3.0`) — `@opennextjs/cloudflare` is a `devDependency` (confirmed in `package.json:87`). The esbuild finding traces to `drizzle-kit`'s `@esbuild-kit/core-utils`/`@esbuild-kit/esm-loader` chain — `drizzle-kit` is also a `devDependency` (`package.json:97`). `[VERIFIED: npm audit, npm audit --json, npm ls qs, all run this session]`

### Sharp and PostCSS resolution — correction to orchestrator-supplied fact

The orchestrator's briefing stated `require('sharp')` does not resolve. **This is false under the current lockfile; the correct, falsified statement is below.**

```
$ node -e "console.log(require.resolve('sharp'))"
/Users/rmoore/Workspaces/mercora/node_modules/sharp/dist/index.cjs

$ npm ls sharp
mercora@0.1.0
├─┬ @cloudflare/vitest-pool-workers@0.21.3
│ └── sharp@0.35.2
└── sharp@0.35.3   (declared dependency of next@16.3.1)
```

`node_modules/next/node_modules` contains **only** `postcss` (confirmed via `readdirSync` — `['postcss']`), matching the orchestrator's claim about that specific path. But `sharp` resolves globally from a top-level hoisted `node_modules/sharp` at `0.35.3`, because npm hoists `next@16.3.1`'s direct dependency on `sharp` to the top level rather than nesting it under `node_modules/next/node_modules`. This is **stronger** evidence for closing the exception, not weaker: `docs/dependency-security.md`'s existing exit-condition text for the Sharp exception reads "Upgrade to a supported Next 16 release that uses Sharp 0.35 or newer" — `0.35.3` satisfies that condition exactly. `[VERIFIED: require.resolve('sharp'), npm ls sharp, readdirSync(node_modules/next/node_modules), all run this session]`

PostCSS resolves to `8.5.26` at the top level (`node -e "console.log(require('.../node_modules/postcss/package.json').version)"` → `8.5.26`). `[VERIFIED: this session]`

### Current CI gate and its exact location

```yaml
# .github/workflows/ci.yml:32-33
- name: Audit production dependencies
  run: npm audit --omit=dev --audit-level=critical
```
`[VERIFIED: .github/workflows/ci.yml:32-33, read this session]`

### Existing `docs/dependency-security.md` structure to reuse

The document already has: a status header (lines 1-6: Status/Baseline date/Owners/Next review), a "Time-bounded production exceptions" section with two entries (PostCSS ~65-81, Sharp ~83-98) each following the pattern Owners/deadline, Advisories, Package path, Why it remains, Exposure, Compensating controls, Exit condition; a "Development-only findings" section (~100-110, currently naming `undici` and legacy `esbuild` — now also should include `qs`, confirmed present); and an "Enforcement and follow-up" section (~112-126) that already contains the target `npm audit --omit=dev --audit-level=high` command as a forward-looking code block (line 125), which the CI change now makes real. Current "Next review" is `2026-08-25` (past). `[VERIFIED: docs/dependency-security.md, full file read this session]`

## Common Pitfalls

### Pitfall 1: Trusting the orchestrator-supplied "facts" without falsification
**What goes wrong:** The briefing text stated `require('sharp')` does not resolve; a literal `npm audit`-only check without an actual `require.resolve` probe would have missed that this is false (sharp resolves via top-level hoisting).
**Why it happens:** Facts gathered before a fresh `npm ci`/lockfile state can drift; hoisting behavior also depends on the exact dependency graph, which changes across `npm install` runs.
**How to avoid:** For every "package X does not resolve" or "path Y has no matching file" claim in this phase, run the actual resolution/existence check rather than restating the briefing. This phase is unusually dense with negative claims (files that don't exist, strings that don't appear) — each one is a falsification opportunity, not a given.
**Warning signs:** A claim about absence with no command shown that produced it.

### Pitfall 2: Bare `grep`/`find` in this shell environment give wrong counts
**What goes wrong:** `grep -n "case '" app/api/mcp/route.ts | wc -l` returned `59` when the correct count (confirmed via `/usr/bin/grep`) is `19`. A bare `find ... -name "..."` also returns garbled multi-file-summary output instead of a clean path list.
**Why it happens:** The user's global CLAUDE.md documents an `rtk` (Rust Token Killer) shell hook that transparently rewrites common commands (`git status` → `rtk git status`, etc.) for token savings; it appears to also intercept `grep`/`find` and, at least for some flag/pipe combinations, produces incorrect or reformatted output rather than passing through the real command's stdout.
**How to avoid:** Use the absolute path (`/usr/bin/grep`, `/usr/bin/find`) for every verification grep/find in this phase, especially anything feeding a `wc -l` count-based gate. Confirmed side-by-side this session: `/usr/bin/grep -n "case '" app/api/mcp/route.ts | wc -l` → `19` (correct), bare `grep` piped the same way → `59` (wrong).
**Warning signs:** A count that doesn't match a manual listing of the same matches; multi-file `find` output containing lines like "19 matches in 19F" or "1F 1D" instead of plain paths.

### Pitfall 3: `ls docs/*.md` count is 27, not 26
**What goes wrong:** REQUIREMENTS.md (written before Phase 2 added `docs/mobile-lighthouse-baseline.md`) says "26 docs." A plan or acceptance check hard-coding "26" will fail on a correct implementation.
**Why it happens:** The requirement was written before Phase 2 shipped MOB-01.
**How to avoid:** Derive the target count from `ls docs/*.md | wc -l` (via `/usr/bin/ls`/`/usr/bin/find` per Pitfall 2) at execution time, not from the REQUIREMENTS.md literal "26." CONTEXT.md's locked decision already says this explicitly — carry it into the plan's acceptance gate.
**Warning signs:** An acceptance check with `test "$(...)" = "26"` hard-coded.

## Runtime State Inventory

Not applicable — this is a documentation-content phase plus one CI YAML line; it does not rename, refactor, or migrate any identifier, so the standard rename/refactor categories (stored data, live service config, OS-registered state, secrets/env vars, build artifacts) do not apply. None of the four historical banners, the tool-count fix, or the model-name fix touch any runtime-persisted key, env var name, or external service configuration — verified by checking that none of the strings being changed ("Llama 3.1", "17", "mock implementation") appear as a D1 column value, KV/env-var name, or Cloudflare dashboard-configured name (they are prose only, confirmed by their surrounding grep context above, all inside markdown sentences or mermaid diagram labels/comments).

## Code Examples

### Historical banner shape (locked format, for the 4 REF-04 targets)

```markdown
> **Status: Historical (September 2025).** [One sentence: what is true now, and where to look.]
```

Applied under an existing H1 (three of four targets) or under a specific `##` heading (`docs/architecture.md`'s `## Database Schema Overview`, since only that section — not the whole file — is historical):

```markdown
## Database Schema Overview

> **Status: Historical (September 2025).** This diagram predates the variant model (`product_variants`) and the order ledger tables (`order_effects`, `order_events`); the current schema is `lib/db/schema/` and `migrations/`.

```mermaid
erDiagram
    ...
```
```

### ADR-style status marker (existing convention, for comparison — NOT what REF-04 banners use)

```markdown
# Order and Checkout Trust Boundary

**Status:** Accepted (2026-08-05)
```
`[VERIFIED: docs/checkout-trust-boundary.md:1-3, docs/database-migrations.md:3, docs/subscriptions.md:3, docs/webhooks-refunds-inventory.md:3 — all four use the identical `**Status:** Accepted (YYYY-MM-DD)` shape at line 3, read this session]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The six-item CI-gates ordered list in the Testing section prose intentionally excludes the three vitest suite steps (since those are covered by the three preceding suite bullets), rather than being an omission in CONTEXT.md | REF-02 Verified Facts | Low — either interpretation produces an accurate Testing section; worst case is a slightly different (both-accurate) prose shape than intended |
| A2 | `docs/o07-gift-cards-plan.md`'s one-line README description should reflect its current state (gift cards shipped, PR #79 merged per REQUIREMENTS.md "Already Shipped") rather than the doc's own "Completion Plan" framing, since the doc itself may be stale relative to the shipped feature | REF-03 Verified Facts (table) | Low — cosmetic; a "planning doc" framing in the one-liner is still technically true, just less current-sounding |

**If this table is empty:** N/A — two low-risk assumptions logged above; both are Claude's-discretion wording choices, not factual risks.

## Open Questions

1. **Should `checkout-trust-boundary.md` be cross-listed under the new "Binding decisions (ADRs)" README group even though it already has a link under "Technical Architecture"?**
   - What we know: CONTEXT.md's decision names all four ADRs (checkout-trust-boundary, webhooks-refunds-inventory, database-migrations, subscriptions) as the ADR group's members, but only 3 of the 4 are among the 15 currently-unlinked files.
   - What's unclear: Whether "every file in docs/ linked" is satisfied by leaving checkout-trust-boundary's existing link as-is (no duplicate), or whether the ADR group should be complete-looking with a second link to it.
   - Recommendation: Either is acceptable for the acceptance criterion (all 27 files already reachable from README either way); planner should pick based on whether a reader scanning "Binding decisions (ADRs)" expects to see all four listed together. Leaving it as a single link elsewhere and noting "(see Technical Architecture above)" in the new group is the more consistent option.

2. **Exact wording for `docs/o07-gift-cards-plan.md`'s README one-liner given it's now shipped (per REQUIREMENTS.md "Already Shipped" section) but the doc's own H1 still says "Completion Plan."**
   - What we know: PR #79 merged; all 8 REQ-gift-cards-* items are marked shipped in REQUIREMENTS.md.
   - What's unclear: Whether REF-03's scope includes correcting the doc's own stale "Completion Plan" framing, or only adding a README link/description.
   - Recommendation: REF-03's locked decision only asks for a README link + one-line description; the doc's own content is out of this phase's stated scope (not in the CONTEXT.md decisions list). Describe it in README using present-tense shipped language without editing the doc itself.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All npm scripts, CI | ✓ | 24.18.1 (matches `.nvmrc` and `package.json` engines) | — |
| npm | `npm audit`, `npm test`, etc. | ✓ | 11.16.0 | — |
| vitest | Test suites referenced in REF-02 | ✓ | ^4.1.10 (devDependency) | — |
| `/usr/bin/grep`, `/usr/bin/find` | Count-based verification gates | ✓ | system | Bare `grep`/`find` — unreliable in this shell, see Common Pitfalls #2 |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** Bare `grep`/`find` (rtk-hook-intercepted) — fallback is the absolute-path form, confirmed reliable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 (three configs: unit/Workers/observability) |
| Config files | `vitest.config.mts`, `vitest.workers.config.mts`, `vitest.observability.config.mts` (all repo root) |
| Quick run command | N/A for this phase — no application code under test changes (docs + one CI YAML line) |
| Full suite command | `npm test && npm run test:workers && npm run test:observability-worker` — run once to confirm the phase's one code change (CI YAML) doesn't regress anything, though the YAML change itself is not exercised by vitest |

This phase's actual verification is **grep/count-based against the doc content**, not vitest — there is no application behavior to unit-test. Each requirement gets an explicit count or emptiness gate:

### Phase Requirements → Verification Map

| Req ID | Gate | Exact command | Expected result |
|--------|------|----------------|------------------|
| REF-01 | No "Llama 3.1" survives | `/usr/bin/grep -r "Llama 3.1" docs/` | empty (exit 1, no output) |
| REF-01 | No case-insensitive "llama" survives anywhere | `/usr/bin/grep -ri "llama" docs/` | empty |
| REF-01 | Tool count is 19 in both places | `/usr/bin/grep -n "19 MCP tools\|with 19 tools" docs/CLAUDE.md docs/ROADMAP.md` | 2 hits, one per file |
| REF-01 | No stale "17" tool count remains | `/usr/bin/grep -n "17 MCP tools\|with 17 tools" docs/CLAUDE.md docs/ROADMAP.md` | empty |
| REF-01 | `ai-pipeline.md` mermaid id fully renamed | `/usr/bin/grep -c "LlamaModel" docs/ai-pipeline.md` then `/usr/bin/grep -c "<NewId>" docs/ai-pipeline.md` | first = 0, second = 4 (the count `LlamaModel` had before the edit) |
| REF-02 | "No formal testing framework" sentence gone | `/usr/bin/grep -n "No formal testing framework" docs/CLAUDE.md` | empty |
| REF-02 | No `API_STRUCTURE.md` reference remains | `/usr/bin/grep -r "API_STRUCTURE" docs/` | empty |
| REF-02 | "mock implementation" note gone | `/usr/bin/grep -n "mock implementation" docs/api-architecture.md` | empty |
| REF-02 | Key Dependencies section has no pinned version strings | `/usr/bin/grep -n '"\^' docs/CLAUDE.md` (after the edit, within the Key Dependencies block) | empty in that section |
| REF-03 | Every `docs/*.md` file is linked from README | for each `f` in `$(ls docs/*.md)`, `/usr/bin/grep -q "$(basename $f)" docs/README.md` | all pass (script the loop; count-based: `test "$(for f in docs/*.md; do /usr/bin/grep -l "$(basename $f)" docs/README.md; done | /usr/bin/grep -c .)" = "$(ls docs/*.md | wc -l)"` using `/usr/bin/ls`/`/usr/bin/grep` throughout) |
| REF-03 | MCP status line is current | `/usr/bin/grep -n "under development" docs/README.md` | empty |
| REF-03 | Last Updated is a 2026 date | `/usr/bin/grep -n "Last Updated.*2026" docs/README.md` | 1 hit |
| REF-04 | All 4 historical banners present | `/usr/bin/grep -c "Status: Historical" docs/admin-dashboard-specification.md docs/architecture.md docs/mobile-ux-assessment.md docs/mobile-testing-automation.md` | 1 each, 4 files |
| REF-04 | Checklist shows exactly 12 ticked, 5 unticked | `/usr/bin/grep -c '\[x\]' docs/mobile-improvements-actionable.md` between lines 419-444 (use `sed -n '419,444p'` piped to the same count, or `/usr/bin/grep -n` with line-range awareness) | 12 ticked |
| DEP-01 | CI gate raised | `/usr/bin/grep -n "audit-level=high" .github/workflows/ci.yml` | 1 hit at line ~33 |
| DEP-01 | Gate passes locally before commit | `npm audit --omit=dev --audit-level=high` | exit 0, "found 0 vulnerabilities" (confirmed this session) |
| DEP-01 | Next-review date is in the future | `/usr/bin/grep -n "Next review" docs/dependency-security.md` | date > 2026-09-02 (locked decision: 2026-12-01) |

### Sampling Rate
- **Per task commit:** run the specific grep/count gate(s) for the requirement(s) that task touches, using `/usr/bin/grep`/`/usr/bin/find` per Pitfall 2.
- **Per wave merge / phase gate:** re-run every gate in the table above in one pass, plus `npm audit --omit=dev --audit-level=high` (the one behavioral check in this phase) and, if `docs/CLAUDE.md` was touched, a full `npm test && npm run test:workers && npm run test:observability-worker` as a sanity check that nothing else in the repo regressed (not expected to be affected, since only `.md`/`.yml` files change, but cheap to confirm).

### Wave 0 Gaps
None — existing test infrastructure (vitest suites, CI) is unaffected by this phase's changes; the phase's own verification is the grep/count gate table above, not a code test suite.

## Security Domain

This phase makes no authentication, authorization, or input-handling change. The only non-documentation change is raising an existing dependency-audit CI gate from `--audit-level=critical` to `--audit-level=high`, which is itself a supply-chain hygiene tightening, not a new attack surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not touched this phase |
| V3 Session Management | No | Not touched this phase |
| V4 Access Control | No | Not touched this phase |
| V5 Input Validation | No | Not touched this phase |
| V6 Cryptography | No | Not touched this phase |
| V14 Configuration (dependency management) | Yes | CI `npm audit --omit=dev --audit-level=high` gate (verified passes with 0 findings today) |

### Known Threat Patterns for this phase's stack
Not applicable — no code paths, no new dependencies, no user input handling introduced.

## Sources

### Primary (HIGH confidence — read/executed this session)
- `lib/ai/config.ts` — model id source of truth
- `app/api/mcp/route.ts` — 19-tool source of truth (case arms + error string)
- `package.json` — npm scripts, dependency names/versions, engines
- `.github/workflows/ci.yml` — CI gate order and exact audit command
- `.nvmrc` — CI Node version
- `vitest.config.mts`, `vitest.workers.config.mts`, `vitest.observability.config.mts` — existence/config confirmed
- `lib/db/schema/*.ts` (29 files) — current schema, cross-checked against `docs/architecture.md`'s ER diagram
- `docs/dependency-security.md` — existing exception structure, current gate command
- `docs/README.md`, `docs/CLAUDE.md`, `docs/ROADMAP.md`, `docs/architecture.md`, `docs/api-architecture.md`, `docs/ai-pipeline.md`, `docs/DEPLOYMENT_SETUP.md`, `docs/STRIPE_INTEGRATION.md`, `docs/checkout-trust-boundary.md`, `docs/admin-dashboard-specification.md`, `docs/mobile-ux-assessment.md`, `docs/mobile-testing-automation.md`, `docs/mobile-improvements-actionable.md`, and the 15 unlinked docs (H1 + opening paragraph) — all read directly
- `npm audit`, `npm audit --omit=dev`, `npm audit --omit=dev --audit-level=high`, `npm audit --json`, `npm ls qs`, `npm ls sharp` — all run this session against the live lockfile
- `components/ui/button.tsx`, `components/cart/CartItemCard.tsx`, `components/HeaderClient.tsx`, `lib/hooks/useWebVitals.ts`, `app/api/analytics/vitals/route.ts`, `app/layout.tsx`, `components/ProductCard.tsx`, `components/checkout/ShippingForm.tsx`, `app/globals.css` — file:line evidence for the mobile-improvements checklist

### Secondary (MEDIUM confidence)
- None — this phase required no external/library documentation lookup; all facts are in-repo.

### Tertiary (LOW confidence)
- A2 (o07-gift-cards-plan.md README wording) and the CI-gates six-vs-nine-item reconciliation (A1) — both logged in Assumptions Log, both low-risk wording choices rather than factual claims.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no packages installed this phase
- Architecture (doc structure, ER diagram gap): HIGH — every claim traced to a specific file:line read this session
- Pitfalls: HIGH — both pitfalls (sharp resolution, grep/find hook interception) were reproduced and falsified live in this session

**Research date:** 2026-09-02
**Valid until:** Facts are pinned to the current commit's `package.json`/lockfile state and current `docs/` content; re-verify any `npm audit` numbers if `package-lock.json` changes before execution (30-day validity is not the binding constraint here — lockfile drift is).
