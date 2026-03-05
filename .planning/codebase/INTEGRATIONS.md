# External Integrations

**Analysis Date:** 2026-03-05

## APIs & External Services

**Payments - Stripe:**
- Payment processing, tax calculation, webhook events
- SDK/Client: `stripe` v18.4.0 (server), `@stripe/stripe-js` v7.8.0 (client), `@stripe/react-stripe-js` v3.9.0
- Server client: `lib/stripe.ts` - dual implementation (standard Stripe SDK + custom `CloudflareStripe` fetch-based client for Workers)
- Config: `lib/stripe.ts` exports `stripeConfig`, `stripeTaxConfig`, currency helpers
- Stripe API version: `2025-08-27.basil` (standard SDK), `2020-08-27` (CloudflareStripe fallback)
- Auth env vars: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

**Authentication - Clerk:**
- User authentication, session management, identity
- SDK/Client: `@clerk/nextjs` v6.25.5
- Middleware integration: `middleware.ts` uses `clerkMiddleware()` for all routes
- Admin auth: `lib/auth/admin-middleware.ts` combines Clerk session with DB admin check
- API auth: `lib/auth/unified-auth.ts` (token-based, currently disabled for dev)
- Auth env var: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Admin check flow: Clerk userId -> `lib/models/admin.ts` `isUserAdmin()` -> DB lookup

**Email - Resend:**
- Transactional email delivery (order confirmations, review notifications)
- SDK/Client: `resend` v4.8.0
- Client factory: `lib/utils/email.ts` `getResendClient()`
- Templates: `emails/OrderConfirmation.tsx` (React Email)
- Notifications: `lib/utils/review-notifications.ts`
- Auth env var: `RESEND_API_KEY`

**AI - Cloudflare Workers AI:**
- Text generation and embeddings (no external API; runs on Cloudflare edge)
- Binding: `env.AI` (type `Ai` from Workers types)
- Config: `lib/ai/config.ts` - centralized model configuration
- Text model: `@cf/openai/gpt-oss-20b` (primary for chat, analytics, content, moderation)
- Embedding model: `@cf/baai/bge-base-en-v1.5` (semantic search)
- Use cases: Chat assistant (`app/api/agent-chat/route.ts`), content moderation (`lib/ai/moderation.ts`), analytics, marketing content generation
- Helper: `runAI()` and `extractAIResponse()` in `lib/ai/config.ts` handle model-specific parameter formats

## Data Storage

**Primary Database - Cloudflare D1 (SQLite):**
- Binding: `DB` (type `D1Database`)
- Database name: `mercora-db`
- ORM: Drizzle ORM with SQLite dialect (`drizzle-orm/d1`, `drizzle-orm/sqlite-core`)
- Connection: `lib/db.ts` provides `getDb()` (sync, React cached) and `getDbAsync()` (async)
- Schema: `lib/db/schema/` - 18 schema files covering products, orders, customers, categories, inventory, pricing, promotions, media, addresses, languages, settings, admin users, pages/CMS, MCP sessions, reviews
- Migrations: `migrations/` (6 SQL migrations: initial schema, admin users, CMS pages, MCP tables, reviews, review reminders)
- Migration tool: Drizzle Kit (`drizzle-kit` v0.31.4)

**Object Storage - Cloudflare R2:**
- Binding: `MEDIA` (type `R2Bucket`, bucket: `voltique-images`) - Product/category images
- Binding: `NEXT_INC_CACHE_R2_BUCKET` (same bucket) - Next.js incremental static regeneration cache
- Static data files: `data/r2/` directory contains local seed data for categories, products, knowledge base markdown

**Vector Search - Cloudflare Vectorize:**
- Binding: `VECTORIZE` (type `VectorizeIndex`, index: `voltique-index`)
- Used for: Semantic product search, knowledge base search, content moderation pattern matching
- Embedding model: `@cf/baai/bge-base-en-v1.5` via Workers AI
- Moderation namespace: `moderation` in `lib/ai/moderation.ts` stores harmful content pattern vectors
- Vectorize APIs: `app/api/vectorize-products/`, `app/api/vectorize-knowledge/`

**Caching:**
- R2-backed Next.js incremental cache (`open-next.config.ts` configures `r2IncrementalCache`)
- React `cache()` for request-level DB connection memoization (`lib/db.ts`)

## Authentication & Identity

**Auth Provider - Clerk:**
- Implementation: Middleware-level auth via `clerkMiddleware()` in `middleware.ts`
- Admin auth: `lib/auth/admin-middleware.ts` `checkAdminPermissions()` - multi-layer:
  1. Dev bypass token (`x-dev-admin: mercora-dev-bypass` header, dev only)
  2. API Bearer token (compared against `ADMIN_VECTORIZE_TOKEN` env var)
  3. Clerk session -> DB admin user lookup (`lib/models/admin.ts`)
  4. Clerk session claims metadata fallback (`role === "admin"`)
- API token auth: `lib/auth/unified-auth.ts` defines permission system (vectorize, orders, webhooks, admin scopes) - currently bypassed in dev
- Token management: `scripts/manage-tokens.ts` for API token CRUD

## Monitoring & Observability

**Error Tracking:**
- Console-based error logging (no external error tracking service detected)

**Logs:**
- `console.log` / `console.error` throughout application code
- Cloudflare Workers observability enabled (`wrangler.jsonc`: `"observability": { "enabled": true }`)

**Performance:**
- Web Vitals tracking via `web-vitals` package
- Vitals API: `app/api/analytics/vitals/route.ts`

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers (via OpenNext adapter)

**CI Pipeline:**
- `.github/workflows/` directory exists but is empty

**Deployment:**
```bash
npm run deploy   # rm -rf artifacts -> opennextjs-cloudflare build -> deploy
npm run preview  # Local Cloudflare Workers preview
```

## MCP Server (Model Context Protocol)

**Purpose:** Exposes commerce operations as tool endpoints for AI agents

**Schema endpoint:** `app/api/mcp/schema/route.ts`
**Session management:** `app/api/mcp/sessions/route.ts`, `app/api/mcp/sessions/[sessionId]/route.ts`

**Tool endpoints:**
- Search: `app/api/mcp/tools/search/route.ts`
- Recommend: `app/api/mcp/tools/recommend/route.ts`
- Cart operations: `app/api/mcp/tools/cart/{add,remove,update,clear,bulk-add,estimate}/route.ts`
- Order operations: `app/api/mcp/tools/order/{place,status,track}/route.ts`
- Shipping: `app/api/mcp/tools/shipping/route.ts`
- Payment validation: `app/api/mcp/tools/payment/validate/route.ts`
- Product assessment: `app/api/mcp/tools/assess/route.ts`
- Agent management: `app/api/mcp/tools/agents/{create,list,[agentId]}/route.ts`

**Tool implementations:** `lib/mcp/tools/` (search, cart, order, recommend, shipping, payment, assess, agent)
**Supporting modules:** `lib/mcp/auth.ts`, `lib/mcp/context.ts`, `lib/mcp/session.ts`, `lib/mcp/error-handler.ts`, `lib/mcp/types.ts`

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk auth (public, also in wrangler.jsonc vars)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe client-side (public, also in wrangler.jsonc vars)
- `STRIPE_SECRET_KEY` - Stripe server-side (secret)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook verification (secret)
- `RESEND_API_KEY` - Email sending (secret)

**Cloudflare bindings (not env vars):**
- `DB` - D1 database
- `MEDIA` - R2 bucket for images
- `NEXT_INC_CACHE_R2_BUCKET` - R2 bucket for ISR cache
- `VECTORIZE` - Vectorize index
- `AI` - Workers AI inference
- `ASSETS` - Static asset serving

**Secrets location:**
- Local development: `.env.local` (gitignored)
- Production: Cloudflare Workers secrets (`wrangler secret put`)
- Public vars: `wrangler.jsonc` `vars` block

## Webhooks & Callbacks

**Incoming:**
- Stripe webhook: `app/api/webhooks/stripe/route.ts`
  - Events handled: `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`, `invoice.payment_succeeded`
  - Signature verification via `STRIPE_WEBHOOK_SECRET`
  - On payment success: updates order status to `processing` via internal API call

**Outgoing:**
- None detected

---

*Integration audit: 2026-03-05*
