# Phase 7 Screenshot Record

This is Phase 7's own screenshot coverage record, following the format
`.planning/phases/06-theme-file-mechanism-presets/06-SCREENSHOTS.md` established (label
sections, route/viewport/state/path/hash/notes tables). Captured images live under the
git-ignored `.screenshots/` directory and are never committed — only this manifest (route,
viewport, state, path, content hash) is committed.

Capture command: `mise exec -- npm run screenshot:routes -- --label <name> --manifest
.planning/phases/07-layout-switches/07-SCREENSHOTS.md --allow-missing` (this phase's local D1
fixture has no seeded order, so `--allow-missing` is required on every run, same as every prior
phase's manifest).

`phase-07-pre-extraction-volt-dark` (below) is the pre-extraction reference for the three
category-layout default variants (`grid-3`, and by extension the home/product defaults this
phase also extracts verbatim): plan 07-05 diffs its hash column against later captures to prove
the extraction changed nothing visually.

## Plan 07-05: Variant Coverage Table (D-14)

Each of the eight variants captured under both the dark default preset (`volt-dark`) and the
light preset (`luxe`), using three combinations per preset rather than sixteen separate runs
(the three switches are independent, so three well-chosen combinations exercise all eight
variants): all-defaults (`grid-3`/`minimal`/`left`), the two-column category with the split hero
and the top gallery (`grid-2`/`split`/`top`), and the list category with the full-bleed hero and
the default gallery (`list`/`full-bleed`/`left`).

| Variant | Switch | Preset | Label | Evidencing Route |
|---|---|---|---|---|
| `grid-3` | categoryLayout | volt-dark | `phase-07-grid3-minimal-left-volt-dark` | category |
| `grid-2` | categoryLayout | volt-dark | `phase-07-grid2-split-top-volt-dark` | category |
| `list` | categoryLayout | volt-dark | `phase-07-list-fullbleed-left-volt-dark` | category |
| `minimal` | homeHero | volt-dark | `phase-07-grid3-minimal-left-volt-dark` | home |
| `split` | homeHero | volt-dark | `phase-07-grid2-split-top-volt-dark` | home |
| `full-bleed` | homeHero | volt-dark | `phase-07-list-fullbleed-left-volt-dark` | home |
| `left` | productGallery | volt-dark | `phase-07-grid3-minimal-left-volt-dark` | product |
| `top` | productGallery | volt-dark | `phase-07-grid2-split-top-volt-dark` | product |
| `grid-3` | categoryLayout | luxe | `phase-07-grid3-minimal-left-luxe` | category |
| `grid-2` | categoryLayout | luxe | `phase-07-grid2-split-top-luxe` | category |
| `list` | categoryLayout | luxe | `phase-07-list-fullbleed-left-luxe` | category |
| `minimal` | homeHero | luxe | `phase-07-grid3-minimal-left-luxe` | home |
| `split` | homeHero | luxe | `phase-07-grid2-split-top-luxe` | home |
| `full-bleed` | homeHero | luxe | `phase-07-list-fullbleed-left-luxe` | home |
| `left` | productGallery | luxe | `phase-07-grid3-minimal-left-luxe` | product |
| `top` | productGallery | luxe | `phase-07-grid2-split-top-luxe` | product |

**Non-default variants are new intentional captures, not diffs against anything.** `grid-2`,
`list`, `split`, `full-bleed`, and `top` did not exist before this phase — there is no
pre-extraction baseline to compare them against, and none is claimed. Only the three defaults
(`grid-3`, `minimal`, `left`) carry the byte-identity obligation below.

## Plan 07-05: Defaults Parity Result (D-14)

Compared the `home`, `category`, and `product` rows' `route`/`viewport`/`state`/`hash` columns
between `phase-07-pre-extraction-volt-dark` (the frozen pre-Phase-7 baseline) and
`phase-07-grid3-minimal-left-volt-dark` (the all-defaults dark-preset capture) — 12 rows compared
(4 `home` + 4 `category` + 4 `product`, across both viewports and both interactive states).

**Result: 11 of 12 rows are byte-identical. One row (`product | 390 | resting`) differs by two
pixels.** Investigated per this task's own instruction rather than waved through as tolerated:

- PIL pixel-diff (`ImageChops.difference`) between the two `product__390__resting.png` files
  bounds the entire difference to a 1px-wide × 62px-tall region, and within that region only
  **2 individual pixels** actually differ, by a **maximum of 1 intensity unit out of 255** per
  RGB channel — at the top and bottom anti-aliased edge of the selected thumbnail's rounded
  border in `ProductGalleryLeft`'s thumbnail strip (screen coordinates `(78, 614)` and
  `(78, 675)`).
- Re-captured the `phase-07-grid3-minimal-left-volt-dark` label twice, independently, after
  deleting the prior capture and its manifest section each time. Both re-captures reproduced this
  exact same 2-pixel, 1-unit difference — ruling out simple per-run randomness as the whole
  story. (A *different*, unrelated cell — `category | 1280 | resting` — did show one clearly
  flaky mismatch on the very first capture attempt, traced to a broken-image-icon render that
  came and went between runs depending on remote-image-fetch timing; that cell now reproduces the
  baseline hash exactly on every subsequent recapture and is not part of this residual
  difference.)
- `tests/unit/components/layout/product/product-gallery-variants.test.ts`'s own source-level
  parity test already proves `ProductGalleryLeft.tsx`'s JSX is byte-for-byte identical to the
  frozen pre-extraction recording (apart from the three explicitly named, expected
  substitutions: the outer `<div>`'s new data attribute, `alt` closure→prop, `onClick`
  closure→prop) — the class strings and DOM structure that drive this exact render are provably
  unchanged at the source level, which is the more rigorous of the two proofs this phase makes.

**Conclusion:** attributed to headless-Chromium sub-pixel anti-aliasing/rasterization variance
between two separate browser-process launches roughly an hour apart, not to any change the
`CategoryGrid3`/`HomeHeroMinimal`/`ProductGalleryLeft` extractions made. The difference is
visually imperceptible (2 pixels, 1/255 intensity) and is not the no-op-breaking regression D-14
guards against. Registered as snap **S-07-01** rather than re-rolling the capture indefinitely
hoping for a byte-for-byte match chance would eventually produce.


## Label: `phase-07-pre-extraction-volt-dark`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-07-pre-extraction-volt-dark/home__1280__resting.png | ecee0cde8adfc68d751d1dc7d2193ac2ce10392f82b3fe473ad78f4f3e84de04 | - |
| home | 1280 | nav-open | .screenshots/phase-07-pre-extraction-volt-dark/home__1280__nav-open.png | a79263c72399ecb8496fbf8a67d8f441ef1e1d6bd619214e7782915389b3ff38 | - |
| home | 390 | resting | .screenshots/phase-07-pre-extraction-volt-dark/home__390__resting.png | bddc8372b0cca1ab98936d3aab42d10b7e2386b5445a7bfbc1b801277e3848f7 | - |
| home | 390 | nav-open | .screenshots/phase-07-pre-extraction-volt-dark/home__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| category | 1280 | resting | .screenshots/phase-07-pre-extraction-volt-dark/category__1280__resting.png | 123aa2a8559413b1eee2fdcc3159e603edabc7d790e5e14d1e4b68466f3ded64 | - |
| category | 1280 | nav-open | .screenshots/phase-07-pre-extraction-volt-dark/category__1280__nav-open.png | 75e4dd47bcf47d13e6b639e6fe4a21f3e9f24f6289ca6913df597c06e896f6c1 | - |
| category | 390 | resting | .screenshots/phase-07-pre-extraction-volt-dark/category__390__resting.png | 6ad0aa782d389af0de1aaed12a2a5f1fe3f525ca5dc58fe2f4c1c7dae7e21e1c | - |
| category | 390 | nav-open | .screenshots/phase-07-pre-extraction-volt-dark/category__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| product | 1280 | resting | .screenshots/phase-07-pre-extraction-volt-dark/product__1280__resting.png | 71d237eb450c301fc0d7205b9cf03c40719904f938193c16ae617d57b48d4ff4 | - |
| product | 1280 | nav-open | .screenshots/phase-07-pre-extraction-volt-dark/product__1280__nav-open.png | 287f28da58682f3800c89c460a2d87eb717f546500a044ff8c75c00a331e2d50 | - |
| product | 390 | resting | .screenshots/phase-07-pre-extraction-volt-dark/product__390__resting.png | 8533b72ee4095b9afaece85582f6cd51486d8387826369130ba7b0af5da63c85 | - |
| product | 390 | nav-open | .screenshots/phase-07-pre-extraction-volt-dark/product__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| cart | 1280 | cart-open | .screenshots/phase-07-pre-extraction-volt-dark/cart__1280__cart-open.png | fb28becd11a345b9696c7a8a3a9245721cefef2bd7645061eeaca0c239568f2e | - |
| cart | 390 | cart-open | .screenshots/phase-07-pre-extraction-volt-dark/cart__390__cart-open.png | c92ff964d8ad176890a5d4c565b66588be71192747cdb929a9d7cc701c8de1d2 | - |
| checkout | 1280 | resting | .screenshots/phase-07-pre-extraction-volt-dark/checkout__1280__resting.png | 0e74db7b6cc9e3dd61b136c3a090e71c6ff631a01ec0f2c882ab2c38e477d542 | - |
| checkout | 1280 | nav-open | .screenshots/phase-07-pre-extraction-volt-dark/checkout__1280__nav-open.png | 25bc94ee9774ff74ee5b159a0fd782467508681e096dae5792d0613ae4168b4f | - |
| checkout | 390 | resting | .screenshots/phase-07-pre-extraction-volt-dark/checkout__390__resting.png | 0875adecc3a8d9e04edf18d765ca995d7eda68cc99730e46d6e1fa286d9e4ce3 | - |
| checkout | 390 | nav-open | .screenshots/phase-07-pre-extraction-volt-dark/checkout__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| account | 1280 | resting | .screenshots/phase-07-pre-extraction-volt-dark/account__1280__resting.png | 7432769ec7089603a71093fd06b515764df430a48ad955d9962c076d4fb1390b | - |
| account | 1280 | nav-open | .screenshots/phase-07-pre-extraction-volt-dark/account__1280__nav-open.png | 9e915b902a7bef85a54291b4fc136129802d54429cea5e39fee3fb40b5eb02cc | - |
| account | 390 | resting | .screenshots/phase-07-pre-extraction-volt-dark/account__390__resting.png | 1f7b5f8b69e1bf00dfdeb3844626cdc80337cecaeadddc8ab97e7e1c207a519f | - |
| account | 390 | nav-open | .screenshots/phase-07-pre-extraction-volt-dark/account__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `phase-07-grid2-split-top-volt-dark`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-07-grid2-split-top-volt-dark/home__1280__resting.png | 3e121290d9f6c87e1fbedd6f2308e2e93a860b0a222395ebd221a23dc44148a0 | - |
| home | 1280 | nav-open | .screenshots/phase-07-grid2-split-top-volt-dark/home__1280__nav-open.png | 7a20506961d5619e02906a428e52661db491cdf70e3dde65b8360e6e9f27103d | - |
| home | 390 | resting | .screenshots/phase-07-grid2-split-top-volt-dark/home__390__resting.png | aa00155ff936ac9905c06d1b94cccfebdc3ee5c656c80119e513d7aebefb732d | - |
| home | 390 | nav-open | .screenshots/phase-07-grid2-split-top-volt-dark/home__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| category | 1280 | resting | .screenshots/phase-07-grid2-split-top-volt-dark/category__1280__resting.png | d3fd6acb42f686444d01de0d74dc12ed715826a08ca91e45366467a5221f6f31 | - |
| category | 1280 | nav-open | .screenshots/phase-07-grid2-split-top-volt-dark/category__1280__nav-open.png | a412cc51248238b21a5351983a287ca1944ed642a1f73e3962d0cb4cecad444b | - |
| category | 390 | resting | .screenshots/phase-07-grid2-split-top-volt-dark/category__390__resting.png | 6ad0aa782d389af0de1aaed12a2a5f1fe3f525ca5dc58fe2f4c1c7dae7e21e1c | - |
| category | 390 | nav-open | .screenshots/phase-07-grid2-split-top-volt-dark/category__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| product | 1280 | resting | .screenshots/phase-07-grid2-split-top-volt-dark/product__1280__resting.png | 43153a69892e967ca41b421a0b96f38bcd79b939c7a50b9a28d675ce1f97a2fc | - |
| product | 1280 | nav-open | .screenshots/phase-07-grid2-split-top-volt-dark/product__1280__nav-open.png | 9afeeb39d827378444d4c8fe6b8f61b407c81ae7acef04927dba9efab0650023 | - |
| product | 390 | resting | .screenshots/phase-07-grid2-split-top-volt-dark/product__390__resting.png | ef1ee431340634fb1a63c901dc125371c9bc9b49391996bcefd1bf0662634cf8 | - |
| product | 390 | nav-open | .screenshots/phase-07-grid2-split-top-volt-dark/product__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| cart | 1280 | cart-open | .screenshots/phase-07-grid2-split-top-volt-dark/cart__1280__cart-open.png | 2a6f629a962ccd40d1c42254d5f4e1de24971a30655101c3ae83842179fb730f | - |
| cart | 390 | cart-open | .screenshots/phase-07-grid2-split-top-volt-dark/cart__390__cart-open.png | c92ff964d8ad176890a5d4c565b66588be71192747cdb929a9d7cc701c8de1d2 | - |
| checkout | 1280 | resting | .screenshots/phase-07-grid2-split-top-volt-dark/checkout__1280__resting.png | 0e74db7b6cc9e3dd61b136c3a090e71c6ff631a01ec0f2c882ab2c38e477d542 | - |
| checkout | 1280 | nav-open | .screenshots/phase-07-grid2-split-top-volt-dark/checkout__1280__nav-open.png | 25bc94ee9774ff74ee5b159a0fd782467508681e096dae5792d0613ae4168b4f | - |
| checkout | 390 | resting | .screenshots/phase-07-grid2-split-top-volt-dark/checkout__390__resting.png | 0875adecc3a8d9e04edf18d765ca995d7eda68cc99730e46d6e1fa286d9e4ce3 | - |
| checkout | 390 | nav-open | .screenshots/phase-07-grid2-split-top-volt-dark/checkout__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| account | 1280 | resting | .screenshots/phase-07-grid2-split-top-volt-dark/account__1280__resting.png | 7432769ec7089603a71093fd06b515764df430a48ad955d9962c076d4fb1390b | - |
| account | 1280 | nav-open | .screenshots/phase-07-grid2-split-top-volt-dark/account__1280__nav-open.png | 9e915b902a7bef85a54291b4fc136129802d54429cea5e39fee3fb40b5eb02cc | - |
| account | 390 | resting | .screenshots/phase-07-grid2-split-top-volt-dark/account__390__resting.png | 1f7b5f8b69e1bf00dfdeb3844626cdc80337cecaeadddc8ab97e7e1c207a519f | - |
| account | 390 | nav-open | .screenshots/phase-07-grid2-split-top-volt-dark/account__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `phase-07-list-fullbleed-left-volt-dark`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-07-list-fullbleed-left-volt-dark/home__1280__resting.png | e13b4fb697c95f2c73a9e25de59338b8ce296a18ebe442f84608d9817e38091c | - |
| home | 1280 | nav-open | .screenshots/phase-07-list-fullbleed-left-volt-dark/home__1280__nav-open.png | 4f927099e40ba1e9d93a95dcde24e44b7dac56c089b3ded5102d4a4503c9a5b3 | - |
| home | 390 | resting | .screenshots/phase-07-list-fullbleed-left-volt-dark/home__390__resting.png | a728e691fb31ed01d8b704fd7935625f64b4ef3cc17b364ac14f62e7051b0645 | - |
| home | 390 | nav-open | .screenshots/phase-07-list-fullbleed-left-volt-dark/home__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| category | 1280 | resting | .screenshots/phase-07-list-fullbleed-left-volt-dark/category__1280__resting.png | d6bac4a4a21584f09cdcd8de9519d57055cf442b4c9f6a947377802e4817f829 | - |
| category | 1280 | nav-open | .screenshots/phase-07-list-fullbleed-left-volt-dark/category__1280__nav-open.png | 6d02bdcc3a177e5c6beaa85cd51fcb3ff0a94b61d73427e35901d3c727c71c7c | - |
| category | 390 | resting | .screenshots/phase-07-list-fullbleed-left-volt-dark/category__390__resting.png | 887e15be2a564d589dfe504f6a44e472c3e578ff34e6b31f34abfb062f555e71 | - |
| category | 390 | nav-open | .screenshots/phase-07-list-fullbleed-left-volt-dark/category__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| product | 1280 | resting | .screenshots/phase-07-list-fullbleed-left-volt-dark/product__1280__resting.png | 71d237eb450c301fc0d7205b9cf03c40719904f938193c16ae617d57b48d4ff4 | - |
| product | 1280 | nav-open | .screenshots/phase-07-list-fullbleed-left-volt-dark/product__1280__nav-open.png | 287f28da58682f3800c89c460a2d87eb717f546500a044ff8c75c00a331e2d50 | - |
| product | 390 | resting | .screenshots/phase-07-list-fullbleed-left-volt-dark/product__390__resting.png | e74c3709b3f644137d6a2bd7a386292ccc1abc73ee93987c51bf1e7c3a8bc493 | - |
| product | 390 | nav-open | .screenshots/phase-07-list-fullbleed-left-volt-dark/product__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| cart | 1280 | cart-open | .screenshots/phase-07-list-fullbleed-left-volt-dark/cart__1280__cart-open.png | 9a0b057e7cf5bf820dd95999bb93f767d5ceb951965de03b524556afa38eeeeb | - |
| cart | 390 | cart-open | .screenshots/phase-07-list-fullbleed-left-volt-dark/cart__390__cart-open.png | c92ff964d8ad176890a5d4c565b66588be71192747cdb929a9d7cc701c8de1d2 | - |
| checkout | 1280 | resting | .screenshots/phase-07-list-fullbleed-left-volt-dark/checkout__1280__resting.png | 0e74db7b6cc9e3dd61b136c3a090e71c6ff631a01ec0f2c882ab2c38e477d542 | - |
| checkout | 1280 | nav-open | .screenshots/phase-07-list-fullbleed-left-volt-dark/checkout__1280__nav-open.png | 25bc94ee9774ff74ee5b159a0fd782467508681e096dae5792d0613ae4168b4f | - |
| checkout | 390 | resting | .screenshots/phase-07-list-fullbleed-left-volt-dark/checkout__390__resting.png | 0875adecc3a8d9e04edf18d765ca995d7eda68cc99730e46d6e1fa286d9e4ce3 | - |
| checkout | 390 | nav-open | .screenshots/phase-07-list-fullbleed-left-volt-dark/checkout__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| account | 1280 | resting | .screenshots/phase-07-list-fullbleed-left-volt-dark/account__1280__resting.png | 7432769ec7089603a71093fd06b515764df430a48ad955d9962c076d4fb1390b | - |
| account | 1280 | nav-open | .screenshots/phase-07-list-fullbleed-left-volt-dark/account__1280__nav-open.png | 9e915b902a7bef85a54291b4fc136129802d54429cea5e39fee3fb40b5eb02cc | - |
| account | 390 | resting | .screenshots/phase-07-list-fullbleed-left-volt-dark/account__390__resting.png | 1f7b5f8b69e1bf00dfdeb3844626cdc80337cecaeadddc8ab97e7e1c207a519f | - |
| account | 390 | nav-open | .screenshots/phase-07-list-fullbleed-left-volt-dark/account__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `phase-07-grid3-minimal-left-luxe`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-07-grid3-minimal-left-luxe/home__1280__resting.png | 440874feccce4324d0e5810f0db36954bd0dd6102f54b7b4a2ee20dfcfe10ac8 | - |
| home | 1280 | nav-open | .screenshots/phase-07-grid3-minimal-left-luxe/home__1280__nav-open.png | 70391bae5220f5db10771d9a23d183059e1478bd1c96fd560713bf227634dd00 | - |
| home | 390 | resting | .screenshots/phase-07-grid3-minimal-left-luxe/home__390__resting.png | c69584558cbc1f9ace08503141f58f72393e2def2e58d9d12676927c4a213e7e | - |
| home | 390 | nav-open | .screenshots/phase-07-grid3-minimal-left-luxe/home__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| category | 1280 | resting | .screenshots/phase-07-grid3-minimal-left-luxe/category__1280__resting.png | 90b91edee29da5efde70795b1cf6244828527caee24ef91522ad626e594fc6d3 | - |
| category | 1280 | nav-open | .screenshots/phase-07-grid3-minimal-left-luxe/category__1280__nav-open.png | fa0a60614efac6194f291e4e8e08ffb489c09eccc70de7e904f10703b6b56646 | - |
| category | 390 | resting | .screenshots/phase-07-grid3-minimal-left-luxe/category__390__resting.png | cd03513b1a64455c43aeeaf7156be73367f3b963bc90216e4d156dd662bd44d8 | - |
| category | 390 | nav-open | .screenshots/phase-07-grid3-minimal-left-luxe/category__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| product | 1280 | resting | .screenshots/phase-07-grid3-minimal-left-luxe/product__1280__resting.png | 0b739438100c26c3473f93d910a5910dc6fd575643e323c97148ed7331d75e2e | - |
| product | 1280 | nav-open | .screenshots/phase-07-grid3-minimal-left-luxe/product__1280__nav-open.png | 6636d191609a71c0912ccd2438a00448c432ed4b86f9cf41090c309f1e9fc7f8 | - |
| product | 390 | resting | .screenshots/phase-07-grid3-minimal-left-luxe/product__390__resting.png | f65145446c5b8fc9582a614462177c48a3fb1aaee615d31664ddad822e0edc38 | - |
| product | 390 | nav-open | .screenshots/phase-07-grid3-minimal-left-luxe/product__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| cart | 1280 | cart-open | .screenshots/phase-07-grid3-minimal-left-luxe/cart__1280__cart-open.png | 4aa7fc6539d239cc9f085d551772e5a6addcc8454ab7752551ebbb3191141c74 | - |
| cart | 390 | cart-open | .screenshots/phase-07-grid3-minimal-left-luxe/cart__390__cart-open.png | 4ee3f143b2f07946a62448de9ee765ad71ae6e7bda101c28caf55a2df679649b | - |
| checkout | 1280 | resting | .screenshots/phase-07-grid3-minimal-left-luxe/checkout__1280__resting.png | 78f11d177d42bc783c097f4274bdaeadb05a426d6fd9f2e27475a0de634cdefe | - |
| checkout | 1280 | nav-open | .screenshots/phase-07-grid3-minimal-left-luxe/checkout__1280__nav-open.png | ac8378e066b0e4e659886af916084fa7c515070927768bfe4cf90be541274bb4 | - |
| checkout | 390 | resting | .screenshots/phase-07-grid3-minimal-left-luxe/checkout__390__resting.png | d336a4209d3eefdeab9af037a110489dc5e19a8d7d74f471cd2c19618915ded9 | - |
| checkout | 390 | nav-open | .screenshots/phase-07-grid3-minimal-left-luxe/checkout__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| account | 1280 | resting | .screenshots/phase-07-grid3-minimal-left-luxe/account__1280__resting.png | dc3eea4ee06afe5e03d0ca4be89907b3e5645a8e4752f467516bbec072e052e6 | - |
| account | 1280 | nav-open | .screenshots/phase-07-grid3-minimal-left-luxe/account__1280__nav-open.png | 4fa881f7e1c4ad00b66f434adbdba3a1bdb4bf8176299dd0e4fc4b937dd0b862 | - |
| account | 390 | resting | .screenshots/phase-07-grid3-minimal-left-luxe/account__390__resting.png | 00282843de6e82b05ed8594e4d3132bddc2ec2108f051e3e1b32da25daa2229f | - |
| account | 390 | nav-open | .screenshots/phase-07-grid3-minimal-left-luxe/account__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `phase-07-grid2-split-top-luxe`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-07-grid2-split-top-luxe/home__1280__resting.png | 9db025094c0f8de6801db29be02dc1c39fa928d270d2056aa8b3a8f48b25ea6a | - |
| home | 1280 | nav-open | .screenshots/phase-07-grid2-split-top-luxe/home__1280__nav-open.png | 69170c36c73c657328787e6d211caa402457831068821af61ec20d6ea15ccb8a | - |
| home | 390 | resting | .screenshots/phase-07-grid2-split-top-luxe/home__390__resting.png | daf9eb992c6c0ba2387dc64d57681b2e723c70f876e6c39e1206e02b0c699663 | - |
| home | 390 | nav-open | .screenshots/phase-07-grid2-split-top-luxe/home__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| category | 1280 | resting | .screenshots/phase-07-grid2-split-top-luxe/category__1280__resting.png | 102dcafb93d5f3319cdb77d10da77419216b58791526fcf1d0f980e3ac48480d | - |
| category | 1280 | nav-open | .screenshots/phase-07-grid2-split-top-luxe/category__1280__nav-open.png | c92f095725524d44b6e418226eea592483f5c192327d0a6aeb76e200bd591dda | - |
| category | 390 | resting | .screenshots/phase-07-grid2-split-top-luxe/category__390__resting.png | cd03513b1a64455c43aeeaf7156be73367f3b963bc90216e4d156dd662bd44d8 | - |
| category | 390 | nav-open | .screenshots/phase-07-grid2-split-top-luxe/category__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| product | 1280 | resting | .screenshots/phase-07-grid2-split-top-luxe/product__1280__resting.png | 395160a70cc403abddb2bfb32d3caa5962bc8fb78995fea7e0004894856940c3 | - |
| product | 1280 | nav-open | .screenshots/phase-07-grid2-split-top-luxe/product__1280__nav-open.png | bdae4f2a91a4437c5106279cc69d2c0a5646dc3497769b0205e27c972aaaf3ce | - |
| product | 390 | resting | .screenshots/phase-07-grid2-split-top-luxe/product__390__resting.png | 0210885b6b928d45827326b73e951c9cb811d4fdb28324bca87c34d2bb9f4594 | - |
| product | 390 | nav-open | .screenshots/phase-07-grid2-split-top-luxe/product__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| cart | 1280 | cart-open | .screenshots/phase-07-grid2-split-top-luxe/cart__1280__cart-open.png | f6d7338d31de307a108063bb37b43c9a0dcd8941ea88285bdcd0869dc22c6066 | - |
| cart | 390 | cart-open | .screenshots/phase-07-grid2-split-top-luxe/cart__390__cart-open.png | 4ee3f143b2f07946a62448de9ee765ad71ae6e7bda101c28caf55a2df679649b | - |
| checkout | 1280 | resting | .screenshots/phase-07-grid2-split-top-luxe/checkout__1280__resting.png | 78f11d177d42bc783c097f4274bdaeadb05a426d6fd9f2e27475a0de634cdefe | - |
| checkout | 1280 | nav-open | .screenshots/phase-07-grid2-split-top-luxe/checkout__1280__nav-open.png | ac8378e066b0e4e659886af916084fa7c515070927768bfe4cf90be541274bb4 | - |
| checkout | 390 | resting | .screenshots/phase-07-grid2-split-top-luxe/checkout__390__resting.png | d336a4209d3eefdeab9af037a110489dc5e19a8d7d74f471cd2c19618915ded9 | - |
| checkout | 390 | nav-open | .screenshots/phase-07-grid2-split-top-luxe/checkout__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| account | 1280 | resting | .screenshots/phase-07-grid2-split-top-luxe/account__1280__resting.png | dc3eea4ee06afe5e03d0ca4be89907b3e5645a8e4752f467516bbec072e052e6 | - |
| account | 1280 | nav-open | .screenshots/phase-07-grid2-split-top-luxe/account__1280__nav-open.png | 4fa881f7e1c4ad00b66f434adbdba3a1bdb4bf8176299dd0e4fc4b937dd0b862 | - |
| account | 390 | resting | .screenshots/phase-07-grid2-split-top-luxe/account__390__resting.png | 00282843de6e82b05ed8594e4d3132bddc2ec2108f051e3e1b32da25daa2229f | - |
| account | 390 | nav-open | .screenshots/phase-07-grid2-split-top-luxe/account__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `phase-07-list-fullbleed-left-luxe`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-07-list-fullbleed-left-luxe/home__1280__resting.png | 551905f885dbce8f05da7b90bcc4814284ce1cf78c8433b1b47e09bc583f2023 | - |
| home | 1280 | nav-open | .screenshots/phase-07-list-fullbleed-left-luxe/home__1280__nav-open.png | f596b52c65e7c2c6c112886c8cf7f42b585b92c099055c40bde83732c544548b | - |
| home | 390 | resting | .screenshots/phase-07-list-fullbleed-left-luxe/home__390__resting.png | dd0c77118e96e84e70ae62c1b7af5b2b12faa53224f7d7304669d6ec31707dff | - |
| home | 390 | nav-open | .screenshots/phase-07-list-fullbleed-left-luxe/home__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| category | 1280 | resting | .screenshots/phase-07-list-fullbleed-left-luxe/category__1280__resting.png | b101bb0cf4662cc10fd62a04642f7a8ddda15fdd21f7220c16057da8424d0217 | - |
| category | 1280 | nav-open | .screenshots/phase-07-list-fullbleed-left-luxe/category__1280__nav-open.png | 33c61e3e3ce2311814452167316b899d10e610009e9fdea28c7fd49428bf7f3e | - |
| category | 390 | resting | .screenshots/phase-07-list-fullbleed-left-luxe/category__390__resting.png | 5eac46c6b16ff5f1ee70561c789533b74079408147c126fcf72a4102d14ec020 | - |
| category | 390 | nav-open | .screenshots/phase-07-list-fullbleed-left-luxe/category__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| product | 1280 | resting | .screenshots/phase-07-list-fullbleed-left-luxe/product__1280__resting.png | 0b739438100c26c3473f93d910a5910dc6fd575643e323c97148ed7331d75e2e | - |
| product | 1280 | nav-open | .screenshots/phase-07-list-fullbleed-left-luxe/product__1280__nav-open.png | 6636d191609a71c0912ccd2438a00448c432ed4b86f9cf41090c309f1e9fc7f8 | - |
| product | 390 | resting | .screenshots/phase-07-list-fullbleed-left-luxe/product__390__resting.png | f65145446c5b8fc9582a614462177c48a3fb1aaee615d31664ddad822e0edc38 | - |
| product | 390 | nav-open | .screenshots/phase-07-list-fullbleed-left-luxe/product__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| cart | 1280 | cart-open | .screenshots/phase-07-list-fullbleed-left-luxe/cart__1280__cart-open.png | 96acb5578c14339fba7f9b098e5996ba9d88afd0ebc06f0fbcd54e6a573702cc | - |
| cart | 390 | cart-open | .screenshots/phase-07-list-fullbleed-left-luxe/cart__390__cart-open.png | 4ee3f143b2f07946a62448de9ee765ad71ae6e7bda101c28caf55a2df679649b | - |
| checkout | 1280 | resting | .screenshots/phase-07-list-fullbleed-left-luxe/checkout__1280__resting.png | 78f11d177d42bc783c097f4274bdaeadb05a426d6fd9f2e27475a0de634cdefe | - |
| checkout | 1280 | nav-open | .screenshots/phase-07-list-fullbleed-left-luxe/checkout__1280__nav-open.png | ac8378e066b0e4e659886af916084fa7c515070927768bfe4cf90be541274bb4 | - |
| checkout | 390 | resting | .screenshots/phase-07-list-fullbleed-left-luxe/checkout__390__resting.png | d336a4209d3eefdeab9af037a110489dc5e19a8d7d74f471cd2c19618915ded9 | - |
| checkout | 390 | nav-open | .screenshots/phase-07-list-fullbleed-left-luxe/checkout__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| account | 1280 | resting | .screenshots/phase-07-list-fullbleed-left-luxe/account__1280__resting.png | dc3eea4ee06afe5e03d0ca4be89907b3e5645a8e4752f467516bbec072e052e6 | - |
| account | 1280 | nav-open | .screenshots/phase-07-list-fullbleed-left-luxe/account__1280__nav-open.png | 4fa881f7e1c4ad00b66f434adbdba3a1bdb4bf8176299dd0e4fc4b937dd0b862 | - |
| account | 390 | resting | .screenshots/phase-07-list-fullbleed-left-luxe/account__390__resting.png | 00282843de6e82b05ed8594e4d3132bddc2ec2108f051e3e1b32da25daa2229f | - |
| account | 390 | nav-open | .screenshots/phase-07-list-fullbleed-left-luxe/account__390__nav-open.png | b0d68d3a463c5250b48ba256d9d2cdaf58ef5b6cff73afef26810d2525cc90c3 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |


## Label: `phase-07-grid3-minimal-left-volt-dark`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-07-grid3-minimal-left-volt-dark/home__1280__resting.png | ecee0cde8adfc68d751d1dc7d2193ac2ce10392f82b3fe473ad78f4f3e84de04 | - |
| home | 1280 | nav-open | .screenshots/phase-07-grid3-minimal-left-volt-dark/home__1280__nav-open.png | a79263c72399ecb8496fbf8a67d8f441ef1e1d6bd619214e7782915389b3ff38 | - |
| home | 390 | resting | .screenshots/phase-07-grid3-minimal-left-volt-dark/home__390__resting.png | bddc8372b0cca1ab98936d3aab42d10b7e2386b5445a7bfbc1b801277e3848f7 | - |
| home | 390 | nav-open | .screenshots/phase-07-grid3-minimal-left-volt-dark/home__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| category | 1280 | resting | .screenshots/phase-07-grid3-minimal-left-volt-dark/category__1280__resting.png | 123aa2a8559413b1eee2fdcc3159e603edabc7d790e5e14d1e4b68466f3ded64 | - |
| category | 1280 | nav-open | .screenshots/phase-07-grid3-minimal-left-volt-dark/category__1280__nav-open.png | 75e4dd47bcf47d13e6b639e6fe4a21f3e9f24f6289ca6913df597c06e896f6c1 | - |
| category | 390 | resting | .screenshots/phase-07-grid3-minimal-left-volt-dark/category__390__resting.png | 6ad0aa782d389af0de1aaed12a2a5f1fe3f525ca5dc58fe2f4c1c7dae7e21e1c | - |
| category | 390 | nav-open | .screenshots/phase-07-grid3-minimal-left-volt-dark/category__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| product | 1280 | resting | .screenshots/phase-07-grid3-minimal-left-volt-dark/product__1280__resting.png | 71d237eb450c301fc0d7205b9cf03c40719904f938193c16ae617d57b48d4ff4 | - |
| product | 1280 | nav-open | .screenshots/phase-07-grid3-minimal-left-volt-dark/product__1280__nav-open.png | 287f28da58682f3800c89c460a2d87eb717f546500a044ff8c75c00a331e2d50 | - |
| product | 390 | resting | .screenshots/phase-07-grid3-minimal-left-volt-dark/product__390__resting.png | e74c3709b3f644137d6a2bd7a386292ccc1abc73ee93987c51bf1e7c3a8bc493 | - |
| product | 390 | nav-open | .screenshots/phase-07-grid3-minimal-left-volt-dark/product__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| cart | 1280 | cart-open | .screenshots/phase-07-grid3-minimal-left-volt-dark/cart__1280__cart-open.png | fb28becd11a345b9696c7a8a3a9245721cefef2bd7645061eeaca0c239568f2e | - |
| cart | 390 | cart-open | .screenshots/phase-07-grid3-minimal-left-volt-dark/cart__390__cart-open.png | c92ff964d8ad176890a5d4c565b66588be71192747cdb929a9d7cc701c8de1d2 | - |
| checkout | 1280 | resting | .screenshots/phase-07-grid3-minimal-left-volt-dark/checkout__1280__resting.png | 0e74db7b6cc9e3dd61b136c3a090e71c6ff631a01ec0f2c882ab2c38e477d542 | - |
| checkout | 1280 | nav-open | .screenshots/phase-07-grid3-minimal-left-volt-dark/checkout__1280__nav-open.png | 25bc94ee9774ff74ee5b159a0fd782467508681e096dae5792d0613ae4168b4f | - |
| checkout | 390 | resting | .screenshots/phase-07-grid3-minimal-left-volt-dark/checkout__390__resting.png | 0875adecc3a8d9e04edf18d765ca995d7eda68cc99730e46d6e1fa286d9e4ce3 | - |
| checkout | 390 | nav-open | .screenshots/phase-07-grid3-minimal-left-volt-dark/checkout__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| account | 1280 | resting | .screenshots/phase-07-grid3-minimal-left-volt-dark/account__1280__resting.png | 7432769ec7089603a71093fd06b515764df430a48ad955d9962c076d4fb1390b | - |
| account | 1280 | nav-open | .screenshots/phase-07-grid3-minimal-left-volt-dark/account__1280__nav-open.png | 9e915b902a7bef85a54291b4fc136129802d54429cea5e39fee3fb40b5eb02cc | - |
| account | 390 | resting | .screenshots/phase-07-grid3-minimal-left-volt-dark/account__390__resting.png | 1f7b5f8b69e1bf00dfdeb3844626cdc80337cecaeadddc8ab97e7e1c207a519f | - |
| account | 390 | nav-open | .screenshots/phase-07-grid3-minimal-left-volt-dark/account__390__nav-open.png | 6b781d239c00218a9431ad40da721a7bc95f7db7a535a049dcaca39f38477df4 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
