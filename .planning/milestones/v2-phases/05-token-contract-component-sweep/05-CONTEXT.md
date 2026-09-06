# Phase 5: Token Contract & Component Sweep - Context

**Gathered:** 2026-09-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Freeze the storefront token contract, wire every token through `runtimeColor()` in `tailwind.config.ts`, relocate the current look verbatim into `themes/volt-dark.css` as a `[data-theme="volt-dark"]` block stamped on `<html>` server-side, and sweep every storefront component, page template, and theme-bearing surface (drawers, Stripe Elements, Clerk, Sonner, error page, transactional emails) to the contract. Admin (`app/admin/**`, `components/admin/**`, the `.admin-*` classes in `globals.css`) is excluded and keeps its hardcoded palette. `NEXT_PUBLIC_THEME_PRIMARY` is removed; `logoPath` stays in store-config.

Not in this phase: the theme scanner/validator, generated manifest, `getActiveTheme()`, admin Appearance UI, second/light presets (Phase 6); layout switches (Phase 7); `docs/theming.md` and the presets x layouts QA matrix (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Token contract (frozen at 23 tokens)
- **D-01:** The contract is the seed's ~18 tokens plus five decided here. Final list — **Reversibility:** one-way — every theme file, the Phase 6 validator, and hundreds of swept class names depend on these exact names; renaming after the sweep is the highest-regression mistake the research identified.
  - Colors, main: `primary`, `on-primary`, `surface`, `surface-elevated`, `foreground`, `muted-foreground`, `border`, `ring`, `success`, `warning`, `danger`, `info`
  - Colors, inverse: `surface-inverse`, `surface-inverse-elevated`, `on-inverse`, `muted-on-inverse`, `border-inverse`
  - Shape: `radius-sm`, `radius-md`, `radius-lg`, `radius-xl`
  - Type: `font-sans`, `font-display`
- **D-02:** Every token is required in every theme file. No optional tokens, no `var(--x, var(--y))` fallbacks. Phase 6's validator treats a missing token as a build failure, full stop. — **Reversibility:** costly — relaxing later means a required/optional split in the validator and two ways to express the same look.
- **D-03:** `info` exists because blue is used for the "processing" order status (`components/OrderCard.tsx`), one promotional banner variant, and the agent chat bubble. The status quartet is `success` / `warning` / `danger` / `info`.
- **D-04:** `radius-xl` is added so card corners are themeable. Mapping: `rounded-sm` and bare `rounded` → `radius-sm`; `rounded-md` → `radius-md`; `rounded-lg` → `radius-lg`; `rounded-xl` → `radius-xl`. `rounded-full` and the directional variants (`rounded-r`, `rounded-tl`, `rounded-none`) stay as raw Tailwind utilities. `volt-dark` sets the four radius tokens to today's Tailwind default values so nothing moves.

### Inverted light panels (cart drawer, agent drawer)
- **D-05:** `components/cart/CartDrawer.tsx` and `components/agent/AgentDrawer.tsx` keep their light-on-dark look through the inverse token set, not by folding into `surface-elevated` and not as a hardcoded exception. Under `volt-dark`, `surface-inverse` is `#fdfdfb`, `on-inverse` is black, `surface-inverse-elevated` covers the `bg-gray-100/200` raised cards, `muted-on-inverse` covers the `text-gray-400..900` range, `border-inverse` covers `border-gray-700` / `border-neutral-800`. — **Reversibility:** costly — five tokens are part of the frozen contract (D-01).
- **D-06:** The inverse set mirrors the main set on purpose so a theme author sees a symmetric contract and a light preset can flip the drawers to dark panels.

### Class naming
- **D-07:** Swept code uses unprefixed Tailwind classes only: `bg-surface`, `text-foreground`, `bg-primary`, `text-on-primary`, `bg-surface-inverse`, `border-border`, `ring-ring`, `bg-info`, `rounded-md` (mapped to `radius-md`). The `store-*` color group and the `background` alias in `tailwind.config.ts` are deleted. CSS custom properties keep the `--store-*` prefix under the hood. — **Reversibility:** costly — every swept file spells classes this way; the whole-tree scan relies on "any raw palette class is a stray".

### Sweep boundary — what is IN
- **D-08:** Transactional email templates are swept, not excluded: `lib/fulfillment/shipping-email.ts`, `lib/payments/refund-email.ts`, `lib/utils/review-notifications.ts`, and any other inline-styled HTML email. Mail clients cannot read CSS variables, so emails receive hex values.
- **D-09:** A typed token source, `lib/themes/tokens.ts` exporting `getThemeTokens()`, returns the `volt-dark` values as a typed constant in Phase 5. Emails, Stripe, Clerk, and `global-error.tsx` read from it. Phase 6 replaces its body to read the generated manifest for the active theme; callers never change again. — **Reversibility:** reversible — one function with one call-site contract.
- **D-10:** Emails map to `primary` plus the inverse set: page background = `surface-inverse`, card background = `surface-inverse-elevated`, body text = `on-inverse`, muted text = `muted-on-inverse`, dividers = `border-inverse`, brand accent and buttons = `primary` / `on-primary`. Emails stay light under `volt-dark`; no email-specific tokens.
- **D-11:** Stripe Elements (`components/checkout/StripeProvider.tsx`) gets its `appearance` values from `getThemeTokens()` using the same mapping as emails (`primary`, `surface-inverse`, `on-inverse`, `border-inverse`, `danger`). The payment form stays light under `volt-dark`. Values reach the client component through the existing `StoreConfigProvider` or a server prop; planner chooses.
- **D-12:** Sonner's toaster `className` in `app/layout.tsx` becomes token classes (`bg-primary/80 text-on-primary`). Clerk keeps `baseTheme: dark` but sets `variables` (`colorPrimary`, `colorBackground`, `colorText`, and whatever else Clerk exposes for surfaces/borders) from `getThemeTokens()`.
- **D-13:** `app/global-error.tsx` renders without `globals.css` or the theme file, so its inline styles import hex from `getThemeTokens()` rather than being listed as an exception. The scan needs no exclusions entry for it.

### Sweep boundary — what is OUT
- **D-14:** Admin stays hardcoded: `app/admin/**`, `components/admin/**`, and the `.admin-*` rules in `app/globals.css`. The scan excludes these paths explicitly and that exclusion is the only path-based exclusion in the storefront tree.

### Color mapping rules
- **D-15:** Semantic first, and consolidate aggressively. The sweep chooses each token by role (text on an orange element = `on-primary`; text on `surface` = `foreground`; text on a light panel = `on-inverse`; secondary copy = `muted-foreground` / `muted-on-inverse`) and collapses the current `neutral-*` / `gray-*` / `orange-*` shade ladder to the fewest shades the contract offers. Close-enough snaps (e.g. `gray-300` → `muted-foreground` `#a3a3a3`, `orange-600` hover → `primary` at reduced opacity or a darker computed value) are expected and are not regressions. Russell's words: "consolidate to the least viable number of shades — as long as it is pretty close I don't mind standardizing."
- **D-16:** What is still a regression: layout, spacing, typography size/weight, opacity/overlay treatment, shadow treatment, and the light-vs-dark polarity of any surface. Success criterion 1 ("renders identically") is read as "no change outside shade consolidation"; each chunk's screenshot manifest lists its intentional snaps.
- **D-17:** shadcn primitives in `components/ui/*` are rewritten to the contract, not aliased and not deleted: `bg-accent` / `bg-muted` → `bg-surface-elevated`, `text-accent-foreground` → `text-foreground`, `bg-destructive` / `text-destructive` → `bg-danger` / `text-danger`, `text-muted-foreground` stays (now a real token), `text-text-secondary` in `app/order-status/[id]/page.tsx` → `text-muted-foreground`. These classes render nothing today, so hover/focus states in dropdowns, navigation menu, select, table stripes, and buttons will become visible for the first time. Those components get their own before/after screenshots.

### Screenshots & PR cadence
- **D-18:** Phase 5 runs on branches: one branch per sweep chunk, each merged to main by PR. Chunks, in order: (1) contract + `tailwind.config.ts` + `themes/volt-dark.css` relocation as a pure no-op, (2) shared shell: `app/layout.tsx`, `Header`/`HeaderClient`, `Footer`, `PromotionalBanner`, `components/ui/*`, (3) home + category + product, (4) cart + checkout + both drawers + Stripe, (5) account + order-status + emails + `global-error.tsx` + Clerk. Planner may split a chunk further but not merge chunks. The project's `branching_strategy: none` is overridden for this phase; the planner records how (phase-branch template or per-plan branches).
- **D-19:** Screenshot images live in a git-ignored folder (`.screenshots/` at repo root). Each chunk adds an entry to `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` listing route, viewport, state, file path, content hash, and the intentional shade snaps for that chunk. Images are never committed.
- **D-20:** Coverage per route, per chunk: desktop 1280px and mobile 390px, resting page plus one open interactive state (cart drawer open, nav menu open, product gallery, checkout form focused, account menu). Routes: home, category, product, cart, checkout, account, order-status.
- **D-21:** The "before" baseline is captured once from main before chunk 1 merges and reused for every chunk's diff. Diffs are against the pre-sweep baseline, not PR-to-PR.

### Claude's Discretion
- **Capture tooling.** Russell chose "you decide." Constraints: repeatable enough that Phase 8 reruns it across presets x layouts, adds nothing to the Worker bundle or the deploy path, and can drive the open interactive states in D-20. A Playwright devDependency with `scripts/screenshot-routes.mjs` is the obvious fit; the planner may pick differently if it meets the constraints.
- **`on-primary` value under `volt-dark`.** Today orange buttons use both `text-white` and `text-black` (toaster). Pick one for the token and consolidate; record the snap in the manifest.
- **`font-display` face under `volt-dark`.** Only two `font-display` uses exist and no display font is loaded. Default to the same Geist stack as `font-sans` unless the planner finds a loaded display face.
- **`warning` source shade.** `amber-*` (11 uses) and `yellow-*` (7 uses) both collapse to `warning`; pick the shade that keeps contrast on `surface`.
- **`ring` / `border` values.** Move `#2a2a2a` and `#333333` out of `tailwind.config.ts` into `volt-dark`; if the sweep finds most borders are actually `neutral-800` (`#262626`), consolidate to one value per D-15.
- **`StoreConfig.theme` shape.** After `NEXT_PUBLIC_THEME_PRIMARY` is removed the `theme` block only needs `logoPath` (mode already folds into the theme file per PROJECT.md). Planner decides whether to keep the other fields as a compatibility shim through Phase 6 or drop them now, as long as `getStoreConfig().theme.logoPath` resolves unchanged and no storefront code reads `theme.primary` any more.
- **Header Suspense fallback** (`bg-neutral-900` in `app/layout.tsx`) and the `#f97316` focus outline in `globals.css` are ordinary sweep targets; pick the token by role.
- **`lib/utils/image-placeholders.ts`** SVG fill `#373741`: treat as a sweep target (`surface-elevated`) unless the placeholder must stay theme-neutral for caching reasons; document either way.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and locked decisions
- `.planning/ROADMAP.md` §Phase 5 — goal, five success criteria, "UI hint: yes"
- `.planning/REQUIREMENTS.md` — TOKEN-01..05 (this phase); THEME-01/02 for what Phase 6 will build on top of `getThemeTokens()`
- `.planning/PROJECT.md` §Current Milestone: v2 Themeable Storefront — the seven locked v2 decisions (registry, deploy-per-theme, no cache, mode folds into theme, no per-theme markup, admin excluded)
- `MILESTONE-SEED.md` (repo root, untracked, may be deleted per its own header) — original phase breakdown and the seed token list; its decisions are already copied into PROJECT.md

### Research
- `.planning/research/SUMMARY.md` — build order (contract → no-op relocation → sweep, strictly sequential), Pitfall 4 (hardcodes outside className), Pitfall 5 (shadows/overlays), Pitfall 6 (dead shadcn classes)
- `.planning/research/PITFALLS.md` — full pitfall detail for the sweep
- `.planning/research/ARCHITECTURE.md` — `data-theme` on `<html>` + CSS-cascade-only resolution pattern; "Build Order" section

### Code the phase modifies or must respect
- `tailwind.config.ts` — `runtimeColor()` helper to extend; the `store.*` group and `background` alias to delete; `border`/`ring` hex to delete
- `app/layout.tsx` §RootLayout — inline `--store-*` body vars to relocate; Clerk `appearance`, Sonner `toastOptions.className`, Header fallback
- `app/globals.css` — `@config` import point for the theme barrel; `.admin-*` rules are excluded from the sweep
- `lib/store-config.ts` §theme (lines 54-62, 114-122, 420-423) — `NEXT_PUBLIC_THEME_PRIMARY` read to remove; `logoPath` to keep
- `docs/runtime-configuration.md` §Theme row — lists `NEXT_PUBLIC_THEME_PRIMARY`; must be updated when the var is removed
- `.planning/codebase/CONVENTIONS.md` — ESLint-only formatting, `.mjs` for scripts, JSDoc style

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runtimeColor()` in `tailwind.config.ts`: the `rgb(from var(--x) r g b / <alpha-value>)` helper already gives opacity modifiers on token classes; extend to all 17 color tokens rather than replace.
- `StoreConfigProvider` (`lib/store`): server-to-client config channel already wraps the tree; a natural carrier for `getThemeTokens()` values into `StripeProvider` if the planner wants to avoid a new prop.
- `scripts/*.mjs` convention (`build-with-public-env.mjs`, `check-deploy-config.mjs`): zero-dependency plain-`.mjs` scripts; a screenshot script follows this shape.
- `components/ui/*` (19 shadcn primitives): already class-driven; once their dead classes are rewritten they become the cheapest tokenized surfaces in the tree.

### Established Patterns
- CSS variables are already the theming mechanism (`--store-primary` etc. on `<body>`); Phase 5 moves them, it does not invent them.
- Tailwind 4.3.3 via `@import 'tailwindcss'` + `@config '../tailwind.config.ts'` in `globals.css`; the theme file is imported into this cascade.
- Palette usage today (storefront, non-admin, non-test): 221 `neutral-*`, 177 `gray-*`, 168 `orange-*`, 138 `text-white`, 48 `red-*`, 31 `green-*`, 11 `amber-*`, 11 `blue-*`, 7 `yellow-*`, 3 `emerald-*`, 1 `zinc-*`, across ~85 files. Hex literals outside `tailwind.config.ts`: two drawers (`bg-[#fdfdfb]`), `StripeProvider.tsx` (9), `global-error.tsx` (7), three email templates, one SVG placeholder, one `globals.css` focus outline.
- Shadows/overlays are confined to `components/ui/*` (`shadow-sm/md/lg`, `bg-black/50`, `bg-black/80`) plus `AgentDrawer`; not a large sweep surface, but Pitfall 5 says they must be screenshotted.

### Integration Points
- `app/layout.tsx`: `data-theme="volt-dark"` on `<html>`; the inline `style` on `<body>` goes away; `backgroundColor`/`color` become `bg-surface text-foreground` classes.
- `themes/volt-dark.css` (new) → imported by `app/globals.css` (Phase 5 imports the single file directly; Phase 6 swaps in the generated barrel).
- `lib/themes/tokens.ts` (new): `getThemeTokens()` consumed by `StripeProvider.tsx`, `app/layout.tsx` (Clerk variables), `app/global-error.tsx`, and the three email builders.
- `.gitignore`: add `.screenshots/`.
- `package.json`: possible devDependency and `screenshot` script; nothing on `build:worker` or `deploy` paths.

</code_context>

<specifics>
## Specific Ideas

- "Consolidate to the least viable number of shades — as long as it is pretty close I don't mind standardizing." The sweep is a palette reduction, not a find-and-replace.
- The light drawers are a deliberate design choice, not an oversight; they must survive the sweep looking the same and be flippable by a future theme.
- Emails should look like the store's brand, so the theme reaches them too, via hex at send time.
- The first chunk (contract + relocation) must be a true visual no-op with its own screenshot set before any component is touched.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Items explicitly left to later phases per ROADMAP.md: theme validator and manifest, `getActiveTheme()` D1 resolution and telemetry, admin Appearance swatches, light preset (Phase 6); layout switches (Phase 7); `docs/theming.md` and the presets x layouts visual QA matrix (Phase 8).

</deferred>

---

*Phase: 05-token-contract-component-sweep*
*Context gathered: 2026-09-03*
