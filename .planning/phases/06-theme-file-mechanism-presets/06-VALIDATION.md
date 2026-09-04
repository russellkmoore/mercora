---
phase: "06"
slug: "theme-file-mechanism-presets"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-04"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit: `vitest.config.mts`; Workers-pool integration: `vitest.workers.config.mts`; tail-worker: `vitest.observability.config.mts`) |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `mise exec -- npx vitest run tests/unit/lib/themes/ tests/unit/scripts/build-themes.test.ts` |
| **Full suite command** | `mise exec -- npm test` |
| **Estimated runtime** | ~8 seconds (full unit suite, 246 files / 1902 tests) |

---

## Sampling Rate

- **After every task commit:** `mise exec -- npx vitest run tests/unit/lib/themes/ tests/unit/scripts/build-themes.test.ts` + `mise exec -- npm run scan:tokens`
- **After every plan wave:** `mise exec -- npm test` + `mise exec -- npm run build:worker`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | THEME-01 | T-06-01 / T-06-02 | Validator rejects a broken theme file (missing token, unknown token, extra rule, at-rule, name mismatch, bad hex, no label, empty); generated barrel/manifest resolve end to end through the real build | integration + unit | `mise exec -- node scripts/build-themes.mjs && mise exec -- npm run build && grep -l bg-surface .next/static/css/*.css && grep -l store-surface .next/static/css/*.css` | ✅ | ✅ green |
| 06-01-02 | 01 | 1 | THEME-01 | T-06-04 | A broken theme file stops `build:worker`/`predev` before the Cloudflare builder or dev DB step runs; committed generated output stays provably fresh | scripted (build-break-rebuild) | `mise exec -- node scripts/build-themes.mjs --check`; deliberate-break-then-restore run of `npm run build:worker` | ✅ | ✅ green |
| 06-01-03 | 01 | 1 | THEME-01 | T-06-01 / T-06-03 | Every validator rule has a failing fixture and a known-clean control passes; `getThemeTokens()` matches every shipped theme file, not one hardcoded file | unit (fixture-driven) | `mise exec -- npx vitest run tests/unit/scripts/build-themes.test.ts tests/unit/lib/themes/token-contract.test.ts && mise exec -- npm test` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure (Vitest, `spawnSync`-a-real-script convention from `tests/unit/scripts/scan-hardcoded-colors.test.ts`, the `token-contract.test.ts` contract-test shape) covers all of Plan 01's requirements. No new framework or shared fixture install was needed — only the eight new fixture directories under `tests/fixtures/themes/`, created inline in Task 3.

---

## Manual-Only Verifications

*None — every Plan 01 behavior has automated verification (fixture-driven unit tests, a real `spawnSync` deploy-gate break test, and build/scan/typecheck/lint gates). Plan 01 produces no rendered UI; visual QA is out of scope until later plans (THEME-03/THEME-04).*

---

## Validation Sign-Off

- [x] All Plan 01 tasks have `<automated>` verify (no Wave 0 dependencies remained after Task 3)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (all 3 tasks in Plan 01 have one)
- [x] Wave 0 covers all MISSING references (none were missing — existing Vitest infra sufficed)
- [x] No watch-mode flags (`vitest run`, never bare `vitest`)
- [x] Feedback latency < 10s (full suite: ~8s)
- [ ] `nyquist_compliant: true` — not set; this file covers Plan 01 only. Remaining plans in Phase 6 (02–05) still need their own Per-Task Verification Map rows before the phase-level sign-off can flip.

**Approval:** pending (phase not yet fully executed)
