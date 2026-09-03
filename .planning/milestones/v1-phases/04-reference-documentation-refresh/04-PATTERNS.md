# Phase 4: Reference Documentation Refresh - Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 15 (13 docs + 1 CI workflow + 1 source-of-truth pair)
**Analogs found:** 15 / 15 (all in-repo; this is a docs-only phase, so "analog" means the closest existing doc-editing precedent, not a code pattern)

This phase edits Markdown prose and one YAML line. There are no controllers/services/components. Roles below are repurposed for doc-editing: **prose-edit** (find/replace factual claims), **index-edit** (README structural additions), **status-banner** (blockquote insertion), **checklist-edit** (checkbox + evidence note), **structured-record** (repeatable entry blocks, e.g. dependency exceptions), **config-line** (single CI YAML value).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `docs/DEPLOYMENT_SETUP.md` (model name, 1 line) | prose-edit | transform (string replace) | Phase 3 `docs/checkout-trust-boundary.md` grep-verified prose edit | role-match |
| `docs/architecture.md` (model name x2 + mermaid labels + historical banner) | prose-edit + status-banner | transform | same file's own existing prose (self-analog) + Phase 3 banner pattern | exact (banner), role-match (mermaid) |
| `docs/api-architecture.md` (model name, mock-implementation note) | prose-edit | transform | Phase 3 checkout-trust-boundary edit (claim replaced, cited against source doc) | role-match |
| `docs/README.md` (model name, index groups, status lines, Last Updated) | index-edit + prose-edit | transform / CRUD (add link rows) | `docs/README.md` itself — existing grouped `### emoji **Group**` + bullet-link shape (lines 14-27) | exact (self-analog) |
| `docs/ROADMAP.md` (model name, tool count) | prose-edit | transform | Phase 3 count-based grep-gate edits | role-match |
| `docs/ai-pipeline.md` (model name + mermaid node id rename) | prose-edit | transform | `docs/architecture.md` mermaid conventions (same repo, same diagram style) | role-match |
| `docs/CLAUDE.md` (model name x4, tool count, Testing section, Key Dependencies, API_STRUCTURE bullet) | prose-edit + structured-record (Testing section rewrite) | transform | Phase 3 `03-01-PLAN.md` verified-claim-before-write pattern; `docs/dependency-security.md` structured-section shape for Testing rewrite | role-match |
| `docs/STRIPE_INTEGRATION.md` (API_STRUCTURE tree entry) | prose-edit | transform | same-class edit as CLAUDE.md's API_STRUCTURE bullet | role-match |
| `docs/admin-dashboard-specification.md` (historical banner) | status-banner | transform | Phase 3 ADR `**Status:** Accepted (date)` marker position (line 3, own block) — this phase uses the blockquote variant instead | role-match |
| `docs/mobile-ux-assessment.md` (historical banner) | status-banner | transform | same Phase 3 status-marker precedent | role-match |
| `docs/mobile-testing-automation.md` (historical banner) | status-banner | transform | same Phase 3 status-marker precedent | role-match |
| `docs/mobile-improvements-actionable.md` (checklist ticks + evidence notes) | checklist-edit | transform (12 of 17 checkboxes + inline citation) | no direct Phase 3 analog; closest is Phase 3's citation-per-claim discipine (grep the fact before writing it) | partial |
| `docs/dependency-security.md` (close 2 exceptions, add "Closed exceptions" section, refresh status header + dev findings) | structured-record | transform + append | the file's own existing "Time-bounded production exceptions" entry shape (self-analog) | exact (self-analog) |
| `.github/workflows/ci.yml` (`--audit-level=critical` → `--audit-level=high`, line ~33) | config-line | transform | file's own existing line (self-analog); `docs/dependency-security.md` already contains this exact target string as a forward-looking code block (line 125) | exact |

## Pattern Assignments

### `docs/README.md` (index-edit, transform)

**Analog:** itself — `docs/README.md:14-27`

**Existing group shape to copy** (verbatim):
```markdown
### 🏗️ **Technical Architecture**
- **[System Architecture](architecture.md)** - Complete system design with Mermaid diagrams
- **[API Architecture](api-architecture.md)** - RESTful API specifications and flows
- **[Order and Checkout Trust Boundary](checkout-trust-boundary.md)** - Server-owned pricing, pending orders, and verified finalization
- **[AI Processing Pipeline](ai-pipeline.md)** - Deep dive into AI workflows and anti-hallucination
- **[Development Context](CLAUDE.md)** - Essential context for developers and AI assistants
```
New groups ("Binding decisions (ADRs)", "Operations and runbooks", "Specs and contracts", "Assessments, baselines, and proposals") each follow this exact `### emoji **Group Name**` + `- **[Title](file.md)** - one-line description` shape. Pick an emoji consistent with the existing set (🚀, 🏗️, 💼) — none are reused.

**Status-line locations to edit** (verbatim, current text):
```
docs/README.md:37:- 🚧 **MCP Server**: Under development for agentic commerce
docs/README.md:42:- **AI**: Cloudflare AI (Llama 3.1 8B + BGE embeddings)
docs/README.md:66:- Review [mcp-server-specification.md] for future AI features
docs/README.md:79:**Last Updated**: September 1, 2025
```
Replace line 37 with a present-tense "MCP Server: live at `/api/mcp` with 19 tools" bullet in the same `- ✅ **Label**: text` shape as its neighbors (lines 32-36). Replace line 42's model name per REF-01. Reword line 66 to present tense. Replace line 79's date with the edit date.

**Acceptance gate pattern (from RESEARCH.md, Phase-3-style count gate):**
```bash
test "$(for f in docs/*.md; do /usr/bin/grep -l "$(basename $f)" docs/README.md; done | /usr/bin/grep -c .)" = "$(ls docs/*.md | wc -l)"
```

---

### `docs/architecture.md`, `docs/mobile-ux-assessment.md`, `docs/mobile-testing-automation.md`, `docs/admin-dashboard-specification.md` (status-banner, transform)

**Analog:** Phase 3's ADR status-marker convention (`docs/checkout-trust-boundary.md:3`, `docs/database-migrations.md:3`, `docs/subscriptions.md:3`, `docs/webhooks-refunds-inventory.md:3`) — same *position* convention (directly under the heading, on its own line, blank lines around it), different *shape* (blockquote, not bold-only):

```markdown
# Order and Checkout Trust Boundary

**Status:** Accepted (2026-08-05)
```

**This phase's shape (locked in CONTEXT.md), apply verbatim structure with per-file sentence:**
```markdown
> **Status: Historical (September 2025).** [One sentence: what is true now, and where to look.]
```

For `docs/architecture.md` specifically, the banner goes under `## Database Schema Overview` (not the H1), because only that section is historical:
```markdown
## Database Schema Overview

> **Status: Historical (September 2025).** This diagram predates the variant model (`product_variants`) and the order ledger tables (`order_effects`, `order_events`, `order_webhooks`); the current schema also includes gift cards, subscriptions, CMS/blog, promotions, and admin-user tables not shown here. The diagrammed `CHAT_SESSIONS` entity has no corresponding table in the current schema.

```mermaid
erDiagram
    ...
```
```

**Phase 3 acceptance-gate pattern to reuse (tolerant regex, count-based, per-file `sed -n` extraction):**
```bash
test "$(grep -lE '^\*\*Status:\*\* Accepted \(20[0-9]{2}-[0-9]{2}-[0-9]{2}\)$' <files> | wc -l | tr -d ' ')" = "4"
```
Adapt for this phase's blockquote shape:
```bash
/usr/bin/grep -c "Status: Historical" docs/admin-dashboard-specification.md docs/architecture.md docs/mobile-ux-assessment.md docs/mobile-testing-automation.md
# expect: 1 each, 4 files
```

---

### `docs/CLAUDE.md` Testing section (structured-record, transform)

**Analog:** `docs/dependency-security.md`'s existing structured-entry shape (Owners/Advisories/Package path/Why/Exposure/Compensating controls/Exit condition per exception) — same discipline of "one bullet per fact, sourced verbatim from a named file," applied to test suites instead of exceptions.

**Source facts to copy verbatim (already verified in RESEARCH.md, do not re-derive):**
```json
// package.json:16-19
"test": "vitest run",
"test:workers": "vitest run --config vitest.workers.config.mts",
"test:observability-worker": "vitest run --config vitest.observability.config.mts",
"test:watch": "vitest",
```
```yaml
# .github/workflows/ci.yml step names/order (32-58)
Audit production dependencies → Check migration safety → Lint → Typecheck →
Check Cloudflare binding types → Test → Test Workers integration →
Test observability Durable Object → Build
```
**Shape to produce (per CONTEXT.md):** three bullets (suite name, config file, npm script) then one ordered list of the six non-test CI gates in file order (audit, migration safety, lint, typecheck, cf-typecheck, build), with prose noting the three test steps run between cf-typecheck and build in the real pipeline.

**Sentence to delete:** `docs/CLAUDE.md` current text `**Status**: No formal testing framework currently configured.`

---

### `docs/CLAUDE.md` Key Dependencies (prose-edit, transform)

**Current block to replace** (`docs/CLAUDE.md` Key Dependencies, ~lines 37-50 per CONTEXT.md; observed content):
```json
{
  "next": "15.3.5",
  "react": "^19.0.0",
  "drizzle-orm": "^0.35.2",
  "@clerk/nextjs": "^6.25.5",
  "@opennextjs/cloudflare": "^1.5.1",
  "zustand": "^5.0.6",
  "@stripe/stripe-js": "^7.8.0",
  "stripe": "^18.4.0"
}
```
Replace with dependency names only, one line appended: "versions live in `package.json`." No pinned version strings remain — the acceptance gate is `/usr/bin/grep -n '"\^' docs/CLAUDE.md` returning empty within that section.

---

### `docs/api-architecture.md` mock-implementation note (prose-edit, transform)

**Current text** (`docs/api-architecture.md:433-436`, inside a mermaid `note right of PaymentProcessing` block):
```
    note right of PaymentProcessing
        Stripe integration
        (mock implementation)
    end note
```
**Analog for the replacement claim:** `docs/checkout-trust-boundary.md:16-22` — states PaymentIntent creation and server-side retrieval for finalization are real Stripe API calls, not mocked. Replace "(mock implementation)" with real-implementation language citing `docs/checkout-trust-boundary.md`, following the same "grep the fact before writing it" discipline Phase 3 used (`03-01-PLAN.md:120-121`).

---

### `docs/mobile-improvements-actionable.md` checklist (checklist-edit, transform)

**Analog:** no direct precedent in-repo for checkbox+evidence notes; closest structural analog is the file-and-line citation style already used throughout RESEARCH.md itself and Phase 3's `03-01-PLAN.md:185` (`for s in '...' '...'; do grep -qF "$s" file || exit 1; done` — one verifiable string per claim).

**Exact 12 items to tick with their evidence** (file:line pairs verified in RESEARCH.md `## REF-04 Verified Facts`, copy directly — do not re-derive):
```
Line 422 → components/ui/button.tsx:74-78
Line 423 → components/cart/CartItemCard.tsx:39,50
Line 424 → components/HeaderClient.tsx:429
Line 426 → components/HeaderClient.tsx:192,310
Line 429 → lib/hooks/useWebVitals.ts
Line 430 → app/api/analytics/vitals/route.ts
Line 431 → app/layout.tsx:54,176
Line 435 → components/ProductCard.tsx:125,142,143,146
Line 436 → components/checkout/ShippingForm.tsx:57,67-68,77,86
Line 437 → app/globals.css:132,136
Line 442 → docs/mobile-lighthouse-baseline.md
Line 443 → docs/mobile-lighthouse-baseline.md
```
Format: `- [x] <original item text> — done, see \`<file:line>\`.` Lines 425, 432, 438, 441, 444 stay `- [ ]` (unticked, per locked decision).

**Gate:** `/usr/bin/grep -c '\[x\]' docs/mobile-improvements-actionable.md` (line-range restricted to 419-444) = `12`.

---

### `docs/dependency-security.md` (structured-record, transform + append)

**Analog:** itself — existing exception-entry shape (`docs/dependency-security.md:65-98`), reused for the new "Closed exceptions" subsection:

```markdown
### Next-bundled PostCSS 8.4.31

- **Owners / review deadline:** Russell K. Moore and Devon Hillard; review by
  2026-08-25.
- **Advisories:** `GHSA-6g55-p6wh-862q`, ...
- **Package path:** `next > postcss`
- **Why it remains:** ...
- **Exposure:** ...
- **Compensating controls:** ...
- **Exit condition:** Upgrade to a supported Next 16 release that bundles a
  patched PostCSS, then raise the CI audit gate from `critical` to `high`.
```

New "Closed exceptions" entries keep the same field labels but each closes with `**Closed:** exit condition met 2026-09-02` instead of an open exit condition, and cite the fresh evidence: `npm audit --omit=dev` 0 findings at every severity, Sharp resolves at 0.35.3 (not bundled inside `next`'s own `node_modules`), PostCSS resolves to 8.5.26.

**Status header to refresh** (current, `docs/dependency-security.md:1-6`):
```markdown
# Dependency Security Baseline

**Status:** No critical findings; two owned upstream package exceptions remain
**Baseline date:** 2026-08-11
**Owners:** Russell K. Moore and Devon Hillard
**Next review:** 2026-08-25
```
Update `Status` (exceptions now closed), add re-run date/Node/npm/Next/PostCSS versions and audit totals, and set `Next review: 2026-12-01`.

**Development-only findings section to refresh** (current, `docs/dependency-security.md:100-110`, names `undici` and legacy `esbuild` only): add `qs` (traced via `npm ls qs` to `@opennextjs/cloudflare → @opennextjs/aws → express → qs`, both `esbuild` and `qs` chains are devDependencies), following the existing bullet-list-with-source-chain shape.

**Enforcement section's existing forward-looking block becomes real** (`docs/dependency-security.md:112-126`):
```markdown
CI runs `npm audit --omit=dev --audit-level=critical`, preventing a return of
critical production findings while the two documented high-severity exceptions
remain. ...
```
```bash
npm audit --omit=dev --audit-level=high
```
Update the prose to describe the gate as already raised (past tense / current state), since the target command block already exists at line 125 — this phase makes it the actual CI behavior, not aspirational text.

---

### `.github/workflows/ci.yml` (config-line, transform)

**Analog:** the file's own current line 32-33:
```yaml
- name: Audit production dependencies
  run: npm audit --omit=dev --audit-level=critical
```
Change `--audit-level=critical` to `--audit-level=high`. This is the only non-Markdown edit in the phase. Run `npm audit --omit=dev --audit-level=high` locally before committing and confirm exit 0 (RESEARCH.md confirms this passes today: "found 0 vulnerabilities").

---

### Model-name and tool-count sweep (prose-edit, transform) — `docs/DEPLOYMENT_SETUP.md`, `docs/architecture.md`, `docs/api-architecture.md`, `docs/README.md`, `docs/ROADMAP.md`, `docs/ai-pipeline.md`, `docs/CLAUDE.md`

**Analog:** Phase 3's count-based grep-gate discipline (`03-01-PLAN.md:170,182,185,242-248` — verify the fact against source before writing, then grep-prove the count post-edit).

**Source of truth to copy verbatim:**
```typescript
// lib/ai/config.ts:25-33
export const TEXT_GENERATION_MODEL = {
  model: "@cf/openai/gpt-oss-20b",
  ...
} as const satisfies AIModelConfig;
```
```typescript
// app/api/mcp/route.ts:193 — 19-name enumeration, copy order exactly
search_products, assess_request, get_recommendations, add_to_cart, update_cart,
remove_from_cart, get_cart, bulk_add_to_cart, clear_cart, create_payment_intent,
place_order, get_order_status, get_shipping_options, validate_payment,
create_agent, list_agents, get_agent_details, update_agent_status, rotate_agent_key
```

**All 14 current "llama" hits to edit** (verbatim from RESEARCH.md, do not re-grep — use this list):
```
docs/DEPLOYMENT_SETUP.md:14
docs/architecture.md:28,103   (label only, id is `LLM` not `Llama` — no id rename needed here)
docs/api-architecture.md:263
docs/README.md:42
docs/ROADMAP.md:55
docs/ai-pipeline.md:41,170,200,201,235   (id `LlamaModel` at 170/200/201/235 — rename id + label together)
docs/CLAUDE.md:33,158,172,357
```

**Mermaid id-rename pattern** (`docs/ai-pipeline.md` only): rename `LlamaModel` → e.g. `TextModel` at all 4 references (170, 200, 201, 235 `class` line) in the same file, in the same commit, so no reference is orphaned.

**Tool-count edit locations** (both say "17" today, target "19"):
```
docs/CLAUDE.md:545:✅ **Complete Tool Set**: 17 MCP tools covering all commerce operations
docs/ROADMAP.md:107:- ✅ **MCP Server Implementation**: ... with 17 tools
```

**Gates:**
```bash
/usr/bin/grep -r "Llama 3.1" docs/          # empty
/usr/bin/grep -ri "llama" docs/             # empty
/usr/bin/grep -c "LlamaModel" docs/ai-pipeline.md   # 0
/usr/bin/grep -c "TextModel" docs/ai-pipeline.md    # 4 (matches pre-edit LlamaModel count)
/usr/bin/grep -n "19 MCP tools\|with 19 tools" docs/CLAUDE.md docs/ROADMAP.md   # 2 hits
```

---

### `docs/CLAUDE.md` / `docs/STRIPE_INTEGRATION.md` API_STRUCTURE references (prose-edit, transform)

**Two sites to edit (exact text):**
```
docs/CLAUDE.md:589:- `docs/API_STRUCTURE.md` - **NEW**: Clean API architecture (eliminates redundancy)
docs/STRIPE_INTEGRATION.md:115:    └── API_STRUCTURE.md          # Clean API architecture
```
Both repoint to `docs/api-architecture.md` (the file that actually exists). No file `docs/API_STRUCTURE.md` exists — confirmed absent.

**Gate:** `/usr/bin/grep -r "API_STRUCTURE" docs/` → empty.

## Shared Patterns

### Grep-before-write discipline
**Source:** Phase 3, `.planning/phases/03-decision-lock-in-and-operator-runbooks/03-01-PLAN.md:120-121,170,185`
**Apply to:** every prose-edit and status-banner file — never paraphrase a fact from memory; read the cited source line (RESEARCH.md already provides most of them verbatim) immediately before writing the doc sentence.

### Count-based acceptance gates, absolute-path grep
**Source:** Phase 3 plans (`03-01-PLAN.md:242-248,304-306`) and RESEARCH.md's `## Validation Architecture` table
**Apply to:** all files — every edit gets a `/usr/bin/grep -c` or `/usr/bin/grep -n` gate with an exact expected count, never a bare `grep`/`find` (the rtk shell hook returns wrong counts — confirmed: bare grep piped to `wc -l` returned 59 vs. correct 19). Never `diff <(...)` — a shell function shadows `diff` in this environment.

### Blockquote-under-heading status marker
**Source:** `docs/checkout-trust-boundary.md:3`, `docs/database-migrations.md:3`, `docs/subscriptions.md:3`, `docs/webhooks-refunds-inventory.md:3` (Phase 3 ADR shape) — this phase's historical banners use the same *position* (directly under the relevant heading, own paragraph, blank lines around) with a blockquote instead of plain bold.
**Apply to:** `docs/admin-dashboard-specification.md`, `docs/architecture.md` (under `## Database Schema Overview`, not H1), `docs/mobile-ux-assessment.md`, `docs/mobile-testing-automation.md`.

### Structured multi-field record entries
**Source:** `docs/dependency-security.md:65-98` (Owners/Advisories/Package path/Why/Exposure/Compensating controls/Exit condition)
**Apply to:** the new "Closed exceptions" subsection in the same file — same field labels, `**Closed:** exit condition met <date>` replacing the open `**Exit condition:**` framing.

### README grouped index shape
**Source:** `docs/README.md:9-27` (`### emoji **Group Name**` + `- **[Title](file.md)** - description` bullets)
**Apply to:** the four new README groups (ADRs, Operations/runbooks, Specs/contracts, Assessments/baselines/proposals) — reuse the exact heading/bullet markup, one new emoji per group, none reused from the existing five groups.

## No Analog Found

None. All 15 files/edits have at least a role-match precedent (either self-analog within the same file, or Phase 3's doc-editing discipline).

## Metadata

**Analog search scope:** `docs/`, `.github/workflows/ci.yml`, `.planning/phases/03-decision-lock-in-and-operator-runbooks/03-01-PLAN.md`, `lib/ai/config.ts`, `app/api/mcp/route.ts`, `package.json`
**Files scanned:** `docs/README.md`, `docs/CLAUDE.md`, `docs/dependency-security.md`, `03-01-PLAN.md` (read in full or targeted this session); remaining facts sourced from `04-RESEARCH.md`'s already-verified file:line citations to avoid redundant re-reads
**Pattern extraction date:** 2026-09-02
