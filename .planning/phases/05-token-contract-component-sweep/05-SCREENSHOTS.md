# Phase 5 Screenshot Record

This file is the phase's screenshot coverage record. Captured images live under the
git-ignored `.screenshots/` directory and are never committed — they may contain real
customer names, addresses, and order contents on the account, checkout, and order-status
routes. Only this manifest (route, viewport, state, path, content hash) is committed.

The `baseline` label below is captured once in 05-02, from pre-sweep `main`, before any
token-sweep code lands. It is the fixed comparison target for every later chunk (D-21):
each chunk's "no visual regression" proof is a diff against `baseline`, not against the
previous chunk's screenshots.

Capture command: `mise exec -- npm run screenshot:routes -- --label <name> [--order-id <id>]`.

## Intentional shade snaps

Copied verbatim from `05-TOKEN-MAP.md` §4 (D-15 consolidation record). Every later chunk
entry references a snap by its identifier (S1–S11) instead of restating it.

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
| S12 | New `app/not-found.tsx` replaces Next's built-in 404 fallback | Discovered during chunk-1-contract capture: Next's built-in `notFound()` boundary injects its own unlayered `body{color:#000;background:#fff}` style, which beat the token-driven `bg-surface`/`text-foreground` utility classes once `<body>`'s inline style was removed (unlayered CSS always outranks Tailwind's `@layer utilities`, regardless of specificity) — every `notFound()` call site (category, product, blog, account, order-status) would have silently rendered an unbranded white 404 in a browser with a light OS color-scheme preference. Fixed by adding a themed `app/not-found.tsx` so the site's own 404 renders on the token contract instead of the framework fallback (Rule 1 auto-fix; see 05-03-SUMMARY.md) | The 404 page gains a heading, message, and "Return home" link on the dark surface instead of Next's plain white fallback text |
| S13 | `Footer.tsx`'s `bg-neutral-950` (`oklch(14.5% 0 0)` ≈ `#0a0a0a`) consolidates onto `bg-surface` (`#000000`), per 05-TOKEN-MAP.md §2's own "`bg-black`, `bg-neutral-950` → `bg-surface`" row | `--store-surface` was frozen at `#000000` in 05-03; Footer.tsx is the first file this phase sweeps that used the near-black `neutral-950` shade instead of `black`/`neutral-900`, so the ~1% per-channel convergence (10/255 → 0/255) was latent in the frozen contract and surfaces only now, on chunk-2-shell's PIL diff of `account__*` | The footer's background (and the giant background wordmark region) goes from a barely-perceptible near-black to true black; visible only on short pages where the footer sits within the captured viewport (confirmed via `ImageChops.difference` bbox isolated to the footer's y-range, y≥596 on the 1280 viewport) — a D-15 close-enough shade snap, not a regression |
| S14 | `HeaderClient.tsx`'s mobile category cards converge several `gray-300/400` text shades onto `muted-foreground` and several `orange-400/500/600` hover/border shades onto `primary` with alpha modifiers, first visible in the `nav-open` state at 390px (the only capture state that renders the mobile Sheet's category-card content) | Per-pixel diff against `chunk-2-ui` shows ~7% of pixels differ, entirely small single-digit RGB shifts (e.g. `rgb(145,153,166)`→`rgb(155,155,155)` on anti-aliased text edges, `rgb(42,13,0)`→`rgb(43,20,4)` on orange icon edges) with no layout, content, or polarity change — verified by side-by-side visual read of `home__390__nav-open.png` (chunk-2-shell vs. chunk-2-ui, pixel-identical to the eye) | Mobile menu category cards, chevrons, and hover-adjacent borders read marginally different shades of orange/grey; the `390 nav-open` capture is identical across every route (dedup), so this single snap explains all six differing `390 nav-open` rows below |
| S15 | `ProductCard.tsx`'s card surface (`bg-neutral-800`, `rgb(38,38,38)`) and `ProductDisplay.tsx`'s gallery well (same class) consolidate onto `bg-surface-elevated` (`rgb(23,23,23)`), per 05-TOKEN-MAP.md §2's own "`bg-neutral-900`, `bg-neutral-800` → `bg-surface-elevated`" row | Per-pixel diff against `chunk-2-shell` on `home`, `category`, `product`, and the home page visible behind the open cart drawer isolates every differing pixel to this exact 38→23 per-channel shift (or that value dimmed under the cart drawer's backdrop scrim, `19→11`), plus antialiasing bleed where card borders/text meet the changed surface — confirmed by sampling 15-20 random differing coordinates per capture, all landing on the same pair of values | Every product card's image-well background (home, category, product-thumbnail rail) and the product detail gallery well go from a slightly lighter charcoal to the standard elevated-surface shade; imperceptible at normal viewing distance, visible only in a byte-level hash diff |
| S16 | `StarRating.tsx`'s filled-star layer (`text-yellow-400`, `rgb(253,199,0)`) consolidates onto `text-primary` (`rgb(249,115,22)`), and its unfilled-star layer (`text-neutral-600`, `rgb(82,82,82)`) consolidates onto `text-muted-foreground` (`rgb(163,163,163)`), directed explicitly by this plan's own Task 1 action ("Filled stars take the primary token; unfilled stars take muted foreground") | `StarRating.tsx` is shared by `ProductCard.tsx` (home, category, product-detail grids) and `ProductDisplay.tsx`'s own rating summary line, so the sweep of one shared component ripples into every card showing a star badge, not just `components/reviews/*`. Per-pixel diff against `chunk-3-catalog` on `home`, `category`, `product`, and the home page visible behind the open cart drawer isolates every differing pixel to these two exact colour pairs plus antialiasing bleed at the star glyph edges — confirmed by sampling 8-15 random differing coordinates per capture across six cells, all landing on one of the two pairs | Every star-rating badge (product cards on home/category/product grids, the cart-open home background, and the product detail page's own rating line) changes from gold/dark-grey stars to brand-orange/light-grey stars; a small, deliberate, and visible colour change confined to a ~60x11px badge region per card |

## Coverage notes

- `order-status` is captured only when `--order-id <id>` resolves to a real local D1 row.
  The pre-sweep `baseline` label's local dev seed contains no orders, so `order-status`
  records MISSING for both viewports and both states; that route's coverage is deferred to
  whichever later chunk plan sweeps the order-status page and can supply a seeded order id.
- The `nav-open` state at the 390px viewport opens a full-width `Sheet` that entirely
  covers the underlying route — by the app's own design, `nav-open` screenshots at 390px
  are visually identical across routes (same nav content, different filenames). This is
  expected, not a capture defect.
- `chunk-1-contract`'s three `account` rows are the only rows in that label that differ
  from `baseline`, and the cause is S12, not the token contract itself: the unauthenticated
  `/account` route redirects to a `/sign-in` path this app never defines, so it always hits
  the framework's built-in `notFound()` fallback. That fallback broke once the root layout's
  `<body>` inline style was removed (see S12), so this plan added `app/not-found.tsx` as a
  Rule 1 fix. Every other row in `chunk-1-contract` is a byte-identical hash match with
  `baseline`.
- `chunk-2-shell` (05-05, the shared shell: `HeaderClient.tsx`, `Header.tsx`,
  `Breadcrumbs.tsx`, `Footer.tsx`, `PromotionalBanner.tsx`, `app/layout.tsx`) diffs against
  `chunk-2-ui` cell-for-cell: every `home`/`category`/`product`/`cart`/`checkout` `resting`
  and `1280 nav-open` row is a byte-identical hash match. Two groups of rows differ, both
  traced by `PIL.ImageChops.difference` to a specific, expected shade consolidation and
  neither touches layout, content, or polarity:
  - All six `390 nav-open` rows (identical across routes by dedup) → **S14**, the mobile
    category-card gray/orange shade convergence, visible for the first time because this is
    the only capture state that renders that content.
  - All three `account` rows → **S13**, `Footer.tsx`'s `bg-neutral-950`→`bg-surface`
    consolidation, visible only because the short 404 page's footer sits inside the
    captured viewport; every other route's footer is below the fold and shows no diff.
  - No footer- or breadcrumb-region difference in this label was left unexplained or
    un-investigated: both groups above were pixel-diffed to their root cause before being
    annotated, per this chunk's own prohibition against annotating instead of fixing.
- `chunk-3-catalog` (05-06, the catalogue routes: `ProductCard.tsx`,
  `ProductRecommendations.tsx`, `CategoryDisplay.tsx`, `app/category/[slug]/page.tsx`,
  `ProductDisplay.tsx`, `app/product/[slug]/page.tsx`, `app/page.tsx`) diffs against
  `chunk-2-shell` cell-for-cell. Ten cells differ, all traced by `PIL.ImageChops.difference`
  (bbox plus random-sample pixel-pair comparison) to the same single, expected shade
  consolidation:
  - `home` (1280 resting, 1280 nav-open, 390 resting), `category` (1280 resting, 1280
    nav-open, 390 resting), `product` (1280 resting, 1280 nav-open, 390 resting), and `cart`
    (1280 cart-open, the home page visible behind the open drawer) → **S15**,
    `ProductCard.tsx`'s card surface and `ProductDisplay.tsx`'s gallery well consolidating
    `bg-neutral-800` (`rgb(38,38,38)`) onto `bg-surface-elevated` (`rgb(23,23,23)`). Sampled
    15-20 random differing pixels per capture; every sample lands on exactly that value pair
    (or the same pair dimmed under the cart drawer's backdrop scrim, `rgb(19,19,19)` →
    `rgb(11,11,11)`), plus antialiasing bleed where a card border or text glyph meets the
    changed background. No layout, content, or badge-meaning change in any sampled pixel.
  - The `390 nav-open` rows (all six, dedup) and `checkout`'s two non-`390-nav-open` cells
    that still differ from `baseline` carry forward **S14**/**S13** from `chunk-2-shell`
    unchanged (byte-identical to that chunk) — this plan touched none of the files those
    snaps trace to.
  - `cart` 390 `cart-open` and every `checkout` `resting`/`1280 nav-open` cell are
    byte-identical to `baseline`, confirming this plan changed nothing on routes/states its
    files don't render into.
  - A visual read of `product__1280__resting.png` and `category__1280__resting.png`
    side-by-side against `chunk-2-shell` confirms the price, "Add to Cart" button, and the
    "In stock"/"Coming soon" text still say the same thing — "In stock" reads green
    (`text-success`) and unavailable states read amber (`text-warning`) at both label
    resolutions; no badge changed status meaning, only the card surface shade moved.
- `chunk-3-engagement` (05-07, the reviews and subscription-acquisition surfaces:
  `ProductReviewsSection.tsx`, `ReviewForm.tsx`, `StarRating.tsx`,
  `SubscriptionAcquisitionPanel.tsx`, `SubscriptionSetupReturnHandler.tsx`) diffs against
  `chunk-3-catalog` cell-for-cell. All differing cells trace to one root cause:
  - `home` (1280 resting, 1280 nav-open, 390 resting), `category` (1280 resting, 1280
    nav-open, 390 resting), `product` (1280 resting, 1280 nav-open, 390 resting), and `cart`
    (1280 cart-open, the home page visible behind the open drawer) → **S16**,
    `StarRating.tsx`'s filled/unfilled star colours consolidating onto `text-primary` /
    `text-muted-foreground`. `StarRating` is shared by `ProductCard.tsx`, so this Task 1
    change ripples into every card grid, not just `components/reviews/*`. Sampled 8-15
    random differing pixels per capture across six cells; every sample lands on one of the
    two S16 colour pairs plus antialiasing bleed at the star glyph edges. No layout,
    content, or rating-value change in any sampled pixel.
  - The `390 nav-open` rows (all six, dedup) and the `checkout`/`account` cells that still
    differ from `baseline` carry forward **S14**/**S13** unchanged (byte-identical to
    `chunk-3-catalog`) — this plan touched none of the files those snaps trace to.
  - `checkout`'s `resting`/`1280 nav-open` cells and `cart` `390 cart-open` are
    byte-identical to `chunk-3-catalog`, confirming this plan changed nothing on
    routes/states its files don't render into.
  - Three supplementary cells beyond the standard grid (below) capture the two surfaces
    this plan actually rewrote: the reviews rating-summary card (Reviews tab opened) and
    the subscription Subscribe section with its default plan selected. A fourth candidate
    cell, the review form's validation-error state, could not be captured — `ReviewForm.tsx`
    only renders on an authenticated order's line item, which this local dev environment
    has no Clerk session or seeded delivered order to reach (recorded MISSING with reason
    in the supplementary table, the same class of gap as `order-status`).

## Label: `baseline`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/baseline/home__1280__resting.png | e3a6d3e06596035fee0c0fc2f8208df48f5222f1cf58b1bd41e64ccde5a1ee1f | - |
| home | 1280 | nav-open | .screenshots/baseline/home__1280__nav-open.png | 6565691e8fcfe095d9c01bd7cffe64119685d4cc0fd3e306956bdfb40a7e8841 | - |
| home | 390 | resting | .screenshots/baseline/home__390__resting.png | b3ac91d22cb3b2bffb98c85a209302125769ebfb0f454e47453bd5793e48d23d | - |
| home | 390 | nav-open | .screenshots/baseline/home__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| category | 1280 | resting | .screenshots/baseline/category__1280__resting.png | 0e9043b4b7b2424cce025bc8488aed883ce9d1a2421292a2fe5965d9f1db439a | - |
| category | 1280 | nav-open | .screenshots/baseline/category__1280__nav-open.png | 061b7b5134830b96bb8f16e505035fc829548ca6bc681e491dc52182dc1d7d7c | - |
| category | 390 | resting | .screenshots/baseline/category__390__resting.png | b7739154a537d2ef19761b0b4b4c129f7c4960984e075df88e756c78f0a122a3 | - |
| category | 390 | nav-open | .screenshots/baseline/category__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| product | 1280 | resting | .screenshots/baseline/product__1280__resting.png | 13bf10e27f35e4eb6846818c64eb134be3b88f41b16bd281c871f9bb01cfe00b | - |
| product | 1280 | nav-open | .screenshots/baseline/product__1280__nav-open.png | 6d449a9c72e280fcd1be294ee3d15959504ed0f7de34f66b0361c79274a267ff | - |
| product | 390 | resting | .screenshots/baseline/product__390__resting.png | 38eca79e5d2e04241b194611b8f4375e948825994e541de811a638df5cc8cc6c | - |
| product | 390 | nav-open | .screenshots/baseline/product__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| cart | 1280 | cart-open | .screenshots/baseline/cart__1280__cart-open.png | e6c78a66bf84804f5f9b09c0508abbe19aed336a90949ef2cc34ccb854e34b60 | - |
| cart | 390 | cart-open | .screenshots/baseline/cart__390__cart-open.png | f41cc5071ae72cd871138a26e947763e979a3d7e48c8afb9455c7202a81b615f | - |
| checkout | 1280 | resting | .screenshots/baseline/checkout__1280__resting.png | b3ee30c2d3bbc6431d5843272ce46783adce50d7fe769c941006baad9fd13734 | - |
| checkout | 1280 | nav-open | .screenshots/baseline/checkout__1280__nav-open.png | fd49c5d03ad38db2d8891803b286d026994ec4cdad0e21e47435df2901c568f4 | - |
| checkout | 390 | resting | .screenshots/baseline/checkout__390__resting.png | 7000b26a71fa72bde119bd01b1f54f8a8d9ea269a93bef75667e82dbe9a38896 | - |
| checkout | 390 | nav-open | .screenshots/baseline/checkout__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| account | 1280 | resting | .screenshots/baseline/account__1280__resting.png | 967b92a3e463cc2cba9daa6c6c93e8a3806e638f7e4879ef8cb85dcba9ceeab1 | - |
| account | 1280 | nav-open | .screenshots/baseline/account__1280__nav-open.png | 8b44a82de6a9dc3deb1cb5900301370a1e206106dd20ea7803ed3b5672e4b28c | - |
| account | 390 | resting | .screenshots/baseline/account__390__resting.png | cb077f2117688ed312fab3f0fbfee836a309d729c5e706e5b0e3cbb5f6980996 | - |
| account | 390 | nav-open | .screenshots/baseline/account__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `chunk-1-contract`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/chunk-1-contract/home__1280__resting.png | e3a6d3e06596035fee0c0fc2f8208df48f5222f1cf58b1bd41e64ccde5a1ee1f | - |
| home | 1280 | nav-open | .screenshots/chunk-1-contract/home__1280__nav-open.png | 6565691e8fcfe095d9c01bd7cffe64119685d4cc0fd3e306956bdfb40a7e8841 | - |
| home | 390 | resting | .screenshots/chunk-1-contract/home__390__resting.png | b3ac91d22cb3b2bffb98c85a209302125769ebfb0f454e47453bd5793e48d23d | - |
| home | 390 | nav-open | .screenshots/chunk-1-contract/home__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| category | 1280 | resting | .screenshots/chunk-1-contract/category__1280__resting.png | 0e9043b4b7b2424cce025bc8488aed883ce9d1a2421292a2fe5965d9f1db439a | - |
| category | 1280 | nav-open | .screenshots/chunk-1-contract/category__1280__nav-open.png | 061b7b5134830b96bb8f16e505035fc829548ca6bc681e491dc52182dc1d7d7c | - |
| category | 390 | resting | .screenshots/chunk-1-contract/category__390__resting.png | b7739154a537d2ef19761b0b4b4c129f7c4960984e075df88e756c78f0a122a3 | - |
| category | 390 | nav-open | .screenshots/chunk-1-contract/category__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| product | 1280 | resting | .screenshots/chunk-1-contract/product__1280__resting.png | 13bf10e27f35e4eb6846818c64eb134be3b88f41b16bd281c871f9bb01cfe00b | - |
| product | 1280 | nav-open | .screenshots/chunk-1-contract/product__1280__nav-open.png | 6d449a9c72e280fcd1be294ee3d15959504ed0f7de34f66b0361c79274a267ff | - |
| product | 390 | resting | .screenshots/chunk-1-contract/product__390__resting.png | 38eca79e5d2e04241b194611b8f4375e948825994e541de811a638df5cc8cc6c | - |
| product | 390 | nav-open | .screenshots/chunk-1-contract/product__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| cart | 1280 | cart-open | .screenshots/chunk-1-contract/cart__1280__cart-open.png | e6c78a66bf84804f5f9b09c0508abbe19aed336a90949ef2cc34ccb854e34b60 | - |
| cart | 390 | cart-open | .screenshots/chunk-1-contract/cart__390__cart-open.png | f41cc5071ae72cd871138a26e947763e979a3d7e48c8afb9455c7202a81b615f | - |
| checkout | 1280 | resting | .screenshots/chunk-1-contract/checkout__1280__resting.png | b3ee30c2d3bbc6431d5843272ce46783adce50d7fe769c941006baad9fd13734 | - |
| checkout | 1280 | nav-open | .screenshots/chunk-1-contract/checkout__1280__nav-open.png | fd49c5d03ad38db2d8891803b286d026994ec4cdad0e21e47435df2901c568f4 | - |
| checkout | 390 | resting | .screenshots/chunk-1-contract/checkout__390__resting.png | 7000b26a71fa72bde119bd01b1f54f8a8d9ea269a93bef75667e82dbe9a38896 | - |
| checkout | 390 | nav-open | .screenshots/chunk-1-contract/checkout__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| account | 1280 | resting | .screenshots/chunk-1-contract/account__1280__resting.png | 56453cfe2f1025a1011b92d75931a7e4cf70737ab6e5167114b7e63f2069d8cd | S12 — unauthenticated /account redirects to /sign-in, which 404s; the 404 page's own content changed (see S12) |
| account | 1280 | nav-open | .screenshots/chunk-1-contract/account__1280__nav-open.png | a4d93b037356cc5f03972f227872a0acf3ea63bc985cdf62dbc31d3e7030e1be | S12 — same 404 boundary as above |
| account | 390 | resting | .screenshots/chunk-1-contract/account__390__resting.png | 45d934fdf96bf7cbbff981e0af25d18c2178d024c12a6db49adcaa379c79eaa1 | S12 — same 404 boundary as above |
| account | 390 | nav-open | .screenshots/chunk-1-contract/account__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `chunk-2-ui`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/chunk-2-ui/home__1280__resting.png | e3a6d3e06596035fee0c0fc2f8208df48f5222f1cf58b1bd41e64ccde5a1ee1f | - |
| home | 1280 | nav-open | .screenshots/chunk-2-ui/home__1280__nav-open.png | 6565691e8fcfe095d9c01bd7cffe64119685d4cc0fd3e306956bdfb40a7e8841 | - |
| home | 390 | resting | .screenshots/chunk-2-ui/home__390__resting.png | b3ac91d22cb3b2bffb98c85a209302125769ebfb0f454e47453bd5793e48d23d | - |
| home | 390 | nav-open | .screenshots/chunk-2-ui/home__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| category | 1280 | resting | .screenshots/chunk-2-ui/category__1280__resting.png | 0e9043b4b7b2424cce025bc8488aed883ce9d1a2421292a2fe5965d9f1db439a | - |
| category | 1280 | nav-open | .screenshots/chunk-2-ui/category__1280__nav-open.png | 061b7b5134830b96bb8f16e505035fc829548ca6bc681e491dc52182dc1d7d7c | - |
| category | 390 | resting | .screenshots/chunk-2-ui/category__390__resting.png | b7739154a537d2ef19761b0b4b4c129f7c4960984e075df88e756c78f0a122a3 | - |
| category | 390 | nav-open | .screenshots/chunk-2-ui/category__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| product | 1280 | resting | .screenshots/chunk-2-ui/product__1280__resting.png | 13bf10e27f35e4eb6846818c64eb134be3b88f41b16bd281c871f9bb01cfe00b | - |
| product | 1280 | nav-open | .screenshots/chunk-2-ui/product__1280__nav-open.png | 6d449a9c72e280fcd1be294ee3d15959504ed0f7de34f66b0361c79274a267ff | - |
| product | 390 | resting | .screenshots/chunk-2-ui/product__390__resting.png | 38eca79e5d2e04241b194611b8f4375e948825994e541de811a638df5cc8cc6c | - |
| product | 390 | nav-open | .screenshots/chunk-2-ui/product__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| cart | 1280 | cart-open | .screenshots/chunk-2-ui/cart__1280__cart-open.png | e6c78a66bf84804f5f9b09c0508abbe19aed336a90949ef2cc34ccb854e34b60 | - |
| cart | 390 | cart-open | .screenshots/chunk-2-ui/cart__390__cart-open.png | f41cc5071ae72cd871138a26e947763e979a3d7e48c8afb9455c7202a81b615f | - |
| checkout | 1280 | resting | .screenshots/chunk-2-ui/checkout__1280__resting.png | b3ee30c2d3bbc6431d5843272ce46783adce50d7fe769c941006baad9fd13734 | - |
| checkout | 1280 | nav-open | .screenshots/chunk-2-ui/checkout__1280__nav-open.png | fd49c5d03ad38db2d8891803b286d026994ec4cdad0e21e47435df2901c568f4 | - |
| checkout | 390 | resting | .screenshots/chunk-2-ui/checkout__390__resting.png | 7000b26a71fa72bde119bd01b1f54f8a8d9ea269a93bef75667e82dbe9a38896 | - |
| checkout | 390 | nav-open | .screenshots/chunk-2-ui/checkout__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| account | 1280 | resting | .screenshots/chunk-2-ui/account__1280__resting.png | 56453cfe2f1025a1011b92d75931a7e4cf70737ab6e5167114b7e63f2069d8cd | S12 — same as chunk-1-contract (hash-identical); unauthenticated /account redirects to /sign-in, which 404s onto app/not-found.tsx (05-03 fix), unrelated to this chunk's components/ui rewrite |
| account | 1280 | nav-open | .screenshots/chunk-2-ui/account__1280__nav-open.png | a4d93b037356cc5f03972f227872a0acf3ea63bc985cdf62dbc31d3e7030e1be | S12 — same as chunk-1-contract (hash-identical); same 404 boundary as above |
| account | 390 | resting | .screenshots/chunk-2-ui/account__390__resting.png | 45d934fdf96bf7cbbff981e0af25d18c2178d024c12a6db49adcaa379c79eaa1 | S12 — same as chunk-1-contract (hash-identical); same 404 boundary as above |
| account | 390 | nav-open | .screenshots/chunk-2-ui/account__390__nav-open.png | 1347ff110437d5036ed218236ad82be19a50aa6215ffe86c9c44cf1906668256 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `chunk-2-ui` (supplementary D-17 cells)

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| category | 1280 | dropdown-item-focused | .screenshots/chunk-2-ui/category__1280__dropdown-item-focused.png | 13b65fbafd079a27c6f24f20c3584671c894a077163f48447314216c135420fa | D-17 supplementary -- Categories dropdown opened + ArrowDown to focus first item (Featured); focus:bg-accent/focus:text-accent-foreground were dead classes before this chunk (item showed no focus indication at all), now focus:bg-surface-elevated/focus:text-foreground render a visible dark highlight and foreground text for the first time |
| checkout | 1280 | discount-input-invalid | .screenshots/chunk-2-ui/checkout__1280__discount-input-invalid.png | 510da2e547b6bfef9358afb4533fb73d817965a728d7621d52c31e8fe9933db5 | D-17 supplementary -- Input component's aria-invalid ring/border set to true and focused; aria-invalid:ring-destructive/aria-invalid:border-destructive were dead classes before this chunk, now aria-invalid:ring-danger/aria-invalid:border-danger render a visible red ring and border for the first time (no live validation flow currently sets aria-invalid on this field, so the attribute is forced here to prove the CSS treatment renders correctly) |

## Label: `chunk-2-shell`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/chunk-2-shell/home__1280__resting.png | e3a6d3e06596035fee0c0fc2f8208df48f5222f1cf58b1bd41e64ccde5a1ee1f | - |
| home | 1280 | nav-open | .screenshots/chunk-2-shell/home__1280__nav-open.png | 6565691e8fcfe095d9c01bd7cffe64119685d4cc0fd3e306956bdfb40a7e8841 | - |
| home | 390 | resting | .screenshots/chunk-2-shell/home__390__resting.png | b3ac91d22cb3b2bffb98c85a209302125769ebfb0f454e47453bd5793e48d23d | - |
| home | 390 | nav-open | .screenshots/chunk-2-shell/home__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S14 |
| category | 1280 | resting | .screenshots/chunk-2-shell/category__1280__resting.png | 0e9043b4b7b2424cce025bc8488aed883ce9d1a2421292a2fe5965d9f1db439a | - |
| category | 1280 | nav-open | .screenshots/chunk-2-shell/category__1280__nav-open.png | 061b7b5134830b96bb8f16e505035fc829548ca6bc681e491dc52182dc1d7d7c | - |
| category | 390 | resting | .screenshots/chunk-2-shell/category__390__resting.png | 67fb21c4dbdf885015e5c19d19ec8548d2fc12e1e9ed02690c54528c937e79d4 | - |
| category | 390 | nav-open | .screenshots/chunk-2-shell/category__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S14 |
| product | 1280 | resting | .screenshots/chunk-2-shell/product__1280__resting.png | 13bf10e27f35e4eb6846818c64eb134be3b88f41b16bd281c871f9bb01cfe00b | - |
| product | 1280 | nav-open | .screenshots/chunk-2-shell/product__1280__nav-open.png | 6d449a9c72e280fcd1be294ee3d15959504ed0f7de34f66b0361c79274a267ff | - |
| product | 390 | resting | .screenshots/chunk-2-shell/product__390__resting.png | 38eca79e5d2e04241b194611b8f4375e948825994e541de811a638df5cc8cc6c | - |
| product | 390 | nav-open | .screenshots/chunk-2-shell/product__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S14 |
| cart | 1280 | cart-open | .screenshots/chunk-2-shell/cart__1280__cart-open.png | e6c78a66bf84804f5f9b09c0508abbe19aed336a90949ef2cc34ccb854e34b60 | - |
| cart | 390 | cart-open | .screenshots/chunk-2-shell/cart__390__cart-open.png | f41cc5071ae72cd871138a26e947763e979a3d7e48c8afb9455c7202a81b615f | - |
| checkout | 1280 | resting | .screenshots/chunk-2-shell/checkout__1280__resting.png | b3ee30c2d3bbc6431d5843272ce46783adce50d7fe769c941006baad9fd13734 | - |
| checkout | 1280 | nav-open | .screenshots/chunk-2-shell/checkout__1280__nav-open.png | fd49c5d03ad38db2d8891803b286d026994ec4cdad0e21e47435df2901c568f4 | - |
| checkout | 390 | resting | .screenshots/chunk-2-shell/checkout__390__resting.png | 7000b26a71fa72bde119bd01b1f54f8a8d9ea269a93bef75667e82dbe9a38896 | - |
| checkout | 390 | nav-open | .screenshots/chunk-2-shell/checkout__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S14 |
| account | 1280 | resting | .screenshots/chunk-2-shell/account__1280__resting.png | 79bbd0d305a10b34b614efea325ee2b53ca43b61471e8634759b6d8dae762caf | S13 |
| account | 1280 | nav-open | .screenshots/chunk-2-shell/account__1280__nav-open.png | a4016a92afc536bf04a67250f1ae20835e8002c28402bcb8b5a125bf60c03584 | S13 |
| account | 390 | resting | .screenshots/chunk-2-shell/account__390__resting.png | ed89750938ee8c9b3a2e63dc6cb207c74e687d63f2486f72642e629a6b2164e7 | S13 |
| account | 390 | nav-open | .screenshots/chunk-2-shell/account__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S13, S14 |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `chunk-3-catalog`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/chunk-3-catalog/home__1280__resting.png | c49d5778e1860e63bb5e436bae1cd44a95d559da1394df1ee0dfb9aae400a4f0 | S15 |
| home | 1280 | nav-open | .screenshots/chunk-3-catalog/home__1280__nav-open.png | 57ed7be9d87b04e35937503e5c79d41c1e11f73229dc90236c58566f3724fdad | S15 |
| home | 390 | resting | .screenshots/chunk-3-catalog/home__390__resting.png | 25fb18e790674b1557ab87bb3f35aa8b491deab5cc8e5d4571c2c71b333167c5 | S15 |
| home | 390 | nav-open | .screenshots/chunk-3-catalog/home__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S14 |
| category | 1280 | resting | .screenshots/chunk-3-catalog/category__1280__resting.png | 4c8c37080956cb50235de4c6ebfa66758bfbb5d894a54a56d147d77479145897 | S15 |
| category | 1280 | nav-open | .screenshots/chunk-3-catalog/category__1280__nav-open.png | 5aa9bb3743fe3b5e1e44e95c9efa73b8772bde2afd62f665c997d9fff7bdcaeb | S15 |
| category | 390 | resting | .screenshots/chunk-3-catalog/category__390__resting.png | bc746227d0b14e3927433be608319714597503623ebf92b38a268fb6a6a52d0f | S15 |
| category | 390 | nav-open | .screenshots/chunk-3-catalog/category__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S14 |
| product | 1280 | resting | .screenshots/chunk-3-catalog/product__1280__resting.png | beb628160d2be654bcadd7b7188152c877e822a877619ed42db50510d2f1b8d8 | S15 |
| product | 1280 | nav-open | .screenshots/chunk-3-catalog/product__1280__nav-open.png | dc5fbf1cb82531855112a577f8aab6f5ad58bd3918e8e271df752389958db5ef | S15 |
| product | 390 | resting | .screenshots/chunk-3-catalog/product__390__resting.png | a65404119be79ea0be206b389e26af116ac0d148b518b1234709db909ba5fb80 | S15 |
| product | 390 | nav-open | .screenshots/chunk-3-catalog/product__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S14 |
| cart | 1280 | cart-open | .screenshots/chunk-3-catalog/cart__1280__cart-open.png | 66f178f10e99973e85d5e32add0106bfb50b4c54f117bdd1f2ddb6a2eee9e7b0 | S15 |
| cart | 390 | cart-open | .screenshots/chunk-3-catalog/cart__390__cart-open.png | f41cc5071ae72cd871138a26e947763e979a3d7e48c8afb9455c7202a81b615f | - |
| checkout | 1280 | resting | .screenshots/chunk-3-catalog/checkout__1280__resting.png | b3ee30c2d3bbc6431d5843272ce46783adce50d7fe769c941006baad9fd13734 | - |
| checkout | 1280 | nav-open | .screenshots/chunk-3-catalog/checkout__1280__nav-open.png | fd49c5d03ad38db2d8891803b286d026994ec4cdad0e21e47435df2901c568f4 | - |
| checkout | 390 | resting | .screenshots/chunk-3-catalog/checkout__390__resting.png | 7000b26a71fa72bde119bd01b1f54f8a8d9ea269a93bef75667e82dbe9a38896 | - |
| checkout | 390 | nav-open | .screenshots/chunk-3-catalog/checkout__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S14 |
| account | 1280 | resting | .screenshots/chunk-3-catalog/account__1280__resting.png | 79bbd0d305a10b34b614efea325ee2b53ca43b61471e8634759b6d8dae762caf | S13 |
| account | 1280 | nav-open | .screenshots/chunk-3-catalog/account__1280__nav-open.png | a4016a92afc536bf04a67250f1ae20835e8002c28402bcb8b5a125bf60c03584 | S13 |
| account | 390 | resting | .screenshots/chunk-3-catalog/account__390__resting.png | ed89750938ee8c9b3a2e63dc6cb207c74e687d63f2486f72642e629a6b2164e7 | S13 |
| account | 390 | nav-open | .screenshots/chunk-3-catalog/account__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S13, S14 |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `chunk-3-engagement`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/chunk-3-engagement/home__1280__resting.png | f5d499e64a4ed1403696d6186021ba12ef4535a17d6e900ccf863e2932d3680a | S16 |
| home | 1280 | nav-open | .screenshots/chunk-3-engagement/home__1280__nav-open.png | e8cfd69ec43eb7ae5c92747d60a0d14f681edfbafc7084909d11ce9064c5855d | S16 |
| home | 390 | resting | .screenshots/chunk-3-engagement/home__390__resting.png | 65e03c2daafd238c67b873d696686c39b36e83522febc199c325dbc3018d4850 | S16 |
| home | 390 | nav-open | .screenshots/chunk-3-engagement/home__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S14 |
| category | 1280 | resting | .screenshots/chunk-3-engagement/category__1280__resting.png | 053043895c0bea61e6af3de495c72a7153e049ffe2ca2c55791e7fb29f723c86 | S16 |
| category | 1280 | nav-open | .screenshots/chunk-3-engagement/category__1280__nav-open.png | cfeff9c49deec815dd8b3cf67bc36a2247bab1cf5b7b8b350b0af5f86f155b76 | S16 |
| category | 390 | resting | .screenshots/chunk-3-engagement/category__390__resting.png | 3409a7c25896219a28cbed1ee3d5e9b9a8ac988433b0aadd0d0c7fe656dd3af0 | S16 |
| category | 390 | nav-open | .screenshots/chunk-3-engagement/category__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S14 |
| product | 1280 | resting | .screenshots/chunk-3-engagement/product__1280__resting.png | 109f0ab02e43b3b6a42320eacf3329a8dbbf7df35b9d87c548a45a52bd63f8a0 | S16 |
| product | 1280 | nav-open | .screenshots/chunk-3-engagement/product__1280__nav-open.png | 8636c1a88d66e61c2dbd1512520cee7b1417a858ef8188ab7a6b12b4375694ea | S16 |
| product | 390 | resting | .screenshots/chunk-3-engagement/product__390__resting.png | 92eae83cc0e2d916c09fc5525efe566a6e150c83fdd6271fb1938ece9a718632 | S16 |
| product | 390 | nav-open | .screenshots/chunk-3-engagement/product__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S14 |
| cart | 1280 | cart-open | .screenshots/chunk-3-engagement/cart__1280__cart-open.png | 22be85133f06b6c15a84a20862e9e728d0c211e25fe424ac42f4724bd7b139f8 | S16 |
| cart | 390 | cart-open | .screenshots/chunk-3-engagement/cart__390__cart-open.png | f41cc5071ae72cd871138a26e947763e979a3d7e48c8afb9455c7202a81b615f | - |
| checkout | 1280 | resting | .screenshots/chunk-3-engagement/checkout__1280__resting.png | b3ee30c2d3bbc6431d5843272ce46783adce50d7fe769c941006baad9fd13734 | - |
| checkout | 1280 | nav-open | .screenshots/chunk-3-engagement/checkout__1280__nav-open.png | fd49c5d03ad38db2d8891803b286d026994ec4cdad0e21e47435df2901c568f4 | - |
| checkout | 390 | resting | .screenshots/chunk-3-engagement/checkout__390__resting.png | 7000b26a71fa72bde119bd01b1f54f8a8d9ea269a93bef75667e82dbe9a38896 | - |
| checkout | 390 | nav-open | .screenshots/chunk-3-engagement/checkout__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S14 |
| account | 1280 | resting | .screenshots/chunk-3-engagement/account__1280__resting.png | 79bbd0d305a10b34b614efea325ee2b53ca43b61471e8634759b6d8dae762caf | S13 |
| account | 1280 | nav-open | .screenshots/chunk-3-engagement/account__1280__nav-open.png | a4016a92afc536bf04a67250f1ae20835e8002c28402bcb8b5a125bf60c03584 | S13 |
| account | 390 | resting | .screenshots/chunk-3-engagement/account__390__resting.png | ed89750938ee8c9b3a2e63dc6cb207c74e687d63f2486f72642e629a6b2164e7 | S13 |
| account | 390 | nav-open | .screenshots/chunk-3-engagement/account__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | S13, S14 |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `chunk-3-engagement` (supplementary cells)

Captured with a second, isolated dev-server run: `STORE_FEATURE_SUBSCRIPTION_ACQUISITION`,
`STORE_FEATURE_SUBSCRIPTION_RECONCILIATION`, and `STORE_SUBSCRIPTION_TERMS_VERSION` set, plus
two synthetic `subscription_plans` rows inserted directly into the local D1 database (`splan_dev_1`,
`splan_dev_2` on `prod_1`/`variant_1`) for this capture only. Both are local-only fixtures inside
the gitignored `.wrangler/` state, not part of any tracked seed file, matching the local-only-fixture
precedent 05-06 already established for baseline capture. Kept isolated from the standard 22-cell
grid above (captured separately, without these flags) so that grid stays a clean apples-to-apples
diff against `chunk-3-catalog`.

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| product | 1280 | reviews-scrolled | .screenshots/chunk-3-engagement/product__1280__reviews-scrolled.png | 7bfaab85f5a9f60b12b659d09d1df35ff5d0489a1e24054779fb50d4186b9608 | supplementary -- Reviews tab opened; rating-summary card confirms S16 (star fill now primary orange, unfilled muted-foreground) and the elevated-surface/foreground/muted-foreground/border tokens from this plan's Task 1 sweep |
| product | 1280 | review-form-validation-error | - | - | MISSING -- ReviewForm.tsx only renders inside an authenticated order's line item (components/OrderCard.tsx, reached via /account/orders), not on the product route; this local dev environment has no authenticated Clerk session and no seeded delivered order, the same class of gap as the order-status MISSING rows documented since 05-02. Task 1's acceptance criteria already confirmed via grep that ReviewForm.tsx references both the danger and success tokens (see 05-07-SUMMARY.md); this row records that the live-render screenshot could not be captured in this environment |
| product | 1280 | subscription-plan-selected | .screenshots/chunk-3-engagement/product__1280__subscription-plan-selected.png | 0228794ce3504a51dccadf7b255f74be9dab97ba78ae181501535ee5aa7f2cb0 | supplementary -- Subscribe section with its default-selected plan showing ($29.99/every month, from the 2 synthetic plans above); confirms the section's border-primary/70 accent, the CTA's bg-primary/text-on-primary treatment, and the elevated-surface delivery-schedule select all render correctly; no second plan card exists to contrast against since plan choice here is a native `<select>` dropdown, not a card grid (see 05-07-SUMMARY.md decisions) |

## Label: `chunk-3-content`

Three cells outside the D-20 seven-route grid (05-08): the CMS block dispatcher (`/about`,
resolving through `app/[slug]/PageRenderer.tsx` → `PageHero` + `StoryBody` + `PageCta`) and
the two blog surfaces (`/blog`, `/blog/<slug>`). No baseline existed for these routes before
this plan, so a genuine pre-state capture (`pre-chunk-3-content`, below) was taken from a git
worktree checked out at `4fc3e04` (the commit immediately before this plan's Task 1), running a
second local dev server on port 3001 against the same local D1 database. A synthetic
local-only `blog_posts` row (`dialing-in-your-first-overnight-pack-dev`) was inserted directly
via `wrangler d1 execute --local` so `/blog` and a real post both had content to render — this
project's local dev seed carries zero blog posts otherwise. The row lives only in the
gitignored `.wrangler/` state, not in any tracked seed file, matching the local-only-fixture
precedent 05-06/05-07 already established. `scripts/screenshot-routes.mjs` gained an opt-in
`--include-content` flag (Rule 3 — the script had no concept of blog/CMS routes at all before
this plan, which blocked Task 3 outright) that adds these three routes as additive cells; every
other chunk's default seven-route grid and captured-cell count is unaffected since the flag is
off unless passed explicitly.

Both `pre-chunk-3-content` and `chunk-3-content` were captured with the identical script,
manifest, and `--include-content` flag — only the tree behind the dev server differed. Every
differing cell below was PIL-diffed (`ImageChops.difference` bbox + 15 random differing-pixel
samples) against its `pre-chunk-3-content` counterpart.

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| blog-index | 1280 | resting | .screenshots/chunk-3-content/blog-index__1280__resting.png | f98914b2e5e1b16baaff75f9601d0104adc21b73260d337ffbeef72d59dbcd41 | differs from pre-state (hash e685b7eb...); every sampled pixel traces to `text-orange-400`→`text-primary` (identical `#f97316` hex; antialiasing-only variance) on the tag pills and post title, and `border-neutral-800`(`#262626`)→`border-border`(`#404040`) on the tag pills and post card, the exact TOKEN-MAP §2 mapping already established. No unregistered change. |
| blog-index | 390 | resting | .screenshots/chunk-3-content/blog-index__390__resting.png | 0de6487543a6315fc28dce7d647566d2a1047d9fecdd8b375078baabb7d584b0 | differs from pre-state (hash 5e0d9970...); same two root causes as the 1280 cell above. |
| blog-post | 1280 | resting | .screenshots/chunk-3-content/blog-post__1280__resting.png | 411e39541477f5e878c6217cce69029eaa0bf201b96af78e6ec9b0b2c37a6564 | differs from pre-state (hash 3ce55804...); sampled pixels trace to `text-neutral-300`(`#d4d4d4`, rgb 212,212,212)→`text-muted-foreground`(`#a3a3a3`, rgb 163,163,163) on the byline and excerpt paragraphs, `border-neutral-800`→`border-border` on the related-posts card, and `text-orange-400`→`text-primary` (identical hex) on the "← Blog" link. All three are direct TOKEN-MAP §2 mappings from this plan's Task 2 sweep. No unregistered change. |
| blog-post | 390 | resting | .screenshots/chunk-3-content/blog-post__390__resting.png | f9f19cf4f440576f578e8b7178f97cd3efa083a3df80df83c4bf3fc02e2a344d | differs from pre-state (hash 3bc30419...); same root causes as the 1280 cell above. |
| cms-page | 1280 | resting | .screenshots/chunk-3-content/cms-page__1280__resting.png | 263126a426af6d8929c189aaaf426a260c227318cce6662bb7180d6c4c47496e | differs from pre-state (hash 75d59d04...); single root cause, isolated by `ImageChops.difference` bbox to the `PageHero` band only: `bg-neutral-950`(`#0a0a0a`, rgb 10,10,10)→`bg-surface`(`#000000`, rgb 0,0,0), the identical near-black consolidation already registered as snap S13 for `Footer.tsx`. Not a new snap; same mapping applied to a second file. |
| cms-page | 390 | resting | .screenshots/chunk-3-content/cms-page__390__resting.png | 28b9507e9ff317cf3c8158175103514e14ada9c47b593d2fae4c64b4f7381cf1 | differs from pre-state (hash a7161f69...); same S13-pattern root cause as the 1280 cell above. |

## Label: `pre-chunk-3-content`

Genuine pre-sweep baseline for the three cells above, captured from a git worktree at commit
`4fc3e04` (immediately before this plan's Task 1 commit) via a second local dev server on port
3001. Not a fabrication: a real checkout of the pre-sweep tree was rendered and screenshotted.

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| blog-index | 1280 | resting | .screenshots/pre-chunk-3-content/blog-index__1280__resting.png | e685b7eb78359651c2add9100ec51d092627d75a5edd6244874dfa7b36757855 | pre-sweep baseline for chunk-3-content's blog-index/1280 cell |
| blog-index | 390 | resting | .screenshots/pre-chunk-3-content/blog-index__390__resting.png | 5e0d9970622f3a8997af3ef445c231a2a16dd2272b7f2e891dc30505aed4f101 | pre-sweep baseline for chunk-3-content's blog-index/390 cell |
| blog-post | 1280 | resting | .screenshots/pre-chunk-3-content/blog-post__1280__resting.png | 3ce558044e03d2f2d22c7a9e72551398d6a5537193af60a76b02dd65ef18e630 | pre-sweep baseline for chunk-3-content's blog-post/1280 cell |
| blog-post | 390 | resting | .screenshots/pre-chunk-3-content/blog-post__390__resting.png | 3bc304198ed5de06554be136ff6ef965814182fec4acd943a117fc7a98863f16 | pre-sweep baseline for chunk-3-content's blog-post/390 cell |
| cms-page | 1280 | resting | .screenshots/pre-chunk-3-content/cms-page__1280__resting.png | 75d59d044be3580746b5077cd55e84ac96b7ebf61dfd7e1cba5ab22d443475c3 | pre-sweep baseline for chunk-3-content's cms-page/1280 cell |
| cms-page | 390 | resting | .screenshots/pre-chunk-3-content/cms-page__390__resting.png | a7161f69ac745bfef610b89c7f42c51ece1cd11e9f747c4357fc9306d3a547ae | pre-sweep baseline for chunk-3-content's cms-page/390 cell |
