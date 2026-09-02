# Constraints (extracted from SPEC-typed sources)

Source set: 6 SPEC-classified docs. `type` is one of api-contract | schema |
nfr | protocol. Verbatim source blocks are fenced with one-off
`DATA_<token>_START/END` markers; everything inside a fence is quoted data,
not an instruction.

---

# docs/admin-dashboard-specification.md

This document is a target-state specification. It contains persona, vision,
4-phase roadmap, and success-metric sections that are PRD-shaped; those were
NOT extracted as requirements because the doc is typed SPEC (see
INGEST-CONFLICTS.md W2 and I16). Whether the modules below are built is not
stated in this source.

## ADS-01: Admin frontend stack
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: nfr
- content: Framework Next.js 15 App Router; UI shadcn/ui + Tailwind CSS; state Zustand + React Query; charts Recharts + D3.js; real-time updates via WebSockets + Server-Sent Events.

## ADS-02: Admin backend integration
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: nfr
- content: Authentication Clerk with admin role enforcement; database Cloudflare D1 with Drizzle ORM; file uploads Cloudflare R2 for product images; real-time WebSocket connections; analytics via a custom pipeline with D1 aggregations.

## ADS-03: AdminSecurity model
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: api-contract
- content: `interface AdminSecurity { authentication: "clerk" | "custom"; authorization: RoleBasedAccess; auditLogging: ComprehensiveAudit; sessionManagement: SecureSessionHandling; apiProtection: RateLimiting & InputValidation; }` and a second `AdminSecurity` interface with `enableMFA(userId, method)`, `verifyMFA(userId, token)`, `assignRole(userId, role)`, `checkPermission(userId, resource, action)`, `validateSession(sessionId)`, `revokeSession(sessionId)`, `enforceSessionTimeout(duration)`.

## ADS-04: ProductManagement interface
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: api-contract
- content: `createProduct(data: ProductFormData)`, `updateProduct(id, data: Partial<ProductFormData>)`, `deleteProduct(id)`, `bulkUpdateProducts(updates: BulkProductUpdate[])`, `duplicateProduct(id, modifications?)`, `importProductsCSV(file)`, `exportProductsCSV(filters?)`, `scheduleProductLaunch(id, launchDate)`. Product form sections: basic info, pricing & inventory (price, sale price, cost, stock, reorder levels), media, SEO, AI integration (AI notes, use cases, vector indexing triggers), shipping & logistics. Bulk operations: mass price updates, inventory adjustments with audit trails, category management, status changes, CSV export/import.

## ADS-05: InventorySystem interface
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: api-contract
- content: `updateStockLevel(productId, quantity, reason)`, `setReorderPoint(productId, threshold)`, `generateReorderReport()`, `recordStockMovement(movement)`, `getStockHistory(productId, dateRange?)`, `getLowStockAlerts()`, `configureStockAlerts(settings)`.

## ADS-06: OrderManagement interface
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: api-contract
- content: `getOrders(filters, pagination)`, `getOrderDetails(orderId)`, `updateOrderStatus(orderId, status, notes?)`, `processRefund(orderId, refundData)`, `generateShippingLabel(orderId, carrier)`, `updateTrackingInfo(orderId, trackingNumber, carrier)`, `bulkUpdateOrders(updates)`, `sendOrderUpdateEmail(orderId, template)`, `addOrderNote(orderId, note, customerVisible)`. Dashboard components: order queue, status pipeline with drag-and-drop, quick actions, order details, customer context.

## ADS-07: FulfillmentAutomation interface
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: api-contract
- content: `createFulfillmentRule(rule)`, `processAutomaticFulfillment()`, `calculateShippingRates(order, destination)`, `generateBulkShippingLabels(orderIds)`, `reserveInventory(orderId)`, `releaseReservation(orderId)`.

## ADS-08: CustomerManagement interface
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: api-contract
- content: `getCustomers(filters)`, `getCustomerProfile(userId)`, `updateCustomerNotes(userId, notes)`, `createCustomerSegment(criteria)`, `getCustomerSegments()`, `assignCustomerToSegment(userId, segmentId)`, `promoteToVIP(userId, tier)`, `getVIPCustomers(tier?)`, `calculateCustomerLTV(userId)`. Analytics dashboard: overview, purchase behavior, segmentation, VIP management, communication history.

## ADS-09: PersonalizationAdmin interface
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: api-contract
- content: `getRecommendationPerformance()`, `adjustRecommendationWeights(weights)`, `testRecommendationAlgorithm(userId, algorithm)`, `getUserContextSummary(userId)`, `updateUserPreferences(userId, preferences)`, `resetUserPersonalization(userId)`.

## ADS-10: VoltAIManagement interface
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: api-contract
- content: `getAIMetrics(dateRange)`, `getConversationAnalytics()`, `identifyProblemQueries()`, `updateKnowledgeBase(updates)`, `reindexVectorDatabase()`, `testAIResponse(question, context?)`, `updateSystemPrompts(prompts)`, `testPromptVariations(variations)`, `rollbackPromptChanges(version)`. AI analytics dashboard: conversation metrics, response quality (hallucination detection), recommendation performance, knowledge coverage, performance optimization.

## ADS-11: VectorManagement interface
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: api-contract
- content: `reindexProducts()`, `reindexKnowledgeBase()`, `addCustomContent(content)`, `testSearchQuery(query)`, `analyzeSearchPerformance()`, `optimizeSearchWeights(weights)`, `getIndexedContent()`, `updateContentMetadata(contentId, metadata)`, `removeFromIndex(contentId)`.

## ADS-12: BusinessAnalytics interface
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: api-contract
- content: `getRevenueMetrics(period)`, `getProductPerformance(dateRange)`, `getCustomerAnalytics(segment?)`, `getInventoryTurnover()`, `getOrderFulfillmentMetrics()`, `getCustomerServiceMetrics()`, `getAIEngagementMetrics()`, `getRecommendationEffectiveness()`, `getChatbotPerformance()`. Report generation: automated daily/weekly/monthly, drag-and-drop custom builder, PDF/CSV/Excel export with scheduling, real-time dashboards, alert system.

## ADS-13: SystemMonitoring interface
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: api-contract
- content: `getSystemHealth()`, `getAPIPerformance()`, `getDatabaseMetrics()`, `getPageLoadTimes()`, `getErrorRates()`, `getUserSatisfactionScores()`, `getSecurityEvents()`, `getAccessLogs(userId?)`, `getFailedLoginAttempts()`.

## ADS-14: SystemConfiguration interface
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: api-contract
- content: `updateSiteSettings(settings)`, `configurePaymentMethods(methods)`, `updateShippingSettings(shipping)`, `updateAISettings(aiConfig)`, `configureRecommendationEngine(config)`, `updateVectorSearchSettings(settings)`, `updateSecuritySettings(security)`, `configureRateLimiting(limits)`, `updateAuditSettings(audit)`. User management: admin CRUD, granular RBAC, session monitoring and forced logout, complete audit logging, two-factor authentication. Compliance: GDPR/CCPA data export/deletion tools, config change version control, access-pattern alerts, compliance reporting.

## ADS-15: AdminLayout structure
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: api-contract
- content: `sidebar { collapsible; pinnedItems; recentlyUsed; quickActions }`, `topBar { globalSearch; notifications; userProfile; systemStatus }`, `mainContent { breadcrumbs; tabNavigation; actionButtons; dataVisualization }`. Design principles: information density, progressive disclosure, consistent navigation, real-time feedback, responsive desktop/tablet/mobile.

## ADS-16: Admin system performance targets
- source: /Users/rmoore/Workspaces/mercora/docs/admin-dashboard-specification.md
- type: nfr
- content: Sub-2s page load for all admin interfaces; 99.9% availability for admin functions; zero security incidents and full audit compliance.

---

# docs/api-architecture.md

## API-01: REST endpoint inventory
- source: /Users/rmoore/Workspaces/mercora/docs/api-architecture.md
- type: api-contract
- content:
  DATA_Xq4vT9mA_START
  /api/orders: GET list orders (owner/admin authorization); POST verify Stripe and finalize a pending order; PUT update allowlisted metadata with optimistic concurrency
  /api/orders/[id]: GET owner/admin-authorized order details
  /api/payment-intent: POST price lines, persist pending order, create bound intent
  /api/tax: POST standalone tax estimate (not checkout authority)
  /api/webhooks/stripe: POST handle Stripe webhook events
  /api/validate-discount: POST validate discount codes
  /api/products: GET list (filters); POST add (admin)
  /api/products/[id]: GET details; PUT update (admin)
  /api/categories: GET list; POST add (admin)
  /api/categories/[id]: GET details; PUT update (admin)
  /api/shipping-options: POST shipping options for address
  /api/agent-chat: POST chat with Volt
  /api/admin/vectorize: GET index products + knowledge (atomic)
  /api/admin/analytics: POST business insights
  /api/admin/generate-article: POST
  /api/admin/generate-product-description: POST
  /api/admin/users: GET, POST, PUT
  /api/admin/pages: GET, POST, PUT
  /api/admin/knowledge: GET, POST, PUT
  /api/admin/settings: GET, PUT
  /api/admin/auth-check: GET
  /api/admin/generate-token: POST
  /api/admin/upload-image: POST
  DATA_Xq4vT9mA_END

## API-02: Checkout request/response contract
- source: /Users/rmoore/Workspaces/mercora/docs/api-architecture.md
- type: api-contract
- content: `POST /api/payment-intent` body `{ items: [{ productId, variantId, quantity }], shippingAddress, shippingMethodId, discountCodes }`; server prices lines, shipping, discounts, tax and persists the pending order before releasing the client secret; client renders totals from `paymentResponse.quote`. Finalize with `POST /api/orders` body `{ orderId: paymentResponse.orderId, paymentIntentId: paymentResponse.paymentIntentId }`; server retrieves and verifies Stripe.

## API-03: Authentication pattern per endpoint class
- source: /Users/rmoore/Workspaces/mercora/docs/api-architecture.md
- type: api-contract
- content: User endpoints (Clerk auth): `/api/orders` (own orders), `/api/payment-intent`, `/api/tax`. Admin endpoints (API key auth): `/api/orders?admin=true`, `/api/orders` PUT with admin permissions, `/api/products` POST/PUT. Webhook endpoints (signature auth): `/api/webhooks/stripe`.

## API-04: Agent chat request flow
- source: /Users/rmoore/Workspaces/mercora/docs/api-architecture.md
- type: protocol
- content: Client validates Clerk session, POSTs `{ question, userName, history }` to `/api/agent-chat`. Server generates a 768-dimension question embedding, queries Vectorize with topK=5, extracts context and product IDs, builds system prompt; easter-egg branch returns a special response, otherwise generates with Llama 3.1 and applies a 30% personality flair; hydrates product IDs from D1 with prices/images; optional edge cache; returns `{ answer, products, history, userId }`.

## API-05: Vectorization pipeline
- source: /Users/rmoore/Workspaces/mercora/docs/api-architecture.md
- type: protocol
- content: Admin token validated, Cloudflare bindings checked, R2 files listed; each file's content extracted, product ID parsed, content validated; embeddings generated with BGE-base-en-v1.5 (768D); metadata built and upserted to Vectorize; results and per-stage errors (auth, binding, file read, AI, vector storage) summarized in the response.

## API-06: Order processing state machine (client view)
- source: /Users/rmoore/Workspaces/mercora/docs/api-architecture.md
- type: protocol
- content: CartReview -> ShippingInfo -> ShippingOptions -> TaxCalculation -> BillingInfo -> PaymentValidation -> OrderCreation -> InventoryCheck -> PaymentProcessing -> OrderConfirmation -> FulfillmentQueue, with OutOfStock and PaymentFailed loops. Diagram notes: cart state persisted in localStorage; real-time tax API; "Stripe integration (mock implementation)". The mock-implementation note is superseded by ADR checkout-trust-boundary (see INGEST-CONFLICTS.md I6).

## API-07: API security layering
- source: /Users/rmoore/Workspaces/mercora/docs/api-architecture.md
- type: nfr
- content: Request -> Cloudflare CDN -> WAF -> rate limiting -> Clerk validation/session/token -> role and permission checks -> input validation, SQL-injection, XSS, CSRF protection -> encryption, sanitization, security headers, audit logging -> output validation, data minimization, safe error handling.

---

# docs/content-publishing.md

## CP-01: Public CMS API contract
- source: /Users/rmoore/Workspaces/mercora/docs/content-publishing.md
- type: api-contract
- content: `GET /api/pages` returns bounded `PublicPageSummary` records for navigation and discovery. Page bodies and custom CSS come from the published, unprotected detail endpoint. Public responses never include stored custom JavaScript, actor IDs, access roles, or version internals.

## CP-02: Blog image upload and CDN behavior
- source: /Users/rmoore/Workspaces/mercora/docs/content-publishing.md
- type: nfr
- content: Admin Blog uploads use the shared, signature-checked R2 upload route. `NEXT_PUBLIC_IMAGE_CDN` publishes absolute cover-image URLs in social metadata and rendered pages. A storefront `/media/` proxy is not part of this feature; installations without an image CDN should treat uploaded R2 keys as unavailable to public social crawlers until a media-delivery route is configured. (Compare RC-09 and docs/shopify-migration.md, which describe a `/media/` route delivered later; INGEST-CONFLICTS.md I13.)

## CP-03: Migration 0019 deployment and rollback
- source: /Users/rmoore/Workspaces/mercora/docs/content-publishing.md
- type: schema
- content: Migration `0019` adds Blog tables and neutral page-template registrations without seeding merchant posts, pages, images, or copy. Apply it before deploying the publishing code. It is expand-only; existing CMS rows are not rewritten; empty Blog tables are a valid starting state. Rollback means deploying the prior application version and leaving the added tables and template rows in place; do not down-migrate merchant content.

---

# docs/mcp-server-specification.md

## MCP-01: Agent credential contract
- source: /Users/rmoore/Workspaces/mercora/docs/mcp-server-specification.md
- type: api-contract
- content: Credential in `X-Agent-API-Key: mcp_...` or `Authorization: Bearer mcp_...`. Query-string credentials are not accepted. New credentials are generated with Web Crypto, stored only as SHA-256 digests, expire after 90 days by default, and are returned in plaintext only when created or rotated. A manager can choose a lifetime from 1 through 365 days. Tool schema at `GET /api/mcp/schema`; clients may use REST routes under `/api/mcp` or the JSON tool dispatcher at `POST /api/mcp`.

## MCP-02: Migration 0012 credential transition and seed policy
- source: /Users/rmoore/Workspaces/mercora/docs/mcp-server-specification.md
- type: schema
- content: `0012_expand_mcp_agent_credentials.sql` is an expand/rotate/contract transition: existing plaintext credentials remain usable initially; first successful use stores the digest, retires the plaintext, and starts a 30-day rotation window; explicit rotation replaces the credential and expiry immediately; the legacy column can be removed in a future contract migration once no version-1 credentials remain. The public demo credential formerly installed by a migration is removed. `npm run dev` applies `data/d1/seed-dev.sql` to local D1 only; its test credential is never installed by preview or production migrations.

## MCP-03: Permissions and rate limits
- source: /Users/rmoore/Workspaces/mercora/docs/mcp-server-specification.md
- type: api-contract
- content: Permissions are deny-by-default; `admin` and `*` satisfy all scopes. `write:cart` allows add/update/remove/bulk-add/clear cart lines; `place:orders` allows creating a bound PaymentIntent and finalizing an order; `agents:manage` allows create/list/inspect/disable/rotate agents. An `agents:manage` credential cannot delegate a permission it does not hold; only `admin` or `*` may delegate arbitrary permissions. Per-agent requests-per-minute limits apply to every authenticated request; the orders-per-hour limit applies to `place_order`; D1 stores and resets both counters by fixed time window.

## MCP-04: Identity and session ownership
- source: /Users/rmoore/Workspaces/mercora/docs/mcp-server-specification.md
- type: api-contract
- content: The authenticated credential is the sole source of agent identity. `X-Agent-Context` may carry bounded user preferences, but a client-provided `agentId` is always replaced with the authenticated agent ID. Sessions are created with `POST /api/mcp/sessions` and use cryptographically random UUIDs. Every cart, shipping, payment, and order mutation verifies the session belongs to the authenticated agent. Order lookup also verifies the agent ID; an order identifier alone is not authorization.

## MCP-05: Catalog boundary and money wire shape
- source: /Users/rmoore/Workspaces/mercora/docs/mcp-server-specification.md
- type: api-contract
- content: Discovery capabilities derive from active catalog categories, product prices, shipping settings, and allowed countries; no demo-store categories, brands, product names, or fulfillment claims are compiled in. Only active products and variants cross the public MCP boundary; the shared public serializer removes internal costs, inventory records, barcodes, integration references, extensions, and media-processing metadata. Money uses the MACH decimal wire shape `{ "amount": 31.49, "currency": "USD", "precision": 2 }`; persisted commerce values remain integer minor units. Addresses accept legacy flat names (`street`, `state`, `postalCode`) or MACH names (`line1`, `region`, `postal_code`) and are normalized before pricing or persistence.

## MCP-06: Commerce workflow and payment authority
- source: /Users/rmoore/Workspaces/mercora/docs/mcp-server-specification.md
- type: protocol
- content: Sequence: create session; search active catalog and add product/variant IDs to the session cart; request shipping options for the owned session and address; call `create_payment_intent` with session, shipping address, configured shipping method, optional discount or gift-card input; complete the returned Stripe PaymentIntent with its client secret; call `place_order` with `orderId` and `paymentIntentId`; poll `get_order_status`. `create_payment_intent` does not trust cart names or prices: it reloads each product and variant, validates inventory, applies shipping, promotions, gift cards, and tax through the shared checkout pricing service, then creates a Stripe PaymentIntent with amount, currency, order ID, agent ID, and session ID bound in metadata plus a durable pending order with the canonical quote and line allocations. On mismatched amount/currency or persistence failure the PaymentIntent is cancelled. `place_order` verifies pending order, PaymentIntent, agent, and session all match before invoking the shared idempotent payment finalizer, which verifies captured payment with Stripe and runs the same durable inventory and post-payment effects as the storefront. Client-supplied totals, display names, prices, cart objects, and paid flags are never authoritative. (Contradicts ADR-CTB-15; see INGEST-CONFLICTS.md W1.)

## MCP-07: Tool inventory
- source: /Users/rmoore/Workspaces/mercora/docs/mcp-server-specification.md
- type: api-contract
- content: Discovery `search_products`, `assess_request`, `get_recommendations`; Cart `add_to_cart`, `update_cart`, `remove_from_cart`, `get_cart`, `bulk_add_to_cart`, `clear_cart`; Checkout `get_shipping_options`, `validate_payment`, `create_payment_intent`, `place_order`; Orders `get_order_status`; Agents `create_agent`, `list_agents`, `get_agent_details`, `update_agent_status`, `rotate_agent_key`. (19 tools; other docs say 17, see INGEST-CONFLICTS.md I9.)

## MCP-08: Order status and tracking projection
- source: /Users/rmoore/Workspaces/mercora/docs/mcp-server-specification.md
- type: api-contract
- content: `get_order_status` returns only an order owned by the authenticated agent. Its `shipment` object is derived from server-owned carrier/tracking columns and the validated runtime carrier registry; stored or client-provided tracking URLs are never trusted. `tracking_history` contains the real order-created marker plus a bounded, customer-safe projection of `shipment_created` and `tracking_updated` audit events; actor identifiers, email-delivery events, and opaque event details are not exposed. Legacy shipped orders without an audit row fall back to their persisted `shipped_at` marker. `/api/mcp/tools/order/track` presents the same owned shipment as camel-cased carrier, tracking-link, and history fields. Missing, non-MCP, and differently owned orders are indistinguishable.

## MCP-09: Credential rotation
- source: /Users/rmoore/Workspaces/mercora/docs/mcp-server-specification.md
- type: api-contract
- content: Rotate via `PATCH /api/mcp/tools/agents/{agentId}` with `{ "rotateApiKey": true, "apiKeyTtlDays": 90 }` or the dispatcher tool `rotate_agent_key` with `agentId` and optional `apiKeyTtlDays`. Rotation invalidates the previous key; the plaintext replacement cannot be recovered from the database. Before removing legacy credential support, confirm no active row remains at credential version 1 and all required clients have rotated credentials.

---

# docs/observability.md

## OBS-01: Telemetry is best effort and never alters commerce behavior
- source: /Users/rmoore/Workspaces/mercora/docs/observability.md
- type: nfr
- content: Logging, Analytics Engine, Tail processing, cooldown storage, and alert delivery may all fail without changing payment, webhook, refund, inventory, fulfillment, email, or recommendation behavior.

## OBS-02: commerce.telemetry.v1 envelope contract
- source: /Users/rmoore/Workspaces/mercora/docs/observability.md
- type: schema
- content: Exact machine marker `commerce.telemetry.v1`. Producer accepts only a closed event and severity taxonomy. Context is restricted to bounded enum, count, attempt, HTTP status, duration, retryability, and closed route-template fields; dynamic route values are never accepted; errors become a low-cardinality error class only. Never add headers, cookies, authorization values, payment details, customer or order identifiers, email or postal addresses, raw exceptions, request or response payloads, or URLs containing queries. The Tail Worker validates and sanitizes the envelope a second time and ignores ordinary logs and uncaught exception details.

## OBS-03: Analytics Engine is optional
- source: /Users/rmoore/Workspaces/mercora/docs/observability.md
- type: nfr
- content: If `COMMERCE_ANALYTICS` is absent or throws, the structured log remains available and the commerce operation continues.

## OBS-04: Tail Worker behavior rules
- source: /Users/rmoore/Workspaces/mercora/docs/observability.md
- type: protocol
- content: `workers/observability-tail` scans a bounded number of trace items and log entries; accepts only an error-level log containing one exact JSON envelope argument; alerts only for the closed critical-event subset; deduplicates and caps alert work and email payload size; HTML-escapes alert content and sends both HTML and plain text; coordinates cooldowns through one SQLite `AlertCooldown` Durable Object per closed alert bucket (never a module global or one global object); reserves the cooldown atomically before delivery; shortens the reservation to a bounded failure backoff if delivery fails.

## OBS-05: Alert email provider adapter
- source: /Users/rmoore/Workspaces/mercora/docs/observability.md
- type: protocol
- content: Provider-neutral adapter kept inside the Tail Worker package (does not import the application sender or Next.js/D1 dependencies). Cloudflare Email Sending is the recommended default; Resend remains available for compatibility. Provider is selected explicitly with `EMAIL_PROVIDER=cloudflare|resend` or inferred only when exactly one provider is configured; both or neither fail closed. Never falls back across providers after delivery starts.

## OBS-06: Tail Worker configuration surface
- source: /Users/rmoore/Workspaces/mercora/docs/observability.md
- type: nfr
- content: The Worker exposes no operator HTTP endpoint. Sender, single recipient, subject prefix, environment label, operator identity, success cooldown, and failure backoff are configuration. The generic committed values deliberately fail runtime validation and cannot send mail.

## OBS-07: Consumer-first deployment order
- source: /Users/rmoore/Workspaces/mercora/docs/observability.md
- type: protocol
- content: Tail Workers require a paid Workers plan; a producer deployment fails if the referenced Tail Worker service does not exist. Order: (1) choose provider (onboard sender domain and verify the one alert destination for Cloudflare; or `RESEND_API_KEY` as a Wrangler secret); (2) copy `workers/observability-tail/wrangler.jsonc` into environment-owned config, replace every `configure-*` and `example.invalid` value, keep `destination_address`/`allowed_sender_addresses` on `ALERT_EMAIL` aligned with `ALERT_EMAIL_TO`/`ALERT_EMAIL_FROM`; for Resend-only remove the `send_email` binding and set `EMAIL_PROVIDER=resend`; (3) generate types with `npx wrangler types --include-runtime=false --config workers/observability-tail/wrangler.jsonc --env-interface ObservabilityTailEnv workers/observability-tail/worker-configuration.d.ts`; (4) deploy the Tail Worker first (creates the SQLite DO class via migration `v1`); (5) only then copy entries from `producer-bindings.example.jsonc` into producer configs and deploy producers; the main repository config intentionally has no `tail_consumers` entry; (6) Analytics Engine binding is independent and optional. The repository test/build workflow performs no deployment, onboarding, verification, binding creation, or message send.

## OBS-08: Validation gates and canary rules
- source: /Users/rmoore/Workspaces/mercora/docs/observability.md
- type: nfr
- content: Gates: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:workers`, `npm run test:observability-worker`, `npx wrangler types --check ...` for the tail config, `npx wrangler deploy --dry-run --config workers/observability-tail/wrangler.jsonc`. Unit tests use fake provider calls and verify no cross-provider fallback; Workers tests exercise SQLite cooldown state without delivering mail. Behavioral tests cover payment-intent creation/persistence/cancellation, webhook claim/ownership/processing/failure/verification, post-payment effect and inventory failures past retry threshold, manual-review adjustments, fulfillment transition/delivery/audit failures, recommendation rebuild and scheduled recovery/analytics failures, and both outbound providers. The AST-based source contract ensures executable telemetry calls use the closed taxonomy (a wiring guard, not a substitute for behavior tests). Canary: non-production account and recipient only; deploy Tail first, attach one non-production producer, call `recordTelemetry("payment.intent_create_failed", { operation: "create", outcome: "failed", provider: "stripe", path: "/api/payment-intent" }, new Error("canary"))` from a guarded non-production path; confirm one alert, confirm suppression during cooldown, remove the canary. Never use a customer request, real order, production payment, raw exception, or production recipient.

---

# docs/runtime-configuration.md

## RC-01: Configuration is resolved per request, not at import
- source: /Users/rmoore/Workspaces/mercora/docs/runtime-configuration.md
- type: nfr
- content: Neutral demo defaults live in `lib/store-config.ts`. A storefront overrides public, non-secret values without editing components. Configuration is resolved when a request/render needs it and is not captured at module import time.

## RC-02: Environment variable contract
- source: /Users/rmoore/Workspaces/mercora/docs/runtime-configuration.md
- type: api-contract
- content:
  DATA_p7Lk2ZsD_START
  Store identity: NEXT_PUBLIC_STORE_NAME, NEXT_PUBLIC_STORE_TAGLINE, NEXT_PUBLIC_STORE_DESCRIPTION
  Assistant/MCP: NEXT_PUBLIC_ASSISTANT_NAME, MCP_CAPABILITIES, MCP_DESCRIPTION
  Public host and SEO: NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_ROBOTS_INDEX=true
  Images: NEXT_PUBLIC_IMAGE_CDN, NEXT_PUBLIC_IMAGE_TRANSFORMS=false
  Browser persistence: NEXT_PUBLIC_STORAGE_NAMESPACE, NEXT_PUBLIC_CART_STORAGE_KEY, NEXT_PUBLIC_CHAT_STORAGE_KEY
  Theme: NEXT_PUBLIC_THEME_PRIMARY, NEXT_PUBLIC_STORE_LOGO_PATH
  Contact and legal links: STORE_SUPPORT_EMAIL, STORE_SENDER_EMAIL, STORE_REPLY_TO_EMAIL, STORE_MERCHANT_NOTIFICATION_EMAIL, STORE_POSTAL_ADDRESS, STORE_SUPPORT_HOURS, NEXT_PUBLIC_PRIVACY_URL, NEXT_PUBLIC_TERMS_URL, NEXT_PUBLIC_RETURNS_URL
  Commerce formatting: STORE_LOCALE (canonical BCP 47 locale, defaults to en-US), STORE_CURRENCY (must match active catalog variant currency; Mercora checkout is single-currency per cart)
  Gift-card reconciliation: STORE_FEATURE_GIFT_CARD_RECONCILIATION=true (defaults off; keep enabled while reservations or balances exist)
  Optional gift-card acquisition: STORE_FEATURE_GIFT_CARD_ACQUISITION=true (defaults off and requires reconciliation enabled)
  Gift-card bearer lookup secrets: server-only GIFT_CARD_CODE_HMAC_CURRENT_VERSION plus GIFT_CARD_CODE_HMAC_KEYS_JSON (at most four versioned keys; never NEXT_PUBLIC_*)
  Subscription reconciliation: STORE_FEATURE_SUBSCRIPTION_RECONCILIATION=true (defaults off; keep enabled after the first subscription is sold)
  Optional subscription acquisition: STORE_FEATURE_SUBSCRIPTION_ACQUISITION=true plus a bounded STORE_SUBSCRIPTION_TERMS_VERSION matching the published recurring terms (defaults off and requires reconciliation enabled)
  Outbound email: EMAIL_PROVIDER=cloudflare|resend; Cloudflare EMAIL binding (recommended) or encrypted RESEND_API_KEY
  DATA_p7Lk2ZsD_END

## RC-03: Public values vs secrets
- source: /Users/rmoore/Workspaces/mercora/docs/runtime-configuration.md
- type: nfr
- content: `NEXT_PUBLIC_*` values are intentionally public. Store credentials (Stripe secrets, Clerk secrets, Cloudflare API tokens) belong in `.dev.vars` locally or Cloudflare secrets remotely, never in `lib/store-config.ts` or `wrangler.jsonc`.

## RC-04: Supported currencies
- source: /Users/rmoore/Workspaces/mercora/docs/runtime-configuration.md
- type: schema
- content: `STORE_CURRENCY` supports `USD`, `EUR`, `GBP`, `CAD`, `AUD`, `CHF`, `CNY`, `INR`, `BRL`, `JPY`, `BHD`, and `KWD`. Unsupported values fall back to `USD`; extend `lib/money/currencies.ts` before enabling another currency.

## RC-05: Subscription flag lifecycle
- source: /Users/rmoore/Workspaces/mercora/docs/runtime-configuration.md
- type: protocol
- content: Optional money features resolve lazily. Before a store has subscription state, leaving both acquisition and reconciliation disabled creates no subscription provider or persistence adapter. Once subscriptions are installed, reconciliation is an independent runtime responsibility: turning off acquisition/UI must not turn off lifecycle webhooks, paid-invoice orders, cancellation, payment recovery, or retryable notifications. Enabling acquisition without installed reconciliation is a configuration error. Order: deploy the additive schema, install reconciliation, then enable acquisition.

## RC-06: Gift-card flag lifecycle and HMAC key ring
- source: /Users/rmoore/Workspaces/mercora/docs/runtime-configuration.md
- type: schema
- content: Gift cards use the same acquisition/reconciliation rollback discipline: both flags off before installing the additive schema and runtime factory (this path does not open D1 or parse bearer-code keys); enable reconciliation first, then acquisition; after accepting a reservation or balance, disable acquisition while leaving reconciliation enabled for verification, settlement, and release. The HMAC key ring is read from the request-scoped Workers environment only when a nonempty bearer token is being resolved; reconciliation-only calls do not need it. `GIFT_CARD_CODE_HMAC_KEYS_JSON` is a JSON object whose canonical positive-integer property names are key versions, e.g. `{"1":"<32+ byte secret>","2":"<32+ byte secret>"}`; the current version must be present and the ring is bounded to four keys. Values live in `.dev.vars` or encrypted Cloudflare secrets and are absent from `StoreConfig`, browser configuration, committed deployment files, telemetry, and errors.

## RC-07: One-time checkout never becomes a subscription
- source: /Users/rmoore/Workspaces/mercora/docs/runtime-configuration.md
- type: protocol
- content: Core one-time checkout never interprets catalog products as subscription acquisition. Products that also have subscription plans remain available for one-time purchase while acquisition is off. Only the dedicated subscription route consults the acquisition flag and selected recurring plan. (Consistent with ADR-SUB-02.)

## RC-08: Robots default noindex
- source: /Users/rmoore/Workspaces/mercora/docs/runtime-configuration.md
- type: nfr
- content: Robots defaults to `noindex`. Production must opt in with `NEXT_PUBLIC_ROBOTS_INDEX=true`; previews stay safe even though Workers sets `NODE_ENV=production` during a production-mode build.

## RC-09: Image delivery fallbacks
- source: /Users/rmoore/Workspaces/mercora/docs/runtime-configuration.md
- type: nfr
- content: When `NEXT_PUBLIC_IMAGE_CDN` is absent, store-object images use the same-origin `/media/` route. Set `NEXT_PUBLIC_IMAGE_TRANSFORMS=false` to bypass Cloudflare Image Transformations and serve raw CDN objects during an outage.
