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
