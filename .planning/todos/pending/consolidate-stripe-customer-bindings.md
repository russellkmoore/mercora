---
title: Consolidate the two Stripe Customer binding tables (payment_customers and subscription_provider_customers)
created: 2026-09-11
resolves_phase: 18
source: Phase 17 (Saved Payment Methods), D-02
audit_acknowledged:
  milestone: v2.2
  at: 2026-09-11
---

# Two separate Stripe Customer bindings

Phase 17 added `payment_customers` — a new D1 table binding a Clerk `userId` to a Stripe
Customer id, used for saved cards at checkout. The store already had
`subscription_provider_customers`, an existing table doing the same binding for subscriptions,
with its own repository (`lib/subscriptions/repository.ts`).

Phase 17 deliberately did **not** reuse `subscription_provider_customers`. Sharing one table
would have meant editing revenue-critical, already-shipped subscription code in the same
unattended run that was also standing up the new checkout/account payment-methods surface —
too much blast radius for one pass. `payment_customers` was added alongside it instead,
scoped only to the new code paths.

## The concrete cost

A shopper who both has an active subscription and saves a card at checkout ends up with two
separate Stripe Customer objects — one bound in each table. A card saved at checkout is not
offered when that shopper later manages or renews a subscription, and a subscription's payment
method is not offered as a saved card at checkout. The shopper sees no saved payment method in
either direction, even though Stripe holds one for each.

## Wanted (Phase 18, tech debt)

- One binding table both features read: either fold `payment_customers` into
  `subscription_provider_customers`'s shape, or the reverse — either way, a single table and a
  single repository function for "get or create this shopper's Stripe Customer id."
- Existing `subscription_provider_customers` rows migrated onto the consolidated table
  expand-only (new migration, no edit to an applied one).
- The duplicate Stripe Customer objects reconciled for any shopper who already has both — decide
  which Customer id wins, merge or archive the other via the Stripe API, and update the local
  binding to point at the survivor.
- Files that would change: `lib/payments/customer-binding.ts` (the new Phase 17 binding logic),
  `lib/subscriptions/repository.ts` (the existing subscription binding logic it would be merged
  with or migrated onto), and `lib/db/schema/subscriptions.ts` (the schema owning
  `subscription_provider_customers`, which the consolidated table's migration builds on).

---
