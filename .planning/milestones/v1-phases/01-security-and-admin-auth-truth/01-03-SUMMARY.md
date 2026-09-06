---
phase: 01-security-and-admin-auth-truth
plan: 03
subsystem: docs
tags: [documentation, admin-auth, credential-scrub]

requires:
  - phase: 01-security-and-admin-auth-truth
    provides: "lib/auth/deployment-guard.ts (01-01) — the enforced mechanism these docs now describe"
provides:
  - "docs/CLAUDE.md, docs/admin-authentication.md, docs/DEPLOYMENT_SETUP.md corrected to match lib/auth/admin-middleware.ts, lib/auth/unified-auth.ts, and lib/models/admin.ts"
  - "Published admin token literal removed from the tracked source tree outside .planning/"
  - "components/admin/AdminGuard.tsx comment corrected to name the real production check"
affects: ["01-04"]

actuals:
  tokens: 3014
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Documentation corrections verified with git grep negative/positive control pairs rather than prose review alone"

key-files:
  created: []
  modified:
    - docs/CLAUDE.md
    - docs/admin-authentication.md
    - docs/DEPLOYMENT_SETUP.md
    - components/admin/AdminGuard.tsx

key-decisions:
  - "Rewrote the whole docs/CLAUDE.md 'Authentication System' section (through its 'Important Notes for Developers' subsection) rather than only the range the plan named, because that trailing subsection also asserted admin endpoints work without authentication — leaving it would have violated the plan's own truth that no document claims admin auth is switched off"
  - "In docs/admin-authentication.md, also corrected two prose bullets ('Role-Based Access Control' and 'Authentication Methods') that described a 'user ID whitelist' without naming ADMIN_USER_IDS literally — the plan designates this file the single source of truth, and those bullets described a mechanism the code does not have"

requirements-completed: [SEC-01, SEC-04]

coverage:
  - id: D1
    description: "No literal admin credential value remains in the tracked source tree outside .planning/"
    requirement: "SEC-01"
    verification:
      - kind: other
        ref: "git grep -q ADMIN_VECTORIZE_TOKEN -- docs/ && ! git grep -q voltique-admin -- ':!.planning'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every documented credential example under docs/ uses a header (Authorization: Bearer, X-API-Key, or x-dev-admin); no query-string credential form remains"
    requirement: "SEC-04"
    verification:
      - kind: other
        ref: "git grep -q 'Authorization: Bearer' -- docs/ && ! git grep -q -e '?token=' -e '?dev=' -- docs/"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/admin-authentication.md describes the real admin mechanism (isUserAdmin / adminUsers table, Clerk role fallback) and names no ADMIN_USER_IDS allowlist anywhere in docs/, components/, lib/, or app/"
    requirement: "SEC-04"
    verification:
      - kind: other
        ref: "git grep -q adminUsers -- docs/ components/ && ! git grep -q ADMIN_USER_IDS -- docs/ components/ lib/ app/"
        status: pass
    human_judgment: false
  - id: D4
    description: "No document under docs/ claims admin authentication is switched off"
    requirement: "SEC-04"
    verification:
      - kind: other
        ref: "git grep -q checkAdminPermissions -- docs/ && ! git grep -qi -e 'temporarily disabled' -e 'currently disabled' -e 'disabled for dev' -- docs/"
        status: pass
    human_judgment: false
  - id: D5
    description: "No code, doc, lint, or type regression introduced by the documentation edits"
    verification:
      - kind: unit
        ref: "npm test (234 files / 1717 tests)"
        status: pass
      - kind: other
        ref: "npm run lint"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-09-02
status: complete
---

# Phase 1 Plan 3: Admin-Auth Documentation Truth Summary

**Scrubbed the published `voltique-admin` token from `docs/CLAUDE.md`, replaced every URL-query credential example across three docs with header forms, and rewrote `docs/admin-authentication.md` to describe the real `isUserAdmin`/`adminUsers` mechanism instead of the phantom `ADMIN_USER_IDS` environment variable.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-02T06:20:00Z (approx.)
- **Completed:** 2026-09-02T06:44:26Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `docs/CLAUDE.md` no longer publishes the live admin token; the value is replaced by the `<ADMIN_VECTORIZE_TOKEN>` placeholder, and every "disabled for dev" claim (project-structure comments, Authentication Status bullets, and the full Authentication System section) is replaced with an accurate ~10-line description pointing at `docs/admin-authentication.md`.
- Every documented vectorize/admin credential example across `docs/CLAUDE.md` and `docs/DEPLOYMENT_SETUP.md` now uses an `Authorization: Bearer` header instead of a `?token=` query parameter; no example was deleted without a working replacement.
- `docs/admin-authentication.md` — designated the single source of truth by Task 1 — now describes production admin access exactly as the code enforces it: `isUserAdmin()` against the `adminUsers` D1 table, with a Clerk `sessionClaims.metadata.role === "admin"` fallback. The phantom `ADMIN_USER_IDS` environment variable is gone from its production-check snippet, environment-variable table, Production Setup steps, security warning, and two prose bullets that described a "user ID whitelist" without naming it.
- The one development-testing example that sent the bypass value as a query parameter (`?dev=mercora-dev-bypass`) now uses `-H "x-dev-admin: <DEV_ADMIN_BYPASS_TOKEN>"`, with a sentence noting it only works under `NODE_ENV=development`.
- `docs/DEPLOYMENT_SETUP.md`'s indexing step now gives an operator one working authenticated `curl` command instead of an unauthenticated example plus a rejected query-parameter example.
- `components/admin/AdminGuard.tsx`'s header comment no longer names `ADMIN_USER_IDS` — the last reference to the phantom variable in tracked application source.
- The migration-history section in `docs/admin-authentication.md` still documents what the superseded implementation did, but as prose rather than a present-tense code snippet, so it no longer trips the "claims auth is disabled" search.

## Task Commits

Each task was committed atomically:

1. **Task 1: Correct docs/CLAUDE.md — six regions** - `afe6c28` (docs)
2. **Task 2: Correct docs/admin-authentication.md — the source of truth** - `711da37` (docs)
3. **Task 3: Correct the deploy runbook and the one stale source comment** - `ec7b25b` (docs)

## Files Created/Modified
- `docs/CLAUDE.md` - Removed published token, rewrote disabled-auth claims, converted credential examples to header form
- `docs/admin-authentication.md` - Replaced ADMIN_USER_IDS with isUserAdmin/adminUsers everywhere, header-form dev bypass, corrected security warning
- `docs/DEPLOYMENT_SETUP.md` - One working authenticated vectorize curl example, replacing the disabled-auth comment and two broken examples
- `components/admin/AdminGuard.tsx` - Corrected the header comment naming the real production admin check

## Decisions Made
- Extended the docs/CLAUDE.md "Authentication System" section rewrite to include its trailing "Important Notes for Developers" subsection (not explicitly itemized in the plan's line list), because that subsection also claimed admin endpoints work without authentication in production — leaving it would have left a "switched off" claim in the file the task was meant to clear.
- Extended the docs/admin-authentication.md corrections to two prose bullets ("Role-Based Access Control", "Authentication Methods") that referenced a "user ID whitelist" without the literal `ADMIN_USER_IDS` string — corrected them to name the real mechanism since the plan designates this file the authoritative source and instructed "it has to be right."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended docs/CLAUDE.md section replacement to cover a trailing subsection with the same defect**
- **Found during:** Task 1
- **Issue:** The plan's line range (190-204) for the Authentication System rewrite did not include the file's "Important Notes for Developers" subsection (then at ~lines 213-218), which separately asserted "All admin endpoints work without authentication" and "Never deploy to production with authentication disabled" — the same class of false claim the task exists to remove.
- **Fix:** Replaced the entire section including that subsection with the accurate summary and pointer.
- **Files modified:** docs/CLAUDE.md
- **Verification:** `git grep -qi -e "temporarily disabled" -e "currently disabled" -e "disabled for dev" -- docs/CLAUDE.md` returns no matches.
- **Committed in:** afe6c28 (Task 1 commit)

**2. [Rule 1 - Bug] Corrected two unlabeled "user ID whitelist" bullets in docs/admin-authentication.md**
- **Found during:** Task 2
- **Issue:** Two prose bullets ("Role-Based Access Control" under Security Layers, and "Authentication Methods" under Implementation Details) described production access control as "admin role or whitelisted user IDs" / "admin role or user ID whitelist" — not a literal `ADMIN_USER_IDS` match, so it would not fail the plan's grep-based acceptance criteria, but still describing a mechanism the code does not have in the file the plan designates as the single source of truth.
- **Fix:** Reworded both bullets to name the real mechanism (Clerk admin role or an active `adminUsers` table row).
- **Files modified:** docs/admin-authentication.md
- **Verification:** Manual read of the corrected file; the acceptance grep still passes with no ADMIN_USER_IDS matches anywhere in docs/.
- **Committed in:** 711da37 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs adjacent to but outside the plan's literal line/string list, within the same files and tasks already being corrected)
**Impact on plan:** Both auto-fixes are documentation-truth corrections that a narrower reading of the plan's line numbers would have missed while leaving a "switched off" or phantom-mechanism claim in place. No scope creep — no additional files were touched.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All six `<verification>` commands from the plan pass: the two `git grep` credential-scrub checks, the header-form check, the `adminUsers`/`ADMIN_USER_IDS` check, the `x-dev-admin`/`mercora-dev-bypass` check, the disabled-claim check, and `npm run lint && npm run typecheck && npm test` (234 files / 1717 tests, 0 errors).
- `lib/auth/admin-middleware.ts:22`'s `mercora-dev-bypass` literal was deliberately left untouched, per the locked 2026-09-01 decision; the `x-dev-admin` code path is unchanged.
- `migrations/0002_add_admin_users.sql:3`'s historical note was deliberately left untouched; migration files are immutable.
- No blockers for `01-04` (token rotation). `01-04` should still confirm the live `ADMIN_VECTORIZE_TOKEN` matches the now-removed `voltique-admin` value before rotating, per its own plan.

---
*Phase: 01-security-and-admin-auth-truth*
*Completed: 2026-09-02*

## Self-Check: PASSED
