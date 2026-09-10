# Phase 9: Gift Card Catalogue - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-07
**Phase:** 9-gift-card-catalogue
**Areas discussed:** Home page placement, Image concept, Catalogue record

---

## Home page placement

| Option | Description | Selected |
|--------|-------------|----------|
| Pin it into the top three | Deterministic Featured order; gift card in one of the home page's three slots | |
| Swap a product out | Data-only: remove a product from Featured so the card lands in the first three | |
| Featured category page only | Appears in the Featured grid and Volt, not on the home page's three cards | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Last, natural order | Insert as prod_31; table order puts it last | ✓ |
| First in Featured | Requires an explicit sort position on the category page | |

| Option | Description | Selected |
|--------|-------------|----------|
| Featured only | One category membership; CAT-05 stays deferred | ✓ |
| Featured plus every top-level category | Shows in every grid as a fallback gift | |

| Option | Description | Selected |
|--------|-------------|----------|
| CMS page in Explore | A "Gift Cards" navigation page in Admin → Pages; zero code | |
| Store-config URL slot | Configurable gift-card URL next to Returns/Privacy/Terms | |
| No footer link | Featured grid and Volt are the discovery surfaces | ✓ |

**User's choice:** Featured category page only; last in natural order; Featured only; no footer link.
**Notes:** Russell asked whether a footer link would be "hardcoding the template to data". It would: the footer is fully data-driven (CMS navigation pages and store-config policy URLs). Both data-driven alternatives were presented and declined.

---

## Image concept

| Option | Description | Selected |
|--------|-------------|----------|
| Card mockup on the dark set | Matte charcoal card with olive accent on the near-black studio set; lucid-origin; no lettering | ✓ |
| Volt mascot card | Card face built around the untracked volt.png mascot, composited by hand | |
| Gift motif, no card | Wrapped parcel or ribbon in olive drab on the dark set | |

| Option | Description | Selected |
|--------|-------------|----------|
| One shared image | Product primary image plus media; variants inherit it | ✓ |
| One per denomination | Four variant images with numerals composited in post | |

| Option | Description | Selected |
|--------|-------------|----------|
| Executor generates candidates, you pick | Human gate before upload | |
| Executor picks and uploads | Executor chooses against the style notes, uploads, shows the result afterwards | ✓ |
| You generate it yourself | Plan only records the expected path | |

**User's choice:** Card mockup on the dark set; one shared image; executor picks and uploads.
**Notes:** volt.png / volt.svg in the repo root are a flat-vector robot mascot in a very different style from the catalogue; not used for the product image.

---

## Catalogue record

| Option | Description | Selected |
|--------|-------------|----------|
| "Voltique Gift Card", slug gift-card | Brand-forward title, short URL | ✓ |
| "Gift Card", slug gift-card | Neutral title | |
| "Voltique Digital Gift Card", slug digital-gift-card | Spells out email delivery in the title | |

| Option | Description | Selected |
|--------|-------------|----------|
| Nontaxable Stripe code | tax_category set to Stripe's nontaxable code; $0 tax on the card | ✓ |
| Same as other products | Leave 'standard' and fall to the store default code | |

| Option | Description | Selected |
|--------|-------------|----------|
| No rating, no related products | rating null, related_products empty | ✓ |
| Seeded rating, related gear | Plausible rating and two related packs | |
| No rating, but related gear | No stars, cross-sell row | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 'In Stock' | No template change | ✓ |
| 'Instant delivery' for digital | Badge keyed on fulfillment_type === 'digital' | |
| Hide the badge for digital | No badge for digital items | |

**User's choice:** "Voltique Gift Card" at /product/gift-card; nontaxable Stripe code; no rating or related products; keep the "In Stock" badge.
**Notes:** Russell chose "Wrap up" when offered more questions on option label, SKU format, description tone, and compare-at price; those are Claude's discretion.

---

## Claude's Discretion

- Go-live sequencing (not selected for discussion): product seeded active with the stock add-to-cart controls untouched; executor applies production SQL and R2 upload under Russell's wrangler login; Volt re-index waits for Phase 12. Stated in CONTEXT.md D-12..D-14 so the planner does not re-ask.
- Option label and value text, SKUs, variant ids, inventory JSON shape, whether `pricing` and `inventory` compatibility rows are added, description copy and metadata, image file number, and whether the rows sit inline or in a delimited block at the end of `data/d1/seed.sql`.

## Deferred Ideas

- Footer "Gift Cards" link via a CMS navigation page or a store-config URL slot.
- Home page placement (deterministic Featured order or pinned slot).
- Digital availability badge wording keyed on fulfillment_type.
- Per-denomination variant images.
- Four pending theming todos matched on generic keywords only; reviewed, not folded.
