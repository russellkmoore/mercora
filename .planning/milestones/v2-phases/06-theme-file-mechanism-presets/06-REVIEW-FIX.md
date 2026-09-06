---
phase: 06-theme-file-mechanism-presets
fixed_at: 2026-09-04T21:12:34Z
review_path: .planning/phases/06-theme-file-mechanism-presets/06-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-09-04T21:12:34Z
**Source review:** .planning/phases/06-theme-file-mechanism-presets/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (Warning only — REVIEW.md reported 0 Critical/Blocker findings)
- Fixed: 3
- Skipped: 0

**Verification environment:** `workflow.use_worktrees` is `false` in `.planning/config.json`, so all edits, commits, and gate runs (tsc, eslint, vitest, scan:tokens) happened directly in the main checkout on branch `main` — not in an isolated worktree. These results are reproducible from the current working tree as-is.

## Fixed Issues

### WR-01: `flex-wrap` tab bar combines with `space-x-1`, breaking wrapped rows

**Files modified:** `app/admin/settings/page.tsx`
**Commit:** `929da47`
**Applied fix:** Replaced `space-x-1` with `gap-1` on the tab bar's `flex flex-wrap` container (line 540), exactly as the review suggested. `gap` applies uniformly on both axes and doesn't leak a horizontal-only margin onto wrapped rows the way `space-x-*` does.
**Verification:** Re-read the modified line; `npx tsc --noEmit` clean for this file; `npx eslint` reported only two pre-existing warnings unrelated to this line (`loadAdminUsers` ordering); `npx vitest run` unaffected (no test covers this CSS-only line, matching REVIEW's own IN-03 note).

### WR-02: `getThemeTokens()` can throw if the generated manifest is ever empty

**Files modified:** `lib/themes/tokens.ts`, `tests/unit/lib/themes/tokens.test.ts` (new)
**Commit:** `9b4df8d`
**Applied fix:** Added an explicit `if (!entry) throw new Error(...)` guard before dereferencing `entry.tokens`, per the environment guidance to fail loudly rather than silently degrade (an empty manifest is impossible once `build-themes.mjs` runs, so masking it would hide a genuinely broken build). Added `tests/unit/lib/themes/tokens.test.ts` (4 tests, new file) covering: named-theme lookup, default-name fallback, first-entry fallback when both name and default miss, and the new empty-manifest error message.
**Verification:** `npx vitest run tests/unit/lib/themes/tokens.test.ts` — 4/4 passed. `npx vitest run tests/unit/lib/themes/` (full directory) — 33/33 passed. `npx tsc --noEmit` and `npx eslint` clean for both files. `npm run scan:tokens` — 0 violations (validator/23-token contract unchanged).

### WR-03: New admin appearance test file only greps source text, not rendered behavior

**Files modified:** `components/admin/ThemePresetGrid.tsx`, `tests/unit/app/admin-appearance-source.test.ts`
**Commit:** `ddee61c`
**Applied fix:** No `@testing-library/react` or DOM-environment package (jsdom/happy-dom) is a declared dependency of this project (`jsdom` exists only as a transitive dependency of `isomorphic-dompurify`, not intended for test use — checked `package.json`/`package-lock.json` before proceeding, per the environment note against adding new dependencies). The project does have an established pattern for this exact situation: `tests/unit/components/account/subscription-manager.test.ts` tests a stateful component by splitting it into a stateful wrapper (`SubscriptionManager`) plus a pure, props-driven view (`SubscriptionContent`) that is rendered with `react-dom/server`'s `renderToStaticMarkup` (already a direct dependency via `react-dom`) and asserted on for real DOM output.

Applied that same split to `ThemePresetGrid.tsx`:
- Extracted `ThemePresetGridContent` — a pure, props-driven view with no state/effects/fetch, exported for testing. `ThemePresetGrid` now only owns state/effects and renders `<ThemePresetGridContent ... />` with unchanged handler logic (`selectTheme`, `handleGridKeyDown`, `save`).
- Exported `extractThemeName` (was already pure/module-private) and extracted+exported `nextRovingIndex` (the arrow-key wrap-around math previously inlined in `handleGridKeyDown`) so both are unit-tested directly rather than only reachable through a simulated DOM keydown.
- Rewrote `tests/unit/app/admin-appearance-source.test.ts` (19 tests, up from 7) to render `ThemePresetGridContent` via `renderToStaticMarkup` and assert on real output: manifest-driven card count (tested at 1 and 5 entries, not hardcoded 3), radiogroup/radio ARIA roles with `aria-checked` reflecting pending vs. saved selection, Active badge shown only when `status === "loaded"` and only on the matching card, Save-button `disabled` across all four disabling conditions (no pending, pending===saved, still loading, saving in flight) plus the enabled case, real text-escaping proof using an injected `<img onerror=...>` "theme label" (asserts the escaped form appears and the raw tag never does — a genuine XSS-safety proof via actual React rendering, not absence-of-string), the `line-clamp-3` synopsis class, and that an unrecognized/malicious `savedTheme` value is never reflected into the output in any form (no Active badge, no literal echo) — because every style/attribute in the view is sourced from the trusted manifest entry, never from `savedTheme`/`pendingTheme` directly. `extractThemeName` and `nextRovingIndex` are tested directly and exhaustively (known theme, absent row, unparseable value, out-of-manifest value, non-string value; forward/backward and both-end wraparound).

Three assertions remain deliberate source-text checks, each documented inline in the test file with why: the settings-endpoint URL and toast copy live inside `ThemePresetGrid`'s async `save()`/effect (genuinely unreachable from a static SSR-style render without jsdom/act()), and the "hosts the grid on its own route" check is about Next.js route wiring across two separate files, not `ThemePresetGrid` behavior.

Real DOM event simulation (an actual dispatched click or keydown moving focus, or a fetch triggered by a real state transition) remains out of reach without adding `@testing-library/react` + a DOM environment, which the environment notes explicitly said not to add without checking availability — checked, and they are not available. If interactive coverage of that kind is wanted, it would need a separate decision to add those dependencies (out of scope for this fix).

**Verification:** `npx vitest run tests/unit/app/admin-appearance-source.test.ts` — 19/19 passed. `npx vitest run tests/unit/app tests/unit/lib/themes` (broader regression sweep) — 68 files / 547 tests, all passed. `npx tsc --noEmit` and `npx eslint` clean for both modified files. `npm run scan:tokens` — 0 violations.

## Skipped Issues

None — all in-scope findings (WR-01, WR-02, WR-03) were fixed. REVIEW.md's Info-level findings (IN-01 through IN-04) were out of `fix_scope: critical_warning` and were not attempted.

---

_Fixed: 2026-09-04T21:12:34Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
