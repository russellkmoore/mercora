# Phase 16: Blog Surfacing - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss. Russell was away; grey areas took the recommended answer. Source: Russell's own todo (`.planning/todos/pending/blog-public-navigation-and-home-block.md`), written while testing gift-card checkout.

<domain>
## Phase Boundary

A shopper can reach the blog from the header nav and the mobile menu, with a configurable label, hidden automatically when no article is published. The home page can render a configurable "latest articles" block: heading, article count, and placement, each set from Admin → Settings, not hardcoded in the template. Requirements BLOG-01..03. No change to the admin blog editor, the blog index/detail pages, RSS, or the public blog API — this phase only adds entry points and a home-page block that link to what already exists.
</domain>

<decisions>
## Implementation Decisions

### Data
- **D-01:** `blogPosts.excerpt` already exists and is nullable (`lib/db/schema/blog.ts:21`). The home block's excerpt resolver tries `excerpt` first; when null it derives one from `html` by stripping tags and collapsing whitespace, capped at 160 characters on a word boundary with a trailing "…". New pure helper `lib/blog/excerpt.ts` `resolveBlogExcerpt(post: { excerpt: string | null; html: string }, maxLength = 160): string`.
- **D-02:** No new index. Blog content is not fed into Vectorize/knowledge today (confirmed absent); this phase does not add one — the todo's own note to confirm before adding a second index path is answered "no, don't add one."
- **D-03:** The home block and the nav entry both call the existing `getPublishedBlogPosts` (`lib/models/blog.ts:198`), never a new query path. The nav-hide check uses `getPublishedBlogPosts({ limit: 1 })` and treats a non-empty result as "articles exist."

### Settings
- **D-04:** New `admin_settings` category `content`, following the `promotions.*` precedent in `lib/db/schema/settings.ts`'s `defaultSettings`: `content.blog_nav_label` (string, default `"Blog"`), `content.blog_home_block_enabled` (boolean, default `true`), `content.blog_home_block_heading` (string, default `"From the Blog"`), `content.blog_home_block_count` (number, default `3`, admin UI bounds 1-6, server clamps to 1-6 regardless of stored value), `content.blog_home_block_placement` (string enum `before_featured` \| `after_featured`, default `after_featured`). Read through the existing `getSettings('content')` (`lib/utils/settings.ts:33`), same as every other category. No new settings mechanism.
- **D-05:** Admin UI: a new "Content" tab on the existing tabbed settings page (`app/admin/settings/page.tsx`), styled like the Promotions tab (toggle + text fields + a number input + a select), not folded into Appearance — this is content, not a layout/theme choice. Saves through the existing generic `PUT /api/admin/settings` path (batched, matching the Promotions fields' own save flow); no new API route.
- **D-06:** No separate on/off toggle for the *nav* entry. Per the todo, "a storefront without articles hides it" — visibility follows content (D-03), only the label is configurable. Reduces surface area; an operator who wants to hide a populated blog from nav can unpublish or ask for a later toggle (deferred).

### Header and mobile menu
- **D-07:** `components/HeaderClient.tsx`'s desktop nav and mobile sheet are hardcoded JSX (no nav-array abstraction exists yet). Extract a small pure builder in a new `components/header-links.ts`: `blogNavLabel(config: PublicStoreConfig): string` (reads `content.blog_nav_label` off store config, default `"Blog"`) is enough — the array-splicing pattern from `components/account/AccountNav.tsx`'s `accountLinks()` is the template for *how* to gate, but the header only needs one conditional entry so a full array builder is unnecessary; a single `{ showBlogNav && <Link href="/blog">{blogNavLabel}</Link> }` inline is fine, in both the desktop nav and the mobile sheet, using the same boolean and label so they can never disagree.
- **D-08:** `showBlogNav` (whether any article is published) is computed **server-side** in `components/Header.tsx` (which already does one server data fetch for categories) via `getPublishedBlogPosts({ limit: 1 })`, and passed as a prop to `HeaderClient`, exactly like categories are passed today. No client-side fetch, no layout shift.
- **D-09:** `content.blog_nav_label` reaches the client the same way other public settings do: add it to `toPublicStoreConfig()` in `lib/store-config.ts` (or the header receives it as a server-resolved string prop like categories — Claude's discretion which, but no new `NEXT_PUBLIC_*` var and no second settings fetch).

### Home page block
- **D-10:** `app/page.tsx`'s sections are hardcoded JSX with no section-array abstraction; introducing one is out of scope. The block conditionally renders inline at one of exactly two fixed points — between the hero and the Featured Products grid (`before_featured`) or after the Featured Products grid (`after_featured`) — selected by the `content.blog_home_block_placement` setting, both call sites reading the same resolved `{ enabled, heading, count, placement, posts }` object computed once.
- **D-11:** New component `components/home/BlogHighlights.tsx` (server component): heading (`<h2>`), a grid of article cards copying `components/blog/BlogIndex.tsx`'s card markup verbatim (`rounded-xl border border-border bg-surface-elevated`, `p-5`, title/date/excerpt classes) — title, cover image (when `coverImageUrl` is set; omit the image slot rather than showing a broken image when absent), formatted `publishedAt`, and the resolved excerpt (D-01) — each card linking to `/blog/[slug]`, plus a "Read all" link to `/blog` beside the heading. Grid columns follow the Featured Products section's responsive classes (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).
- **D-12:** The block fetches `getPublishedBlogPosts({ limit: clampedCount })` once in `app/page.tsx` (server component already doing data fetching there) and renders nothing (not even the heading) when `content.blog_home_block_enabled` is false or the result is empty — matching the "hides it" rule from D-06/the todo.

### UI design contract
- **D-13:** The phase's UI is fully derived from existing, already-token-class-correct components (`BlogIndex` card markup, the Featured Products grid, `AccountNav`'s config-gated-link pattern, the Promotions settings tab); no new visual design decisions remain to make. Planning runs with `--skip-ui`, the same call as Phases 9, 12, 13 and 14.

### Footer
- **D-14 (Claude's discretion, recorded so it isn't silently dropped):** `components/Footer.tsx`'s "Blog" link stays hardcoded exactly as it is today. The todo did not ask to change the footer, and re-labelling it from the same setting risks disagreeing with a footer link that is conditioned on CMS pages, not on the nav's article-existence check — a mismatch is out of scope to resolve here. Logged as a deferred idea, not a decision to act on.

### Tests
- **D-15:** New/extended tests: a pure-function test for `resolveBlogExcerpt` (excerpt present → used verbatim; excerpt null + short html → full text; excerpt null + long html → capped at a word boundary with `…`; HTML entities/tags stripped); a source-contract or rendered test for the header (mirroring `account-subscriptions-navigation.test.ts`'s mock-`getStoreConfig`-then-assert-presence/absence pattern, adapted to `getPublishedBlogPosts`) proving the label and the show/hide rule; a behavioural test for `app/page.tsx`'s block (enabled+posts → renders at the chosen placement with the right heading/count; disabled → absent; zero posts → absent) mocking `getSettings`/`getPublishedBlogPosts`; extend `tests/unit/app/api/admin-settings*.test.ts`-style coverage for the new `content.*` keys reading/saving through the generic settings route (no new route, so this is mostly a "new keys are readable/writable, clamped and defaulted correctly" test); `mobile-header-contract.test.ts` stays green (its existing substring assertions must not be disturbed by the new conditional block).

### Research resolutions (Claude, after 16-RESEARCH.md)
- **D-16:** Corrects D-05: settings save through this codebase's generic endpoint is `POST /api/admin/settings` (there is no PUT handler), same as every other category's save flow.
- **D-17:** `getSettings(category)` does not auto-seed `defaultSettings` on read — only the admin API's own `GET` handler does that seeding. Any server component reading `content.*` directly (`Header.tsx`, `app/page.tsx`) must supply its own per-key fallback, mirroring `lib/layout/settings.ts` `getLayoutSettings()`'s pattern for `appearance.*`. A new `lib/content/settings.ts` `getContentSettings()` resolver does this once, returning fully-defaulted `{ blogNavLabel, blogHomeBlockEnabled, blogHomeBlockHeading, blogHomeBlockCount, blogHomeBlockPlacement }`, used by both call sites.
- **D-18:** D-09 is resolved: no store-config change. `StoreConfig`/`toPublicStoreConfig()` is purely `process.env`-derived with no D1 access anywhere in the codebase, so it cannot carry a `content.*` value. `Header.tsx` resolves the label and nav-visibility server-side via `getContentSettings()` + `getPublishedBlogPosts({ limit: 1 })` and passes both to `HeaderClient` as props, exactly like `categories` flows today. No client fetch, no new settings mechanism.
- **D-19:** The app is already `force-dynamic` at the root layout, so the new D1 reads introduce no caching regression; blog posts are not wrapped in `unstable_cache` elsewhere in the codebase and this phase does not add one.
- **D-20:** `app/admin/settings/page.tsx` uses the admin's own hardcoded palette throughout (confirmed: `scan:tokens` excludes any path with an `admin` segment); the new Content tab matches the Promotions tab's existing hardcoded-color styling, not the storefront token classes.

### Claude's Discretion
- Exact icon (if any) for the blog nav entry, matching whatever the Categories/Help & Search entries already use (recommended: none, plain text link, matching "Home").
- Whether cover-image-absent cards show a token-class placeholder block or simply skip the image slot (recommended: skip).
</decisions>

<specifics>
## Specific Ideas

- Russell: "we need to work the blog in. we have the admin, but no way to navigate to articles from public. We also probably want a configurable block on the home page to render blog articles in a new section.. excerpts with a 'read all' link or something like that."
- Todo: "Store-config driven so a storefront without articles hides it" (nav); "Configurable: enabled, heading, count, placement" (home block); "same rule as the gift card: no template hardcoding to data" (settings).
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `lib/db/schema/blog.ts` (fields, esp. `excerpt`, `coverImageUrl`, `status`, `publishedAt`), `lib/models/blog.ts` `getPublishedBlogPosts` (:198), `lib/blog/values.ts` (`BlogPostSummary`)
- `components/blog/BlogIndex.tsx` — the card markup to copy
- `components/Header.tsx`, `components/HeaderClient.tsx` (desktop nav ~358-410, mobile sheet ~450-484)
- `components/account/AccountNav.tsx` `accountLinks()` and `tests/unit/components/account/account-subscriptions-navigation.test.ts` — the config-gated-link test pattern to mirror
- `app/page.tsx` (Hero, Featured Products section ~72-80)
- `lib/db/schema/settings.ts` `defaultSettings` (promotions block as the template), `lib/utils/settings.ts` `getSettings`
- `app/admin/settings/page.tsx` (Promotions tab, lines ~106-112, ~942-1027) — the admin UI pattern
- `lib/store-config.ts` `toPublicStoreConfig` — where a public label setting is exposed to the client, if D-09 goes that route
- `tests/unit/components/mobile-header-contract.test.ts` — must stay green
- `docs/theming.md` "The 23-token contract"; `scripts/scan-hardcoded-colors.mjs`

### Locked
- `getPublishedBlogPosts`'s query semantics (`status = 'published' AND publishedAt <= now`, `MAX_LIMIT = 100`) do not change.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getPublishedBlogPosts` already does exactly the list/filter/order this phase needs; no new query.
- `BlogIndex.tsx`'s card is already the right visual shape for the home block.
- `AccountNav.tsx` + its test is the exact template for a config-gated link and how to test it.

### Established Patterns
- `admin_settings` categories are declared once in `defaultSettings`, read via `getSettings(category)`, saved through the one generic settings route; the Promotions tab is the closest existing "toggle + text + number" admin form.
- Server components (`Header.tsx`, `app/page.tsx`) already do their own data fetching and pass results down as props — no new client-fetch pattern needed.

### Integration Points
- `Header.tsx` → `HeaderClient.tsx` prop passing (categories today, blog-nav visibility + label tomorrow).
- `app/page.tsx` already resolves layout settings (`getLayoutSettings()`) for the hero; the new block's settings read sits beside that.
</code_context>

<deferred>
## Deferred Ideas

- A separate manual on/off toggle for the nav entry, independent of whether articles exist (D-06).
- Making the footer's "Blog" link share the nav's label/visibility rule (D-14).
- Full-text search or a "trending articles" variant of the home block.
- Feeding blog content into Vectorize/knowledge (D-02).
</deferred>

---

*Phase: 16-blog-surfacing*
*Context gathered: 2026-09-11 autonomously from Russell's todo*
