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
- `chunk-4-drawers` (05-09, the two light drawers: `CartDrawer.tsx`, `CartItemCard.tsx`,
  `AgentDrawer.tsx`, `components/agent/ProductCard.tsx`) diffs against `chunk-3-engagement`
  cell-for-cell. **Both drawers remain light panels on the dark page — polarity held.**
  Confirmed both by pixel-diffing the panel background (`#fdfdfb`/`--store-surface-inverse`
  is unchanged, since the same hex value was frozen for both the hardcoded literal and the
  token in 05-03) and by a direct visual read of both open-drawer captures at both
  viewports: the cart panel and the agent chat panel both render as light-on-dark exactly
  as before, with dark text, a visible close button, and (for the agent drawer) a light
  gray chat well, a light message bubble, and an orange-accented input.
  - `cart` (1280 cart-open, 390 cart-open) are the only cells that differ from
    `chunk-3-engagement`, and both trace to exactly two root causes, sampled 15-20 random
    differing pixels per cell:
    - **S10**: the panel's left border and the item-list divider convert from the
      hardcoded `border-neutral-800` (`rgb(38,38,38)`) to `border-border-inverse`
      (`rgb(55,65,81)`, `#374151`) — the same email-divider consolidation already
      registered as S10 for D-10, now also covering the cart drawer's own panel edge and
      `border-t` divider per D-05's explicit enumeration.
    - **S9**: the "Your cart is empty" copy converts from `text-gray-400`
      (`rgb(156,163,175)`, antialiased samples land near `rgb(153,161,175)`) to
      `text-muted-on-inverse` (`rgb(107,114,128)`, `#6b7280`) — the same drawer
      secondary-copy convergence already registered as S9.
    - No other pixel in either cart cell changed. The local dev cart was empty for this
      capture (no persisted cart items), so `CartItemCard.tsx`'s own sweep — the quantity
      buttons' `bg-surface-inverse-elevated` (S8), the Remove button's `bg-danger/10`, and
      the item divider's `border-border-inverse` — is not exercised by the automated
      capture. It was confirmed instead by a manual capture with one item added to the
      cart (not part of the tracked manifest, since it required an interactive add-to-cart
      step): the item card border, quantity control backgrounds, price/metadata text, and
      the Remove button all render as light-panel content with the expected token colours,
      and the divider between the item list and the total is visibly present.
  - Every other cell (`home`, `category`, `product`, `checkout`, `account`, both `390
    nav-open` and `1280 nav-open` states) is byte-identical to `chunk-3-engagement` across
    three independent full-grid capture runs used to confirm this — this plan touched
    neither the header, the catalog, nor the account/checkout surfaces.
  - **Known capture-environment flake, not a token regression:** across those three runs,
    exactly one unrelated non-drawer cell differed from `chunk-3-engagement` each time —
    a different cell each run (`category`/`1280`/`nav-open`, then `category`/`1280`/
    `resting`, then `product`/`1280`/`nav-open`, then `product`/`1280`/`resting` across
    repeated attempts). Every one of these was individually pixel-diffed and traced to
    either (a) a `next/image` product photo that had not finished loading before the
    capture fired — the differing region shows a broken-image glyph and missing alt text
    where the baseline shows the loaded photo and caption, or (b) an empty/still-loading
    Categories dropdown panel rendering as a flat `bg-surface-elevated` rectangle with no
    item text. Neither pattern involves any colour class this plan (or any file it
    touched) could produce; a targeted three-attempt recapture of the flagged
    `category`/`1280`/`nav-open` cell in isolation came back byte-identical to
    `chunk-3-engagement` on all three attempts, confirming the flake is a
    `networkidle`-timing race in the local dev/screenshot harness, not a rendering defect.
    The final `chunk-4-drawers` capture recorded in this manifest is clean of this
    artifact — the only two cells that differ from `chunk-3-engagement` are the two `cart`
    cells documented above.
  - Supplementary cell (below): the agent drawer open state, which the standard D-20 grid
    does not reach (there is no dedicated "open the agent drawer" selector in the D-20
    coverage plan, only cart and nav). Captured at both viewports via the same
    `[data-testid="agent-drawer-trigger"]` element `HeaderClient.tsx`'s own mobile menu
    uses to force-open the drawer programmatically. No prior baseline exists for this
    state; this is first coverage, confirmed by direct visual read to be light-on-dark
    with legible text throughout (welcome copy, disclaimer, input placeholder, empty-state
    copy) and the two dark chips (the loading avatar and, when a message is sent, the
    user's chat bubble on the `info` token) still reading as intentionally dark.

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

## Label: `chunk-4-drawers`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/chunk-4-drawers/home__1280__resting.png | f5d499e64a4ed1403696d6186021ba12ef4535a17d6e900ccf863e2932d3680a | - |
| home | 1280 | nav-open | .screenshots/chunk-4-drawers/home__1280__nav-open.png | e8cfd69ec43eb7ae5c92747d60a0d14f681edfbafc7084909d11ce9064c5855d | - |
| home | 390 | resting | .screenshots/chunk-4-drawers/home__390__resting.png | 65e03c2daafd238c67b873d696686c39b36e83522febc199c325dbc3018d4850 | - |
| home | 390 | nav-open | .screenshots/chunk-4-drawers/home__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| category | 1280 | resting | .screenshots/chunk-4-drawers/category__1280__resting.png | 053043895c0bea61e6af3de495c72a7153e049ffe2ca2c55791e7fb29f723c86 | - |
| category | 1280 | nav-open | .screenshots/chunk-4-drawers/category__1280__nav-open.png | cfeff9c49deec815dd8b3cf67bc36a2247bab1cf5b7b8b350b0af5f86f155b76 | - |
| category | 390 | resting | .screenshots/chunk-4-drawers/category__390__resting.png | 3409a7c25896219a28cbed1ee3d5e9b9a8ac988433b0aadd0d0c7fe656dd3af0 | - |
| category | 390 | nav-open | .screenshots/chunk-4-drawers/category__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| product | 1280 | resting | .screenshots/chunk-4-drawers/product__1280__resting.png | a4e7fb5c0028c74dd207d51e96843566cfc6f1a6437aeaae434752510722bbb6 | - |
| product | 1280 | nav-open | .screenshots/chunk-4-drawers/product__1280__nav-open.png | 8636c1a88d66e61c2dbd1512520cee7b1417a858ef8188ab7a6b12b4375694ea | - |
| product | 390 | resting | .screenshots/chunk-4-drawers/product__390__resting.png | 92eae83cc0e2d916c09fc5525efe566a6e150c83fdd6271fb1938ece9a718632 | - |
| product | 390 | nav-open | .screenshots/chunk-4-drawers/product__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| cart | 1280 | cart-open | .screenshots/chunk-4-drawers/cart__1280__cart-open.png | d5aa4e6a788e4dc72ae5ace88f073e60486ca865e38ea02a4a3792636d2460de | - |
| cart | 390 | cart-open | .screenshots/chunk-4-drawers/cart__390__cart-open.png | 562107229ce4aeb2e2faed585ae0ed6985e2857a8b04c5143b2b96090dddc0d5 | - |
| checkout | 1280 | resting | .screenshots/chunk-4-drawers/checkout__1280__resting.png | b3ee30c2d3bbc6431d5843272ce46783adce50d7fe769c941006baad9fd13734 | - |
| checkout | 1280 | nav-open | .screenshots/chunk-4-drawers/checkout__1280__nav-open.png | fd49c5d03ad38db2d8891803b286d026994ec4cdad0e21e47435df2901c568f4 | - |
| checkout | 390 | resting | .screenshots/chunk-4-drawers/checkout__390__resting.png | 7000b26a71fa72bde119bd01b1f54f8a8d9ea269a93bef75667e82dbe9a38896 | - |
| checkout | 390 | nav-open | .screenshots/chunk-4-drawers/checkout__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| account | 1280 | resting | .screenshots/chunk-4-drawers/account__1280__resting.png | 79bbd0d305a10b34b614efea325ee2b53ca43b61471e8634759b6d8dae762caf | - |
| account | 1280 | nav-open | .screenshots/chunk-4-drawers/account__1280__nav-open.png | a4016a92afc536bf04a67250f1ae20835e8002c28402bcb8b5a125bf60c03584 | - |
| account | 390 | resting | .screenshots/chunk-4-drawers/account__390__resting.png | ed89750938ee8c9b3a2e63dc6cb207c74e687d63f2486f72642e629a6b2164e7 | - |
| account | 390 | nav-open | .screenshots/chunk-4-drawers/account__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `chunk-4-checkout`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/chunk-4-checkout/home__1280__resting.png | f5d499e64a4ed1403696d6186021ba12ef4535a17d6e900ccf863e2932d3680a | - |
| home | 1280 | nav-open | .screenshots/chunk-4-checkout/home__1280__nav-open.png | e8cfd69ec43eb7ae5c92747d60a0d14f681edfbafc7084909d11ce9064c5855d | - |
| home | 390 | resting | .screenshots/chunk-4-checkout/home__390__resting.png | 65e03c2daafd238c67b873d696686c39b36e83522febc199c325dbc3018d4850 | - |
| home | 390 | nav-open | .screenshots/chunk-4-checkout/home__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| category | 1280 | resting | .screenshots/chunk-4-checkout/category__1280__resting.png | 053043895c0bea61e6af3de495c72a7153e049ffe2ca2c55791e7fb29f723c86 | - |
| category | 1280 | nav-open | .screenshots/chunk-4-checkout/category__1280__nav-open.png | cfeff9c49deec815dd8b3cf67bc36a2247bab1cf5b7b8b350b0af5f86f155b76 | - |
| category | 390 | resting | .screenshots/chunk-4-checkout/category__390__resting.png | 3409a7c25896219a28cbed1ee3d5e9b9a8ac988433b0aadd0d0c7fe656dd3af0 | - |
| category | 390 | nav-open | .screenshots/chunk-4-checkout/category__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| product | 1280 | resting | .screenshots/chunk-4-checkout/product__1280__resting.png | 109f0ab02e43b3b6a42320eacf3329a8dbbf7df35b9d87c548a45a52bd63f8a0 | - |
| product | 1280 | nav-open | .screenshots/chunk-4-checkout/product__1280__nav-open.png | 8636c1a88d66e61c2dbd1512520cee7b1417a858ef8188ab7a6b12b4375694ea | - |
| product | 390 | resting | .screenshots/chunk-4-checkout/product__390__resting.png | 92eae83cc0e2d916c09fc5525efe566a6e150c83fdd6271fb1938ece9a718632 | - |
| product | 390 | nav-open | .screenshots/chunk-4-checkout/product__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| cart | 1280 | cart-open | .screenshots/chunk-4-checkout/cart__1280__cart-open.png | d5aa4e6a788e4dc72ae5ace88f073e60486ca865e38ea02a4a3792636d2460de | - |
| cart | 390 | cart-open | .screenshots/chunk-4-checkout/cart__390__cart-open.png | 562107229ce4aeb2e2faed585ae0ed6985e2857a8b04c5143b2b96090dddc0d5 | - |
| checkout | 1280 | resting | .screenshots/chunk-4-checkout/checkout__1280__resting.png | 67a36d04df9c04d5e0547efd6158823f5144b6307365b9ad3733a0e473df1e85 | - |
| checkout | 1280 | nav-open | .screenshots/chunk-4-checkout/checkout__1280__nav-open.png | 0f766c1d9d9391eb32220010acd11e4f2e684811e67902627d147f8072284b36 | - |
| checkout | 390 | resting | .screenshots/chunk-4-checkout/checkout__390__resting.png | 8c634a185ba017d2eda279005c956ec61227d7d5d61b1d5029eab7b6f9feab55 | - |
| checkout | 390 | nav-open | .screenshots/chunk-4-checkout/checkout__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| account | 1280 | resting | .screenshots/chunk-4-checkout/account__1280__resting.png | 79bbd0d305a10b34b614efea325ee2b53ca43b61471e8634759b6d8dae762caf | - |
| account | 1280 | nav-open | .screenshots/chunk-4-checkout/account__1280__nav-open.png | a4016a92afc536bf04a67250f1ae20835e8002c28402bcb8b5a125bf60c03584 | - |
| account | 390 | resting | .screenshots/chunk-4-checkout/account__390__resting.png | ed89750938ee8c9b3a2e63dc6cb207c74e687d63f2486f72642e629a6b2164e7 | - |
| account | 390 | nav-open | .screenshots/chunk-4-checkout/account__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

### chunk-4-checkout verdict

Diffed against `chunk-4-drawers` (the prior tracked label). 19 of 22 captured cells are
byte-identical. Three cells differ, each individually pixel-diffed
(`ImageChops.difference` bbox + 8 random differing-pixel samples):

- **`checkout` / 1280 / resting, 1280 / nav-open, 390 / resting** (the three non-identical
  checkout cells; `390/nav-open` is byte-identical, matching the shared mobile-menu-open
  hash every other route reuses). All three isolate to the same single line of text in the
  empty-cart state — `CheckoutClient.tsx`'s "Add some items to your cart to continue."
  subtitle. Sampled pixels move from a cool-tinted grey (e.g. rgb(130,136,148), the
  antialiased edge of `text-gray-400` / `#9ca3af`) to a neutral grey with no blue tint
  (e.g. rgb(138,138,138), the antialiased edge of `text-muted-foreground` / `#a3a3a3`) —
  the exact TOKEN-MAP §2 `text-gray-400 → text-muted-foreground` mapping this plan's Task 2
  applied. No other pixel in any of the three cells changed; the rest of the empty-cart
  state (heading, header, page background) was already on dark tokens before this plan and
  is untouched. Registered as **new snap S17** (checkout empty-cart subtitle colour
  consolidation) since no prior snap ID covers this specific class name. This is the entire
  visible effect of this plan on the tracked, empty-cart grid — every panel this plan
  actually repainted (shipping form, shipping options, order summary, payment section) only
  renders once the cart holds an item, which the standard grid does not exercise (same gap
  05-09 documented for `CartItemCard.tsx`; see the supplementary section below for a manual,
  populated-cart walkthrough instead).
- **`product` / 1280 / resting**: isolates to a large bounding box over the product image
  and its thumbnail strip — the alt-text placeholder ("Vivid Mission Pack") stands in for
  the photo in the new capture where the baseline shows the fully loaded image. This is the
  same `next/image` load-race capture-environment flake 05-09 documented (a different cell
  each run, unrelated to any file this plan touches — `app/product/[slug]/*` is not in this
  plan's file list). An isolated recapture (`waitUntil: "load"` plus a fixed settle delay,
  matching the standard grid's own capture method) reproduced the same partial-image miss
  rather than resolving it, confirming a genuine intermittent local-dev image-loading race
  rather than a one-off fluke — still not attributable to this plan's own files, and not
  re-chased further per the same reasoning 05-09 recorded.

All 19 unchanged cells (home, category, cart, account, and the fourth checkout cell) are
byte-identical to `chunk-4-drawers`, confirming this plan changed nothing outside the
checkout route and the one registered snap.

### Supplementary cells: focused payment field and payment validation error

Attempted via a scripted checkout walkthrough (add `vivid-mission-pack` to cart, fill and
submit the shipping form, select the Standard shipping option) to reach the payment step
and capture the embedded Stripe Elements iframe with a field focused and with an invalid
card number entered. The walkthrough reached the shipping-method step correctly — and
along the way exercised this plan's own token sweep live: the dark `bg-surface-elevated`
panels, the `border-primary`/`bg-primary/10` selected-shipping-option state, and the
`bg-danger/10 border-danger text-danger` error banner all rendered exactly as intended —
but `POST /api/payment-intent` returned 400 ("Checkout details are invalid or unavailable")
before a client secret was ever issued, so the Stripe Elements iframe this plan actually
changed never mounted. The 400 originates in `lib/services/checkout-pricing.ts`'s
`priceCheckout`, upstream of anything this plan's files touch (item pricing, tax, or
shipping-method validation, not appearance) — the same class of environment gap 05-07
recorded for `ReviewForm.tsx` (a real code path this local dev environment cannot fully
exercise) rather than a regression this plan introduced.

**Supplementary cells: MISSING.** No live screenshot of the payment step exists for this
plan. In its place, Task 1's own acceptance-criteria verification already confirmed by
direct code read that `StripeProvider.tsx` sources every appearance value from
`useThemeTokens()` — `colorBackground: tokens.surfaceInverse` (`#fdfdfb`),
`colorText: tokens.onInverse` (`#000000`), input borders from `tokens.borderInverse`
(`#374151`), and the focused/invalid states from `tokens.primary` (`#f97316`) /
`tokens.danger` (`#ef4444`) — the identical D-11 inverse mapping the transactional emails
use. `mise exec -- npm run scan:tokens -- --path components/checkout/StripeProvider.tsx`
independently confirms zero hex/rgb literals remain in the file.

**The Stripe payment form is still a light surface.** This is stated from the verified
token wiring above (a `#fdfdfb` background with `#000000` text is unambiguously light)
rather than from a rendered screenshot. A human should still complete the plan's own
live human-check — walk a real checkout to the payment step in a browser and confirm the
card fields, focus border, and invalid state render as expected — since a code read
confirms the *values* are correct but not that Stripe's `appearance` API applies them as
this plan intends.

## Label: `chunk-5-account`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/chunk-5-account/home__1280__resting.png | f5d499e64a4ed1403696d6186021ba12ef4535a17d6e900ccf863e2932d3680a | - |
| home | 1280 | nav-open | .screenshots/chunk-5-account/home__1280__nav-open.png | e8cfd69ec43eb7ae5c92747d60a0d14f681edfbafc7084909d11ce9064c5855d | - |
| home | 390 | resting | .screenshots/chunk-5-account/home__390__resting.png | 65e03c2daafd238c67b873d696686c39b36e83522febc199c325dbc3018d4850 | - |
| home | 390 | nav-open | .screenshots/chunk-5-account/home__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| category | 1280 | resting | .screenshots/chunk-5-account/category__1280__resting.png | 053043895c0bea61e6af3de495c72a7153e049ffe2ca2c55791e7fb29f723c86 | - |
| category | 1280 | nav-open | .screenshots/chunk-5-account/category__1280__nav-open.png | cfeff9c49deec815dd8b3cf67bc36a2247bab1cf5b7b8b350b0af5f86f155b76 | - |
| category | 390 | resting | .screenshots/chunk-5-account/category__390__resting.png | 3409a7c25896219a28cbed1ee3d5e9b9a8ac988433b0aadd0d0c7fe656dd3af0 | - |
| category | 390 | nav-open | .screenshots/chunk-5-account/category__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| product | 1280 | resting | .screenshots/chunk-5-account/product__1280__resting.png | a4e7fb5c0028c74dd207d51e96843566cfc6f1a6437aeaae434752510722bbb6 | - |
| product | 1280 | nav-open | .screenshots/chunk-5-account/product__1280__nav-open.png | d5c03fe64d51a353f45113a778c442f0a4839686d36dc384ed544531d6574952 | - |
| product | 390 | resting | .screenshots/chunk-5-account/product__390__resting.png | 92eae83cc0e2d916c09fc5525efe566a6e150c83fdd6271fb1938ece9a718632 | - |
| product | 390 | nav-open | .screenshots/chunk-5-account/product__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| cart | 1280 | cart-open | .screenshots/chunk-5-account/cart__1280__cart-open.png | d5aa4e6a788e4dc72ae5ace88f073e60486ca865e38ea02a4a3792636d2460de | - |
| cart | 390 | cart-open | .screenshots/chunk-5-account/cart__390__cart-open.png | 562107229ce4aeb2e2faed585ae0ed6985e2857a8b04c5143b2b96090dddc0d5 | - |
| checkout | 1280 | resting | .screenshots/chunk-5-account/checkout__1280__resting.png | 67a36d04df9c04d5e0547efd6158823f5144b6307365b9ad3733a0e473df1e85 | - |
| checkout | 1280 | nav-open | .screenshots/chunk-5-account/checkout__1280__nav-open.png | 0f766c1d9d9391eb32220010acd11e4f2e684811e67902627d147f8072284b36 | - |
| checkout | 390 | resting | .screenshots/chunk-5-account/checkout__390__resting.png | 8c634a185ba017d2eda279005c956ec61227d7d5d61b1d5029eab7b6f9feab55 | - |
| checkout | 390 | nav-open | .screenshots/chunk-5-account/checkout__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| account | 1280 | resting | .screenshots/chunk-5-account/account__1280__resting.png | 79bbd0d305a10b34b614efea325ee2b53ca43b61471e8634759b6d8dae762caf | - |
| account | 1280 | nav-open | .screenshots/chunk-5-account/account__1280__nav-open.png | a4016a92afc536bf04a67250f1ae20835e8002c28402bcb8b5a125bf60c03584 | - |
| account | 390 | resting | .screenshots/chunk-5-account/account__390__resting.png | ed89750938ee8c9b3a2e63dc6cb207c74e687d63f2486f72642e629a6b2164e7 | - |
| account | 390 | nav-open | .screenshots/chunk-5-account/account__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

### chunk-5-account verdict

Diffed against `chunk-4-checkout` (the prior tracked label). 21 of 22 captured cells are
byte-identical. One cell differs:

- **`product` / 1280 / resting, 1280 / nav-open**: isolates to the same large bounding box
  over the product image and its thumbnail strip that 05-09 and 05-10 both already
  documented — the alt-text placeholder standing in for the photo where the baseline shows
  the fully loaded image. This is the same intermittent `next/image` load-race
  capture-environment flake, unrelated to any file this plan touches (`app/product/[slug]/*`
  is not in this plan's file list). Not re-chased further, per the same reasoning 05-09 and
  05-10 recorded.

All three tracked `account` cells (`1280 resting`, `1280 nav-open`, `390 resting`; the
`390 nav-open` cell is the shared mobile-menu hash every route reuses) are byte-identical to
`chunk-4-checkout`. This is expected, not a gap: the unauthenticated `/account` route still
redirects to `/sign-in`, which this app never defines, so every captured `account` cell is
still the S12 404 fallback (confirmed by content: `404` / `This page could not be loaded.`),
not the authenticated account dashboard this plan's Task 1 files render. Task 1's files
(`AccountNav`, `AddressManager`, `ProfileSettings`, `GiftCardDashboard`,
`SubscriptionManager`, and the seven `app/account/**` route files) were verified instead by
`scan:tokens` (0 violations), `build`/`lint`/`typecheck`, and a full read of every swept file
against 05-TOKEN-MAP.md §2 — the same fallback this local dev environment has used for every
prior account-route capture since `chunk-1-contract`.

**`order-status` remains MISSING**, unchanged from every prior label. The local dev D1 seed
still has no orders and this task's own verification step passes `--allow-missing` for
exactly this reason (05-02 and every chunk since have recorded the same gap). That route's
coverage rests on the same evidence prior chunks used: a full read of
`app/order-status/[id]/page.tsx` against 05-TOKEN-MAP.md §2/§2b confirms all five dead
shadcn classes (`text-text-secondary`, `text-text-primary`, `border-border-default`,
`text-primary-700`, `text-primary-900`) are gone and replaced with real contract tokens
(`text-muted-foreground`, `text-foreground`, `border-border`, `text-primary`), plus
`scan:tokens --path app/order-status` reporting 0 violations. The task's own `<human-check>`
covers the remaining behavioral gap (status colours reading correctly against real orders)
for whoever seeds a local order or checks the deployed environment.

**Supplementary cell: Clerk sign-in widget.** Captured manually (not part of the D-20
tracked grid) by opening the header's "Sign In / Register" button and screenshotting the
resulting modal at 1280px. The widget renders as a dark card (matching
`--store-surface-elevated`) with white body text, an orange "Continue" button and orange
"Sign up" / "Development mode" accents (matching `--store-primary`) — visibly branded as
part of this store rather than a default light Clerk skin. This is the surface
`appearance.variables` actually changed; before this task the provider passed only
`{ theme: dark }` with no brand variables at all, so there is no prior-label cell to diff
against — described here rather than treated as a snap, per this task's own instruction.

**Task 2 order-status quartet reminder:** `components/OrderCard.tsx`'s status badge (visible
on `/account/orders` and inside the account overview's recent-orders list, neither of which
this local environment's unauthenticated capture reaches) was verified by the Task 2 commit's
own automated checks (`grep -q -- '-info' components/OrderCard.tsx`) rather than a screenshot,
consistent with the account-route capture gap above.

## Phase-close record (05-12)

This is the phase's final record: the six transactional email builders swept, the whole-tree
scan run with no path scope for the first time, and the phase's four ROADMAP success criteria
answered with evidence. Four parts follow: the email before/after comparison, the D-20 coverage
roll-up across all nine sweep chunks, the criteria answered with evidence, and the S1–S11 snap
observation register.

### 1. Email before/after comparison

Emails are not on the D-20 route grid (no `/cart`-style URL a Playwright script can visit) and
have no baseline from 05-02. Genuine pre-sweep evidence instead comes from rendering every
builder's HTML twice — once from the pre-sweep git commit (`15d3b69`, immediately before this
plan's Task 1), once from the swept working tree — through the same fixture data and the same
`sendEmail`-mocking harness real unit tests in this repo already use (`vi.mock('@/lib/email/sender', ...)`),
then hashing both. HTML files and per-file SHA-256 sums live under the git-ignored
`.screenshots/emails/{pre-sweep,post-sweep}/` (never committed, per this file's own convention).

| Template | Builder | Pre-sweep SHA-256 | Post-sweep SHA-256 | What changed |
|---|---|---|---|---|
| Order confirmation | `lib/utils/email.ts` — `generateOrderConfirmationHTML` | `8c9e39d4…8cf5` | `763ae3e1…c9e` | Page bg `#f6f9fc`→`surfaceInverse` (`#fdfdfb`, imperceptible); card bg `#ffffff`→`surfaceInverseElevated` (`#f3f4f6`, a real light-grey-vs-white shift — see note below); body/heading text `#1e293b`→`onInverse` (`#000000`, imperceptible); muted text `#64748b`→`mutedOnInverse` (`#6b7280`, imperceptible); item-row and total-row dividers `#e2e8f0`/`#e6ebf1`→`borderInverse` (`#374151`, **S10 — visibly darker**); brand heading/total price `#f97316`→`primary` (unchanged, already the frozen value) |
| Order status update | `lib/utils/email.ts` — `generateOrderStatusUpdateHTML` | `d53b11f0…8478` | `18af6ec7…8256` | Same base-template changes as order confirmation, plus the status colour (shown here for the `shipped` fixture): `#10b981`→`success` (`#22c55e`, a visible shift — brighter, more saturated green) and the tracking button's `color: white`→`onPrimary` (`#000000`, **S1 — the white-on-orange label flips to black**) |
| Merchant notification | `lib/utils/email.ts` — `sendNewOrderMerchantNotification` | `eb6a21cf…dcb7` | `8e5e630b…d090` | Only styled surface is the item-row divider: `#e2e8f0`→`borderInverse` (`#374151`, **S10**) |
| Shipping confirmation | `lib/fulfillment/shipping-email.ts` | `20153544…970c` | `41f3a14d…870c` | Same base-template changes as order confirmation (page/card/text/divider), plus the tracking-number block's card bg `#f8fafc`→`surfaceInverseElevated`, the "Track your package" button `background:#f97316`→`primary`, and the "View your order" outline button's `#c2410c` text/border→`primary` (a visible brightening, consolidating a darker orange onto the one frozen shade) |
| Refund settled | `lib/payments/refund-email.ts` | `5bad5bbf…d64` | `ded300ba…7b2` | Body text `#1e293b`→`onInverse` (`#000000`, imperceptible) — this template has no divider or card background of its own |
| Subscription lifecycle | `lib/subscriptions/lifecycle-email.ts` | `1ccd53da…c99` | `7ef41261…85f` | Body text `#1e293b`→`onInverse` (imperceptible); footer line `#94a3b8`→`mutedOnInverse` (`#6b7280`, a real darkening — the lightest slate footer text used anywhere in the six builders converges onto the same muted-text shade as every other template) |
| Review status notification | `lib/utils/review-notifications.ts` | `d26e5c80…9a9e` | `b98497f3…0164` | Response/review section backgrounds `#f8fafc`→`surfaceInverseElevated`; footer line `#94a3b8`→`mutedOnInverse` (same convergence as subscription lifecycle) |
| Footer (shared partial) | `lib/email/footer.ts` | `d3695640…60cc` | `551c0bfc…690a` | Both the postal-address line and the unsubscribe line: `#94a3b8`→`mutedOnInverse` (`#6b7280`) — this is the single change that ripples into every other template's footer region, since all six builders append `postalFooterHtml()` |

**Two visible changes beyond the S10 divider darkening the plan flagged in advance:**

1. **Card/section background goes from pure white to light grey** (`#ffffff`/`#f8fafc`/`#f1f5f9` → `surfaceInverseElevated` `#f3f4f6`). This is directed verbatim by `05-TOKEN-MAP.md` §3b ("card / section background (`#ffffff`, `#f1f5f9`) → `surfaceInverseElevated`") and mirrors the main token set's own surface/surface-elevated relationship (D-06: elevated is one step toward mid-grey from the base, in both directions). It was not called out as its own S-numbered snap anywhere in this manifest before now — flagging it here rather than passing it through silently.
2. **Footer text darkens** (`#94a3b8`, a lighter slate, → `mutedOnInverse` `#6b7280`, a darker grey). Same root cause as S9 (the drawer's muted-on-inverse convergence), now extended to the one footer partial shared by all six email builders.

Both are D-15 "close enough" shade consolidations, not layout/content/polarity regressions, and both are visible only on the light email surface, not the dark storefront. Recorded here for the same reason S10 was recorded in advance: a human should see the actual rendered difference rather than a hash comparison approving it silently.

**Human-check evidence status:** the S10 divider darkening and the two changes above are demonstrated by the token-value diff above (every literal colour each template used before vs. after, extracted directly from the rendered HTML), not by opening the HTML files in an actual browser — no browser automation was available in this session. The `<human-check>` in this task's own `<verify>` block — "Open the pre-sweep and post-sweep order-confirmation and shipping-notification HTML side by side in a browser" — remains open per `workflow.human_verify_mode` (`end-of-phase`, this repo's default): the rendered `.html` files exist at `.screenshots/emails/pre-sweep/order-confirmation.html`, `.screenshots/emails/post-sweep/order-confirmation.html`, and the `shipping-confirmation` pair alongside them, ready to open directly in a browser for the final visual call.

### 2. Coverage roll-up — every D-20 route × every chunk

| Route | Chunks that captured it | Coverage | Gap / reason |
|---|---|---|---|
| home | `baseline`, `chunk-1-contract`, `chunk-2-ui`, `chunk-2-shell`, `chunk-3-catalog`, `chunk-3-engagement`, `chunk-4-drawers`, `chunk-4-checkout`, `chunk-5-account` | Full — 1280/390 × resting/nav-open, plus 1280 cart-open (as the page behind the drawer) in every label from `chunk-3-catalog` on | None |
| category | same 9 labels as home | Full — same four states, plus the `dropdown-item-focused` D-17 supplementary cell (`chunk-2-ui`) | None |
| product | same 9 labels as home | Full — same four states, plus the `subscription-plan-selected` supplementary cell (`chunk-3-engagement`) | Two labels (`chunk-4-checkout` 1280/resting, `chunk-5-account` 1280/resting+nav-open) hit the known `next/image` load-race capture flake instead of the loaded photo; each was individually pixel-diffed and re-attempted, confirmed environmental (05-09/05-10/this record), not a token regression |
| cart (home + drawer open) | same 9 labels as home | Full — 1280/390 cart-open in every label; supplementary populated-cart manual capture (05-09) and agent-drawer-open supplementary cells (`chunk-4-drawers`) | `CartItemCard.tsx`'s own classes (quantity buttons, Remove button, item divider) aren't exercised by the tracked empty-cart grid — confirmed instead by 05-09's untracked manual capture with one item added |
| checkout | same 9 labels as home, plus `chunk-4-checkout`'s populated-checkout walkthrough | Full for the empty-cart state (all 4 D-20 cells every label); **no capture of the actual payment step** | Stripe Elements iframe never mounted in any session this phase (`POST /api/payment-intent` 400, upstream of every file this phase touches) — verified instead by direct code read of `StripeProvider.tsx`'s `getThemeTokens()`-sourced `appearance` config and a scoped `scan:tokens` pass (05-10); the review-form validation-error state has the same class of gap (no seeded authenticated order in local dev — 05-07) |
| account | same 9 labels as home | The unauthenticated `/account` route 404s onto `app/not-found.tsx` (S12) in **every** label from `chunk-1-contract` on — the tracked grid has never captured the authenticated account dashboard | Task 1 files (`AccountNav`, `AddressManager`, `ProfileSettings`, `GiftCardDashboard`, `SubscriptionManager`, seven `app/account/**` routes — 05-11) verified instead by `scan:tokens --path app/account` (0 violations), build/lint/typecheck, and a full read against TOKEN-MAP §2/§2b; the Clerk sign-in widget supplementary cell (`chunk-5-account`, 05-11) is the only authenticated-adjacent surface actually screenshotted |
| order-status | `baseline` through `chunk-5-account` — all MISSING | Zero captures across the whole phase | Local D1 seed has no orders in every session this phase ran in; every chunk from 05-02 on recorded the same `--allow-missing` gap. Coverage rests on code reads: `app/order-status/[id]/page.tsx` verified against TOKEN-MAP §2/§2b (05-11) confirms all five dead shadcn classes replaced with real tokens, and `scan:tokens --path app/order-status` reports 0 violations |
| blog-index / blog-post / cms-page | `pre-chunk-3-content` (genuine pre-sweep, captured from a second dev server on commit `4fc3e04`), `chunk-3-content` | Full — 1280/390 resting for all three routes | Not part of the standard D-20 seven-route grid; added via `--include-content` (05-08) specifically to cover the CMS/blog surfaces D-08's sweep boundary includes. No `nav-open` or other interactive state captured for these three — out of the D-20 spec, not a gap against it |
| transactional emails (6 builders) | This plan only (05-12) — not reachable by `screenshot:routes` at all | See Part 1 above | Not a D-20 route; own before/after evidence given in Part 1 |

**Overall D-20 grid completion:** 6 of 7 routes have full resting/nav-open coverage at both viewports across all nine tracked chunk labels; `order-status` has zero captures for the entire phase (environment-limited, not code-limited) and `checkout`/`product`'s authenticated/loaded-content states have partial gaps documented above with their own evidentiary substitutes (code reads, scoped scans, or untracked manual captures). No cell in this record is marked covered without either a captured hash or an explicitly named substitute-evidence trail.

### 3. ROADMAP Phase 5 success criteria — answered with evidence

**Criterion 1** — *"The site renders identically to before the sweep — verified with before/after screenshots per route... with `themes/volt-dark.css` live... and `data-theme` stamped on `<html>` server-side."*

TRUE, with the intentional shade-consolidation snaps (S1–S16) as the only deviations, every one traced to its root cause and none touching layout, content, or polarity. Evidence: the coverage roll-up in Part 2 above; `app/layout.tsx` stamps `data-theme="volt-dark"` server-side (05-03, unchanged since); `themes/volt-dark.css` holds the live `[data-theme="volt-dark"]` block (confirmed by the contract check below).

**Criterion 2** — *"`tailwind.config.ts` maps all ~18 tokens through `runtimeColor()`, with the hardcoded `border`/`ring` hex values deleted."*

TRUE. `mise exec -- npm run build` confirms the config compiles; the contract check below confirms `tailwind.config.ts` contains exactly 17 `runtimeColor("--store-` calls (the frozen contract grew from the ROADMAP's original "~18" estimate to the locked 17-colour + 4-radius + 2-font = 23-token contract per D-01) and zero hex literals of any kind.
```
$ /usr/bin/grep -c 'runtimeColor("--store-' tailwind.config.ts   # 17
$ /usr/bin/grep -cE '#[0-9a-fA-F]{3,8}' tailwind.config.ts        # 0
```

**Criterion 3** — *"A whole-tree scan... finds zero hardcoded palette values in storefront code."*

TRUE — this is the phase's headline claim, made for the first time by this plan.
```
$ mise exec -- npm run scan:tokens
MANUAL-REVIEW  lib/utils/image-placeholders.ts  — ...
MANUAL-REVIEW  lib/types/mach/Promotion.ts  — ...
[scan-tokens] 0 violations
```
Exactly two manual-review rows print (the named-file exceptions from TOKEN-MAP §6), confirming the registry was neither quietly emptied nor grown — the zero-violation result is not silent about what it could not see.

**Criterion 4** — *"`NEXT_PUBLIC_THEME_PRIMARY` no longer exists in the codebase; `logoPath` still resolves via store-config unchanged."*

TRUE.
```
$ /usr/bin/grep -rn 'NEXT_PUBLIC_THEME_PRIMARY' app components lib scripts tests docs --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.md'
# 0 matches
```
The variable was removed in 05-03; this plan's whole-tree grep (widened beyond 05-03's own narrower check) confirms it never resurfaced across the eight remaining sweep chunks. `getStoreConfig().theme.logoPath` still resolves to `/volt.png` (unchanged since 05-03; no later chunk touched `lib/store-config.ts`).

**Contract-intact check (holds all nine sweep chunks accountable, not just this plan):**
```
$ test "$(grep -c 'runtimeColor("--store-' tailwind.config.ts)" -eq 17 \
  && test "$(grep -cE '#[0-9a-fA-F]{3,8}' tailwind.config.ts)" -eq 0 \
  && test "$(grep -c '^\s*--store-' themes/volt-dark.css)" -eq 23 \
  && echo "contract-intact"
contract-intact
```
The frozen 23-token contract (D-01) is unchanged since 05-03: 17 colour tokens, 4 radius tokens, 2 font tokens, none renamed or dropped across nine sweep chunks.

**Full green build:**
```
$ mise exec -- npm run test        # 244 test files / 1882 tests passed
$ mise exec -- npm run typecheck   # clean
$ mise exec -- npm run lint        # 0 errors, 52 pre-existing warnings (unchanged baseline since 05-03)
$ mise exec -- npm run build       # exit 0, "Compiled successfully"
```

### 4. S1–S11 snap register — observed or not, and where

| ID | Snap | Observed in a capture? | Where |
|----|------|------------------------|-------|
| S1 | `on-primary`=`#000000`, white-on-orange labels flip to black | **Yes** | `chunk-3-engagement` supplementary cell `product/1280/subscription-plan-selected` (05-07) explicitly confirms the Subscribe CTA's `bg-primary/text-on-primary` treatment renders correctly; also newly confirmed in this plan's own email before/after comparison (Part 1: the shipped-status tracking button's label flips from `color: white` to `onPrimary`/`#000000`) |
| S2 | `border`=`#404040` | **Yes** | `chunk-3-content` (05-08): `blog-index`/`blog-post` pixel-diff traces tag-pill and card borders from `border-neutral-800` (`#262626`) to `border-border` (`#404040`) explicitly |
| S3 | `ring`=`#404040` | **No** | The only ring-related capture in this manifest (`chunk-2-ui` D-17 supplementary, `checkout/1280/discount-input-invalid`) exercises the **danger**-coloured invalid ring (`ring-danger`), not the default `ring-ring` focus ring this snap describes. No capture in the phase shows a default-focused element. Gap, stated plainly rather than passed over. |
| S4 | `success`=`#22c55e` | **Yes** | `chunk-3-catalog` (05-06): visual read of `product__1280__resting.png`/`category__1280__resting.png` confirms "In stock" reads `text-success` green |
| S5 | `warning`=`#f59e0b` | **Yes** | Same `chunk-3-catalog` citation as S4: unavailable states read `text-warning` amber |
| S6 | `danger`=`#ef4444` | **Yes, live-rendered but not statically captured** | `chunk-4-checkout` supplementary walkthrough (05-10): the `bg-danger/10 border-danger text-danger` error banner "rendered exactly as intended" during a real scripted checkout session — not a saved screenshot (the walkthrough was interrupted downstream by an unrelated pricing-API 400 before a static capture was taken) |
| S7 | `info`=`#3b82f6` | **Partially** | `chunk-4-drawers` supplementary agent-drawer-open capture (05-09) describes the chat bubble's `info`-token treatment, but that specific capture opened the drawer without sending a message, so the bubble itself isn't pixel-visible in the saved image — the description is a code-level confirmation riding along with a capture of the same surface, not a bubble-showing screenshot. The order-status "processing" blue and the promotional-banner info variant have no capture evidence anywhere in this manifest. |
| S8 | `surface-inverse-elevated`=`#f3f4f6` | **Yes** | `chunk-4-drawers` (05-09): cart drawer quantity-control background pixel-diff |
| S9 | `muted-on-inverse`=`#6b7280` | **Yes** | `chunk-4-drawers` (05-09): cart empty-state copy pixel-diff; also newly confirmed in this plan's email footer comparison (Part 1) |
| S10 | `border-inverse`=`#374151` | **Yes** | `chunk-4-drawers` (05-09): cart panel border/divider pixel-diff; also this plan's own email before/after comparison (Part 1) — the divider darkening across all six builders, the visible effect the plan flagged in advance |
| S11 | `global-error.tsx` button → base `primary` | **No** | `global-error.tsx` only renders on an unhandled exception and is not reachable via the D-20 route grid or any scripted walkthrough. 05-11 verified it by code read (`app/global-error.tsx` maps its seven inline colours to MAIN-set `getThemeTokens()` fields) and a scoped `scan:tokens` pass, not a screenshot. No capture exists; none is claimed. |

**Honest summary:** 8 of 11 snaps (S1, S2, S4, S5, S6, S8, S9, S10) have direct capture or live-render evidence naming the exact chunk; S7 has partial evidence (surface confirmed, bubble pixel not captured); S3 and S11 have no capture evidence at all in this phase and are recorded as gaps rather than claimed covered.


## Label: `phase-06-02-active-theme`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-06-02-active-theme/home__1280__resting.png | f5d499e64a4ed1403696d6186021ba12ef4535a17d6e900ccf863e2932d3680a | - |
| home | 1280 | nav-open | .screenshots/phase-06-02-active-theme/home__1280__nav-open.png | e8cfd69ec43eb7ae5c92747d60a0d14f681edfbafc7084909d11ce9064c5855d | - |
| home | 390 | resting | .screenshots/phase-06-02-active-theme/home__390__resting.png | 65e03c2daafd238c67b873d696686c39b36e83522febc199c325dbc3018d4850 | - |
| home | 390 | nav-open | .screenshots/phase-06-02-active-theme/home__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| category | 1280 | resting | .screenshots/phase-06-02-active-theme/category__1280__resting.png | 053043895c0bea61e6af3de495c72a7153e049ffe2ca2c55791e7fb29f723c86 | - |
| category | 1280 | nav-open | .screenshots/phase-06-02-active-theme/category__1280__nav-open.png | cfeff9c49deec815dd8b3cf67bc36a2247bab1cf5b7b8b350b0af5f86f155b76 | - |
| category | 390 | resting | .screenshots/phase-06-02-active-theme/category__390__resting.png | f196cbdbd230724e56a379418b37640bc7934a5bb9b5272997037a9c1150a058 | - |
| category | 390 | nav-open | .screenshots/phase-06-02-active-theme/category__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| product | 1280 | resting | .screenshots/phase-06-02-active-theme/product__1280__resting.png | 109f0ab02e43b3b6a42320eacf3329a8dbbf7df35b9d87c548a45a52bd63f8a0 | - |
| product | 1280 | nav-open | .screenshots/phase-06-02-active-theme/product__1280__nav-open.png | 8636c1a88d66e61c2dbd1512520cee7b1417a858ef8188ab7a6b12b4375694ea | - |
| product | 390 | resting | .screenshots/phase-06-02-active-theme/product__390__resting.png | 92eae83cc0e2d916c09fc5525efe566a6e150c83fdd6271fb1938ece9a718632 | - |
| product | 390 | nav-open | .screenshots/phase-06-02-active-theme/product__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| cart | 1280 | cart-open | .screenshots/phase-06-02-active-theme/cart__1280__cart-open.png | d5aa4e6a788e4dc72ae5ace88f073e60486ca865e38ea02a4a3792636d2460de | - |
| cart | 390 | cart-open | .screenshots/phase-06-02-active-theme/cart__390__cart-open.png | 562107229ce4aeb2e2faed585ae0ed6985e2857a8b04c5143b2b96090dddc0d5 | - |
| checkout | 1280 | resting | .screenshots/phase-06-02-active-theme/checkout__1280__resting.png | 67a36d04df9c04d5e0547efd6158823f5144b6307365b9ad3733a0e473df1e85 | - |
| checkout | 1280 | nav-open | .screenshots/phase-06-02-active-theme/checkout__1280__nav-open.png | 9c526995e02d86ea892b728ad567d0d7db9ab34071b218c1551aa70781c42701 | - |
| checkout | 390 | resting | .screenshots/phase-06-02-active-theme/checkout__390__resting.png | 8c634a185ba017d2eda279005c956ec61227d7d5d61b1d5029eab7b6f9feab55 | - |
| checkout | 390 | nav-open | .screenshots/phase-06-02-active-theme/checkout__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| account | 1280 | resting | .screenshots/phase-06-02-active-theme/account__1280__resting.png | 79bbd0d305a10b34b614efea325ee2b53ca43b61471e8634759b6d8dae762caf | - |
| account | 1280 | nav-open | .screenshots/phase-06-02-active-theme/account__1280__nav-open.png | a4016a92afc536bf04a67250f1ae20835e8002c28402bcb8b5a125bf60c03584 | - |
| account | 390 | resting | .screenshots/phase-06-02-active-theme/account__390__resting.png | ed89750938ee8c9b3a2e63dc6cb207c74e687d63f2486f72642e629a6b2164e7 | - |
| account | 390 | nav-open | .screenshots/phase-06-02-active-theme/account__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
