---
phase: "1"
slug: "security-and-admin-auth-truth"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| 01-01 T1 | 01-01 | 1 | SEC-03 | T-01-01, T-01-02, T-01-03 | Deployed dev build denies the `x-dev-admin` bypass through `checkAdminPermissions`; event registered and escalated | unit + AST contract | `npx vitest run tests/unit/lib/auth/admin-middleware.test.ts tests/unit/observability/instrumentation-source.test.ts tests/unit/workers/observability-tail-core.test.ts` | ❌ W0 (new `it()` case) | ✅ green |
| 01-01 T2 | 01-01 | 1 | SEC-03 | T-01-02, T-01-04 | Guard predicate boundaries: exact equality, absent/empty `navigator`, near-miss `NODE_ENV`, no leaked detail in the message | unit | `npx vitest run tests/unit/lib/auth/deployment-guard.test.ts tests/unit/lib/auth/admin-middleware.test.ts` | ❌ W0 (new file) | ✅ green |
| 01-01 T3 | 01-01 | 1 | SEC-03 | T-01-04, T-01-18 | Production and local development unchanged; service-token path also closed when tripped | unit + full gate | `npx vitest run tests/unit/lib/auth/admin-middleware.test.ts` then `npm test && npm run lint && npm run typecheck` | ❌ W0 (new `it()` cases) | ✅ green |
| 01-02 T1 | 01-02 | 2 | SEC-03 | T-01-05 | `authenticateRequest` returns a real HTTP 503; Clerk dev-admin path unreachable | unit | `npx vitest run tests/unit/lib/auth/unified-auth.test.ts tests/unit/observability/instrumentation-source.test.ts` | ❌ W0 (new `it()` cases) | ✅ green |
| 01-02 T2 | 01-02 | 2 | SEC-03 | T-01-06, T-01-07, T-01-08 | `middleware.ts` returns 503 on `/admin` and `/api/admin` when tripped; storefront unaffected | unit + source contract | `npx vitest run tests/unit/app/admin-guard-middleware.test.ts tests/unit/app/redirect-middleware-source.test.ts` | ❌ W0 (new file) | ✅ green |
| 01-02 T3 | 01-02 | 2 | SEC-04 | T-01-19 | Guard documented: what trips it, what the operator sees, how to recover, and the residual 401-vs-503 difference | scripted grep | `grep -q 'Deployment Safety' docs/admin-authentication.md && grep -q 'auth.deployment_guard_tripped' docs/admin-authentication.md` | ✅ shell | ✅ green |
| 01-03 T1 | 01-03 | 1 | SEC-01, SEC-04 | T-01-09, T-01-10, T-01-20 | `docs/CLAUDE.md` publishes no credential, shows no URL-credential example, makes no switched-off claim | scripted grep | `git grep -q "ADMIN_VECTORIZE_TOKEN" -- docs/CLAUDE.md && ! git grep -q "voltique-admin" -- docs/` | ✅ shell | ✅ green |
| 01-03 T2 | 01-03 | 1 | SEC-04 | T-01-11, T-01-12 | `docs/admin-authentication.md` matches `lib/auth` and `lib/models/admin.ts`; names no phantom allowlist variable | scripted grep | `git grep -q "isUserAdmin" -- docs/admin-authentication.md && ! git grep -q "ADMIN_USER_IDS" -- docs/` | ✅ shell | ✅ green |
| 01-03 T3 | 01-03 | 1 | SEC-01, SEC-04 | T-01-09, T-01-10, T-01-20 | Deploy runbook uses one authenticated header example; no tracked file outside `.planning/` holds the published value | scripted grep + lint | `git grep -q "checkAdminPermissions" -- docs/ && ! git grep -qi -e "temporarily disabled" -e "currently disabled" -e "disabled for dev" -- docs/` then `npm run lint && npm run typecheck` | ✅ shell | ✅ green |
| 01-04 T1 | 01-04 | 1 | SEC-02 | T-01-17 | Wrangler authenticated, secret binding present, pre-rotation baseline captured | scripted CLI + HTTP | `npx wrangler whoami` then `npx wrangler secret list 2>&1 \| grep -q ADMIN_VECTORIZE_TOKEN` | ✅ shell | ✅ green |
| 01-04 T2 | 01-04 | 1 | SEC-02 | T-01-14, T-01-15 | Secret rotated; the new value exists in no file, transcript, or commit | scripted CLI + grep | `npx wrangler secret list 2>&1 \| grep -q ADMIN_VECTORIZE_TOKEN` and `! git grep -qEI '[0-9a-f]{64}' -- ':!.planning'` | ✅ shell | ✅ green |
| 01-04 T3 | 01-04 | 1 | SEC-02 | T-01-14, T-01-21 | Old value rejected on both live endpoints (read-only probe first); storefront still 200 | scripted HTTP probe | `curl -s -o /dev/null -w "%{http_code}" --max-time 20 -H "Authorization: Bearer voltique-admin" https://voltique.russellkmoore.me/api/admin/knowledge` prints 401 or 403, then the same for `-X POST .../api/admin/vectorize` | ✅ shell | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Probe-endpoint correction (found during planning)

`GET /api/admin/vectorize` returns HTTP 405 unconditionally with **no** authentication check
(`app/api/admin/vectorize/route.ts:356-361`). The `GET` probe named in `01-CONTEXT.md` would have
proven nothing. The authenticated method there is `POST`, and a successful `POST` clears and
rebuilds the entire vector index. Plan `01-04` therefore probes the read-only
`GET /api/admin/knowledge` first and only issues the `POST` probe after the old value has already
been rejected, which makes the destructive outcome unreachable.

### Grep-scope note (SEC-01)

The credential search excludes `.planning/`. This phase's own CONTEXT, RESEARCH, VALIDATION, and
plan files quote the old value because it is the probe payload and the specification of the work.
Every negative gate is paired with a positive control match so a broken pathspec cannot produce a
vacuous pass.

---

## Wave 0 Requirements

- [x] `tests/unit/lib/auth/admin-middleware.test.ts` — add cases: guard-tripped (dev + Workers UA → denial, `x-dev-admin` bypass does not succeed), guard-silent-in-prod, guard-silent-in-dev-without-Workers-UA
- [x] `tests/unit/lib/auth/unified-auth.test.ts` — same three cases for `authenticateRequest`
- [x] `tests/unit/lib/auth/deployment-guard.test.ts` — guard predicate in isolation (uses `vi.stubEnv('NODE_ENV', …)` and `vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' })`); owned by plan `01-01` task 2
- [x] `tests/unit/app/admin-guard-middleware.test.ts` — the `middleware.ts` 503 path plus a source-ordering contract; owned by plan `01-02` task 2. Mock exactly `@clerk/nextjs/server` (clerkMiddleware as an identity passthrough), `@/lib/utils/settings`, and `@/lib/db` — this mock set was executed against the repository during planning and reaches the admin branch without touching D1
- [x] `lib/observability/telemetry.ts` — new event key in `TELEMETRY_EVENTS` before any test references it (AST contract test enforces the closed taxonomy)
- [ ] `workers/observability-tail/src/core.ts` — the same key appended to `TAIL_CRITICAL_EVENTS`, so a tripped guard escalates to an operator like every other critical event

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Secret rotation applied to the live Worker | SEC-02 | Requires the developer's Cloudflare login; new value must never be printed | `openssl rand -hex 32 \| npx wrangler secret put ADMIN_VECTORIZE_TOKEN`, then run the SEC-02 curl probes with the OLD value and record both status codes in the SUMMARY |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-02

## Validation Audit 2026-09-02

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

State A audit by the orchestrator after phase completion. Every Wave 0 test file now exists (`tests/unit/lib/auth/deployment-guard.test.ts`, `tests/unit/app/admin-guard-middleware.test.ts`, new cases in `admin-middleware.test.ts` and `unified-auth.test.ts`, plus the enum parity test in `tests/unit/workers/observability-tail-core.test.ts` added by the code-review fix). Full unit suite: 235 files / 1732 tests green; lint 0 errors; typecheck clean; `cf-typecheck` green in CI (local failure is the documented `.env.local` effect). Manual-only item (secret rotation) completed and evidenced by live probe status codes 401/401 in `01-04-SUMMARY.md`.
