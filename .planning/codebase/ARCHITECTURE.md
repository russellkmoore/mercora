<!-- refreshed: 2026-08-31 -->
# Architecture

**Analysis Date:** 2026-08-31

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers Runtime                               │
│                    (worker.ts + OpenNext Handler)                            │
└─────────────────────────────────────────────────────────────────┬───────────┘
                                                                  │
        ┌─────────────────────────────────────────────────────────┼──────────────┬──────────────┐
        │                                                          │              │              │
        ▼                                                          ▼              ▼              ▼
┌─────────────────────────┐                          ┌──────────────────┐ ┌──────────────┐ ┌─────────────┐
│  Middleware             │                          │  Server Pages    │ │  Client UI   │ │  API Routes │
│  (middleware.ts)        │                          │  (app/**/*.tsx)  │ │ (components) │ │ (app/api/*) │
│ - Auth (Clerk)          │                          │ - Home (/)       │ │              │ │ - Express   │
│ - Maintenance mode      │                          │ - Checkout       │ │ - Components │ │ - Handlers  │
│ - Redirects             │                          │ - Product detail │ │ - Layout     │ │ - WebHooks  │
└──────────┬──────────────┘                          │ - Admin UI       │ │ - Cart       │ │ - MCP       │
           │                                          └──────────────────┘ └──────────────┘ │ - Payment   │
           │                                                                                 └──────────────┘
           │                                                                                 │
           ▼─────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Business Logic & Domain Services                          │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Commerce & Checkout (lib/services/)                                │  │
│  │  - checkout-pricing.ts ← priceCheckout()                            │  │
│  │  - order-finalization.ts ← finalizeOrderPayment()                   │  │
│  │  - order-effects.ts ← stagePaidOrderEffects()                       │  │
│  │  - order-confirmation.ts ← sendOrderConfirmation()                  │  │
│  │  - inventory-adjustments.ts ← assertCheckoutInventoryAvailable()    │  │
│  │  - gift-card-fulfillment.ts ← fulfillPaidGiftCards()                │  │
│  │  - shipping-options.ts ← resolveShippingOptions()                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Data Models & Queries (lib/models/mach/)                           │  │
│  │  - products.ts, categories.ts, inventory.ts                         │  │
│  │  - orders.ts, customer.ts, pricing.ts                               │  │
│  │  - promotions.ts, couponInstance.ts                                 │  │
│  │  - product-serializer.ts, order-serializer.ts                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Commerce Capabilities (lib/commerce/)                              │  │
│  │  - capabilities.ts ← CommerceCapabilities (gift cards, subs)         │  │
│  │  - runtime.ts ← resolveRuntimeCommerceCapabilities()                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Cross-Cutting Concerns                                             │  │
│  │  - auth/ (Clerk integration)                                        │  │
│  │  - payments/ (Stripe integration)                                   │  │
│  │  - shipping/ (Carrier management)                                   │  │
│  │  - email/ (Notification service)                                    │  │
│  │  - observability/ (Telemetry, logging)                              │  │
│  │  - utils/ (Helpers, validation)                                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Data Access Layer (lib/db/)                          │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Drizzle ORM (getDb / getDbAsync)                                   │  │
│  │  - Query builder with type safety                                   │  │
│  │  - Request-level caching via React cache()                          │  │
│  │  - Schema-driven type generation                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Database Schema (lib/db/schema/)                                   │  │
│  │  - orders, customers, products, inventory                           │  │
│  │  - pricing, promotions, couponInstance                              │  │
│  │  - subscriptions, gift_cards, order_effects                         │  │
│  │  - categories, pages, blog, media, analytics                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Migrations (migrations/ — hand-authored SQL)                       │  │
│  │  - Schema evolution tracked separately from models                  │  │
│  │  - Expand-only policy for production stability                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│          Cloudflare D1 (SQLite on Replicated Durable Storage)                │
│          + External Integrations                                             │
│          - Stripe (payment processing)                                       │
│          - Clerk (authentication)                                            │
│          - R2 (media storage)                                                │
│          - Email service (order notifications)                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Worker Entry | Wraps OpenNext handler, adds scheduled (cron) export | `worker.ts` |
| Middleware | Auth via Clerk, maintenance mode, legacy redirects | `middleware.ts` |
| Checkout Page | Server-side auth context, renders CheckoutClient | `app/checkout/page.tsx` |
| Checkout Component | Client-side payment flow (Stripe, gift cards) | `components/checkout/CheckoutClient` |
| Payment Intent API | Computes pricing, creates Stripe PI, persists pending order | `app/api/payment-intent/route.ts` |
| Orders API | Finalizes payment, triggers order effects | `app/api/orders/route.ts` |
| Checkout Pricing Service | Pricing engine (tax, shipping, discounts, tender) | `lib/services/checkout-pricing.ts` |
| Order Finalization | Verifies payment, promotes order to paid | `lib/services/order-finalization.ts` |
| Order Effects | Async post-payment: inventory, email, coupons, subscriptions | `lib/services/order-effects.ts` |
| Commerce Capabilities | Pluggable features (gift cards, subscriptions) | `lib/commerce/capabilities.ts` |
| Product Queries | MACH-compliant product fetching and serialization | `lib/models/mach/products.ts` |
| Order Queries | Order hydration and lifecycle state management | `lib/models/mach/orders.ts` |
| Database Connection | Drizzle ORM instance with request-level caching | `lib/db.ts` |
| MCP API | Agent-facing commerce API | `app/api/mcp/route.ts` |

## Pattern Overview

**Overall:** Server-authoritative, async-first commerce platform with payment-gated order lifecycle and pluggable post-purchase effects.

**Key Characteristics:**
- All checkout pricing, inventory, and payment decisions are computed and persisted server-side
- Pending orders are durable from the start (created at `POST /api/payment-intent`)
- Payment finalization (at `POST /api/orders` or Stripe webhook) atomically promotes order to paid
- Post-payment effects (email, inventory deductions, coupon redemption) run asynchronously and are recoverable via scheduler
- Cloudflare Workers runtime with D1 as the primary database
- Stripe handles payment capture; server holds the authoritative receipt
- Gift-card and subscription features are pluggable via commerce capabilities

## Layers

**Presentation Layer:**
- Purpose: User-facing pages and API responses
- Location: `app/` (pages) and `app/api/` (endpoints)
- Contains: Next.js page components, server/client split, API route handlers
- Depends on: Middleware for auth, services for business logic
- Used by: Browser clients, Stripe webhooks, MCP agents

**API & Route Layer:**
- Purpose: HTTP request handling, validation, response formatting
- Location: `app/api/**/*.ts`
- Contains: Route handlers, request validation, response serialization
- Depends on: Services for domain logic, database for persistence
- Used by: Client applications, webhooks, external integrations

**Service & Business Logic Layer:**
- Purpose: Domain-specific workflows and computations
- Location: `lib/services/`
- Contains: Pricing engine, order finalization, effects orchestration, email, inventory
- Depends on: Models for data access, capabilities for extensibility
- Used by: API routes, scheduled handlers, effects processor

**Models & Data Access Layer:**
- Purpose: Type-safe queries and domain object hydration
- Location: `lib/models/mach/`
- Contains: Product, order, customer, inventory queries; serializers
- Depends on: Drizzle ORM, database schema
- Used by: Services, API routes, admin pages

**Database Layer:**
- Purpose: Persistence and transactional consistency
- Location: `lib/db/` (connection), `lib/db/schema/` (tables)
- Contains: Drizzle ORM instance, table definitions, migrations
- Depends on: Cloudflare D1, external storage (R2 for media)
- Used by: All data-dependent layers

**Integration Layer:**
- Purpose: External service adapters
- Location: `lib/payments/` (Stripe), `lib/auth/` (Clerk), `lib/email/`, `lib/shipping/`
- Contains: API client wrappers, token management, webhook handlers
- Depends on: Environment secrets, external provider SDKs
- Used by: Services, API routes

## Data Flow

### Primary Request Path: Checkout to Payment

1. **User initiates checkout** (`POST /api/payment-intent`)
   - Request validation normalizes address and cart items
   - Rate limit enforced per client IP

2. **Compute authoritative quote** → `priceCheckout()` (`lib/services/checkout-pricing.ts`)
   - Load product variants, current pricing, promotions
   - Validate discount codes and gift-card tender
   - Calculate tax via Stripe Tax (or configured fallback)
   - Compute shipping based on address and method
   - Return immutable quote + opaque tender state

3. **Create pending order** → `db.insert(orders)` (`lib/db/schema/order.ts`)
   - Store order with status='pending', payment_status='pending'
   - Persist quote snapshot in extensions (checkout_total, checkout_tender, etc.)
   - Persist external_references with payment_intent_id (if Stripe)
   - Immutable order ID = `WEB-[USER]-[TIMESTAMP]-[UUID]`

4. **Create Stripe PaymentIntent** → `createPaymentIntent()` (`lib/payments/stripe.ts`)
   - For zero-cash (gift card only), skip; immediately finalize
   - Amount = checkout_total minor units, currency from quote
   - Metadata: orderId, expectedAmount, currency
   - Return clientSecret for 3DS/payment element

5. **Return response to client** with clientSecret + quote
   - If zero-cash: finalized order returned immediately
   - Otherwise: Stripe client-side confirmation required

6. **Client confirms payment** (Stripe payment element, background)
   - Stripe captures payment, transitions PI status → 'succeeded'

7. **Client finalizes order** → `POST /api/orders`
   - Send paymentIntentId + orderId
   - Lookup pending order by PI ID (if orderId omitted)
   - Call `finalizeOrderPayment()` (`lib/services/order-finalization.ts`)

8. **Verify payment** inside finalization:
   - Retrieve Stripe PI, confirm status='succeeded'
   - Verify amount received ≥ checkout_total
   - Verify currency matches quote
   - Verify gift-card tender (if any) still reserved
   - Stage deterministic order effects rows (BEFORE paid CAS)

9. **Atomic promotion** → `promoteOrderToPaid()` (`lib/models/mach/orders.ts`)
   - CAS: pending → paid, total_amount := amount_received
   - Single database transaction ensures idempotency
   - Return new order state

10. **Drain order effects** (best-effort, inline)
    - Claim, execute, complete effects (inventory, email, coupons, subscriptions)
    - Failures logged and scheduled for retry
    - All effect state durable; scheduler owns recovery

11. **Return finalized order** to client
    - Includes: order ID, paid status, no sensitive payment details

### Secondary Flow: Stripe Webhook Fallback

1. **Stripe sends `payment_intent.succeeded` webhook** (`app/api/webhooks/stripe.ts`)
2. **Lookup pending order** by PaymentIntent ID
3. **Call `finalizeOrderPayment()`** with same verification as client path
4. **Idempotent:** If order already paid, skip; webhook succeeds either way
5. **Drain effects** via scheduled handler if inline attempt fails

### Zero-Cash Gift-Card Checkout (Subset)

1. **User has sufficient gift-card balance** → tender covers 100% of checkout_total
2. At step 3 above: quote.tender === quote.total, paymentIntent skipped
3. At step 7: `POST /api/payment-intent` returns noCash: true, finalized order
4. No Stripe involvement; gift-card capability handles reservation/settlement

### State Management

**Order Lifecycle:**
- `pending` (created at `/api/payment-intent`) → `paid` (promoted at `/api/orders` or webhook)
- `processing` (async effects running) → `shipped`/`delivered` (fulfillment updates)

**Payment Status:**
- `pending` → `paid` (Stripe/gift-card success) → `refunded` (if applicable)

**Effect State:**
- Persisted in `order_effects` table before effect execution
- Claimed (lease token), executed (attempt count incremented), completed (result stored)
- Failures eligible for retry; scheduler picks up abandoned leases

**Durable Idempotency:**
- Order ID immutable; lookup by ID always recovers same order
- PaymentIntent ID bound to order at creation; cannot be reused
- Effect state prevents double-execution (claim → execute → complete)

## Key Abstractions

**CheckoutQuote:**
- Purpose: Immutable server-computed snapshot of cart pricing at moment of checkout
- Examples: `lib/services/checkout-pricing.ts` returns CheckoutQuote
- Pattern: Quoted at `/api/payment-intent`, stored in order extensions, used to verify client payment

**Order:**
- Purpose: MACH-compliant order entity with immutable server-authored financial snapshot
- Examples: `lib/types/order.ts`, `lib/models/mach/orders.ts`
- Pattern: Type-safe lifecycle (pending → paid → processing → shipped → delivered), all state in D1

**CommerceCapabilities:**
- Purpose: Pluggable feature implementations for gift cards, subscriptions
- Examples: `lib/commerce/capabilities.ts`, feature flag gating
- Pattern: Interface-based injection; no-op fallback if disabled; factory resolves at runtime

**OrderEffect:**
- Purpose: Declarative post-payment side effect (inventory, email, coupon)
- Examples: `lib/services/order-effects.ts` effect type enum
- Pattern: Staged deterministically, claimed with lease token, executed asynchronously, completed durably

**MACH Model:**
- Purpose: Domain-driven data models aligned with MACH Alliance standards
- Examples: `lib/models/mach/products.ts`, `lib/models/mach/orders.ts`
- Pattern: Query-specific shapes (e.g., product hydration), serializers for API responses

## Entry Points

**Web App (Browser):**
- Location: `app/` (Next.js App Router)
- Triggers: User navigates to `https://domain/`, hits any page or checkout
- Responsibilities: Render pages, handle client-side state, call APIs for dynamic content

**Checkout API:**
- Location: `app/api/payment-intent/route.ts`
- Triggers: `POST /api/payment-intent` from checkout client
- Responsibilities: Validate cart, compute quote, create Stripe PI or finalize zero-cash, persist pending order

**Order Finalization API:**
- Location: `app/api/orders/route.ts` (POST)
- Triggers: `POST /api/orders` from checkout client after Stripe payment
- Responsibilities: Verify payment, promote order, trigger effects

**Stripe Webhooks:**
- Location: `app/api/webhooks/stripe.ts`
- Triggers: `payment_intent.succeeded`, `charge.refunded`, etc.
- Responsibilities: Idempotent order finalization, refund processing

**Scheduled Tasks (Cron):**
- Location: `worker.ts` (scheduled export) → `lib/observability/scheduled.ts`
- Triggers: Cloudflare cron schedule (configured in wrangler.jsonc)
- Responsibilities: Drain abandoned order effects, regenerate admin analytics cache

**MCP Agent API:**
- Location: `app/api/mcp/**`
- Triggers: Agent requests (Claude tool calls, schemas)
- Responsibilities: Expose commerce operations (search, shipping, cart, assess) for agent workflows

**Admin Dashboard:**
- Location: `app/admin/**`
- Triggers: Authenticated admin users navigate to `/admin`
- Responsibilities: Order management, product administration, settings

## Architectural Constraints

- **Threading:** Single-threaded event loop (Cloudflare Workers); CPU-bound work (pricing) must complete synchronously within request timeout (~600s)
- **Global state:** No module-level mutable singletons; all state flows through D1 or request context
- **Circular imports:** Avoided via strict layer boundaries (API → Services → Models → DB)
- **Transaction scope:** Atomic CAS (compare-and-set) via single-row update on `orders.payment_status`; multi-row operations staged deterministically before CAS
- **Idempotency:** All write operations must survive duplicate calls; leased effect state prevents double-execution
- **Rate limiting:** Per-IP public endpoints (checkout, finalization) to prevent abuse; admin API keyed

## Anti-Patterns

### Client-Computed Pricing

**What happens:** Cart totals, tax, shipping computed on client; sent to server as request parameter

**Why it's wrong:** Enables price manipulation, tax evasion, inventory double-counting. Server has no way to verify cart authenticity.

**Do this instead:** All pricing computed server-side at `POST /api/payment-intent` by `priceCheckout()` (`lib/services/checkout-pricing.ts`). Client receives immutable quote, sends it back only for verification, never modification.

### Unverified Payment State

**What happens:** Order marked paid based on client claim alone, without contacting payment provider

**Why it's wrong:** Attacker can claim payment without actually paying; merchant loses funds.

**Do this instead:** `finalizeOrderPayment()` (`lib/services/order-finalization.ts`) retrieves Stripe PaymentIntent, verifies status='succeeded' and amount_received >= expected. If client and webhook both attempt finalization, CAS prevents double-promotion.

### Synchronous Effect Execution

**What happens:** Email, inventory, coupon effects run within request context; request fails if effect fails

**Why it's wrong:** User sees checkout failure even though payment succeeded and order is durable. Cascading failures.

**Do this instead:** Effects staged deterministically BEFORE paid CAS; executed asynchronously via scheduler (`lib/services/order-effects.ts` stagePaidOrderEffects → drainOrderEffects). Request returns immediately. Failures scheduled for retry.

### Missing Inventory Snapshot

**What happens:** Order stores only product/variant ID; inventory quantities fetched at fulfillment time

**Why it's wrong:** Price, tax, shipping became stale; can't audit what was actually charged; refund math breaks.

**Do this instead:** Order.items includes snapshot of product_name, unit_price, fulfillment_type at checkout time. CheckoutLineAllocation includes immutable tax and discount attribution. Server never recomputes.

### Unbound Gift-Card Tender

**What happens:** Gift-card balance checked at checkout, but not reserved; another order drains balance before finalization

**Why it's wrong:** Overlapping checkouts fight over same balance; double-spending.

**Do this instead:** Gift-card capability's `resolveTender()` reserves the amount atomically, returns opaque state. Re-verified at finalization before paid CAS. Released if checkout abandoned.

## Error Handling

**Strategy:** Fail-fast validation upstream, graceful degradation downstream, all write state durable.

**Patterns:**
- Request validation: Reject with 400 (bad request) or 403 (forbidden) before any side effects
- Inventory unavailable: Return 409 (conflict) with count of unavailable items; client re-quotes
- Payment provider error: Return 503 (service unavailable); user can retry from same cart
- Effect failure: Log + telemetry + schedule retry; never fail the finalization response
- Webhook idempotency: Always return 200 (ok) even if order already paid; deduplication handled by state

## Cross-Cutting Concerns

**Logging:** `lib/observability/telemetry.ts` records operation outcomes (validate, create, process, finalize) with result (success, rejected, failed, retry_scheduled) and provider. Consumed by analytics and alerting.

**Validation:** Public API endpoints validate request shape + bounds (`lib/public-request-validation.ts`). Server models validate invariants (e.g., order currency consistency). Type safety via TypeScript.

**Authentication:** Clerk via middleware (`middleware.ts`), server helpers (`auth()`, `currentUser()`), Clerk token in cookies. Admin requires API key + permission check (`lib/auth/unified-auth.ts`).

**Rate Limiting:** Per-IP limiter on public checkout endpoints (`lib/rate-limit.ts`). Prevents brute-force abuse and resource exhaustion.

**Database Access:** All queries through Drizzle ORM (`lib/db.ts`) with request-level caching. No raw SQL except migrations. Transactions via explicit tx() wrapper.

---

*Architecture analysis: 2026-08-31*
