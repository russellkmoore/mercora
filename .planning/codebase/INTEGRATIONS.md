# External Integrations

**Analysis Date:** 2026-08-31

## APIs & External Services

**Payment Processing:**
- Stripe - Complete payment platform for checkouts, subscriptions, refunds, and tax calculation
  - SDK/Client: `stripe` (22.5.0) for server-side, `@stripe/stripe-js` (9.13.0) + `@stripe/react-stripe-js` (6.8.1) for client
  - Auth: `STRIPE_SECRET_KEY` (server secret), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (public, test key)
  - Implementation: `lib/stripe.ts` for configuration and utilities
  - Webhook handling: `app/api/webhooks/stripe/route.ts` for event processing (payment_intent, invoice, refund events)
  - Usage: Payment intents, setup intents, subscriptions, tax calculation, refunds

**Authentication & Identity:**
- Clerk - User authentication and identity management
  - SDK/Client: `@clerk/nextjs` (7.7.6), `@clerk/themes` (2.4.57)
  - Auth: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (public, test key), `CLERK_SECRET_KEY` (server secret)
  - Implementation: ClerkProvider wraps app in `app/layout.tsx`, server auth via `@clerk/nextjs/server` in routes
  - Usage: User authentication, session management, user ID retrieval for orders and profiles
  - Server-side auth: `app/product/[slug]/page.tsx`, `app/checkout/page.tsx`, API routes

## Data Storage

**Databases:**
- Cloudflare D1 - SQLite database at the edge
  - Connection: `DB` binding in `wrangler.jsonc`
  - Database ID: a27c0044-672d-4355-aa47-4410746f45f9
  - Database name: mercora-db
  - Client: Drizzle ORM (`drizzle-orm` 0.45.2)
  - Schema location: `lib/db/schema/` with tables:
    - Orders, Order Events, Order Effects
    - Products, Inventory, Inventory Adjustments
    - Categories, Pages, Blog
    - Customers, Addresses
    - Gift Cards
    - Coupons, Promotions
    - Email Deliveries, Email Preferences, Subscriptions
    - Analytics, Language, Media
    - MCP (Management Control Panel)
    - Admin Users
  - Migrations: Located in `lib/db/migrations/` (auto-applied on deploy)
  - Access pattern: `lib/db.ts` provides `getDb()` and `getDbAsync()` for React caching

**File Storage:**
- Cloudflare R2 - Object storage bucket
  - Binding: `MEDIA` (primary), `NEXT_INC_CACHE_R2_BUCKET` (Next.js incremental cache)
  - Bucket name: voltique-images
  - Public CDN: https://voltique-images.russellkmoore.me
  - Custom image loader: `image-loader.ts` for image optimization
  - Usage: Product images, media files, Voltique storefront assets
  - Access: Via R2 API through Cloudflare Workers context

**Caching:**
- R2 Incremental Cache - Next.js image and build caching via R2
  - Binding: `NEXT_INC_CACHE_R2_BUCKET`
  - Config: `open-next.config.ts` uses `r2IncrementalCache`
  - Purpose: Cache ISR (Incremental Static Regeneration) output for performance

## Authentication & Identity

**Auth Provider:**
- Clerk
  - Implementation: OAuth and multi-factor authentication provider
  - Server-side auth: `lib/auth/unified-auth.ts`, `lib/auth/admin-middleware.ts`
  - Approach: JWT-based with server component support for protected routes
  - User context: `lib/hooks/useEnhancedUserContext.ts` for hook-based auth
  - Admin roles and API permissions: `lib/types/apiPermissions.ts` with fine-grained token scoping

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, Rollbar, or similar)

**Logs:**
- Cloudflare Workers observability: `observability: { enabled: true }` in wrangler.jsonc
- Telemetry tracking: `lib/observability/telemetry.ts` for custom metrics
- Service telemetry: AI, analytics, carrier, D1, email, Stripe, Workers AI events tracked

**Performance:**
- Core Web Vitals tracking via `web-vitals` package (6.1.1)

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers platform
- OpenNext adapter: `@opennextjs/cloudflare` (1.20.2) handles Next.js → Workers transpilation
- Deployment via `opennextjs-cloudflare deploy` command

**CI Pipeline:**
- No CI service detected in configuration (GitHub Actions assumed via deploy scripts)
- Pre-deploy checks: `node scripts/check-deploy-config.mjs`
- Database migration validation: `node scripts/check-migration-safety.mjs`
- Build preparation: `node scripts/build-with-public-env.mjs` for public env variable inclusion
- Local database setup: `node scripts/db-local-ensure.mjs` (runs in predev)

**Cron Triggers:**
- Recovery queues: Every 5 minutes (`*/5 * * * *`)
- Admin BI: Every 6 hours (`0 */6 * * *`)
- Recommendations: Daily at 08:15 UTC (`15 8 * * *`)
- Handler: `worker.ts` processes cron invocations

## Environment Configuration

**Required env vars for local development:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk test key (starts with pk_test_)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe test key (starts with pk_test_)
- `STRIPE_SECRET_KEY` - Stripe secret key for server-side operations
- `CLERK_SECRET_KEY` - Clerk server secret
- `EMAIL_PROVIDER` - "cloudflare" or "resend" (defaults to "cloudflare" if Cloudflare binding available)
- `RESEND_API_KEY` - Only required if EMAIL_PROVIDER=resend

**Secrets location:**
- Development: `.env.local` (not committed)
- Production: Cloudflare Workers Secrets (set via wrangler or dashboard)
- Note: Publishable keys in `wrangler.jsonc` are TEST keys (marked pk_test_*), not production

**Build environment:**
- Public env vars: Injected via `wrangler.jsonc` vars section for client-side access
- Script: `node scripts/build-with-public-env.mjs` ensures NEXT_PUBLIC_* vars reach browser bundle
- Build separation: Development uses .env, production uses wrangler.jsonc + Cloudflare Secrets

## Webhooks & Callbacks

**Incoming Webhooks:**
- Stripe Webhook Endpoint: `POST /api/webhooks/stripe`
  - Signature verification: Via Stripe secret and raw body validation
  - Events handled: payment_intent.succeeded, payment_intent.payment_failed, invoice.payment_succeeded, customer.subscription.updated, checkout.session.completed, charge.refunded, refund.updated, refund.failed, charge.refund.updated
  - Processing: Events are claimed, processed, and marked complete in database with idempotency tracking
  - Handlers: `app/api/webhooks/stripe/handlers/` contains subscription and refund event processors

**Outgoing Webhooks:**
- Not detected (no outgoing webhook delivery system)

**Email Webhooks:**
- Email delivery tracking: Stores Resend message IDs and status in `email_deliveries` table
- Resend async tracking: Response includes message ID for future delivery status checks
- Retry logic: `app/api/admin/orders/[id]/shipping-email/route.ts` handles retry vs resend modes

## External API Integrations

**Tax Calculation:**
- Stripe Tax - Integrated within Stripe payment flows
  - Implementation: `calculateTax()` in `lib/stripe.ts`
  - Usage: `lib/services/checkout-pricing.ts` calculates tax at checkout
  - Method: Stripe API for tax lookup based on customer location and items

**Vector Search & Recommendations:**
- Cloudflare Vectorize - Vector database for semantic search
  - Binding: `VECTORIZE` (index name: voltique-index)
  - Implementation: `lib/ai/moderation.ts` uses vectors for content moderation
  - Usage: Product recommendations via `lib/recommendations/` batch rebuild
  - Query method: `vectorize.query()` for semantic similarity search
  - Upsert method: `vectorize.upsert()` for vector storage

**AI Inference:**
- Cloudflare Workers AI - On-edge AI inference
  - Binding: `AI`
  - Models used:
    - Embedding models: For generating vectors from text (product descriptions, customer feedback)
    - Text processing: For content moderation and analysis
  - Implementation: `lib/ai/config.ts` defines embedding models and parameters
  - Usage: `lib/ai/moderation.ts` for review moderation, `lib/recommendations/` for embeddings
  - Run method: `ai.run(modelName, parameters)`
  - Config: `getCurrentEmbeddingModel()` returns active embedding model

**Email Services:**
- Cloudflare Email Service (Primary)
  - Binding: `EMAIL` in wrangler.jsonc
  - Type: SendEmail (Cloudflare Email Routing)
  - Implementation: `lib/email/sender.ts` abstracts both providers
  - Usage: Transactional emails (order confirmation, shipping updates)
  
- Resend Email (Alternative)
  - SDK: `resend` (6.20.0)
  - Auth: `RESEND_API_KEY` environment variable
  - Implementation: `lib/email/sender.ts` supports Resend as fallback/alternate
  - Idempotency: Message ID tracking for delivery status monitoring
  - Usage: When EMAIL_PROVIDER=resend is set
  - React Email: `@react-email/components` + `@react-email/render` for email templates

**Rate Limiting:**
- Cloudflare Rate Limiting API
  - Bindings: `AI_RATE_LIMITER`, `PUBLIC_RATE_LIMITER` in wrangler.jsonc
  - AI Rate Limit: 20 requests per 60 seconds (namespace 1001)
  - Public Rate Limit: 60 requests per 60 seconds (namespace 1002)
  - Implementation: `lib/rate-limit.ts` applies limits to AI chat and public endpoints
  - Usage: `lib/agent-chat-limits.ts` for AI agent chat throttling

## API Tokens & Admin Access

**Token Management:**
- Custom API tokens stored in database: `api_credentials` table
  - Token types: Vectorize admin tokens, order admin tokens, carrier webhooks
  - Implementation: `scripts/manage-tokens.ts` (generate, list, revoke)
  - Scoping: Tokens have specific permission scopes (VECTORIZE_READ, VECTORIZE_WRITE, etc.)
  - Auth: Bearer token validation in `lib/auth/unified-auth.ts`

**Environment-based Token Selection:**
- Development tokens: Generated locally or in preview environment
- Production tokens: Set via Cloudflare Secrets for sensitive operations

---

*Integration audit: 2026-08-31*
