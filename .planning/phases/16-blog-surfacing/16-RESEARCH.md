# Phase 16: Blog Surfacing - Research

**Researched:** 2026-09-11
**Domain:** Next.js App Router server-component data flow; D1-backed admin settings; existing blog read model
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `blogPosts.excerpt` already exists and is nullable (`lib/db/schema/blog.ts:21`). The home block's excerpt resolver tries `excerpt` first; when null it derives one from `html` by stripping tags and collapsing whitespace, capped at 160 characters on a word boundary with a trailing "…". New pure helper `lib/blog/excerpt.ts` `resolveBlogExcerpt(post: { excerpt: string | null; html: string }, maxLength = 160): string`.
- **D-02:** No new index. Blog content is not fed into Vectorize/knowledge today (confirmed absent); this phase does not add one — the todo's own note to confirm before adding a second index path is answered "no, don't add one."
- **D-03:** The home block and the nav entry both call the existing `getPublishedBlogPosts` (`lib/models/blog.ts:198`), never a new query path. The nav-hide check uses `getPublishedBlogPosts({ limit: 1 })` and treats a non-empty result as "articles exist."
- **D-04:** New `admin_settings` category `content`, following the `promotions.*` precedent in `lib/db/schema/settings.ts`'s `defaultSettings`: `content.blog_nav_label` (string, default `"Blog"`), `content.blog_home_block_enabled` (boolean, default `true`), `content.blog_home_block_heading` (string, default `"From the Blog"`), `content.blog_home_block_count` (number, default `3`, admin UI bounds 1-6, server clamps to 1-6 regardless of stored value), `content.blog_home_block_placement` (string enum `before_featured` | `after_featured`, default `after_featured`). Read through the existing `getSettings('content')` (`lib/utils/settings.ts:33`), same as every other category. No new settings mechanism.
- **D-05:** Admin UI: a new "Content" tab on the existing tabbed settings page (`app/admin/settings/page.tsx`), styled like the Promotions tab (toggle + text fields + a number input + a select), not folded into Appearance — this is content, not a layout/theme choice. Saves through the existing generic `PUT /api/admin/settings` path (batched, matching the Promotions fields' own save flow); no new API route.
- **D-06:** No separate on/off toggle for the *nav* entry. Per the todo, "a storefront without articles hides it" — visibility follows content (D-03), only the label is configurable. Reduces surface area; an operator who wants to hide a populated blog from nav can unpublish or ask for a later toggle (deferred).
- **D-07:** `components/HeaderClient.tsx`'s desktop nav and mobile sheet are hardcoded JSX (no nav-array abstraction exists yet). Extract a small pure builder in a new `components/header-links.ts`: `blogNavLabel(config: PublicStoreConfig): string` (reads `content.blog_nav_label` off store config, default `"Blog"`) is enough — the array-splicing pattern from `components/account/AccountNav.tsx`'s `accountLinks()` is the template for *how* to gate, but the header only needs one conditional entry so a full array builder is unnecessary; a single `{ showBlogNav && <Link href="/blog">{blogNavLabel}</Link> }` inline is fine, in both the desktop nav and the mobile sheet, using the same boolean and label so they can never disagree.
- **D-08:** `showBlogNav` (whether any article is published) is computed **server-side** in `components/Header.tsx` (which already does one server data fetch for categories) via `getPublishedBlogPosts({ limit: 1 })`, and passed as a prop to `HeaderClient`, exactly like categories are passed today. No client-side fetch, no layout shift.
- **D-09:** `content.blog_nav_label` reaches the client the same way other public settings do: add it to `toPublicStoreConfig()` in `lib/store-config.ts` (or the header receives it as a server-resolved string prop like categories — Claude's discretion which, but no new `NEXT_PUBLIC_*` var and no second settings fetch).
- **D-10:** `app/page.tsx`'s sections are hardcoded JSX with no section-array abstraction; introducing one is out of scope. The block conditionally renders inline at one of exactly two fixed points — between the hero and the Featured Products grid (`before_featured`) or after the Featured Products grid (`after_featured`) — selected by the `content.blog_home_block_placement` setting, both call sites reading the same resolved `{ enabled, heading, count, placement, posts }` object computed once.
- **D-11:** New component `components/home/BlogHighlights.tsx` (server component): heading (`<h2>`), a grid of article cards copying `components/blog/BlogIndex.tsx`'s card markup verbatim (`rounded-xl border border-border bg-surface-elevated`, `p-5`, title/date/excerpt classes) — title, cover image (when `coverImageUrl` is set; omit the image slot rather than showing a broken image when absent), formatted `publishedAt`, and the resolved excerpt (D-01) — each card linking to `/blog/[slug]`, plus a "Read all" link to `/blog` beside the heading. Grid columns follow the Featured Products section's responsive classes (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).
- **D-12:** The block fetches `getPublishedBlogPosts({ limit: clampedCount })` once in `app/page.tsx` (server component already doing data fetching there) and renders nothing (not even the heading) when `content.blog_home_block_enabled` is false or the result is empty — matching the "hides it" rule from D-06/the todo.
- **D-13:** The phase's UI is fully derived from existing, already-token-class-correct components (`BlogIndex` card markup, the Featured Products grid, `AccountNav`'s config-gated-link pattern, the Promotions settings tab); no new visual design decisions remain to make. Planning runs with `--skip-ui`, the same call as Phases 9, 12, 13 and 14.
- **D-14 (Claude's discretion, recorded so it isn't silently dropped):** `components/Footer.tsx`'s "Blog" link stays hardcoded exactly as it is today. The todo did not ask to change the footer, and re-labelling it from the same setting risks disagreeing with a footer link that is conditioned on CMS pages, not on the nav's article-existence check — a mismatch is out of scope to resolve here. Logged as a deferred idea, not a decision to act on.
- **D-15:** New/extended tests: a pure-function test for `resolveBlogExcerpt` (excerpt present → used verbatim; excerpt null + short html → full text; excerpt null + long html → capped at a word boundary with `…`; HTML entities/tags stripped); a source-contract or rendered test for the header (mirroring `account-subscriptions-navigation.test.ts`'s mock-`getStoreConfig`-then-assert-presence/absence pattern, adapted to `getPublishedBlogPosts`) proving the label and the show/hide rule; a behavioural test for `app/page.tsx`'s block (enabled+posts → renders at the chosen placement with the right heading/count; disabled → absent; zero posts → absent) mocking `getSettings`/`getPublishedBlogPosts`; extend `tests/unit/app/api/admin-settings*.test.ts`-style coverage for the new `content.*` keys reading/saving through the generic settings route (no new route, so this is mostly a "new keys are readable/writable, clamped and defaulted correctly" test); `mobile-header-contract.test.ts` stays green (its existing substring assertions must not be disturbed by the new conditional block).

**RESEARCH CORRECTION to D-05 and D-15's route name:** the generic settings save endpoint is `POST /api/admin/settings`, not `PUT` — see Verified Facts below. The behavior CONTEXT.md describes (batched, single request for every category) is otherwise accurate.

### Claude's Discretion

- Exact icon (if any) for the blog nav entry, matching whatever the Categories/Help & Search entries already use (recommended: none, plain text link, matching "Home").
- Whether cover-image-absent cards show a token-class placeholder block or simply skip the image slot (recommended: skip).
- D-09's routing choice: **research recommends the server-prop route** (Header.tsx passes `blogNavLabel` and `showBlogNav` to `HeaderClient` as props), not `toPublicStoreConfig()`. See Verified Facts below for why the store-config route does not fit this codebase's architecture.

### Deferred Ideas (OUT OF SCOPE)

- A separate manual on/off toggle for the nav entry, independent of whether articles exist (D-06).
- Making the footer's "Blog" link share the nav's label/visibility rule (D-14).
- Full-text search or a "trending articles" variant of the home block.
- Feeding blog content into Vectorize/knowledge (D-02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLOG-01 | Header nav (desktop + mobile) shows a configurably-labelled blog entry, hidden when no published article exists | `getPublishedBlogPosts({ limit: 1 })` (`lib/models/blog.ts:198-212`) is the existence check; `Header.tsx` (`components/Header.tsx:49-55`) is the exact server-fetch-then-prop-pass precedent; `getSettings('content')` (`lib/utils/settings.ts:33-53`) resolves the label; `mobile-header-contract.test.ts` pins the exact substrings a new conditional must not disturb (quoted below) |
| BLOG-02 | Home page renders a configurable articles block (heading, N latest published articles as title/cover/date/excerpt, "Read all" link) driven by admin settings, not template code | `app/page.tsx` (`app/page.tsx:51-83`) is the exact insertion point (two fixed slots before/after the Featured Products `<section>`); `BlogIndex.tsx`'s card markup (`components/blog/BlogIndex.tsx:28-39`) is the copy source; `getLayoutSettings()` (`lib/layout/settings.ts:95-122`) is the resolver pattern to mirror for reading+validating the four `content.*` keys with safe fallback |
| BLOG-03 | Excerpt uses explicit field or stripped/capped first-paragraph fallback; block links out, never reproduces content | `blogPosts.excerpt` (`lib/db/schema/blog.ts:21`, nullable `text("excerpt")`); `calculateBlogReadingTime`'s tag-stripping idiom (`lib/blog/values.ts:43-46`, `html.replace(/<[^>]*>/g, " ")`) is the pattern to reuse in a new `resolveBlogExcerpt`; `lib/cms/page-html.ts:7-9`'s private (non-exported) `stripTags` confirms no exported generic strip/truncate utility exists to import instead |
</phase_requirements>

## Summary

Phase 16 is almost entirely composition of existing, already-correct pieces — there is no new query, no new settings mechanism, and no new admin API route. `getPublishedBlogPosts` (`lib/models/blog.ts:198`) already does the exact list/filter/order this phase needs for both call sites. The admin-settings read/write pipeline (`getSettings`, the generic `POST /api/admin/settings` route, `defaultSettings` seeding) already has a `promotions.*`-shaped precedent to copy verbatim for a new `content` category. The two places that need genuinely new code are: (1) a pure excerpt-resolution helper (`lib/blog/excerpt.ts`), and (2) a pure settings-resolution helper for the four `content.*` keys that mirrors `lib/layout/settings.ts`'s `getLayoutSettings()` — read once, validate each field against its own type/enum, fall back silently, never throw.

Three things CONTEXT.md got wrong or left ambiguous, corrected here with file:line evidence: (1) the settings save endpoint is `POST /api/admin/settings`, not `PUT` — there is no PUT handler in `app/api/admin/settings/route.ts`; (2) `getSettings(category)` does **not** merge in `defaultSettings` on every call — only the admin settings **API route**'s `GET` handler does that seeding (`app/api/admin/settings/route.ts:85-120`); a server component calling `getSettings('content')` directly (as `Header.tsx` and `app/page.tsx` will) sees **only rows that already exist in D1**, so the new resolver must supply its own in-code defaults exactly like `getLayoutSettings()` does, never assume the DB row exists; (3) D-09's `toPublicStoreConfig()` route does not fit this codebase — `StoreConfig`/`PublicStoreConfig` is resolved purely from `process.env` (`lib/store-config.ts:366-461`, `getStoreConfig()` calls `resolveStoreConfig(process.env)`) with **zero** connection to D1 `admin_settings`; there is no existing mechanism that folds a D1-backed setting into `StoreConfig`, so adding `content.blog_nav_label` there would require building new plumbing this phase doesn't otherwise need. The server-prop route (label resolved in `Header.tsx`, passed to `HeaderClient` as a prop, exactly matching how `categories` already flows) requires zero new plumbing and is the recommended discretion call.

**Primary recommendation:** Two new pure resolvers (`resolveBlogExcerpt` in `lib/blog/excerpt.ts`, and a `content.*`-settings resolver modeled on `getLayoutSettings()`), one new component (`BlogHighlights.tsx` copying `BlogIndex`'s card markup), one new admin settings tab (copying the Promotions tab's JSX shape), and small, additive edits to `Header.tsx` → `HeaderClient.tsx` prop passing and `app/page.tsx`'s two fixed insertion points. No new API route, no new D1 table, no new npm package.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Blog-nav visibility/label resolution | Frontend Server (SSR) | Database / Storage (D1 read) | `Header.tsx` is already an async server component doing exactly this shape of work for categories (`components/Header.tsx:49-55`) |
| Home articles block content + settings resolution | Frontend Server (SSR) | Database / Storage (D1 read) | `app/page.tsx` is already an async server component reading `getLayoutSettings()` (D1-backed) alongside product data (`app/page.tsx:51-64`) |
| Excerpt derivation | Frontend Server (SSR) — pure function, no I/O | — | Runs on already-fetched `BlogPostSummary` rows; no new fetch, so it belongs beside the data it transforms, not as a client-side computation |
| Admin settings read/write for `content.*` | API / Backend | Admin UI (Browser/Client form) | Existing generic `POST /api/admin/settings` route already owns every category's persistence; the admin settings page is a client component that only calls that route |
| Card/link rendering (BlogHighlights, nav link) | Browser / Client (hydrated) | Frontend Server (SSR, initial paint) | Both are server-rendered with no client interactivity beyond `next/link` navigation — same tier split as `BlogIndex.tsx`'s cards |

## Standard Stack

No new external package is required for this phase. Every capability composes existing, already-installed pieces of this codebase (Drizzle/D1 read helpers, Next.js server components, `next/link`, `lucide-react` icons already imported in `HeaderClient.tsx` and `app/admin/settings/page.tsx`).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next (App Router) | pinned by repo (`package.json`) | Server components, `next/link`, `next/image` | Already the framework; no version change needed for this phase's patterns |
| drizzle-orm | pinned by repo | `getPublishedBlogPosts`, `getSettings` queries | Already used by every model/settings read in this codebase |

### Supporting
None new.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-prop route for `blog_nav_label` (recommended) | `toPublicStoreConfig()` client-store route (D-09's other option) | Would require new D1-into-StoreConfig plumbing that doesn't exist anywhere in the codebase today — `StoreConfig` is purely `process.env`-derived (`lib/store-config.ts:366`); out of proportion to this phase's scope |
| `resolveBlogExcerpt` as a new pure helper | Reusing `lib/cms/page-html.ts`'s `stripTags` | That function is private (not exported) and solves a different problem (normalizing imported page HTML, not excerpting); the tag-stripping *regex idiom* is reused, the function is not imported |

**Installation:** None — no new dependency.

**Version verification:** N/A — no new package.

## Package Legitimacy Audit

**No new external packages are introduced by this phase.** The gate is not applicable; skipped per the protocol's own trigger condition ("whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Request (any route, app/layout.tsx is force-dynamic — app/layout.tsx:51) │
└───────────────────────────┬─────────────────────────────────────────┘
                             │
                 ┌───────────▼────────────┐
                 │  Header.tsx (server)   │
                 │  - listCategories()    │  (existing, unstable_cache)
                 │  - getSettings('content')│ → blog_nav_label
                 │  - getPublishedBlogPosts│ → showBlogNav (limit:1)
                 └───────────┬────────────┘
                             │ props: { categories, showBlogNav, blogNavLabel }
                 ┌───────────▼────────────┐
                 │ HeaderClient.tsx        │
                 │ "use client"            │
                 │ desktop nav (~358-410)  │──▶ { showBlogNav && <Link href="/blog">{blogNavLabel}</Link> }
                 │ mobile sheet (~450-484) │──▶ same conditional, same values
                 └─────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ GET / → app/page.tsx (server, force-dynamic via root layout)          │
│  1. getStoreConfig().commerce.features  (existing)                    │
│  2. getProductsByCategory("cat_1") → featuredProducts (existing)      │
│  3. getLayoutSettings() → homeHero (existing)                         │
│  4. NEW: resolveBlogHighlightsSettings() → { enabled, heading,        │
│           count, placement }  (reads getSettings('content'))          │
│  5. NEW: if enabled, getPublishedBlogPosts({ limit: clampedCount })   │
└───────────────────────────┬────────────────────────────────────────┘
                             │
                 placement === "before_featured"?
                 ┌───────────┴────────────┐
                 ▼                         ▼
      <BlogHighlights /> then       Featured Products <section>
      Featured Products <section>   then <BlogHighlights />
                 │                         │
                 └────────────┬────────────┘
                              ▼
                 BlogHighlights.tsx (server)
                 - <h2>{heading}</h2> + "Read all" → /blog
                 - grid of cards (copies BlogIndex.tsx markup)
                 - each card: resolveBlogExcerpt(post) for the excerpt line
                 - each card links to /blog/[slug]
```

### Recommended Project Structure
```
lib/blog/
├── values.ts          # existing — BlogPostSummary, calculateBlogReadingTime
├── excerpt.ts          # NEW — resolveBlogExcerpt(post, maxLength = 160)
└── highlights.ts        # NEW (suggested name) — resolveBlogHighlightsSettings(), mirrors lib/layout/settings.ts shape

components/
├── header-links.ts       # NEW — blogNavLabel(config) pure helper (D-07)
├── Header.tsx           # EDIT — adds getSettings('content') + getPublishedBlogPosts({limit:1}) reads
├── HeaderClient.tsx       # EDIT — adds showBlogNav/blogNavLabel props + two inline conditionals
└── home/
    └── BlogHighlights.tsx # NEW — server component, copies BlogIndex.tsx card markup

app/
├── page.tsx             # EDIT — reads resolveBlogHighlightsSettings(), inserts BlogHighlights at one of two fixed points
└── admin/settings/page.tsx # EDIT — new "Content" tab (state, form, save-array entry)
```

### Pattern 1: Server-resolved D1 settings with safe fallback (mirror `getLayoutSettings()`)
**What:** Read a settings category once, validate each field's type/enum, fall back silently on anything malformed, never throw.
**When to use:** Any time a server component needs a D1-backed admin setting with a guaranteed shape.
**Example — the exact precedent to mirror, verbatim:**
```typescript
// Source: lib/layout/settings.ts:64-89 (VERIFIED — read this session)
function resolveLayoutEnum<T extends string>(
  stored: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (stored === undefined || stored === null) {
    return fallback;
  }
  if (typeof stored !== "string") {
    recordTelemetry("layout.unknown_selection", { outcome: "invalid" });
    return fallback;
  }
  const trimmed = stored.trim();
  if (trimmed === "") {
    return fallback;
  }
  if ((allowed as readonly string[]).includes(trimmed)) {
    return trimmed as T;
  }
  recordTelemetry("layout.unknown_selection", { outcome: "invalid" });
  return fallback;
}
```
A `resolveBlogHighlightsSettings()` for this phase should follow the identical shape: read `getSettings('content')` once, resolve `blog_home_block_enabled` (boolean, default `true`), `blog_home_block_heading` (string, default `"From the Blog"`), `blog_home_block_count` (number, clamp `Math.max(1, Math.min(6, ...))` — the exact clamp idiom already used by `normalizeRecommendationSettings` for `recommendations.limit`, `lib/utils/settings.ts:147-150`, quoted: `Math.max(1, Math.min(6, Math.trunc(rawLimit))) : 3;`), and `blog_home_block_placement` (enum `"before_featured" | "after_featured"`, default `"after_featured"`, same enum-match-or-fallback shape as `resolveLayoutEnum`).

### Pattern 2: Server fetch → prop pass into a "use client" component (the Header precedent)
**What:** A server component does a data fetch and hands the result down as a typed prop; the client component never fetches.
**Example — the exact precedent, verbatim:**
```typescript
// Source: components/Header.tsx:49-55 (VERIFIED — read this session)
export default async function Header() {
  // Fetch categories on the server for optimal performance with caching
  const categories = await getCachedCategories();

  // Pass data to client component for interactive functionality
  return <HeaderClient categories={categories} />;
}
```
Add `showBlogNav` and `blogNavLabel` the same way — two more awaited values, two more props. `categories` is cached with `unstable_cache` + a revalidation tag (`CATEGORY_NAV_CACHE_TAG`, `lib/cache-tags.ts:4`) because category *writes* are infrequent admin events with a dedicated invalidation call site. **No such caching exists for blog posts anywhere in this codebase** (`getPublishedBlogPosts` is never wrapped in `unstable_cache` or `cache()` — confirmed by reading `lib/models/blog.ts:198-212` in full; only the *singular* `getPublishedBlogPost` uses React's request-scoped `cache()`, `lib/models/blog.ts:225-237`). `app/blog/page.tsx` itself calls `getPublishedBlogPosts` uncached with `export const dynamic = "force-dynamic"` (`app/blog/page.tsx:8,33`). Do not add a new `unstable_cache` wrapper for the nav check — match the existing, simpler, always-live pattern the rest of the blog surface already uses.

### Pattern 3: Config-gated single link (the AccountNav precedent, scaled down per D-07)
**What:** One boolean gates a single nav entry inline; no array-builder abstraction needed for one conditional item.
**Example:**
```typescript
// Source: components/account/AccountNav.tsx:4-14 (VERIFIED — read this session)
export function accountLinks(subscriptionReconciliation: boolean) {
  return [
    ["Overview", "/account"],
    ["Orders", "/account/orders"],
    ...(subscriptionReconciliation
      ? [["Subscriptions", "/account/subscriptions"] as const]
      : []),
    ["Addresses", "/account/addresses"],
    ["Settings", "/account/settings"],
  ] as const;
}
```
`HeaderClient.tsx` has no such array (its nav is hand-written JSX — confirmed by reading the full file), so per D-07 the header only needs the inline form: `{showBlogNav && <Link href="/blog" prefetch={true} className="...">{blogNavLabel}</Link>}`, once in the desktop block (`components/HeaderClient.tsx:358-410`) and once in the mobile sheet (`components/HeaderClient.tsx:450-484`), both reading the identical two props so they can never disagree.

### Anti-Patterns to Avoid
- **Wrapping the new D1 reads in a fresh `unstable_cache`:** nothing else in the blog surface does this; it adds invalidation-plumbing risk (a new cache tag, a new revalidate call site on every admin blog publish/unpublish) for a phase whose own context (D-02/D-06) explicitly limits scope. The app is already fully dynamic (`app/layout.tsx:51`, `export const dynamic = "force-dynamic"`), so there is no static-generation win to protect.
- **Assuming `getSettings('content')` returns seeded defaults:** it does not (see Verified Facts). Any resolver reading it directly must supply its own fallback for every key, exactly like `getLayoutSettings()` does — an absent row is the *normal* first-run state, not an error.
- **Folding `content.*` into `toPublicStoreConfig()`:** would require new, unprecedented D1-into-env-config plumbing (see Verified Facts). Use the server-prop route instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fetching published blog posts | A new query in `app/page.tsz` or `Header.tsx` | `getPublishedBlogPosts` (`lib/models/blog.ts:198`) | Already filters `status = 'published' AND publishedAt <= now`, orders, paginates — locked per CONTEXT.md's canonical_refs |
| Reading/writing admin settings | A new API route for `content.*` | The existing generic `POST /api/admin/settings` (`app/api/admin/settings/route.ts:137`) + `getSettings()` (`lib/utils/settings.ts:33`) | Every other category (`promotions`, `refund`, `recommendations`, `gift_cards`) already goes through this one route; a second route would fragment the settings surface with no benefit |
| Date formatting for the card | A new date formatter | `formatCmsTimestamp` (`lib/utils/cms-timestamp.ts:28-38`) | Already used by `BlogIndex.tsx:35` for the identical `publishedAt` field on the identical card shape |
| HTML tag stripping for the excerpt fallback | A full HTML parser / new dependency | The same regex idiom `calculateBlogReadingTime` already uses (`lib/blog/values.ts:44`, `html.replace(/<[^>]*>/g, " ")`) | No exported generic strip/truncate utility exists in this codebase (`lib/cms/page-html.ts`'s `stripTags` is private and solves a different problem); the regex idiom is proven in production on the same `html` field already |

**Key insight:** This phase's entire implementation surface is glue between things that already exist correctly. The only genuinely new logic is (1) capping/word-boundary-trimming a string, and (2) validating four settings fields with fallback — both single-purpose pure functions with no I/O of their own.

## Common Pitfalls

### Pitfall 1: Assuming `getSettings()` auto-seeds defaults outside the admin API route
**What goes wrong:** A server component calls `getSettings('content')` expecting `content.blog_nav_label` etc. to already be `"Blog"` / `true` / `3` / `"after_featured"` on a fresh D1, and gets `undefined` for every key instead, silently rendering with no label or crashing on a `.toUpperCase()`-style call on `undefined`.
**Why it happens:** The default-seeding logic lives *only* inside `GET /api/admin/settings`'s handler (`app/api/admin/settings/route.ts:85-120`, verified by reading the full route file) — it inserts `defaultSettings` rows into D1 the first time an admin loads the settings page for that category. `lib/utils/settings.ts`'s `getSettings()` itself (verified `lib/utils/settings.ts:33-53`) does a bare `db.select()` with no seeding and no fallback logic whatsoever — it returns exactly whatever rows exist.
**How to avoid:** Every reader of `content.*` (the header, the home page) must supply its own in-code default for each key, exactly like `getLayoutSettings()` does for `appearance.*` (`lib/layout/settings.ts:95-122`) — never assume the row exists.
**Warning signs:** Blog nav label renders as `undefined` or blank on a fresh clone/fresh D1 before an admin has ever opened the Content settings tab.

### Pitfall 2: Building the `blog_nav_label` route through `toPublicStoreConfig()`
**What goes wrong:** Attempting to add a `content.blog_nav_label` field onto `StoreConfig`/`PublicStoreConfig` discovers there is no D1 read anywhere in `resolveStoreConfig()` (`lib/store-config.ts:366-461`) — it takes only an `Environment` (`process.env`) argument. Wiring in a D1 read here would need to thread an async settings fetch through a function every current caller treats as synchronous (`getStoreConfig()` itself is synchronous, `lib/store-config.ts:469-471`), a much larger change than this phase's scope.
**Why it happens:** `StoreConfig` was designed as a purely env-derived, build/request-cheap value (`lib/store-config.ts:1-8`'s own header comment warns against anything heavier). D1-backed settings (theme, layout, content) intentionally live in a separate resolution path (`lib/layout/settings.ts`, `lib/themes/active-theme.ts`).
**How to avoid:** Take the server-prop route (Pattern 2 above) — resolve the label in `Header.tsx`, pass it to `HeaderClient` as a prop.
**Warning signs:** `resolveStoreConfig()` needing to become `async`, or a new synchronous cache layer appearing just to fake synchronicity — either is a sign of forcing the wrong architecture.

### Pitfall 3: Two D1 round trips per page load and treating it as a bug to fix
**What goes wrong:** `Header.tsx`'s `getPublishedBlogPosts({ limit: 1 })` and `app/page.tsx`'s `getPublishedBlogPosts({ limit: clampedCount })` are two separate D1 queries on the same home-page request, with different `limit` arguments, so no per-request memoization (even a request-scoped `React.cache()`) would dedupe them — `cache()` keys on argument equality, and these two calls never share arguments.
**Why it happens:** `Header` and `HomePage` are siblings under `app/layout.tsx` (`<Header />` at `app/layout.tsx:258`, independent of the routed page), not parent/child — there is no natural prop channel between them, and `Header` renders on every route, not just `/`, so it cannot depend on the home page's own count.
**How to avoid:** Accept it. This repo has an explicit precedent for accepting two D1 reads per request when sharing them would break independence: "[Phase 07]: Accepted two D1 reads per request for `getLayoutSettings()`… keeps the new resolver fully independent of the frozen theme-resolver test suite" (`.planning/STATE.md`, Phase 07 decisions). Do not build cross-component memoization to "fix" this.
**Warning signs:** A plan task proposing a shared "blog highlights context" or a request-scoped singleton just to avoid the second query — unnecessary complexity for two cheap, indexed (`blog_posts_status_published_idx`, `lib/db/schema/blog.ts:39`) reads.

### Pitfall 4: Breaking `mobile-header-contract.test.ts`'s pinned substrings
**What goes wrong:** The new conditional blog link is inserted in a way that changes `HeaderClient.tsx`'s existing `min-w-0 flex-1 truncate` logo wrapper, the `flex shrink-0 items-center gap-1` mobile controls wrapper, the `<SheetTrigger>`/`<DropdownMenuTrigger>` boundaries the test's regex captures, or `CartDrawer.tsx`'s pinned strings — none of which this phase should touch at all.
**Why it happens:** The test (`tests/unit/components/mobile-header-contract.test.ts`, read in full this session) asserts on raw substrings of the file's *source text*, not rendered output — any edit anywhere in `HeaderClient.tsx` risks an accidental adjacency change if it's placed carelessly near these blocks.
**How to avoid:** Insert the new `{showBlogNav && ...}` link as a new sibling JSX expression inside the existing desktop nav div (`components/HeaderClient.tsx:358-410`) and mobile sheet div (`components/HeaderClient.tsx:450-484`) — do not touch the logo `<Link>` (`:349-355`), the mobile controls wrapper (`:413`), or `CartDrawer.tsx` at all.
**Warning signs:** `npx vitest run tests/unit/components/mobile-header-contract.test.ts` failing after an otherwise-correct-looking header diff.

### Pitfall 5: Forgetting the settings-save route already rejects unrecognized categories' honor-guard-adjacent keys
**What goes wrong:** Not applicable to `content.*` directly, but worth knowing: `POST /api/admin/settings` has a `writesTheHonorGuard()` guard (`app/api/admin/settings/route.ts:46-58`) that special-cases the `gift_cards` category. `content.*` keys are unaffected by this guard (different category name), but a plan task should not assume every category is unconditionally writable without reading this file — it is, for `content`, but the reason is "no matching guard clause," not "no guards exist at all."
**How to avoid:** No code change needed here — just don't assume the settings route is guard-free when writing verification steps; note explicitly that `content.*` passes through with no additional gate beyond `checkAdminPermissions` (`app/api/admin/settings/route.ts:67-73`, applied to both `GET` and `POST`).

## Code Examples

### Reading a D1 settings category (existing, direct precedent)
```typescript
// Source: lib/utils/settings.ts:33-53 (VERIFIED — read this session)
export async function getSettings(category?: string): Promise<Record<string, any>> {
  const db = await getDbAsync();

  let settings;
  if (category) {
    settings = await db.select().from(admin_settings).where(eq(admin_settings.category, category));
  } else {
    settings = await db.select().from(admin_settings);
  }

  const result: Record<string, any> = {};
  for (const setting of settings) {
    try {
      result[setting.key] = JSON.parse(setting.value as string);
    } catch {
      result[setting.key] = setting.value;
    }
  }

  return result;
}
```

### The existing numeric-clamp idiom to reuse for `blog_home_block_count`
```typescript
// Source: lib/utils/settings.ts:147-150 (VERIFIED — read this session)
const rawLimit = raw['recommendations.limit'];
const limit = typeof rawLimit === 'number' && Number.isFinite(rawLimit)
  ? Math.max(1, Math.min(6, Math.trunc(rawLimit)))
  : 3;
```

### The Promotions tab's toggle/number/select shapes to copy for the new Content tab
```typescript
// Source: app/admin/settings/page.tsx:990-1021 (VERIFIED — read this session)
<Switch
  checked={promotionSettings.banner_enabled}
  onCheckedChange={(checked) => setPromotionSettings(prev => ({ ...prev, banner_enabled: checked }))}
/>
// ...
<select
  value={promotionSettings.banner_type}
  onChange={(e) => setPromotionSettings(prev => ({ ...prev, banner_type: e.target.value as any }))}
  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-md"
>
  <option value="info">Info (Blue)</option>
  {/* ... */}
</select>
```
Note: `app/admin/settings/page.tsx` uses the admin's own hardcoded palette (`bg-neutral-700`, `text-white`, `bg-orange-600`), **not** token classes — this is by design. `scripts/scan-hardcoded-colors.mjs` explicitly excludes any path with an `admin` directory segment (`scripts/scan-hardcoded-colors.mjs:23-24,132`, quoted: `const EXCLUDED_DIR_SEGMENT = "admin";` / `if (entry.name === EXCLUDED_DIR_SEGMENT) continue; // never descend into admin/`), matching `AGENTS.md`'s "admin dashboard is explicitly excluded from the token contract" rule. Do not token-class the new Content tab.

### Tab-list entry to add
```typescript
// Source: app/admin/settings/page.tsx:476-485 (VERIFIED — read this session)
const tabs = [
  { kind: "state" as const, id: "system" as const, label: "System", icon: Settings, description: "Maintenance & debug" },
  // ... existing entries ...
  { kind: "state" as const, id: "promotions" as const, label: "Promotions", icon: DollarSign, description: "Sales & banners" },
  // NEW: { kind: "state" as const, id: "content" as const, label: "Content", icon: <some lucide icon>, description: "Blog nav & home block" },
  { kind: "route" as const, id: "appearance" as const, href: "/admin/settings/appearance", label: "Appearance", icon: Palette, description: "Theme & look" },
];
```
Also requires: extending the `activeTab` union type (`page.tsx:132`), a new `contentSettings` state object (mirroring `promotionSettings`, `page.tsx:175-181`), a new branch in `loadSettings()`'s per-row `forEach` (`page.tsx:229-264`), five new entries appended to the `updates` array inside `handleSave()` (`page.tsx:385-422`), and a new `{activeTab === "content" && (...)}` JSX block modeled on the Promotions block (`page.tsx:943-1027`).

### The `BlogIndex` card markup to copy for `BlogHighlights`
```tsx
// Source: components/blog/BlogIndex.tsx:28-39 (VERIFIED — read this session)
<article key={post.id} className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
  {post.coverImageUrl && (
    <Link href={`/blog/${post.slug}`} tabIndex={-1} aria-hidden>
      <Image src={post.coverImageUrl} alt="" width={720} height={405} className="aspect-video w-full object-cover" />
    </Link>
  )}
  <div className="p-5">
    <p className="text-xs uppercase tracking-wider text-muted-foreground">{formatCmsTimestamp(post.publishedAt)} · {post.readingTime} min read</p>
    <h2 className="mt-2 text-xl font-semibold text-foreground"><Link href={`/blog/${post.slug}`} className="hover:text-primary/90">{post.title}</Link></h2>
    {post.excerpt && <p className="mt-3 line-clamp-3 text-muted-foreground">{post.excerpt}</p>}
  </div>
</article>
```
For `BlogHighlights.tsx`, the excerpt line becomes unconditional (`{resolveBlogExcerpt(post)}` instead of `{post.excerpt && ...}`) since the resolver always returns a non-empty string per D-01.

### `app/page.tsx`'s exact current structure (insertion points)
```tsx
// Source: app/page.tsx:51-83 (VERIFIED — read this session)
export default async function HomePage() {
  const { giftCardAcquisition } = getStoreConfig().commerce.features;
  const featuredProducts = filterListedProducts(
    (await getProductsByCategory("cat_1")).filter((product) => product.status === "active"),
    { giftCardAcquisition },
  ).map(toPublicProduct).slice(0, 3);

  const { homeHero } = await getLayoutSettings();
  const HeroVariant = HOME_HERO_MAP[homeHero];

  return (
    <div className="bg-surface-elevated text-foreground px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      <HeroVariant featuredProduct={featuredProducts[0] ?? null} />
      {/* before_featured slot goes here */}
      <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 mb-12 sm:mb-16">
        {featuredProducts.map((product, index) => (
          <ProductCard key={product.id} product={product} priority={index === 0} />
        ))}
      </section>
      {/* after_featured slot goes here */}
    </div>
  );
}

export const revalidate = 3600; // NOTE: overridden in practice — app/layout.tsx:51 sets `export const dynamic = "force-dynamic"` at the root, which takes precedence over a child route's `revalidate` export.
```

## State of the Art

No framework/library version changes are relevant to this phase — it is pure composition of existing code paths at their current versions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A reasonable default icon (e.g. a lucide `Newspaper`/`FileText`) is fine for the new admin "Content" tab; no specific icon was locked by CONTEXT.md | Code Examples / Don't Hand-Roll | Cosmetic only — trivial to swap, no functional impact |
| A2 | Stripping only the five common HTML entities (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&#39;`/`&quot;`) is sufficient for D-15's "HTML entities... stripped" test requirement, since no HTML-entity-decoding library exists in this codebase and none is being added | Common Pitfalls / Don't Hand-Roll | If blog post HTML contains rarer entities (e.g. `&mdash;`), the excerpt could show the raw entity instead of the character — low-severity, cosmetic, and only affects the automatic-derivation fallback path (not the common case where an editor sets an explicit excerpt) |

**If this table is empty:** N/A — two low-risk cosmetic assumptions remain, both flagged above; every architectural/data-flow claim in this document was verified by reading the source this session.

## Open Questions

None blocking. The two Assumptions above are the only unresolved discretion points, and both are explicitly marked Claude's Discretion in CONTEXT.md or are low-risk cosmetic choices with no behavioral test dependency.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest.config.mts`, `environment: "node"`, JSX transform `"automatic"` even in node env — confirmed `vitest.config.mts:9-13`) |
| Config file | `vitest.config.mts` (unit tests only; `vitest.workers.config.mts` and `vitest.observability.config.mts` are separate suites this phase does not touch) |
| Quick run command | `mise exec -- npx vitest run tests/unit/lib/blog/excerpt.test.ts tests/unit/components/header-blog-nav.test.ts tests/unit/app/page-blog-highlights.test.ts` (adjust filenames to the plan's actual test names) |
| Full suite command | `mise exec -- npm test` (equivalent to `vitest run`, includes `tests/unit/**/*.test.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BLOG-01 | Header shows configurable label; hidden when no published post | unit (source-contract/rendered, mirroring `account-subscriptions-navigation.test.ts`) | `mise exec -- npx vitest run tests/unit/components/header-blog-nav.test.ts -x` | ❌ Wave 0 |
| BLOG-01 | `mobile-header-contract.test.ts`'s pinned substrings stay intact | unit (regression) | `mise exec -- npx vitest run tests/unit/components/mobile-header-contract.test.ts -x` | ✅ (existing, must stay green) |
| BLOG-02 | Home block renders at chosen placement with right heading/count; absent when disabled/empty | unit (behavioural, mocking `getSettings`/`getPublishedBlogPosts`) | `mise exec -- npx vitest run tests/unit/app/page-blog-highlights.test.ts -x` | ❌ Wave 0 |
| BLOG-03 | `resolveBlogExcerpt` covers explicit/null/long/entity cases | unit (pure function) | `mise exec -- npx vitest run tests/unit/lib/blog/excerpt.test.ts -x` | ❌ Wave 0 |
| BLOG-01/02/03 | New `content.*` keys read/write/clamp/default correctly through the generic route | unit (extends `admin-settings-empty-category.test.ts`-style coverage) | `mise exec -- npx vitest run tests/unit/app/api/admin-settings-empty-category.test.ts -x` | ✅ (existing file to extend, not create) |

### Sampling Rate
- **Per task commit:** the quick run command above, scoped to the files the task touched
- **Per wave merge:** `mise exec -- npm test` (full unit suite)
- **Phase gate:** full CI-mirroring gate before `/gsd-verify-work` — `npm audit --omit=dev --audit-level=high`, `npm run build:themes:check`, `npm run scan:tokens`, `npm run lint`, `npm run typecheck`, `npm run cf-typecheck`, `npm test`, `npm run test:workers`, `npm run test:observability-worker`, `npm run build` (the exact CI order from `AGENTS.md`)

### Wave 0 Gaps
- [ ] `tests/unit/lib/blog/excerpt.test.ts` — covers BLOG-03 (new file; `tests/unit/lib/blog/` already exists with `http.test.ts`, `rss.test.ts` as siblings)
- [ ] `tests/unit/components/header-blog-nav.test.ts` — covers BLOG-01 (new file; model directly on `tests/unit/components/account/account-subscriptions-navigation.test.ts`'s `vi.mock` + `renderToStaticMarkup` pattern, mocking `@/lib/models/blog` and `@/lib/utils/settings` instead of `@/lib/store-config`)
- [ ] `tests/unit/app/page-blog-highlights.test.ts` — covers BLOG-02 (new file)
- [ ] No new test framework install needed — Vitest is already configured and every precedent pattern (mock + `renderToStaticMarkup`, or source-string assertions) is already in use elsewhere in this repo

## Security Domain

`security_enforcement` is not set to `false` anywhere in `.planning/config.json` (confirmed by reading the full file this session — it contains only `workflow` and `git` keys), so this section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase adds no new authenticated surface; the only write path (`content.*` settings) already requires admin auth |
| V3 Session Management | No | No new session-bearing surface |
| V4 Access Control | Yes | `checkAdminPermissions()` already gates both `GET` and `POST /api/admin/settings` (`app/api/admin/settings/route.ts:67-73`, `140-146` — VERIFIED read this session); no new route is added, so no new access-control surface to build, only to confirm the existing gate still covers the new `content.*` keys (it does — the route has no per-category allowlist except the `gift_cards`-specific honor-guard carve-out) |
| V5 Input Validation | Yes | `blog_home_block_count` must be clamped server-side regardless of the stored value (D-04's own text: "server clamps to 1-6 regardless of stored value") using the `Math.max(1, Math.min(6, ...))` idiom already proven at `lib/utils/settings.ts:149`; `blog_home_block_placement` must validate against the two-member enum with fallback, mirroring `resolveLayoutEnum` (`lib/layout/settings.ts:64-89`) |
| V6 Cryptography | No | No cryptographic material is introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via `content.blog_nav_label` or `content.blog_home_block_heading` (admin-controlled free text rendered into the storefront header/home page) | Tampering / Elevation of Privilege (if a non-super-admin can write it) | React's default JSX text-node escaping renders these as plain text automatically — no `dangerouslySetInnerHTML` is used anywhere in `HeaderClient.tsx` or the planned `BlogHighlights.tsx`; do not introduce one for these fields. Write access is already admin-gated (see V4 above), so this is defense-in-depth, not the primary control |
| Excerpt fallback rendering raw HTML from `blogPosts.html` as unescaped markup | Tampering (stored content escaping its container) | `resolveBlogExcerpt` must strip tags to **plain text** before returning (D-01), and the caller renders it as plain JSX text (like `BlogIndex.tsx:37` already does for the `excerpt` field) — never `dangerouslySetInnerHTML` |
| Settings-write replay/over-broad category writes | Tampering | Already mitigated by the existing `writesTheHonorGuard()` category-scoped refusal pattern (`app/api/admin/settings/route.ts:46-58`); `content` is a new, unguarded-but-admin-gated category with no sensitive cross-category leakage risk (it holds no balances, no PII, no secrets) |

## Sources

### Primary (HIGH confidence — all read directly this session)
- `lib/models/blog.ts` — full file read, `getPublishedBlogPosts` signature/caching confirmed absent
- `lib/db/schema/blog.ts` — full file read, `excerpt`/`coverImageUrl`/`status`/`publishedAt` fields confirmed
- `lib/blog/values.ts` — full file read, `BlogPostSummary`, `calculateBlogReadingTime` tag-stripping regex
- `components/Header.tsx`, `components/HeaderClient.tsx` — full files read
- `lib/store-config.ts` — full file read, confirmed purely env-derived
- `app/page.tsx` — full file read
- `lib/db/schema/settings.ts`, `lib/utils/settings.ts`, `app/api/admin/settings/route.ts` — full files read
- `app/admin/settings/page.tsx` — read in sections (header/imports, state, `loadSettings`, `handleSave`, tabs array, Promotions tab JSX)
- `lib/layout/settings.ts` — full file read (the resolver pattern to mirror)
- `components/blog/BlogIndex.tsx`, `components/account/AccountNav.tsx` — full files read
- `tests/unit/components/mobile-header-contract.test.ts`, `tests/unit/components/account/account-subscriptions-navigation.test.ts` — full files read
- `lib/cms/page-html.ts` — full file read, confirmed `stripTags` is private/non-exported
- `lib/utils/cms-timestamp.ts` — full file read
- `lib/cache-tags.ts` — full file read, confirmed no blog cache tag exists
- `app/blog/page.tsx` — head read, confirmed uncached/`force-dynamic` precedent
- `app/layout.tsx` — grepped, confirmed root-level `force-dynamic`
- `components/Footer.tsx` — grepped, confirmed hardcoded "Blog" link location (D-14, not touched)
- `scripts/scan-hardcoded-colors.mjs` — grepped, confirmed `admin` directory exclusion
- `vitest.config.mts`, `package.json` scripts — read/grepped, confirmed test commands and environment
- `.planning/config.json` — read, confirmed `nyquist_validation` absent (treated enabled) and `security_enforcement` absent (treated enabled)

### Secondary (MEDIUM confidence)
None — every material claim in this document traces to a file read this session.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, every reused piece read directly
- Architecture: HIGH — every insertion point, prop-passing precedent, and settings-resolution precedent verified by reading the actual source files, including two corrections to CONTEXT.md (PUT→POST, and the `getSettings()`/`defaultSettings` seeding boundary)
- Pitfalls: HIGH — each pitfall traces to a specific file:line verified this session, not inferred

**Research date:** 2026-09-11
**Valid until:** 2026-10-11 (30 days — this is internal application code with no external version-drift risk; re-verify if `app/page.tsx`, `HeaderClient.tsx`, or the admin settings route change substantially before planning executes)
