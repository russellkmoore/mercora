---
phase: 16-blog-surfacing
fixed_at: 2026-09-11T09:30:00Z
review_path: .planning/phases/16-blog-surfacing/16-REVIEW.md
iteration: 2
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 16: Code Review Fix Report

**Fixed at:** 2026-09-11T09:24:43Z
**Source review:** .planning/phases/16-blog-surfacing/16-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (1 Critical, 2 Warning)
- Fixed: 3
- Skipped: 0

## Fixed Issues

| Finding | Title | Files Modified | Commit | Status |
|---|---|---|---|---|
| CR-01 | Unguarded `getPublishedBlogPosts` call in `Header.tsx` can turn a blog-table read failure into a full-storefront outage | `components/Header.tsx`, `tests/unit/components/header-blog-nav.test.ts` | `24fcfb7` | fixed |
| WR-01 | Admin Content tab does not re-validate loaded `content.*` values against the same bounds the storefront enforces | `app/admin/settings/page.tsx` | `0581841` | fixed |
| WR-02 | `getPublishedBlogPosts` rejection path is untested end-to-end for the blog-nav boolean | `tests/unit/components/header-blog-nav.test.ts` | `24fcfb7` | fixed |

### CR-01: Unguarded `getPublishedBlogPosts` call in `Header.tsx`

**Files modified:** `components/Header.tsx`, `tests/unit/components/header-blog-nav.test.ts`
**Commit:** `24fcfb7`
**Applied fix:** Wrapped `getPublishedBlogPosts({ limit: 1 })` in `Header()` in a try/catch, defaulting `showBlogNav` to `false` on any rejection, mirroring `getContentSettings()`'s existing D-17 posture two lines above it. `blogNavLabel` (from `getContentSettings()`) is still resolved before the guarded call, unchanged, since that read was already guarded. Added a test case asserting `Header()` resolves with `showBlogNav: false` and does not throw when `getPublishedBlogPosts` rejects.

### WR-01: Admin Content tab does not re-validate loaded `content.*` values

**Files modified:** `app/admin/settings/page.tsx`
**Commit:** `0581841`
**Applied fix:** Added four client-safe normalize helpers (`normalizeContentText`, `normalizeContentFlag`, `normalizeContentCount`, `normalizeContentPlacement`) that mirror `lib/content/settings.ts`'s resolver clamps (text: fallback on non-string/empty/over-length; flag: fallback on non-boolean; count: clamp to `[BLOG_HOME_BLOCK_COUNT_MIN, BLOG_HOME_BLOCK_COUNT_MAX]`; placement: fallback on non-member). These reuse the already-imported bounds/enum constants rather than retyping them. The recorder's `recordTelemetry` call was intentionally not reused/duplicated — it calls `getCloudflareContext()` and is server-only, so it cannot run in this `"use client"` file; the admin-load path silently normalizes without emitting a duplicate `content.unknown_selection` signal (the storefront's own read already covers that signal). Applied the four helpers to all five `content.*` branches of `loadSettings()`'s parsing `forEach`, so an out-of-range stored value now displays the same normalized value in the admin form that `getContentSettings()` would render on the storefront.

### WR-02: `getPublishedBlogPosts` rejection path is untested

**Files modified:** `tests/unit/components/header-blog-nav.test.ts`
**Commit:** `24fcfb7`
**Applied fix:** Added to the same commit as CR-01, per the finding's own instruction ("Add the rejection-path test alongside CR-01's fix"). New test case in the `Header() resolves blog nav visibility and label server-side` block: mocks `getPublishedBlogPosts` to reject, asserts the returned promise resolves (does not throw) and that `showBlogNav` is `false`.

## Skipped Issues

None — all findings were fixed.

## Gate Results

All run via `mise exec --` from repo root, after all three commits above:

| Gate | Result |
|---|---|
| `npm run lint` | 0 errors, 54 warnings (all pre-existing, none in files touched by these fixes) |
| `npm run typecheck` | exit 0, no output |
| `npm run scan:tokens` | `[scan-tokens] 0 violations` (2 pre-existing `MANUAL-REVIEW` lines, unrelated) |
| `mise exec -- npm test` | 316 test files, 2851 tests passed (2850 pre-existing + 1 new: the CR-01/WR-02 rejection-path test) |

---

_Fixed: 2026-09-11T09:24:43Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

## Iteration 2

**Fixed at:** 2026-09-11T09:30:00Z (review) / same session (fix)
**Source review:** .planning/phases/16-blog-surfacing/16-REVIEW.md (Iteration 2 — targeted re-review)

**Summary:**
- Findings in scope: 1 (0 Critical, 1 Warning)
- Fixed: 1
- Skipped: 0

### Fixed Issues

| Finding | Title | Files Modified | Commit | Status |
|---|---|---|---|---|
| WR-03 | WR-01's normalize helpers have no behavioral test — only a source-contract test | `lib/content/normalize-client.ts` (new), `app/admin/settings/page.tsx`, `tests/unit/app/admin-settings-content-normalize.test.ts` (new) | `89dcb25` | fixed |

#### WR-03: WR-01's normalize helpers have no behavioral test

**Files modified:** `lib/content/normalize-client.ts` (new), `app/admin/settings/page.tsx`, `tests/unit/app/admin-settings-content-normalize.test.ts` (new)
**Commit:** `89dcb25`
**Applied fix:** Extracted the four page-local `normalizeContentText`/`Flag`/`Count`/`Placement` functions out of `app/admin/settings/page.tsx` into a new pure, side-effect-free, client-safe module `lib/content/normalize-client.ts` (no React import, no `"use client"` directive, no D1/Cloudflare access — importable from both the client settings page and a Node test), keeping every clamp/fallback expression byte-identical to what shipped in WR-01. `page.tsx` now imports the four functions from the new module instead of declaring them locally; the five `content.*` `loadSettings()` branches are unchanged. Added `tests/unit/app/admin-settings-content-normalize.test.ts` (22 cases) that calls each normalizer directly and asserts its result equals `getContentSettings()`'s resolved value for the identical stored input, covering the same boundary classes `lib/content/settings.ts`'s own test suite uses: in-range, boundary-exact (count `1`/`6`), out-of-range low/high (`-3`/`999`), fractional truncation (`4.9`→`4`), wrong type, missing key, and an unrecognized enum member (`"middle_of_page"`). A future edit that silently diverges the admin clamp from the storefront resolver now fails this test, not just the pre-existing source-contract regex in `admin-settings-content-tab-source.test.ts` (which continues to pass unmodified).

### Skipped Issues

None — the finding was fixed.

### Gate Results

All run via `mise exec --` from repo root, after the commit above:

| Gate | Result |
|---|---|
| `npm run lint` | 0 errors, 54 warnings (all pre-existing, same baseline as iteration 1) |
| `npm run typecheck` | exit 0, no output |
| `mise exec -- npm test` | 317 test files, 2873 tests passed (2851 iteration-1 total + 22 new: the WR-03 parity test suite) |

---

_Fixed: 2026-09-11T09:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
