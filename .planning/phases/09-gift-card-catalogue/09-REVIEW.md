---
phase: 09-gift-card-catalogue
reviewed: 2026-09-08T00:00:00Z
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
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-09-08
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase adds a `data/d1/seed.sql` block seeding a `gift_card`/`digital` catalogue product
(`prod_33`, variants `variant_33..36`, `price_33`), four new unit test files that exercise the
existing availability, inventory-adjustment, and serializer logic against that shape, and two
documentation fixes (a stale seed-file path in `DEPLOYMENT_SETUP.md`, two dead links in
`theming.md`).

I traced the seed data against `migrations/0001_initial_schema.sql` column-by-column for
`products`, `product_variants`, and `pricing` — column counts, value counts, and `CHECK`
constraints all agree, every JSON blob in the new block parses, and both embedded apostrophes in
the product description are correctly SQL-escaped (`''`). All three `INSERT`s use
`INSERT OR IGNORE`, matching the idempotency claim in the block's own comment and in the new
`DEPLOYMENT_SETUP.md` production-apply recipe (verified the `sed` sentinel-slice command actually
produces a complete, valid three-statement SQL file). The `docs/theming.md` link fix points at a
file that now genuinely exists at the new path (`.planning/milestones/v2-phases/...`), while the
old path is gone.

I also read the production code behind every test (`lib/inventory/availability.ts`,
`lib/services/inventory-adjustments.ts`, `lib/gift-cards/checkout.ts`,
`lib/models/mach/product-serializer.ts`) and confirmed the tests exercise real behavior rather
than mocking it away: `aggregateOrderDemand`'s gift-card skip, `isGiftCardOrderLine`'s
`fulfillment_type`+`gift_card` predicate, and `toPublicProduct`'s `isVariantAvailable`-driven
`available_for_sale` projection are all genuinely reached by the new fixtures, using a
hand-written D1 fake rather than module mocks for the batch-call assertions. The one substantive
issue found is a test correctness gap, not a production defect — see WR-01.

## Warnings

### WR-01: `seed-gift-card.test.ts` never asserts the products/variants/pricing statements appear in that order

**File:** `tests/unit/data/seed-gift-card.test.ts:56-60`
**Issue:** The test `"the slice contains exactly three statements, each an INSERT OR IGNORE INTO"`
counts `INSERT OR IGNORE INTO` occurrences but never checks *which* tables they target or that
`products` precedes `product_variants` precedes `pricing`. Because `product_variants.product_id`
and `pricing.product_id` both reference `products.id`, and D1/SQLite only enforces foreign keys
when `PRAGMA foreign_keys = ON` is active for the connection, a future edit that reorders the
block (e.g. variants before the product row) would pass every existing assertion in this file
while silently becoming order-dependent on FK enforcement being off. That's the kind of thing a
sentinel-block test suite exists to catch.
**Fix:**
```ts
it("orders INSERT OR IGNORE statements as products, then product_variants, then pricing", () => {
  const slice = stripCommentLines(extractGiftCardSlice(seedSql));
  const tableOrder = Array.from(
    slice.matchAll(/INSERT OR IGNORE INTO (\w+)/g),
  ).map((match) => match[1]);
  expect(tableOrder).toEqual(["products", "product_variants", "pricing"]);
});
```

## Info

### IN-01: `pricing` table only reflects the $25 denomination for a 4-denomination product

**File:** `data/d1/seed.sql:401-402`
**Issue:** `price_33` carries `list_price`/`sale_price` of `'2500'` (the $25 variant), but
`prod_33` has four variants priced $25/$50/$100/$200. Any caller that reads the `pricing` table
for a product-level display price (rather than the selected variant's `product_variants.price`)
will show $25 regardless of which denomination is in view. This exactly mirrors the pre-existing
pattern for other multi-variant products in this file (e.g. `prod_1`/`variant_1`/`variant_1_xl`
only has one `pricing` row matching the base variant), so it is not a regression introduced by
this phase — flagging only because a reviewer skimming the gift-card block in isolation, without
the multi-variant precedent, could reasonably read it as a bug.
**Fix:** No action needed if this is accepted as the established one-`pricing`-row-per-product
convention. If a future phase wants per-denomination display pricing sourced from `pricing`
directly, that would need a schema/product-model change well outside this phase's scope.

### IN-02: `sed -n '...'p'` slice recipe in `DEPLOYMENT_SETUP.md` depends on exact sentinel text staying byte-identical

**File:** `docs/DEPLOYMENT_SETUP.md:293-299`
**Issue:** The documented `sed -n '/^-- BEGIN gift-card-block (Phase 9)$/,/^-- END gift-card-block (Phase 9)$/p'` command anchors on the literal sentinel text with `^...$`. It works today (verified
by running it against the current file) but has no guard against a future edit that reflows or
retitles the sentinel comment — the failure mode is a silent empty/partial slice rather than an
error, since `sed` doesn't complain about an unmatched address range.
**Fix:** Optional: add a one-line note that an empty output file from this command means the
sentinel text was not found verbatim and to grep for the current `-- BEGIN ... (Phase N)` line
before slicing, rather than trusting the copy-pasted command silently.

---

_Reviewed: 2026-09-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
