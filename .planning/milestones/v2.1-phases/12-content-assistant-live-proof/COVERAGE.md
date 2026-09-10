# Phase 12 — API Coverage Note

**No external API integration is introduced by this phase.**

Stripe is already integrated and has been since long before this milestone. The live-proof plan
(12-05) calls exactly one Stripe endpoint,
`POST https://api.stripe.com/v1/payment_intents/{id}/confirm`, which is the same call the
browser already makes through Stripe.js during a normal checkout. It is authenticated with the
public `pk_test_` publishable key that already sits in the committed `wrangler.jsonc` `vars`
block, together with the per-intent client secret returned by the store's own
`POST /api/payment-intent` response.

So this phase adds:

| What could have been added | What was actually added |
|---|---|
| New provider | none |
| New SDK or dependency | none — the confirm call is a plain `fetch` to an endpoint already in use |
| New credential | none — only the existing public publishable key |
| New secret | none; no Stripe secret key is read, held, or referenced anywhere in this phase |
| New surface for a reviewer to audit | none beyond the existing checkout trust boundary documented in `docs/checkout-trust-boundary.md` |

The server side is unchanged and untouched: `POST /api/orders` re-verifies the payment intent
with the Worker's own Stripe secret key and never trusts what the client reports. Reproducing the
browser's confirm call from a script does not widen that boundary — it exercises it.

## Two findings about the existing Stripe integration

The 12-05 run surfaced two pre-existing problems in an already-integrated surface, recorded here
because they concern Stripe rather than because this phase introduced them.

**1. The configured-rate tax fallback ignored per-line tax codes — FIXED.** A catalogue line
explicitly marked nontaxable (`txcd_00000000`, which is what the gift card carries) was taxed
anyway whenever the fallback ran, because the flat rate was applied to the whole discounted
merchandise total. Commit `3b821f7` gives nontaxable lines zero weight in both the taxable base
and the per-line allocation, matching what the Stripe Tax path already did. Deployed
2026-09-09T21:05:06Z, with a regression test.

**2. Stripe Tax is unavailable on the production store — STILL OPEN.** Every checkout silently
falls back to the flat `store.tax_rate` (8.25%) configured in `admin_settings`, so every taxable
order is charged a guessed rate rather than a calculated one. Confirmed independently by
`POST /api/tax`, which reports `calculated_by: "fallback"` with
`"Stripe Tax unavailable, using fallback rate"`. The fix is in the Stripe account's Tax
configuration, not in this repository.

Details and evidence are in `12-PROOF-ORDER-attempt1.md` §2.
