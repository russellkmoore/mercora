---
phase: 01-security-and-admin-auth-truth
plan: 02
subsystem: auth
tags: [cloudflare-workers, middleware, admin-auth, deployment-guard, telemetry, documentation]

requires:
  - phase: 01-security-and-admin-auth-truth
    provides: "lib/auth/deployment-guard.ts with isDeployedDevelopmentBuild()/assertDeploymentPosture(), DEPLOYMENT_GUARD_STATUS/MESSAGE, and auth.deployment_guard_tripped registered in the closed telemetry taxonomy (01-01)"
provides:
  - "authenticateRequest (lib/auth/unified-auth.ts) returns a real HTTP 503 for every credential path in a deployed development build"
  - "middleware.ts returns a real HTTP 503 at the edge for /admin and /api/admin when the guard is tripped, storefront unaffected"
  - "docs/admin-authentication.md Deployment Safety section and docs/DEPLOYMENT_SETUP.md pointer for operators"
affects: []

actuals:
  tokens: 6100
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "middleware.ts guard branch runs before the static-asset skip and the pre-existing pathname short-circuit, scoped narrowly to /admin and /api/admin so the storefront and /api/mcp are never touched"

key-files:
  created:
    - tests/unit/app/admin-guard-middleware.test.ts
  modified:
    - lib/auth/unified-auth.ts
    - middleware.ts
    - tests/unit/lib/auth/unified-auth.test.ts
    - docs/admin-authentication.md
    - docs/DEPLOYMENT_SETUP.md

key-decisions:
  - "assertDeploymentPosture() is the first statement inside authenticateRequest's try, above extractToken(request), reusing the existing deny(status, message) helper so every caller gets a real 503 with no caller edits"
  - "middleware.ts guard branch placed immediately after pathname is read and before the static-asset skip, scoped only to /admin and /api/admin (not /api/mcp), so the ordering contract is trivially assertable and the guard cannot be reordered past the existing short-circuit by accident"
  - "docs/admin-authentication.md Deployment Safety section states the residual 401-vs-503 difference for the six checkAdminPermissions callers outside app/api/admin explicitly, rather than overclaiming uniform 503 coverage"

patterns-established: []

requirements-completed: [SEC-03, SEC-04]

coverage:
  - id: D1
    description: "authenticateRequest denies every credential path (no credentials, valid Bearer service token, signed-in Clerk user) with a real 503 under a deployed development build, and is unaffected in production or local development"
    requirement: "SEC-03"
    verification:
      - kind: unit
        ref: "tests/unit/lib/auth/unified-auth.test.ts (6 new it blocks: no-credentials 503, Bearer-token-precedes-guard 503, Clerk-user-unreachable 503, production unaffected, local-dev unaffected, 503 body equals DEPLOYMENT_GUARD_MESSAGE)"
        status: pass
      - kind: other
        ref: "awk ordering check: assertDeploymentPosture() appears before extractToken(request) in lib/auth/unified-auth.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "middleware.ts returns a real HTTP 503 for /admin and /api/admin when the guard is tripped, before the existing admin short-circuit, while the storefront and product pages are unaffected"
    requirement: "SEC-04"
    verification:
      - kind: unit
        ref: "tests/unit/app/admin-guard-middleware.test.ts (7 it blocks: /api/admin 503, /admin 503, storefront root unaffected, product path unaffected, untripped short-circuit still 200, body equals DEPLOYMENT_GUARD_MESSAGE, source-order contract)"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/admin-authentication.md and docs/DEPLOYMENT_SETUP.md describe the guard as shipped: what trips it, what the operator sees, how to recover, the first-deploy confirmation step, and the residual 401-vs-503 status-code difference"
    requirement: "SEC-04"
    verification:
      - kind: other
        ref: "grep -q 'Deployment Safety'/'assertDeploymentPosture'/'deployment-guard'/'auth.deployment_guard_tripped' docs/admin-authentication.md; grep -q '503'/'admin-authentication.md' docs/DEPLOYMENT_SETUP.md; git grep credential-header/query-string checks"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full CI parity is green after the wire-level and documentation changes"
    verification:
      - kind: unit
        ref: "npm test (235 files / 1730 tests)"
        status: pass
      - kind: other
        ref: "npm run lint"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: false
  - id: D5
    description: "navigator.userAgent reads the Cloudflare Workers value inside the deployed OpenNext bundle even with nodejs_compat enabled, so the guard is live in production and not silently inert"
    requirement: "SEC-04"
    verification: []
    human_judgment: true
    rationale: "This is the plan's own flagged 'backstop' must_have (RESEARCH.md Assumption A1) — not falsifiable from a unit test or from this local session. Mitigated by documenting a first-deploy confirmation step in docs/admin-authentication.md's Deployment Safety section: an operator must observe that a correct production deploy serves admin routes normally while a deliberately-misbuilt one returns 503. Requires a live-deploy human check, not available to this executor."

duration: 35min
completed: 2026-09-02
status: complete
---

# Phase 1 Plan 2: Deployment Guard Wire-Up and Operator Documentation Summary

**`authenticateRequest` and `middleware.ts` now both fail closed with a real HTTP 503 on a deployed development build — the last two open choke points from `01-01` — and `docs/admin-authentication.md`/`docs/DEPLOYMENT_SETUP.md` document the guard as shipped, including the residual 401-vs-503 status-code gap for six non-`/api/admin` callers.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-02T00:17:00Z
- **Completed:** 2026-09-02T00:22:00Z
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- `lib/auth/unified-auth.ts`'s `authenticateRequest` calls `assertDeploymentPosture()` as the first statement in its `try`, above `extractToken(request)`, so the guard precedes the service-token path, the database-token path, and the Clerk-user-as-admin development shortcut alike. Reuses the existing `deny(status, message)` helper — no caller of `authenticateRequest` needed changes to receive a genuine 503.
- Six new tests in `tests/unit/lib/auth/unified-auth.test.ts` pin the guard's behavior: denial with no credentials, denial with a valid Bearer service token (proving the guard runs before token extraction), denial for a signed-in Clerk user (proving the dev-admin shortcut is unreachable), and confirmation that production and local development (Node's native `navigator.userAgent`) are unaffected; a sixth test asserts the 503 body's `error` field equals `DEPLOYMENT_GUARD_MESSAGE`.
- `middleware.ts` gained a guard branch scoped to `/admin` and `/api/admin`, placed immediately after `pathname` is read and before both the static-asset skip and the pre-existing unconditional `NextResponse.next()` short-circuit for those two prefixes. A tripped posture returns a plain-text 503 with the shared message and a `Retry-After: 3600` header; deliberately not applied to `/api/mcp`, which stays out of scope for this phase.
- New `tests/unit/app/admin-guard-middleware.test.ts` (7 cases) proves: `/api/admin` and `/admin` return 503 when tripped; `/` and a product path are untouched even while tripped; the untripped short-circuit still returns its normal 200; the 503 body equals `DEPLOYMENT_GUARD_MESSAGE`; and a source-order contract (read via `readFileSync`, following the `redirect-middleware-source.test.ts` pattern) confirms `assertDeploymentPosture()` appears before the existing short-circuit's `NextResponse.next()` line.
- `docs/admin-authentication.md` gained a "🛡️ Deployment Safety" section immediately before "🚨 Security Considerations": what trips the guard, what the operator sees (503, the fixed message, the `auth.deployment_guard_tripped` telemetry event), how to recover (redeploy a production build), a first-deploy confirmation step for the `navigator.userAgent` assumption flagged in `01-RESEARCH.md`, and the residual 401-vs-503 status-code difference for the six `checkAdminPermissions` callers outside `app/api/admin/`.
- `docs/DEPLOYMENT_SETUP.md`'s "Step 2: Deploy and Index Content" block gained one line pointing at the guard and `docs/admin-authentication.md` for recovery.
- Full unit suite (235 files / 1730 tests), `npm run lint`, `npm run typecheck`, and `npm run build` all exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Guard authenticateRequest and return a real 503 on the wire** - `dead469` (feat)
2. **Task 2: Return 503 at the edge for admin routes without touching the storefront** - `881895c` (feat)
3. **Task 3: Document the guard for the operator** - `583a82e` (docs)

**Plan metadata:** committed separately per `<final_commit>` (SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md).

## Files Created/Modified
- `lib/auth/unified-auth.ts` - Calls `assertDeploymentPosture()` first inside `authenticateRequest`'s `try`, above token extraction
- `middleware.ts` - New guard branch scoped to `/admin`/`/api/admin`, before the static-asset skip and the existing short-circuit
- `tests/unit/lib/auth/unified-auth.test.ts` - Adds six deployment-guard behavior cases and imports `DEPLOYMENT_GUARD_MESSAGE` for the body assertion
- `tests/unit/app/admin-guard-middleware.test.ts` - New file: 7 tests covering the middleware guard's behavior and source ordering
- `docs/admin-authentication.md` - New "Deployment Safety" section
- `docs/DEPLOYMENT_SETUP.md` - One line pointing at the guard in the indexing step

## Decisions Made
- Reused `unified-auth.ts`'s existing `deny(status, message)` helper for the guard denial rather than constructing a new response shape, since it already threads a caller-specified status end to end through `NextResponse.json`.
- Scoped the `middleware.ts` guard branch to exactly `/admin` and `/api/admin` (not `/api/mcp`), matching the plan's explicit exclusion and keeping the guard's blast radius provably narrow.
- Stated the residual 401-vs-503 status-code gap for the six non-`/api/admin` `checkAdminPermissions` callers explicitly in `docs/admin-authentication.md`, rather than letting the Deployment Safety section imply uniform 503 coverage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed a TS18046 typecheck failure surfaced by Task 2's typecheck gate, in a Task 1 test file**
- **Found during:** Task 2, running `npm run typecheck` as part of the plan's `<verify>` block
- **Issue:** `const body = await result.response!.json();` in `tests/unit/lib/auth/unified-auth.test.ts` (added in Task 1) inferred `body` as `unknown` under this project's `tsc` configuration, so `body.error` failed to compile.
- **Fix:** Added an explicit type assertion: `const body = (await result.response!.json()) as { error: string };`
- **Files modified:** tests/unit/lib/auth/unified-auth.test.ts
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** 881895c (Task 2 commit, since it was surfaced by Task 2's verification gate)

**2. [Rule 3 - Blocking] Fixed a source-contract search string false match in the new middleware test**
- **Found during:** Task 2, first run of `tests/unit/app/admin-guard-middleware.test.ts`
- **Issue:** The source-order test's search string for the existing short-circuit (`"pathname.startsWith('/admin') ||"`) also matched the new guard's own conditional on line 78 (`if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin'))`), which appears before the short-circuit — causing a false failure that made it look like the guard ran after the short-circuit.
- **Fix:** Changed the search string to the short-circuit-only substring `"pathname.startsWith('/api/mcp')"`, which appears nowhere else in the file.
- **Files modified:** tests/unit/app/admin-guard-middleware.test.ts
- **Verification:** Test passes; the ordering assertion now correctly measures guard-line-index versus short-circuit-line-index.
- **Committed in:** 881895c (Task 2 commit)

**3. [Rule 3 - Blocking] Cast the middleware default export back to its runtime call shape for the test file**
- **Found during:** Task 2, running `npm run typecheck`
- **Issue:** The mocked `clerkMiddleware` returns the inner `(auth, req)` handler unchanged at runtime, but TypeScript still type-checks the import against the real `clerkMiddleware` return type (`NextMiddleware`, taking `(request, event)`), so passing `{}` as the first argument failed to compile.
- **Fix:** Added `const middleware = middlewareImport as unknown as (auth: unknown, req: NextRequest) => Promise<NextResponse>;` matching the documented mock-set behavior from `01-RESEARCH.md`/`01-PATTERNS.md`.
- **Files modified:** tests/unit/app/admin-guard-middleware.test.ts
- **Verification:** `npm run typecheck` exits 0; all 7 tests pass at runtime.
- **Committed in:** 881895c (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking typecheck/test-correctness issues discovered while running the plan's own verification commands, all confined to test files this plan already owns)
**Impact on plan:** No scope creep. All three fixes were required for the plan's own acceptance criteria (`npm run typecheck` exit 0) to pass and were confined to the test files the plan's `files_modified` list already names.

## Issues Encountered
None beyond the three auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both remaining open choke points from `01-01` (`authenticateRequest`'s Clerk-user-as-admin shortcut, `middleware.ts`'s unconditional admin bypass) are now closed with a real HTTP 503.
- All four plans in Phase 1 (01, 02, 03, 04) are now complete. SEC-01 through SEC-04 are all satisfied: no literal credential remains in tracked docs, the production `ADMIN_VECTORIZE_TOKEN` is rotated, a deployed development build fails closed at every admin/service-token entry point (function-return level in `admin-middleware.ts`, real HTTP 503 in `unified-auth.ts` and at the edge in `middleware.ts`), and the operator documentation matches the shipped code including the residual status-code gap.
- The `navigator.userAgent`-inside-`nodejs_compat` assumption (D5 above, RESEARCH.md Assumption A1) remains a live-deploy human verification, not resolvable by this executor; the first-deploy confirmation step is now documented in `docs/admin-authentication.md` for whoever performs the next production deploy.
- No blockers for phase completion.

---
*Phase: 01-security-and-admin-auth-truth*
*Completed: 2026-09-02*

## Self-Check: PASSED

- `lib/auth/unified-auth.ts` contains `assertDeploymentPosture()` before `extractToken(request)` — FOUND (verified by awk check above)
- `middleware.ts` contains exactly one `assertDeploymentPosture()` call — FOUND
- `tests/unit/app/admin-guard-middleware.test.ts` — FOUND (7 `it(` blocks)
- `docs/admin-authentication.md` contains "Deployment Safety" section naming `assertDeploymentPosture`, `deployment-guard`, `503`, `auth.deployment_guard_tripped` — FOUND
- `docs/DEPLOYMENT_SETUP.md` names `503` and references `admin-authentication.md` — FOUND
- Commit `dead469` — FOUND in git log
- Commit `881895c` — FOUND in git log
- Commit `583a82e` — FOUND in git log
- `npm test` (235/235 files), `npm run lint`, `npm run typecheck`, `npm run build` — all exit 0
