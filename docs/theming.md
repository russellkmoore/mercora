# Theming

**Status:** In progress — this section covers switching presets from the admin and the frozen
23-token contract. Theme-file anatomy, duplicating a theme, the validator, resolution order, the
admin Appearance page, the layout switches, the build gates, and known limits land in later Phase 8
plans; this file gains sections, it is never rewritten out from under them.

## Switching themes and layouts in the admin

Go to **Admin → Settings → Appearance** (`/admin/settings/appearance`). The page shows a grid of
theme cards — click one, then click **Save Changes** to make it live on the storefront. Below the
theme grid are three layout switches (category grid density, home hero style, product gallery
orientation), each with its own **Save**.

Switching between any of the shipped presets is instant — no deploy needed. Adding a genuinely
*new* theme does need a deploy, because the preset list is generated at build time from the theme
files in the repository, not read at request time.

The admin dashboard itself keeps its own fixed dark palette and does not change with the
storefront theme. That is deliberate, not a bug — admin theming is out of scope.

If you need to switch themes without the admin UI (local development only), the settings API
accepts a development-only header that bypasses the normal admin check. It only works when
`NODE_ENV` is `development`. See `lib/auth/admin-middleware.ts` for the exact mechanism — this
document does not print the header's value.

## The 23-token contract

Every theme file declares the same 23 CSS custom properties under a `[data-theme]` selector. The
`--store-` prefix is not cosmetic: Tailwind itself defines its own `--radius-sm`/`--radius-md` and
`--font-sans` custom properties in its own theme layer, and the prefix is what keeps the
storefront's tokens from colliding with the framework's.

| Token | Role | `volt-dark` value | Surfaces |
|---|---|---|---|
| `--store-primary` | Brand accent, primary actions | `#f97316` | storefront |
| `--store-on-primary` | Text/icon on top of primary | `#000000` | storefront |
| `--store-surface` | Base app background | `#000000` | storefront |
| `--store-surface-elevated` | Raised panel/card background | `#171717` | storefront |
| `--store-foreground` | Default body text | `#ffffff` | storefront |
| `--store-muted-foreground` | De-emphasized secondary text | `#a3a3a3` | storefront |
| `--store-border` | Hairline dividers and borders | `#404040` | storefront |
| `--store-ring` | Focus ring outline | `#404040` | storefront |
| `--store-success` | Success/positive status | `#22c55e` | status UI |
| `--store-warning` | Warning/caution status | `#f59e0b` | status UI |
| `--store-danger` | Error/destructive status | `#ef4444` | status UI |
| `--store-info` | Informational status | `#3b82f6` | status UI, chat |
| `--store-surface-inverse` | Light panel background | `#fdfdfb` | inverse¹ |
| `--store-surface-inverse-elevated` | Raised light panel background | `#f3f4f6` | inverse¹ |
| `--store-on-inverse` | Text on the inverse surface | `#000000` | inverse¹ |
| `--store-muted-on-inverse` | Secondary text on the inverse surface | `#6b7280` | inverse¹ |
| `--store-border-inverse` | Hairline border on the inverse surface | `#374151` | inverse¹ |
| `--store-radius-sm` | Small corner radius | `0.25rem` | storefront |
| `--store-radius-md` | Medium corner radius | `0.375rem` | storefront |
| `--store-radius-lg` | Large corner radius | `0.5rem` | storefront |
| `--store-radius-xl` | Extra-large corner radius | `0.75rem` | storefront |
| `--store-font-sans` | Body/UI typeface | Geist sans stack | storefront |
| `--store-font-display` | Heading/display typeface | Geist sans stack | headings |

¹ The five inverse-set tokens apply to exactly four surface groups: the cart drawer
(`components/cart/CartDrawer.tsx`, `components/cart/CartItemCard.tsx`), the agent drawer
(`components/agent/AgentDrawer.tsx`, `components/agent/ProductCard.tsx`), the Stripe checkout host
(`components/checkout/StripeProvider.tsx`, via `getThemeTokens()`), and the six transactional email
builders. Nowhere else uses the inverse set.

² Four consumers cannot read a `[data-theme]` CSS custom property at all and read the same 23
values a different way (see below). Quoted verbatim from `lib/themes/tokens.ts`'s own header
comment: "Stripe Elements' `appearance` config, Clerk's `appearance.variables`, the standalone
`app/global-error.tsx` page (which renders without `globals.css`), and the transactional email
builders (mail clients cannot read CSS variables)."

The same 23 values are also available to server code under camelCase keys (`primary`, `onPrimary`,
`surface`, `surfaceElevated`, `foreground`, `mutedForeground`, `border`, `ring`, `success`,
`warning`, `danger`, `info`, `surfaceInverse`, `surfaceInverseElevated`, `onInverse`,
`mutedOnInverse`, `borderInverse`, `radiusSm`, `radiusMd`, `radiusLg`, `radiusXl`, `fontSans`,
`fontDisplay`) through `getThemeTokens()` in `lib/themes/tokens.ts` — this is how the four
non-cascade consumers² get them without a CSS cascade.

This contract is frozen and one-way: no token is renamed or removed, and no new token is added
without a fresh milestone decision. `.planning/phases/05-token-contract-component-sweep/05-TOKEN-MAP.md`
is the source of truth this table was copied from; if the two ever disagree, the token map wins.

## Theme-file anatomy

A theme file (`themes/<name>.css`) is data, not a stylesheet fragment: no `@import`, no
`@font-face`, no second selector. It is exactly three things: a plain `/**...*/` comment header
(prose, ignored by the validator), one `/* @theme ... */` metadata line, and exactly one
`[data-theme="<name>"]` rule.

The metadata line has the shape:

```
/* @theme label: My Theme | industry: outdoor & technical gear | synopsis: A one-sentence pitch. */
```

Three pipe-delimited fields, in `key: value` form, field order not enforced:

| Field | Required | Used for |
|---|---|---|
| `label` | Yes — the file fails validation without it | The admin theme card's heading, and the manifest entry's `label` |
| `industry` | No | The admin theme card's industry line only |
| `synopsis` | No | The admin theme card's clamped description only |

The rule's selector must equal `[data-theme="<filename-stem>"]` — a file named `themes/luxe.css`
must declare `[data-theme="luxe"]`, nothing else. Inside that one rule, every declared property
must be one of the 23 `--store-*` custom properties above: no other property name is accepted, and
every one of the 23 is required — none may be omitted.

The 17 colour tokens (everything except the four `--store-radius-*` tokens and the two
`--store-font-*` tokens) must be a 6-digit hex colour (`#rrggbb`) — `#fff`, `rgb(...)`, and named
CSS colours are all rejected. The four radius tokens and the two font tokens are **not**
hex-checked; a radius is a CSS length (`0.375rem`) and a font is a full font-family stack.

**How a display font actually reaches a heading.** A theme's `--store-font-display` value doesn't
load a font by itself — it only *names* a CSS variable, e.g. `var(--font-cormorant-garamond), ...`.
That variable is defined once, in `app/layout.tsx`, by a `next/font/google` loader
(`Cormorant_Garamond`, `Orbitron`, `Fraunces`, `Nunito`, one per non-Geist display face). The root
layout applies every one of these font-loader variable classes to **both** the `<html>` element and
the `<body>` element. This is load-bearing, not redundant: `--store-font-display` is declared by the
`[data-theme="..."]` rule, which matches `<html>`, and a custom property whose value nests another
`var()` reference resolves at the element that **declares** it, not the element that later
**consumes** it in a `font-family` rule. If the referenced `next/font` variable isn't also in scope
on `<html>`, the token resolves to invalid there, and that invalidity is what inherits down to
`<body>` — putting the font-loader class on `<body>` alone is not sufficient. This was a real bug,
found and fixed by applying the variable classes to `<html>` as well.

A theme file is a leaf: it declares data, and nothing about *how* a font is loaded or *how* a
component renders. Adding a theme never requires touching `app/layout.tsx`, a component, or the
validator — only a new `--store-font-display` value referencing a font variable that already exists.

## Duplicate a theme in five steps

1. **Copy an existing theme file to a new name.** Pick a name that satisfies the validator's name
   pattern — lowercase alphanumerics and hyphens only, no other characters:
   ```bash
   cp themes/volt-dark.css themes/my-theme.css
   ```
2. **Change the metadata line** to describe the new theme:
   ```
   /* @theme label: My Theme | industry: my industry | synopsis: A one-sentence pitch. */
   ```
3. **Change the selector** to match the new filename stem:
   ```css
   [data-theme="my-theme"] {
   ```
4. **Set all 23 tokens** — the 17 hex colours, the 4 radius tokens, and the 2 font tokens — to the
   new theme's real values.
5. **Run the theme build and the token scanner:**
   ```bash
   node scripts/build-themes.mjs
   npm run scan:tokens
   ```

What happens automatically after that: the new theme appears in the admin's card grid
(`/admin/settings/appearance`) with no other file edited — `lib/themes/manifest.generated.ts` and
`themes/index.generated.css` are regenerated by step 5, and the admin's theme grid reads the
manifest directly. What does not happen automatically: a genuinely **new** theme needs a deploy,
because the manifest is generated at build time, not read at request time. Switching *between*
shipped themes (the ones already in the manifest) is instant — no deploy needed.

**A converted preset should be re-checked, not assumed to pass.** Six of this repo's seven shipped
presets (`luxe`, `midnight`, `clinical`, `retro`, `atelier`, `market`) were converted from
`docs/voltique-theme-direction.md`'s own oklch design values onto this 23-token hex contract
(`volt-dark` predates that document — it's the store's original look, relocated verbatim, not a
conversion). Of those six converted presets, **five carry a deliberate contrast correction** away
from the direction document's literal values, because a direct oklch-to-hex transcription measured
below its required WCAG contrast threshold on that preset's own surface (details are in each theme
file's own header comment). **`retro` is the one converted preset that needed no correction** — every
one of its four required contrast checks passed on the direction document's literal values with no
adjustment. Treat "converted from the direction doc" and "passes contrast" as two separate facts:
re-check a new conversion against its own surface rather than assuming it inherits a passing grade.

## What the validator rejects

`scripts/build-themes.mjs` validates every `themes/*.css` file and collects every violation rather
than stopping at the first. The table below quotes each check's message exactly as the script
produces it (interpolated fields shown as the script's own template placeholder):

| Check | Message |
|---|---|
| Empty file | `theme file is empty` |
| Unparseable CSS | `unparseable CSS: ${error.reason ?? error.message}` |
| Disallowed at-rule | `disallowed at-rule "@${atRule.name}" — a theme file may not use at-rules` |
| No rule in the file | `no rule found; expected exactly one [data-theme="${stem}"] block` |
| More than one rule | `unexpected extra rule "${extra.selector}" — a theme file may contain exactly one rule` |
| Bad filename stem | `filename stem "${stem}" must be lowercase alphanumerics and hyphens only` |
| Selector doesn't match filename | `selector "${primaryRule.selector}" must equal "${expectedSelector}" (the filename stem)` |
| Declaration isn't a `--store-*` property | `non-token declaration "${decl.prop}"` |
| Colour token isn't 6-digit hex | `token "${decl.prop}" must be a 6-digit hex colour, got "${decl.value.trim()}"` |
| Required token absent | `missing required token "${token}"` |
| Declared property isn't one of the 23 | `unknown token "${token}" is not part of the frozen 23-token contract` |
| No `@theme` header, or no `label` field | `missing required @theme header label (e.g. /* @theme label: My Theme */)` |
| Theme directory has no `.css` files | `no theme files found in "${themeDir}"` |
| `--check` finds committed output out of date | `stale generated file(s): ${stale.join(", ")}. Run \`node scripts/build-themes.mjs\` to regenerate and commit the result.` |

Errors are collected, not reported one at a time — a single run against a broken file can print
several of the rows above at once. The report format is `[build-themes] <file>:<line>: <message>`,
one line per error, followed by an abort line naming the total count:

```
[build-themes] ABORT: 3 error(s).
```

The process exits non-zero whenever any error is present.

**How each entry point fails.** Three real commands run this validator, and all three fail exactly
the way a plain `node scripts/build-themes.mjs` invocation would — non-zero exit, same messages:

- **The pre-dev hook** (`predev` in `package.json`): `node scripts/build-themes.mjs && node scripts/db-local-ensure.mjs` — a broken theme file blocks `npm run dev` from starting at all.
- **The worker build** (`build:worker` in `package.json`): `node scripts/build-themes.mjs && node scripts/build-with-public-env.mjs ./node_modules/.bin/opennextjs-cloudflare build` — a broken theme file blocks the Cloudflare Workers build.
- **The CI step** named **"Check theme manifest freshness"** (`.github/workflows/ci.yml`), which runs `npm run build:themes:check` — this catches both an invalid theme file and a committed `lib/themes/manifest.generated.ts` / `themes/index.generated.css` that is stale relative to the `themes/*.css` sources.

## Resolution order

`getActiveTheme()` (`lib/themes/active-theme.ts`) resolves the storefront's active theme in this
order, on every request:

1. **The database read.** `getSettings("appearance")` reads the `appearance.theme` row. An absent
   or empty stored value falls through silently to step 2 — that's the normal first-load state
   before any admin selection has ever been saved, not an anomaly, so it carries no telemetry.
2. **The deploy-time environment default**, `NEXT_PUBLIC_THEME_DEFAULT` — used only if it is itself
   a manifest theme name.
3. **The manifest default**, `DEFAULT_THEME_NAME` (`volt-dark`) — the final fallback.

A present stored value that is **not** a manifest theme name is a genuinely unknown selection: the
resolver emits exactly one telemetry signal, `theme.unknown_selection`, carrying only
`{ outcome: "invalid" }` — never the stored string itself — and then falls through to step 2. A
database read failure degrades straight to step 2 as well, rather than taking down every route.

There is no cache anywhere in this path — no module-scope variable, no cross-request memoisation.
The module's own header comment states why: a Cloudflare Workers isolate can be reused across
requests, so any caching here risks serving a stale look after an admin save.

The layout resolver (`getLayoutSettings()` in `lib/layout/settings.ts`) has the same shape and reads
the same `appearance` category, but is deliberately a second, independent D1 read rather than
sharing a memoised helper with `getActiveTheme()` — its own header comment gives the reason: it
keeps this module fully independent of the theme resolver's internals and its own frozen test
suite. Each of the three layout switches resolves against its own enum array the same way: absent
or empty falls through silently to that switch's default; a present value outside the enum emits
exactly one `layout.unknown_selection` signal, again carrying only `{ outcome: "invalid" }`, then
falls through to the default.

## The admin surface

Go to **Admin → Settings → Appearance** (`/admin/settings/appearance`). The theme grid
(`components/admin/ThemePresetGrid.tsx`) shows one card per manifest entry — colour chips, a mini
mock, the label, an industry line and a synopsis when present, and an **Active** badge on whichever
theme is currently saved — with its own **Save Changes** button. Below it, the layout section
(`components/admin/LayoutSwitches.tsx`) shows three independent radiogroups (category layout, home
hero, product gallery), each option rendered as an icon-labelled card, with its own separate
**Save**.

The admin dashboard keeps its own fixed palette and does not change with the storefront theme —
deliberate, not a bug, and the reason `scripts/scan-hardcoded-colors.mjs` excludes any path
containing an `admin` directory segment outright. Section 0 above already covers how to switch a
theme or layout from this page; this section only names what the page shows.

## The layout switches

`lib/layout/variants.ts` is the single source of truth for the three layout switches. Their setting
keys, read from and written to the same `appearance` settings category as the theme:

- `appearance.category_layout` — enum `grid-3` | `grid-2` | `list` (default `grid-3`)
- `appearance.home_hero` — enum `full-bleed` | `split` | `minimal` (default `minimal`)
- `appearance.product_gallery` — enum `left` | `top` (default `left`)

All four appearance keys — the theme key and these three switches — live in the same `appearance`
settings category, which is why a single admin save can change a whole look at once.

Each enum member renders through a typed lookup map, never a generic layout prop:

- `categoryLayout`: `grid-3` → `CategoryGrid3`, `grid-2` → `CategoryGrid2`, `list` → `CategoryList` (`components/layout/category/category-layout-map.ts`)
- `homeHero`: `full-bleed` → `HomeHeroFullBleed`, `split` → `HomeHeroSplit`, `minimal` → `HomeHeroMinimal` (`components/layout/home/home-hero-map.ts`)
- `productGallery`: `left` → `ProductGalleryLeft`, `top` → `ProductGalleryTop` (`components/layout/product/`)

## The two gates and the screenshot harness

Two build-time gates enforce the token contract; neither touches a running server.

```bash
npm run scan:tokens
```
Runs `scripts/scan-hardcoded-colors.mjs` — a whole-tree scan for hardcoded palette values (hex
literals, `rgb()`/`hsl()` functions, and raw Tailwind/shadcn palette utility classes) across `app/`,
`components/`, `lib/`, `themes/`, and `tailwind.config.ts`. Any path segment named `admin` is
excluded outright (the admin surface keeps its own fixed palette, by design). `themes/` itself and
`lib/themes/tokens.ts` / `lib/themes/manifest.generated.ts` are excluded as the theme source of
truth — hex literals there are the contract, not a violation. A short, fixed list of named files is
excluded outright too, each with a written reason printed on every run (e.g. a base64 data URI, or a
merchant-authored fixture colour that a theme must not override) — a clean run can never be silent
about what it deliberately did not look at. A polarity-neutral literal (one that reads correctly
under both light and dark presets) gets an explicit sentinel-comment pair with a written reason,
rather than a blanket exception.

**`npm run scan:tokens` is not wired into CI today.** It is a local gate every phase of this
milestone has run by convention before committing, not an automated CI check. Wiring it into CI is
recorded as a recommended follow-up, not done in this phase.

```bash
node scripts/build-themes.mjs --check
```
The theme-manifest freshness gate — see "What the validator rejects" above for what it enforces and
exactly how it fails. **This one does run in CI**, as the step named "Check theme manifest
freshness".

```bash
mise exec -- npm run screenshot:routes -- --label <name> --manifest <path> --allow-missing [--include-content]
```
The screenshot harness (`scripts/screenshot-routes.mjs`) captures deterministic, multi-viewport,
multi-state screenshots of the storefront's route grid and appends a coverage table to the manifest
file at `<path>`. `--label` is required. **The `--manifest` flag silently defaults to an earlier
phase's file** (`.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md`) when omitted
— this has already caused one real cross-phase mistake, where a later phase's captures landed in
Phase 5's manifest and had to be moved out by hand. Always pass `--manifest` explicitly, pointed at
the file you actually want rows appended to.

### Phase 8 visual QA summary

Seven presets by three packed layout combinations, copied verbatim from
[`08-QA-MATRIX.md`](../.planning/phases/08-documentation-visual-qa-close-out/08-QA-MATRIX.md)'s own
`## Visual QA Summary` section — that record is the full evidence (findings table, judgement
design, and close-out rollup); this is the compact grid a reader scans, not a re-derivation of it.

| Preset | A (`grid-3`/`minimal`/`left`) | B (`grid-2`/`split`/`top`) | C (`list`/`full-bleed`/`left`) |
|---|---|---|---|
| `volt-dark` | ✓ Pass — F2, F15-F18 | ✓ Pass — F6-F9 | ✓ Pass — F10-F14 |
| `luxe` | ✓ Pass — F19-F22 | ✓ Pass (by design — combination-axis criteria are checked once, at `volt-dark`; see Judgement Design) | ✓ Pass — F43 (scrim cross-check); anatomy by design |
| `midnight` | ✓ Pass — F23-F26 | ✓ Pass (by design) | ✓ Pass (by design) |
| `clinical` | ✓ Pass — F27-F30 | ✓ Pass (by design) | ✓ Pass — F44 (scrim cross-check); anatomy by design |
| `retro` | ✓ Pass — F31-F34 | ✓ Pass (by design) | ✓ Pass (by design) |
| `atelier` | ✓ Pass — F35-F38 | ✓ Pass (by design) | ✓ Pass — F45 (scrim cross-check); anatomy by design |
| `market` | ✓ Pass — F39-F42 | ✓ Pass (by design) | ✓ Pass — F46 (scrim cross-check); anatomy by design |

"By design" cells are not independently inspected — they rest on the Judgement Design's stated
factorisation (layout-anatomy criteria don't vary by preset; legibility/scrim/display-face criteria
don't vary by combination), which is itself flagged as a planner assumption, not a proven property.
Every other mark cites the specific findings row(s) it rests on. Zero defects were found across all
46 findings; nothing required a fix.

## Known limits and backlog

| Item | Tracked in | What closing it would take |
|---|---|---|
| `NEXT_PUBLIC_THEME_DEFAULT` still needs to be added as a Cloudflare Workers Build variable | `.planning/STATE.md` Blockers/Concerns | Add the variable in the Cloudflare Dashboard's Workers Builds settings and redeploy — `wrangler.jsonc`'s own `vars` entry is a local/preview default only, not a substitute for the dashboard-side Build variable |
| The admin Appearance page (theme grid + layout switches) has never been walked through in a real browser with a real Clerk admin session | `.planning/WINDOWS.md` #2 | A manual pass signed in as an admin, clicking through both sections, confirming ring/badge/toast behaviour and keyboard arrow-key selection |
| Six of the seven presets carry design-direction properties (shadow, border-width, image-aspect, some `accent-2` values, font-mono, letter-spacing, and several per-theme layout behaviours) that this milestone's tokens-only architecture deliberately does not carry | `.planning/todos/pending/theme-contract-dropped-properties.md` (luxe/midnight), `.planning/todos/pending/theme-direction-doc-backlog-06.1.md` (clinical/retro/atelier/market) | A new contract-widening milestone with its own token sweep — not an incremental addition to the frozen 23-token contract |
| Two image-URL resolvers coexist: `components/layout/product/gallery-media-url.ts` and `lib/utils/product-image.ts` | `.planning/STATE.md` Blockers/Concerns (carried from Phase 7) | Consolidate into one resolver the next time the product display is touched |
| Pre-extraction parity tests self-write a missing baseline snapshot instead of failing | `.planning/STATE.md` Blockers/Concerns (carried from Phase 7) | Snapshots are committed today, but a deleted snapshot would silently regenerate rather than fail the test — worth a hard failure instead |
| `npm run scan:tokens` is not wired into CI | This document, "The two gates" above | Add a step to `.github/workflows/ci.yml` running `npm run scan:tokens`, alongside the existing "Check theme manifest freshness" step |
