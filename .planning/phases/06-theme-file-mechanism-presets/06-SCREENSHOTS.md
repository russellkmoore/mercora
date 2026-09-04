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

## Label: `phase-06-05-luxe-postfix`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-06-05-luxe-postfix/home__1280__resting.png | d53e3f278592f286b33e595d514b35148b4e574745a63c7a7e9b5d93c95a66ff | - |
| home | 1280 | nav-open | .screenshots/phase-06-05-luxe-postfix/home__1280__nav-open.png | 3876c4f852874c3a24c71a8c704c1575d958571a1487baa32140ecf572b7aeaf | - |
| home | 390 | resting | .screenshots/phase-06-05-luxe-postfix/home__390__resting.png | caebb86b39129d2e3732f0a79d085b15eebfb63203d5057cdaa30802022c3eb0 | - |
| home | 390 | nav-open | .screenshots/phase-06-05-luxe-postfix/home__390__nav-open.png | 09f26cdeb7ade75b42950f521c6a46e6f0cc906a6e6a3ce31ec0632eeef497a7 | - |
| category | 1280 | resting | .screenshots/phase-06-05-luxe-postfix/category__1280__resting.png | bd487f9b3e0f0810a7a6249618041d0b6b6112f633749cc061a50fa21f5c507b | - |
| category | 1280 | nav-open | .screenshots/phase-06-05-luxe-postfix/category__1280__nav-open.png | 77c3bc094a360d8ebaa88ffca9d3dca9e79e92e5c55069fa95701cb2df6b1c13 | - |
| category | 390 | resting | .screenshots/phase-06-05-luxe-postfix/category__390__resting.png | 2e3cc4bc3983cf4320e4759240cc54594b0da7af3d9fa4ef5b61b5026493a477 | - |
| category | 390 | nav-open | .screenshots/phase-06-05-luxe-postfix/category__390__nav-open.png | 09f26cdeb7ade75b42950f521c6a46e6f0cc906a6e6a3ce31ec0632eeef497a7 | - |
| product | 1280 | resting | .screenshots/phase-06-05-luxe-postfix/product__1280__resting.png | 6c6322b35ae7505a10b57d3ff657dbce149ab18053399279fb261f0763548c03 | - |
| product | 1280 | nav-open | .screenshots/phase-06-05-luxe-postfix/product__1280__nav-open.png | 20abaf81763b551465c2f204f88be397bb79b0761feb722c0eedef06a7951111 | - |
| product | 390 | resting | .screenshots/phase-06-05-luxe-postfix/product__390__resting.png | 9948ab23bed3d0094907cfb3a1e90eb8420a1c5dcde31541c8c70592f091ce3e | - |
| product | 390 | nav-open | .screenshots/phase-06-05-luxe-postfix/product__390__nav-open.png | 09f26cdeb7ade75b42950f521c6a46e6f0cc906a6e6a3ce31ec0632eeef497a7 | - |
| cart | 1280 | cart-open | .screenshots/phase-06-05-luxe-postfix/cart__1280__cart-open.png | 91eae9aee96c6cc8991fd75ac2c4d5294d1ef3bd0f6327da91a783d0b340d82d | - |
| cart | 390 | cart-open | .screenshots/phase-06-05-luxe-postfix/cart__390__cart-open.png | 98e6c138e635e221c51825d6bcd1003fd5768cc16040be53f9a2a0aea7d39b11 | - |
| checkout | 1280 | resting | .screenshots/phase-06-05-luxe-postfix/checkout__1280__resting.png | fe13e930773dce613ce22ed07bf7bef503ce4bea64d7aa8e56c7e65654c588b0 | - |
| checkout | 1280 | nav-open | .screenshots/phase-06-05-luxe-postfix/checkout__1280__nav-open.png | 6fca758e54c7c454ab3550295e7446c2db9a6dd6d9f54576c3affa2bed541609 | - |
| checkout | 390 | resting | .screenshots/phase-06-05-luxe-postfix/checkout__390__resting.png | 2a2e2f96b0d82fb283b1c6c988a2885de4817e9983958ce95ce32c8c6517e4b4 | - |
| checkout | 390 | nav-open | .screenshots/phase-06-05-luxe-postfix/checkout__390__nav-open.png | 09f26cdeb7ade75b42950f521c6a46e6f0cc906a6e6a3ce31ec0632eeef497a7 | - |
| account | 1280 | resting | .screenshots/phase-06-05-luxe-postfix/account__1280__resting.png | 9062b935c1520073778e3e5dfd99a147b43e2c474e04fc1a3e42daed3d47bb95 | - |
| account | 1280 | nav-open | .screenshots/phase-06-05-luxe-postfix/account__1280__nav-open.png | daccf8aff6e7523c98dc5bde962a3db5a5d220b7d6f7891c1c39a64e0b8278ba | - |
| account | 390 | resting | .screenshots/phase-06-05-luxe-postfix/account__390__resting.png | 81d61c1372fce37302129ae65a637146dcf16d21f80e063526afa63a3d278e79 | - |
| account | 390 | nav-open | .screenshots/phase-06-05-luxe-postfix/account__390__nav-open.png | 09f26cdeb7ade75b42950f521c6a46e6f0cc906a6e6a3ce31ec0632eeef497a7 | - |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 1280 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |
| order-status | 390 | MISSING | - | - | no order id available (pass --order-id, or local D1 seed has no orders) |

---

## Task 2: The light-preset acid test

Per D-04 and the UI-SPEC's pre-located finding, the light preset is where a token-driven scrim's
polarity dependence would surface: `bg-surface/NN` at any opacity inherits `--store-surface`,
which is near-white (`#f8f5ef`) under `luxe`, so the same class that reads as a correct black-alpha
scrim under every dark preset can read as an invisible or near-invisible wash under the light one.

**Method.** With the stored theme switched to `luxe` (confirmed via the served `data-theme`
attribute), each of the four UI-SPEC-located sites was inspected two ways: (1) live, in the
running app, wherever a real trigger exists in this environment (the cart drawer and mobile nav
Sheet, both reachable with no auth; the category hero, reachable but without a real photo behind
it in the local fixture); and (2) via a live-DOM compositing check — injecting the exact same
Tailwind class (`bg-surface/NN`) over a realistic photographic gradient on an actual page load (so
the real compiled CSS custom properties resolve exactly as production would), for the two sites
this environment cannot reach with a real trigger (`Dialog`'s `OrderConfirmationModal`, gated
behind a completed Stripe checkout that fails locally; `AlertDialog`, used only inside the admin
tree, which requires a Clerk session unavailable here). The `SheetOverlay` finding was additionally
confirmed by reading its live computed style with the cart drawer open under `luxe`:
`background-color: oklab(0.970797 0.000856102 0.0085628 / 0.5)` — `--store-surface` at 50% alpha,
confirming the overlay renders exactly as specified but is visually indistinguishable from the
page behind it.

### Findings

| # | Site | File:line | Class in play | What it looks like under `luxe` | Judgement | Reason |
|---|---|---|---|---|---|---|
| F1 | Dialog backdrop | `components/ui/dialog.tsx:106` | `bg-surface/80` | Near-invisible near-white wash over a photographic backdrop (verified via live-DOM injection test, `.screenshots/scrim-inspect-luxe.png` vs. `.screenshots/scrim-inspect-volt-dark.png`: the volt-dark cell darkens the same gradient to near-black; the luxe cell barely tints it) | **Changed** | This backdrop's entire purpose is to obscure the full page behind a centered modal. At 80% opacity — the strongest of the three overlay classes — a near-white value over an already-light page produces essentially no visible separation, the clearest failure of the three. |
| F2 | AlertDialog backdrop | `components/ui/alert-dialog.tsx:39` | `bg-surface/50` | Same underlying token and mechanism as `SheetOverlay` below (byte-identical class before this fix); not independently live-triggerable in this environment (admin-only, no Clerk session — same limitation WINDOWS #2 already records for 06-04) | **Changed** | Applied the same fix as `SheetOverlay` (F3) for consistency: both call sites shared the identical `bg-surface/50` class and the identical composited-color mechanism, so the live evidence gathered for the Sheet overlay applies here directly — this is a case-by-case fix scoped to the two sites that shared this exact class, not a blanket rule change. |
| F3 | Sheet backdrop (cart drawer, mobile nav) | `components/ui/sheet.tsx:128` | `bg-surface/50` | Live-verified: with the cart drawer open under `luxe`, the overlay's computed background was `--store-surface` at 50% alpha (near-white) and the home page visible behind it showed no discernible dimming — compare `.screenshots/phase-06-05-luxe/cart__1280__cart-open.png` (before) against `.screenshots/phase-06-05-luxe-postfix/cart__1280__cart-open.png` (after) | **Changed** | Same failure class as F1: the backdrop's job is to visually separate the drawer/menu from the page behind it, and a near-white-on-near-white overlay does not do that. The drawer panel itself (`bg-surface-inverse`) already correctly inverts to dark under `luxe` — only the full-viewport backdrop scrim behind it was wrong. |
| F4 | Category hero image overlay | `app/category/[slug]/page.tsx:133` | `bg-surface/40` | Live-DOM injection test reproducing the real markup (`text-foreground` heading/description over a photographic gradient at 40% opacity, no shadow): `.screenshots/scrim-category-hero-luxe.png`. Black heading/body text stayed clearly legible across the whole gradient; the overlay read as a soft, natural lightening of the photo rather than an unintended light haze obscuring it. The local D1 fixture's category has no real image configured, so a live in-app capture with a real photo was not possible this session — the injection test is the closest available substitute, using the component's actual classes and text styling. | **Accepted as-is** | This site's job is different from the other three: it is a permanent background treatment providing contrast for overlaid heading text, not a modal-separation backdrop that must fully obscure content behind a floating panel. At 40% — the weakest of the three overlay opacities — and paired with `text-foreground` (black under `luxe`, already high-contrast against the photo independent of the overlay's own direction), the site did not exhibit the same failure the other three did. Per D-04's "polarity-neutral" framing and the plan's own instruction to fix only what genuinely reads wrong, this is left as a real, deliberate "accept" rather than folded into the same fix as F1–F3 for the sake of consistency alone. Carried forward: this judgement rests on a synthetic reproduction, not a live photo in this fixture — worth a real look once a category has a configured image. |

**A QA pass whose record contains only changes is a pass that did not consider leaving things
alone** — F4 is that record's one deliberate "accept," and it stands on the same evidentiary
footing as the three changes (a controlled compositing test against the real compiled CSS and the
real component markup), not a default or an omission.

### Change register (before / after)

| Site | File | Before | After | Reason | Mechanism |
|---|---|---|---|---|---|
| Dialog backdrop | `components/ui/dialog.tsx` | `bg-surface/80` | `bg-black/80` | F1 — token-driven scrim inherited light-preset polarity, reading as a near-invisible wash instead of a full-page-obscuring backdrop | `gsd:scan-ignore-start`/`-end` sentinel around the literal, with a written reason in the surrounding comment (scanner's existing exception mechanism, `scripts/scan-hardcoded-colors.mjs`) |
| AlertDialog backdrop | `components/ui/alert-dialog.tsx` | `bg-surface/50` | `bg-black/50` | F2 — identical class/mechanism to the Sheet backdrop fix | Same sentinel mechanism |
| Sheet backdrop | `components/ui/sheet.tsx` | `bg-surface/50` | `bg-black/50` | F3 — live-verified near-zero visible dimming under `luxe` | Same sentinel mechanism |
| Category hero overlay | `app/category/[slug]/page.tsx` | `bg-surface/40` | *(unchanged)* | F4 — accepted as-is; see Findings table | n/a |

No new `--store-*` token was added to satisfy any of these three fixes, and no shared/blanket
overlay class was introduced — each fix is a literal value scoped to the one primitive's own
overlay declaration, per D-03/D-04's explicit prohibitions. Post-fix gates: `mise exec -- npm run
scan:tokens` → 0 violations (sentinel-excluded, same 2 manual-review rows); `for f in themes/*.css`
token-count check → 23 for every shipped theme; `mise exec -- node scripts/build-themes.mjs
--check` → fresh; `mise exec -- npm run lint` → 0 errors (52 pre-existing warnings, unchanged);
`mise exec -- npm run typecheck` → clean; `mise exec -- npm test` → 248 files / 1932 tests, all
green.

### Newly-inverted surfaces re-checked under `luxe`

- **Drawer edges (`border-border-inverse`).** `themes/luxe.css` declares its own
  `--store-border-inverse: #2b221a` (a dark warm brown), independently authored for luxe's own
  dark inverse panel — not a value shared across themes. The Phase 5 carry-over note ("the shared
  border token serving both drawer edges and email dividers") is about `volt-dark`'s own single
  `border-inverse` value serving two consumers *within that one theme*; it is unaffected by luxe
  or midnight existing, since each theme declares its own independent value. Re-checked and
  confirmed no cross-theme leakage: `.screenshots/phase-06-05-luxe-postfix/cart__1280__cart-open.png`
  shows the cart drawer's dark panel with a visible dark divider against the (now correctly
  darkened) page behind it. The original Phase 5 question — whether `volt-dark`'s one value
  serving both consumers reads badly — is unchanged by this plan and remains open for whoever
  next touches email templates or drawer borders (still carried forward, not resolved here).
- **Stripe host panel.** Per the Phase 5 decision log, `SubscriptionAcquisitionPanel.tsx`'s Stripe
  setup host wrapper deliberately uses the **main** token set (`bg-surface-elevated`/
  `text-foreground`), not the inverse set — so under `luxe` it renders as part of the normal light
  page, not as a newly-inverted dark panel. Confirmed by reading the file: no inverse-token class
  present. Not a scrim site, no finding to register.
- **Mobile nav Sheet at 390px.** Per the existing coverage note carried from Phase 5, the 390px
  `nav-open` state's Sheet is full-width and covers the entire viewport, so there is no visible
  page content behind it to judge a backdrop against at that viewport — expected, not a gap. The
  1280px cart-drawer capture (F3 above) is where the backdrop is actually visible and was judged.

### Cross-check: anything else read as a dark-tuned leftover under `luxe`?

Beyond the four UI-SPEC-located sites, the full route-grid captures from Task 1
(`phase-06-05-luxe`) and the post-fix re-capture (`phase-06-05-luxe-postfix`) were reviewed for
any other surface that reads wrong under the light preset. Home, category, product, checkout, and
account pages all rendered with correct light-preset polarity (ivory surfaces, black foreground
text, gold accent, dark inverse cart drawer) — no additional dark-tuned leftover was found beyond
the three fixed scrim sites. One pre-existing, out-of-scope observation carried forward rather
than fixed here: the category page's hero image slot renders a broken-image icon in this
environment because the local D1 fixture's one category has no configured image URL — unrelated
to theming, a data-fixture gap, not a token or polarity issue (see the category hero row's own
carried-forward note above for the QA implication).

---

## Task 3: Phase-close evidence roll-up

Phase 6's four ROADMAP success criteria, each quoted, with the named evidence and the command or
label that produced it. Requirements: THEME-01, THEME-02, THEME-03, THEME-04.

### Criterion 1 (THEME-01) — evidence

> *"Running the real deploy build (`build:worker`) against a deliberately broken theme file fails
> the build, and `predev` runs the same scan."*

TRUE. Evidenced by plan 06-01's deploy-gate run: deleting `--store-primary` from
`themes/volt-dark.css` and running `npm run build:worker` exited non-zero, the captured log
ending at `[build-themes] ABORT: 1 error(s).` with zero output from the Cloudflare builder
(`opennextjs-cloudflare build`) — confirmed two ways in 06-01-SUMMARY.md (the raw log's early
termination, and a `--silent` re-run removing npm's own script-echo preamble so the absence of
builder output is unambiguous). `predev` runs the identical validator (`node
scripts/build-themes.mjs`) before `db-local-ensure.mjs`, per `package.json`. Re-confirmed fresh
at phase close: `mise exec -- node scripts/build-themes.mjs --check` → `[build-themes] check
passed — generated output for 3 theme(s) is fresh.`

### Criterion 2 (THEME-02) — evidence

> *"`getActiveTheme()` resolves `admin_settings` → `NEXT_PUBLIC_THEME_DEFAULT` env → manifest
> default, blocking server-side in the root layout (no FOUC, no Suspense, no isolate cache); an
> unknown stored theme name falls back and emits a telemetry event present in both
> `commerce.telemetry.v1` parity files."*

TRUE. Evidenced by plan 06-02: `tests/unit/lib/themes/active-theme.test.ts` (15 tests) covers
every row of the fallback chain (D1 present/absent/empty/invalid, env valid/invalid, manifest
default) and asserts `theme.unknown_selection` fires exactly once, with no stored string leaked
into any telemetry field. `app/layout.tsx`'s `RootLayout` is an `async function` that `await`s
`getActiveTheme()` directly in the body, never behind either of the file's two `<Suspense>`
boundaries and never isolate-cached (no module-scope state in `lib/themes/active-theme.ts`,
confirmed by its own file-header comment and this plan's re-read of the file in Task 2's
`<read_first>`). `theme.unknown_selection` is registered in `TELEMETRY_EVENTS`
(`lib/observability/telemetry.ts`) and proven structurally absent from the tail Worker's
critical-only list in `tests/unit/workers/observability-tail-core.test.ts`. Served-HTML probe:
`curl http://localhost:3000/` showed `data-theme="volt-dark"` on first load in this session
(Task 1), confirming the blocking server-side stamp with no FOUC-enabling client branch.

### Criterion 3 (THEME-03) — evidence

> *"Admin's Appearance section shows manifest-driven swatch-preview cards for every shipped
> theme, indicates the active one, and saves a selection through the existing `admin_settings`
> API pattern."*

TRUE. Evidenced by plan 06-04: `components/admin/ThemePresetGrid.tsx` renders one card per
`THEME_MANIFEST` entry with no hardcoded card-count literal (pinned by
`tests/unit/app/admin-appearance-source.test.ts`, 8 tests), an Active badge driven by the loaded
saved value, and a Save flow posting through the existing `POST /api/admin/settings` endpoint
using the imported `APPEARANCE_SETTINGS_CATEGORY`/`APPEARANCE_THEME_SETTING_KEY` constants — no
new API route. 06-04's own end-to-end proof (`x-dev-admin` dev-bypass header, since no Clerk
session exists in this environment) posted `appearance.theme=midnight` and confirmed the
storefront's `data-theme` attribute flipped with no restart. This plan's own Task 1 captures used
the identical mechanism three more times (`volt-dark` → `midnight` → `luxe` → restored to
`volt-dark`), re-confirming the save path still works at phase close. The human-observable
click/ring/badge/toast/keyboard walkthrough remains unrun in this environment (no Clerk session)
— tracked as WINDOWS #2, carried forward below, not re-attempted here since nothing in this
plan's scope changes that constraint.

### Criterion 4 (THEME-04) — evidence

> *"2-3 preset themes ship, at least one light; the light preset's shadows and overlays read
> correctly rather than as dark-tuned leftovers."*

TRUE, with three narrow fixes required to make it true. Evidenced by plan 06-03's per-file
assertions (`themes/midnight.css`, `themes/luxe.css`, both 23-token pure data files passing the
validator unmodified) and this plan's own findings table (Task 2): all four UI-SPEC-located
scrim sites were inspected under `luxe` against a real dark-preset baseline captured in the same
session (Task 1). Two of the four read genuinely wrong (`Dialog`'s and `Sheet`'s/`AlertDialog`'s
`bg-surface/NN` overlays composited to a near-invisible near-white wash instead of a scrim) and
were fixed to a literal, sentinel-wrapped dark value; the fourth (`app/category/[slug]/page.tsx`
hero overlay) was inspected and accepted as-is with a written reason. **Answering the plan's own
required one-sentence summary: the acid test did expose dark-tuned leftovers — three of the four
inspected sites (`Dialog`, `Sheet`, `AlertDialog`) shared one `bg-surface/NN` overlay pattern
whose polarity assumption broke under the light preset, all three fixed the same way.**

### Full green build (re-run at phase close)

```
$ mise exec -- node scripts/build-themes.mjs --check
[build-themes] check passed — generated output for 3 theme(s) is fresh.
$ mise exec -- npm run scan:tokens
MANUAL-REVIEW  lib/utils/image-placeholders.ts  — ...
MANUAL-REVIEW  lib/types/mach/Promotion.ts  — ...
[scan-tokens] 0 violations
$ mise exec -- npm run lint        # 0 errors, 52 pre-existing warnings (unchanged since Phase 5 close)
$ mise exec -- npm run typecheck   # clean
$ mise exec -- npm test            # 248 test files / 1932 tests, all green
$ mise exec -- npm run build       # exit 0, "Compiled successfully"
```

### Carried forward

Items this phase either closed or is handing to the next phase, each with why it is still open
and where it should be picked up:

| Item | Status | Where to pick up |
|---|---|---|
| Phase 5 screenshot coverage gaps: `order-status` (no seeded order), Stripe payment step (payment-intent 400 locally), authenticated account dashboard (no Clerk session), review-form error state | Still open — every capture run this phase (Task 1's three labels, the post-fix re-capture) hit the same four missing cells for the same environmental reasons | Phase 8's visual QA close-out; needs a seeded order and a Clerk session in whatever environment runs it |
| `border-inverse`'s dual role within `volt-dark` (drawer edges + email dividers share one value) | Still open — re-checked under `luxe` this plan (Task 2) and confirmed unaffected: `luxe` and `midnight` each declare their own independent `border-inverse` value, so this is purely a `volt-dark`-internal question, not a cross-theme leak | Whoever next touches email templates or drawer borders; a token split is the likely resolution if the darker email divider (Phase 5 S10) reads badly |
| Dropped direction-doc properties (`shadow`, `border-width`, `image-aspect`, `accent-2`, `font-mono`, `letter-spacing`) not expressible in the frozen 23-token contract | Backlog, not blocking | `.planning/todos/pending/theme-contract-dropped-properties.md` (written in plan 06-03) |
| `NEXT_PUBLIC_THEME_DEFAULT` env-default-invalid case emits no telemetry (only a *stored* unknown value does, per D-12's literal wording) | Flagged planner decision from plan 06-02, not resolved either way | Revisit if deploy-time misconfiguration turns out to need its own signal |
| `font-display` (Cormorant Garamond) fully wired end-to-end but applied by no component — `luxe`'s serif headings do not currently render anywhere | Still open (WINDOWS #1) | A future component-wiring task, or Phase 8's QA pass; this plan's Task 1/2 captures confirm the gap is unchanged (no heading in any captured cell renders serif) |
| Task 3 (06-04) human-observable admin walkthrough (click a card, ring vs. badge, toast, keyboard radiogroup) never run — no Clerk session in this environment | Still open (WINDOWS #2) | Whoever next has a real Clerk-authenticated browser session against this environment |
| `GET /api/admin/settings?category=X` inserts the full `defaultSettings` array (every category) when the filtered result is empty, not scoped to `X` — a latent bug in shared, unmodified code | Still open (WINDOWS #3) | A real fix scoping the insert to the requested category, before a genuinely fresh install exercises the Appearance page |
| **Human action required:** `NEXT_PUBLIC_THEME_DEFAULT` Workers Build variable | Still outstanding — flagged in plan 06-02's `user_setup`, no evidence in this session or `STATE.md`'s Blockers/Concerns that it was completed | Cloudflare Dashboard → Workers & Pages → the Voltique Worker → Settings → Build → Variables and Secrets. RESEARCH Pitfall 7 notes this may already be redundant given `scripts/build-with-public-env.mjs`'s auto-injection of every `wrangler.jsonc` `NEXT_PUBLIC_*` var into `build:worker`, but the safer default (both the wrangler var, already done, and the dashboard variable) was followed as written |

Category-hero overlay's judgement (Task 2, F4) rests on a synthetic reproduction rather than a
live photo, since the local D1 fixture's one category has no configured image — carried forward
above as part of the light-preset findings, worth a real look once a category has a real image.

No cell in this record is marked covered without either a captured hash or an explicitly named
substitute-evidence trail, matching the convention `05-SCREENSHOTS.md`'s own phase-close record
established.
