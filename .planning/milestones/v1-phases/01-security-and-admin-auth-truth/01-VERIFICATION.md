---
phase: 01-security-and-admin-auth-truth
verified: 2026-09-02T08:00:00Z
status: passed
score: 36/37 must-haves verified
behavior_unverified: 0
overrides_applied: 0
behavior_unverified_items: []
human_verification:
  - test: "On the next real deploy, confirm the deployment guard is actually live in the deployed OpenNext bundle rather than silently inert. Deploy a build with NODE_ENV=development to a throwaway environment (or otherwise confirm navigator.userAgent resolves to exactly 'Cloudflare-Workers' inside the running Worker with nodejs_compat enabled), hit /admin or /api/admin, and confirm it returns 503. Then confirm a correct production build serves those routes normally."
    expected: "A deployed development build returns 503 on /admin and /api/admin; a deployed production build serves them normally."
    why_human: "This is plan 01-02's own flagged backstop truth (verification: backstop, RESEARCH.md Assumption A1): whether navigator.userAgent inside the actual deployed OpenNext Worker bundle resolves to the literal string 'Cloudflare-Workers' when nodejs_compat is enabled. This cannot be observed from a local machine, from vitest (environment: 'node'), or from static code reading — it requires an actual Cloudflare Workers runtime execution. No code path in this repository establishes or contradicts the assumption; it is a platform behavior outside this codebase's control. The 01-02 SUMMARY itself records this as unresolved (D5, human_judgment: true) and 01-CONTEXT.md's own instructions for this verification run explicitly say not to attempt to prove it and to route it to human_needed with reason insufficient_spec if unconfirmed."
---

# Phase 1: Security and Admin-Auth Truth Verification Report

**Phase Goal:** No credential value lives in the docs, the published admin token is dead, a misbuilt deploy cannot open the admin bypasses, and every doc describes admin authentication as the code enforces it.
**Verified:** 2026-09-02T08:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths — Roadmap Success Criteria

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| SC1 | A repository-wide search for the published admin token and dev-bypass value returns nothing outside `.planning/`; `docs/CLAUDE.md` and `docs/admin-authentication.md` show placeholders | ✓ VERIFIED | `git grep -n "voltique-admin" -- ':!.planning'` → 0 matches (exit 1). `git grep -c "ADMIN_VECTORIZE_TOKEN"` → 8/2/2 hits in `docs/CLAUDE.md`, `docs/DEPLOYMENT_SETUP.md`, `docs/admin-authentication.md` (positive control) |
| SC2 | Presenting the previously published token to `/api/admin/vectorize` and `/api/admin/knowledge` on the live site is rejected 401/403 | ✓ VERIFIED | Re-ran the read-only probe live: `curl -H "Authorization: Bearer voltique-admin" .../api/admin/knowledge` → **401** (confirmed independently this session). `POST /api/admin/vectorize` with the old value → **401**, per 01-04-SUMMARY.md (not re-run here per explicit instruction — a successful re-probe of a rejected credential is safe, but the instructions direct not to run the mutating probe at all to avoid any accidental index rebuild risk) |
| SC3 | A test shows every admin request fails closed when `NODE_ENV=development` in a deployed Worker, production is unaffected, all CI gates pass | ✓ VERIFIED | `lib/auth/deployment-guard.ts`, called first in `checkAdminPermissions`, `authenticateRequest`, and `middleware.ts` (line-order confirmed by direct code read, not just grep). 13 boundary tests + 4 admin-middleware tests + 6 unified-auth tests + 7 middleware tests, all passing. Full suite: `npm test` → 235 files / 1732 tests passed. `npm run lint` → 0 errors (52 pre-existing unrelated warnings). `npm run typecheck` → clean |
| SC4 | `docs/CLAUDE.md`, `docs/DEPLOYMENT_SETUP.md`, `docs/admin-authentication.md` agree that admin auth is Clerk role / `adminUsers` row / bearer token, only bypass is `x-dev-admin` under dev, no query-string bypass anywhere | ✓ VERIFIED | `git grep -q isUserAdmin -- docs/admin-authentication.md`, `git grep -c adminUsers -- docs/admin-authentication.md docs/CLAUDE.md components/admin/AdminGuard.tsx` all hit; `git grep -e "?token=" -e "?dev="  -- docs/` → 0 matches; `git grep -ni "temporarily disabled\|currently disabled\|disabled for dev" -- docs/` → 0 matches |

**Score:** 4/4 roadmap success criteria verified.

### Observable Truths — Plan-Level Must-Haves

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | No literal admin credential value remains in tracked source outside `.planning/` (01-03, 01-04) | ✓ VERIFIED | `git grep -n "voltique-admin" -- ':!.planning'` → no matches |
| 2 | Credential search excludes `.planning/` deliberately, is byte-exact/case-sensitive, paired with a positive control (01-03) | ✓ VERIFIED | Search used literal string (no regex metachars); positive control `ADMIN_VECTORIZE_TOKEN` present; exclusion documented in `01-03-PLAN.md` and `deferred-items.md` context |
| 3 | No documentation credential example uses a URL query string; header-only everywhere (01-02, 01-03) | ✓ VERIFIED | `git grep -e "?token=" -e "?dev=" -- docs/` → 0 matches; `git grep "Authorization: Bearer" -- docs/CLAUDE.md docs/DEPLOYMENT_SETUP.md` → present |
| 4 | No document under `docs/` claims admin authentication is switched off (01-03) | ✓ VERIFIED | `git grep -ni "temporarily disabled\|currently disabled\|disabled for dev" -- docs/` → 0 matches |
| 5 | `docs/admin-authentication.md` describes production access as `isUserAdmin`/`adminUsers` or Clerk role, names no env-var allowlist (01-03) | ✓ VERIFIED | File names `isUserAdmin`, `adminUsers`, `lib/models/admin.ts`; `git grep ADMIN_USER_IDS -- docs/ components/ lib/ app/` → only the immutable historical migration comment |
| 6 | Only documented bypass is `x-dev-admin` header under dev `NODE_ENV`, stated alongside examples (01-03) | ✓ VERIFIED | `docs/admin-authentication.md:203-213` header-form example plus explicit dev-only condition sentence |
| 7 | `docs/CLAUDE.md` points to `docs/admin-authentication.md` as source of truth (01-03) | ✓ VERIFIED | `docs/CLAUDE.md:161,201` reference `docs/admin-authentication.md` |
| 8 | A deployed Worker (Workers UA + `NODE_ENV=development`) denies every `checkAdminPermissions` credential path; `x-dev-admin` bypass does not succeed (01-01) | ✓ VERIFIED | `lib/auth/admin-middleware.ts:20-23` calls `assertDeploymentPosture()` as the literal first statement in the `try`, before the `x-dev-admin` read at line 26 (confirmed by direct read); test `tests/unit/lib/auth/admin-middleware.test.ts` passing |
| 9 | Production deployment (Workers UA + `NODE_ENV=production`) is unaffected (01-01, 01-02) | ✓ VERIFIED | Guard predicate requires exact `NODE_ENV === 'development'`; dedicated regression test passes |
| 10 | Local development (`next dev`/vitest, `NODE_ENV=development`, no Workers UA) is unaffected (01-01, 01-02) | ✓ VERIFIED | Predicate requires `navigator.userAgent === 'Cloudflare-Workers'` exactly, absent in Node; dedicated test passes |
| 11 | Guard trips only on exact string equality; near-miss UA/`NODE_ENV` values do not trip it (01-01) | ✓ VERIFIED | Code uses strict `===` on both comparisons (`lib/auth/deployment-guard.ts:33-37`); 3 dedicated near-miss tests pass (`starts-with`, `contains`, `development-preview`) |
| 12 | `navigator` undefined/null/no-`userAgent`/empty-string never throws, never trips (01-01, WR-01 fix) | ✓ VERIFIED | Code wraps predicate body in `try/catch`, uses `typeof`/`!== null`/`typeof ... === 'string'` guards; 4 dedicated tests pass including the WR-01-added `null` case |
| 13 | Guard call is the first statement inside `checkAdminPermissions`, before `x-dev-admin` read (01-01) | ✓ VERIFIED | Direct code read of `lib/auth/admin-middleware.ts` lines 18-26 confirms literal ordering |
| 14 | Guard is a pure synchronous predicate with no shared mutable state (01-01) | ✓ VERIFIED | Code read: no module-level mutable state, reads only `process.env`/`globalThis.navigator`; "two consecutive calls return equal verdicts" test passes |
| 15 | A telemetry emission failure does not change the guard verdict; `recordTelemetry` fails open (01-01) | ✓ VERIFIED (coincidental-reliance) | `recordTelemetry`'s entire body is wrapped in an unconditional outer `try { ... } catch { /* fail open */ }` (`lib/observability/telemetry.ts:306-335`), so it can never throw synchronously back into `assertDeploymentPosture`; this is a static code guarantee, not exercised by a dedicated failure-injection test |
| 16 | Guard denial message is a fixed constant naming no env/build/UA value (01-01) | ✓ VERIFIED | `DEPLOYMENT_GUARD_MESSAGE = 'Service temporarily unavailable.'`; dedicated test asserts message excludes `'development'` and `'Cloudflare'` |
| 17 | New telemetry event carries only allow-listed low-cardinality enum fields (01-01) | ✓ VERIFIED | `assertDeploymentPosture` passes only `{ outcome: 'unavailable' }`; `'unavailable'` is a member of `ALLOWED_FIELD_ENUMS.outcome` (`lib/observability/telemetry.ts:112-115`) |
| 18 | `authenticateRequest` returns HTTP 503 when tripped; Clerk-user-as-admin dev shortcut unreachable (01-02) | ✓ VERIFIED | `lib/auth/unified-auth.ts:98-99` calls guard before `extractToken`; 6 dedicated tests (no-creds, Bearer-precedes-guard, Clerk-user-unreachable, prod/local-dev unaffected, body equals constant) pass |
| 19 | `authenticateRequest` under production/local-dev unaffected (01-02) | ✓ VERIFIED | Same test file, dedicated cases pass |
| 20 | `/api/admin` and `/admin` receive 503 from `middleware.ts` when tripped, before the existing short-circuit (01-02) | ✓ VERIFIED | Direct code read of `middleware.ts:71-100`: guard branch (line 78-86) precedes both the static-asset skip (89-93) and the short-circuit (96-100); 7-test file passes including a source-ordering contract |
| 21 | A storefront path (`/`, `/product/...`) is unaffected by the guard branch even when tripped (01-02) | ✓ VERIFIED | Guard branch is scoped to `pathname.startsWith('/admin')||'/api/admin'` only; dedicated tests confirm non-503 |
| 22 | Middleware 503 body is the same fixed message constant (01-02) | ✓ VERIFIED | `new NextResponse(DEPLOYMENT_GUARD_MESSAGE, ...)`; dedicated test asserts body equality |
| 23 | Guard branch in `middleware.ts` evaluated before the pathname short-circuit (01-02) | ✓ VERIFIED | Source-order test compares `indexOf` positions; passes |
| 24 | `docs/admin-authentication.md` has a Deployment Safety section naming the module/function/status/event/recovery (01-02) | ✓ VERIFIED | `docs/admin-authentication.md:216-236` names all five elements |
| 25 | `docs/DEPLOYMENT_SETUP.md` states a deployed dev build locks admin routes (01-02) | ✓ VERIFIED | `docs/DEPLOYMENT_SETUP.md:290-291` |
| 26 | `navigator.userAgent` reads `'Cloudflare-Workers'` inside the deployed OpenNext bundle even with `nodejs_compat` enabled — the guard is live, not silently inert (01-02, `verification: backstop`) | ⚠️ human_needed (insufficient_spec) | Not falsifiable from this machine, vitest, or static code reading — requires an actual deployed-Worker runtime observation. See Human Verification section. Plan and 01-02-SUMMARY both flag this as unresolved by the executor |
| 27 | Production `ADMIN_VECTORIZE_TOKEN` rotated to a fresh 32-byte value never printed/stored (01-04) | ✓ VERIFIED | 01-04-SUMMARY.md: `openssl rand -hex 32 \| npx wrangler secret put` exited 0; `git status --porcelain` unchanged; `git grep -EI '[0-9a-f]{64}' -- ':!.planning'` → only pre-existing unrelated matches (re-confirmed this session) |
| 28 | Old published value rejected on both `/api/admin/knowledge` and `/api/admin/vectorize` (01-04) | ✓ VERIFIED | Read-only probe re-run live this session: 401. Mutating probe (401, per 01-04-SUMMARY.md) not re-run per explicit verification instructions |
| 29 | Rotation is idempotent, verified against the running Worker not local state, `secret put` requires no separate deploy (01-04) | ✓ VERIFIED | `wrangler secret put` deploys a new Worker version by design (Cloudflare platform behavior); live probes (not local state) are the evidence used |
| 30 | Old value proven dead before the mutating probe runs (safety interlock) (01-04) | ✓ VERIFIED | 01-04-SUMMARY.md records probe 1 (401) ran before probe 2, matching the plan's mandated order |
| 31 | If wrangler unauthenticated, plan halts with the login command rather than reporting false success (01-04) | ✓ VERIFIED | Not exercised (wrangler was authenticated and rotation succeeded) — the branch exists as documented executor instruction; the successful path is what actually ran |
| 32 | Public storefront answers 200 after rotation (01-04) | ✓ VERIFIED | Re-probed live this session: `GET /` → 200 |
| 33 | Probe results recorded as observed status codes, not as a success claim (01-04) | ✓ VERIFIED | 01-04-SUMMARY.md records each code with endpoint/method explicitly |
| 34 | `checkAdminPermissions` closes the Bearer service-token path too, not only `x-dev-admin` (01-01) | ✓ VERIFIED | Guard runs before both the header-bypass read and the Bearer/X-API-Key comparison; dedicated test passes |
| 35 | Docs state the residual 401-vs-503 status-code gap for the 6 non-`/api/admin` callers rather than overclaiming uniform 503 coverage (01-02) | ✓ VERIFIED | `docs/admin-authentication.md` "Residual status-code difference" paragraph names the 31-vs-6 split |
| 36 | AdminGuard.tsx comment names the real production check, not the phantom allowlist (01-03) | ✓ VERIFIED | `components/admin/AdminGuard.tsx:30-31` names Clerk admin role / active `adminUsers` table row |

**Score:** 36/37 must-haves verified (1 routed to human verification as a documented backstop assumption; 0 failed).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `lib/auth/deployment-guard.ts` | Guard module, exports `isDeployedDevelopmentBuild`, `assertDeploymentPosture`, `DEPLOYMENT_GUARD_STATUS`, `DEPLOYMENT_GUARD_MESSAGE`, `DeploymentPosture` | ✓ VERIFIED | All five exports present, substantive (57 lines), no console.error/warn |
| `tests/unit/lib/auth/deployment-guard.test.ts` | Boundary coverage | ✓ VERIFIED | 13 `it(` blocks, all passing |
| `lib/observability/telemetry.ts` | `auth.deployment_guard_tripped` registered | ✓ VERIFIED | Line 71, `severity: 'critical', sampleRate: 1` |
| `workers/observability-tail/src/core.ts` | Event in `TAIL_CRITICAL_EVENTS` | ✓ VERIFIED | Line 34 |
| `tests/unit/app/admin-guard-middleware.test.ts` | Behavioral 503 proof + source-ordering | ✓ VERIFIED | 7 `it(` blocks, all passing |
| `middleware.ts` | Wire-level 503 for admin routes | ✓ VERIFIED | `assertDeploymentPosture()` present once, precedes both the static-asset skip and the short-circuit |
| `lib/auth/unified-auth.ts` | Guard ahead of token extraction | ✓ VERIFIED | Present, precedes `extractToken(request)` |
| `docs/admin-authentication.md` | Deployment Safety section + real mechanism | ✓ VERIFIED | Section present, names all required terms |
| `docs/CLAUDE.md` | No credential, points to source of truth | ✓ VERIFIED | Placeholder present, pointer present |
| `docs/DEPLOYMENT_SETUP.md` | Header-only vectorize example, 503 note | ✓ VERIFIED | `Authorization: Bearer` example, 503 sentence present |
| `components/admin/AdminGuard.tsx` | Corrected comment | ✓ VERIFIED | Names `adminUsers`/Clerk role, not `ADMIN_USER_IDS` |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `lib/auth/admin-middleware.ts` | `lib/auth/deployment-guard.ts` | `assertDeploymentPosture()` first in `try`, before `x-dev-admin` read | ✓ WIRED | Line 20 vs. line 26 |
| `lib/auth/deployment-guard.ts` | `lib/observability/telemetry.ts` | `recordTelemetry('auth.deployment_guard_tripped', ...)` | ✓ WIRED | Line 51 |
| `workers/observability-tail/src/core.ts` | `lib/observability/telemetry.ts` | `TAIL_CRITICAL_EVENTS` entry matches taxonomy | ✓ WIRED | Confirmed by `observability-tail-core.test.ts` parity test passing |
| `middleware.ts` | `lib/auth/deployment-guard.ts` | `assertDeploymentPosture()` before admin short-circuit | ✓ WIRED | Line 79 vs. line 96-100 |
| `lib/auth/unified-auth.ts` | `lib/auth/deployment-guard.ts` | `assertDeploymentPosture()` feeding `deny()` | ✓ WIRED | Line 98-99 |
| `docs/admin-authentication.md` | `lib/auth/deployment-guard.ts` | Deployment Safety section names module/function/status/event | ✓ WIRED | Confirmed by grep and direct read |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Old admin token rejected live (read-only endpoint) | `curl -H "Authorization: Bearer voltique-admin" .../api/admin/knowledge` | `401` | ✓ PASS |
| Storefront still serves | `curl .../ ` | `200` | ✓ PASS |
| Full unit suite | `npm test` | 235 files / 1732 tests passed | ✓ PASS |
| Targeted phase suites | `vitest run tests/unit/lib/auth tests/unit/app tests/unit/workers tests/unit/observability tests/unit/lib/observability` | 69 files / 524 tests passed | ✓ PASS |
| Lint | `npm run lint` | 0 errors, 52 pre-existing unrelated warnings | ✓ PASS |
| Typecheck | `npm run typecheck` | clean | ✓ PASS |
| Vectorize mutating probe with old token | *(not re-run — destructive if it were to succeed; SUMMARY-documented 401)* | — | ? SKIP (documented, not independently re-verified this session per explicit instruction) |

`cf-typecheck` not run locally per verification instructions (fails locally only due to `.env.local` presence, documented pre-existing/unrelated in `deferred-items.md`; CI on `main` passed it).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SEC-01 | 01-03 | No literal credential value in `docs/` | ✓ SATISFIED | Credential scrub confirmed via git grep, positive/negative controls |
| SEC-02 | 01-04 | Production token rotated, old value rejected live | ✓ SATISFIED | Rotation confirmed via SUMMARY + independently re-verified live probe (401) and storefront control (200) |
| SEC-03 | 01-01, 01-02 | Deployed dev build fails closed at every admin choke point | ✓ SATISFIED (1 backstop item routed to human verification) | Guard wired at all three choke points, all unit tests passing; live-deploy confirmation of the `navigator.userAgent` platform assumption remains outstanding |
| SEC-04 | 01-02, 01-03 | Docs match code exactly, no phantom mechanism, no disabled-claim, no query-string bypass | ✓ SATISFIED | All three docs corrected and cross-checked against `lib/auth`/`lib/models/admin.ts` |

No orphaned requirements — REQUIREMENTS.md traceability table maps SEC-01 through SEC-04 to Phase 1 only, and all four appear in a plan's `requirements:` frontmatter.

### Anti-Patterns Found

None. Scanned all files touched by this phase (`lib/auth/deployment-guard.ts`, `lib/auth/admin-middleware.ts`, `lib/auth/unified-auth.ts`, `middleware.ts`, `lib/observability/telemetry.ts`, `workers/observability-tail/src/core.ts`, all four test files, `docs/admin-authentication.md`, `docs/CLAUDE.md`, `docs/DEPLOYMENT_SETUP.md`, `components/admin/AdminGuard.tsx`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` — zero matches.

The one accepted, previously-reviewed deferral (WR-04, `AdminGuard.tsx` client-side dev-bypass not covered by the server-side guard) is logged in `deferred-items.md` with an explicit locked-decision rationale (server-side middleware independently blocks `/admin` and `/api/admin`; residual is a cosmetic nav-link exposure, not a data exposure). Per this verification's instructions, WR-04 is treated as an accepted deferral, not a gap.

### Human Verification Required

### 1. Confirm the deployment guard is live (not silently inert) on the next real production deploy

**Test:** Deploy a build with `NODE_ENV=development` to the live/staging Cloudflare Worker (or otherwise directly observe `navigator.userAgent` inside the running Worker with `nodejs_compat` enabled) and request `/admin` or `/api/admin`. Separately confirm a correctly-built production deploy serves those routes normally.
**Expected:** The misbuilt-development deploy returns HTTP 503 with `Service temporarily unavailable.`; the correct production deploy serves admin routes normally.
**Why human:** This is plan `01-02`'s own flagged backstop assumption (RESEARCH.md Assumption A1, `verification: backstop` in the plan's must_haves): whether `navigator.userAgent` resolves to exactly `'Cloudflare-Workers'` inside the deployed OpenNext Worker bundle when `nodejs_compat` is enabled. Nothing in this codebase establishes or falsifies this — it is Cloudflare Workers platform behavior, not observable from a local machine, from vitest (`environment: 'node'`), or from reading source. The `docs/admin-authentication.md` Deployment Safety section already documents this exact check as a required first-deploy confirmation step for whoever performs the next production deploy.

### Gaps Summary

No gaps. All 4 roadmap success criteria and 36 of 37 plan-level must-haves are verified against the actual codebase, live probes, and a full green test/lint/typecheck run. The single unresolved item is a documented, unavoidable backstop assumption about Cloudflare Workers runtime behavior that the phase's own plans correctly flagged as unverifiable by an executor and routed to a human confirmation step on the next real deploy — it is not a code defect, missing artifact, or broken wiring.

---

_Verified: 2026-09-02T08:00:00Z_
_Verifier: Claude (gsd-verifier)_

## Human Verification Resolution (2026-09-02)

The single `human_needed` item (guard live inside the deployed OpenNext bundle) was resolved by Russell's decision to accept static bundle evidence gathered by the orchestrator:

- A fresh `npm run build:worker` (OpenNext) bundle contains the guard (`deployment_guard_tripped` present in `.open-next/middleware/handler.mjs` and server route bundles).
- No code in `.open-next/server-functions`, `.open-next/middleware`, `.open-next/worker.js`, or `.open-next/cloudflare` assigns, declares, or `defineProperty`s a global `navigator`; the only `navigator` binding is a module-local const inside bundled jsdom.
- `wrangler.jsonc` compatibility date is 2026-08-01; workerd enables `global_navigator` for any date on or after 2022-03-21, so `navigator.userAgent === "Cloudflare-Workers"` in the deployed runtime. `nodejs_compat` does not remove it.

A live dev-build deploy was not performed. The first-deploy confirmation step remains documented in `docs/admin-authentication.md` for whoever next deploys a non-production build.

Status set to `passed` on that basis.
