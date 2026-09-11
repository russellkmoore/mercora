---
phase: 16-blog-surfacing
plan: 01
subsystem: content-settings
tags: [blog, admin-settings, telemetry, drizzle, tdd]

requires: []
provides:
  - "lib/content/settings.ts getContentSettings() — the five content.* admin settings, fully defaulted, never throws"
  - "lib/blog/excerpt.ts resolveBlogExcerpt() — explicit-excerpt-else-derived plain-text excerpt with word-boundary cap"
  - "getPublishedBlogPosts({ includeHtml }) — opt-in post body, byte-identical default payload"
affects: [16-02-blog-header-nav, 16-03-blog-home-block, 16-04-blog-admin-tab]

actuals:
  tokens: 8615
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "content.* admin_settings category, seeded in defaultSettings, resolved per-key with in-code fallback (mirrors appearance.* / lib/layout/settings.ts)"
    - "Enum/text/flag/count resolvers that emit exactly one telemetry signal (never the stored value) on a malformed value, then fall back"
    - "Opt-in wide column select on an existing shared read (summaryColumns(includeHtml)), default false, one call site widened"

key-files:
  created:
    - lib/content/settings.ts
    - lib/blog/excerpt.ts
    - tests/unit/lib/content/settings.test.ts
    - tests/unit/lib/blog/excerpt.test.ts
    - tests/unit/lib/models/blog-published-html.test.ts
  modified:
    - lib/db/schema/settings.ts
    - lib/observability/telemetry.ts
    - lib/blog/values.ts
    - lib/models/blog.ts

key-decisions:
  - "getContentSettings() wraps getSettings('content') in try/catch, degrading to five defaults on any DB error — same posture as getLayoutSettings()/readAppearanceSettings() (D-17)."
  - "Count clamp (1-6) is unconditional in the resolver, independent of whatever bound the admin UI enforces (D-04, T-16-01)."
  - "Enum membership tested with `(allowed as readonly string[]).includes(trimmed)`, never by indexing an object with the stored string (T-16-03, mirrors T-07-01)."
  - "BlogPostSummary.html is optional; a narrow (non-opted-in) row's summary carries no html member at all rather than one set to undefined."

patterns-established:
  - "Content settings resolver: absent/null -> silent fallback; wrong type -> one content.unknown_selection signal (`{ outcome: 'invalid' }`) + fallback; valid -> trimmed/clamped value."

requirements-completed: [BLOG-02, BLOG-03]

coverage:
  - id: D1
    description: "getContentSettings() resolves all five content.* settings against a database with no content rows, honours stored values, and clamps/enum-validates each one"
    requirement: "BLOG-02"
    verification:
      - kind: unit
        ref: "tests/unit/lib/content/settings.test.ts#getContentSettings"
        status: pass
    human_judgment: false
  - id: D2
    description: "resolveBlogExcerpt returns an explicit excerpt verbatim, else a stripped/decoded/collapsed/word-boundary-capped derivation from the body, with single-pass entity decoding (no double-decode)"
    requirement: "BLOG-03"
    verification:
      - kind: unit
        ref: "tests/unit/lib/blog/excerpt.test.ts#resolveBlogExcerpt"
        status: pass
    human_judgment: false
  - id: D3
    description: "getPublishedBlogPosts can return post bodies on request (includeHtml) and returns exactly today's 13-column payload when not asked; adminListBlogPosts is unaffected"
    requirement: "BLOG-03"
    verification:
      - kind: unit
        ref: "tests/unit/lib/models/blog-published-html.test.ts#getPublishedBlogPosts"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/models/blog.test.ts"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/blog/rss.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "No search or embedding index is created for blog content in this plan (D-02)"
    verification: []
    human_judgment: true
    rationale: "An absence is not something a test can positively assert; confirmed by review of this plan's diff, which touches no Vectorize/search/knowledge-index code."

duration: 9min
completed: 2026-09-11
status: complete
---

# Phase 16 Plan 1: Content Settings & Blog Excerpt Data Layer Summary

**Five `content.*` admin settings with a never-throwing typed resolver, a pure word-boundary excerpt derivation, and an opt-in post-body column on the existing published-posts read — the shared data layer 16-02/16-03/16-04 all consume.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-11T08:34:00Z
- **Completed:** 2026-09-11T08:43:10Z
- **Tasks:** 3
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- `lib/content/settings.ts` resolves `blogNavLabel`, `blogHomeBlockEnabled`, `blogHomeBlockHeading`, `blogHomeBlockCount`, `blogHomeBlockPlacement` against the `content` admin-settings category, with per-key fallback (no reliance on `getSettings()` auto-seeding, D-17) and a single `content.unknown_selection` telemetry signal on any malformed stored value.
- `lib/db/schema/settings.ts` gained five `content.*` rows in `defaultSettings`, additions only, matching the schema/in-code default parity the test suite proves.
- `lib/blog/excerpt.ts`'s `resolveBlogExcerpt` returns an editor's explicit excerpt verbatim, or derives one from the post body: strips tags, decodes six entities in a single non-re-scanning pass, collapses whitespace, and caps at a word boundary with a trailing ellipsis (hard-cutting an unbroken over-cap word).
- `getPublishedBlogPosts({ includeHtml: true })` opts a caller into the post body column; every existing caller (`adminListBlogPosts`, and every test that already covered `getPublishedBlogPosts`'s default shape) keeps its byte-identical 13-column payload.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end content settings path** - `69009ef` (feat)
2. **Task 2: resolveBlogExcerpt (RED)** - `7f1d66f` (test)
3. **Task 2: resolveBlogExcerpt (GREEN)** - `2b5f2e3` (feat)
4. **Task 3: Opt-in post body (RED)** - `02e3538` (test)
5. **Task 3: Opt-in post body (GREEN)** - `32c6ce7` (feat)

**Plan metadata:** committed alongside this SUMMARY.

_Task 1 was `type="tracer"`: production-quality end-to-end path, committed in one commit (no test-first split specified for that task)._
_Tasks 2 and 3 carried `tdd="true"`: each has a failing-test commit followed by the minimal-implementation commit. Neither needed a REFACTOR commit — the GREEN implementation was already the intended final shape._

## Files Created/Modified

- `lib/content/settings.ts` - `getContentSettings()` and the five resolvers (text/flag/enum/count), never throws
- `lib/blog/excerpt.ts` - `resolveBlogExcerpt()`, pure, no I/O
- `lib/db/schema/settings.ts` - five `content.*` rows appended to `defaultSettings`
- `lib/observability/telemetry.ts` - one new `content.unknown_selection` event
- `lib/blog/values.ts` - `BlogPostSummary` gained an optional `html` member
- `lib/models/blog.ts` - `summaryColumns(includeHtml)`, `getPublishedBlogPosts({ includeHtml })`, `toSummary` carries `html` conditionally
- `tests/unit/lib/content/settings.test.ts` - defaults, schema/in-code parity, stored-value overrides, clamping, enum fallback + telemetry payload shape, malformed-value fallbacks, DB-error fallback, call-count/category assertion
- `tests/unit/lib/blog/excerpt.test.ts` - 11 cases covering every `<behavior>` bullet
- `tests/unit/lib/models/blog-published-html.test.ts` - default vs. opted-in column sets, unchanged filter/order/limit/offset, no-html-member-when-absent, `adminListBlogPosts` isolation

## Decisions Made

- `getContentSettings()`'s database read is wrapped in try/catch with no memoisation/caching wrapper of any kind, matching `getLayoutSettings()`'s exact posture and the plan's explicit "no cross-request state" requirement.
- Text resolver falls back (never truncates) an over-length stored value — a silently cut label is worse than the documented default.
- `toSummary` spreads an empty object rather than assigning `html: undefined` so a narrow row's summary has no `html` key at all (`"html" in result` is `false`), matching the plan's explicit behavior requirement.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. One wording adjustment: the initial `lib/content/settings.ts` header comment named `unstable_cache`/`React.cache` literally while documenting their *absence*, which tripped the plan's own acceptance-criteria grep (`grep -c "unstable_cache\|React.cache\|let \|var "` must be `0`). Reworded to describe the same guarantee without those literal substrings; not a deviation from the plan's intent, just a grep-safe phrasing fix caught before commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/content/settings.ts` and `lib/blog/excerpt.ts` are ready for 16-02 (`Header.tsx`), 16-03 (`app/page.tsx`, `BlogHighlights.tsx`), and 16-04 (admin Content tab) to import directly — the interfaces are frozen exactly as declared in this plan's `<interface_context>`.
- No blockers. `getPublishedBlogPosts({ includeHtml: true })` is available for 16-03's excerpt derivation.

---
*Phase: 16-blog-surfacing*
*Completed: 2026-09-11*

## Self-Check: PASSED

All 5 created files verified present on disk; all 5 task commit hashes verified present in `git log --oneline --all`.
