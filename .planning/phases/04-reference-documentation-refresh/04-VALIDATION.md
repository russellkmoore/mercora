---
phase: "4"
slug: "reference-documentation-refresh"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-02"
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
| 4-01-01 | 01 | 1 | REF-01 | — | N/A | grep | `test "$(/usr/bin/grep -ri 'llama' docs/ \| /usr/bin/grep -c .)" = "0"` | ✅ | ⬜ pending |
| 4-01-02 | 01 | 1 | REF-01 | — | N/A | grep | `test "$(/usr/bin/grep -c '19 MCP tools\|with 19 tools' docs/CLAUDE.md docs/ROADMAP.md \| /usr/bin/grep -vc ':0$')" = "2"` | ✅ | ⬜ pending |
| 4-02-01 | 02 | 1 | REF-02 | — | N/A | grep | `test "$(/usr/bin/grep -c 'No formal testing framework' docs/CLAUDE.md)" = "0" && test "$(/usr/bin/grep -r 'API_STRUCTURE' docs/ \| /usr/bin/grep -c .)" = "0" && test "$(/usr/bin/grep -c 'mock implementation' docs/api-architecture.md)" = "0"` | ✅ | ⬜ pending |
| 4-02-02 | 02 | 1 | REF-03 | — | N/A | shell | `test "$(for f in docs/*.md; do /usr/bin/grep -l "$(basename "$f")" docs/README.md; done \| /usr/bin/grep -c .)" = "$(/bin/ls docs/*.md \| /usr/bin/wc -l \| tr -d ' ')" && test "$(/usr/bin/grep -c 'under development' docs/README.md)" = "0" && test "$(/usr/bin/grep -c 'Last Updated.*2026' docs/README.md)" = "1"` | ✅ | ⬜ pending |
| 4-02-03 | 02 | 1 | REF-04 | — | N/A | grep | `test "$(/usr/bin/grep -l 'Status: Historical' docs/admin-dashboard-specification.md docs/architecture.md docs/mobile-ux-assessment.md docs/mobile-testing-automation.md \| /usr/bin/wc -l \| tr -d ' ')" = "4" && test "$(sed -n '419,444p' docs/mobile-improvements-actionable.md \| /usr/bin/grep -c '\[x\]')" = "12"` | ✅ | ⬜ pending |
| 4-03-01 | 03 | 1 | DEP-01 | T-04-xx | Supply-chain gate tightened, not weakened | shell | `test "$(/usr/bin/grep -c 'audit-level=high' .github/workflows/ci.yml)" = "1" && npm audit --omit=dev --audit-level=high` | ✅ | ⬜ pending |
| 4-03-02 | 03 | 1 | DEP-01 | — | N/A | grep | `test "$(/usr/bin/grep -c 'Next review:\*\* 2026-12-01' docs/dependency-security.md)" = "1"` | ✅ | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
