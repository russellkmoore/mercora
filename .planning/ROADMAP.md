# Roadmap: Mercora

## Milestones

- ✅ **v1 Hardening** — Phases 1-4 (shipped 2026-09-02) — [archive](milestones/v1-ROADMAP.md)
- ✅ **v2 Themeable Storefront** — Phases 5-8.2 (shipped 2026-09-05) — [archive](milestones/v2-ROADMAP.md)
- 🚧 **v2.1 Gift Card Product** — Phases 9-12 (in progress)

## Phases

<details>
<summary>✅ v1 Hardening (Phases 1-4) — SHIPPED 2026-09-02</summary>

Hardening pass on the live Voltique storefront: dead published credential, fail-closed admin guard, telemetry for silent failure modes, ADRs locked, runbooks and reference docs brought in line with the code.

- [x] Phase 1: Security and Admin-Auth Truth (4/4 plans) — completed 2026-09-02
- [x] Phase 2: Observability and Regression Guards (5/5 plans) — completed 2026-09-02
- [x] Phase 3: Decision Lock-In and Operator Runbooks (3/3 plans) — completed 2026-09-02
- [x] Phase 4: Reference Documentation Refresh (5/5 plans) — completed 2026-09-02

Full phase details, success criteria, and plan lists: `milestones/v1-ROADMAP.md`. Requirements and backlog: `milestones/v1-REQUIREMENTS.md`. Audit: `milestones/v1-MILESTONE-AUDIT.md`. Phase artifacts: `milestones/v1-phases/`.

</details>

<details>
<summary>✅ v2 Themeable Storefront (Phases 5-8.2) — SHIPPED 2026-09-05</summary>

The storefront is skinnable without touching component code: a theme is one 23-token CSS file in `themes/`, validated at build time, chosen from admin with swatch previews, and applied per request to the storefront, transactional emails, and the crash page. Three page templates expose enumerated layout switches set from admin. Seven presets ship. Docs pruned to 20 files and rewritten product-neutral, with a root `AGENTS.md` for coding assistants.

- [x] Phase 5: Token Contract & Component Sweep (12/12 plans) — completed 2026-09-04
- [x] Phase 6: Theme File Mechanism & Presets (5/5 plans) — completed 2026-09-04
- [x] Phase 6.1: Remaining Presets: Clinical, Retro, Atelier, Market (4/4 plans, inserted) — completed 2026-09-04
- [x] Phase 7: Layout Switches (5/5 plans) — completed 2026-09-05
- [x] Phase 8: Documentation & Visual QA Close-out (5/5 plans) — completed 2026-09-05
- [x] Phase 8.1: v2 Tech-Debt Closure (7/7 plans, inserted) — completed 2026-09-05
- [x] Phase 8.2: Documentation Overhaul & Agent Onboarding (6/6 plans, inserted) — completed 2026-09-05

Full phase details, success criteria, and plan lists: `milestones/v2-ROADMAP.md`. Requirements: `milestones/v2-REQUIREMENTS.md`. Audit and accepted tech debt: `milestones/v2-MILESTONE-AUDIT.md`. Phase artifacts: `milestones/v2-phases/`.

</details>

### 🚧 v2.1 Gift Card Product (In Progress)

**Milestone Goal:** A shopper can buy a Voltique gift card on the storefront and the recipient receives it by email, using the gift card backend that shipped in v1 (PR #79, locked behind ADR-CTB-10). This milestone adds only the storefront front half — catalogue entry, recipient form, cart/checkout display — and production enablement of the flags and secrets that make issuance and delivery actually run.

- [x] **Phase 9: Gift Card Catalogue** - A gift card product with four denomination variants exists in production and renders like any other product (completed 2026-09-08)
- [ ] **Phase 10: Gift Card Purchase Flow** - A shopper enters recipient details on the product page and carries them through cart, checkout, and order history
- [x] **Phase 11: Production Enablement** - Gift card secrets and feature flags are live in production, rolled out in the required order, and documented (completed 2026-09-09)
- [ ] **Phase 12: Content, Assistant & Live Proof** - Volt and the Terms page describe the gift card accurately, and a real production purchase proves the whole flow end to end

**Phase Numbering:** continues from v2 (which ended at Phase 8.2); this milestone runs Phases 9-12. Decimal phases (9.1, 9.2, ...) are urgent insertions.

## Phase Details

### Phase 9: Gift Card Catalogue

**Goal**: A gift card product with four denomination variants exists in the catalogue, in production, with a matching image, and correct never-out-of-stock inventory behavior.
**Depends on**: Nothing (first phase of v2.1; v2 shipped 2026-09-05)
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04
**Success Criteria** (what must be TRUE):

  1. The gift card product exists in production D1 with four variants priced $25, $50, $100, and $200, `type = 'gift_card'`, `fulfillment_type = 'digital'`, added via idempotent `INSERT OR IGNORE` SQL recorded in `data/d1/seed.sql`
  2. The product is listed in the Featured category and renders on the home page, the Featured grid, the product page, and in search like any other product, showing the selected denomination's price
  3. The product page shows a Workers-AI-generated image in the catalogue's dark-studio style, stored in `data/r2/products/` and uploaded to the public `voltique-images` bucket
  4. None of the four variants ever shows as out of stock, and a paid gift card order does not decrement their inventory

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 09-01-PLAN.md — Seed the gift-card block in `data/d1/seed.sql` and prove `/product/gift-card` renders locally (tracer)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-02-PLAN.md — Cover the untracked-inventory, paid-decrement-skip and public-projection behaviors with tests
- [x] 09-03-PLAN.md — Generate the Workers AI catalogue image and upload it to the public bucket

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-04-PLAN.md — Fix the seed step in the deploy runbook, then apply the block to production and prove the card is live

### Phase 10: Gift Card Purchase Flow

**Goal**: A shopper can enter recipient details on the gift card product page and carry them, unaltered, through the cart, checkout, order confirmation, and account order history — with an all-digital cart skipping shipping entirely.
**Depends on**: Phase 9
**Requirements**: SHOP-01, SHOP-02, SHOP-03, SHOP-04, SHOP-05, SHOP-06
**Success Criteria** (what must be TRUE):

  1. On the gift card product page, the shopper sees a recipient form (recipient email required; name, message, delivery date optional) in place of the physical-product add-to-cart controls; it validates client-side against the same limits the server enforces (email format, 254/100/500 character caps, no control characters), shows field-level errors, and keeps "add to cart" disabled until the form is valid
  2. A signed-in shopper can choose "Send to myself" to fill the recipient email and name from their account; guests do not see the option
  3. Adding to cart creates a line that carries the recipient customization; two gift cards for different recipients stay as separate lines, while the same recipient and denomination merge into one line
  4. The recipient name, email, message, and delivery date are visible on the cart item, the checkout order summary, the order confirmation, and the account order detail page
  5. When every line in the cart is digital, web checkout hides the shipping address and shipping method steps and submits the order without an address; carts that also hold physical items are unchanged

**Plans**: 5/5 plans executed
**UI hint**: yes

Plans:
**Wave 1**

- [x] 10-01-PLAN.md — Per-field validators and the recipient form on the gift card product page (tracer)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10-02-PLAN.md — Shared recipient block on the cart line and the checkout order summary
- [x] 10-03-PLAN.md — Optional step-label, heading and helper props on ProgressBar and ShippingForm

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 10-04-PLAN.md — Recipient details on the order confirmation modal and the account order detail page

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 10-05-PLAN.md — Digital-only checkout steps, Clerk billing prefill, confirmation snapshot, phase gate

### Phase 11: Production Enablement

**Goal**: Production has the gift card key secrets and feature flags live, rolled out in the order `docs/runtime-configuration.md` requires, with the enablement recipe documented.
**Depends on**: Phase 10
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):

  1. The code HMAC key ring (`GIFT_CARD_CODE_HMAC_CURRENT_VERSION`, `GIFT_CARD_CODE_HMAC_KEYS_JSON`) and the delivery key ring (`GIFT_CARD_DELIVERY_CURRENT_VERSION`, `GIFT_CARD_DELIVERY_KEYS_JSON`) are live as Worker secrets and mirrored in local `.dev.vars`, with at least 32-byte secrets and nothing landing in `wrangler.jsonc`, source, docs, or git history
  2. `STORE_FEATURE_GIFT_CARD_RECONCILIATION` is enabled and deployed first and verified, then `STORE_FEATURE_GIFT_CARD_ACQUISITION` is enabled, both as `wrangler.jsonc` `vars`, with `cloudflare-env.d.ts` regenerated and `cf-typecheck` passing
  3. `docs/runtime-configuration.md` documents the delivery key ring alongside the code HMAC ring, and `docs/DEPLOYMENT_SETUP.md` carries a step-by-step enablement recipe (generate keys, put secrets, enable reconciliation, verify, enable acquisition)
  4. `.env.example` shows the shape of all four gift card secrets with placeholder values so a developer can exercise the full flow locally

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 11-01-PLAN.md — Prove the key-ring pipeline locally: generate a dev ring into `.dev.vars`, prove git cannot see it, pin both parser shapes (tracer)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 11-02-PLAN.md — Delivery-ring placeholders and the `.dev.vars` read-path comment in `.env.example`, pinned by a source-contract test
- [x] 11-03-PLAN.md — Delivery-ring contract in `docs/runtime-configuration.md` and the five-step enablement recipe in `docs/DEPLOYMENT_SETUP.md` §9

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 11-04-PLAN.md — Put the four production secrets, enable reconciliation, deploy, and prove one clean cron cycle

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 11-05-PLAN.md — D-07 blocking-human gate, enable acquisition, deploy, and run the full CI gate suite

### Phase 12: Content, Assistant & Live Proof

**Goal**: Volt and the support docs describe the gift card that actually ships, and a real production purchase proves issuance and delivery work end to end.
**Depends on**: Phase 11
**Requirements**: CONTENT-01, CONTENT-02, CONTENT-03, SHOP-07
**Success Criteria** (what must be TRUE):

  1. The gift card support article in `data/r2/knowledge_md/` describes what actually ships (four denominations, immediate email delivery after payment, no expiry, no cash redemption, how to redeem at checkout, where to check a balance) and is uploaded to R2
  2. Volt is re-indexed and recommends the gift card when a shopper asks about gifts, presents, or vouchers
  3. The Terms of Service page has a gift card section (email delivery, no expiry, no cash redemption, not transferable for resale), published through Admin → Pages
  4. A gift-card-only order paid in Stripe test mode on production results in an issued gift card, a delivery email to the recipient, and the card appearing under Account → Gift Cards for the recipient's account

**Plans**: 5/6 plans executed

Plans:
**Wave 1**

- [x] 12-01-PLAN.md — Prove the remote-binding tool chain reads production D1, R2, Vectorize and AI from one local process (tracer)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 12-02-PLAN.md — Rewrite the gift-card support article to match what ships, pin it with a test, upload it to R2
- [x] 12-03-PLAN.md — Add the gift card section to the Terms of Service page and prove the live page serves it

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 12-04-PLAN.md — Re-index Volt's knowledge articles upsert-only and prove three gift questions surface the card

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 12-05-PLAN.md — Buy one gift card in Stripe test mode on production and gather the issuance and delivery evidence

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 12-06-PLAN.md — Run the full CI gate suite, fill the validation contract, prove scope held, and push main

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1-4 (v1 Hardening) | 17/17 | Complete | 2026-09-02 |
| 5-8.2 (v2 Themeable Storefront) | 44/44 | Complete | 2026-09-05 |
| 9. Gift Card Catalogue | 4/4 | Complete    | 2026-09-08 |
| 10. Gift Card Purchase Flow | 5/5 | In Progress|  |
| 11. Production Enablement | 5/5 | Complete    | 2026-09-09 |
| 12. Content, Assistant & Live Proof | 5/6 | In Progress|  |
