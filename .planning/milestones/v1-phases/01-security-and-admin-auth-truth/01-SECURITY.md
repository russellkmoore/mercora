---
phase: "1"
slug: "security-and-admin-auth-truth"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-02"
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Unauthenticated internet → Next.js middleware | Every request, including admin paths, crosses here before Clerk runs | Attacker-controlled headers and cookies |
| Unauthenticated internet → `app/api/**` route handlers and `authenticateRequest` | `x-dev-admin`, `Authorization`, `X-API-Key` headers and Clerk session cookies | Credentials (service token, session) |
| Build-time configuration → runtime authorization decision | `process.env.NODE_ENV` is baked at build time and consumed as an authorization input | Build mode flag |
| Repository → public reader | Every tracked file is readable by anyone with repo access | Documentation, examples, any literal credential |
| Documentation → operator action | Operators follow documented examples verbatim | Commands, curl examples |
| Executor shell → Cloudflare control plane | Secret rotation writes `ADMIN_VECTORIZE_TOKEN` | The generated secret (must cross nothing else) |
| Executor shell → live production site | Verification probes against `/api/admin/*` | The OLD token only |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Elevation of Privilege | `checkAdminPermissions` `x-dev-admin` bypass | high | mitigate | `assertDeploymentPosture()` is the first statement in the `try` (`lib/auth/admin-middleware.ts:20`), before the header read | closed |
| T-01-02 | Information Disclosure | Guard denial text | medium | mitigate | Fixed `DEPLOYMENT_GUARD_MESSAGE` constant, no interpolation (`lib/auth/deployment-guard.ts:19`) | closed |
| T-01-03 | Information Disclosure | Telemetry payload for `auth.deployment_guard_tripped` | medium | mitigate | Only `{ outcome: 'unavailable' }`; `sanitizeTelemetryFields` allow-list drops everything else | closed |
| T-01-04 | Denial of Service | Guard tripping in a correct production deploy | high | mitigate | Strict `===` on both operands; 13 predicate tests incl. near-misses, prod, and local-dev paths | closed |
| T-01-18 | Elevation of Privilege | Service-token branch of `checkAdminPermissions` | high | mitigate | Guard precedes the Bearer / X-API-Key comparison (`admin-middleware.ts:34-44`) | closed |
| T-01-05 | Elevation of Privilege | `unified-auth.ts` Clerk-user-as-admin dev shortcut | high | mitigate | Guard precedes `extractToken` (`lib/auth/unified-auth.ts:100`); test proves Clerk path unreachable when tripped | closed |
| T-01-06 | Elevation of Privilege | `middleware.ts` unconditional `NextResponse.next()` for admin paths | high | mitigate | Prefix-scoped guard branch above the short-circuit returns 503 (`middleware.ts:78-86`) | closed |
| T-01-07 | Information Disclosure | Middleware 503 body | medium | mitigate | Shared constant, plain text, no stack or env echo (`middleware.ts:81`) | closed |
| T-01-08 | Denial of Service | Over-broad guard branch takes storefront offline | high | mitigate | Branch scoped to `/admin` and `/api/admin`; storefront tests assert non-503 while tripped | closed |
| T-01-19 | Repudiation | Docs overstating 503 coverage | medium | mitigate | `docs/admin-authentication.md:236-238` states the 401-vs-503 residual for six non-`/api/admin` callers | closed |
| T-01-09 | Information Disclosure | Live admin token published in `docs/CLAUDE.md` | high | mitigate | Placeholder; `git grep voltique-admin -- docs/` returns 0 with positive control; rotated in 01-04 | closed |
| T-01-10 | Spoofing | Documented examples sending credentials in URL query | high | mitigate | All converted to header form; `git grep -e "?token=" -e "?dev=" -- docs/` returns 0 | closed |
| T-01-11 | Repudiation | Docs naming `ADMIN_USER_IDS`, which the code never reads | medium | mitigate | Replaced with Clerk role + `adminUsers` table description; 0 matches in docs, components, lib, app | closed |
| T-01-12 | Information Disclosure | Dev bypass value advertised in docs | medium | mitigate | Placeholder prose; `git grep mercora-dev-bypass -- docs/` returns 0; literal intentionally retained in source per 2026-09-01 decision | closed |
| T-01-20 | Repudiation | Docs asserting admin auth is switched off | medium | mitigate | All such claims corrected; case-insensitive grep returns 0 | closed |
| T-01-14 | Spoofing | Published token as admin service identity | critical | mitigate | Rotated via `openssl rand -hex 32 \| wrangler secret put`; live probes with old value: GET knowledge 401, POST vectorize 401; auditor re-ran GET probe: 401 | closed |
| T-01-15 | Information Disclosure | New secret leaking to transcript, history, log, or commit | critical | mitigate | Single generate-into-upload pipeline; hex-64 grep of tracked tree shows only three pre-existing files | closed |
| T-01-16 | Denial of Service | Rotation breaking a server-to-server caller holding the old value | medium | accept | In-repo consumers read `process.env.ADMIN_VECTORIZE_TOKEN` at request time; external holders are intended to lose access | closed (accepted) |
| T-01-17 | Repudiation | Rotation silently no-ops on unauthenticated wrangler | high | mitigate | Preflight halts on `wrangler whoami`; status codes are the only accepted evidence; the deploy-precondition failure was surfaced, not swallowed | closed |
| T-01-21 | Denial of Service | Verification probe rebuilding the live vector index | high | mitigate | POST probe issued only after the read-only GET probe rejected the old value | closed |
| T-01-SC | Tampering | Package installs (all four plans) | low | accept | No packages installed this phase; `git log` shows no `package.json` / lockfile changes in phase commits | closed (accepted) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-16 | Consumers read the secret at request time, so rotation cannot break in-repo callers; any external holder of the old value is meant to lose access | Plan 01-04 threat model (planner), passed plan-checker; rotation itself decided by Russell 2026-09-01 | 2026-09-02 |
| AR-01-02 | T-01-SC | No dependency changes in this phase; no supply-chain surface | Plans 01-01..04 threat models (planner), passed plan-checker | 2026-09-02 |
| AR-01-03 | WR-04 (code review; client-side dev-mode admin shortcuts in `components/admin/AdminGuard.tsx`) | Only reachable if a development build is deployed to production, which has no unintentional path in this project's deploy flow; production is a demo site; server-side middleware and API guards independently block admin access, so the residual is a visible nav link | Russell, 2026-09-02 ("accept as-is") | 2026-09-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags Pending Owner Sign-Off

| Flag | Source | Component | Bounded Impact | Status |
|------|--------|-----------|----------------|--------|
| WR-04 | `01-REVIEW.md` (code review) | `components/admin/AdminGuard.tsx:69-74, 206-211` client-side dev-mode admin shortcuts (`checkAdminAccess`, `useAdminAccess`) not covered by the deployment guard (a browser `navigator` never reads `Cloudflare-Workers`) | Cosmetic: a misbuilt development deploy would show the "Admin Dashboard" link to any signed-in user; clicking through hits the middleware 503 and every admin API call is server-guarded | **Accepted by Russell 2026-09-02** — moved to Accepted Risks Log as AR-01-03. Fix suggestion remains in `deferred-items.md` if ever wanted |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-02 | 21 | 21 | 0 | gsd-security-auditor (verdict: SECURED, 63/63 threat-relevant tests re-run live, live GET probe re-run, credential greps re-run) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-02 (automated audit); WR-04 accepted by Russell 2026-09-02 (AR-01-03)
