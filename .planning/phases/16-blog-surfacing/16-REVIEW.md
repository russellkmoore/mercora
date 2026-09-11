---
phase: 16-blog-surfacing
reviewed: 2026-09-11T09:21:09Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - app/admin/settings/page.tsx
  - app/page.tsx
  - components/Header.tsx
  - components/HeaderClient.tsx
  - components/home/BlogHighlights.tsx
  - lib/blog/excerpt.ts
  - lib/blog/values.ts
  - lib/content/settings.ts
  - lib/db/schema/settings.ts
  - lib/models/blog.ts
  - lib/observability/telemetry.ts
  - tests/unit/lib/content/settings.test.ts
  - tests/unit/lib/blog/excerpt.test.ts
  - tests/unit/lib/models/blog-published-html.test.ts
  - tests/unit/components/header-blog-nav.test.ts
  - tests/unit/components/home/blog-highlights.test.ts
  - tests/unit/app/page-blog-highlights.test.ts
  - tests/unit/app/api/admin-settings-content-category.test.ts
  - tests/unit/app/admin-settings-content-tab-source.test.ts
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-09-11T09:21:09Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 16 (blog surfacing) is a clean, well-tested implementation of BLOG-01/02/03. The widened
`getPublishedBlogPosts({ includeHtml })` is genuinely additive — every pre-existing caller (RSS,
`app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, admin list) omits the new option and keeps its exact
13-column payload, confirmed by both source inspection and a passing test suite. `resolveBlogExcerpt`'s
word-boundary cap, entity decoding, and empty/whitespace handling all match their test assertions and the
plan's documented scope (six named entities, capped-on-derivation only, verbatim explicit excerpt per
BLOG-03's actual wording). `getContentSettings()` never throws and independently defaults/clamps/validates
all five keys. The header's boolean-only boundary is real: `showBlogNav` is collapsed to a strict boolean
in `Header.tsx` before `HeaderClient` ever sees it, and no post object crosses the RSC boundary. The home
block never renders (not even its heading) when disabled or empty, is inserted at exactly one of two fixed
slots, and copies `BlogIndex.tsx`'s card markup byte-for-byte (token classes, no hardcoded colors — `scan:tokens`
passes clean). The admin Content tab correctly saves all five keys through the existing generic endpoint,
uses the admin's own fixed palette (matching D-20), and imports its bounds/enum rather than retyping them.
`content.unknown_selection` telemetry matches the existing `theme.unknown_selection`/`layout.unknown_selection`
taxonomy exactly and never carries the stored value. All specified smoke tests, `npm run typecheck`, and
`npm run scan:tokens` pass clean.

One genuine robustness gap was found: `Header.tsx` — which renders on every route via the root layout —
added a second, completely unguarded D1 read for blog-nav visibility, immediately adjacent to a sibling
read that the same plan deliberately hardened against exactly this failure mode. Two lower-severity issues
round out the findings below.

## Critical Issues

### CR-01: Unguarded `getPublishedBlogPosts` call in `Header.tsx` can turn a blog-table read failure into a full-storefront outage

**File:** `components/Header.tsx:62-64`
**Issue:**

```ts
const { blogNavLabel } = await getContentSettings();
const latestPublishedPosts = await getPublishedBlogPosts({ limit: 1 });
const showBlogNav = latestPublishedPosts.length > 0;
```

`Header` is rendered directly inside `app/layout.tsx` (`app/layout.tsx:258`), inside a `<Suspense>` boundary
that only covers the *pending* state, not thrown/rejected promises. `Header()` is not wrapped in
`app/error.tsx` either — a route segment's `error.tsx` cannot catch an error thrown by its own parent
layout; only `app/global-error.tsx` can, and that boundary replaces the entire `<html>`/`<body>` for every
route, not just `/blog`.

`getPublishedBlogPosts` → `getDbAsync()` (`lib/db.ts:72-75`) has no try/catch anywhere in the chain — a D1
connectivity error, timeout, or binding failure propagates straight up through `Header()` uncaught. Because
`Header` renders on every single page (it is the site's global nav, not something scoped to `/blog`), any
transient failure reading the `blog_posts` table — a table with no other role in page rendering — would
take down every route's render for the duration of the failure, replacing the storefront with the global
error fallback.

This is a real regression risk specifically because the *same plan* explicitly engineered the opposite
posture for the sibling call two lines above: `getContentSettings()` wraps its own `getSettings()` read in
try/catch and documents why in `lib/content/settings.ts:183-186` — *"A database hiccup degrades to an empty
record, rather than a 500 on every storefront page (D-17)."* The exact same reasoning applies to
`getPublishedBlogPosts({ limit: 1 })` here — it exists purely to compute a boolean nav-visibility flag, a
degradable enhancement — but it received no such protection. `tests/unit/components/header-blog-nav.test.ts`
only exercises the resolved/empty-array cases; there is no test for `getPublishedBlogPosts` rejecting.

**Fix:** Guard the read the same way `getContentSettings()` guards its own, defaulting to "no blog nav" on
failure (never crashing the header for a feature that is allowed to silently disappear):

```ts
// components/Header.tsx
let showBlogNav = false;
try {
  showBlogNav = (await getPublishedBlogPosts({ limit: 1 })).length > 0;
} catch {
  // A blog-table read failure must degrade the nav link, not the whole page —
  // mirrors getContentSettings()'s D-17 posture for the exact same reason.
}
```

Add a case to `tests/unit/components/header-blog-nav.test.ts` asserting `Header()` resolves
`showBlogNav: false` (and does not throw) when `getPublishedBlogPosts` rejects.

## Warnings

### WR-01: Admin Content tab does not re-validate loaded `content.*` values against the same bounds the storefront enforces

**File:** `app/admin/settings/page.tsx:291-296`
**Issue:** `getContentSettings()` unconditionally clamps `blogHomeBlockCount` to `[1,6]` and falls back an
unrecognized `blogHomeBlockPlacement` to the default (`lib/content/settings.ts:167-181`, `:132-157`) — by
design, "the clamp does not trust that the admin UI enforced its own bounds" (D-04). But the admin form's
own `loadSettings()` sets `contentSettings` straight from the parsed API value with no equivalent
clamp/enum check:

```ts
if (setting.key === CONTENT_SETTING_KEYS.blogHomeBlockCount) setContentSettings(prev => ({ ...prev, blog_home_block_count: value }));
...
if (setting.key === CONTENT_SETTING_KEYS.blogHomeBlockPlacement) setContentSettings(prev => ({ ...prev, blog_home_block_placement: value }));
```

The `onChange` handlers do clamp on every keystroke (so the UI itself can't produce an out-of-range value
today), but if a `content.blog_home_block_count`/`content.blog_home_block_placement` row is ever out of
range on read — a future migration, a direct D1 edit, or a bug in another write path — the admin dashboard
will silently display and let an admin re-save that raw value verbatim, while the storefront quietly
renders the server-clamped default instead. The admin would have no indication the two disagree.

**Fix:** Apply the same clamp/enum-membership check on load that `getContentSettings()` applies on read
(or, more simply, import and call `getContentSettings()`'s own resolver logic here instead of trusting the
raw API value), so the admin form can never show a number/placement the storefront wouldn't actually use.

### WR-02: `getPublishedBlogPosts` rejection path is untested end-to-end for the blog-nav boolean

**File:** `tests/unit/components/header-blog-nav.test.ts`
**Issue:** Every test in the "Header() resolves blog nav visibility and label server-side" block mocks
`getPublishedBlogPosts` to resolve (`mocks.posts = []` or a populated array). None exercises the rejection
path, so the gap described in CR-01 shipped without a failing test to catch it — the suite would not have
caught this regression, and won't catch one if it reappears after CR-01 is fixed.
**Fix:** Add the rejection-path test alongside CR-01's fix, per that finding's fix section.

---

_Reviewed: 2026-09-11T09:21:09Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
