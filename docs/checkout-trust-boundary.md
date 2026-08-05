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
   `succeeded`, matching metadata/order ids, matching currency, an exact
   authorized amount, and an `amount_received` at or above the persisted server
   charge floor. The paid order records the actual captured receipt amount.
5. A guarded `pending`/`pending` to `processing`/`paid` update first proves a
   paid order. Promotion usage is then atomically audited by order on both the
   winning call and already-paid retries, allowing transient audit failures to
   recover without mutating coupons for cancelled or missing orders. Idempotent
   tender settlement and subscription activation also run idempotently on the
   winner and already-paid retries so transient failures can recover. Only the
   transition winner runs the best-effort confirmation email.

The browser cannot assert an order owner, paid status, item display data,
prices, totals, discounts, tax, or shipping. It receives the authoritative
quote used by Stripe so the payment screen cannot display a different total.

Destination policy is configured with `shipping.allowed_countries` as ISO
alpha-2 codes. Missing, empty, or malformed configuration fails back to
`['US']`. The shipping estimator and authoritative pricing share this policy
and the same enabled fresh-install methods (standard, express, and overnight),
so enabling a destination requires one explicit shipping configuration change.

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
when quoted and reverified before the paid CAS. Already-paid recovery does not
require the original reservation to remain open; tender settlement is keyed by
order, required to be idempotent, and retried during paid convergence.
Subscription `orderPaid` implementations have the same order-idempotent retry
contract.

When concurrent checkouts race for the last coupon use, Mercora honors each
already-captured order's persisted server quote rather than stranding paid
funds. A losing redemption writes the protected
`coupon_reconciliation_codes` marker on the paid order for operational repair;
temporary usage overage is accepted until a later reservation/effect-ledger
schema can prevent the race before capture.

## Scope and schema

This boundary does not consume inventory, execute refunds, implement webhook
deduplication, expose MCP operations, or start fulfillment.

No database migration is required. The existing `orders` columns already hold
the durable pending state, canonical line snapshot, Money values, and guarded
extension metadata. Promotion consumption uses an atomic JSON audit append in
the existing `coupon_instances.extensions` column.
