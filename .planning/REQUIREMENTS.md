# Requirements: Mercora v2.2 Operations & Polish

**Defined:** 2026-09-10
**Core Value:** A customer or an external AI agent can find the right product through Volt, pay for it exactly once, and have inventory, orders, and post-payment effects stay correct.

**Milestone goal:** Make gift cards operable (flags that mean what they say, an admin that can manage individual cards with an audit trail), close the shopper-facing gaps the v2.1 live test exposed (subscription address entry in place, blog reachable, saved payment methods), and clear the accumulated tech debt and operator checklist.

## v1 Requirements

Requirements for this milestone. Each maps to a roadmap phase.

### Gift-card flags

- [x] **GCF-01**: With `STORE_FEATURE_GIFT_CARD_ACQUISITION` (sell) off and reconciliation (honor) on, the gift card cannot be bought: the product page shows no recipient form and "not available" copy, `priceCheckout` rejects gift-card lines, and existing cards still redeem at checkout
- [x] **GCF-02**: Honor (`STORE_FEATURE_GIFT_CARD_RECONCILIATION`) cannot be turned off while any active balance or open reservation exists: the runtime refuses to start (or, if a refusal is judged too blunt, admin shows a loud warning naming the outstanding balance) and the deploy docs say so
- [x] **GCF-03**: With both flags off, no gift-card surface renders: product hidden from listings and 404 on its page, no checkout gift-card panel, no admin nav entry, no `/admin/gift-cards`
- [x] **GCF-04**: Sell on with honor off still refuses to start (existing rule kept and tested)
- [x] **GCF-05**: `docs/runtime-configuration.md` and `docs/DEPLOYMENT_SETUP.md` §9 describe the two flags as sell and honor with the four-state table and the rollback recipe (stop selling, keep honoring)

### Gift-card admin

- [x] **GCA-01**: `/admin/gift-cards` lists cards with masked code (last group), issued amount, available balance, status, purchaser (or "admin: who"), recipient email, issuing order, delivery status, created date; searchable by recipient email, order id and last four characters; paginated
- [x] **GCA-02**: A card detail page shows a timeline: issuance (order, purchaser, recipient, amount) or admin creation (who, reason), every hold and release, every redemption (order, amount), refunds to the card, disable/reissue events (date, who), and notes
- [x] **GCA-03**: An admin can add a free-text note to a card (author and timestamp recorded)
- [ ] **GCA-04**: An admin can disable a card with a reason; a disabled card cannot be redeemed, its ledger is preserved, and the action appears on the timeline
- [ ] **GCA-05**: An admin can reissue a disabled card: a new card is issued for the remaining balance, emailed to the recipient (or an address the admin enters), and both cards' timelines link to each other
- [ ] **GCA-06**: An admin can resend the delivery email, re-queue a `needs_review` delivery, and release a stuck hold, each recorded on the timeline
- [ ] **GCA-07**: An admin can create a card (amount, recipient email, reason) that is issued and delivered like a purchased one, marked as admin-created with the admin's identity
- [x] **GCA-08**: Card codes are never shown in admin by default; a reveal, if enabled by a documented setting, requires a confirm step and writes an audit event (decision recorded in the phase context)
- [x] **GCA-09**: Human actions and notes persist in an expand-only `gift_card_events` migration; all admin gift-card APIs require admin auth and never return hash, ciphertext or nonce columns

### Subscription address

- [ ] **SUB-01**: On a subscription product page the shipping-address select always offers "Add a new address…", including when the shopper has none; the "Manage addresses" navigation link is gone
- [ ] **SUB-02**: Choosing it opens a modal with the same address form the account page uses (one shared component, no second field list or validation); saving posts to the existing account addresses API
- [ ] **SUB-03**: After a successful save the modal closes, the list refreshes and the new address is pre-selected; plan, quantity and other page state survive; API errors show inside the modal; cancel restores the previous selection

### Blog

- [ ] **BLOG-01**: The header navigation (desktop and mobile) shows a blog entry with a configurable label, hidden automatically when no published article exists
- [ ] **BLOG-02**: The home page renders a configurable articles block: heading, N latest published articles as excerpts (title, cover image, date, excerpt), and a "Read all" link to `/blog`; enabled/heading/count/placement are admin settings, not template code
- [ ] **BLOG-03**: Excerpts come from an explicit excerpt field when present, otherwise the first paragraph with markup stripped and a length cap; the block links to articles rather than duplicating content

### Saved payment methods

- [ ] **PAY-01**: A signed-in shopper can save a card at checkout; the store creates a Stripe Customer per shopper (mapped from the Clerk user) and the PaymentIntent is created with that customer and `setup_future_usage`
- [ ] **PAY-02**: Account → Payment methods lists saved methods (brand, last four, expiry) and lets the shopper remove one; guests never see saved-method UI
- [ ] **PAY-03**: The Payment Element offers a signed-in shopper their saved methods; Stripe Link stays hidden unless explicitly re-enabled with this feature

### Tech-debt closure

- [ ] **DEBT-01**: `/api/tax` is either removed or wired to the authoritative pricing service; no route hardcodes a tax code
- [ ] **DEBT-02**: `order-effects` no longer falls back to a `{ DB }`-only gift-card environment: the request path passes the full worker env (or the fallback fails loudly) so issuance-time delivery cannot silently degrade
- [ ] **DEBT-03**: A persisted cart line whose gift note now fails validation is surfaced to the shopper for editing instead of being dropped silently on load
- [ ] **DEBT-04**: Transient delivery retries emit a non-paging event; only terminal failures (`needs_review`) page through `gift_card.delivery_failed`
- [ ] **DEBT-05**: Client and server share one rule for "digital-only cart" (fulfillment type, not the presence of a customization), pinned by a test
- [ ] **DEBT-06**: A digital-only order keeps the billing address the shopper entered and shows it on the confirmation email and account order detail
- [ ] **DEBT-07**: Docs and tests match the code: the stale "scan:tokens is local-only" claim, the REQUIREMENTS-wide verify check, and the retroactive-note behaviour for pre-existing pending deliveries are each resolved and the corresponding broken-windows entries closed
- [ ] **DEBT-08**: Admin Appearance cards show each theme's industry and synopsis from the theme file header

### Operator checklist

- [ ] **OPS-05**: Stripe Tax is enabled on the live Stripe account and a production order records `tax_source = provider`; the fallback path stays as the documented degraded mode
- [ ] **OPS-06**: `STORE_SUPPORT_EMAIL` is a real address and an Email Routing rule exists for `orders@` (or the sender changes to a routed address) so replies to store email reach a person
- [ ] **OPS-07**: `ORDER_STATUS_SECRET` and `EMAIL_UNSUBSCRIBE_SECRET_CURRENT` exist as production secrets (names only in docs) and the stale `ADMIN_USER_IDS` secret is deleted; `wrangler secret list` proves it

## Future Requirements

Deferred to a later milestone.

- Scheduled-delivery UX beyond the date picker (reminders, resend before date) — SHOP-08
- Custom gift-card amounts — SHOP-09
- A Gift Cards category — CAT-05
- Recipient-based card lookup ("find my card by email") — replaced for now by admin resend
- Themed demo deployments; remaining direction-doc theme properties (`.planning/todos/pending/`)

## Out of Scope

- An Account → Gift cards listing for shoppers — removed in v2.1 by decision; a gift card is a bearer instrument delivered by email
- Live Stripe or Clerk keys — the site stays a test-mode demo
- Multi-currency gift cards — single-currency store
- Any change to the locked gift-card backend semantics (ADR-CTB-10) beyond additive admin operations

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GCF-01 | Phase 13 | Complete |
| GCF-02 | Phase 13 | Complete |
| GCF-03 | Phase 13 | Complete |
| GCF-04 | Phase 13 | Complete |
| GCF-05 | Phase 13 | Complete |
| GCA-01 | Phase 14 | Complete |
| GCA-02 | Phase 14 | Complete |
| GCA-03 | Phase 14 | Complete |
| GCA-04 | Phase 14 | Pending |
| GCA-05 | Phase 14 | Pending |
| GCA-06 | Phase 14 | Pending |
| GCA-07 | Phase 14 | Pending |
| GCA-08 | Phase 14 | Complete |
| GCA-09 | Phase 14 | Complete |
| SUB-01 | Phase 15 | Pending |
| SUB-02 | Phase 15 | Pending |
| SUB-03 | Phase 15 | Pending |
| BLOG-01 | Phase 16 | Pending |
| BLOG-02 | Phase 16 | Pending |
| BLOG-03 | Phase 16 | Pending |
| PAY-01 | Phase 17 | Pending |
| PAY-02 | Phase 17 | Pending |
| PAY-03 | Phase 17 | Pending |
| DEBT-01 | Phase 18 | Pending |
| DEBT-02 | Phase 18 | Pending |
| DEBT-03 | Phase 18 | Pending |
| DEBT-04 | Phase 18 | Pending |
| DEBT-05 | Phase 18 | Pending |
| DEBT-06 | Phase 18 | Pending |
| DEBT-07 | Phase 18 | Pending |
| DEBT-08 | Phase 18 | Pending |
| OPS-05 | Phase 19 | Pending |
| OPS-06 | Phase 19 | Pending |
| OPS-07 | Phase 19 | Pending |

**Coverage:** 34/34 v1 requirements mapped to exactly one phase each. No orphans, no duplicates.
