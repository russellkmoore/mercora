# Codebase Structure

**Analysis Date:** 2026-08-31

## Directory Layout

```
mercora/
├── app/                          # Next.js App Router — pages and API routes
│   ├── layout.tsx                # Root layout (auth, styling)
│   ├── page.tsx                  # Home page (hero + featured products)
│   ├── middleware.ts             # ← Global auth, maintenance, redirects
│   ├── [slug]/                   # Dynamic pages (category, static content)
│   │   └── page.tsx              # Parameterized page renderer
│   ├── account/                  # User dashboard
│   │   ├── page.tsx              # Account overview
│   │   ├── addresses/            # Saved addresses
│   │   ├── orders/               # Order history
│   │   ├── subscriptions/        # Active subscriptions
│   │   └── settings/             # User settings
│   ├── admin/                    # Admin dashboard (requires auth)
│   │   ├── page.tsx              # Admin home
│   │   ├── products/             # Product management
│   │   ├── orders/               # Order fulfillment
│   │   ├── categories/           # Category management
│   │   ├── promotions/           # Discount/promotion editing
│   │   ├── settings/             # Store settings
│   │   └── [other resources]/    # Other admin sections
│   ├── checkout/                 # Checkout flow
│   │   ├── page.tsx              # Checkout page (renders CheckoutClient)
│   │   └── success/              # Post-payment success page
│   ├── blog/                     # Blog posts
│   │   ├── page.tsx              # Blog listing
│   │   └── [slug]/               # Individual post
│   ├── product/                  # Product detail
│   │   └── [slug]/               # Product page
│   ├── category/                 # Category pages
│   │   └── [slug]/               # Category listing
│   ├── order-status/             # Order status tracking (public)
│   │   └── [id]/                 # Status for specific order
│   ├── orders/                   # Redirect (legacy)
│   ├── media/                    # File upload / R2 proxy
│   │   └── [...key]/             # Dynamic file key handling
│   └── api/                      # API routes (backend)
│       ├── payment-intent/       # ← Create pending order + Stripe PI
│       │   └── route.ts
│       ├── orders/               # ← Finalize payment, list orders
│       │   ├── route.ts          # POST (finalize), GET (list), PUT (update)
│       │   ├── [id]/
│       │   └── refund/           # Refund handling
│       ├── submit-order/         # (Legacy?) order submission
│       ├── update-order/         # Order metadata updates
│       ├── user-orders/          # User order listing (subsumed by GET /api/orders)
│       ├── account/              # User account operations
│       ├── admin/                # Admin-only endpoints
│       ├── products/             # Product catalog API
│       ├── categories/           # Category CRUD
│       ├── promotions/           # Promotion management
│       ├── tax/                  # Tax calculation
│       ├── shipping-options/     # Shipping method listing
│       ├── validate-discount/    # Coupon validation
│       ├── setup-intent/         # Stripe setup for subscriptions
│       ├── subscriptions/        # Subscription management
│       ├── gift-cards/           # Gift card operations
│       ├── email/                # Email sending (transactional)
│       ├── test-email/           # Email template testing
│       ├── analytics/            # Dashboard data
│       ├── vectorize-products/   # AI search embedding
│       ├── vectorize-knowledge/  # KB embedding
│       ├── agent-chat/           # Agent chat integration
│       ├── webhooks/             # External webhooks
│       │   └── stripe.ts         # Stripe payment events
│       ├── mach/                 # MACH compliance (spec endpoint)
│       ├── mcp/                  # ← MCP Protocol API (agent-facing)
│       │   ├── route.ts          # MCP server root
│       │   ├── schema/           # Tool schemas
│       │   ├── sessions/         # Session management
│       │   └── tools/            # Agent tools
│       │       ├── search/       # Product search
│       │       ├── shipping/     # Shipping calculator
│       │       ├── cart/         # Cart operations
│       │       ├── assess/       # Product assessment
│       │       └── recommend/    # Recommendations
│       ├── blog/                 # Blog API
│       ├── pages/                # Dynamic page API
│       ├── reviews/              # Product reviews
│       ├── send-email/           # Email API
│       ├── debug/                # Debug endpoints
│       └── [feature]/            # Other domain APIs
│
├── lib/                          # Core business logic and utilities
│   ├── db.ts                     # ← Database connection (getDb, getDbAsync)
│   ├── db/                       # Database layer
│   │   ├── schema/               # ← Drizzle table definitions
│   │   │   ├── order.ts          # Order table
│   │   │   ├── products.ts       # Product variants + inventory
│   │   │   ├── customers.ts      # Customer records
│   │   │   ├── subscriptions.ts  # Subscription state
│   │   │   ├── gift-cards.ts     # Gift card balances
│   │   │   ├── order-effects.ts  # Post-payment effects queue
│   │   │   ├── pricing.ts        # Pricing rules
│   │   │   ├── promotions.ts     # Discount definitions
│   │   │   ├── couponInstance.ts # Applied coupon state
│   │   │   ├── settings.ts       # Store configuration
│   │   │   ├── analytics.ts      # Cached dashboard data
│   │   │   └── [other tables]/   # Additional tables
│   │   ├── mach/                 # MACH schema hooks (none currently)
│   │   └── seed-clean/           # Test data seeding
│   ├── migrations/               # ← Hand-authored SQL migrations
│   │   ├── 001_initial.sql       # Schema bootstrap
│   │   ├── 002_*.sql             # Sequential migrations
│   │   └── [...]
│   ├── services/                 # ← Business logic workflows
│   │   ├── checkout-pricing.ts   # ← Core: compute cart total (tax, shipping, discounts)
│   │   ├── order-finalization.ts # ← Core: verify payment, promote to paid
│   │   ├── order-effects.ts      # ← Core: async post-payment side effects
│   │   ├── order-confirmation.ts # Email notifications
│   │   ├── inventory-adjustments.ts # Inventory deductions + snapshots
│   │   ├── gift-card-fulfillment.ts # Gift card delivery
│   │   └── shipping-options.ts   # Shipping method resolution
│   ├── models/                   # Data access layer (queries + hydration)
│   │   └── mach/                 # MACH-compliant models
│   │       ├── products.ts       # ← Product queries (variants, pricing)
│   │       ├── orders.ts         # ← Order lifecycle state machine
│   │       ├── customers.ts      # Customer lookups
│   │       ├── inventory.ts      # Inventory reads
│   │       ├── pricing.ts        # Pricing rule queries
│   │       ├── promotions.ts     # Promotion/discount lookups
│   │       ├── couponInstance.ts # Coupon redemption logic
│   │       ├── product-serializer.ts # Product → API response
│   │       ├── order-serializer.ts # Order → API response
│   │       └── [other models]/   # Additional queries
│   ├── types/                    # TypeScript type definitions
│   │   ├── order.ts              # ← Order interface (MACH)
│   │   ├── cartitem.ts           # Cart item + gift card customization
│   │   ├── shipping.ts           # Shipping types
│   │   ├── apiPermissions.ts     # API permission enums
│   │   ├── money.ts              # Money type
│   │   ├── review.ts             # Review type
│   │   ├── userProfile.ts        # User type
│   │   └── mach/                 # MACH spec types
│   ├── commerce/                 # ← Pluggable commerce features
│   │   ├── capabilities.ts       # Gift card + subscription interfaces
│   │   └── runtime.ts            # Capability factory resolver
│   ├── payments/                 # Stripe integration
│   │   ├── stripe.ts             # Stripe API client
│   │   └── [helpers]/
│   ├── auth/                     # Authentication
│   │   ├── unified-auth.ts       # API key + permission validation
│   │   └── [helpers]/
│   ├── email/                    # Email service integration
│   │   ├── [provider]/           # Email provider client
│   │   └── templates/            # Email templates
│   ├── shipping/                 # Shipping integrations
│   │   ├── allowed-countries.ts  # Shipping policy
│   │   └── [providers]/          # Carrier APIs
│   ├── gift-cards/               # Gift card logic
│   │   ├── checkout.ts           # Gift card in checkout
│   │   └── [operations]/
│   ├── subscriptions/            # Subscription logic
│   │   ├── lifecycle.ts          # Subscription state machine
│   │   └── billing.ts            # Invoice generation
│   ├── inventory/                # Inventory management
│   │   ├── availability.ts       # Stock checks
│   │   └── adjustments.ts        # Quantity tracking
│   ├── money/                    # Money type and utilities
│   │   └── index.ts              # Money class (immutable, currency-aware)
│   ├── observability/            # Logging and monitoring
│   │   ├── telemetry.ts          # Event recording
│   │   ├── scheduled.ts          # Cron handler (analytics cache, effect drain)
│   │   └── [middleware]/
│   ├── mcp/                      # MCP Protocol implementation
│   │   ├── auth.ts               # MCP auth helpers
│   │   └── tools/                # MCP tool implementations
│   ├── cms/                      # Content management
│   │   ├── pages.ts              # Dynamic page queries
│   │   └── blog.ts               # Blog post queries
│   ├── utils/                    # Utilities and helpers
│   │   ├── settings.ts           # Store settings getter
│   │   ├── store-config.ts       # Store identity + configuration
│   │   ├── request-validation.ts # Input normalization
│   │   ├── public-request-validation.ts # Public endpoint validation
│   │   ├── maintenance-html.ts   # Maintenance page HTML
│   │   ├── order-update-guards.ts # Order update validation
│   │   ├── redirects/            # Legacy redirect resolution
│   │   └── [common utilities]/
│   ├── rate-limit.ts             # Rate limiter (public endpoints)
│   ├── media/                    # Media/file handling
│   ├── analytics/                # Analytics dashboard
│   ├── recommendations/          # Product recommendations
│   │   ├── providers/            # Recommendation engines
│   │   └── batch/                # Batch processing
│   ├── order-status/             # Order status queries
│   ├── fulfillment/              # Fulfillment workflows
│   ├── loaders/                  # Data loaders (caching)
│   ├── redirects/                # Redirect resolution
│   └── store/                    # Store state (Zustand?)
│
├── components/                   # React UI components (client + server)
│   ├── ProductCard.tsx           # Product card component
│   ├── checkout/                 # Checkout-specific components
│   │   ├── CheckoutClient.tsx    # ← Main checkout form (client-side)
│   │   ├── StripePaymentElement.tsx # Stripe payment UI
│   │   ├── GiftCardInput.tsx      # Gift card form
│   │   └── [other checkout]/
│   ├── cart/                     # Cart UI
│   │   └── CartSummary.tsx       # Cart display
│   ├── account/                  # Account page components
│   │   ├── OrdersList.tsx        # Order history
│   │   └── AddressesList.tsx     # Saved addresses
│   ├── admin/                    # Admin page components
│   │   ├── OrdersTable.tsx       # Order management
│   │   ├── ProductForm.tsx       # Product editor
│   │   └── [admin UI]/
│   ├── ui/                       # Reusable UI primitives
│   │   ├── Button.tsx            # Button component
│   │   ├── Input.tsx             # Input component
│   │   ├── Modal.tsx             # Modal/dialog
│   │   └── [other primitives]/
│   ├── login/                    # Authentication UI
│   ├── pages/                    # Page layout components
│   ├── blog/                     # Blog UI
│   ├── reviews/                  # Review display
│   ├── subscriptions/            # Subscription UI
│   ├── agent/                    # Agent chat UI
│   └── analytics/                # Analytics dashboard
│
├── hooks/                        # Custom React hooks
│   ├── useCart.ts                # Cart state management
│   ├── useCheckout.ts            # Checkout form state
│   ├── useAuth.ts                # Auth state (Clerk)
│   └── [other hooks]/
│
├── emails/                       # Email template components
│   ├── OrderConfirmation.tsx     # Order confirmation email
│   ├── OrderShipped.tsx          # Shipment notification
│   ├── [other emails]/
│   └── [template components]/
│
├── mach-standards/               # MACH Alliance compliance schemas
│   └── schemas/                  # JSON Schema definitions
│       ├── catalog/              # Product catalog schemas
│       ├── commerce/             # Order/payment schemas
│       ├── customer/             # Customer schemas
│       └── common/               # Shared types
│
├── workers/                      # Cloudflare Worker-specific code
│   └── observability-tail/       # Tail worker for log aggregation
│
├── scripts/                      # Development and migration scripts
│   ├── shopify-migration/        # Shopify → Mercora data import
│   │   ├── adapters/             # Data transformation
│   │   ├── extractors/           # Data extraction
│   │   ├── transformers/         # Data transformation
│   │   └── lib/                  # Shared utilities
│   └── [other scripts]/
│
├── tests/                        # Test suite
│   ├── unit/                     # Unit tests (jest/vitest)
│   │   ├── lib/                  # Services, models, utilities
│   │   ├── components/           # Component rendering
│   │   ├── api/                  # API route testing
│   │   └── [coverage by feature]/
│   ├── integration/              # Integration tests
│   │   ├── lib/                  # Cross-service integration
│   │   ├── helpers/              # Test utilities
│   │   └── [workflow testing]/
│   └── workers/                  # Worker-specific tests
│
├── data/                         # Non-code data files
│   ├── d1/                       # D1 database artifacts (local)
│   └── r2/                       # R2 bucket simulation / seed data
│       ├── products/             # Product images
│       ├── products_md/          # Product descriptions (markdown)
│       ├── categories/           # Category data
│       └── knowledge_md/         # KB articles
│
├── public/                       # Static assets (images, fonts)
│   ├── images/
│   ├── fonts/
│   └── [other static]/
│
├── docs/                         # Project documentation
│   ├── DEPLOYMENT.md             # Deployment instructions
│   ├── DEVELOPMENT.md            # Local dev setup
│   └── [other guides]/
│
├── .claude/                      # Claude Code configuration
│   └── skills/                   # Project-specific skills (if any)
│
├── .vscode/                      # VS Code workspace config
│
├── .github/                      # GitHub Actions CI/CD
│   └── workflows/
│
├── worker.ts                     # ← Cloudflare Worker entry point
├── middleware.ts                 # ← Next.js middleware (auth, maintenance)
├── package.json                  # Node dependencies
├── tsconfig.json                 # TypeScript configuration
├── wrangler.jsonc                # Cloudflare Workers configuration
├── next.config.js                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration (if used)
├── .eslintrc.json                # ESLint configuration
├── .prettierrc                   # Prettier configuration
├── vitest.config.ts              # Vitest test runner config (if used)
└── README.md                     # Project overview

```

## Directory Purposes

**`app/`**
- Purpose: Next.js App Router pages and API routes
- Contains: All HTTP entry points, route handlers, page components
- Key files: `middleware.ts` (auth), `page.tsx` (home), `api/payment-intent/route.ts` (checkout), `api/orders/route.ts` (finalization)

**`lib/`**
- Purpose: All shared business logic, type-safe models, and utilities
- Contains: Services, models, database connection, integrations, utilities
- Key files: `db.ts` (DB connection), `services/` (workflows), `models/mach/` (queries), `types/order.ts` (types)

**`components/`**
- Purpose: React components for UI rendering
- Contains: Page components, reusable UI primitives, feature-specific components
- Key files: `checkout/CheckoutClient.tsx` (main checkout form), `ui/` (primitives)

**`lib/db/schema/`**
- Purpose: Drizzle ORM table definitions
- Contains: All database schema (orders, products, customers, etc.)
- Key files: `order.ts`, `products.ts`, `customers.ts`, `subscriptions.ts`

**`lib/services/`**
- Purpose: Business logic workflows
- Contains: Pricing computation, order finalization, effect orchestration, email, inventory
- Key files: `checkout-pricing.ts` (quote engine), `order-finalization.ts` (payment verification), `order-effects.ts` (async effects)

**`lib/models/mach/`**
- Purpose: Type-safe data queries and domain object hydration
- Contains: Product, order, customer, inventory queries
- Key files: `products.ts` (product queries), `orders.ts` (order lifecycle), `order-serializer.ts` (response shape)

**`migrations/`**
- Purpose: Hand-authored SQL schema evolution
- Contains: Sequential .sql files, one change per file
- Key files: Chronologically numbered files (e.g., `001_initial.sql`, `002_*.sql`)

**`app/api/payment-intent/`**
- Purpose: Checkout quote and Stripe PaymentIntent creation
- Contains: Cart validation, pricing, pending order creation
- Key files: `route.ts` (POST handler)

**`app/api/orders/`**
- Purpose: Order finalization and listing
- Contains: Payment verification, order promotion, effect triggering, metadata updates
- Key files: `route.ts` (POST/GET/PUT handlers)

**`lib/commerce/`**
- Purpose: Pluggable commerce feature interfaces
- Contains: Gift card and subscription capability definitions and resolvers
- Key files: `capabilities.ts` (interfaces), `runtime.ts` (factory)

**`app/api/mcp/`**
- Purpose: Agent-facing MCP Protocol API
- Contains: Tool schemas, session management, commerce operations for agents
- Key files: `route.ts` (MCP server), `tools/` (tool implementations)

## Key File Locations

**Entry Points:**
- `worker.ts`: Cloudflare Worker root (fetch + scheduled exports)
- `app/page.tsx`: Home page
- `app/checkout/page.tsx`: Checkout page
- `middleware.ts`: Global auth & maintenance middleware
- `app/layout.tsx`: Root layout (styling, providers)

**Configuration:**
- `wrangler.jsonc`: Cloudflare Workers config (bindings, triggers, crons)
- `tsconfig.json`: TypeScript compiler options
- `next.config.js`: Next.js build and runtime config
- `package.json`: Node dependencies + scripts

**Core Logic:**
- `lib/services/checkout-pricing.ts`: Pricing engine (tax, shipping, discounts)
- `lib/services/order-finalization.ts`: Payment verification & order promotion
- `lib/services/order-effects.ts`: Async post-payment effects (email, inventory, coupons)
- `lib/db.ts`: Database connection (getDb, getDbAsync)
- `lib/models/mach/orders.ts`: Order lifecycle state machine
- `lib/models/mach/products.ts`: Product queries

**Testing:**
- `tests/unit/`: Unit tests per feature/module
- `tests/integration/`: End-to-end workflow tests
- `vitest.config.ts`: Test runner configuration

## Naming Conventions

**Files:**
- `*.ts`: TypeScript source
- `*.tsx`: React component (server or client)
- `route.ts`: Next.js API handler (in `app/api/`)
- `layout.tsx`: Next.js layout component
- `page.tsx`: Next.js page component
- `*.test.ts` / `*.spec.ts`: Test file
- `schema.ts`: Drizzle table definition
- `*.sql`: SQL migration
- `[id]` or `[slug]`: Dynamic route segment

**Directories:**
- `lib/services/`: Business workflows
- `lib/models/`: Data queries and serialization
- `lib/db/schema/`: Drizzle schemas
- `lib/types/`: Shared TypeScript types
- `lib/auth/`: Authentication helpers
- `lib/payments/`: Payment provider integration
- `app/api/`: HTTP API routes
- `components/`: React UI components
- `migrations/`: SQL schema changes
- `tests/`: Automated tests

## Where to Add New Code

**New Feature (e.g., loyalty points):**
1. **Domain logic** → `lib/services/loyalty-points.ts`
   - Implement computation, application, redemption
   - Follow checkout-pricing pattern (pure function + types)
2. **Data access** → `lib/models/mach/loyalty.ts`
   - Query builders for fetching points, balances, history
3. **Database table** → `lib/db/schema/loyalty.ts`
   - Drizzle definition for points ledger
4. **Migration** → `migrations/NNN_add_loyalty.sql`
   - Add table to schema (expand-only)
5. **API endpoint** → `app/api/loyalty/[operation]/route.ts`
   - POST to apply points, GET to check balance
6. **Tests** → `tests/unit/services/loyalty-points.test.ts`
   - Unit test service logic, mock DB

**New Commerce Capability (e.g., split payment):**
1. **Interface** → Add method to `lib/commerce/capabilities.ts`
   - Define resolveTender, verify, apply pattern
2. **Integrate into checkout** → Update `lib/services/checkout-pricing.ts`
   - Call capability at tender resolution step
3. **Update order effects** → `lib/services/order-effects.ts`
   - Add effect type + handler for post-payment settlement
4. **Test** → Mock capability in `tests/`

**New Component/Page:**
1. **Page** → `app/[feature]/page.tsx` (server component)
   - Fetch server data, render layout
2. **Component** → `components/[feature]/ClientComponent.tsx` (client component)
   - Interactive UI, client state (hooks)
3. **Styles** → Use Tailwind (inline className)
4. **Types** → `lib/types/[feature].ts` (if domain-specific)

**New API Endpoint:**
1. **Route handler** → `app/api/[feature]/route.ts`
   - Validate request, call service, return response
2. **Service logic** → `lib/services/[feature].ts` (if not covered)
   - Implement domain workflow
3. **Tests** → `tests/unit/api/[feature].test.ts`
   - Mock dependencies, test all paths

**Utilities/Helpers:**
1. **Shared helpers** → `lib/utils/[name].ts`
2. **Type definitions** → `lib/types/[name].ts`
3. **Constants** → `lib/[domain]/constants.ts`

**Database Changes:**
1. **New table** → `lib/db/schema/[name].ts` (Drizzle)
2. **Schema migration** → `migrations/NNN_[description].sql`
   - Must be expand-only (add columns/tables, never drop)
3. **Queries** → `lib/models/mach/[name].ts`
4. **Update schema index** → `lib/db/schema/index.ts` (re-export)

## Special Directories

**`migrations/`**
- Purpose: Hand-authored SQL schema changes
- Generated: No (committed manually)
- Committed: Yes (required for production deploy)
- Rule: Expand-only; never drop columns/tables in production
- Apply: Automatically on deploy via Cloudflare Worker build

**`public/`**
- Purpose: Static assets (images, fonts, robots.txt)
- Generated: No
- Committed: Yes (design assets)
- Rule: Keep < 100MB for fast CDN delivery

**`.next/` / `.open-next/` / `.wrangler/`**
- Purpose: Build artifacts (generated by build pipeline)
- Generated: Yes (at build time)
- Committed: No (.gitignore)
- Rule: Never edit; regenerate via npm run build

**`lib/db/schema/`**
- Purpose: Centralized table definitions for type safety
- Generated: No (hand-written Drizzle)
- Committed: Yes (part of source)
- Rule: One file per logical entity; shared index.ts exports all

**`lib/models/mach/`**
- Purpose: Query builders and domain hydration
- Generated: No
- Committed: Yes (part of source)
- Rule: Query-specific shapes; no generic DAOs; models are query-scoped

---

*Structure analysis: 2026-08-31*
