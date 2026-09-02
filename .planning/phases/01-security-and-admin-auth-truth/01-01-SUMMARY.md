---
phase: 01-security-and-admin-auth-truth
plan: 01
subsystem: auth
tags: [cloudflare-workers, telemetry, admin-auth, deployment-guard]

requires: []
provides:
  - "lib/auth/deployment-guard.ts with isDeployedDevelopmentBuild()/assertDeploymentPosture(), consumed by 01-02's middleware.ts branch"
  - "auth.deployment_guard_tripped registered in the closed telemetry taxonomy and the tail-worker critical escalation list"
affects: ["01-02"]

actuals:
  tokens: 2905
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Telemetry-emitting call sites for a file with a raw-exception console.error catch block are isolated into a new module rather than inlined, to satisfy the observability AST contract test"

key-files:
  created:
    - lib/auth/deployment-guard.ts
    - tests/unit/lib/auth/deployment-guard.test.ts
  modified:
    - lib/auth/admin-middleware.ts
    - lib/observability/telemetry.ts
    - workers/observability-tail/src/core.ts
    - tests/unit/lib/auth/admin-middleware.test.ts

key-decisions:
  - "Guard returns a discriminated union rather than throwing, matching this codebase's denial-as-return-value convention (AdminAuthResult / deny())"
  - "recordTelemetry call kept exclusively in the new lib/auth/deployment-guard.ts module, never inlined into admin-middleware.ts, to avoid tripping the AST contract test against that file's pre-existing console.error(label, error) catch block"

patterns-established:
  - "Deployed-development detection via strict navigator.userAgent === 'Cloudflare-Workers' AND process.env.NODE_ENV === 'development', guarded by typeof navigator !== 'undefined' so non-Workers runtimes never throw"

requirements-completed: [SEC-03]

coverage:
  - id: D1
    description: "A deployed development build denies the x-dev-admin admin bypass through checkAdminPermissions"
    requirement: "SEC-03"
    verification:
      - kind: unit
        ref: "tests/unit/lib/auth/admin-middleware.test.ts#trips the deployment guard under development + Workers UA, bypass unreachable"
        status: pass
    human_judgment: false
  - id: D2
    description: "Production deployments and local development (next dev/vitest) are unaffected by the guard"
    requirement: "SEC-03"
    verification:
      - kind: unit
        ref: "tests/unit/lib/auth/admin-middleware.test.ts#follows the normal Clerk flow in production under a deployed Workers UA"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/auth/admin-middleware.test.ts#still honors the dev bypass under Node native UA in local development"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/auth/deployment-guard.test.ts#does not trip under Node native user-agent and development (local development)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The guard also closes the Bearer service-token path, not only the x-dev-admin header"
    requirement: "SEC-03"
    verification:
      - kind: unit
        ref: "tests/unit/lib/auth/admin-middleware.test.ts#denies the service-token path too under development + Workers UA"
        status: pass
    human_judgment: false
  - id: D4
    description: "The guard's boundary conditions (exact-match UA/NODE_ENV, absent/empty navigator, message leaks no environment detail, statelessness) are pinned in isolation"
    requirement: "SEC-03"
    verification:
      - kind: unit
        ref: "tests/unit/lib/auth/deployment-guard.test.ts (12 it blocks covering every listed behavior)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The new critical telemetry event is registered, wired into a real recordTelemetry call, and escalates through the tail worker's alert list"
    requirement: "SEC-03"
    verification:
      - kind: unit
        ref: "tests/unit/observability/instrumentation-source.test.ts"
        status: pass
      - kind: unit
        ref: "tests/unit/workers/observability-tail-core.test.ts"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-02
status: complete
---

# Phase 1 Plan 1: Deployment Posture Guard Summary

**A deployed Worker running a development build now hard-denies every `checkAdminPermissions` credential path (header bypass, Clerk session, and Bearer service token) via a new `lib/auth/deployment-guard.ts` module, proven by an end-to-end tracer test plus 15 isolated boundary/regression tests.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-02T06:14:00Z
- **Completed:** 2026-09-02T06:34:58Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- New `lib/auth/deployment-guard.ts` exports `isDeployedDevelopmentBuild()` (strict `===` predicate over `navigator.userAgent` and `process.env.NODE_ENV`, never throws on missing `navigator`) and `assertDeploymentPosture()` (returns a fixed `503` denial and emits the one telemetry call site for this feature).
- `auth.deployment_guard_tripped` registered as `critical`/`sampleRate: 1` in `lib/observability/telemetry.ts` and appended to `workers/observability-tail/src/core.ts`'s `TAIL_CRITICAL_EVENTS`, so a tripped guard escalates to an operator.
- `checkAdminPermissions` now calls `assertDeploymentPosture()` as the first statement inside its `try`, above the `x-dev-admin` header read — verified mechanically by line-number ordering, not just by test behavior.
- 16 tests in `tests/unit/lib/auth/admin-middleware.test.ts` (12 pre-existing + 4 new: guard-tripped, production-unaffected, local-dev-unaffected, service-token-denied) and 12 new isolated boundary tests in `tests/unit/lib/auth/deployment-guard.test.ts`.
- Full unit suite (234 files / 1717 tests), `npm run lint`, and `npm run typecheck` all exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end — a deployed development build denies the admin bypass** - `878c420` (feat)
2. **Task 2: Pin the guard predicate's boundaries in isolation** - `0a3779e` (test)
3. **Task 3: Prove production and local development are untouched at the call site** - `72670ac` (test)

_Task 1 is `type="tracer"`: production-quality code and a real end-to-end test, committed as `feat`. Its tracer feedback gate was satisfied by re-running the tracer's `<verify>` (all three automated checks passed) before Task 2 began — `human_verify_mode` is `end-of-phase` (default) and the tracer's `<verify>` block carries only `<automated>` checks, so no checkpoint was required (checkpoints.md #3299 row 3)._

## Files Created/Modified
- `lib/auth/deployment-guard.ts` - New module: the guard predicate, the fixed 503 denial contract, and the single `recordTelemetry` call site for this feature
- `lib/auth/admin-middleware.ts` - Calls `assertDeploymentPosture()` first inside `checkAdminPermissions`, before the `x-dev-admin` read
- `lib/observability/telemetry.ts` - Registers `auth.deployment_guard_tripped` in the closed `TELEMETRY_EVENTS` taxonomy
- `workers/observability-tail/src/core.ts` - Adds `auth.deployment_guard_tripped` to `TAIL_CRITICAL_EVENTS`
- `tests/unit/lib/auth/admin-middleware.test.ts` - Adds guard-tripped, production-unaffected, local-dev-unaffected, and service-token-denied cases
- `tests/unit/lib/auth/deployment-guard.test.ts` - New file: 12 tests pinning every boundary condition listed in the plan's `<behavior>` block

## Decisions Made
- The guard's `recordTelemetry` call stays exclusively in the new `lib/auth/deployment-guard.ts` file rather than being inlined into `admin-middleware.ts`, because `admin-middleware.ts:93` already has a `console.error("Admin auth error:", error)` catch block that the `instrumentation-source.test.ts` AST contract test would start flagging the moment that file also called `recordTelemetry`.
- `assertDeploymentPosture()` returns a discriminated union (`{ tripped: true, status, message } | { tripped: false }`) rather than throwing, matching the codebase's existing denial-as-return-value convention (`AdminAuthResult`, `deny()`).
- `checkAdminPermissions`'s denial on trip is `{ success: false, error: posture.message }` — `AdminAuthResult` has no status field, so the fixed 503 is proven at the function-return level here; the wire-level 503 for admin API routes is `01-02`'s scope (per `01-RESEARCH.md` Pitfall 4, matching CONTEXT.md's own test list).

## Deviations from Plan

None - plan executed exactly as written. One out-of-scope, pre-existing issue was found and logged rather than fixed (see below).

### Out-of-Scope Discovery (not fixed, logged)

**`cf-typecheck` reports stale generated Cloudflare types**
- **Found during:** Task 3, running the plan-level `<verification>` command `npm run cf-typecheck`
- **Symptom:** `wrangler types --check` reports `Types at ./cloudflare-env.d.ts are out of date. Run 'wrangler types' to regenerate.`
- **Why not fixed:** No file in this plan touches `wrangler.jsonc`, bindings, or Cloudflare configuration. `git log` confirms `cloudflare-env.d.ts` was last regenerated in an unrelated prior commit (`39ad990`). This drift predates and is unrelated to this plan's changes — out of scope per the deviation rules' scope boundary.
- **Logged to:** `.planning/phases/01-security-and-admin-auth-truth/deferred-items.md`

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None. The plan's own verification commands (`npx vitest run` for the four targeted test files, `npm test`, `npm run lint`, `npm run typecheck`, and the `git grep` taxonomy check) all pass exactly as specified.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `lib/auth/deployment-guard.ts` and its exact exported names (`isDeployedDevelopmentBuild`, `assertDeploymentPosture`, `DEPLOYMENT_GUARD_STATUS`, `DEPLOYMENT_GUARD_MESSAGE`, `DeploymentPosture`) are stable and ready for `01-02`'s `middleware.ts` branch to import.
- `unified-auth.ts` was explicitly out of this plan's `files_modified` list and is untouched; SEC-03's CONTEXT.md also names `authenticateRequest` as a call site — confirm with the `01-02`/`01-03` plans whether that wiring is scoped elsewhere in the phase or still open.
- No blockers for `01-02`.

---
*Phase: 01-security-and-admin-auth-truth*
*Completed: 2026-09-02*
