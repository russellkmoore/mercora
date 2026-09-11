# Phase 16: Blog Surfacing - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** 9 (5 new, 4 edited) + 4 new test files
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/blog/excerpt.ts` | utility | transform | `lib/blog/values.ts` (`calculateBlogReadingTime`) | exact |
| `lib/content/settings.ts` | service | CRUD (read, defaulted) | `lib/layout/settings.ts` (`getLayoutSettings`) | exact |
| `lib/db/schema/settings.ts` (additions) | model/config | CRUD | `promotions.*` block in same file's `defaultSettings` | exact |
| `components/header-links.ts` | utility | transform | `components/account/AccountNav.tsx` (`accountLinks()`) | role-match (scaled down per D-07) |
| `components/Header.tsx` | component (server) | request-response | itself, existing categories fetch | exact (edit) |
| `components/HeaderClient.tsx` | component (client) | request-response | itself, existing nav JSX | exact (edit) |
| `app/page.tsx` | route/page (server) | request-response | itself, existing `getLayoutSettings()` + Featured Products section | exact (edit) |
| `components/home/BlogHighlights.tsx` | component (server) | request-response | `components/blog/BlogIndex.tsx` | exact |
| `app/admin/settings/page.tsx` (Content tab) | component (client, admin) | CRUD (form + save) | same file's Promotions tab | exact |
| `tests/unit/lib/blog/excerpt.test.ts` | test | transform | `tests/unit/lib/blog/*.test.ts` siblings (`values.test.ts` pattern) | exact |
| `tests/unit/components/header-blog-nav.test.ts` | test | request-response | `tests/unit/components/account/account-subscriptions-navigation.test.ts` | exact |
| `tests/unit/app/page-blog-highlights.test.ts` | test | request-response | same account-nav test's mock+render pattern, adapted | role-match |
| `tests/unit/app/api/admin-settings-*.test.ts` (extend) | test | CRUD | existing file, extend in place | exact |

## Pattern Assignments

### `lib/blog/excerpt.ts` (utility, transform)

**Analog:** `lib/blog/values.ts` — `calculateBlogReadingTime` (tag-stripping idiom, line ~44)

**Core pattern to copy** — the tag-stripping regex:
```typescript
// Source: lib/blog/values.ts:44
html.replace(/<[^>]*>/g, " ")
```

**New function signature (per D-01):**
```typescript
export function resolveBlogExcerpt(
  post: { excerpt: string | null; html: string },
  maxLength = 160,
): string
```

**Logic to implement:**
1. If `post.excerpt` is a non-null, non-empty string, return it verbatim.
2. Otherwise strip tags from `post.html` with the regex above, decode the five common HTML entities (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&#39;`/`&quot;`) since no entity-decoding library exists in this codebase (`lib/cms/page-html.ts`'s `stripTags` is private, not importable — confirm via `git ls-files -- lib/cms/page-html.ts`), collapse whitespace.
3. If the result is ≤ `maxLength`, return it as-is.
4. Otherwise cut at the last word boundary ≤ `maxLength` and append `"…"`.

Pure function, no I/O — do not import anything from `lib/db` or `lib/models`.

---

### `lib/content/settings.ts` (service, CRUD read-with-fallback)

**Analog:** `lib/layout/settings.ts` — `resolveLayoutEnum` + `getLayoutSettings` (verified read this session, lines 64-89 and surrounding)

**Enum-resolution pattern to copy verbatim** (adapt name/telemetry event):
```typescript
// Source: lib/layout/settings.ts:64-89
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

**Numeric clamp idiom to copy** (for `blog_home_block_count`):
```typescript
// Source: lib/utils/settings.ts:147-150
const rawLimit = raw['recommendations.limit'];
const limit = typeof rawLimit === 'number' && Number.isFinite(rawLimit)
  ? Math.max(1, Math.min(6, Math.trunc(rawLimit)))
  : 3;
```

**Read call to base the new resolver on:**
```typescript
// Source: lib/utils/settings.ts:33-53
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

**New function to write, mirroring `getLayoutSettings()`'s shape exactly:**
```typescript
export async function getContentSettings(): Promise<{
  blogNavLabel: string;
  blogHomeBlockEnabled: boolean;
  blogHomeBlockHeading: string;
  blogHomeBlockCount: number;
  blogHomeBlockPlacement: "before_featured" | "after_featured";
}>
```
Call `getSettings('content')` once; resolve each key with its own default (never assume the D1 row exists — `getSettings()` does NOT auto-seed `defaultSettings`, only the admin API `GET` handler does that). Never throw.

**CRITICAL — do not build a request-scoped memoization/context to share this read with `Header.tsx`'s own call.** Two independent D1 reads per home-page request is the accepted, precedented pattern (see Pitfall 3 in RESEARCH.md, citing Phase 07's `getLayoutSettings()` precedent).

---

### `lib/db/schema/settings.ts` (additions to `defaultSettings`)

**Analog:** the existing `promotions.*` block in the same file's `defaultSettings` object.

Add a new `content` category following the exact same shape (string key → typed default value) used by `promotions`. Read the file directly to copy the object literal shape (key naming convention `content.blog_nav_label`, etc., matching D-04's dotted-key names) — do not invent a different naming scheme.

New keys (per D-04):
```
content.blog_nav_label            -> "Blog"
content.blog_home_block_enabled   -> true
content.blog_home_block_heading   -> "From the Blog"
content.blog_home_block_count     -> 3
content.blog_home_block_placement -> "after_featured"
```

---

### `components/header-links.ts` (utility, transform)

**Analog:** `components/account/AccountNav.tsx` — `accountLinks()` (lines 4-14, verified)

```typescript
// Source: components/account/AccountNav.tsx:4-14
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

Per D-07, this is the *template for how to gate a link*, not literally an array builder to reuse — the header needs only one conditional entry. `components/header-links.ts` should export a small pure helper:
```typescript
export function blogNavLabel(config: PublicStoreConfig): string
```
Note the RESEARCH.md correction (D-18): the label is **not** resolved via `PublicStoreConfig`/`toPublicStoreConfig()` — it is resolved server-side in `Header.tsx` via `getContentSettings()` and passed as a prop. Confirm the exact discretion call in the plan before implementing; `header-links.ts` may end up unnecessary if the inline conditional in `HeaderClient.tsx` is sufficient (D-07's own text: "a single `{ showBlogNav && <Link>... }` inline is fine").

---

### `components/Header.tsx` (server component, edit)

**Analog:** itself — the existing categories fetch-then-pass-prop pattern.

```typescript
// Source: components/Header.tsx:49-55 (VERIFIED)
export default async function Header() {
  // Fetch categories on the server for optimal performance with caching
  const categories = await getCachedCategories();

  // Pass data to client component for interactive functionality
  return <HeaderClient categories={categories} />;
}
```

**Edit:** add two more awaited values and two more props, same shape:
```typescript
const { blogNavLabel } = await getContentSettings();
const showBlogNav = (await getPublishedBlogPosts({ limit: 1 })).length > 0;

return <HeaderClient categories={categories} showBlogNav={showBlogNav} blogNavLabel={blogNavLabel} />;
```
Do **not** wrap this in `unstable_cache` — no blog-post caching exists anywhere in this codebase (`getPublishedBlogPosts` is never cached; only the singular `getPublishedBlogPost` uses request-scoped `cache()`). Match the existing simpler, always-live pattern.

---

### `components/HeaderClient.tsx` (client component, edit)

**Analog:** itself — the existing hardcoded desktop nav (~358-410) and mobile sheet (~450-484).

**Insertion pattern (D-07):**
```tsx
{showBlogNav && (
  <Link href="/blog" prefetch={true} className="/* match sibling nav link classes exactly */">
    {blogNavLabel}
  </Link>
)}
```
Insert as a new sibling JSX expression inside the existing desktop nav `<div>` and inside the mobile sheet `<div>` — using the identical `showBlogNav`/`blogNavLabel` props in both places so they can never disagree.

**Do not touch:** the logo `<Link>` (~349-355), the mobile controls wrapper (~413), or `CartDrawer.tsx` — `tests/unit/components/mobile-header-contract.test.ts` pins raw substrings from these exact regions; any adjacency change there breaks that test. Read the actual current line numbers before editing since RESEARCH.md's line refs may have drifted slightly.

---

### `app/page.tsx` (server route, edit)

**Analog:** itself — existing `getLayoutSettings()` read and the Featured Products section.

```tsx
// Source: app/page.tsx:51-83 (VERIFIED)
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
      {/* before_featured slot */}
      <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 mb-12 sm:mb-16">
        {featuredProducts.map((product, index) => (
          <ProductCard key={product.id} product={product} priority={index === 0} />
        ))}
      </section>
      {/* after_featured slot */}
    </div>
  );
}
```

**Edit:** add, alongside the `getLayoutSettings()` read:
```typescript
const { blogHomeBlockEnabled, blogHomeBlockHeading, blogHomeBlockCount, blogHomeBlockPlacement } = await getContentSettings();
const blogPosts = blogHomeBlockEnabled ? await getPublishedBlogPosts({ limit: blogHomeBlockCount }) : [];
const showBlogHighlights = blogHomeBlockEnabled && blogPosts.length > 0;
```
Compute this object once; both insertion points (`before_featured`, `after_featured`) read the same resolved values so the block never renders twice or inconsistently. Render nothing (not even the heading) when `!showBlogHighlights`.

---

### `components/home/BlogHighlights.tsx` (server component, new)

**Analog:** `components/blog/BlogIndex.tsx` (lines 28-39, verified) — card markup to copy verbatim.

```tsx
// Source: components/blog/BlogIndex.tsx:28-39
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

**Differences for `BlogHighlights.tsx`:**
- Excerpt line becomes unconditional: `<p className="mt-3 line-clamp-3 text-muted-foreground">{resolveBlogExcerpt(post)}</p>` (resolver always returns non-empty string per D-01).
- Grid wrapper uses Featured Products' responsive classes: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (from `app/page.tsx`'s Featured Products `<section>`).
- Add `<h2>{heading}</h2>` plus a "Read all" link to `/blog`, positioned beside the heading.
- Omit the image slot entirely when `coverImageUrl` is absent (per D-11/discretion) — do not render a placeholder block.
- Date formatting: reuse `formatCmsTimestamp` from `lib/utils/cms-timestamp.ts` exactly as `BlogIndex.tsx:35` does — do not write a new formatter.

---

### `app/admin/settings/page.tsx` — new Content tab (client component, edit)

**Analog:** the existing Promotions tab in the same file (state ~175-181, `loadSettings` forEach ~229-264, `handleSave` updates array ~385-422, tabs array ~476-485, JSX block ~943-1027).

**Toggle/select shapes to copy verbatim:**
```typescript
// Source: app/admin/settings/page.tsx:990-1021
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
</select>
```

**IMPORTANT (D-20):** `app/admin/settings/page.tsx` uses the admin's own hardcoded palette (`bg-neutral-700`, `text-white`, `bg-orange-600`) — NOT the storefront's 23-token contract classes. `scripts/scan-hardcoded-colors.mjs` explicitly excludes any path with an `admin` directory segment. Do not token-class the new Content tab; match the Promotions tab's existing hardcoded-color styling exactly.

**Tabs array entry to add:**
```typescript
// Source: app/admin/settings/page.tsx:476-485
const tabs = [
  { kind: "state" as const, id: "system" as const, label: "System", icon: Settings, description: "Maintenance & debug" },
  // ...
  { kind: "state" as const, id: "promotions" as const, label: "Promotions", icon: DollarSign, description: "Sales & banners" },
  // NEW: { kind: "state" as const, id: "content" as const, label: "Content", icon: <lucide icon, e.g. Newspaper>, description: "Blog nav & home block" },
  { kind: "route" as const, id: "appearance" as const, href: "/admin/settings/appearance", label: "Appearance", icon: Palette, description: "Theme & look" },
];
```

**Save endpoint correction (D-16, RESEARCH override of CONTEXT D-05):** the generic settings save endpoint is `POST /api/admin/settings`, not `PUT`. Batch the five new `content.*` keys into the same `updates` array `handleSave()` already builds (~385-422) — do not add a new route.

**Also requires:** extending the `activeTab` union type (~132), a new `contentSettings` state object mirroring `promotionSettings` (~175-181), a new branch in `loadSettings()`'s per-row `forEach` (~229-264), and a new `{activeTab === "content" && (...)}` JSX block modeled on the Promotions block (~943-1027).

---

### Test files

**`tests/unit/lib/blog/excerpt.test.ts`** — Analog: sibling files in `tests/unit/lib/blog/` (`http.test.ts`, `rss.test.ts`) for file placement/structure conventions; plain Vitest `describe`/`it` on the pure function, no mocks needed.

**`tests/unit/components/header-blog-nav.test.ts`** — Analog: `tests/unit/components/account/account-subscriptions-navigation.test.ts` (full pattern below), adapted to mock `@/lib/models/blog` (`getPublishedBlogPosts`) and `@/lib/content/settings` (`getContentSettings`) instead of `@/lib/store-config`.

```typescript
// Source: tests/unit/components/account/account-subscriptions-navigation.test.ts:1-30 (VERIFIED)
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enabled: false,
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));

vi.mock('@/lib/store-config', () => ({
  getStoreConfig: () => ({
    commerce: { features: { subscriptionReconciliation: mocks.enabled } },
  }),
}));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));

import { AccountNav, accountLinks } from '@/components/account/AccountNav';
import AccountSubscriptionsPage from '@/app/account/subscriptions/page';

beforeEach(() => {
  mocks.enabled = false;
});

describe('account subscription feature gate', () => {
  it('omits the navigation destination and rejects the page while reconciliation is off', () => {
    expect(accountLinks(false)).not.toContainEqual(['Subscriptions', '/account/subscriptions']);
    expect(renderToStaticMarkup(React.createElement(AccountNav))).not.toContain('/account/subscriptions');
  });
  // ... mirror-image "enabled" case
});
```
Adapt: mock `getPublishedBlogPosts` to return `[]` (hides link) vs `[somePost]` (shows link, with label); since `Header.tsx` is `async`, render with `renderToStaticMarkup(await Header())` or test the underlying prop-driven pieces directly — follow whichever the account-nav precedent's render call supports for async server components (check if a wrapper/awaited call is needed, since `Header` here is async unlike the synchronous `AccountNav`).

**`tests/unit/app/page-blog-highlights.test.ts`** — Analog: same mock+render approach as above, mocking `@/lib/utils/settings` (`getSettings`) and `@/lib/models/blog` (`getPublishedBlogPosts`) to assert: enabled+posts → block renders at chosen placement with right heading/count; disabled → absent; zero posts → absent.

**`tests/unit/app/api/admin-settings-*.test.ts` (extend)** — Analog: existing file `tests/unit/app/api/admin-settings-empty-category.test.ts` (or sibling `admin-settings*.test.ts`); extend with `content.*` key read/write/clamp/default assertions through the generic route, no new route/file needed.

**Regression guard:** `tests/unit/components/mobile-header-contract.test.ts` must stay green unmodified — it pins raw substrings of `HeaderClient.tsx`'s source text.

## Shared Patterns

### D1 settings resolution with safe fallback
**Source:** `lib/layout/settings.ts` (`resolveLayoutEnum`, `getLayoutSettings`)
**Apply to:** `lib/content/settings.ts`'s `getContentSettings()`
```typescript
// enum resolution — copy shape verbatim, rename telemetry event
function resolveLayoutEnum<T extends string>(stored: unknown, allowed: readonly T[], fallback: T): T { /* see above */ }
```
Critical invariant: `getSettings(category)` never auto-seeds `defaultSettings` outside the admin API's own `GET` handler. Every direct reader (`Header.tsx`, `app/page.tsx` via `getContentSettings()`) must supply its own per-key fallback.

### Numeric clamp
**Source:** `lib/utils/settings.ts:147-150`
**Apply to:** `blogHomeBlockCount` resolution in `getContentSettings()`
```typescript
Math.max(1, Math.min(6, Math.trunc(rawLimit)))
```

### Server-fetch-then-prop-pass into "use client"
**Source:** `components/Header.tsx:49-55`
**Apply to:** `Header.tsx` → `HeaderClient.tsx` (add `showBlogNav`, `blogNavLabel` props exactly like `categories`)

### Admin hardcoded palette (not token classes)
**Source:** `app/admin/settings/page.tsx`'s existing Promotions tab
**Apply to:** the new Content tab — `bg-neutral-700`, `text-white`, `border-neutral-600` etc. `scripts/scan-hardcoded-colors.mjs` excludes any `admin`-segment path from the token-contract scan; do not "fix" this.

### Date formatting
**Source:** `lib/utils/cms-timestamp.ts` (`formatCmsTimestamp`)
**Apply to:** `BlogHighlights.tsx` card dates — same field (`publishedAt`), same formatter as `BlogIndex.tsx:35`.

## No Analog Found

None — every file in scope has a direct or role-match analog already read and verified in RESEARCH.md this session.

## Metadata

**Analog search scope:** `lib/blog/`, `lib/layout/`, `lib/utils/settings.ts`, `lib/db/schema/settings.ts`, `components/Header.tsx`, `components/HeaderClient.tsx`, `components/account/AccountNav.tsx`, `components/blog/BlogIndex.tsx`, `app/page.tsx`, `app/admin/settings/page.tsx`, `tests/unit/components/account/`, `tests/unit/lib/blog/`
**Files scanned:** 12 read directly (all VERIFIED in RESEARCH.md's Sources section, cross-checked this session for `lib/layout/settings.ts` and `components/account/AccountNav.tsx` + its test)
**Pattern extraction date:** 2026-09-11
**Tracked-source gate:** all analog paths listed above are ordinary repo source files (not under `.gsd/capabilities/` or any gitignored mirror); no substitution needed.

## PATTERN MAPPING COMPLETE
