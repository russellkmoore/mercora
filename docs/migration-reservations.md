# Migration reservations

The optional platform pass assigns migration numbers from the current Mercora
ledger. Reservations prevent parallel feature branches from reusing a number.

| Migration | Owner | Purpose | State |
| --- | --- | --- | --- |
| `0018` | `O01` | Email preferences and unsubscribe suppression | Merged |
| `0019` | `O02` | Blog and neutral structured content publishing | Reserved on `agent/o02-content-publishing` |

The next schema-bearing extraction must start at `0020` and reconcile against
the then-current main branch before it commits a migration.
