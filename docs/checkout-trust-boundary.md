# Order and checkout trust boundary

Mercora treats checkout as one server-owned state transition rather than a
client-created paid order.

## Checkout sequence

1. The browser sends product ids, variant ids, quantities, a destination,
   shipping-method id, and optional promotion codes to `POST /api/payment-intent`.
2. Mercora resolves the active catalog entities and recomputes canonical line
   names, SKUs, prices, discounts, taxable line bases, tax, shipping, optional
   reserved tender, and the final cash charge with `Money`.
3. Mercora creates the PaymentIntent, then persists a `pending` order containing
   the provider-reported amount and immutable PaymentIntent binding. If the D1
   insert fails, Mercora attempts to cancel the intent and never returns its
   client secret.
4. Inline completion, redirect return, and the signed Stripe webhook all call
   the same finalizer. It retrieves the PaymentIntent server-side and requires
   `succeeded`, matching metadata/order ids, matching currency, and an
   `amount_received` at or above the persisted server charge floor.
5. A guarded `pending`/`pending` to `processing`/`paid` update chooses one winner.
   Only that winner consumes promotion usage, applies optional capability
   effects, and sends the confirmation email.

The browser cannot assert an order owner, paid status, item display data,
prices, totals, discounts, tax, or shipping. It receives the authoritative
quote used by Stripe so the payment screen cannot display a different total.

## Authorization and metadata

- Customer order history is SQL-scoped to the authenticated Clerk user.
- Order detail and receipt data require the owner or an authenticated
  `orders:read` admin. An order id is never a guest read credential.
- Generic `PUT /api/orders` accepts only `notes`, `external_references`, and
  `extensions`. It cannot perform lifecycle, fulfillment, ownership, money, or
  payment transitions.
- JSON metadata is merged with compare-and-swap lost-update protection.
  `payment_intent_id` is immutable in both JSON columns, and every extension key
  read by payment, refund, fulfillment, agent ownership, or checkout accounting
  is protected from generic writers.

## Optional capabilities

Gift cards and subscriptions implement interfaces in
`lib/commerce/capabilities.ts`; core checkout does not import either feature.
Defaults are no-ops. A nonzero optional tender must be authoritatively reserved
when quoted and reverified before the paid CAS. Tender settlement is required
to be idempotent.

## Scope and schema

This boundary does not consume inventory, execute refunds, implement webhook
deduplication, expose MCP operations, or start fulfillment.

No database migration is required. The existing `orders` columns already hold
the durable pending state, canonical line snapshot, Money values, and guarded
extension metadata. Promotion consumption uses an atomic JSON audit append in
the existing `coupon_instances.extensions` column.
