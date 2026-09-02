# Requirements: Mercora

**Defined:** 2026-09-01
**Core Value:** A customer or an external AI agent can find the right outdoor gear through Volt, pay for it exactly once, and have inventory, order state, and refunds end up correct, whether they arrive via the storefront or the MCP server.

**Milestone scope:** v1 is a hardening milestone. It covers only verified gaps between the docs and the code: an exposed credential, stale documentation, un-locked binding decisions, and silent failure modes with no telemetry or tests. Feature work from `docs/ROADMAP.md` is backlogged below.

## v1 Requirements

Each maps to exactly one roadmap phase.

### Security (SEC)

- [x] **SEC-01**: No literal credential value remains in `docs/`. The admin token published in `docs/CLAUDE.md` ("Admin Token Config", ~line 323) and the dev-bypass literal in `docs/admin-authentication.md` (~line 203) are replaced with `<placeholder>` text, and a repository-wide search for the previous values returns nothing.
- [x] **SEC-02**: The production `ADMIN_VECTORIZE_TOKEN` is rotated if the value published in `docs/CLAUDE.md` is, or ever was, the live secret. After rotation, presenting the previously published value to `/api/admin/vectorize` and `/api/admin/knowledge` is rejected (401/403). If the published value was never live, that finding is recorded and no rotation is needed.
- [x] **SEC-03**: A deployed Worker fails loudly at startup, or every admin request fails closed, when `process.env.NODE_ENV` resolves to `"development"`, so the dev-only bypasses in `lib/auth/admin-middleware.ts:22` and `lib/auth/unified-auth.ts:163` can never open in a production deployment. A unit test proves the assertion fires under `development` and is silent under `production`.
- [x] **SEC-04**: `docs/CLAUDE.md` (line ~160) and `docs/DEPLOYMENT_SETUP.md` (line ~285) no longer say admin authentication is disabled. `docs/admin-authentication.md` describes the real mechanism: production requires Clerk `metadata.role === "admin"` or an active row in the `adminUsers` D1 table (`isUserAdmin()` in `lib/models/admin.ts`), server-to-server calls use `Authorization: Bearer $ADMIN_VECTORIZE_TOKEN`, and the only bypass is the `x-dev-admin` header under `NODE_ENV === "development"`. No query-string bypass is documented, and no `ADMIN_USER_IDS` variable is mentioned (it does not exist in code; corrected 2026-09-01 after Phase 1 research).

### Observability and Regression Guards (OBS)

- [x] **OBS-01**: When `lib/services/checkout-pricing.ts` falls back to the configured flat tax rate (`taxSource = 'configured_fallback'`, line ~712), a telemetry event in the closed `commerce.telemetry.v1` taxonomy is recorded with low-cardinality fields only (no address, no order or customer identifier). A unit test proves the event fires on fallback and not on provider success, and the AST taxonomy contract accepts the new event.
- [x] **OBS-02**: Web-vitals beacons posted to `/api/analytics/vitals` in production are written to a queryable sink (a Workers Analytics Engine dataset or a bounded D1 table) carrying only metric name, value, rating, route template, and `isMobile`. An operator can query mobile LCP, INP, and CLS from real traffic. The route no longer returns `{ status: "ok" }` while discarding the payload.
- [ ] **OBS-03**: `app/product/[slug]/page.tsx` and `app/category/[slug]/page.tsx` type `params` as `Promise<{ slug: string }>` and `await` it (no `: any`). An unknown category slug returns HTTP 404 via `notFound()` instead of a 200 "Category not found" div. Tests cover the unknown-slug path for both routes.
- [ ] **OBS-04**: Discount allocation (`allocateDiscount`) and tax allocation (`allocateLargestRemainder`) in `lib/services/checkout-pricing.ts` have tests asserting that allocated parts sum exactly to the total across 1, 2, 10, and 100 lines, including penny-rounding edge cases. (One largest-remainder sum test exists at `tests/unit/lib/services/checkout-pricing.test.ts:525`; this requirement is about breadth.)
- [ ] **OBS-05**: The empty `handlePaymentFailed` handler in `app/api/webhooks/stripe/route.ts` (TODO at line ~351) is resolved. Either `payment_intent.payment_failed` is handled with a recorded telemetry/audit outcome that does not violate ADR-WRI rules (no order-state change outside the ledgers), or the handler and its event subscription are removed and the removal is noted for RUN-02. No `TODO` remains in the webhook route.

### Mobile Measurement (MOB)

- [x] **MOB-01**: A Lighthouse mobile baseline (performance score, LCP, CLS, TBT) is recorded for the home, a category, a product, and the checkout route on the live storefront, compared against the PRD target (performance >= 85, target 90+), and stored in `docs/` so the unchecked measurement items in `docs/mobile-improvements-actionable.md` are closed.

### Decision Lock-In (ADR)

- [ ] **ADR-01**: `docs/checkout-trust-boundary.md` no longer states that MCP checkout is outside the paid inventory boundary (lines ~101–103). It states that MCP `create_payment_intent` and `place_order` use the shared checkout pricing service and the same idempotent finalizer (`lib/services/order-finalization.ts`) as the storefront and webhook paths, and that MCP is inside the boundary.
- [ ] **ADR-02**: The four ADR docs (`checkout-trust-boundary.md`, `database-migrations.md`, `subscriptions.md`, `webhooks-refunds-inventory.md`) each carry an explicit `Status: Accepted` marker with a date, and `gsd-ingest-manifest.yaml` marks all four `locked: true`. Re-running `/gsd-ingest-docs` classifies all four as locked and produces neither the I17 lock-status note nor the W1 warning.

### Operator Runbooks (RUN)

- [ ] **RUN-01**: `docs/CLAUDE.md` (lines ~237–238, ~467) and `docs/DEPLOYMENT_SETUP.md` (lines ~29, ~248–251) show only the guarded migration commands (`db:migrate:status:*`, `db:migrate:apply:*`, production gated by `MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1`), state that `npm run deploy` never applies remote migrations while `npm run deploy:ci` (Workers Builds) applies production migrations before upload, and require Node 24 (not 18). No unguarded `wrangler d1 migrations apply mercora-db` for production remains.
- [ ] **RUN-02**: The Stripe webhook event lists in `docs/DEPLOYMENT_SETUP.md` (~lines 203–210) and `docs/STRIPE_INTEGRATION.md` (~lines 60–67) match ADR-WRI-02's required set (`payment_intent.succeeded`, `charge.refunded`, `refund.updated`, `refund.failed`, legacy `charge.refund.updated`) plus the subscription events ADR-SUB actually handles. Events with no handler after OBS-05 (`checkout.session.completed`, and `payment_intent.payment_failed` if removed) are gone.

### Reference Documentation (REF)

- [ ] **REF-01**: Every doc names the production text model as `@cf/openai/gpt-oss-20b` (source: `lib/ai/config.ts:29`). `grep -r "Llama 3.1" docs/` returns nothing across `CLAUDE.md`, `README.md`, `ROADMAP.md`, `architecture.md`, `ai-pipeline.md`, `api-architecture.md`, `DEPLOYMENT_SETUP.md`. The MCP tool count reads 19 in `docs/CLAUDE.md:536` and `docs/ROADMAP.md:107`.
- [ ] **REF-02**: `docs/CLAUDE.md` describes the real test and CI setup (vitest unit, Workers, and observability suites; CI gates: audit, migration safety, lint, typecheck, cf-typecheck, build) instead of "No formal testing framework" (line ~408), points to `package.json` instead of pinning dependency versions, and drops the reference to the nonexistent `docs/API_STRUCTURE.md` (also in `docs/STRIPE_INTEGRATION.md:99`). `docs/api-architecture.md:435` no longer says "Stripe integration (mock implementation)".
- [ ] **REF-03**: `docs/README.md` links all 26 docs in `docs/` (11 of the 12 2026-era docs are currently missing), says the MCP server is live at `/api/mcp` (line ~37), and carries a 2026 "Last Updated" date (line ~79).
- [ ] **REF-04**: Historical and proposal documents are labeled at the top: `docs/admin-dashboard-specification.md` (historical design; unbuilt modules are not planned), the ER diagram in `docs/architecture.md` (~lines 240–320; predates the variant/ledger model), `docs/mobile-ux-assessment.md` (September 2025 snapshot), and `docs/mobile-testing-automation.md` (proposal; Lighthouse CI and Playwright suites are not implemented). The implementation checklist in `docs/mobile-improvements-actionable.md` (~lines 422–444) shows the code items as complete.

### Dependency Hygiene (DEP)

- [ ] **DEP-01**: `docs/dependency-security.md` is refreshed under Node 24: `npm audit --omit=dev` is re-run, the two Next-bundled exceptions (PostCSS, Sharp) are closed now that Next 16.3.1 has landed or re-recorded with a new owner and review date if still present, CI's gate is raised to `--audit-level=high` per the document's own rule (or the blocking finding is recorded as a bounded exception), and the next-review date (currently 2026-08-25, passed) is in the future.

## Already Shipped (validated, no phase)

Carried from the ingested PRDs. Every item below is implemented per its own status markers and verified against the code on 2026-09-01. They are recorded here so nobody re-plans them.

### Mobile UX sprint (`docs/mobile-improvements-actionable.md`)

- [x] **REQ-mobile-touch-targets** — `components/ui/button.tsx:74-78`: default `h-11`, sm `h-10`, lg `h-12`, icon `size-11`
- [x] **REQ-mobile-cart-quantity-controls** — `components/cart/CartItemCard.tsx:39,50`: `h-10 w-10 p-0 touch-manipulation`
- [x] **REQ-mobile-menu-animation** — `components/HeaderClient.tsx:429`: `duration-300!`, closed `duration-200!`
- [x] **REQ-mobile-category-indentation** — `components/HeaderClient.tsx:192-197`: `getIndentationClass` with orange left borders
- [x] **REQ-mobile-product-card-spacing** — `components/ProductCard.tsx:125-146`: `touch-manipulation`, responsive `sizes`, blur placeholder, `space-y-3`, `line-clamp-2`
- [x] **REQ-web-vitals-tracking-hook** — `lib/hooks/useWebVitals.ts`, mounted via `components/analytics/WebVitals.tsx` in `app/layout.tsx:176`
- [x] **REQ-web-vitals-api-route** — `app/api/analytics/vitals/route.ts` exists as specified (dev logging only; production sink is OBS-02)
- [x] **REQ-mobile-form-inputs** — `components/checkout/ShippingForm.tsx:57-116`: `autoComplete`, `inputMode`, `pattern`
- [x] **REQ-mobile-css** — `app/globals.css:132-165`: `.touch-manipulation`, `.mobile-scroll`, coarse-pointer focus outline, 16px inputs

### Gift cards (`docs/o07-gift-cards-plan.md`, PR #79 merged)

- [x] **REQ-gift-cards-invariants** — bearer codes never persisted; HMAC digests; AES-GCM retry material; server-authoritative amounts
- [x] **REQ-gift-cards-mixed-cart-pricing** — wave 1
- [x] **REQ-gift-cards-tender-lifecycle** — wave 2 (web and MCP share the authoritative checkout path)
- [x] **REQ-gift-cards-issuance-delivery** — wave 3
- [x] **REQ-gift-cards-refund-convergence** — wave 4
- [x] **REQ-gift-cards-presentation-surfaces** — wave 5 (`/admin/gift-cards`, customer APIs)
- [x] **REQ-gift-cards-runtime-composition** — wave 6 (migration `0022`, scheduler)
- [x] **REQ-gift-cards-stack-handoff** — wave 7 (merged to `main` as PR #79)

### Reviews (`docs/ROADMAP.md`)

- [x] **REQ-reviews-ratings** — every sub-item is marked complete in the source and `/admin/reviews` is live; the parent bullet's "planned" marker is stale (fix in REF-04 is optional)

## v2 Requirements (Backlog)

Deferred by user decision on 2026-09-01. Tracked, not in the current roadmap. None has acceptance criteria in its source; each needs `/gsd-review-backlog` or `/gsd-discuss-phase` before promotion.

### From `docs/ROADMAP.md` (2025 planned items)

- **REQ-pwa-features**: Offline browsing, push notifications, app-like install experience
- **REQ-touch-interactions**: Gesture and spacing refinements beyond the shipped mobile sprint
- **REQ-wishlist**: Save products for later with sharing
- **REQ-social-features**: Product sharing and user-generated content integration
- **REQ-visual-search**: Image-based product discovery
- **REQ-predictive-analytics**: Inventory management and demand forecasting
- **REQ-multi-language**: Multi-language support and international markets (note: `STORE_LOCALE`/`STORE_CURRENCY` plumbing exists per RC-02/RC-04; checkout is single-currency per cart)
- **REQ-advanced-security**: Fraud detection and security monitoring (note: `AI_RATE_LIMITER` and `PUBLIC_RATE_LIMITER` bindings already exist; the rate-limiting portion is partly done)
- **REQ-email-marketing**: Newsletter system and customer communication enhancements (note: `docs/ROADMAP.md` explicitly dropped notification preferences as "not needed for transactional-only emails")
- **REQ-advanced-analytics**: Enhanced business intelligence and customer insights
- **REQ-performance-image-caching**: Image strategy and caching (Core Web Vitals instrumentation is shipped; OBS-02 makes it measurable)

### Deferred by existing docs

- **REQ-u13-shipment-command**: Atomic shipment transition with `SHIPMENT_NO_UNSETTLED_REFUNDS_SQL` inside the `UPDATE`, already-shipped idempotency handled first, and an end-to-end real-D1 CAS test (ADR-CTB-14, ADR-WRI-11)
- **REQ-account-deletion-data-export**: Customer account deletion and personal-data export (deferred by `docs/customer-communications.md`; separate design required)
- **REQ-mcp-credential-contract-migration**: Remove the legacy plaintext credential column once no version-1 credential remains (MCP-02, MCP-09)
- **REQ-mobile-test-automation**: Lighthouse CI workflow and Playwright mobile specs from `docs/mobile-testing-automation.md`

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Unbuilt modules in `docs/admin-dashboard-specification.md` (MFA, WebSocket/SSE, report builder, fulfillment automation, GDPR/CCPA tools, VIP tiers, personalization admin) | Historical design document, not a backlog (W2 resolved). Admin is shipped as the 12 live routes. |
| Switching `pk_test_` publishable keys in `wrangler.jsonc` to live keys | Business decision about whether Voltique runs in Stripe test mode; needs Russell's answer, not a plan. Flagged in STATE.md. |
| Splitting large service files (`checkout-pricing.ts`, `reviews.ts`, `products.ts`, `inventory.ts`, `agent-chat/route.ts`) | Refactor with no user-observable outcome. Revisit when a feature touches them. |
| Deleting the 12 empty `app/api/*` directories | Git does not track empty directories; they exist only locally. `find app/api -type d -empty -delete` clears them. |
| Differentiating the generic `"Checkout details are invalid or unavailable"` response | Telemetry already records `payment.pricing_rejected` with an error class; user-facing detail would leak validation internals. |
| `favoriteCategories` TODO in `lib/hooks/useEnhancedUserContext.ts:140` | Cosmetic dead field in a client hook; no commerce or observability impact. |
| Re-planning any Validated item above | Already shipped and verified in code. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| SEC-04 | Phase 1 | Complete |
| OBS-01 | Phase 2 | Complete |
| OBS-02 | Phase 2 | Complete |
| OBS-03 | Phase 2 | Pending |
| OBS-04 | Phase 2 | Pending |
| OBS-05 | Phase 2 | Pending |
| MOB-01 | Phase 2 | Complete |
| ADR-01 | Phase 3 | Pending |
| ADR-02 | Phase 3 | Pending |
| RUN-01 | Phase 3 | Pending |
| RUN-02 | Phase 3 | Pending |
| REF-01 | Phase 4 | Pending |
| REF-02 | Phase 4 | Pending |
| REF-03 | Phase 4 | Pending |
| REF-04 | Phase 4 | Pending |
| DEP-01 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓
- Validated (already shipped, no phase): 18
- Backlog (v2+): 15

---
*Requirements defined: 2026-09-01*
*Last updated: 2026-09-01 after initial definition from doc ingest and codebase map*
