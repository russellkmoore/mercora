---
phase: 12-content-assistant-live-proof
plan: 05
subsystem: commerce
tags: [tech, stripe, gift-cards, live-proof, email, blocked]
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
  - "Production finding: no transactional email has ever sent from this store — EMAIL_PROVIDER is unset while both providers are configured, so lib/email/sender.ts throws before any email_deliveries row is written"
  - "Production finding: Stripe Tax is unavailable on the live account; every taxable order gets the flat 8.25% configured fallback"
  - "SHOP-07 Account -> Gift Cards clause recorded as a structural product gap, now with a real issued row carrying a NULL purchaser column as evidence"
  - ".planning/phases/12-content-assistant-live-proof/COVERAGE.md — no external API integration introduced by this phase"
affects: [phase-12-plan-06]
actuals:
  tokens: 8900
  tasks: 3
  commits: 4
  plan_head_before: 806b5c815c23b99ee8d7ef8fef25a31afac6c86a
  commits_note: "Measured with git rev-list from plan_head_before. Two of the four are the orchestrator's tax-fix commits (3b821f7, 0ac6bc3), which landed mid-plan between the two purchase attempts; the other two are this plan's own docs commits."
tech-stack:
  added: []
  patterns:
    - "Non-billable tax diagnosis: POST /api/tax reproduces the Stripe Tax call and reports calculated_by without creating an order or a payment intent — use it to tell 'Stripe Tax is down' apart from 'this line is priced wrongly'."
    - "Bounded wrangler-tail capture driven from a Node wrapper (spawn + timed SIGINT) rather than shell job control: zsh noclobber blocks the '>' redirect and macOS has no 'timeout', both of which silently produce an empty capture that reads as 'no events'."
    - "A silent per-item catch makes a healthy-looking cron. 'recovery queues drained' with zero cron.recovery_failed proves the batch ran, not that the work succeeded — read the row's attempt_count, not just the telemetry."
key-files:
  created:
    - .planning/phases/12-content-assistant-live-proof/12-PROOF-ORDER.md
    - .planning/phases/12-content-assistant-live-proof/12-PROOF-ORDER-attempt1.md
    - .planning/phases/12-content-assistant-live-proof/COVERAGE.md
  modified: []
key-decisions:
  - "Attempt 1 halted before payment on the plan's own amount assertion ($27.06 quoted for a $25 card). The orchestrator then applied option B under Russell's standing best-assumption instruction: commit 3b821f7 made the configured-fallback tax path skip txcd_00000000 lines, with a regression test, deployed 2026-09-09T21:05:06Z. Attempt 2 ran against that deployment and was quoted exactly 2500."
  - "Attempt 2 used a NEW PaymentIntent, a deliberate deviation from the plan's resume-only rule. The halted intent from attempt 1 carried the wrong amount (2706) and was never confirmed, so --resume could not reuse it; resuming would have finalized an order for the wrong total. The attempt-1 intent stays unconfirmed and expires on its own."
  - "Delivery did not reach sent within two cron cycles. Per the plan's own instruction the run recorded status, attempt count and deliver_after and stopped rather than waiting indefinitely."
  - "Root cause of the stuck delivery, established read-only: EMAIL_PROVIDER is set neither as a var nor as a secret while both the Cloudflare EMAIL binding and RESEND_API_KEY exist, so resolveRuntime() in lib/email/sender.ts throws before claimDelivery() writes an email_deliveries row. Zero email_deliveries rows exist for the entire store against four paid orders — no transactional email has ever sent from production."
  - "Deviation from D-05, planned by the plan's own output section: the recipient message appends the run id. Sent verbatim: 'Phase 12 live proof — Voltique gift card (run phase12-20260909-80403f)'."
patterns-established: []
requirements-completed: []
coverage:
  - id: D1
    description: "Exactly one gift-card order is paid on production in Stripe test mode, and its orders row reads paid."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "SELECT status, payment_status, total_amount, currency_code FROM orders WHERE id='WEB-GUEST-1788989054887-B4382C10' -> processing / paid / 2500 / USD; SELECT COUNT(*) -> 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "A gift_card_accounts row exists for that order with issued_amount_minor 2500, currency USD, status active."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "SELECT status, currency_code, issued_amount_minor, purchaser_customer_id FROM gift_card_accounts WHERE issued_order_id='WEB-GUEST-1788989054887-B4382C10' -> active / USD / 2500 / NULL; COUNT(*) -> exactly 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "The gift_card_deliveries row for that order reaches status sent within two five-minute recovery cron cycles."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "Polled 21:25:00Z through 21:35:51Z across both cycles: status pending throughout, attempt_count 1 -> 4, deliver_after 0, completed_at NULL, recipient_email russellkmoore@mac.com"
        status: fail
    human_judgment: false
    rationale: "Blocked on the email-provider finding below. The delivery row and the cron are both healthy; the send throws before it can be recorded."
  - id: D4
    description: "No cron.recovery_failed event appears in the tail capture spanning those cycles."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "Bounded JSON tail capture over the 21:30:33Z and 21:35:33Z ticks: cron.recovery_failed count 0, both outcomes ok, both exception lists empty, 'recovery queues drained' logged with giftCardDeliveries attempted 1 each cycle; capture deleted immediately after the assertion"
        status: pass
    human_judgment: false
    rationale: "Passes, but does not mean delivery succeeded — that event only fires when the whole batch rejects, and deliverOne swallows per-delivery failures."
  - id: D5
    description: "The email provider actually used is read from the email_deliveries row joined on the delivery's idempotency key."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "JOIN email_deliveries ON gift_card_deliveries.email_idempotency_key -> zero rows; and SELECT COUNT(*) FROM email_deliveries -> 0 for the whole table against 4 paid orders"
        status: fail
    human_judgment: false
    rationale: "Answered by measurement, just not with the expected answer: production currently uses neither provider, because provider resolution throws. The research question is resolved as a defect rather than as a value."
  - id: D6
    description: "The purchase script refuses to run twice: it aborts if the proof artifact already exists or if any gift card account already exists."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "Both guards logged as passing before the first billable call on both attempts; guard 1 demonstrably fired between attempts, which is why attempt 1's record was renamed to 12-PROOF-ORDER-attempt1.md rather than overwritten"
        status: pass
    human_judgment: false
  - id: D7
    description: "No bearer code and no code-column value is ever read, printed, or written to any artifact."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "Every SELECT named its columns; a grep of all three artifacts for the three gift-card code column names returns 0 for each. Account and delivery row ids were also kept out of the artifacts."
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
  - id: D10
    description: "COVERAGE.md exists and states that no external API integration is introduced, naming Stripe's already-integrated confirm endpoint and the public key."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "test -s COVERAGE.md && grep -ic 'stripe' COVERAGE.md -> nonzero"
        status: pass
    human_judgment: false
duration: 75min
completed: 2026-09-09
status: blocked
---

# Phase 12 Plan 05: Live Gift-Card Purchase Proof Summary

**Bought one real $25 gift card on production in Stripe test mode and proved it issues correctly — then found the delivery email cannot send, because no transactional email has ever sent from this store.**

Two attempts. The first halted before payment on a tax bug and bought nothing. The bug was fixed
and deployed between attempts; the second attempt was quoted exactly $25.00, paid, and issued a
card. The delivery is stuck.

## What is proven

| Claim | Evidence |
| --- | --- |
| Exactly one gift-card order is paid on production | `orders` row `WEB-GUEST-1788989054887-B4382C10` — `payment_status = paid`, total **2500 USD**, `COUNT(*) = 1` |
| The server verified the payment itself | `POST /api/orders` returned **200**; `finalizeOrderPayment` re-retrieved the intent with the Worker's own secret key and matched status, order id, currency and amount against its own quote |
| A $25 card was issued and is active | exactly one `gift_card_accounts` row for that order — `active`, `USD`, `issued_amount_minor = 2500`, created ~2s after payment (issuance is synchronous at finalization, not a later cron cycle) |
| The tax fix works on the live path | the quote came back at 2500 with no tax, against the $27.06 attempt 1 saw |
| The recovery cron is healthy | two captured cycles, both `outcome: ok`, both `exceptions: []`, zero `cron.recovery_failed`, `giftCardDeliveries: { attempted: 1 }` each cycle |
| No secret or bearer code leaked | only the public `pk_test_` key was used and never printed; the client secret was memory-only; every SELECT named its columns; all artifacts grep clean |

Run id `phase12-20260909-80403f`, payment intent `pi_3UDsyZLL7e1EcFUl0KV8QOiJ`, confirmed with
`pm_card_visa` at 21:24:16Z, finalized at 21:24:19Z.

## What is not proven, and why

**The delivery email has not sent.** After two full five-minute cron cycles the
`gift_card_deliveries` row still reads `pending`, with `attempt_count` climbing 1 → 4,
`deliver_after` 0 and `completed_at` NULL. The recipient address on the row is correct. Per the
plan's own instruction this was recorded and the wait stopped rather than continuing indefinitely.

The cause is not the gift-card code:

| Check | Result |
| --- | --- |
| `email_deliveries` rows for this order | 0 |
| `email_deliveries` rows in the whole table, ever | **0**, against **4 paid orders** |
| `EMAIL` binding configured | yes |
| `RESEND_API_KEY` configured | yes (name only, from `wrangler secret list`) |
| `EMAIL_PROVIDER` as a var or secret | **absent from both** |

`resolveRuntime()` in `lib/email/sender.ts` throws
`"Both email providers are configured; set EMAIL_PROVIDER explicitly"` in exactly that
configuration, and it throws *before* `claimDelivery()` writes the `email_deliveries` row — which
is precisely the observed pattern: attempts rise, no email row appears, no exception surfaces
because `deliverOne` catches per-delivery failures silently.

Zero email rows against four paid orders means this is not new and not gift-card-specific. **No
transactional email has ever sent from production** — not order confirmations either. The
gift-card purchase is simply the first thing that looked closely enough to notice. Research
Pitfall 3 predicted this exact failure mode as a risk; it turns out to be the live state.

## Decisions and who made them

- **The tax fix (option B) was decided by the orchestrator**, under Russell's standing "move
  forward with best-assumption decisions" instruction, after attempt 1 halted and surfaced the
  choice. Commit `3b821f7` makes the configured-fallback tax path give `txcd_00000000` lines zero
  weight in both the taxable base and the per-line allocation, matching what the Stripe Tax path
  already did. Test added, full suite green, deployed 2026-09-09T21:05:06Z. Recorded in STATE.md.
- **Stripe Tax being unavailable on the live account remains open for Russell.** The fix above
  corrects how the fallback behaves; it does not restore the provider. Every taxable order is
  still charged a flat 8.25% guess from `admin_settings` rather than a calculated rate.
  Independently confirmed by `POST /api/tax` returning `calculated_by: "fallback"`.
- **The email provider is a new decision for Russell.** Set `EMAIL_PROVIDER` to `cloudflare` or
  `resend` and deploy; `docs/customer-communications.md` recommends `cloudflare` with the
  `send_email` binding. This plan is forbidden from changing configuration or deploying.

## SHOP-07: the Account → Gift Cards clause is a product gap

Recorded as a finding, not as a pending human check — a person signing in would find nothing,
which is the whole point.

- **The listing filters on the purchaser.** `GET /api/gift-cards` calls
  `listCustomerGiftCardPresentations({ customerId: userId })`, whose SQL is
  `WHERE account.purchaser_customer_id = ?`. Read verbatim this session.
- **Issuance copies that column from the order's `customer_id`**, and this guest purchase wrote
  `NULL`. This time the evidence is the real issued row, not an inference: the card that exists
  right now on production carries `purchaser_customer_id = NULL`, so it will not appear under any
  account — including Russell's, despite being bought for his address.
- **Even a signed-in purchase would set it to the buyer**, never the recipient. A card bought for
  someone else can never appear in that someone else's account.
- **Decision for Russell:** either recipients should see cards sent to them (a change under
  `lib/gift-cards/`, a later milestone), or SHOP-07's wording should be corrected to describe what
  the product does.

## Deviations from Plan

### 1. [Deliberate, orchestrator-directed] Attempt 2 created a new PaymentIntent

The plan says a corrected run may only resume against the same PaymentIntent. That rule could not
apply here. Attempt 1's intent `pi_3UDsU6LL7e1EcFUl0hlGh34j` was created for **2706** — the wrong
amount — and was never confirmed, so resuming it would have finalized an order for a total the
plan explicitly forbids. It was also unconfirmable in practice, because the client secret is
memory-only by design and was discarded when attempt 1 exited. A new intent was created instead,
after re-checking guard 2 (`gift_card_accounts` still 0). Attempt 1's intent stays unconfirmed and
expires on its own; its order row `WEB-GUEST-1788987166118-30E971BD` stays as an unpaid pending
order, indistinguishable from an abandoned browser checkout, alongside two others from
2026-08-30. No D1 write was made by this plan.

### 2. [Deliberate] Attempt 1's record was renamed, not deleted

Guard 1 fired correctly on the second run, which is the guard working as designed. Attempt 1's
proof file was renamed to `12-PROOF-ORDER-attempt1.md` (via `git mv`, preserved verbatim) so the
tax finding and the halted-run record survive, and so guard 1 could pass legitimately for a fresh
attempt. The new `12-PROOF-ORDER.md` points at it in its opening lines.

### 3. [Planned by the plan's output section] Run id appended to the D-05 message

Sent verbatim: `Phase 12 live proof — Voltique gift card (run phase12-20260909-80403f)`. Because
the delivery has not sent, nothing carrying it has reached Russell's inbox yet. If
`EMAIL_PROVIDER` is set before `attempt_count` reaches 8, a later cron cycle will deliver this
exact message.

### 4. [Rule 3 — unblock diagnosis] Two diagnostics not in the plan

- `POST /api/tax` was called during attempt 1 to separate "Stripe Tax is down for everything" from
  "this one line is priced wrongly". It creates no order and no payment intent.
- `wrangler secret list` (names only, no values) and a whole-table `COUNT(*)` on
  `email_deliveries` were used to establish that the email failure predates this purchase. Both
  are read-only and neither touches a secret value.

## Issues Encountered

- **The tail capture silently produced nothing three times before it worked.** macOS has no
  `timeout`, and the shell has `noclobber` set, so `>` onto an existing path fails. Both failures
  leave an empty capture file that reads exactly like "no events occurred" — a dangerous false
  negative for an assertion whose pass condition is a zero count. Rewrote the capture as a Node
  wrapper that spawns `wrangler tail` and sends it SIGINT after a fixed window, then asserted only
  after confirming the file actually contained the expected cron ticks.
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

- **12-06 can proceed.** It gates the phase and does not depend on a sent email. All three
  artifacts exist and grep clean for secrets, client secrets and gift-card code column names.
- **SHOP-07 is not complete** and was not marked complete. Purchase and issuance are proven;
  delivery is blocked on `EMAIL_PROVIDER`, and the account-listing clause is a documented product
  gap.
- **Time-sensitive:** the stuck delivery retries every five minutes until `attempt_count` hits 8
  (`MAX_DELIVERY_ATTEMPTS`), then parks as `needs_review`. Setting `EMAIL_PROVIDER` before then
  lets a later cycle deliver it with no further action; after then the parked row needs a
  deliberate re-queue. The issued card is active and unaffected either way.

---
*Phase: 12-content-assistant-live-proof*
*Completed: 2026-09-09*

## Self-Check: PASSED (for what this plan produced)

- FOUND: `.planning/phases/12-content-assistant-live-proof/12-PROOF-ORDER.md`
- FOUND: `.planning/phases/12-content-assistant-live-proof/12-PROOF-ORDER-attempt1.md`
- FOUND: `.planning/phases/12-content-assistant-live-proof/COVERAGE.md`
- FOUND: `.planning/phases/12-content-assistant-live-proof/12-05-SUMMARY.md`
- Task 1 verify 1: `PURCHASE_RECORDED` printed
- Task 1 verify 2: `SELECT COUNT(*) FROM orders WHERE id='WEB-GUEST-1788989054887-B4382C10'` returns 1
- Task 1 verify 3 / Task 2 verify 4 / Task 3 verify 3: secret and code-column greps return 0 for every artifact
- Task 3 verify 1: `COVERAGE.md` names Stripe 11 times; verify 2: `purchaser` appears 6 times in the proof file
- No publishable-key value in any artifact; no account or delivery row id in any artifact
- No change under `lib/`, `app/`, `components/`, or `wrangler.jsonc` by this plan
- Tail capture asserted then deleted; the file no longer exists

Task 2's delivery verify does **not** pass: `SELECT status FROM gift_card_deliveries` reads
`pending` with `attempt_count` 4 after two cron cycles, and the `email_deliveries` join returns
zero rows. Both are recorded as findings with their evidence rather than retried by hand, which is
what the plan asks for in exactly this case.
