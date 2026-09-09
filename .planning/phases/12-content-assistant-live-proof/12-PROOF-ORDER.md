# Phase 12 — Live Gift-Card Purchase Proof (SHOP-07)

**Status: HALTED before payment. No card was bought. No money moved. No gift card was issued.**

**Run id:** `phase12-20260909-6a3455`
**Attempted:** 2026-09-09T20:52:46Z by plan 12-05, Task 1 (scripted guest checkout, Stripe test mode)
**Store:** https://voltique.russellkmoore.me
**Halted at:** Task 1 step 6 — the plan's own amount assertion, which fired before the payment was confirmed.

---

## 1. What happened

The plan told the script to check the quoted amount before confirming payment, and to stop if
it was not $25.00. The quote came back **$27.06**. The script stopped there, exactly as written.

| Field | Value |
|---|---|
| Order id (created, never paid) | `WEB-GUEST-1788987166118-30E971BD` |
| Payment intent id (created, never confirmed) | `pi_3UDsU6LL7e1EcFUl0hlGh34j` |
| Quoted subtotal | 2500 minor units ($25.00) — correct |
| Quoted tax | **206 minor units ($2.06) — not expected** |
| Quoted total | 2706 minor units ($27.06) |
| Currency | USD |
| Order status / payment status | `pending` / `pending` |
| `customer_id` on the order | `NULL` (guest checkout, as designed by D-05) |
| Product / variant | `prod_33` / `variant_33`, quantity 1 |
| Recipient in the request | russellkmoore@mac.com ("Russell") |
| Message in the request | Phase 12 live proof — Voltique gift card (run phase12-20260909-6a3455) |
| Delivery date | none sent (D-05) |
| Shipping method id | `digital` |

Both guards passed before anything was called: the proof artifact did not exist, and
`gift_card_accounts` held zero rows. The Stripe credential used was only the public
`pk_test_` publishable key read from the committed `wrangler.jsonc` vars block; the script
also verified that no secret-prefixed Stripe key appears in that file or in the environment.
The client secret returned by the payment-intent response was held in memory only and was
discarded when the script exited — it was never printed, written here, or passed as a shell
argument.

**Current production state, re-read after the halt:**

| Table | Rows | Meaning |
|---|---|---|
| `gift_card_accounts` | 0 | no card was issued |
| `gift_card_deliveries` | 0 | no delivery was queued |
| `email_deliveries` | 0 | no email was sent |

The order row above is an unpaid pending order — the same state an abandoned browser checkout
leaves behind. Two other unpaid guest pending orders from 2026-08-30 already sit in that table,
so this is a pre-existing shape, not new damage. No D1 write of any kind was made by this plan;
that row was written by the production Worker's own payment-intent route.

---

## 2. Why the amount was wrong: Stripe Tax is not working in production

The gift card is explicitly marked nontaxable in the catalogue, and it was still taxed.

**Evidence, all read-only:**

| Check | Result |
|---|---|
| `products.tax_category` / `product_variants.tax_category` for `prod_33` | `txcd_00000000` — Stripe's "nontaxable" code, on both rows |
| `tax_source` recorded on the halted order | `configured_fallback` — **not** `provider` |
| `admin_settings` key `store.tax_rate` | `8.25` |
| 2500 × 8.25% | 206.25 → 206 minor units — exactly the tax that was charged |
| `POST /api/tax` probe (creates no order and no payment) | `calculated_by: "fallback"`, `error: "Stripe Tax unavailable, using fallback rate"` |

So two separate things are true, and only the second one is about gift cards:

1. **Stripe Tax is unavailable on this production store.** Every checkout silently falls back to
   the flat 8.25% configured rate. This affects every order, not just gift cards. The
   independent `/api/tax` probe confirms it is the Stripe Tax call failing, not something
   specific to the gift-card line.
2. **The fallback ignores per-line tax codes.** `lib/services/checkout-pricing.ts` applies the
   configured rate to the whole discounted merchandise total, so a line marked `txcd_00000000`
   is taxed anyway. On the Stripe Tax path the per-line code is passed through and honoured,
   and the gift card would have been taxed $0.

Neither is caused by anything in Phase 12. Both are pre-existing, and both live in
`lib/services/checkout-pricing.ts` and the Stripe account configuration, which this plan is
forbidden to change.

---

## 3. Why the run stopped instead of buying anyway

The purchase is the one irreversible step in this milestone. Buying at $27.06 would have
permanently recorded a real order that charges sales tax on a gift card the catalogue says is
nontaxable, and would have emailed Russell a card whose order shows tax he arguably should not
owe. The plan's own acceptance criteria and `must_haves` say the order total must read 2500 —
that criterion cannot pass while the tax bug is live, so proceeding would have meant knowingly
executing a costly, unreversible action against a criterion already known to fail.

The plan's step 6 says the run stops. It stopped. Nothing was retried, and no second payment
intent was created.

**The decision this needs from Russell** is in the SUMMARY, under "Decision needed".

---

## 4. SHOP-07: the Account → Gift Cards clause is a product gap, not a pending check

This section is independent of the purchase, and it is recorded as a finding rather than as
something still to be verified — because a person signing in would find nothing, by design.

**What SHOP-07 asks for:** the purchased card appears under Account → Gift Cards for the
recipient's account.

**Why that cannot happen, for any recipient who is not the buyer:**

- `GET /api/gift-cards` lists cards through `listCustomerGiftCardPresentations`, whose WHERE
  clause filters on `gift_card_accounts.purchaser_customer_id` — the **purchaser**, never the
  recipient. (`app/api/gift-cards/route.ts`, `lib/gift-cards/presentations.ts`)
- `purchaser_customer_id` is written directly from the order's `customer_id` at issuance.
  (`lib/services/gift-card-fulfillment.ts`)
- A guest checkout writes `customer_id` as `NULL`. **Directly evidenced by this run:** the
  halted order `WEB-GUEST-1788987166118-30E971BD` has `customer_id = NULL`, read back from
  production above. `NULL` can never match `= ?` against any concrete Clerk user id.
- Even a signed-in purchase would set the purchaser column to the **buyer**, not the recipient.
  So a card bought for someone else can never appear in that someone else's account.

**Evidence status, stated plainly:** the account-row form of this evidence — a
`gift_card_accounts` row with a NULL purchaser column — was not obtained, because no card was
issued. The order-row form of the same fact was obtained and is shown above, and it is the value
that issuance copies into the purchaser column. The structural argument itself is verified
against the source of both the write path and the read path (12-RESEARCH.md Pitfall 2).

**What it would take to satisfy the requirement as worded:** matching issued cards to a verified
recipient email address, a change under `lib/gift-cards/`, out of this milestone's scope. It is
already on 12-CONTEXT.md's deferred list as a product gap.

**The decision for Russell:** either the recipient should be able to see cards sent to them
(a product change), or SHOP-07's wording should be corrected to describe what the product
actually does (list cards to their purchaser). This is not a "sign in and check" item.

---

*Phase 12, plan 12-05. Written by the executor at the halt; every value above was read from
production with column-named, order-filtered SELECTs. No gift-card code, ciphertext or nonce
column was ever selected, printed, or recorded — no card exists to have one.*
