# Decisions (extracted from ADR-typed sources)

Source set: 4 ADR-classified docs. Every distinct decision is a separate entry.
`status: locked` only where the classification has `locked: true`. Three of the
four ADR sources have no Status/Decision/Consequences structure; their entries
are `proposed` per the classifier, even though the prose is prescriptive.

Precedence: ADR > SPEC > PRD > DOC. See `.planning/INGEST-CONFLICTS.md` for
every place a lower-precedence source disagreed with an entry below.

---

## ADR-CTB-01: Checkout is one server-owned state transition
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Checkout is treated as one server-owned state transition, not a client-created paid order.
- scope: checkout

## ADR-CTB-02: POST /api/payment-intent recomputes all pricing server-side
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: The browser sends product ids, variant ids, quantities, destination, shipping-method id, and optional promotion codes. The server resolves active catalog entities and recomputes canonical line names, SKUs, prices, discounts, taxable line bases, tax, shipping, optional reserved tender, and the final cash charge with `Money`. It persists exact discount and tax allocation by stable line id and verifies authoritative variant availability before creating the PaymentIntent.
- scope: POST /api/payment-intent, pricing authority

## ADR-CTB-03: Pending order persisted with immutable PaymentIntent binding; cancel on insert failure
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: After creating the PaymentIntent, a `pending` order is persisted containing the provider-reported amount and an immutable PaymentIntent binding. If the D1 insert fails, the intent is cancelled and the client secret is never returned.
- scope: pending order persistence, Stripe PaymentIntent

## ADR-CTB-04: One shared finalizer verifies the PaymentIntent server-side
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Inline completion, redirect return, and the signed Stripe webhook all call the same finalizer. It retrieves the PaymentIntent server-side and requires `succeeded`, matching metadata/order ids, matching currency, an exact authorized amount, and `amount_received` at or above the persisted server charge floor. The paid order records the actual captured receipt amount.
- scope: order finalization, Stripe webhook finalizer

## ADR-CTB-05: Order effects are staged before the guarded paid CAS and drained durably
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Deterministic order-effect rows are staged before a guarded `pending`/`pending` to `processing`/`paid` update and stay dormant until that update proves the order paid. The winner and already-paid retries drain the same durable effects (inventory, promotion audit, optional tender and subscription capabilities, confirmation email). A five-minute cron recovers transient failures and expired leases.
- scope: paid order effects, order_effects

## ADR-CTB-06: The browser asserts nothing about order money or ownership
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: The browser cannot assert an order owner, paid status, item display data, prices, totals, discounts, tax, or shipping. It receives the authoritative quote used by Stripe so the payment screen cannot display a different total.
- scope: client trust boundary

## ADR-CTB-07: Shipping destination policy from shipping.allowed_countries, fallback ['US']
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Destination policy is configured with `shipping.allowed_countries` as ISO alpha-2 codes. Missing, empty, or malformed configuration falls back to `['US']`. The shipping estimator and authoritative pricing share this policy and the same enabled fresh-install methods (standard, express, overnight), so enabling a destination requires one explicit shipping configuration change.
- scope: shipping.allowed_countries, shipping methods

## ADR-CTB-08: Order reads are owner- or admin-scoped; an order id is not a credential
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Customer order history is SQL-scoped to the authenticated Clerk user. Order detail and receipt data require the owner or an authenticated `orders:read` admin. An order id is never a guest read credential.
- scope: order authorization

## ADR-CTB-09: PUT /api/orders is metadata-only with CAS and protected keys
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Generic `PUT /api/orders` accepts only `notes`, `external_references`, and `extensions`. It cannot perform lifecycle, fulfillment, ownership, money, or payment transitions. JSON metadata is merged with compare-and-swap lost-update protection. `payment_intent_id` is immutable in both JSON columns, and every extension key read by payment, refund, fulfillment, agent ownership, or checkout accounting is protected from generic writers.
- scope: PUT /api/orders, order metadata

## ADR-CTB-10: Gift cards and subscriptions are optional capabilities behind lib/commerce/capabilities.ts
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Gift cards and subscriptions implement interfaces in `lib/commerce/capabilities.ts`; core checkout does not import either feature. Defaults are no-ops. A nonzero optional tender must be authoritatively reserved when quoted and reverified before the paid CAS. Already-paid recovery does not require the original reservation to remain open; tender settlement is keyed by order, must be idempotent, and is retried during paid convergence. Subscription `orderPaid` implementations have the same order-idempotent retry contract.
- scope: optional capabilities, gift cards, subscriptions

## ADR-CTB-11: Coupon races honor captured orders; losers get a reconciliation marker
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: When concurrent checkouts race for the last coupon use, each already-captured order's persisted server quote is honored rather than stranding paid funds. A losing redemption writes the protected `coupon_reconciliation_codes` marker on the paid order for operational repair. Temporary usage overage is accepted until a later reservation/effect-ledger schema can prevent the race before capture.
- scope: coupon concurrency, coupon_reconciliation_codes

## ADR-CTB-12: product_variants.inventory is the inventory authority; decrements are ledgered
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: `product_variants.inventory` is the checkout and storefront authority. Tracked, non-backorderable variants must have sufficient integer quantity before Stripe is called. Paid decrements are keyed by order and variant in `inventory_adjustments`; the quantity mutation and terminal adjustment marker commit in one D1 batch.
- scope: inventory authority, product_variants.inventory, inventory_adjustments

## ADR-CTB-13: Refund authority rules
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Refunds require the immutable PaymentIntent binding in both protected order JSON columns. Cumulative refundable balance is reserved before calling Stripe, a deterministic provider idempotency key is used, and delayed or Dashboard refunds are reconciled from signed Stripe events. Exact local returned lines stage deterministic restocks. Dashboard partial refunds never guess line attribution; full Dashboard restocking is an explicit default-off operator policy.
- scope: refunds

## ADR-CTB-14: No shipment command yet; future transition must guard unsettled refunds
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: There is no shipment command. The future atomic shipment transition must include `SHIPMENT_NO_UNSETTLED_REFUNDS_SQL` so a `pending` or `requires_action` refund reservation cannot race a transition to `shipped`. The existing real-D1 contract test covers malformed and legacy JSON shapes; U13 must replace that contract-only coverage with an end-to-end shipment CAS test.
- scope: fulfillment / shipment transition, U13

## ADR-CTB-15: MCP checkout stays outside the paid inventory boundary until it verifies PaymentIntents
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: This boundary does not expose trusted MCP payment operations or start fulfillment. MCP checkout remains outside the paid inventory boundary until it performs the same PaymentIntent verification.
- scope: MCP checkout
- note: contradicted by SPEC docs/mcp-server-specification.md and PRD docs/o07-gift-cards-plan.md, which describe MCP already using the shared finalizer. Surfaced as WARNING W1 in INGEST-CONFLICTS.md; not auto-resolved because the ADR statement is conditional and its condition may now be met.

## ADR-CTB-16: Orders schema and U09 migrations 0008-0011
- source: /Users/rmoore/Workspaces/mercora/docs/checkout-trust-boundary.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: The existing `orders` columns hold pending state, canonical line and Money snapshots, immutable provider bindings, and the versioned refund ledger. U09 adds migrations `0008` through `0011` for webhook claims, paid effects, inventory adjustments, and the external full-refund restock setting.
- scope: orders schema, D1 migrations 0008-0011

---

## ADR-DBM-01: Remote D1 migrations are never applied by `npm run deploy`
- source: /Users/rmoore/Workspaces/mercora/docs/database-migrations.md
- status: locked (manifest ADR, locked=true; source has no Status field)
- decision: Mercora does not apply remote D1 migrations as part of `npm run deploy`. Schema changes are an explicit operator action so a preview or a failed build cannot silently mutate production data.
- scope: deploy pipeline, D1 migrations

## ADR-DBM-02: `npm run dev` prepares only local Wrangler state
- source: /Users/rmoore/Workspaces/mercora/docs/database-migrations.md
- status: locked (manifest ADR, locked=true; source has no Status field)
- decision: `npm run dev` first runs `npm run db:prepare:local`, which applies tracked migrations only to the local Wrangler state. It does not access Cloudflare and does not seed or erase data.
- scope: local development, db:prepare:local

## ADR-DBM-03: Preview migrations require preview_database_id and never fall back to production
- source: /Users/rmoore/Workspaces/mercora/docs/database-migrations.md
- status: locked (manifest ADR, locked=true; source has no Status field)
- decision: Preview commands (`db:migrate:status:preview`, `db:migrate:apply:preview`) require a `preview_database_id` on the selected D1 binding. If it is absent, Mercora aborts rather than falling back to production. A preview is applied only after reviewing the status plan.
- scope: preview migrations, preview_database_id

## ADR-DBM-04: Production migrations require confirmation plus MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1
- source: /Users/rmoore/Workspaces/mercora/docs/database-migrations.md
- status: locked (manifest ADR, locked=true; source has no Status field)
- decision: Production apply requires both a command confirmation and the environment guard `MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1 npm run db:migrate:apply:production`. The script verifies migration status after apply and aborts on a failed/unknown status.
- scope: production migrations, MERCORA_ALLOW_PRODUCTION_MIGRATIONS

## ADR-DBM-05: Migrations are additive (expand/contract); back up before destructive production changes
- source: /Users/rmoore/Workspaces/mercora/docs/database-migrations.md
- status: locked (manifest ADR, locked=true; source has no Status field)
- decision: Keep migrations additive: expand first, deploy compatible code, then contract in a later release. Take a durable backup before a destructive or data-changing production migration.
- scope: migration design, expand/contract, production backups

---

## ADR-SUB-01: Subscription acquisition is optional, off by default, and never down-migrated
- source: /Users/rmoore/Workspaces/mercora/docs/subscriptions.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: New subscription acquisition is optional and disabled by default. Migration `0021` is additive and may be deployed while old code is still running. Roll back the application by disabling acquisition; never down-migrate subscription or invoice-order state. After the first subscription exists, reconciliation must remain enabled even while acquisition and its UI are disabled.
- scope: subscription feature flags, migration 0021, rollback

## ADR-SUB-02: Core one-time checkout never treats a plan selection as recurring
- source: /Users/rmoore/Workspaces/mercora/docs/subscriptions.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Core one-time checkout does not call the subscription capability. A product may remain purchasable once even when it also has subscription plans and new acquisition is disabled. Only the dedicated, guarded subscription acquisition route may interpret a plan selection as recurring.
- scope: checkout / subscription boundary

## ADR-SUB-03: Acquisition uses a server-owned SetupIntent and a bounded reservation row
- source: /Users/rmoore/Workspaces/mercora/docs/subscriptions.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Subscription acquisition is not an ordinary paid-order effect. The customer completes a server-owned Stripe SetupIntent; Mercora verifies it belongs to the authenticated customer, then reserves a bounded `subscription_acquisitions` row before asking Stripe to create a subscription. The row id is also the Stripe idempotency key. It stores only the immutable plan billing snapshot, customer, quantity, address, consent, state, and bounded provider identities, never a payment-method id, client secret, or credential. The snapshot may be created only from a currently active plan; later plan deactivation prevents new acquisitions but does not invalidate a reserved retry or a signed lifecycle webhook for an existing acquisition.
- scope: subscription acquisition, Stripe SetupIntent, subscription_acquisitions

## ADR-SUB-04: One acquisition per plan/variant binding
- source: /Users/rmoore/Workspaces/mercora/docs/subscriptions.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Each acquisition represents exactly one plan/variant binding. A UI offering more than one subscription line must create one independent acquisition per line, avoiding an order-level uniqueness boundary and keeping every provider operation independently retryable.
- scope: subscription acquisition

## ADR-SUB-05: Lifecycle state is created only by the signed customer.subscription.created event
- source: /Users/rmoore/Workspaces/mercora/docs/subscriptions.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: The synchronous Stripe create response records only `provider_created` and the subscription id; it must never synthesize a webhook event cursor. The signed `customer.subscription.created` event atomically creates the lifecycle row and opening audit event and completes the acquisition linked from trusted provider metadata. Completion compares provider customer, plan/price identity, currency and amount, cadence, and quantity against the full canonical reserved acquisition. A repeated SetupIntent converges only when plan, customer, quantity, normalized address, and consent all still match.
- scope: subscription lifecycle, customer.subscription.* webhooks

## ADR-SUB-06: Orders come only from verified paid invoices, one order per invoice
- source: /Users/rmoore/Workspaces/mercora/docs/subscriptions.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: No Mercora order exists at acquisition. The first verified paid invoice creates the first order; subsequent paid invoices create renewal orders. `subscription_invoice_orders.stripe_invoice_id` guarantees one order per invoice. No fulfillment effect may be staged until invoice payment is verified and that order has won its durable insert.
- scope: invoice-driven renewal orders, subscription_invoice_orders

## ADR-SUB-07: Lifecycle cursor rules and invoice claims
- source: /Users/rmoore/Workspaces/mercora/docs/subscriptions.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: The lifecycle cursor on `customer_subscriptions` applies only to `customer.subscription.*` snapshots. Older events are audited without mutating state. An equal timestamp with a different event id requires an authoritative provider refresh. Invoice claims use the core `processed_webhook_events` ledger and never advance or block the lifecycle cursor.
- scope: event ordering, customer_subscriptions, processed_webhook_events

## ADR-SUB-08: Pause, scheduled cancellation, and ended_at are separate persisted facts
- source: /Users/rmoore/Workspaces/mercora/docs/subscriptions.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Stripe pause collection is stored separately from subscription status because pausing invoice collection does not change the provider lifecycle status. Scheduled cancellation (`cancel_at`) and end-of-period cancellation are separate persisted facts. `ended_at` records the actual end of service and is not inferred from the cancellation request time.
- scope: subscription lifecycle state

## ADR-SUB-09: Paid-order subscription effect applicability
- source: /Users/rmoore/Workspaces/mercora/docs/subscriptions.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Core checkout stages an optional subscription effect only for paid orders carrying a protected subscription acquisition marker. The capability contract distinguishes an ordinary order (not applicable) from a marked order. While disabled, ordinary orders converge successfully, but a genuine marker must fail and remain retryable rather than silently succeeding through a no-op. Verified subscription invoices do not use that recursive effect: their atomic order writer stages inventory and customer/merchant email effects but excludes the subscription effect. Lifecycle and invoice reconciliation are driven only by signed Stripe webhook events.
- scope: paid-order subscription effect

## ADR-SUB-10: Runtime flag ordering for subscriptions
- source: /Users/rmoore/Workspaces/mercora/docs/subscriptions.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Set `STORE_FEATURE_SUBSCRIPTION_RECONCILIATION=true` before accepting the first subscription. New acquisition additionally requires `STORE_FEATURE_SUBSCRIPTION_ACQUISITION=true` and a bounded `STORE_SUBSCRIPTION_TERMS_VERSION` matching the published recurring terms. To stop new sales, disable acquisition first and leave reconciliation enabled for existing subscriptions, invoices, customer actions, and renewal orders.
- scope: STORE_FEATURE_SUBSCRIPTION_RECONCILIATION, STORE_FEATURE_SUBSCRIPTION_ACQUISITION, STORE_SUBSCRIPTION_TERMS_VERSION

---

## ADR-WRI-01: Webhooks, order state, and inventory are durable, retryable transitions
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Stripe, order state, and variant inventory are treated as a set of durable, retryable transitions. A successful HTTP request is not the recovery mechanism; the D1 ledgers and scheduled worker are.
- scope: processing model

## ADR-WRI-02: One Stripe webhook endpoint with a fixed event subscription list
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Configure one Stripe webhook endpoint at `https://<store-host>/api/webhooks/stripe` subscribed to `payment_intent.succeeded`, `charge.refunded`, `refund.updated`, and `refund.failed`. `charge.refund.updated` is also supported for compatibility with older configurations; `refund.updated` is the preferred lifecycle event. Deployment is incomplete until the endpoint shows successful deliveries for the required events in every Stripe environment the store uses.
- scope: Stripe webhook configuration

## ADR-WRI-03: Stripe secrets live only in Worker secrets
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Worker secrets. Do not put live values in `.env.example`, `wrangler.jsonc`, source files, or Git history. `.env.example` holds placeholders only.
- scope: secrets handling

## ADR-WRI-04: Migrations 0008-0011 apply in numeric order before the matching code deploys
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Apply in numeric order before deploying the corresponding code: `0008_add_processed_webhook_events.sql` (webhook claims, leases, outcomes, retry audit), `0009_add_order_effects.sql` (recoverable post-payment effects), `0010_add_inventory_adjustments.sql` (exactly-once paid decrements and refund restocks), `0011_add_external_refund_restock_setting.sql` (default-off Dashboard full-refund restock policy). Use the repository `db:migrate:*` commands, which include explicit environment confirmation. Do not copy a preview database or migration journal into production.
- scope: D1 migrations 0008-0011

## ADR-WRI-05: Webhook inbox claim/lease semantics
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: `processed_webhook_events` has one row per Stripe event id. Processing acquires a claim token and a five-minute lease; only the current token can mark the event completed or failed. A completed redelivery returns `200` without repeating domain work. An actively leased duplicate returns `503` with `Retry-After: 5`. A transient handler failure records the error and returns `500` so Stripe retries. An expired lease or failed row can be reclaimed. A signed event that cannot belong to an order is recorded as a permanent rejection rather than retried forever.
- scope: processed_webhook_events, webhook inbox

## ADR-WRI-06: order_effects holds deterministic post-payment work
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: `order_effects` stores deterministic work for inventory, coupons, optional gift cards/subscriptions, and confirmation email. Rows are staged before the paid compare-and-swap and remain dormant until the order is authoritatively `paid`. The five-minute cron retries failures and expired leases.
- scope: order_effects

## ADR-WRI-07: inventory_adjustments ledger keys and the inventory authority
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: `inventory_adjustments` is the mutation ledger for variant stock. Paid decrement key `paid:<orderId>:inventory:<variantId>:v1`; refund restock key `restock:<orderId>:<lineId>:v1`. The variant mutation and terminal adjustment status run in one D1 batch; duplicate events converge on the same primary key and cannot apply stock twice. The authoritative inventory value is `product_variants.inventory` JSON (`track_inventory`, `quantity`, `allow_backorder`), which drives storefront availability, the pre-charge check, paid decrements, and restocks. The separate MACH `inventory` table is a compatibility surface and is not read or written by this flow.
- scope: inventory_adjustments, product_variants.inventory

## ADR-WRI-08: Cron drains ledgers; correctness cannot depend on the isolate surviving
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: The cron in `worker.ts` drains order effects and inventory adjustments every five minutes. Inline handlers may attempt foreground work, but correctness must not depend on an isolate surviving after a response.
- scope: worker.ts cron

## ADR-WRI-09: Admin/API refund reservation lifecycle
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: `POST /api/orders/refund` requires `orders:update` and an immutable PaymentIntent binding in both order JSON columns. A bounded refund record is reserved in `orders.extensions.refunds` with CAS before Stripe is called; the Stripe SDK receives a deterministic idempotency key. `pending` and `requires_action` reserve refundable balance; `failed` and `canceled` release it; `succeeded` settles it. A full refund always means the remaining refundable amount, not the original order total. An ambiguous provider failure leaves the reservation pending; retrying reuses the same Stripe key and never creates a replacement request. Reservations without a known Stripe refund id stop automatic create retries after 23 hours and require provider reconciliation. Partial refunds use stable order-line ids and operate on whole lines; multiple partial-quantity returns for one line need a new versioned operation-id contract.
- scope: POST /api/orders/refund, refund ledger

## ADR-WRI-10: Stripe Dashboard refund reconciliation
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: `charge.refunded` is the only event allowed to append a refund Mercora did not originate; the handler validates PaymentIntent/currency/amount bindings and records the charge's cumulative `amount_refunded` as `stripe_amount_refunded`. Mercora never guesses which goods were returned for a Dashboard partial refund and does not restock one. A cumulative full Dashboard refund restocks every outstanding line only when `refund.external_full_restock_enabled = true` (default `false`; malformed or unreadable fails closed). `refund.updated`, `refund.failed`, and legacy `charge.refund.updated` update only an existing ledger record and never append an unattributed refund. Refund settlement and restock-row insertion share one D1 batch; stock is drained separately. Settlement email uses `refund/<stripeRefundId>/succeeded/v1` as its provider idempotency key.
- scope: Dashboard refunds, refund.external_full_restock_enabled

## ADR-WRI-11: Fulfillment hold contract for the future shipment command (U13)
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: The shipment command arrives in U13 and must reject a transition while any refund has status `pending` or `requires_action`. The pre-read check exists only for a clear `refund_pending` response; the same predicate must also be inside the atomic `UPDATE ... SET status = 'shipped'` statement. Already-shipped idempotency/conflict handling must happen before this hold. Use `SHIPMENT_NO_UNSETTLED_REFUNDS_SQL` from `lib/utils/refund-validation.ts`.
- scope: fulfillment hold, SHIPMENT_NO_UNSETTLED_REFUNDS_SQL, U13

## ADR-WRI-12: Legacy order refund rules
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Older orders may lack stable line ids or `checkout_line_allocations`. A full legacy refund is exact (remaining order total). A partial legacy amount is a proportional operator estimate and the admin UI must label it as such. Targeted promotion and per-line provider tax attribution cannot be recreated after the fact. Unknown or ambiguous line identity fails closed instead of restocking a guessed variant. Do not backfill invented allocation data into historical orders.
- scope: legacy orders, refunds

## ADR-WRI-13: Inspection and repair discipline
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Start with read-only inspection of `processed_webhook_events`, `order_effects`, `inventory_adjustments`, and `orders.extensions.refunds`. For provider/local disagreement: inspect Stripe ids, correct the configuration or malformed record deliberately (never delete durable claim rows to force retries), redeliver the original Stripe event (use `charge.refunded` for Dashboard-created refunds), and let the cron drain staged adjustments. `needs_review` rows are terminal and reviewed manually. Avoid direct quantity edits while a related adjustment is retryable; if unavoidable, record the reason and reconcile the adjustment row and order ledger together.
- scope: operations, repair

## ADR-WRI-14: Verification gates run under Node 24; the Workers suite is required
- source: /Users/rmoore/Workspaces/mercora/docs/webhooks-refunds-inventory.md
- status: proposed (source has no Status field; classifier locked=false)
- decision: Run `npm test`, `npm run test:workers`, `npm run typecheck`, and `npm run lint` under the project's Node 24 standard. The Workers suite is a required correctness gate because it verifies D1 batch rollback, JSON predicates, leases, CAS races, and exactly-once adjustment keys against real D1 behavior rather than an in-memory mock.
- scope: verification, Node 24, test:workers
