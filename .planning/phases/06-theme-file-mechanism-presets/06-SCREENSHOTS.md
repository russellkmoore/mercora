# Phase 6 Screenshot Record

This is Phase 6's own screenshot coverage record — a new file, following the format
`.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` established (label
sections, route/viewport/state/path/hash/notes tables, and a phase-close roll-up), but scoped
to this phase's own capture runs rather than appending to Phase 5's file. Captured images live
under the git-ignored `.screenshots/` directory and are never committed — they may contain real
customer names, addresses, and order contents on the account, checkout, and order-status
routes. Only this manifest (route, viewport, state, path, content hash) is committed.

Capture command: `mise exec -- npm run screenshot:routes -- --label <name> --allow-missing`
(this phase's local D1 fixture has no seeded order, so `--allow-missing` is required on every
run; see Task 1's carried-forward gaps below).

Plans 06-02 and 06-03 already ran two capture labels each (`phase-06-02-active-theme`,
`phase-06-03-midnight`, `phase-06-03-luxe`) — those went to the harness's default manifest path
and live in `05-SCREENSHOTS.md`, not here (an inherited default-path choice from before this
plan existed, not revisited retroactively). This file's own three labels
(`phase-06-05-volt-dark`, `phase-06-05-midnight`, `phase-06-05-luxe`) are Task 1's own baseline
captures, taken fresh against the current tree so the light-preset QA pass in Task 2 has a real
same-session dark-preset comparison rather than a different plan's older capture.

---

## Task 1: Per-preset route-grid captures

Three shipped presets (`volt-dark`, `midnight`, `luxe` — the 06-03 manifest, filename order),
each captured across the full D-20 seven-route grid at both viewports and all interactive
states, with the stored `appearance.theme` D1 setting switched before each run and the served
`<html data-theme="...">` attribute confirmed to match before capturing.

**Method:** local `npm run dev` server against the existing local D1 fixture (1 category, 1
product — the same thin-but-present catalog fixture prior Phase 6 plans used, sufficient for
every cell except the pre-existing gaps below). Theme switched via `POST /api/admin/settings`
using the documented `x-dev-admin: mercora-dev-bypass` dev-bypass header (same mechanism
06-04's own E2E proof used), since no Clerk session is available in this environment. Confirmed
via `curl http://localhost:3000/ | grep data-theme` before each capture run.

| Run | Label | Theme written to D1 | `data-theme` confirmed before capture | Cells captured | Cells missing |
|---|---|---|---|---|---|
| 1 | `phase-06-05-volt-dark` | `volt-dark` | `data-theme="volt-dark"` | 22 | 4 |
| 2 | `phase-06-05-midnight` | `midnight` | `data-theme="midnight"` | 22 | 4 |
| 3 | `phase-06-05-luxe` | `luxe` | `data-theme="luxe"` | 22 | 4 |

All three runs report the identical 22-captured/4-missing split. The 4 missing cells in every
run are `order-status` (1280/resting, 1280/nav-open, 390/resting, 390/nav-open) — the same
Phase 5 coverage gap carried forward unchanged since 06-02: the local D1 fixture has no seeded
order, so `--order-id` cannot be supplied and the harness records `MISSING` with its own
built-in reason string. This run closed none of the four Phase 5 gaps (order-status, Stripe
payment step, authenticated account dashboard, review-form error state) — none of those
prerequisites (a seeded order, a Clerk session) exist in this environment either, consistent
with every prior Phase 6 plan's capture runs. Carried forward again in the phase-close section
below.

At the end of Task 1, the stored `appearance.theme` setting was written back to the manifest
default (`volt-dark`), confirmed via `wrangler d1 execute mercora-db --local --command "SELECT
key,value FROM admin_settings WHERE category='appearance'"` → `{"key":"appearance.theme",
"value":"\"volt-dark\""}`.

`mise exec -- npm run scan:tokens` after this task: 0 violations, the same 2 manual-review rows
Phase 5 closed with (nothing in this task changed source).

## Label: `phase-06-05-volt-dark`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-06-05-volt-dark/home__1280__resting.png | f5d499e64a4ed1403696d6186021ba12ef4535a17d6e900ccf863e2932d3680a | - |
| home | 1280 | nav-open | .screenshots/phase-06-05-volt-dark/home__1280__nav-open.png | e8cfd69ec43eb7ae5c92747d60a0d14f681edfbafc7084909d11ce9064c5855d | - |
| home | 390 | resting | .screenshots/phase-06-05-volt-dark/home__390__resting.png | 65e03c2daafd238c67b873d696686c39b36e83522febc199c325dbc3018d4850 | - |
| home | 390 | nav-open | .screenshots/phase-06-05-volt-dark/home__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| category | 1280 | resting | .screenshots/phase-06-05-volt-dark/category__1280__resting.png | 053043895c0bea61e6af3de495c72a7153e049ffe2ca2c55791e7fb29f723c86 | - |
| category | 1280 | nav-open | .screenshots/phase-06-05-volt-dark/category__1280__nav-open.png | c8af917527a7904472212387c65af4c46bba94d4cc6ad3e0c33f02d8046dec68 | - |
| category | 390 | resting | .screenshots/phase-06-05-volt-dark/category__390__resting.png | f196cbdbd230724e56a379418b37640bc7934a5bb9b5272997037a9c1150a058 | - |
| category | 390 | nav-open | .screenshots/phase-06-05-volt-dark/category__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| product | 1280 | resting | .screenshots/phase-06-05-volt-dark/product__1280__resting.png | 109f0ab02e43b3b6a42320eacf3329a8dbbf7df35b9d87c548a45a52bd63f8a0 | - |
| product | 1280 | nav-open | .screenshots/phase-06-05-volt-dark/product__1280__nav-open.png | 8636c1a88d66e61c2dbd1512520cee7b1417a858ef8188ab7a6b12b4375694ea | - |
| product | 390 | resting | .screenshots/phase-06-05-volt-dark/product__390__resting.png | 92eae83cc0e2d916c09fc5525efe566a6e150c83fdd6271fb1938ece9a718632 | - |
| product | 390 | nav-open | .screenshots/phase-06-05-volt-dark/product__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| cart | 1280 | cart-open | .screenshots/phase-06-05-volt-dark/cart__1280__cart-open.png | d5aa4e6a788e4dc72ae5ace88f073e60486ca865e38ea02a4a3792636d2460de | - |
| cart | 390 | cart-open | .screenshots/phase-06-05-volt-dark/cart__390__cart-open.png | 562107229ce4aeb2e2faed585ae0ed6985e2857a8b04c5143b2b96090dddc0d5 | - |
| checkout | 1280 | resting | .screenshots/phase-06-05-volt-dark/checkout__1280__resting.png | 67a36d04df9c04d5e0547efd6158823f5144b6307365b9ad3733a0e473df1e85 | - |
| checkout | 1280 | nav-open | .screenshots/phase-06-05-volt-dark/checkout__1280__nav-open.png | 0f766c1d9d9391eb32220010acd11e4f2e684811e67902627d147f8072284b36 | - |
| checkout | 390 | resting | .screenshots/phase-06-05-volt-dark/checkout__390__resting.png | 8c634a185ba017d2eda279005c956ec61227d7d5d61b1d5029eab7b6f9feab55 | - |
| checkout | 390 | nav-open | .screenshots/phase-06-05-volt-dark/checkout__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| account | 1280 | resting | .screenshots/phase-06-05-volt-dark/account__1280__resting.png | 79bbd0d305a10b34b614efea325ee2b53ca43b61471e8634759b6d8dae762caf | - |
| account | 1280 | nav-open | .screenshots/phase-06-05-volt-dark/account__1280__nav-open.png | a4016a92afc536bf04a67250f1ae20835e8002c28402bcb8b5a125bf60c03584 | - |
| account | 390 | resting | .screenshots/phase-06-05-volt-dark/account__390__resting.png | ed89750938ee8c9b3a2e63dc6cb207c74e687d63f2486f72642e629a6b2164e7 | - |
| account | 390 | nav-open | .screenshots/phase-06-05-volt-dark/account__390__nav-open.png | ee617831f0bbfbf560aa2c79629c83bbbed92aed847278e8ccfb79defe78ada4 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `phase-06-05-midnight`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-06-05-midnight/home__1280__resting.png | f23c8055b6b706d4c34040325c8b0264627ef7e5eef25f4f7db5e523c02133f2 | - |
| home | 1280 | nav-open | .screenshots/phase-06-05-midnight/home__1280__nav-open.png | 6fd4cfb9a5754e7292f260be14fafe0e90f7bfb1a04b6fd1c25cf9b91165ac2c | - |
| home | 390 | resting | .screenshots/phase-06-05-midnight/home__390__resting.png | 6f78eee0b0627928f80b4b0958bb1b8149ecb213e3ec57ffa0e7d9bf4027fba5 | - |
| home | 390 | nav-open | .screenshots/phase-06-05-midnight/home__390__nav-open.png | a6e8782a71c048a52f663aa30af0441df7f668b78176781ddb6e4f6ecfc600cd | - |
| category | 1280 | resting | .screenshots/phase-06-05-midnight/category__1280__resting.png | 4c10b684b93b3c605caec72b7ada6928c2349086aa7c5ac388112732cbaf20ca | - |
| category | 1280 | nav-open | .screenshots/phase-06-05-midnight/category__1280__nav-open.png | 3837fd239d57a6fa9b4d49ca98c3fa8d662b52275c47687d13ddbf8adc47cf4e | - |
| category | 390 | resting | .screenshots/phase-06-05-midnight/category__390__resting.png | 706088cc9b5989999657d9c09a10f0baf39e1325801cddc36a3f716a01dacaca | - |
| category | 390 | nav-open | .screenshots/phase-06-05-midnight/category__390__nav-open.png | a6e8782a71c048a52f663aa30af0441df7f668b78176781ddb6e4f6ecfc600cd | - |
| product | 1280 | resting | .screenshots/phase-06-05-midnight/product__1280__resting.png | 03c7a24ca69c0f9eb790c6f685c2a4ddc9ecb59c54b936ee0dc019d75ce36000 | - |
| product | 1280 | nav-open | .screenshots/phase-06-05-midnight/product__1280__nav-open.png | 65f1f345f434d4cf3cd8927d9d5423b0f43c9287d38a1113e9f289a2db47dc61 | - |
| product | 390 | resting | .screenshots/phase-06-05-midnight/product__390__resting.png | f2fc28770d93ea75ef007e23f644bf9ad9f5cfcb60a89736d755b8166a87afac | - |
| product | 390 | nav-open | .screenshots/phase-06-05-midnight/product__390__nav-open.png | a6e8782a71c048a52f663aa30af0441df7f668b78176781ddb6e4f6ecfc600cd | - |
| cart | 1280 | cart-open | .screenshots/phase-06-05-midnight/cart__1280__cart-open.png | 8e722759bb1123c3b072ccfe762f3d3f7446f5b8fb4dd0257efb157f7dd031b5 | - |
| cart | 390 | cart-open | .screenshots/phase-06-05-midnight/cart__390__cart-open.png | ac70109d13d8e61c49f45493dbc7771c2f85dcd8f3b9aec82c569326723134d1 | - |
| checkout | 1280 | resting | .screenshots/phase-06-05-midnight/checkout__1280__resting.png | af947fd63661bea22042880896910f4f99e44584d5b6bc3fdc355e625f3963d7 | - |
| checkout | 1280 | nav-open | .screenshots/phase-06-05-midnight/checkout__1280__nav-open.png | 777259c9a2bb59652999474bd3530ca41f0e0d21a9a796c7d2542fe57d1bebf8 | - |
| checkout | 390 | resting | .screenshots/phase-06-05-midnight/checkout__390__resting.png | 480c8444f261ff916e6283bb5a502dfd049d8a6bc804d50d2e25a850a00784d3 | - |
| checkout | 390 | nav-open | .screenshots/phase-06-05-midnight/checkout__390__nav-open.png | a6e8782a71c048a52f663aa30af0441df7f668b78176781ddb6e4f6ecfc600cd | - |
| account | 1280 | resting | .screenshots/phase-06-05-midnight/account__1280__resting.png | ddd9cc23aa5edf4d30068ee6dd928b419583ac11b91c5bf536756622e937cab3 | - |
| account | 1280 | nav-open | .screenshots/phase-06-05-midnight/account__1280__nav-open.png | c4bd45e4f0da11760e72a022e55311cdbde0d33151278ee1b12ec8ae307f8457 | - |
| account | 390 | resting | .screenshots/phase-06-05-midnight/account__390__resting.png | ea1583e8b40f3b06f50cfc6017d209b330d4f35784357532913a957f3eaffe32 | - |
| account | 390 | nav-open | .screenshots/phase-06-05-midnight/account__390__nav-open.png | a6e8782a71c048a52f663aa30af0441df7f668b78176781ddb6e4f6ecfc600cd | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

## Label: `phase-06-05-luxe`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-06-05-luxe/home__1280__resting.png | d53e3f278592f286b33e595d514b35148b4e574745a63c7a7e9b5d93c95a66ff | - |
| home | 1280 | nav-open | .screenshots/phase-06-05-luxe/home__1280__nav-open.png | 3876c4f852874c3a24c71a8c704c1575d958571a1487baa32140ecf572b7aeaf | - |
| home | 390 | resting | .screenshots/phase-06-05-luxe/home__390__resting.png | caebb86b39129d2e3732f0a79d085b15eebfb63203d5057cdaa30802022c3eb0 | - |
| home | 390 | nav-open | .screenshots/phase-06-05-luxe/home__390__nav-open.png | 09f26cdeb7ade75b42950f521c6a46e6f0cc906a6e6a3ce31ec0632eeef497a7 | - |
| category | 1280 | resting | .screenshots/phase-06-05-luxe/category__1280__resting.png | bd487f9b3e0f0810a7a6249618041d0b6b6112f633749cc061a50fa21f5c507b | - |
| category | 1280 | nav-open | .screenshots/phase-06-05-luxe/category__1280__nav-open.png | 77c3bc094a360d8ebaa88ffca9d3dca9e79e92e5c55069fa95701cb2df6b1c13 | - |
| category | 390 | resting | .screenshots/phase-06-05-luxe/category__390__resting.png | 2e3cc4bc3983cf4320e4759240cc54594b0da7af3d9fa4ef5b61b5026493a477 | - |
| category | 390 | nav-open | .screenshots/phase-06-05-luxe/category__390__nav-open.png | 09f26cdeb7ade75b42950f521c6a46e6f0cc906a6e6a3ce31ec0632eeef497a7 | - |
| product | 1280 | resting | .screenshots/phase-06-05-luxe/product__1280__resting.png | 6c6322b35ae7505a10b57d3ff657dbce149ab18053399279fb261f0763548c03 | - |
| product | 1280 | nav-open | .screenshots/phase-06-05-luxe/product__1280__nav-open.png | 20abaf81763b551465c2f204f88be397bb79b0761feb722c0eedef06a7951111 | - |
| product | 390 | resting | .screenshots/phase-06-05-luxe/product__390__resting.png | 9948ab23bed3d0094907cfb3a1e90eb8420a1c5dcde31541c8c70592f091ce3e | - |
| product | 390 | nav-open | .screenshots/phase-06-05-luxe/product__390__nav-open.png | 09f26cdeb7ade75b42950f521c6a46e6f0cc906a6e6a3ce31ec0632eeef497a7 | - |
| cart | 1280 | cart-open | .screenshots/phase-06-05-luxe/cart__1280__cart-open.png | 368cf9886ab5e18ed3c21bab336e1031bfc2eba6bacb3fa121460cf1276358ed | - |
| cart | 390 | cart-open | .screenshots/phase-06-05-luxe/cart__390__cart-open.png | 98e6c138e635e221c51825d6bcd1003fd5768cc16040be53f9a2a0aea7d39b11 | - |
| checkout | 1280 | resting | .screenshots/phase-06-05-luxe/checkout__1280__resting.png | fe13e930773dce613ce22ed07bf7bef503ce4bea64d7aa8e56c7e65654c588b0 | - |
| checkout | 1280 | nav-open | .screenshots/phase-06-05-luxe/checkout__1280__nav-open.png | 6fca758e54c7c454ab3550295e7446c2db9a6dd6d9f54576c3affa2bed541609 | - |
| checkout | 390 | resting | .screenshots/phase-06-05-luxe/checkout__390__resting.png | 2a2e2f96b0d82fb283b1c6c988a2885de4817e9983958ce95ce32c8c6517e4b4 | - |
| checkout | 390 | nav-open | .screenshots/phase-06-05-luxe/checkout__390__nav-open.png | 09f26cdeb7ade75b42950f521c6a46e6f0cc906a6e6a3ce31ec0632eeef497a7 | - |
| account | 1280 | resting | .screenshots/phase-06-05-luxe/account__1280__resting.png | 9062b935c1520073778e3e5dfd99a147b43e2c474e04fc1a3e42daed3d47bb95 | - |
| account | 1280 | nav-open | .screenshots/phase-06-05-luxe/account__1280__nav-open.png | daccf8aff6e7523c98dc5bde962a3db5a5d220b7d6f7891c1c39a64e0b8278ba | - |
| account | 390 | resting | .screenshots/phase-06-05-luxe/account__390__resting.png | 81d61c1372fce37302129ae65a637146dcf16d21f80e063526afa63a3d278e79 | - |
| account | 390 | nav-open | .screenshots/phase-06-05-luxe/account__390__nav-open.png | 09f26cdeb7ade75b42950f521c6a46e6f0cc906a6e6a3ce31ec0632eeef497a7 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

<!-- gsd:write-continue -->
