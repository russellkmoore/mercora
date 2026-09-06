# Phase 5 — Token Map (frozen sweep contract)

**Authored:** 2026-09-03 by the planner, from CONTEXT.md D-01..D-21 plus this session's
measured shade counts across `app/ components/ lib/` excluding `admin/`.

> **This file is the single source of truth for the sweep.** Every sweep plan lists it in
> `<read_first>`. Class-name literals live here, not in plan `<action>` bodies, so the
> comment-text discipline gate stays clean.

---

## 1. The 23-token contract (D-01, frozen, one-way)

CSS custom properties keep the `--store-` prefix (D-07). Tailwind class names are
unprefixed. **The prefix is load-bearing, not cosmetic:** Tailwind v4.3.3 defines its own
`--radius-sm/md/lg/xl` and `--font-sans` in `node_modules/tailwindcss/theme.css` (lines
397-404, 2-6). Bare property names would collide with the framework's own theme layer.
Where RESEARCH.md Pattern 1 shows bare `--primary`, D-07 and this collision override it.

| # | Token | CSS custom property | Tailwind class stem | `volt-dark` value | Provenance |
|---|-------|---------------------|---------------------|-------------------|------------|
| 1 | primary | `--store-primary` | `primary` | `#f97316` | `lib/store-config.ts:116` |
| 2 | on-primary | `--store-on-primary` | `on-primary` | `#000000` | see §4 snap S1 |
| 3 | surface | `--store-surface` | `surface` | `#000000` | `lib/store-config.ts:117` |
| 4 | surface-elevated | `--store-surface-elevated` | `surface-elevated` | `#171717` | `lib/store-config.ts:118` |
| 5 | foreground | `--store-foreground` | `foreground` | `#ffffff` | `lib/store-config.ts:119` |
| 6 | muted-foreground | `--store-muted-foreground` | `muted-foreground` | `#a3a3a3` | `lib/store-config.ts:120` |
| 7 | border | `--store-border` | `border` | `#404040` | see §4 snap S2 |
| 8 | ring | `--store-ring` | `ring` | `#404040` | see §4 snap S3 |
| 9 | success | `--store-success` | `success` | `#22c55e` | see §4 snap S4 |
| 10 | warning | `--store-warning` | `warning` | `#f59e0b` | see §4 snap S5 |
| 11 | danger | `--store-danger` | `danger` | `#ef4444` | see §4 snap S6 |
| 12 | info | `--store-info` | `info` | `#3b82f6` | see §4 snap S7 |
| 13 | surface-inverse | `--store-surface-inverse` | `surface-inverse` | `#fdfdfb` | D-05, both drawers |
| 14 | surface-inverse-elevated | `--store-surface-inverse-elevated` | `surface-inverse-elevated` | `#f3f4f6` | see §4 snap S8 |
| 15 | on-inverse | `--store-on-inverse` | `on-inverse` | `#000000` | D-05, both drawers |
| 16 | muted-on-inverse | `--store-muted-on-inverse` | `muted-on-inverse` | `#6b7280` | see §4 snap S9 |
| 17 | border-inverse | `--store-border-inverse` | `border-inverse` | `#374151` | see §4 snap S10 |
| 18 | radius-sm | `--store-radius-sm` | `rounded-sm` | `0.25rem` | `node_modules/tailwindcss/theme.css:398` |
| 19 | radius-md | `--store-radius-md` | `rounded-md` | `0.375rem` | `node_modules/tailwindcss/theme.css:399` |
| 20 | radius-lg | `--store-radius-lg` | `rounded-lg` | `0.5rem` | `node_modules/tailwindcss/theme.css:400` |
| 21 | radius-xl | `--store-radius-xl` | `rounded-xl` | `0.75rem` | `node_modules/tailwindcss/theme.css:401` |
| 22 | font-sans | `--store-font-sans` | `font-sans` | Geist sans stack (§5) | `app/globals.css:12-15` |
| 23 | font-display | `--store-font-display` | `font-display` | Geist sans stack (§5) | discretion; A1 — no display face is loaded |

`getThemeTokens()` in `lib/themes/tokens.ts` returns the same 23 values under camelCase keys
(`primary`, `onPrimary`, `surface`, `surfaceElevated`, `foreground`, `mutedForeground`,
`border`, `ring`, `success`, `warning`, `danger`, `info`, `surfaceInverse`,
`surfaceInverseElevated`, `onInverse`, `mutedOnInverse`, `borderInverse`, `radiusSm`,
`radiusMd`, `radiusLg`, `radiusXl`, `fontSans`, `fontDisplay`).

---

## 2. Substitution table — MAIN token set (dark surfaces)

Applies to every storefront surface **except** the two drawers, Stripe Elements, and email
HTML (§3). Role beats shade (D-15): pick the token by what the element *is*, then confirm
against this table.

| Current class family | Replacement | Notes |
|---|---|---|
| `bg-black`, `bg-neutral-950` | `bg-surface` | page/base background |
| `bg-neutral-900`, `bg-neutral-800` | `bg-surface-elevated` | cards, panels, raised chrome |
| `bg-neutral-700` | `bg-surface-elevated` when a raised chip; `bg-border` when it reads as a filled divider/track | role call |
| `text-white`, `text-neutral-100`, `text-neutral-200`, `text-gray-100`, `text-gray-200` | `text-foreground` | on dark surfaces only |
| `text-neutral-300/400/500/600`, `text-gray-300/400/500/600` | `text-muted-foreground` | secondary copy on dark |
| `border-neutral-600/700/800`, `border-gray-500`, `border-white/*` | `border-border` | |
| `ring-orange-500`, existing `ring-ring` | `ring-ring` | `ring-ring` already resolves; keep the name |
| `bg-orange-500` | `bg-primary` | |
| `hover:bg-orange-400` | `hover:bg-primary/90` | lighter hover → reduced alpha |
| `hover:bg-orange-600`, `hover:bg-orange-700` | `hover:bg-primary/80` | darker hover → reduced alpha |
| `text-orange-300/400/500/600` | `text-primary` | |
| `hover:text-orange-300/400/500/700` | `hover:text-primary/90` | |
| `border-orange-500`, `border-orange-800` | `border-primary` | |
| `text-black` **on an orange background** | `text-on-primary` | |
| `text-white` **on an orange background** | `text-on-primary` | flips white→black; snap S1 |
| `bg-green-*`, `text-green-*`, `border-green-*`, `text-emerald-*` | `bg-success` / `text-success` / `border-success` | |
| `bg-red-*`, `text-red-*`, `border-red-*` | `bg-danger` / `text-danger` / `border-danger` | |
| `bg-amber-*`, `text-amber-*`, `bg-yellow-*`, `text-yellow-*`, `border-amber-*` | `bg-warning` / `text-warning` / `border-warning` | |
| `bg-blue-*`, `text-blue-*` | `bg-info` / `text-info` | |
| `bg-green-950`, `bg-red-950`, `bg-amber-950`, `bg-red-50` and similar tinted panels | `bg-{status}/10` | keep the tint, drive it from the token |
| `rounded-sm`, bare `rounded` | `rounded-sm` | now token-driven; class text unchanged |
| `rounded-md` / `rounded-lg` / `rounded-xl` | unchanged | now token-driven |
| `rounded-full`, `rounded-r`, `rounded-tl`, `rounded-none` | unchanged | stay raw Tailwind (D-04) |

## 2b. Substitution table — dead shadcn vocabulary (D-17 + RESEARCH Pitfall 2)

These classes reference CSS variables that were never defined in this codebase; they render
nothing today. Rewriting them makes hover/focus/selected states visible for the first time —
that is expected and is **not** a regression. Rewrite in place in each `components/ui/*`
source file. Do not add a Tailwind alias layer.

| Dead class | Replacement |
|---|---|
| `bg-accent` / `hover:bg-accent` / `focus:bg-accent` / `data-[state=open]:bg-accent` / `dark:hover:bg-accent` | `bg-surface-elevated` (same modifier preserved) |
| `text-accent-foreground` / `hover:text-accent-foreground` / `focus:text-accent-foreground` | `text-foreground` |
| `bg-muted` / `hover:bg-muted` | `bg-surface-elevated` |
| `bg-secondary` / `hover:bg-secondary` | `bg-surface-elevated` |
| `text-secondary` / `text-secondary-foreground` | `text-foreground` |
| `bg-card` / `text-card-foreground` | `bg-surface-elevated` / `text-foreground` |
| `bg-popover` / `text-popover-foreground` | `bg-surface-elevated` / `text-foreground` |
| `bg-background` | `bg-surface` |
| `bg-input` / `dark:bg-input` / `dark:hover:bg-input` | `bg-surface-elevated` (same modifier) |
| `border-input` / `dark:border-input` | `border-border` |
| `bg-destructive` / `hover:bg-destructive` / `focus:bg-destructive` / `dark:bg-destructive` | `bg-danger` (same modifier) |
| `text-destructive` | `text-danger` |
| `ring-destructive` / `focus-visible:ring-destructive` / `aria-invalid:ring-destructive` / `dark:aria-invalid:ring-destructive` / `dark:focus-visible:ring-destructive` | `ring-danger` (same modifier) |
| `border-destructive` / `aria-invalid:border-destructive` | `border-danger` (same modifier) |
| `text-primary-foreground` / `bg-primary-foreground` | `text-on-primary` / `bg-on-primary` |
| `text-muted-foreground` | **unchanged** — now a real token |
| `text-text-secondary` (in `app/order-status/[id]/page.tsx`) | `text-muted-foreground` |
| `bg-primary`, `text-primary`, `border-primary` | **unchanged** — already real |

Opacity suffixes survive substitution verbatim: `bg-destructive/60` becomes `bg-danger/60`,
`ring-destructive/20` becomes `ring-danger/20`.

---

## 3. Substitution table — INVERSE token set (light panels on a dark app)

**Applies to exactly four surface groups and nothing else:**
`components/cart/CartDrawer.tsx`, `components/cart/CartItemCard.tsx`,
`components/agent/AgentDrawer.tsx`, `components/agent/ProductCard.tsx`,
`components/checkout/StripeProvider.tsx` (via `getThemeTokens()`), and the six email
builders (§3b).

**`app/global-error.tsx` uses the MAIN set, not this one** — RESEARCH Pitfall 4. Its current
background is `#171717`, matching `surfaceElevated`. Mapping it to the inverse set would flip
the error page dark→light, the exact polarity regression D-16 forbids.

| Current | Replacement |
|---|---|
| `bg-[#fdfdfb]` | `bg-surface-inverse` |
| `bg-white`, `bg-gray-50` (inside a drawer) | `bg-surface-inverse` |
| `bg-gray-100`, `bg-gray-200`, `bg-neutral-100`, `bg-neutral-200` (inside a drawer) | `bg-surface-inverse-elevated` |
| `text-black`, `text-gray-800`, `text-gray-900` | `text-on-inverse` |
| `text-gray-400/500/600/700` (inside a drawer) | `text-muted-on-inverse` |
| `border-gray-300`, `border-gray-700`, `border-neutral-800` (on a drawer panel) | `border-inverse` |
| `text-white` on a dark chip **inside** a light drawer | `text-foreground` — the chip is still a MAIN-set surface |

### 3b. Email + Stripe hex mapping (D-10, D-11)

Mail clients and the Stripe Elements iframe cannot read CSS custom properties. Both read hex
from `getThemeTokens()`.

| Role in the current HTML/config | `getThemeTokens()` field |
|---|---|
| page background (`#f6f9fc`) | `surfaceInverse` |
| card / section background (`#ffffff`, `#f1f5f9`) | `surfaceInverseElevated` |
| body + heading text (`#1e293b`, `#000000`) | `onInverse` |
| muted / secondary text (`#64748b`, `#374151`) | `mutedOnInverse` |
| dividers and input borders (`#e2e8f0`, `#e6ebf1`, `#d1d5db`) | `borderInverse` |
| brand accent, buttons, focus border (`#f97316`) | `primary` |
| button label on the brand accent | `onPrimary` |
| error / invalid state (`#ef4444`) | `danger` |

---

## 4. Intentional shade snaps (D-15 consolidation record)

Each row is a deliberate, recorded consolidation. Copy this list into `05-SCREENSHOTS.md`'s
chunk-1 entry, then reference it from every later chunk entry.

| ID | Snap | Evidence | Visible effect |
|----|------|----------|----------------|
| S1 | `on-primary` = `#000000`; the 6 `text-white`-on-orange call sites flip to black | 10 `text-black` vs 6 `text-white` paired with `bg-orange-500`; the Sonner toaster already uses black; contrast on `#f97316` is ~7.4:1 black vs ~2.8:1 white | 6 button/badge labels change from white to black |
| S2 | `border` = `#404040` (was the config's own darker hex) | `border-neutral-700` 56 uses vs `border-neutral-800` 18 vs `border-neutral-600` 12 | borders across the app become very slightly lighter |
| S3 | `ring` = `#404040`, same as `border` | today's ring hex sits between neutral-800 and neutral-700 and is near-invisible on `#171717` | focus rings become marginally more visible |
| S4 | `success` = `#22c55e` (green-500) | usage spans green-300/400/500/600/700 with no dominant shade; 500 is the midpoint that reads on `#000000` | green text/badges converge on one shade |
| S5 | `warning` = `#f59e0b` (amber-500) | amber 11 uses vs yellow 8; amber-500 holds 8.6:1 on `#000000` | amber and yellow converge |
| S6 | `danger` = `#ef4444` (red-500) | `bg-red-500` is the most common red background | red text/badges converge |
| S7 | `info` = `#3b82f6` (blue-500) | `bg-blue-500` 8 uses is the dominant blue | processing status, promo variant, agent bubble converge |
| S8 | `surface-inverse-elevated` = `#f3f4f6` (gray-100) | `bg-gray-100` is the drawer's raised-card class; `bg-neutral-100` (`#f5f5f5`) in `CartItemCard.tsx` snaps to it | drawer raised cards converge |
| S9 | `muted-on-inverse` = `#6b7280` (gray-500) | drawer muted text spans gray-400..700; 500 is the midpoint | drawer secondary copy converges |
| S10 | `border-inverse` = `#374151` (gray-700), per D-05's explicit enumeration | D-05 locks `border-inverse` to cover `border-gray-700`/`border-neutral-800`; D-10 also routes email dividers here | **email dividers darken noticeably** — flagged for human review on the email chunk |
| S11 | `global-error.tsx` button background moves from its current hover-darkened orange to base `primary` | RESEARCH Pitfall 4 | error-page button becomes slightly brighter orange |

---

## 5. Font stack

Both `--store-font-sans` and `--store-font-display` resolve to the same stack under
`volt-dark` (no display face is loaded anywhere — RESEARCH Assumption A1):

`var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

`app/globals.css`'s static `.font-sans` rule currently owns this stack directly. It is
replaced by the token indirection so the Tailwind `font-sans` utility and the CSS class agree
on one source. `.font-mono` is **not** part of the contract and stays exactly as it is.

---

## 6. Scan scope and the exception registry

`scripts/scan-hardcoded-colors.mjs` walks `app/`, `components/`, `lib/`, `themes/`, and
`tailwind.config.ts` over `.ts`, `.tsx`, and `.css`.

**Hex is legal only in the theme source of truth:** `themes/*.css` and `lib/themes/tokens.ts`.
Every other file in scope must be free of it.

**Path exclusion (D-14, the only one):** `app/admin/**` and `components/admin/**`.

**Region exclusion:** the `.admin-*` block inside `app/globals.css`, delimited by the sentinel
comments `gsd:scan-ignore-start` / `gsd:scan-ignore-end` that the tracer plan adds around it.
Sentinels are parsed **before** comment stripping.

**Comment stripping:** `//` line comments, `/* */` block comments, and JSDoc are stripped
before matching. This is what keeps `lib/utils.ts`'s `cn()` JSDoc examples, the decoded-SVG
reference comment in `lib/utils/image-placeholders.ts`, and the shade annotations in the
admin CSS block from registering as findings. It is comment hygiene, not an allowlist.

**Manual-review registry (printed on every run, including clean runs):** these two files carry
a palette value the regex cannot see or must not own. The script prints them as
`MANUAL-REVIEW` rows so no clean result is ever silent (RESEARCH Pitfall 3).

| File | Reason | Disposition |
|---|---|---|
| `lib/utils/image-placeholders.ts` | The two `blurDataURL` constants are base64 data URIs; the palette values are inside the encoded payload where no text scan can reach. A data URI can never read a CSS custom property, so no theme can make it correct without a build-time regeneration step that does not exist until Phase 6 at the earliest. Regenerating it now would hardcode one theme's value with no mechanism to update it. | Left as-is, registered, printed every run |
| `lib/types/mach/Promotion.ts` | The single hex is `highlight_color` inside an example promotion fixture — merchant-authored per-promotion display data, not app chrome. A theme must not dictate promotion badge colours. | Left as-is, registered, printed every run |

---

## 7. Chunk → plan map (D-18 order preserved)

| D-18 chunk | Plans | Wave |
|---|---|---|
| — (tooling) | 05-01, 05-02 | 1, 2 |
| 1 — contract + relocation, pure no-op | 05-03 (tracer) | 3 |
| 2 — shared shell | 05-04, 05-05 | 4, 5 |
| 3 — home + category + product | 05-06, 05-07, 05-08 | 6, 7, 8 |
| 4 — cart + checkout + drawers + Stripe | 05-09, 05-10 | 9, 10 |
| 5 — account + order-status + emails + error + Clerk | 05-11, 05-12 | 11, 12 |

Chunks run strictly in order (D-18) and every plan appends to `05-SCREENSHOTS.md`, so the
waves are serial by construction. Each plan is one branch, one PR (D-18); the phase overrides
the project's `branching_strategy: none` for its duration, using one branch per plan named
`phase-05/<plan-number>-<slug>`.

---

## 8. Screenshot coverage (D-19, D-20, D-21)

Routes: `/` (home), `/category/<slug>`, `/product/<slug>`, cart (home with the cart drawer
open — there is no `/cart` route), `/checkout`, `/account`, `/order-status/<id>`.
Viewports: desktop 1280px, mobile 390px. States: resting + one open interactive state.
Images land in the git-ignored `.screenshots/` and are never committed. The "before" baseline
is captured once in 05-02 from pre-sweep `main` and every chunk diffs against it (D-21).

`scripts/screenshot-routes.mjs` resolves the product/category/blog slugs from the store's own
`/sitemap.xml`. `/order-status/<id>` needs a real order id: pass `--order-id <id>`; without
one the script records an explicit `MISSING` row in the manifest and exits non-zero unless
`--allow-missing` is passed. It never silently omits a route.
