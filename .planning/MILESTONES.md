# Milestones

## v2.2 Operations & Polish (Shipped: 2026-09-11)

**Phases completed:** 7 phases, 39 plans, 107 tasks

**Key accomplishments:**

- Gift-card redemption now follows the honor flag instead of the sell flag, so turning off sales no longer strands a balance a shopper already paid for — and the one visibility predicate every wave-2 surface plan imports now exists.
- All nine public browse surfaces — /api/products, the home and category pages, Volt's search/assess/recommend tools, catalog capabilities, and CMS product blocks — now hide the gift card through one shared predicate when selling is off, while /admin/products keeps seeing it untouched.
- `/product/gift-card` now 404s when both flags are off and shows a truthful "not available right now" notice — in token classes, ahead of the inventory check — when only selling is off, with the flag state computed server-side and passed to `ProductDisplay` as a prop rather than re-derived client-side.
- A gift-card line can no longer be priced or paid for while selling is off — the refusal is a server-side throw in `priceCheckout` with its own `/api/payment-intent` response code, and the cart marks a stale line while the redemption panel keeps following honor.
- Stranded gift-card money can now be measured in one D1 round trip, parked in one small `admin_settings` row, read cheaply enough for the request path, and paged on by name — and every way of failing to read it resolves toward honoring the card.
- Rewrote `docs/runtime-configuration.md` and `docs/DEPLOYMENT_SETUP.md` §9 in sell/honor language with a four-state table and rollback recipe, and added a source-contract test that reads both docs against `resolveCommerceCapabilities` and the honor-guard constants.
- Gift cards vanish from the admin sidebar, admin page, admin API and public balance endpoint when both flags are off, except the admin page and its API stay reachable — with a banner naming the stranded total, open-reservation count and measurement time — while the honor guard from 13-05 says money is still outstanding.
- Full CI-mirroring gate run green, 45 unpushed phase-13 commits deployed to production via Workers Builds, and read-only evidence that both gift-card flags stay on with a quiet, zero-outstanding honor guard.
- Migration 0024 adds an append-only `gift_card_events` audit table and a `code_suffix` search column to `gift_card_accounts`, with a partial UNIQUE index making a second `reissued` event for one card impossible at the database layer.
- Narrowed the honor-guard settings refusal so `gift_cards.code_reveal_enabled` can be saved through the existing admin settings route, and extracted `lib/gift-cards/admin-http.ts` — one shared bounded-body parser, actor builder, flag reader, and typed error vocabulary — for every gift-card admin route waves 2-4 will add.
- Five new repository methods (disableAccount, findReservations, requeueDelivery, writeAdjustment, reissue) plus a code-suffix column binding at issuance, all proven against real D1 triggers, with the reissue once-only guarantee demonstrated by a second attempt that fails and leaves no partial state.
- Event writer, four-source timeline merge, and a searchable admin list projection — all three tied together by one forbidden-column source contract that greps the actual read paths for code material instead of relying on review.
- Two new exports on `lib/services/gift-card-fulfillment.ts` — `issueAdminGiftCard` (order-less card, same machinery as a purchase) and `resendGiftCardDelivery` (re-send with a fresh idempotency key, zero writes to the delivery row) — plus `code_suffix` now recorded on checkout-issued cards too.
- Three thin admin routes — card detail, merged timeline, and a searchable/pageable list with admin-create — every one auth-gated, honor-gated through `resolveHonorEffective`, and provably free of code material.
- Seven mutation routes (disable, notes, requeue, release-hold, resend, reissue, reveal) over HTTP, each writing exactly one audit event, with reveal's ciphertext access deliberately kept out of the route directory so the D-14 forbidden-column contract never has to scan a route file for a code column.
- A real gift-card list (search/filter/paging/create) and a detail page (header, seven-action bar, notes, merged timeline) replacing the five-column read-only queue Russell called "next to useless."
- Documented the code-reveal admin setting and the 0024 migration, ran the full 11-gate CI suite green in one pass, then pushed phase 14 to production and confirmed the new admin gift-card API refuses anonymous callers.
- Extracted the account address form into `AddressForm.tsx` + `saveAddress()`, wired `AddressManager` to delegate both create and edit to it, and pinned the "one shared component, no second field list" contract with a source-contract test — the account addresses page's own behavior and file are unchanged.
- Replaced the subscription panel's "manage addresses" navigation link with a sentinel-driven select option that opens a token-class modal (the shared `AddressForm` locked to shipping); saving refreshes the list, pre-selects the new address, and leaves plan, quantity, and terms acceptance untouched.
- Full CI-mirroring gate suite green (2783+249+3 tests, lint/typecheck/build clean), pushed to `main`, deployed to production via Cloudflare Workers Builds (asset fingerprint `bcdc6e960bbd` to `b95c9d190804`), SUB-01/02/03 marked complete, and one documented scope-assertion exception in `app/api/setup-intent/route.ts` (a review-time bugfix, not new work by this plan).
- `Header.tsx` resolves blog-post existence and the admin-set label server-side as a strict boolean+string pair; `HeaderClient.tsx` renders one identical conditional `/blog` link in the desktop nav and the mobile sheet, proven by a source-occurrence-count test suite that pins both call sites and the pre-existing mobile-width contract.
- Latest-articles block on the home page — admin-controlled heading, count, on/off, and one of two fixed positions relative to the featured-products grid, cards copied from the blog index's own markup.
- `payment_customers` migration plus `lib/payments/customer-binding.ts`'s idempotent find-or-create/conflict-reconciliation algorithm against real Stripe and D1 semantics, mirroring `establishProviderCustomer` without importing from `lib/subscriptions/`.
- `app/api/payment-intent/route.ts` binds a signed-in shopper to a Stripe Customer, creates the PaymentIntent against it, and returns a Customer Session client secret in the same response — with two new warning-severity telemetry events and every guest/failure path proven unchanged.
- `StripeProvider.tsx` forwards the Customer Session secret into `Elements`, `CheckoutClient.tsx` threads it down from the `/api/payment-intent` response, and `PaymentForm.tsx`'s stale "no saved-payment-method feature" comment now tells the truth — completing PAY-03's checkout half.
- GET/DELETE routes behind the Payment methods page: GET projects saved Stripe cards to a five-field shape, DELETE retrieves-then-compares the payment method's Stripe customer against the caller's own binding before ever calling detach, denying every mismatch with the same 404.
- Account -> Payment methods page with a self-fetching PaymentMethodList client component (list/confirm/DELETE/remove, no add-a-card UI) and an unconditional AccountNav entry, both pinned by a new source-contract test file.
- Eleven CI gates green in one local run, production confirmed already deployed and read-only (401/401/307/200, migration 0025 live with zero rows), D-02 filed as a Phase 18 todo, and a four-step card-in-hand checklist handed to Russell.
- Gift-card-only orders now send a confirmation email and merchant notification carrying the shopper's billing address, correctly labelled, closing DEBT-06's silent email-skip bug.
- Doc-comment cross-references pin `isDigitalOnlyCart` and `hasPhysicalCheckoutLines` to each other and to the invariant test that proves their equivalence, with a hardened test that fails if either pin disappears.
- Deleted the orphaned `/api/tax` route (its own hardcoded 7% fallback rate and `txcd_99999999` tax code, diverging from the authoritative pricing service) and closed a latent trap in the gift-card order effect that could have handed the fulfilment service an environment rich enough to disable its own context lookup while carrying neither key ring.
- `normalizeCartItemForStore` now flags a rejected gift note instead of deleting the cart line; `projectCartLineForCheckout` refuses to price a flagged line; `CartItemCard` tells the shopper how to fix it — closing broken-windows ledger entry 10.
- A permanently failing gift-card delivery now pages an operator once, at the eighth and final attempt, instead of eight times for the same not-yet-terminal card.
- A pure `findDuplicateNumbers` rule closes DEBT-07's code half — `check:migrations` now refuses a new migration that reuses an existing number, while the already-applied `0023` pair (both filenames, both in production) stays permanently exempt, and `docs/database-migrations.md` records why neither file is ever renamed.
- Closed four broken-windows entries and two todos on cited code-level evidence, ratified the D-10 gift-note default, ran all 12 CI-mirroring gates green in one pass (catching and reverting a false-fix cf-typecheck regeneration along the way), and confirmed the deployed tax-route deletion from production with read-only probes.
- 3/3 complete — all executed directly by Russell in conversation, with this session verifying each from the outside where possible.

---

## v2.1 Gift Card Product (Shipped: 2026-09-10)

**Delivered:** A shopper can buy a Voltique gift card on the storefront and the recipient receives it by email. The catalogue carries `prod_33` with four denominations and a Workers-AI image; the product page collects recipient email, name, note and an optional delivery date; an all-digital cart checks out with a billing step and no shipping; both gift-card key rings and both feature flags are live in production; Volt, the support article and the Terms of Service describe what ships; and one real $25 test-mode purchase on production issued a card and delivered the email. After the live proof, Russell's own checkout drove three more changes the same night: the gift-card code is applied on the Payment Information step with its own Apply/Remove (re-quoting in place and releasing the previous hold), the applied tender is labelled with the masked code, and the Account → Gift cards section was removed as a wrong idea.

**Phases completed:** 4 phases (9, 10, 11, 12), 20 plans, 30 tasks
**Timeline:** 2026-09-07 (Phase 9 discussion) → 2026-09-10 (close), 3 days
**Git range:** `7026921` → `cf55fcd`, 177 commits
**Code changes (excluding `.planning/`):** 69 files, +3,498 / −327 lines (66 code files outside `docs/`, +3,358 / −321)
**Closeout:** verified_closeout — all 4 phases verified (10 and 12 by Russell via `/gsd-verify-work`), 18/18 requirements complete (SHOP-07's account-listing clause withdrawn by Russell). Known verification overrides: 5 newly acknowledged, 8 carried forward from a prior close (see STATE.md Deferred Items): three next-milestone todos and two UAT files already passed with 0 pending scenarios.
**Tech debt accepted:** see `milestones/v2.1-MILESTONE-AUDIT.md` (Stripe Tax unavailable on the live account; `STORE_SUPPORT_EMAIL` placeholder and no routing rule for `orders@`; orphaned `/api/tax`; acquisition flag gates redemption not sales — redesigned as sell/honor in the next milestone seed; `order-effects` `{ DB }` fallback; pre-deploy carts with a URL in the note; production secret list missing `ORDER_STATUS_SECRET` and the unsubscribe secrets).
**Unattended production changes (all accepted by Russell 2026-09-10):** fallback tax zero-rates nontaxable lines; `EMAIL_PROVIDER=cloudflare` and `STORE_SENDER_EMAIL` set (no transactional email had ever sent from production before); the cron now hands the worker env to the email sender; the buyer's note is delivered in the email.

**Key accomplishments:**

- Gift card catalogue product `prod_33` seeded idempotently, imaged with Workers AI, applied to production, never out of stock, nontaxable (`txcd_00000000`).
- Product-page recipient form with server-parity validators, cart lines keyed by recipient and denomination, recipient details on four surfaces, and a three-step digital-only checkout.
- Both gift-card key rings put into production as Worker secrets through non-echoing pipelines; flags rolled out reconciliation-first behind a blocking-human gate.
- Support article, product copy and Terms §6 corrected to what the code does (scheduled delivery, note in the email, no expiry, no cash), re-indexed for Volt.
- One real production purchase proved issuance and delivery end to end and surfaced four latent production defects (tax fallback, email provider, cron sender env, sender domain), all fixed and deployed.
- Gift-card tender redesigned from Russell's live checkout: applied on the payment step with Apply/Remove, previous hold released on re-quote, masked code on the summary and receipt.

---

## v2 Themeable Storefront (Shipped: 2026-09-05)

**Delivered:** The Voltique storefront is skinnable without touching component code. A theme is one CSS file of 23 tokens in `themes/`, validated at build time, chosen from admin with swatch previews, and applied per request to the storefront, transactional emails, and the crash page. Three page templates expose enumerated layout switches set from admin. Seven presets ship. The docs were pruned from 28 files to 20 and rewritten product-neutral, with a root `AGENTS.md` a coding assistant can follow from clone to deploy.

**Phases completed:** 7 phases (5, 6, 6.1, 7, 8, 8.1, 8.2), 44 plans, 125 tasks
**Timeline:** 2026-09-03 (Phase 5 planning) → 2026-09-05 (Phase 8.2 close), 3 days
**Git range:** `f878f9d` → `0c46346`, 305 commits
**Code changes (excluding `.planning/`):** 225 files, +10,941 / −5,520 lines (194 code files outside `docs/`, +10,080 / −1,169)
**Closeout:** override_closeout — all 7 phases verified, 20/20 requirements complete. Known verification overrides: 8 newly acknowledged, 0 carried forward from a prior close (see STATE.md Deferred Items): four UAT files already passed with 0 pending scenarios, four backlog todos deliberately deferred.
**Tech debt accepted:** see `milestones/v2-MILESTONE-AUDIT.md` (12 items: Clerk/Stripe-session walkthroughs, AGENTS.md dry run, a11y screen-reader row, `docs:lint` not in CI, direction-doc extra properties, themed demos, two accepted residuals)

**Key accomplishments:**

- Frozen 23-token contract (17 colours incl. a 5-token inverse set, 4 radii, 2 font faces) wired through Tailwind, a server-rendered `data-theme` attribute, and a typed `getThemeTokens()` bridge; the volt-dark look moved verbatim to `themes/volt-dark.css` and preserved pixel-for-pixel across a 12-plan component sweep.
- `scripts/scan-hardcoded-colors.mjs` (`npm run scan:tokens`) proven fail-first against 1,165 violations in 86 files, driven to 0, and wired into CI in Phase 8.1.
- `scripts/build-themes.mjs` validates every `themes/*.css` file (metadata header, one selector, all 23 tokens as hex, nothing else) and generates the committed CSS barrel plus typed manifest, with a CI `--check`.
- `getActiveTheme()` resolves D1 `appearance.theme` → `NEXT_PUBLIC_THEME_DEFAULT` → manifest default once per request through a shared `React.cache` reader also used by `getLayoutSettings()`.
- Admin `/admin/settings/appearance`: manifest-driven theme cards with swatches, industry and synopsis metadata, and three segmented layout switches, saving through the existing guarded settings API.
- Seven presets ship (`volt-dark`, `luxe`, `midnight`, `clinical`, `retro`, `atelier`, `market`), each with its own display face; the light-preset acid test found and fixed three invisible scrims and one cross-theme `Select` highlight bug.
- Three enumerated layout switches (category grid-3/grid-2/list, home hero full-bleed/split/minimal, product gallery left/top) rendered as named server-chosen components, with default variants proven verbatim by snapshot and screenshot parity and a repo-wide contract test.
- Transactional emails and the crash page follow the admin-selected theme: request-path senders resolve it at send time, cron-drained effects carry it in the new expand-only `order_effects.payload` column (migration 0023), and `app/global-error.tsx` repaints from public `GET /api/theme`.
- Visual QA matrix of 7 presets × 3 layout combinations (21 runs, 46 judgements, zero defects) recorded in `docs/theming.md`.
- Documentation overhaul: 9 docs retired, `docs/` down to 20 files with one style contract and a claim check against the code, `scripts/docs-lint.mjs` (`npm run docs:lint`) guarding references, script names, retired paths, the four locked ADRs, and header status lines; README rewritten product-neutral with preset screenshots.
- Root `AGENTS.md` (157 lines, wrapped around the Next-generated block) gives a coding assistant an ordered, command-exact path from clone to deploy; root `CLAUDE.md` points to it; `docs/CLAUDE.md` cut from 655 to 236 lines.

---

## v1 Hardening (Shipped: 2026-09-02)

**Delivered:** The live Voltique storefront's docs and code now agree: the published admin token is dead, a misbuilt deploy cannot open the admin bypasses, the silent failure modes have telemetry and regression tests, the four ADRs are locked, and the runbooks and reference docs describe the current system.

**Phases completed:** 4 phases, 17 plans, 46 tasks
**Timeline:** 2026-08-31 (codebase map) → 2026-09-02 (last phase commit), 3 days
**Git range:** `f179b53` → `f716ae2`, 135 commits
**Code changes (excluding `.planning/`):** 51 files, +2,842 / −292 lines (32 code files outside `docs/`, +2,351 / −112)
**Closeout:** verified_closeout — all 4 phases verified, 19/19 requirements complete, artifact audit clear (0 open, 0 carried forward)
**Tech debt accepted:** see `milestones/v1-MILESTONE-AUDIT.md` (operator follow-ups: sitemap Build variable, post-deploy 503 and Analytics Engine checks, tail-consumer alert email; Cloudflare hygiene; mobile performance backlog)

**Key accomplishments:**

- A deployed Worker running a development build now hard-denies every `checkAdminPermissions` credential path (header bypass, Clerk session, and Bearer service token) via a new `lib/auth/deployment-guard.ts` module, proven by an end-to-end tracer test plus 15 isolated boundary/regression tests.
- `authenticateRequest` and `middleware.ts` now both fail closed with a real HTTP 503 on a deployed development build — the last two open choke points from `01-01` — and `docs/admin-authentication.md`/`docs/DEPLOYMENT_SETUP.md` document the guard as shipped, including the residual 401-vs-503 status-code gap for six non-`/api/admin` callers.
- Scrubbed the published `voltique-admin` token from `docs/CLAUDE.md`, replaced every URL-query credential example across three docs with header forms, and rewrote `docs/admin-authentication.md` to describe the real `isUserAdmin`/`adminUsers` mechanism instead of the phantom `ADMIN_USER_IDS` environment variable.
- Rotated the production `ADMIN_VECTORIZE_TOKEN` via a single generate-and-upload pipe and proved the previously published `voltique-admin` value now returns 401 on both `/api/admin/knowledge` and `/api/admin/vectorize`, with the storefront still serving 200.
- `checkout.tax_fallback` fires on every Stripe Tax degradation with zero identifiers, registered alongside two forward-looking events and a `reason` enum in both parity files, plus the two allocation functions exported for `02-04`.
- A new `WEB_VITALS` Analytics Engine binding, a bounded route-template mapper, and a rewritten `/api/analytics/vitals` route that writes exactly five fields and never returns anything but 200.
- `handlePaymentFailed` now emits one identifier-free `payment.intent_failed` event through a closed allow-list decline-reason mapper, writes nothing, and the placeholder TODO and its dead guard are gone.
- Category page now 404s through Next's boundary instead of a 200 sentinel div, both slug pages share a `Promise<{ slug: string }>` params signature, and the tax/discount allocation functions are pinned by sum-exactness tables at 1, 2, 10, and 100 lines.
- Live-site mobile Lighthouse baseline for four routes shows every one failing the PRD's target of 85 — home/category/checkout in the low-to-mid 70s, product highest at 80 — recorded as median-of-three in `docs/mobile-lighthouse-baseline.md`.
- Corrected the false MCP-checkout-boundary claim in `docs/checkout-trust-boundary.md` and marked all four ADR docs `Accepted`, with the lock recorded in a newly git-tracked `gsd-ingest-manifest.yaml`.
- Rewrote the migration, deploy-path, Node prerequisite, and Stripe webhook sections of three operator runbooks to match the guarded scripts and dispatch switch the repository actually enforces.
- Deleted the checkout.session.completed dispatch case, its comments-only handler, and its header doc bullet from the Stripe webhook route (29 lines, deletions only), then pinned the unhandled-event fall-through contract with a new 4-assertion regression test.
- Corrected `docs/README.md`'s status lines and model name to match the shipped system, then linked all 15 previously-unreachable documents across four new index groups so every file in `docs/` is reachable.
- CI's production audit gate raised to `--audit-level=high` and `docs/dependency-security.md` refreshed to close both Next-bundled exceptions with re-observed evidence — the audit reports 0 findings in production at every severity.

---
