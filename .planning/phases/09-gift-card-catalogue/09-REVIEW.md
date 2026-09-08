---
phase: 09-gift-card-catalogue
reviewed: 2026-09-08T08:52:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - data/d1/seed.sql
  - docs/DEPLOYMENT_SETUP.md
  - docs/theming.md
  - tests/unit/data/seed-gift-card.test.ts
  - tests/unit/lib/inventory/availability.test.ts
  - tests/unit/lib/models/mach/product-serializer.test.ts
  - tests/unit/lib/services/inventory-adjustments.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 9: Code Review Report

**Reviewed:** 2026-09-08
**Depth:** standard
**Files Reviewed:** 7
**Status:** clean

## Summary

This is iteration 2 of the `--auto` fix loop, re-reviewing after commit `9f9e70a` addressed WR-01
from the prior review (`09-REVIEW.iter2.md`).

**WR-01 verification:** Read `tests/unit/data/seed-gift-card.test.ts:62-69`. The fixer added the
exact test the previous review specified: it extracts the gift-card seed slice, strips comments,
collects every `INSERT OR IGNORE INTO <table>` match in document order via
`slice.matchAll(/INSERT OR IGNORE INTO (\w+)/g)`, and asserts the resulting table sequence equals
`["products", "product_variants", "pricing"]`. This closes the gap the previous review identified
— a future edit that reorders the block (e.g., variants before the parent product row) will now
fail this test regardless of whether `PRAGMA foreign_keys` is on for the connection. Ran
`mise exec -- npx vitest run tests/unit/data/seed-gift-card.test.ts`: 10/10 tests pass, including
the new one. WR-01 is resolved.

**Regression check on the other six files:** `git diff 51d6c68..HEAD` (the commit that produced
the previous review) shows the *only* change since that review is the 8-line addition to
`seed-gift-card.test.ts` above — `data/d1/seed.sql`, `docs/DEPLOYMENT_SETUP.md`, `docs/theming.md`,
`availability.test.ts`, `product-serializer.test.ts`, and `inventory-adjustments.test.ts` are
byte-identical to the versions already reviewed at standard depth in iteration 1. No new code was
introduced in those files, so no new regressions are possible. Ran the full set of the four
gift-card-related test files together (`seed-gift-card`, `availability`, `product-serializer`,
`inventory-adjustments`): 35/35 pass.

No Critical or Warning findings remain. The two Info items from the previous review
(IN-01: single-pricing-row-per-product is an established pre-existing convention, not a defect;
IN-02: the `sed` sentinel-slice recipe in `DEPLOYMENT_SETUP.md` has no guard against sentinel text
drift) were not addressed by the fixer and were not required to be — they're carried forward
unchanged below for visibility, not because they block ship.

## Info

### IN-01: `pricing` table only reflects the $25 denomination for a 4-denomination product

**File:** `data/d1/seed.sql:401-402`
**Issue:** `price_33` carries `list_price`/`sale_price` of `'2500'` (the $25 variant), but
`prod_33` has four variants priced $25/$50/$100/$200. Any caller that reads the `pricing` table
for a product-level display price (rather than the selected variant's `product_variants.price`)
will show $25 regardless of which denomination is in view. This mirrors the pre-existing pattern
for other multi-variant products in this file (e.g. `prod_1`/`variant_1`/`variant_1_xl` only has
one `pricing` row matching the base variant), so it is not a regression introduced by this phase.
**Fix:** No action needed if this is accepted as the established one-`pricing`-row-per-product
convention. If a future phase wants per-denomination display pricing sourced from `pricing`
directly, that would need a schema/product-model change well outside this phase's scope.

### IN-02: `sed -n '...'p'` slice recipe in `DEPLOYMENT_SETUP.md` depends on exact sentinel text staying byte-identical

**File:** `docs/DEPLOYMENT_SETUP.md:293-299`
**Issue:** The documented `sed -n '/^-- BEGIN gift-card-block (Phase 9)$/,/^-- END gift-card-block (Phase 9)$/p'` command anchors on the literal sentinel text with `^...$`. It works today but has
no guard against a future edit that reflows or retitles the sentinel comment — the failure mode is
a silent empty/partial slice rather than an error, since `sed` doesn't complain about an unmatched
address range.
**Fix:** Optional: add a one-line note that an empty output file from this command means the
sentinel text was not found verbatim and to grep for the current `-- BEGIN ... (Phase N)` line
before slicing, rather than trusting the copy-pasted command silently.

---

_Reviewed: 2026-09-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
