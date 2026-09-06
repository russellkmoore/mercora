---
phase: 06-theme-file-mechanism-presets
plan: 02
subsystem: theming
tags: [theme-resolution, telemetry, next-font, wrangler, root-layout]

# Dependency graph
requires:
  - phase: 06-01
    provides: "THEME_MANIFEST, DEFAULT_THEME_NAME, getThemeTokens(name?), and the generated barrel"
provides:
  - "lib/themes/active-theme.ts — getActiveTheme(), APPEARANCE_SETTINGS_CATEGORY, APPEARANCE_THEME_SETTING_KEY (D1 -> env -> manifest fallback, manifest as allow-list)"
  - "theme.unknown_selection registered in TELEMETRY_EVENTS (warning, sampleRate 1), verified absent from the tail Worker's critical-only list"
  - "app/layout.tsx as an async server component stamping the resolved theme on <html> and loading Cormorant Garamond once"
  - "NEXT_PUBLIC_THEME_DEFAULT declared in wrangler.jsonc vars"
affects: [06-03, 06-04, 06-05]

# Actuals (#2632)
actuals:
  tokens: 21000
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-request server resolver with a try/catch fail-open shell around the D1 read, called directly (never Suspense-wrapped) in an async root layout body"
    - "Telemetry emitted only on a present-but-unrecognised value, never on absent/null/empty — case (a) vs case (b) split from RESEARCH Pitfall 6"

key-files:
  created:
    - lib/themes/active-theme.ts
    - tests/unit/lib/themes/active-theme.test.ts
  modified:
    - lib/observability/telemetry.ts
    - tests/unit/workers/observability-tail-core.test.ts
    - app/layout.tsx
    - wrangler.jsonc
    - cloudflare-env.d.ts
    - tests/unit/lib/email/sender.test.ts
    - .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md

key-decisions:
  - "theme.unknown_selection registered in TELEMETRY_EVENTS during Task 1 (pulled forward from Task 2) because recordTelemetry's event parameter is a literal-string union type derived from TELEMETRY_EVENTS's keys — Task 1's own typecheck acceptance criterion cannot pass while calling recordTelemetry('theme.unknown_selection', ...) against an unregistered event name. Task 2 found the registration already satisfied and only added the tail-worker parity test."
  - "An environment default that is not a manifest name falls through silently to the manifest default with no telemetry (flagged planner decision, D-12 is silent on this case) — a misconfigured deploy-time variable is an operator error surfaced at deploy, not a per-request anomaly worth a sample-rate-1 event."
  - "getSettings('appearance') (category-level read) reused verbatim rather than a single-key query, per RESEARCH Assumption A1 / the plan's Claude's Discretion note."

patterns-established:
  - "A resolver whose type signature is constrained by a companion literal-union registration (here, TelemetryEvent) must register that literal before the resolver's own typecheck gate can pass — sequence the registration into whichever task hits the type error first, not strictly by task number."

requirements-completed: [THEME-02]

coverage:
  - id: D1
    description: "getActiveTheme() resolves D1 -> env -> manifest default, always returns a manifest key, and never throws"
    requirement: THEME-02
    verification:
      - kind: unit
        ref: "tests/unit/lib/themes/active-theme.test.ts (15 tests covering every behavior row)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An unknown stored theme name emits theme.unknown_selection exactly once with no stored string in any field; an absent/empty/null row emits nothing"
    requirement: THEME-02
    verification:
      - kind: unit
        ref: "tests/unit/lib/themes/active-theme.test.ts (case-mismatch, unknown-name, non-string, absent/empty/null cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "theme.unknown_selection is registered at warning severity, sample rate 1, and structurally absent from the tail Worker's critical-only event list, with a passing cross-file test"
    requirement: THEME-02
    verification:
      - kind: unit
        ref: "tests/unit/workers/observability-tail-core.test.ts#registers theme.unknown_selection at warning severity outside the tail critical list"
        status: pass
      - kind: other
        ref: "npm run test:observability-worker"
        status: pass
    human_judgment: false
  - id: D4
    description: "The root layout is an async server component that awaits getActiveTheme() directly in its body (never Suspense-wrapped), stamps the resolved name on <html>, and passes it to getThemeTokens()"
    requirement: THEME-02
    verification:
      - kind: integration
        ref: "npm run build && npm run dev + curl http://localhost:3000/ | grep 'data-theme=\"volt-dark\"'"
        status: pass
      - kind: manual_procedural
        ref: "human-check: load storefront home + one product page with Network throttled, confirm no FOUC and no Cormorant Garamond fetch on a volt-dark page"
        status: unknown
    human_judgment: true
    rationale: "The plan's <verify> block carries an explicit <human-check> for this exact claim (no visible flash before first paint, no font fetch on the wrong theme) that only a human eye on a throttled network trace can confirm; the automated curl probe proves the attribute is present in the first response but cannot itself observe paint timing or network waterfalls."
  - id: D5
    description: "Cormorant Garamond loads once in the root layout via next/font with preload disabled; no theme CSS file declares a font-loading at-rule; NEXT_PUBLIC_THEME_DEFAULT is declared in wrangler.jsonc"
    requirement: THEME-02
    verification:
      - kind: other
        ref: "grep -q 'Cormorant_Garamond' app/layout.tsx && grep -q 'NEXT_PUBLIC_THEME_DEFAULT' wrangler.jsonc && npm run cf-typecheck && npm run scan:tokens"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-04
status: complete
---

# Phase 6 Plan 2: Active Theme Resolution Summary

**`getActiveTheme()` resolves the storefront's rendered theme per request from D1, falling back through `NEXT_PUBLIC_THEME_DEFAULT` to the manifest default with the manifest itself as the allow-list, and the async root layout now stamps that resolved name on `<html>` before any byte of HTML leaves the server.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-04T19:47:00Z
- **Completed:** 2026-09-04T19:58:32Z
- **Tasks:** 3 completed
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- Built `lib/themes/active-theme.ts`: `getActiveTheme()` reads `appearance.theme` through the existing `getSettings('appearance')` helper, membership-checks the (trimmed) value against the manifest's name set case-sensitively, and falls through on any miss — absent/null/empty/whitespace silently, a present-but-unrecognised value (wrong case, unknown name, or a non-string) with exactly one `theme.unknown_selection` telemetry call carrying only `{ outcome: 'invalid' }`, never the stored string itself. A rejected settings read degrades to the same fallback chain instead of propagating. No module-scope state, no cross-request memoisation of any kind — the function reads D1 fresh on every call.
- Registered `theme.unknown_selection` in `TELEMETRY_EVENTS` (`warning`, sample rate 1) and proved it stays out of the tail Worker's `TAIL_CRITICAL_EVENTS` array with a new assertion in the existing parity test file, per RESEARCH Pitfall 4's verified resolution (a warning-severity event joining a structurally critical-only list would break an already-passing test).
- Turned `app/layout.tsx` into an async server component: `await getActiveTheme()` sits directly in the function body, in the same position the two prior synchronous calls occupied, never behind either of the file's two existing `<Suspense>` boundaries. The resolved name replaces the hardcoded `data-theme="volt-dark"` literal and feeds `getThemeTokens(activeTheme)`, so Clerk's appearance variables and the `StoreConfigProvider` payload describe the theme actually being rendered.
- Added `Cormorant_Garamond` via `next/font/google` (`preload: false`) alongside the existing Geist declarations, exposing `--font-cormorant-garamond` on the body's class list. No theme file needs to load a font itself; the browser only fetches the face when a `[data-theme]` block that references the variable actually renders text with it.
- Declared `NEXT_PUBLIC_THEME_DEFAULT: "volt-dark"` in `wrangler.jsonc`'s `vars` block; the matching Workers Build variable step is recorded in this plan's `user_setup` frontmatter for the human action below.
- Verified end-to-end: `npm run build` succeeds; a local `npm run dev` + `curl http://localhost:3000/` shows `data-theme="volt-dark"` in the served HTML with no Cormorant/Garamond `<link>` preload present; `npm run screenshot:routes -- --label phase-06-02-active-theme` captured 22/26 grid cells (the 4 missing cells are the pre-existing Phase 5 coverage gaps — order-status, Stripe payment step, authenticated account dashboard, review-form error state — carried forward, not new).

## Task Commits

Each task was committed atomically:

1. **Task 1: getActiveTheme — D1 to env to manifest default, with the manifest as the allow-list** - `ea92a15` (feat)
2. **Task 2: Register theme.unknown_selection and extend the tail-worker parity test** - `8d4778e` (test)
3. **Task 3: Async root layout stamping the resolved theme, plus the display face and the wrangler var** - `6b85d2f` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `lib/themes/active-theme.ts` - `getActiveTheme()` resolver + the two setting constants
- `tests/unit/lib/themes/active-theme.test.ts` - 15 tests covering every behavior row
- `lib/observability/telemetry.ts` - registers `theme.unknown_selection` (warning, sample rate 1)
- `tests/unit/workers/observability-tail-core.test.ts` - asserts the new event's severity/sample rate and its absence from the tail critical list
- `app/layout.tsx` - async component, resolves and stamps the active theme, loads Cormorant Garamond
- `wrangler.jsonc` - declares `NEXT_PUBLIC_THEME_DEFAULT`
- `cloudflare-env.d.ts` - regenerated to reflect the new var (see Deviations)
- `tests/unit/lib/email/sender.test.ts` - one-line fix required by the regeneration (see Deviations)
- `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` - appended the `phase-06-02-active-theme` capture run

## Decisions Made

- **`theme.unknown_selection` registered a task early.** `recordTelemetry`'s `event` parameter is typed as `keyof typeof TELEMETRY_EVENTS`; Task 1's own `npm run typecheck` acceptance criterion cannot pass while `active-theme.ts` calls `recordTelemetry('theme.unknown_selection', ...)` against an unregistered literal. Registered the event in `lib/observability/telemetry.ts` during Task 1 instead of waiting for Task 2; Task 2 found its own "registered exactly once" acceptance criterion already satisfied and added only the tail-worker parity test extension it was scoped to.
- **A misconfigured env default is silent, per the plan's flagged discretion point.** `NEXT_PUBLIC_THEME_DEFAULT` set to a name absent from the manifest falls through to the manifest default with no telemetry — D-12's wording covers an unknown *stored* value, and a bad deploy-time variable is an operator error surfaced at deploy, not a per-request anomaly worth a sample-rate-1 event. Recorded here per the plan's own instruction, for a later phase to revisit if desired.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `cf-typecheck` required regenerating `cloudflare-env.d.ts`, which surfaced an unrelated pre-existing TS2790 in a test file**
- **Found during:** Task 3 acceptance-criteria verification (`npm run cf-typecheck`)
- **Issue:** Adding `NEXT_PUBLIC_THEME_DEFAULT` to `wrangler.jsonc` made the committed `cloudflare-env.d.ts` stale; `wrangler types --check` fails until regenerated. Regenerating against the current authenticated Cloudflare account also picked up four secret bindings already present on the deployed Worker but not previously reflected in the committed type file (`RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CLERK_SECRET_KEY`, `ADMIN_VECTORIZE_TOKEN`) — unrelated environment drift, not caused by this plan's own changes. Once `RESEND_API_KEY` became a required (non-optional) `string` in the generated `process.env` type, `tests/unit/lib/email/sender.test.ts`'s `delete process.env.RESEND_API_KEY;` failed `tsc --noEmit` with "the operand of a `delete` operator must be optional" (TS2790).
- **Fix:** Regenerated `cloudflare-env.d.ts` via `npm run cf-typegen` (required regardless, to reflect the new var). Fixed the resulting test failure by switching to the file's own already-established `Reflect.deleteProperty(process.env, "RESEND_API_KEY")` pattern — the line directly above it already used this exact idiom for `EMAIL_PROVIDER` for the identical reason.
- **Files modified:** `cloudflare-env.d.ts`, `tests/unit/lib/email/sender.test.ts`
- **Verification:** `npm run cf-typecheck` and `npm run typecheck` both exit 0; `npm test` — 247 files / 1918 tests, all green.
- **Committed in:** `6b85d2f`

---

**Total deviations:** 1 auto-fixed (Rule 3 — a blocking issue discovered while proving this plan's own `cf-typecheck` acceptance criterion). **Impact:** Necessary for the plan's stated acceptance criteria to hold; the secret-binding additions to `cloudflare-env.d.ts` are incidental to running the required regeneration, not new scope introduced by this plan's code.

## Issues Encountered

None beyond the deviation documented above.

## User Setup Required

**External services require manual configuration.** `NEXT_PUBLIC_THEME_DEFAULT` is a client-prefixed variable; per the project rule for `NEXT_PUBLIC_*` vars it needs a Cloudflare Workers Build variable in addition to the `wrangler.jsonc` declaration made in this plan:

- **Service:** cloudflare-workers
- **Task:** Add `NEXT_PUBLIC_THEME_DEFAULT` as a Build variable and redeploy
- **Location:** Cloudflare Dashboard -> Workers & Pages -> the Voltique Worker -> Settings -> Build -> Variables and Secrets
- **Value:** A manifest theme name (`volt-dark` unless a different shipped preset should become the deploy-time default)

RESEARCH Pitfall 7 notes this dashboard step may already be redundant given `scripts/build-with-public-env.mjs`'s existing auto-injection of every `wrangler.jsonc` `NEXT_PUBLIC_*` var into the `build:worker` step — but since that claim rests on a 30-day-old project memory outside what this session could verify against live dashboard state, the safer default (both the wrangler var and the dashboard variable) is followed as written in D-10.

## Next Phase Readiness

- `getActiveTheme()` is proven against every fallback-chain edge case and ready for plan 06-04's admin Appearance page to write `appearance.theme` through the existing `POST /api/admin/settings` pattern — the setting category/key constants this plan exports (`APPEARANCE_SETTINGS_CATEGORY`, `APPEARANCE_THEME_SETTING_KEY`) are the exact contract 06-04 consumes; do not rename them.
- The root layout now resolves and renders whatever theme is stored, so plan 06-03's new preset files (`luxe.css`, `midnight.css`) will render immediately once `appearance.theme` is set to their name, with no further layout change needed.
- `theme.unknown_selection` is live in production telemetry as soon as this deploys; the tail Worker correctly ignores it (by design) while `console.warn`/analytics still capture it.
- The Cormorant Garamond CSS variable is available to any theme's `--store-font-display`; 06-03's Luxe preset is the first consumer.
- `NEXT_PUBLIC_THEME_DEFAULT`'s Workers Build variable step (above) is outstanding and blocks nothing in this milestone's remaining plans — it only matters for the deploy-time fallback tier, which is rarely exercised once an admin has saved a selection.

---
*Phase: 06-theme-file-mechanism-presets*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: lib/themes/active-theme.ts
- FOUND: tests/unit/lib/themes/active-theme.test.ts
- FOUND: app/layout.tsx
- FOUND: wrangler.jsonc
- FOUND: lib/observability/telemetry.ts
- FOUND: tests/unit/workers/observability-tail-core.test.ts
- FOUND commit: ea92a15
- FOUND commit: 8d4778e
- FOUND commit: 6b85d2f
- Re-ran plan-level verification: vitest (active-theme.test.ts 15/15, observability-tail-core.test.ts 12/12), npm run test:observability-worker (3/3), npm run lint (0 errors), npm run typecheck (exit 0), npm run cf-typecheck (exit 0), npm test (247 files / 1918 tests, all pass), npm run scan:tokens (0 violations), npm run build (exit 0), dev-server probe (data-theme="volt-dark" present in served HTML), npm run screenshot:routes --label phase-06-02-active-theme (22/26 cells captured)
