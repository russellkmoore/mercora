# Codebase Concerns

**Analysis Date:** 2026-03-05

## Tech Debt

**Authentication Completely Disabled for API Token Auth:**
- Issue: `authenticateRequest()` in `lib/auth/unified-auth.ts` is hardcoded to always return `success: true` with full `admin:*` permissions. Every call to this function is a no-op. The function logs a warning but provides zero protection.
- Files: `lib/auth/unified-auth.ts`, `app/api/orders/route.ts`, `app/api/orders/refund/route.ts`
- Impact: Any unauthenticated request to order management endpoints (GET with `?admin`, PUT status updates, refunds) passes through with full admin permissions. The Stripe webhook handler at `app/api/webhooks/stripe/route.ts` uses `STRIPE_WEBHOOK_SECRET` as an `X-API-Key` header to call the orders API internally -- but since auth is disabled, this is moot.
- Fix approach: Re-implement the `authenticateRequest()` function to actually validate API tokens against a tokens table. Verify tokens have correct permissions before returning success.

**Dev-Mode Admin Bypass in Production-Adjacent Code:**
- Issue: `lib/auth/admin-middleware.ts` grants admin access to ANY authenticated Clerk user when `NODE_ENV === "development"` (line 46). It also accepts a hardcoded bypass token `"mercora-dev-bypass"` via header or query param (line 18). While gated on `NODE_ENV`, this is fragile.
- Files: `lib/auth/admin-middleware.ts`
- Impact: If `NODE_ENV` is ever misconfigured or if this code pattern is copied, all authenticated users get admin access. The hardcoded bypass token is a security smell.
- Fix approach: Remove the dev bypass token entirely. For development, seed an admin user instead. Remove the blanket dev-mode admin grant and use the database-backed `isUserAdmin()` check in all environments.

**Unprotected Public CRUD API Routes:**
- Issue: Multiple API routes that perform write operations (POST, PUT, DELETE) have zero authentication checks. Anyone can create, update, or delete products, categories, and promotions.
- Files:
  - `app/api/products/route.ts` - POST (create product) has no auth
  - `app/api/products/[id]/route.ts` - PUT (update) and DELETE have no auth
  - `app/api/categories/route.ts` - POST (create category) has no auth
  - `app/api/categories/[id]/route.ts` - PUT and DELETE have no auth
  - `app/api/promotions/route.ts` - POST, PUT, DELETE have no auth
  - `app/api/payment-intent/route.ts` - POST (create Stripe payment intent) has no auth
- Impact: Critical data manipulation endpoints are publicly accessible. An attacker could delete all products, create fraudulent promotions, or generate arbitrary Stripe payment intents.
- Fix approach: Add `checkAdminPermissions()` to all write endpoints on these routes. For `payment-intent`, require Clerk user authentication at minimum.

**Dual Order Model Systems:**
- Issue: Two separate order systems coexist. `lib/models/order.ts` defines its own `orders` table schema (with `nanoid` IDs like `ORD-XXXXXXXX`), while `lib/db/schema/order.ts` + `lib/models/mach/orders.ts` define a MACH-compliant order system (with timestamp-based IDs). The main `app/api/orders/route.ts` imports from BOTH systems simultaneously.
- Files: `lib/models/order.ts`, `lib/models/mach/orders.ts`, `lib/db/schema/order.ts`, `app/api/orders/route.ts` (lines 21-24)
- Impact: Confusing dual imports, potential for data inconsistency. The legacy `order.ts` model re-declares the `orders` table which may conflict with the schema export.
- Fix approach: Complete the MACH migration. Remove `lib/models/order.ts` and consolidate all order operations through `lib/models/mach/orders.ts`.

**Pervasive `as any` Type Casting:**
- Issue: Over 40 instances of `as any` type casting across the codebase, particularly in admin components and API routes. This defeats TypeScript's type safety.
- Files (worst offenders):
  - `app/admin/categories/CategoryManagement.tsx` - 7 instances
  - `app/admin/knowledge/KnowledgeManagement.tsx` - 4 instances
  - `app/api/promotions/route.ts` - 6 instances (casting promotion fields)
  - `app/api/payment-intent/route.ts` - 2 instances (casting Stripe response)
  - `app/api/agent-chat/route.ts` - `(env as any).AI`, `(env as any).VECTORIZE`
  - `app/api/admin/analytics/route.ts` - `(env as any).AI`
  - `app/api/admin/knowledge/route.ts` - `(env as any).MEDIA`
  - `app/api/orders/refund/route.ts` - `stripe as any`
- Impact: Runtime type errors go undetected. Stripe response types are not properly typed, which could cause silent failures.
- Fix approach: Define proper TypeScript interfaces for Cloudflare bindings (AI, VECTORIZE, MEDIA) in the environment types. Use Stripe's built-in types properly instead of casting. Fix promotion type mismatches at the model layer.

**Incomplete Stripe Webhook Handlers:**
- Issue: Several webhook event handlers are stubs that only log to console without performing actual operations.
- Files: `app/api/webhooks/stripe/route.ts`
  - `handlePaymentFailed()` (line 155): Logs but does not update order status. Has `TODO: Implement order status update`.
  - `handleCheckoutCompleted()` (line 184): Logs but takes no action.
  - `handleInvoicePaymentSucceeded()` (line 212): Logs but takes no action.
- Impact: Failed payments do not update order status. Checkout completions are not tracked. Invoice payments are not processed.
- Fix approach: Implement actual order status updates in each handler. Use the same internal fetch pattern used in `handlePaymentSucceeded()`.

**TODO Items Indicating Missing Features:**
- Issue: Several TODO comments mark unimplemented functionality.
- Files:
  - `lib/hooks/useEnhancedUserContext.ts:140` - `favoriteCategories` always returns empty array
  - `app/api/orders/route.ts:372` - Webhook audit trail not re-implemented after MACH migration
- Impact: User personalization features are incomplete. Order audit trail is missing.
- Fix approach: Implement category mapping for favorites. Re-implement webhook logging using the MACH orders model.

**`force-dynamic` on Root Layout:**
- Issue: `app/layout.tsx` exports `const dynamic = "force-dynamic"`, which disables static generation for the entire application.
- Files: `app/layout.tsx:43`
- Impact: Every page is server-rendered on every request, even pages that could be statically generated. This increases Cloudflare Workers invocations and response latency.
- Fix approach: Remove `force-dynamic` from the root layout. Apply it selectively only to pages that require dynamic rendering (e.g., pages using `auth()`). Static pages like product listings and CMS pages should use ISR with `revalidate`.

## Security Considerations

**XSS via Maintenance Mode Message:**
- Risk: The maintenance mode page in `middleware.ts` (line 148) interpolates `${maintenanceMessage}` directly into raw HTML without sanitization. The message comes from the database settings.
- Files: `middleware.ts:148`
- Current mitigation: Only admins can set the maintenance message via settings API.
- Recommendations: HTML-escape the maintenance message before interpolation. Use a template that does not allow HTML injection.

**XSS via CMS Page Content:**
- Risk: `app/[slug]/PageRenderer.tsx:135` uses `dangerouslySetInnerHTML={{ __html: page.content }}` to render CMS page content. If admin accounts are compromised, arbitrary JS can be injected.
- Files: `app/[slug]/PageRenderer.tsx:135`, `app/admin/page.tsx:455`
- Current mitigation: Only admins can create/edit pages.
- Recommendations: Sanitize HTML content server-side before storage using a library like DOMPurify. Implement a Content Security Policy (CSP) header.

**Custom CSS/JS Injection in CMS Pages:**
- Risk: `PageRenderer.tsx` injects arbitrary custom CSS and JavaScript from page records directly into the DOM via `document.createElement('style')` and potentially script elements.
- Files: `app/[slug]/PageRenderer.tsx:22-28`
- Current mitigation: Admin-only page editing.
- Recommendations: Restrict custom CSS to a whitelist of properties. Remove custom JS injection entirely or sandbox it.

**Webhook Handler Calls Own API via Public URL:**
- Risk: `app/api/webhooks/stripe/route.ts:119` makes an HTTP fetch to its own `/api/orders` endpoint using `process.env.NEXT_PUBLIC_URL`. This creates a circular dependency through the public internet and uses the webhook secret as an API key (which is a misuse of the secret).
- Files: `app/api/webhooks/stripe/route.ts:119-131`
- Current mitigation: None.
- Recommendations: Call order update functions directly instead of making HTTP requests to own API. Import `updateOrderStatus` from `lib/models/mach/orders.ts` and call it directly.

**No Rate Limiting on Public APIs:**
- Risk: Public-facing API routes (products, categories, payment-intent, agent-chat, tax) have no rate limiting. The MCP API has rate limiting, but the rest of the application does not.
- Files: All routes under `app/api/` except `app/api/mcp/`
- Current mitigation: Cloudflare Workers has some built-in DDoS protection.
- Recommendations: Implement rate limiting middleware for sensitive endpoints, especially `payment-intent`, `agent-chat`, and `submit-order`.

**Admin Token Accepted via Query Parameter:**
- Risk: `lib/auth/admin-middleware.ts:26` accepts auth tokens via `request.nextUrl.searchParams.get("token")`, which means tokens appear in URLs, browser history, and server logs.
- Files: `lib/auth/admin-middleware.ts:24-26`
- Current mitigation: None.
- Recommendations: Remove query parameter token acceptance. Accept tokens only via `Authorization` header.

## Performance Bottlenecks

**Global `force-dynamic` Rendering:**
- Problem: Every page in the application is dynamically rendered due to `export const dynamic = "force-dynamic"` in `app/layout.tsx`.
- Files: `app/layout.tsx:43`
- Cause: This was likely added to ensure Clerk auth context is available everywhere, but it prevents any static optimization.
- Improvement path: Remove from root layout. Use `force-dynamic` only on pages that need auth. Use ISR (`revalidate`) for product and category pages. The homepage already has `export const revalidate = 3600` but it is overridden by the root layout's `force-dynamic`.

**Large Admin Components:**
- Problem: Several admin components exceed 800+ lines, creating large client-side bundles.
- Files:
  - `components/admin/ProductEditor.tsx` - 1645 lines
  - `app/admin/settings/page.tsx` - 1135 lines
  - `app/admin/categories/CategoryManagement.tsx` - 1066 lines
  - `app/admin/pages/PageManagement.tsx` - 975 lines
  - `app/admin/orders/[id]/page.tsx` - 952 lines
  - `app/admin/promotions/PromotionManagement.tsx` - 843 lines
  - `app/admin/orders/page.tsx` - 842 lines
  - `components/admin/reviews/ReviewModerationDashboard.tsx` - 777 lines
- Cause: Monolithic component design without extraction of sub-components.
- Improvement path: Break into smaller sub-components. Use dynamic imports for admin pages since they are not on the critical user path.

**Product Page Caching Disabled:**
- Problem: `app/product/[slug]/page.tsx` sets `export const revalidate = 0`, meaning product pages are never cached.
- Files: `app/product/[slug]/page.tsx:48`
- Cause: Likely disabled to ensure review counts are always fresh.
- Improvement path: Use ISR with a short revalidate period (e.g., 60 seconds) or use client-side fetching for dynamic data like reviews.

## Fragile Areas

**Database Connection via Cloudflare Context:**
- Files: `lib/db.ts`
- Why fragile: Every database operation depends on `getCloudflareContext()`, which is only available in the Cloudflare Workers runtime. This makes local development, testing, and migration scripts difficult. The `cache()` wrapper from React only works in React Server Component contexts.
- Safe modification: Always use `getDbAsync()` in API routes (async context) and `getDb()` in Server Components. Never call these functions in client components or build-time scripts.
- Test coverage: No test files exist in the entire codebase.

**Middleware Settings Check:**
- Files: `middleware.ts:80-83`
- Why fragile: The middleware makes a database call (`getSettings('system')`) on every non-static request to check maintenance mode. If the database is slow or unavailable, it catches the error and continues (line 164-167), but this adds latency to every request.
- Safe modification: Consider caching the maintenance mode setting with a TTL rather than checking on every request.
- Test coverage: None.

**Dual Schema Exports:**
- Files: `lib/db/schema/index.ts`, `lib/models/order.ts`
- Why fragile: `lib/models/order.ts` re-declares `orders` as a `sqliteTable` (line 13) which may conflict with `lib/db/schema/order.ts` exports. The schema index barrel file at `lib/db/schema/index.ts` uses `export *` which makes naming collisions silent.
- Safe modification: When modifying order-related code, verify which `orders` import is being used. Check both `lib/db/schema/order.ts` and `lib/models/order.ts`.
- Test coverage: None.

## Test Coverage Gaps

**No Tests Exist:**
- What's not tested: The entire application. No test files, no test framework configured, no test scripts in `package.json`.
- Files: All files under `app/`, `lib/`, `components/`
- Risk: Any change can break existing functionality with no automated detection. Refactoring is high-risk. The order processing flow, payment handling, and webhook processing are all untested.
- Priority: High - At minimum, add integration tests for:
  1. Order creation and status update flow (`app/api/orders/route.ts`)
  2. Payment intent creation (`app/api/payment-intent/route.ts`)
  3. Stripe webhook handling (`app/api/webhooks/stripe/route.ts`)
  4. Admin authentication (`lib/auth/admin-middleware.ts`)
  5. Product CRUD operations (`lib/models/mach/products.ts`)

## Dependencies at Risk

**Cloudflare Platform Lock-in:**
- Risk: Deep dependency on Cloudflare-specific APIs (D1, R2, AI, Vectorize, Workers). Every database call, file upload, AI inference, and search operation uses Cloudflare bindings accessed via `(env as any).AI`, `(env as any).VECTORIZE`, `(env as any).MEDIA`.
- Impact: Cannot migrate to another hosting provider without rewriting all data access, storage, AI, and search layers.
- Migration plan: Not actionable in the short term. Accept as architectural decision. Ensure Cloudflare bindings are accessed through abstraction layers rather than directly in route handlers.

**OpenNext for Cloudflare:**
- Risk: `@opennextjs/cloudflare` (v1.5.1) bridges Next.js 15 to Cloudflare Workers. This is a community-maintained adapter with potential compatibility gaps during Next.js major updates.
- Impact: Next.js version upgrades may be blocked by OpenNext compatibility.
- Migration plan: Monitor OpenNext release cycles. Pin Next.js versions until OpenNext compatibility is confirmed.

## Missing Critical Features

**No Input Validation Library:**
- Problem: API routes parse request bodies with `await request.json() as any` or `await request.json() as SomeType` without runtime validation. TypeScript type assertions provide no runtime safety.
- Blocks: Proper request validation, clear error messages for malformed input, protection against unexpected data shapes.
- Files: Most API routes under `app/api/`
- Recommendation: Adopt Zod for runtime schema validation on all API request bodies.

**No Structured Logging:**
- Problem: All logging uses `console.log`, `console.error`, and `console.warn` with inconsistent formatting. Some logs include emoji prefixes. No log levels, no structured data, no correlation IDs.
- Files: 101 `console.log/error/warn` calls across 30 API route files.
- Blocks: Production debugging, log aggregation, request tracing.
- Recommendation: Implement a lightweight structured logger that outputs JSON with request IDs, timestamps, and log levels.

---

*Concerns audit: 2026-03-05*
