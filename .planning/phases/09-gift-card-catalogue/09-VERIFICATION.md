---
phase: 09-gift-card-catalogue
verified: 2026-09-08T16:17:21Z
status: passed
score: 4/4 truths verified
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - .planning/phases/09-gift-card-catalogue/09-01-PLAN.md
  - .planning/phases/09-gift-card-catalogue/09-01-SUMMARY.md
  - .planning/phases/09-gift-card-catalogue/09-02-PLAN.md
  - .planning/phases/09-gift-card-catalogue/09-02-SUMMARY.md
  - .planning/phases/09-gift-card-catalogue/09-03-PLAN.md
  - .planning/phases/09-gift-card-catalogue/09-03-SUMMARY.md
  - .planning/phases/09-gift-card-catalogue/09-04-PLAN.md
  - .planning/phases/09-gift-card-catalogue/09-04-SUMMARY.md
  - .planning/REQUIREMENTS.md
  - data/d1/seed.sql
  - data/r2/products/gift-card-33.png
  - docs/DEPLOYMENT_SETUP.md
  - tests/unit/data/seed-gift-card.test.ts
  - tests/unit/lib/inventory/availability.test.ts
  - tests/unit/lib/services/inventory-adjustments.test.ts
  - tests/unit/lib/models/mach/product-serializer.test.ts
covered_digest: "v1:sha256:0e45656108e5b134f1e696c57f42baf0c391aa25b3ce997be04b1c8678314110"
human_verification:
  - test: "Open https://voltique.russellkmoore.me/product/gift-card and compare the product photo against the two sibling shots at https://voltique-images.russellkmoore.me/products/field-ration-resupply-31.png and https://voltique-images.russellkmoore.me/products/campfire-smores-kit-32.png"
    expected: "The gift card image reads as belonging to the same photo shoot as the two sibling images: same near-black seamless backdrop, same soft studio lighting and shadow falloff, matte charcoal/olive-drab palette, no lettering, no logos, no numerals"
    why_human: "Style continuity across a photo set is a visual judgement; grep and file-dimension checks cannot assess it. The verifier viewed data/r2/products/gift-card-33.png directly and observed a matte charcoal card with a single olive-drab accent stripe on a near-black seamless set with soft directional light and no text of any kind, consistent with D-05/D-07's description, but a side-by-side comparison against the two named siblings is a human call, not a fabricated pass."
---

# Phase 9: Gift Card Catalogue Verification Report

**Phase Goal:** A gift card product with four denomination variants exists in the catalogue, in production, with a matching image, and correct never-out-of-stock inventory behavior.
**Verified:** 2026-09-08T08:56:00Z
**Status:** passed (human item confirmed by Russell 2026-09-08 via 09-UAT.md)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The gift card product exists in production D1 with four variants priced $25/$50/$100/$200, `type='gift_card'`, `fulfillment_type='digital'`, added via idempotent `INSERT OR IGNORE` SQL recorded in `data/d1/seed.sql` | VERIFIED | `data/d1/seed.sql` contains a sentinel-delimited `INSERT OR IGNORE` block (`prod_33`, `variant_33..36`, `price_33`). Live production `wrangler d1 execute mercora-db --remote` read-back (run by this verifier, not taken from SUMMARY) returns `prod_33`: `type=gift_card`, `fulfillment_type=digital`, `status=active`, `tax_category=txcd_00000000`, `categories=["cat_1"]`; four `product_variants` rows at 2500/5000/10000/20000 minor units, all `tax_category=txcd_00000000`, all `inventory={"track_inventory": false}` |
| 2 | The product is listed in the Featured category and renders wherever the Featured category is rendered, the product page, and in search like any other product, showing the selected denomination's price (per CONTEXT D-03/D-14) | VERIFIED | `curl https://voltique.russellkmoore.me/product/gift-card` → 200, body contains `Voltique Gift Card` (23 occurrences) and `25.00`. `curl https://voltique.russellkmoore.me/category/featured` → 200, body contains `gift-card`. `curl https://voltique.russellkmoore.me/` confirmed the three existing Featured cards are unchanged and do **not** include the gift card, matching D-03's explicit exemption. Volt/search re-index is explicitly deferred to Phase 12 per locked decision D-14 — judged against that decision, not the raw roadmap wording, per this task's own instruction |
| 3 | The product page shows a Workers-AI-generated image in the catalogue's dark-studio style, stored in `data/r2/products/` and uploaded to the public `voltique-images` bucket | VERIFIED (mechanical) — style-match sub-claim routed to human verification | `file data/r2/products/gift-card-33.png` → JPEG bytes, 1024x1536 (matches sibling images' documented behavior of JPEG-under-.png). `git ls-files` confirms it is tracked. `curl -I https://voltique-images.russellkmoore.me/products/gift-card-33.png` → 200, `content-type: image/jpeg`, `content-length: 384813`. Verifier viewed the image directly (see below) — a matte charcoal card with one olive-drab accent stripe on a near-black seamless set, no text/logo/numerals. Whether it specifically reads as "the same photo shoot" as the two sibling gear shots is a comparative style judgement — see Human Verification |
| 4 | None of the four variants ever shows as out of stock, and a paid gift card order does not decrement their inventory | VERIFIED | Code-level: `lib/inventory/availability.ts` `isInventoryAvailable` returns `true` whenever `inventory.track_inventory` is falsy (the seeded shape has no `track_inventory` key set true). `lib/services/inventory-adjustments.ts:100` calls `isGiftCardOrderLine(item)` (imported from `lib/gift-cards/checkout.ts`) and `continue`s past gift-card lines before building the paid-decrement demand map — this is production code, not test-only logic. Behavioral tests (`tests/unit/lib/inventory/availability.test.ts`, `tests/unit/lib/services/inventory-adjustments.test.ts`) exercise both paths against the exact seeded fixture and pass (see Behavioral Spot-Checks). Live PDP HTML shows "In Stock" for all four denomination selections (4 occurrences of "In Stock"/"In stock" in the fetched page) |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `data/d1/seed.sql` | Sentinel-delimited `INSERT OR IGNORE` gift-card block | VERIFIED | Sliced block confirmed present with correct sentinels, 3 statements (products, product_variants, pricing), matches all seeded values claimed in SUMMARY |
| `tests/unit/data/seed-gift-card.test.ts` | Guard test pinning the block's shape | VERIFIED | 10 tests, all pass when run standalone by this verifier |
| `tests/unit/lib/inventory/availability.test.ts` | New coverage for untracked-inventory availability | VERIFIED | 6 tests pass |
| `tests/unit/lib/services/inventory-adjustments.test.ts` | Gift-card paid-decrement skip coverage | VERIFIED | 10 tests pass (4 new gift-card cases confirmed present) |
| `tests/unit/lib/models/mach/product-serializer.test.ts` | Four-denomination projection coverage | VERIFIED | 9 tests pass |
| `data/r2/products/gift-card-33.png` | 1024x1536 catalogue image | VERIFIED | Confirmed via `file`; git-tracked; only path changed under `data/r2/products/` in this phase's diff |
| `docs/DEPLOYMENT_SETUP.md` | Corrected seed path + production-apply recipe | VERIFIED | Diff confirms `lib/db/seed.sql` replaced with `data/d1/seed.sql --local`, and a new subsection documents the `sed` sentinel-slice + `--remote --file` recipe; `npm run docs:lint` → 0 violations |
| `.planning/phases/09-gift-card-catalogue/09-VALIDATION.md` | Filled validation tables | PRESENT, with a stale note | See Anti-Patterns below — two per-task rows still marked "⬜ pending" even though the phase completed and production evidence proves those tasks ran; informational only, does not affect codebase behavior |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `data/d1/seed.sql products.default_variant_id` | `product_variants.id variant_33` | direct FK-style reference | WIRED | Confirmed in seed block; drives the `$25.00` default price shown in SSR HTML |
| `data/d1/seed.sql products.categories ["cat_1"]` | `/category/featured` | `getProductsByCategory('cat_1')` | WIRED | Confirmed live: `/category/featured` returns 200 and body contains `gift-card` |
| `product_variants.inventory {"track_inventory": false}` | `isVariantAvailable`/`available_for_sale` | `lib/inventory/availability.ts` → `lib/models/mach/product-serializer.ts` | WIRED | Confirmed by source read and passing serializer tests; live PDP shows "In Stock" |
| `products.primary_image url products/gift-card-33.png` | live CDN object | `lib/utils/product-image.ts` → `NEXT_PUBLIC_IMAGE_CDN` | WIRED | Confirmed: image URL resolves 200 on the live PDP fetch context (same bucket/CDN pattern as sibling images, both verified live) |
| `lib/gift-cards/checkout.ts isGiftCardOrderLine` | `lib/services/inventory-adjustments.ts` paid-decrement skip | direct import + `continue` at line 100 | WIRED | Confirmed by direct source read, not just test claims |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All four gift-card test files pass together | `mise exec -- npx vitest run tests/unit/data/seed-gift-card.test.ts tests/unit/lib/inventory/availability.test.ts tests/unit/lib/services/inventory-adjustments.test.ts tests/unit/lib/models/mach/product-serializer.test.ts` | 4 files, 35 tests, all pass | PASS |
| Production D1 holds the exact seeded product/variant rows | `wrangler d1 execute mercora-db --remote --json` SELECTs (run independently by this verifier) | `prod_33`: gift_card/digital/active/txcd_00000000/["cat_1"]; 4 variants at 2500/5000/10000/20000, all untracked inventory, all txcd_00000000 | PASS |
| Live product page renders with price | `curl -s https://voltique.russellkmoore.me/product/gift-card` | 200, "Voltique Gift Card" x23, "25.00" present | PASS |
| Live image resolves publicly | `curl -sI https://voltique-images.russellkmoore.me/products/gift-card-33.png` | 200, image/jpeg, 384813 bytes | PASS |
| Live Featured category page lists the card | `curl -s https://voltique.russellkmoore.me/category/featured \| grep -c gift-card` | 2 matches | PASS |
| Home page's three Featured cards are unaffected (D-03) | `curl -s https://voltique.russellkmoore.me/ \| grep -o "product/[a-z0-9-]*" \| sort -u` | `dusty-fire-tool`, `echo-sky-kit`, `vivid-mission-pack` only — no gift-card | PASS |
| No forbidden-path files changed by this phase | `git diff ae255f5 HEAD --stat -- migrations lib/gift-cards lib/db/schema app components` | empty | PASS |
| Docs and token gates | `npm run docs:lint`, `npm run scan:tokens` | 0 violations each | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CAT-01 | 09-01, 09-04 | Gift card product + 4 variants seeded and applied to production D1 with idempotent SQL | SATISFIED | Production read-back confirmed independently by this verifier |
| CAT-02 | 09-01, 09-02, 09-04 | Product listed in Featured, renders on relevant surfaces with denomination price | SATISFIED | Live PDP + Featured page confirmed; search deferred per locked D-14 |
| CAT-03 | 09-03, 09-04 | Workers-AI image in dark-studio style, stored + uploaded publicly | SATISFIED (mechanical); style-match routed to human verification | Image file confirmed 1024x1536, live public 200; style continuity is a human call |
| CAT-04 | 09-02 | Never out of stock; no decrement on paid order | SATISFIED | Confirmed at the source-code level, not just test claims |

No orphaned requirements found — `.planning/REQUIREMENTS.md`'s Phase 9 row for CAT-01..04 matches exactly the four IDs declared across the four plans' frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/phases/09-gift-card-catalogue/09-VALIDATION.md` | Per-Task Verification Map, rows `9-04-02`/`9-04-03` | Status column still reads "⬜ pending" for tasks the phase's own summary and this verifier's independent production checks confirm ran and passed | Info | Cosmetic staleness in the phase's own bookkeeping file; does not reflect on the codebase or the production data, which this verifier confirmed independently. Worth a one-line follow-up edit but not a phase-goal blocker |

No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) found in any file modified by this phase.

## Human Verification Required

### 1. Photo-shoot style continuity

**Test:** Open `https://voltique-images.russellkmoore.me/products/gift-card-33.png` next to `https://voltique-images.russellkmoore.me/products/field-ration-resupply-31.png` and `https://voltique-images.russellkmoore.me/products/campfire-smores-kit-32.png`.
**Expected:** All three read as the same photo shoot — same near-black seamless backdrop, same soft studio lighting/shadow falloff, matte/olive-drab palette family, no lettering, logos, or numerals anywhere.
**Why human:** This is a comparative visual judgement (CONTEXT D-05/D-07, PLAN 09-03's backstop truth). The verifier viewed the gift-card image directly and it is consistent with the described style (matte charcoal card, single olive-drab accent stripe, near-black seamless set, soft directional light, no text) — see the evidence table above — but declining to fabricate the cross-image comparison call per this task's explicit instruction.

## Gaps Summary

No gaps found. Every roadmap success criterion, every plan's must-haves, and both CONTEXT.md's locked decisions (D-01 through D-14) and the phase's stated prohibitions checked out against the live codebase and live production site, independently re-verified by this agent (not taken on SUMMARY.md's word): production D1 read-back, live HTTP fetches, a direct image view, a source-code read of the inventory-skip logic, and a standalone test run of all 35 gift-card-related tests. The only open item is the inherently visual, comparative "same photo shoot" style judgement, which is routed to human verification rather than asserted.

---

*Verified: 2026-09-08T08:56:00Z*
*Verifier: Claude (gsd-verifier)*
