# Mercora

## What This Is

Mercora is an AI-assisted outdoor-gear commerce platform running on Cloudflare's edge. Its storefront brand is **Voltique**, live at https://voltique.russellkmoore.me, where shoppers browse gear, ask the **Volt** assistant for help, and check out with Stripe. The same commerce core is exposed to external AI shopping agents through an MCP server at `/api/mcp`, so an agent can search the catalog, build a cart, pay, and track an order without a browser.

## Core Value

A customer or an external AI agent can find the right outdoor gear through Volt, pay for it exactly once, and have inventory, order state, and refunds end up correct, whether they arrive via the storefront or the MCP server.

## Business Context

- **Customer**: Outdoor-gear shoppers on the Voltique storefront, plus AI shopping agents (Claude Desktop, Cursor, VS Code, custom agents) using the MCP server
- **Revenue model**: Direct product sales through Stripe; stored-value gift cards; subscriptions (new acquisition is off by default per ADR-SUB-01)
- **Success metric**: TBD
- **Strategy notes**: `docs/ROADMAP.md` (2025 strategic priorities; its 12 planned items are backlogged in REQUIREMENTS.md, not in v1)

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

### Active

<!-- v1 = hardening milestone. Verified gaps only. Full definitions in REQUIREMENTS.md. -->

*(none — every v1 hardening requirement has shipped; see Validated)*

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- The 12 planned items in `docs/ROADMAP.md` (PWA, touch interactions, wishlist, social, visual search, predictive analytics, multi-language, advanced security, email marketing, advanced analytics, image caching, reviews header) — backlogged in REQUIREMENTS.md by user decision; v1 is hardening only
- Unbuilt modules in `docs/admin-dashboard-specification.md` (MFA, WebSocket/SSE, custom report builder, fulfillment automation, GDPR/CCPA tools, VIP tiers, personalization admin) — that document is a historical design doc, not a backlog (W2 resolved); admin is treated as shipped
- The U13 shipment command and `SHIPMENT_NO_UNSETTLED_REFUNDS_SQL` end-to-end CAS test — future ADR-scoped work with its own migration; not a hardening gap
- Account deletion and personal-data export — explicitly deferred by `docs/customer-communications.md`; needs a separate design
- Switching the `pk_test_` Stripe/Clerk publishable keys in `wrangler.jsonc` to live keys — production is intentionally a demo environment with no live Stripe account (confirmed 2026-09-01)
- Splitting large service files (`checkout-pricing.ts`, `reviews.ts`, `products.ts`, `inventory.ts`, `agent-chat/route.ts`) — refactor with no user-observable outcome; revisit only when a feature touches them
- Deleting the 12 empty `app/api/*` directories — git does not track empty directories, so they exist only in the local working tree; one local `find app/api -type d -empty -delete` clears them
- Playwright mobile suite and Lighthouse CI workflow from `docs/mobile-testing-automation.md` — v1 records a one-time baseline (MOB-01); ongoing automation is backlog
- Differentiating the generic `"Checkout details are invalid or unavailable"` response — telemetry already records `payment.pricing_rejected` with an error class; user-facing detail would leak validation internals

## Context

**Brownfield.** The codebase was mapped on 2026-08-31 (`.planning/codebase/ARCHITECTURE.md`, `CONCERNS.md`, `CONVENTIONS.md`, `INTEGRATIONS.md`, `STACK.md`, `STRUCTURE.md`, `TESTING.md`) and 26 docs were ingested on 2026-09-01 (`.planning/intel/`, `.planning/INGEST-CONFLICTS.md`). This milestone exists because the docs and the code disagree in specific, verified places.

**Two generations of docs.** The 2025-dated docs (`CLAUDE.md`, `README.md`, `ROADMAP.md`, `architecture.md`, `ai-pipeline.md`, `api-architecture.md`, `DEPLOYMENT_SETUP.md`, `STRIPE_INTEGRATION.md`, `admin-*.md`, `mobile-*.md`) describe an earlier system. The 2026-dated operational docs (the four ADRs, `observability.md`, `runtime-configuration.md`, `content-publishing.md`, `customer-communications.md`, `dependency-security.md`, `shopify-migration.md`, `migration-reservations.md`, `o07-gift-cards-plan.md`) are newer and match the code. Where they disagree, the 2026 set wins.

**Verified facts that override the 2025 docs:**
- MCP `place_order` (`lib/mcp/tools/order.ts:148`) calls the same `finalizeOrderPayment` as `app/api/orders/route.ts:193` and `app/api/webhooks/stripe/route.ts:318`. ADR-CTB-15's "MCP remains outside the boundary" is superseded.
- Admin auth is enforced in production. The `x-dev-admin` header bypass (`lib/auth/admin-middleware.ts:22`) and the signed-in-user-is-admin shortcut (`lib/auth/unified-auth.ts:163`) both require `NODE_ENV === "development"`. There is no query-string bypass in code; `docs/admin-authentication.md:203` documents one anyway.
- The text model is `@cf/openai/gpt-oss-20b` (`lib/ai/config.ts:29`). Seven docs still say Llama 3.1 8B.
- `npm run deploy` never applies remote migrations (ADR-DBM-01). `npm run deploy:ci`, used by Cloudflare Workers Builds, runs `scripts/d1-migrate.mjs --target production --apply --confirm-production` before uploading. Both are true. Expand-only migrations (ADR-DBM-05) is a hard rule precisely because the schema lands before the new Worker.
- Migrations live in `migrations/`; the highest tracked file is `0022_add_gift_cards.sql`; the next free schema-bearing number is `0023`.

**Known issues carried into this milestone:**
- `docs/CLAUDE.md` (section "Admin Token Config", ~line 323) publishes a literal admin token value; `docs/admin-authentication.md:203` publishes the dev-bypass literal (I15).
- `app/api/analytics/vitals/route.ts` returns `{ status: "ok" }` and discards every beacon when `NODE_ENV === "production"`. The PRD's success metrics (touch response < 100 ms, Mobile PageSpeed > 85) are therefore unmeasured.
- `lib/services/checkout-pricing.ts:712` sets `taxSource = 'configured_fallback'` with no telemetry event; `lib/observability/telemetry.ts` has no tax event in its taxonomy.
- `app/product/[slug]/page.tsx:60` and `app/category/[slug]/page.tsx:52` take `{ params }: any` and read `params.slug` synchronously; the category route renders a 200 "not found" div instead of `notFound()`.
- `app/api/webhooks/stripe/route.ts:351` is an empty `handlePaymentFailed` with a TODO. `lib/hooks/useEnhancedUserContext.ts:140` has a `favoriteCategories` TODO (minor; not a requirement).
- `worker.ts` has no `NODE_ENV` assertion; the admin bypass guard is only as good as the baked-in build value.
- `wrangler.jsonc` carries two `pk_test_` publishable keys and `scripts/build-with-public-env.mjs` injects `NEXT_PUBLIC_*` from it. Production is a demo environment in Stripe test mode by design; the file stays tracked.
- `docs/dependency-security.md` next review date was 2026-08-25. Its two exceptions (Next-bundled PostCSS and Sharp) have exit condition "Next 16 upgrade"; the repo is on Next 16.3.1.
- `docs/README.md` links 1 of the 12 2026-era docs and says "MCP Server: Under development".

## Constraints

- **Tech stack**: Next.js 16.3.1 App Router on Cloudflare Workers via `@opennextjs/cloudflare` 1.20.2; D1 (`mercora-db`) with Drizzle 0.45.2; R2 (`voltique-images`, public CDN); Vectorize (`voltique-index`, 768-d cosine); Workers AI; Clerk 7.x; Stripe 22.x; TypeScript 6.0.3 — the deployed platform; not changing in this milestone
- **Runtime**: Node 24.18.1 (`>=24.18.1 <25`), use `mise exec --` for project commands — ADR-WRI-14 and `package.json` engines
- **Security**: Stripe, Clerk, Cloudflare, gift-card HMAC, and unsubscribe secrets live only in Worker secrets or `.dev.vars`; never in `wrangler.jsonc`, `lib/store-config.ts`, source, docs, or git history; `NEXT_PUBLIC_*` values are intentionally public — ADR-WRI-03, RC-03, RC-06
- **Telemetry**: `commerce.telemetry.v1` accepts only the closed event/severity taxonomy and low-cardinality fields; never headers, cookies, payment details, customer or order identifiers, addresses, raw exceptions, or query-bearing URLs; telemetry failure must never change commerce behavior — OBS-01, OBS-02; any new event (tax fallback, web vitals) must respect this
- **Data**: Migrations are additive expand/contract only, hand-authored in `migrations/`, numbered from `0023`; never down-migrate merchant, subscription, or gift-card state — ADR-DBM-05, ADR-SUB-01, CP-03
- **Money**: Integer minor units in D1 via the `Money` class; MACH decimal wire shape on HTTP/MCP; single currency per cart — MCP-05, CONVENTIONS.md
- **Verification gates**: `npm run lint`, `npm run typecheck`, `npm run cf-typecheck`, `npm test`, `npm run test:workers`, `npm run test:observability-worker`, `npm run check:migrations`, `npm audit --omit=dev`, `npm run build` all run in CI; the Workers suite is a required correctness gate — ADR-WRI-14, OBS-08, `.github/workflows/ci.yml`
- **Provider isolation**: No development or test path may call Stripe, send email, deploy, create Cloudflare resources, or use real credentials — REQ-gift-cards-invariants, OBS-07
- **Image pipeline**: The custom image loader must remain and image handling must not switch to Next's default optimizer while the Sharp audit exception is open — `docs/dependency-security.md`
- **Documentation as source**: `docs/` is the ingest source for planning; `gsd-ingest-manifest.yaml` types each doc; doc changes should keep the manifest accurate so re-ingest stays clean
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
| v1 is a hardening milestone; the 12 `docs/ROADMAP.md` items are backlog | User decision 2026-09-01; docs and code must agree before feature work resumes | — Pending |
| Publishable `pk_test_` keys stay in tracked `wrangler.jsonc` | Production is a demo with no live Stripe account; publishable keys are public by design; Workers Builds and deploy scripts read the file | ✓ Good |
| Deployment guard detects "deployed" via `navigator.userAgent === "Cloudflare-Workers"` and trips only when combined with `NODE_ENV === "development"`; fails closed per request (503), never at boot (Phase 1) | No new config; local `next dev` and vitest are unaffected; storefront keeps serving while admin locks. Live-bundle assumption accepted on static evidence 2026-09-02 (guard present in the OpenNext bundle, nothing shadows `navigator`, compat date guarantees the global) | ✓ Good — first-deploy confirmation step documented in `docs/admin-authentication.md` |
| The dev-bypass value stays a source literal in `lib/auth/admin-middleware.ts`; docs use prose placeholders, never the value (Phase 1) | Russell's choice 2026-09-01; the guard closes the deployed-development case, so the literal is harmless in production | ✓ Good |
| `ADMIN_VECTORIZE_TOKEN` rotated by the executor with a single `openssl rand -hex 32 \| wrangler secret put` pipeline; verified only with the old value (Phase 1) | Value never printed or stored; proof is two live 401s. Required pushing `main` first because Cloudflare refuses secret edits when the latest uploaded version is not deployed | ✓ Good |
| `workflow.use_worktrees=false` for this project | Fresh git worktrees have no `node_modules` or `.dev.vars`, so parallel executors would fail vitest and wrangler or spend minutes on `npm ci`; sequential execution on the main tree is the safer trade | ✓ Good |
| Client-side dev-mode admin shortcuts in `components/admin/AdminGuard.tsx` left unchanged (code-review WR-04) | Accepted by Russell 2026-09-02: no unintentional path puts a development build in production, the site is a demo, and server-side guards hold; residual is a visible nav link | ✓ Good — accepted risk AR-01-03 |

| Web-vitals sink is a Workers Analytics Engine dataset (`WEB_VITALS` → `mercora_web_vitals`), not D1 (Phase 2) | Purpose-built for metrics, no schema migration or retention job; five fields only, route template derived server-side | ✓ Good — post-deploy row check tracked in STATE.md |
| `handlePaymentFailed` is telemetry-only and the `payment_intent.payment_failed` subscription stays (Phase 2) | ADR-WRI forbids order-state changes outside the ledgers; the event is still useful ops signal | ✓ Good — runbook update is RUN-02 in Phase 3 |
| `allocateDiscount` caps every line at its own capacity and redistributes remainder cents ascending by index (Phase 2, code-review CR-01) | The old algorithm could give the last line more discount than its value, producing a negative net line and a crash in the fallback tax path | ✓ Good — invariants pinned by tests |
| Live sitemap advertises `mercora.example.com` because `NEXT_PUBLIC_SITE_URL` is only a runtime var, not a Workers Build var (Phase 2 finding) | `app/sitemap.ts` resolves the host at build time | — Pending Russell: add the Build variable and redeploy |
| ADR status markers are one `**Status:** Accepted (YYYY-MM-DD)` line under each H1, dated to each doc's first commit, not to the day they were labeled (Phase 3) | The classifier keys on the literal `Status: Accepted`; the first-commit date is when the decision actually took effect. The manifest `locked: true` keys are a human-readable record only; the classifier does not read them | ✓ Good — ingest re-run classified all four ADRs LOCKED |
| `payment_intent.payment_failed` stays subscribed and is listed under Required in both runbooks; `checkout.session.completed` removed from docs and from the route's dispatch switch (Phase 3) | Phase 2 made the failed-payment handler telemetry-only but kept the event; the checkout-session case was a comment-only no-op returning `ignored`, identical to `default`, so deleting it is behavior-neutral and makes "docs match the route" literally true | ✓ Good — 29 deletions, 0 insertions; regression test pins the fall-through |
| Remote migration commands in runbooks are the four `db:migrate:*` npm scripts only; local keeps `wrangler d1 migrations apply --local`; `npm run deploy` never applies remote migrations, `npm run deploy:ci` does (Phase 3) | The scripts wrap `scripts/d1-migrate.mjs`, which gates production on `--confirm-production` plus `MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1`; the docs must not offer an unguarded path | ✓ Good |
| Docs name the exact model id `@cf/openai/gpt-oss-20b` and cite `app/api/mcp/route.ts` for the 19-tool count; mermaid node ids renamed with the labels (Phase 4) | One source of truth each (`lib/ai/config.ts`, the route's "Available tools" string); a label-only rename leaves misleading ids in diagrams | ✓ Good — repo-wide `grep -ri llama docs/` is empty |
| Historical material is labelled with a `> **Status: Historical (September 2025).**` blockquote under the heading, not deleted or moved (Phase 4) | Same position as the ADR status markers; keeps the design history readable while stopping a reader from mistaking a proposal for the shipped system | ✓ Good |
| CI dependency audit gate raised from `critical` to `high`; both Next-bundled exceptions closed on observed evidence rather than deleted (Phase 4) | `npm audit --omit=dev` is clean under Next 16.3.1 (Sharp 0.35.3 hoisted, PostCSS patched), which is the exit condition the doc's own rule set; closed entries keep the history | ✓ Good — next review 2026-12-01 |
| Phase 4 planned with `--skip-ui`: the UI plan gate matched the word "dashboard" inside the filename `admin-dashboard-specification.md` (Phase 4) | Markdown edits and one CI line; no UI code. Recorded as a flagged assumption in plan 04-04 | ✓ Good |

---
*Last updated: 2026-09-03 after Phase 4 (milestone v1 complete)*
