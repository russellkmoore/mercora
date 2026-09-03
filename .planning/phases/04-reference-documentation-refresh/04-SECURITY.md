---
phase: "4"
slug: "reference-documentation-refresh"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-03"
---

# Phase 4 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Repository docs → future reader (human or AI contributor) | Reference docs are read as the description of the current system; a false claim becomes trusted input | Model id, tool names and count, test/CI description, index links, status banners |
| Repository → CI (`.github/workflows/ci.yml`) | The audit step decides which dependency advisories block a merge | Severity threshold and `--omit=dev` scope |
| Public npm registry → `npm audit` | Advisory data consumed to produce the dependency baseline | Package paths, advisory ids, severities |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Information Disclosure | `docs/DEPLOYMENT_SETUP.md`, `docs/ai-pipeline.md`, `docs/ROADMAP.md` | low | mitigate | Only a model id, a tool count, and a mermaid node id changed; Phase 1 placeholder convention untouched. Verified: code review found no credential values in the 14-file scope | closed |
| T-04-02 | Tampering | claims written into `docs/` (plan 01) | medium | mitigate | Facts copied in-session from `lib/ai/config.ts:29` and `app/api/mcp/route.ts:193`; gates re-count the source. Verified: repo-wide `grep -ri llama docs/` empty; 19 case arms in the route match the documented count | closed |
| T-04-03 | Information Disclosure | `docs/CLAUDE.md` | low | mitigate | `<ADMIN_VECTORIZE_TOKEN>` placeholders untouched; diff bounded to the edited sections. Verified by code review and the Phase 1 credential scan | closed |
| T-04-04 | Tampering | Testing / CI description in `docs/CLAUDE.md` | medium | mitigate | Suite, config, script, and CI step names copied from `package.json` and `ci.yml`; `grep -F` loop fails on paraphrase; audit step named without its `--audit-level` value so plan 05's change cannot falsify it. Verified: code review parsed the YAML step list and matched | closed |
| T-04-05 | Tampering | MCP tool list in `docs/CLAUDE.md` | medium | mitigate | Count re-derived from the route; 19-name presence loop; the two missing tools (`create_payment_intent`, `rotate_agent_key`) were added rather than only the number changed. Verified by verifier and code review | closed |
| T-04-06 | Information Disclosure | README index descriptions | low | mitigate | One-line descriptions from each doc's H1 and opening paragraph; only public endpoint named is `/api/mcp` | closed |
| T-04-07 | Tampering | README status lines claiming shipped state | medium | mitigate | Live-endpoint claim confirmed against `app/api/mcp/route.ts`; tool count matches plans 01 and 02's independent derivations | closed |
| T-04-08 | Repudiation | README index completeness | low | mitigate | Every-file-linked gate derives its list from the directory at run time and refuses to run below 27 files. Verified: 27/27 linked | closed |
| T-04-09 | Tampering | ER-diagram banner in `docs/architecture.md` | medium | mitigate | Named table gaps copied from RESEARCH's `lib/db/schema/*.ts` citations; gate greps for three of them. Verified by verifier | closed |
| T-04-10 | Repudiation | ticked checklist items | medium | mitigate | Each ticked item cites a path that must exist on disk; the five manual items held unticked by a fixed-string gate. Verified: 12 ticked, 5 unticked | closed |
| T-04-11 | Information Disclosure | banner sentences and evidence notes | low | mitigate | Repository-relative paths only; no env values or deployment identifiers | closed |
| T-04-12 | Tampering | supply chain via the CI audit gate | medium | mitigate | Gate tightened from `critical` to `high`; proven locally (exit 0, 0 findings) before the edit; `--omit=dev` asserted still present. Verified: `ci.yml:33` reads `npm audit --omit=dev --audit-level=high`; orchestrator and verifier each re-ran the command with exit 0 | closed |
| T-04-13 | Repudiation | closed exception entries | medium | mitigate | Each closure carries a dated marker and observed version evidence (Sharp 0.35.3 hoisted, PostCSS 8.5.23 nested / 8.5.26 top-level) satisfying that entry's exit condition. Verified by code review against `node_modules` | closed |
| T-04-14 | Information Disclosure | refreshed dev-only findings | low | mitigate | Package paths and advisory ids only (public registry data). Verified: five moderate dev-only findings listed match a fresh full-tree audit | closed |
| T-04-15 | Denial of Service | CI availability after the gate raise | low | accept | A future high-severity production advisory now blocks merges, which is the gate's purpose; reverting one line restores the old threshold if ever needed | closed (accepted) |
| T-04-SC (×5) | Tampering | npm / pip / cargo installs | low | accept | No plan installs a package; `package.json` and `package-lock.json` unchanged in this phase | closed (accepted) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-15 | Blocking merges on high-severity production advisories is the intended behavior of the raised gate; the doc's own rule called for it once the exceptions closed | Planner (per CONTEXT.md DEP-01 Q2, accepted by Russell in discuss) | 2026-09-03 |
| AR-04-02 | T-04-SC | No packages installed in any plan | Planner | 2026-09-03 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-03 | 16 | 16 | 0 | Orchestrator (secure-phase, State B, L1 short-circuit: no threat at or above `high`, register authored at plan time, ASVS 1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-03
