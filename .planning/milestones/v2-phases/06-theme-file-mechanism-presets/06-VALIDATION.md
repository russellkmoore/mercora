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
| 06-03-01 | 03 | 3 | THEME-04 | T-06-09 | `themes/midnight.css` is a pure 23-token data file (1 block, 17 hex colours) with a valid header; the validator and token-contract parity test pass unmodified | unit + scripted (grep shape assertions) | `test "$(grep -c '^\s*--store-' themes/midnight.css)" -eq 23 && test "$(grep -c '{' themes/midnight.css)" -eq 1 && mise exec -- node scripts/build-themes.mjs && mise exec -- npx vitest run tests/unit/lib/themes/token-contract.test.ts` | ✅ | ✅ green |
| 06-03-02 | 03 | 3 | THEME-04 | T-06-09 | `themes/luxe.css` is a pure 23-token data file with inverted inverse surfaces, a contrast-corrected ring, flat radii, and a display token referencing the layout's Cormorant Garamond variable with no font-loading at-rule | unit + scripted (grep shape assertions) | `test "$(grep -c '^\s*--store-' themes/luxe.css)" -eq 23 && grep -q 'font-cormorant-garamond' themes/luxe.css && mise exec -- node scripts/build-themes.mjs && mise exec -- npx vitest run tests/unit/lib/themes/token-contract.test.ts` | ✅ | ✅ green |
| 06-03-03 | 03 | 3 | THEME-04 | T-06-10 / T-06-11 / T-06-12 | Manifest/barrel regenerate to 3 entries and stay check-clean; writing `appearance.theme` in local D1 to each of the three names in turn changes the served `<html>` theme attribute and the stylesheet's active declaration block, restored to the manifest default when done | integration (real dev server + D1 write) + full gate suite | `mise exec -- node scripts/build-themes.mjs --check && test "$(grep -c 'name: "' lib/themes/manifest.generated.ts)" -eq 3 && test "$(grep -c '@import' themes/index.generated.css)" -eq 3`; manual `wrangler d1 execute … --local` write + `curl` probe per theme name; `mise exec -- npm run lint && npm run typecheck && npm run scan:tokens && npm test` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Note (06-03-03): the plan's own literal acceptance-criteria grep (`grep -c 'name:'` == 3) counts the generated `ThemeManifestEntry` type's `name: string;` field as a fourth match; the corrected `grep -c 'name: "'` (quote-anchored, matches only object literals) is 3 and is what this row records. See 06-03-SUMMARY.md "Issues Encountered."*

---

## Wave 0 Requirements

Existing infrastructure (Vitest, `spawnSync`-a-real-script convention from `tests/unit/scripts/scan-hardcoded-colors.test.ts`, the `token-contract.test.ts` contract-test shape) covers all of Plan 01's requirements. No new framework or shared fixture install was needed — only the eight new fixture directories under `tests/fixtures/themes/`, created inline in Task 3.

---

## Manual-Only Verifications

*Plan 01: None — every behavior has automated verification (fixture-driven unit tests, a real `spawnSync` deploy-gate break test, and build/scan/typecheck/lint gates). Plan 01 produces no rendered UI; visual QA is out of scope until later plans (THEME-03/THEME-04).*

*Plan 03 (06-03-03): the task's `<verify>` carries one `<human-check>` — switching the stored theme through all three names and confirming the page visibly changes look (black/orange, indigo/violet, ivory/gold), needs only a reload, and that luxe renders headings in the serif face while the dark themes fetch no font file. The automated portion (attribute + stylesheet-block match per name) is proven above. The visual-look and reload-only claims were spot-checked directly (screenshot captures + curl reload probes) during execution and read correctly; the serif-heading claim could not be confirmed as written — see 06-03-SUMMARY.md "Issues Encountered" and `.planning/WINDOWS.md` — because no component in the tree currently applies the `font-display` Tailwind class to any element, a pre-existing gap outside this data-only plan's scope. Full pixel-level QA is plan 06-05's job.*

---

## Validation Sign-Off

- [x] All Plan 01 tasks have `<automated>` verify (no Wave 0 dependencies remained after Task 3)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (all 3 tasks in Plan 01 have one)
- [x] Wave 0 covers all MISSING references (none were missing — existing Vitest infra sufficed)
- [x] No watch-mode flags (`vitest run`, never bare `vitest`)
- [x] Feedback latency < 10s (full suite: ~8s)
- [ ] `nyquist_compliant: true` — not set; this file covers Plan 01 only. Remaining plans in Phase 6 (02–05) still need their own Per-Task Verification Map rows before the phase-level sign-off can flip.

**Approval:** pending (phase not yet fully executed)
