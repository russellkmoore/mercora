# Webhooks, refunds, and inventory operations

Mercora treats Stripe, order state, and variant inventory as a set of durable,
retryable transitions. A successful HTTP request is not the recovery mechanism;
the D1 ledgers and scheduled worker are.

## Required Stripe configuration

Configure one Stripe webhook endpoint at:

```text
https://<store-host>/api/webhooks/stripe
```

Subscribe it to these events:

- `payment_intent.succeeded`
- `charge.refunded`
- `refund.updated`
- `refund.failed`

`charge.refund.updated` is also supported for compatibility with older Stripe
event configurations. `refund.updated` is the preferred lifecycle event.

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Worker secrets. Do not put
live values in `.env.example`, `wrangler.jsonc`, source files, or Git history.
The existing `.env.example` contains placeholders for both variables.

Deployment is incomplete until the endpoint shows successful deliveries for the
required events in every Stripe environment the store uses.

## Migration order

Apply migrations in numeric order before deploying the corresponding code:

| Migration | Durable state |
| --- | --- |
| `0008_add_processed_webhook_events.sql` | Webhook claims, leases, outcomes, and retry audit |
| `0009_add_order_effects.sql` | Recoverable post-payment effects |
| `0010_add_inventory_adjustments.sql` | Exactly-once paid decrements and refund restocks |
| `0011_add_external_refund_restock_setting.sql` | Default-off Dashboard full-refund restock policy |

Use the repository migration commands to inspect and apply them:

```bash
npm run db:migrate:status:preview
npm run db:migrate:apply:preview
npm run db:migrate:status:production
npm run db:migrate:apply:production
```

The apply commands include explicit environment confirmation. Do not copy a
preview database or migration journal into production.

## Durable processing model

### Webhook inbox

`processed_webhook_events` has one row per Stripe event id. Processing acquires
a claim token and five-minute lease. Only the current token can mark the event
completed or failed.

- A completed redelivery returns `200` without repeating domain work.
- An actively leased duplicate returns `503` with `Retry-After: 5`.
- A transient handler failure records the error and returns `500`, allowing
  Stripe to retry.
- An expired processing lease or failed row can be reclaimed.
- A signed event that cannot belong to an order is recorded as a permanent
  rejection rather than retried forever.

### Paid-order effects

`order_effects` stores deterministic work for inventory, coupons, optional gift
cards/subscriptions, and confirmation email. Rows are staged before the paid
compare-and-swap and remain dormant until the order is authoritatively `paid`.
The five-minute cron retries failures and expired leases.

### Inventory adjustments

`inventory_adjustments` is the mutation ledger for variant stock:

- Paid decrement key: `paid:<orderId>:inventory:<variantId>:v1`
- Refund restock key: `restock:<orderId>:<lineId>:v1`

The variant mutation and terminal adjustment status run in one D1 batch. A
crash cannot commit the quantity change without its terminal marker. Duplicate
events converge on the same primary key and cannot apply stock twice.

The authoritative inventory value is `product_variants.inventory` JSON. Its
`track_inventory`, `quantity`, and `allow_backorder` fields drive storefront
availability, the pre-charge checkout check, paid decrements, and restocks. The
separate MACH `inventory` table remains a compatibility surface and is not read
or written by this flow.

The cron in `worker.ts` drains order effects and inventory adjustments every
five minutes. Inline handlers may attempt foreground work, but correctness must
not depend on an isolate surviving after a response.

## Refund behavior

### Admin/API refunds

`POST /api/orders/refund` requires `orders:update` permission and an immutable
PaymentIntent binding in both order JSON columns.

1. A bounded refund record is reserved in `orders.extensions.refunds` with a
   compare-and-swap before Stripe is called.
2. The Stripe SDK receives a deterministic idempotency key as request options.
3. `pending` and `requires_action` reserve the refundable balance.
4. `failed` and `canceled` release that reservation.
5. `succeeded` settles it. A full refund always means the remaining refundable
   amount, not the original order total.

An ambiguous provider failure leaves the reservation pending. Retrying the
same request reuses the same Stripe key. Do not create a replacement request to
work around a timeout. Reservations without a known Stripe refund id stop
automatic create retries after 23 hours and require provider reconciliation.

Partial refunds use stable order-line ids. Current returns operate on whole
lines; supporting multiple partial-quantity returns for one line requires a new
versioned operation-id contract.

### Stripe Dashboard refunds

`charge.refunded` is the only event allowed to append a refund that Mercora did
not originate. The handler lists the bounded Stripe refund collection, validates
PaymentIntent/currency/amount bindings, and records the charge's cumulative
`amount_refunded` as `stripe_amount_refunded`.

Mercora never guesses which goods were returned for a Dashboard partial refund,
so it does not restock one. A cumulative full Dashboard refund can restock every
outstanding line only when the operator enables:

```text
refund.external_full_restock_enabled = true
```

The setting defaults to `false`. A malformed or unreadable setting fails closed.

`refund.updated`, `refund.failed`, and legacy `charge.refund.updated` retrieve
fresh Stripe state and may update only an existing ledger record. They never
append an unattributed refund. The next `charge.refunded` event performs that
authoritative reconciliation.

Refund settlement and deterministic restock-row insertion share one D1 batch.
Stock is drained separately, so a webhook can be retried without repeating a
restock. Settlement email uses `refund/<stripeRefundId>/succeeded/v1` as its
provider idempotency key.

## Fulfillment hold contract

Mercora does not yet contain the shipment command; that arrives in U13. That
command must reject a transition while any refund has status `pending` or
`requires_action`.

The pre-read check is only for a clear `refund_pending` response. The same
predicate must also be inside the atomic `UPDATE ... SET status = 'shipped'`
statement, otherwise a refund reservation can land between the read and write.
Already-shipped idempotency/conflict handling must happen before this hold,
because a later refund cannot undo a physical shipment.

Use `SHIPMENT_NO_UNSETTLED_REFUNDS_SQL` from
`lib/utils/refund-validation.ts` in that future compare-and-swap. Its tested JSON
guard ignores absent, malformed, scalar, and substring-only legacy values while
blocking well-formed reserved refund objects.

## Legacy orders

Older orders may lack stable line ids or `checkout_line_allocations`.

- A full legacy refund remains exact because it uses the remaining order total.
- A partial legacy amount is a proportional operator estimate and the admin UI
  must label it as such.
- Targeted promotion and per-line provider tax attribution cannot be recreated
  exactly after the fact.
- Unknown or ambiguous line identity fails closed instead of restocking a
  guessed variant.

Do not backfill invented allocation data into historical orders.

## Inspection and repair

Start with read-only inspection:

```sql
SELECT event_id, event_type, status, outcome, attempt_count,
       lease_expires_at, last_error, updated_at
FROM processed_webhook_events
WHERE status <> 'completed'
ORDER BY updated_at;

SELECT effect_key, order_id, effect_type, status, attempt_count,
       lease_expires_at, next_attempt_at, last_error
FROM order_effects
WHERE status <> 'succeeded'
ORDER BY updated_at;

SELECT adjustment_key, order_id, line_id, variant_id, kind, status,
       attempt_count, lease_expires_at, next_attempt_at, last_error, result
FROM inventory_adjustments
WHERE status NOT IN ('succeeded', 'skipped')
ORDER BY updated_at;

SELECT id, payment_status,
       json_extract(extensions, '$.refunds_version') AS refunds_version,
       json_extract(extensions, '$.stripe_amount_refunded') AS stripe_floor,
       json_extract(extensions, '$.refunds') AS refunds
FROM orders
WHERE json_array_length(
  CASE
    WHEN json_valid(COALESCE(extensions, '{}')) = 1
      AND json_type(extensions, '$.refunds') = 'array'
      THEN json_extract(extensions, '$.refunds')
    ELSE '[]'
  END
) > 0;
```

For provider/local disagreement:

1. Inspect the PaymentIntent, charge, and refund ids in Stripe.
2. Correct the underlying configuration or malformed local record deliberately;
   do not delete durable claim rows to force retries.
3. Redeliver the original Stripe event from the Dashboard. Use
   `charge.refunded` when Dashboard-created refunds need attribution.
4. Let the cron drain any staged adjustment. Review `needs_review` rows manually;
   they are terminal because automatic mutation would be unsafe.

Avoid direct quantity edits while a related adjustment is retryable. If a
manual repair is unavoidable, record the reason and reconcile the adjustment
row and order ledger together.

## Verification

Run both suites under the project's Node 24 standard:

```bash
npm test
npm run test:workers
npm run typecheck
npm run lint
```

The Workers suite is a required correctness gate because it verifies D1 batch
rollback, JSON predicates, leases, CAS races, and exactly-once adjustment keys
against real D1 behavior rather than an in-memory mock.
