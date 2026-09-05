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
