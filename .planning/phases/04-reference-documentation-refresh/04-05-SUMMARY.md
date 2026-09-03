---
phase: 04-reference-documentation-refresh
plan: 05
subsystem: infra
tags: [dependency-security, npm-audit, ci, next-16, docs]

requires:
  - phase: 04-reference-documentation-refresh
    provides: "Next 16.3.1 already installed and in production use prior to this plan"
provides:
  - "CI production dependency audit gate raised from critical to high"
  - "docs/dependency-security.md refreshed to describe the current dependency posture"
affects: []

actuals:
  tokens: 2468
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - docs/dependency-security.md

key-decisions:
  - "Raised CI's production dependency audit gate to --audit-level=high after proving it passes locally (exit 0, 0 findings)"
  - "Closed both Next-bundled production exceptions (PostCSS, Sharp) with dated markers and re-observed version evidence rather than carrying forward the 2026-08-11 baseline numbers"
  - "Sharp resolves from a top-level hoisted node_modules/sharp at 0.35.3 (confirmed via require.resolve), correcting the prior briefing's claim that it does not resolve"

patterns-established: []

requirements-completed: [DEP-01]

coverage:
  - id: D1
    description: "CI's production dependency audit runs at --audit-level=high; no --audit-level=critical remains"
    requirement: "DEP-01"
    verification:
      - kind: other
        ref: "npm audit --omit=dev --audit-level=high (exit 0)"
        status: pass
      - kind: other
        ref: "grep -c 'audit-level=high' .github/workflows/ci.yml == 1; grep -c 'audit-level=critical' == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Raised gate proven to pass locally before the CI change was committed, with exit code recorded"
    requirement: "DEP-01"
    verification:
      - kind: other
        ref: "npm audit --omit=dev --audit-level=high run before editing ci.yml, exit code 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both Next-bundled production exceptions closed with dated exit-condition-met markers in a Closed exceptions subsection"
    requirement: "DEP-01"
    verification:
      - kind: other
        ref: "grep -c '## Closed exceptions' docs/dependency-security.md == 1; grep -c 'Closed:** exit condition met 2026-09-02' == 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "Status header records re-run date, Node/npm versions, installed Next/PostCSS versions, and audit totals"
    requirement: "DEP-01"
    verification:
      - kind: other
        ref: "grep header fields (Re-run date, Node, npm, Installed Next, Installed PostCSS, owners) all present"
        status: pass
    human_judgment: false
  - id: D5
    description: "Development-only findings refreshed from a full-tree audit run in the same session, listed with severity and package path"
    requirement: "DEP-01"
    verification:
      - kind: other
        ref: "npm audit --json (full tree) run this session: 5 moderate findings, each traced to esbuild/drizzle-kit or qs/@opennextjs/cloudflare chains, listed in docs/dependency-security.md"
        status: pass
    human_judgment: false
  - id: D6
    description: "Next-review date is 2026-12-01 (future) and owners unchanged"
    requirement: "DEP-01"
    verification:
      - kind: other
        ref: "grep -qF '**Next review:** 2026-12-01' docs/dependency-security.md"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-03
status: complete
---

# Phase 4 Plan 5: Dependency Baseline Refresh Summary

**CI's production audit gate raised to `--audit-level=high` and `docs/dependency-security.md` refreshed to close both Next-bundled exceptions with re-observed evidence — the audit reports 0 findings in production at every severity.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-02T17:57:00Z (approx)
- **Completed:** 2026-09-03T00:59:44Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- Proved `npm audit --omit=dev --audit-level=high` exits 0 locally (0 vulnerabilities at every severity) before editing CI, then raised `.github/workflows/ci.yml`'s audit step from `--audit-level=critical` to `--audit-level=high` in a single-line change — step name, indentation, and `--omit=dev` scope untouched.
- Closed both Next-bundled production exceptions (PostCSS, Sharp) in `docs/dependency-security.md` with dated `Closed: exit condition met 2026-09-02` markers and version evidence observed this session, not carried forward from the 2026-08-11 baseline.
- Refreshed the Development-only findings section from a full-tree `npm audit` run in the same session: 5 moderate findings, all traced to devDependency chains (`drizzle-kit`'s bundled `esbuild`, `@opennextjs/cloudflare`'s `qs`).
- Rewrote the Enforcement section in the present tense — CI runs the `high`-level gate now, not as a future intention — and set the next-review date to 2026-12-01.

## Task Commits

1. **Task 1: Prove the raised audit gate locally, then raise it in CI** - `405ffae` (ci)
2. **Task 2: Refresh the dependency baseline document from this session's audit output** - `7d79ff2` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `.github/workflows/ci.yml` - Audit production dependencies step raised from `--audit-level=critical` to `--audit-level=high` (one line)
- `docs/dependency-security.md` - Status header, exceptions, dev-only findings, and enforcement prose all rewritten from this session's audit evidence

## Audit Evidence (recorded per plan `<output>` spec)

**Production audit:** `npm audit --omit=dev --audit-level=high` — **exit code 0**, 0 vulnerabilities at every severity (critical/high/moderate/low/total all 0).

**Full-tree audit** (`npm audit --json`, includes dev dependencies) — 0 info, 0 low, **5 moderate**, 0 high, 0 critical, 5 total:

| Finding | Severity | Path |
| --- | --- | --- |
| `esbuild` (`<=0.24.2`) | moderate | `drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild@0.18.20` |
| `@esbuild-kit/core-utils` | moderate | `drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils` |
| `@esbuild-kit/esm-loader` | moderate | `drizzle-kit > @esbuild-kit/esm-loader` |
| `drizzle-kit` | moderate | `drizzle-kit@0.31.10` (devDependency) |
| `qs` (array-limit bypass; DoS via `isBuffer`) | moderate | `@opennextjs/cloudflare > @opennextjs/aws > express > qs@6.15.3` (devDependency) |

**Observed versions (this session):**

- Node: `24.18.1`
- npm: `11.16.0`
- Installed Next: `16.3.1`
- Resolved PostCSS (top-level, `require.resolve('postcss')`): `8.5.26`
- PostCSS as bundled by Next (`node_modules/next/node_modules/postcss`): `8.5.23` — no longer the flagged `8.4.31` line
- Resolved Sharp (`require.resolve('sharp')` → `node_modules/sharp/dist/index.cjs`): `0.35.3`, hoisted to the top level as a direct dependency of Next (not nested under `node_modules/next/node_modules`) — this corrects `04-RESEARCH.md`'s claim that Sharp does not resolve; it does, and the resolved version satisfies the exit condition's "0.35 or newer" requirement.

No production finding blocked the gate raise — no bounded exception was needed.

## Decisions Made

- Raised the CI gate to `high` only after the local audit proved 0 findings at that level — the plan's Rule against weakening the gate never came into play since nothing needed suppressing.
- Both closed-exception entries cite the specific nested/hoisted resolution paths (`node_modules/next/node_modules/postcss` vs. top-level `node_modules/sharp`) rather than a single ambiguous "installed version," since the two packages resolve differently (Sharp hoisted, PostCSS nested under Next) and the exit conditions are about what Next itself bundles.
- Used the literal `2026-09-02` date specified throughout the plan and `04-CONTEXT.md` (D-13/D-15/D-16) for the re-run date and closure markers, matching the plan's explicit acceptance criteria strings, even though the executing session's wall-clock date rolled to 2026-09-03 partway through.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 4 (Reference Documentation Refresh) is now complete — this was the last plan (5 of 5). All five DEP-01 through REF-04 requirement threads across the phase are closed. No blockers carried forward from this plan.

---
*Phase: 04-reference-documentation-refresh*
*Completed: 2026-09-03*

## Self-Check: PASSED
