---
phase: 12-content-assistant-live-proof
verified: 2026-09-09T22:47:20Z
status: human_needed
score: 3/4 must-haves verified
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/12-content-assistant-live-proof/12-01-PLAN.md"
  - ".planning/phases/12-content-assistant-live-proof/12-01-SUMMARY.md"
  - ".planning/phases/12-content-assistant-live-proof/12-02-PLAN.md"
  - ".planning/phases/12-content-assistant-live-proof/12-02-SUMMARY.md"
  - ".planning/phases/12-content-assistant-live-proof/12-03-PLAN.md"
  - ".planning/phases/12-content-assistant-live-proof/12-03-SUMMARY.md"
  - ".planning/phases/12-content-assistant-live-proof/12-04-PLAN.md"
  - ".planning/phases/12-content-assistant-live-proof/12-04-SUMMARY.md"
  - ".planning/phases/12-content-assistant-live-proof/12-05-PLAN.md"
  - ".planning/phases/12-content-assistant-live-proof/12-05-SUMMARY.md"
  - ".planning/phases/12-content-assistant-live-proof/12-06-PLAN.md"
  - ".planning/phases/12-content-assistant-live-proof/12-06-SUMMARY.md"
  - "cloudflare-env.d.ts"
  - "data/r2/knowledge_md/gift-cards.md"
  - "lib/services/checkout-pricing.ts"
  - "lib/services/gift-card-fulfillment.ts"
  - "tests/integration/lib/services/gift-card-fulfillment.test.ts"
  - "tests/unit/data/knowledge-gift-cards.test.ts"
  - "tests/unit/lib/services/checkout-pricing.test.ts"
  - "wrangler.jsonc"
  - "components/product/GiftCardRecipientForm.tsx"
  - "data/d1/seed.sql"
  - "lib/gift-cards/customization.ts"
  - "lib/observability/telemetry.ts"
  - "tests/unit/components/gift-card-recipient-form-source.test.ts"
  - "workers/observability-tail/src/core.ts"
covered_digest: "v1:sha256:54e3fc7ec403fa319c35ea5fec6ae404cc404815ea3e1a4ffe8d7e1c31fafdf3"
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 11
  total: 11
  not_honored: []
prohibition_flags:
  - statement: "No code change under lib/**, app/**, components/** (12-01..12-06 plan prohibitions)"
    status: violated_and_documented
    verification: judgment
    evidence: "lib/services/checkout-pricing.ts (3b821f7) and lib/services/gift-card-fulfillment.ts (f813499) changed. Both are orchestrator fixes for production defects the live proof exposed, each with a regression test, each recorded in STATE.md Decisions, 12-05-SUMMARY §Deviations and 12-VALIDATION §Recorded Scope Deviation. app/, components/ and migrations/ are genuinely untouched."
    human_review: recommended
  - statement: "No edit to the committed wrangler.jsonc (12-01..12-06 plan prohibitions)"
    status: violated_and_documented
    verification: judgment
    evidence: "wrangler.jsonc gained two public vars: EMAIL_PROVIDER=cloudflare (32b9df1) and STORE_SENDER_EMAIL=\"Voltique <orders@russellkmoore.me>\" (d8b4d11). Both are non-secret and both are already documented in docs/runtime-configuration.md. Added-line secret scan: 0 matches."
    human_review: recommended
  - statement: "No D1 write of any kind in 12-05 — every query is a read (12-05 prohibition)"
    status: violated_and_documented
    verification: judgment
    evidence: "One orchestrator UPDATE at 22:01:10Z re-queued the parked gift_card_deliveries row (changes: 1). Named in 12-PROOF-ORDER §7 with the exact SQL. The gift card row itself was never written."
human_verification:
  - test: "Open russellkmoore@mac.com and find the Voltique gift-card email sent 2026-09-09T22:20:34Z."
    expected: "The email is present, renders, and carries a usable redemption code."
    why_human: "D1 says sent and email_deliveries says cloudflare/succeeded with a provider message id, but only the inbox owner can confirm the mail arrived and is usable."
  - test: "Decide what to do about SHOP-07's 'appears under Account → Gift Cards for the recipient's account' clause."
    expected: "Either accept that the store lists cards to their purchaser and correct SHOP-07's wording, or open follow-up work under lib/gift-cards/ to match issued cards to a verified recipient email."
    why_human: "Structurally unsatisfiable as written, not a pending check. lib/gift-cards/presentations.ts:74 filters WHERE account.purchaser_customer_id = ?; lib/services/gift-card-fulfillment.ts:93 writes that column from order.customer_id, which is NULL for this guest purchase (verified in production). This is a product decision, not a defect to fix in-phase."
  - test: "Accept or reject the four unattended code/config commits made during 12-05."
    expected: "3b821f7, 32b9df1, f813499, d8b4d11 are accepted as legitimate production fixes, or reverted."
    why_human: "Every plan in this phase prohibited code changes under lib/** and edits to wrangler.jsonc. The prohibition was broken four times, deliberately and honestly recorded. Whether that was the right call is Russell's."
  - test: "Open https://voltique.russellkmoore.me/terms-of-service and read section 6 after Recurring Orders."
    expected: "Section 6 reads naturally in place and matches the house style of its sibling sections."
    why_human: "Prose quality and typographic fit are editorial judgments. Also confirm you accept that this row was written by a scoped D1 UPDATE rather than through the Admin → Pages UI (D-02) — the row is the same one admin edits and remains editable there."
  - test: "Watch the Cloudflare Workers Builds run for the pushed commit f7a11b2."
    expected: "The build succeeds. Nothing in the range changes behaviour beyond what was already deployed during 12-05."
    why_human: "The build runs on Cloudflare after the push, outside this session."
  - test: "Review the three still-open production findings recorded in 12-PROOF-ORDER §7."
    expected: "A decision on each: (1) Stripe Tax is unavailable on the live account, so every taxable order is charged a flat 8.25% guess; (2) STORE_SUPPORT_EMAIL is still support@mercora.example.com and there is no Email Routing rule for orders@, so replies bounce; (3) app/api/tax/route.ts:180 hardcodes txcd_99999999, so the displayed estimate taxes a gift card even though checkout no longer does."
    why_human: "All three are pre-existing, outside this phase's file scope, and each needs a product or account-level decision rather than a code fix inside Phase 12."
advisory: []
---

# Phase 12: Content, Assistant & Live Proof — Verification Report

**Phase Goal:** Volt and the support docs describe the gift card that actually ships, and a real production purchase proves issuance and delivery work end to end.
**Verified:** 2026-09-09T22:47:20Z
**Status:** human_needed
**Re-verification:** No — initial verification

Every result below was re-derived in this session against production and the committed tree. No
value was carried over from a SUMMARY. Where a SUMMARY number and my measurement differ, my
measurement is what is recorded.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | The gift card support article describes what actually ships and is uploaded to R2 | ✓ VERIFIED | `data/r2/knowledge_md/gift-cards.md` names $25/$50/$100/$200, says "delivered by email as soon as payment completes", "never expires", "cannot be redeemed for cash", "cannot be transferred or resold", names the "Gift card" field on the checkout shipping/billing step, and names Account → Gift Cards for balances. No "1 hour" anywhere. `md5 -q` = `435afd94cd37ca7f77203101c222c35d`; `curl -sI https://voltique-images.russellkmoore.me/knowledge_md/gift-cards.md` → HTTP 200, `etag: "435afd94cd37ca7f77203101c222c35d"` — the live object body IS the committed body. |
| 2 | Volt is re-indexed and recommends the gift card for gift / present / voucher questions | ✓ VERIFIED | `wrangler vectorize info voltique-index` → 48 vectors, 768 dims (unchanged from the pre-run baseline of 48). `get-vectors --ids knowledge-gift-cards` → 768 values, metadata keys exactly `slug,source,text`, text length 1000, contains "as soon as payment", does not contain "1 hour", tags carry present + voucher. Three live unauthenticated `POST /api/agent-chat` calls run in this session: "what should I get as a gift?" → 200, names *Voltique Gift Card* first; "do you sell presents?" → 200, "Voltique Gift Card"; "do you have vouchers?" → 200, "Voltique Gift Card is available in $25, $50, $100, or $200 amounts". All three mention "gift card". |
| 3 | The Terms of Service page has a gift card section, published | ✓ VERIFIED (deviation recorded) | Production D1 `pages` row `terms-of-service`: `version 3`, `status published`, `len 1468`, `'6. Gift Cards'` occurrence count `1`. Live page: `'6. Gift Cards'` occurs 4× and `'5. Recurring Orders'` occurs 4× — exact parity with the known-good sibling section. The served section reads "delivered to the recipient by email as soon as payment completes. They never expire, cannot be redeemed for cash, and cannot be transferred or resold." **Deviation:** written by a scoped D1 `UPDATE` (D-02), not by driving the Admin → Pages UI. Same row, still editable in admin. Recorded honestly in 12-03-SUMMARY and CONTEXT D-02; listed for human acceptance. |
| 4 | A gift-card-only order paid in Stripe test mode on production issues a card, emails the recipient, **and the card appears under Account → Gift Cards for the recipient's account** | ? UNCERTAIN — 3 of 4 clauses proven, the fourth is a structural product gap | Issuance and delivery are proven (rows below). The account-listing clause is not met and cannot be met by any purchase for a non-purchaser: `lib/gift-cards/presentations.ts:74` filters `WHERE account.purchaser_customer_id = ?`, and `lib/services/gift-card-fulfillment.ts:93` writes that column from `order.customer_id`, which production confirms is NULL for this guest order. Per phase instruction this is reported as a documented gap needing a decision, not a phase failure. |

**Score:** 3/4 truths verified (0 present, behavior-unverified)

### SHOP-07 production evidence (re-read this session, read-only, non-secret columns only)

| Query | Result |
|---|---|
| `orders WHERE id='WEB-GUEST-1788989054887-B4382C10'` | `payment_status = paid`, `status = processing`, `total_amount = {"amount":2500,"currency":"USD"}`, `customer_id = NULL` (guest), created 2026-09-09T21:24:15.266Z |
| `gift_card_accounts WHERE issued_order_id = …` | exactly **1** row, `status active`, `issued_amount_minor 2500`, `currency USD`, `purchaser_customer_id NULL` |
| `gift_card_deliveries WHERE order_id = …` | exactly **1** row, `status sent`, `recipient_email russellkmoore@mac.com`, `attempt_count 4`, `completed_at 1788992434` (2026-09-09T22:20:34Z) |
| `email_deliveries` joined on `email_idempotency_key` | `provider cloudflare`, `status succeeded`, `error_code NULL`, `completed_at 2026-09-09T22:20:35.521Z`, **1** row in the whole table |

The total is exactly 2500 — no tax on the nontaxable gift-card line, which is `3b821f7` behaving
as intended. No code, `code_hash`, `code_ciphertext` or `code_nonce` column was selected at any
point in this verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `data/r2/knowledge_md/gift-cards.md` | Rewritten to match what ships | ✓ VERIFIED | 1763 bytes, committed in `6614391`, clean working tree, all promises present |
| `tests/unit/data/knowledge-gift-cards.test.ts` | Source-contract test, no mocks | ✓ VERIFIED | Reads the real committed file, 10 assertions, no skips/todos, all value-level. Ran: **10/10 passed** |
| R2 object `knowledge_md/gift-cards.md` | The only object this phase puts | ✓ VERIFIED | ETag == local MD5 |
| Vector `knowledge-gift-cards` in `voltique-index` | Refreshed, admin-route shape | ✓ VERIFIED | id/metadata/truncation match `app/api/admin/vectorize/route.ts` lines 284-293 exactly |
| Production `pages` row `terms-of-service` | Gift card section, published | ✓ VERIFIED | version 3, published, 1 heading occurrence |
| `12-PROOF-ORDER.md` | Full run log with evidence | ✓ VERIFIED | 330 lines; includes §5 (failure diagnosis), §6 (product gap), §7 (resolution) — the failed readings are preserved, not overwritten |
| `12-PROOF-ORDER-attempt1.md` | Attempt 1 record preserved | ✓ VERIFIED | Present and referenced |
| `COVERAGE.md` | API coverage note | ✓ VERIFIED | States no new provider/SDK/credential/secret; records the two Stripe findings |
| `12-VALIDATION.md` | Filled, validated, nyquist_compliant | ✓ VERIFIED | `status: validated`, `nyquist_compliant: true`, 18-row per-task map with real commands, no placeholders |
| Scratch harnesses (12-01, 12-04, 12-05) | Shape recorded in SUMMARY, not committed | ✓ VERIFIED | `12-remote-env.mjs` (161 lines), `12-reindex-knowledge.mjs` (151 lines), `12-purchase.mjs` — present in the session scratch dir, shapes recorded, none tracked |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Committed article | Public R2 object | `wrangler r2 object put --remote` | ✓ WIRED | ETag == MD5 |
| R2 object | `knowledge-gift-cards` vector | bge-base-en-v1.5 → `VECTORIZE.upsert` | ✓ WIRED | Vector text is the article's first 1000 bytes verbatim, front matter included |
| `voltique-index` | Volt's answer | `POST /api/agent-chat` retrieval | ✓ WIRED | Three live answers name the Voltique Gift Card, one quoting the four amounts from the article |
| `pages` row | `/terms-of-service` HTML | `app/[slug]/page.tsx` per-request read | ✓ WIRED | Section 6 served with all four promises |
| payment-intent → Stripe confirm → orders → fulfillment → cron → delivery → email | End-to-end | production run | ✓ WIRED | Proven by the four D1 rows above, ending in `email_deliveries.status = succeeded` |
| `gift_card_accounts.purchaser_customer_id` | Account → Gift Cards listing | `listCustomerGiftCardPresentations` | ✗ NOT_WIRED for a recipient | By design of the current code; the documented product gap |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| Volt answer | `match.metadata.text` | Vectorize `knowledge-gift-cards` | Yes — the answer quotes the article's four amounts | ✓ FLOWING |
| `/terms-of-service` | `page.content` | D1 `pages` row | Yes — version 3 content is what is served | ✓ FLOWING |
| Gift-card delivery email | `email_deliveries.provider` | Real send through the Cloudflare EMAIL binding | Yes — `succeeded` with a provider message id | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Article contract holds | `npx vitest run tests/unit/data/knowledge-gift-cards.test.ts` | 1 file, 10 tests passed | ✓ PASS |
| Whole unit suite green | `npm test` (run once) | 279 files / 2347 tests passed in 7.66s | ✓ PASS |
| Cron drain hands the env to the sender | `npx vitest run --config vitest.workers.config.mts tests/integration/lib/services/gift-card-fulfillment.test.ts` | 1 file, 4 tests passed | ✓ PASS |
| Types compile | `npm run typecheck` | `tsc --noEmit`, exit 0, no output | ✓ PASS |
| Live R2 object matches commit | `curl -sI …/knowledge_md/gift-cards.md` vs `md5 -q` | both `435afd94cd37ca7f77203101c222c35d` | ✓ PASS |
| Volt recommends the card | 3× `POST /api/agent-chat` | 200/200/200, all mention "gift card" | ✓ PASS |
| Terms section served | `curl -s …/terms-of-service` | gift=4, recurring=4 (parity) | ✓ PASS |
| Index untouched apart from the one upsert | `wrangler vectorize info voltique-index` | 48 / 768, same as baseline | ✓ PASS |
| Re-index script is upsert-only | `grep -E "delete\|deleteByIds\|clear"` on `12-reindex-knowledge.mjs` | only a comment; no call | ✓ PASS |
| Tree clean and pushed | `git status --porcelain` / `git rev-list --left-right --count origin/main...HEAD` | no tracked modifications; `0 0` | ✓ PASS |

### Probe Execution

N/A — this project has no `scripts/*/tests/probe-*.sh` convention and no plan declared one. The
equivalent runnable evidence is the spot-check table above, each command run in this process.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CONTENT-01 | 12-02 | Article describes what ships and is uploaded to R2 | ✓ SATISFIED | Truth 1 |
| CONTENT-02 | 12-01, 12-04 | Volt re-indexed and recommends the card for gift/present/voucher | ✓ SATISFIED | Truth 2 |
| CONTENT-03 | 12-03 | Terms of Service gains a gift card section published through Admin → Pages | ✓ SATISFIED in substance | Truth 3. The "through Admin → Pages" clause was met in effect, not by driving the UI (D-02) — human acceptance item |
| SHOP-07 | 12-05 | Paid test-mode order → issued card, delivery email, card under Account → Gift Cards | ⚠️ PARTIAL | Issuance ✓, delivery email ✓ (provider `cloudflare`, `succeeded`), account listing ✗ structurally. `.planning/REQUIREMENTS.md:27` marks SHOP-07 `[x]` and line 84 marks it Complete — that overstates it by one clause and should be corrected or the wording amended |

No orphaned requirements: REQUIREMENTS.md maps exactly CONTENT-01, CONTENT-02, CONTENT-03 and
SHOP-07 to Phase 12, and all four appear in plan frontmatter.

### Decision Coverage

`check.decision-coverage-verify` → **11 of 11** trackable CONTEXT.md decisions honored by shipped
artifacts. `not_honored: []`. Non-blocking gate; recorded for drift tracking.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | none | — | Debt-marker scan (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) over every added line in all eight non-planning files changed in the range: **0 matches** |
| — | — | none | — | Skipped/todo test scan over the three changed test files: **0 matches** |

**Test quality audit.** The three test files touched in this phase all carry value-level or
behavioral assertions against real inputs, none circular:

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|---|---|---|---|---|---|---|
| `tests/unit/data/knowledge-gift-cards.test.ts` | CONTENT-01 | 10 | 0 | No — reads the committed file, expectations hand-written from D-08 | Value | ✓ Sound |
| `tests/unit/lib/services/checkout-pricing.test.ts` | (fix 3b821f7) | +1 | 0 | No — expects `tax = 0`, `total = 2500`, allocations `[200, 0]` derived from the tax rule, not from the engine | Value | ✓ Sound |
| `tests/integration/lib/services/gift-card-fulfillment.test.ts` | (fix f813499) | 4 | 0 | No — asserts `sendEmail` receives `env: { EMAIL, DB, EMAIL_PROVIDER }` | Behavioral | ✓ Sound |

### Scope Deviation — Confirmed Recorded Honestly

The phase asserted, in every plan's prohibitions, that no file under `lib/`, `app/`,
`components/`, `migrations/` or `wrangler.jsonc` would change. **That assertion did not hold**, and
the phase says so plainly in four places. I re-ran the check independently over
`2102380915137d48c96b3726f2e21b69dbf57a6c..HEAD` (23 commits):

| Commit | Files | What |
|---|---|---|
| `3b821f7` | `lib/services/checkout-pricing.ts`, `tests/unit/lib/services/checkout-pricing.test.ts` | Configured-rate tax fallback zero-rates `txcd_00000000` lines |
| `32b9df1` | `wrangler.jsonc`, `cloudflare-env.d.ts` | Public var `EMAIL_PROVIDER=cloudflare` |
| `f813499` | `lib/services/gift-card-fulfillment.ts`, `tests/integration/lib/services/gift-card-fulfillment.test.ts` | Cron drain passes the worker env to `sendEmail` |
| `d8b4d11` | `wrangler.jsonc`, `cloudflare-env.d.ts` | Public var `STORE_SENDER_EMAIL="Voltique <orders@russellkmoore.me>"` |

What I confirmed against the repository, not against the narrative:

- Those are the **only** files under the asserted globs in the range. `app/`, `components/` and
  `migrations/` are empty in the range. No migration was added.
- Each of the four is documented in **all four** places the phase claims: `.planning/STATE.md`
  Decisions (lines 287-291, with alternatives rejected), `12-05-SUMMARY.md` §Deviations,
  `12-VALIDATION.md` §Recorded Scope Deviation, and `12-PROOF-ORDER.md` §7 with a minute-by-minute
  timeline.
- The one production D1 write outside the plans (re-queuing the parked delivery row) is recorded
  with its exact SQL in `12-PROOF-ORDER.md` §7.
- Neither `wrangler.jsonc` addition is a secret: one is a provider name, one is a public sender
  address, and both are already documented in `docs/runtime-configuration.md` (lines 18 and 26).
  Independent scan of added lines across the range for key-shaped values: 0 matches.
- No non-planning file changed after `d8b4d11`, so production is running the code at HEAD.

This is the honest-reporting standard the phase claimed for itself, and it holds. What is
**not** true, and is nowhere claimed, is that the phase shipped no application code.

### Human Verification Required

1. **Open the gift-card email.** Find the Voltique gift-card email at russellkmoore@mac.com sent
   2026-09-09T22:20:34Z; confirm it renders and carries a usable code.
   *Why human:* D1 and `email_deliveries` both say it sent; only you can see the inbox.
2. **Decide the Account → Gift Cards gap.** Either correct SHOP-07's wording to "lists to the
   purchaser", or open follow-up work to match cards to a verified recipient email.
   *Why human:* Structurally unsatisfiable as written — a product decision, not a defect.
3. **Accept or reject the four unattended commits** (`3b821f7`, `32b9df1`, `f813499`, `d8b4d11`).
   *Why human:* They break the phase's own prohibitions. Documented, tested, deployed — but yours
   to accept.
4. **Read Terms section 6 on the live page** for editorial fit, and accept that the row was
   written by a scoped D1 `UPDATE` rather than through Admin → Pages.
   *Why human:* Prose quality is an editorial judgment.
5. **Watch the Workers Build for `f7a11b2`.** *Why human:* Runs on Cloudflare after the push.
6. **Review the three still-open findings** in `12-PROOF-ORDER.md` §7: Stripe Tax unavailable on
   the live account; `STORE_SUPPORT_EMAIL` still `support@mercora.example.com` with no routing rule
   for `orders@` (replies bounce); `app/api/tax/route.ts:180` hardcodes `txcd_99999999` so the
   displayed estimate disagrees with what checkout charges. All three are pre-existing and outside
   this phase's file scope.

Carried forward from earlier phases and still outstanding: `/gsd-verify-work 10` (Phase 10 UAT)
and the signed-in `GET /api/gift-cards` check from Phase 11.

### Gaps Summary

No blocking gaps. Three of the four roadmap success criteria are fully proven against production
in this session; the fourth is proven for issuance and delivery and falls one clause short on
account listing, which no purchase could have satisfied given the current code. That clause was
identified during planning (D-06), recorded as a product gap rather than claimed as a pass, and is
now the main decision waiting for you.

The reason this phase is `human_needed` rather than `passed` is the six items above — chiefly the
unmet SHOP-07 clause, the inbox check nobody but you can do, and the four prohibition-breaking
commits that need your sign-off. Nothing here needs a `--gaps` replan.

One bookkeeping correction to make: `.planning/REQUIREMENTS.md` marks SHOP-07 complete, which
overstates it by one clause.

---

_Verified: 2026-09-09T22:47:20Z_
_Verifier: Claude (gsd-verifier)_

## Post-review refresh (2026-09-09)

The code-review fix loop (12-REVIEW.md iterations 1–3, 12-REVIEW-FIX.md) landed after this verification: article/product copy corrected for scheduled delivery, the buyer's gift note now delivered in the email (URLs rejected), delivery failures routed through telemetry, gift-card lines classified nontaxable on both tax paths. Gates re-run green (2366 unit / 157 workers / 3 tail). Live re-checks after the fixes: article ETag == committed md5; `knowledge-gift-cards` and `prod_33` vectors carry the corrected wording; index still 48. Status stays `human_needed` for the SHOP-07 account-listing clause and Russell's sign-off on the unattended commits. `covered_files` extended and `covered_digest` recomputed below.
