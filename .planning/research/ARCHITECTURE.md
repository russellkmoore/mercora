# Architecture Research: Themeable Storefront Integration

**Domain:** Adding build-time CSS themes + server-resolved active theme + enumerated layout variants to an existing Next.js 16 App Router storefront on Cloudflare Workers (OpenNext), D1-backed settings, Tailwind v4
**Researched:** 2026-09-02
**Confidence:** HIGH — every claim below is verified against the current mercora code (`app/layout.tsx`, `tailwind.config.ts`, `lib/db/schema/settings.ts`, `lib/utils/settings.ts`, `app/api/admin/settings/route.ts`, `lib/observability/telemetry.ts`, `workers/observability-tail/src/core.ts`, `app/category/[slug]/page.tsx`, `app/admin/layout.tsx`, `app/globals.css`, `package.json`). No external ecosystem unknowns — this is a brownfield integration, not a technology choice.

## System Overview

```
BUILD TIME (new)
┌──────────────────────────────────────────────────────────────────┐
│  scripts/build-themes.mjs  (new prebuild step)                    │
│    scans themes/*.css → validates → generates:                    │
│      lib/themes/manifest.generated.ts   (name/label/tokens list)  │
│      lib/themes/import-barrel.generated.css (or .ts side-effect)  │
│    exits non-zero on: missing required token, extra selector,     │
│    duplicate theme name, missing header label comment             │
└───────────────────────────────┬────────────────────────────────────┘
                                 │ npm run predev / prebuild (before next dev / next build)
                                 ▼
REQUEST TIME (modified layout, new resolver)
┌──────────────────────────────────────────────────────────────────┐
│ app/layout.tsx  (force-dynamic — already per-request)             │
│   getStoreConfig()  ──────────────────────────────┐               │
│   getActiveTheme()  (new, lib/themes/active-theme) │               │
│     1. admin_settings['appearance.active_theme'] via D1 (getSettings) │
│     2. validate against manifest.generated.ts names               │
│     3. else NEXT_PUBLIC_THEME_DEFAULT env, validate                │
│     4. else manifest default                                       │
│     5. unknown name at step 1/2 → recordTelemetry(...) then fall  │
│        through the same chain                                      │
│   <html data-theme={theme}>                                        │
└───────────────────────────────┬────────────────────────────────────┘
                                 │ CSS cascade only — no client JS needed
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ themes/*.css  →  [data-theme="volt-dark"] { --store-primary: … }  │
│ tailwind.config.ts  →  bg-store-*, text-store-*, border-store-*   │
│   all mapped through runtimeColor("--store-*")                     │
│ storefront components  →  token classes only (post-sweep)          │
│ admin/*  →  untouched hardcoded neutral-950/white palette          │
│   (app/admin/layout.tsx renders inside the same <html data-theme>  │
│   from the root layout, but admin components never reference       │
│   store.* token classes, so the stamped attribute is inert there)  │
└──────────────────────────────────────────────────────────────────┘

REQUEST TIME (layout switches — same D1 settings pattern, page-level)
┌──────────────────────────────────────────────────────────────────┐
│ app/category/[slug]/page.tsx  (and home, PDP gallery)              │
│   getAppearanceSettings()  (new, lib/utils/settings.ts)            │
│     admin_settings['appearance.category_layout'] → 'grid-3'|'grid-2'|'list' │
│   switch(layout) → <CategoryGrid3/> | <CategoryGrid2/> | <CategoryList/>   │
│   (enumerated union, chosen server-side, no client branching)      │
└──────────────────────────────────────────────────────────────────┘

ADMIN (modified UI, unmodified API contract)
┌──────────────────────────────────────────────────────────────────┐
│ app/admin/settings/page.tsx  → new "Appearance" section            │
│   theme cards render swatches from manifest data (passed as a      │
│   server-fetched prop / embedded JSON, not a client import of the  │
│   generated module — see Integration Points)                       │
│   layout-switch selects (category_layout / home_hero / gallery)    │
│   saves via existing POST /api/admin/settings — no route changes   │
└──────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities — New vs Modified

| Component | Responsibility | Status |
|-----------|-----------------|--------|
| `themes/*.css` | One file per theme; `[data-theme="name"]` block with the ~18 tokens, nothing else selector-wise; header comment supplies the display label | **NEW** (`volt-dark.css` = current look moved verbatim from `app/layout.tsx`) |
| `scripts/build-themes.mjs` | Scans `themes/*.css`, validates token completeness + selector scoping, generates the manifest + CSS import barrel, fails the build loudly | **NEW** |
| `lib/themes/manifest.generated.ts` | Generated, typed `{ name, label, tokens }[]` plus a `defaultTheme` name; import-only, never hand-edited | **NEW** (generated artifact — decide gitignored vs committed, see Integration Points) |
| `lib/themes/active-theme.ts` (`getActiveTheme()`) | Server-only resolution: `admin_settings` → env → manifest default, with validation and telemetry on an unknown stored name | **NEW** |
| `app/layout.tsx` | Calls `getActiveTheme()`, stamps `data-theme` on `<html>`, drops the inline `--store-*` `style` block on `<body>` | **MODIFIED** |
| `tailwind.config.ts` | All ~18 tokens mapped through `runtimeColor()`; `border`/`ring` hex literals deleted | **MODIFIED** |
| `app/globals.css` | Imports the generated theme CSS barrel (`@import` or the prebuild script writes directly into a dedicated `themes.generated.css` that globals.css imports) | **MODIFIED** |
| Storefront components/templates (Header, Footer, ProductCard, cart, checkout, reviews, account, order-status, home, category, PDP) | Hardcoded `neutral-700/800`, `gray-300`, `text-white` replaced with token classes | **MODIFIED** (widest-blast-radius change in the milestone) |
| `admin/**` (all `app/admin/*` and `components/admin/*`) | Keeps its hardcoded `neutral-950`/`white` palette; explicitly out of the sweep | **UNCHANGED** by decision |
| `lib/db/schema/settings.ts` (`defaultSettings`) | Add seed rows for `appearance.active_theme`, `appearance.category_layout`, `appearance.home_hero`, `appearance.product_gallery` under a new `appearance` category | **MODIFIED** (data-only; no `admin_settings` schema change — it's already a KV table) |
| `lib/utils/settings.ts` | Add `getAppearanceSettings()` following the existing `getRefundPolicy()` / `getStoreSettings()` typed-getter pattern | **MODIFIED** |
| `app/api/admin/settings/route.ts` | Generic key/value POST already accepts arbitrary `category`/`key`; no code change needed | **UNCHANGED — reused as-is** |
| `app/admin/settings/page.tsx` | New "Appearance" section: theme swatch cards + the three layout selects, wired through the same save pattern already used for Promotions/Refund/etc. | **MODIFIED** |
| `lib/observability/telemetry.ts` **and** `workers/observability-tail/src/core.ts` | Add one new closed-taxonomy event (e.g. `appearance.theme_unknown`) to `TELEMETRY_EVENTS`, and update `ALLOWED_FIELD_ENUMS`/`ENUM_FIELDS` in both files if a new enum field is needed (e.g. a `reason: 'unknown_theme'` style value) | **MODIFIED — both files, byte-parity required per the locked v1 taxonomy rule** |
| `app/category/[slug]/page.tsx` → `CategoryDisplay` | Becomes a thin server switch choosing `CategoryGrid3` / `CategoryGrid2` / `CategoryList` based on `appearance.category_layout` | **MODIFIED** |
| Home page template | Same pattern for `appearance.home_hero`: `full-bleed` / `split` / `minimal` hero components | **MODIFIED** |
| PDP template | Same pattern for `appearance.product_gallery`: `left` / `top` gallery components | **MODIFIED** |
| `package.json` scripts | Add a `prebuild`-equivalent hook so `scripts/build-themes.mjs` runs before both `next dev` and `next build`/`build:worker` | **MODIFIED** |
| `docs/theming.md` | New reference doc for token contract, theme duplication, build validation | **NEW** |

## Architectural Patterns

### Pattern 1: Generated manifest as the single theme registry

**What:** A prebuild Node script (`scripts/build-themes.mjs`) is the *only* place that knows the list of themes. It reads `themes/*.css`, and writes a generated TypeScript module. Nothing else — not a wrangler var, not a hand-maintained array — enumerates themes.
**When to use:** Any time the source of truth is a set of files on disk that both server code (validation, resolution) and a UI (admin swatches) need typed access to.
**Trade-offs:** Adding a theme requires a deploy (already accepted milestone decision); in exchange, the registry can never drift from the actual CSS files, and an invalid theme fails the build instead of failing silently at runtime.

**Existing precedent in this codebase to follow, not invent:** `scripts/build-with-public-env.mjs` already runs as a wrapper step ahead of `opennextjs-cloudflare build` (see `build:worker` script). `build-themes.mjs` is a sibling of that script, not a new category of tooling.

### Pattern 2: D1 KV settings with a typed getter, mirroring `getRefundPolicy()`

**What:** `admin_settings` is already a categorized KV table. The theme milestone adds an `appearance` category and follows the exact shape of `getRefundPolicy()` / `getStoreSettings()` in `lib/utils/settings.ts` — read via `getSettings('appearance')`, coerce/validate each key, return a typed object with safe fallbacks when a value is missing or malformed.
**When to use:** Any new admin-configurable value that doesn't need its own table.
**Trade-offs:** None new — this is the same pattern the milestone already commits to (`Decisions taken`: "admin_settings needs no schema change").

**Example (shape to follow):**
```typescript
// lib/utils/settings.ts — new function, same shape as getRefundPolicy()
export async function getAppearanceSettings(): Promise<AppearanceSettings> {
  const s = await getSettings('appearance');
  return {
    activeTheme: typeof s['appearance.active_theme'] === 'string'
      ? s['appearance.active_theme'] : undefined, // validated against manifest by the caller
    categoryLayout: isCategoryLayout(s['appearance.category_layout'])
      ? s['appearance.category_layout'] : 'grid-3',
    homeHero: isHomeHero(s['appearance.home_hero']) ? s['appearance.home_hero'] : 'full-bleed',
    productGallery: isProductGallery(s['appearance.product_gallery'])
      ? s['appearance.product_gallery'] : 'left',
  };
}
```

### Pattern 3: Server-chosen enumerated variant components (no client branching)

**What:** A page-level server component reads one settings value and renders one of N named components via a `switch`/lookup map. No shared "flexible" component takes a `layout` prop internally — each variant is its own component tree, matching the milestone's "enumerated variants, never free composition" rule.
**When to use:** `category_layout`, `home_hero`, `product_gallery` — and any future layout switch.
**Trade-offs:** Some duplication between e.g. `CategoryGrid3` and `CategoryGrid2` (both map over the same product list) is intentional and cheap; it keeps each variant independently testable with one render test, per the milestone's acceptance criteria.

### Pattern 4: `data-theme` on `<html>`, tokens resolved by CSS cascade only

**What:** `getActiveTheme()` returns a string; the string is written once as an HTML attribute. All visual variation after that point is pure CSS (`[data-theme="x"] { --store-primary: ... }` + Tailwind's `runtimeColor()` reading the resulting custom property at paint time). No React tree branches on theme name.
**When to use:** This is already how `--store-primary` etc. work today (inline on `<body>`); the change is moving the token *values* out of `layout.tsx` into per-theme CSS files and moving the *attribute* from an inline `style` object to `data-theme` on `<html>` so cascade scoping works for an arbitrary number of themes instead of one hardcoded set.
**Trade-offs:** None — this is strictly a generalization of the existing mechanism, not a new concept for this codebase.

## Data Flow

### Theme resolution (per request)

```
Request → app/layout.tsx (force-dynamic, runs every request already)
  → getActiveTheme()
      → getSettings('appearance') [or a dedicated single-key read]  — D1 via getDbAsync(), same as every other settings read
      → name valid in manifest.generated.ts?  yes → return it
                                               no  → recordTelemetry('appearance.theme_unknown', { ... })
      → fallback: process.env.NEXT_PUBLIC_THEME_DEFAULT, same validation
      → fallback: manifest.generated.ts defaultTheme
  → <html data-theme={resolvedThemeName}>
  → browser applies themes/*.css cascade rules matching [data-theme="resolvedThemeName"]
  → Tailwind token classes throughout the (swept) storefront resolve live
```

### Layout-switch resolution (per page template, same request)

```
app/category/[slug]/page.tsx
  → getAppearanceSettings()  (same D1 read pattern, can share the single getSettings('appearance') call with theme resolution to avoid a second round trip)
  → switch (categoryLayout) { grid-3 → <CategoryGrid3 products=.../>, grid-2 → <CategoryGrid2 .../>, list → <CategoryList .../> }
```

### Admin save flow (unchanged plumbing, new content)

```
Admin "Appearance" section (app/admin/settings/page.tsx)
  → user picks a theme card / layout select
  → existing POST /api/admin/settings { updates: [{ key: 'appearance.active_theme', value: 'volt-light', category: 'appearance' }] }
  → app/api/admin/settings/route.ts (no changes) upserts into admin_settings
  → next storefront request reads the new value through getActiveTheme()
```

### Build-time flow (new)

```
npm run dev  /  npm run build:worker
  → prebuild hook runs scripts/build-themes.mjs
      → glob themes/*.css
      → per file: exactly one [data-theme="X"] selector, all required tokens present, header comment present for label, no stray selectors
      → any violation → non-zero exit → build/dev fails with a specific file+reason
      → success → write lib/themes/manifest.generated.ts + theme CSS barrel
  → next dev / next build proceeds, importing the generated files as ordinary TS/CSS
```

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `scripts/build-themes.mjs` ↔ `lib/themes/manifest.generated.ts` | File generation, not a runtime import graph | Treat like `cloudflare-env.d.ts` (already generated by `cf-typegen`) — gitignore it and regenerate on every `predev`/`prebuild`, OR commit it for CI reproducibility without a build step. Given the CI gate list already includes `npm run build`, generating fresh in CI is safe; **recommend gitignored + regenerated**, matching `cloudflare-env.d.ts` precedent, so a stale committed manifest can never mask a scanner bug. |
| `app/layout.tsx` ↔ `lib/themes/active-theme.ts` | Direct server import, awaited in the layout body (already `async`-compatible since layout is a server component) | Layout is already `force-dynamic`; no new caching concern. Keep the D1 read for theme + the D1 read for appearance settings as **one combined `getSettings('appearance')` call** if both live under the same category — avoids two round trips per request. |
| `lib/themes/active-theme.ts` ↔ `admin_settings` (D1) | Reuses `getDbAsync()` / `getSettings()` — no new binding, no new table | Matches the "D1 read per request, revisit only if traces show it" decision already taken. |
| `lib/themes/active-theme.ts` ↔ `lib/observability/telemetry.ts` | `recordTelemetry('appearance.theme_unknown', fields)` | New event must be added to `TELEMETRY_EVENTS` in `lib/observability/telemetry.ts` **and** the mirrored `ENUM_FIELDS`/event table in `workers/observability-tail/src/core.ts` — this is a locked v1 rule (byte-equal parity asserted by `tests/unit/workers/observability-tail-core.test.ts`). Forgetting the tail-worker file is the single most likely regression in this milestone's mechanism phase. |
| `app/admin/settings/page.tsx` ↔ `lib/themes/manifest.generated.ts` | Needs theme metadata (name/label/token swatch colors) for rendering cards | The admin page is a **client component section**; it cannot import a server-generated `.ts` module with D1/Node dependencies directly if that module pulls in server-only code. Since the manifest module is pure data (name/label/tokens — no D1, no `getCloudflareContext`), a direct import into a client component is safe *if* `build-themes.mjs` keeps the generated module free of server-only imports. Alternatively, fetch it through a tiny server component wrapper that passes the manifest array as a prop. **Recommend**: keep `manifest.generated.ts` pure data (no imports beyond types) so both server (`active-theme.ts`) and client (`admin/settings` swatches) can import it directly — simplest, no new API route needed. |
| `tailwind.config.ts` ↔ `themes/*.css` | No direct coupling — Tailwind maps *token names* to CSS custom properties; it never reads theme files itself | The prebuild scanner is the only place that must agree with `tailwind.config.ts` on the token *names* (the ~18-token contract). Define the contract once (e.g. `lib/themes/token-contract.ts` exporting the required token name list) and have **both** `build-themes.mjs` (validation) and `tailwind.config.ts` (comment/reference) point at it, so they can't drift independently. |
| `app/category/[slug]/page.tsx` ↔ variant components | Direct server-side `switch`, not a registry | No abstraction needed for three cases; a lookup map is fine too, but avoid building a generic "layout registry" — the milestone explicitly rejects free composition. |
| Admin exclusion boundary | `app/admin/layout.tsx` renders under the same root `<html data-theme>` (there's only one `<html>` per document, and `/admin` routes go through `app/admin/layout.tsx` nested inside the root layout) | This is fine as-is: admin components use raw Tailwind color utilities (`bg-neutral-950`, `text-white`) that don't reference `store.*`/token classes, so the stamped `data-theme` attribute has no effect on `/admin`. **No change needed to admin layout** — the exclusion is achieved entirely by *not* sweeping admin components, not by suppressing the attribute. |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Cloudflare Workers Build / OpenNext | `scripts/build-themes.mjs` runs as a Node prebuild step, same tier as `scripts/build-with-public-env.mjs` and `scripts/check-deploy-config.mjs` | No new Cloudflare binding. Runs in the Workers Build pipeline exactly like existing prebuild scripts — no infra change. |
| D1 (`mercora-db`) | Reused `admin_settings` table, no migration | Confirmed: `admin_settings` schema (`lib/db/schema/settings.ts`) needs zero DDL change; new rows are just new `key`/`category` values, consistent with the milestone's "expand-only, no schema change" note. |

## Build Order (minimizes regression risk)

The token sweep (Phase A in the milestone seed) touches nearly every storefront component, so it must land on a **stable, finished token contract** — doing the sweep before the contract is final means re-touching every file twice. The build order below sequences by *blast radius* and *dependency*, not by milestone phase number, though it matches the seed's phase order:

1. **Token contract first, in isolation.** Define the ~18 token names (`lib/themes/token-contract.ts` or equivalent single source), extend `tailwind.config.ts` to map every token through `runtimeColor()`, delete the hardcoded `border`/`ring` hex. At this point nothing consumes the new tokens yet — this step is additive and cannot regress anything, because no component has been swept.
   - *Why first:* every later step (theme file authoring, the sweep, layout variants) depends on token names being frozen. Changing a token name after components are swept means a second pass across the same files.

2. **Move current look into `themes/volt-dark.css` verbatim, stamp `data-theme` on `<html>`.** This alone should be a no-op visually (same hex values, just relocated from inline `style` to a CSS block) — a safe checkpoint to verify before any component touches token classes.
   - *Why second:* proves the CSS-cascade mechanism works end-to-end (attribute → cascade → custom property → Tailwind `runtimeColor()`) against the *existing* look before any component is at risk. Cheap to verify with a single before/after screenshot of any one route.

3. **Sweep storefront components/templates to token classes**, route by route, with before/after screenshots per the milestone's own mitigation plan (home, category, product, cart, checkout, account, order-status). Admin stays untouched.
   - *Why third, and largest:* this is the regression-prone step (matches Russell's profile: regressions are the top frustration). It can only be done safely once the token contract (step 1) and the mechanism (step 2) are both proven stable — otherwise a token rename mid-sweep silently reintroduces hardcoded values in files "finished" before the rename.
   - Do **not** interleave this with the prebuild scanner/manifest work (step 4) or admin Appearance UI (step 5) — those are independent of which components have been swept and can be built/tested against the single `volt-dark` theme in parallel branches, but should be *merged* after the sweep to avoid a moving token target during scanner validation testing.

4. **Prebuild scanner + generated manifest + `getActiveTheme()` resolution.** Only meaningful once there are ≥2 theme files to validate against, and only *safe* to test end-to-end once the sweep (step 3) means a second theme actually looks different. Build the scanner against `volt-dark.css` alone first (validates the mechanism), then author a second preset (a light theme, per the seed's "light theme is the acid test") to prove both the scanner and the sweep completeness at once — a missed `text-white` hardcode becomes visually obvious under a light theme in a way it never would under another dark theme.
   - Telemetry taxonomy addition (both `lib/observability/telemetry.ts` and `workers/observability-tail/src/core.ts`) belongs in this step, not later — `getActiveTheme()` can't be considered done without its telemetry path tested.

5. **Admin "Appearance" section** (theme swatch cards + layout selects), built against the manifest from step 4 and the settings pattern already proven by every other admin settings section (Promotions, Refund, etc.). Lowest risk step — it's additive UI on an unchanged API route.

6. **Layout switches** (`category_layout`, `home_hero`, `product_gallery`) as enumerated server-chosen variants. Independent of theming mechanically (different settings category, different render path) but depends on the *sweep* (step 3) being complete, since each new variant component must itself be written in token classes, not hardcoded values — building a layout variant before the sweep just creates more files that need re-touching.

7. **Close-out**: `docs/theming.md`, visual QA of presets × layout variants (a 2-3 theme × 3-variant matrix), targeted `.planning/codebase/` doc refresh.

**Critical ordering constraint:** steps 1 → 2 → 3 are strictly sequential (each depends on the previous being stable). Steps 4 and 6 both depend on step 3 being complete but not on each other, so they can run in parallel once the sweep lands. Step 5 depends on step 4 (needs the manifest) but not on step 6.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Letting the admin UI import server-only code paths

**What people do:** Import `getActiveTheme()` or a D1-touching helper directly into the client-side `app/admin/settings/page.tsx` to "just get the theme list."
**Why it's wrong:** `getActiveTheme()` calls `getDbAsync()`/`getCloudflareContext()`, which are server/edge-only; bundling that into a `"use client"` file either breaks the build or silently ships dead code to the client.
**Instead:** Keep `manifest.generated.ts` as pure data (no D1 imports) so it's safely importable from both server and client contexts; keep all D1 reads in server components or route handlers.

### Anti-Pattern 2: A generic `layout` prop instead of named variant components

**What people do:** Build one `CategoryGrid` component that takes a `columns` or `variant` prop and branches internally.
**Why it's wrong:** This is exactly the "free composition" the milestone rejects — it reopens the door to per-theme/per-variant markup drift and makes the "one render test per variant" acceptance criterion awkward (you're testing prop combinations, not components).
**Instead:** Separate named components (`CategoryGrid3`, `CategoryGrid2`, `CategoryList`) selected by a server-side `switch`, each independently simple and testable.

### Anti-Pattern 3: Sweeping components before the token contract is frozen

**What people do:** Start replacing `neutral-700` with token classes opportunistically while still deciding what the token list should be.
**Why it's wrong:** Given the sweep touches nearly the entire storefront, any token rename after partial sweeping means hunting down and re-touching already-"done" files — the exact regression risk the milestone's own mitigation (before/after screenshots per PR) is trying to catch, made worse by churn.
**Instead:** Freeze the ~18-token contract and prove the mechanism against one theme (steps 1–2 above) before touching component-by-component classes.

## Sources

- `/Users/rmoore/Workspaces/mercora/app/layout.tsx` — current inline theme mechanism, `force-dynamic` export, `StoreConfigProvider` wiring
- `/Users/rmoore/Workspaces/mercora/tailwind.config.ts` — `runtimeColor()` pattern, hardcoded `border`/`ring`
- `/Users/rmoore/Workspaces/mercora/lib/db/schema/settings.ts` — `admin_settings` KV schema and `defaultSettings` seed pattern
- `/Users/rmoore/Workspaces/mercora/lib/utils/settings.ts` — `getSettings()`, `getRefundPolicy()`/`getStoreSettings()` typed-getter precedent
- `/Users/rmoore/Workspaces/mercora/app/api/admin/settings/route.ts` — generic KV POST/GET admin settings API, reused unchanged
- `/Users/rmoore/Workspaces/mercora/components/PromotionalBanner.tsx` — existing server-component D1-settings-read pattern with `unstable_cache`
- `/Users/rmoore/Workspaces/mercora/lib/observability/telemetry.ts` and `/Users/rmoore/Workspaces/mercora/workers/observability-tail/src/core.ts` — closed telemetry taxonomy, byte-parity requirement, `recordTelemetry()` signature
- `/Users/rmoore/Workspaces/mercora/app/category/[slug]/page.tsx` — current category page server component, sweep + variant-switch target
- `/Users/rmoore/Workspaces/mercora/app/admin/layout.tsx` — confirms admin's separate hardcoded palette and why the exclusion needs no code change
- `/Users/rmoore/Workspaces/mercora/app/globals.css` — Tailwind v4 `@import`/`@config` entry point
- `/Users/rmoore/Workspaces/mercora/package.json` — existing prebuild script precedent (`build:worker` → `scripts/build-with-public-env.mjs`)
- `/Users/rmoore/Workspaces/mercora/.planning/PROJECT.md` and `/Users/rmoore/Workspaces/mercora/MILESTONE-SEED.md` — locked milestone decisions and phase sketch

---
*Architecture research for: Mercora / Voltique v2 Themeable Storefront milestone*
*Researched: 2026-09-02*
