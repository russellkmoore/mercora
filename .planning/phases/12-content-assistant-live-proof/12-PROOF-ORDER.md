# Phase 12 — Live Gift-Card Purchase Proof (SHOP-07)

**Attempt 2.** Attempt 1 halted before payment on a production tax finding and bought
nothing; its record is preserved verbatim in `12-PROOF-ORDER-attempt1.md` and is still the
authority on that finding. The fallback-tax fix (`3b821f7`) was deployed at
2026-09-09T21:05:06Z before this attempt ran.

**Run id:** `phase12-20260909-80403f`
**Executed:** 2026-09-09T21:24:15.669Z by plan 12-05, Task 1 (scripted guest checkout, Stripe test mode)
**Store:** https://voltique.russellkmoore.me

## 1. Order created (POST /api/payment-intent)

| Field | Value |
|---|---|
| Order id | `WEB-GUEST-1788989054887-B4382C10` |
| Payment intent id | `pi_3UDsyZLL7e1EcFUl0KV8QOiJ` |
| Amount | 2500 minor units ($25.00) |
| Currency | USD |
| Product / variant | `prod_33` / `variant_33`, quantity 1 |
| Recipient | russellkmoore@mac.com ("Russell") |
| Recipient message | Phase 12 live proof — Voltique gift card (run phase12-20260909-80403f) |
| Delivery date | none sent (D-05) |
| Shipping method id | `digital` |
| Purchaser | guest (no Clerk session) |
| Timestamp | 2026-09-09T21:24:15.669Z |

The client secret returned alongside these fields was held in memory only for the
duration of the confirm call: never printed, never written here, never passed as a
shell argument. Stripe requires it never be stored, logged, or exposed.

## 2. Payment confirmed (Stripe test mode)

| Field | Value |
|---|---|
| Endpoint | `POST https://api.stripe.com/v1/payment_intents/{id}/confirm` |
| Auth | public `pk_test_` publishable key (HTTP basic username, empty password) |
| Payment method | `pm_card_visa` (Stripe test Visa) |
| Returned status | **succeeded** |
| Timestamp | 2026-09-09T21:24:16.548Z |

## 3. Order finalized (POST /api/orders)

| Field | Value |
|---|---|
| Request body | `orderId` + `paymentIntentId` only |
| HTTP status | **200** |
| Response | `{"data":{"id":"WEB-GUEST-1788989054887-B4382C10"},"meta":{"schema":"mach:order","idempotent":false}}` |
| Server-side check | `finalizeOrderPayment` re-retrieved the PaymentIntent with the server's own secret key and matched status, order id, currency and amount against its own quote. The client's report of success is never trusted. |
| Timestamp | 2026-09-09T21:24:19.187Z |


## 4. Read-only evidence

Every query below names its columns explicitly and filters on this run's order. No column whose
name begins with the code prefix, and no ciphertext or nonce column, was ever selected (D-07).
Account and delivery row ids are deliberately omitted from this artifact as well, per the
carried-forward rule that no account id appears in any artifact.

### Order (`orders`, by `id`)

| Column | Value |
|---|---|
| status | `processing` |
| payment_status | **`paid`** |
| total_amount | **2500 USD** |
| currency_code | USD |

Read at 2026-09-09T21:24:35Z. The total is exactly the $25.00 list price — no tax — which is the
fallback-tax fix (`3b821f7`) behaving as intended for a nontaxable line.

### Issued gift card (`gift_card_accounts`, by `issued_order_id`)

| Column | Value |
|---|---|
| rows for this order | **exactly 1** |
| status | **`active`** |
| currency_code | USD |
| issued_amount_minor | **2500** |
| purchaser_customer_id | **NULL** |
| created_at | 1788989057 (2026-09-09T21:24:17Z) |

Issuance ran synchronously at finalization — about two seconds after the order was paid, not on a
later cron cycle.

### Delivery (`gift_card_deliveries`, by `order_id`) — **did not reach `sent` within two cycles; see §7 for the eventual send**

| Observed at | status | attempt_count | deliver_after | completed_at |
|---|---|---|---|---|
| 21:25:00Z | `pending` | 1 | 0 | NULL |
| 21:27:04Z | `pending` | 2 | 0 | NULL |
| 21:28:55Z | `pending` | 2 | 0 | NULL |
| 21:35:51Z | `pending` | **4** | 0 | NULL |

`recipient_email` reads `russellkmoore@mac.com` throughout — correct. Exactly one delivery row
exists for this order. After two full five-minute cron cycles the status is still `pending` with
a rising attempt count, so per the plan this is recorded as a finding and the wait stops here
rather than continuing indefinitely.

### Email delivery (`email_deliveries`, joined on the delivery's idempotency key)

**No row exists.** The join returns zero results, so no send was ever recorded for this order —
which means the phase's open question, "which email provider does production actually use",
cannot be answered from this run. The honest answer measured here is that production is currently
using **neither**: see §5.

### Bounded tail capture

Captured across the two cron ticks that followed the purchase (21:30:33Z and 21:35:33Z), in JSON
form to a scratch file, asserted, and deleted immediately afterwards per 11-04's method.

| Assertion | Result |
|---|---|
| `cron.recovery_failed` events | **0** |
| cron cycles captured | 2 |
| `outcome` on both | `ok` |
| `exceptions` on both | `[]` (empty) |
| recovery drain log | `[cron] recovery queues drained` with `giftCardDeliveries: { attempted: 1 }` on each cycle |

**Read this carefully:** zero `cron.recovery_failed` does **not** mean the delivery succeeded. That
event only fires when the whole recovery batch rejects. Each cycle picked this delivery up
(`attempted: 1`) and the send failed inside a per-delivery `catch` in `deliverOne`, which swallows
the error without logging it. The cron is healthy; the send is not.

---

## 5. Why the delivery was not sending (superseded by §7 — this section is the diagnosis, not the final state)

The evidence points at email provider configuration, not at the gift-card code.

| Check | Result |
|---|---|
| `email_deliveries` rows for this order | 0 |
| `email_deliveries` rows in the entire table, ever | **0**, against **4 paid orders** in production |
| `EMAIL` binding configured | yes (`wrangler.jsonc`) |
| `RESEND_API_KEY` configured | yes (present in `wrangler secret list`, name only) |
| `EMAIL_PROVIDER` set as a Worker var | no (absent from `wrangler.jsonc` vars) |
| `EMAIL_PROVIDER` set as a Worker secret | no (absent from `wrangler secret list`) |

`resolveRuntime()` in `lib/email/sender.ts` throws
`"Both email providers are configured; set EMAIL_PROVIDER explicitly"` when both a Cloudflare
`EMAIL` binding and a Resend key are present and `EMAIL_PROVIDER` names neither. That throw
happens **before** `claimDelivery()` writes the `email_deliveries` row, which is exactly the
pattern observed: attempt counts rise, no email row is ever created, no exception surfaces
because `deliverOne` catches it silently.

That no email row has ever been written for any of the four paid orders in this store's history
says this is not new and not gift-card-specific: **no transactional email has ever sent from
production.** The gift-card purchase is simply the first thing to look closely enough to notice.

**What it would take:** set `EMAIL_PROVIDER` to `cloudflare` or `resend` and deploy.
`docs/customer-communications.md` recommends `cloudflare` with the `send_email` binding. This
plan is forbidden from changing configuration or deploying, so it stops here.

**Left to run on its own:** the delivery keeps retrying every five minutes until
`attempt_count` reaches 8 (`MAX_DELIVERY_ATTEMPTS`), at which point the row parks as
`needs_review` with `completed_at` set. Setting `EMAIL_PROVIDER` before then would let a later
cycle send it; after then, the parked row needs a deliberate re-queue. The gift card itself is
issued, active and unaffected either way — only its delivery email is stuck.

## 6. SHOP-07: the Account → Gift Cards clause is a product gap, not a pending check

Recorded as a finding, not as something still to verify — a person signing in would find nothing,
which is the whole point.

**What SHOP-07 asks for:** the purchased card appears under Account → Gift Cards for the
recipient's account.

**Why that cannot happen for any recipient who is not the buyer:**

- `GET /api/gift-cards` lists through `listCustomerGiftCardPresentations({ customerId: userId })`,
  whose SQL reads `WHERE account.purchaser_customer_id = ?` — the **purchaser**, never the
  recipient. Read verbatim from `app/api/gift-cards/route.ts` and `lib/gift-cards/presentations.ts`
  this session.
- `purchaser_customer_id` is written straight from the order's `customer_id` at issuance
  (`lib/services/gift-card-fulfillment.ts`).
- This guest purchase wrote it as **NULL** — the actual issued row above shows
  `purchaser_customer_id = NULL`. A `NULL` can never match `= ?` against any concrete Clerk user
  id, so this card will not appear under any account, including Russell's, even though the card
  was bought for his address.
- Even a signed-in purchase would set that column to the **buyer**. A card bought for someone
  else can never appear in that someone else's account.

**What it would take:** matching issued cards to a verified recipient email, a change under
`lib/gift-cards/`, out of this milestone's scope. Already on 12-CONTEXT.md's deferred list.

**The decision for Russell:** either recipients should see cards sent to them (a product change),
or SHOP-07's wording should be corrected to describe what the product does — list cards to their
purchaser.

---

*Phase 12, plan 12-05, attempt 2. Every value above was read from production with column-named,
order-filtered SELECTs. No gift-card code, ciphertext or nonce column was ever selected, printed
or recorded, and no account or delivery row id appears in this file.*

---

## 7. Resolution: the delivery sent

The §4 and §5 readings above are preserved as they were taken — they are the honest record of the
first two cron cycles and the diagnosis that came out of them. They were not the end state. Three
fixes followed, each decided by the orchestrator under Russell's standing best-assumption
instruction and each recorded in STATE.md, and the delivery then sent.

### Timeline

| Time (UTC) | What happened |
|---|---|
| 21:24:19 | order paid, card issued, delivery row created |
| 21:25 – 21:55 | cron attempts 1–8, every one failing silently; row parks as `needs_review` at 21:55 |
| 21:44 | `EMAIL_PROVIDER=cloudflare` added to `wrangler.jsonc` vars (`32b9df1`), deployed — **not sufficient**, attempts 6–8 still failed |
| 22:01 | real root cause fixed in code (`f813499`), deployed |
| 22:01:10 | one production D1 write by the orchestrator: the parked row re-queued |
| 22:05 | first real send attempt — wrote the **first-ever** `email_deliveries` row: provider `cloudflare`, status `failed`, `error_code = E_SENDER_DOMAIN_NOT_AVAILABLE` |
| 22:15:48 | `STORE_SENDER_EMAIL="Voltique <orders@russellkmoore.me>"` added to vars (`d8b4d11`), deployed |
| 22:20:34 | **delivery `sent`**; `email_deliveries` reads `succeeded` |

### The actual root cause

Setting `EMAIL_PROVIDER` was necessary but not sufficient. `drainGiftCardDeliveries` and
`fulfillPaidGiftCards` called `sendEmail` **without** an `env` argument, so inside the scheduled
handler the sender fell back to `getCloudflareContext()` — which throws outside a request context
— and never found the `EMAIL` binding or the database at all. Commit `f813499` makes both
`deliverOne` call sites pass `{ EMAIL, DB, EMAIL_PROVIDER, RESEND_API_KEY }` from the fulfillment
environment, with an integration test asserting it.

The second failure was the sender address: the store still carried the placeholder
`mercora.example.com`, which Cloudflare rejected with *"email from mercora.example.com not allowed
because domain is not owned by the same account"*. DNS showed `russellkmoore.me` already onboarded
to Cloudflare Email Sending, so `STORE_SENDER_EMAIL` was pointed at `orders@russellkmoore.me`.

### The one production D1 write

Made by the orchestrator at 22:01:10Z, not by this plan, and recorded here for the audit trail:

```sql
UPDATE gift_card_deliveries
   SET status='pending', attempt_count=0, completed_at=NULL, claim_token=NULL,
       lease_expires_at=NULL, updated_at=strftime('%s','now')
 WHERE order_id='WEB-GUEST-1788989054887-B4382C10' AND status='needs_review';
```

Reported `changes: 1`. It re-queued the row that had exhausted its eight attempts against the
broken code path, so the fixed code could retry it. The gift card itself was never touched.

### Final evidence, re-read at 2026-09-09T22:21:23Z

**Order** (`orders`, by `id`)

| Column | Value |
|---|---|
| status | `processing` |
| payment_status | **`paid`** |
| total_amount | **2500 USD** |
| currency_code | USD |

**Issued gift card** (`gift_card_accounts`, by `issued_order_id`)

| Column | Value |
|---|---|
| rows for this order | **exactly 1** (and exactly 1 in the whole table) |
| status | **`active`** |
| currency_code | USD |
| issued_amount_minor | **2500** |
| purchaser_customer_id | **NULL** |
| created_at | 1788989057 |

**Delivery** (`gift_card_deliveries`, by `order_id`)

| Column | Value |
|---|---|
| rows for this order | **exactly 1** |
| status | **`sent`** |
| recipient_email | russellkmoore@mac.com |
| attempt_count | 4 (counted from the 22:01:10Z re-queue) |
| deliver_after | 0 |
| completed_at | 1788992434 (2026-09-09T22:20:34Z) |

**Email delivery** (`email_deliveries`, joined on the delivery's idempotency key)

| Column | Value |
|---|---|
| provider | **`cloudflare`** |
| status | **`succeeded`** |
| error_code | NULL |
| provider_message_id | present (value not recorded here) |
| completed_at | 2026-09-09T22:20:35.521Z |
| rows in the whole table | 1 — this send is the first transactional email this store has ever recorded |

**The phase's open question is answered by measurement: production's email provider is
`cloudflare`.** It was read from the delivery's own row, not assumed from config.

### Still open for Russell

1. **Stripe Tax is unavailable on the live account.** The `3b821f7` fix corrects how the
   configured-rate fallback treats nontaxable lines; it does not restore the provider. Every
   taxable order is still charged a flat 8.25% guess rather than a calculated rate.
2. **`STORE_SUPPORT_EMAIL` is still the placeholder, and there is no routing rule for `orders@`.**
   Gift-card emails now send *from* `orders@russellkmoore.me`, but a reply to one will bounce.
3. **The `/api/tax` estimate route ignores tax codes.** It hardcodes `txcd_99999999` for every
   line, so its displayed estimate will tax a gift card even though checkout no longer does. It is
   display-only and does not affect what anyone is charged, but the two paths now disagree.
