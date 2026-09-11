---
phase: "13"
slug: "gift-card-flags"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-10"
---

# Phase 13 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audit run by gsd-security-auditor (read-only verdict) against HEAD `774d6ea` (all seven review-fix commits); this file persisted by the orchestrator, who also closed T-13-42 the same day.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| deploy-time env → capability resolution | `STORE_FEATURE_GIFT_CARD_ACQUISITION` (sell) / `_RECONCILIATION` (honor) read in `lib/commerce/runtime.ts`; the money decision owned by `resolveHonorEffective` (D-18) | Two booleans; one keyed `admin_settings` row (`gift_cards.honor_guard`) |
| cron tick → D1 → `admin_settings` | `runGiftCardHonorGuard` measures outstanding balances and held reservations, writes the guard record, pages on `gift_card.honor_disabled_with_balances` | Aggregate minor units, held minor units, open-reservation count, currency, timestamp |
| anonymous / customer browser → public surfaces | Listings, `/product/gift-card`, `/checkout`, `/api/gift-cards/balance`, `/api/products`, agent chat, MCP catalogue and checkout | Product visibility, one generic `{ valid: false }`, `gift_card_sales_disabled` |
| admin browser → `/admin/gift-cards`, `/api/admin/gift-cards`, `/api/admin/settings` | Clerk session (server-gated in the layout since T-13-42) or service token | Guard record (aggregate only), masked queue rows; the settings route refuses the guard key and category |
| Workers Builds → production Worker | Push to `main` only; flags unchanged in `wrangler.jsonc` | Public vars |

---

## Threat Register

Declared threats come from the `<threat_model>` blocks in 13-01..13-09 PLAN.md. T-13-42 was registered from the audit's unregistered flag UF-1.

| Threat ID | Category | Component | Severity | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|----------|-------------|-----------------------|--------|
| T-13-01 | Denial of Service | tender under sell-off/honor-on | high | mitigate | `lib/commerce/capabilities.ts:181-192` installs the real tender factory on `acquisition \|\| reconciliation`; `capabilities.test.ts:161` | closed |
| T-13-02 | Elevation of Privilege | sell-on/honor-off startup | high | mitigate | Throw intact at `capabilities.ts:158-162`; `capabilities.test.ts:102,212`; docs pin `gift-card-flag-docs.test.ts:81` | closed |
| T-13-03 | Tampering | renamed / impostor gift card | medium | mitigate | `lib/gift-cards/visibility.ts:64` keys on `type`, no slug; decoys in `visibility.test.ts:81-85` | closed |
| T-13-04 | Information Disclosure | filter leaking into model layer | medium | mitigate | `lib/models/mach/products.ts` imports none of the predicate exports; `listing-call-sites-source.test.ts:59-71` | closed |
| T-13-05 | Information Disclosure | `/api/products` admin vs public | medium | mitigate | `app/api/products/route.ts:55-56,84-87` `isAdmin ? products : filterListedProducts(...)`; `products-public.test.ts:187` | closed |
| T-13-06 | Denial of Service | admin listing loses the product | high | mitigate | Same as T-13-04 | closed |
| T-13-07 | Tampering | a listing surface skips the predicate | medium | mitigate | Eleven call sites pinned in `listing-call-sites-source.test.ts:21-43` (incl. agent-chat and sitemap added after planning) | closed |
| T-13-08 | Information Disclosure | stale agent reference to the product | low | accept | AR-13-01 | closed |
| T-13-09 | Elevation of Privilege | client add-to-cart with sell off | high | mitigate | `ProductDisplay.tsx:371-386` unavailable branch precedes `available`; server rejects at `checkout-pricing.ts:583` | closed |
| T-13-10 | Information Disclosure | both-off product page distinguishable from unknown | low | mitigate | `app/product/[slug]/page.tsx:70` `notFound()`, same path as `:66`; `product-slug-page.test.ts:143` | closed |
| T-13-11 | Tampering | product page keyed on slug | medium | mitigate | `page.tsx:69` `storedProduct.type === GIFT_CARD_PRODUCT_TYPE`; grep pin added at audit (`product-slug-page.test.ts`, T-13-11 block) | closed |
| T-13-12 | Elevation of Privilege | gift-card line priced with sell off | high | mitigate | `checkout-pricing.ts:551,583-584` throws before tender; `payment-intent/route.ts:174-178`; MCP `mcp-gift-card-sales-disabled.test.ts` | closed |
| T-13-13 | Spoofing | request body overriding the sell flag | medium | mitigate | `checkout-pricing.ts:108,542` defaults merged from server config; body never reaches `giftCardSalesEnabled` | closed |
| T-13-14 | Information Disclosure | `gift_card_sales_disabled` reveals flag | low | accept | AR-13-02 | closed |
| T-13-15 | Denial of Service | checkout panel gated on the wrong flag | medium | mitigate | `CheckoutClient.tsx:520-521` on `honorEffective`; `gift-card-checkout-gating-source.test.ts:41-49` | closed |
| T-13-16 | Tampering | ADR-CTB-10 backend semantics changed | high | accept | AR-13-03 | closed |
| T-13-17 | Tampering | guard record written outside the cron | high | mitigate | Writer `honor-guard.ts:180-200`, sole caller `:354-376`, sole entry `scheduled.ts:40`; `honor-guard-writer-source.test.ts`, `admin-settings-writer-source.test.ts:91-106`; settings route refusal `:36-41,140-149` | closed |
| T-13-18 | Denial of Service | malformed / stale record turns honoring off | high | mitigate | `honor-guard.ts:118-146` malformed → null; `:243-262` null/NaN/stale/negative → true; `:272-283` read error → true; `honor-guard.test.ts:32-107` | closed |
| T-13-19 | Denial of Service | per-request balance scan | medium | mitigate | Aggregate SQL lives in `repository.ts:271-350`; request path reads one keyed row `honor-guard.ts:159-165`; grep pin added at audit (`honor-guard-writer-source.test.ts`, T-13-19 block) | closed |
| T-13-20 | Repudiation | alarm not critical / not paged | high | mitigate | `telemetry.ts:68` critical, sampleRate 1; tail `core.ts:32`; parity `observability-tail-core.test.ts:63-66`; `honor-guard-cron.test.ts:112-131` | closed |
| T-13-21 | Information Disclosure | guard record content | low | accept | AR-13-04 | closed |
| T-13-22 | Repudiation | docs contradict code | high | mitigate | `gift-card-flag-docs.test.ts:58-66,81-89,102-136` (four-state table, real throw, constants imported) | closed |
| T-13-23 | Denial of Service | operator flips honor off with money out | high | mitigate | `docs/DEPLOYMENT_SETUP.md:589-605` names the liability, alarm, banner, rollback recipe | closed |
| T-13-24 | Information Disclosure | secret-shaped text in docs | medium | mitigate | No secret-shaped string in the doc diff; `docs:lint` credential check green | closed |
| T-13-25 | Tampering | locked ADR edited | medium | mitigate | `docs/checkout-trust-boundary.md` diff empty; `scripts/docs-lint.mjs:26-28` `LOCKED_ADRS` | closed |
| T-13-26 | Elevation of Privilege | guard overrides the sell-on/honor-off throw | critical | mitigate | `honor-guard.ts:329-330` returns `false` before D1; `runtime.ts:44-56`; integration `honor-guard.test.ts:547-570` with a throwing DB | closed |
| T-13-27 | Tampering | forged fresh-zero record | high | mitigate | Plan rationale corrected: a forged zero *narrows* honoring (CR-02). Protection is the write contract plus the route refusal (T-13-17) | closed |
| T-13-28 | Denial of Service | cron failure strands honoring | critical | mitigate | Fail direction as T-13-18; pages every tick `honor-guard.ts:370-374`; `worker-cron-routing.test.ts:136-150` | closed |
| T-13-29 | Denial of Service | guard failure blocks the delivery drain | high | mitigate | `scheduled.ts:37,49-56` `.catch` precedes `.then`; `worker-cron-routing.test.ts:168-181` | closed |
| T-13-30 | Information Disclosure | telemetry payload | low | mitigate | `honor-guard.ts:217-222` emits `effect_type`, `trigger`, `outcome`, `count` only | closed |
| T-13-31 | Information Disclosure | admin API before auth | medium | mitigate | `app/api/admin/gift-cards/route.ts:21-24` 401 before flags; `gift-card-presentation-routes.test.ts:55-58,97-101` | closed |
| T-13-32 | Information Disclosure | balance route oracle | medium | mitigate | Fixed 404 body both-off; every other branch `{ valid: false }`; rate-limited `:18-19`; `gift-card-presentation-routes.test.ts:158-168` | closed |
| T-13-33 | Tampering | settings route writes the guard key | high | mitigate | `admin-settings-honor-guard.test.ts:54-90` (key, category, smuggled batch all 400 before `getDbAsync`) | closed |
| T-13-34 | Information Disclosure | banner leaks card material | high | mitigate | `GiftCardHonorBanner.tsx:72-89,117-141` total/held/count/time only; `admin-gift-card-gating.test.ts:229` | closed |
| T-13-35 | Denial of Service | admin page 404s while money is out | high | mitigate | `app/admin/gift-cards/page.tsx:61-64` 404 only when hidden and the owner says no; `admin-gift-card-gating.test.ts:84-90` | closed |
| T-13-36 | Elevation of Privilege | guard widens a hidden surface | medium | mitigate | Sidebar on configured flags only (`AdminSidebar.tsx:141-146`); balance route applies the D-10 gate before the owner (`:35`, `:48`) | closed |
| T-13-37 | Elevation of Privilege | manual deploy | high | mitigate | Push-to-main only; `13-09-SUMMARY.md:104` | closed |
| T-13-38 | Tampering | production writes during proof | high | mitigate | `13-09-PLAN.md:194-231` only `SELECT` / GET; `13-09-SUMMARY.md:105-107,148` | closed |
| T-13-39 | Denial of Service | product missing after deploy | high | mitigate | `13-09-SUMMARY.md:62,105` `prod_33` present in the live listing | closed |
| T-13-40 | Tampering | `wrangler.jsonc` flags changed | high | mitigate | File absent from the phase diff; both flags `"true"` at `:131-132` | closed |
| T-13-41 | Repudiation | alarm quiet unproven | medium | mitigate | `13-09-SUMMARY.md:41,76-82` live tail plus a fresh zero record; alarm fires only on the measured condition | closed |
| T-13-42 | Information Disclosure | `/admin/*` pages server-render data behind a client-only guard (audit UF-1) | medium | mitigate | **Amended 2026-09-10 (Phase 14 audit UF-14-1):** the `app/admin/layout.tsx` gate added here only decides whether to *mount* a page; the App Router streams the page segment in the RSC payload regardless, so on its own it did not stop an anonymous read. The real closure is Phase 14's T-14-63: `middleware.ts` redirects anonymous `/admin` page requests to sign-in before any segment renders, and every async `app/admin/**/page.tsx` calls `requireAdminSession()` (`lib/auth/admin-session.ts`) first and 404s for a non-admin session. `tests/unit/app/admin-pages-server-gate-source.test.ts`, `admin-guard-middleware.test.ts` | closed (via T-14-63) |

Informational (no action): UF-2 agent-chat and sitemap listing surfaces map to T-13-07; UF-3 `CheckoutPageClient` carries `honorEffective` as advice only, the server enforces; N-4 the cron path honors without the `!sell` short-circuit, which only settles money already taken (D-04) while new sales still throw.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-13-01 | T-13-08 | An agent holding a stale gift-card reference cannot buy: the product page and `priceCheckout` reject independently. | Claude (autonomous run, Russell's standing instruction) | 2026-09-10 |
| AR-13-02 | T-13-14 | `gift_card_sales_disabled` reveals only a public flag state the product page already shows. | Claude (autonomous run) | 2026-09-10 |
| AR-13-03 | T-13-16 | Reservation, settlement, release and restore untouched (repository diff additive only); ADR-CTB-10 locked and unchanged; 53 D1 integration tests pass. | Claude (autonomous run) | 2026-09-10 |
| AR-13-04 | T-13-21 | The guard record is an aggregate total, held total, count and timestamp; no card identity, code or recipient. Both API routes are admin-gated; the page render is gated by middleware sign-in plus `requireAdminSession()` since Phase 14's T-14-63 (the T-13-42 layout gate alone was not sufficient). | Claude (autonomous run) | 2026-09-10 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-10 | 41 | 41 | 0 (UF-1 flagged, non-blocking) | gsd-security-auditor (L1; money paths traced at L2; 448 unit + 53 integration tests run) |
| 2026-09-10 | 42 | 42 | 0 | Orchestrator registered and closed T-13-42; added the T-13-11 and T-13-19 grep pins |
| 2026-09-10 | 42 | 42 | 0 | Phase 14 audit (UF-14-1) showed the T-13-42 layout gate insufficient; re-closed via T-14-63 (middleware + per-page `requireAdminSession`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** Claude, autonomous run 2026-09-10 (Russell to confirm AR-13-01..04 at the milestone review)
