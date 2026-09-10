---
phase: 09-gift-card-catalogue
plan: 01
subsystem: catalogue
tags: [d1, seed-data, gift-card, sql, vitest]

requires: []
provides:
  - "prod_33 (Voltique Gift Card), variant_33..36 ($25/$50/$100/$200), price_33 seeded into data/d1/seed.sql inside a sentinel-delimited, replay-safe INSERT OR IGNORE block"
  - "A vitest guard test pinning the block's sentinels, statement count, ids, tax code, inventory shape, prices, image path, rating and related_products"
  - "Proof that /product/gift-card renders 200 with the product name and $25.00 on a local dev server, with zero changes to app/ or components/"
affects: [09-02, 09-03, 09-04]

actuals:
  tokens: 2924
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Sentinel-delimited INSERT OR IGNORE block appended to a non-idempotent seed.sql, extracted at apply time with sed for idempotent local/production application"
    - "Guard test reads seed.sql off disk, slices between named sentinel comments, and asserts only on the slice (mirrors tests/unit/scripts/dev-seed-guard.test.ts)"

key-files:
  created:
    - tests/unit/data/seed-gift-card.test.ts
  modified:
    - data/d1/seed.sql

key-decisions:
  - "Used prod_33/variant_33..36/price_33 per Research Finding 1 (prod_31/prod_32 already occupy the ids CONTEXT.md assumed were free)"
  - "Used txcd_00000000 (Stripe's unconditional Nontaxable code) per Research Finding 2, not the topically-named but conditional txcd_10502000"
  - "No pricing-table apostrophe/em-dash pitfall left in place -- found and fixed a missing closing SQL quote and a literal '--' inside a string literal that both broke SQL parsing before the scratch-D1 apply ever ran"
  - "Skipped the standalone inventory table for the four variants per Research Finding 4 (nothing in app/ or components/ reads it)"

patterns-established:
  - "Modern JSON-shaped seed columns (matching variant_31/variant_32), never the legacy bare-number shape used by variant_1..30"

requirements-completed: [CAT-01, CAT-02]

coverage:
  - id: D1
    description: "prod_33 + variant_33..36 + price_33 seeded as a sentinel-delimited INSERT OR IGNORE block in data/d1/seed.sql, applying cleanly to a fresh scratch D1 and replaying against an already-seeded one with no error"
    requirement: "CAT-01"
    verification:
      - kind: integration
        ref: "wrangler d1 migrations apply + wrangler d1 execute --file data/d1/seed.sql against /tmp/gsd-09-scratch-d1, then re-applying the extracted block"
        status: pass
      - kind: integration
        ref: "SELECT read-back: p=1, v=4, pr=1, untracked=4, amounts=2500,5000,10000,20000; products row reads gift_card/digital/txcd_00000000/active"
        status: pass
    human_judgment: false
  - id: D2
    description: "tests/unit/data/seed-gift-card.test.ts pins sentinels, statement count, ids, tax code (re-checked against the checkout regex), inventory shape, prices, image path, rating, and related_products"
    requirement: "CAT-01"
    verification:
      - kind: unit
        ref: "tests/unit/data/seed-gift-card.test.ts (9 tests)"
        status: pass
      - kind: unit
        ref: "mise exec -- npm test (268 files / 2203 tests, no regressions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "/product/gift-card returns HTTP 200 with 'Voltique Gift Card' and '25.00' in the SSR HTML on a local dev server, with zero changes under app/ or components/"
    requirement: "CAT-02"
    verification:
      - kind: integration
        ref: "curl http://localhost:3000/product/gift-card against mise exec -- npm run dev, saved to /tmp/gsd-09-pdp.html"
        status: pass
      - kind: other
        ref: "git status --porcelain migrations/ lib/gift-cards/ app/ components/ (empty)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-08
status: complete
---

# Phase 9 Plan 01: Gift Card Catalogue Tracer Summary

**Seeded the Voltique Gift Card (prod_33, four denomination variants, one pricing row) into `data/d1/seed.sql` as an idempotent, sentinel-delimited block, and proved `/product/gift-card` renders it end to end on a local dev server with zero storefront code changes.**

## Performance
- **Duration:** 20 min
- **Started:** 2026-09-08T07:29:00Z (approx)
- **Completed:** 2026-09-08T07:43:57Z
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- Appended a sentinel-delimited (`-- BEGIN gift-card-block (Phase 9)` / `-- END gift-card-block (Phase 9)`) `INSERT OR IGNORE` block to `data/d1/seed.sql` defining `prod_33` (type `gift_card`, fulfillment_type `digital`), four variants `variant_33..36` at 2500/5000/10000/20000 minor units with untracked inventory, and a `price_33` pricing row.
- Proved the block end to end: applied to a fresh scratch D1, read back every value from the acceptance criteria, replayed the extracted slice against the already-seeded scratch DB with no error and no duplicate rows, applied to the local dev D1, and confirmed `GET /product/gift-card` returns 200 with `Voltique Gift Card` and `25.00` in the SSR HTML.
- Wrote `tests/unit/data/seed-gift-card.test.ts`, a 9-assertion guard test that reads `seed.sql` off disk, slices between the sentinels, and pins sentinel uniqueness, statement count, ids, the checkout tax-code regex, inventory shape, prices, image path, and the `rating`/`related_products` shape.
- Confirmed the guard test's sensitivity with a mutation spot-check: temporarily corrupted the seeded tax code to an invalid `txcd_` value, watched the tax-code assertion fail (4 codes found vs. the expected 5), then reverted and confirmed all 9 tests pass again.
- Ran `mise exec -- npm test` (268 files / 2203 tests), `npm run lint`, and `npm run typecheck` — all green, no regressions.

## Task Commits
1. **Task 1: End-to-end "a shopper can open /product/gift-card"** - `5d295d5` (feat)
2. **Task 2: Pin the seed block's shape with a tracked guard test** - `9695b19` (test)

## Files Created/Modified
- `data/d1/seed.sql` - appended the sentinel-delimited gift-card `INSERT OR IGNORE` block (products, product_variants, pricing)
- `tests/unit/data/seed-gift-card.test.ts` - guard test pinning the block's shape

## Decisions Made
- **prod_33, not prod_31.** Research verified `prod_31`/`prod_32` were already taken by a same-week commit; used the next free id sequence per Research Finding 1.
- **txcd_00000000, not txcd_10502000.** Stripe's dedicated "Gift Card" tax code is jurisdiction-conditional; the unconditional "Nontaxable" code is what D-09 actually requires (Research Finding 2).
- **No standalone `inventory` table rows.** Research Finding 4 verified nothing under `app/` or `components/` reads that table for these queries; the four variants rely solely on `product_variants.inventory` with `track_inventory: false`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a missing closing SQL string quote and a literal `--` inside a string literal, both of which broke SQL parsing**
- **Found during:** Task 1, first scratch-D1 apply attempt
- **Issue:** The hand-authored `INSERT OR IGNORE INTO products` statement (a) used an em-dash-style `--` inside the description text (`"$200 -- it's not redeemable..."`), which some SQL tokenizers (including `sqlite3`'s and `wrangler`'s) treat as a comment start even inside a quoted string in certain code paths, and (b) was missing the closing `'` after the `extensions` JSON object's `'{"ai_notes": ...}'` literal, which caused every subsequent quote to be mis-paired and the statement to fail with `near "gift_card": syntax error`.
- **Fix:** Rewrote the `--` as a period (`"$200. It's not redeemable..."`) and added the missing closing quote after the `extensions` field.
- **Files modified:** `data/d1/seed.sql`
- **Verification:** Wrote a standalone quote-balance scanner and re-ran the block against a bare `sqlite3` schema before re-attempting the real `wrangler d1 execute`; both passed cleanly afterward.
- **Commit:** `5d295d5` (fixed before the task's own commit; no separate commit needed)

**Total deviations:** 1 auto-fixed (Rule 1, SQL syntax bug caught by the plan's own scratch-D1 verify step before any commit). **Impact:** none — caught and fixed within Task 1 before its acceptance criteria were checked; no downstream effect on Task 2 or later plans.

## Issues Encountered
None beyond the deviation above, which the plan's own verification step was designed to catch.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

Ready for 09-02 (test coverage on `isInventoryAvailable`/`isGiftCardOrderLine`/serializer using this exact seed shape), 09-03 (image generation targeting `products/gift-card-33.png`, the path already seeded), and 09-04 (production apply of the same sentinel-delimited block via `sed` extraction, and the `docs/DEPLOYMENT_SETUP.md` path correction). No blockers.

## TDD Gate Compliance

Task 2 is a guard test written against data (`data/d1/seed.sql`) that Task 1 already implemented and committed in this same plan — there is no separate "feat" implementation step for Task 2, so the canonical `test → feat → refactor` commit triple does not apply verbatim. Per the plan's own acceptance criteria ("Temporarily changing the seeded tax code... makes the run fail, spot-checked by the executor, then reverted"), RED evidence was produced via mutation testing instead of a pre-implementation failing test: the tax code was corrupted, the run failed as expected (`RED_EVIDENCE_OK`-equivalent: 4 valid codes found vs. the required 5), then reverted and re-verified GREEN. Single commit `9695b19` (`test(09-01): ...`) carries the guard test; `git diff --stat data/d1/seed.sql` was empty immediately before that commit, confirming the mutation was fully reverted and no production data changed as a side effect of writing the test.

## Self-Check: PASSED

- `data/d1/seed.sql` — FOUND (modified, sentinel block present)
- `tests/unit/data/seed-gift-card.test.ts` — FOUND
- `git log --oneline --all | grep 5d295d5` — FOUND
- `git log --oneline --all | grep 9695b19` — FOUND
- `mise exec -- npx vitest run tests/unit/data/seed-gift-card.test.ts` — 9/9 passed
- `mise exec -- npm test` — 268 files / 2203 tests passed
- `mise exec -- npm run lint` — 0 errors
- `mise exec -- npm run typecheck` — clean
- `git status --porcelain migrations/ lib/gift-cards/ app/ components/` — empty

---
*Phase: 09-gift-card-catalogue*
*Completed: 2026-09-08*
