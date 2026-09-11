# Roadmap: Mercora

## Milestones

- ✅ **v1 Hardening** — Phases 1-4 (shipped 2026-09-02) — [archive](milestones/v1-ROADMAP.md)
- ✅ **v2 Themeable Storefront** — Phases 5-8.2 (shipped 2026-09-05) — [archive](milestones/v2-ROADMAP.md)
- ✅ **v2.1 Gift Card Product** — Phases 9-12 (shipped 2026-09-10) — [archive](milestones/v2.1-ROADMAP.md)
- 🚧 **v2.2 Operations & Polish** — Phases 13-19 (in progress)

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

<details>
<summary>✅ v2.1 Gift Card Product (Phases 9-12) — SHIPPED 2026-09-10</summary>

A shopper can buy a Voltique gift card on the storefront and the recipient receives it by email, on the gift-card backend that shipped in v1 (ADR-CTB-10). Catalogue product with four denominations and a Workers-AI image; product-page recipient form; recipient details through cart, checkout and order history; digital-only checkout with a billing step; key rings and flags live in production; Volt, article and Terms aligned to the code; one real production purchase proved issuance and delivery. Post-proof: gift-card tender on the payment step with Apply/Remove, masked code on the summary, Account → Gift cards removed.

- [x] Phase 9: Gift Card Catalogue (4/4 plans) — completed 2026-09-08
- [x] Phase 10: Gift Card Purchase Flow (5/5 plans) — completed 2026-09-09
- [x] Phase 11: Production Enablement (5/5 plans) — completed 2026-09-09
- [x] Phase 12: Content, Assistant & Live Proof (6/6 plans) — completed 2026-09-10

Full phase details, success criteria, and plan lists: `milestones/v2.1-ROADMAP.md`. Requirements: `milestones/v2.1-REQUIREMENTS.md`. Audit and accepted tech debt: `milestones/v2.1-MILESTONE-AUDIT.md`. Phase artifacts: `milestones/v2.1-phases/`.

</details>

### 🚧 v2.2 Operations & Polish (In Progress)

**Milestone Goal:** Make gift cards operable — flags that mean what they say, and an admin that can manage individual cards with an audit trail. Close the shopper-facing gaps the v2.1 live test exposed: subscription address entry in place, the blog reachable, saved payment methods. Clear the tech debt carried out of v2.1 and the operator checklist that needs Russell in the Stripe and Cloudflare dashboards.

- [x] **Phase 13: Gift-Card Flags** - Sell and honor each control what their name says, and both off makes gift cards vanish (completed 2026-09-10)
- [x] **Phase 14: Gift-Card Admin & Audit Trail** - An admin can find, read the history of, and act on any individual gift card (completed 2026-09-10)
- [x] **Phase 15: Subscription Address In Place** - A shopper adds a shipping address on the subscription product page without leaving it (completed 2026-09-11)
- [x] **Phase 16: Blog Surfacing** - The blog is reachable from the header and the latest articles appear on the home page (completed 2026-09-11)
- [ ] **Phase 17: Saved Payment Methods** - A signed-in shopper saves a card at checkout and manages it from their account
- [ ] **Phase 18: Tech-Debt Closure** - The debt carried out of v2.1 is closed and the docs match the code
- [ ] **Phase 19: Operator Checklist** - **Human-checkpoint phase, last by design** — every task needs Russell in the Stripe or Cloudflare dashboard

**Phase Numbering:** continues from v2.1 (which ended at Phase 12); this milestone runs Phases 13-19. Decimal phases (13.1, 13.2, ...) are urgent insertions.

## Phase Details

### Phase 13: Gift-Card Flags

**Goal**: The two gift-card flags do what their names say — sell (`STORE_FEATURE_GIFT_CARD_ACQUISITION`) controls selling, honor (`STORE_FEATURE_GIFT_CARD_RECONCILIATION`) controls redeeming — so a store can stop selling cards while still honoring the balances it already took money for.
**Depends on**: Nothing (first phase of v2.2; v2.1 shipped 2026-09-10)
**Requirements**: GCF-01, GCF-02, GCF-03, GCF-04, GCF-05
**Success Criteria** (what must be TRUE):

  1. With sell off and honor on, a shopper cannot buy a gift card — the product page shows "not available" copy instead of the recipient form and checkout rejects a gift-card line — while a shopper holding an existing card still redeems its balance at checkout as before
  2. With both flags off, no gift-card surface renders anywhere: the product is absent from listings and its page 404s, checkout shows no gift-card panel, and an admin sees no gift-card nav entry and cannot reach `/admin/gift-cards`
  3. Honor cannot be turned off while any active balance or open reservation exists — the runtime refuses to start, or admin shows a loud warning naming the outstanding balance — and sell on with honor off still refuses to start
  4. An operator reading `docs/runtime-configuration.md` and `docs/DEPLOYMENT_SETUP.md` §9 finds the two flags described as sell and honor, with the four-state table and the "stop selling, keep honoring" rollback recipe

**Plans**: 9/9 plans executed

Plans:
**Wave 1**

- [x] 13-01-PLAN.md — Tracer: tender follows honor, shared gift-card visibility predicate (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 13-02-PLAN.md — Listing visibility at nine public call sites, admin listing untouched (wave 2)
- [x] 13-03-PLAN.md — Product page: unavailable notice under sell=off, 404 under both-off (wave 2)
- [x] 13-04-PLAN.md — Checkout: server-side sell=off rejection, cart mark, panel gated on honor (wave 2)
- [x] 13-05-PLAN.md — Honor guard: balance measurement, admin_settings record, critical event (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 13-06-PLAN.md — Docs: sell/honor four-state table, rollback recipe, source-contract test (wave 3)
- [x] 13-07-PLAN.md — Cron measures and alarms; request-path honor override that still throws (wave 3)
- [x] 13-08-PLAN.md — Admin and public surface gating plus the outstanding-balance banner (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 13-09-PLAN.md — Phase gate: full CI, push to main, read-only production confirmation (wave 4)

**UI hint**: yes

### Phase 14: Gift-Card Admin & Audit Trail

**Goal**: An admin can find any gift card, read its whole history, and act on it — disable, reissue, resend, re-queue, release a hold, or create one — with every human action and note recorded durably.
**Depends on**: Phase 13 (the flag rules decide whether the admin nav entry and `/admin/gift-cards` render at all)
**Requirements**: GCA-01, GCA-02, GCA-03, GCA-04, GCA-05, GCA-06, GCA-07, GCA-08, GCA-09
**Success Criteria** (what must be TRUE):

  1. An admin opens `/admin/gift-cards`, searches by recipient email, order id, or the last four characters of a code, and sees a paginated list showing masked code, issued amount, available balance, status, purchaser (or "admin: who"), recipient email, issuing order, delivery status and created date
  2. A card's detail page shows one timeline covering issuance (order, purchaser, recipient, amount) or admin creation (who, reason), every hold and release, every redemption with its order and amount, refunds back to the card, disable and reissue events, and notes — each entry naming who did it and when
  3. An admin disables a card with a reason and it stops redeeming while its ledger stays intact; reissuing that card issues a new one for the remaining balance, emails it to the recipient (or an address the admin types), and both cards' timelines link to each other
  4. An admin resends a delivery email, re-queues a `needs_review` delivery, releases a stuck hold, adds a free-text note, and creates a card (amount, recipient, reason) that is issued and delivered like a purchased one — every action lands on the timeline and survives a redeploy, persisted through the expand-only `gift_card_events` migration (next free number `0024`)
  5. No admin screen or API response ever returns a code hash, ciphertext or nonce, and every gift-card admin API refuses a caller without admin auth; a full code reveal is off unless a documented setting enables it, and then it takes a confirm step and writes an audit event

**Plans**: 9 plans

Plans:
**Wave 1**

- [x] 14-01-PLAN.md — Migration `0024`, the `gift_card_events` Drizzle table and `code_suffix`, proven by a migration-ordering test
- [x] 14-02-PLAN.md — Narrow the honor-guard settings refusal, declare the code-reveal setting, add the shared admin route scaffold

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 14-03-PLAN.md — Repository: `disableAccount`, `findReservations`, `requeueDelivery`, `writeAdjustment`, once-only `reissue`

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 14-04-PLAN.md — Event writer, four-source timeline merge, extended list projection with search, forbidden-column contract

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 14-05-PLAN.md — Fulfillment: `issueAdminGiftCard`, `resendGiftCardDelivery`, code suffix on checkout-issued cards

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 14-06-PLAN.md — Read and create routes: card detail, timeline, list search and paging, admin-create
- [x] 14-07-PLAN.md — Seven mutation routes: disable, notes, requeue, release-hold, resend, reissue, reveal

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 14-08-PLAN.md — Admin UI: real list with search and paging, card detail page, action bar, confirm dialogs, timeline

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 14-09-PLAN.md — Documentation, full CI gate suite, deploy and read-only production check

**UI hint**: yes

### Phase 15: Subscription Address In Place

**Goal**: A shopper on a subscription product page can add a shipping address without leaving the page or losing the plan and quantity they already chose.
**Depends on**: Nothing (independent of the gift-card phases)
**Requirements**: SUB-01, SUB-02, SUB-03
**Success Criteria** (what must be TRUE):

  1. The shipping-address select on a subscription product page always offers "Add a new address…", including when the shopper has no saved addresses, and the "Manage addresses" link that used to navigate away is gone
  2. Choosing it opens a modal showing the same address form the account page uses — one shared component, one field list, one set of validation rules, no second copy
  3. Saving posts to the existing account addresses API, closes the modal, refreshes the list and pre-selects the new address, while the chosen plan, quantity and other page state are exactly as the shopper left them
  4. An API error appears inside the modal without closing it, and cancelling restores the address that was selected before

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 15-01-PLAN.md — Extract the shared AddressForm and saveAddress helper; refactor AddressManager (SUB-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 15-02-PLAN.md — Sentinel select option, AddAddressDialog, post-save refresh and pre-select (SUB-01, SUB-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 15-03-PLAN.md — Gate suite, scope assertions, deploy, read-only production check, human list

**UI hint**: yes

### Phase 16: Blog Surfacing

**Goal**: A shopper can find the blog from the header and see the latest articles on the home page, with an admin controlling the label, the block and its contents from settings rather than from template code.
**Depends on**: Nothing (independent)
**Requirements**: BLOG-01, BLOG-02, BLOG-03
**Success Criteria** (what must be TRUE):

  1. A shopper sees a blog entry in the header navigation on desktop and in the mobile menu, carrying a configurable label; when no article is published the entry does not render at all
  2. The home page renders an articles block with an admin-set heading, the N latest published articles shown as title, cover image, date and excerpt, and a "Read all" link to `/blog`
  3. An admin turns the block on or off and changes its heading, article count and placement from Admin → Settings, and the storefront follows without a template change
  4. Each excerpt uses the article's explicit excerpt field when it has one, otherwise the first paragraph with markup stripped and a length cap; the block links to each article rather than reproducing its content

**Plans**: 4 plans

Plans:
**Wave 1**

- [x] 16-01-PLAN.md — Content settings resolver, excerpt resolver, opt-in post body on the published-posts read (BLOG-02, BLOG-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 16-02-PLAN.md — Header blog entry: server-resolved visibility and label, desktop and mobile links (BLOG-01)
- [x] 16-03-PLAN.md — BlogHighlights component and the home-page block at its two fixed placements (BLOG-02, BLOG-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 16-04-PLAN.md — Admin Content settings tab, write-path tests, gate suite, deploy, live check (BLOG-01, BLOG-02)

**UI hint**: yes

### Phase 17: Saved Payment Methods

**Goal**: A signed-in shopper can save a card at checkout and then reuse or remove it from their account, replacing the Stripe Link box that saved nothing to the store.
**Depends on**: Nothing (independent — it shares no component with Phase 15's address form)
**Requirements**: PAY-01, PAY-02, PAY-03
**Success Criteria** (what must be TRUE):

  1. A signed-in shopper can save their card at checkout: the store creates or reuses one Stripe Customer for that Clerk user and creates the PaymentIntent against that customer with `setup_future_usage`
  2. On a later checkout the Payment Element offers that shopper their saved cards, while a guest sees the plain card form and no saved-method UI anywhere
  3. Account → Payment methods lists each saved card by brand, last four and expiry and lets the shopper remove one; a removed card is gone from the next checkout
  4. Stripe Link stays hidden unless it is deliberately re-enabled alongside this feature

**Plans**: TBD
**UI hint**: yes

### Phase 18: Tech-Debt Closure

**Goal**: The debt carried out of v2.1 is closed — no orphaned tax route, no silently degrading gift-card delivery, no cart line dropped without telling the shopper, and docs that say what the code does.
**Depends on**: Nothing (independent)
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05, DEBT-06, DEBT-07, DEBT-08
**Success Criteria** (what must be TRUE):

  1. `/api/tax` either no longer exists or returns numbers from the authoritative pricing service, and no route carries a hardcoded tax code
  2. Gift-card issuance can no longer degrade in silence: the request path hands `order-effects` the full worker env, a caller supplying only a database fails loudly instead of skipping delivery, and only terminal `needs_review` failures page through `gift_card.delivery_failed` while retries emit a non-paging event
  3. A shopper whose saved cart line has a gift note that no longer validates sees that line and is asked to fix it, instead of finding it silently gone
  4. A digital-only order keeps the billing address the shopper entered and shows it on the confirmation email and the account order detail; client and server decide "digital-only cart" from fulfillment type by one shared rule, pinned by a test
  5. Docs and tests match the code: the stale "scan:tokens is local-only" claim, the REQUIREMENTS-wide verify check and the retroactive-note behaviour for pre-existing pending deliveries are each resolved with their broken-windows entries closed, and the admin Appearance cards show each theme's industry and synopsis (verify first — `components/admin/ThemePresetGrid.tsx` already renders both, so this may reduce to confirming and closing the todo)

**Plans**: TBD
**UI hint**: yes

### Phase 19: Operator Checklist

**Goal**: The three operator items that only Russell can do are done and proven from the outside. **This is a human-checkpoint phase and is deliberately last**: every task needs Russell signed in to the Stripe dashboard or the Cloudflare dashboard, so nothing here can be executed unattended.
**Depends on**: Phases 13-18 (sequencing, not code — this phase is kept last so the code work never waits on a human checkpoint)
**Requirements**: OPS-05, OPS-06, OPS-07
**Success Criteria** (what must be TRUE):

  1. Stripe Tax is enabled on the live Stripe account and a production order records `tax_source = provider`; the configured-rate fallback stays in place as the documented degraded mode
  2. A reply to a store email reaches a person: `STORE_SUPPORT_EMAIL` is a real address and an Email Routing rule exists for `orders@` (or the sender moves to an already-routed address)
  3. `wrangler secret list` against production shows `ORDER_STATUS_SECRET` and `EMAIL_UNSUBSCRIBE_SECRET_CURRENT` present and the stale `ADMIN_USER_IDS` gone, with the docs naming the secrets and never their values

**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1-4 (v1 Hardening) | 17/17 | Complete | 2026-09-02 |
| 5-8.2 (v2 Themeable Storefront) | 44/44 | Complete | 2026-09-05 |
| 9-12 (v2.1 Gift Card Product) | 20/20 | Complete | 2026-09-10 |
| 13. Gift-Card Flags | 9/9 | Complete    | 2026-09-10 |
| 14. Gift-Card Admin & Audit Trail | 9/9 | Complete    | 2026-09-10 |
| 15. Subscription Address In Place | 3/3 | Complete    | 2026-09-11 |
| 16. Blog Surfacing | 4/4 | Complete    | 2026-09-11 |
| 17. Saved Payment Methods | 0/? | Not started | - |
| 18. Tech-Debt Closure | 0/? | Not started | - |
| 19. Operator Checklist (human checkpoints) | 0/? | Not started | - |
