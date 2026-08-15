# Subscriptions

New subscription acquisition is optional and disabled by default. Migration `0021` is
additive and may be deployed while old code is still running. Roll back the
application by disabling acquisition; never down-migrate subscription or
invoice-order state. After the first subscription exists, reconciliation must
remain enabled even while acquisition and its UI are disabled.
Core one-time checkout does not call the subscription capability. A product may
therefore remain purchasable once even when it also has subscription plans and
new subscription acquisition is disabled. Only the dedicated, guarded
subscription acquisition route may interpret a plan selection as recurring.

## Acquisition and initial order

Subscription acquisition is not an ordinary paid-order effect. The customer
first completes a server-owned Stripe SetupIntent. Mercora verifies that the
SetupIntent belongs to the authenticated customer, then reserves a bounded
`subscription_acquisitions` row before asking Stripe to create a subscription.
The row id is also the Stripe idempotency key. It stores only the immutable
plan billing snapshot, customer, quantity, address, consent, state, and bounded
provider identities—never a payment-method id, client secret, or credential.
The repository may create that snapshot only from a currently active plan.
Later plan deactivation prevents new acquisitions but does not invalidate a
reserved retry or signed lifecycle webhook for an existing acquisition.

Each acquisition represents exactly one plan/variant binding. A UI that offers
more than one subscription line must create one independent acquisition per
line. This avoids an order-level uniqueness boundary and makes every provider
operation independently retryable.

The synchronous Stripe create response records only `provider_created` and the
subscription id; it must never synthesize a webhook event cursor. The signed
`customer.subscription.created` event atomically creates the lifecycle row and
opening audit event, and completes the acquisition linked from trusted provider
metadata. Completion compares the provider customer, plan/price identity,
currency and amount, cadence, and quantity against the full canonical reserved
acquisition. A repeated SetupIntent converges only when plan, customer,
quantity, normalized address, and consent all still match. No Mercora order
exists yet. The first
verified paid invoice creates the first order; subsequent paid invoices create
renewal orders. `subscription_invoice_orders.stripe_invoice_id` guarantees one
order per invoice. No fulfillment effect may be staged until invoice payment is
verified and that order has won its durable insert.

## Event ordering

The lifecycle cursor on `customer_subscriptions` applies only to
`customer.subscription.*` snapshots. Older events are audited without mutating
state. An equal timestamp with a different event id requires an authoritative
provider refresh. Invoice claims use the core `processed_webhook_events` ledger
and never advance or block the lifecycle cursor.

Stripe pause collection is stored separately from subscription status because
pausing invoice collection does not change the provider lifecycle status.
Scheduled cancellation (`cancel_at`) and end-of-period cancellation are also
separate persisted facts. `ended_at` records the actual end of service and is
not inferred from the cancellation request time.

## Paid-order effect applicability

Core checkout currently stages an optional subscription effect for every paid
order. The capability contract distinguishes an ordinary order (not
applicable) from an order carrying a protected subscription acquisition marker.
While disabled, ordinary orders converge successfully, but a genuine marker
must fail and remain retryable rather than silently succeeding through a no-op.
The route/effect wave must conditionally stage from the protected marker before
subscriptions can be enabled.
