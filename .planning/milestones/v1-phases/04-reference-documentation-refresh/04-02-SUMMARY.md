---
phase: 04-reference-documentation-refresh
plan: 02
subsystem: docs
tags: [documentation, ai-model-config, mcp, testing, ci, dependencies]

requires:
  - phase: 04-reference-documentation-refresh
    provides: "plan 04-01's re-counted MCP tool-arm figure (19) and model-id reference, which this plan's docs/CLAUDE.md must agree with"
provides:
  - "docs/CLAUDE.md and docs/api-architecture.md name the current text model @cf/openai/gpt-oss-20b at all sites"
  - "docs/CLAUDE.md states 19 MCP tools in both places and enumerates all 19 tool names with a citation of app/api/mcp/route.ts"
  - "docs/CLAUDE.md's Testing section describes the three real vitest suites and the six CI gates in ci.yml order"
  - "docs/CLAUDE.md's Key Dependencies block lists names only, pointing to package.json for versions"
  - "No file under docs/ references the nonexistent API_STRUCTURE.md; both former reference sites point at docs/api-architecture.md"
  - "docs/api-architecture.md's PaymentProcessing note describes the real Stripe PaymentIntent flow, citing docs/checkout-trust-boundary.md"
affects: [04-03, 04-04, 04-05]

actuals:
  tokens: 1758
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Tracer-first cross-cutting file: docs/api-architecture.md carried both a REF-01 (model name) and REF-02 (payment note) edit through the full read-source -> edit -> gate -> commit cycle before the larger docs/CLAUDE.md tasks expanded on the same pattern"
    - "Source-verify-before-write: re-read lib/ai/config.ts, re-counted app/api/mcp/route.ts case arms, and read package.json/.github/workflows/ci.yml in-session before writing any doc claim; matched plan 04-01's independently measured 19-tool count"

key-files:
  created: []
  modified:
    - docs/api-architecture.md
    - docs/CLAUDE.md
    - docs/STRIPE_INTEGRATION.md

key-decisions:
  - "Used the readable form 'gpt-oss-20b (`@cf/openai/gpt-oss-20b`)' on docs/CLAUDE.md's two admin-analytics prose bullets (lines 158, 172) per D-01, and the bare backticked id on the dense stack bullet (line 33) and the plain-text arrow diagram (line 357, no backticks so the fence stays plain text)"
  - "Named the CI audit step by its step name ('Audit production dependencies') only, with no --audit-level value quoted, since plan 04-05 changes that value in the same phase with no ordering guarantee"
  - "Placed create_payment_intent before place_order in Order Processing (call order) and rotate_agent_key last in Agent Administration (after update_agent_status), matching the existing bullet shape"

patterns-established:
  - "Cite the authoritative source file once per document rather than per claim (single app/api/mcp/route.ts citation covers the full 19-tool enumeration)"

requirements-completed: [REF-01, REF-02]

coverage:
  - id: D1
    description: "docs/api-architecture.md names the current model in its AI sequence diagram and describes the real Stripe PaymentIntent flow in its PaymentProcessing note, citing docs/checkout-trust-boundary.md"
    requirement: "REF-01"
    verification:
      - kind: other
        ref: "grep -c 'gpt-oss-20b' docs/api-architecture.md == 1; grep -ic 'llama' == 0; grep -c 'mock implementation' == 0; grep -c 'checkout-trust-boundary' == 1; git diff --name-only HEAD~1 HEAD count == 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/CLAUDE.md names the current model at all five sites and states 19 MCP tools in both places, enumerating all 19 tool names with one citation of app/api/mcp/route.ts"
    requirement: "REF-01"
    verification:
      - kind: other
        ref: "grep -c 'case ''' app/api/mcp/route.ts == 19 (re-counted, matches 04-01); grep -c 'gpt-oss-20b' docs/CLAUDE.md == 5; grep -ic 'llama' == 0; grep -c '(19 total)' == 1; grep -c '19 MCP tools' == 1; grep -cE stale-count-regex == 0; all-19-name loop == ALL19_PRESENT; grep -c 'app/api/mcp/route.ts' == 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/CLAUDE.md's Testing section names the three real vitest suites with config files and npm scripts, and the six CI gates in ci.yml file order; the 'no testing framework' claim is gone. Key Dependencies lists names only and points to package.json. No file under docs/ references the nonexistent API_STRUCTURE.md."
    requirement: "REF-02"
    verification:
      - kind: other
        ref: "grep -c 'No formal testing' docs/CLAUDE.md == 0; 8-string grep -F loop == TESTING_SECTION_OK; pinned-version regex == 0; grep -c 'package.json' == 1; grep -rl 'API_STRUCTURE' docs/ == 0 files; grep -c 'api-architecture.md' docs/STRIPE_INTEGRATION.md == 1; deferred-sections diff regex == 0"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-03
status: complete
---

# Phase 4 Plan 2: docs/CLAUDE.md and Neighbours Reference Refresh Summary

Corrected the primary contributor-reference file (`docs/CLAUDE.md`) and its two neighbours to match the running code: the current text model at all sites, the real 19-tool MCP list (was 17, missing `create_payment_intent` and `rotate_agent_key`), a truthful three-suite/six-gate Testing section replacing the "no testing framework" claim, an unpinned dependency list, and two repointed references to a documentation file that does not exist.

## Performance

- **Duration:** 15 min (estimated)
- **Completed:** 2026-09-03T00:45:31Z
- **Tasks:** 3 completed
- **Files modified:** 3

## Accomplishments
- `docs/api-architecture.md` (tracer task): sequence diagram names `@cf/openai/gpt-oss-20b`; the `note right of PaymentProcessing` block now states Mercora creates the PaymentIntent and the finalizer retrieves it server-side before finalizing, citing `docs/checkout-trust-boundary.md`, replacing the "mock implementation" claim
- `docs/CLAUDE.md` model mentions corrected at all five sites (stack bullet, two admin-analytics bullets, AI-pipeline arrow diagram, plus the already-correct Language Model bullet); MCP tool count corrected to 19 in both places (`#### MCP Tools (19 total)` heading and the `✅ Complete Tool Set: 19 MCP tools` feature line), with `create_payment_intent` and `rotate_agent_key` added to the enumerated list and a single citation of `app/api/mcp/route.ts` added as the authoritative source
- `docs/CLAUDE.md`'s Testing section rewritten to name the three real vitest suites (`vitest.config.mts`/`npm test`, `vitest.workers.config.mts`/`npm run test:workers`, `vitest.observability.config.mts`/`npm run test:observability-worker`) and the six non-test CI gates in `.github/workflows/ci.yml` file order (Audit production dependencies, Check migration safety, Lint, Typecheck, Check Cloudflare binding types, Build), replacing "No formal testing framework currently configured"
- `docs/CLAUDE.md`'s Key Dependencies block now lists the eight dependency names with no pinned versions, pointing to `package.json`
- Both stale references to the nonexistent `docs/API_STRUCTURE.md` (in `docs/CLAUDE.md`'s "Important Files to Reference" and `docs/STRIPE_INTEGRATION.md`'s documentation tree) repointed to `docs/api-architecture.md`, which exists

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end correction of docs/api-architecture.md (tracer)** - `560a799` (docs)
2. **Task 2: docs/CLAUDE.md model mentions, tool count, and tool list** - `7be1979` (docs)
3. **Task 3: docs/CLAUDE.md Testing section, Key Dependencies, stale doc references** - `3e18f24` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified
- `docs/api-architecture.md` - AI sequence diagram names the current model; PaymentProcessing note describes the real Stripe path, citing `docs/checkout-trust-boundary.md`
- `docs/CLAUDE.md` - Model name at five sites, 19-tool MCP count with full enumerated list and source citation, real Testing section (three vitest suites + six CI gates), unpinned Key Dependencies, repointed stale doc reference
- `docs/STRIPE_INTEGRATION.md` - Documentation tree entry repointed from `API_STRUCTURE.md` to `api-architecture.md`

## Reference measurements (for verification against plan 04-01)

- **MCP tool-arm count**, re-counted this session via `/usr/bin/grep -c "case '" app/api/mcp/route.ts` = **19**. Matches plan 04-01's independently measured figure.
- **Six CI step names copied verbatim from `.github/workflows/ci.yml`**, in file order: Audit production dependencies, Check migration safety, Lint, Typecheck, Check Cloudflare binding types, Build. (Checkout repository, Set up Node.js, and Install dependencies precede these; the three Test steps run between Check Cloudflare binding types and Build — noted in the new Testing section, not listed among the six gates since they are the suites, not gates.)
- **Descriptions written for the two added tool bullets**, derived from their handler imports in `app/api/mcp/route.ts`:
  - `create_payment_intent` — "Create a Stripe payment intent for an agent's order" (dispatches to `createAgentPaymentIntent` in `lib/mcp/tools/payment.ts`)
  - `rotate_agent_key` — "Rotate an agent's API key credential" (dispatches to `rotateAgentCredential` in `lib/mcp/tools/agent.ts`)

## Decisions Made
- Used the readable "gpt-oss-20b (`@cf/openai/gpt-oss-20b`)" form on the two admin-analytics prose bullets per D-01's guidance for prose sites, versus the bare backticked id on the dense stack bullet and the plain-text arrow diagram node (no backticks, to keep the fence plain text).
- Named the CI audit step by step name only ("Audit production dependencies"), deliberately omitting its `--audit-level` value since plan 04-05 changes that value in the same phase with no commit-order guarantee between the two plans.
- Placed the two new tool bullets in call-order-consistent positions: `create_payment_intent` before `place_order` in Order Processing, `rotate_agent_key` last in Agent Administration.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
Ready for plans 04-03 (README index groups) and 04-04 (historical doc banners), which own disjoint file sets. The phase-level repo-wide model-name sweep gate and the `/gsd-verify-work` roll-up can now include `docs/CLAUDE.md`, `docs/api-architecture.md`, and `docs/STRIPE_INTEGRATION.md` as corrected. `docs/dependency-security.md` and `.github/workflows/ci.yml` remain untouched, owned by plan 04-05.

---
*Phase: 04-reference-documentation-refresh*
*Completed: 2026-09-03*

## Self-Check: PASSED

All three modified files (`docs/api-architecture.md`, `docs/CLAUDE.md`, `docs/STRIPE_INTEGRATION.md`) and all three task commits (560a799, 7be1979, 3e18f24) verified present on disk / in git log. All plan-level `<verification>` and per-task `<acceptance_criteria>` commands re-run and passed.
