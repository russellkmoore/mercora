# Phase 9: Gift Card Catalogue - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning

<domain>
## Phase Boundary

One active catalogue product, "Voltique Gift Card", with `type = 'gift_card'`, `fulfillment_type = 'digital'`, and four denomination variants ($25 / $50 / $100 / $200), recorded as idempotent SQL in `data/d1/seed.sql` and applied to production D1; one matching catalogue image in `data/r2/products/` uploaded to the public `voltique-images` bucket; variants that never read as out of stock and are never decremented by a paid order (CAT-01..04).

Not in this phase: the recipient form and any change to add-to-cart, cart, or checkout (Phase 10); production flags and key secrets (Phase 11); the support article, Volt re-index, and Terms section (Phase 12); anything in `lib/gift-cards/` money paths (locked, ADR-CTB-10).

</domain>

<decisions>
## Implementation Decisions

### Placement and discovery
- **D-01:** The gift card belongs to the Featured category (`cat_1`) only. No other category membership; a dedicated Gift Cards category stays deferred (CAT-05).
- **D-02:** It sits last in the Featured grid in natural table order (insert as the next free product id — `prod_33` at research time, since `prod_31` and `prod_32` were added by PR #92). No ordering code is added to the category page.
- **D-03:** It does not need to appear among the home page's three Featured cards. Roadmap success criterion 2's "renders on the home page" is read as "renders wherever the Featured category is rendered, like any other product"; the home page query and hero are untouched. If the planner wants a home-page proof, it is the Featured category page (`/category/featured`), not `/`.
- **D-04:** No footer link. Russell asked whether a footer link would hardcode the template to sample data; it would, since the footer is fully data-driven today (CMS navigation pages plus store-config policy URLs). The two data-driven alternatives are recorded under Deferred Ideas and were declined for now.

### Image
- **D-05:** One shared image: a matte charcoal gift card with an olive-drab accent, propped on the same seamless near-black studio set as the gear, soft studio light, no lettering, no logos, no numerals. Portrait 1024×1536 PNG like every other product shot.
- **D-06:** The product's `primary_image` and `media` both point at that one file; the four variants carry no variant media and inherit it. Naming follows the existing `<slug>-<n>.png` pattern under `data/r2/products/` (so `gift-card-31.png` or similar; planner picks the exact `n`).
- **D-07:** The executor generates the render with Workers AI `@cf/leonardo/lucid-origin` through the existing `getPlatformProxy` script path, chooses the best candidate against the style notes itself, saves it to `data/r2/products/`, and uploads it with `wrangler r2 object put ... --remote`. No human gate on image choice; the chosen image is shown to Russell in the summary afterwards. Discarded candidates are not committed.

### Catalogue record
- **D-08:** Name "Voltique Gift Card", slug `gift-card` (URL `/product/gift-card`). Brand follows the seed's existing brand value.
- **D-09:** Tax: the product and all four variants carry Stripe's nontaxable tax code in `tax_category` so checkout charges no tax on the card itself; tax is collected when the card is spent on goods. The researcher confirms the exact `txcd_` value from Stripe's tax-code list (checkout validates `/^txcd_\d{8}$/`). — **Reversibility:** reversible — a data-only change to two seed columns; production rows can be updated with one `UPDATE`.
- **D-10:** `rating` is null (no stars shown) and `related_products` is empty. No seeded review count for a stored-value item.
- **D-11:** The "In Stock" availability badge stays as-is on `ProductCard` and `ProductDisplay`. No template change keyed on `fulfillment_type` in this phase.

### Go-live sequencing (not selected for discussion; Claude's default, stated so the planner does not re-ask)
- **D-12:** The product is seeded `status = 'active'` in production in this phase, with the stock option `Select` and add-to-cart controls left untouched. Between Phase 9 and Phase 10 a shopper who adds it to the cart will be refused at checkout by the existing pricing guard (`lib/services/checkout-pricing.ts` requires a recipient customization on a `gift_card` line). Accepted as a demo-site interim; Phase 10 replaces those controls. If Russell prefers `draft` until Phase 10 ships, that is a one-word change to the seed row and the production `UPDATE`.
- **D-13:** The executor applies the production SQL (`wrangler d1 execute mercora-db --remote --file <idempotent sql>`) and the R2 upload under Russell's existing wrangler OAuth login, the same way earlier phases ran `wrangler secret put`. This is catalogue data, not a schema migration, so ADR-DBM's production-migration gate does not apply, and `npm run deploy` is not involved. Verification is a read-back `SELECT` against production and a `curl` of `/product/gift-card`.
- **D-14:** Volt is not re-indexed in this phase. CAT-02's "search" is the Volt assistant on this storefront (there is no text search route); product vectorisation happens through the admin re-index route and is scheduled for Phase 12 alongside the knowledge article, so the assistant learns the article and the product in one pass.

### Claude's Discretion
- Option definition: one `select` option (label such as "Amount") with four values; option value text and whether the value carries a `$` sign. `ProductDisplay` already renders each variant's own price beside its option value, which satisfies "showing the selected denomination's price" with no code.
- Variant ids, SKUs (e.g. `GC-025` … `GC-200`), `position`, `compare_at_price` (none), `cost` (none), `weight`/`dimensions` (null), `barcode` (null), `shipping_required = 0`.
- Description copy in the Voltique voice. It must not promise anything Phase 12's article will contradict: email delivery after payment, no expiry, no cash redemption, four fixed amounts. Do not mention a delivery date (SHOP-08 defers scheduled delivery).
- `extensions` / `ai_notes` / `use_cases` / `tags` / `seo` wording, chosen so Volt can match "gift", "present", "voucher".
- Inventory JSON shape for the four variants. The availability helper treats `track_inventory` false or absent as always available, and the paid-order ledger already skips gift-card lines; the planner picks the explicit representation (`{"track_inventory": false, "status": "in_stock"}` or equivalent) and whether compatibility rows in the MACH `inventory` table are added at all. CAT-04 is proven by tests on the existing helpers with the seeded shape, not by new inventory logic.
- Whether the four rows live inline in `data/d1/seed.sql`'s existing bulk inserts or as a clearly delimited `INSERT OR IGNORE` block at the end of the file. The roadmap requires `INSERT OR IGNORE` and the file `data/d1/seed.sql`; a separate one-off apply file is acceptable only if it is generated from, or byte-identical to, the block in `seed.sql`.
- Whether a `pricing` table row is added for compatibility with the other 30 products (storefront and checkout read the variant price).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Gift card contract (locked)
- `docs/checkout-trust-boundary.md` — ADR-CTB-10, "Optional capabilities": gift cards live behind `lib/commerce/capabilities.ts`; core checkout imports nothing from the feature. Nothing in `lib/gift-cards/` changes in this milestone.
- `lib/gift-cards/checkout.ts` — `isGiftCardOrderLine` (digital + customization) is the definition the inventory ledger and fulfilment use; the seed must produce lines that satisfy it once Phase 10 adds the customization.
- `lib/services/checkout-pricing.ts` §"gift_card" (around lines 185–195 and 560–575) — promotions never target gift-card lines; a `gift_card` product must be `digital` and carry a customization or the quote is rejected. Also the tax-code validation regex (around line 663).
- `lib/services/inventory-adjustments.ts` (around line 98) — paid decrements skip gift-card lines. CAT-04's "no decrement" is already enforced here; the phase adds proof, not logic.
- `lib/inventory/availability.ts` — `isInventoryAvailable`: `track_inventory` false/absent means always available. Basis for the never-out-of-stock inventory shape.

### Catalogue data and its application
- `data/d1/seed.sql` — the 30-product sample catalogue; the gift card rows are appended here with `INSERT OR IGNORE`. Phase 5 recorded that this file had a bad bulk-insert row and is not applied by `predev`; the planner must verify it applies cleanly to a scratch local D1 before extending it.
- `docs/database-migrations.md` — ADR-DBM: what counts as a migration and how production is gated. Catalogue rows are data, not schema; no file under `migrations/` is touched.
- `docs/DEPLOYMENT_SETUP.md` §"Step 2: Seed Data" — the only documented seed-apply command. Note: it names `./lib/db/seed.sql`, a stale path; the real file is `data/d1/seed.sql`. Correcting that line is in scope for whichever plan documents the production apply.
- `docs/runtime-configuration.md` — feature flags and gift-card secret names (Phase 11 owns enabling them; Phase 9 must not).

### Image pipeline and store surfaces
- `lib/utils/product-image.ts` — the single image resolver; media URLs are bucket-relative (`products/<file>.png`) and resolve through the custom loader.
- `lib/models/mach/products.ts` — `getProductsByCategory` (table order, JSON field parsing, `parseInventoryField` defaults) and `deserializeProduct`.
- `components/ProductCard.tsx`, `app/product/[slug]/ProductDisplay.tsx` — how price, availability badge, rating, and the variant `Select` render; no change expected, used for verification.
- `app/api/admin/vectorize/route.ts` — the product + knowledge re-index Phase 12 will run.
- `docs/theming.md` — any storefront change must stay inside the 23-token contract (`npm run scan:tokens`).

### Milestone framing
- `.planning/REQUIREMENTS.md` — CAT-01..04 wording; SHOP-08 and CAT-05 deferred; out-of-scope table.
- `.planning/ROADMAP.md` §"Phase 9" — success criteria; criterion 2's home-page clause is softened by D-03.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `products.type` and `products.fulfillment_type` already exist (`lib/db/schema/products.ts`); no migration is needed for a `gift_card` / `digital` product.
- `lib/inventory/availability.ts` and `lib/services/inventory-adjustments.ts` already implement never-out-of-stock and never-decrement for untracked inventory and gift-card lines respectively. CAT-04 is a seed-shape plus test-coverage task.
- The Workers AI image path from earlier catalogue work: a node script using `getPlatformProxy` from `node_modules/wrangler/wrangler-dist/cli.js` with `remoteBindings: true` calling `@cf/leonardo/lucid-origin`; the wrangler OAuth login already has `ai:write`. Prompt must say "no text, no lettering, no logos". Existing shots: 1024×1536 portrait, near-black seamless background, olive-drab/charcoal palette, soft studio light.
- `ProductDisplay` renders a per-variant price inside the option `Select` and updates the headline price on selection, so four differently priced variants display correctly without code.
- `lib/recommendations/scoring.ts` already folds `product.type` into scoring; no change needed.

### Established Patterns
- Seed rows are bulk `INSERT INTO ... VALUES (...)` lists in `data/d1/seed.sql`; ids are sequential (`prod_30`, `variant_30`, `inv_30`, `price_30` are the current maxima). Every product carries brand "Mercora", a seeded rating, `tax_category: 'standard'`, and a `primary_image` plus one `media` entry pointing at `products/<slug>-<n>.png`.
- Local dev (`predev` → `scripts/db-local-ensure.mjs`) applies only `data/d1/seed-dev.sql` (MCP agents, a dev order). The catalogue seed is applied by hand with `wrangler d1 execute` locally and remotely.
- Production catalogue data is applied by hand with `wrangler d1 execute mercora-db --remote --file`, never by deploy scripts; R2 objects with `wrangler r2 object put voltique-images/<key> --file ... --remote`. The bucket is public; nothing sensitive goes in it.
- Checkout tax codes must match `/^txcd_\d{8}$/`; `'standard'` is not a code and falls to `store.default_tax_code` or `txcd_99999999`.
- Storefront components use token classes only; `scan:tokens` runs in CI.

### Integration Points
- Home page: `app/page.tsx` takes the first three active Featured products in table order; the gift card as the newest product row will not be among them (D-03 accepts this).
- Featured category page `/category/featured`: `getProductsByCategory('cat_1')` in table order; the card shows last (D-02).
- Product page `/product/gift-card`: standard `ProductDisplay` with the variant `Select`; Phase 10 swaps in the recipient form.
- Volt: `app/api/admin/vectorize/route.ts` indexes all products; re-index deferred to Phase 12 (D-14).
- Admin: `components/admin/ProductEditor.tsx` already exposes `type`; the seeded product should open cleanly there (worth a render check, no change expected).

</code_context>

<specifics>
## Specific Ideas

- The image should look like it belongs in the same photo shoot as the gear: same near-black seamless set, same olive-drab/charcoal palette, a single matte charcoal card standing or lying at an angle, no lettering of any kind.
- Description and metadata must line up with what Phase 12's article will promise: four amounts, delivered by email after payment, no expiry, not redeemable for cash.
- Russell explicitly does not want template code that knows about one sample-catalogue row (the footer question). Any storefront code change in this phase must key off data (`fulfillment_type`, `type`), never off the gift card's id or slug.

</specifics>

<deferred>
## Deferred Ideas

- Footer "Gift Cards" link, done data-driven: either a "Gift Cards" navigation page in Admin → Pages (appears in the Explore column automatically; natural for Phase 12 content) or a configurable gift-card URL slot next to Returns/Privacy/Terms in store config. Raised by Russell, declined for now.
- Home page placement of the gift card (a deterministic Featured order or a pinned slot) — declined; revisit if the demo needs the card above the fold.
- Availability badge wording for digital items ("Instant delivery" or hidden), keyed on `fulfillment_type` — declined for now.
- Per-denomination variant images with numerals composited in post — declined; one shared image.
- Already in REQUIREMENTS.md v2: scheduled delivery date (SHOP-08), custom amount (SHOP-09), dedicated Gift Cards category (CAT-05).

### Reviewed Todos (not folded)
- `theme-contract-dropped-properties.md`, `theme-direction-doc-backlog-06.1.md`, `theme-metadata-industry-synopsis-admin.md`, `themed-demo-deployments.md` — matched on generic keywords only ("phase", "2026"); all are theming backlog with no bearing on the gift card catalogue.

</deferred>

---

*Phase: 09-gift-card-catalogue*
*Context gathered: 2026-09-07*
