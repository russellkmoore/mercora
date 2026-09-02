# Order and checkout trust boundary

**Status:** Accepted (2026-08-05)

Mercora treats checkout as one server-owned state transition rather than a
client-created paid order.

## Checkout sequence

1. The browser sends product ids, variant ids, quantities, a destination,
   shipping-method id, and optional promotion codes to `POST /api/payment-intent`.
2. Mercora resolves the active catalog entities and recomputes canonical line
   names, SKUs, prices, discounts, taxable line bases, tax, shipping, optional
   reserved tender, and the final cash charge with `Money`. It persists exact
   discount and tax allocation by stable line id and verifies authoritative
   variant availability before creating the PaymentIntent.
3. Mercora creates the PaymentIntent, then persists a `pending` order containing
   the provider-reported amount and immutable PaymentIntent binding. If the D1
   insert fails, Mercora attempts to cancel the intent and never returns its
   client secret.
4. Inline completion, redirect return, and the signed Stripe webhook all call
   the same finalizer. It retrieves the PaymentIntent server-side and requires
   `succeeded`, matching metadata/order ids, matching currency, an exact
   authorized amount, and an `amount_received` at or above the persisted server
   charge floor. The paid order records the actual captured receipt amount.
5. Deterministic order-effect rows are staged before a guarded
   `pending`/`pending` to `processing`/`paid` update. They remain dormant until
   that update proves the order paid. The winner and already-paid retries drain
   the same durable effects for inventory, promotion audit, optional tender and
   subscription capabilities, and confirmation email. The five-minute cron
   recovers transient failures and expired leases.

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

## Inventory and refund authority

`product_variants.inventory` is the checkout and storefront authority. Tracked,
non-backorderable variants must have sufficient integer quantity before Stripe
is called. Paid decrements are keyed by order and variant in
`inventory_adjustments`; the quantity mutation and terminal adjustment marker
commit in one D1 batch.

Refunds require the immutable PaymentIntent binding in both protected order JSON
columns. Mercora reserves cumulative refundable balance before calling Stripe,
uses a deterministic provider idempotency key, and reconciles delayed or
Dashboard refunds from signed Stripe events. Exact local returned lines stage
deterministic restocks. Dashboard partial refunds never guess line attribution,
and full Dashboard restocking is an explicit default-off operator policy.

See [Webhooks, refunds, and inventory operations](./webhooks-refunds-inventory.md)
for event subscriptions, retries, repair queries, and migration order.

## Fulfillment boundary

Mercora still has no shipment command. The future atomic shipment transition
must include `SHIPMENT_NO_UNSETTLED_REFUNDS_SQL` so a `pending` or
`requires_action` refund reservation cannot race a transition to `shipped`.
The accompanying real-D1 contract test covers malformed and legacy JSON shapes;
U13 must replace that contract-only coverage with an end-to-end shipment CAS
test.

## Scope and schema

MCP `create_payment_intent` and `place_order` use the same shared checkout
pricing service (`lib/services/checkout-pricing.ts`) and the same idempotent
finalizer (`lib/services/order-finalization.ts`) as the storefront
`POST /api/orders` route and the Stripe webhook path.
MCP checkout is inside the paid inventory boundary.

An earlier version of this document stated MCP checkout was outside the
boundary; that was corrected on 2026-09-02 after verifying the code.

The existing `orders` columns hold pending state, canonical line and Money
snapshots, immutable provider bindings, and the versioned refund ledger. U09
adds migrations `0008` through `0011` for webhook claims, paid effects,
inventory adjustments, and the external full-refund restock setting.
