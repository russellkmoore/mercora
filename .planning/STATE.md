---
gsd_state_version: 1.0
milestone: v2
milestone_name: Themeable Storefront
current_phase: 05
current_phase_name: Token Contract & Component Sweep
status: executing
stopped_at: Completed 05-04-PLAN.md
last_updated: "2026-09-04T15:11:04.936Z"
last_activity: 2026-09-03
last_activity_desc: Phase 05 execution started
state_head: 2b11dd9ce64342e07e968538be1c5354c7c21500
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 12
  completed_plans: 4
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-02 after v2 milestone start)

**Core value:** A customer or an external AI agent can find the right outdoor gear through Volt, pay for it exactly once, and have inventory, order state, and refunds end up correct, whether they arrive via the storefront or the MCP server.
**Current focus:** Phase 05 — Token Contract & Component Sweep

## Current Position

Phase: 05 (Token Contract & Component Sweep) — EXECUTING
Plan: 5 of 12
Status: Ready to execute
Last activity: 2026-09-03 — Phase 05 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 17 (all v1)
- Average duration: - (v2 not started)
- Total execution time: 0.0 hours (v2)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 (v1) | 4 | - | - |
| 2 (v1) | 5 | - | - |
| 3 (v1) | 3 | - | - |
| 4 (v1) | 5 | - | - |
| 5 (v2) | - | - | - |
| 6 (v2) | - | - | - |
| 7 (v2) | - | - | - |
| 8 (v2) | - | - | - |

**Recent Trend:**

- Last 5 plans: - (v2 not started)
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 05 P01 | 20min | 2 tasks | 7 files |
| Phase 05 P02 | 55min | 2 tasks | 5 files |
| Phase 05 P03 | 130min | 3 tasks | 11 files |
| Phase 05 P04 | 55min | 3 tasks | 18 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Decisions locked for v2:

- Theme registry is build-time generated from `themes/*.css` only — never a wrangler var or hand-maintained list
- A new theme requires a deploy; switching between shipped themes is instant via D1
- `getActiveTheme()` accepts the per-request D1 read; no caching layer unless traces show it's needed
- `theme.mode` (dark/light) folds into the theme file — a theme IS a mode; no separate mode switch
- Per-theme component/markup overrides and per-category layout overrides are rejected — tokens + enumerated variants is the line
- Admin theming is out of scope for this milestone; admin keeps its hardcoded palette
- [Phase 05]: MANUAL_REVIEW files are excluded from scanning entirely (not just flagged inline), each printed with a written reason on every run. — Matches TOKEN-MAP §6's framing of them as named-file exceptions with a printed reason, so a future 0-violations result never silently omits content the scanner never looked at.
- [Phase 05]: The screenshot harness's 'open' interactive state for every non-cart route is the header nav (desktop dropdown / mobile sheet); only two selectors (nav trigger, cart trigger) cover the whole coverage grid.
- [Phase 05]: Local D1 dev seed (predev/seed-dev.sql) does not provide catalog data; data/d1/seed.sql is the documented but currently broken source (bad bulk-insert row) — screenshot baseline used a minimal local-only D1 fixture instead of fixing the unrelated seed file.
- [Phase 05]: [Phase 05-03] Adopted all four discretionary volt-dark token values as derived: on-primary=black, border/ring=neutral-700 (#404040), warning=amber-500 (#f59e0b), border-inverse=gray-700 (#374151). — User decision (Task 0, adopt-all). border-inverse routes both D-05 (drawer edges) and D-10 (email dividers) to the same value, so transactional email dividers will visibly darken once plan 05-12 lands — a known, accepted consequence, recorded as the place to reverse course if it reads badly.
- [Phase 05]: [Phase 05-03] StoreConfig.theme reduced to { logoPath: string } only; mode/primary/surface/surfaceElevated/foreground/mutedForeground deleted from both the type and defaults, not kept as a Phase 6 compatibility shim. — app/layout.tsx was the only reader of the colour fields anywhere in the tree (confirmed by whole-repo grep) and Task 1 already removed those reads, so a shim would just be a second, unused source of the same values.
- [Phase 05]: [Phase 05-03] Added app/not-found.tsx to fix a regression Next's built-in notFound() fallback exposed once the body's inline style was removed. — Next's built-in 404 boundary injects an unlayered body{background:#fff} style that outranks Tailwind's @layer utilities regardless of specificity; the prior inline style always won by CSS origin priority, masking this. Reproduced in dev and production next start; reachable from real notFound() call sites (category, product, blog, account, order-status), not just the screenshot tooling.
- [Phase 05]: [Phase 05-04] Fixed CSS-specificity regression on CategoryDisplay.tsx's sort-toggle active indicator (Rule 1) — data-[state=on]:bg-surface-elevated now legitimately outranks the page's unconditional bg-orange-500 override; marked the override !important to restore the exact prior pixel.

### Pending Todos

None.

### Blockers/Concerns

Open items carried from v1 close (none blocks v2 feature work; full list in `milestones/v1-MILESTONE-AUDIT.md`):

- [Needs Russell] Add `NEXT_PUBLIC_SITE_URL` as a Cloudflare Workers Build variable and redeploy (sitemap still advertises `mercora.example.com`)
- [Cloudflare hygiene] Delete the unused `ADMIN_USER_IDS` Worker secret
- [Backlog] Mobile Lighthouse scores 72-80 vs. target 85 on all four measured routes
- [Review 2026-12-01] Five moderate dev-only `npm audit` findings

Research flags for v2 execution (from `.planning/research/SUMMARY.md`):

- Phase 5: the sweep grep must cover the whole tree (Tailwind config, inline `style={}`, SVG fill/stroke, dead shadcn classes) — a className-only pass will look complete and won't be
- Phase 6: any new telemetry event needs both `commerce.telemetry.v1` parity files updated (`lib/observability/telemetry.ts` + `workers/observability-tail/src/core.ts`) — locked v1 rule
- Phase 6: `scripts/build-themes.mjs` must be wired into `build:worker` and `predev` explicitly — a `prebuild` script name never fires on the real deploy path

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-04T15:11:04.924Z
Stopped at: Completed 05-04-PLAN.md
Resume file: None

Next: `/gsd-discuss-phase 5` (or `/gsd-plan-phase 5` directly) to start Token Contract & Component Sweep
