---
phase: 12-content-assistant-live-proof
plan: 05
subsystem: commerce
tags: [tech, stripe, gift-cards, live-proof, email]
requires:
  - phase: 12-content-assistant-live-proof
    plan: "03"
    provides: Terms of Service gift-card section, and the read-back discipline this plan reused
  - phase: 11-production-enablement
    plan: "04"
    provides: The bounded wrangler-tail capture method, and the five-minute recovery cron proven healthy
  - phase: 11-production-enablement
    plan: "05"
    provides: STORE_FEATURE_GIFT_CARD_ACQUISITION live in production — confirmed still true
provides:
  - "One real paid gift-card order on production in Stripe test mode: WEB-GUEST-1788989054887-B4382C10, $25.00, no tax"
  - "One issued gift card: 2500 minor units, USD, active, purchaser_customer_id NULL"
  - "One delivered gift-card email: gift_card_deliveries sent at 22:20:34Z, email_deliveries succeeded via provider cloudflare"
  - "Answered open question: production's email provider is cloudflare, read from the delivery's own row"
  - "Production finding fixed mid-plan: the delivery cron never passed the worker env to the email sender (f813499)"
  - "Production finding still open: Stripe Tax is unavailable on the live account; every taxable order gets the flat 8.25% configured fallback"
  - "SHOP-07 Account -> Gift Cards clause recorded as a structural product gap, with a real issued row carrying a NULL purchaser column as evidence"
  - ".planning/phases/12-content-assistant-live-proof/COVERAGE.md — no external API integration introduced by this phase"
affects: [phase-12-plan-06]
actuals:
  tokens: 12500
  tasks: 3
  commits: 11
  plan_head_before: 806b5c815c23b99ee8d7ef8fef25a31afac6c86a
  commits_note: "Measured with git rev-list from plan_head_before. Only three of the eleven are this plan's own docs commits; the other eight are the orchestrator's mid-plan tax, email-provider, sender-env and sender-address fixes plus their decision records, which landed inside this plan's range while it was blocked."
tech-stack:
  added: []
  patterns:
    - "Non-billable tax diagnosis: POST /api/tax reproduces the Stripe Tax call and reports calculated_by without creating an order or a payment intent — use it to tell 'the provider is down' apart from 'this line is priced wrongly'."
    - "Bounded wrangler-tail capture driven from a Node wrapper (spawn + timed SIGINT) rather than shell job control: zsh noclobber blocks the '>' redirect and macOS has no 'timeout', both of which silently produce an empty capture that reads as 'no events'."
    - "A silent per-item catch makes a healthy-looking cron. 'recovery queues drained' with zero cron.recovery_failed proves the batch ran, not that the work succeeded — read the row's attempt_count, not just the telemetry."
    - "A worker-env-dependent helper called from a scheduled handler must be handed the env explicitly; getCloudflareContext() throws outside a request, and a caller that swallows errors turns that into a silent no-op."
key-files:
  created:
    - .planning/phases/12-content-assistant-live-proof/12-PROOF-ORDER.md
    - .planning/phases/12-content-assistant-live-proof/12-PROOF-ORDER-attempt1.md
    - .planning/phases/12-content-assistant-live-proof/COVERAGE.md
  modified: []
key-decisions:
  - "Attempt 1 halted before payment on the plan's own amount assertion ($27.06 quoted for a $25 card). The orchestrator applied option B under Russell's standing best-assumption instruction: commit 3b821f7 made the configured-fallback tax path skip txcd_00000000 lines, with a regression test, deployed 21:05:06Z. Attempt 2 ran against that deployment and was quoted exactly 2500."
  - "Attempt 2 used a NEW PaymentIntent, a deliberate deviation from the plan's resume-only rule. The halted intent from attempt 1 carried the wrong amount (2706) and was never confirmed, so --resume could not reuse it; resuming would have finalized an order for the wrong total."
  - "The delivery missed the plan's two-cycle window and was recorded as blocked. Three orchestrator changes then fixed it: EMAIL_PROVIDER=cloudflare (32b9df1), the real root cause in code (f813499), and a real sending domain (d8b4d11). It sent at 22:20:34Z."
  - "Root cause of the stuck delivery was NOT the missing EMAIL_PROVIDER alone: drainGiftCardDeliveries and fulfillPaidGiftCards called sendEmail without env, so inside the scheduled handler the sender fell back to getCloudflareContext (which throws outside a request) and never found the EMAIL binding or the database. Fixed in f813499 with an integration test."
  - "Deviation from D-05, planned by the plan's own output section: the recipient message appends the run id. Sent verbatim: 'Phase 12 live proof — Voltique gift card (run phase12-20260909-80403f)'."
patterns-established: []
requirements-completed: [SHOP-07]
coverage:
  - id: D1
    description: "Exactly one gift-card order is paid on production in Stripe test mode, and its orders row reads paid."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "SELECT id, status, payment_status, total_amount, currency_code FROM orders WHERE id='WEB-GUEST-1788989054887-B4382C10' -> processing / paid / 2500 / USD; COUNT(*) -> 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "A gift_card_accounts row exists for that order with issued_amount_minor 2500, currency USD, status active."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "SELECT status, currency_code, issued_amount_minor, issued_order_id, purchaser_customer_id, created_at FROM gift_card_accounts WHERE issued_order_id='WEB-GUEST-1788989054887-B4382C10' -> active / USD / 2500 / NULL / 1788989057; COUNT(*) -> 1 for the order and 1 for the whole table"
        status: pass
    human_judgment: false
  - id: D3
    description: "The gift_card_deliveries row for that order reaches status sent."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "SELECT status, recipient_email, attempt_count, deliver_after, completed_at FROM gift_card_deliveries WHERE order_id='WEB-GUEST-1788989054887-B4382C10' -> sent / russellkmoore@mac.com / 4 / 0 / 1788992434 (2026-09-09T22:20:34Z); COUNT(*) -> 1"
        status: pass
    human_judgment: false
    rationale: "Not within the plan's two-cycle window. It missed that window, was recorded as blocked, and sent at 22:20:34Z after three orchestrator fixes — see the delivery timeline below. attempt_count counts from the 22:01:10Z re-queue, not from issuance."
  - id: D4
    description: "No cron.recovery_failed event appears in the tail capture spanning the first two cycles."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "Bounded JSON tail capture over the 21:30:33Z and 21:35:33Z ticks: cron.recovery_failed count 0, both outcomes ok, both exception lists empty, 'recovery queues drained' logged with giftCardDeliveries attempted 1 each cycle; capture deleted immediately after the assertion"
        status: pass
    human_judgment: false
    rationale: "Passed then and passes now, but on its own it proved only that the batch ran — the sends inside it were failing silently. Recorded so the limit of this assertion is on the record."
  - id: D5
    description: "The email provider actually used is read from the email_deliveries row joined on the delivery's idempotency key."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "SELECT ed.provider, ed.status, ed.error_code, ed.completed_at FROM email_deliveries ed JOIN gift_card_deliveries gd ON gd.email_idempotency_key = ed.idempotency_key WHERE gd.order_id='WEB-GUEST-1788989054887-B4382C10' -> cloudflare / succeeded / NULL / 2026-09-09T22:20:35.521Z, provider_message_id present"
        status: pass
    human_judgment: false
    rationale: "Answered by measurement, as planned: production's email provider is cloudflare. This is also the first email_deliveries row this store has ever written."
  - id: D6
    description: "The purchase script refuses to run twice: it aborts if the proof artifact already exists or if any gift card account already exists."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "Both guards logged as passing before the first billable call on both attempts; guard 1 demonstrably fired between attempts, which is why attempt 1's record was renamed to 12-PROOF-ORDER-attempt1.md rather than overwritten. Post-run gift_card_accounts total is exactly 1."
        status: pass
    human_judgment: false
  - id: D7
    description: "No bearer code and no code-column value is ever read, printed, or written to any artifact."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "Every SELECT named its columns; a grep of all artifacts for the three gift-card code column names returns 0 for each. Account and delivery row ids, and the provider message id value, were also kept out of the artifacts."
        status: pass
    human_judgment: false
  - id: D8
    description: "No Stripe secret key and no payment client secret reached a committed artifact."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "Only the public pk_test_ key was used, asserted by prefix and never printed; a grep of all artifacts for a Stripe secret-key prefix and for the payment client-secret field name returns 0 for each"
        status: pass
    human_judgment: false
  - id: D9
    description: "The Account -> Gift Cards clause of SHOP-07 is recorded as a documented product gap, not claimed as proven."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "12-PROOF-ORDER.md §6, with the real issued row's purchaser_customer_id = NULL as evidence and the WHERE clause read verbatim from lib/gift-cards/presentations.ts this session"
        status: pass
    human_judgment: false
    rationale: "Recorded as a gap, deliberately not as a pending human check — a person signing in would find nothing, which is the point."
  - id: D10
    description: "COVERAGE.md exists and states that no external API integration is introduced, naming Stripe's already-integrated confirm endpoint and the public key."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "test -s COVERAGE.md && grep -ic 'stripe' COVERAGE.md -> 11"
        status: pass
    human_judgment: false
  - id: D11
    description: "Russell confirms the gift-card email arrived and is usable by a real recipient."
    requirement: "SHOP-07"
    verification: []
    human_judgment: true
    rationale: "The database says sent and the provider says succeeded with a message id, but only Russell can open the inbox. See the human checks below."
duration: 2h
completed: 2026-09-09
status: complete
---

# Phase 12 Plan 05: Live Gift-Card Purchase Proof Summary

**Bought one real $25 gift card on production in Stripe test mode and proved the whole chain end to end: the order is paid, the card is issued and active, and the delivery email actually sent through Cloudflare Email Sending.**

It took two purchase attempts and four fixes to get there, and it surfaced three production defects
that had nothing to do with gift cards — including the fact that this store had never successfully
sent a transactional email of any kind.

## What is proven

| Claim | Evidence |
| --- | --- |
| Exactly one gift-card order is paid on production | `orders` row `WEB-GUEST-1788989054887-B4382C10` — `payment_status = paid`, total **2500 USD**, `COUNT(*) = 1` |
| The server verified the payment itself | `POST /api/orders` returned **200**; `finalizeOrderPayment` re-retrieved the intent with the Worker's own secret key and matched status, order id, currency and amount against its own quote |
| A $25 card was issued and is active | exactly one `gift_card_accounts` row for the order, and exactly one in the whole table — `active`, `USD`, `issued_amount_minor = 2500`, created ~2s after payment |
| The tax fix works on the live path | the quote came back at 2500 with no tax, against the $27.06 attempt 1 saw |
| The delivery email sent | `gift_card_deliveries` → **`sent`**, recipient `russellkmoore@mac.com`, `completed_at = 1788992434` (22:20:34Z) |
| The provider is measured, not assumed | `email_deliveries` → provider **`cloudflare`**, status **`succeeded`**, `provider_message_id` present, `error_code` NULL |
| No secret or bearer code leaked | only the public `pk_test_` key was used and never printed; the client secret was memory-only; every SELECT named its columns; all artifacts grep clean |

Run id `phase12-20260909-80403f`, payment intent `pi_3UDsyZLL7e1EcFUl0KV8QOiJ`, confirmed with
`pm_card_visa` at 21:24:16Z, finalized at 21:24:19Z, delivered at 22:20:34Z.

**The phase's open question is answered by measurement: production's email provider is
`cloudflare`.** It was read from the delivery's own row rather than inferred from config — and
this send is the first `email_deliveries` row the store has ever written.

## Delivery timeline

The delivery missed the plan's two-cycle window, was recorded as blocked with its evidence, and
then sent after three orchestrator fixes. Full detail is in `12-PROOF-ORDER.md` §7.

| Time (UTC) | What happened |
| --- | --- |
| 21:24:19 | order paid, card issued, delivery row created |
| 21:25 – 21:55 | cron attempts 1–8, every one failing silently; row parks as `needs_review` at 21:55 |
| 21:44 | `EMAIL_PROVIDER=cloudflare` added to vars (`32b9df1`), deployed — **not sufficient**, attempts 6–8 still failed |
| 22:01 | the real root cause fixed in code (`f813499`), deployed |
| 22:01:10 | one production D1 write by the orchestrator re-queues the parked row (`changes: 1`) |
| 22:05 | first real send attempt writes the first-ever `email_deliveries` row: `cloudflare` / `failed` / `E_SENDER_DOMAIN_NOT_AVAILABLE` — the store's placeholder sender domain |
| 22:15:48 | `STORE_SENDER_EMAIL="Voltique <orders@russellkmoore.me>"` added to vars (`d8b4d11`), deployed |
| 22:20:34 | **delivery `sent`**, `email_deliveries` **`succeeded`** |

Two things are worth carrying forward from this:

1. **Setting `EMAIL_PROVIDER` was necessary but not sufficient.** `drainGiftCardDeliveries` and
   `fulfillPaidGiftCards` called `sendEmail` without an `env` argument, so inside the scheduled
   handler the sender fell back to `getCloudflareContext()` — which throws outside a request
   context — and never found the `EMAIL` binding or the database at all.
2. **The cron looked perfectly healthy the entire time it was failing.** Both captured cycles
   logged `recovery queues drained` with `outcome: ok`, empty exception lists and zero
   `cron.recovery_failed`, because `deliverOne` catches per-delivery failures without logging.
   The only signal that anything was wrong was the row's own `attempt_count`.

## SHOP-07: the Account → Gift Cards clause is a product gap

Recorded as a finding, not as a pending human check — a person signing in would find nothing,
which is the whole point.

- **The listing filters on the purchaser.** `GET /api/gift-cards` calls
  `listCustomerGiftCardPresentations({ customerId: userId })`, whose SQL is
  `WHERE account.purchaser_customer_id = ?`. Read verbatim this session.
- **Issuance copies that column from the order's `customer_id`**, and this guest purchase wrote
  `NULL`. The evidence is the real issued row, not an inference: the card sitting on production
  right now carries `purchaser_customer_id = NULL`, so it will not appear under any account —
  including Russell's, despite being bought for his address and now delivered to it.
- **Even a signed-in purchase would set it to the buyer**, never the recipient. A card bought for
  someone else can never appear in that someone else's account.
- **Decision for Russell:** either recipients should see cards sent to them (a change under
  `lib/gift-cards/`, a later milestone), or SHOP-07's wording should be corrected to describe what
  the product does.

SHOP-07 is marked complete for the purchase, issuance and delivery it actually proves, with this
clause carried as a documented gap rather than quietly counted as met.

## Human checks for Russell

1. **Open the gift-card email at `russellkmoore@mac.com`.** It should be from
   **`Voltique <orders@russellkmoore.me>`** and carry the run id
   `phase12-20260909-80403f` in its message. Confirm it arrived, that it is presented in a way a
   real recipient could actually use, and that the card code works at checkout if you want to
   spend it. The database says `sent` and Cloudflare says `succeeded` with a message id — only you
   can confirm what landed.
2. **The Account → Gift Cards gap stays as recorded above.** No check needed; it needs a decision,
   not a look.

## Still open for Russell

1. **Stripe Tax is unavailable on the live account.** `3b821f7` corrects how the configured-rate
   fallback treats nontaxable lines; it does not restore the provider. Every taxable order is
   still charged a flat 8.25% guess from `admin_settings` rather than a calculated rate.
2. **`STORE_SUPPORT_EMAIL` is still the placeholder, and there is no routing rule for `orders@`.**
   Gift-card emails now send *from* `orders@russellkmoore.me`, but a reply to one will bounce.
3. **The `/api/tax` estimate route ignores tax codes.** It hardcodes `txcd_99999999` for every
   line, so its displayed estimate taxes a gift card even though checkout no longer does. Display
   only — nobody is charged from it — but the two paths now disagree.

## Deviations from Plan

### 1. [Orchestrator, unattended] Four production changes landed mid-plan

This plan forbids code changes, config changes and deploys, and made none. All four below were
made by the orchestrator under Russell's standing best-assumption instruction while this plan was
blocked, each recorded in STATE.md:

| Commit | Change | Deployed |
| --- | --- | --- |
| `3b821f7` | `lib/services/checkout-pricing.ts`: the configured-rate tax fallback gives `txcd_00000000` lines zero weight in both the taxable base and the per-line allocation, with a regression test | 21:05:06Z |
| `32b9df1` | `wrangler.jsonc` vars: `EMAIL_PROVIDER=cloudflare` | 21:44Z |
| `f813499` | `lib/services/gift-card-fulfillment.ts`: both `deliverOne` call sites now pass `{ EMAIL, DB, EMAIL_PROVIDER, RESEND_API_KEY }` from the fulfillment environment to `sendEmail`, with an integration test asserting it | 22:01Z |
| `d8b4d11` | `wrangler.jsonc` vars: `STORE_SENDER_EMAIL="Voltique <orders@russellkmoore.me>"` | 22:15:48Z |

### 2. [Orchestrator, unattended] One production D1 write

The plan forbids any D1 write, and this plan made none. The orchestrator made one at 22:01:10Z to
re-queue the delivery row that had exhausted its eight attempts against the broken code path:
`UPDATE gift_card_deliveries SET status='pending', attempt_count=0, completed_at=NULL,
claim_token=NULL, lease_expires_at=NULL, updated_at=strftime('%s','now') WHERE
order_id='WEB-GUEST-1788989054887-B4382C10' AND status='needs_review'`, reporting `changes: 1`.
The gift card itself was never touched. Recorded here for the audit trail, and in
`12-PROOF-ORDER.md` §7.

### 3. [Deliberate] Attempt 2 created a new PaymentIntent

The plan says a corrected run may only resume against the same PaymentIntent. That could not
apply. Attempt 1's intent `pi_3UDsU6LL7e1EcFUl0hlGh34j` was created for **2706** — the wrong
amount — and never confirmed, so resuming it would have finalized an order for a total the plan
forbids. It was also unconfirmable in practice, because the client secret is memory-only by design
and was discarded when attempt 1 exited. A new intent was created after re-checking guard 2
(`gift_card_accounts` still 0). Attempt 1's intent stays unconfirmed and expires on its own; its
order row `WEB-GUEST-1788987166118-30E971BD` remains an unpaid pending order, indistinguishable
from an abandoned browser checkout, alongside two others from 2026-08-30.

### 4. [Deliberate] Attempt 1's record was renamed, not deleted

Guard 1 fired correctly on the second run — the guard working as designed. Attempt 1's proof file
was renamed to `12-PROOF-ORDER-attempt1.md` via `git mv`, preserved verbatim, so the tax finding
and the halted-run record survive and guard 1 could pass legitimately for a fresh attempt.

### 5. [Planned by the plan's output section] Run id appended to the D-05 message

Sent verbatim: `Phase 12 live proof — Voltique gift card (run phase12-20260909-80403f)`.

### 6. [Rule 3 — unblock diagnosis] Diagnostics not in the plan

`POST /api/tax` (creates no order and no payment intent) separated "the tax provider is down" from
"this line is priced wrongly". `wrangler secret list` (names only) and a whole-table `COUNT(*)` on
`email_deliveries` established that the email failure predated this purchase. All read-only.

## Issues Encountered

- **The tail capture silently produced nothing three times before it worked.** macOS has no
  `timeout`, and the shell has `noclobber` set, so `>` onto an existing path fails. Both leave an
  empty capture file that reads exactly like "no events occurred" — a dangerous false negative for
  an assertion whose pass condition is a zero count. Rewrote it as a Node wrapper that spawns
  `wrangler tail` and sends SIGINT after a fixed window, and asserted only after confirming the
  file contained the expected cron ticks.
- **`wrangler tail --format json` emits pretty-printed multi-line JSON, not JSONL**, so per-line
  parsing yields nothing. Parsed the whole document instead.
- The plan's Task 1 step 3 says to read the publishable key by "stripping line comments and
  parsing the JSON". `wrangler.jsonc` also has block comments, trailing commas, and `//` inside
  string values, so a naive strip corrupts it. Wrote a string-aware stripper and validated it
  parsed before any network call.
- The payment-intent response reports `amount` as MACH wire money in major units
  (`{amount: 25, currency: 'USD', precision: 2}`), not the minor units the plan's criterion names.
  The script compares `Math.round(amount × 100)` against 2500.

## Purchase script shape (scratch only, never committed)

`$SCRATCH/12-purchase.mjs`, one Node 24 process, standard library only: JSONC-aware read of
`wrangler.jsonc` → both guards (proof-artifact existence; a `wrangler d1 execute --remote --json`
count of `gift_card_accounts`) → abort if any Stripe secret-key prefix appears in that file or the
environment → run id `phase12-<YYYYMMDD>-<6 hex>` → `POST /api/payment-intent` → amount assertion
→ write the proof artifact **before** confirming → Stripe confirm with the publishable key as HTTP
basic username and the client secret in the form body → `POST /api/orders` → append confirm and
finalize results. Every failure path appends the step it reached to the artifact and exits
non-zero. A `--resume <orderId>` flag skips to the finalize call and never touches the
payment-intent route.

Also scratch-only: `$SCRATCH/tail-capture.mjs`, the bounded tail wrapper described above. Both are
recorded here rather than committed.

## Next Phase Readiness

- **12-06 can proceed** and gates the phase. All four artifacts exist and grep clean for secrets,
  client secrets and gift-card code column names. Note for its secret scan: the added lines in this
  plan's range include the orchestrator's four production fixes, none of which add a secret value.
- **SHOP-07 is marked complete** for purchase, issuance and delivery, with the Account → Gift Cards
  clause carried as a documented product gap rather than counted as met.
- **One human check is outstanding:** Russell opening the delivered email. It is not blocking —
  the database and the provider both confirm the send — but nobody has looked at what arrived.
- **Three findings stay open for Russell**, listed above. None of them blocks this milestone.

---
*Phase: 12-content-assistant-live-proof*
*Completed: 2026-09-09*

## Self-Check: PASSED

- FOUND: `.planning/phases/12-content-assistant-live-proof/12-PROOF-ORDER.md`
- FOUND: `.planning/phases/12-content-assistant-live-proof/12-PROOF-ORDER-attempt1.md`
- FOUND: `.planning/phases/12-content-assistant-live-proof/COVERAGE.md`
- FOUND: `.planning/phases/12-content-assistant-live-proof/12-05-SUMMARY.md`
- FOUND commits: `3b821f7`, `32b9df1`, `f813499`, `d8b4d11` (all verified with `git cat-file -e`)
- Task 1 verify 1: `PURCHASE_RECORDED` printed; verify 2: `SELECT COUNT(*) FROM orders WHERE id='WEB-GUEST-1788989054887-B4382C10'` returns 1
- Task 2 verifies: `gift_card_accounts` → active / USD / 2500 / NULL; `gift_card_deliveries` → sent / russellkmoore@mac.com / 4; `email_deliveries` join → cloudflare / succeeded
- Task 3 verifies: `COVERAGE.md` names Stripe 11 times; `purchaser` appears in the proof file
- Secret and code-column greps return 0 for every artifact; no publishable-key value, no account or delivery row id, and no provider message id value in any artifact
- Tail capture asserted then deleted; the file no longer exists
- This plan made no code change, no config change, no deploy and no D1 write. The four production
  changes and the one D1 write inside its range were the orchestrator's and are recorded as
  deviations above.
