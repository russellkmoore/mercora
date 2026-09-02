---
phase: "3"
slug: "decision-lock-in-and-operator-runbooks"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-02"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit suite) |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run tests/unit/app/api/webhooks` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/app/api/webhooks`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | ADR-01 | — | N/A | grep | `! grep -q "remains outside" docs/checkout-trust-boundary.md` | ✅ | ⬜ pending |
| 3-01-02 | 01 | 1 | ADR-02 | — | N/A | grep | `grep -lE "Status:\*{0,2} Accepted" docs/checkout-trust-boundary.md docs/webhooks-refunds-inventory.md docs/database-migrations.md docs/subscriptions.md` | ✅ | ⬜ pending |
| 3-02-01 | 02 | 1 | RUN-01 | — | N/A | grep | `! grep -nE "wrangler d1 migrations apply mercora-db\s*$" docs/CLAUDE.md docs/DEPLOYMENT_SETUP.md` | ✅ | ⬜ pending |
| 3-03-01 | 03 | 1 | RUN-02 | — | N/A | unit | `npx vitest run tests/unit/app/api/webhooks` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Re-running `/gsd-ingest-docs` classifies all four ADRs as locked with no lock-status note and no W1 warning | ADR-02 | The ingest classifier is a subagent; merge mode can write to `.planning/`, so it is run by Russell on a throwaway branch | Create a throwaway branch, run `/gsd-ingest-docs --manifest gsd-ingest-manifest.yaml --mode merge`, confirm the four ADRs show `locked: true` and no I17/W1 entries, then discard the branch |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
