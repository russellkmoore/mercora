# Feature Research

**Domain:** Storefront theming / appearance customization (tokens + enumerated layout variants, no free composition)
**Researched:** 2026-09-02
**Confidence:** MEDIUM

## Scope Note

This research covers only the NEW theming/appearance surface for the v2 milestone: theme picker with swatches, light/dark presets, and enumerated layout switches (category grid/list, hero style, gallery position). Existing commerce, admin auth, and the `admin_settings` KV pattern are already built and are treated as given dependencies, not researched here.

## Feature Landscape

### Table Stakes (Users/Operators Expect These)

Features an admin appearance panel is assumed to have. Missing these makes the feature feel unfinished even though it technically "works."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Theme picker with visual swatch previews (not just a name dropdown) | Both Shopify (`color_palette` setting type) and WordPress block themes (style variation swatches) show a grid of small color previews per option — operators expect to see the palette before committing, not read a label | LOW | Manifest already carries `{ name, label, tokens }` per Phase B; render 3-5 swatch chips per theme card from the token values (primary, surface, foreground) |
| Instant apply, no redeploy, for shipped themes | Shopify preset switching and WP style-variation switching are both live, no-rebuild operations | LOW | Already the decision: D1-backed `store.active_theme`, resolved server-side |
| Clear "currently active" indication in the picker | Every reference implementation (Shopify editor, WP Site Editor, SaaS settings panels) highlights the selected option distinctly | LOW | Standard selected-state styling on the swatch card |
| Server-side resolution before first paint (no flash of wrong theme) | FOUC/flash-of-unstyled-theme is the most commonly reported theming bug; client-side theme resolution after hydration causes a visible flash | LOW–MEDIUM | Already the architecture: `getActiveTheme()` resolves server-side in `layout.tsx` and stamps `data-theme` on `<html>` before render — this table-stakes item is satisfied by the existing design, not new work |
| Fallback behavior when a stored value is invalid/unknown | Shopify and WP both validate presets against the theme's defined settings; an unrecognized value must not crash or blank-render the page | LOW | Already decided: unknown theme name falls back to env default → manifest default, with a telemetry event |
| Light and dark options both present | Dark-mode-only or light-mode-only theming reads as incomplete once any picker UI exists — users expect to see the axis, even if only 2-3 themes ship total | LOW | Already decided: "2-3 preset themes, one light"; `theme.mode` folded into the theme file |
| Layout switches rendered as clearly labeled, mutually exclusive choices (not checkboxes that can combine oddly) | Radio-style / segmented-control pattern is standard for enumerated variants (grid-3 / grid-2 / list; full-bleed / split / minimal; left / top) | LOW | Enumerated union types already chosen; UI is a segmented control or radio card group per switch, consistent with the existing `admin_settings` sectioned-card pattern |
| Settings persist through the existing admin save pattern | The promotional banner toggle already establishes save/feedback UX for `admin_settings`; a new Appearance section that behaves differently (different save button, different feedback) would feel inconsistent | LOW | Reuse the existing settings API/save pattern verbatim — this is a dependency, not new design work |

### Differentiators (Where This Implementation Can Stand Out)

Not required for the feature to "work," but where Voltique's constrained approach pays off relative to the reference systems above.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Build-time validated theme contract (fails the build on missing token or stray selector) | Shopify/WP never hard-fail a bad theme at deploy time — a malformed preset just renders wrong in production. Mercora's prebuild scan catching this before merge is strictly better operational safety, and it's already the plan (Phase B) | MEDIUM | Already designed; worth calling out in `docs/theming.md` as the reason theme authoring is safer here than in Shopify/WP, since it directly serves the "simpler than Shopify" positioning |
| One canonical token contract shared by every theme (no per-theme token additions) | Shopify themes can add arbitrary custom settings per theme, which is exactly the sprawl Voltique is rejecting. Documenting "extend only when a preset theme needs it, and extend the contract, not one theme" is a differentiator worth stating explicitly | LOW | Governance note for `docs/theming.md`, not code |
| Telemetry on unknown/invalid theme selection | Neither Shopify nor WP theme switching emits a structured signal when a stored preference becomes invalid (e.g., after a theme file is removed) | LOW | Already decided (taxonomy addition); genuinely differentiates from the reference systems, which fail silently |
| Admin UI itself never re-themed | Every reference system (Shopify admin, WP Site Editor chrome, most SaaS dashboards) at minimum supports admin dark mode as a separate axis. Voltique explicitly does not theme admin at all — this is a scope reduction, but worth stating as intentional so it's never mistaken for an oversight | N/A | Documentation clarity, not implementation |

### Anti-Features (Respect the Already-Decided Line)

These map directly to capabilities the reference systems (Shopify, WordPress) DO offer and that Voltique has explicitly rejected. Listed so nobody re-proposes them mid-milestone.

| Feature | Why It Looks Appealing (Shopify/WP precedent) | Why It's Rejected Here | What To Do Instead |
|---------|-----------------------------------------------|--------------------------|---------------------|
| Free-form CSS/custom code injection per theme (WooCommerce Additional CSS box, Shopify theme.liquid edits) | Gives merchants unlimited visual control without a developer | Directly contradicts the locked decision ("Per-theme component/markup overrides — rejected on principle"); also reopens the exact hardcoded-color/FOUC-adjacent bugs the token sweep is meant to close, and bypasses the build-time validation entirely | A theme is only the ~18-token CSS custom-property block; anything beyond that requires a new enumerated layout variant, added deliberately, not a CSS escape hatch |
| Open color picker for theme customization (pick any hex per token) | Shopify's non-`color_palette` settings and most page builders allow arbitrary color choice | Explodes the combinatorial testing surface (any color × any component), defeats the "swatch preview = what you get" guarantee, and turns every new color into an unreviewed accessibility/contrast risk | Swatch picker over a fixed, curated set of preset theme files only; new colors require adding a new theme file (which goes through prebuild validation), not a live picker |
| Per-category or per-product layout overrides | Shopify sections/blocks allow this at arbitrary granularity; feels like more merchandising flexibility | Already rejected ("Per-category layout overrides — Not now; per-template only"); multiplies the variant matrix that needs render tests and visual QA without a stated business need | Per-template enumerated switch only (category page as a whole is grid-3/grid-2/list, not per-category) |
| Admin dashboard theming | Every reference system treats admin/back-office as themable too (WP Site Editor chrome, most SaaS dashboards have dark admin) | Already rejected ("Admin theming — Never in this milestone"); admin keeps its hardcoded palette by design, and the component sweep explicitly excludes admin | None needed — just don't extend the token sweep or picker UI into `app/admin/*` component styling |
| User-facing (customer-selectable) theme switching, as opposed to admin-only | Some SaaS products (Notion, Linear) let end users pick their own theme/appearance, and it's tempting to extend "admin picks the storefront theme" to "shoppers pick their own" | Out of scope for this milestone entirely — the milestone is about the *admin* controlling one active theme for all shoppers, not per-visitor preference, and per-visitor state would need session/account storage design not covered here | If ever wanted, treat as a separate future milestone: needs its own storage (cookie/account preference) and interacts with SSR resolution differently than the single-admin-selected-theme model |
| Live/instant preview of a theme before saving (Shopify/WP editor preview pane) | Both reference systems let you see the theme applied before publishing | Not in the milestone's target features list; swatch previews from the manifest already give a reasonable approximation without building a full live-preview iframe/rendering pipeline | Swatch cards (color chips) are the preview; a full live-apply preview is a plausible P2/P3 addition for a later milestone, not this one |

## Feature Dependencies

```
Token contract (~18 tokens) + component/template sweep
    └──requires──> [nothing new; foundational]

Theme file mechanism (prebuild scan, manifest, getActiveTheme())
    └──requires──> Token contract (tokens must exist before themes can supply values for them)

Admin Appearance UI: theme picker with swatches
    └──requires──> Theme file mechanism (manifest is the data source for swatches)
    └──requires──> Existing admin_settings save pattern (banner toggle precedent)

Layout switches (category/hero/gallery enumerated variants)
    └──requires──> Existing admin_settings save pattern
    └──independent-of──> Theme file mechanism (can ship before or after; no shared code path)

Light preset theme
    └──validates──> Component/template sweep completeness (acid test — surfaces missed hardcoded text-white etc.)
```

### Dependency Notes

- **Theme file mechanism requires token contract:** the prebuild scan validates each `themes/*.css` file against the required token set, so the token contract must be finalized (or at least frozen for v2) before the validation script has something to check against. This is why Phase A precedes Phase B in the milestone seed.
- **Admin Appearance UI requires theme file mechanism:** swatch cards render from `lib/themes/manifest.generated.ts`, so there's nothing to pick from until the manifest exists.
- **Layout switches are independent of the theme mechanism:** they share only the `admin_settings` storage pattern and the Appearance admin section as a UI home. They could ship in either order relative to Phase B without blocking each other — useful if the roadmap wants to parallelize or resequence.
- **Light preset validates the sweep, it doesn't just add a color:** because the current look is entirely dark, a light theme is the only way to prove no component silently assumes a dark background (e.g., `text-white` that a token sweep might have missed). Treat "does the light preset render correctly everywhere" as a de facto acceptance test for Phase A, not just a Phase B content task.

## MVP Definition

### Launch With (v2, this milestone)

Already scoped in `PROJECT.md` Active requirements and the milestone seed — listed here for completeness against the table-stakes/differentiator analysis above, not as new proposals:

- [ ] Token contract (~18 tokens) + full component/template sweep — table stakes, everything else depends on it
- [ ] Build-time theme validation (prebuild scan, fails on invalid theme) — table stakes for operational safety, and the milestone's differentiator vs. Shopify/WP
- [ ] `getActiveTheme()` server-side resolution with fallback chain + telemetry on unknown theme — table stakes (avoids FOUC) and differentiator (structured failure signal)
- [ ] Admin Appearance section: swatch-preview theme picker — table stakes
- [ ] 2-3 preset themes, at least one light — table stakes (light is also the sweep's acid test)
- [ ] Three enumerated layout switches (category, hero, gallery) as server-chosen variant components — table stakes for the "layout switches" half of the milestone goal

### Add After Validation (not proposed for this milestone, but plausible v2.x)

- [ ] Live preview of a theme in the admin panel before saving — nice-to-have UX improvement once the core picker ships and if operators report wanting it
- [ ] More layout switch dimensions (e.g., product card density, footer style) — only if the three shipped switches prove the pattern works and operators ask for more surface area

### Future Consideration (explicitly out of scope, see Anti-Features)

- [ ] Free-form CSS overrides per theme — rejected on principle, not just deferred
- [ ] Customer-selectable (per-shopper) themes — different problem (session/account state), separate milestone if ever pursued
- [ ] Per-category layout overrides — rejected for now, would need a demonstrated merchandising need
- [ ] Admin dashboard theming — rejected for this milestone by explicit decision

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Token contract + sweep | HIGH | HIGH | P1 |
| Theme file mechanism + validation | HIGH | MEDIUM | P1 |
| Admin swatch picker | HIGH | LOW | P1 |
| Layout switches (3) | MEDIUM | MEDIUM | P1 |
| Light preset theme | HIGH (validates sweep) | LOW (once tokens exist) | P1 |
| Live theme preview before save | LOW-MEDIUM | MEDIUM | P3 |
| Additional layout switch dimensions | LOW (unproven demand) | MEDIUM | P3 |

**Priority key:**
- P1: Must have for this milestone (matches `PROJECT.md` Active requirements)
- P2: Should have, add when possible (none identified beyond current scope)
- P3: Nice to have, future consideration only

## Reference System Comparison

| Feature | Shopify Online Store 2.0 | WordPress Block Themes / WooCommerce | Mercora v2 Approach |
|---------|---------------------------|----------------------------------------|----------------------|
| Theme customization unit | `settings_schema.json` + Liquid sections; presets in `settings_data.json` cap at 5 per theme, but themes can define arbitrary custom settings beyond a shared contract | `theme.json` settings + style variations (palette/typography only); classic WooCommerce Customizer additionally allows free CSS | Fixed ~18-token contract shared by every theme file; no per-theme custom settings |
| Color selection UI | `color_palette` setting type shows a swatch grid bound to developer-defined named colors | Site Editor Styles sidebar shows palette swatches per style variation | Swatch cards from generated manifest, one set of tokens per theme, no open picker |
| Validation | None at deploy time; a malformed theme just renders incorrectly live | None; a bad theme.json can break the Site Editor silently | Prebuild script fails the build on missing token or stray selector — strictly safer |
| Per-theme markup/code | Fully allowed (Liquid sections, theme.liquid edits) | Fully allowed (block templates, PHP in classic themes, Additional CSS) | Explicitly rejected; tokens + enumerated variants only |
| Layout variation mechanism | Section/block settings, essentially free composition | Block patterns, free composition within the editor | Named enumerated variant components (grid-3/grid-2/list, etc.), chosen server-side, no composition |
| Requires deploy for new option | New theme file = yes (upload); switching among uploaded themes = no | New style variation file = yes (theme update); switching among shipped variations = no | Same pattern: new theme file requires deploy; switching among shipped themes is instant via D1 (already decided) |

## Sources

- [settings_schema.json — Shopify.dev](https://shopify.dev/docs/storefronts/themes/architecture/config/settings-schema-json) — MEDIUM confidence (official docs via web search, not directly fetched/cross-verified against a second independent source in this pass)
- [settings_data.json — Shopify.dev](https://shopify.dev/docs/storefronts/themes/architecture/config/settings-data-json) — MEDIUM confidence
- [Input settings — Shopify.dev](https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings) — MEDIUM confidence (source of the `color_palette` swatch-grid behavior)
- [Announcing Online Store 2.0 — Shopify Partners Blog](https://www.shopify.com/partners/blog/shopify-theme-styles-and-presets) — MEDIUM confidence
- [Theme.json for WordPress Block Themes explained — Elmastudio](https://elmastudio.de/en/theme-json-for-wordpress-block-themes-explained/) — MEDIUM confidence
- [Theme.json color options — Full Site Editing](https://fullsiteediting.com/lessons/theme-json-color-options/) — MEDIUM confidence
- [Block Theme Color Switcher plugin — WordPress.org](https://wordpress.org/plugins/block-theme-color-switcher/) — MEDIUM confidence (describes style-variation CSS-custom-property mechanics)
- [WordPress Block Themes: Complete 2026 Developer Guide — Gatilab](https://gatilab.com/wordpress-block-themes/) — LOW-MEDIUM confidence (secondary source; used for WooCommerce block-theme transition status)
- [Is Your SaaS UI Letting You Down? The Color System Fix — Merveilleux Design](https://www.merveilleux.design/en/blog/article/color-systems-for-saas) — LOW confidence (opinion/blog synthesis, not vendor documentation)
- [SaaS Dark Mode UI Design — Orbix Studio](https://www.orbix.studio/blogs/saas-dark-mode-ui-design) — LOW confidence (marketing/blog content)
- [The developer's guide to design tokens and CSS variables — Penpot](https://penpot.app/blog/the-developers-guide-to-design-tokens-and-css-variables/) — MEDIUM confidence (tool vendor blog, but technically consistent with broader token-tier consensus across sources)
- [Design Tokens and Theming Architecture — Sujeet Jaiswal](https://sujeet.pro/articles/design-tokens-and-theming) — MEDIUM confidence
- [The Perfect Theme Switch Component — Aleksandr Hovhannisyan](https://www.aleksandrhovhannisyan.com/blog/the-perfect-theme-switch/) — MEDIUM confidence (widely cited independent technical writeup on FOUC root cause and fix)
- [Fixing the dark mode flash issue on server rendered websites — Maxime Heckel](https://blog.maximeheckel.com/posts/switching-off-the-lights-part-2-fixing-dark-mode-flashing-on-servered-rendered-website/) — MEDIUM confidence (corroborates the same FOUC mechanism from an independent source)
- Project context: `/Users/rmoore/Workspaces/mercora/.planning/PROJECT.md`, `/Users/rmoore/Workspaces/mercora/MILESTONE-SEED.md` — HIGH confidence (primary source of already-decided scope and constraints)

**Note on confidence:** No official Shopify/WordPress documentation page was directly fetched and cross-verified against a second primary source in this pass (web-search snippets only, via `WebSearch`, not a dedicated docs-fetch tool), so individual claims about exact mechanics are held at MEDIUM rather than HIGH. The general shape of the findings (swatch-preview pickers, bounded token/preset contracts, build-vs-runtime theme switching split, FOUC caused by SSR/client resolution mismatch) is corroborated across 2+ independent sources per claim and is not contested by any source found, so overall directional confidence for the roadmap implications is MEDIUM-HIGH in practice.

---
*Feature research for: storefront theming / appearance customization*
*Researched: 2026-09-02*
