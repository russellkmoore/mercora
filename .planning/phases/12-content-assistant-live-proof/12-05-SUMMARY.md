---
phase: 12-content-assistant-live-proof
plan: 05
subsystem: commerce
tags: [tech, stripe, gift-cards, live-proof, blocked]
requires:
  - phase: 12-content-assistant-live-proof
    plan: "02"
    provides: Rewritten gift-card knowledge article (not exercised by this plan)
  - phase: 12-content-assistant-live-proof
    plan: "03"
    provides: Terms of Service gift-card section, and the read-back discipline this plan reused
  - phase: 12-content-assistant-live-proof
    plan: "04"
    provides: Volt re-index (not exercised by this plan)
  - phase: 11-production-enablement
    plan: "05"
    provides: STORE_FEATURE_GIFT_CARD_ACQUISITION live in production — confirmed still true
provides:
  - "Production finding: Stripe Tax is unavailable on the live store; every checkout falls back to the flat 8.25% configured rate"
  - "Production finding: the tax fallback ignores per-line tax codes, so a nontaxable (txcd_00000000) gift card is taxed"
  - "SHOP-07 Account -> Gift Cards clause recorded as a structural product gap with order-level evidence"
  - ".planning/phases/12-content-assistant-live-proof/COVERAGE.md — no external API integration introduced by this phase"
affects: [phase-12-plan-06]
actuals:
  tokens: 5600
  tasks: 1.5
  commits: 1
  plan_head_before: 806b5c815c23b99ee8d7ef8fef25a31afac6c86a
tech-stack:
  added: []
  patterns:
    - "Non-billable tax diagnosis: POST /api/tax reproduces the Stripe Tax call and reports calculated_by without creating an order or a payment intent — use it to tell 'Stripe Tax is down' apart from 'this line is taxed wrongly'."
key-files:
  created:
    - .planning/phases/12-content-assistant-live-proof/12-PROOF-ORDER.md
    - .planning/phases/12-content-assistant-live-proof/COVERAGE.md
  modified: []
key-decisions:
  - "HALTED before payment. The plan's step-6 amount assertion fired: the live quote was $27.06, not $25.00. Nothing was bought, no money moved, no gift card was issued, and no second payment intent was created."
  - "Did not relax the assertion and buy anyway. The purchase is the milestone's one irreversible act, and its acceptance criteria (order total 2500) were already known to be unsatisfiable while the tax bug is live. Buying would have permanently recorded an order charging sales tax on a catalogue line explicitly marked nontaxable. That is Russell's call, not the executor's (deviation Rule 4)."
  - "Root cause established read-only and independently: Stripe Tax is unavailable in production (tax_source on the halted order reads configured_fallback, and POST /api/tax returns calculated_by fallback with 'Stripe Tax unavailable'), and the fallback path in lib/services/checkout-pricing.ts applies store.tax_rate (8.25%) to all merchandise, ignoring the per-line txcd_00000000 the gift card carries."
  - "Deviation from D-05, deliberate and planned: the recipient message appends the run id, so a delivered email would be traceable to one execution. Message actually sent to the payment-intent route: 'Phase 12 live proof — Voltique gift card (run phase12-20260909-6a3455)'. No email was ever sent, because payment was never confirmed."
patterns-established: []
requirements-completed: []
coverage:
  - id: D1
    description: "Both single-run guards are present in the script's source and both ran before the first billable call."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "Script output: '[guard] G1 pass: proof artifact absent', '[guard] G2 pass: gift_card_accounts count = 0'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Only the public pk_test_ publishable key from the committed wrangler.jsonc vars block was used; no Stripe secret key appears in that file or the environment."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "Script asserts the pk_test_ prefix and aborts on any Stripe secret-key prefix found in wrangler.jsonc or process.env; a grep for that prefix over wrangler.jsonc returns 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exactly one gift-card order is paid on production, with a gift_card_accounts row for 2500 USD active."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "SELECT COUNT(*) FROM gift_card_accounts -> 0; the purchase halted before payment"
        status: fail
    human_judgment: false
    rationale: "Blocked on the tax finding below — see 'Decision needed'."
  - id: D4
    description: "The delivery row reaches sent within two cron cycles, with no cron.recovery_failed in a bounded tail capture, and the email provider is read from the data."
    requirement: "SHOP-07"
    verification: []
    human_judgment: false
    rationale: "Not attempted. There is nothing to deliver: no card was issued. The phase's open question about which email provider production uses therefore remains unanswered; it is still answerable by measurement the moment a real delivery exists."
  - id: D5
    description: "No gift-card code, ciphertext or nonce column was selected, printed or written to any artifact."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "A grep over 12-PROOF-ORDER.md and COVERAGE.md for the three gift-card code column names (hash, ciphertext, nonce) returns 0 for both; no such column was ever named in a SELECT, and no card exists to have one"
        status: pass
    human_judgment: false
  - id: D6
    description: "No payment client secret and no Stripe secret key reached a committed artifact."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "A grep over 12-PROOF-ORDER.md and COVERAGE.md for a Stripe secret-key prefix and for the payment client-secret field name returns 0 for both"
        status: pass
    human_judgment: false
  - id: D7
    description: "COVERAGE.md exists and states that no external API integration is introduced, naming Stripe's already-integrated confirm endpoint and the public key."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "test -s COVERAGE.md && grep -ic 'stripe' COVERAGE.md -> 11"
        status: pass
    human_judgment: false
  - id: D8
    description: "The Account -> Gift Cards clause of SHOP-07 is recorded as a documented product gap, not claimed as proven and not softened into a pending human check."
    requirement: "SHOP-07"
    verification:
      - kind: other
        ref: "grep -ic 'purchaser' 12-PROOF-ORDER.md -> 6; §4 records the gap, its source-verified cause, the order-level NULL evidence, and the one decision it needs"
        status: pass
    human_judgment: false
duration: 25min
completed: 2026-09-09
status: blocked
---

# Phase 12 Plan 05: Live Gift-Card Purchase Proof Summary

**The purchase was stopped one step before payment because the live store quoted $27.06 for a $25 gift card — production is charging 8.25% sales tax on a catalogue line explicitly marked nontaxable, because Stripe Tax is not working on the live store at all.**

Nothing was bought. No money moved. No gift card was issued, no delivery was queued, no email
was sent. `gift_card_accounts`, `gift_card_deliveries` and `email_deliveries` all still hold
zero rows, re-read from production after the halt.

## What ran

| Step | Result |
|---|---|
| Guard 1 — proof artifact must not exist | pass |
| Guard 2 — `gift_card_accounts` must hold 0 rows | pass (0) |
| Publishable key read from committed `wrangler.jsonc` vars, `pk_test_` prefix asserted | pass, value never printed |
| Secret-key abort check across `wrangler.jsonc` and the environment | pass, no `sk_` anywhere |
| `POST /api/payment-intent` (guest, `prod_33`/`variant_33` ×1, digital, full billing address) | HTTP 200 |
| **Amount assertion: expect $25.00** | **FAILED — quote was $27.06. Run stopped here.** |
| Stripe confirm | never called |
| `POST /api/orders` | never called |

The order the route created before the halt is `WEB-GUEST-1788987166118-30E971BD`
(payment intent `pi_3UDsU6LL7e1EcFUl0hlGh34j`), sitting `pending`/`pending` and unpaid — the
same state an abandoned browser checkout leaves behind. Two other unpaid guest pending orders
from 2026-08-30 already exist in that table. This plan made no D1 write of any kind; that row
was written by the production Worker's own route.

The client secret from the payment-intent response was held in memory only and discarded when
the script exited. It was never printed, never written to any artifact, never passed as a shell
argument. Because it only exists at creation time and cannot be retrieved without a Stripe
secret key, that payment intent is now unconfirmable and will expire on its own.

## Root cause, established read-only

| Check | Result |
|---|---|
| `tax_category` on `prod_33` and `variant_33` | `txcd_00000000` — Stripe's nontaxable code, on both |
| `tax_source` recorded on the halted order | `configured_fallback`, **not** `provider` |
| `admin_settings` → `store.tax_rate` | `8.25` |
| 2500 × 8.25% | 206.25 → 206 minor units — exactly what was charged |
| `POST /api/tax` probe (creates no order, no payment intent) | `calculated_by: "fallback"`, `"Stripe Tax unavailable, using fallback rate"` |

Two distinct problems, both pre-existing and neither caused by Phase 12:

1. **Stripe Tax is unavailable on the production store.** Every checkout silently falls back to
   the flat configured rate. This affects every order, not just gift cards. The `/api/tax` probe
   confirms the failure is in the Stripe Tax call itself, not in the gift-card line.
2. **The fallback ignores per-line tax codes.** `lib/services/checkout-pricing.ts` applies
   `store.tax_rate` to the whole discounted merchandise total, so a line marked nontaxable is
   taxed anyway. On the working Stripe Tax path the per-line code is passed through and honoured,
   and the gift card would have been taxed $0.

## Decision needed

**Decide how to handle the gift-card tax, then say whether to buy.**

| Option | What it means | Cost |
|---|---|---|
| **A — Fix Stripe Tax, then buy** | Turn on / repair Stripe Tax for the live account so `tax_source` reads `provider`. The gift card's `txcd_00000000` is then honoured and the quote is exactly $25.00. The plan runs as written, unchanged. | Stripe dashboard work (Tax settings, origin address); no code change |
| **B — Fix the fallback, then buy** | Change `lib/services/checkout-pricing.ts` so the configured-rate fallback excludes lines whose tax code is nontaxable. Fixes gift cards even while Stripe Tax stays down; leaves problem 1 (every other order still gets a flat guessed rate). | A code change in a phase that forbids code changes — needs its own plan |
| **C — Buy at $27.06 anyway** | Accept a permanent real order that charges $2.06 tax on a nontaxable gift card, and an email to yourself for it. Proves issuance and delivery today; memorialises the bug in live data. | The plan's own criterion "order total 2500" fails; the finding stays open |
| **D — Do neither now** | Close the milestone with SHOP-07's live proof outstanding and both tax findings logged for a later phase. | SHOP-07 stays unproven |

Recommendation: **A**, then re-run 12-05 unchanged. It is the only option that both proves
SHOP-07 and leaves production correct. If Stripe Tax cannot be turned on quickly, **B** is the
narrower fix, and it deserves its own plan because it touches checkout pricing for every order.

**Do not re-run the purchase script until this is decided.** Guard 1 will now block it, because
`12-PROOF-ORDER.md` exists — that is deliberate, so nothing can buy a card by accident.

## SHOP-07: the Account listing clause is a product gap

Recorded in full in `12-PROOF-ORDER.md` §4, as a finding rather than a pending check.

- **Proven structurally, from the source of both the write and the read path:**
  `GET /api/gift-cards` filters on `gift_card_accounts.purchaser_customer_id`; issuance copies
  that column straight from the order's `customer_id`; a guest checkout writes `NULL`. A `NULL`
  can never match `= ?` against a Clerk user id, and even a signed-in purchase would set the
  column to the **buyer**, never the recipient.
- **Evidence obtained by this run:** the halted order's `customer_id` reads `NULL` — the exact
  value issuance would have copied. The account-row form of that evidence (a
  `gift_card_accounts` row with a NULL purchaser column) was not obtained, because no card was
  issued. Stated plainly in the artifact rather than glossed.
- **Not a human check.** A person signing in would find nothing, by design. Softening it into
  "Russell should go look" would be misleading.
- **Decision for Russell:** either recipients should see cards sent to them (a change under
  `lib/gift-cards/`, a later milestone), or SHOP-07's wording should be corrected to describe
  what the product does — list cards to their purchaser.

## Deviations from Plan

### 1. [Rule 4 — architectural / irreversible-action judgment] Halted instead of buying

- **Found during:** Task 1, step 6 (the plan's own amount assertion).
- **Issue:** The plan's assertion assumed a $25.00 quote, resting on 12-RESEARCH.md's A4 note
  that `prod_33` carries `txcd_00000000` and is therefore untaxed. That is true of the catalogue
  data and true on the Stripe Tax path — but production is not on the Stripe Tax path.
- **Why it was not auto-corrected:** relaxing the assertion to accept $27.06 would have required
  a second payment intent and would have executed the milestone's one irreversible action
  against an acceptance criterion already known to fail. Rule 4 applies: a human decides.
- **Action:** stopped, gathered read-only root-cause evidence, wrote it up, created no second
  payment intent.

### 2. [Planned deviation, per the plan's own output section] Run id appended to the D-05 message

D-05 specifies the recipient message "Phase 12 live proof — Voltique gift card". The run appended
the run id for traceability, sending:
`Phase 12 live proof — Voltique gift card (run phase12-20260909-6a3455)`.
No email was delivered, so nothing landed in Russell's inbox carrying it.

### 3. [Rule 3 — unblock diagnosis] Added a non-billable tax probe not in the plan

To tell "Stripe Tax is down for everything" apart from "this one line is priced wrongly", the run
called `POST /api/tax`, which reproduces the Stripe Tax call and reports `calculated_by` without
creating an order or a payment intent. This is a read-shaped diagnostic with no billable side
effect; it is what upgraded the finding from "the amount was wrong" to a named root cause.

## Issues Encountered

- The plan's Task 1 step 3 says to read the publishable key by "stripping line comments and
  parsing the JSON". `wrangler.jsonc` also contains block comments, trailing commas, and `//`
  inside string values (URLs), so a naive strip corrupts it. Wrote a string-aware stripper that
  removes both comment forms and trailing commas without touching string bodies, and validated it
  parsed the file before any network call.
- The payment-intent response reports `amount` as MACH wire money in major units
  (`{amount: 25, currency: 'USD', precision: 2}`), not the minor units the plan's criterion
  names. The script compares `Math.round(amount × 100)` against 2500, which is the same check the
  plan intends.

## Purchase script shape (scratch only, never committed)

`$SCRATCH/12-purchase.mjs`, one Node 24 process, no dependencies beyond the standard library:
JSONC-aware read of `wrangler.jsonc` → both guards (`existsSync` on the proof artifact;
`wrangler d1 execute --remote --json` count of `gift_card_accounts`) → run id
`phase12-<YYYYMMDD>-<6 hex>` → `POST /api/payment-intent` → amount assertion → write the proof
artifact **before** confirming → Stripe confirm with the publishable key as HTTP basic username
→ `POST /api/orders` → append confirm and finalize results. Every failure path appends the step
it reached to the artifact and exits non-zero. A `--resume <orderId>` flag exists that skips
straight to the finalize call and never touches the payment-intent route; it is unusable for this
halt, because the halt happened before any payment intent could be confirmed and the client
secret was deliberately not persisted.

## Next Phase Readiness

- **12-06 can proceed.** It gates the phase (lint, typecheck, tests, build, secret scan over
  added lines) and does not depend on a paid order. Both artifacts this plan owns exist and grep
  clean for secrets, client secrets, and gift-card code column names.
- **SHOP-07 is not complete** and was not marked complete. The requirement needs either the
  decision above plus a re-run, or an explicit deferral.
- **The phase's open question about the live email provider is still open.** It was to be
  answered by reading the `provider` column of the real delivery's `email_deliveries` row; with
  no delivery, there is nothing to read. The method is sound and costs nothing extra the moment a
  real gift-card email exists.

---
*Phase: 12-content-assistant-live-proof*
*Halted: 2026-09-09*

## Self-Check: PASSED (for what this plan produced)

- FOUND: `.planning/phases/12-content-assistant-live-proof/12-PROOF-ORDER.md`
- FOUND: `.planning/phases/12-content-assistant-live-proof/COVERAGE.md`
- FOUND: `.planning/phases/12-content-assistant-live-proof/12-05-SUMMARY.md`
- Secret / code-column grep over all three artifacts: 0 matches in each
- No publishable-key value appears in any artifact: 0 matches
- No change under `lib/`, `app/`, `components/`, or `wrangler.jsonc`: `git status --porcelain` on those paths is empty
- Production re-read after the halt: `gift_card_accounts` 0, `gift_card_deliveries` 0, `email_deliveries` 0
- Artifact and database agree on the halted order: `SELECT COUNT(*) FROM orders WHERE id='WEB-GUEST-1788987166118-30E971BD'` returns 1

The plan's Task 1 verify (`PURCHASE_RECORDED`) does **not** pass, and is not claimed to. It is
the correct failure: the run halted before payment, so the artifact records no succeeded confirm
and no 200 finalize. That verify is read-only precisely so it cannot be "fixed" by re-running the
script, which would buy a card.
