# Migration reservations

The optional platform pass assigns migration numbers from the current Mercora
ledger. Reservations prevent parallel feature branches from reusing a number.

| Migration | Owner | Purpose | State |
| --- | --- | --- | --- |
| `0018` | `O01` | Email preferences and unsubscribe suppression | Merged |
| `0019` | `O02` | Blog and neutral structured content publishing | Merged |
| `0020` | `O05` | Exact legacy redirects for the Shopify migration toolkit | In review on PR `#75` |
| `0021` | `O06` | Subscription plans, lifecycle, audit, and renewal-order identity | Reserved on `agent/o06-subscriptions` |
| `0022` | `O07` | Gift-card account, ledger, reservation, and delivery state | Reserved for `O07` |

The next unreserved schema-bearing extraction must start at `0023` and
reconcile against the then-current main branch before it commits a migration.
