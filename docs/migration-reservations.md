# Migration reservations

The optional platform pass assigns migration numbers from the current Mercora
ledger. Reservations prevent parallel feature branches from reusing a number.

| Migration | Owner | Purpose | State |
| --- | --- | --- | --- |
| `0018` | `O01` | Email preferences and unsubscribe suppression | Reserved on `agent/o01-customer-communications` |

After O01 merges, later schema work (including O02 and O05) must start after
`0018` and reconcile against the then-current main branch.
