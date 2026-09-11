# Mercora

## What This Is

Mercora is an AI-assisted commerce platform running on Cloudflare's edge, built to be re-skinned for any product vertical. Its demo storefront brand is **Voltique**, live at https://voltique.russellkmoore.me, where shoppers browse the catalog, ask the **Volt** assistant for help, and check out with Stripe. A storefront's look is a theme: one 23-token CSS file in `themes/`, chosen from admin, applied to pages, emails, and the crash page; three page templates expose enumerated layout switches. The same commerce core is exposed to external AI shopping agents through an MCP server at `/api/mcp`, so an agent can search the catalog, build a cart, pay, and track an order without a browser.

## Core Value

A customer or an external AI agent can find the right product through Volt, pay for it exactly once, and have inventory, order state, and refunds end up correct, whether they arrive via the storefront or the MCP server.

## Business Context

- **Customer**: Shoppers on a Mercora-powered storefront (Voltique is the outdoor-gear demo), plus AI shopping agents (Claude Desktop, Cursor, VS Code, custom agents) using the MCP server
- **Revenue model**: Direct product sales through Stripe; stored-value gift cards; subscriptions (new acquisition is off by default per ADR-SUB-01)
- **Success metric**: TBD
- **Strategy notes**: `docs/ROADMAP.md` (2025 strategic priorities; its 12 planned items are backlogged in `.planning/milestones/v1-REQUIREMENTS.md`, not in v1)

## Current State

**Shipped: v2.2 Operations & Polish (2026-09-11).** Seven phases (13–19), 39 plans, over 2026-09-10 to 2026-09-11. Archive: `.planning/milestones/v2.2-ROADMAP.md`, `v2.2-REQUIREMENTS.md`, `v2.2-phases/`.

What v2.2 changed:

- Gift-card flags now mean what their names say: sell (`STORE_FEATURE_GIFT_CARD_ACQUISITION`) stops sales, honor (`STORE_FEATURE_GIFT_CARD_RECONCILIATION`) refuses to turn off while any balance or open reservation exists (measured by a cron-written honor guard, not a per-request scan), and both off hides every gift-card surface including the admin nav. `resolveHonorEffective` is the one owner of that decision, called by every surface.
- The admin gift-card queue became a real panel: searchable list, a per-card timeline merging ledger, reservations, deliveries and human actions, disable/reissue (once-only, proven against a real D1 race)/resend/re-queue/release-hold/admin-create, CSR notes, and a confirm-gated code reveal — migration `0024` (`gift_card_events`, append-only).
- Subscription product pages replace the "manage addresses" navigation link with a modal using the same shared `AddressForm` the account page uses; saving pre-selects the new address and leaves plan, quantity and terms untouched.
- The blog is reachable from the header (desktop and mobile, admin-labelled, hidden when nothing is published) and from a configurable home-page articles block (heading, count, on/off, placement — Admin → Settings, not template code).
- Signed-in shoppers can save a card at checkout (`payment_customers` migration `0025`, a Stripe Customer Session drives the Payment Element's saved-card UI) and manage it from Account → Payment methods; guests see the plain form; Stripe Link stays hidden.
- Eight pieces of tech debt closed: the orphaned `/api/tax` route deleted, a gift-card delivery env fallback removed before it could strand issuance, an invalid cart gift note now warns instead of vanishing, delivery-retry telemetry split so only terminal failures page, one digital-only-cart rule pinned by a cross-referenced test, and a real bug fixed — order-confirmation email was silently skipped for every non-subscription digital-only (gift-card) order.
- Phase 19, the deliberately-last human checkpoint: Stripe Tax enabled on the live account, `STORE_SUPPORT_EMAIL` set and routed, `ORDER_STATUS_SECRET`/`EMAIL_UNSUBSCRIBE_SECRET_CURRENT` added as Worker secrets and the stale `ADMIN_USER_IDS` deleted — all three confirmed live, not just claimed.
- Every phase code-reviewed (two iterations each, several real regressions caught and fixed before deploy — a subscription-renewal email skip, a checkout-panel gap, a delivery-telemetry alert silently dropped by the tail worker's own sanitizer) and security-audited (ASVS L1–L2 depending on sensitivity, 0 open threats across all seven phases) before every push.

Codebase after v2.2: 322 unit test files (2,958 tests) plus the Workers (255) and observability (3) suites; `docs/` 20 files.

**Open items carried out of v2.2** (none blocks feature work; full list in `.planning/todos/pending/`):

- Consolidate `payment_customers` and `subscription_provider_customers` into one Stripe-customer binding — deliberately deferred in Phase 17 to avoid touching revenue-critical subscription code in an unattended run (`consolidate-stripe-customer-bindings.md`).
- Inline gift-note editing in the cart drawer — Phase 18 gave the shopper an actionable warning (remove and re-add), not a new edit flow.
- The retroactive gift-note default (D-10: send the note on old pending deliveries) is ratified, not re-decided; Russell can override.
- Review D-02 (gift-card admin reissue design) and the two-Stripe-customer trade-off at the next milestone checkpoint.

<details>
<summary>Previous: v2.1 Gift Card Product (2026-09-10)</summary>

**Shipped: v2.1 Gift Card Product (2026-09-10).** Four phases (9–12), 20 plans, 30 tasks over 2026-09-07 to 2026-09-10. Archive: `.planning/milestones/v2.1-ROADMAP.md`, `v2.1-REQUIREMENTS.md`, `v2.1-MILESTONE-AUDIT.md`, `v2.1-phases/`.

What v2.1 changed:

- The catalogue carries `prod_33` "Voltique Gift Card" (four denominations, Workers-AI image, nontaxable `txcd_00000000`, never out of stock), seeded as a sentinel block in `data/d1/seed.sql` and applied to production.
- The product page collects recipient email, name, note and an optional delivery date through validators that share the server's normalisers; the cart keys lines by recipient and denomination; an all-digital cart checks out with a billing step and no shipping.
- Both gift-card key rings are Worker secrets (generated by non-echoing pipelines); reconciliation and acquisition flags are on in production; `EMAIL_PROVIDER=cloudflare` and `STORE_SENDER_EMAIL` are set — the first transactional email this store ever sent went out during Phase 12.
- The gift-card code is applied on the Payment Information step with its own Apply/Remove; a re-quote releases the previous hold and cancels the old PaymentIntent; the summary and receipt name the card by its masked code; Stripe Link is hidden.
- Volt, the support article, the product copy and Terms §6 say what the code does: delivery on payment or at the start of the chosen date (UTC), the buyer's note in the email, no expiry, no cash, no account listing.
- One real $25 test-mode purchase on production proved issuance and delivery and exposed four latent defects (fallback tax on nontaxable lines, no email provider chosen, cron sender without the worker env, placeholder sender domain), all fixed the same night.

Codebase after v2.1: 288 unit test files (2,375 tests) plus the Workers (157) and observability (3) suites; `docs/` 20 files.

</details>

<details>
<summary>Previous: v2 Themeable Storefront (2026-09-05)</summary>

**Shipped: v2 Themeable Storefront (2026-09-05).** Seven phases (5, 6, 6.1, 7, 8, 8.1, 8.2), 44 plans, 125 tasks over 2026-09-03 to 2026-09-05. Archive: `.planning/milestones/v2-ROADMAP.md`, `v2-REQUIREMENTS.md`, `v2-MILESTONE-AUDIT.md`, `v2-phases/`.

What v2 changed:

- Every storefront surface reads a frozen 23-token contract; `npm run scan:tokens` (in CI) reports zero hardcoded palette values outside admin.
- A theme is one validated CSS file in `themes/`; `scripts/build-themes.mjs` generates the committed barrel and manifest and fails the build on a bad file.
- `getActiveTheme()` and `getLayoutSettings()` resolve per request from D1 through one shared `React.cache` reader; admin `/admin/settings/appearance` sets the theme and three layout switches.
- Seven presets ship, each with its own display face; emails and the crash page follow the admin-selected theme (cron-drained emails carry it in `order_effects.payload`, migration 0023).
- `docs/` is 20 files with one style contract, claim-checked against the code and guarded by `npm run docs:lint`; README is product-neutral; root `AGENTS.md` onboards a coding assistant from clone to deploy.

Codebase after v2: 265 unit test files (2,187 tests) plus the Workers and observability suites; `docs/` 20 files; `themes/` 7 files.

**Open items carried out of v2** (none blocks feature work; full list in `.planning/milestones/v2-MILESTONE-AUDIT.md`):

- Walk through the admin Appearance page in a real browser with a Clerk admin session.
- Fresh-clone dry run of `AGENTS.md` with a coding assistant; confirm `npm run dev` leaves `AGENTS.md` unchanged.
- Add `npm run docs:lint` to CI.
- Direction-doc theme properties outside the token contract and themed demo deployments stay in `.planning/todos/pending/`.

</details>

<details>
<summary>Previous: v1 Hardening (2026-09-02)</summary>

**Shipped: v1 Hardening (2026-09-02).** Four phases, 17 plans, 46 tasks over 2026-08-31 to 2026-09-02. Archive: `.planning/milestones/v1-ROADMAP.md`, `v1-REQUIREMENTS.md`, `v1-MILESTONE-AUDIT.md`, `v1-phases/`.

What v1 changed:

- The published admin token is dead and no credential value lives in `docs/`.
- A development build deployed to Workers fails closed (503) on every admin path.
- Tax fallback, failed payments, and production web vitals all emit real signals.
- Slug routes 404 correctly; allocation math is pinned by sum-exactness tests (and one real over-allocation bug was fixed).
- All four ADRs are marked Accepted and locked; the runbooks and reference docs match the code.
- CI's dependency audit gate is at `high` with a clean production tree.

Live site: https://voltique.russellkmoore.me (demo, Stripe test mode). Codebase: roughly 108k lines of TypeScript outside tests, 233 unit test files plus the Workers and observability suites.

**Operator follow-ups carried out of v1** (none blocks feature work; see `.planning/milestones/v1-MILESTONE-AUDIT.md` tech debt):

- Add `NEXT_PUBLIC_SITE_URL=https://voltique.russellkmoore.me` as a Cloudflare Workers Build variable and redeploy. The live sitemap advertises `mercora.example.com` until then.
- After the next deploy: confirm `/admin` returns 503 on a non-production build, confirm `mercora_web_vitals` rows arrive, and trip one warning-severity event to confirm the `commerce-observability-tail` alert email arrives.
- Cloudflare hygiene: delete the unused `ADMIN_USER_IDS` Worker secret; two unpromoted Worker versions from 2026-08-31 can be ignored.
- Dependency review due 2026-12-01 (five moderate dev-only findings).

</details>

## Requirements

### Validated

<!-- Shipped and confirmed working. Inferred from code, the codebase maps in .planning/codebase/, and PRD status markers. -->

- ✓ Server-authoritative checkout: `POST /api/payment-intent` recomputes all pricing, persists a pending order, and binds the Stripe PaymentIntent; the browser asserts nothing about money — pre-GSD (ADR-CTB)
- ✓ One idempotent payment finalizer (`lib/services/order-finalization.ts`) shared by `POST /api/orders`, the Stripe webhook, and MCP `place_order` — pre-GSD (verified in code, supersedes ADR-CTB-15)
- ✓ Durable post-payment effects (`order_effects`), webhook claim ledger (`processed_webhook_events`), and exactly-once inventory ledger (`inventory_adjustments`) drained by a five-minute cron — pre-GSD (ADR-WRI)
- ✓ Refunds: admin/API refunds with reserved balance and deterministic Stripe idempotency keys; Stripe Dashboard refunds reconciled from `charge.refunded`; external full restock default-off — pre-GSD (ADR-WRI-09/10)
- ✓ Gift cards, waves 1–7: mixed-cart pricing, request-bound tender reservation, zero-cash finalization, idempotent issuance and delivery, dual-leg refund convergence, customer/admin surfaces, scheduler composition, migration `0022`; PR #79 merged — pre-GSD (REQ-gift-cards-*)
- ✓ Subscriptions: SetupIntent acquisition behind flags, lifecycle from signed webhooks, one order per paid invoice, migration `0021` — pre-GSD (ADR-SUB)
- ✓ Guarded D1 migration tooling: `db:prepare:local`, `db:migrate:status|apply:preview|production`, production apply gated by confirmation plus `MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1`; `check:migrations` safety check in CI — pre-GSD (ADR-DBM, locked)
- ✓ MCP server: 19 tools (discovery, cart, checkout, orders, agent management), digest-stored credentials with 90-day expiry and rotation, deny-by-default permissions, per-agent rate limits, session ownership checks — pre-GSD (SPEC MCP)
- ✓ Volt assistant: `POST /api/agent-chat` with BGE-base-en-v1.5 embeddings, Vectorize top-K retrieval, `@cf/openai/gpt-oss-20b` generation, anti-hallucination validation, product hydration from D1 — pre-GSD
- ✓ Admin dashboard: `/admin`, `/admin/products`, `/admin/categories`, `/admin/orders`, `/admin/settings`, `/admin/gift-cards`, `/admin/promotions`, `/admin/reviews`, `/admin/blog`, `/admin/knowledge`, `/admin/pages`, `/admin/subscription-plans`; production auth enforced via Clerk role or an active `adminUsers` table row (no `ADMIN_USER_IDS` variable exists; docs claiming it are stale), dev bypasses gated on `NODE_ENV === "development"` — pre-GSD (W2, W3 verified)
- ✓ Reviews and ratings: schema, submission with AI-assisted moderation and single-review enforcement, star summaries and verified badges, moderation queue, status emails and post-delivery reminders — pre-GSD (REQ-reviews-ratings; all sub-items complete)
- ✓ CMS pages and Blog publishing (migration `0019`), customer accounts with owner-scoped order history and saved addresses, provider-neutral transactional email (Cloudflare Email Sending or Resend, never cross-provider fallback), unsubscribe tokens (migration `0018`) — pre-GSD
- ✓ Mobile UX sprint code items: 44px button targets, cart quantity controls, 300/200ms menu animation, category indentation, ProductCard spacing and responsive `sizes`, ShippingForm keyboard attributes, mobile CSS, `useWebVitals` hook mounted via `components/analytics/WebVitals.tsx`, `/api/analytics/vitals` route — pre-GSD (REQ-mobile-*, REQ-web-vitals-*; PRD checklist is stale)
- ✓ Observability: `commerce.telemetry.v1` closed-taxonomy producer, Tail Worker with SQLite cooldown Durable Object, three vitest suites (unit 233 files, Workers, observability) plus lint, typecheck, cf-typecheck, migration-safety, and `npm audit --audit-level=critical` in `.github/workflows/ci.yml` — pre-GSD (SPEC OBS)
- ✓ Shopify migration toolkit (dry-run by default, migration `0020` redirects, `/media/*` object serving) and runtime store configuration (`lib/store-config.ts`, `NEXT_PUBLIC_*` overrides, feature flags) — pre-GSD

- ✓ No literal credential values in `docs/`; the published admin token was rotated on 2026-09-02 and the old value returns 401 on both admin endpoints — Phase 1 (SEC-01, SEC-02)
- ✓ Deployment-posture guard (`lib/auth/deployment-guard.ts`): a development build running in the Cloudflare Workers runtime fails closed with 503 in `checkAdminPermissions`, `authenticateRequest`, and `middleware.ts` for `/admin` and `/api/admin`, and emits `auth.deployment_guard_tripped` (escalated as critical by the tail worker) — Phase 1 (SEC-03)
- ✓ Admin-auth docs describe the real mechanism: Clerk role or active `adminUsers` row, header-only bearer token, `x-dev-admin` header only under development, no query-string auth, no phantom `ADMIN_USER_IDS` — Phase 1 (SEC-04)

- ✓ Tax fallback emits `checkout.tax_fallback`; production web-vitals beacons are written to the `mercora_web_vitals` Analytics Engine dataset with five low-cardinality fields, always answering 200 — Phase 2 (OBS-01, OBS-02)
- ✓ Slug pages take `Promise`-typed `params` and return real 404s; allocation-sum tests at 1, 2, 10, 100 lines. These tests exposed and fixed a pre-existing bug where `allocateDiscount` could over-allocate the last line beyond its capacity — Phase 2 (OBS-03, OBS-04)
- ✓ `payment_intent.payment_failed` handled as telemetry only (`payment.intent_failed` with an allowlisted `reason`), no order-state change — Phase 2 (OBS-05)
- ✓ Mobile Lighthouse baseline recorded in `docs/mobile-lighthouse-baseline.md`: all four routes score 72–80 against the 85 target — Phase 2 (MOB-01)

- ✓ `docs/checkout-trust-boundary.md` states MCP checkout is inside the paid inventory boundary and names the shared pricing service and finalizer; all four ADR docs carry a dated `**Status:** Accepted` marker and `gsd-ingest-manifest.yaml` (now tracked) marks them `locked: true`; a throwaway-branch ingest re-run classified all four as locked with the prior W1 and I17 closed — Phase 3 (ADR-01, ADR-02)
- ✓ Runbooks match the repo: `docs/CLAUDE.md` and `docs/DEPLOYMENT_SETUP.md` show only the guarded `db:migrate:*` scripts, the `deploy` versus `deploy:ci` distinction, and Node 24.18.1; both Stripe webhook event lists are identical 16-event Required/Subscriptions groups matching the route's dispatch switch, and the dead `checkout.session.completed` branch is gone from the route with a regression test pinning the unhandled-event contract — Phase 3 (RUN-01, RUN-02)

- ✓ Reference docs are current: every model mention names `@cf/openai/gpt-oss-20b` (no "Llama" anywhere in `docs/`), the MCP tool count reads 19 with the full list in `docs/CLAUDE.md`, the Testing section describes the three vitest suites and six CI gates, dependency versions point at `package.json`, no doc references the dead `API_STRUCTURE.md`, `docs/README.md` links all 27 files with the MCP server shown live at `/api/mcp`, and the four historical or proposal documents carry `Status: Historical` banners with the mobile checklist's 12 shipped items ticked — Phase 4 (REF-01, REF-02, REF-03, REF-04)
- ✓ Dependency baseline current: `npm audit --omit=dev --audit-level=high` exits 0 under Next 16.3.1 and Node 24.18.1, CI gates at `high`, both Next-bundled exceptions closed on observed evidence (Sharp 0.35.3, PostCSS 8.5.23/8.5.26), next review 2026-12-01 — Phase 4 (DEP-01)
- ✓ Token contract defined (23 tokens: 17 colours, 4 radii, 2 font faces) and the current volt-dark look moved verbatim to `themes/volt-dark.css` under `[data-theme="volt-dark"]` — Phase 5
- ✓ All storefront components and page templates use token classes; whole-tree `scan:tokens` finds zero hardcoded palette values in storefront code (admin excluded) — Phase 5
- ✓ Prebuild theme scan (`scripts/build-themes.mjs`) generates the CSS barrel + typed manifest and fails `build:worker`/`predev` on an invalid theme file — Phase 6
- ✓ `getActiveTheme()` resolves `admin_settings` → `NEXT_PUBLIC_THEME_DEFAULT` → manifest default per request in the async root layout, with `theme.unknown_selection` telemetry — Phase 6
- ✓ Admin Appearance page with manifest-driven swatch-preview cards (industry + synopsis metadata), Active badge, explicit Save through the existing settings API — Phase 6
- ✓ Three presets ship (`volt-dark`, `luxe` light, `midnight` dark); light-preset scrim QA fixed three shadcn overlays — Phase 6
- ✓ All six direction-doc presets ship (`luxe`, `midnight`, `clinical`, `retro`, `atelier`, `market`) plus `volt-dark`; both type tokens wired site-wide so each preset's display face renders — Phase 6.1
- ✓ Admin Appearance page: three layout switches (category layout, home hero, product gallery) as segmented controls, saved through the settings API — Phase 7
- ✓ Category, home hero and product gallery render as enumerated, server-chosen named variants (8 components, typed lookup maps, repo-wide contract test) — Phase 7
- ✓ `docs/theming.md` (contract, anatomy, duplication recipe, validator rejections, resolution, admin, layouts, gates, QA summary, known limits), `docs/CLAUDE.md` refreshed, codebase docs refreshed, 21-run visual QA matrix with zero defects — Phase 8
- ✓ v2 tech debt closed: emails and the crash page follow the admin-selected theme (staged on effect rows for cron retries), `scan:tokens` in CI, one request-scoped appearance read, one image resolver, loud parity snapshots, logged seed fallback, review Info items, order-status screenshots via a dev-only seeded order — Phase 8.1
- ✓ Docs overhaul: 9 docs retired, 20 remain under one style contract with a claim check against the code and `npm run docs:lint` guarding references, script names, retired paths, locked ADRs and status lines; README product-neutral with preset screenshots; root `AGENTS.md` (Next-generated block preserved) with an ordered command-exact setup path, root `CLAUDE.md` pointing to it, `docs/CLAUDE.md` 655→236 lines — Phase 8.2 (DOCS-04, DOCS-05)
- ✓ Gift card catalogue product: `prod_33` "Voltique Gift Card" (`type = gift_card`, `fulfillment_type = digital`, four variants at $25/$50/$100/$200, `tax_category = txcd_00000000`, untracked inventory) seeded as an idempotent `INSERT OR IGNORE` block in `data/d1/seed.sql`, applied to production D1 (status active), rendering at `/product/gift-card` and in the Featured grid with a Workers AI dark-studio image at `products/gift-card-33.png`; never-out-of-stock and never-decrement proven by tests on the existing helpers — Phase 9 (CAT-01..CAT-04)
- ✓ Production enablement: both gift-card key rings live as Worker secrets (names only, generated by non-echoing pipelines) and mirrored in an untracked `.dev.vars`; `STORE_FEATURE_GIFT_CARD_RECONCILIATION` deployed and verified (clean cron cycle) before `STORE_FEATURE_GIFT_CARD_ACQUISITION`; `docs/runtime-configuration.md` documents the delivery ring; `docs/DEPLOYMENT_SETUP.md` §9 carries the enablement recipe; `.env.example` shows all four secret shapes — Phase 11 (OPS-01..OPS-04)

- ✓ Product-page recipient form (email, name, note, delivery date) with server-parity validators; cart lines keyed by recipient and denomination; recipient details on cart, checkout, confirmation and account order surfaces; digital-only checkout with a billing step — v2.1 (Phase 10)
- ✓ Volt, the support article, product copy and Terms §6 describe the gift card that ships; knowledge and product vectors re-indexed by upsert — v2.1 (Phase 12)
- ✓ One real Stripe test-mode gift-card purchase on production issued a card and delivered the email (cron-driven, Cloudflare Email Sending) — v2.1 (Phase 12, SHOP-07 with the account-listing clause withdrawn)
- ✓ Gift-card tender applied on the Payment Information step with Apply/Remove, previous hold released on re-quote, masked code on the summary and receipt — v2.1 (post-proof, from Russell's live checkout)

- ✓ Gift-card flags sell and honor do what their names say: sell=off stops sales (product page unavailable notice, checkout server-side rejection), honor=off refuses while any balance or open reservation exists (a cron-written honor guard, not a per-request scan), off/off hides every surface including the admin nav — v2.2 (Phase 13)
- ✓ Gift-card admin: searchable list, per-card timeline (ledger + reservations + deliveries + human actions), disable, once-only reissue, resend, re-queue, release-hold, admin-create, CSR notes, confirm-gated code reveal, expand-only `gift_card_events` audit table (migration 0024) — v2.2 (Phase 14)
- ✓ Subscription product page: an "Add a new address…" select option opens a modal with the shared `AddressForm`; saving pre-selects the address and leaves plan/quantity/terms untouched — v2.2 (Phase 15)
- ✓ Blog reachable from the header (desktop + mobile, admin-labelled, hidden when nothing published) and a configurable home-page articles block (heading, count, on/off, placement) — v2.2 (Phase 16)
- ✓ Saved payment methods for signed-in shoppers: one Stripe Customer per shopper, a Customer Session drives the Payment Element's saved-card UI, Account → Payment methods lists/removes; guests unaffected, Link stays hidden — v2.2 (Phase 17)
- ✓ Tech debt closed: `/api/tax` deleted, `order-effects` `{ DB }` fallback removed, invalid cart gift notes warn instead of vanishing, delivery-retry telemetry split (only terminal failures page), one digital-only-cart rule cross-referenced and pinned, digital-only order confirmation email and billing address fixed, migration-number-collision check added, admin Appearance theme metadata confirmed already shipping — v2.2 (Phase 18)
- ✓ Operator checklist: Stripe Tax enabled on the live account, `STORE_SUPPORT_EMAIL` set and routed, `ORDER_STATUS_SECRET`/`EMAIL_UNSUBSCRIBE_SECRET_CURRENT` added, stale `ADMIN_USER_IDS` deleted — v2.2 (Phase 19, human-checkpoint)

### Active

<!-- Next milestone candidates. Seeds in .planning/todos/pending/. -->

(None yet — v2.2 shipped with 0 open requirement gaps. Candidates for the next milestone live in `.planning/todos/pending/`: `consolidate-stripe-customer-bindings.md`, plus whatever surfaces from the next round of live testing.)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- An Account → Gift cards listing — removed 2026-09-10. A gift card is a bearer instrument delivered by email, not an account object; a purchaser-keyed listing could never show the recipient anything and misled the buyer. Admin management replaces it.
- Stripe Link's "Save my information" box — hidden 2026-09-10, replaced by a real saved-payment-methods feature in v2.2 (Phase 17); Link itself stays off — re-enabling it is a separate, explicit future decision, not part of this feature.
- Inline gift-note editing in the cart drawer — v2.2 (Phase 18) gives the shopper an actionable warning (remove and re-add) instead; a full edit flow is a bigger UI feature than tech-debt closure scope.
- Sharing one Stripe Customer table between checkout and subscriptions — v2.2 (Phase 17) deliberately kept `payment_customers` separate from `subscription_provider_customers` to avoid touching revenue-critical subscription code in an unattended run; consolidation is a future refactor (`consolidate-stripe-customer-bindings.md`).

- The 12 planned items from the retired `docs/ROADMAP.md` (PWA, touch interactions, wishlist, social, visual search, predictive analytics, multi-language, advanced security, email marketing, advanced analytics, image caching, reviews header) — backlogged in `.planning/milestones/v1-REQUIREMENTS.md` by user decision; v1 was hardening only. Candidates for the next milestone, not out of scope forever
- Unbuilt modules from the retired `docs/admin-dashboard-specification.md` (MFA, WebSocket/SSE, custom report builder, fulfillment automation, GDPR/CCPA tools, VIP tiers, personalization admin) — that document is a historical design doc, not a backlog (W2 resolved); admin is treated as shipped
- The U13 shipment command and `SHIPMENT_NO_UNSETTLED_REFUNDS_SQL` end-to-end CAS test — future ADR-scoped work with its own migration; not a hardening gap
- Account deletion and personal-data export — explicitly deferred by `docs/customer-communications.md`; needs a separate design
- Switching the `pk_test_` Stripe/Clerk publishable keys in `wrangler.jsonc` to live keys — production is intentionally a demo environment with no live Stripe account (confirmed 2026-09-01)
- Splitting large service files (`checkout-pricing.ts`, `reviews.ts`, `products.ts`, `inventory.ts`, `agent-chat/route.ts`) — refactor with no user-observable outcome; revisit only when a feature touches them
- Deleting the 12 empty `app/api/*` directories — git does not track empty directories, so they exist only in the local working tree; one local `find app/api -type d -empty -delete` clears them
- Playwright mobile suite and Lighthouse CI workflow from the retired `docs/mobile-testing-automation.md` — v1 records a one-time baseline (MOB-01); ongoing automation is backlog
- Differentiating the generic `"Checkout details are invalid or unavailable"` response — telemetry already records `payment.pricing_rejected` with an error class; user-facing detail would leak validation internals

## Context

**Brownfield.** The codebase was mapped on 2026-08-31 (`.planning/codebase/ARCHITECTURE.md`, `CONCERNS.md`, `CONVENTIONS.md`, `INTEGRATIONS.md`, `STACK.md`, `STRUCTURE.md`, `TESTING.md`) and 26 docs were ingested on 2026-09-01 (`.planning/intel/`, `.planning/INGEST-CONFLICTS.md`). Milestone v1 existed because the docs and the code disagreed in specific, verified places. As of 2026-09-02 they agree; the codebase map and ingest intel predate v1's changes and should be refreshed (`/gsd-map-codebase`) before planning code-heavy work.

**Docs after v2.** `docs/` holds 20 files: four locked ADRs (`checkout-trust-boundary.md`, `webhooks-refunds-inventory.md`, `database-migrations.md`, `subscriptions.md`), the setup runbook `DEPLOYMENT_SETUP.md`, `theming.md`, `architecture.md`, `CLAUDE.md` (AI-assistant context), and the feature references. The 2025-era docs that described an earlier system were retired in Phase 8.2 (`docs/CHANGELOG-docs.md` lists them). Root `AGENTS.md` is the onboarding entry point; `gsd-ingest-manifest.yaml` must list exactly the files in `docs/` (`npm run docs:lint` enforces it).

**Facts a planner should not re-derive** (all now reflected in `docs/` after v1):
- MCP `place_order` (`lib/mcp/tools/order.ts`) calls the same `finalizeOrderPayment` as `app/api/orders/route.ts` and the Stripe webhook route. MCP checkout is inside the paid inventory boundary; ADR-CTB-15 is superseded and `docs/checkout-trust-boundary.md` says so.
- Admin auth is enforced in production through Clerk role or an active `adminUsers` row, or a header-only bearer token. The `x-dev-admin` bypass and the signed-in-user shortcut require `NODE_ENV === "development"`, and `lib/auth/deployment-guard.ts` returns 503 if such a build ever reaches the Workers runtime.
- The text model is `@cf/openai/gpt-oss-20b` (`lib/ai/config.ts`). The MCP server exposes 19 tools (`app/api/mcp/route.ts`).
- `npm run deploy` never applies remote migrations (ADR-DBM-01). `npm run deploy:ci`, used by Cloudflare Workers Builds, applies production migrations before uploading. Expand-only migrations (ADR-DBM-05) is a hard rule because the schema lands before the new Worker.
- Migrations live in `migrations/`; the highest tracked file is `0025_add_payment_customers.sql`; the next free schema-bearing number is `0026`. Two files share number `0023` (`0023_add_order_effects_payload.sql`, `0023_normalize_tax_category_codes.sql`), both applied in production and deterministically ordered by filename — documented in `docs/database-migrations.md`, and `check:migrations` now refuses any new file that reuses an existing number.
- The gift-card money decision ("is honor effectively on") has one owner: `resolveHonorEffective` in `lib/gift-cards/honor-guard.ts`, called by the runtime, checkout, the balance route, and the admin page/API — never re-derived independently.
- Two separate Stripe Customer bindings exist by design: `payment_customers` (checkout saved cards, migration 0025) and `subscription_provider_customers` (subscriptions, pre-v2.2). A shopper who uses both features gets two Stripe Customer objects; consolidating them is deferred (`consolidate-stripe-customer-bindings.md`).
- Telemetry taxonomy now includes `auth.deployment_guard_tripped`, `checkout.tax_fallback`, `payment.intent_failed`, and `theme.unknown_selection`; web vitals go to the `mercora_web_vitals` Analytics Engine dataset via the `WEB_VITALS` binding. The `commerce-observability-tail` Worker is wired as a tail consumer in `wrangler.jsonc`.
- `wrangler.jsonc` carries two `pk_test_` publishable keys by design (demo environment); the file stays tracked.

**Known debt after v1–v2.2** (nothing here blocks feature work):
- Mobile Lighthouse scores are 72–80 on all four measured routes against a target of 85.
- `NEXT_PUBLIC_SITE_URL` is a runtime var only, so the live sitemap advertises `mercora.example.com` until a Workers Build variable is added.
- `lib/hooks/useEnhancedUserContext.ts` still has the cosmetic `favoriteCategories` TODO.
- Six non-`/api/admin` callers of `authenticateRequest` get 401 rather than 503 when the deployment guard trips (documented residual, `docs/admin-authentication.md`).
- Client-side dev-mode admin shortcuts in `components/admin/AdminGuard.tsx` remain (accepted risk AR-01-03).
- Direction-doc theme properties outside the 23-token contract are backlog (`.planning/todos/pending/`).
- `payment_customers` and `subscription_provider_customers` are two separate Stripe-customer bindings for the same shopper (v2.2, Phase 17 D-02) — consolidation deferred.
- Inline gift-note editing in the cart is not built; an invalid note gets an actionable warning (remove and re-add), not an edit flow (v2.2, Phase 18).
- The retroactive gift-note default (send the note on old pending deliveries, ratified not re-decided) awaits Russell's confirmation or override (v2.2, Phase 18 D-10).

## Constraints

- **Tech stack**: Next.js 16.3.1 App Router on Cloudflare Workers via `@opennextjs/cloudflare` 1.20.2; D1 (`mercora-db`) with Drizzle 0.45.2; R2 (`voltique-images`, public CDN); Vectorize (`voltique-index`, 768-d cosine); Workers AI; Clerk 7.x; Stripe 22.x; TypeScript 6.0.3 — the deployed platform; not changing in this milestone
- **Runtime**: Node 24.18.1 (`>=24.18.1 <25`), use `mise exec --` for project commands — ADR-WRI-14 and `package.json` engines
- **Security**: Stripe, Clerk, Cloudflare, gift-card HMAC, and unsubscribe secrets live only in Worker secrets or `.dev.vars`; never in `wrangler.jsonc`, `lib/store-config.ts`, source, docs, or git history; `NEXT_PUBLIC_*` values are intentionally public — ADR-WRI-03, RC-03, RC-06
- **Telemetry**: `commerce.telemetry.v1` accepts only the closed event/severity taxonomy and low-cardinality fields; never headers, cookies, payment details, customer or order identifiers, addresses, raw exceptions, or query-bearing URLs; telemetry failure must never change commerce behavior — OBS-01, OBS-02; any new event (tax fallback, web vitals) must respect this
- **Data**: Migrations are additive expand/contract only, hand-authored in `migrations/`, numbered from `0024`; never down-migrate merchant, subscription, or gift-card state — ADR-DBM-05, ADR-SUB-01, CP-03
- **Money**: Integer minor units in D1 via the `Money` class; MACH decimal wire shape on HTTP/MCP; single currency per cart — MCP-05, CONVENTIONS.md
- **Verification gates**: `npm run build:themes:check`, `npm run scan:tokens`, `npm run lint`, `npm run typecheck`, `npm run cf-typecheck`, `npm test`, `npm run test:workers`, `npm run test:observability-worker`, `npm run check:migrations`, `npm audit --omit=dev`, `npm run build` all run in CI; `npm run docs:lint` is a local gate; the Workers suite is a required correctness gate — ADR-WRI-14, OBS-08, `.github/workflows/ci.yml`
- **Provider isolation**: No development or test path may call Stripe, send email, deploy, create Cloudflare resources, or use real credentials — REQ-gift-cards-invariants, OBS-07
- **Image pipeline**: The custom image loader must remain and image handling must not switch to Next's default optimizer while the Sharp audit exception is open — `docs/dependency-security.md`
- **Documentation as source**: `docs/` is the ingest source for planning; `gsd-ingest-manifest.yaml` types each doc and must match the `docs/` tree exactly (`npm run docs:lint`); the four locked ADRs are trim-and-link only, never merged, renamed or deleted; the Next-generated block in `AGENTS.md` is never hand-edited
- **Theming line**: tokens plus enumerated variants only; never per-theme markup, never free composition; the 23-token contract is one-way frozen (adding a token touches the validator, every theme file, and the sweep)
- **Regression sensitivity**: Russell's profile flags regressions as the top frustration; verify safety and flag risk before touching working checkout, webhook, or auth code

## Key Decisions

<!-- Locked = binding. ADR-DBM entries are locked by manifest; the other three ADR sources are treated as locked per user direction (manifest types them "ADR – binding decisions"). -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **[LOCKED] ADR-DBM-01** `npm run deploy` never applies remote D1 migrations | Schema changes are an explicit operator action; a preview or failed build cannot mutate production data | ✓ Good |
| **[LOCKED] ADR-DBM-02** `npm run dev` runs `db:prepare:local` against local Wrangler state only | No Cloudflare access, no seeding or erasing from dev startup | ✓ Good |
| **[LOCKED] ADR-DBM-03** Preview migrations require `preview_database_id` and abort rather than fall back to production | Prevents accidental production writes from preview commands | ✓ Good |
| **[LOCKED] ADR-DBM-04** Production apply requires confirmation plus `MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1`; status is verified after apply | Two independent guards on the most dangerous command | ✓ Good |
| **[LOCKED] ADR-DBM-05** Migrations are additive (expand, deploy, contract later); back up before destructive production changes | `deploy:ci` applies migrations before the new Worker uploads, so old code must tolerate new schema | ✓ Good |
| **[LOCKED] ADR-CTB** Checkout is one server-owned state transition: the server recomputes all pricing, persists the pending order with an immutable PaymentIntent binding, and the browser asserts nothing about money or ownership | Removes price manipulation, unverified payment, and client-owned order state | ✓ Good |
| **[LOCKED] ADR-CTB-04/05** One shared finalizer verifies the PaymentIntent server-side; effects are staged before the guarded paid CAS and drained durably by cron | Idempotent across inline, redirect, webhook, and MCP paths; correctness never depends on the isolate surviving | ✓ Good |
| **[LOCKED, supersedes ADR-CTB-15] MCP and storefront share one idempotent payment finalizer** | Verified in code (`lib/mcp/tools/order.ts:148`); MCP `create_payment_intent`/`place_order` are inside the paid inventory boundary | ✓ Good — doc update is ADR-01 |
| **[LOCKED] ADR-CTB-10** Gift cards and subscriptions are optional capabilities behind `lib/commerce/capabilities.ts`; core checkout imports neither; defaults are no-ops | Keeps the money path small and lets features be disabled by flag | ✓ Good |
| **[LOCKED] ADR-CTB-12 / WRI-07** `product_variants.inventory` JSON is the inventory authority; paid decrements and restocks are ledgered in `inventory_adjustments` with deterministic keys, mutated in one D1 batch | Exactly-once stock movement under duplicate events; the MACH `inventory` table is compatibility only | ✓ Good |
| **[LOCKED] ADR-CTB-08/09** Order reads are owner- or admin-scoped (an order id is not a credential); `PUT /api/orders` is metadata-only with CAS and protected keys | Guests cannot read orders by id; generic writers cannot touch money, payment, or lifecycle fields | ✓ Good |
| **[LOCKED] ADR-CTB-13 / WRI-09/10** Refunds reserve balance before Stripe with a deterministic idempotency key; Dashboard refunds reconcile only from `charge.refunded`; external full restock is default-off and fails closed | No double refunds, no guessed restocks | ✓ Good |
| **[LOCKED] ADR-WRI-01/05/08** Stripe, order state, and inventory are durable retryable transitions; `processed_webhook_events` uses claim tokens and five-minute leases; the cron, not the HTTP response, is the recovery mechanism | A 200 to Stripe is not proof of work done; ledgers are | ✓ Good |
| **[LOCKED] ADR-WRI-02** One webhook endpoint subscribed to `payment_intent.succeeded`, `charge.refunded`, `refund.updated`, `refund.failed` (legacy `charge.refund.updated` tolerated) | Fixed contract for operators; docs listing extra events are stale (RUN-02) | ✓ Good |
| **[LOCKED] ADR-WRI-03** Stripe secrets live only in Worker secrets | Standard secret hygiene | ✓ Good |
| **[LOCKED] ADR-WRI-14** Gates run under Node 24; the Workers suite is required | D1 batch rollback, JSON predicates, leases, and CAS races are only real against real D1 | ✓ Good |
| **[LOCKED] ADR-SUB-01/10** Subscription acquisition is optional and off by default; reconciliation stays on once any subscription exists; never down-migrate; flag order is reconciliation then acquisition | Safe rollback by flag, never by schema | ✓ Good |
| **[LOCKED] ADR-SUB-02 / RC-07** Core one-time checkout never treats a plan selection as recurring | A product with plans stays purchasable once; only the guarded acquisition route creates subscriptions | ✓ Good |
| **[LOCKED] ADR-SUB-03/05/06** Acquisition uses a server-owned SetupIntent and a bounded reservation row (row id = Stripe idempotency key); lifecycle state is created only by the signed `customer.subscription.created` event; orders come only from verified paid invoices, one per invoice | No synthesized webhook cursors, no order without verified money | ✓ Good |
| Admin authentication is enforced in production; dev bypasses are gated on `NODE_ENV === "development"` (W3) | Verified in `lib/auth/admin-middleware.ts:22`, `lib/auth/unified-auth.ts:163`; `docs/CLAUDE.md` and `DEPLOYMENT_SETUP.md` are stale | ✓ Good — hardening in SEC-03, docs in SEC-04 |
| `docs/admin-dashboard-specification.md` is a historical design document, not a backlog (W2) | Live admin routes cover the shipped scope; its unbuilt modules are not planned | ✓ Good — label in REF-04 |
| The production text model is `@cf/openai/gpt-oss-20b` (I8) | `lib/ai/config.ts:29` is the single source of truth | ✓ Good — docs in REF-01 |
| Migrations nuance: `deploy` never migrates; `deploy:ci` migrates production first | Both true; not a conflict. Recorded so nobody "fixes" one to match the other | ✓ Good — runbook in RUN-01 |
| v1 is a hardening milestone; the 12 `docs/ROADMAP.md` items are backlog | User decision 2026-09-01; docs and code must agree before feature work resumes | ✓ Good — shipped 2026-09-02 in 3 days; the audit found no gaps and the backlog is intact for the next milestone |
| Publishable `pk_test_` keys stay in tracked `wrangler.jsonc` | Production is a demo with no live Stripe account; publishable keys are public by design; Workers Builds and deploy scripts read the file | ✓ Good |
| Deployment guard detects "deployed" via `navigator.userAgent === "Cloudflare-Workers"` and trips only when combined with `NODE_ENV === "development"`; fails closed per request (503), never at boot (Phase 1) | No new config; local `next dev` and vitest are unaffected; storefront keeps serving while admin locks. Live-bundle assumption accepted on static evidence 2026-09-02 (guard present in the OpenNext bundle, nothing shadows `navigator`, compat date guarantees the global) | ✓ Good — first-deploy confirmation step documented in `docs/admin-authentication.md` |
| The dev-bypass value stays a source literal in `lib/auth/admin-middleware.ts`; docs use prose placeholders, never the value (Phase 1) | Russell's choice 2026-09-01; the guard closes the deployed-development case, so the literal is harmless in production | ✓ Good |
| `ADMIN_VECTORIZE_TOKEN` rotated by the executor with a single `openssl rand -hex 32 \| wrangler secret put` pipeline; verified only with the old value (Phase 1) | Value never printed or stored; proof is two live 401s. Required pushing `main` first because Cloudflare refuses secret edits when the latest uploaded version is not deployed | ✓ Good |
| `workflow.use_worktrees=false` for this project | Fresh git worktrees have no `node_modules` or `.dev.vars`, so parallel executors would fail vitest and wrangler or spend minutes on `npm ci`; sequential execution on the main tree is the safer trade | ✓ Good |
| Client-side dev-mode admin shortcuts in `components/admin/AdminGuard.tsx` left unchanged (code-review WR-04) | Accepted by Russell 2026-09-02: no unintentional path puts a development build in production, the site is a demo, and server-side guards hold; residual is a visible nav link | ✓ Good — accepted risk AR-01-03 |
| Web-vitals sink is a Workers Analytics Engine dataset (`WEB_VITALS` → `mercora_web_vitals`), not D1 (Phase 2) | Purpose-built for metrics, no schema migration or retention job; five fields only, route template derived server-side | ✓ Good — post-deploy row check tracked in STATE.md |
| `handlePaymentFailed` is telemetry-only and the `payment_intent.payment_failed` subscription stays (Phase 2) | ADR-WRI forbids order-state changes outside the ledgers; the event is still useful ops signal | ✓ Good — runbook update is RUN-02 in Phase 3 |
| `allocateDiscount` caps every line at its own capacity and redistributes remainder cents ascending by index (Phase 2, code-review CR-01) | The old algorithm could give the last line more discount than its value, producing a negative net line and a crash in the fallback tax path | ✓ Good — invariants pinned by tests |
| Live sitemap advertises `mercora.example.com` because `NEXT_PUBLIC_SITE_URL` is only a runtime var, not a Workers Build var (Phase 2 finding) | `app/sitemap.ts` resolves the host at build time | — Pending Russell: add the Build variable and redeploy (carried out of v1 as an operator follow-up) |
| ADR status markers are one `**Status:** Accepted (YYYY-MM-DD)` line under each H1, dated to each doc's first commit, not to the day they were labeled (Phase 3) | The classifier keys on the literal `Status: Accepted`; the first-commit date is when the decision actually took effect. The manifest `locked: true` keys are a human-readable record only; the classifier does not read them | ✓ Good — ingest re-run classified all four ADRs LOCKED |
| `payment_intent.payment_failed` stays subscribed and is listed under Required in both runbooks; `checkout.session.completed` removed from docs and from the route's dispatch switch (Phase 3) | Phase 2 made the failed-payment handler telemetry-only but kept the event; the checkout-session case was a comment-only no-op returning `ignored`, identical to `default`, so deleting it is behavior-neutral and makes "docs match the route" literally true | ✓ Good — 29 deletions, 0 insertions; regression test pins the fall-through |
| Remote migration commands in runbooks are the four `db:migrate:*` npm scripts only; local keeps `wrangler d1 migrations apply --local`; `npm run deploy` never applies remote migrations, `npm run deploy:ci` does (Phase 3) | The scripts wrap `scripts/d1-migrate.mjs`, which gates production on `--confirm-production` plus `MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1`; the docs must not offer an unguarded path | ✓ Good |
| Docs name the exact model id `@cf/openai/gpt-oss-20b` and cite `app/api/mcp/route.ts` for the 19-tool count; mermaid node ids renamed with the labels (Phase 4) | One source of truth each (`lib/ai/config.ts`, the route's "Available tools" string); a label-only rename leaves misleading ids in diagrams | ✓ Good — repo-wide `grep -ri llama docs/` is empty |
| Historical material is labelled with a `> **Status: Historical (September 2025).**` blockquote under the heading, not deleted or moved (Phase 4) | Same position as the ADR status markers; keeps the design history readable while stopping a reader from mistaking a proposal for the shipped system | ✓ Good |
| CI dependency audit gate raised from `critical` to `high`; both Next-bundled exceptions closed on observed evidence rather than deleted (Phase 4) | `npm audit --omit=dev` is clean under Next 16.3.1 (Sharp 0.35.3 hoisted, PostCSS patched), which is the exit condition the doc's own rule set; closed entries keep the history | ✓ Good — next review 2026-12-01 |
| Phase 4 planned with `--skip-ui`: the UI plan gate matched the word "dashboard" inside the filename `admin-dashboard-specification.md` (Phase 4) | Markdown edits and one CI line; no UI code. Recorded as a flagged assumption in plan 04-04 | ✓ Good |
| `commerce-observability-tail` wired as a `tail_consumers` entry in `wrangler.jsonc` at milestone close (post-Phase 4) | The audit found the tail Worker deployed but not attached, so critical-severity alerts never reached the consumer | ✓ Good — email delivery check pending the next deploy |
| Milestone v1 closed with tech debt accepted, not with open gaps | The audit satisfied all 19 requirements; the remaining items are operator follow-ups outside the repo, Cloudflare hygiene, or backlog | ✓ Good |

| Token contract frozen at 23 tokens (17 colours incl. a 5-token inverse set, 4 radii, 2 font faces), not ~18; four discretionary volt-dark values adopted as measured: on-primary=black, border/ring=neutral-700, warning=amber-500, border-inverse=gray-700 (Phase 5) | Names locked in discussion (D-01); values derived from usage counts. border-inverse serves both drawer edges and email dividers, so email dividers darkened — accepted, with Phase 6 as the place to split the token if it reads badly | ✓ Good — user decision `adopt-all` 2026-09-04 |
| The palette scan gate (`scripts/scan-hardcoded-colors.mjs`, `scan:tokens`) was built first and proven to fail on the dirty tree before any sweep; the Playwright harness (`screenshot:routes`) diffs every chunk against one pre-sweep baseline (Phase 5) | A "zero violations" claim is only worth something if the gate was seen failing; the pixel diff caught four real regressions that scanner, build, lint, typecheck and tests all missed | ✓ Good |
| Checkout and order-status panels normalised from legacy light (`bg-white`) to the dark main-set tokens rather than kept as extra inverse-surface exceptions; only the two drawers, Stripe Elements, and emails use the inverse set (Phase 5) | Keeps the inverse set scoped to the four surfaces TOKEN-MAP names; the largest deliberate visual change in the phase, accepted at human verification | ✓ Good |
| Non-cascade consumers (Stripe Elements, Clerk, emails, global-error) read hex via `getThemeTokens()`; the client receives a narrowed `PublicStoreConfig` (no merchant email) through `StoreConfigProvider` (Phase 5) | Server-computed tokens mean Phase 6 can make the active theme a per-request D1 read without touching callers; the narrowing closed a code-review finding | ✓ Good |
| `app/not-found.tsx` added because Next's built-in 404 injects an unlayered white body background that beats Tailwind once the root inline style is gone (Phase 5) | Reachable from every `notFound()` call site, not just tooling; caught by the screenshot diff | ✓ Good |

| A theme is one CSS file: a metadata header comment (`@theme label | industry | synopsis`) plus a single `[data-theme="<name>"]` block with all 23 tokens as 6-digit hex; the validator rejects anything else (`@import`, `@font-face`, second selectors, unknown tokens); generated barrel + manifest are committed with a CI `--check` (Phase 6) | Themes are data, not code; email/Stripe read hex from the manifest; committed generated files keep `tsc`/vitest working on a fresh clone | ✓ Good |
| `theme.unknown_selection` is registered in `TELEMETRY_EVENTS` only, not in the tail Worker's `TAIL_CRITICAL_EVENTS` (Phase 6) | That list is `severity: critical`-only and test-enforced; a warning event there breaks a passing test. Parity test asserts the event is known and correctly absent | ✓ Good — accepted reading of THEME-02 |
| Theme resolution is one blocking D1 read per request in the root layout, no isolate cache, no Suspense; `NEXT_PUBLIC_THEME_DEFAULT` declared in `wrangler.jsonc` and as a Workers Build variable (Phase 6) | An isolate-level cache serves a stale theme after an admin save; Suspense would cause FOUC | ✓ Good — Build variable pending Russell |
| Presets beyond the three shipped (Clinical, Retro, Atelier, Market) and the direction doc's extra properties (shadow, border-width, image-aspect, accent-2, mono) are deferred; the 23-token contract stays frozen (Phase 6) | Contract is one-way (Phase 5 D-01); extra properties would touch the validator, every theme file and the sweep | ✓ Good — backlog |
| Light-preset scrims: `dialog`, `alert-dialog`, `sheet` use `bg-black/NN` under the scanner sentinel; the category hero overlay was inspected and left as-is (Phase 6) | Token-driven scrims inherit theme polarity and washed out under `luxe`; a scrim must be polarity-neutral; no new token | ✓ Good |

| Type tokens wired site-wide: `font-family: var(--store-font-sans)` on `body`, `font-display` on the 23 page-title headings, and the `next/font` variable classes on `<html>` as well as `<body>` (Phase 6.1, D-10) | The storefront had been rendering in `system-ui` since v1; a token declared on `<html>` cannot resolve a nested `var()` that only exists on `<body>`. volt-dark's shift to Geist is an intentional snap (S-TYPE-01) | ✓ Good — Russell accepted the visible change |
| Display faces load via `next/font` with `preload: false` and the weights headings actually use; `font-synthesis: none` means an unloaded weight renders at the nearest loaded one, so weight arrays must match usage (Phase 6.1, code-review CR-01) | Cormorant shipped with 400/500 only and Luxe's bold headings silently thinned | ✓ Good |
| Page-level `focus:bg-*` overrides on `SelectItem` are removed rather than layered; the primitive owns its highlight (Phase 6.1) | `twMerge` last-wins let a page override reintroduce the invisible-highlight bug the phase had just fixed | ✓ Good |

| Layout switches: enum names in `lib/layout/variants.ts` are the primary identity; `getLayoutSettings()` reads `appearance.*` per request (accepted second D1 read, no cache); server pages resolve the enum and pass the typed value into client displays, which do one typed map lookup to a named component (Phase 7) | React Server Components cannot serialize a component reference across the client boundary; a typed enum + typed map keeps LAYOUT-04's "no generic layout prop" guarantee, enforced by a repo-wide contract test | ✓ Good |
| Default variants (`grid-3`, `minimal`, `left`) are verbatim extractions proven by pre-extraction snapshots and volt-dark screenshot parity; non-default variants are new captures, not diffs (Phase 7) | Extraction must not move pixels; new layouts have no baseline | ✓ Good — one 2-pixel headless-rendering residual accepted as S-07-01 |
| Admin `LayoutSwitches` POSTs only changed keys and shares `nextRovingIndex` with `ThemePresetGrid` via `components/admin/roving-index.ts` (Phase 7 code review) | Rewriting all three keys risked lost updates between concurrent admins; a copied helper drifts | ✓ Good |

| Admin settings GET seeds only the default keys absent in the requested scope, with `onConflictDoNothing()` so concurrent cold starts degrade to a no-op re-select (Phase 8) | The previous "any row exists" gate starved other categories forever once one category was seeded, and a category-filtered GET on an empty category re-inserted every default and collided on the primary key | ✓ Good — 9-case regression test |
| `scan:tokens` is documented as NOT wired into CI (only `build-themes --check` is); adding it is a recorded follow-up rather than a same-phase CI change that would falsify the doc it ships with (Phase 8) | Docs and CI must agree on the day they land | ✓ Good — follow-up |
| Visual QA matrix judged 7 presets × 3 packed layout combinations (21 runs, 672 cells) via a stated factorisation of the six criteria, not exhaustive per-cell inspection; 46 judgements, zero defects (Phase 8) | Criteria that vary by combination were checked once per combination, criteria that vary by preset once per preset, plus a light-preset cross-check under full-bleed | ✓ Good |

| Emails and the crash page follow the admin-selected theme: pure builders take `tokens`; senders resolve once via `resolveEmailTheme()`; effects staged during a request carry `themeName` in a new nullable `order_effects.payload` column (expand-only migration 0023) so the cron drain renders the right theme without a request context; `global-error.tsx` fetches public `GET /api/theme` after a default first paint (Phase 8.1) | Russell's decision; `getActiveTheme()` cannot run in `scheduled()`, and a client crash page cannot read D1 | ✓ Good |
| One request-scoped `React.cache` reader (`lib/themes/appearance-read.ts`) shared by the theme and layout resolvers; `React.cache` is a no-op outside a render, so it is the one allowed cache (Phase 8.1) | Avoids a second D1 read per page without an isolate cache | ✓ Good |
| Bare relative image paths now resolve root-relative (`/products/x.jpg`) after consolidating on `resolveProductImageSrc`; the one accepted output change, product route hash-identical (Phase 8.1, D-11) | A bare path resolves against the current route and was the less correct form | ✓ Good |

| Docs retirement is one commit per document: delete, fix inbound links, drop the manifest entry, add a changelog line; the four locked ADRs are trim-and-link only (Phase 8.2) | A half-retired doc leaves dangling links and a manifest that lies; the ADRs are the ingest source of binding decisions | ✓ Good — 9 retired, `docs:lint` guards the invariant |
| `AGENTS.md` at the repo root is the coding-assistant onboarding file, wrapped around the Next-generated `nextjs-agent-rules` block; root `CLAUDE.md` is `@AGENTS.md`; `docs/CLAUDE.md` links rather than restates (Phase 8.2) | Russell's choice 2026-09-05; one entry point every assistant reads, `next dev` keeps regenerating its block byte-identically | ✓ Good — fresh-clone dry run pending Russell |
| Themed demo deployments deferred out of v2; README shows preset screenshots instead (Phase 8.2) | Demos need separate Workers, D1 and secrets per preset; the screenshots answer "what does it look like" without them | ✓ Good — `.planning/todos/pending/themed-demo-deployments.md` |
| `scripts/docs-lint.mjs` binds `locked: true` to each ADR's own manifest entry and requires a `**Status:**` line per doc (Phase 8.2 code review CR-01/WR-01) | A global marker count passed when the marker moved to another doc; the header check let four docs ship without a status line | ✓ Good — both mutations now fail the gate |
| Milestone v2 closed with 12 accepted open items, all environment-limited, user-owned, or explicitly deferred | Russell chose to close the code-closable debt first (Phase 8.1), then complete; the rest needs a Clerk/Stripe session, a person, or a later milestone | ✓ Good |
| Gift card tax classification is Stripe's unconditional nontaxable code `txcd_00000000` on the product and all four variants, not the jurisdiction-dependent `txcd_10502000` "Gift Card" code (Phase 9, D-09) | A $25 card must cost $25; tax is collected when the card is spent. Data-only, reversible with one `UPDATE` | ✓ Good |
| Gift card seed rows are a sentinel-delimited `INSERT OR IGNORE` block at the end of `data/d1/seed.sql` (`prod_33`, `variant_33..36`, `price_33`); production apply slices only that block, never the whole file (Phase 9, D-13) | Research proved the full seed file is not idempotent on replay (categories UNIQUE constraint); the block alone is | ✓ Good — one production write, read-back verified |
| Gift card catalogue product seeded `active` in production before Phase 10 ships the recipient form; a shopper who adds it to the cart is refused at checkout by the existing pricing guard until then (Phase 9, D-12; Russell chose `apply-active`) | Phase 9 closes against the real site and Phase 10 builds against a live product; demo-site interim accepted | ✓ Good — Phase 10 removes the interim |
| Gift card image is one shared 1024×1536 lucid-origin render (matte charcoal card, olive-drab edge, dark studio set, no lettering) chosen by the executor from four candidates; no per-denomination images, no home-page pinning, no footer link (Phase 9, D-02..D-07) | Keeps the template free of sample-data knowledge and matches the catalogue shoot; Russell confirmed the style match at UAT | ✓ Good |
| Gift-card key rings ship as one-version JSON: HMAC ring keys are raw ≥32-byte strings, delivery ring keys are `base64:` + 32 AES bytes; values are generated inline and piped into `wrangler secret put` / `.dev.vars`, never printed (Phase 11, D-01..D-04) | The parsers in `lib/gift-cards/config.ts` are the shape oracle; Phase 1's non-echoing pipeline is the precedent | ✓ Good — `wrangler secret list` shows four names, leak scans 0 |
| Flag rollout is two commits to `wrangler.jsonc` pushed to `main` (Workers Builds), reconciliation first and verified by a clean five-minute cron cycle, acquisition second behind a blocking-human gate (Phase 11, D-05..D-08) | `resolveCommerceCapabilities` throws if acquisition is on without reconciliation; `cf-typegen` runs with env files aside because `wrangler types` copies local env names into `cloudflare-env.d.ts` | ✓ Good |
| The reconciliation push deployed all ~98 unpushed commits including Phase 10's checkout, and acquisition was enabled while Phase 10's human verification stayed deferred (Phase 11; Russell: "Push as planned", `enable-anyway`, "demo site, I can always revert") | Demo site; reversible by flag flip and revert; Phase 12's live proof needs a purchasable card | ✓ Good — `/gsd-verify-work 10` still open |
| Phase 12 ran unattended under "move forward with best assumption decisions": the live proof was scripted (public key + `pm_card_visa`), and four production defects it exposed were fixed and deployed in the same run (fallback tax, `EMAIL_PROVIDER`, cron sender env, sender domain) | The proof was worth more than the phase's no-code rule; every change was tested, documented as a deviation, and accepted by Russell the next day | ✓ Good — first email ever sent from production; accepted via `/gsd-verify-work` |
| Gift-card code entry lives on the Payment Information step with its own Apply/Remove, not with the discount code; a re-quote names the previous order so the server releases its hold and cancels the old PaymentIntent | A gift card is a form of payment; the step-1 box was never found, and a reload stranded the card's balance for 15 minutes | ✓ Good — Russell redeemed the first card through it |
| No customer-facing gift-card listing (Account → Gift cards removed); SHOP-07's account clause withdrawn | A bearer instrument delivered by email is not an account object; the purchaser-keyed listing could never show the recipient anything | ✓ Good |
| Gift-card flags are sell (`ACQUISITION`) and honor (`RECONCILIATION`); sell-without-honor is invalid; sell=off must stop sales, honor=off must refuse while balances exist; off/off hides everything | Prepaid balances must be honored after a store stops selling cards; today's code gates redemption instead of sales, so the flags are redesigned in the next milestone | — Pending (v2.2 seed) |
| Stripe Link hidden in the Payment Element (`link: 'never'`) | Its "save my information" saved to Link, not to the store, which has no saved-payment feature | ✓ Good |

| Tender is gated on honor only, never sell; sell-without-honor keeps throwing `CommerceCapabilityConfigurationError`; honor=off is ignored (redemption keeps working) while a cron-measured `admin_settings` row shows any active balance or open reservation, missing/stale reading as "balances may exist"; hiding (sell/honor state) and honoring (money) are separate decisions — a hidden-both-off gift card can still be honored if money is outstanding (Phase 13) | Prepaid money must never be stranded by flipping a var; a per-request balance scan would be too slow, so the cron writes one small row the request path reads cheaply | ✓ Good |
| Listing visibility is one shared predicate (`lib/gift-cards/visibility.ts`) imported at nine public call sites, never inside `lib/models/mach/products.ts` (which `/admin/products` also uses); the money decision has exactly one owner, `resolveHonorEffective`, called by the runtime, checkout, the balance route and the admin page/API (Phase 13, review-found: four call sites had drifted to different preconditions before this was locked) | A second implementation of "is this hidden" or "is honoring effectively on" always drifts from the first; the review caught it once and the fix made drift structurally impossible | ✓ Good |
| Admin server pages gate on `checkAdminSession()` as their first `await`, in addition to the client-side `AdminGuard`; middleware redirects an anonymous `/admin` page request to sign-in before any segment renders (Phase 13 security audit, T-13-42/T-14-63) | The client guard alone doesn't stop a server-rendered admin page's data from reaching an anonymous request in the RSC payload — a real gap the honor-guard banner's own data exposed | ✓ Good |
| Reissue is one D1 `batch()` (adjustment, new account, issuance ledger, delivery, both audit events); once-only via a deterministic new-card id plus a partial UNIQUE index, not a sequential two-call implementation (Phase 14, code-review CR-01) | The first implementation could strand the old card's balance if the second write failed; the fix proved atomicity with a real injected-failure test, not just a same-input-twice test | ✓ Good |
| Code reveal is off by default (`gift_cards.code_reveal_enabled`), requires a super-admin session, a confirm step, and writes the audit event before decrypting — a failed decrypt after the event still wrote a truthful record, not a phantom reveal (Phase 14) | Codes exist only as an HMAC hash plus an encrypted delivery copy; revealing means decrypting in admin, which needed its own audit trail separate from ledger events | ✓ Good |
| Admin gift-card projections and event details are checked by a forbidden-column source contract that greps the actual read paths for code material (hash, ciphertext, nonce, key version, claim token, idempotency key), not relied on by review alone (Phase 14) | A single missed grep target let a WR-05 finding through a code-camelCase form the first pass didn't scan; the contract now covers both cases | ✓ Good |
| The address form is one shared component (`AddressForm.tsx` + `saveAddress()`) used by both the account page and the subscription-panel modal; the client's `isDigitalOnlyCart` and the server's `hasPhysicalCheckoutLines` stay two implementations, cross-referenced by doc comment and pinned by one invariant test, not merged into one function (Phase 15, Phase 18 D-05) | Plumbing `fulfillment_type` onto client cart items to make the second pair literally one function is a bigger, riskier change than either phase's scope; the test is the enforcement mechanism either way | ✓ Good |
| The blog's existence check on every storefront page is wrapped in its own try/catch, defaulting to "no blog link" on failure — kept separate from the unrelated `getContentSettings()` guard (Phase 16, code-review CR-01) | `Header.tsx` renders on every route; an unguarded D1 read for a link nobody needs to see that day would take down the whole storefront on a transient failure | ✓ Good |
| Saved payment methods use a Stripe Customer Session (`payment_method_save_usage` on the session, never `setup_future_usage` on the PaymentIntent — combining both is a documented Stripe integration error); `payment_method_remove: 'disabled'` on the session since removal lives on the account page, not in checkout (Phase 17, D-06/D-06a, verified against Stripe's current docs and the installed SDK types, not training-data recall) | The roadmap's literal "PaymentIntent with `setup_future_usage`" phrasing was wrong; research resolved the actual current Stripe mechanism before planning | ✓ Good |
| The DELETE payment-method route answers 404 for both "not yours" and "doesn't exist" through one shared function, and the idempotency-key derivation for the new Stripe-customer binding copies `stableId`'s exact NUL-byte separator from `lib/subscriptions/acquisition-service.ts` byte-for-byte, not from a paraphrase (Phase 17) | A distinguishable-but-different response leaks which ids exist to a probing caller; a wrong separator would silently produce different idempotency keys than the existing subscription-customer binding uses for the same concept | ✓ Good |
| `/api/tax` deleted outright rather than wired up — it had zero non-test callers and diverged from the authoritative `checkout-pricing.ts` (a different hardcoded rate, no gift-card exemption); `order-effects.ts`'s `{ DB }`-only gift-card environment fallback removed, since a partial environment is worse than none for issuance's own key-ring parsing (Phase 18, DEBT-01/02) | Dead code that duplicates and disagrees with the real implementation is a landmine, not neutral; the request path today never hit the fallback, but a future caller could have | ✓ Good |
| An invalid cart gift note is flagged (`giftCardNoteInvalid: true`), not silently dropped; `projectCartLineForCheckout` explicitly refuses a flagged line rather than letting an unvalidated blob through as if trusted (Phase 18, DEBT-03, code-review-found security edge) | Without the explicit refusal, a shopper could have paid for a gift card with no recipient ever recorded — the review found this before it shipped | ✓ Good |
| Gift-card delivery telemetry splits into `gift_card.delivery_retry` (warning, never pages) and `gift_card.delivery_failed` (critical, terminal only); the new `delivery_id` correlation field had to be added to both the producer sanitizer and the tail worker's own independent sanitizer, not just one (Phase 18, DEBT-04, code-review iteration-2 CR-01) | Every retry attempt paged identically to a terminal failure before this; the second sanitizer gap would have silently dropped the correlation id from the one alert email that matters | ✓ Good |
| Digital-only order confirmation emails use a union guard (the existing subscription flag OR `!hasPhysicalCheckoutLines`), not a straight replacement — a subscription renewal's `OrderItem` carries no `fulfillment_type`, so the server rule alone misreads it as physical (Phase 18, DEBT-06, planner-caught hazard, independently re-found by the executor) | A straight replacement would have re-introduced the exact bug (silently skipped confirmation emails) for a different order type; the union covers both | ✓ Good |
| Three v2.1 broken-windows entries closed on cited code-level evidence rather than re-fixed: the "scan:tokens is local-only" doc claim was already stale-fixed by unrelated Phase 8.2 work, the REQUIREMENTS-wide verify check lived only in an archived plan, and the retroactive gift-note question is ratified as "send it" by default (Phase 18) | Closing with evidence, not silent deletion, keeps the audit trail honest about what changed versus what was already true | ✓ Good |
| All three Phase 19 operator items executed and verified from outside the repo: Stripe Tax by Russell's direct dashboard confirmation, the support email and both new Worker secrets by live read-only checks (`curl`, `wrangler secret list`) after the fact, never by trusting the action alone | The whole milestone's own convention — code-level evidence over trust — extends to the one phase that has no code to check | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-11 — milestone v2.2 shipped*
