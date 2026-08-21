# O07 Gift Cards: Completion Plan

## Scope and completed foundation

O07 provides generic stored-value gift cards for Mercora, stacked on
`agent/o06-subscriptions`. The branch currently contains the security and
ledger foundation:

- Cart lines have stable identifiers and bounded gift-card recipient fields.
- Migration `0022` and the Drizzle schema model cards, append-only ledger
  entries, and delivery state.
- Bearer codes are versioned 140-bit values represented in storage only by a
  keyed HMAC digest; raw codes are never persisted with an order or card.
- Cards support append-only issuance, reservation, settlement, release,
  expiration, and refund-restoration guards.
- Retry-delivery material is encrypted with AES-GCM, and checkout acquisition
  is a separately configurable lazy capability while reconciliation remains
  available.
- D1 migration, atomicity, and concurrency tests exercise the foundation.

## Implementation waves

1. **Authoritative mixed-cart calculation and snapshots.** Classify digital
   gift-card lines in server pricing; exclude them from shipping and inventory;
   retain physical shipping for mixed carts; calculate promotion/tax/shipping
   using the current framework contracts; persist immutable order snapshots
   without bearer codes.
2. **Checkout and MCP tender lifecycle.** Add web and MCP acquisition,
   request-identity-bound reservation and explicit release/expiry. Finalize
   partial-gift purchases with positive cash through the payment boundary, and
   finalize fully funded purchases through a genuine no-Stripe, zero-cash
   path. Gift-card value must never pay for a gift-card line.
3. **Issuance and delivery.** Issue cards idempotently only after successful
   order finalization; deliver through a provider-neutral, retryable email
   boundary. The raw code exists only transiently in encrypted retry material
   and delivery rendering.
4. **Refund convergence.** Allocate refunds between cash and gift tender,
   restore gift value exactly once, and mark a refund complete only after its
   cash and gift restoration legs have both converged.
5. **Safe presentation surfaces.** Add customer/admin APIs and UI, public
   rate limiting and enumeration-resistant responses, and secret-safe
   projections with no raw code or encrypted material leakage.
6. **Runtime composition and audit.** Connect scheduler/runtime composition
   for reconciliation, reservation expiry, and delivery retries; finish docs
   and the complete unit, integration, worker, API/MCP, and UI test matrix.
7. **Stack validation and handoff.** Rebase the completed worktree on
   `agent/o06-subscriptions` without rewriting the existing O07 history,
   validate the full suite, push, and open one draft O07 PR stacked on O06 and
   assigned to Russell. This final wave requires explicit GitHub/network action
   only when requested/available; development performs no provider calls.

## Provenance and exclusions

Behavioral provenance is frozen downstream source
`/Users/devon/git/mercora-beauteas-v1.0.0`, principally its Phase 8 migration
plan and gift-card behavior/follow-ups at `30a70f5`, `a965cfe`, `ba58808`,
`0c64aec`, `7b7da32`, `6f64b57`, `fe15622`, `7371ed5`, and `1fa7c81`.
Those commits are inspected as evidence, not merged, rebased, or blindly
cherry-picked. Mercora implementations must use current upstream contracts and
exclude BeauTeas branding, copy, catalog/denominations, merchant policy,
provider/infrastructure identifiers, credentials, and plaintext-code design.

## Security and commerce invariants

- Raw bearer codes never enter D1, logs, telemetry, order metadata, API/MCP
  projections, or UI state beyond the immediate redemption/delivery boundary.
- Code storage remains a keyed digest; retry material remains encrypted and is
  revealed only transiently for a claimed delivery attempt.
- Reconciliation can run when acquisition is disabled. Reservation operations
  use a stable request identity and explicit release or expiry.
- Gift tender cannot purchase gift-card value. A full gift tender finalizes
  through a real zero-cash path, never a fabricated zero-dollar Stripe intent.
- Digital-only orders have no shipping; mixed orders preserve physical shipping.
  Gift-card products are never inventory-adjusted.
- All final order amounts, tender allocation, inventory actions, and issuance
  eligibility are server authoritative and snapshot-based.
- Issuance, delivery, settlement, releases, and refund restoration are
  idempotent. Refund completion requires both cash and gift legs to converge.
- No development or tests invoke payment/email providers, send email, use
  credentials, deploy, or write external resources.

## Test matrix

| Area | Required coverage |
| --- | --- |
| Pricing and fulfillment | Digital-only, physical-only, and mixed carts; promotion/tax/shipping; no gift-card self-purchase; immutable snapshots; no gift inventory mutation |
| Tender lifecycle | Web and MCP acquire/retry/release/expiry; stable request identity; partial and full tender finalization; positive-cash payment binding |
| Issuance and delivery | Idempotent issuance; encrypted retry material; claim/release single-flight delivery; no raw-code persistence or projection leakage |
| Refunds | Cash-only, gift-only, split tender, retry/idempotency, and dual-leg completion convergence |
| Public/admin surfaces | Input bounds, rate limit fail mode, enumeration resistance, authorization, and safe customer/admin projections |
| Runtime and D1 | Scheduler composition, migration application/order, real-D1 atomicity/concurrency, reconciliation, expiry, and worker-safe configuration |
| Regression | Focused unit/API/MCP/worker/UI tests plus lint, typecheck, build, and relevant existing checkout/subscription suites |

## PR dependency chain

`O03 runtime safety` → `O06 subscriptions / order-trust + webhook-inventory-
refund foundations` → `O07 gift cards`.

O07 remains one draft PR based on `agent/o06-subscriptions`; it must not merge
or rebase against the unrelated BeauTeas `main` history. The expected reviewer
assignment is Russell.
