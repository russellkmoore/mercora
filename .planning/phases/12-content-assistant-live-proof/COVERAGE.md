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

| | |
|---|---|
| New provider | none |
| New SDK or dependency | none — the confirm call is a plain `fetch` to an endpoint already in use |
| New credential | none — only the existing public publishable key |
| New secret | none; no Stripe secret key is read, held, or referenced anywhere in this phase |
| New surface for a reviewer to audit | none beyond the existing checkout trust boundary documented in `docs/checkout-trust-boundary.md` |

The server side is unchanged and untouched: `POST /api/orders` re-verifies the payment intent
with the Worker's own Stripe secret key and never trusts what the client reports. Reproducing the
browser's confirm call from a script does not widen that boundary — it exercises it.

## One finding about the existing Stripe integration

The 12-05 run surfaced a pre-existing problem in an already-integrated surface, recorded here
because it concerns Stripe rather than because this phase changed anything:

**Stripe Tax is unavailable on the production store.** Every checkout silently falls back to the
flat `store.tax_rate` (8.25%) configured in `admin_settings`, and that fallback path ignores
per-line tax codes — so a catalogue line explicitly marked nontaxable (`txcd_00000000`, which is
what the gift card carries) is taxed anyway. Confirmed independently by `POST /api/tax`, which
reports `calculated_by: "fallback"` with `"Stripe Tax unavailable, using fallback rate"`.

Details and evidence are in `12-PROOF-ORDER.md` §2. No code was changed in response; the fix
lives in `lib/services/checkout-pricing.ts` and the Stripe account's Tax configuration, both
outside this phase's scope.
