# Voltique / Mercora: Pre-packaged Themes

Voltique is a reference storefront, so its themes don't need to match the electric-gear catalog. They should do what a Shopify theme store does: render the same product data convincingly for six different kinds of merchant. Each theme below names its target industry, gives a short synopsis, the design direction, and a full color and token spec.

Color values are oklch to match Tailwind v4 output. Token names are the semantic set: `surface`, `surface-raised`, `surface-sunken`, `ink`, `ink-muted`, `accent`, `accent-ink`, `accent-2` (optional secondary), `success`, `warning`, `radius`, `font-display`, `font-body`, `font-mono`, `shadow`, `border-width`, `image-aspect`. Rename to match the codebase.

The six were chosen to be as far apart as possible: three light, three dark; serif, geometric sans, rounded sans and mono; radius from 0 to 1rem; flat, glassy and hard-shadow card treatments. If all six look right, the token system is complete.

---

## 1. Luxe

**Industry:** fashion, jewelry, watches, fragrance.
**Shopify analogues:** Prestige, Impact, Broadcast.

**Synopsis.** A small luxury house that wants the site to feel like a printed lookbook. Everything is quiet: ivory paper, a single gold accent used sparingly, tall portrait photography, serif headlines with wide-tracked uppercase labels. The store sells confidence, not urgency; nothing flashes, nothing bounces.

**Direction.** Tall centered header with the wordmark alone. Product grid at three across with portrait images and no card backgrounds; title in the serif, price smaller and in the muted tone below it. Hairline dividers instead of borders. Buttons are outlined, square-cornered, with a slow 300ms fill on hover. Uppercase labels carry `letter-spacing: .12em`. Product pages lead with a full-bleed image and a narrow text column. This theme proves `font-display` and `letter-spacing` are real tokens.

**Colors and tokens.**

- surface `oklch(97% .008 80)` warm ivory
- surface-raised `oklch(99% .004 80)`
- surface-sunken `oklch(93% .012 80)`
- ink `oklch(18% .01 60)`
- ink-muted `oklch(48% .015 60)`
- accent `oklch(72% .11 85)` champagne gold
- accent-ink `oklch(18% .01 60)`
- success `oklch(52% .1 150)`
- warning `oklch(60% .13 60)`
- radius `0`; border-width `1px`; shadow `none`
- font-display Cormorant Garamond 400–500, tight leading; font-body Inter or Geist at 15px
- image-aspect `3 / 4`

---

## 2. Midnight

**Industry:** consumer electronics, audio, gaming peripherals, hardware-adjacent SaaS.
**Shopify analogues:** Sense, Dawn (dark preset), Xtra.

**Synopsis.** The store for people who compare specs before they buy. Indigo-black surfaces, a violet accent with a cyan secondary, a glass header, cards outlined in a faint gradient that brightens on hover. It should feel like a product launch page, polished and slightly cinematic, without tipping into gamer neon.

**Direction.** Sticky header with `backdrop-blur` over a 60%-opacity surface. Cards at 16:9 with a 1px gradient border (`accent` to `accent-2` at 30% opacity, 70% on hover) and a soft deep shadow. Spec rows as a two-column definition list on the product page, with prices and numbers in Geist Mono. "Add to cart" is a solid accent pill. Hero uses a radial glow in accent-2 behind the headline. Exercises `shadow`, gradient borders, `accent-2` and the glass header.

**Colors and tokens.**

- surface `oklch(18% .03 270)` indigo-black
- surface-raised `oklch(24% .035 270)`
- surface-sunken `oklch(13% .025 270)`
- ink `oklch(97% .01 270)`
- ink-muted `oklch(68% .03 270)`
- accent `oklch(70% .18 300)` violet
- accent-ink `oklch(98% 0 0)`
- accent-2 `oklch(75% .15 200)` cyan
- success `oklch(78% .16 155)`
- warning `oklch(84% .17 85)`
- radius `0.75rem`; border-width `1px`; shadow `0 8px 30px oklch(0% 0 0 / .45)`
- font-display Geist 700 with `letter-spacing: -.02em`; font-body Geist; font-mono Geist Mono
- image-aspect `16 / 9`

---

## 3. Clinical

**Industry:** skincare, wellness, supplements, pharmacy, dental.
**Shopify analogues:** Refresh, Ritual, Craft.

**Synopsis.** Trustworthy and regulated. Pure white, cool graphite text, one sea-teal accent, medium-weight type that is never bold, and a lot of air. Products sit on white so bottles and tubes float. Ratings are a numeric score, not stars. The store reads like a well-designed pharmacy label.

**Direction.** Slim top bar for trust messaging (free shipping, dermatologist tested). Square 1:1 product images on white with a barely-visible 1px border. Ingredient and dosage information in a bordered callout on the product page. Body text at 16px with 1.6 line-height. Hover states are minimal: a border darkens, nothing lifts. Buttons are solid accent with white text and a 0.5rem radius. This theme is the test that light-theme hover states invert correctly instead of going white-on-white.

**Colors and tokens.**

- surface `oklch(100% 0 0)`
- surface-raised `oklch(97.5% .005 220)`
- surface-sunken `oklch(95% .008 220)`
- ink `oklch(28% .02 240)`
- ink-muted `oklch(55% .02 240)`
- accent `oklch(62% .12 200)` sea-teal
- accent-ink `oklch(100% 0 0)`
- success `oklch(58% .13 160)`
- warning `oklch(68% .14 70)`
- radius `0.5rem`; border-width `1px` at `oklch(90% .01 220)`; shadow `0 1px 2px oklch(0% 0 0 / .05)`
- font-display Inter or Geist 500; font-body same at 16px / 1.6
- image-aspect `1 / 1`

---

## 4. Retro

**Industry:** vintage clothing, record stores, arcade and collectibles, nostalgia brands.
**Shopify analogues:** Pop, Colorblock, Loft.

**Synopsis.** Deep purple, magenta and cyan, cream text, a perspective grid fading into the hero. Hard offset shadows in the secondary color, chunky price tags, diagonal SALE ribbons. It is loud on purpose but stays legible; the joke is in the decoration, not in the contrast.

**Direction.** Hero background is a CSS `repeating-linear-gradient` perspective grid fading to surface, with an optional 4%-opacity scanline overlay. Cards have a 2px border and a `4px 4px 0` hard shadow in accent-2; on hover the card shifts up-left and the shadow grows. Hover states swap colors rather than fade; no easing longer than 100ms. Display font (Orbitron or Righteous) is for headings only; body stays in Geist so product copy remains readable. Price sits in a chunky rounded-rectangle tag. Exercises `accent-2`, hard shadows and decorative backgrounds.

**Colors and tokens.**

- surface `oklch(22% .06 300)` deep purple
- surface-raised `oklch(28% .07 300)`
- surface-sunken `oklch(16% .05 300)`
- ink `oklch(96% .02 90)` cream
- ink-muted `oklch(75% .04 300)`
- accent `oklch(80% .2 340)` magenta
- accent-ink `oklch(16% .05 300)`
- accent-2 `oklch(85% .15 195)` cyan
- success `oklch(85% .15 195)`
- warning `oklch(88% .18 95)`
- radius `0.25rem`; border-width `2px`; shadow `4px 4px 0 oklch(85% .15 195)`
- font-display Orbitron or Righteous (headings only); font-body Geist
- image-aspect `4 / 3`

---

## 5. Atelier

**Industry:** furniture, ceramics, home goods, handmade and small-batch.
**Shopify analogues:** Studio, Stiletto, Be Yours.

**Synopsis.** Warm linen background, clay accent, a sage secondary, soft optical-size serif headlines. Products are shown as objects in a room rather than items in a grid: mixed aspect ratios, no card backgrounds, a "materials" line under each title. The store feels like a maker's studio page.

**Direction.** Masonry-style grid with mixed image aspects (4:5 default, occasional 1:1 and 3:2). Image fills the cell; title, materials and price sit on bare surface below with no card fill. Very soft shadow only on hover. Earthy badges ("small batch", "ships in 2 weeks") in accent-2. Buttons are solid clay with ivory text and a modest radius. Product page uses a two-column layout with a sticky image and a long-form description. Proves the grid can vary per theme, not just the colors.

**Colors and tokens.**

- surface `oklch(96% .012 85)` warm linen
- surface-raised `oklch(98.5% .008 85)`
- surface-sunken `oklch(91% .02 80)`
- ink `oklch(24% .02 60)`
- ink-muted `oklch(50% .025 60)`
- accent `oklch(58% .1 40)` clay
- accent-ink `oklch(98.5% .008 85)`
- accent-2 `oklch(60% .06 140)` sage
- success `oklch(55% .1 145)`
- warning `oklch(62% .12 65)`
- radius `0.375rem`; border-width `0`; shadow `0 2px 12px oklch(30% .03 60 / .12)`
- font-display Fraunces (soft optical size) 500; font-body Inter
- image-aspect `4 / 5` with per-card overrides

---

## 6. Market

**Industry:** grocery, specialty food, coffee, farm boxes.
**Shopify analogues:** Crave, Spark, Taste.

**Synopsis.** Bright, dense and friendly. Off-white surface, forest-green text, a produce-green accent with an orange secondary, big radius, rounded sans. Cards carry quantity steppers and unit pricing because people buy six of something, not one. The store feels like a good neighborhood grocer's app.

**Direction.** Four-across grid at desktop with square images. Quantity stepper on every card instead of a plain "add" button. Unit price ("$4.99 / lb") in muted under the main price. Category chips as rounded pills in a horizontally scrolling row beneath the header. Promo banner strip in accent-2. Radius flows into inputs, chips and image corners, not just buttons. Hover lifts the card 2px with a slightly deeper shadow. Tests that `radius` reaches inputs and chips, and that a dense grid still breathes.

**Colors and tokens.**

- surface `oklch(98% .01 100)`
- surface-raised `oklch(100% 0 0)`
- surface-sunken `oklch(94% .03 110)`
- ink `oklch(25% .04 140)` forest
- ink-muted `oklch(50% .04 140)`
- accent `oklch(60% .18 145)` produce green
- accent-ink `oklch(100% 0 0)`
- accent-2 `oklch(70% .18 45)` orange
- success `oklch(60% .18 145)`
- warning `oklch(72% .17 75)`
- radius `1rem`; border-width `0`; shadow `0 4px 16px oklch(25% .04 140 / .1)`
- font-display Nunito or Fredoka 700; font-body Nunito
- image-aspect `1 / 1`

---

## What each theme is testing

| Theme | Tokens it stresses |
|---|---|
| Luxe | serif display, letter-spacing, portrait images, radius 0 |
| Midnight | shadow, gradient borders, glass header, accent-2, mono numerals |
| Clinical | light-theme hover inversion, light borders, numeric ratings |
| Retro | accent-2, hard offset shadows, decorative hero backgrounds |
| Atelier | mixed-aspect grid, no card fills, serif display |
| Market | radius on inputs and chips, dense grid, steppers, unit pricing |

## Cross-cutting rules

Hover states are expressed as inversions (`hover:bg-ink hover:text-surface`) or accent fills, never literal white or black; half the set is light and would lose its hovers otherwise. Star ratings and stock badges ride on `warning` and `success`, not on yellow-400 and green-400. The catalog photos are dark and moody, so light themes apply a per-theme image treatment (a hairline ring, or `brightness(1.04)`) on the image container rather than expecting the assets to change. Fonts load through `next/font` and are exposed as `--font-display`, `--font-body` and `--font-mono` so a theme file can swap them without a code change.
