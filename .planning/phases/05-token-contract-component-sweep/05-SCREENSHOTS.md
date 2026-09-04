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

## Coverage notes

- `order-status` is captured only when `--order-id <id>` resolves to a real local D1 row.
  The pre-sweep `baseline` label's local dev seed contains no orders, so `order-status`
  records MISSING for both viewports and both states; that route's coverage is deferred to
  whichever later chunk plan sweeps the order-status page and can supply a seeded order id.
- The `nav-open` state at the 390px viewport opens a full-width `Sheet` that entirely
  covers the underlying route — by the app's own design, `nav-open` screenshots at 390px
  are visually identical across routes (same nav content, different filenames). This is
  expected, not a capture defect.

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
