---
phase: "1"
slug: "security-and-admin-auth-truth"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-01"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.mts` (unit suite; `environment: 'node'`, `include: ["tests/unit/**/*.test.ts"]`) |
| **Quick run command** | `npx vitest run tests/unit/lib/auth/admin-middleware.test.ts tests/unit/lib/auth/unified-auth.test.ts tests/unit/observability/instrumentation-source.test.ts` |
| **Full suite command** | `npm test && npm run lint && npm run typecheck && npm run cf-typecheck` |
| **Estimated runtime** | ~20 seconds quick, ~3 minutes full |

Project commands run under Node 24 via mise (`mise exec -- <command>`).

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full CI parity green: `npm test`, `npm run test:workers`, `npm run test:observability-worker`, `npm run build` (mirrors `.github/workflows/ci.yml`)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | | | SEC-01 | — | No credential literal in `docs/` | scripted grep | `git grep -n "voltique-admin"` returns nothing; `git grep -n "mercora-dev-bypass" docs/` returns nothing | ✅ shell | ⬜ pending |
| (filled by planner) | | | SEC-02 | — | Old token rejected on live site | scripted HTTP probe | `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer voltique-admin" https://voltique.russellkmoore.me/api/admin/vectorize` prints 401 or 403; same for `/api/admin/knowledge` | ✅ shell | ⬜ pending |
| (filled by planner) | | | SEC-03 | — | Guard trips under dev + Workers UA; bypass unreachable; silent in prod; silent in dev without Workers UA | unit | `npx vitest run tests/unit/lib/auth/admin-middleware.test.ts tests/unit/lib/auth/unified-auth.test.ts` | ❌ W0 (new `it()` cases) | ⬜ pending |
| (filled by planner) | | | SEC-03 | — | New telemetry event fits the closed taxonomy | unit (AST contract) | `npx vitest run tests/unit/observability/instrumentation-source.test.ts tests/unit/lib/observability/telemetry.test.ts` | ✅ exists | ⬜ pending |
| (filled by planner) | | | SEC-03 | — | middleware.ts returns 503 on `/api/admin/*` when tripped | unit | `npx vitest run tests/unit/lib/auth/deployment-guard.test.ts` (or the test file the planner names) | ❌ W0 | ⬜ pending |
| (filled by planner) | | | SEC-04 | — | No query-string bypass documented; no "disabled" claim | scripted grep | `git grep -n -e "?dev=" -e "?token=" -e "temporarily disabled" -e "disabled for dev" docs/` returns nothing | ✅ shell | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/lib/auth/admin-middleware.test.ts` — add cases: guard-tripped (dev + Workers UA → denial, `x-dev-admin` bypass does not succeed), guard-silent-in-prod, guard-silent-in-dev-without-Workers-UA
- [ ] `tests/unit/lib/auth/unified-auth.test.ts` — same three cases for `authenticateRequest`
- [ ] `tests/unit/lib/auth/deployment-guard.test.ts` — guard predicate in isolation plus the middleware 503 path (uses `vi.stubEnv('NODE_ENV', …)` and `vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' })`)
- [ ] `lib/observability/telemetry.ts` — new event key in `TELEMETRY_EVENTS` before any test references it (AST contract test enforces the closed taxonomy)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Secret rotation applied to the live Worker | SEC-02 | Requires the developer's Cloudflare login; new value must never be printed | `openssl rand -hex 32 \| npx wrangler secret put ADMIN_VECTORIZE_TOKEN`, then run the SEC-02 curl probes with the OLD value and record both status codes in the SUMMARY |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
