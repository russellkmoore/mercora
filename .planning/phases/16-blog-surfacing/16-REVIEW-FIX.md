---
phase: 16-blog-surfacing
fixed_at: 2026-09-11T09:24:43Z
review_path: .planning/phases/16-blog-surfacing/16-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
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
