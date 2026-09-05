# Phase 8 Visual QA Matrix

**Status:** in-progress
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
| 13 | `phase-08-a-retro` | `retro` | `grid-3` | `minimal` | `left` | | | |
| 14 | `phase-08-b-retro` | `retro` | `grid-2` | `split` | `top` | | | |
| 15 | `phase-08-c-retro` | `retro` | `list` | `full-bleed` | `left` | | | |
| 16 | `phase-08-a-atelier` | `atelier` | `grid-3` | `minimal` | `left` | | | |
| 17 | `phase-08-b-atelier` | `atelier` | `grid-2` | `split` | `top` | | | |
| 18 | `phase-08-c-atelier` | `atelier` | `list` | `full-bleed` | `left` | | | |
| 19 | `phase-08-a-market` | `market` | `grid-3` | `minimal` | `left` | | | |
| 20 | `phase-08-b-market` | `market` | `grid-2` | `split` | `top` | | | |
| 21 | `phase-08-c-market` | `market` | `list` | `full-bleed` | `left` | | | |

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
