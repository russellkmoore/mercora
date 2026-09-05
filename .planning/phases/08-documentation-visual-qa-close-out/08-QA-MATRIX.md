# Phase 8 Visual QA Matrix

**Status:** captured — complete (findings pending plan 08-04)
**Captured:** 2026-09-05

This is Phase 8's own visual QA coverage record — a new file, following the format
`.planning/phases/06.1-remaining-presets-clinical-retro-atelier-market/06.1-SCREENSHOTS.md` and
`.planning/phases/07-layout-switches/07-SCREENSHOTS.md` established (label sections,
route/viewport/state/path/hash/notes tables), scoped to this phase's own capture runs rather than
appended to an earlier phase's file. Captured images live under the git-ignored `.screenshots/`
directory and are never committed — they may contain real customer names, addresses, and order
contents on the account, checkout, and order-status routes. Only this manifest (route, viewport,
state, path, content hash) is committed.

Scope: all seven shipped presets (`volt-dark`, `luxe`, `midnight`, `clinical`, `retro`, `atelier`,
`market`) crossed with the three packed layout combinations Phase 7 defined (A, B, C below) — 21
harness runs total, each over the full seven-route grid plus the `--include-content` cells. This
plan produces the evidence only; plan 08-04 judges each cell against the six per-cell pass
criteria in `08-UI-SPEC.md` and records findings — no findings table is written here.

## Capture command

Every one of the 21 runs uses this exact invocation, with all four flags:

```bash
mise exec -- npm run screenshot:routes -- \
  --label phase-08-<combo>-<theme> \
  --manifest .planning/phases/08-documentation-visual-qa-close-out/08-QA-MATRIX.md \
  --allow-missing \
  --include-content
```

The `--manifest` flag is passed explicitly on every single run because its default points at
`.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` — an earlier phase's
committed file — and relying on that default has already caused one real incident (plan 06-05:
captures landed in the wrong file and had to be moved, with `05-SCREENSHOTS.md` restored
byte-for-byte). This phase's own captures always point at this file, so no row lands anywhere
else.

## Theme-switch method

A local `npm run dev` server runs against the existing local D1 fixture (1 category, 1 product).
Theme and all three layout keys are written in one request to `POST /api/admin/settings`, using
the documented `x-dev-admin` development-bypass header (its value is read from
`lib/auth/admin-middleware.ts` at run time — not written down here — and the bypass is gated to
the development environment only), since no Clerk session is available in this environment. Before
every capture: the appearance category is read back from the settings endpoint and all four
written values are confirmed, and the storefront root is fetched and its rendered `data-theme`
attribute is confirmed to match. Only after both confirmations does the harness run.

## Combination table

Reused verbatim from `07-SCREENSHOTS.md`'s combination definitions (`08-CONTEXT.md` D-03):

| Combination | `categoryLayout` | `homeHero` | `productGallery` |
|---|---|---|---|
| A (defaults) | `grid-3` | `minimal` | `left` |
| B | `grid-2` | `split` | `top` |
| C | `list` | `full-bleed` | `left` |

## Coverage grid

Ordered preset-major, then combination (A, B, C) — this ordering is fixed and is never re-sorted
after being written, so a reader diffing two capture sessions has stable row identity. Rows are
written with their run number, label, theme, and layout values filled in before capture begins;
result columns are filled in as each run completes.

| Run | Label | Theme | categoryLayout | homeHero | productGallery | Switch confirmed | Cells captured | Cells missing |
|---|---|---|---|---|---|---|---|---|
| 1 | `phase-08-a-volt-dark` | `volt-dark` | `grid-3` | `minimal` | `left` | ✅ | 28 | 4 |
| 2 | `phase-08-b-volt-dark` | `volt-dark` | `grid-2` | `split` | `top` | ✅ | 28 | 4 |
| 3 | `phase-08-c-volt-dark` | `volt-dark` | `list` | `full-bleed` | `left` | ✅ | 28 | 4 |
| 4 | `phase-08-a-luxe` | `luxe` | `grid-3` | `minimal` | `left` | ✅ | 28 | 4 |
| 5 | `phase-08-b-luxe` | `luxe` | `grid-2` | `split` | `top` | ✅ | 28 | 4 |
| 6 | `phase-08-c-luxe` | `luxe` | `list` | `full-bleed` | `left` | ✅ | 28 | 4 |
| 7 | `phase-08-a-midnight` | `midnight` | `grid-3` | `minimal` | `left` | ✅ | 28 | 4 |
| 8 | `phase-08-b-midnight` | `midnight` | `grid-2` | `split` | `top` | ✅ | 28 | 4 |
| 9 | `phase-08-c-midnight` | `midnight` | `list` | `full-bleed` | `left` | ✅ | 28 | 4 |
| 10 | `phase-08-a-clinical` | `clinical` | `grid-3` | `minimal` | `left` | ✅ | 28 | 4 |
| 11 | `phase-08-b-clinical` | `clinical` | `grid-2` | `split` | `top` | ✅ | 28 | 4 |
| 12 | `phase-08-c-clinical` | `clinical` | `list` | `full-bleed` | `left` | ✅ | 28 | 4 |
| 13 | `phase-08-a-retro` | `retro` | `grid-3` | `minimal` | `left` | ✅ | 28 | 4 |
| 14 | `phase-08-b-retro` | `retro` | `grid-2` | `split` | `top` | ✅ | 28 | 4 |
| 15 | `phase-08-c-retro` | `retro` | `list` | `full-bleed` | `left` | ✅ | 28 | 4 |
| 16 | `phase-08-a-atelier` | `atelier` | `grid-3` | `minimal` | `left` | ✅ | 28 | 4 |
| 17 | `phase-08-b-atelier` | `atelier` | `grid-2` | `split` | `top` | ✅ | 28 | 4 |
| 18 | `phase-08-c-atelier` | `atelier` | `list` | `full-bleed` | `left` | ✅ | 28 | 4 |
| 19 | `phase-08-a-market` | `market` | `grid-3` | `minimal` | `left` | ✅ | 28 | 4 |
| 20 | `phase-08-b-market` | `market` | `grid-2` | `split` | `top` | ✅ | 28 | 4 |
| 21 | `phase-08-c-market` | `market` | `list` | `full-bleed` | `left` | ✅ | 28 | 4 |

## Carried-forward gaps

These four screenshot-coverage gaps have been carried since Phase 5 and are recorded here
deliberately, not discovered during this plan's capture:

- **No seeded order** — the local D1 fixture seeds no order, so every one of the 21 runs'
  `order-status` cells (1280/resting, 1280/nav-open, 390/resting, 390/nav-open) are recorded
  `MISSING` by the harness. Same gap since `05-SCREENSHOTS.md`.
- **The Stripe payment step** — checkout's post-payment confirmation cannot be reached locally
  (payment-intent creation 400s without live Stripe test keys wired to this fixture); no cell in
  this matrix exercises it.
- **An authenticated account dashboard** — no Clerk session is available in this environment, so
  every `account` capture renders whatever the route's no-session fallback is, not a signed-in
  dashboard.
- **The review-form error state** — no cell in this matrix exercises a submitted review form's
  validation-error state.

None of these four is fought or worked around in this plan; they are accepted exactly as every
prior phase (5, 6, 6.1, 7) accepted them.


## Label: `phase-08-a-volt-dark`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-a-volt-dark/home__1280__resting.png | ecee0cde8adfc68d751d1dc7d2193ac2ce10392f82b3fe473ad78f4f3e84de04 | - |
| home | 1280 | nav-open | .screenshots/phase-08-a-volt-dark/home__1280__nav-open.png | a79263c72399ecb8496fbf8a67d8f441ef1e1d6bd619214e7782915389b3ff38 | - |
| home | 390 | resting | .screenshots/phase-08-a-volt-dark/home__390__resting.png | bddc8372b0cca1ab98936d3aab42d10b7e2386b5445a7bfbc1b801277e3848f7 | - |
| home | 390 | nav-open | .screenshots/phase-08-a-volt-dark/home__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| category | 1280 | resting | .screenshots/phase-08-a-volt-dark/category__1280__resting.png | 123aa2a8559413b1eee2fdcc3159e603edabc7d790e5e14d1e4b68466f3ded64 | - |
| category | 1280 | nav-open | .screenshots/phase-08-a-volt-dark/category__1280__nav-open.png | 748b036078a4151f1ce0ce3e31ec9e87f195a8485c59abf8e3d091df93da2a32 | - |
| category | 390 | resting | .screenshots/phase-08-a-volt-dark/category__390__resting.png | 6ad0aa782d389af0de1aaed12a2a5f1fe3f525ca5dc58fe2f4c1c7dae7e21e1c | - |
| category | 390 | nav-open | .screenshots/phase-08-a-volt-dark/category__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| product | 1280 | resting | .screenshots/phase-08-a-volt-dark/product__1280__resting.png | 71d237eb450c301fc0d7205b9cf03c40719904f938193c16ae617d57b48d4ff4 | - |
| product | 1280 | nav-open | .screenshots/phase-08-a-volt-dark/product__1280__nav-open.png | 287f28da58682f3800c89c460a2d87eb717f546500a044ff8c75c00a331e2d50 | - |
| product | 390 | resting | .screenshots/phase-08-a-volt-dark/product__390__resting.png | e74c3709b3f644137d6a2bd7a386292ccc1abc73ee93987c51bf1e7c3a8bc493 | - |
| product | 390 | nav-open | .screenshots/phase-08-a-volt-dark/product__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-a-volt-dark/cart__1280__cart-open.png | fb28becd11a345b9696c7a8a3a9245721cefef2bd7645061eeaca0c239568f2e | - |
| cart | 390 | cart-open | .screenshots/phase-08-a-volt-dark/cart__390__cart-open.png | c92ff964d8ad176890a5d4c565b66588be71192747cdb929a9d7cc701c8de1d2 | - |
| checkout | 1280 | resting | .screenshots/phase-08-a-volt-dark/checkout__1280__resting.png | 0e74db7b6cc9e3dd61b136c3a090e71c6ff631a01ec0f2c882ab2c38e477d542 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-a-volt-dark/checkout__1280__nav-open.png | 25bc94ee9774ff74ee5b159a0fd782467508681e096dae5792d0613ae4168b4f | - |
| checkout | 390 | resting | .screenshots/phase-08-a-volt-dark/checkout__390__resting.png | 0875adecc3a8d9e04edf18d765ca995d7eda68cc99730e46d6e1fa286d9e4ce3 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-a-volt-dark/checkout__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| account | 1280 | resting | .screenshots/phase-08-a-volt-dark/account__1280__resting.png | 7432769ec7089603a71093fd06b515764df430a48ad955d9962c076d4fb1390b | - |
| account | 1280 | nav-open | .screenshots/phase-08-a-volt-dark/account__1280__nav-open.png | 9e915b902a7bef85a54291b4fc136129802d54429cea5e39fee3fb40b5eb02cc | - |
| account | 390 | resting | .screenshots/phase-08-a-volt-dark/account__390__resting.png | 1f7b5f8b69e1bf00dfdeb3844626cdc80337cecaeadddc8ab97e7e1c207a519f | - |
| account | 390 | nav-open | .screenshots/phase-08-a-volt-dark/account__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-a-volt-dark/blog-index__1280__resting.png | d3ae381ba24ee9877a393d20dc6e125cf495f838a66e46b1ee89fdbf75d9ce94 | - |
| blog-index | 390 | resting | .screenshots/phase-08-a-volt-dark/blog-index__390__resting.png | 04c27ae1828f68d9e922d6738eafd9ef64e33ef8d5248154e8c6a519fd31e55a | - |
| blog-post | 1280 | resting | .screenshots/phase-08-a-volt-dark/blog-post__1280__resting.png | 96fc302e790af5e951e7449291b0e23e137a24ef37437384669f9923d7f13308 | - |
| blog-post | 390 | resting | .screenshots/phase-08-a-volt-dark/blog-post__390__resting.png | 730dfaac3256bb1cdc89046205934233cec86acaf816414ef55c5d07a737051e | - |
| cms-page | 1280 | resting | .screenshots/phase-08-a-volt-dark/cms-page__1280__resting.png | ca65d81c09566411fe8a209396121513462e159e0279e0cd0c07ab629e1754ef | - |
| cms-page | 390 | resting | .screenshots/phase-08-a-volt-dark/cms-page__390__resting.png | 5c52dec3590fe0ec3c036a15dd3d80023abe77f7f8af89ebda4490bbdf9cfe07 | - |

## Label: `phase-08-b-volt-dark`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-b-volt-dark/home__1280__resting.png | 2174a65b6a0b44c66b1d16dfa3342a9c2c87aa457771c02ed7cda7cce82f1e32 | - |
| home | 1280 | nav-open | .screenshots/phase-08-b-volt-dark/home__1280__nav-open.png | 0bda64daa04abe7d3885b6bdf099b70ad8c9657417b8fd34ef0c56965e97d2a0 | - |
| home | 390 | resting | .screenshots/phase-08-b-volt-dark/home__390__resting.png | aa00155ff936ac9905c06d1b94cccfebdc3ee5c656c80119e513d7aebefb732d | - |
| home | 390 | nav-open | .screenshots/phase-08-b-volt-dark/home__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| category | 1280 | resting | .screenshots/phase-08-b-volt-dark/category__1280__resting.png | d3fd6acb42f686444d01de0d74dc12ed715826a08ca91e45366467a5221f6f31 | - |
| category | 1280 | nav-open | .screenshots/phase-08-b-volt-dark/category__1280__nav-open.png | a412cc51248238b21a5351983a287ca1944ed642a1f73e3962d0cb4cecad444b | - |
| category | 390 | resting | .screenshots/phase-08-b-volt-dark/category__390__resting.png | 6ad0aa782d389af0de1aaed12a2a5f1fe3f525ca5dc58fe2f4c1c7dae7e21e1c | - |
| category | 390 | nav-open | .screenshots/phase-08-b-volt-dark/category__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| product | 1280 | resting | .screenshots/phase-08-b-volt-dark/product__1280__resting.png | 967781261023eac45372ed59330e32ffe95ad8dfcb96e427d84b90f2c344e6da | - |
| product | 1280 | nav-open | .screenshots/phase-08-b-volt-dark/product__1280__nav-open.png | 9afeeb39d827378444d4c8fe6b8f61b407c81ae7acef04927dba9efab0650023 | - |
| product | 390 | resting | .screenshots/phase-08-b-volt-dark/product__390__resting.png | 565e4a0df8815305d4e90a35fbefbdc3c83b7f7571e48968d95b56be7c5610f1 | - |
| product | 390 | nav-open | .screenshots/phase-08-b-volt-dark/product__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-b-volt-dark/cart__1280__cart-open.png | 2a6f629a962ccd40d1c42254d5f4e1de24971a30655101c3ae83842179fb730f | - |
| cart | 390 | cart-open | .screenshots/phase-08-b-volt-dark/cart__390__cart-open.png | c92ff964d8ad176890a5d4c565b66588be71192747cdb929a9d7cc701c8de1d2 | - |
| checkout | 1280 | resting | .screenshots/phase-08-b-volt-dark/checkout__1280__resting.png | 0e74db7b6cc9e3dd61b136c3a090e71c6ff631a01ec0f2c882ab2c38e477d542 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-b-volt-dark/checkout__1280__nav-open.png | 25bc94ee9774ff74ee5b159a0fd782467508681e096dae5792d0613ae4168b4f | - |
| checkout | 390 | resting | .screenshots/phase-08-b-volt-dark/checkout__390__resting.png | 0875adecc3a8d9e04edf18d765ca995d7eda68cc99730e46d6e1fa286d9e4ce3 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-b-volt-dark/checkout__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| account | 1280 | resting | .screenshots/phase-08-b-volt-dark/account__1280__resting.png | 7432769ec7089603a71093fd06b515764df430a48ad955d9962c076d4fb1390b | - |
| account | 1280 | nav-open | .screenshots/phase-08-b-volt-dark/account__1280__nav-open.png | 9e915b902a7bef85a54291b4fc136129802d54429cea5e39fee3fb40b5eb02cc | - |
| account | 390 | resting | .screenshots/phase-08-b-volt-dark/account__390__resting.png | 1f7b5f8b69e1bf00dfdeb3844626cdc80337cecaeadddc8ab97e7e1c207a519f | - |
| account | 390 | nav-open | .screenshots/phase-08-b-volt-dark/account__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-b-volt-dark/blog-index__1280__resting.png | d3ae381ba24ee9877a393d20dc6e125cf495f838a66e46b1ee89fdbf75d9ce94 | - |
| blog-index | 390 | resting | .screenshots/phase-08-b-volt-dark/blog-index__390__resting.png | 04c27ae1828f68d9e922d6738eafd9ef64e33ef8d5248154e8c6a519fd31e55a | - |
| blog-post | 1280 | resting | .screenshots/phase-08-b-volt-dark/blog-post__1280__resting.png | 96fc302e790af5e951e7449291b0e23e137a24ef37437384669f9923d7f13308 | - |
| blog-post | 390 | resting | .screenshots/phase-08-b-volt-dark/blog-post__390__resting.png | 730dfaac3256bb1cdc89046205934233cec86acaf816414ef55c5d07a737051e | - |
| cms-page | 1280 | resting | .screenshots/phase-08-b-volt-dark/cms-page__1280__resting.png | ca65d81c09566411fe8a209396121513462e159e0279e0cd0c07ab629e1754ef | - |
| cms-page | 390 | resting | .screenshots/phase-08-b-volt-dark/cms-page__390__resting.png | 5c52dec3590fe0ec3c036a15dd3d80023abe77f7f8af89ebda4490bbdf9cfe07 | - |

## Label: `phase-08-c-volt-dark`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-c-volt-dark/home__1280__resting.png | e13b4fb697c95f2c73a9e25de59338b8ce296a18ebe442f84608d9817e38091c | - |
| home | 1280 | nav-open | .screenshots/phase-08-c-volt-dark/home__1280__nav-open.png | 4f927099e40ba1e9d93a95dcde24e44b7dac56c089b3ded5102d4a4503c9a5b3 | - |
| home | 390 | resting | .screenshots/phase-08-c-volt-dark/home__390__resting.png | a728e691fb31ed01d8b704fd7935625f64b4ef3cc17b364ac14f62e7051b0645 | - |
| home | 390 | nav-open | .screenshots/phase-08-c-volt-dark/home__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| category | 1280 | resting | .screenshots/phase-08-c-volt-dark/category__1280__resting.png | d6bac4a4a21584f09cdcd8de9519d57055cf442b4c9f6a947377802e4817f829 | - |
| category | 1280 | nav-open | .screenshots/phase-08-c-volt-dark/category__1280__nav-open.png | 6d02bdcc3a177e5c6beaa85cd51fcb3ff0a94b61d73427e35901d3c727c71c7c | - |
| category | 390 | resting | .screenshots/phase-08-c-volt-dark/category__390__resting.png | 887e15be2a564d589dfe504f6a44e472c3e578ff34e6b31f34abfb062f555e71 | - |
| category | 390 | nav-open | .screenshots/phase-08-c-volt-dark/category__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| product | 1280 | resting | .screenshots/phase-08-c-volt-dark/product__1280__resting.png | 71d237eb450c301fc0d7205b9cf03c40719904f938193c16ae617d57b48d4ff4 | - |
| product | 1280 | nav-open | .screenshots/phase-08-c-volt-dark/product__1280__nav-open.png | 287f28da58682f3800c89c460a2d87eb717f546500a044ff8c75c00a331e2d50 | - |
| product | 390 | resting | .screenshots/phase-08-c-volt-dark/product__390__resting.png | 8533b72ee4095b9afaece85582f6cd51486d8387826369130ba7b0af5da63c85 | - |
| product | 390 | nav-open | .screenshots/phase-08-c-volt-dark/product__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-c-volt-dark/cart__1280__cart-open.png | 9a0b057e7cf5bf820dd95999bb93f767d5ceb951965de03b524556afa38eeeeb | - |
| cart | 390 | cart-open | .screenshots/phase-08-c-volt-dark/cart__390__cart-open.png | c92ff964d8ad176890a5d4c565b66588be71192747cdb929a9d7cc701c8de1d2 | - |
| checkout | 1280 | resting | .screenshots/phase-08-c-volt-dark/checkout__1280__resting.png | 0e74db7b6cc9e3dd61b136c3a090e71c6ff631a01ec0f2c882ab2c38e477d542 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-c-volt-dark/checkout__1280__nav-open.png | 25bc94ee9774ff74ee5b159a0fd782467508681e096dae5792d0613ae4168b4f | - |
| checkout | 390 | resting | .screenshots/phase-08-c-volt-dark/checkout__390__resting.png | 0875adecc3a8d9e04edf18d765ca995d7eda68cc99730e46d6e1fa286d9e4ce3 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-c-volt-dark/checkout__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| account | 1280 | resting | .screenshots/phase-08-c-volt-dark/account__1280__resting.png | 7432769ec7089603a71093fd06b515764df430a48ad955d9962c076d4fb1390b | - |
| account | 1280 | nav-open | .screenshots/phase-08-c-volt-dark/account__1280__nav-open.png | 9e915b902a7bef85a54291b4fc136129802d54429cea5e39fee3fb40b5eb02cc | - |
| account | 390 | resting | .screenshots/phase-08-c-volt-dark/account__390__resting.png | 1f7b5f8b69e1bf00dfdeb3844626cdc80337cecaeadddc8ab97e7e1c207a519f | - |
| account | 390 | nav-open | .screenshots/phase-08-c-volt-dark/account__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-c-volt-dark/blog-index__1280__resting.png | d3ae381ba24ee9877a393d20dc6e125cf495f838a66e46b1ee89fdbf75d9ce94 | - |
| blog-index | 390 | resting | .screenshots/phase-08-c-volt-dark/blog-index__390__resting.png | 04c27ae1828f68d9e922d6738eafd9ef64e33ef8d5248154e8c6a519fd31e55a | - |
| blog-post | 1280 | resting | .screenshots/phase-08-c-volt-dark/blog-post__1280__resting.png | 96fc302e790af5e951e7449291b0e23e137a24ef37437384669f9923d7f13308 | - |
| blog-post | 390 | resting | .screenshots/phase-08-c-volt-dark/blog-post__390__resting.png | 730dfaac3256bb1cdc89046205934233cec86acaf816414ef55c5d07a737051e | - |
| cms-page | 1280 | resting | .screenshots/phase-08-c-volt-dark/cms-page__1280__resting.png | ca65d81c09566411fe8a209396121513462e159e0279e0cd0c07ab629e1754ef | - |
| cms-page | 390 | resting | .screenshots/phase-08-c-volt-dark/cms-page__390__resting.png | 5c52dec3590fe0ec3c036a15dd3d80023abe77f7f8af89ebda4490bbdf9cfe07 | - |

## Label: `phase-08-a-luxe`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-a-luxe/home__1280__resting.png | 440874feccce4324d0e5810f0db36954bd0dd6102f54b7b4a2ee20dfcfe10ac8 | - |
| home | 1280 | nav-open | .screenshots/phase-08-a-luxe/home__1280__nav-open.png | 70391bae5220f5db10771d9a23d183059e1478bd1c96fd560713bf227634dd00 | - |
| home | 390 | resting | .screenshots/phase-08-a-luxe/home__390__resting.png | c69584558cbc1f9ace08503141f58f72393e2def2e58d9d12676927c4a213e7e | - |
| home | 390 | nav-open | .screenshots/phase-08-a-luxe/home__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| category | 1280 | resting | .screenshots/phase-08-a-luxe/category__1280__resting.png | 90b91edee29da5efde70795b1cf6244828527caee24ef91522ad626e594fc6d3 | - |
| category | 1280 | nav-open | .screenshots/phase-08-a-luxe/category__1280__nav-open.png | fa0a60614efac6194f291e4e8e08ffb489c09eccc70de7e904f10703b6b56646 | - |
| category | 390 | resting | .screenshots/phase-08-a-luxe/category__390__resting.png | cd03513b1a64455c43aeeaf7156be73367f3b963bc90216e4d156dd662bd44d8 | - |
| category | 390 | nav-open | .screenshots/phase-08-a-luxe/category__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| product | 1280 | resting | .screenshots/phase-08-a-luxe/product__1280__resting.png | 4d4882d6996dd1ee9810f76fb84172c7a279cb960aeda9c1222c027a0e46ed7f | - |
| product | 1280 | nav-open | .screenshots/phase-08-a-luxe/product__1280__nav-open.png | 6636d191609a71c0912ccd2438a00448c432ed4b86f9cf41090c309f1e9fc7f8 | - |
| product | 390 | resting | .screenshots/phase-08-a-luxe/product__390__resting.png | f65145446c5b8fc9582a614462177c48a3fb1aaee615d31664ddad822e0edc38 | - |
| product | 390 | nav-open | .screenshots/phase-08-a-luxe/product__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-a-luxe/cart__1280__cart-open.png | 4aa7fc6539d239cc9f085d551772e5a6addcc8454ab7752551ebbb3191141c74 | - |
| cart | 390 | cart-open | .screenshots/phase-08-a-luxe/cart__390__cart-open.png | 4ee3f143b2f07946a62448de9ee765ad71ae6e7bda101c28caf55a2df679649b | - |
| checkout | 1280 | resting | .screenshots/phase-08-a-luxe/checkout__1280__resting.png | 78f11d177d42bc783c097f4274bdaeadb05a426d6fd9f2e27475a0de634cdefe | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-a-luxe/checkout__1280__nav-open.png | ac8378e066b0e4e659886af916084fa7c515070927768bfe4cf90be541274bb4 | - |
| checkout | 390 | resting | .screenshots/phase-08-a-luxe/checkout__390__resting.png | d336a4209d3eefdeab9af037a110489dc5e19a8d7d74f471cd2c19618915ded9 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-a-luxe/checkout__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| account | 1280 | resting | .screenshots/phase-08-a-luxe/account__1280__resting.png | dc3eea4ee06afe5e03d0ca4be89907b3e5645a8e4752f467516bbec072e052e6 | - |
| account | 1280 | nav-open | .screenshots/phase-08-a-luxe/account__1280__nav-open.png | 4fa881f7e1c4ad00b66f434adbdba3a1bdb4bf8176299dd0e4fc4b937dd0b862 | - |
| account | 390 | resting | .screenshots/phase-08-a-luxe/account__390__resting.png | 00282843de6e82b05ed8594e4d3132bddc2ec2108f051e3e1b32da25daa2229f | - |
| account | 390 | nav-open | .screenshots/phase-08-a-luxe/account__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-a-luxe/blog-index__1280__resting.png | 4a768693263984d50e521c9d6a8f026096edbf6078914cafaa0cb13be94a3944 | - |
| blog-index | 390 | resting | .screenshots/phase-08-a-luxe/blog-index__390__resting.png | 2d30aca4d720dc02440583f538cd40cf10cb7ad2ffd2ce9f8c5ee1f05e1eae74 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-a-luxe/blog-post__1280__resting.png | 9d0159b5e1e61f57f130636efa24541b1f546d11d28d73c0a82f4a8a4bda69c7 | - |
| blog-post | 390 | resting | .screenshots/phase-08-a-luxe/blog-post__390__resting.png | 32af0a93847548e8c5f8c6def9451ce654c340e98b15f6b9797bc67e3c313601 | - |
| cms-page | 1280 | resting | .screenshots/phase-08-a-luxe/cms-page__1280__resting.png | 8453614911db499bf75aa62d1c411a8f0637f999f5f9fce9f3902f55c6434509 | - |
| cms-page | 390 | resting | .screenshots/phase-08-a-luxe/cms-page__390__resting.png | 7e0b14812b117ff92d7f3cc1ef21b70c8b2e91c98aa2b68271df4f5f87fcc5fe | - |

## Label: `phase-08-b-luxe`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-b-luxe/home__1280__resting.png | e7282b764a815d00a16ca623764d444ec469852b518888abe96ea248f9418775 | - |
| home | 1280 | nav-open | .screenshots/phase-08-b-luxe/home__1280__nav-open.png | 69170c36c73c657328787e6d211caa402457831068821af61ec20d6ea15ccb8a | - |
| home | 390 | resting | .screenshots/phase-08-b-luxe/home__390__resting.png | 0bc6358b7e4c4cc6210d774178c9d067b42b330c1a246bf35a919bf874ed5c60 | - |
| home | 390 | nav-open | .screenshots/phase-08-b-luxe/home__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| category | 1280 | resting | .screenshots/phase-08-b-luxe/category__1280__resting.png | 102dcafb93d5f3319cdb77d10da77419216b58791526fcf1d0f980e3ac48480d | - |
| category | 1280 | nav-open | .screenshots/phase-08-b-luxe/category__1280__nav-open.png | c92f095725524d44b6e418226eea592483f5c192327d0a6aeb76e200bd591dda | - |
| category | 390 | resting | .screenshots/phase-08-b-luxe/category__390__resting.png | cd03513b1a64455c43aeeaf7156be73367f3b963bc90216e4d156dd662bd44d8 | - |
| category | 390 | nav-open | .screenshots/phase-08-b-luxe/category__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| product | 1280 | resting | .screenshots/phase-08-b-luxe/product__1280__resting.png | 395160a70cc403abddb2bfb32d3caa5962bc8fb78995fea7e0004894856940c3 | - |
| product | 1280 | nav-open | .screenshots/phase-08-b-luxe/product__1280__nav-open.png | bdae4f2a91a4437c5106279cc69d2c0a5646dc3497769b0205e27c972aaaf3ce | - |
| product | 390 | resting | .screenshots/phase-08-b-luxe/product__390__resting.png | 0210885b6b928d45827326b73e951c9cb811d4fdb28324bca87c34d2bb9f4594 | - |
| product | 390 | nav-open | .screenshots/phase-08-b-luxe/product__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-b-luxe/cart__1280__cart-open.png | f6d7338d31de307a108063bb37b43c9a0dcd8941ea88285bdcd0869dc22c6066 | - |
| cart | 390 | cart-open | .screenshots/phase-08-b-luxe/cart__390__cart-open.png | 4ee3f143b2f07946a62448de9ee765ad71ae6e7bda101c28caf55a2df679649b | - |
| checkout | 1280 | resting | .screenshots/phase-08-b-luxe/checkout__1280__resting.png | 78f11d177d42bc783c097f4274bdaeadb05a426d6fd9f2e27475a0de634cdefe | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-b-luxe/checkout__1280__nav-open.png | ac8378e066b0e4e659886af916084fa7c515070927768bfe4cf90be541274bb4 | - |
| checkout | 390 | resting | .screenshots/phase-08-b-luxe/checkout__390__resting.png | d336a4209d3eefdeab9af037a110489dc5e19a8d7d74f471cd2c19618915ded9 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-b-luxe/checkout__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| account | 1280 | resting | .screenshots/phase-08-b-luxe/account__1280__resting.png | dc3eea4ee06afe5e03d0ca4be89907b3e5645a8e4752f467516bbec072e052e6 | - |
| account | 1280 | nav-open | .screenshots/phase-08-b-luxe/account__1280__nav-open.png | 4fa881f7e1c4ad00b66f434adbdba3a1bdb4bf8176299dd0e4fc4b937dd0b862 | - |
| account | 390 | resting | .screenshots/phase-08-b-luxe/account__390__resting.png | 00282843de6e82b05ed8594e4d3132bddc2ec2108f051e3e1b32da25daa2229f | - |
| account | 390 | nav-open | .screenshots/phase-08-b-luxe/account__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-b-luxe/blog-index__1280__resting.png | 4a768693263984d50e521c9d6a8f026096edbf6078914cafaa0cb13be94a3944 | - |
| blog-index | 390 | resting | .screenshots/phase-08-b-luxe/blog-index__390__resting.png | 2d30aca4d720dc02440583f538cd40cf10cb7ad2ffd2ce9f8c5ee1f05e1eae74 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-b-luxe/blog-post__1280__resting.png | 9d0159b5e1e61f57f130636efa24541b1f546d11d28d73c0a82f4a8a4bda69c7 | - |
| blog-post | 390 | resting | .screenshots/phase-08-b-luxe/blog-post__390__resting.png | 32af0a93847548e8c5f8c6def9451ce654c340e98b15f6b9797bc67e3c313601 | - |
| cms-page | 1280 | resting | .screenshots/phase-08-b-luxe/cms-page__1280__resting.png | 8453614911db499bf75aa62d1c411a8f0637f999f5f9fce9f3902f55c6434509 | - |
| cms-page | 390 | resting | .screenshots/phase-08-b-luxe/cms-page__390__resting.png | 7e0b14812b117ff92d7f3cc1ef21b70c8b2e91c98aa2b68271df4f5f87fcc5fe | - |

## Label: `phase-08-c-luxe`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-c-luxe/home__1280__resting.png | 551905f885dbce8f05da7b90bcc4814284ce1cf78c8433b1b47e09bc583f2023 | - |
| home | 1280 | nav-open | .screenshots/phase-08-c-luxe/home__1280__nav-open.png | f596b52c65e7c2c6c112886c8cf7f42b585b92c099055c40bde83732c544548b | - |
| home | 390 | resting | .screenshots/phase-08-c-luxe/home__390__resting.png | dd0c77118e96e84e70ae62c1b7af5b2b12faa53224f7d7304669d6ec31707dff | - |
| home | 390 | nav-open | .screenshots/phase-08-c-luxe/home__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| category | 1280 | resting | .screenshots/phase-08-c-luxe/category__1280__resting.png | b101bb0cf4662cc10fd62a04642f7a8ddda15fdd21f7220c16057da8424d0217 | - |
| category | 1280 | nav-open | .screenshots/phase-08-c-luxe/category__1280__nav-open.png | 33c61e3e3ce2311814452167316b899d10e610009e9fdea28c7fd49428bf7f3e | - |
| category | 390 | resting | .screenshots/phase-08-c-luxe/category__390__resting.png | 262df48e58f1d86e8ecf90387727fd65e975805d70bbf8caebae2c5be906c1ba | - |
| category | 390 | nav-open | .screenshots/phase-08-c-luxe/category__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| product | 1280 | resting | .screenshots/phase-08-c-luxe/product__1280__resting.png | 0b739438100c26c3473f93d910a5910dc6fd575643e323c97148ed7331d75e2e | - |
| product | 1280 | nav-open | .screenshots/phase-08-c-luxe/product__1280__nav-open.png | 6636d191609a71c0912ccd2438a00448c432ed4b86f9cf41090c309f1e9fc7f8 | - |
| product | 390 | resting | .screenshots/phase-08-c-luxe/product__390__resting.png | f65145446c5b8fc9582a614462177c48a3fb1aaee615d31664ddad822e0edc38 | - |
| product | 390 | nav-open | .screenshots/phase-08-c-luxe/product__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-c-luxe/cart__1280__cart-open.png | 96acb5578c14339fba7f9b098e5996ba9d88afd0ebc06f0fbcd54e6a573702cc | - |
| cart | 390 | cart-open | .screenshots/phase-08-c-luxe/cart__390__cart-open.png | 4ee3f143b2f07946a62448de9ee765ad71ae6e7bda101c28caf55a2df679649b | - |
| checkout | 1280 | resting | .screenshots/phase-08-c-luxe/checkout__1280__resting.png | 78f11d177d42bc783c097f4274bdaeadb05a426d6fd9f2e27475a0de634cdefe | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-c-luxe/checkout__1280__nav-open.png | ac8378e066b0e4e659886af916084fa7c515070927768bfe4cf90be541274bb4 | - |
| checkout | 390 | resting | .screenshots/phase-08-c-luxe/checkout__390__resting.png | d336a4209d3eefdeab9af037a110489dc5e19a8d7d74f471cd2c19618915ded9 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-c-luxe/checkout__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| account | 1280 | resting | .screenshots/phase-08-c-luxe/account__1280__resting.png | dc3eea4ee06afe5e03d0ca4be89907b3e5645a8e4752f467516bbec072e052e6 | - |
| account | 1280 | nav-open | .screenshots/phase-08-c-luxe/account__1280__nav-open.png | 4fa881f7e1c4ad00b66f434adbdba3a1bdb4bf8176299dd0e4fc4b937dd0b862 | - |
| account | 390 | resting | .screenshots/phase-08-c-luxe/account__390__resting.png | 00282843de6e82b05ed8594e4d3132bddc2ec2108f051e3e1b32da25daa2229f | - |
| account | 390 | nav-open | .screenshots/phase-08-c-luxe/account__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-c-luxe/blog-index__1280__resting.png | 4a768693263984d50e521c9d6a8f026096edbf6078914cafaa0cb13be94a3944 | - |
| blog-index | 390 | resting | .screenshots/phase-08-c-luxe/blog-index__390__resting.png | 2d30aca4d720dc02440583f538cd40cf10cb7ad2ffd2ce9f8c5ee1f05e1eae74 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-c-luxe/blog-post__1280__resting.png | 9d0159b5e1e61f57f130636efa24541b1f546d11d28d73c0a82f4a8a4bda69c7 | - |
| blog-post | 390 | resting | .screenshots/phase-08-c-luxe/blog-post__390__resting.png | 32af0a93847548e8c5f8c6def9451ce654c340e98b15f6b9797bc67e3c313601 | - |
| cms-page | 1280 | resting | .screenshots/phase-08-c-luxe/cms-page__1280__resting.png | 8453614911db499bf75aa62d1c411a8f0637f999f5f9fce9f3902f55c6434509 | - |
| cms-page | 390 | resting | .screenshots/phase-08-c-luxe/cms-page__390__resting.png | 7e0b14812b117ff92d7f3cc1ef21b70c8b2e91c98aa2b68271df4f5f87fcc5fe | - |

## Label: `phase-08-a-midnight`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-a-midnight/home__1280__resting.png | e534f89cf426d655e8e934aa2e95905cd5e29434471d5ac2f65d5f572c3ba575 | - |
| home | 1280 | nav-open | .screenshots/phase-08-a-midnight/home__1280__nav-open.png | 2db75e10a31fa88f1ac820cc0f3aa41a5193387d4a6329a3ef5ada09744bf987 | - |
| home | 390 | resting | .screenshots/phase-08-a-midnight/home__390__resting.png | 2ff582985f85bb90f1a01c2bb79f7a2379830cdd99c2b0c9f9b017f31cea5acf | - |
| home | 390 | nav-open | .screenshots/phase-08-a-midnight/home__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| category | 1280 | resting | .screenshots/phase-08-a-midnight/category__1280__resting.png | b50e95d7f759cb7827696a27bf96bc7521938fdf5805cdded3806f632367195b | - |
| category | 1280 | nav-open | .screenshots/phase-08-a-midnight/category__1280__nav-open.png | 0bf6081854d27f60e356623ac6b404d0043e8d6f3da5378770ba035899a941c9 | - |
| category | 390 | resting | .screenshots/phase-08-a-midnight/category__390__resting.png | 7b7212f53619444022a2e446af3f30e547fe1e0e339c0b6f1c3658b63a68aea6 | - |
| category | 390 | nav-open | .screenshots/phase-08-a-midnight/category__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| product | 1280 | resting | .screenshots/phase-08-a-midnight/product__1280__resting.png | 0ab743de62019b75db2118f2f9e59a8f2dec9bbf73ee2c0bfdeaf66c0e64ad01 | - |
| product | 1280 | nav-open | .screenshots/phase-08-a-midnight/product__1280__nav-open.png | b02f125ba20b278884dbfe982cdbb50fd6f19cec5da06555a737f1be2aad182a | - |
| product | 390 | resting | .screenshots/phase-08-a-midnight/product__390__resting.png | 35dbcc3567bdaa3082f8b26dfc08440c8ac7159668b7a9fd198a47b0f4a00e97 | - |
| product | 390 | nav-open | .screenshots/phase-08-a-midnight/product__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-a-midnight/cart__1280__cart-open.png | 396c1ffa4747042a3c7f8559ef7895ba999e4f3b7eee52985f0022421bec4ce2 | - |
| cart | 390 | cart-open | .screenshots/phase-08-a-midnight/cart__390__cart-open.png | fbfb6e35c19b94f46340b81854770697db0b7061e4c55321a59145fe70f90792 | - |
| checkout | 1280 | resting | .screenshots/phase-08-a-midnight/checkout__1280__resting.png | 9892d4e04b4036592cc73e3a48d46ce69f748d6fba3217f451ade82bb9dd35d9 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-a-midnight/checkout__1280__nav-open.png | eb732f849f4f797df42740fa145385ee9aa3b7848280b556ab82e5a53ebb8807 | - |
| checkout | 390 | resting | .screenshots/phase-08-a-midnight/checkout__390__resting.png | 37d9b4d3b62c887afc9bfdb75b73833374a9e1d511bffe88b6f04a9fc939efa6 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-a-midnight/checkout__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| account | 1280 | resting | .screenshots/phase-08-a-midnight/account__1280__resting.png | 161db153d8f1cfd3d1f3e6d59571431ed5e6072a5b38210ecc15e53828ef255a | - |
| account | 1280 | nav-open | .screenshots/phase-08-a-midnight/account__1280__nav-open.png | 75a90fc44007b008d1618b95bd41a14d84e86ca7f4514809d47832852b589aec | - |
| account | 390 | resting | .screenshots/phase-08-a-midnight/account__390__resting.png | 603371f022b732afe72423e11c03abc559da20917fa428d187d9f7b4315cd806 | - |
| account | 390 | nav-open | .screenshots/phase-08-a-midnight/account__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-a-midnight/blog-index__1280__resting.png | 617454e868f5e265625c5c1195752676a4c1c97d6b67b20aba4cf94b8da97277 | - |
| blog-index | 390 | resting | .screenshots/phase-08-a-midnight/blog-index__390__resting.png | f04337586c2d1fc087c8b750d29cf38e59155f3a12d41db60037fcd4bc19e106 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-a-midnight/blog-post__1280__resting.png | 3203dbcff6d4e47f81550fc8cac444ea5d43552e702b3be1a5f0a7f6c06457c8 | - |
| blog-post | 390 | resting | .screenshots/phase-08-a-midnight/blog-post__390__resting.png | 2bd7f876148c2abc8aa977d553a6cae262b76a036b6324121fe493450acde6f7 | - |
| cms-page | 1280 | resting | .screenshots/phase-08-a-midnight/cms-page__1280__resting.png | aba62ee2a97d5d98184d4333adf45f2e91fd9c887bf6594235d90fe216cd388f | - |
| cms-page | 390 | resting | .screenshots/phase-08-a-midnight/cms-page__390__resting.png | 3ffaca6082cea41ce2b26074a1d14ba2e5f693558886043caba2219470fd3c00 | - |

## Label: `phase-08-b-midnight`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-b-midnight/home__1280__resting.png | b859350f9d23112a0977f0d4b5f476bd5d04a0eb8711121b5dc9f804c09aea05 | - |
| home | 1280 | nav-open | .screenshots/phase-08-b-midnight/home__1280__nav-open.png | 2d5cc51a0b79d736bb6a779aafc88802b486f4d18a5d0ce2687d857c423bca73 | - |
| home | 390 | resting | .screenshots/phase-08-b-midnight/home__390__resting.png | c68f6c31bd14ea2eedd7e54a2d5f24f6b8fa9f559e3384a0d7789ae1801c0937 | - |
| home | 390 | nav-open | .screenshots/phase-08-b-midnight/home__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| category | 1280 | resting | .screenshots/phase-08-b-midnight/category__1280__resting.png | 532a0e49cd65833f8c18c5b12cbf3419388efbf012f40768c1f37bb16c58137e | - |
| category | 1280 | nav-open | .screenshots/phase-08-b-midnight/category__1280__nav-open.png | 409647ce9d33ce23423c3e260cd0a944e2f718891fece6ef913e611c7dc37b3d | - |
| category | 390 | resting | .screenshots/phase-08-b-midnight/category__390__resting.png | 7b7212f53619444022a2e446af3f30e547fe1e0e339c0b6f1c3658b63a68aea6 | - |
| category | 390 | nav-open | .screenshots/phase-08-b-midnight/category__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| product | 1280 | resting | .screenshots/phase-08-b-midnight/product__1280__resting.png | 45edadc5ab1bfb554cd7f2804bfbb0c60b39db24ab2f3ac89d08c6b4a16ab386 | - |
| product | 1280 | nav-open | .screenshots/phase-08-b-midnight/product__1280__nav-open.png | 0f560f56443ce06547d4d59efe6b39f2d082bdeed06b176277163f3f357d97bf | - |
| product | 390 | resting | .screenshots/phase-08-b-midnight/product__390__resting.png | 8f27fa033541fd7bb408821049958315db284d8aef1d62de00f11a11c92859a3 | - |
| product | 390 | nav-open | .screenshots/phase-08-b-midnight/product__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-b-midnight/cart__1280__cart-open.png | 54587636ff2c55436e6b65f206e082f3a299b3051b9151205eaf765a24c04fe4 | - |
| cart | 390 | cart-open | .screenshots/phase-08-b-midnight/cart__390__cart-open.png | fbfb6e35c19b94f46340b81854770697db0b7061e4c55321a59145fe70f90792 | - |
| checkout | 1280 | resting | .screenshots/phase-08-b-midnight/checkout__1280__resting.png | 9892d4e04b4036592cc73e3a48d46ce69f748d6fba3217f451ade82bb9dd35d9 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-b-midnight/checkout__1280__nav-open.png | eb732f849f4f797df42740fa145385ee9aa3b7848280b556ab82e5a53ebb8807 | - |
| checkout | 390 | resting | .screenshots/phase-08-b-midnight/checkout__390__resting.png | 37d9b4d3b62c887afc9bfdb75b73833374a9e1d511bffe88b6f04a9fc939efa6 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-b-midnight/checkout__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| account | 1280 | resting | .screenshots/phase-08-b-midnight/account__1280__resting.png | 161db153d8f1cfd3d1f3e6d59571431ed5e6072a5b38210ecc15e53828ef255a | - |
| account | 1280 | nav-open | .screenshots/phase-08-b-midnight/account__1280__nav-open.png | 75a90fc44007b008d1618b95bd41a14d84e86ca7f4514809d47832852b589aec | - |
| account | 390 | resting | .screenshots/phase-08-b-midnight/account__390__resting.png | 603371f022b732afe72423e11c03abc559da20917fa428d187d9f7b4315cd806 | - |
| account | 390 | nav-open | .screenshots/phase-08-b-midnight/account__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-b-midnight/blog-index__1280__resting.png | 617454e868f5e265625c5c1195752676a4c1c97d6b67b20aba4cf94b8da97277 | - |
| blog-index | 390 | resting | .screenshots/phase-08-b-midnight/blog-index__390__resting.png | f04337586c2d1fc087c8b750d29cf38e59155f3a12d41db60037fcd4bc19e106 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-b-midnight/blog-post__1280__resting.png | 3203dbcff6d4e47f81550fc8cac444ea5d43552e702b3be1a5f0a7f6c06457c8 | - |
| blog-post | 390 | resting | .screenshots/phase-08-b-midnight/blog-post__390__resting.png | 2bd7f876148c2abc8aa977d553a6cae262b76a036b6324121fe493450acde6f7 | - |
| cms-page | 1280 | resting | .screenshots/phase-08-b-midnight/cms-page__1280__resting.png | aba62ee2a97d5d98184d4333adf45f2e91fd9c887bf6594235d90fe216cd388f | - |
| cms-page | 390 | resting | .screenshots/phase-08-b-midnight/cms-page__390__resting.png | 3ffaca6082cea41ce2b26074a1d14ba2e5f693558886043caba2219470fd3c00 | - |

## Label: `phase-08-c-midnight`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-c-midnight/home__1280__resting.png | 2f05087014c57934a7ac6621dfc9676ad47ec3afe12df008710d0c5d86573336 | - |
| home | 1280 | nav-open | .screenshots/phase-08-c-midnight/home__1280__nav-open.png | 5f7e33f5f4d5a984c93516d140ff829098fb9c3c6735f5c21bde879b534b4b12 | - |
| home | 390 | resting | .screenshots/phase-08-c-midnight/home__390__resting.png | 468084a3af57d3e810a0e63b5c767998b0022cc665881dd6776f89a7f602b341 | - |
| home | 390 | nav-open | .screenshots/phase-08-c-midnight/home__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| category | 1280 | resting | .screenshots/phase-08-c-midnight/category__1280__resting.png | 80bf860fe13e48645f20ab7e47cd49a2eba439c0b59f07472eb4db470a64b3aa | - |
| category | 1280 | nav-open | .screenshots/phase-08-c-midnight/category__1280__nav-open.png | 7da6da0663f89d8a98112f75ed1f4195726cdc62afd2d36b98ba45cbbaabe2ce | - |
| category | 390 | resting | .screenshots/phase-08-c-midnight/category__390__resting.png | 46a187a91fb2c60681089954d83b6b20c6543bd5551f51d6e7f03a9bebe06b73 | - |
| category | 390 | nav-open | .screenshots/phase-08-c-midnight/category__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| product | 1280 | resting | .screenshots/phase-08-c-midnight/product__1280__resting.png | 0ab743de62019b75db2118f2f9e59a8f2dec9bbf73ee2c0bfdeaf66c0e64ad01 | - |
| product | 1280 | nav-open | .screenshots/phase-08-c-midnight/product__1280__nav-open.png | b02f125ba20b278884dbfe982cdbb50fd6f19cec5da06555a737f1be2aad182a | - |
| product | 390 | resting | .screenshots/phase-08-c-midnight/product__390__resting.png | 35dbcc3567bdaa3082f8b26dfc08440c8ac7159668b7a9fd198a47b0f4a00e97 | - |
| product | 390 | nav-open | .screenshots/phase-08-c-midnight/product__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-c-midnight/cart__1280__cart-open.png | ca2871428bb2fda27e2078be577e6f5fbccd4bfe0dd2317b85cfb5a321235149 | - |
| cart | 390 | cart-open | .screenshots/phase-08-c-midnight/cart__390__cart-open.png | fbfb6e35c19b94f46340b81854770697db0b7061e4c55321a59145fe70f90792 | - |
| checkout | 1280 | resting | .screenshots/phase-08-c-midnight/checkout__1280__resting.png | 9892d4e04b4036592cc73e3a48d46ce69f748d6fba3217f451ade82bb9dd35d9 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-c-midnight/checkout__1280__nav-open.png | eb732f849f4f797df42740fa145385ee9aa3b7848280b556ab82e5a53ebb8807 | - |
| checkout | 390 | resting | .screenshots/phase-08-c-midnight/checkout__390__resting.png | 37d9b4d3b62c887afc9bfdb75b73833374a9e1d511bffe88b6f04a9fc939efa6 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-c-midnight/checkout__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| account | 1280 | resting | .screenshots/phase-08-c-midnight/account__1280__resting.png | 161db153d8f1cfd3d1f3e6d59571431ed5e6072a5b38210ecc15e53828ef255a | - |
| account | 1280 | nav-open | .screenshots/phase-08-c-midnight/account__1280__nav-open.png | 75a90fc44007b008d1618b95bd41a14d84e86ca7f4514809d47832852b589aec | - |
| account | 390 | resting | .screenshots/phase-08-c-midnight/account__390__resting.png | 603371f022b732afe72423e11c03abc559da20917fa428d187d9f7b4315cd806 | - |
| account | 390 | nav-open | .screenshots/phase-08-c-midnight/account__390__nav-open.png | 7e1351ff5fe4ca70826fc4bc2699315b06f04fe104119826a3805c5828e98400 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-c-midnight/blog-index__1280__resting.png | 617454e868f5e265625c5c1195752676a4c1c97d6b67b20aba4cf94b8da97277 | - |
| blog-index | 390 | resting | .screenshots/phase-08-c-midnight/blog-index__390__resting.png | f04337586c2d1fc087c8b750d29cf38e59155f3a12d41db60037fcd4bc19e106 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-c-midnight/blog-post__1280__resting.png | 3203dbcff6d4e47f81550fc8cac444ea5d43552e702b3be1a5f0a7f6c06457c8 | - |
| blog-post | 390 | resting | .screenshots/phase-08-c-midnight/blog-post__390__resting.png | 2bd7f876148c2abc8aa977d553a6cae262b76a036b6324121fe493450acde6f7 | - |
| cms-page | 1280 | resting | .screenshots/phase-08-c-midnight/cms-page__1280__resting.png | aba62ee2a97d5d98184d4333adf45f2e91fd9c887bf6594235d90fe216cd388f | - |
| cms-page | 390 | resting | .screenshots/phase-08-c-midnight/cms-page__390__resting.png | 3ffaca6082cea41ce2b26074a1d14ba2e5f693558886043caba2219470fd3c00 | - |

## Label: `phase-08-a-clinical`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-a-clinical/home__1280__resting.png | 1d05c5b03955ce085f4d34beb12f893abf46ea0fad446763f9cedd33961a416d | - |
| home | 1280 | nav-open | .screenshots/phase-08-a-clinical/home__1280__nav-open.png | 02560b76be9915bc57dca9116a6f3c78a4a76c2da6b7be9d99fd36aa29a2e167 | - |
| home | 390 | resting | .screenshots/phase-08-a-clinical/home__390__resting.png | 2b5b550ae612d5ed44ef066ab6dc1eaa43a9e3a0ed4e05cba1a716094e471dd2 | - |
| home | 390 | nav-open | .screenshots/phase-08-a-clinical/home__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| category | 1280 | resting | .screenshots/phase-08-a-clinical/category__1280__resting.png | f26f6d04b84d40d8539df903a233c5df9dbf0cb8b85706422172608d7013888f | - |
| category | 1280 | nav-open | .screenshots/phase-08-a-clinical/category__1280__nav-open.png | eb20a9fecedff559005804f96747f4bf8cf3c33df5e4ea094a92b510344e7b84 | - |
| category | 390 | resting | .screenshots/phase-08-a-clinical/category__390__resting.png | 518fb58fbec8cc6949422b4d5f606414dcc0672b1b486769567b5b577ab13609 | - |
| category | 390 | nav-open | .screenshots/phase-08-a-clinical/category__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| product | 1280 | resting | .screenshots/phase-08-a-clinical/product__1280__resting.png | 23e99867a08a3492d4348f45b7766bdc937cb8d99d12bbec4d8d64278e8c2afe | - |
| product | 1280 | nav-open | .screenshots/phase-08-a-clinical/product__1280__nav-open.png | db9283b1446a14c783b9078b4ff71af1ff61a81f6c978077f3defc55f8a670d9 | - |
| product | 390 | resting | .screenshots/phase-08-a-clinical/product__390__resting.png | 2906815861c67c24900f56b1fd4e154d3092d29e1bdcc3d67d363ce961999f5f | - |
| product | 390 | nav-open | .screenshots/phase-08-a-clinical/product__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| cart | 1280 | cart-open | .screenshots/phase-08-a-clinical/cart__1280__cart-open.png | f483428610084c670dc33f3552c1b504fb92e0a5b85fc7b3fe1f2b3c41bbbe69 | - |
| cart | 390 | cart-open | .screenshots/phase-08-a-clinical/cart__390__cart-open.png | c06d6c7d8059765bdf7a1e17dace08b71407e2c4ad88b1817c180be107b9fe9d | - |
| checkout | 1280 | resting | .screenshots/phase-08-a-clinical/checkout__1280__resting.png | 2c4c41334cd68bd220f93e36bd5148ed41aafceed519ec88725776db4ce4dab7 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-a-clinical/checkout__1280__nav-open.png | 998343b873066f303714a17fbf653d16525bcd063ab94a573a70f7b1869cb621 | - |
| checkout | 390 | resting | .screenshots/phase-08-a-clinical/checkout__390__resting.png | e906b29c8e34b8199bf3fe16061d5e0abfe89bcef1e84ee65b2b72740783f380 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-a-clinical/checkout__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| account | 1280 | resting | .screenshots/phase-08-a-clinical/account__1280__resting.png | 3595f882b19e216a1332d83e7222f1f7fd9a8b9e44165b2e756173abbb620c2f | - |
| account | 1280 | nav-open | .screenshots/phase-08-a-clinical/account__1280__nav-open.png | 29bc4562e57bf86432f74c488843d68dc6f3e6d55e1df9305a064c65abd3b246 | - |
| account | 390 | resting | .screenshots/phase-08-a-clinical/account__390__resting.png | 44d4530bb0b44dd4c4f2d1aa44b21adfc689d917680a7d24c27a6b7e7e0c8df3 | - |
| account | 390 | nav-open | .screenshots/phase-08-a-clinical/account__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-a-clinical/blog-index__1280__resting.png | eecdbe2cfbdd827e23c30c7f2238aa842dc95a4e26ddd4096fbcabc5fa027700 | - |
| blog-index | 390 | resting | .screenshots/phase-08-a-clinical/blog-index__390__resting.png | 74974ad8024ad38819c503b5d83e2efe07238b0b41ad1d62f5cfb5a14d5b01b6 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-a-clinical/blog-post__1280__resting.png | f5c2b60c88a065c880238dd63a63dcad35de8711117c2eba88edaacaa60afe03 | - |
| blog-post | 390 | resting | .screenshots/phase-08-a-clinical/blog-post__390__resting.png | 7ef2f109c0a04157d3cc25f19ea9ce2c5f8749f91c43ee4126f6405b87db2fec | - |
| cms-page | 1280 | resting | .screenshots/phase-08-a-clinical/cms-page__1280__resting.png | 46bd3f924acf8089b4019e86941e0f922e3bbd694ce45c5d6cd70afe0070c31d | - |
| cms-page | 390 | resting | .screenshots/phase-08-a-clinical/cms-page__390__resting.png | 4856bb88adc76b4005651aa5b809d197fc8f7d9fa7b3dbda62de135a0f724c78 | - |

## Label: `phase-08-b-clinical`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-b-clinical/home__1280__resting.png | 0f7883cc433586af249cabf169a4cc6a6678e527e0a14b4438053f4acd1ac6c2 | - |
| home | 1280 | nav-open | .screenshots/phase-08-b-clinical/home__1280__nav-open.png | f6191729f9c52bbf5427f9af44c0920b1319c617e19b2b846e7e5169170f4fba | - |
| home | 390 | resting | .screenshots/phase-08-b-clinical/home__390__resting.png | 7d65718c5a1ccca2458f122d571f959d1bef68c7afb620a31afb867d3266833e | - |
| home | 390 | nav-open | .screenshots/phase-08-b-clinical/home__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| category | 1280 | resting | .screenshots/phase-08-b-clinical/category__1280__resting.png | f1c32e2fe1325d03f668aa15a4955df17f4ef0181d361f00245d9675d9daae76 | - |
| category | 1280 | nav-open | .screenshots/phase-08-b-clinical/category__1280__nav-open.png | b1bcddffbbf2941e0d02f65fcf5fffaf943c2a87291719d96e278f7d0001a2c3 | - |
| category | 390 | resting | .screenshots/phase-08-b-clinical/category__390__resting.png | 2d971940e731b4ecbaea6ba55bde3973874523f2ef500cf9b05b0a40d7c5a6fc | - |
| category | 390 | nav-open | .screenshots/phase-08-b-clinical/category__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| product | 1280 | resting | .screenshots/phase-08-b-clinical/product__1280__resting.png | d6927d89aab4399ef46b659859be8193ceb32dab57c8975cc3204fe179b88f62 | - |
| product | 1280 | nav-open | .screenshots/phase-08-b-clinical/product__1280__nav-open.png | e8d1028341f402b1f294077867353fad6033bae2052a085cbc4f0b39b6680d63 | - |
| product | 390 | resting | .screenshots/phase-08-b-clinical/product__390__resting.png | 2c2354366cfa521755c7d4b424423f1c6c9d27fb3aa6e49867951f516f50999f | - |
| product | 390 | nav-open | .screenshots/phase-08-b-clinical/product__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| cart | 1280 | cart-open | .screenshots/phase-08-b-clinical/cart__1280__cart-open.png | 0a6b6eb20eea4207fe07783106e14df3cd4dd52652dd4667641539f8e43cd67c | - |
| cart | 390 | cart-open | .screenshots/phase-08-b-clinical/cart__390__cart-open.png | c06d6c7d8059765bdf7a1e17dace08b71407e2c4ad88b1817c180be107b9fe9d | - |
| checkout | 1280 | resting | .screenshots/phase-08-b-clinical/checkout__1280__resting.png | 2c4c41334cd68bd220f93e36bd5148ed41aafceed519ec88725776db4ce4dab7 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-b-clinical/checkout__1280__nav-open.png | 998343b873066f303714a17fbf653d16525bcd063ab94a573a70f7b1869cb621 | - |
| checkout | 390 | resting | .screenshots/phase-08-b-clinical/checkout__390__resting.png | e906b29c8e34b8199bf3fe16061d5e0abfe89bcef1e84ee65b2b72740783f380 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-b-clinical/checkout__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| account | 1280 | resting | .screenshots/phase-08-b-clinical/account__1280__resting.png | 3595f882b19e216a1332d83e7222f1f7fd9a8b9e44165b2e756173abbb620c2f | - |
| account | 1280 | nav-open | .screenshots/phase-08-b-clinical/account__1280__nav-open.png | 29bc4562e57bf86432f74c488843d68dc6f3e6d55e1df9305a064c65abd3b246 | - |
| account | 390 | resting | .screenshots/phase-08-b-clinical/account__390__resting.png | 44d4530bb0b44dd4c4f2d1aa44b21adfc689d917680a7d24c27a6b7e7e0c8df3 | - |
| account | 390 | nav-open | .screenshots/phase-08-b-clinical/account__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-b-clinical/blog-index__1280__resting.png | eecdbe2cfbdd827e23c30c7f2238aa842dc95a4e26ddd4096fbcabc5fa027700 | - |
| blog-index | 390 | resting | .screenshots/phase-08-b-clinical/blog-index__390__resting.png | 74974ad8024ad38819c503b5d83e2efe07238b0b41ad1d62f5cfb5a14d5b01b6 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-b-clinical/blog-post__1280__resting.png | f5c2b60c88a065c880238dd63a63dcad35de8711117c2eba88edaacaa60afe03 | - |
| blog-post | 390 | resting | .screenshots/phase-08-b-clinical/blog-post__390__resting.png | 7ef2f109c0a04157d3cc25f19ea9ce2c5f8749f91c43ee4126f6405b87db2fec | - |
| cms-page | 1280 | resting | .screenshots/phase-08-b-clinical/cms-page__1280__resting.png | 46bd3f924acf8089b4019e86941e0f922e3bbd694ce45c5d6cd70afe0070c31d | - |
| cms-page | 390 | resting | .screenshots/phase-08-b-clinical/cms-page__390__resting.png | 4856bb88adc76b4005651aa5b809d197fc8f7d9fa7b3dbda62de135a0f724c78 | - |

## Label: `phase-08-c-clinical`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-c-clinical/home__1280__resting.png | 41e47aacd6b2e23aaebcac9586b2cf0947c6effa6432e5532b1d0051ed10b46d | - |
| home | 1280 | nav-open | .screenshots/phase-08-c-clinical/home__1280__nav-open.png | 220805249b1f0e09144e92bfeecc3eaaf878cbf4689f458dd813fa719874a7f2 | - |
| home | 390 | resting | .screenshots/phase-08-c-clinical/home__390__resting.png | 7f6af889d6c0018eae5ad915a5d61b9d594da8d98bc3934a6bf5e70d125bdf4d | - |
| home | 390 | nav-open | .screenshots/phase-08-c-clinical/home__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| category | 1280 | resting | .screenshots/phase-08-c-clinical/category__1280__resting.png | 9bd0c7355ccd1769c47b71d98e39f33b639e294f6da1e577df7bb0151176fb1a | - |
| category | 1280 | nav-open | .screenshots/phase-08-c-clinical/category__1280__nav-open.png | d6d09f38f3b9d5bd39476791ec240e8d04aadbcc0a6a7c6149ac39ec77097c2a | - |
| category | 390 | resting | .screenshots/phase-08-c-clinical/category__390__resting.png | 680fc6f2c4139202e648a9391edfdb986acd18ab023a4c417c56cd134aa5f459 | - |
| category | 390 | nav-open | .screenshots/phase-08-c-clinical/category__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| product | 1280 | resting | .screenshots/phase-08-c-clinical/product__1280__resting.png | 23e99867a08a3492d4348f45b7766bdc937cb8d99d12bbec4d8d64278e8c2afe | - |
| product | 1280 | nav-open | .screenshots/phase-08-c-clinical/product__1280__nav-open.png | db9283b1446a14c783b9078b4ff71af1ff61a81f6c978077f3defc55f8a670d9 | - |
| product | 390 | resting | .screenshots/phase-08-c-clinical/product__390__resting.png | 01f41c820d3412dd22285a8a45065ce3d66eaa3bde17e7d89901862806e5b2a4 | - |
| product | 390 | nav-open | .screenshots/phase-08-c-clinical/product__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| cart | 1280 | cart-open | .screenshots/phase-08-c-clinical/cart__1280__cart-open.png | 845c167d80f9132f5be9a52e20e9653ba5c05005567a919769eec1dd287d40ad | - |
| cart | 390 | cart-open | .screenshots/phase-08-c-clinical/cart__390__cart-open.png | c06d6c7d8059765bdf7a1e17dace08b71407e2c4ad88b1817c180be107b9fe9d | - |
| checkout | 1280 | resting | .screenshots/phase-08-c-clinical/checkout__1280__resting.png | 2c4c41334cd68bd220f93e36bd5148ed41aafceed519ec88725776db4ce4dab7 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-c-clinical/checkout__1280__nav-open.png | 998343b873066f303714a17fbf653d16525bcd063ab94a573a70f7b1869cb621 | - |
| checkout | 390 | resting | .screenshots/phase-08-c-clinical/checkout__390__resting.png | e906b29c8e34b8199bf3fe16061d5e0abfe89bcef1e84ee65b2b72740783f380 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-c-clinical/checkout__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| account | 1280 | resting | .screenshots/phase-08-c-clinical/account__1280__resting.png | 3595f882b19e216a1332d83e7222f1f7fd9a8b9e44165b2e756173abbb620c2f | - |
| account | 1280 | nav-open | .screenshots/phase-08-c-clinical/account__1280__nav-open.png | 29bc4562e57bf86432f74c488843d68dc6f3e6d55e1df9305a064c65abd3b246 | - |
| account | 390 | resting | .screenshots/phase-08-c-clinical/account__390__resting.png | 44d4530bb0b44dd4c4f2d1aa44b21adfc689d917680a7d24c27a6b7e7e0c8df3 | - |
| account | 390 | nav-open | .screenshots/phase-08-c-clinical/account__390__nav-open.png | cbd5fb0e54a71751245ab3bb9d4f5b744735b7a013e895336f7799a24aa93c4c | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-c-clinical/blog-index__1280__resting.png | eecdbe2cfbdd827e23c30c7f2238aa842dc95a4e26ddd4096fbcabc5fa027700 | - |
| blog-index | 390 | resting | .screenshots/phase-08-c-clinical/blog-index__390__resting.png | 74974ad8024ad38819c503b5d83e2efe07238b0b41ad1d62f5cfb5a14d5b01b6 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-c-clinical/blog-post__1280__resting.png | f5c2b60c88a065c880238dd63a63dcad35de8711117c2eba88edaacaa60afe03 | - |
| blog-post | 390 | resting | .screenshots/phase-08-c-clinical/blog-post__390__resting.png | 7ef2f109c0a04157d3cc25f19ea9ce2c5f8749f91c43ee4126f6405b87db2fec | - |
| cms-page | 1280 | resting | .screenshots/phase-08-c-clinical/cms-page__1280__resting.png | 46bd3f924acf8089b4019e86941e0f922e3bbd694ce45c5d6cd70afe0070c31d | - |
| cms-page | 390 | resting | .screenshots/phase-08-c-clinical/cms-page__390__resting.png | 4856bb88adc76b4005651aa5b809d197fc8f7d9fa7b3dbda62de135a0f724c78 | - |

## Label: `phase-08-a-retro`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-a-retro/home__1280__resting.png | e128155c2abde06f2469cad42962e1395328510ca8249b9dd9a049e596fdfdf1 | - |
| home | 1280 | nav-open | .screenshots/phase-08-a-retro/home__1280__nav-open.png | 802067eaf3bf812ec4408c359d0142d42f762174331088dcaf2e83032599aabd | - |
| home | 390 | resting | .screenshots/phase-08-a-retro/home__390__resting.png | acb28aa7ac72907af8c71be4ef5ded62554bca82f9fc00b466a2a54fccbc8145 | - |
| home | 390 | nav-open | .screenshots/phase-08-a-retro/home__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| category | 1280 | resting | .screenshots/phase-08-a-retro/category__1280__resting.png | af83e759e901fc6dc77495946700b76b919b74ec9af60d74b16a28f7b2e26c1e | - |
| category | 1280 | nav-open | .screenshots/phase-08-a-retro/category__1280__nav-open.png | 266c3379c21c8b458c21ecbe15bb95806f34e4e17dc4cfd122a30ce21b9ae9ce | - |
| category | 390 | resting | .screenshots/phase-08-a-retro/category__390__resting.png | ce68816f57a1624a48e1db64c3df64f0656d329955afb40af2c74d08a7a7674b | - |
| category | 390 | nav-open | .screenshots/phase-08-a-retro/category__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| product | 1280 | resting | .screenshots/phase-08-a-retro/product__1280__resting.png | 02ee8301885d8c4cf9d24055fca70fb84230bcc7e59ede95b0ddc0c89bf3103b | - |
| product | 1280 | nav-open | .screenshots/phase-08-a-retro/product__1280__nav-open.png | f48ea0e0a55d3f40487862b6ccbd55cdbb09c36ba723d7d95ac840df9ba05200 | - |
| product | 390 | resting | .screenshots/phase-08-a-retro/product__390__resting.png | d9994f02fe8c020192d3f4f042062a0390382a3afd58bff47db73bbd15f43a64 | - |
| product | 390 | nav-open | .screenshots/phase-08-a-retro/product__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-a-retro/cart__1280__cart-open.png | a7379a06d4ae0f92a1212768aa2756bbc9a4c21b5bae677036eac57eb72cf79e | - |
| cart | 390 | cart-open | .screenshots/phase-08-a-retro/cart__390__cart-open.png | 7d6cff42ada2a7a39344180ad2b87eb80685ab424f6c6f19f17aae3d0c50b6e6 | - |
| checkout | 1280 | resting | .screenshots/phase-08-a-retro/checkout__1280__resting.png | 4e77359cb889bd857921c606e0358804ead52135f2612d54c3b51ff65b695cf4 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-a-retro/checkout__1280__nav-open.png | 508001b46e568b7f446364e09f57e48f30ec5a18a0db770866f3664e4bc2fe7c | - |
| checkout | 390 | resting | .screenshots/phase-08-a-retro/checkout__390__resting.png | 8ba6a8409323dc6a2f008b42bba794307023ea58cd6077fed5445ac4f7657a51 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-a-retro/checkout__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| account | 1280 | resting | .screenshots/phase-08-a-retro/account__1280__resting.png | 1295321f6a3305f700da7fbd2c99efeac85f526e62cf0a7ef4cdc03b80fdfc56 | - |
| account | 1280 | nav-open | .screenshots/phase-08-a-retro/account__1280__nav-open.png | 82c805f396b6f628aa9b3d437351659e43860075bfc33c78aa8d84bdc4cf8f30 | - |
| account | 390 | resting | .screenshots/phase-08-a-retro/account__390__resting.png | d929c9c01e4e32e944574e0c8155ffc2dd19f56aa2032c9dfb75232bdc735884 | - |
| account | 390 | nav-open | .screenshots/phase-08-a-retro/account__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-a-retro/blog-index__1280__resting.png | 0f37f0462a83e591848093789acc9e10ceb3a34213b05c096e83089ef514716b | - |
| blog-index | 390 | resting | .screenshots/phase-08-a-retro/blog-index__390__resting.png | 4205d40374cd1c2cabcd7b5e97e7483b1c2bbff0d1ec885efea1af661f02f6e8 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-a-retro/blog-post__1280__resting.png | d9dba3dcf43bfd050be4c347f0a1d364454de74163d5f98b334c60a8cc50e3ad | - |
| blog-post | 390 | resting | .screenshots/phase-08-a-retro/blog-post__390__resting.png | 6683adb696c3f7005e8fe2d76c5325b662ab60dad0fdcd0ab4512c7523de8d3f | - |
| cms-page | 1280 | resting | .screenshots/phase-08-a-retro/cms-page__1280__resting.png | a647025f739c2a4f788071bbfacff50534a5c7efd2453628ff5048fe1555facb | - |
| cms-page | 390 | resting | .screenshots/phase-08-a-retro/cms-page__390__resting.png | d70bbfe50a3446c7d54bad8b8fb2502602389bd034a3790f840359f028baf231 | - |

## Label: `phase-08-b-retro`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-b-retro/home__1280__resting.png | 1e6b9d28240073fca5d5f38460b8384e1c833c5e511dece10574f4423e63ad87 | - |
| home | 1280 | nav-open | .screenshots/phase-08-b-retro/home__1280__nav-open.png | f514607a48cd6594f7d129c69fa5d2804034b2913c1a37029a120b953a81e0c3 | - |
| home | 390 | resting | .screenshots/phase-08-b-retro/home__390__resting.png | 2e9a38de0a62b1d32b5a02d09c5ce630037d87c9f4260dea098ddcc757e75855 | - |
| home | 390 | nav-open | .screenshots/phase-08-b-retro/home__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| category | 1280 | resting | .screenshots/phase-08-b-retro/category__1280__resting.png | ae1dfe2d6139d6d3e0a4f3f5c6c2cba0b49dd01c52a74c530fa642b87410caf4 | - |
| category | 1280 | nav-open | .screenshots/phase-08-b-retro/category__1280__nav-open.png | 1b3ad4cbe39c2fb2fcbf97a9f603ec77a33c78c303b39a9fa80508ee78908df8 | - |
| category | 390 | resting | .screenshots/phase-08-b-retro/category__390__resting.png | ce68816f57a1624a48e1db64c3df64f0656d329955afb40af2c74d08a7a7674b | - |
| category | 390 | nav-open | .screenshots/phase-08-b-retro/category__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| product | 1280 | resting | .screenshots/phase-08-b-retro/product__1280__resting.png | d92fadb426cbdc3e2a79a657902e7d4c4bccb1612150f9101d808b9ff23aa2b9 | - |
| product | 1280 | nav-open | .screenshots/phase-08-b-retro/product__1280__nav-open.png | 3c1efa2ed81dede048faa9de6923ed1b0e59ce8bf56427bea17b1d6b7355127b | - |
| product | 390 | resting | .screenshots/phase-08-b-retro/product__390__resting.png | c0aa743347a94290632857993435c9925802918926aee070e0344883cddc0521 | - |
| product | 390 | nav-open | .screenshots/phase-08-b-retro/product__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-b-retro/cart__1280__cart-open.png | 06295b99ce25d0b0d5b7dbf79d072748226dba24ed0318177bbed68bf24b3458 | - |
| cart | 390 | cart-open | .screenshots/phase-08-b-retro/cart__390__cart-open.png | 7d6cff42ada2a7a39344180ad2b87eb80685ab424f6c6f19f17aae3d0c50b6e6 | - |
| checkout | 1280 | resting | .screenshots/phase-08-b-retro/checkout__1280__resting.png | 4e77359cb889bd857921c606e0358804ead52135f2612d54c3b51ff65b695cf4 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-b-retro/checkout__1280__nav-open.png | 508001b46e568b7f446364e09f57e48f30ec5a18a0db770866f3664e4bc2fe7c | - |
| checkout | 390 | resting | .screenshots/phase-08-b-retro/checkout__390__resting.png | 8ba6a8409323dc6a2f008b42bba794307023ea58cd6077fed5445ac4f7657a51 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-b-retro/checkout__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| account | 1280 | resting | .screenshots/phase-08-b-retro/account__1280__resting.png | 1295321f6a3305f700da7fbd2c99efeac85f526e62cf0a7ef4cdc03b80fdfc56 | - |
| account | 1280 | nav-open | .screenshots/phase-08-b-retro/account__1280__nav-open.png | 82c805f396b6f628aa9b3d437351659e43860075bfc33c78aa8d84bdc4cf8f30 | - |
| account | 390 | resting | .screenshots/phase-08-b-retro/account__390__resting.png | d929c9c01e4e32e944574e0c8155ffc2dd19f56aa2032c9dfb75232bdc735884 | - |
| account | 390 | nav-open | .screenshots/phase-08-b-retro/account__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-b-retro/blog-index__1280__resting.png | 0f37f0462a83e591848093789acc9e10ceb3a34213b05c096e83089ef514716b | - |
| blog-index | 390 | resting | .screenshots/phase-08-b-retro/blog-index__390__resting.png | 4205d40374cd1c2cabcd7b5e97e7483b1c2bbff0d1ec885efea1af661f02f6e8 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-b-retro/blog-post__1280__resting.png | d9dba3dcf43bfd050be4c347f0a1d364454de74163d5f98b334c60a8cc50e3ad | - |
| blog-post | 390 | resting | .screenshots/phase-08-b-retro/blog-post__390__resting.png | 6683adb696c3f7005e8fe2d76c5325b662ab60dad0fdcd0ab4512c7523de8d3f | - |
| cms-page | 1280 | resting | .screenshots/phase-08-b-retro/cms-page__1280__resting.png | a647025f739c2a4f788071bbfacff50534a5c7efd2453628ff5048fe1555facb | - |
| cms-page | 390 | resting | .screenshots/phase-08-b-retro/cms-page__390__resting.png | d70bbfe50a3446c7d54bad8b8fb2502602389bd034a3790f840359f028baf231 | - |

## Label: `phase-08-c-retro`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-c-retro/home__1280__resting.png | 09e948b9df0bdc10cf2be76bb24535787b74e9d9a7b6668a16e709ec92fc8f8f | - |
| home | 1280 | nav-open | .screenshots/phase-08-c-retro/home__1280__nav-open.png | bf7de956caf0c8248646f4aa2de4650a4f7d319d5a9705ed2a77b7b7e56ea993 | - |
| home | 390 | resting | .screenshots/phase-08-c-retro/home__390__resting.png | 983b01ce3c8c9447b603aaf1ec9f14a559e9a961fdaab5647221741a2b7b3f61 | - |
| home | 390 | nav-open | .screenshots/phase-08-c-retro/home__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| category | 1280 | resting | .screenshots/phase-08-c-retro/category__1280__resting.png | 0eda16c8876b942ef1b40e1876fef7377fd5c6838278086f4d19197b4f5e480d | - |
| category | 1280 | nav-open | .screenshots/phase-08-c-retro/category__1280__nav-open.png | 3c7761abcee37f13c9eea7c63e63fe6f8b95672a3890b44bd0551ad9f1367006 | - |
| category | 390 | resting | .screenshots/phase-08-c-retro/category__390__resting.png | 3626265db6c8fc26cdded0db177ef51fda21ede91de6e67252c8c1fed4df7e22 | - |
| category | 390 | nav-open | .screenshots/phase-08-c-retro/category__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| product | 1280 | resting | .screenshots/phase-08-c-retro/product__1280__resting.png | 02ee8301885d8c4cf9d24055fca70fb84230bcc7e59ede95b0ddc0c89bf3103b | - |
| product | 1280 | nav-open | .screenshots/phase-08-c-retro/product__1280__nav-open.png | f48ea0e0a55d3f40487862b6ccbd55cdbb09c36ba723d7d95ac840df9ba05200 | - |
| product | 390 | resting | .screenshots/phase-08-c-retro/product__390__resting.png | d9994f02fe8c020192d3f4f042062a0390382a3afd58bff47db73bbd15f43a64 | - |
| product | 390 | nav-open | .screenshots/phase-08-c-retro/product__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-c-retro/cart__1280__cart-open.png | da0848a567d8a1c19dc2d73ba0f5022661adc67a1efaa95c99ca2b212a063c3c | - |
| cart | 390 | cart-open | .screenshots/phase-08-c-retro/cart__390__cart-open.png | 7d6cff42ada2a7a39344180ad2b87eb80685ab424f6c6f19f17aae3d0c50b6e6 | - |
| checkout | 1280 | resting | .screenshots/phase-08-c-retro/checkout__1280__resting.png | 4e77359cb889bd857921c606e0358804ead52135f2612d54c3b51ff65b695cf4 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-c-retro/checkout__1280__nav-open.png | 508001b46e568b7f446364e09f57e48f30ec5a18a0db770866f3664e4bc2fe7c | - |
| checkout | 390 | resting | .screenshots/phase-08-c-retro/checkout__390__resting.png | 8ba6a8409323dc6a2f008b42bba794307023ea58cd6077fed5445ac4f7657a51 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-c-retro/checkout__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| account | 1280 | resting | .screenshots/phase-08-c-retro/account__1280__resting.png | 1295321f6a3305f700da7fbd2c99efeac85f526e62cf0a7ef4cdc03b80fdfc56 | - |
| account | 1280 | nav-open | .screenshots/phase-08-c-retro/account__1280__nav-open.png | 82c805f396b6f628aa9b3d437351659e43860075bfc33c78aa8d84bdc4cf8f30 | - |
| account | 390 | resting | .screenshots/phase-08-c-retro/account__390__resting.png | d929c9c01e4e32e944574e0c8155ffc2dd19f56aa2032c9dfb75232bdc735884 | - |
| account | 390 | nav-open | .screenshots/phase-08-c-retro/account__390__nav-open.png | 8d1709fb8d0751c2e57de40bca4e459b3f779fb4c19283b568fb846ac93c25e9 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-c-retro/blog-index__1280__resting.png | 0f37f0462a83e591848093789acc9e10ceb3a34213b05c096e83089ef514716b | - |
| blog-index | 390 | resting | .screenshots/phase-08-c-retro/blog-index__390__resting.png | 4205d40374cd1c2cabcd7b5e97e7483b1c2bbff0d1ec885efea1af661f02f6e8 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-c-retro/blog-post__1280__resting.png | d9dba3dcf43bfd050be4c347f0a1d364454de74163d5f98b334c60a8cc50e3ad | - |
| blog-post | 390 | resting | .screenshots/phase-08-c-retro/blog-post__390__resting.png | 6683adb696c3f7005e8fe2d76c5325b662ab60dad0fdcd0ab4512c7523de8d3f | - |
| cms-page | 1280 | resting | .screenshots/phase-08-c-retro/cms-page__1280__resting.png | a647025f739c2a4f788071bbfacff50534a5c7efd2453628ff5048fe1555facb | - |
| cms-page | 390 | resting | .screenshots/phase-08-c-retro/cms-page__390__resting.png | d70bbfe50a3446c7d54bad8b8fb2502602389bd034a3790f840359f028baf231 | - |

## Label: `phase-08-a-atelier`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-a-atelier/home__1280__resting.png | 35695e4b7ab9febccb33a0bad05259897a2a645e2b316df5cf4d622c7ffaa17a | - |
| home | 1280 | nav-open | .screenshots/phase-08-a-atelier/home__1280__nav-open.png | c08ffd7f4b06b4fcde1b2870e7123d362f57d6715bb09d4cf673f6300775109d | - |
| home | 390 | resting | .screenshots/phase-08-a-atelier/home__390__resting.png | 1f799d814c5e4fe79309c68dbeee50b815e893c5205e053e3e02eb943150b39c | - |
| home | 390 | nav-open | .screenshots/phase-08-a-atelier/home__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| category | 1280 | resting | .screenshots/phase-08-a-atelier/category__1280__resting.png | 653cd2dde7dd00c0435f11a1fc3c7f1bb63c8ce0de0003b9ec8a54c15dca2bf3 | - |
| category | 1280 | nav-open | .screenshots/phase-08-a-atelier/category__1280__nav-open.png | 4ebe3778abe5cca2c0be44356ca1f373f7d7708ecf7a942768215206f6bdb019 | - |
| category | 390 | resting | .screenshots/phase-08-a-atelier/category__390__resting.png | 28a3232b95707dddf420e48742e641f59dd32c4e7ff9f5c1f9dd14fb51de0610 | - |
| category | 390 | nav-open | .screenshots/phase-08-a-atelier/category__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| product | 1280 | resting | .screenshots/phase-08-a-atelier/product__1280__resting.png | 8312b377f9aafc00178ffe9012409b59125c993dcb119943644e8ba4d9e1ace2 | - |
| product | 1280 | nav-open | .screenshots/phase-08-a-atelier/product__1280__nav-open.png | 2cd1526d5e196dd7611b79a0ba934d6c6cb4a2df2d5f5e86d9fcead870583904 | - |
| product | 390 | resting | .screenshots/phase-08-a-atelier/product__390__resting.png | 00f7ddedc5b1035944bc34fafb02b9f34ec406db7549511f3c348b1e13cfe438 | - |
| product | 390 | nav-open | .screenshots/phase-08-a-atelier/product__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| cart | 1280 | cart-open | .screenshots/phase-08-a-atelier/cart__1280__cart-open.png | 08713145cbbca57ea5131fc2e6250742c19b0a8b930ca3171eeb6d1e71272a55 | - |
| cart | 390 | cart-open | .screenshots/phase-08-a-atelier/cart__390__cart-open.png | 65484c0aaa8fec07a79bf72e22416c4ec3c4fc1ca7602bfee8d647e4d6fb1ff0 | - |
| checkout | 1280 | resting | .screenshots/phase-08-a-atelier/checkout__1280__resting.png | e22c9ceb4eb803759459753d0176ef7fb827b2e200613f5af8db728a523e8cc8 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-a-atelier/checkout__1280__nav-open.png | 9277bb9b80605355ee0366c4a411c4ab0f3451c001147061aaf683ec4a4d924a | - |
| checkout | 390 | resting | .screenshots/phase-08-a-atelier/checkout__390__resting.png | e0811304ba34422fc18f746aede07131a3e5b3aaf3b10624e5def62048ffacde | - |
| checkout | 390 | nav-open | .screenshots/phase-08-a-atelier/checkout__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| account | 1280 | resting | .screenshots/phase-08-a-atelier/account__1280__resting.png | ce283b77eb188354c670d8c63a51c30a441c97259cb91d9db930b436f796b52e | - |
| account | 1280 | nav-open | .screenshots/phase-08-a-atelier/account__1280__nav-open.png | b196a43dc588d47477fa796e4f195111c5dd7206f5026011d42af6b6fa84887a | - |
| account | 390 | resting | .screenshots/phase-08-a-atelier/account__390__resting.png | 8751c2895cb67cefe46324535ccb632decd428cb6bffbbdd3e9e61fbf62984a5 | - |
| account | 390 | nav-open | .screenshots/phase-08-a-atelier/account__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-a-atelier/blog-index__1280__resting.png | dd2825532289df5056a028e8530ef99c00b3a0999fb64cc8589c6e61d880d922 | - |
| blog-index | 390 | resting | .screenshots/phase-08-a-atelier/blog-index__390__resting.png | 6b598feb7a90ca73fefb1ffa15c8c7d84b5c6122b58e9b338e94e14791b656c4 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-a-atelier/blog-post__1280__resting.png | fe870a6d432a6745a9fa6227bd781cde92723d8a78e82290171172cc30f808f7 | - |
| blog-post | 390 | resting | .screenshots/phase-08-a-atelier/blog-post__390__resting.png | c76cce2433c8ec4aa6f68ffe91746ca2296bb23a67516ae9d66b42e58a321dc4 | - |
| cms-page | 1280 | resting | .screenshots/phase-08-a-atelier/cms-page__1280__resting.png | 7a92155e1262ac251c560d562f782cd0c94f47a355076cd476cecc340313fe37 | - |
| cms-page | 390 | resting | .screenshots/phase-08-a-atelier/cms-page__390__resting.png | 4dd84df3fffdeb57831c67f2e429af5a8710a9f5fc1c2021c6e9afae4a65fdaa | - |

## Label: `phase-08-b-atelier`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-b-atelier/home__1280__resting.png | ec1a71f0e37eae965086b20e7546461c0bfd682a14e40512d55d5b1dcb8ffa98 | - |
| home | 1280 | nav-open | .screenshots/phase-08-b-atelier/home__1280__nav-open.png | c3c61819271d83b3d6ebca33b84a4a4df648dfdd9d489626d8cd1b79802ae6d3 | - |
| home | 390 | resting | .screenshots/phase-08-b-atelier/home__390__resting.png | 56a8dcdb7a79862e9a84ab225ea830d4af93eaef34563e3e2fc460643dad5b63 | - |
| home | 390 | nav-open | .screenshots/phase-08-b-atelier/home__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| category | 1280 | resting | .screenshots/phase-08-b-atelier/category__1280__resting.png | 4248b0431a48bc02badd84d49c25e4882a8de7a885fa6d03cfc0d01040a75af5 | - |
| category | 1280 | nav-open | .screenshots/phase-08-b-atelier/category__1280__nav-open.png | 61908715b1e2faadf9944a547baa7d55a9cc648ea6a91c0b62a2904d4429ffd3 | - |
| category | 390 | resting | .screenshots/phase-08-b-atelier/category__390__resting.png | 28a3232b95707dddf420e48742e641f59dd32c4e7ff9f5c1f9dd14fb51de0610 | - |
| category | 390 | nav-open | .screenshots/phase-08-b-atelier/category__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| product | 1280 | resting | .screenshots/phase-08-b-atelier/product__1280__resting.png | d511bf2701c6be9a8fbbac33f17c6ecd8a5c22736d68a4c701c8ba674fda526f | - |
| product | 1280 | nav-open | .screenshots/phase-08-b-atelier/product__1280__nav-open.png | bd5a7466e66171dce24317959c6ae8677c8c4a7c3702fb39867d193bfafa9c19 | - |
| product | 390 | resting | .screenshots/phase-08-b-atelier/product__390__resting.png | 8839715f38516b37b375a56abf8667958beabfe97c660c7b91a0f9ae26b6f4f9 | - |
| product | 390 | nav-open | .screenshots/phase-08-b-atelier/product__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| cart | 1280 | cart-open | .screenshots/phase-08-b-atelier/cart__1280__cart-open.png | 1e3f683eb0954173af5777ae14c01f12063b18c72ffcaf73f1e3f98a1c80b0d9 | - |
| cart | 390 | cart-open | .screenshots/phase-08-b-atelier/cart__390__cart-open.png | 65484c0aaa8fec07a79bf72e22416c4ec3c4fc1ca7602bfee8d647e4d6fb1ff0 | - |
| checkout | 1280 | resting | .screenshots/phase-08-b-atelier/checkout__1280__resting.png | e22c9ceb4eb803759459753d0176ef7fb827b2e200613f5af8db728a523e8cc8 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-b-atelier/checkout__1280__nav-open.png | 9277bb9b80605355ee0366c4a411c4ab0f3451c001147061aaf683ec4a4d924a | - |
| checkout | 390 | resting | .screenshots/phase-08-b-atelier/checkout__390__resting.png | e0811304ba34422fc18f746aede07131a3e5b3aaf3b10624e5def62048ffacde | - |
| checkout | 390 | nav-open | .screenshots/phase-08-b-atelier/checkout__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| account | 1280 | resting | .screenshots/phase-08-b-atelier/account__1280__resting.png | ce283b77eb188354c670d8c63a51c30a441c97259cb91d9db930b436f796b52e | - |
| account | 1280 | nav-open | .screenshots/phase-08-b-atelier/account__1280__nav-open.png | b196a43dc588d47477fa796e4f195111c5dd7206f5026011d42af6b6fa84887a | - |
| account | 390 | resting | .screenshots/phase-08-b-atelier/account__390__resting.png | 8751c2895cb67cefe46324535ccb632decd428cb6bffbbdd3e9e61fbf62984a5 | - |
| account | 390 | nav-open | .screenshots/phase-08-b-atelier/account__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-b-atelier/blog-index__1280__resting.png | dd2825532289df5056a028e8530ef99c00b3a0999fb64cc8589c6e61d880d922 | - |
| blog-index | 390 | resting | .screenshots/phase-08-b-atelier/blog-index__390__resting.png | 6b598feb7a90ca73fefb1ffa15c8c7d84b5c6122b58e9b338e94e14791b656c4 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-b-atelier/blog-post__1280__resting.png | fe870a6d432a6745a9fa6227bd781cde92723d8a78e82290171172cc30f808f7 | - |
| blog-post | 390 | resting | .screenshots/phase-08-b-atelier/blog-post__390__resting.png | c76cce2433c8ec4aa6f68ffe91746ca2296bb23a67516ae9d66b42e58a321dc4 | - |
| cms-page | 1280 | resting | .screenshots/phase-08-b-atelier/cms-page__1280__resting.png | 7a92155e1262ac251c560d562f782cd0c94f47a355076cd476cecc340313fe37 | - |
| cms-page | 390 | resting | .screenshots/phase-08-b-atelier/cms-page__390__resting.png | 4dd84df3fffdeb57831c67f2e429af5a8710a9f5fc1c2021c6e9afae4a65fdaa | - |

## Label: `phase-08-c-atelier`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-c-atelier/home__1280__resting.png | 21288a9351bc664c8fbae08994b6bd578bccbf6ba081572c16789b5d377eee4d | - |
| home | 1280 | nav-open | .screenshots/phase-08-c-atelier/home__1280__nav-open.png | 6e203ceba5175e6200ef177b11918171fb6dd85d6fe1b476e03ba3505218f6d5 | - |
| home | 390 | resting | .screenshots/phase-08-c-atelier/home__390__resting.png | 675b027df2442de1679bd1282b2e63bc0ec022e1f2da1ade2e177212e5d10a31 | - |
| home | 390 | nav-open | .screenshots/phase-08-c-atelier/home__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| category | 1280 | resting | .screenshots/phase-08-c-atelier/category__1280__resting.png | 013cbb93f5c8ba8111e36089f6dd5afd5cd477a108dfa047420d06ebb5e85de8 | - |
| category | 1280 | nav-open | .screenshots/phase-08-c-atelier/category__1280__nav-open.png | c07817f937080f44adda2da7c19192da5c3e4c33d17d53c9d709ca80d5c3c6c5 | - |
| category | 390 | resting | .screenshots/phase-08-c-atelier/category__390__resting.png | 5e73adf27a7189fbaebf869c04c06cf9475cdf44a855cfc9f38e8a11a7d62c45 | - |
| category | 390 | nav-open | .screenshots/phase-08-c-atelier/category__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| product | 1280 | resting | .screenshots/phase-08-c-atelier/product__1280__resting.png | 8312b377f9aafc00178ffe9012409b59125c993dcb119943644e8ba4d9e1ace2 | - |
| product | 1280 | nav-open | .screenshots/phase-08-c-atelier/product__1280__nav-open.png | 425a34a736db80b064edea1e86ed63ee78b9533b4d84d104e262003c5175d102 | - |
| product | 390 | resting | .screenshots/phase-08-c-atelier/product__390__resting.png | 00f7ddedc5b1035944bc34fafb02b9f34ec406db7549511f3c348b1e13cfe438 | - |
| product | 390 | nav-open | .screenshots/phase-08-c-atelier/product__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| cart | 1280 | cart-open | .screenshots/phase-08-c-atelier/cart__1280__cart-open.png | 964b21f1ac8780a35699aba9ba27ee390b715905cce9d85aa7363882a919285d | - |
| cart | 390 | cart-open | .screenshots/phase-08-c-atelier/cart__390__cart-open.png | 65484c0aaa8fec07a79bf72e22416c4ec3c4fc1ca7602bfee8d647e4d6fb1ff0 | - |
| checkout | 1280 | resting | .screenshots/phase-08-c-atelier/checkout__1280__resting.png | e22c9ceb4eb803759459753d0176ef7fb827b2e200613f5af8db728a523e8cc8 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-c-atelier/checkout__1280__nav-open.png | 9277bb9b80605355ee0366c4a411c4ab0f3451c001147061aaf683ec4a4d924a | - |
| checkout | 390 | resting | .screenshots/phase-08-c-atelier/checkout__390__resting.png | e0811304ba34422fc18f746aede07131a3e5b3aaf3b10624e5def62048ffacde | - |
| checkout | 390 | nav-open | .screenshots/phase-08-c-atelier/checkout__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| account | 1280 | resting | .screenshots/phase-08-c-atelier/account__1280__resting.png | ce283b77eb188354c670d8c63a51c30a441c97259cb91d9db930b436f796b52e | - |
| account | 1280 | nav-open | .screenshots/phase-08-c-atelier/account__1280__nav-open.png | b196a43dc588d47477fa796e4f195111c5dd7206f5026011d42af6b6fa84887a | - |
| account | 390 | resting | .screenshots/phase-08-c-atelier/account__390__resting.png | 8751c2895cb67cefe46324535ccb632decd428cb6bffbbdd3e9e61fbf62984a5 | - |
| account | 390 | nav-open | .screenshots/phase-08-c-atelier/account__390__nav-open.png | 3f6ca72326b76d3475f92f30c1fcbe89440d4af5f88612c5e448900548ed548f | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-c-atelier/blog-index__1280__resting.png | dd2825532289df5056a028e8530ef99c00b3a0999fb64cc8589c6e61d880d922 | - |
| blog-index | 390 | resting | .screenshots/phase-08-c-atelier/blog-index__390__resting.png | 6b598feb7a90ca73fefb1ffa15c8c7d84b5c6122b58e9b338e94e14791b656c4 | - |
| blog-post | 1280 | resting | .screenshots/phase-08-c-atelier/blog-post__1280__resting.png | fe870a6d432a6745a9fa6227bd781cde92723d8a78e82290171172cc30f808f7 | - |
| blog-post | 390 | resting | .screenshots/phase-08-c-atelier/blog-post__390__resting.png | c76cce2433c8ec4aa6f68ffe91746ca2296bb23a67516ae9d66b42e58a321dc4 | - |
| cms-page | 1280 | resting | .screenshots/phase-08-c-atelier/cms-page__1280__resting.png | 7a92155e1262ac251c560d562f782cd0c94f47a355076cd476cecc340313fe37 | - |
| cms-page | 390 | resting | .screenshots/phase-08-c-atelier/cms-page__390__resting.png | 4dd84df3fffdeb57831c67f2e429af5a8710a9f5fc1c2021c6e9afae4a65fdaa | - |

## Label: `phase-08-a-market`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-a-market/home__1280__resting.png | 15b3916ee7d2e0d540770c0da8ef33f47273db7d3500d97fcf7cd1ada0cabedb | - |
| home | 1280 | nav-open | .screenshots/phase-08-a-market/home__1280__nav-open.png | a6a64a8f8c77e1c51b706c4f3bc476c424ed33e57fe6cfb0fef051747a2c2fd3 | - |
| home | 390 | resting | .screenshots/phase-08-a-market/home__390__resting.png | 0d0eae38603c188586e109f70c6d3183a01f658b1c44ecde52a306cb5fe4092d | - |
| home | 390 | nav-open | .screenshots/phase-08-a-market/home__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| category | 1280 | resting | .screenshots/phase-08-a-market/category__1280__resting.png | 004cee85b5079a01b2648a2ff5165abe8d7a073cf8b25f60c8d41759ab217001 | - |
| category | 1280 | nav-open | .screenshots/phase-08-a-market/category__1280__nav-open.png | d5c44aeaa86044002506a27495164472557dccfac20e3be662b14acafd9d4e0a | - |
| category | 390 | resting | .screenshots/phase-08-a-market/category__390__resting.png | d31e2a7e5fb32b2be28850ec1a439b15ebea01e65fe9155dfc8a9831814dd530 | - |
| category | 390 | nav-open | .screenshots/phase-08-a-market/category__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| product | 1280 | resting | .screenshots/phase-08-a-market/product__1280__resting.png | 8cc72f49a48c6bd8257baad37a61b3bc75e4d6cd8039d4a1f22beff7fa2c58b3 | - |
| product | 1280 | nav-open | .screenshots/phase-08-a-market/product__1280__nav-open.png | e67bffa7d6de057004ef1a99432bb0fd970e06190a3e6a1d19d25c122cdb38b2 | - |
| product | 390 | resting | .screenshots/phase-08-a-market/product__390__resting.png | 67eccc7553fd58a54c6bb3e039ea1a41e454490bffaa6d4a2426f3b831dcab70 | - |
| product | 390 | nav-open | .screenshots/phase-08-a-market/product__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-a-market/cart__1280__cart-open.png | 0d0f1bcac239d19d3d6b2b124f5f7ba67617c42047bd6238e2abe34d65b8b2ac | - |
| cart | 390 | cart-open | .screenshots/phase-08-a-market/cart__390__cart-open.png | 8db8ef8815691bba465c940126da0ee24f7656a814cae32567bf9282b7607149 | - |
| checkout | 1280 | resting | .screenshots/phase-08-a-market/checkout__1280__resting.png | 15b673516ed16364734a227ecb153a181b8f160de3fadb1ea09ec88f4b2608e1 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-a-market/checkout__1280__nav-open.png | 36ebfd0f96c7100a54f3e0fde308da5650d6689cbfe3e91fb8aa4e9eabea61a8 | - |
| checkout | 390 | resting | .screenshots/phase-08-a-market/checkout__390__resting.png | a7f9e84278432ef817c716fc740164fd9564d964136903ddb24a609decb2e288 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-a-market/checkout__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| account | 1280 | resting | .screenshots/phase-08-a-market/account__1280__resting.png | e3f4fd6518bab08c7ec2936999497baaf88850bc04b994798b09cf3893fad7b9 | - |
| account | 1280 | nav-open | .screenshots/phase-08-a-market/account__1280__nav-open.png | 69788975f487b628a1a00f0ae654a8148dd507bc69efeb0a6f598e1d0e176862 | - |
| account | 390 | resting | .screenshots/phase-08-a-market/account__390__resting.png | 2098dda817638731005fadd92a00d769f4054e20e6e6e9523b487198c72938b9 | - |
| account | 390 | nav-open | .screenshots/phase-08-a-market/account__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-a-market/blog-index__1280__resting.png | 02b4f1ed5827aaa56df45bcf4dd6129a0e14b709331a56f8c642c00a9271d574 | - |
| blog-index | 390 | resting | .screenshots/phase-08-a-market/blog-index__390__resting.png | d1235f069e0eae9e79fc4cc9f6aa5d880810536794b863779ca4f19ddc090f4a | - |
| blog-post | 1280 | resting | .screenshots/phase-08-a-market/blog-post__1280__resting.png | b1130d1b275b4920b8463ecc276e6df2ff0cb2970951da97ac5fe25587bd40bc | - |
| blog-post | 390 | resting | .screenshots/phase-08-a-market/blog-post__390__resting.png | c4cf82fb305e93cb68d45634c1831557af46a4821b816979536de59e1eb11cae | - |
| cms-page | 1280 | resting | .screenshots/phase-08-a-market/cms-page__1280__resting.png | 12d805a02d38dd139e256ce5f4f5473217c8b433243d3ef38034e553dd2cd918 | - |
| cms-page | 390 | resting | .screenshots/phase-08-a-market/cms-page__390__resting.png | 3d6b2510cd82e1b8318b51fde49ccf73dcc857c1892a69338b0e9c1376c6bf34 | - |

## Label: `phase-08-b-market`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-b-market/home__1280__resting.png | e3c3a563ef15cb3b3aab69fc726b7527949c818a1e71bdfcec11c705d4f042f3 | - |
| home | 1280 | nav-open | .screenshots/phase-08-b-market/home__1280__nav-open.png | 9ff22ebb3117a0826f1e162e9481bde183d07a7e7a0ea43f5539c460a9e96604 | - |
| home | 390 | resting | .screenshots/phase-08-b-market/home__390__resting.png | eb7279b5b3a13974c2ac015a23cb4e50025342ada066330cfa0b90e1997f7497 | - |
| home | 390 | nav-open | .screenshots/phase-08-b-market/home__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| category | 1280 | resting | .screenshots/phase-08-b-market/category__1280__resting.png | be2fa97f96d8d87cb4e7306d7b3b7209db7d2a0897b4ff11eb533140656d8178 | - |
| category | 1280 | nav-open | .screenshots/phase-08-b-market/category__1280__nav-open.png | f41ca6f23a0c392814dc36db317aa24700d15185d5d55db404aaa9c701aacc46 | - |
| category | 390 | resting | .screenshots/phase-08-b-market/category__390__resting.png | d31e2a7e5fb32b2be28850ec1a439b15ebea01e65fe9155dfc8a9831814dd530 | - |
| category | 390 | nav-open | .screenshots/phase-08-b-market/category__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| product | 1280 | resting | .screenshots/phase-08-b-market/product__1280__resting.png | b04b7fbcaa96da1cf6f056d02d297615bdf747f09f0e2423fb2144dc2c16b5b1 | - |
| product | 1280 | nav-open | .screenshots/phase-08-b-market/product__1280__nav-open.png | ccc2c1f55dfb1888e46887351954b2053b91a28c635cade19a4e7965bbf23a24 | - |
| product | 390 | resting | .screenshots/phase-08-b-market/product__390__resting.png | ae817d377c49e0d181609148e90a08f918121149b01e709dfa3b5f0d7efc0ea9 | - |
| product | 390 | nav-open | .screenshots/phase-08-b-market/product__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-b-market/cart__1280__cart-open.png | 8eb90ea56e44340d32389c8d0a2aff5e85daeddcd97276e9b97cfaf33001f871 | - |
| cart | 390 | cart-open | .screenshots/phase-08-b-market/cart__390__cart-open.png | 8db8ef8815691bba465c940126da0ee24f7656a814cae32567bf9282b7607149 | - |
| checkout | 1280 | resting | .screenshots/phase-08-b-market/checkout__1280__resting.png | 15b673516ed16364734a227ecb153a181b8f160de3fadb1ea09ec88f4b2608e1 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-b-market/checkout__1280__nav-open.png | 36ebfd0f96c7100a54f3e0fde308da5650d6689cbfe3e91fb8aa4e9eabea61a8 | - |
| checkout | 390 | resting | .screenshots/phase-08-b-market/checkout__390__resting.png | a7f9e84278432ef817c716fc740164fd9564d964136903ddb24a609decb2e288 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-b-market/checkout__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| account | 1280 | resting | .screenshots/phase-08-b-market/account__1280__resting.png | e3f4fd6518bab08c7ec2936999497baaf88850bc04b994798b09cf3893fad7b9 | - |
| account | 1280 | nav-open | .screenshots/phase-08-b-market/account__1280__nav-open.png | 69788975f487b628a1a00f0ae654a8148dd507bc69efeb0a6f598e1d0e176862 | - |
| account | 390 | resting | .screenshots/phase-08-b-market/account__390__resting.png | 2098dda817638731005fadd92a00d769f4054e20e6e6e9523b487198c72938b9 | - |
| account | 390 | nav-open | .screenshots/phase-08-b-market/account__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-b-market/blog-index__1280__resting.png | 02b4f1ed5827aaa56df45bcf4dd6129a0e14b709331a56f8c642c00a9271d574 | - |
| blog-index | 390 | resting | .screenshots/phase-08-b-market/blog-index__390__resting.png | d1235f069e0eae9e79fc4cc9f6aa5d880810536794b863779ca4f19ddc090f4a | - |
| blog-post | 1280 | resting | .screenshots/phase-08-b-market/blog-post__1280__resting.png | b1130d1b275b4920b8463ecc276e6df2ff0cb2970951da97ac5fe25587bd40bc | - |
| blog-post | 390 | resting | .screenshots/phase-08-b-market/blog-post__390__resting.png | c4cf82fb305e93cb68d45634c1831557af46a4821b816979536de59e1eb11cae | - |
| cms-page | 1280 | resting | .screenshots/phase-08-b-market/cms-page__1280__resting.png | 12d805a02d38dd139e256ce5f4f5473217c8b433243d3ef38034e553dd2cd918 | - |
| cms-page | 390 | resting | .screenshots/phase-08-b-market/cms-page__390__resting.png | 3d6b2510cd82e1b8318b51fde49ccf73dcc857c1892a69338b0e9c1376c6bf34 | - |

## Label: `phase-08-c-market`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-08-c-market/home__1280__resting.png | 2f8373d8adaed6e7a289e9e5ac47f4fc3c1a6e47c2851d5ff1b4898c56e506f3 | - |
| home | 1280 | nav-open | .screenshots/phase-08-c-market/home__1280__nav-open.png | 033e6df3680b3f7a66869ba9f0f0335f7ec6ad61be93a3be46b8da0f417aa6d3 | - |
| home | 390 | resting | .screenshots/phase-08-c-market/home__390__resting.png | 3b0a8a19a5733c9ea4b1a59ec30f82abd334f9503b4a8ac43cf736f0fc65017d | - |
| home | 390 | nav-open | .screenshots/phase-08-c-market/home__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| category | 1280 | resting | .screenshots/phase-08-c-market/category__1280__resting.png | 5df749ffa63bfe19c384270fee57f907b1e7c188a9b8199b96eaa01d3821bced | - |
| category | 1280 | nav-open | .screenshots/phase-08-c-market/category__1280__nav-open.png | 4f8f0dfa96e23d2546dbedaf6092cd0d4d851ea8a6204c15448bc55d862e39fa | - |
| category | 390 | resting | .screenshots/phase-08-c-market/category__390__resting.png | e1fa05800bb19fb1ca230eaa66427ce480bf0310139d1855581c25954a338701 | - |
| category | 390 | nav-open | .screenshots/phase-08-c-market/category__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| product | 1280 | resting | .screenshots/phase-08-c-market/product__1280__resting.png | 8cc72f49a48c6bd8257baad37a61b3bc75e4d6cd8039d4a1f22beff7fa2c58b3 | - |
| product | 1280 | nav-open | .screenshots/phase-08-c-market/product__1280__nav-open.png | e67bffa7d6de057004ef1a99432bb0fd970e06190a3e6a1d19d25c122cdb38b2 | - |
| product | 390 | resting | .screenshots/phase-08-c-market/product__390__resting.png | 67eccc7553fd58a54c6bb3e039ea1a41e454490bffaa6d4a2426f3b831dcab70 | - |
| product | 390 | nav-open | .screenshots/phase-08-c-market/product__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| cart | 1280 | cart-open | .screenshots/phase-08-c-market/cart__1280__cart-open.png | e06bc43a5a1de7b489719423a147dee4ce85cb32a1a9bb13e580ef01a4c02313 | - |
| cart | 390 | cart-open | .screenshots/phase-08-c-market/cart__390__cart-open.png | 8db8ef8815691bba465c940126da0ee24f7656a814cae32567bf9282b7607149 | - |
| checkout | 1280 | resting | .screenshots/phase-08-c-market/checkout__1280__resting.png | 15b673516ed16364734a227ecb153a181b8f160de3fadb1ea09ec88f4b2608e1 | - |
| checkout | 1280 | nav-open | .screenshots/phase-08-c-market/checkout__1280__nav-open.png | 36ebfd0f96c7100a54f3e0fde308da5650d6689cbfe3e91fb8aa4e9eabea61a8 | - |
| checkout | 390 | resting | .screenshots/phase-08-c-market/checkout__390__resting.png | a7f9e84278432ef817c716fc740164fd9564d964136903ddb24a609decb2e288 | - |
| checkout | 390 | nav-open | .screenshots/phase-08-c-market/checkout__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| account | 1280 | resting | .screenshots/phase-08-c-market/account__1280__resting.png | e3f4fd6518bab08c7ec2936999497baaf88850bc04b994798b09cf3893fad7b9 | - |
| account | 1280 | nav-open | .screenshots/phase-08-c-market/account__1280__nav-open.png | 69788975f487b628a1a00f0ae654a8148dd507bc69efeb0a6f598e1d0e176862 | - |
| account | 390 | resting | .screenshots/phase-08-c-market/account__390__resting.png | 2098dda817638731005fadd92a00d769f4054e20e6e6e9523b487198c72938b9 | - |
| account | 390 | nav-open | .screenshots/phase-08-c-market/account__390__nav-open.png | 2a56399812984b981343a9d0cf3ca20e0c6bfb43e4950488c178a2720314c150 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| blog-index | 1280 | resting | .screenshots/phase-08-c-market/blog-index__1280__resting.png | 02b4f1ed5827aaa56df45bcf4dd6129a0e14b709331a56f8c642c00a9271d574 | - |
| blog-index | 390 | resting | .screenshots/phase-08-c-market/blog-index__390__resting.png | d1235f069e0eae9e79fc4cc9f6aa5d880810536794b863779ca4f19ddc090f4a | - |
| blog-post | 1280 | resting | .screenshots/phase-08-c-market/blog-post__1280__resting.png | b1130d1b275b4920b8463ecc276e6df2ff0cb2970951da97ac5fe25587bd40bc | - |
| blog-post | 390 | resting | .screenshots/phase-08-c-market/blog-post__390__resting.png | c4cf82fb305e93cb68d45634c1831557af46a4821b816979536de59e1eb11cae | - |
| cms-page | 1280 | resting | .screenshots/phase-08-c-market/cms-page__1280__resting.png | 12d805a02d38dd139e256ce5f4f5473217c8b433243d3ef38034e553dd2cd918 | - |
| cms-page | 390 | resting | .screenshots/phase-08-c-market/cms-page__390__resting.png | 3d6b2510cd82e1b8318b51fde49ccf73dcc857c1892a69338b0e9c1376c6bf34 | - |

## Capture session closed

Captured 2026-09-05, 16:01–16:26 UTC (~25 minutes wall-clock for all 21 runs, well under the
~45–85 minute estimate `08-RESEARCH.md` flagged — average ~70 seconds per run rather than the
2–4 minute per-run estimate).

**Measured results (not predicted):** 21 label subsections, 21 distinct labels, all seven presets
across all three combinations. Every run produced an identical grid of **32 cells attempted per
run** (26 base seven-route grid + 6 `--include-content` cells), **28 captured** and **4 MISSING**
(`order-status`, no seeded order in the local fixture) per run — **672 total rows, 588 captured,
84 MISSING** across the whole matrix. This reconciles with `08-RESEARCH.md`'s corrected
cell-count math (26 base + 6 content = 32) and its ~84-MISSING estimate for the whole matrix.

All four appearance keys were restored to their defaults (`volt-dark` / `grid-3` / `minimal` /
`left`), confirmed via a read-back of the `appearance` category and a fetch of the storefront
root's rendered `data-theme` attribute, and the restore was run twice to confirm it is idempotent
(both runs produced the identical stored state). The dev server was then stopped and port 3000
was confirmed free.

Phase 5's screenshot manifest (`05-SCREENSHOTS.md`) was never touched — every one of the 21
invocations passed `--manifest` explicitly, pointed at this file.

No findings table is written here — plan 08-04 inspects the captured evidence against the six
per-cell pass criteria in `08-UI-SPEC.md` and records judgements there.

## Judgement Design

Stated here before any cell is judged, per D-04's own instruction: a findings row with no design
behind it is worse than an absent one.

**Criterion 1** (renders without error) is judged mechanically across every captured cell in all 21
runs, independent of preset or combination: a captured cell passes when its file exists on disk
with non-zero size and the manifest carries no error annotation; a `MISSING` cell is exempt from
this criterion and is judged only against its own recorded reason string. This is a whole-matrix
count, not a sample — see finding F1.

**Criteria 2 and 6** (overflow/clipping, and layout matching its variant's anatomy) vary with the
*layout combination*, not the preset. `CategoryGrid3`/`CategoryGrid2`/`CategoryList`,
`HomeHeroMinimal`/`HomeHeroSplit`/`HomeHeroFullBleed`, and `ProductGalleryLeft`/`ProductGalleryTop`
are rendered by the same component regardless of which of the seven presets supplies the theme's
colour tokens — none of the eight variant components reads a theme token to decide its own
geometry, and no preset file contains any markup or layout rule. So Task 1 inspects these two
criteria across all three packed combinations (A, B, C) at one preset only (`volt-dark`, the
reference preset `06-UI-SPEC.md` already specifies in full) — thirteen specific cells (see
findings F2-F14), not all 21 runs, because a second, third, ... seventh preset would be re-judging
the identical DOM/CSS-class output a second time, not observing a new fact.

**Criteria 3, 4 and 5** (legibility, scrim darkness, display face) vary with the *preset*, not the
combination — no layout-variant component reads a different token set depending on which of the
three combinations is active. So Task 2 inspects these three criteria across all seven presets at
one combination only (A, the defaults), plus a targeted cross-check where the two axes genuinely
interact: `HomeHeroFullBleed`'s literal `bg-black/50` scrim (a fenced exception, not a token) sits
directly over each light preset's own light surface only under combination C (the one combination
that selects `full-bleed`) — that specific interaction is checked separately for the four light
presets, at combination C, in Task 2.

This factorisation — combination-axis criteria checked once across combinations at a fixed preset,
preset-axis criteria checked once across presets at a fixed combination, plus one named cross-term
— is a **planner assumption** about how the six criteria decompose, not a proven property of the
codebase. A reader who disagrees with it should read every row below as answering "why was this
cell chosen, and not some other one", not as a claim that every one of the 672 rows in the matrix
was independently inspected. Every layout-variant component read this session takes preset-derived
values only through CSS custom properties it never branches on, and every theme file changes only
token values, never markup or component logic — nothing contradicted the assumption — but that
reading was not an exhaustive trace of every rendering path in the tree.

A **screen-reader pass over the rendered cells themselves** — an accessibility-tree check, not a
visual legibility-by-inspection check — is explicitly **not** attempted in this phase.
`08-UI-SPEC.md`'s six criteria all name visual properties (contrast, overflow, presence of a font,
anatomy match); none of them is "reachable and correctly labelled by assistive technology". Phase 6
and Phase 6.1 both flagged the identical gap in their own `## UI Considerations` tables and
deferred it (⚠ unresolved, per `08-UI-SPEC.md`'s own carry-forward); this phase inherits the same
open question rather than closing it either way, and rather than silently skipping past it as
though it were already closed.

## Visual QA Summary

Seven presets by three packed layout combinations. This is the grid a reader scans — the findings
table below it is the full evidence every mark here points back to.

| Preset | A (`grid-3`/`minimal`/`left`) | B (`grid-2`/`split`/`top`) | C (`list`/`full-bleed`/`left`) |
|---|---|---|---|
| `volt-dark` | ✓ Pass — F2, F15-F18 | ✓ Pass — F6-F9 | ✓ Pass — F10-F14 |
| `luxe` | ✓ Pass — F19-F22 | ✓ Pass (by design — combination-axis criteria are checked once, at `volt-dark`; see Judgement Design) | ✓ Pass — F43 (scrim cross-check); anatomy by design |
| `midnight` | ✓ Pass — F23-F26 | ✓ Pass (by design) | ✓ Pass (by design) |
| `clinical` | ✓ Pass — F27-F30 | ✓ Pass (by design) | ✓ Pass — F44 (scrim cross-check); anatomy by design |
| `retro` | ✓ Pass — F31-F34 | ✓ Pass (by design) | ✓ Pass (by design) |
| `atelier` | ✓ Pass — F35-F38 | ✓ Pass (by design) | ✓ Pass — F45 (scrim cross-check); anatomy by design |
| `market` | ✓ Pass — F39-F42 | ✓ Pass (by design) | ✓ Pass — F46 (scrim cross-check); anatomy by design |

"By design" cells are not independently inspected — they rest on the Judgement Design's stated
factorisation (layout-anatomy criteria don't vary by preset; legibility/scrim/display-face criteria
don't vary by combination), which is itself flagged as a planner assumption, not a proven property.
Every other mark cites the specific findings row(s) it rests on. Zero defects were found across all
46 findings; nothing required a fix.

## Findings

Column set reused verbatim from `06.1-SCREENSHOTS.md`; judgement values are exactly **"Leave it"**
and **"Fixed"** (optionally suffixed), per `08-UI-SPEC.md`'s Copywriting Contract. A row that reads
"Leave it" after inspection is as much a finding as a row that reads "Fixed" — this table is not
change-only.

| # | Site | File:line | Class in play | What it looks like under the preset | Judgement | Reason |
|---|---|---|---|---|---|---|
| F1 | Criterion 1 (renders without error) — mechanical pass, all 21 runs, 672 rows | n/a | n/a | 588/588 non-`MISSING` rows have a captured PNG on disk with non-zero size (`test -s` over every unique path in the manifest, one command, whole file); 84/672 rows are `MISSING`, each carrying the harness's own reason string (`order-status`, no seeded order in the local fixture); zero rows anywhere in the manifest carry an error annotation — the only two matches for the word "error" in this file are in the Carried-forward-gaps prose ("review-form error state"), never a row note | Leave it | Mechanical count, not a judgement call — matches `08-03-SUMMARY.md`'s own measured 588-captured/84-`MISSING` totals exactly; no cell needs re-inspection for this criterion |
| F2 | Combination A (`grid-3`/`minimal`/`left`), `volt-dark` — home, 1280 | `components/layout/home/HomeHeroMinimal.tsx:27` | `max-w-6xl mx-auto text-center mb-16 sm:mb-20` | Centered hero, no image slot; heading, subhead and CTA all sit inside the max-width container, nothing touches the viewport edge (`phase-08-a-volt-dark/home__1280__resting.png`) | Leave it | Matches `07-UI-SPEC.md`'s `HomeHeroMinimal` anatomy verbatim; no overflow at 1280 |
| F3 | Combination A, `volt-dark` — category, 1280 | `components/layout/category/CategoryGrid3.tsx:23` | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10` | Grid container renders correctly; the local fixture's single product means the 3-column breakpoint can't be visually distinguished from fewer columns in this capture, but the container class and card markup are unchanged from the verbatim Phase-5-extraction baseline (`phase-08-a-volt-dark/category__1280__resting.png`) | Leave it | Container class matches `07-UI-SPEC.md`'s `CategoryGrid3` row exactly; single-product fixture is a pre-existing limitation (05-SCREENSHOTS.md), not a new gap this plan introduces |
| F4 | Combination A, `volt-dark` — product, 1280 | `components/layout/product/ProductGalleryLeft.tsx:40-41` | `data-product-gallery="left"`; `relative aspect-3/4 w-full overflow-hidden rounded bg-surface-elevated` inside the left column of the two-column grid | Main image left, thumbnail strip below it still in the left column, info column (title/rating/tabs/price/CTA) right — matches `ProductGalleryLeft`'s anatomy exactly (`phase-08-a-volt-dark/product__1280__resting.png`) | Leave it | Matches `07-UI-SPEC.md`'s default gallery anatomy; no overflow at 1280 |
| F5 | Combination A, `volt-dark` — category, 390 (narrow) | `components/layout/category/CategoryGrid3.tsx:23` | same container class, collapsed to its `grid-cols-1` breakpoint | Single-column card, no horizontal scrollbar, card contents (image/name/price/availability/CTA) fully contained (`phase-08-a-volt-dark/category__390__resting.png`) | Leave it | Responsive collapse matches the container's own breakpoint classes; no overflow observed |
| F6 | Combination B (`grid-2`/`split`/`top`), `volt-dark` — home, 1280 | `components/layout/home/HomeHeroSplit.tsx:44-45` | `data-home-hero="split"`; `max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center` | Text column first (`text-left`, headline/subhead/CTA), image column second (broken-image icon — the fixture's product has no working image URL, a pre-existing fixture limitation, not a layout defect); at 1280 both columns sit side by side with no overflow (`phase-08-b-volt-dark/home__1280__resting.png`) | Leave it | Matches `07-UI-SPEC.md`'s `HomeHeroSplit` anatomy exactly (text left / image right at `lg`); broken image is `resolveProductImageSrc`'s fixture-data gap, unrelated to the split layout itself |
| F7 | Combination B, `volt-dark` — category, 1280 | `components/layout/category/CategoryGrid2.tsx:20` | `grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10 lg:gap-12` | Container capped at 2 columns per its own class (never a 3rd, even past `lg`); single-product fixture can't show the 2nd column, but the container class is correctly `grid-2`, distinct from combination A's `grid-3` container (`phase-08-b-volt-dark/category__1280__resting.png`) | Leave it | Confirms the `categoryLayout` setting actually swaps the rendered component (not just a label) — different container class present between F3 and F7 for the identical fixture data |
| F8 | Combination B, `volt-dark` — product, 1280 | `components/layout/product/ProductGalleryTop.tsx:39-40` | `data-product-gallery="top"`; `relative w-full aspect-video overflow-hidden rounded bg-surface-elevated` spanning the full content width, thumbnail strip directly below, info block `mt-8 lg:mt-10 max-w-2xl` beneath that | Main image spans the full width above a horizontal thumbnail strip, info column stacked below and capped at `max-w-2xl` rather than stretched full-bleed — matches `ProductGalleryTop`'s anatomy exactly, distinct from F4's left/right split for the same product (`phase-08-b-volt-dark/product__1280__resting.png`) | Leave it | Matches `07-UI-SPEC.md`'s `ProductGalleryTop` row; no overflow at 1280 |
| F9 | Combination B, `volt-dark` — category, 390 (narrow) | `components/layout/category/CategoryGrid2.tsx:20` | same container, collapsed to `grid-cols-1` | Single-column card, no overflow, same collapse behavior as F5 (`phase-08-b-volt-dark/category__390__resting.png`) | Leave it | Consistent with F5; `grid-2`'s narrow-viewport behavior is identical to `grid-3`'s, as expected since both share the same `grid-cols-1` mobile base class |
| F10 | Combination C (`list`/`full-bleed`/`left`), `volt-dark` — home, 1280 | `components/layout/home/HomeHeroFullBleed.tsx:55-56,69` | `data-home-hero="full-bleed"`; `relative w-full h-64 sm:h-80 lg:h-96 -mx-4 sm:-mx-6 lg:-mx-12 overflow-hidden`; scrim `absolute inset-0 bg-black/50` | Full-bleed band escapes the page's horizontal padding as designed; the featured-product image itself renders as a broken-image icon (same fixture-data gap as F6 — `resolveProductImageSrc` has no working URL for this product, not the category-hero image RESEARCH Pitfall 4 names, but the identical class of "no photo in this fixture" limitation applied to a different image slot); the dark scrim panel is visible as a distinct darker rectangle behind the heading/subhead/CTA even composited over the placeholder grey, and the white heading/CTA text stays legible on it (`phase-08-c-volt-dark/home__1280__resting.png`) | Leave it | Anatomy matches `07-UI-SPEC.md`'s `HomeHeroFullBleed` row; per RESEARCH Pitfall 4's own guidance, this row states the fixture limitation rather than judging photo-behind-text legibility as though a real photo were present — the scrim's own presence and the text's own legibility over it are still real, judgeable facts independent of the missing photo |
| F11 | Combination C, `volt-dark` — category, 1280 | `components/layout/category/CategoryList.tsx:27,76` | `flex flex-col gap-4 sm:gap-6`; row `flex flex-col sm:flex-row gap-4 sm:gap-6 rounded-lg bg-surface-elevated p-4 sm:p-6` | Image left, name/description/rating top of info column, price/availability/CTA row at the bottom, all inside one rounded row card — matches `CategoryList`'s anatomy exactly (`phase-08-c-volt-dark/category__1280__resting.png`) | Leave it | Matches `07-UI-SPEC.md`'s `CategoryList` row; no overflow at 1280 |
| F12 | Combination C, `volt-dark` — product, 1280 | `components/layout/product/ProductGalleryLeft.tsx:40-41` | identical class to F4 (`productGallery` is `left` for both combination A and combination C) | Renders identically to F4's left/right split anatomy — confirms the gallery variant is driven purely by the `productGallery` setting, independent of which category/hero combination is active (`phase-08-c-volt-dark/product__1280__resting.png`) | Leave it | Cross-check: combination A and combination C intentionally share the same gallery variant per the combination table; identical rendered anatomy confirms no cross-talk between the three layout keys |
| F13 | Combination C, `volt-dark` — category, 390 (narrow) | `components/layout/category/CategoryList.tsx:27,39,109` | `flex-col sm:flex-row` row collapses to stacked (image top, info below) below the `sm` breakpoint; price/availability/CTA row is `flex flex-wrap items-center justify-between gap-2` | Image-top/info-below stacked row, no horizontal scrollbar; price ("$79.99"), "In Stock" and "Learn more →" all remain on one line at 390 for this fixture's short product name (`phase-08-c-volt-dark/category__390__resting.png`) | Leave it (lower-confidence evidence) | This is `07-UI-SPEC.md`'s own flagged 🧪 backstop row (a genuinely long product name could still squeeze the price/CTA row off-edge); the local fixture's one product ("Vivid Mission Pack") is too short to exercise that risk, so this row confirms no regression for the data present, not that the flagged risk is resolved — same inherited, untested edge every prior phase left open |
| F14 | Combination C, `volt-dark` — home, 390 (narrow) | `components/layout/home/HomeHeroFullBleed.tsx:55-56,69` | same classes as F10, collapsed to the `h-64` narrow-viewport band height | Band, scrim and overlaid heading/subhead/CTA all stay contained within the narrower band height at 390, no horizontal overflow; same broken-image fixture limitation as F10 | Leave it | Matches `07-UI-SPEC.md`'s anatomy at the narrow viewport; no overflow |
| F15 | `volt-dark` — legibility, home heading/subhead | `themes/volt-dark.css:42` (`--store-font-display` = `--font-geist-sans`, same as body by design) | body/heading text on `bg-surface` | White/near-white heading and grey subhead against the near-black page background — high contrast, clearly legible; the outlined "Shop Featured Gear" CTA's orange border/text reads clearly against black (`phase-08-a-volt-dark/home__1280__resting.png`) | Leave it | Matches `06-UI-SPEC.md`'s already-computed contrast for this token pair; no re-derivation needed |
| F16 | `volt-dark` — legibility, product page + thumbnail selection ring | `components/layout/product/ProductGalleryLeft.tsx` (selected border), `app/product/[slug]/ProductDisplay.tsx:233` (`border border-border` details/reviews card) | `border-primary` (selected thumbnail); `border border-border bg-surface-elevated` | Selected thumbnail's orange ring is clearly visible against the dark gallery background; the Details/Reviews tab card's hairline border is visible against `bg-surface-elevated`; "Add to Cart" orange button legible with black text (`phase-08-a-volt-dark/product__1280__resting.png`) | Leave it | Both named ring/border checks in the D-04 criterion (thumbnail selection, card hairline) are visibly present, not invisible-by-omission |
| F17 | `volt-dark` — scrim, cart drawer open | `components/ui/sheet.tsx:136` (`bg-black/50` overlay, literal, sentinel-wrapped) | `bg-black/50` | Backdrop over the already-dark page reads visibly darker/dimmed compared to the resting state; the drawer's own inverse-surface panel renders light/cream (`bg-surface-inverse`, correct polarity flip for a dark preset per the frozen 5-token inverse set) with dark, legible "Your Cart" text (`phase-08-a-volt-dark/cart__1280__cart-open.png`) | Leave it | Confirms Phase 6's own scrim-polarity fix holds for `volt-dark`; the overlay and the inverse-surface panel are two different mechanisms and both read correctly |
| F18 | `volt-dark` — display face, headings | `themes/volt-dark.css:42` | `--store-font-display` = `--font-geist-sans` | Heading renders in the same sans face as the body copy — no face change, matching the token's own declared value (Geist reused, not a distinct display font) | Leave it | Intentional same-face-as-body per `06-UI-SPEC.md`; there is no face-survives-its-own-palette question to judge since there is no face change |
| F19 | `luxe` — legibility, home heading/subhead | `themes/luxe.css:59` | body/heading text on the cream `bg-surface` | Dark charcoal heading and muted grey subhead read clearly against the cream page; the outlined "Shop Featured Gear" CTA's gold border/text is clearly visible on cream (`phase-08-a-luxe/home__1280__resting.png`) | Leave it | Matches `06-UI-SPEC.md`'s computed contrast for luxe's token pair |
| F20 | `luxe` — legibility, product page + thumbnail selection ring | `app/product/[slug]/ProductDisplay.tsx:233`; `ProductGalleryLeft.tsx` (`border-primary`) | `border border-border`; `border-primary` | Selected thumbnail's gold ring is clearly visible against the cream gallery background; hairline card border visible against `bg-surface-elevated`; "Add to Cart" gold button with dark text legible (`phase-08-a-luxe/product__1280__resting.png`) | Leave it | Both ring/border checks hold; matches the "hairline border on white/cream" concern `06.1-SCREENSHOTS.md` F3 already verified for a different light preset, re-confirmed here for luxe |
| F21 | `luxe` — scrim, cart drawer open | `components/ui/sheet.tsx:136` | `bg-black/50` | Backdrop over the cream page reads as a visible mid-grey wash, clearly darker than the resting cream page and clearly separating the page from the drawer; drawer panel itself renders dark/near-black (correct inverse-polarity flip for a light preset) with white "Your Cart" text (`phase-08-a-luxe/cart__1280__cart-open.png`) | Leave it | This is Phase 6's own named finding, re-verified: a light preset's scrim must not read as a pale wash that fails to separate the backdrop — it does not, here |
| F22 | `luxe` — display face, headings | `themes/luxe.css:59` (`--store-font-display` = `--font-cormorant-garamond`) | `font-display` | Heading renders as an unmistakably serif face (Cormorant Garamond), visibly distinct from the sans body copy at both the home and product headings | Leave it | Confirms the loaded webfont renders (not the Georgia fallback stack) — genuinely different face from body, as luxe's direction intends |
| F23 | `midnight` — legibility, home heading/subhead | `themes/midnight.css:53` (`--store-font-display` = `--font-geist-sans`, same as body by design) | body/heading text on `bg-surface` | White heading and light-grey subhead read clearly against the deep navy-black page; the purple-outlined CTA is clearly visible (`phase-08-a-midnight/home__1280__resting.png`) | Leave it | Matches `06-UI-SPEC.md`'s computed contrast |
| F24 | `midnight` — legibility, product page + thumbnail selection ring | `app/product/[slug]/ProductDisplay.tsx:233`; `ProductGalleryLeft.tsx` | `border border-border`; `border-primary` | Selected thumbnail's purple ring clearly visible against the dark gallery panel; hairline card border visible; "Add to Cart" purple button with dark text legible (`phase-08-a-midnight/product__1280__resting.png`) | Leave it | Both ring/border checks hold |
| F25 | `midnight` — scrim, cart drawer open | `components/ui/sheet.tsx:136` | `bg-black/50` | Backdrop dims the already-dark page visibly; drawer panel renders light/cream (correct inverse-polarity flip for a dark preset) with dark, legible "Your Cart" text (`phase-08-a-midnight/cart__1280__cart-open.png`) | Leave it | Same mechanism and same correct outcome as F17 (`volt-dark`), independently re-confirmed under midnight's own palette |
| F26 | `midnight` — display face, headings | `themes/midnight.css:53` | `--store-font-display` = `--font-geist-sans` | Heading renders in the same sans face as body copy, no face change | Leave it | Intentional same-face-as-body per `06-UI-SPEC.md`; no face-survives-palette question applies |
| F27 | `clinical` — legibility, home heading/subhead | `themes/clinical.css:64` (`--store-font-display` = `--font-geist-sans`, same as body by design) | body/heading text on the near-white `bg-surface` | Dark navy heading and muted grey subhead read clearly against the very light sea-foam/white page; the teal-outlined CTA is clearly visible (`phase-08-a-clinical/home__1280__resting.png`) | Leave it | Matches `06.1-UI-SPEC.md`'s computed contrast for clinical (the tightest surface/surface-elevated gap of any shipped theme, per 06.1's F1, but body/heading contrast itself is unaffected) |
| F28 | `clinical` — legibility, product page + thumbnail selection ring | `app/product/[slug]/ProductDisplay.tsx:233`; `ProductGalleryLeft.tsx` | `border border-border`; `border-primary` | Selected thumbnail's teal ring clearly visible; hairline card border visible against the near-white surface; "Add to Cart" teal button with white text legible (`phase-08-a-clinical/product__1280__resting.png`) | Leave it | Both ring/border checks hold; consistent with `06.1-SCREENSHOTS.md` F3's own checkout-input finding for the same preset |
| F29 | `clinical` — scrim, cart drawer open | `components/ui/sheet.tsx:136` | `bg-black/50` | Backdrop over the near-white page reads as a clear mid-grey dimming wash; drawer panel renders dark/near-black (correct inverse-polarity flip for a light preset) with white "Your Cart" text (`phase-08-a-clinical/cart__1280__cart-open.png`) | Leave it | Matches `06.1-SCREENSHOTS.md` F6's own conclusion for clinical's scrim sites, re-confirmed here for the cart drawer specifically |
| F30 | `clinical` — display face, headings | `themes/clinical.css:64` | `--store-font-display` = `--font-geist-sans` | Heading renders in the same sans face as body copy, no face change | Leave it | Intentional same-face-as-body per `06.1-UI-SPEC.md`; matches `06.1-SCREENSHOTS.md` F8's own conclusion |
| F31 | `retro` — legibility, home heading/subhead | `themes/retro.css:78` | body/heading text on the deep-purple `bg-surface` | Cream/off-white heading and muted lavender-grey subhead read clearly against the dark purple page; the magenta-outlined CTA is clearly visible (`phase-08-a-retro/home__1280__resting.png`) | Leave it | Matches `06.1-UI-SPEC.md`'s computed contrast |
| F32 | `retro` — legibility, product page + thumbnail selection ring | `app/product/[slug]/ProductDisplay.tsx:233`; `ProductGalleryLeft.tsx` | `border border-border`; `border-primary` | Selected thumbnail's magenta ring clearly visible against the dark purple gallery panel; hairline card border visible; "Add to Cart" pink/magenta button with dark text legible (`phase-08-a-retro/product__1280__resting.png`) | Leave it | Both ring/border checks hold |
| F33 | `retro` — scrim, cart drawer open | `components/ui/sheet.tsx:136` | `bg-black/50` | Backdrop dims the dark-purple page visibly; drawer panel renders light/cream (correct inverse-polarity flip for a dark preset) with dark "Your Cart" text (`phase-08-a-retro/cart__1280__cart-open.png`) | Leave it | Same mechanism, same correct outcome as F17/F25 |
| F34 | `retro` — display face, headings | `themes/retro.css:78` (`--store-font-display` = `--font-orbitron`) | `font-display` | Heading renders as an unmistakably wide, geometric display face (Orbitron), clearly distinct from the sans body copy, at font-weight 800 — no hollow-at-weight rendering observed | Leave it | Matches `06.1-SCREENSHOTS.md` F22's own prior human-check finding for retro at this exact weight; re-confirmed against this plan's own capture |
| F35 | `atelier` — legibility, home heading/subhead | `themes/atelier.css:73` | body/heading text on the warm-linen `bg-surface` | Dark brown/near-black heading and muted grey subhead read clearly against the warm cream/linen page; the terracotta-outlined CTA is clearly visible (`phase-08-a-atelier/home__1280__resting.png`) | Leave it | Matches `06.1-UI-SPEC.md`'s computed contrast |
| F36 | `atelier` — legibility, product page + thumbnail selection ring | `app/product/[slug]/ProductDisplay.tsx:233`; `ProductGalleryLeft.tsx` | `border border-border`; `border-primary` | Selected thumbnail's terracotta ring clearly visible against the linen gallery panel; hairline card border visible (per 06.1-SCREENSHOTS.md F11, a quiet hairline, not a heavy outline); "Add to Cart" clay/terracotta button with white text legible (`phase-08-a-atelier/product__1280__resting.png`) | Leave it | Both ring/border checks hold, consistent with 06.1's own F11 conclusion for this preset |
| F37 | `atelier` — scrim, cart drawer open | `components/ui/sheet.tsx:136` | `bg-black/50` | Backdrop dims the linen page visibly; drawer panel renders dark/near-black (correct inverse-polarity flip for a light preset) with white "Your Cart" text (`phase-08-a-atelier/cart__1280__cart-open.png`) | Leave it | Matches `06.1-SCREENSHOTS.md` F14's own conclusion for atelier's scrim sites |
| F38 | `atelier` — display face, headings | `themes/atelier.css:73` (`--store-font-display` = `--font-fraunces`) | `font-display` | Heading renders as an obviously serif, higher-contrast face (Fraunces), clearly distinct from the sans body copy; reads well against the warm-linen surface | Leave it | Matches `06.1-SCREENSHOTS.md` F13's own conclusion for atelier |
| F39 | `market` — legibility, home heading/subhead | `themes/market.css:94` | body/heading text on the pale-cream `bg-surface` | Dark forest-green/near-black heading and muted grey subhead read clearly against the pale cream page; the green-outlined CTA is clearly visible (`phase-08-a-market/home__1280__resting.png`) | Leave it | Matches `06.1-UI-SPEC.md`'s computed contrast |
| F40 | `market` — legibility, product page + thumbnail selection ring | `app/product/[slug]/ProductDisplay.tsx:233`; `ProductGalleryLeft.tsx` | `border border-border`; `border-primary` | Selected thumbnail's green ring clearly visible against the cream gallery panel; hairline card border visible; solid green "Add to Cart" button with white text legible; visibly rounder corners on the tab card/button than clinical or atelier at the same breakpoint, consistent with market's larger radius token (`phase-08-a-market/product__1280__resting.png`) | Leave it | Both ring/border checks hold; the radius observation matches `06.1-SCREENSHOTS.md` F16's own finding, re-confirmed here on a different element |
| F41 | `market` — scrim, cart drawer open | `components/ui/sheet.tsx:136` | `bg-black/50` | Backdrop dims the cream page visibly; drawer panel renders dark forest-green/near-black (correct inverse-polarity flip for a light preset) with white "Your Cart" text (`phase-08-a-market/cart__1280__cart-open.png`) | Leave it | Matches `06.1-SCREENSHOTS.md` F20's own conclusion for market's scrim sites |
| F42 | `market` — display face, headings | `themes/market.css:94` (`--store-font-display` = `--font-nunito`) | `font-display` | Heading renders as a rounded, friendly sans clearly distinct from the (Geist) body copy — the letterforms are visibly rounder/softer than the sans body text at the same weight | Leave it | Matches `06.1-SCREENSHOTS.md` F19's own conclusion for market |
| F43 | Cross-check — `luxe` under combination C's full-bleed hero | `components/layout/home/HomeHeroFullBleed.tsx:69` (`bg-black/50`, literal) | scrim over `luxe`'s own light surface | The dark scrim panel is visible as a distinct grey-brown band behind the heading/CTA even composited over the fixture's broken-image placeholder; the white heading text and gold CTA stay legible on it, exactly as under the dark presets (`phase-08-c-luxe/home__1280__resting.png`) | Leave it | Direct descendant of Phase 6's scrim-polarity finding: a literal, non-token scrim must read dark regardless of preset polarity — it does, here, for the one light preset already carrying Phase 6's own fix |
| F44 | Cross-check — `clinical` under combination C's full-bleed hero | `components/layout/home/HomeHeroFullBleed.tsx:69` | scrim over `clinical`'s own light surface | Same dark scrim band visible over the placeholder, white heading text legible (`phase-08-c-clinical/home__1280__resting.png`) | Leave it | Same conclusion as F43, independently re-confirmed under clinical's own palette |
| F45 | Cross-check — `atelier` under combination C's full-bleed hero | `components/layout/home/HomeHeroFullBleed.tsx:69` | scrim over `atelier`'s own light surface | Same dark scrim band visible over the placeholder, white heading text legible (`phase-08-c-atelier/home__1280__resting.png`) | Leave it | Same conclusion as F43/F44, independently re-confirmed under atelier's own palette |
| F46 | Cross-check — `market` under combination C's full-bleed hero | `components/layout/home/HomeHeroFullBleed.tsx:69` | scrim over `market`'s own light surface | Same dark scrim band visible over the placeholder, white heading text legible (`phase-08-c-market/home__1280__resting.png`) | Leave it | Same conclusion as F43-F45, independently re-confirmed under market's own palette; all four light presets now confirmed under the one genuine cross-term this design names |

**Task 1 total:** 14 rows recorded (1 mechanical criterion-1 pass + 13 combination-axis
inspections across all three packed combinations at `volt-dark`). Zero defects found; nothing
fixed. `scan:tokens`, lint, and typecheck all re-run clean after this task (no file besides this
record was touched).

**Task 2 total:** 32 rows recorded (28 preset-axis inspections — legibility, scrim, and display face
for all seven presets at combination A — plus 4 light-preset cross-checks at combination C). Zero
defects found; nothing fixed. Cumulative findings after tasks 1 and 2: 46.

## Close-out rollup

Items this phase either closed or is handing onward, each with why it is still open and where to
pick it up next. Ledger shape reused from `06.1-SCREENSHOTS.md`'s own "Carried forward" table.

| Item | Status | Where to pick up |
|---|---|---|
| `GET /api/admin/settings?category=X` inserted the full `defaultSettings` array when the filtered result was empty, not scoped to `X` (Phase 6, WINDOWS #3) | **Closed this phase**, at plan 08-01: a category-scoped seed guard now computes the requested category's own default set and only inserts when it is non-empty, with the post-seed re-select scoped identically; pinned by `tests/unit/app/api/admin-settings-empty-category.test.ts` (6 cases). Marked fixed in `.planning/WINDOWS.md` via `gsd-tools windows fixed 3` | Closed at 08-01; no further action |
| Admin Appearance page human-observable walkthrough never run — no Clerk session in this environment (Phase 6, WINDOWS #2) | Still open, unchanged this phase | Whoever next has a real Clerk-authenticated browser session against this environment |
| Defaults-parity screenshot diff: `product\|390\|resting` differs from baseline by 2 pixels at ±1/255 intensity, attributed to headless-Chromium rendering variance and registered as snap S-07-01 (Phase 7, WINDOWS #4) | Still open, unchanged this phase | Not blocking; re-evaluate only if a future capture shows the same cell drifting further |
| Phase 5 screenshot coverage gaps: `order-status` (no seeded order), Stripe payment step (payment-intent 400 locally), authenticated account dashboard (no Clerk session), review-form error state | Still open — every one of this phase's 21 capture runs hit the same four missing cells for the same environmental reasons, recorded in the Coverage grid and every label subsection | Whoever next seeds an order and establishes a Clerk session in whatever environment runs the QA matrix |
| Screen-reader / accessibility-tree pass over the rendered storefront cells | Still open — flagged as an inherited, explicitly unresolved question in this plan's own Judgement Design, matching the identical gap Phase 6 and Phase 6.1 both flagged and deferred | Whoever next scopes an accessibility-focused QA pass; not closed silently either way by this phase |
| `07-UI-SPEC.md`'s flagged narrow-viewport overflow risk for `CategoryList`/`CategoryGrid` (a genuinely long product name squeezing the price/CTA row off-edge) | Still open, lower-confidence evidence (F13) — the local fixture's one product name is too short to exercise it | Worth a real check once a product with a long name exists in whatever environment tests it |
| Category hero / featured-product image renders as a broken-image icon across every preset and combination (RESEARCH Pitfall 4 and its broader instance noted at F10) | Still open, unchanged since Phase 5/6 — the local D1 fixture has no working image URL for its one product | Worth a real look once the fixture (or a future environment) has a working image URL |
| Dropped direction-doc properties for all seven presets (`shadow`, `border-width`, `image-aspect`, `accent-2` where not folded, `font-mono`, `letter-spacing`, per-theme layout behaviours) | Backlog, not blocking | `.planning/todos/pending/theme-contract-dropped-properties.md` (luxe/midnight), `.planning/todos/pending/theme-direction-doc-backlog-06.1.md` (clinical/retro/atelier/market) |
| Two image-URL resolvers coexist (`components/layout/product/gallery-media-url.ts`, `lib/utils/product-image.ts`) | Still open, carried from Phase 7 | Consolidate the next time the product display is touched |
| Pre-extraction parity tests self-write a missing baseline snapshot instead of failing | Still open, carried from Phase 7 | Worth a hard failure instead, next time the parity-test harness is touched |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_THEME_DEFAULT` Workers Build variables | Still outstanding, carried from v1/Phase 6 | Cloudflare Dashboard → Workers & Pages → the Voltique Worker → Settings → Build → Variables and Secrets |

No cell in this record is marked covered without either a captured hash or an explicitly named
substitute-evidence trail, matching the convention `05-SCREENSHOTS.md`, `06-SCREENSHOTS.md`, and
`06.1-SCREENSHOTS.md` all established. Zero findings from tasks 1 or 2 required flagging as an
unresolved-for-a-future-milestone contract change — every inspected cell was a clean "Leave it";
nothing in this phase's own QA pass needed a fix that a token, theme-file, or variant-enum change
would have been required for.
