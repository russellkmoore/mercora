# Architecture

**Analysis Date:** 2026-03-05

## Pattern Overview

**Overall:** Next.js App Router full-stack monolith deployed to Cloudflare Workers via OpenNext

**Key Characteristics:**
- Server Components by default with explicit Client Components where needed
- MACH Alliance-aligned data model for commerce entities (products, categories, pricing, inventory)
- Cloudflare-native infrastructure: D1 (SQLite), R2 (object storage), Vectorize (AI search), Workers AI
- Drizzle ORM with schema definitions co-located in `lib/db/schema/`
- Zustand for client-side state (cart), no server state management library
- MCP (Model Context Protocol) server embedded as API routes for multi-agent commerce

## Layers

**Presentation Layer (App Router Pages):**
- Purpose: Server-rendered pages and client interactive components
- Location: `app/`
- Contains: Page components (server), co-located client components (e.g., `ProductDisplay.tsx`, `CategoryDisplay.tsx`, `PageRenderer.tsx`)
- Depends on: Models layer, Components layer
- Used by: End users via browser

**Components Layer:**
- Purpose: Reusable UI components shared across pages
- Location: `components/`
- Contains: Layout components (`Header.tsx`, `Footer.tsx`), domain components (`ProductCard.tsx`, `OrderCard.tsx`), admin components (`components/admin/`), UI primitives (`components/ui/`)
- Depends on: Types, Stores, Hooks
- Used by: Presentation layer

**API Layer:**
- Purpose: REST API endpoints for client-server communication and external integrations
- Location: `app/api/`
- Contains: Route handlers using Next.js `route.ts` convention
- Depends on: Models layer, Auth layer
- Used by: Client components (fetch), MCP agents, Stripe webhooks

**Models Layer:**
- Purpose: Business logic and database operations
- Location: `lib/models/`
- Contains: Domain operations grouped by entity (products, orders, reviews, cart, pages, admin, auth)
- Depends on: Database layer (`lib/db.ts`), Schema layer, Types layer
- Used by: API layer, Presentation layer (Server Components)

**Schema Layer (Drizzle ORM):**
- Purpose: Database table definitions and schema-level utilities
- Location: `lib/db/schema/`
- Contains: Table definitions, validation helpers, transformation functions
- Depends on: Drizzle ORM
- Used by: Models layer, Database connection (`lib/db.ts`)

**Types Layer:**
- Purpose: Shared TypeScript interfaces and type definitions
- Location: `lib/types/`
- Contains: Domain types organized by MACH entity plus app-specific types (cart, order, review, billing, shipping)
- Depends on: Nothing
- Used by: All layers

**MCP Layer:**
- Purpose: Model Context Protocol server for AI agent commerce interactions
- Location: `lib/mcp/` and `app/api/mcp/`
- Contains: Tool implementations (search, cart, order, payment, shipping, recommend, assess), session management, auth, error handling
- Depends on: Models layer, Auth layer
- Used by: External AI agents

**Auth Layer:**
- Purpose: Authentication and authorization
- Location: `lib/auth/`, `middleware.ts`
- Contains: Clerk integration (user auth), API token auth (`unified-auth.ts`), admin permission checks (`admin-middleware.ts`)
- Depends on: Clerk SDK, Models layer (admin users, API tokens)
- Used by: Middleware, API routes, Admin pages

**Utilities Layer:**
- Purpose: Cross-cutting helper functions
- Location: `lib/utils/`, `lib/utils.ts`
- Contains: Email (`email.ts`), R2 storage (`r2.ts`), settings (`settings.ts`), ratings (`ratings.ts`), image placeholders, performance tracing, review notifications, personalized recommendations
- Depends on: Database layer, external services (Resend, R2)
- Used by: Models layer, API layer

## Data Flow

**Product Browse Flow:**
1. Server Component page (`app/product/[slug]/page.tsx`) extracts slug from URL params
2. Calls `getProductBySlug()` from `lib/models/mach/products.ts`
3. Model function calls `getDb()` -> queries D1 via Drizzle ORM
4. Product data deserialized from DB row format to MACH-compliant `Product` type
5. Data passed as props to `ProductDisplay` client component for interactive rendering

**Checkout Flow:**
1. Cart state managed client-side in Zustand store (`lib/stores/cart-store.ts`) persisted to localStorage
2. `app/checkout/page.tsx` renders `CheckoutClient` dynamically (no SSR) with auth context from Clerk
3. Client component calls API routes: `/api/shipping-options`, `/api/tax`, `/api/validate-discount`
4. Payment processed via `/api/payment-intent` -> Stripe server SDK (`lib/stripe.ts`)
5. Order created via `/api/orders` -> `lib/models/order.ts` -> D1 database
6. Stripe webhook (`app/api/webhooks/stripe/route.ts`) confirms payment asynchronously

**Admin Flow:**
1. `app/admin/layout.tsx` wraps all admin pages with `AdminGuard` (checks Clerk auth + admin role via `lib/auth/admin-middleware.ts`)
2. Admin pages use client-side management components (e.g., `ProductManagement.tsx`, `CategoryManagement.tsx`)
3. Management components call admin API routes (`app/api/admin/*`)
4. Admin API routes verify admin permissions then call Models layer

**MCP Agent Flow:**
1. External agent sends request to `/api/mcp/tools/*` with `X-Agent-Context` header
2. Context parsed by `lib/mcp/context.ts`, auth checked by `lib/mcp/auth.ts`
3. Tool-specific handler (`lib/mcp/tools/*.ts`) processes request
4. Handler calls Models layer for data access, returns structured response
5. Session state tracked in `lib/mcp/session.ts` for multi-turn conversations

**State Management:**
- **Server state**: No caching layer beyond React `cache()` in `lib/db.ts` for request-level deduplication
- **Client state**: Zustand store for cart (`lib/stores/cart-store.ts`), chat state (`lib/stores/chat-store.ts`, `server-chat-store.ts`)
- **Persistence**: Cart persisted to localStorage; all other state in D1 database
- **Revalidation**: Per-page `revalidate` exports (e.g., homepage = 3600s, product page = 0)

## Key Abstractions

**MACH Commerce Entities:**
- Purpose: Standardized e-commerce data model following MACH Alliance patterns
- Examples: `lib/db/schema/products.ts`, `lib/db/schema/category.ts`, `lib/db/schema/pricing.ts`, `lib/db/schema/inventory.ts`
- Pattern: Each entity has a schema file (Drizzle table def), a model file (business logic), and a types file (TypeScript interfaces)
- Sub-paths use `mach/` prefix: `lib/models/mach/`, `lib/types/mach/`, `lib/db/mach/`

**Database Access:**
- Purpose: Cloudflare D1 connection with Drizzle ORM
- Examples: `lib/db.ts`
- Pattern: Two access functions - `getDb()` (sync, Server Components) and `getDbAsync()` (async, API routes). Both use React `cache()` for request-level memoization.

**Admin Guard:**
- Purpose: Protects admin routes with multi-layer auth
- Examples: `components/admin/AdminGuard.tsx`, `lib/auth/admin-middleware.ts`
- Pattern: Clerk session check -> admin_users table lookup -> permission grant. Dev bypass available via `x-dev-admin` header.

**API Response Format:**
- Purpose: Consistent API response structure
- Examples: `app/api/products/route.ts`
- Pattern: `{ data: T, meta: { total, limit, offset, schema }, links: { self, next, prev } }`

## Entry Points

**Web Application:**
- Location: `app/layout.tsx`
- Triggers: Browser requests
- Responsibilities: ClerkProvider wrapping, font loading, global layout (Header/Footer/Toaster), WebVitals monitoring

**Middleware:**
- Location: `middleware.ts`
- Triggers: Every non-static request
- Responsibilities: Clerk auth, maintenance mode check (reads settings from DB), static asset bypass

**API Routes:**
- Location: `app/api/*/route.ts`
- Triggers: Client fetch calls, webhooks, MCP agents
- Responsibilities: Request validation, auth checks, calling Models layer, response formatting

**Cloudflare Worker:**
- Location: `.open-next/worker.js` (built artifact)
- Triggers: Cloudflare Workers runtime
- Responsibilities: Serving the Next.js app on Cloudflare edge via OpenNext adapter

## Error Handling

**Strategy:** Try-catch at API route level with console.error logging, generic error responses to clients

**Patterns:**
- API routes return `{ error: string }` with appropriate HTTP status codes
- Server Components use Next.js `notFound()` for missing resources
- Middleware catches settings check failures silently to avoid breaking the site
- MCP layer has dedicated error handler (`lib/mcp/error-handler.ts`)
- Stripe webhook verifies signatures and returns 400 for invalid requests

## Cross-Cutting Concerns

**Logging:** `console.log`/`console.error` throughout. No structured logging framework. Performance tracer in `lib/utils/performance-tracer.ts`.

**Validation:** Ad-hoc validation in API route handlers and model functions. Schema-level validation helpers in `lib/db/schema/` (e.g., `validateProductType`, `validateAttributeValue`). No validation library (no Zod/Yup).

**Authentication:** Dual auth system:
- User auth: Clerk (`@clerk/nextjs`) for browser sessions, checked in middleware and Server Components
- API auth: Token-based via `lib/auth/unified-auth.ts` (currently disabled for development)
- Admin auth: Clerk + admin_users table via `lib/auth/admin-middleware.ts`

**Image Handling:** Custom image loader (`image-loader.ts`) for Cloudflare R2 integration. Image uploads via `app/api/admin/upload-image/route.ts` -> `lib/utils/r2.ts`.

**Email:** React Email templates (`emails/`) rendered and sent via Resend (`lib/utils/email.ts`). Used for review reminders and status notifications.

**AI/ML:** Cloudflare Workers AI binding for content moderation (`lib/ai/moderation.ts`), product description generation (`app/api/admin/generate-product-description/route.ts`), article generation, and vectorize-based search/recommendations (`lib/utils/personalized-recommendations.ts`).

---

*Architecture analysis: 2026-03-05*
