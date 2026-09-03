---
phase: 04-reference-documentation-refresh
reviewed: 2026-09-03T01:07:18Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - .github/workflows/ci.yml
  - docs/CLAUDE.md
  - docs/DEPLOYMENT_SETUP.md
  - docs/README.md
  - docs/ROADMAP.md
  - docs/STRIPE_INTEGRATION.md
  - docs/admin-dashboard-specification.md
  - docs/ai-pipeline.md
  - docs/api-architecture.md
  - docs/architecture.md
  - docs/dependency-security.md
  - docs/mobile-improvements-actionable.md
  - docs/mobile-testing-automation.md
  - docs/mobile-ux-assessment.md
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-09-03T01:07:18Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

This phase is a documentation-correctness refresh plus a one-line CI severity-gate
change. Every factual claim in the diff was independently re-derived from the
codebase rather than taken on trust:

- **Model id** — `@cf/openai/gpt-oss-20b` in `docs/CLAUDE.md`, `docs/ROADMAP.md`,
  `docs/DEPLOYMENT_SETUP.md`, `docs/README.md`, `docs/architecture.md`, and
  `docs/ai-pipeline.md` matches `lib/ai/config.ts:29` exactly. Grepped the whole
  `docs/` tree for leftover `Llama` references — none remain.
- **MCP tool count/names** — counted the `switch (tool)` cases in
  `app/api/mcp/route.ts`: exactly 19, and every name (`search_products` …
  `rotate_agent_key`) matches the lists in `docs/CLAUDE.md`. Grepped for
  leftover "17 tool(s)" references — none remain.
- **Testing/CI section** — `docs/CLAUDE.md`'s Testing section (three vitest
  configs, gate order) was checked against `package.json` scripts and the
  parsed step list of `.github/workflows/ci.yml`; both match exactly, including
  the claim that the three test steps run between "Check Cloudflare binding
  types" and "Build".
- **README index (27 files)** — `find docs -maxdepth 1 -name '*.md'` returns
  exactly 27 files, and every one of the 26 non-README files is linked from
  `docs/README.md`'s navigation map with no dead or missing links.
- **Dependency baseline** — ran a fresh `npm audit --omit=dev --json`: 0
  vulnerabilities at every severity, matching the doc's claim. Ran the
  full-tree `npm audit --json`: exactly 5 moderate findings across
  `esbuild`, `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`,
  `drizzle-kit`, and `qs` — matching the doc's dev-only findings list
  package-for-package. Verified `node_modules` directly: `next@16.3.1`,
  top-level `postcss@8.5.26`, nested `next/node_modules/postcss@8.5.23`,
  `sharp@0.35.3` hoisted to top-level `node_modules/sharp` (confirmed via
  `require.resolve('sharp')`), Node `24.18.1`, npm `11.16.0` — all match the
  doc's stated evidence for closing both prior exceptions.
- **CI YAML** — the diff is a single line (`--audit-level=critical` →
  `--audit-level=high`); parsed the workflow with a YAML loader to confirm it
  is still valid, and `--omit=dev` is preserved.
- **Historical banners / ADR claims** — spot-checked `docs/README.md`'s new
  claim that "All four [ADRs] carry a dated Accepted status and are locked in
  `gsd-ingest-manifest.yaml`" against that manifest: four `type: ADR` entries,
  all `locked: true`. Historical banners on `mobile-ux-assessment.md`,
  `mobile-testing-automation.md`, and `admin-dashboard-specification.md` read
  accurately against their content.
- **Mermaid diagrams (rename)** — traced the `LlamaModel` → `TextModel` and
  `LLM[...]` label rename through `docs/ai-pipeline.md` and
  `docs/architecture.md` node-by-node (declaration, arrows, `class` assignment
  lines). Both are fully consistent — no dangling node ids were introduced by
  the rename in either file.

One pre-existing defect was found while doing the file-scoped mermaid check
described above, in a file that is in this review's scope even though this
specific diagram section wasn't touched by this phase's diff (see below).

## Warnings

### WR-01: Dangling mermaid node references in the "Unified API Structure Overview" diagram

**File:** `docs/api-architecture.md:59-60,67-68,91`
**Issue:** The graph subgraph "Unified API Layer" declares a single
consolidated node for the vectorize endpoint:

```
Vectorize[🔍 /api/admin/vectorize]
```

but the flow and class-assignment lines still reference two node ids that are
never declared anywhere in this diagram block:

```
Admin --> VectorizeProducts
Admin --> VectorizeKnowledge
...
VectorizeProducts --> VectorService
VectorizeKnowledge --> VectorService
...
class AgentChat,Orders,PaymentIntent,Tax,Products,Categories,ShippingOptions,VectorizeProducts,VectorizeKnowledge,StripeWebhooks api
```

Mermaid will silently auto-create two extra, unstyled boxes literally labeled
`VectorizeProducts` and `VectorizeKnowledge` instead of connecting to the
already-declared, correctly-labeled `Vectorize` node. This is a leftover from
before the products/knowledge vectorize endpoints were consolidated into the
single `/api/admin/vectorize` endpoint (confirmed current: `docs/CLAUDE.md`
and `docs/api-architecture.md`'s own endpoint list both describe only the
consolidated endpoint). This diagram is not part of this phase's diff, but the
file is in this review's scope, `docs/api-architecture.md` is typed `SPEC`
(binding contract) in `gsd-ingest-manifest.yaml`, and this phase's stated
charter explicitly includes checking these diagrams for dangling node ids
after the rename — this is exactly that class of defect, just found in the
sibling diagram file rather than the two named in the task brief.

**Fix:** Replace the two dangling references with the already-declared
`Vectorize` node, and drop the two ids from the `class` line:

```
Admin --> Vectorize
...
Vectorize --> VectorService
...
class AgentChat,Orders,PaymentIntent,Tax,Products,Categories,ShippingOptions,StripeWebhooks api
```

---

_Reviewed: 2026-09-03T01:07:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
