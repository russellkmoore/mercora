---
phase: 09-gift-card-catalogue
plan: 04
subsystem: catalogue
tags: [d1, production, deploy-runbook, gift-card]

requires:
  - phase: 09-01
    provides: "Sentinel-delimited, replay-safe gift-card INSERT OR IGNORE block in data/d1/seed.sql, already proven against a scratch D1 and a local dev server"
  - phase: 09-02
    provides: "Coverage proving inventory/checkout/serializer code correctly treats gift-card lines as untracked and skip-eligible"
  - phase: 09-03
    provides: "Public product image at voltique-images.russellkmoore.me/products/gift-card-33.png"
provides:
  - "Production mercora-db holds prod_33, variant_33..36 and price_33, live and active"
  - "docs/DEPLOYMENT_SETUP.md Step 2 names the real seed path and documents the sliced production-apply recipe"
  - ".planning/phases/09-gift-card-catalogue/09-VALIDATION.md filled from commands that actually ran"
affects: [10, 11, 12]

actuals:
  tokens: 1200
  tasks: 3
  commits: 1
  plan_head_before: 648144f435ea12c8952e8e417a41b25ede8e6bdb

tech-stack:
  added: []
  patterns:
    - "sed slice between named sentinel comments as the only sanctioned path for a single-block production D1 write outside the migration runner"

key-files:
  created: []
  modified:
    - docs/DEPLOYMENT_SETUP.md
    - .planning/phases/09-gift-card-catalogue/09-VALIDATION.md

key-decisions:
  - "apply-active: Russell chose to write the gift card into production now, seeded active, over apply-draft or hold — Phase 9 closes provably against the real site and Phase 10 has a live product to build the recipient form against, accepting that a shopper can add it to cart and hit a checkout refusal until Phase 10 ships"

patterns-established:
  - "A single-block, sentinel-delimited catalogue addition applies to production via sed extraction + wrangler d1 execute --remote --file, never a whole-file remote apply"

requirements-completed: [CAT-01, CAT-02, CAT-03]

coverage:
  - id: D1
    description: "docs/DEPLOYMENT_SETUP.md Step 2 names data/d1/seed.sql with an explicit --local target and documents the sentinel-slice production-apply recipe; docs:lint passes"
    requirement: "CAT-01"
    verification:
      - kind: other
        ref: "mise exec -- npm run docs:lint -> 0 violations; grep -c data/d1/seed.sql -> 4; grep -c lib/db/seed.sql -> 0; grep -c gift-card-block -> 3"
        status: pass
    human_judgment: false
  - id: D2
    description: "09-VALIDATION.md filled from what actually ran across plans 09-01..09-04, no skeleton placeholder left, per-task table has 9 rows"
    requirement: "CAT-01"
    verification:
      - kind: other
        ref: "grep -c brace-placeholder .planning/phases/09-gift-card-catalogue/09-VALIDATION.md -> 0; per-task rows -> 9"
        status: pass
    human_judgment: false
  - id: D3
    description: "The gift-card sentinel block, sliced fresh from data/d1/seed.sql, applied cleanly to production mercora-db as three INSERT OR IGNORE statements with no constraint error"
    requirement: "CAT-01"
    verification:
      - kind: integration
        ref: "mise exec -- npx wrangler d1 execute mercora-db --remote --file /tmp/gsd-09-gift-card-apply.sql -y -> 3 queries executed, 8 rows read, 52 rows written, success true"
        status: pass
    human_judgment: false
  - id: D4
    description: "Production read-back of prod_33 and its four variants matches the 09-01 scratch read-back value for value: p=1, v=4, pr=4, amounts=2500,5000,10000,20000, product row gift_card/digital/txcd_00000000/active"
    requirement: "CAT-01"
    verification:
      - kind: integration
        ref: "wrangler d1 execute mercora-db --remote --json SELECT id,type,fulfillment_type,tax_category,status FROM products WHERE id='prod_33' -> gift_card/digital/txcd_00000000/active; aggregate SELECT -> p=1,v=4,pr=4,amounts=2500,5000,10000,20000"
        status: pass
    human_judgment: false
  - id: D5
    description: "The live product page returns 200 with the product name and default denomination price; the public image URL returns 200"
    requirement: "CAT-02"
    verification:
      - kind: e2e
        ref: "curl https://voltique.russellkmoore.me/product/gift-card -> 200, body contains 'Voltique Gift Card' and '25.00'; curl -I https://voltique-images.russellkmoore.me/products/gift-card-33.png -> 200 image/jpeg"
        status: pass
    human_judgment: false
  - id: D6
    description: "The live Featured category page lists the gift card"
    requirement: "CAT-02"
    verification:
      - kind: other
        ref: "curl https://voltique.russellkmoore.me/category/featured -> 200, body contains gift-card"
        status: pass
    human_judgment: false
  - id: D7
    description: "No migration file, no deploy, and no source file under lib/, app/, components/ or migrations/ was touched by this plan"
    requirement: "CAT-01"
    verification:
      - kind: other
        ref: "git status --porcelain migrations/ lib/ app/ components/ -> empty, both after Task 1 and after Task 3"
        status: pass
    human_judgment: false
  - id: D8
    description: "Full CI-mirroring gate suite green: docs:lint, lint, typecheck, unit tests"
    requirement: "CAT-01"
    verification:
      - kind: other
        ref: "npm run docs:lint 0 violations; npm run lint 0 errors (52 pre-existing unrelated warnings); npm run typecheck clean; npm test 269 files / 2219 tests passed"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-08
status: complete
---

# Phase 9 Plan 04: Production Apply and Deploy-Runbook Correction Summary

**Corrected the seed-path typo and documented the sentinel-slice apply recipe in the deploy runbook, filled the phase validation record, then applied the gift-card block to production D1 as active and proved it live on the real site.**

## Performance
- **Duration:** ~15 min this continuation (Tasks 1-2 ran ~5 min in the prior agent before this checkpoint resume)
- **Started:** 2026-09-08 (continuation resume)
- **Completed:** 2026-09-08T08:43:01Z
- **Tasks:** 3
- **Files modified:** 2 (docs/DEPLOYMENT_SETUP.md, .planning/phases/09-gift-card-catalogue/09-VALIDATION.md — both in Task 1; Task 3 wrote no file since the seed row already carried `status='active'`)

## Accomplishments
- Fixed `docs/DEPLOYMENT_SETUP.md` Step 2 to name the real seed file `data/d1/seed.sql` with an explicit `--local` target, and added a subsection documenting the sentinel-slice production-apply recipe (`sed` extraction between the two named sentinel lines, then `wrangler d1 execute --remote --file` against the slice only, never the whole file).
- Filled `.planning/phases/09-gift-card-catalogue/09-VALIDATION.md` from the commands that actually ran across plans 09-01 through 09-04, closing the Wave 0 gaps Research listed and updating the front-matter status/compliance flag.
- Regenerated `/tmp/gsd-09-gift-card-apply.sql` fresh from the committed `data/d1/seed.sql` sentinel block and confirmed the guard (non-empty, exactly 3 `INSERT OR IGNORE` statements, strictly shorter than the whole seed file) before running anything remote.
- Applied the block once to production `mercora-db` via `wrangler d1 execute --remote --file`: 3 queries executed, 8 rows read, 52 rows written, no constraint error.
- Read production back and confirmed every value matches the 09-01 scratch read-back exactly: `prod_33` reads `gift_card`/`digital`/`txcd_00000000`/`active` with `cat_1` in categories; 4 variants at 2500/5000/10000/20000 minor units, all `txcd_00000000`, all untracked inventory.
- Confirmed the live site: `https://voltique.russellkmoore.me/product/gift-card` returns 200 with `Voltique Gift Card` and `25.00` in the body; the public image `products/gift-card-33.png` returns 200 (`image/jpeg`, 384813 bytes); the live Featured category page already lists the gift card (no cache staleness observed).
- Ran the full CI-mirroring subset: `docs:lint` (0 violations), `lint` (0 errors, 52 pre-existing unrelated warnings), `typecheck` (clean), `npm test` (269 files / 2219 tests, all passing).

## Task Commits
1. **Task 1: Correct the seed step in the deploy runbook and fill the validation record** - `67f3e5b` (docs) — completed in the prior agent before this checkpoint
2. **Task 2: Confirm the production catalogue write** - checkpoint:decision, no commit (Russell answered `apply-active`)
3. **Task 3: Apply the block to production and prove the gift card is live** - no commit; production data write only, no file under version control changed (the seed row already carried `status='active'` from plan 09-01, so no edit to `data/d1/seed.sql` was needed before slicing)

## Files Created/Modified
- `docs/DEPLOYMENT_SETUP.md` - Step 2 corrected to the real seed path with explicit target flag; sentinel-slice production-apply recipe documented (Task 1)
- `.planning/phases/09-gift-card-catalogue/09-VALIDATION.md` - filled from real commands, no skeleton placeholder left (Task 1)

## Production Read-Back (Task 3)

```
SELECT id, type, fulfillment_type, tax_category, status FROM products WHERE id='prod_33';
-> {"id":"prod_33","type":"gift_card","fulfillment_type":"digital","tax_category":"txcd_00000000","status":"active"}

Aggregate check:
-> {"p":1,"v":4,"amounts":"2500,5000,10000,20000","pr":4}
```

All values match the plan 09-01 scratch read-back exactly.

## Live-Site Proof (Task 3)

| Check | Result |
|---|---|
| `curl https://voltique.russellkmoore.me/product/gift-card` | HTTP 200; body contains `Voltique Gift Card` and `25.00` |
| `curl -I https://voltique-images.russellkmoore.me/products/gift-card-33.png` | HTTP 200, `content-type: image/jpeg`, `content-length: 384813` |
| `curl https://voltique.russellkmoore.me/category/featured` | HTTP 200; body contains the gift card (backstop truth confirmed, no stale-cache retry needed) |

## Decisions Made
- **apply-active.** Russell's answer to Task 2's checkpoint: write the gift card into production now, seeded `active`, rather than `apply-draft` or `hold`. Rationale recorded in the plan: Phase 9 closes provably against the real site, the card renders on `/product/gift-card` and in the Featured grid immediately, and Phase 10 has a live product to build the recipient form against — accepting that a shopper who adds it to cart hits the existing pricing guard's checkout refusal (recipient customization required) until Phase 10 ships.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed two pre-existing dead links to `08-QA-MATRIX.md`** (carried forward from Task 1, prior agent)
- **Found during:** Task 1, `docs:lint` run
- **Issue:** Two stale relative links in docs pointed at a retired `08-QA-MATRIX.md` path, unrelated to this plan's own edits but blocking `docs:lint` from passing.
- **Fix:** Corrected both links to their current target.
- **Files modified:** `docs/theming.md`
- **Commit:** `67f3e5b`

**Total deviations:** 1 auto-fixed (Rule 1, carried in Task 1's commit). **Impact:** none — `docs:lint` now passes cleanly and no other file was touched.

## Issues Encountered
None. The production apply, read-back, and live-site checks all passed on the first attempt with no constraint errors and no cache staleness.

## User Setup Required
None — the checkpoint decision (`apply-active`) was the only human input this plan required, and it has been answered and recorded above.

## Next Phase Readiness

Phase 9 (Gift Card Catalogue) is complete: CAT-01, CAT-02, and CAT-03 are all closed against the live production site. Phase 10 (storefront recipient/cart/checkout UI) can build against a real, live `prod_33` gift-card product. D-12's accepted interim (checkout refusal until the recipient form ships) remains true until Phase 10 lands.

## TDD Gate Compliance

Not applicable — this plan's tasks are documentation correction, a decision checkpoint, and a production data apply with read-back verification, not behavior-adding code (`tdd` frontmatter attribute not set on any task).

## Self-Check: PASSED

- `docs/DEPLOYMENT_SETUP.md` — FOUND, contains `data/d1/seed.sql` (4x), `gift-card-block` (3x), zero `lib/db/seed.sql`
- `.planning/phases/09-gift-card-catalogue/09-VALIDATION.md` — FOUND, zero brace-placeholder tokens, 9 per-task rows
- `git log --oneline --all --grep="09-04"` — FOUND (`67f3e5b`)
- Task 1 acceptance criteria re-run: `docs:lint` 0 violations; path/sentinel greps as above; `git status --porcelain lib/ app/ components/ migrations/` empty — all PASS
- Task 3 acceptance criteria re-run: slice guard (non-empty, 3 openers, shorter than whole file) PASS; remote apply exit 0, no constraint error PASS; production read-back p=1/v=4/pr=4/amounts match PASS; tax_category count PASS; categories LIKE PASS; live PDP 200 + name + price PASS; image 200 PASS; `git status --porcelain migrations/ lib/ app/ components/` empty PASS
- Plan `<verification>`: `docs:lint` green; `npm test` 269/2219 green; `lint` 0 errors; `typecheck` clean; production read-back matches 09-01 scratch value for value; live product page and image both 200; `git status --porcelain migrations/ lib/ app/ components/` empty — all PASS

---
*Phase: 09-gift-card-catalogue*
*Completed: 2026-09-08*
