# Stack Research

**Domain:** CSS-file-based storefront theming (design tokens + enumerated layout variants) on top of an existing Next.js 16 / Tailwind v4 / Cloudflare Workers storefront
**Researched:** 2026-09-02
**Confidence:** HIGH

## Headline Finding

**This milestone needs zero new production or build dependencies.** Every piece — CSS custom-property tokens, multi-file theme bundling, a prebuild validator, server-side theme resolution — is covered by what's already in `package.json` at its current, latest version: Tailwind CSS 4.3.3, `@tailwindcss/postcss` 4.3.3, `postcss` 8.5.26, and Node 24's built-in `fs`/`path`. The only new artifact is a Node script (`scripts/build-themes.mjs`) written in the same plain-ESM style as the existing `scripts/*.mjs` files, using `postcss` (already a devDependency) purely as a CSS parser — not as a build pipeline.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tailwind CSS | 4.3.3 (pinned, already latest) | Utility classes resolve to `var(--store-*)` via the existing `runtimeColor()` helper | v4 bundles `@import` and does vendor prefixing/nesting natively via Lightning CSS internally — a theme-file barrel (`@import "../../themes/a.css"; @import "../../themes/b.css";`) needs no extra plugin. Confirmed against current Tailwind docs (Context7 `/websites/tailwindcss`, "Compatibility" page): "Tailwind automatically bundles `@import` statements... removing the need for external preprocessors like Sass or `postcss-import`." |
| `@tailwindcss/postcss` | 4.3.3 (matches `tailwindcss`) | PostCSS plugin that runs the v4 engine | Already wired in `postcss.config.js`; no change needed. Keep this version locked to `tailwindcss` — v4 ships them as a matched pair. |
| `postcss` | 8.5.26 (already latest, already a devDependency) | AST parser for the new prebuild theme validator | `postcss.parse(css)` (no plugins, no `.process()`) returns a `Root` node you can `walkRules()` / `walkDecls()` / `walkComments()` synchronously. It throws a `CssSyntaxError` (`error.name === 'CssSyntaxError'`) on malformed CSS — exactly the "fail the build on an invalid theme file" behavior the milestone requires, for free. Confirmed against current PostCSS docs (Context7 `/postcss/postcss`). |
| Node.js built-ins (`node:fs`, `node:path`) | Node 24.18.1 (pinned by `engines`) | Directory scan (`themes/*.css`), file read, generated-file write | Matches every existing script in `scripts/` (`db-local-ensure.mjs`, `check-deploy-config.mjs`, `d1-migrate.mjs`) — plain `.mjs`, zero dependencies, synchronous or `spawnSync`-based. The new script should follow this exact convention, not TypeScript/`tsx` (those are reserved for developer-invoked CLIs like `token:generate`, not automated pre-hooks). |
| Next.js App Router Server Components | 16.3.1 (pinned) | `getActiveTheme()` reads `admin_settings` via D1 and stamps `data-theme` on `<html>` in `app/layout.tsx` before render | No library needed — this is the same server-first pattern already used for `getStoreConfig()`. Zero client JS, zero hydration flash, because the theme is known before the HTML streams. |

### Supporting Libraries

None required. The token contract is ~18 explicit CSS custom properties per theme file (colors, radius, fonts) — small enough that no token-transformation pipeline, color-math library, or CSS-variable runtime is justified. See "What NOT to Use" for the specific things that look tempting here and aren't needed.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `postcss` (parse-only usage) | Theme file validator inside `scripts/build-themes.mjs` | Use `require('postcss').parse(cssText)` or the ESM equivalent — not `postcss().process()`. You don't want a transform pipeline (no plugins run), you want a strict AST to check two things: (1) every top-level rule's selector matches `^\[data-theme="[a-z0-9-]+"\]$` and nothing else, (2) the declaration block contains every required `--store-*` token. Reject on any other selector, at-rule, or missing token; let `CssSyntaxError` propagate for malformed CSS. |
| npm lifecycle pre-hooks | Wire the generator into every path that needs the barrel/manifest to exist | Three entry points need it, not one: `npm run dev` (local), `npm run build` (CI gate — `PROJECT.md` lists this explicitly as a required check), and `npm run build:worker` (the actual `deploy`/`deploy:ci` path, which never calls `npm run build` — it invokes `opennextjs-cloudflare build` directly via `build:worker`). Add `"prebuild": "node scripts/build-themes.mjs"` and `"prebuild:worker": "node scripts/build-themes.mjs"`, and extend the existing `"predev"` chain: `"predev": "node scripts/db-local-ensure.mjs && node scripts/build-themes.mjs"`. Missing any one of these three means a theme file can be added, pass `npm run build` locally, and still ship a stale barrel through `deploy:ci` — npm's `pre<name>` convention applies per script name, not globally. |

## Installation

```bash
# No installs needed — everything is already in package.json at current versions:
# tailwindcss@4.3.3, @tailwindcss/postcss@4.3.3, postcss@8.5.26
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| `postcss.parse()` (existing dependency, parse-only) | `lightningcss` (Rust-based, 1.33.0 latest) | Only if the theme directory grows to hundreds of files and parse time becomes measurable at build time — at 2–3 theme files this is not a real constraint. `lightningcss` also has a slightly different AST shape (visitor-based, not the familiar PostCSS node tree) with no upside here since you already depend on PostCSS's tree for the exact task (selector + declaration walking). |
| `postcss.parse()` | `csstree` (3.2.1 latest) | `csstree` is a fine standalone CSS AST library, but it's a net-new dependency doing the same job `postcss` already does, and this codebase's scripts (`db-local-ensure.mjs`, `check-deploy-config.mjs`) consistently reach for what's already installed rather than adding single-purpose parsers. No reason to introduce a second CSS parser into the tree. |
| Plain CSS custom properties consumed through `runtimeColor()` | Tailwind v4 `@theme` directive | `@theme` is for *design tokens that generate new utility classes* (e.g., `bg-brand` from `--color-brand`). This project's tokens are *runtime-switchable values* behind fixed utility names (`bg-store-primary` already exists as a class; only its resolved color changes per `data-theme`). Putting theme colors in `@theme` would bake one theme's values into the generated CSS at build time — the opposite of "switch themes via a D1 read, no rebuild." The existing `runtimeColor()` pattern (`rgb(from var(--store-primary) r g b / <alpha-value>)`) is the correct v4-idiomatic way to keep utilities static while values stay dynamic; extend it to the new tokens (border, ring, success, warning, danger, on-primary) rather than replacing it. |
| Server-side `getActiveTheme()` + `data-theme` attribute stamped in `app/layout.tsx` | `next-themes` | `next-themes` solves a different problem: client-detected system preference (`prefers-color-scheme`), `localStorage` persistence, and a no-flash inline script that runs *before* hydration because the server doesn't know the answer. Here the server already knows the answer (D1 read in a Server Component) before it renders a single byte — there is nothing for a client-side theme library to do except add a dependency and an unnecessary flash-prevention script. Do not add it. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| CSS-in-JS (`styled-components`, `emotion`, `vanilla-extract`, `stitches`) | Directly contradicts the locked decision "no per-theme markup overrides" — CSS-in-JS computes styles per-component at build or runtime, which is a different mental model than "one CSS file per theme, selected by a data attribute, cascade does the rest." It also adds runtime style injection and SSR streaming complexity that has to be specifically supported on the Cloudflare Workers/`@opennextjs/cloudflare` runtime — an unforced risk on a platform that already works with plain CSS. | Plain CSS files in `themes/*.css`, one `[data-theme="x"]` block each. |
| `next-themes` (or similar client theme-toggle libraries) | Built for client-detected/localStorage-persisted theme switching with a flash-prevention script — solving a problem this project doesn't have, since theme identity comes from a per-request D1 read on the server, stamped into the HTML before it streams. Adding it would introduce a second, competing source of truth for "what theme is this." | The existing server-first `getStoreConfig()`/`getActiveTheme()` pattern already in `app/layout.tsx`. |
| Design-token pipelines (Style Dictionary) or component-theming frameworks (Theme UI, Radix Themes) | Built for many tokens across many platforms (web/iOS/Android) or for swapping the component primitives themselves. This milestone has ~18 tokens, one platform, and an explicit rule that admin keeps its hardcoded palette and no theme gets its own markup — a full token-transform pipeline or alternate component system is solving a problem an order of magnitude larger than the one that exists. | The hand-written `--store-*` token contract, validated by the ~100-line prebuild script. |
| `postcss-import`, `autoprefixer` as active plugins for this feature | Tailwind v4's `@tailwindcss/postcss` already bundles `@import` and handles vendor prefixing via its internal Lightning CSS pass (confirmed in Tailwind's v4 upgrade guide: "remove `postcss-import` and `autoprefixer`... v4 handles imports and vendor prefixing automatically"). Note: `autoprefixer` is still listed in this repo's `devDependencies` but is **not** wired into `postcss.config.js` (which only lists `@tailwindcss/postcss`) — it's already dead weight, unrelated to this milestone; don't wire it in for the theme barrel, and don't treat its presence in `package.json` as evidence it's needed. | Nothing — v4 handles both natively. |
| Color-math libraries (`chroma-js`, `culori`, `polished`) for deriving hover/active shades from a single brand color | The token contract is explicit and complete per theme (`primary`, `on-primary`, `surface`, `surface-elevated`, `foreground`, `muted-foreground`, `border`, `ring`, `success`, `warning`, `danger`, plus radius/font tokens) — themes supply every value directly, nothing is derived. Adding a color-math dependency now would be solving a "generate a palette from one seed color" problem this milestone explicitly doesn't have. | Explicit values per token in each `themes/*.css` file. Revisit only if a future milestone wants one-input theme generation. |

## Stack Patterns by Variant

**If a theme file's tokens use anything other than a literal color value (hex, `rgb()`, `oklch()`, named color):**
- The prebuild validator should reject it.
- Because the existing `runtimeColor()` Tailwind mapping does `rgb(from var(--store-primary) r g b / <alpha-value>)` — CSS relative-color syntax requires the referenced variable to resolve to a plain absolute color. A token defined as `var()` of another token, or a `color-mix()` expression, either breaks this syntax or produces browser-inconsistent results. Enforce "literal color only" for color tokens at validation time, not at runtime.

**If the theme count grows past ~5–6 files:**
- No stack change needed — `postcss.parse()` on a handful of small CSS files is sub-millisecond work at prebuild time. Only reconsider tooling if theme count grows by an order of magnitude (tens to hundreds), which is not this milestone's shape (2–3 presets).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `tailwindcss@4.3.3` | `@tailwindcss/postcss@4.3.3` | Ship as a matched pair in v4; both are already pinned at the current latest release in this repo — no bump needed for this milestone. |
| `postcss@8.5.26` | `tailwindcss@4.3.3` | v4's PostCSS plugin requires PostCSS 8.x; 8.5.26 is current and already satisfies it. Using `postcss.parse()` directly (outside the Tailwind pipeline) has no version interaction with the Tailwind plugin — it's the same package, used as a plain parser in a separate script. |
| CSS relative-color syntax (`rgb(from var(...) ...)`) | Modern evergreen browsers (Chrome/Edge/Safari; Firefox 128+, 2024) | Already load-bearing in production via the existing `runtimeColor()` helper for `primary`/`background`/`foreground` — this milestone only extends the same mechanism to more tokens, it doesn't introduce the technique. No new browser-support exposure. |
| `next@16.3.1` App Router Server Components | D1 read per request in `getActiveTheme()` | Already the accepted latency/architecture tradeoff per the milestone's locked decisions ("`getActiveTheme()` D1 read per request... Accept; revisit only if traces show it") — not a stack question, a decision already made. |

## Sources

- Context7 `/websites/tailwindcss` ("Compatibility", "Theme variables", "Functions and directives" pages) — verified `@import` bundling behavior, `@theme` vs plain CSS-variable semantics, `@config` legacy-JS-config support in v4.0.
- Context7 `/postcss/postcss` (architecture/syntax docs) — verified `postcss.parse()` AST usage and `CssSyntaxError` handling without a plugin pipeline.
- `npm view` against the registry (2026-09-02) — confirmed `tailwindcss`, `@tailwindcss/postcss`, and `postcss` in this repo's `package.json` are already at the current latest published versions (4.3.3 / 4.3.3 / 8.5.26); `lightningcss@1.33.0` and `css-tree@3.2.1` checked as alternatives, not adopted.
- Direct repo inspection — `tailwind.config.ts`, `postcss.config.js`, `app/globals.css`, `app/layout.tsx`, `package.json`, `scripts/db-local-ensure.mjs`, `scripts/check-deploy-config.mjs` — confirmed current CSS pipeline (`@import 'tailwindcss'` + `@config` in `globals.css`, `@tailwindcss/postcss`-only `postcss.config.js`, no `autoprefixer` wired despite being listed), existing `runtimeColor()` token pattern, existing plain-`.mjs` script convention, and the `build`/`build:worker`/`deploy`/`deploy:ci` script graph relevant to prebuild-hook placement.

---
*Stack research for: CSS-file-based storefront theming (v2 milestone, Mercora/Voltique)*
*Researched: 2026-09-02*
