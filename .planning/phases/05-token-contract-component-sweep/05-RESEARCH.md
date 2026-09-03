# Phase 5: Token Contract & Component Sweep - Research

**Researched:** 2026-09-03
**Domain:** Design-token retrofit onto an existing Next.js 16 / Tailwind v4 / Cloudflare Workers storefront (brownfield, no external unknowns)
**Confidence:** HIGH

## Summary

This phase has no new library to learn — every mechanism already exists in the repo (`runtimeColor()`, CSS-variable theming, `getStoreConfig()`) and needs extension, not invention. The work is almost entirely a **verified inventory problem**: how many files touch the palette, in what forms (Tailwind utility, hex literal, inline `style`, dead shadcn class, base64-encoded SVG), and which third-party surfaces need a non-CSS-variable bridge (Stripe, Clerk, email, `global-error.tsx`).

This session's whole-tree greps (excluding `app/admin/**` and `components/admin/**`) found **88 distinct files** carrying a hardcoded-palette signal — consistent with the prior research pass's "85+ files" figure, now independently reconfirmed. The two config-level hex values (`border: "#2a2a2a"`, `ring: "#333333"`) are exactly where CONTEXT.md and the prior research say they are. One correction to CONTEXT.md's assumptions surfaced during this pass: **`font-display` has zero actual Tailwind utility-class usages in the codebase today** (see Assumptions Log A1) — the two "font-display" string matches are the unrelated CSS `font-display: swap;` font-loading property in `app/globals.css`, not a `font-display` className. This doesn't block D-01 (the token stays in the frozen contract), it just means there is no sweep target to find for it — only the Tailwind config wiring itself.

One additional finding not previously surfaced: `lib/utils/email.ts` (order confirmation / order status update templates) carries **85 of the ~127 total hex-literal occurrences** outside `tailwind.config.ts` — a much bigger email surface than the three files named in CONTEXT.md's D-08 list (`shipping-email.ts`, `refund-email.ts`, `review-notifications.ts`). It's already covered by D-08's "and any other inline-styled HTML email" clause, but the planner should size the email chunk (chunk 5 per D-18) around this file, not the three named ones.

**Primary recommendation:** Follow the locked build order exactly (contract → no-op relocation → sweep by chunk), wire `borderRadius` and `fontFamily` into `tailwind.config.ts` alongside `colors` using the same `runtimeColor()`-adjacent CSS-variable pattern, and script both the whole-tree hardcode scan and route screenshots as plain zero-dependency `.mjs`/Playwright scripts consistent with `scripts/build-with-public-env.mjs`. No new npm dependency is required except a screenshot tool (Playwright — verified `OK` on the legitimacy gate below); do not add a client-side theming library.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token contract (CSS custom properties + `runtimeColor()` Tailwind mapping) | Browser / Client (CSS cascade resolves the variable at paint time) | Frontend Server (SSR) | Tailwind emits class names referencing `var(--store-*)`; the browser's CSS engine does the actual color resolution, no JS involved |
| `data-theme` stamping on `<html>` | Frontend Server (SSR) | — | Must be present in the initial server-rendered HTML (`app/layout.tsx`) before first paint, matching the existing `getStoreConfig()` blocking-read pattern |
| Component/template sweep to token classes | Frontend Server (SSR renders the markup) | Browser / Client (renders it visually) | All swept components are React Server Components or client components emitting static class strings; no new runtime logic |
| Stripe Elements appearance | Browser / Client (`"use client"` component) | API / Backend (values sourced from `getThemeTokens()`) | `StripeProvider.tsx` is a client component; Stripe's Elements iframe cannot read page CSS variables, so hex must be computed server-side and passed as a prop/config |
| Clerk `appearance`/`variables` | Browser / Client (Clerk renders its own widgets client-side) | Frontend Server (initial config passed from `app/layout.tsx`, a server component) | `ClerkProvider` is instantiated in the server-rendered root layout but Clerk's actual UI mounts client-side |
| Sonner toast styling | Browser / Client | — | `<Toaster>` is rendered in the client bundle; token classes resolve identically to any other component |
| Transactional email HTML (`lib/utils/email.ts` and siblings) | API / Backend | — | Rendered server-side to a static HTML string and sent via Resend; no CSS cascade exists in an email client, so this tier owns hex resolution entirely, sourced from `getThemeTokens()` |
| `lib/themes/tokens.ts` (`getThemeTokens()`) | API / Backend | Frontend Server, Browser / Client (both consume it) | Single typed source of truth; must be importable from both server and client bundles (no D1/edge-only imports), matching the Anti-Pattern 1 guidance in prior ARCHITECTURE.md research |
| Whole-tree hardcode scan / screenshot capture scripts | Build / CI Tooling (new tier — build-time only) | — | Runs at development/CI time via `.mjs` scripts, never ships in the Worker bundle, matching `scripts/build-with-public-env.mjs` and `scripts/check-deploy-config.mjs` precedent |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

**Token contract (frozen at 23 tokens)**
- D-01: Contract = seed's ~18 tokens + 5 decided here. Colors main: `primary`, `on-primary`, `surface`, `surface-elevated`, `foreground`, `muted-foreground`, `border`, `ring`, `success`, `warning`, `danger`, `info`. Colors inverse: `surface-inverse`, `surface-inverse-elevated`, `on-inverse`, `muted-on-inverse`, `border-inverse`. Shape: `radius-sm`, `radius-md`, `radius-lg`, `radius-xl`. Type: `font-sans`, `font-display`. Reversibility: one-way.
- D-02: Every token required in every theme file. No optional tokens, no fallback chains. Phase 6 validator treats a missing token as a build failure.
- D-03: `info` exists for the "processing" order status (`components/OrderCard.tsx`), one promo banner variant, and the agent chat bubble. Status quartet: `success`/`warning`/`danger`/`info`.
- D-04: `radius-xl` added for themeable card corners. Mapping: `rounded-sm`/bare `rounded` → `radius-sm`; `rounded-md` → `radius-md`; `rounded-lg` → `radius-lg`; `rounded-xl` → `radius-xl`. `rounded-full` and directional variants stay raw. `volt-dark` sets all four radius tokens to today's Tailwind default values so nothing moves.

**Inverted light panels (cart drawer, agent drawer)**
- D-05: `CartDrawer.tsx` and `AgentDrawer.tsx` keep light-on-dark via the inverse token set, not folded into `surface-elevated`, not a hardcoded exception. Under `volt-dark`: `surface-inverse` = `#fdfdfb`, `on-inverse` = black, `surface-inverse-elevated` covers `bg-gray-100/200`, `muted-on-inverse` covers `text-gray-400..900`, `border-inverse` covers `border-gray-700`/`border-neutral-800`. Reversibility: costly.
- D-06: Inverse set mirrors main set so a light preset can flip the drawers to dark panels.

**Class naming**
- D-07: Swept code uses unprefixed Tailwind classes only: `bg-surface`, `text-foreground`, `bg-primary`, `text-on-primary`, `bg-surface-inverse`, `border-border`, `ring-ring`, `bg-info`, `rounded-md`. The `store-*` color group and `background` alias in `tailwind.config.ts` are deleted. CSS custom properties keep the `--store-*` prefix. Reversibility: costly.

**Sweep boundary — IN**
- D-08: Transactional emails ARE swept: `lib/fulfillment/shipping-email.ts`, `lib/payments/refund-email.ts`, `lib/utils/review-notifications.ts`, and any other inline-styled HTML email. Mail clients receive hex values.
- D-09: `lib/themes/tokens.ts` exports `getThemeTokens()` returning `volt-dark` values as a typed constant in Phase 5. Emails, Stripe, Clerk, `global-error.tsx` read from it. Phase 6 replaces its body to read the generated manifest; callers never change again. Reversibility: reversible.
- D-10: Emails map to `primary` + inverse set: page bg = `surface-inverse`, card bg = `surface-inverse-elevated`, body text = `on-inverse`, muted text = `muted-on-inverse`, dividers = `border-inverse`, brand accent/buttons = `primary`/`on-primary`. Emails stay light under `volt-dark`.
- D-11: Stripe Elements (`components/checkout/StripeProvider.tsx`) gets `appearance` from `getThemeTokens()` using the same mapping as emails (`primary`, `surface-inverse`, `on-inverse`, `border-inverse`, `danger`). Payment form stays light under `volt-dark`. Values reach the client component through `StoreConfigProvider` or a server prop; planner chooses.
- D-12: Sonner's `className` in `app/layout.tsx` becomes token classes (`bg-primary/80 text-on-primary`). Clerk keeps `baseTheme: dark` but sets `variables` from `getThemeTokens()`.
- D-13: `app/global-error.tsx` renders without `globals.css` or the theme file; its inline styles import hex from `getThemeTokens()` rather than being an exception. No exclusions entry needed.

**Sweep boundary — OUT**
- D-14: Admin stays hardcoded: `app/admin/**`, `components/admin/**`, `.admin-*` rules in `app/globals.css`. This is the only path-based scan exclusion in the storefront tree.

**Color mapping rules**
- D-15: Semantic first, consolidate aggressively. Choose token by role; collapse `neutral-*`/`gray-*`/`orange-*` shade ladders to the fewest shades the contract offers. Close-enough snaps are expected, not regressions.
- D-16: Regression = layout, spacing, typography size/weight, opacity/overlay treatment, shadow treatment, light-vs-dark surface polarity. "Renders identically" = "no change outside shade consolidation."
- D-17: shadcn primitives in `components/ui/*` rewritten to the contract, not aliased/deleted: `bg-accent`/`bg-muted` → `bg-surface-elevated`, `text-accent-foreground` → `text-foreground`, `bg-destructive`/`text-destructive` → `bg-danger`/`text-danger`, `text-muted-foreground` stays, `text-text-secondary` in `app/order-status/[id]/page.tsx` → `text-muted-foreground`. Hover/focus states become visible for the first time in dropdowns, nav menu, select, table, buttons — these get their own screenshots.

**Screenshots & PR cadence**
- D-18: One branch per sweep chunk, PR to main. Chunks in order: (1) contract + tailwind.config.ts + volt-dark.css relocation, pure no-op; (2) shared shell (layout.tsx, Header/HeaderClient, Footer, PromotionalBanner, components/ui/*); (3) home + category + product; (4) cart + checkout + both drawers + Stripe; (5) account + order-status + emails + global-error.tsx + Clerk. Planner may split further, not merge. `branching_strategy: none` is overridden for this phase.
- D-19: Screenshots in git-ignored `.screenshots/`; each chunk adds to `05-SCREENSHOTS.md` (route, viewport, state, path, hash, intentional snaps). Images never committed.
- D-20: Per route per chunk: desktop 1280px + mobile 390px, resting + one open interactive state. Routes: home, category, product, cart, checkout, account, order-status.
- D-21: "Before" baseline captured once from main before chunk 1 merges; every chunk diffs against that baseline, not PR-to-PR.

### Claude's Discretion

- Screenshot capture tooling (must be repeatable for Phase 8, add nothing to the Worker bundle or deploy path, drive open interactive states)
- `on-primary` value under `volt-dark` (today mixes `text-white` and `text-black`)
- `font-display` face under `volt-dark` (default to Geist sans stack unless a loaded display face is found — **none was found this session, see Assumptions Log**)
- `warning` source shade (`amber-*` 5 files vs `yellow-*` 5 files this session — pick contrast-safe shade)
- `ring`/`border` consolidated values (move `#2a2a2a`/`#333333` out of `tailwind.config.ts`; this session's grep shows `border-neutral-700` and `border-neutral-600` as the dominant shades, not `neutral-800` — see Assumptions Log A2)
- `StoreConfig.theme` shape after `NEXT_PUBLIC_THEME_PRIMARY` removal (shim vs drop other fields)
- Header Suspense fallback (`bg-neutral-900`), `#f97316` focus outline in `globals.css` — ordinary sweep targets
- `lib/utils/image-placeholders.ts` SVG fill `#373741` — sweep target or documented theme-neutral exception (**this session found it is base64-encoded inside a data URI, not a literal `fill=` attribute — see Common Pitfalls**)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Items explicitly left to later phases per ROADMAP.md: theme validator and manifest, `getActiveTheme()` D1 resolution and telemetry, admin Appearance UI, second/light presets (Phase 6); layout switches (Phase 7); `docs/theming.md` and the presets × layouts QA matrix (Phase 8).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOKEN-01 | ~23-token contract (per CONTEXT.md D-01, supersedes REQUIREMENTS.md's ~18-token draft list) mapped through `runtimeColor()` in `tailwind.config.ts`, hardcoded `border`/`ring` hex deleted | Standard Stack + Code Examples sections give exact `tailwind.config.ts` extension pattern and verified Tailwind v4 default radius values to seed `volt-dark.css` |
| TOKEN-02 | Current look relocated verbatim to `themes/volt-dark.css` as `[data-theme="volt-dark"]`, `data-theme` stamped on `<html>` server-side in `app/layout.tsx`, visual no-op | Architecture Patterns section documents the exact current inline-style block (lines 132-144) to relocate and the CSS import mechanics |
| TOKEN-03 | Whole-tree scan finds zero hardcoded palette values in storefront code (admin excluded) | Common Pitfalls + Code Examples give the verified grep patterns and the 88-file/127-hex-occurrence baseline this session established |
| TOKEN-04 | `NEXT_PUBLIC_THEME_PRIMARY` removed from codebase; `logoPath` still resolves via store-config | Code the phase modifies section cites exact `lib/store-config.ts` line numbers (54-62, 116-120, 420-424) |
| TOKEN-05 | Before/after screenshots per route accompany each sweep PR | Validation Architecture section covers screenshot tooling (none exists today — Playwright recommended, legitimacy-verified) |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| Tailwind CSS | 4.3.3 (pinned; matches `npm view tailwindcss version` = `4.3.3` [VERIFIED: npm registry]) | Utility classes resolving CSS custom properties | Already the project's styling layer; `runtimeColor()` helper already proven in `tailwind.config.ts:3-4` |
| `@tailwindcss/postcss` | ^4.3.3 (installed devDependency) | PostCSS plugin for Tailwind v4 | Required companion to `tailwindcss` v4; already present |
| Next.js | ^16.3.1 in `package.json`, `16.3.4` latest per `npm view next version` [VERIFIED: npm registry] | App Router SSR, `next/font` | Already the framework; no version bump needed for this phase |

### Supporting (new for this phase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `playwright` | `1.62.1` current per `npm view playwright version` [VERIFIED: npm registry]; package identity/choice is `[ASSUMED]` (training knowledge, not Context7-confirmed this session — Context7 was unavailable) | Route screenshot capture (before/after diffing per D-19/D-20) | devDependency only; scripted via `scripts/screenshot-routes.mjs`, never touches `build:worker`/deploy path |

No other new dependency is required. `postcss` (already a devDependency, parse-only) and Node built-ins are sufficient for a hardcode-scan script; do not add a headless-browser alternative (`puppeteer`) or a visual-diff SaaS (Percy/Chromatic) — Playwright alone (`page.screenshot()` + a simple pixel/hash compare, or even just file-naming discipline per D-19) meets every stated constraint without a paid service.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright for screenshots | Manual capture via `chrome-cdp` skill | Not repeatable for Phase 8's preset × layout matrix — CONTEXT.md's discretion note explicitly names this as the non-repeatable option |
| Playwright for screenshots | `puppeteer` | Functionally similar; Playwright chosen because its multi-viewport (`page.setViewportSize`) and trace tooling are slightly better documented and it's the more actively maintained of the two as of this session's `npm view` check |
| `getThemeTokens()` as plain object | Parsing `themes/volt-dark.css` at send/request time | Workers can't reliably read the filesystem at runtime in the OpenNext/Cloudflare build; CONTEXT.md's discussion log explicitly rejected this (D-09 discussion) |

**Installation:**
```bash
mise exec -- npm install -D playwright @playwright/test
mise exec -- npx playwright install --with-deps chromium
```

**Version verification:** Confirmed via `npm view playwright version` → `1.62.1`, `npm view @playwright/test version` → `1.62.1`, both published `2026-07-30` (this session). `npm view tailwindcss version` → `4.3.3` (matches installed). `npm view next version` → `16.3.4` (package.json pins `^16.3.1`; a routine patch bump exists but is not required for this phase).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| `playwright` | npm | actively maintained, latest release 2026-07-30 | 87.5M/week | github.com/microsoft/playwright | OK | Approved |
| `@playwright/test` | npm | actively maintained, latest release 2026-07-30 | 58.4M/week | github.com/microsoft/playwright | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Both packages were discovered via training knowledge (Context7 unavailable this session per the invocation's environment notes), so the package **name** is tagged `[ASSUMED]` per the provenance rule even though the legitimacy gate (`gsd_run query package-legitimacy check --ecosystem npm`) returned `OK` for both with no postinstall script, an authentic Microsoft-owned source repo, and tens of millions of weekly downloads. The planner should add a `checkpoint:human-verify` before `npm install` per the ASSUMED-package gating rule, even though the legitimacy signals are strong.*

## Architecture Patterns

### System Architecture Diagram

```
Request for any storefront route
        │
        ▼
app/layout.tsx (Server Component, force-dynamic)
        │  reads getStoreConfig() [server-only, no process.env leakage]
        │  stamps <html data-theme="volt-dark">   ◄── TOKEN-02 target
        │  (inline --store-* body style REMOVED — was lines 134-142)
        ▼
themes/volt-dark.css  ──imported──▶  app/globals.css  ──@config──▶  tailwind.config.ts
        │  [data-theme="volt-dark"] { --primary: #f97316; --on-primary: ...; }
        │  (23 custom properties, ALL required — TOKEN-01)
        ▼
Browser applies CSS cascade
        │
        ├──▶ Swept component markup (bg-primary, text-on-primary, rounded-md, ...)
        │      resolved via runtimeColor()-style var() lookups — TOKEN-03
        │
        ├──▶ components/ui/* (shadcn primitives)
        │      dead classes (bg-accent, bg-popover, ...) rewritten to real tokens — D-17
        │
        └──▶ Inverse-token surfaces (CartDrawer, AgentDrawer)
               bg-surface-inverse / text-on-inverse — stay visually light — D-05/D-06

Non-CSS-cascade consumers (cannot read var(--x) directly):
        │
lib/themes/tokens.ts::getThemeTokens()  ── typed hex constants, volt-dark only (Phase 5) ── D-09
        │
        ├──▶ components/checkout/StripeProvider.tsx ("use client")
        │      appearance.variables = { colorPrimary: tokens.primary, colorBackground: tokens.surfaceInverse, ... }
        │
        ├──▶ app/layout.tsx  ClerkProvider variables={...}  +  Sonner toastOptions.className
        │
        ├──▶ app/global-error.tsx (no globals.css available — renders standalone)
        │      style={{ background: tokens.surfaceElevated, color: tokens.foreground, ... }}
        │
        └──▶ lib/utils/email.ts, lib/fulfillment/shipping-email.ts, lib/payments/refund-email.ts,
             lib/utils/review-notifications.ts, lib/subscriptions/lifecycle-email.ts, lib/email/footer.ts
                inline HTML style="color: ${tokens.onInverse}" (sent via Resend, no CSS cascade exists)
```

### Recommended Project Structure

```
themes/
└── volt-dark.css          # new: [data-theme="volt-dark"] block, all 23 tokens, verbatim current look
lib/
└── themes/
    └── tokens.ts           # new: getThemeTokens() typed constant (Phase 5 body; Phase 6 rewires internals only)
scripts/
├── scan-hardcoded-colors.mjs   # new: whole-tree grep-equivalent scan, exit 1 on any hit outside admin exclusion
└── screenshot-routes.mjs        # new: Playwright script, desktop+mobile, resting+interactive, per D-20
.screenshots/                    # new, git-ignored: raw PNGs
.planning/phases/05-token-contract-component-sweep/
└── 05-SCREENSHOTS.md            # new: manifest (route, viewport, state, path, hash, snaps) per D-19
```

### Pattern 1: Extending `runtimeColor()` to the full 23-token contract

**What:** The existing helper already proves the mechanism (`tailwind.config.ts:3-4`); it needs to cover every color token, not just the four it does today.
**When to use:** Every color token in D-01's list.
**Example:**
```typescript
// Source: current tailwind.config.ts (this repo), extended per D-01/D-07
const runtimeColor = (variable: string) =>
  `rgb(from var(${variable}) r g b / <alpha-value>)`;

const config: Config = {
  theme: {
    extend: {
      colors: {
        primary: runtimeColor("--primary"),
        "on-primary": runtimeColor("--on-primary"),
        surface: runtimeColor("--surface"),
        "surface-elevated": runtimeColor("--surface-elevated"),
        foreground: runtimeColor("--foreground"),
        "muted-foreground": runtimeColor("--muted-foreground"),
        border: runtimeColor("--border"),
        ring: runtimeColor("--ring"),
        success: runtimeColor("--success"),
        warning: runtimeColor("--warning"),
        danger: runtimeColor("--danger"),
        info: runtimeColor("--info"),
        "surface-inverse": runtimeColor("--surface-inverse"),
        "surface-inverse-elevated": runtimeColor("--surface-inverse-elevated"),
        "on-inverse": runtimeColor("--on-inverse"),
        "muted-on-inverse": runtimeColor("--muted-on-inverse"),
        "border-inverse": runtimeColor("--border-inverse"),
      },
      // NOTE: `store` group and `background` alias (current lines 14-20, 22) are DELETED per D-07
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
    },
  },
};
```
This is `[CITED: current tailwind.config.ts read this session]` for the base pattern, extended per the locked D-01/D-04/D-07 decisions. `borderRadius`/`fontFamily` extension keys are standard Tailwind v3-compatible JS-config syntax (still honored under the `@config` directive already in use in `app/globals.css:2`), consistent with how `colors.extend` already works in this file.

### Pattern 2: `volt-dark.css` radius values — verified against installed Tailwind, not assumed

**What:** D-04 requires `volt-dark` to set radius tokens to "today's Tailwind default values so nothing moves." This session read the actual installed package rather than relying on documentation search (a WebSearch on this exact question returned a slightly wrong `rounded-sm` value, corrected below).
**Verified values** `[VERIFIED: node_modules/tailwindcss/theme.css:397-404]`:
```css
--radius-xs: 0.125rem;
--radius-sm: 0.25rem;
--radius-md: 0.375rem;
--radius-lg: 0.5rem;
--radius-xl: 0.75rem;
```
Because D-04 maps bare `rounded` and `rounded-sm` to the same `radius-sm` token, and Tailwind's own `--radius` (bare `rounded`) default is *also* `0.25rem` `[VERIFIED: node_modules/tailwindcss/theme.css:508]`, there is no value conflict — both currently resolve to the same pixel size.
```css
/* themes/volt-dark.css */
[data-theme="volt-dark"] {
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
}
```

### Pattern 3: `font-sans`/`font-display` must move out of `globals.css`'s hardcoded `.font-sans` class

**What:** Today, `font-sans` is NOT wired through Tailwind's `theme.fontFamily` at all — it's a static CSS class in `app/globals.css:11-16` (`[VERIFIED: app/globals.css:11-16]`, quoted: `".font-sans { font-family: var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-display: swap; }"`). This bypasses the token contract entirely — it's not driven by a `--font-sans` CSS custom property, it's driven directly by `next/font`'s `--font-geist-sans` variable.
**Why it matters for this phase:** To make `font-sans`/`font-display` real *tokens* (D-01 requires them in the contract, one-way frozen), `volt-dark.css` needs to define `--font-sans` and `--font-display` (referencing `var(--font-geist-sans)` per CONTEXT.md's discretion note — no display font is loaded), and `tailwind.config.ts`'s new `fontFamily` extension (Pattern 1) needs to reference those vars instead of `globals.css` owning the mapping directly. The static `.font-sans`/`.font-mono` classes in `globals.css` should be reconciled with — not duplicated by — the new `fontFamily.sans` Tailwind utility.
**Example:**
```css
/* themes/volt-dark.css */
[data-theme="volt-dark"] {
  --font-sans: var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-display: var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

### Pattern 4: `data-theme` stamping replaces the current inline `--store-*` body style

**What:** Today, `app/layout.tsx` sets four CSS custom properties inline on `<body>` from `getStoreConfig().theme` `[VERIFIED: app/layout.tsx:132-144]`, quoted:
```
<body
  className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
  style={{
    backgroundColor: config.theme.surface,
    color: config.theme.foreground,
    "--store-primary": config.theme.primary,
    "--store-surface": config.theme.surface,
    "--store-surface-elevated": config.theme.surfaceElevated,
    "--store-foreground": config.theme.foreground,
    "--store-muted-foreground": config.theme.mutedForeground,
  } as React.CSSProperties}
  suppressHydrationWarning
>
```
**Where it goes:** This entire `style={{ ... }}` prop is deleted. `data-theme="volt-dark"` is stamped on the `<html>` element `[VERIFIED: app/layout.tsx:126]` (quoted: `<html lang="en" suppressHydrationWarning>`), which currently has no `data-theme` attribute. The `bg-surface text-foreground` Tailwind classes replace the inline `backgroundColor`/`color` on `<body>`, per CONTEXT.md's Integration Points note.
**Why this is safe as a no-op (D-18 chunk 1):** `themes/volt-dark.css` sets `--surface`/`--foreground`/etc. to the exact same hex values `getStoreConfig().theme` returns today (`#000000`, `#ffffff`, etc. `[VERIFIED: lib/store-config.ts:116-120]`), so the rendered pixels don't change — only the mechanism does.

### Anti-Patterns to Avoid

- **Aliasing shadcn dead classes instead of rewriting them:** CONTEXT.md's D-17 explicitly rejects `accent`/`muted`/`destructive` as permanent Tailwind config aliases — "two vocabularies forever" was the rejected option in the discussion log. Rewrite class names in `components/ui/*` source files, don't add a config-level alias layer.
- **A generic `layout` prop or reintroducing `store-*` prefixed classes "just to be safe":** D-07 is one-way; mixing prefixed and unprefixed class names during the sweep makes the completion scan unable to tell "tokenized" from "stray."
- **Reading `themes/volt-dark.css` at runtime to build `getThemeTokens()`:** rejected in the discussion log (D-09) — Workers cannot reliably read the filesystem at request time in the OpenNext/Cloudflare build. `getThemeTokens()` must be a plain TypeScript module returning a typed constant object, matching `[CITED: .planning/research/ARCHITECTURE.md Anti-Pattern 1]`'s guidance to keep it import-safe from both server and client bundles.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Detecting every hardcoded color across a mixed TS/TSX/CSS tree | A custom AST walker | Layered `grep -rEIn` passes (hex, `rgb(`/`hsl(`, named Tailwind palette utilities, `style={{` color props, `fill=`/`stroke=` attributes) wrapped in one `.mjs` script, exit-code gated | `postcss.parse()` (already a devDependency) is available if AST precision is ever needed for `tailwind.config.ts` itself, but a layered grep is sufficient for a one-time completion gate and is what Phase 6's validator (different concern — theme *file* validation, not sweep completion) will build alongside, not replace |
| Route screenshot capture + basic diffing | A custom headless-Chrome CDP driver | Playwright (`page.screenshot()`, `page.setViewportSize()`) | Battle-tested viewport/wait-state handling; CDP-direct scripting (the `chrome-cdp` skill) is explicitly non-repeatable per CONTEXT.md's discretion note |
| Feeding hex values into Stripe Elements / Clerk / emails | Parsing CSS at runtime, or duplicating hex literals in each consumer | Single `getThemeTokens()` typed source (D-09) | One source of truth avoids the four-consumer hex-drift problem the milestone is designed to prevent |

**Key insight:** Nothing about this phase requires a new abstraction. The single biggest risk is under-scoping the sweep (Pitfall 4 below) — the fix is a wider grep, not a smarter tool.

## Common Pitfalls

### Pitfall 1: A className-only sweep misses `tailwind.config.ts` itself, inline `style={}`, and dead shadcn classes

**What goes wrong:** `grep -rn "className.*bg-neutral"` looks complete at ~90% coverage and stops there, missing the two hex literals inside `tailwind.config.ts` (not a `className` string), `app/global-error.tsx`'s seven `style={{ }}` color props, and `components/ui/*`'s references to CSS variables (`--popover`, `--accent`) that were never defined anywhere in this codebase.
**Why it happens:** "Sweep the components" mentally scopes to `.tsx` files with `className="bg-X"` strings because that's most of the surface area.
**How to avoid:** This session's verified counts, to size the actual scan: **88 distinct non-admin files** carry a hardcoded-palette signal (Tailwind palette utility, hex literal, or `rgb()/hsl()` literal) `[VERIFIED: this session's grep against app/, components/, lib/]`. Breakdown:
  - 76 files with raw Tailwind palette utility classes (`bg-gray-*`, `text-neutral-*`, `bg-white`, dead shadcn classes, etc.)
  - 127 total hex-literal (`#rrggbb`/`#rgb`) occurrences across 14 files, dominated by `lib/utils/email.ts` (85 occurrences alone)
  - 2 files with `rgb()`/`rgba()` literals outside `tailwind.config.ts`/`globals.css`'s admin block: `app/globals.css` (admin-only, excluded) and `components/checkout/StripeProvider.tsx`
  - Only `app/global-error.tsx` has inline `style={{ }}` color/background props outside admin
  - Zero `fill=`/`stroke=` SVG attributes with literal hex/rgb/named colors were found by direct grep — but see Pitfall 3 below, this is a false negative
**Warning signs:** `grep -rEIn '#[0-9a-fA-F]{3,8}|rgb\(|hsl\('` across `app/ components/ lib/ tailwind.config.ts` (excluding `admin/`) still returns hits after the sweep is marked complete.

### Pitfall 2: shadcn dead classes are a bigger and more varied set than D-17 enumerates

**What goes wrong:** D-17 names `bg-accent`, `bg-muted`, `bg-destructive`/`text-destructive`, `text-muted-foreground`, `text-text-secondary` explicitly. This session's grep of `components/ui/*` found a wider set that also needs a mapping decision: `ring-destructive` (18 occurrences), `border-destructive` (7), `bg-secondary`/`text-secondary-foreground` (5+2), `bg-primary-foreground`/`text-primary-foreground` (5 combined — these reference an undefined `--primary-foreground`, distinct from the real, already-working `primary` token), `bg-card`/`text-card-foreground` (2 combined), `text-popover-foreground` (5).
**Why it happens:** shadcn/ui ships a much larger default color vocabulary (`accent`, `muted`, `destructive`, `secondary`, `card`, `popover`, each with a `-foreground` pair) than this project's token contract names explicitly.
**How to avoid:** Before the `components/ui/*` chunk (D-18 chunk 2), the planner should extend D-17's mapping table to cover every class this session found: `bg-primary-foreground`/`text-primary-foreground` → `bg-on-primary`/`text-on-primary` (they mean the same thing as the contract's `on-primary`), `bg-secondary`/`text-secondary-foreground` → same target as `accent`/`muted` (`surface-elevated`/`foreground`) unless a distinct visual is wanted, `ring-destructive`/`border-destructive` → `ring-danger`/`border-danger`, `bg-card`/`text-card-foreground` → `surface-elevated`/`foreground`, `text-popover-foreground` → `foreground`. `bg-primary`, `text-primary`, `border-primary` are **already real** (defined via `runtimeColor("--store-primary")` today) and don't need remapping, only the unprefixed-class rename per D-07.
**Warning signs:** A dropdown, dialog, or destructive-action button renders transparent, unstyled, or with an invisible focus ring after the "sweep is done."

### Pitfall 3: A blur-placeholder SVG is base64-encoded — a literal `fill=` grep will silently miss it

**What goes wrong:** `lib/utils/image-placeholders.ts` `[VERIFIED: lib/utils/image-placeholders.ts, full file read this session]` contains two exported `data:image/svg+xml;base64,...` strings used as Next.js `<Image>` blur placeholders. The *decoded* SVG contains `fill="#373741"` and `fill="#525257"` (documented in a comment at the bottom of the file for human reference), but the live, executing code is a base64 string — a grep for `fill="#` will report zero hits in this file even though it does hardcode a color.
**Why it happens:** Base64 encoding is opaque to text-based scanning by construction; the JSDoc comment showing the decoded SVG is a documentation aid, not the executing value.
**How to avoid:** Treat this file as a manual-review item, not a scan-passable one. Per CONTEXT.md's discretion note, the correct handling is a documented decision either way: (a) since this is a `blurDataURL` for `next/image` — rendered for a fraction of a second before the real image loads, and cached at the CDN/build level — it is reasonable to leave it as a **documented, code-commented exception** (base64 data URIs cannot read CSS custom properties regardless of theme, so no theme can ever make it "correct" without a build-time regeneration step that doesn't exist yet), OR (b) regenerate it to use `surface-elevated`'s volt-dark hex value (still hardcoded, just correctly matching the new token's value) if the planner wants the scan to have zero hand-maintained exceptions. Either way, this needs one line in the phase's exceptions list — do not let a "clean scan output" claim rest on this file being silently skipped.
**Warning signs:** Whole-tree scan reports zero hits yet the placeholder still visibly doesn't match a new preset's `surface-elevated` value (only detectable by eye, not by grep).

### Pitfall 4: `app/global-error.tsx` currently renders with MAIN tokens, not inverse — unlike every other non-CSS-cascade consumer

**What goes wrong:** D-13 groups `global-error.tsx` alongside emails/Stripe conceptually ("its inline styles import hex from `getThemeTokens()`") but its *current* colors are darkmode-matching, not light-mode-matching: background `#171717` `[VERIFIED: app/global-error.tsx, full file read this session]` matches `storeDefaults.theme.surfaceElevated` (`#171717` `[VERIFIED: lib/store-config.ts:118]`), not the inverse set. If a planner defaults to the inverse-set mapping used for emails/Stripe (D-10/D-11) by pattern-matching D-13's neighboring bullet points, the error page would flip from dark to light — a visual regression D-16 forbids.
**Why it happens:** D-13 doesn't specify which token subset `global-error.tsx` should map to, and it's grouped in the same CONTEXT.md subsection as the two inverse-mapped surfaces.
**How to avoid:** Map `global-error.tsx` to the **main** token set: `background: #171717` → `surfaceElevated`, `color: #ffffff` → `foreground`, `color: #d4d4d4` (muted paragraph text) → `mutedForeground`, `background: #ea580c` (button) → a darker `primary` shade or `primary` itself (currently a hover-state orange, not the base `#f97316` — flag as a D-15-style close-enough snap), `border: 1px solid #737373"` → `border` (post-consolidation value, see Assumptions Log A2).
**Warning signs:** Before/after screenshot of a forced error boundary (e.g., temporarily throwing in a server component) shows a light page where a dark one existed.

### Pitfall 5: The real deploy build is `build:worker`, not `build` — verified again this session

**What goes wrong:** `[VERIFIED: package.json scripts block, read this session]` — `"build": "next build --webpack"`, `"build:worker": "node scripts/build-with-public-env.mjs ./node_modules/.bin/opennextjs-cloudflare build"`, `"deploy": "npm run clean && npm run build:worker && opennextjs-cloudflare deploy"`. Nothing in Phase 5 wires a validator into the build (that's Phase 6's THEME-01), but the *scan script* this phase builds should itself be run via a script name that will actually get invoked in CI (a `npm run scan:tokens` step in whatever CI config exists, or as a documented manual pre-PR step) — do not name it `prescan` or similar hoping for automatic npm lifecycle behavior, since this repo's own `predeploy`/`predev` hooks are wired explicitly by name match, not by convention magic.
**Why it happens:** npm's `pre*` lifecycle hooks only fire for an exact script-name match; this repo already had to learn this the hard way per `.planning/research/PITFALLS.md` Pitfall 1 (documented for Phase 6, same underlying npm behavior applies to any script this phase adds).
**How to avoid:** Add the scan as a named script (e.g., `"scan:tokens": "node scripts/scan-hardcoded-colors.mjs"`) invoked explicitly per PR/chunk, not relying on a `pre`-prefixed convenience name.

## Code Examples

### Whole-tree hardcode scan (verified patterns from this session's manual greps, ready to script)

```javascript
// Source: this session's verified grep passes against the live repo; scripts/scan-hardcoded-colors.mjs
// Pattern follows scripts/check-deploy-config.mjs's exit-code convention.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOTS = ["app", "components", "lib", "tailwind.config.ts"];
const EXCLUDE_DIRS = new Set(["admin"]); // app/admin/**, components/admin/**
const EXCLUDE_FILES = new Set([
  // documented exceptions — see Pitfall 3 (base64 blur placeholder) and Pitfall 4 handling
]);
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_HSL = /\b(rgb|rgba|hsl|hsla)\([0-9]/g;
const RAW_PALETTE = /\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|caret|accent|shadow)-(gray|neutral|zinc|slate|stone|orange|red|green|blue|amber|yellow|emerald|white|black|popover|accent|muted|destructive|card|secondary)(-[0-9]+)?\b/g;
const INLINE_STYLE_COLOR = /style=\{\{[^}]*(color|background)/g;
// ... walk ROOTS, skip EXCLUDE_DIRS/EXCLUDE_FILES, test each .ts/.tsx/.css file against all four patterns,
// collect hits with file:line, exit(1) if any hit remains outside the documented exceptions list.
```

### `getThemeTokens()` typed source (D-09)

```typescript
// Source: pattern synthesized from D-09/D-10/D-11 decisions + this repo's existing typed-getter
// convention (getStoreConfig() in lib/store-config.ts)
export type ThemeTokens = {
  primary: string; onPrimary: string; surface: string; surfaceElevated: string;
  foreground: string; mutedForeground: string; border: string; ring: string;
  success: string; warning: string; danger: string; info: string;
  surfaceInverse: string; surfaceInverseElevated: string; onInverse: string;
  mutedOnInverse: string; borderInverse: string;
  radiusSm: string; radiusMd: string; radiusLg: string; radiusXl: string;
  fontSans: string; fontDisplay: string;
};

const VOLT_DARK_TOKENS: ThemeTokens = {
  primary: "#f97316", onPrimary: "#000000" /* or #ffffff — planner's discretion call */,
  surface: "#000000", surfaceElevated: "#171717",
  foreground: "#ffffff", mutedForeground: "#a3a3a3",
  border: "#262626" /* consolidated value — see Assumptions Log A2 */, ring: "#262626",
  success: "#22c55e" /* green-500, planner confirms exact shade during sweep */,
  warning: "#f59e0b" /* amber vs yellow — planner's discretion call */,
  danger: "#ef4444", info: "#3b82f6",
  surfaceInverse: "#fdfdfb", surfaceInverseElevated: "#f3f4f6" /* gray-100 */,
  onInverse: "#000000", mutedOnInverse: "#6b7280" /* gray-500-ish midpoint */,
  borderInverse: "#374151" /* gray-700 */,
  radiusSm: "0.25rem", radiusMd: "0.375rem", radiusLg: "0.5rem", radiusXl: "0.75rem",
  fontSans: "var(--font-geist-sans), system-ui, sans-serif",
  fontDisplay: "var(--font-geist-sans), system-ui, sans-serif",
};

export function getThemeTokens(): ThemeTokens {
  return VOLT_DARK_TOKENS; // Phase 6 replaces this body to read the generated manifest
}
```
This is `[ASSUMED]` for the exact hex values not already verified against `lib/store-config.ts` (primary/surface/surfaceElevated/foreground/mutedForeground/surfaceInverse/onInverse are `[VERIFIED: lib/store-config.ts:116-120]` and CONTEXT.md D-05; the remaining shade picks — `success`/`warning`/`danger`/`info`/consolidated `border`/`ring`/`surfaceInverseElevated`/`mutedOnInverse`/`borderInverse` — are placeholders the planner/executor must confirm against the actual current usage during the sweep, several of which are explicitly marked "Claude's Discretion" in CONTEXT.md).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 `[VERIFIED: package.json devDependencies]` |
| Config file | `vitest.config.ts` — `include: ["tests/unit/**/*.test.ts"]`, `exclude: ["tests/e2e/**", ...]` `[VERIFIED: vitest.config.ts, full file read this session]` |
| Quick run command | `mise exec -- npm run test -- <pattern>` (`"test": "vitest run"`) |
| Full suite command | `mise exec -- npm run test && npm run typecheck && npm run lint` |
| Visual regression tooling | **None exists today** `[VERIFIED: no playwright/puppeteer/storybook/chromatic/percy references in package.json, and no `tests/e2e/` directory present on disk this session]` — must be introduced this phase (see Standard Stack) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| TOKEN-01 | `tailwind.config.ts` exports all 23 tokens through `runtimeColor()`/`borderRadius`/`fontFamily`, no `border`/`ring` hex literal remains | unit / static check | `grep -c '#2a2a2a\|#333333' tailwind.config.ts` (expect 0) + `mise exec -- npm run typecheck` | ❌ Wave 0 — write as a one-line assertion in a new `tests/unit/lib/themes/token-contract.test.ts` |
| TOKEN-02 | `themes/volt-dark.css` live, `data-theme="volt-dark"` on `<html>`, zero visual diff | visual (screenshot) + manual | `node scripts/screenshot-routes.mjs --baseline` then a re-run compared by eye/hash after chunk 1 merges | ❌ Wave 0 — script doesn't exist yet |
| TOKEN-03 | Zero hardcoded palette values outside `app/admin/**`/`components/admin/**` | automated scan | `mise exec -- npm run scan:tokens` (exit 0) | ❌ Wave 0 — script doesn't exist yet |
| TOKEN-04 | `NEXT_PUBLIC_THEME_PRIMARY` absent from codebase; `getStoreConfig().theme.logoPath` unchanged | automated scan + unit | `grep -r "NEXT_PUBLIC_THEME_PRIMARY" --include='*.ts' --include='*.tsx' .` (expect 0, excluding this RESEARCH.md and `docs/runtime-configuration.md` update) + existing store-config tests | Check `tests/unit/` for an existing `store-config` test file before assuming Wave 0 |
| TOKEN-05 | Before/after screenshots per route accompany each sweep PR | manual (screenshot review) + scripted capture | `node scripts/screenshot-routes.mjs --route home --route category ...` | ❌ Wave 0 |

### Sampling Rate
- **Per task/chunk commit:** `mise exec -- npm run typecheck && npm run lint` (fast, catches broken class-name references and TS errors from the `getThemeTokens()` refactor)
- **Per chunk merge (D-18 branch → main):** full `mise exec -- npm run test`, plus a screenshot capture + manual diff review against the D-21 baseline for that chunk's routes
- **Phase gate:** `mise exec -- npm run test && npm run typecheck && npm run lint` green, `npm run scan:tokens` exit 0, and every route's screenshot manifest entry in `05-SCREENSHOTS.md` reviewed, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `scripts/scan-hardcoded-colors.mjs` — whole-tree hardcode scan, covers TOKEN-03
- [ ] `scripts/screenshot-routes.mjs` — Playwright capture script, covers TOKEN-02/TOKEN-05
- [ ] `tests/unit/lib/themes/token-contract.test.ts` — asserts `tailwind.config.ts` has no `border`/`ring` hex literal and `lib/themes/tokens.ts` returns all 23 keys, covers TOKEN-01
- [ ] `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` — manifest file, covers TOKEN-05
- [ ] `.screenshots/` added to `.gitignore` (not currently present `[VERIFIED: .gitignore, read this session]`)
- [ ] Playwright install: `mise exec -- npm install -D playwright @playwright/test && npx playwright install --with-deps chromium`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `font-display` has zero live Tailwind-utility-class usages in the codebase (only an unrelated CSS `font-display: swap;` property exists) | Summary, User Constraints (Claude's Discretion) | Low — this only affects whether there's an actual sweep target for the token; the contract stays frozen regardless. If a hidden usage exists (e.g., dynamically constructed className string), it would surface as a missed sweep item, not a broken build |
| A2 | Consolidated `border`/`ring` value should likely be `neutral-700`/`neutral-600`-range (`#404040`/`#525252`), not `neutral-800` (`#262626`) as CONTEXT.md's discretion note speculated, because this session's grep found `border-neutral-700` (165 occurrences) and `border-neutral-600` (147) dominating over `border-neutral-800` (22) | Common Pitfalls (Pitfall 4), Code Examples | Medium — picking the wrong consolidated shade changes the visual weight of every border/ring in the app; this is explicitly a D-16-governed "shade drift is OK, polarity/other properties are not" case, so the risk is aesthetic, not a hard regression, but should be confirmed against the actual current dominant value (not the raw occurrence count, which weights small icon borders same as large card borders) before locking `volt-dark.css` |
| A3 | Package identity/choice of Playwright over Puppeteer (both npm-registry-confirmed `[VERIFIED]` this session, but discovered via training knowledge, not Context7 — Context7 was unavailable per the invocation's environment notes) | Standard Stack, Package Legitimacy Audit | Low — both are legitimate, actively maintained Microsoft/community tools; wrong choice costs a swap of devDependency, not a rewrite |
| A4 | Exact hex values for `success`/`warning`/`danger`/`info`/`surfaceInverseElevated`/`mutedOnInverse`/`borderInverse` in the Code Examples `getThemeTokens()` skeleton are placeholders, not confirmed against every current usage site | Code Examples | Medium — these are exactly the values CONTEXT.md marks "Claude's Discretion"; the planner/executor must derive them from the actual dominant shade during the sweep (per D-15's "semantic first, consolidate aggressively" rule), not copy the skeleton's placeholder values verbatim |
| A5 | `on-primary` and `warning` values in the same skeleton are unresolved discretion calls (white vs black text on primary; amber vs yellow) | Code Examples, User Constraints | Low — explicitly flagged as open in CONTEXT.md; no plan should treat these as locked without a decision recorded in the chunk's screenshot manifest per D-19 |

**If this table is empty:** N/A — five assumptions logged above, all low-to-medium risk and all pre-flagged as open discretion items in CONTEXT.md except A1 and A2, which are corrections/refinements this session's verification surfaced.

## Open Questions

1. **Exact consolidated `border`/`ring` hex value**
   - What we know: `border-neutral-700` and `border-neutral-600` dominate by raw occurrence count in this session's grep; CONTEXT.md speculated `neutral-800`.
   - What's unclear: Raw occurrence count doesn't weight by visual prominence (a 1px card border vs a small icon divider count equally); the actual pixel-dominant border color needs eyeballing a handful of screenshots, not just grep counts.
   - Recommendation: Resolve during chunk 1 (the no-op relocation) — pick the shade, render the before/after screenshot pair, and lock it in `05-SCREENSHOTS.md`'s intentional-snap notes before chunk 2 starts consuming the token.

2. **`StoreConfig.theme` shape after `NEXT_PUBLIC_THEME_PRIMARY` removal**
   - What we know: `logoPath` must keep resolving unchanged; CONTEXT.md leaves "shim vs drop" other fields (`mode`, `primary`, `surface`, `surfaceElevated`, `foreground`, `mutedForeground`) to the planner.
   - What's unclear: Whether any other code outside the theme system reads `getStoreConfig().theme.primary`/`.surface`/etc. beyond what this session found (`app/layout.tsx`'s soon-to-be-deleted inline style block was the only other reader found this session besides `lib/store-config.ts` itself).
   - Recommendation: Grep for `.theme.primary`, `.theme.surface`, `.theme.foreground`, `.theme.mutedForeground`, `.theme.surfaceElevated`, `.theme.mode` across the tree as a Wave 0 task before deciding shim-vs-drop; this session's scope did not exhaustively confirm zero other readers exist.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js (via mise) | All project commands | ✓ (system Node also present) | Project requires `>=24.18.1 <25` `[VERIFIED: package.json engines]`; system `node --version` reported `v26.7.0` this session — use `mise exec --` for every command per the invocation's environment notes, not the bare system Node | — |
| Playwright + Chromium | Screenshot capture (TOKEN-02/TOKEN-05) | ✗ (not installed) | `1.62.1` current on npm | None viable — must install; `chrome-cdp` skill is explicitly non-repeatable per CONTEXT.md |
| Vitest | Unit test verification | ✓ | `4.1.10` `[VERIFIED: package.json]` | — |
| ESLint / tsc | Lint/typecheck gates | ✓ | `eslint ^9.36.0`, `typescript ^6.0.3` `[VERIFIED: package.json]` | — |

**Missing dependencies with no fallback:**
- Playwright — must be installed this phase; no existing tool in the repo can drive multi-viewport, multi-state screenshot capture repeatably.

**Missing dependencies with fallback:**
- None — the one missing dependency has no viable fallback per the stated constraints (repeatability for Phase 8).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Phase touches no auth logic |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | No | This phase changes only static class names, CSS files, and a typed constants module — no new user input surface |
| V6 Cryptography | No | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| N/A — this phase is a pure styling/markup refactor with no new data flow, no new external input, and no change to auth/session/crypto surfaces | — | The only "security-adjacent" consideration is that `getThemeTokens()` values eventually reach a `"use client"` component (`StripeProvider.tsx`) — these are static, non-secret color/shape values (not credentials or PII), so no data-exposure concern applies |

## Sources

### Primary (HIGH confidence — direct repo/registry verification this session)
- `tailwind.config.ts` (full file, all 32 lines)
- `app/globals.css` (full file)
- `app/layout.tsx` (full file, lines 132-144 and 126 cited)
- `lib/store-config.ts` (lines 1-140, 380-430; theme type at 54-62, defaults at 114-122, env override at 418-426)
- `package.json` (scripts and full dependency/devDependency blocks)
- `vitest.config.ts` (full file)
- `.gitignore` (first 30 lines)
- `components/checkout/StripeProvider.tsx`, `app/global-error.tsx`, `components/cart/CartDrawer.tsx`, `components/agent/AgentDrawer.tsx`, `lib/utils/image-placeholders.ts`, `lib/types/mach/Promotion.ts`, `scripts/check-deploy-config.mjs`, `scripts/build-with-public-env.mjs`, `docs/runtime-configuration.md` (Theme row), `lib/store/StoreConfigProvider.tsx` (full files/relevant excerpts read this session)
- `node_modules/tailwindcss/theme.css` (lines 397-404, 508) — verified installed-package default radius values, correcting a WebSearch snippet
- `npm view playwright version`, `npm view @playwright/test version`, `npm view tailwindcss version`, `npm view next version` (registry checks, this session, 2026-09-03)
- `gsd_run query package-legitimacy check --ecosystem npm playwright @playwright/test` (both `OK`, this session)
- This session's whole-tree `grep -rEIn` passes across `app/`, `components/`, `lib/` for hex literals, `rgb()/hsl()` literals, raw Tailwind palette utilities, inline `style={{` color props, and SVG `fill=`/`stroke=` attributes (all commands and counts reproduced in Common Pitfalls)

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md`, `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md` (prior research session, 2026-09-02) — build order, Pitfalls 1/4/5/6, Anti-Patterns 1/2/3; independently corroborated by this session's fresh greps rather than re-verified against Context7 (unavailable this session)
- WebSearch: Tailwind CSS v4 default border-radius values — used only to prompt the direct-source check; the search result itself was inaccurate for `rounded-sm` and is NOT used as a cited value (superseded by the `[VERIFIED]` `node_modules` read)

### Tertiary (LOW confidence)
- None used as load-bearing for any claim in this document

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies except Playwright, which is registry-verified and legitimacy-gate-passed; every existing-stack claim is a direct file read
- Architecture: HIGH — every pattern is grounded in a file this session actually opened, with line-range citations
- Pitfalls: HIGH for codebase-specific counts (this session's own greps), MEDIUM for general "shadows/overlays under a future light theme" guidance carried from the prior research pass (not re-verified, since no light preset exists yet to test against — correctly deferred to Phase 6 per ROADMAP.md)

**Research date:** 2026-09-03
**Valid until:** Effectively permanent for the codebase-fact claims (file contents don't change until this phase modifies them); 30 days for the Playwright version pin before re-checking `npm view`
