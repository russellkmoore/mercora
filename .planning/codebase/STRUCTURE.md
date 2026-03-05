# Codebase Structure

**Analysis Date:** 2026-03-05

## Directory Layout

```
mercora/
├── app/                        # Next.js App Router (pages + API routes)
│   ├── layout.tsx              # Root layout (Clerk, fonts, Header/Footer)
│   ├── page.tsx                # Home page (server component)
│   ├── loading.tsx             # Global loading state
│   ├── globals.css             # Global styles (Tailwind)
│   ├── [slug]/                 # Dynamic CMS pages
│   ├── admin/                  # Admin dashboard section
│   │   ├── layout.tsx          # Admin layout (sidebar, guard)
│   │   ├── page.tsx            # Admin dashboard home
│   │   ├── categories/         # Category management
│   │   ├── knowledge/          # Knowledge base / vectorize
│   │   ├── orders/             # Order management
│   │   ├── pages/              # CMS page management
│   │   ├── products/           # Product management
│   │   ├── promotions/         # Promotion management
│   │   ├── reviews/            # Review moderation
│   │   └── settings/           # Site settings
│   ├── api/                    # API route handlers
│   │   ├── admin/              # Admin-only API endpoints
│   │   ├── agent-chat/         # AI agent chat
│   │   ├── analytics/          # Analytics + web vitals
│   │   ├── categories/         # Category CRUD
│   │   ├── mcp/                # MCP server endpoints
│   │   │   ├── route.ts        # MCP root
│   │   │   ├── schema/         # MCP schema discovery
│   │   │   ├── sessions/       # MCP session management
│   │   │   └── tools/          # MCP tool endpoints
│   │   ├── orders/             # Order CRUD + reviews
│   │   ├── pages/              # CMS pages API
│   │   ├── payment-intent/     # Stripe payment intents
│   │   ├── products/           # Product CRUD
│   │   ├── promotions/         # Promotions API
│   │   ├── shipping-options/   # Shipping rates
│   │   ├── tax/                # Tax calculation
│   │   ├── validate-discount/  # Discount validation
│   │   └── webhooks/stripe/    # Stripe webhook handler
│   ├── category/[slug]/        # Category browse pages
│   ├── checkout/               # Checkout flow
│   ├── orders/                 # User order history
│   └── product/[slug]/         # Product detail pages
├── components/                 # Reusable React components
│   ├── admin/                  # Admin-specific components
│   ├── agent/                  # AI agent chat components
│   ├── analytics/              # Web vitals tracking
│   ├── cart/                   # Shopping cart components
│   ├── checkout/               # Checkout flow components
│   ├── login/                  # Login components
│   ├── reviews/                # Review display + forms
│   ├── ui/                     # Shadcn/Radix UI primitives
│   ├── Breadcrumbs.tsx         # Navigation breadcrumbs
│   ├── ClientOnly.tsx          # Client-only render wrapper
│   ├── Footer.tsx              # Site footer
│   ├── Header.tsx              # Site header (server)
│   ├── HeaderClient.tsx        # Header client interactions
│   ├── OrderCard.tsx           # Order display card
│   ├── ProductCard.tsx         # Product display card
│   ├── ProductRecommendations.tsx  # AI-powered recommendations
│   └── PromotionalBanner.tsx   # Promotional banner
├── lib/                        # Core application logic
│   ├── db.ts                   # Database connection (D1 + Drizzle)
│   ├── stripe.ts               # Stripe client/server config
│   ├── utils.ts                # General utilities (cn, formatters)
│   ├── ai/                     # AI/ML integrations
│   │   ├── config.ts           # AI configuration
│   │   └── moderation.ts       # Content moderation
│   ├── auth/                   # Authentication modules
│   │   ├── index.ts            # Auth exports barrel
│   │   ├── admin-middleware.ts  # Admin permission checks
│   │   └── unified-auth.ts     # API token auth (disabled)
│   ├── db/                     # Database layer
│   │   ├── schema/             # Drizzle ORM table definitions
│   │   ├── mach/               # MACH-specific DB utilities
│   │   └── seed-clean/         # Database seeding
│   ├── hooks/                  # Server-side hooks
│   │   └── OrderConfirmation.tsx  # Order confirmation hook
│   ├── mcp/                    # MCP server implementation
│   │   ├── auth.ts             # MCP authentication
│   │   ├── context.ts          # Agent context parsing
│   │   ├── error-handler.ts    # MCP error handling
│   │   ├── session.ts          # MCP session management
│   │   ├── types.ts            # MCP type definitions
│   │   └── tools/              # MCP tool implementations
│   ├── models/                 # Business logic / data access
│   │   ├── index.ts            # Models barrel export
│   │   ├── admin.ts            # Admin user operations
│   │   ├── auth.ts             # API token operations
│   │   ├── cart.ts             # Cart calculations
│   │   ├── order.ts            # Order table + operations
│   │   ├── pages.ts            # CMS page operations
│   │   ├── reviews.ts          # Review CRUD + moderation
│   │   └── mach/               # MACH entity operations
│   │       ├── index.ts        # MACH models barrel
│   │       ├── products.ts     # Product queries
│   │       ├── category.ts     # Category queries
│   │       ├── orders.ts       # MACH order queries
│   │       ├── pricing.ts      # Pricing operations
│   │       ├── inventory.ts    # Inventory operations
│   │       ├── promotions.ts   # Promotion operations
│   │       └── ...             # Other MACH entities
│   ├── stores/                 # Zustand state stores
│   │   ├── cart-store.ts       # Shopping cart state
│   │   ├── chat-store.ts       # Client chat state
│   │   └── server-chat-store.ts  # Server chat state
│   ├── types/                  # TypeScript type definitions
│   │   ├── index.ts            # Types barrel export
│   │   ├── cart.ts             # Cart types
│   │   ├── order.ts            # Order types
│   │   ├── review.ts           # Review types
│   │   ├── billing.ts          # Billing types
│   │   ├── shipping.ts         # Shipping types
│   │   ├── agent.ts            # Agent types
│   │   ├── money.ts            # Money/currency types
│   │   └── mach/               # MACH entity types
│   │       ├── Product.ts      # Product interfaces
│   │       ├── Category.ts     # Category interfaces
│   │       ├── Pricing.ts      # Pricing interfaces
│   │       └── ...             # Other MACH types
│   └── utils/                  # Utility functions
│       ├── email.ts            # Email sending (Resend)
│       ├── r2.ts               # R2 object storage
│       ├── settings.ts         # Site settings access
│       ├── ratings.ts          # Rating calculations
│       ├── review-notifications.ts  # Review email notifications
│       ├── personalized-recommendations.ts  # AI recommendations
│       ├── image-placeholders.ts  # Placeholder images
│       └── performance-tracer.ts  # Performance monitoring
├── hooks/                      # Client-side React hooks
│   ├── useCartPersistence.ts   # Cart localStorage sync
│   ├── useEnhancedUserContext.ts  # Extended user context
│   └── useWebVitals.ts        # Web Vitals reporting
├── emails/                     # React Email templates
├── migrations/                 # D1 SQL migration files
│   ├── 0001_initial_schema.sql # Core commerce tables
│   ├── 0002_add_admin_users.sql
│   ├── 0003_add_cms_pages.sql
│   ├── 0004_add_mcp_tables.sql
│   ├── 0005_add_reviews_tables.sql
│   └── 0006_add_review_reminders.sql
├── data/                       # Static data files
│   ├── d1/                     # D1 seed data
│   └── r2/                     # R2 seed assets
├── docs/                       # Project documentation
├── scripts/                    # CLI utility scripts
├── public/                     # Static public assets
├── mach-standards/             # MACH Alliance reference docs
├── middleware.ts               # Global middleware (auth + maintenance)
├── next.config.ts              # Next.js configuration
├── wrangler.jsonc              # Cloudflare Workers config
├── image-loader.ts             # Custom Next.js image loader (R2)
├── cloudflare-env.d.ts         # Cloudflare env type definitions
├── worker-configuration.d.ts   # Worker config types
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
├── components.json             # Shadcn UI configuration
└── mercora-db-dump.sql         # Database snapshot
```

## Directory Purposes

**`app/`:**
- Purpose: Next.js App Router - all pages and API routes
- Contains: Server Components (default), Client Components (explicit `"use client"`), route handlers (`route.ts`)
- Key files: `layout.tsx` (root layout), `page.tsx` (home), `middleware.ts` (auth)

**`app/admin/`:**
- Purpose: Admin dashboard with separate layout
- Contains: Page files that import co-located client management components (e.g., `page.tsx` imports `ProductManagement.tsx`)
- Key files: `layout.tsx` (admin layout with sidebar + guard)

**`app/api/`:**
- Purpose: REST API endpoints
- Contains: `route.ts` files with GET/POST/PUT/DELETE/PATCH exports
- Key files: `webhooks/stripe/route.ts`, `payment-intent/route.ts`, `mcp/route.ts`

**`components/`:**
- Purpose: Shared React components
- Contains: Layout pieces, domain-specific UI, UI primitives
- Key files: `ProductCard.tsx`, `HeaderClient.tsx`, `OrderCard.tsx`

**`components/ui/`:**
- Purpose: Shadcn UI primitive components (Radix-based)
- Contains: Button, Dialog, Input, Select, Table, etc.
- Key files: All are standalone UI primitives following Shadcn patterns

**`components/admin/`:**
- Purpose: Admin dashboard UI components
- Contains: Layout components (sidebar, header, guard), domain editors (ProductEditor, CategoryPicker)
- Key files: `AdminGuard.tsx`, `AdminSidebar.tsx`, `ProductEditor.tsx`

**`lib/models/`:**
- Purpose: Data access and business logic
- Contains: Functions that query/mutate D1 via Drizzle ORM
- Key files: `index.ts` (barrel), `reviews.ts`, `order.ts`, `mach/products.ts`

**`lib/db/schema/`:**
- Purpose: Drizzle ORM table definitions
- Contains: SQLite table schemas, validation helpers, transformation utilities
- Key files: `index.ts` (barrel), `products.ts`, `order.ts`, `reviews.ts`, `settings.ts`

**`lib/types/`:**
- Purpose: Shared TypeScript interfaces
- Contains: Domain type definitions, API response types
- Key files: `index.ts` (barrel), `mach/Product.ts`, `order.ts`, `review.ts`

**`lib/mcp/`:**
- Purpose: MCP server for AI agent interactions
- Contains: Auth, context parsing, session management, tool implementations
- Key files: `tools/search.ts`, `tools/cart.ts`, `tools/order.ts`

**`migrations/`:**
- Purpose: D1 database migration SQL files
- Contains: Sequential numbered migration scripts
- Key files: `0001_initial_schema.sql` (core tables)

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root layout with ClerkProvider, Header, Footer
- `app/page.tsx`: Home page
- `middleware.ts`: Global middleware (Clerk auth + maintenance mode)
- `next.config.ts`: Next.js + OpenNext Cloudflare configuration

**Configuration:**
- `wrangler.jsonc`: Cloudflare Workers bindings (D1, R2, Vectorize, AI)
- `tsconfig.json`: TypeScript config with `@/*` path alias
- `tailwind.config.ts`: Tailwind CSS configuration
- `components.json`: Shadcn UI component config
- `.eslintrc.json`: ESLint configuration

**Core Logic:**
- `lib/db.ts`: Database connection factory (`getDb()`, `getDbAsync()`)
- `lib/stripe.ts`: Stripe client/server initialization
- `lib/models/index.ts`: All model function exports
- `lib/types/index.ts`: All type exports
- `lib/auth/index.ts`: Auth function exports

**Database:**
- `lib/db/schema/index.ts`: All schema exports
- `lib/db/schema/products.ts`: Product + variant table definitions
- `lib/db/schema/order.ts`: Order table definition
- `lib/db/schema/reviews.ts`: Reviews, media, flags, reminders tables
- `migrations/`: Sequential SQL migration files

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- API Routes: `route.ts` (Next.js convention)
- Components: PascalCase (`ProductCard.tsx`, `AdminGuard.tsx`)
- Models/Logic: snake_case or camelCase (`cart.ts`, `order.ts`, `product_types.ts`)
- Schema: snake_case (`admin_users.ts`, `couponInstance.ts`)
- Types: PascalCase (`Product.ts`, `Category.ts`, `APIResponse.ts`)
- Hooks: camelCase with `use` prefix (`useCartPersistence.ts`, `useWebVitals.ts`)
- Stores: kebab-case (`cart-store.ts`, `chat-store.ts`)
- Utils: kebab-case (`image-placeholders.ts`, `performance-tracer.ts`)

**Directories:**
- Feature-based grouping in `app/` (e.g., `admin/`, `product/`, `checkout/`)
- Domain-based grouping in `lib/` (e.g., `models/`, `types/`, `auth/`)
- `mach/` subdirectory for MACH Alliance-specific code in `lib/models/`, `lib/types/`, `lib/db/`

**Database Tables:**
- snake_case plurals: `products`, `categories`, `product_reviews`, `review_media`

**Route Segments:**
- Dynamic: `[slug]`, `[id]`, `[sessionId]`, `[agentId]`
- Static: lowercase (`admin`, `checkout`, `orders`)

## Where to Add New Code

**New Public Page:**
- Page component: `app/{route-name}/page.tsx` (Server Component)
- Client interactions: `app/{route-name}/{FeatureName}.tsx` (Client Component, co-located)
- If it needs a layout: `app/{route-name}/layout.tsx`

**New Admin Page:**
- Page: `app/admin/{feature}/page.tsx`
- Management component: `app/admin/{feature}/{Feature}Management.tsx`
- Add nav link in `components/admin/AdminSidebar.tsx`

**New API Endpoint:**
- Route handler: `app/api/{resource}/route.ts` (or `app/api/{resource}/[id]/route.ts`)
- Admin-only endpoint: `app/api/admin/{resource}/route.ts`
- Use `lib/auth/admin-middleware.ts` `checkAdminPermissions()` for admin APIs

**New Database Table:**
- Schema: `lib/db/schema/{table_name}.ts`
- Export from: `lib/db/schema/index.ts`
- Migration: `migrations/{NNNN}_{description}.sql`

**New Model (Business Logic):**
- MACH entity: `lib/models/mach/{entity}.ts`
- App-specific: `lib/models/{entity}.ts`
- Export from: `lib/models/index.ts`

**New Type Definition:**
- MACH type: `lib/types/mach/{Entity}.ts`
- App-specific: `lib/types/{entity}.ts`
- Export from: `lib/types/index.ts`

**New Reusable Component:**
- Domain component: `components/{feature}/{ComponentName}.tsx`
- Shared component: `components/{ComponentName}.tsx`
- UI primitive: `components/ui/{component-name}.tsx` (use Shadcn CLI)

**New Client-Side Hook:**
- Location: `hooks/use{HookName}.ts`

**New Utility Function:**
- Location: `lib/utils/{utility-name}.ts`
- General helpers: `lib/utils.ts` (cn, formatters)

**New MCP Tool:**
- Tool implementation: `lib/mcp/tools/{tool-name}.ts`
- API route: `app/api/mcp/tools/{tool-name}/route.ts`

**New Zustand Store:**
- Location: `lib/stores/{store-name}.ts`

## Special Directories

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No

**`.open-next/`:**
- Purpose: OpenNext build output for Cloudflare deployment
- Generated: Yes (by `opennextjs-cloudflare build`)
- Committed: No

**`.wrangler/`:**
- Purpose: Wrangler local development state (D1, R2, cache)
- Generated: Yes
- Committed: No

**`mach-standards/`:**
- Purpose: Reference documentation for MACH Alliance data model
- Generated: No
- Committed: Yes

**`data/`:**
- Purpose: Seed data for D1 database and R2 bucket
- Generated: No
- Committed: Yes

**`docs/`:**
- Purpose: Project documentation (architecture, API specs, roadmap)
- Generated: No
- Committed: Yes

**`public/`:**
- Purpose: Static assets served at root URL
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-05*
