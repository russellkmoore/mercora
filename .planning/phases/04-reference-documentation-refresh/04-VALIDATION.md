---
phase: "4"
slug: "reference-documentation-refresh"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-02"
validated: "2026-09-03"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (three configs: unit, Workers, observability); this phase's own gates are grep/count checks on doc content |
| **Config file** | `vitest.config.mts`, `vitest.workers.config.mts`, `vitest.observability.config.mts` |
| **Quick run command** | the per-requirement grep gate(s) listed below for the task's requirement |
| **Full suite command** | `npm audit --omit=dev --audit-level=high && npm test` |
| **Estimated runtime** | ~90 seconds |

### Shell caveats (carried from Phase 3 and confirmed in Phase 4 research)

- Bare `grep` and `find` are intercepted by a shell hook and return wrong counts or garbled multi-file output. Use `/usr/bin/grep` and `/usr/bin/find` in every gate.
- `diff` is shadowed by a shell function; never use `diff <(...) <(...)`. Use count and string-comparison gates.
- `npx vitest` inside a `bash -c` string gets rewritten; use `./node_modules/.bin/vitest run <files>`.

---

## Sampling Rate

- **After every task commit:** Run the grep/count gate(s) for the requirement(s) the task touched
- **After every plan wave:** Run every gate in the map below in one pass, then `npm audit --omit=dev --audit-level=high`, then `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | REF-01 | — | N/A | grep | `test "$(/usr/bin/grep -ri 'llama' docs/ \| /usr/bin/grep -c .)" = "0"` | ✅ | ✅ green |
| 4-01-02 | 01 | 1 | REF-01 | — | N/A | grep | `test "$(/usr/bin/grep -c '19 MCP tools\|with 19 tools' docs/CLAUDE.md docs/ROADMAP.md \| /usr/bin/grep -vc ':0$')" = "2"` | ✅ | ✅ green |
| 4-02-01 | 02 | 1 | REF-02 | — | N/A | grep | `test "$(/usr/bin/grep -c 'No formal testing framework' docs/CLAUDE.md)" = "0" && test "$(/usr/bin/grep -r 'API_STRUCTURE' docs/ \| /usr/bin/grep -c .)" = "0" && test "$(/usr/bin/grep -c 'mock implementation' docs/api-architecture.md)" = "0"` | ✅ | ✅ green |
| 4-02-02 | 02 | 1 | REF-03 | — | N/A | shell | `test "$(for f in docs/*.md; do /usr/bin/grep -l "$(basename "$f")" docs/README.md; done \| /usr/bin/grep -c .)" = "$(/bin/ls docs/*.md \| /usr/bin/wc -l \| tr -d ' ')" && test "$(/usr/bin/grep -c 'under development' docs/README.md)" = "0" && test "$(/usr/bin/grep -c 'Last Updated.*2026' docs/README.md)" = "1"` | ✅ | ✅ green |
| 4-02-03 | 02 | 1 | REF-04 | — | N/A | grep | `test "$(/usr/bin/grep -l 'Status: Historical' docs/admin-dashboard-specification.md docs/architecture.md docs/mobile-ux-assessment.md docs/mobile-testing-automation.md \| /usr/bin/wc -l \| tr -d ' ')" = "4" && test "$(sed -n '419,444p' docs/mobile-improvements-actionable.md \| /usr/bin/grep -c '\[x\]')" = "12"` | ✅ | ✅ green |
| 4-03-01 | 03 | 1 | DEP-01 | T-04-xx | Supply-chain gate tightened, not weakened | shell | `test "$(/usr/bin/grep -c 'audit-level=high' .github/workflows/ci.yml)" = "1" && npm audit --omit=dev --audit-level=high` | ✅ | ✅ green |
| 4-03-02 | 03 | 1 | DEP-01 | — | N/A | grep | `test "$(/usr/bin/grep -c 'Next review:\*\* 2026-12-01' docs/dependency-security.md)" = "1"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Task IDs above are the seed's expectation; the planner assigns the real plan/task split and the executor records the final commands here.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No application code under test changes; the phase's verification is the gate table above.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 13 tasks across the 5 plans carry runnable `<automated>` commands with `<fails_when>` siblings (61 commands, both probes clean)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — no MISSING sentinels; no Wave 0 needed
- [x] No watch-mode flags — no vitest invocation in this phase's gates; `npm test` is one-shot
- [x] Feedback latency < 90s — grep gates are instant; the audit command takes seconds
- [x] `nyquist_compliant: true` set in frontmatter — set by the validate-phase audit on 2026-09-03

**Approval:** approved 2026-09-03

## Validation Audit 2026-09-03

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

State A audit by the orchestrator after phase completion. Every gate in the Per-Task Verification Map was re-run against the completed tree and passed: no "llama" at any casing anywhere in `docs/`; the 19-tool count in `docs/CLAUDE.md` (two sites) and `docs/ROADMAP.md`; no "No formal testing framework", no `API_STRUCTURE` reference, no "mock implementation"; README links 27/27 files with no "under development" line and a 2026 Last Updated; four `Status: Historical` banners and 12 ticked checklist items; `audit-level=high` in `ci.yml`, next review 2026-12-01, and `npm audit --omit=dev --audit-level=high` exit 0. Post-merge gates during execution: `npm run build` clean, `npm test` 242 files / 1868 tests green, regression run of 13 prior-phase test files green. Code review reached `clean` after two one-line mermaid fixes in `docs/api-architecture.md`. No manual-only items; no auditor spawned.
