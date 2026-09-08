# Phase 9: Gift Card Catalogue - Pattern Map

**Mapped:** 2026-09-08
**Files analyzed:** 8
**Analogs found:** 7 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `data/d1/seed.sql` (new `INSERT OR IGNORE` block) | migration/seed (config) | batch (SQL insert) | `data/d1/seed.sql` rows `prod_31`/`prod_32`, `variant_31`/`variant_32`, `price_31`/`price_32` (same file, modern-shape rows added one day prior, commit `9df5ed9`) | exact |
| One-off production apply SQL (extracted block) | config/script | batch | none tracked — synthesize by extracting the `seed.sql` block; no separate apply-file precedent exists in the repo | no analog (see below) |
| `data/r2/products/gift-card-33.png` (image asset) | static asset (file-I/O) | file-I/O | `data/r2/products/field-ration-resupply-31.png` / `campfire-smores-kit-32.png` (binary siblings, same naming convention `<slug>-<n>.png`) | exact |
| Workers AI image-generation script (ad hoc, not committed) | utility/script | file-I/O (binary write) | No tracked script exists (`git ls-files` — zero hits for `lucid-origin`/`getPlatformProxy`/`leonardo`). Nearest tracked, wrangler-driven node script: `scripts/db-local-ensure.mjs` | role-match only (see below) |
| `tests/unit/lib/inventory/availability.test.ts` (new file) | test | unit/pure-function | `tests/unit/lib/services/inventory-adjustments.test.ts` (its own `describe('shared storefront and checkout availability policy', ...)` block already exercises `isInventoryAvailable`/`isVariantAvailable` from the same module) | exact (source block to copy, different file target) |
| `tests/unit/lib/services/inventory-adjustments.test.ts` (extend) | test | unit/pure-function | itself (extend in place) — pattern source: `lib/services/inventory-adjustments.ts` lines ~95-110 (`aggregateOrderDemand`'s gift-card skip) and `lib/gift-cards/checkout.ts` `isGiftCardOrderLine` | exact |
| `tests/unit/lib/models/mach/product-serializer.test.ts` (extend) | test | unit/transform | itself (extend in place) — existing `productFixture()` helper is the template for a gift-card fixture | exact |
| `docs/DEPLOYMENT_SETUP.md` §"Step 2: Seed Data" | docs | — | itself (one-line path/flag fix) | exact |

## Pattern Assignments

### `data/d1/seed.sql` — new `INSERT OR IGNORE` block (migration/seed, batch)

**Analog:** the file's own `prod_31`/`prod_32` product rows, `variant_31`/`variant_32` variant rows, and `price_31`/`price_32` pricing rows (added by commit `9df5ed9`, one day before this phase). These are the only rows in the file using the **modern JSON-shaped** columns — copy their shape, not the legacy `prod_1`..`prod_30` bare-number shape.

**Products INSERT — column list and a template row** (`data/d1/seed.sql` line 98, `prod_31`):
```sql
INSERT OR IGNORE INTO products (id, name, description, slug, status, external_references, created_at, updated_at, brand, categories, tags, options, default_variant_id, fulfillment_type, tax_category, primary_image, media, seo, rating, related_products, extensions) VALUES
('prod_33', 'Voltique Gift Card', '{"en": "..."}', 'gift-card', 'active', '{}', datetime('now'), datetime('now'), 'Mercora', '["cat_1"]', '["gift", "present", "voucher"]', '[{"id": "amount", "name": "Amount", "type": "select", "values": [...]}]', 'variant_33', 'digital', 'txcd_00000000', '{"url": "products/gift-card-33.png", "alt_text": "Voltique Gift Card"}', '[{"url": "products/gift-card-33.png", "alt_text": "Voltique Gift Card"}]', '{"meta_title": "...", "meta_description": "..."}', null, '[]', '{"ai_notes": "...", "use_cases": [...]}');
```
Note D-10: `rating` is `null` (not the `{"average": ..., "count": ...}` object `prod_31`/`prod_32` use) and `related_products` is `'[]'` (not populated).

**Variants INSERT — column list and a template row** (`data/d1/seed.sql` line 107 for the column list; `variant_31` at line 170 for the modern-shape values):
```sql
INSERT INTO product_variants (id, product_id, sku, option_values, price, status, position, compare_at_price, cost, weight, dimensions, barcode, inventory, tax_category, shipping_required, media, attributes, created_at, updated_at) VALUES
('variant_31', 'prod_31', 'FRR-001', '[]', '{"amount": 5900, "currency": "USD"}', 'active', 1,
 '{"amount": 5900, "currency": "USD"}', '{"amount": 3200, "currency": "USD"}',
 '{"value": 4.8, "unit": "lbs"}', '{"length": 12, "width": 8, "height": 6, "unit": "inches"}',
 'FRR001BAR', '{"quantity": 80, "status": "in_stock"}', 'txcd_40040000', 1, '[]', '{...}',
 datetime('now'), datetime('now'))
```
For the gift card, per D-09/CAT-04, use `NULL` for `compare_at_price`/`cost`/`weight`/`dimensions`/`barcode`, `'{"track_inventory": false}'` for `inventory`, `'txcd_00000000'` for `tax_category`, `shipping_required = 0`, and `option_values` as `'[{"option_id": "amount", "value": "$25"}]'` (etc. per denomination) rather than `'[]'`.

**IMPORTANT — do not copy the legacy shape.** Contrast: `variant_30` (`data/d1/seed.sql` line 168, `prod_1`-`prod_30` era) uses bare-string `compare_at_price: '3599'` and `inventory: '110'` — this only round-trips through a parser fallback in `lib/models/mach/products.ts`'s `parseMoneyField`/`parseInventoryField` and must not be reproduced in new rows.

**Pricing INSERT (optional, Claude's Discretion — recommend adding for consistency)** — column list at `data/d1/seed.sql` line 179, template row `price_31` at line 240:
```sql
INSERT INTO pricing (id, product_id, list_price, sale_price, type, status, external_references, created_at, updated_at, valid_from, valid_to, campaign_id, pricelist_id, catalog_id, tax, currency_code, minimum_quantity, customer_segment_id, channel_id, region_id, extensions) VALUES
('price_33', 'prod_33', '2500', '2500', 'retail', 'active', '{}', datetime('now'), datetime('now'), datetime('now'), NULL, NULL, NULL, NULL, '{"included": false, "rate": 0, "type": "none"}', 'USD', 1, NULL, NULL, 'US', '{"on_sale": false}')
```
(No functional read path consumes `pricing`; storefront/checkout read `product_variants.price` directly — this row is cosmetic-consistency only, per Research Finding/Open Question 1.)

**Delimiter comment convention** — bracket the new block clearly, matching the file's existing section-header style (e.g. `data/d1/seed.sql` line 99, `-- =====...=====` before "Product Variants Data"):
```sql
-- =====================================================
-- Gift Card Product (Phase 9, idempotent — safe to re-run against production)
-- =====================================================
```

**SQL string escaping** — single quotes inside text fields are doubled, e.g. `Campfire S''mores Kit` (`data/d1/seed.sql` line 100). Apply the same doubling in any gift-card description/AI-notes copy containing an apostrophe.

---

### One-off production apply SQL (extracted block)

**No tracked analog exists** — there is no separate `*.sql` apply-file precedent anywhere in the repo (`git ls-files` shows only `data/d1/seed.sql` and files under `migrations/`, none of which are single-purpose apply extracts). Per Research Finding 3, do not run `wrangler d1 execute --remote --file data/d1/seed.sql` against production (aborts on the first non-`OR IGNORE` `categories` insert). Generate this file mechanically from the canonical block in `data/d1/seed.sql` via `sed`, e.g.:
```bash
sed -n '/-- BEGIN gift card/,/-- END gift card/p' data/d1/seed.sql > /tmp/gift-card-apply.sql
```
This file must be byte-identical to (or a literal `sed`/`tail` slice of) the `seed.sql` block per CONTEXT.md's Claude's-Discretion note — do not hand-diverge the two.

---

### `data/r2/products/gift-card-33.png` (static asset, file-I/O)

**Analog:** `data/r2/products/field-ration-resupply-31.png` and `data/r2/products/campfire-smores-kit-32.png` — both binary PNGs, same naming convention (`<slug>-<n>.png`), same portrait 1024×1536 dimensions, same near-black studio/olive-drab palette (per D-05/D-06). No code excerpt applies (binary asset); match on naming and upload command shape only.

**Upload command (from Research Finding 7 / memory note "catalogue-images-via-workers-ai", used for the two sibling images one day prior):**
```bash
npx wrangler r2 object put voltique-images/products/gift-card-33.png --file data/r2/products/gift-card-33.png --remote
```

---

### Workers AI image-generation script (role-match only — no tracked analog)

**No committed script exists.** `git ls-files` and repo-wide grep for `lucid-origin`/`getPlatformProxy`/`leonardo` return zero hits outside this phase's own planning docs — the script that produced `field-ration-resupply-31.png`/`campfire-smores-kit-32.png` was run ad hoc and never committed. Per D-07, this phase's script is also written ad hoc by the executor and is not expected to land as a tracked file.

**Nearest tracked, wrangler-driven node script for general shape/conventions** (`scripts/db-local-ensure.mjs`) — use for import/invocation style conventions only, not for AI-generation specifics:
```bash
# not read in full this pass; role-match is "node script invoked via mise exec -- that
# talks to a Cloudflare binding through wrangler tooling", nothing more specific applies
```

**Invocation shape to actually use** (reconstructed from the memory note "catalogue-images-via-workers-ai" and Research Finding 7 — the only source, since no code file exists):
```js
const { getPlatformProxy } = require('/absolute/path/to/node_modules/wrangler/wrangler-dist/cli.js');
const { env } = await getPlatformProxy({ configPath: 'wrangler.jsonc', remoteBindings: true });
const result = await env.AI.run('@cf/leonardo/lucid-origin', {
  prompt: 'matte charcoal gift card, olive-drab accent, propped on seamless near-black studio set, soft studio light, no text, no lettering, no logos, no numerals',
  width: 1024,
  height: 1536,
});
// result is a binary stream — write to data/r2/products/gift-card-33.png
```
Prompt must include "no text, no lettering, no logos" — labels/numerals come out garbled per the memory note.

---

### `tests/unit/lib/inventory/availability.test.ts` (new file, unit/pure-function)

**Analog:** the existing `describe('shared storefront and checkout availability policy', ...)` block inside `tests/unit/lib/services/inventory-adjustments.test.ts` (lines 1-45) — same functions under test (`isInventoryAvailable`, `isVariantAvailable` from `lib/inventory/availability.ts`), just currently colocated with a different file. Copy the import and assertion style verbatim into the new dedicated file.

**Imports pattern:**
```ts
import { describe, expect, it } from 'vitest';
import {
  canFulfillInventory,
  isInventoryAvailable,
  isVariantAvailable,
} from '@/lib/inventory/availability';
```

**Core assertion pattern** (from the analog block):
```ts
it('treats untracked and backorderable inventory as available', () => {
  expect(isInventoryAvailable(undefined)).toBe(true);
  expect(isInventoryAvailable({ track_inventory: false, quantity: 0 })).toBe(true);
  expect(isInventoryAvailable({
    track_inventory: true,
    quantity: -4,
    allow_backorder: true,
  })).toBe(true);
});

it('combines active status with the same inventory policy', () => {
  expect(isVariantAvailable({ status: 'active', inventory: undefined })).toBe(true);
  expect(isVariantAvailable({
    status: 'inactive',
    inventory: { track_inventory: false },
  })).toBe(false);
});
```
For CAT-04, add the gift-card-specific case: `isInventoryAvailable({ track_inventory: false })` (no `quantity` key at all, matching the seeded shape) → `true`, and `isVariantAvailable({ status: 'active', inventory: { track_inventory: false } })` → `true`.

---

### `tests/unit/lib/services/inventory-adjustments.test.ts` (extend)

**Analog:** itself. Pattern source for the new gift-card case is `lib/services/inventory-adjustments.ts`'s `aggregateOrderDemand` (lines ~95-99) and `lib/gift-cards/checkout.ts`'s `isGiftCardOrderLine` (line 22).

**Skip-site under test** (`lib/services/inventory-adjustments.ts` lines 95-99):
```ts
function aggregateOrderDemand(items: OrderItem[]): Map<string, number> {
  const demand = new Map<string, number>();
  for (const item of items) {
    // Gift cards are stored value, not catalog stock. Their face value is
    // issued by the paid-order effect and must never mutate variant inventory.
    if (isGiftCardOrderLine(item)) continue;
    ...
```

**Predicate under test** (`lib/gift-cards/checkout.ts` line 22):
```ts
return item.fulfillment_type === 'digital' && item.gift_card !== undefined;
```

**Existing assertion style to extend** (`tests/unit/lib/services/inventory-adjustments.test.ts`, `assertCheckoutInventoryAvailable` block, ~line 50):
```ts
await expect(assertCheckoutInventoryAvailable([{
  product_id: 'product',
  variant_id: 'variant',
  sku: 'SKU',
  quantity: 0,
  unit_price: { amount: 1, currency: 'USD' },
  total_price: { amount: 1, currency: 'USD' },
  product_name: 'Product',
}])).rejects.toThrow('invalid quantity');
```
New test should build an `OrderItem`-shaped fixture with `fulfillment_type: 'digital'` and a `gift_card: {...}` object, call `isGiftCardOrderLine(item)` directly (asserting `true`), and exercise whatever public surface (`stageInventoryAdjustments` or equivalent) confirms the item is excluded from the paid-decrement demand map — same file already imports `stageInventoryAdjustments` at the top, reuse that import.

---

### `tests/unit/lib/models/mach/product-serializer.test.ts` (extend)

**Analog:** itself — the existing `productFixture()` helper (lines 8-40+) is the template for a gift-card fixture.

**Existing fixture pattern to copy:**
```ts
import { describe, expect, it } from 'vitest';
import {
  fromWireProduct,
  toPublicProduct,
  toWireProduct,
} from '@/lib/models/mach/product-serializer';
import type { Product } from '@/lib/types';

function productFixture(): Product {
  return {
    id: 'product-1',
    name: 'Trail Pack',
    status: 'active',
    external_references: { erp: 'private-erp-id' },
    extensions: { integrationSecret: 'do-not-leak' },
    primary_image: { ... },
    variants: [
      {
        id: 'variant-1',
        sku: 'TRAIL-1',
        status: 'active',
        option_values: [],
        price: { amount: 2599, currency: 'USD' },
        compare_at_price: { amount: 2999, currency: 'USD' },
        cost: { amount: 800, currency: 'USD' },
        barcode: '012345678905',
        inventory: { track_inventory: true, quantity: 42 },
        attributes: { color: 'green', material: 'canvas' },
      },
      { id: 'variant-2', sku: 'TRAIL-HIDDEN', status: 'inactive', ... },
    ],
  };
}
```
For CAT-02/CAT-04, add a gift-card-shaped fixture (or extend this one with an untracked-inventory variant): `fulfillment_type: 'digital'`, `type: 'gift_card'`, `tax_category: 'txcd_00000000'`, `inventory: { track_inventory: false }`, then assert via `toPublicProduct`/the serializer's `toPublicVariant` (`lib/models/mach/product-serializer.ts` lines 30-44) that `available_for_sale: true` and no unexpected fields leak (mirrors the existing `extensions`/`external_references` stripping assertions already in this file).

**Function under test** (`lib/models/mach/product-serializer.ts` lines 30-44):
```ts
function toPublicVariant(variant: ProductVariant): ProductVariant {
  const { cost: _cost, barcode: _barcode, inventory: _inventory, ...publicVariant } = variant;
  return {
    ...publicVariant,
    available_for_sale: isVariantAvailable(variant),
    ...
  };
}
```

---

### `docs/DEPLOYMENT_SETUP.md` §"Step 2: Seed Data" (docs, one-line fix)

**Current text** (lines 279-283):
```
### **Step 2: Seed Data (Optional)**
```bash
# Execute seed data if you have any
npx wrangler d1 execute mercora-db --file=./lib/db/seed.sql
```
```
**Fix:** path is stale (`./lib/db/seed.sql` does not exist); correct path is `data/d1/seed.sql`. Also add the required `--local`/`--remote` flag (not optional under wrangler 4.129.0). Run `npm run docs:lint` after editing to confirm the corrected path passes the existence check.

---

## Shared Patterns

### SQL row idempotency
**Source:** `data/d1/seed.sql` — every existing product/variant/pricing bulk `INSERT INTO` has no `OR IGNORE`; only the new gift-card block should use `INSERT OR IGNORE`, per D-13/Finding 3, so it is safe to replay.
**Apply to:** all three new INSERT statements (products, product_variants, pricing) in the new block.

### Modern JSON-shaped columns (not legacy bare-number)
**Source:** `data/d1/seed.sql` `variant_31`/`variant_32` (lines 170-172) vs. legacy `variant_1`..`variant_30`.
**Apply to:** all four gift-card variant rows — `price`, `compare_at_price`, `cost`, `weight`, `dimensions`, `inventory` must all be JSON objects/`NULL`, never bare numeric strings.

### Tax-code regex compliance
**Source:** `lib/services/checkout-pricing.ts` line 669, `/^txcd_\d{8}$/`.
**Apply to:** `products.tax_category` and all four `product_variants.tax_category` values — use `txcd_00000000` (verified against Stripe's docs as the unconditional "Nontaxable" code, not `txcd_10502000`).

### Untracked-inventory shape
**Source:** `lib/inventory/availability.ts` `isInventoryAvailable` (`!inventory?.track_inventory` returns `true`).
**Apply to:** all four variant `inventory` columns — use `'{"track_inventory": false}'`, not `NULL` (self-documents intent even though both produce the same runtime result).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| One-off production apply SQL file | config/script | batch | No separate apply-file precedent exists anywhere in the repo; must be mechanically derived (sed-extracted) from the canonical `seed.sql` block, not modeled on an existing file |
| Workers AI image-generation script | utility/script | file-I/O | No script using `getPlatformProxy`/`lucid-origin` is tracked in git (only described in a project memory note from one day prior); reconstruct from the memory note's invocation shape, not from a codebase analog |

## Metadata

**Analog search scope:** `data/d1/seed.sql` (full read of relevant line ranges), `data/r2/products/`, `tests/unit/lib/inventory/`, `tests/unit/lib/services/inventory-adjustments.test.ts`, `tests/unit/lib/models/mach/product-serializer.test.ts`, `lib/inventory/availability.ts`, `lib/services/inventory-adjustments.ts`, `lib/gift-cards/checkout.ts`, `lib/models/mach/product-serializer.ts`, `docs/DEPLOYMENT_SETUP.md`
**Files scanned:** 8 target files against ~10 source/analog files
**Pattern extraction date:** 2026-09-08
```
