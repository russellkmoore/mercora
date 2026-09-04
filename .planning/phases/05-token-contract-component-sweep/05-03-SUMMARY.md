---
phase: 05-token-contract-component-sweep
plan: 03
subsystem: theming
tags: [tailwind, css-custom-properties, tokens, nextjs, data-theme]

# Dependency graph
requires:
  - phase: 05-01
    provides: "scan:tokens gate and the gsd:scan-ignore sentinel convention, used here to wrap the admin CSS block"
  - phase: 05-02
    provides: "screenshot:routes harness and the baseline label this plan diffs chunk-1-contract against"
provides:
  - "themes/volt-dark.css — the frozen 23-token contract as one [data-theme=\"volt-dark\"] block"
  - "tailwind.config.ts fully wired to runtimeColor()/borderRadius/fontFamily tokens, zero hex literals"
  - "data-theme=\"volt-dark\" stamped server-side on <html>; <body> reads token utility classes, not inline style"
  - "lib/themes/tokens.ts getThemeTokens() — the typed bridge for Stripe, Clerk, email, and the standalone error page"
  - "app/not-found.tsx — themed 404 boundary, required once the body's inline style was removed"
affects: [05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-10, 05-11, 05-12]

# Actuals (#2632)
actuals:
  tokens: 8316
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS custom-property theme file per data-theme value, imported ahead of @config, never inline-styled"
    - "runtimeColor() extended to all 17 colour tokens; borderRadius/fontFamily driven by plain var() against the same --store- properties"
    - "Typed non-cascade token bridge (getThemeTokens()) duplicates theme-file values on purpose, guarded by a CSS-parity contract test instead of a single source of truth at runtime"

key-files:
  created:
    - themes/volt-dark.css
    - lib/themes/tokens.ts
    - tests/unit/lib/themes/token-contract.test.ts
    - app/not-found.tsx
  modified:
    - tailwind.config.ts
    - app/globals.css
    - app/layout.tsx
    - tests/unit/tailwind-config.test.ts
    - lib/store-config.ts
    - docs/runtime-configuration.md
    - .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md

key-decisions:
  - "User decision (Task 0, adopt-all): on-primary=black, border/ring=neutral-700 (#404040), warning=amber-500 (#f59e0b), border-inverse=gray-700 (#374151) — all four discretionary values adopted as the planner derived them, including the email-divider darkening consequence of border-inverse, tracked as a known, accepted effect for plan 05-12 to reverse if it reads badly"
  - "Sonner's toaster className, previously a raw bg-(--store-primary)/80 var() reference, was rewritten to bg-primary/80 text-on-primary — required by Task 1's own acceptance criterion that app/layout.tsx contain no literal --store- string, and matches D-12's mapping ahead of its scheduled chunk"
  - "StoreConfig.theme shrinks to { logoPath: string } only — mode/primary/surface/surfaceElevated/foreground/mutedForeground are deleted from both the type and the defaults object, not kept as a compatibility shim, since app/layout.tsx was their only reader anywhere in the tree and Task 1 already removed those reads"

patterns-established:
  - "Contract tests that parse the theme CSS file at test time (regex over custom-property declarations) rather than hardcoding a second copy of its values, so lib/themes/tokens.ts and themes/volt-dark.css cannot silently drift"

requirements-completed: [TOKEN-01, TOKEN-02, TOKEN-04]

coverage:
  - id: D1
    description: "themes/volt-dark.css declares all 23 --store- custom properties inside one [data-theme=\"volt-dark\"] selector, values relocated verbatim (adopt-all decision), no fallback chains (D-02)"
    requirement: "TOKEN-01"
    verification:
      - kind: other
        ref: "grep -c '^\\s*--store-' themes/volt-dark.css == 23; grep -c '{' themes/volt-dark.css == 1"
        status: pass
      - kind: other
        ref: "grep -cE 'var\\([^)]*,' themes/volt-dark.css == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "tailwind.config.ts maps all 17 colour tokens through runtimeColor(), borderRadius and fontFamily through plain var(); the store colour group, background alias, and both hardcoded border/ring hex literals are deleted"
    requirement: "TOKEN-01"
    verification:
      - kind: other
        ref: "grep -c 'runtimeColor(\"--store-' tailwind.config.ts == 17; grep -cE '#[0-9a-fA-F]{3,8}' tailwind.config.ts == 0"
        status: pass
      - kind: unit
        ref: "tests/unit/tailwind-config.test.ts#maps shared component colors to request-time store variables"
        status: pass
    human_judgment: false
  - id: D3
    description: "data-theme=\"volt-dark\" is stamped server-side on <html>; the built CSS bundle carries both --store-surface and a generated bg-surface utility rule, proving the token path resolves end to end"
    requirement: "TOKEN-02"
    verification:
      - kind: other
        ref: "mise exec -- npm run build; grep -l bg-surface / --store-surface in .next/static/css/*.css"
        status: pass
      - kind: other
        ref: "dev-server request to / returns data-theme=\"volt-dark\" in the initial HTML"
        status: pass
    human_judgment: false
  - id: D4
    description: "getThemeTokens() returns all 23 camelCase keys, 17 colour + 4 radius values byte-equal (case-insensitive, trimmed) to themes/volt-dark.css, reads no environment variable, imports nothing server-only"
    requirement: "TOKEN-01"
    verification:
      - kind: unit
        ref: "tests/unit/lib/themes/token-contract.test.ts (6 assertions, all pass)"
        status: pass
      - kind: other
        ref: "manual mutation check: editing one hex in themes/volt-dark.css fails the parity test; reverting passes it again"
        status: pass
    human_judgment: false
  - id: D5
    description: "NEXT_PUBLIC_THEME_PRIMARY is removed from code and docs; the sibling logo-path env read and getStoreConfig().theme.logoPath both remain unchanged"
    requirement: "TOKEN-04"
    verification:
      - kind: other
        ref: "grep -rn NEXT_PUBLIC_THEME_PRIMARY app components lib scripts tests docs -> 0 matches"
        status: pass
      - kind: other
        ref: "npx tsx -e getStoreConfig().theme.logoPath === '/volt.png' -> logoPath-stable"
        status: pass
    human_judgment: false
  - id: D6
    description: "chunk-1-contract screenshot set matches the 05-02 baseline cell-for-cell (26 rows in both sections); 18 of 22 captured cells are byte-identical hashes, the remaining 3 differences trace to snap S12 (new app/not-found.tsx), no unexplained mismatch"
    requirement: "TOKEN-02"
    verification:
      - kind: other
        ref: "05-SCREENSHOTS.md baseline vs chunk-1-contract section row-count and per-row hash diff (scripted comparison in this session)"
        status: pass
      - kind: manual_procedural
        ref: "visual read of home__1280__resting.png / home__390__resting.png (byte-identical to baseline) and account__1280__resting.png (S12 fix)"
        status: pass
    human_judgment: true
    rationale: "I diffed all 26 rows programmatically and visually inspected the home pair (byte-identical, confirming the no-op) and the account pair (confirming the S12 fix renders correctly). A human should still skim the remaining screenshot pairs once, since a scripted hash diff plus a 3-image spot check is not the same as a full deliberate visual QA pass."
  - id: D7
    description: "mise exec -- npm run test && npm run typecheck && npm run lint all pass with zero errors after every change in this plan (244 test files / 1882 tests; 0 lint errors, 52 pre-existing warnings unchanged)"
    requirement: "TOKEN-01"
    verification:
      - kind: other
        ref: "npm run test / npm run typecheck / npm run lint (this session's final combined run)"
        status: pass
    human_judgment: false

# Metrics
duration: 130min
completed: 2026-09-04
status: complete
---

# Phase 5 Plan 3: Token Contract Wiring and Env-Var Retirement Summary

**The frozen 23-token contract now runs end to end — theme file, Tailwind mapping, server-rendered `data-theme` attribute, and a typed `getThemeTokens()` bridge — with the current volt-dark look preserved pixel-for-pixel and the deprecated theme env var gone.**

## Performance

- **Duration:** ~130 min (continuation session; Task 0's decision checkpoint was resolved by the user before this session started)
- **Started:** 2026-09-04T07:20:00Z
- **Completed:** 2026-09-04T09:30:00Z
- **Tasks:** 3 completed (Task 0 was a decision-only checkpoint resolved prior to this session)
- **Files modified:** 11 (4 created, 7 modified)

## Accomplishments

- Created `themes/volt-dark.css`: all 23 `--store-` custom properties in a single `[data-theme="volt-dark"]` block, no fallback chains, values relocated verbatim from the prior config/hardcoded look plus the user's adopt-all decision on the four discretionary values.
- Rewired `tailwind.config.ts`: 17 colour keys through `runtimeColor()`, `borderRadius` and `fontFamily` through plain `var()` against the same `--store-` properties; deleted the `store` colour group, the `background` alias, and the two hardcoded `border`/`ring` hex literals.
- `app/globals.css` imports the theme file ahead of `@config`, routes `.font-sans` and the focus-visible outline through tokens, and wraps the admin rule block in `gsd:scan-ignore` sentinels per D-14.
- `app/layout.tsx` stamps `data-theme="volt-dark"` on `<html>` and drives `<body>` styling through `bg-surface text-foreground` utility classes instead of an inline `style` prop; the Sonner toaster moved off a raw `--store-primary` `var()` reference onto `bg-primary/80 text-on-primary`.
- Built `lib/themes/tokens.ts` (`getThemeTokens()`) via RED-GREEN TDD: a contract test parses `themes/volt-dark.css` directly (not a restated copy) and asserts 23-key parity, environment-read absence, and repeat-call stability.
- Retired `NEXT_PUBLIC_THEME_PRIMARY` from `lib/store-config.ts` and `docs/runtime-configuration.md`; `StoreConfig.theme` now declares `logoPath` alone; `getStoreConfig().theme.logoPath` still resolves to `/volt.png`.
- Captured the `chunk-1-contract` screenshot label and diffed all 26 coverage rows against the `baseline` label: 18 of 22 captured cells are byte-identical SHA-256 matches; the only differences are the three `/account` rows, fully explained by a new snap (S12, below).
- **Found and fixed a real regression during the screenshot diff**, not merely documented it: Next.js's built-in `notFound()` fallback injects an unlayered `body{color:#000;background:#fff}` style that outranks Tailwind's `@layer utilities` regardless of specificity. Removing `<body>`'s inline style (Task 1, matching the plan's own acceptance criteria) exposed this — every `notFound()` call site in the app (category, product, blog, account, order-status) would silently render Next's plain white fallback for any visitor with a light OS colour-scheme preference. Added `app/not-found.tsx` so the site's own dark theme renders instead of the framework default; recorded as intentional snap **S12** in `05-SCREENSHOTS.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire the 23-token contract from theme file to rendered pixel** - `003868f` (feat)
2. **Task 2 (RED): add failing token-contract test** - `3256d00` (test)
2. **Task 2 (GREEN): implement getThemeTokens()** - `9522038` (feat)
3. **Task 3: retire the deprecated theme env var and prove the chunk is a visual no-op** - `d8720c5` (feat, includes the `app/not-found.tsx` regression fix and the `chunk-1-contract` screenshot manifest)

**Plan metadata:** (this commit)

_Task 0 (the discretionary-values decision checkpoint) was resolved by the user (`adopt-all`) before this continuation session — no code changes, decision only._

## Files Created/Modified

- `themes/volt-dark.css` - the 23-token contract as one `[data-theme="volt-dark"]` CSS block
- `lib/themes/tokens.ts` - `getThemeTokens()`, the typed non-cascade bridge for Stripe/Clerk/email/`global-error.tsx`
- `tests/unit/lib/themes/token-contract.test.ts` - 6-assertion contract test parsing the theme CSS for parity
- `app/not-found.tsx` - themed 404 boundary (Rule 1 fix; see Deviations)
- `tailwind.config.ts` - 17 `runtimeColor()` colours, token-driven `borderRadius`/`fontFamily`, zero hex
- `app/globals.css` - theme import, token-driven `.font-sans` and focus outline, admin block sentinels
- `app/layout.tsx` - `data-theme` on `<html>`, token utility classes on `<body>`, Sonner toaster fix
- `tests/unit/tailwind-config.test.ts` - updated for the deleted `background` alias
- `lib/store-config.ts` - `NEXT_PUBLIC_THEME_PRIMARY` read removed; `StoreConfig.theme` reduced to `logoPath`
- `docs/runtime-configuration.md` - removed variable dropped from the Theme row
- `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` - `chunk-1-contract` section, snap S12

## Decisions Made

- **User (Task 0, adopt-all):** `on-primary`=black, `border`/`ring`=neutral-700 (`#404040`), `warning`=amber-500 (`#f59e0b`), `border-inverse`=gray-700 (`#374151`) — all four planner-derived values adopted as-is. The `border-inverse` choice means transactional email dividers will visibly darken once plan 05-12 lands (D-05/D-10 both route to this token); this is a known, accepted consequence, not an oversight, and 05-12's email chunk is the recorded place to reverse course if the darker rules read badly.
- Sonner's toaster className was rewritten from a raw `bg-(--store-primary)/80` `var()` reference to `bg-primary/80 text-on-primary` — required by this task's own acceptance criterion (`app/layout.tsx` must contain no literal `--store-` string), and happens to match D-12's chunk-2-scheduled mapping exactly, so no rework is expected when that chunk lands.
- `StoreConfig.theme` shrinks to `{ logoPath: string }` rather than keeping the colour fields as a Phase-6 compatibility shim — `app/layout.tsx` was their only reader anywhere in the tree (confirmed by whole-repo grep) and Task 1 already removed those reads, so keeping dead fields would just be a second, unused source of the same values.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Sonner toaster referenced `--store-primary` directly via a raw `var()` arbitrary value**
- **Found during:** Task 1 acceptance-criteria verification (`app/layout.tsx` must contain no `--store-` string)
- **Issue:** `toastOptions.className` used `bg-(--store-primary)/80 text-black`, a Tailwind v4 arbitrary-value syntax reading the CSS custom property directly instead of going through a token utility class.
- **Fix:** Rewrote to `bg-primary/80 text-on-primary`, using the `primary` and `on-primary` Tailwind colour keys added in this same task.
- **Files modified:** `app/layout.tsx`
- **Verification:** `grep -c -- '--store-' app/layout.tsx` → 0; visually identical (on-primary=black matches the prior `text-black`).
- **Committed in:** `003868f`

**2. [Rule 1 - Bug, critical] Next's built-in `notFound()` fallback lost its dark styling once `<body>`'s inline style was removed**
- **Found during:** Task 3's screenshot diff against baseline (the three `/account` rows, which redirect to a nonexistent `/sign-in` route and hit the framework's built-in 404 boundary, showed as a stark white page instead of black)
- **Issue:** Next.js's built-in `HTTPAccessErrorFallback` (used automatically wherever a route calls `notFound()` without a matching `app/not-found.tsx`) injects its own unlayered `<style>body{color:#000;background:#fff}</style>`. CSS cascade layers give ANY unlayered rule priority over ANY rule inside `@layer utilities` — including Tailwind's own — regardless of selector specificity. The prior inline `style` attribute on `<body>` always won (inline style beats any stylesheet origin short of `!important`), which is exactly why this was invisible before Task 1. Once Task 1 replaced that inline style with `bg-surface text-foreground` utility classes (as its own acceptance criteria required), the built-in fallback's unlayered rule started winning — reproduced in both `next dev` and a production `next build && next start`, and reachable from real `notFound()` call sites in `category`, `product`, `blog`, `account`, and `order-status` pages, not just this plan's synthetic screenshot route.
- **Fix:** Added `app/not-found.tsx`, a themed 404 page rendered inside the app's own root layout. This is the idiomatic Next.js fix (define the boundary instead of falling back to the framework default) and keeps Task 1's "no inline style" change intact rather than reverting it.
- **Files modified:** `app/not-found.tsx` (new)
- **Verification:** Reproduced the white background via Playwright computed-style inspection against both `next dev` and a `next start` production server before the fix; confirmed black background and correct themed content after. Recorded as intentional snap S12 in `05-SCREENSHOTS.md`; the three affected `chunk-1-contract` rows reference it.
- **Committed in:** `d8720c5`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs; the second is a genuine cross-cutting regression this plan's own screenshot-diff step exists to catch). **Impact:** Both fixes were necessary for correctness — the first to satisfy this task's own acceptance criterion, the second to prevent a real, site-wide visual regression on every `notFound()` page for light-colour-scheme visitors. No scope creep beyond what the screenshot diff required to explain or fix.

## Issues Encountered

- `mv -i` (interactive alias) silently refused to restore `themes/volt-dark.css` after a deliberate mutation test (proving the token-contract test has teeth); caught immediately via `git diff` showing the file still mutated, restored from the `.bak` copy with `\cp -f`, then re-verified clean and re-run to confirm the test passes on the correct content. No lasting effect — documented here only because a silent no-op on a "restore" step is exactly the kind of thing that should be visible, not because it changed the outcome.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The token path (theme file → Tailwind → cascade → `data-theme` → rendered pixel) is proven end to end, on real code, verified by a green build, a passing dev-server `data-theme` check, and a byte-identical screenshot diff against the pre-sweep baseline for every route except the one `app/not-found.tsx` intentionally changed.
- `getThemeTokens()` is ready for the drawers, Stripe, Clerk, and email chunks (D-18 chunks 2, 4, 5) to import.
- All 9 remaining sweep plans (05-04 through 05-12) can now substitute class names against a mechanism that is proven to work, per this plan's purpose as the tracer slice.
- `app/not-found.tsx` is a new, permanent surface not enumerated in the original phase's `<artifacts_produced>` list — it uses `text-muted-foreground`, `text-primary`, and default surface tokens already covered by this plan's contract, so no later chunk needs to sweep it further, but reviewers should be aware it now exists.

---
*Phase: 05-token-contract-component-sweep*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: themes/volt-dark.css
- FOUND: lib/themes/tokens.ts
- FOUND: tests/unit/lib/themes/token-contract.test.ts
- FOUND: app/not-found.tsx
- FOUND commit: 003868f
- FOUND commit: 3256d00
- FOUND commit: 9522038
- FOUND commit: d8720c5
