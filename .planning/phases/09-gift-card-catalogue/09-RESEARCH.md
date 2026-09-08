# Phase 9: Gift Card Catalogue - Research

**Researched:** 2026-09-08
**Domain:** Catalogue seed data (D1/SQL), Stripe tax classification, Workers AI image generation, MACH product/inventory model
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The gift card belongs to the Featured category (`cat_1`) only. No other category membership; a dedicated Gift Cards category stays deferred (CAT-05).
- **D-02:** It sits last in the Featured grid in natural table order (insert as the next product id — **see Finding 1: this is `prod_33`, not `prod_31`, per verified seed.sql state**). No ordering code is added to the category page.
- **D-03:** It does not need to appear among the home page's three Featured cards. Roadmap success criterion 2's "renders on the home page" is read as "renders wherever the Featured category is rendered, like any other product"; the home page query and hero are untouched. If the planner wants a home-page proof, it is the Featured category page (`/category/featured`), not `/`.
- **D-04:** No footer link. The two data-driven alternatives are recorded under Deferred Ideas and declined for now.
- **D-05:** One shared image: a matte charcoal gift card with an olive-drab accent, propped on the same seamless near-black studio set as the gear, soft studio light, no lettering, no logos, no numerals. Portrait 1024×1536 PNG like every other product shot.
- **D-06:** The product's `primary_image` and `media` both point at that one file; the four variants carry no variant media and inherit it. Naming follows the existing `<slug>-<n>.png` pattern under `data/r2/products/`.
- **D-07:** The executor generates the render with Workers AI `@cf/leonardo/lucid-origin` through the existing `getPlatformProxy` script path, chooses the best candidate against the style notes itself, saves it to `data/r2/products/`, and uploads it with `wrangler r2 object put ... --remote`. No human gate on image choice; the chosen image is shown to Russell in the summary afterwards. Discarded candidates are not committed.
- **D-08:** Name "Voltique Gift Card", slug `gift-card` (URL `/product/gift-card`). Brand follows the seed's existing brand value (`Mercora`).
- **D-09:** Tax: the product and all four variants carry Stripe's nontaxable tax code in `tax_category` so checkout charges no tax on the card itself. **See Finding 2: the verified code is `txcd_00000000`, not the "Gift Card" category code `txcd_10502000`.**
- **D-10:** `rating` is null (no stars shown) and `related_products` is empty. No seeded review count for a stored-value item.
- **D-11:** The "In Stock" availability badge stays as-is on `ProductCard` and `ProductDisplay`. No template change keyed on `fulfillment_type` in this phase.
- **D-12:** The product is seeded `status = 'active'` in production in this phase, with the stock option `Select` and add-to-cart controls left untouched. Accepted as a demo-site interim; Phase 10 replaces those controls.
- **D-13:** The executor applies the production SQL (`wrangler d1 execute mercora-db --remote --file <idempotent sql>`) and the R2 upload under Russell's existing wrangler OAuth login. This is catalogue data, not a schema migration; `npm run deploy` is not involved. Verification is a read-back `SELECT` against production and a `curl` of `/product/gift-card`. **See Finding 3: `<idempotent sql>` must be a file containing only the new `INSERT OR IGNORE` block, not the full `seed.sql` — the file's other inserts are not idempotent and abort on replay.**
- **D-14:** Volt is not re-indexed in this phase. CAT-02's "search" is the Volt assistant on this storefront; product vectorisation happens through the admin re-index route, scheduled for Phase 12.

### Claude's Discretion

- Option definition: one `select` option (label such as "Amount") with four values.
- Variant ids, SKUs (e.g. `GC-025` … `GC-200`), `position`, `compare_at_price` (none), `cost` (none), `weight`/`dimensions` (null), `barcode` (null), `shipping_required = 0`.
- Description copy in the Voltique voice: email delivery after payment, no expiry, no cash redemption, four fixed amounts. No delivery date mention (SHOP-08 defers scheduled delivery).
- `extensions` / `ai_notes` / `use_cases` / `tags` / `seo` wording, chosen so Volt can match "gift", "present", "voucher".
- Inventory JSON shape for the four variants. The planner picks the explicit representation; CAT-04 is proven by tests on existing helpers with the seeded shape, not by new inventory logic.
- Whether the four rows live inline in `data/d1/seed.sql`'s existing bulk inserts or as a clearly delimited `INSERT OR IGNORE` block at the end of the file. A separate one-off apply file is acceptable only if it is generated from, or byte-identical to, the block in `seed.sql`.
- Whether a `pricing` table row is added for compatibility with the other products.

### Deferred Ideas (OUT OF SCOPE)

- Footer "Gift Cards" link (data-driven alternatives), declined for now.
- Home page placement of the gift card, declined.
- Availability badge wording for digital items, declined for now.
- Per-denomination variant images with numerals composited in post, declined.
- Already in REQUIREMENTS.md v2: SHOP-08 (scheduled delivery), SHOP-09 (custom amount), CAT-05 (dedicated Gift Cards category).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | One active gift card product, `type='gift_card'`, `fulfillment_type='digital'`, four variants ($25/$50/$100/$200), idempotent SQL in `data/d1/seed.sql`, applied to production D1 | Findings 1, 3, 4; verified seed schema/column order; verified idempotency behavior; verified next-id sequence |
| CAT-02 | Listed in Featured category, renders on home page (softened by D-03), Featured grid, product page, and search (Volt), showing selected denomination's price | Findings 5, 6, 8; verified `ProductDisplay`/`ProductCard` rendering paths, `toPublicProduct`, Volt indexing scope |
| CAT-03 | Workers-AI-generated image, dark-studio style, `data/r2/products/`, uploaded to public `voltique-images` | Finding 7; verified prior-session precedent (commit 9df5ed9, memory note) |
| CAT-04 | Variants never show out of stock; paid order never decrements their inventory | Finding 4; verified `isInventoryAvailable`, `isGiftCardOrderLine`, `parseInventoryField`, `available_for_sale` derivation; verified test-coverage gap |
</phase_requirements>

## Summary

This phase is a data-and-asset phase, not a code phase — the storefront rendering paths (`ProductDisplay`, `ProductCard`, `toPublicProduct`, category/home queries) already handle a fourth-variant, digital, untracked-inventory product correctly with zero code changes, confirmed by reading every consumer this session. The work is: (1) four new SQL rows appended to `data/d1/seed.sql` as an `INSERT OR IGNORE` block using the *modern* JSON-shaped columns (not the legacy bare-number shape the original 30 products use), (2) one Workers-AI-generated image uploaded to R2, (3) both applied directly to production outside the migration/deploy pipeline, and (4) a small set of new unit tests proving the existing availability/inventory-skip/tax-validation logic behaves correctly for this specific seed shape.

Three corrections to CONTEXT.md's stated facts came out of this session's verification and change what the planner should do:

1. **Next product id is `prod_33`, not `prod_31`.** `data/d1/seed.sql` already contains `prod_31` (Field Ration Resupply) and `prod_32` (Campfire S'mores Kit), added the day before this phase's context was gathered (commit `9df5ed9`, 2026-09-07). The gift card must use `prod_33` / `variant_33`–`variant_36` / `price_33`–`price_36`.
2. **The verified "nontaxable" Stripe code is `txcd_00000000`, not `txcd_10502000`.** Stripe's own tax-code docs list a dedicated "Gift Card" category code (`txcd_10502000`) whose taxability is explicitly jurisdiction-dependent — the opposite of what D-09 needs. The code that "ensures no tax is applied, even for jurisdictions that impose a tax" is `txcd_00000000` ("Nontaxable" / "General — Not otherwise specified, Nontaxable").
3. **`data/d1/seed.sql` applied cleanly** against a freshly migrated scratch local D1 this session — the "bad bulk-insert row" Phase 5 recorded (missing `options` column on 28 rows) was already fixed in commit `9df5ed9`. But the file is **not idempotent**: re-running it against an already-seeded database aborts immediately with `UNIQUE constraint failed: categories.id` on the very first statement. This means the production-apply file (D-13) must contain *only* the new `INSERT OR IGNORE` gift-card block — pointing `--file` at the whole `seed.sql` against production will fail before it ever reaches the new rows.

**Primary recommendation:** Extend `data/d1/seed.sql` with a delimited `INSERT OR IGNORE` block (ids `prod_33`/`variant_33..36`/`price_33..36`) using the JSON-shaped column style already established by `prod_31`/`prod_32` (not the legacy bare-number style of `prod_1..30`); generate and apply the image via the existing Workers-AI/`getPlatformProxy` path already used for those two products; apply to production with a file containing only the new block; add targeted unit tests against `isInventoryAvailable`, `isGiftCardOrderLine`-driven inventory-adjustment skipping, and `toPublicVariant`'s `available_for_sale` derivation, none of which currently have any test coverage.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Catalogue record (product/variant/price rows) | Database / Storage (D1) | — | Static seed data, no application code needed to define it |
| Storefront rendering (card, PDP, variant select) | Frontend Server (SSR: Next.js on Workers) | Browser (variant `Select` interactivity) | `ProductDisplay`/`ProductCard` are existing React components; SSR fetches via `toPublicProduct` |
| Tax classification | API / Backend | — | `lib/services/checkout-pricing.ts` reads `tax_category` at quote time; pure data flows into an existing backend code path |
| Inventory availability | API / Backend | Database / Storage | `isInventoryAvailable`/`isVariantAvailable` are backend pure functions reading the `product_variants.inventory` JSON column; no separate inventory-table row needed (see Finding 4) |
| Product image | CDN / Static (R2 + Cloudflare Image Optimization) | Frontend Server (image resolver) | Generated once via Workers AI, stored in public R2 bucket, resolved through `lib/utils/product-image.ts` at render time |
| Production apply (SQL + R2 upload) | Operator action (outside all tiers) | — | Explicitly outside the Worker; run by hand under the developer's own `wrangler` OAuth login per D-13 |

## Package Legitimacy Audit

Not applicable. This phase installs no new npm/pip/cargo packages — it adds SQL rows to an existing seed file and one PNG to an existing R2 bucket, using tooling (`wrangler`, Workers AI binding) already present in the repo and already used for the identical purpose one day earlier (commit `9df5ed9`). `[VERIFIED: git log 9df5ed9]`

## Findings

### Finding 1 — Seed file id sequence: next id is `prod_33`, not `prod_31`

`[VERIFIED: data/d1/seed.sql]` — read the file directly and grepped every `'prod_NN'`, `'variant_NN'`, `'price_NN'`, `'inv_NN'` literal:

```
'prod_28' 'prod_29' 'prod_30' 'prod_31' 'prod_32'
'variant_28' 'variant_29' 'variant_30' 'variant_31' 'variant_32'
'price_28' 'price_29' 'price_30' 'price_31' 'price_32'
'inv_28' 'inv_29' 'inv_30' 'inv_31' 'inv_32'
```

`prod_31` = "Field Ration Resupply" (`data/d1/seed.sql:98`) and `prod_32` = "Campfire S'mores Kit" (`data/d1/seed.sql:100`), added by commit `9df5ed9` ("feat(catalog): add Provisions category with two subscription products", 2026-09-07 23:06:54, one day before this phase's context was gathered). CONTEXT.md's "current max ids prod_30" is stale relative to the actual file. **The gift card must use `prod_33`, `variant_33`–`variant_36`, `price_33`–`price_36`.** If a fifth id is needed for a compatibility `inventory`-table row, it is `inv_33` (see Finding 4 for why this is likely unnecessary).

### Finding 2 — Stripe nontaxable tax code is `txcd_00000000`

`[CITED: docs.stripe.com/tax/tax-categories]` — fetched twice from two entry points and cross-checked:

| Code | Category name | Description | Fits D-09? |
|------|---------------|-------------|------------|
| `txcd_00000000` | Nontaxable | "Any nontaxable good or service which can be used to ensure no tax is applied, even for jurisdictions that impose a tax." | **Yes** — unconditional |
| `txcd_10502000` | Gift Card | "Gift card or gift certificate that you purchase and receive electronically and assumed to be multi-purpose." Taxability explicitly "will depend on the jurisdiction and whether they have an active tax registration for digital products." | No — conditional, can still charge tax |
| `txcd_99999999` | General - Tangible Goods | "Any tangible or physical good. For jurisdictions that impose a tax, the standard rate is applied." | No — this is the store's *default* fallback for ordinary physical goods |

D-09's own wording — "carries Stripe's **nontaxable** tax code ... so checkout charges no tax on the card itself" — describes `txcd_00000000` exactly, not the topically-named-but-conditional `txcd_10502000`. Use `txcd_00000000` on both the `products` row and all four `product_variants` rows.

Regex check: checkout validates `/^txcd_\d{8}$/` at `lib/services/checkout-pricing.ts:669`. `txcd_00000000` matches (8 digits, all zero). `[VERIFIED: lib/services/checkout-pricing.ts:669]` — read directly, line quoted: `!/^txcd_\d{8}$/.test(code)`.

**How `store.default_tax_code`/`store.require_tax_category` interact (confirmed by reading `lib/services/checkout-pricing.ts:655-672`):**

```
const defaultTaxCode = typeof storeSettings['store.default_tax_code'] === 'string'
  ? storeSettings['store.default_tax_code']
  : 'txcd_99999999';
const requireTaxCategory = storeSettings['store.require_tax_category'] === true;
const taxCodes = catalog.map(({ product, variant }, index) => {
  const code = variant.tax_category || product.tax_category || defaultTaxCode;
  ...
```

`variant.tax_category` wins over `product.tax_category`, which wins over the store default. There is no code-level default for `store.default_tax_code`/`store.require_tax_category` anywhere in the repo besides this inline fallback (`[VERIFIED: repo-wide grep, only match is this file]`) — they are runtime settings-table keys with no seeded value, so unless an admin has set them, `store.default_tax_code` is absent and the `'txcd_99999999'` inline fallback applies, and `requireTaxCategory` is `false`. **Practical effect:** because the gift card sets its own `tax_category` explicitly at both product and variant level, it is fully insulated from whatever the store default is or becomes.

Migration `migrations/0023_normalize_tax_category_codes.sql` independently confirms `txcd_99999999` = "Stripe's 'General - Tangible Goods' code and matches store.default_tax_code" — this migration retroactively fixed 30 legacy products whose seeded `tax_category = 'standard'` failed the regex in production. `[VERIFIED: migrations/0023_normalize_tax_category_codes.sql:1-21]`, quoted: `"txcd_99999999 is Stripe's \"General - Tangible Goods\" code and matches store.default_tax_code."` Note this migration only fixed the **production database** — `data/d1/seed.sql` itself still literally contains `tax_category = 'standard'` for `prod_1`..`prod_30` (`[VERIFIED: data/d1/seed.sql:38]`, quoted: `'physical', 'standard', '{"url": "products/vivid-mission-pack-0.png"...`). This is a pre-existing, out-of-scope gap (re-seeding fresh would reproduce the old bug for those 30 products) — not something Phase 9 needs to fix, but worth flagging so the planner doesn't assume `seed.sql` is currently checkout-clean end to end; it only needs to be checkout-clean for the four *new* gift-card rows this phase adds.

### Finding 3 — `data/d1/seed.sql` applies cleanly today, but is not idempotent; production apply must target only the new block

`[VERIFIED: command output, this session]` — ran against a scratch local D1 (never touches real dev/prod data):

```bash
mkdir -p /tmp/scratch-d1-persist
mise exec -- npx wrangler d1 migrations apply mercora-db --local --persist-to /tmp/scratch-d1-persist
# → all 24 migrations applied ✅, including 0023_normalize_tax_category_codes.sql

mise exec -- npx wrangler d1 execute mercora-db --local --persist-to /tmp/scratch-d1-persist --file data/d1/seed.sql
# → "🚣 8 commands executed successfully."

mise exec -- npx wrangler d1 execute mercora-db --local --persist-to /tmp/scratch-d1-persist \
  --command "SELECT count(*) as products FROM products;"
# → {"products": 32}
# product_variants: 33, pricing: 32, inventory: 32 (all counted this session)
```

So the CONTEXT.md-recorded concern ("Phase 5 recorded that this file had a bad bulk-insert row") is **resolved** — commit `9df5ed9`'s message says explicitly: *"Also fix 28 pre-existing product rows that omitted the `options` column, which made the products INSERT fail on a fresh database."* `[VERIFIED: git show 9df5ed9]`. The planner does not need a repair task for this.

However, re-running the same file against the now-seeded scratch database fails immediately:

```
✘ [ERROR] UNIQUE constraint failed: categories.id: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_PRIMARYKEY)
```

`[VERIFIED: command output, this session]` — the `categories` bulk `INSERT INTO` (no `OR IGNORE`) is the very first statement in the file and aborts the whole `wrangler d1 execute --file` batch on conflict. **Consequence for D-13:** production already has all 32 products/categories from the original seed. If the executor runs `wrangler d1 execute mercora-db --remote --file data/d1/seed.sql` (the whole file) against production, it will fail on the very first statement and never reach the new gift-card `INSERT OR IGNORE` block at the end. The production-apply file must be either:
- a **separate file** containing only the new `INSERT OR IGNORE` block (matches CONTEXT.md's Claude's-Discretion note: *"a separate one-off apply file is acceptable only if it is generated from, or byte-identical to, the block in `seed.sql`"*), or
- extracted via `sed`/`tail` from `seed.sql` at apply time.

Recommend: keep the canonical `INSERT OR IGNORE` block in `data/d1/seed.sql` (satisfies the roadmap's literal requirement — "recorded in `data/d1/seed.sql`"), and generate the production-apply file by extracting just that block (e.g. `sed -n '/-- BEGIN gift card/,/-- END gift card/p' data/d1/seed.sql > /tmp/gift-card-apply.sql`) rather than pointing `--file` at the whole file.

**Existing column-shape precedent to follow** (from `prod_31`/`prod_32`, the two rows added the day before, using the *modern* JSON shape — not the *legacy* bare-number shape the original 30 rows use, which only round-trips through a parser fallback):

```sql
-- variant_31 (Field Ration Resupply) — modern shape, verified data/d1/seed.sql:170
('variant_31', 'prod_31', 'FRR-001', '[]', '{"amount": 5900, "currency": "USD"}', 'active', 1,
 '{"amount": 5900, "currency": "USD"}',   -- compare_at_price: proper Money JSON
 '{"amount": 3200, "currency": "USD"}',   -- cost: proper Money JSON
 '{"value": 4.8, "unit": "lbs"}', '{"length": 12, "width": 8, "height": 6, "unit": "inches"}',
 'FRR001BAR',
 '{"quantity": 80, "status": "in_stock"}', -- inventory: proper JSON, not a bare number
 'txcd_40040000', 1, '[]', '{...}', datetime('now'), datetime('now'))
```

Contrast with the legacy shape still used by `variant_30` (`data/d1/seed.sql:168`): `compare_at_price` is the bare string `'3599'`, `inventory` is the bare string `'110'` — these only work because `lib/models/mach/products.ts`'s `parseMoneyField`/`parseInventoryField` have an explicit "legacy string number format" fallback branch (`[VERIFIED: lib/models/mach/products.ts:44-51, 54-70]`). **Use the modern JSON shape for all four gift-card variant rows** — there is no reason to reproduce the legacy quirk in new data.

### Finding 4 — Inventory JSON shape, `parseInventoryField`, `available_for_sale`, and the inventory-adjustment skip

`[VERIFIED: lib/inventory/availability.ts]` (full file read):

```ts
export function isInventoryAvailable(inventory: ProductInventory | null | undefined): boolean {
  if (!inventory?.track_inventory) return true;
  ...
}
export function isVariantAvailable(variant: Pick<ProductVariant, 'status' | 'inventory'>): boolean {
  return (variant.status == null || variant.status === 'active') &&
    isInventoryAvailable(variant.inventory);
}
```

Any inventory object where `track_inventory` is `false` or absent returns "always available", regardless of `quantity`/`status`. The `ProductInventory` type (`lib/types/mach/Product.ts:132-139`, read directly) is:

```ts
export interface MACHProductInventory {
  track_inventory?: boolean;
  quantity?: number;
  allow_backorder?: boolean;
  backorder_quantity?: number;
  lead_time_days?: number;
  location_quantities?: Record<string, number>;
}
```

Recommended seed shape for the four `product_variants.inventory` columns: `'{"track_inventory": false}'`. This is sufficient on its own — no `quantity`/`status` fields are required by the type or by `isInventoryAvailable`.

**How `parseInventoryField` treats it** (`[VERIFIED: lib/models/mach/products.ts:54-70]`, the same logic is duplicated at lines 260, 508, 698 for different query paths — all four copies were read):

```ts
const parseInventoryField = (field: any) => {
  if (!field) return { quantity: 0, status: 'out_of_stock' };
  if (typeof field === 'object') return field;
  if (typeof field === 'string') {
    if (field.startsWith('{')) return JSON.parse(field);
    ...
  }
  ...
};
```

A D1 TEXT column comes back as a string; `'{"track_inventory": false}'` starts with `{`, so it round-trips through `JSON.parse` unchanged into `{track_inventory: false}`. **Important:** if the `inventory` column is left `NULL` instead, `parseInventoryField` returns `{quantity: 0, status: 'out_of_stock'}` with **no `track_inventory` key at all** — since `track_inventory` is then `undefined` (falsy), `isInventoryAvailable` *still* returns `true` (because `!inventory?.track_inventory` is `true` either way). Both a `NULL` column and an explicit `{"track_inventory": false}` string produce "always available" — but the explicit JSON is what CONTEXT.md's Claude's-Discretion note asks for, and it self-documents intent for the next reader, so use the explicit string rather than `NULL`.

`available_for_sale` is **derived at request time**, not stored: `[VERIFIED: lib/models/mach/product-serializer.ts:30-44]`:

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

`toPublicProduct` (called by every public read path — `app/product/[slug]/page.tsx:66`, `app/category/[slug]/page.tsx:75`, `app/page.tsx:53`, `app/api/products/route.ts`, all read/`[VERIFIED]`) filters variants to `status == null || status === 'active'` and maps each through `toPublicVariant`, so `available_for_sale: true` is computed fresh on every request as long as `status` is `'active'` (or absent) and `inventory.track_inventory` is falsy. No stored `available_for_sale` column exists to seed.

**Inventory-adjustment skip** — `[VERIFIED: lib/services/inventory-adjustments.ts:97-99]`, quoted:

```ts
// Gift cards are stored value, not catalog stock. Their face value is
// issued by the paid-order effect and must never mutate variant inventory.
if (isGiftCardOrderLine(item)) continue;
```

inside `aggregateOrderDemand`, which builds the paid-decrement work list. `isGiftCardOrderLine` (`[VERIFIED: lib/gift-cards/checkout.ts:20-23]`) is `item.fulfillment_type === 'digital' && item.gift_card !== undefined` — this is an **order-item** field (set at checkout time by Phase 10's recipient customization, not by the catalogue seed), so this phase's job is only to make sure the *catalog* data (`fulfillment_type = 'digital'`, `type = 'gift_card'`) is correct; the skip logic itself is already correct and already shipped (v1, locked by ADR-CTB-10). CAT-04's "a paid gift card order does not decrement their inventory" is proven by a unit test exercising this existing skip with a gift-card-shaped `OrderItem`, not new production code.

**Compatibility `inventory` table (separate MACH entity, `lib/db/schema/inventory.ts`):** `[VERIFIED: repo-wide grep this session]` — no file under `app/` or `components/` imports `lib/models/mach/inventory.ts`, and no query in `lib/models/mach/products.ts` joins against the standalone `inventory` table; `deserializeProduct` reads inventory exclusively from the `product_variants.inventory` JSON column. Recommend **skipping** compatibility rows in the `inventory` table for the four gift-card variants — nothing in the storefront read path consumes them. (CONTEXT.md explicitly leaves this to Claude's Discretion; this is the evidence for choosing "skip.")

**Existing test coverage (gap confirmed):** `[VERIFIED: filesystem check this session]` — there is no `tests/unit/lib/inventory/` directory at all (zero tests for `availability.ts`). `tests/unit/lib/services/inventory-adjustments.test.ts` exists but has zero occurrences of the string `"gift"` (`[VERIFIED: grep, 0 matches]`) — the gift-card skip branch in `aggregateOrderDemand` is currently untested. `tests/unit/lib/models/mach/product-serializer.test.ts` exists (tests `toPublicProduct`/`toWireProduct`/`fromWireProduct`) but was not checked for gift-card-specific coverage; treat `available_for_sale` for an untracked-inventory variant as untested until proven otherwise. All three are Wave 0 gaps — see Validation Architecture.

### Finding 5 — Product page / card rendering: variant `Select`, pricing, and `default_variant_id`

`[VERIFIED: app/product/[slug]/ProductDisplay.tsx]` (relevant excerpts read directly):

```ts
const variants = product.variants || [];
const defaultVariant = variants.find((variant) => variant.id === product.default_variant_id) || variants[0];
const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(defaultVariant?.id);
const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || defaultVariant;
const price = selectedVariant?.price?.amount ?? 0;
const available = selectedVariant?.available_for_sale ??
  (selectedVariant ? isVariantAvailable(selectedVariant) : false);
```

and, inside the render (`ProductDisplay.tsx:278-306`), the variant picker only appears when `variants.length > 1`:

```tsx
{variants.length > 1 && (
  <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
    ...
    {variants.map((variant) => {
      const optionDisplay = variant.option_values?.map((value) => `${value.value}`).join(", ") || `Variant ${variant.id}`;
      const priceDisplay = variant.price ? Money.fromStored(variant.price).format() : "";
      ...
```

Four variants trigger this automatically; each `SelectItem` shows its own `option_values`-derived label and its own formatted price with **no code change required**. `product.default_variant_id` must be set to one of the four gift-card variant ids (recommend the `$25` variant, `GC-025`, as the lowest/"starting" denomination shown by default and on the card).

`[VERIFIED: components/ProductCard.tsx:79-89]` — the card (Featured grid, home page, category page) shows only the **default variant's** price, with no interactive selector:

```ts
const defaultVariant: ProductVariant | undefined = ...
const price = defaultVariant?.price?.amount ?? null;
const isAvailable = defaultVariant?.available_for_sale ??
  (defaultVariant ? isVariantAvailable(defaultVariant) : false);
```

`[VERIFIED: components/admin/ProductEditor.tsx:343]` — `product.options` is read only as a raw JSON textarea (`JSON.stringify(product.options, null, 2)`) for the admin editor; it is **not** consumed by any storefront rendering path (`[VERIFIED: repo-wide grep, only match outside admin is the type definition]`). Functional variant selection is driven entirely by each variant's own `option_values` + `price`, not by `product.options`. This means the `options` column just needs to be valid JSON in the existing MACH shape (`[{id, name, type, values}]`, matching the pattern at `data/d1/seed.sql:38`) for the admin editor to open cleanly — it carries no functional risk.

**Image resolution** — `[VERIFIED: lib/utils/product-image.ts, full file]` — `resolveProductImageUrl`/`resolveProductImageSrc` accept either the "flat" shape (`{url, alt_text}`, what every existing seed row uses) or the MACH admin-editor shape (`{type, file: {url}, accessibility}`), reading `primary_image` first, falling back to the first entry of `media`. Use the flat shape (`{"url": "products/gift-card-33.png", "alt_text": "Voltique Gift Card"}`) for both `primary_image` and the single `media` entry, matching every other seeded product (`[VERIFIED: data/d1/seed.sql:38-39]` pattern).

### Finding 6 — Home/Featured/Category query paths

`[VERIFIED: app/page.tsx:39-54]`, quoted: `const featuredProducts = (await getProductsByCategory("cat_1")) ... .slice(0, 3);` — confirms D-03's framing exactly: the home page takes only the first 3 of `cat_1` in table order, so a `prod_33` inserted after `prod_32` will not appear there by construction, and no code guards against a 4th+ product — this is expected, not a bug.

`app/category/[slug]/page.tsx:75` calls `toPublicProduct` over the full `getProductsByCategory('cat_1')` result (`[VERIFIED]`), so `/category/featured` shows the gift card last, in table order, per D-02 — once corrected to `prod_33` per Finding 1.

### Finding 7 — Workers AI image generation: exact precedent, one day old

`[VERIFIED: git show 9df5ed9]` + `[VERIFIED: user memory note "catalogue-images-via-workers-ai", modified 2026-09-08T05:46:33Z]` (session-scoped project memory, read directly) — this exact pipeline was run the day before this phase's context was gathered, to produce the images now at `data/r2/products/field-ration-resupply-31.png` and `data/r2/products/campfire-smores-kit-32.png` (`[VERIFIED: ls data/r2/products/, both files present]`). Quoted from the memory note:

> "generated new ones with Workers AI `@cf/leonardo/lucid-origin` via a node script using `getPlatformProxy` from `node_modules/wrangler/wrangler-dist/cli.js` (remoteBindings: true) — the wrangler OAuth login already has `ai:write`, so no API token is needed. Prompt with "no text, no lettering, no logos" or labels come out garbled."
> "Save into `data/r2/products/<slug>-<n>.png`... then `npx wrangler r2 object put voltique-images/<key> --file ... --remote`"

No committed script file exists under `scripts/` for this (`[VERIFIED: repo-wide grep for "lucid-origin"/"getPlatformProxy"/"leonardo", zero hits outside this phase's own CONTEXT.md]`) — it is written ad hoc by the executor each time, per D-07 ("The executor generates the render ... through the existing `getPlatformProxy` script path"). The invocation shape (not independently re-verified this session beyond the memory note, since it requires live Workers AI credentials to actually execute — `[CITED: user memory note]`, LOW-risk since it was run successfully one day prior by the same account):

```js
// getPlatformProxy import path, per the memory note and D-07
const { getPlatformProxy } = require('/absolute/path/to/node_modules/wrangler/wrangler-dist/cli.js');
const { env } = await getPlatformProxy({ configPath: 'wrangler.jsonc', remoteBindings: true });
const result = await env.AI.run('@cf/leonardo/lucid-origin', {
  prompt: '<matte charcoal gift card, olive-drab accent, propped on seamless near-black studio set, soft studio light, no text, no lettering, no logos, no numerals>',
  width: 1024,
  height: 1536,
});
// result is a binary stream/ReadableStream — write to a PNG file at data/r2/products/gift-card-33.png
```

Followed by:

```bash
npx wrangler r2 object put voltique-images/products/gift-card-33.png --file data/r2/products/gift-card-33.png --remote
```

**AGENTS.md constraints that apply:** no secrets in the repo (none needed — the wrangler OAuth login already carries `ai:write`); "dev must not create Cloudflare resources" — this is not a new resource, it is an object `put` into the existing public `voltique-images` bucket, matching D-07/D-13's framing of this as an operator action equivalent to `wrangler secret put` in earlier phases. `voltique-images` is confirmed public (`[VERIFIED: user memory note "voltique-r2-buckets-are-public"]`) — no sensitive data risk.

### Finding 8 — Production apply command shape, `wrangler.jsonc` D1 binding, and the stale docs path

`[VERIFIED: wrangler.jsonc:35-40]`:

```jsonc
"d1_databases": [
  { "binding": "DB", "database_name": "mercora-db", "database_id": "a27c0044-672d-4355-aa47-4410746f45f9" }
],
```

Confirms the database name used in every `wrangler d1 execute mercora-db ...` command throughout this document and CONTEXT.md D-13 is correct.

Production apply and read-back:

```bash
mise exec -- npx wrangler d1 execute mercora-db --remote --file <gift-card-only.sql>
mise exec -- npx wrangler d1 execute mercora-db --remote --command "SELECT id, name, slug, type, fulfillment_type, tax_category FROM products WHERE id='prod_33';"
mise exec -- npx wrangler d1 execute mercora-db --remote --command "SELECT id, sku, price, tax_category, inventory FROM product_variants WHERE product_id='prod_33';"
curl -sI https://voltique.russellkmoore.me/product/gift-card   # or the deployed origin; confirms 200
```

(`--remote` flag is required for a production/remote D1 target; `[VERIFIED: earlier local-vs-remote wrangler output this session shows the flag distinguishing local from remote target]`.)

`[VERIFIED: docs/DEPLOYMENT_SETUP.md:279-283]`, quoted:

```
### **Step 2: Seed Data (Optional)**
npx wrangler d1 execute mercora-db --file=./lib/db/seed.sql
```

Confirms the stale path (`./lib/db/seed.sql` does not exist; the real file is `data/d1/seed.sql`) and confirms the documented command is also missing `--remote`/`--local` — under current wrangler (v4.129.0, `[VERIFIED: npx wrangler --version]`) this flag is not optional for hitting a real target. Correcting this doc line is in scope per CONTEXT.md ("Correcting that line is in scope for whichever plan documents the production apply").

`[VERIFIED: docs/database-migrations.md:13]`, quoted: `"does not seed or erase data"` — confirms catalogue seed data is explicitly outside ADR-DBM's migration gate, matching D-13.

### Finding 9 — Gate/test surface this phase touches

- `tests/unit/scripts/dev-seed-guard.test.ts` (`[VERIFIED: full file header read]`) only asserts that the dev-only fixture order id `dev-order-001` never appears in `data/d1/seed.sql` or any `migrations/*.sql` file, and that exactly one file under `scripts/` references `data/d1/seed-dev.sql`. Adding gift-card rows to `seed.sql` does not touch this fixture id and will not break this test, but the file **is** re-read by it — a syntax break in `seed.sql` (e.g. malformed SQL string escaping in the description text) would still be caught by other gates (D1 apply itself), not by this test.
- `npm run check:migrations -- --base <sha>` (`scripts/check-migration-safety.mjs`, `[VERIFIED: file header read]`) only inspects **newly added files under `migrations/`**; this phase adds none, so this gate is a no-op for Phase 9's changes (still runs in CI on the PR regardless).
- `npm run scan:tokens` scans component/CSS files for hardcoded colors; this phase touches no `app/`/`components/` files (per D-11, no template change), so it has nothing new to scan.
- `npm run docs:lint` (`scripts/docs-lint.mjs`) checks dead-path references and relative links in docs; fixing the stale `./lib/db/seed.sql` path in `docs/DEPLOYMENT_SETUP.md` is a correction, not a new risk — `[VERIFIED: scripts/docs-lint.mjs, existsSync-based path-checking logic confirmed present]`, though the exact regex that decides which docs strings are path-checked was not traced token-by-token this session; run `npm run docs:lint` after the doc edit to confirm.
- `npm test` (vitest) is where the new availability/inventory-adjustment/serializer tests land (see Validation Architecture below).

## Standard Stack

No new libraries. This phase uses only tooling already in the repo:

| Tool | Version (verified) | Purpose |
|------|---------------------|---------|
| `wrangler` | 4.129.0 `[VERIFIED: npx wrangler --version]` | D1 execute (local scratch + production), R2 object put |
| `vitest` | existing project config | New unit tests for availability/inventory-skip/serializer |
| Workers AI `@cf/leonardo/lucid-origin` | n/a (managed model binding) | Image generation, same model used one day prior for `prod_31`/`prod_32` |

## Architecture Patterns

### Data flow for this phase

```
data/d1/seed.sql (new INSERT OR IGNORE block: prod_33, variant_33-36, price_33-36)
        │
        ├──► scratch local D1 (verification only, this research session)
        │
        └──► production D1, via `wrangler d1 execute mercora-db --remote --file <extracted-block>.sql`
                   │
                   ▼
        toPublicProduct() / toPublicVariant()  ◄── read at request time by:
                   │                                - app/page.tsx (home, first 3 of cat_1 — NOT this product)
                   │                                - app/category/[slug]/page.tsx (Featured grid — last)
                   │                                - app/product/[slug]/page.tsx (/product/gift-card)
                   ▼
        ProductCard.tsx / ProductDisplay.tsx  (existing components, no changes needed)
                   │
                   ▼
        resolveProductImageSrc() ──► R2 public bucket `voltique-images/products/gift-card-33.png`
                                     (generated once via Workers AI, uploaded via `wrangler r2 object put --remote`)

Checkout-adjacent (already shipped, locked by ADR-CTB-10 — proven by new tests, not new code):
        product.tax_category='txcd_00000000' ──► checkout-pricing.ts tax-code validation (passes regex, no tax charged)
        variant.inventory={"track_inventory": false} ──► isInventoryAvailable() → always true
        OrderItem.fulfillment_type='digital' + .gift_card ──► isGiftCardOrderLine() → inventory-adjustments.ts skips decrement
```

### Recommended `data/d1/seed.sql` block structure

```sql
-- =====================================================
-- Gift Card Product (Phase 9, idempotent — safe to re-run against production)
-- =====================================================
INSERT OR IGNORE INTO products (id, name, description, slug, status, external_references, created_at, updated_at, brand, categories, tags, options, default_variant_id, fulfillment_type, tax_category, primary_image, media, seo, rating, related_products, extensions) VALUES
('prod_33', 'Voltique Gift Card', '{"en": "..."}', 'gift-card', 'active', '{}', datetime('now'), datetime('now'), 'Mercora', '["cat_1"]', '["gift", "present", "voucher", ...]', '[{"id": "amount", "name": "Amount", "type": "select", "values": [...]}]', 'variant_33', 'digital', 'txcd_00000000', '{"url": "products/gift-card-33.png", "alt_text": "Voltique Gift Card"}', '[{"url": "products/gift-card-33.png", "alt_text": "Voltique Gift Card"}]', '{...}', null, '[]', '{...}');

INSERT OR IGNORE INTO product_variants (id, product_id, sku, option_values, price, status, position, compare_at_price, cost, weight, dimensions, barcode, inventory, tax_category, shipping_required, media, attributes, created_at, updated_at) VALUES
('variant_33', 'prod_33', 'GC-025', '[{"option_id": "amount", "value": "$25"}]', '{"amount": 2500, "currency": "USD"}', 'active', 1, NULL, NULL, NULL, NULL, NULL, '{"track_inventory": false}', 'txcd_00000000', 0, '[]', '{}', datetime('now'), datetime('now')),
('variant_34', 'prod_33', 'GC-050', '[{"option_id": "amount", "value": "$50"}]', '{"amount": 5000, "currency": "USD"}', 'active', 2, NULL, NULL, NULL, NULL, NULL, '{"track_inventory": false}', 'txcd_00000000', 0, '[]', '{}', datetime('now'), datetime('now')),
('variant_35', 'prod_33', 'GC-100', '[{"option_id": "amount", "value": "$100"}]', '{"amount": 10000, "currency": "USD"}', 'active', 3, NULL, NULL, NULL, NULL, NULL, '{"track_inventory": false}', 'txcd_00000000', 0, '[]', '{}', datetime('now'), datetime('now')),
('variant_36', 'prod_33', 'GC-200', '[{"option_id": "amount", "value": "$200"}]', '{"amount": 20000, "currency": "USD"}', 'active', 4, NULL, NULL, NULL, NULL, NULL, '{"track_inventory": false}', 'txcd_00000000', 0, '[]', '{}', datetime('now'), datetime('now'));

-- pricing table row(s): Claude's Discretion (D-CONTEXT) — add only if a functional read path needs it (verify before adding)
```

Column lists and NULL/`'[]'`/`'{}'` placement above are copied verbatim from `INSERT INTO product_variants (...)` at `data/d1/seed.sql:107` (`[VERIFIED: data/d1/seed.sql:107]`) and the modern-shape example at `variant_31`/`variant_32` (Finding 3) — the planner should confirm the exact column order by reading `data/d1/seed.sql:107` directly before writing, since column order is load-bearing for a positional `VALUES` list.

### Anti-Patterns to Avoid

- **Reproducing the legacy bare-number shape** (`compare_at_price`/`cost`/`inventory` as plain strings like `'110'`) for the new rows — it only works via a parser fallback and has no reason to exist in new data (Finding 3).
- **Pointing `--remote --file` at the whole `data/d1/seed.sql`** for the production apply — it will abort on the first `categories` insert (Finding 3). Extract just the new block.
- **Adding compatibility rows to the standalone `inventory` table** — no live read path consumes them (Finding 4); skip unless a future phase proves otherwise.
- **Using `txcd_10502000`** ("Gift Card" category) instead of `txcd_00000000` — the former's taxability is jurisdiction-dependent, which does not satisfy D-09's "charges no tax" requirement (Finding 2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Never-out-of-stock inventory | New "digital product" branch in `isInventoryAvailable` | `{"track_inventory": false}` in the seeded `inventory` JSON | Existing function already treats this as always-available; zero code change (Finding 4) |
| Skip inventory decrement for gift cards | New gift-card special-case in `inventory-adjustments.ts` | Already-shipped `isGiftCardOrderLine` skip | Locked by ADR-CTB-10; this phase only needs to prove it with a test |
| Variant price display per denomination | New price-selector component | Existing `ProductDisplay`/`ProductCard` variant `Select` + `option_values`/`price` | Already renders correctly for any N-variant product (Finding 5) |

**Key insight:** every piece of "logic" CAT-01..04 sounds like it needs already exists and is already tested indirectly by other product types (subscriptions, physical goods with `track_inventory: false` conceptually). The actual net-new surface is: four SQL rows, one image, and tests that pin down behavior that today has zero direct coverage.

## Common Pitfalls

### Pitfall 1: Assuming `prod_31` is free
**What goes wrong:** Following CONTEXT.md's literal "next product id, prod_31" note without re-checking `data/d1/seed.sql` produces a `PRIMARY KEY`/`UNIQUE` collision with the existing Field Ration Resupply product on apply.
**Why it happens:** CONTEXT.md was written from a codebase snapshot that was one commit stale relative to the file's actual state by the time planning starts.
**How to avoid:** Re-grep `data/d1/seed.sql` for the actual max id immediately before writing SQL (Finding 1); this research confirms `prod_33` as of 2026-09-08.
**Warning signs:** `UNIQUE constraint failed` on apply.

### Pitfall 2: Applying the whole `seed.sql` to production
**What goes wrong:** `wrangler d1 execute mercora-db --remote --file data/d1/seed.sql` aborts on the very first `categories` insert because production already has that row, and the gift-card block at the bottom is never reached.
**Why it happens:** The file's pre-existing bulk inserts are not `OR IGNORE`; only the new block is.
**How to avoid:** Extract only the new block into a separate file (or `sed`-slice it) before the production apply (Finding 3).
**Warning signs:** `UNIQUE constraint failed: categories.id` in the apply output, with zero rows changed.

### Pitfall 3: Using the "Gift Card" tax code and still seeing tax charged
**What goes wrong:** Seeding `tax_category = 'txcd_10502000'` (Stripe's literal "Gift Card" category) does not guarantee zero tax — Stripe's own docs say its taxability depends on jurisdiction and digital-product tax registration.
**Why it happens:** The topically-matching code name is a false friend; the actually-unconditional code is named "Nontaxable" (`txcd_00000000`), not "Gift Card."
**How to avoid:** Use `txcd_00000000` (Finding 2).
**Warning signs:** A test-mode Stripe Tax calculation returns nonzero tax for the gift-card line once Phase 10 wires checkout.

### Pitfall 4: Leaving `data/d1/seed.sql`'s `options`/`option_values` column order wrong
**What goes wrong:** The `product_variants` INSERT is fully positional (`VALUES (...)` with no named columns per row); getting the column order wrong silently miswrites, e.g., `inventory` data into the `tax_category` column, since SQLite does not error on a type mismatch in a loosely-typed TEXT column.
**Why it happens:** The column list is declared once at the top of the `INSERT INTO product_variants (...)` statement and then implicitly reused for every row in the same statement; a plan or human copying an example row from a different table/statement can misalign columns.
**How to avoid:** Copy the column list from `data/d1/seed.sql:107` directly, and copy the modern-shape example row (`variant_31`) verbatim as a template, changing only the values (Finding 3).
**Warning signs:** `parseInventoryField`/`parseMoneyField` throwing on `JSON.parse`, or a variant rendering with an obviously wrong price/tax code.

## Code Examples

### Test: `isInventoryAvailable` treats `track_inventory: false` as always available

```ts
// tests/unit/lib/inventory/availability.test.ts (new file — Wave 0 gap)
import { describe, expect, it } from 'vitest';
import { isInventoryAvailable, isVariantAvailable } from '@/lib/inventory/availability';

describe('gift-card-shaped inventory (CAT-04)', () => {
  it('is always available when track_inventory is false', () => {
    expect(isInventoryAvailable({ track_inventory: false })).toBe(true);
  });
  it('is always available when inventory is absent', () => {
    expect(isInventoryAvailable(undefined)).toBe(true);
    expect(isInventoryAvailable(null)).toBe(true);
  });
  it('a status:"active" variant with untracked inventory is available_for_sale-eligible', () => {
    expect(isVariantAvailable({ status: 'active', inventory: { track_inventory: false } })).toBe(true);
  });
});
```

### Test: paid-order inventory decrement skips a gift-card line

```ts
// extend tests/unit/lib/services/inventory-adjustments.test.ts (currently 0 "gift" matches — Wave 0 gap)
import { isGiftCardOrderLine } from '@/lib/gift-cards/checkout';
// Build an OrderItem with fulfillment_type: 'digital', gift_card: {...}, and assert
// aggregateOrderDemand-equivalent behavior (exercise via stageInventoryAdjustments's
// public surface, or directly assert isGiftCardOrderLine(item) === true and that the
// item is excluded from whatever demand map the paid-decrement path builds).
```

Source for the exact skip site (verified this session): `lib/services/inventory-adjustments.ts:97-99`:
```ts
if (isGiftCardOrderLine(item)) continue;
```

## Runtime State Inventory

Not applicable — this is a greenfield data-addition phase (new product), not a rename/refactor/migration. No existing runtime state references the strings `gift-card`, `prod_33`, or `Voltique Gift Card` today (`[VERIFIED: grep across repo this session found only CONTEXT.md/DISCUSSION-LOG.md — planning artifacts, not runtime state]`).

## Common Pitfalls

(see above — merged into the single Common Pitfalls section for this phase)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | The exact `getPlatformProxy`/Workers AI invocation shape (import path, `remoteBindings: true`, binary-to-PNG handling) reproduces correctly for a new prompt — based on a memory note describing a session from the day before, not re-executed this session (no live Workers AI credentials available to this research pass) | Finding 7, Image pipeline | Low — the same account ran this successfully one day prior for two other products; if the script shape has drifted, the executor will discover it immediately on first run and can adjust, since D-07 gives full discretion over candidate selection with no human gate blocking iteration |
| A2 | `docs/docs-lint.mjs`'s path-existence check covers inline bash code-fence paths (like the stale `./lib/db/seed.sql` reference), not just markdown `[text](path)` links — confirmed the script does existence-checking, but the exact regex scope for *which* strings get checked was not traced line-by-line | Finding 9 / Gates | Low — worst case, fixing the stale path either passes trivially or the gate doesn't check it at all; either way running `npm run docs:lint` after the edit resolves the uncertainty before commit |
| A3 | Recommending `GC-025` ($25 variant) as `default_variant_id` — CONTEXT.md leaves this to Claude's Discretion but doesn't state a specific choice; this is this research's recommendation, not a verified requirement | Finding 5, Standard Stack SQL example | Low — cosmetic only; any of the four variants would satisfy CAT-01..04, this just affects which price shows first on the card |

## Open Questions

1. **Should a `pricing` table row be added for the four variants?**
   - What we know: `prod_31`/`prod_32` both have `pricing` rows (`price_31`/`price_32`); `variant_31`/`variant_32` also carry price directly on `product_variants.price`. No code path was found this session that reads the `pricing` table for storefront display (checkout/storefront read `variant.price` directly per `checkout-pricing.ts:653`/`ProductDisplay.tsx:170`).
   - What's unclear: whether `pricing` table rows are consumed by any admin or reporting path not covered by this session's grep sweep (e.g., BI dashboard, admin product list).
   - Recommendation: Claude's Discretion note in CONTEXT.md already flags this as optional; add rows for consistency with all 32 other products at negligible cost (matches every existing row's shape) unless the planner finds a reason not to.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| `wrangler` CLI | D1 apply, R2 upload, Workers AI image gen | ✓ | 4.129.0 `[VERIFIED]` | — |
| Node.js | test runs, any local scripting | ✓ | 24.18.1 `[VERIFIED]`, matches `.node-version` pin | — |
| Workers AI binding (`env.AI`) + `ai:write` OAuth scope | Image generation | Not independently re-verified this session (requires live credentials); confirmed by memory note it worked 2026-09-07 under the same account | — | If unavailable, executor surfaces the failure immediately — no code fallback needed, this is an operator-run step per D-07 |
| Production D1 (`mercora-db`) access | Production apply | Assumed available under Russell's existing wrangler OAuth login per D-13 (same pattern as prior `wrangler secret put` operations) | — | — |

No missing dependencies with no fallback — every dependency in this phase is tooling already proven working by the immediately preceding commit (`9df5ed9`).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run`), config at repo root; a separate Workers-runtime config (`vitest.workers.config.mts`) exists but is not needed for this phase's pure-function tests |
| Config file | `vitest.config.*` (existing, unmodified) |
| Quick run command | `mise exec -- npx vitest run tests/unit/lib/inventory/availability.test.ts tests/unit/lib/services/inventory-adjustments.test.ts tests/unit/lib/models/mach/product-serializer.test.ts` |
| Full suite command | `mise exec -- npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|---------------|
| CAT-01 | Seed SQL applies cleanly (idempotent block, no PK collisions) | integration (D1 apply) | `mise exec -- npx wrangler d1 execute mercora-db --local --persist-to <scratch> --file <extracted-block>.sql` then `--command "SELECT * FROM products WHERE id='prod_33'"` | ❌ Wave 0 — this is a manual/scripted verification step, not a vitest file; consider a small assertion script or fold into a plan verify step |
| CAT-01 | `tax_category` passes checkout's regex for both product and all 4 variants | unit | New test in a `checkout-pricing`-adjacent file, or a focused regex assertion: `expect(/^txcd_\d{8}$/.test('txcd_00000000')).toBe(true)` | ❌ Wave 0 |
| CAT-02 | `toPublicProduct`/`toPublicVariant` project the seeded gift card correctly (`available_for_sale: true`, price per variant) | unit | `mise exec -- npx vitest run tests/unit/lib/models/mach/product-serializer.test.ts` | ⚠️ file exists but gift-card-shaped fixture not yet added — extend it |
| CAT-03 | Image resolves via `resolveProductImageSrc` for the flat `{url, alt_text}` shape | unit | `tests/unit/lib/utils/product-image.test.ts` already exists and tests the flat shape generically `[VERIFIED: file exists]`; no new test needed unless the planner wants a gift-card-specific fixture | ✅ covered generically |
| CAT-04 | `isInventoryAvailable`/`isVariantAvailable` return `true` for `{track_inventory: false}` | unit | `mise exec -- npx vitest run tests/unit/lib/inventory/availability.test.ts` | ❌ Wave 0 — new file, new directory |
| CAT-04 | Paid-order inventory decrement skips a gift-card-shaped `OrderItem` | unit | `mise exec -- npx vitest run tests/unit/lib/services/inventory-adjustments.test.ts` | ⚠️ file exists, 0 gift-card cases today — extend it |

### Sampling Rate

- **Per task commit:** the quick run command above (three targeted files + the D1 scratch-apply check for the SQL task)
- **Per wave merge:** `mise exec -- npm test`
- **Phase gate:** full suite green (`npm test`, `npm run lint`, `npm run typecheck`, `npm run cf-typecheck`, `npm run build`) before `/gsd-verify-work`, per AGENTS.md's CI gate list — note `npm run scan:tokens` and `npm run build:themes:check` are unaffected by this phase's changes but remain part of the standard gate order

### Wave 0 Gaps

- [ ] `tests/unit/lib/inventory/availability.test.ts` — new file, new directory; covers CAT-04 (`isInventoryAvailable`/`isVariantAvailable` for untracked inventory)
- [ ] Extend `tests/unit/lib/services/inventory-adjustments.test.ts` — add a gift-card-shaped `OrderItem` case; covers CAT-04 (decrement skip)
- [ ] Extend `tests/unit/lib/models/mach/product-serializer.test.ts` — add a gift-card-shaped product fixture (4 variants, `tax_category: 'txcd_00000000'`, `inventory: {track_inventory: false}`); covers CAT-02/CAT-04 (`available_for_sale` derivation, public projection strips nothing unexpected)
- [ ] Confirm whether `tests/unit/lib/utils/product-image.test.ts` (or equivalent) already exists before adding new image-resolution coverage for CAT-03 — not located in this research session, check first
- [ ] A scripted or manual D1-apply verification step for CAT-01 (not a vitest unit test by nature — it's a real SQL apply against a scratch/local database, as this research session did)

## Security Domain

`security_enforcement` is not explicitly disabled in `.planning/config.json` (absent → treated as enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | No auth surface changes; this is catalogue data |
| V3 Session Management | No | — |
| V4 Access Control | No | Public product data, same visibility as every other catalogue product |
| V5 Input Validation | Marginal | The `/^txcd_\d{8}$/` tax-code regex (already-shipped, `checkout-pricing.ts:669`) is the only validation surface this phase's data must pass; no new validation code is written |
| V6 Cryptography | No | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Malformed/unescaped SQL literal in a hand-written seed row (e.g. an unescaped `'` in description copy) | Tampering (self-inflicted, not an external attacker — this is static seed data, not user input) | SQLite single-quote escaping (`''`) as used throughout `data/d1/seed.sql` (e.g. `Campfire S''mores Kit`, `[VERIFIED: data/d1/seed.sql:100]`); verify by actually applying the SQL (Finding 3's method), not just visual review |
| A future product row accidentally omitting `tax_category`, silently falling through to `store.default_tax_code`/`txcd_99999999` and charging tax on a card that should be tax-free | Tampering / Information Disclosure (financial correctness, not a security vuln per se) | Explicit `tax_category` on both product and all 4 variant rows (Finding 2); a unit test asserting the seeded value, not just eyeballing the SQL |

This phase introduces no new attack surface — it is exclusively static catalogue data flowing through already-hardened, already-tested (elsewhere) read paths. The one genuinely security-adjacent property (correct tax classification) is covered by Finding 2 and the Validation Architecture's CAT-01 regex test.

## Sources

### Primary (HIGH confidence)
- `data/d1/seed.sql` (full structural read + targeted greps) — schema, existing id sequence, column order, legacy vs. modern JSON shapes
- `lib/inventory/availability.ts`, `lib/services/inventory-adjustments.ts`, `lib/gift-cards/checkout.ts`, `lib/models/mach/products.ts`, `lib/models/mach/product-serializer.ts`, `lib/services/checkout-pricing.ts`, `lib/db/schema/products.ts`, `lib/types/mach/Product.ts`, `lib/utils/product-image.ts`, `app/product/[slug]/ProductDisplay.tsx`, `components/ProductCard.tsx`, `components/admin/ProductEditor.tsx`, `app/page.tsx`, `app/category/[slug]/page.tsx`, `app/product/[slug]/page.tsx`, `app/api/admin/vectorize/route.ts`, `wrangler.jsonc`, `docs/DEPLOYMENT_SETUP.md`, `docs/database-migrations.md`, `migrations/0023_normalize_tax_category_codes.sql` — all read directly this session
- `git show 9df5ed9` — the immediate precedent commit for this exact workflow (seed rows + Workers AI image + production D1/R2 apply for a new catalogue product), one day prior
- Live scratch-D1 verification: 24 migrations applied cleanly, `data/d1/seed.sql` applied cleanly (32 products/33 variants/32 prices/32 inventory rows), then confirmed non-idempotent on replay (`UNIQUE constraint failed: categories.id`) — command output captured this session
- `docs.stripe.com/tax/tax-categories` (fetched twice, cross-checked) — `txcd_00000000` (Nontaxable) vs. `txcd_10502000` (Gift Card, jurisdiction-dependent) vs. `txcd_99999999` (General - Tangible Goods, the store's fallback)

### Secondary (MEDIUM confidence)
- User project memory note "catalogue-images-via-workers-ai" (session-scoped, written by the same account the day before) — the Workers AI image-generation invocation shape, not independently re-executed this session

### Tertiary (LOW confidence)
- None retained — every claim above was either verified against a file/command this session or cited to Stripe's own documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all tooling versions confirmed via direct command execution
- Architecture: HIGH — every rendering/read path (`ProductDisplay`, `ProductCard`, `toPublicProduct`, home/category queries, availability, inventory-adjustment skip) was read directly this session, not inferred from CONTEXT.md
- Pitfalls: HIGH — Pitfalls 1–2 were discovered by actually running the seed apply against a scratch D1, not by inspection alone; Pitfall 3 is grounded in a primary-source doc fetch, not training-data recall

**Research date:** 2026-09-08
**Valid until:** 14 days (catalogue data + Stripe tax-code references are stable, but `data/d1/seed.sql`'s id sequence is actively moving — commit `9df5ed9` landed the day before this research; re-verify the max id immediately before writing SQL if planning is delayed)
