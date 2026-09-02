# Requirements (extracted from PRD-typed sources)

Source set: 3 PRD-classified docs. None of them contain user stories or
per-item acceptance criteria in the usual sense. Where a source gives a
measurable target or a test-matrix row, it is recorded as `acceptance`. Where
it gives nothing, `acceptance` is marked absent. Status markers in the source
(completed / implemented / planned) are carried into `description` so the
roadmapper does not re-plan finished work.

No competing acceptance variants were found across PRDs (see INGEST-CONFLICTS.md).

---

# docs/mobile-improvements-actionable.md

Doc-level success metrics that apply to every REQ-mobile-* entry below (the
source does not attach them per item): touch response < 100ms average; Mobile
PageSpeed > 85 (target 90+); 5 users complete mobile checkout in a task test;
mobile cart-to-checkout rate tracked. Stated expected impact: 10-20%
improvement in mobile conversion. Source priority order: 1 touch targets,
2 performance tracking, 3 mobile navigation, 4 form optimization.

## REQ-mobile-touch-targets
- source: /Users/rmoore/Workspaces/mercora/docs/mobile-improvements-actionable.md
- description: Raise `buttonVariants` sizes in `components/ui/button.tsx`: default `h-11` (44px, from h-9), sm `h-10` (40px, from h-8), lg `h-12` (48px, from h-10), icon `size-11` (44px, from size-9). Source status: unchecked in implementation checklist.
- acceptance: doc-level (touch response < 100ms average); no per-item criterion in source
- scope: Button component touch targets

## REQ-mobile-cart-quantity-controls
- source: /Users/rmoore/Workspaces/mercora/docs/mobile-improvements-actionable.md
- description: In `components/cart/CartItemCard.tsx`, give the minus/plus quantity buttons explicit `h-10 w-10 p-0 touch-manipulation` sizing and a `min-w-[3rem]` centered quantity label. Source status: unchecked.
- acceptance: doc-level; no per-item criterion in source
- scope: CartItemCard quantity controls

## REQ-mobile-menu-animation
- source: /Users/rmoore/Workspaces/mercora/docs/mobile-improvements-actionable.md
- description: In `components/HeaderClient.tsx`, change the mobile `SheetContent` animation from 600ms to 300ms open / 200ms close (`duration-300!`, `data-[state=closed]:duration-200!`, `data-[state=open]:duration-300!`). Source status: unchecked.
- acceptance: doc-level; no per-item criterion in source
- scope: HeaderClient mobile menu

## REQ-mobile-category-indentation
- source: /Users/rmoore/Workspaces/mercora/docs/mobile-improvements-actionable.md
- description: Update `getIndentationClass` in `HeaderClient.tsx` so nested category levels use reduced margins with a colored left border (`ml-4 border-l-2 border-orange-500/20 pl-3` at level 1, `ml-8 .../10` at level 2, `ml-10 .../5` at level 3, fallback `ml-12 border-l border-neutral-700 pl-4`). Source status: unchecked.
- acceptance: doc-level; no per-item criterion in source
- scope: category navigation indentation

## REQ-mobile-product-card-spacing
- source: /Users/rmoore/Workspaces/mercora/docs/mobile-improvements-actionable.md
- description: In `components/ProductCard.tsx`, add `touch-manipulation` to the card, `space-y-3` to the content block, `line-clamp-2 leading-snug` on the title, reduce description clamp from 3 to 2 lines, and use responsive `sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"` with blur placeholder on the image. Source status: unchecked.
- acceptance: doc-level; no per-item criterion in source
- scope: ProductCard mobile spacing

## REQ-web-vitals-tracking-hook
- source: /Users/rmoore/Workspaces/mercora/docs/mobile-improvements-actionable.md
- description: `lib/hooks/useWebVitals.ts` reports CLS/FCP/INP/LCP/TTFB plus a custom `touch-latency` metric (only when latency > 100ms; rating poor > 300ms, needs-improvement > 150ms) to `/api/analytics/vitals` via `sendBeacon` (fetch keepalive fallback), enriched with pathname, timestamp, isMobile, userAgent. Tracks only in production or when `NEXT_PUBLIC_ENABLE_WEB_VITALS_DEV=true`. Mounted from `app/layout.tsx` via a `WebVitalsTracker` component. Source status: marked COMPLETED.
- acceptance: absent in source (item is marked completed)
- scope: useWebVitals hook, app/layout.tsx

## REQ-web-vitals-api-route
- source: /Users/rmoore/Workspaces/mercora/docs/mobile-improvements-actionable.md
- description: `app/api/analytics/vitals/route.ts` POST handler parses the metric JSON, logs name/value/rating/url/isMobile to console in development, returns `{ status: 'ok' }`, and returns 500 `{ error: 'Failed to track metric' }` on parse failure. Production forwarding to an analytics service is left as a comment. Source checklist status: unchecked (but the hook that posts to it is marked completed).
- acceptance: absent in source
- scope: /api/analytics/vitals route

## REQ-mobile-form-inputs
- source: /Users/rmoore/Workspaces/mercora/docs/mobile-improvements-actionable.md
- description: In `components/checkout/ShippingForm.tsx`, add mobile keyboard attributes: `autoComplete="name"` on recipient; `type="email" autoComplete="email" inputMode="email"` on email; `autoComplete="postal-code" inputMode="numeric" pattern="[0-9]*"` on postal code; all with `touch-manipulation`. Source status: unchecked.
- acceptance: doc-level; no per-item criterion in source
- scope: ShippingForm mobile inputs, mobile checkout flow

## REQ-mobile-css
- source: /Users/rmoore/Workspaces/mercora/docs/mobile-improvements-actionable.md
- description: Add global mobile CSS: `.touch-manipulation { touch-action: manipulation }`; orange 2px `focus-visible` outline under `@media (hover: none) and (pointer: coarse)`; `.mobile-scroll` with `-webkit-overflow-scrolling: touch`; 16px font-size on text/email/tel inputs, textarea, select (prevents iOS zoom); `.mobile-button-spacing button { margin: 8px 0; min-height: 44px }` under 768px. Source status: unchecked.
- acceptance: doc-level; no per-item criterion in source
- scope: mobile CSS

---

# docs/o07-gift-cards-plan.md

Source is a completion plan with a dated status audit (2026-08-21). All seven
waves are reported Implemented; wave 7 external handoff (push + draft PR) was
pending at the time of writing. Source states the branch is stacked on
`agent/o06-subscriptions` and depends on migration `0022`. Behavioral
provenance is described as an external frozen source tree and commit list;
that is recorded in context.md, not here.

## REQ-gift-cards-invariants
- source: /Users/rmoore/Workspaces/mercora/docs/o07-gift-cards-plan.md
- description: Security and commerce invariants for stored-value gift cards: raw bearer codes never enter D1, logs, telemetry, order metadata, API/MCP projections, or UI state beyond the immediate redemption/delivery boundary; code storage is a keyed HMAC digest and retry material is AES-GCM encrypted, revealed only transiently for a claimed delivery attempt; reconciliation runs when acquisition is disabled; reservations use a stable request identity with explicit release or expiry; gift tender cannot purchase gift-card value; a full gift tender finalizes through a real zero-cash path, never a fabricated zero-dollar Stripe intent; digital-only orders have no shipping, mixed orders keep physical shipping; gift-card products are never inventory-adjusted; all final amounts, tender allocation, inventory actions, and issuance eligibility are server-authoritative and snapshot-based; issuance, delivery, settlement, releases, and refund restoration are idempotent; refund completion requires both cash and gift legs to converge; no development or tests invoke payment/email providers, send email, use credentials, deploy, or write external resources.
- acceptance: the full test matrix in the source (Pricing and fulfillment; Tender lifecycle; Issuance and delivery; Refunds; Public/admin surfaces; Runtime and D1; Regression) is the stated release gate
- scope: gift cards, stored-value ledger, bearer codes, mixed-cart pricing, tender lifecycle, refunds

## REQ-gift-cards-mixed-cart-pricing
- source: /Users/rmoore/Workspaces/mercora/docs/o07-gift-cards-plan.md
- description: Wave 1. Classify digital gift-card lines in server pricing; exclude them from shipping and inventory; retain physical shipping for mixed carts; calculate promotion/tax/shipping through the current framework contracts; persist immutable order snapshots without bearer codes. Source status: Implemented.
- acceptance: digital-only, physical-only, and mixed carts; promotion/tax/shipping; no gift-card self-purchase; immutable snapshots; no gift inventory mutation
- scope: mixed-cart pricing and snapshots

## REQ-gift-cards-tender-lifecycle
- source: /Users/rmoore/Workspaces/mercora/docs/o07-gift-cards-plan.md
- description: Wave 2. Web and MCP acquisition, request-identity-bound reservation, explicit release/expiry. Partial-gift purchases with positive cash finalize through the payment boundary; fully funded purchases finalize through a genuine no-Stripe zero-cash path. Gift-card value must never pay for a gift-card line. Source status: Implemented ("MCP uses the same authoritative checkout path").
- acceptance: web and MCP acquire/retry/release/expiry; stable request identity; partial and full tender finalization; positive-cash payment binding
- scope: checkout and MCP tender lifecycle

## REQ-gift-cards-issuance-delivery
- source: /Users/rmoore/Workspaces/mercora/docs/o07-gift-cards-plan.md
- description: Wave 3. Issue cards idempotently only after successful order finalization; deliver through a provider-neutral, retryable email boundary; the raw code exists only transiently in encrypted retry material and delivery rendering. Source status: Implemented and focused-tested (corrupted retry material becomes review-only).
- acceptance: idempotent issuance; encrypted retry material; claim/release single-flight delivery; no raw-code persistence or projection leakage
- scope: issuance and email delivery

## REQ-gift-cards-refund-convergence
- source: /Users/rmoore/Workspaces/mercora/docs/o07-gift-cards-plan.md
- description: Wave 4. Allocate refunds between cash and gift tender, restore gift value exactly once, and mark a refund complete only after both the cash and gift restoration legs have converged. Stripe is called only for positive cash. Source status: Implemented.
- acceptance: cash-only, gift-only, split tender, retry/idempotency, and dual-leg completion convergence
- scope: refund convergence (cash and gift legs)

## REQ-gift-cards-presentation-surfaces
- source: /Users/rmoore/Workspaces/mercora/docs/o07-gift-cards-plan.md
- description: Wave 5. Customer/admin APIs and UI with public rate limiting, enumeration-resistant responses, and secret-safe projections with no raw code or encrypted material leakage. Balance remains available with reconciliation enabled after acquisition is disabled. Source status: Implemented.
- acceptance: input bounds, rate-limit fail mode, enumeration resistance, authorization, safe customer/admin projections
- scope: customer/admin gift-card APIs and UI

## REQ-gift-cards-runtime-composition
- source: /Users/rmoore/Workspaces/mercora/docs/o07-gift-cards-plan.md
- description: Wave 6. Scheduler/runtime composition for reconciliation, reservation expiry, and delivery retries; the five-minute scheduler drains delivery only when reconciliation is enabled; docs and the full unit/integration/worker/API/MCP/UI test matrix. Source status: Implemented.
- acceptance: scheduler composition, migration application/order, real-D1 atomicity/concurrency, reconciliation, expiry, worker-safe configuration
- scope: scheduler reconciliation and reservation expiry, D1 migration 0022

## REQ-gift-cards-stack-handoff
- source: /Users/rmoore/Workspaces/mercora/docs/o07-gift-cards-plan.md
- description: Wave 7. Rebase the completed worktree on `agent/o06-subscriptions` without rewriting O07 history, validate the full suite, push, and open one draft O07 PR stacked on O06 assigned to Russell. Must not merge or rebase against the unrelated BeauTeas `main` history. Source status: validation complete (230 unit files / 1,677 tests; 27 Worker/D1 files / 147 tests; typecheck, build, whitespace pass; 52 pre-existing lint warnings, 0 errors); external push/PR pending.
- acceptance: focused unit/API/MCP/worker/UI tests plus lint, typecheck, build, and relevant existing checkout/subscription suites pass
- scope: PR dependency chain O03 -> O06 -> O07

---

# docs/ROADMAP.md

Only items the source marks planned (clipboard icon) or lists under "Immediate
Next Steps" are extracted. Completed items are recorded in context.md as
existing behavior. The source's Success Metrics section names metric
categories (revenue, conversion, NPS, AI engagement, Core Web Vitals, uptime,
MCP usage) with no numeric targets, so acceptance is absent throughout.

## REQ-pwa-features
- source: /Users/rmoore/Workspaces/mercora/docs/ROADMAP.md
- description: PWA features: potential offline browsing, push notifications, app-like experience. Source status: planned.
- acceptance: absent in source
- scope: PWA features, mobile UX

## REQ-touch-interactions
- source: /Users/rmoore/Workspaces/mercora/docs/ROADMAP.md
- description: Refine gestures and spacing for mobile-first design. Listed alongside the active "Mobile UX Optimization Sprint" (high priority #1) which ships assessment-driven touch, navigation, and product-card improvements. Source status: planned.
- acceptance: absent in source
- scope: mobile UX, touch interactions

## REQ-reviews-ratings
- source: /Users/rmoore/Workspaces/mercora/docs/ROADMAP.md
- description: Reviews & Ratings. The parent bullet carries the planned marker, but every sub-item (schema alignment, submission flow with AI-assisted moderation and single-review enforcement, product UI with star summaries and verified badges, moderation queue, status/response emails and post-delivery reminders) is marked complete. Also listed in high-priority next steps #3. Source status: ambiguous (planned header, completed children).
- acceptance: absent in source
- scope: reviews and ratings

## REQ-wishlist
- source: /Users/rmoore/Workspaces/mercora/docs/ROADMAP.md
- description: Wishlist system: save products for later with sharing capabilities. Also in high-priority next steps #3. Source status: planned.
- acceptance: absent in source
- scope: wishlist system

## REQ-social-features
- source: /Users/rmoore/Workspaces/mercora/docs/ROADMAP.md
- description: Social features: product sharing, user-generated content integration. Source status: planned.
- acceptance: absent in source
- scope: social features

## REQ-visual-search
- source: /Users/rmoore/Workspaces/mercora/docs/ROADMAP.md
- description: Visual search: image-based product discovery. Source status: planned.
- acceptance: absent in source
- scope: visual search

## REQ-predictive-analytics
- source: /Users/rmoore/Workspaces/mercora/docs/ROADMAP.md
- description: Predictive analytics: inventory management and demand forecasting. Source status: planned.
- acceptance: absent in source
- scope: predictive analytics

## REQ-multi-language
- source: /Users/rmoore/Workspaces/mercora/docs/ROADMAP.md
- description: Multi-language support to expand to international markets; also "International Expansion - Multi-language support and global markets" under strategic priority #3. Source status: planned.
- acceptance: absent in source
- scope: multi-language support, international expansion

## REQ-advanced-security
- source: /Users/rmoore/Workspaces/mercora/docs/ROADMAP.md
- description: Advanced security: rate limiting, fraud detection, security monitoring. Source status: planned. (Note: docs/DEPLOYMENT_SETUP.md already documents `AI_RATE_LIMITER` and `PUBLIC_RATE_LIMITER` bindings, so the rate-limiting portion may be partly done; the source does not say.)
- acceptance: absent in source
- scope: advanced security

## REQ-email-marketing
- source: /Users/rmoore/Workspaces/mercora/docs/ROADMAP.md
- description: Advanced email marketing: newsletter system and customer communication enhancement. High-priority next step #2. Source status: planned.
- acceptance: absent in source
- scope: email marketing

## REQ-advanced-analytics
- source: /Users/rmoore/Workspaces/mercora/docs/ROADMAP.md
- description: Advanced analytics: enhanced business intelligence and customer insights. Strategic priority #1; 30% of stated resource allocation. Source status: planned.
- acceptance: absent in source
- scope: advanced analytics

## REQ-performance-image-caching
- source: /Users/rmoore/Workspaces/mercora/docs/ROADMAP.md
- description: Performance optimization: Core Web Vitals instrumentation is shipped; remaining focus is image strategy and caching. Strategic priority #2. Source status: planned.
- acceptance: absent in source
- scope: performance optimization, image strategy, caching
