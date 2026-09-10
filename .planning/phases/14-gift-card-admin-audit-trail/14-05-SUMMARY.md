---
phase: 14-gift-card-admin-audit-trail
plan: 05
subsystem: database
tags: [gift-cards, d1, email, tdd, fulfillment, admin]

requires:
  - phase: 14-01
    provides: "gift_card_events table, gift_card_accounts.code_suffix column"
  - phase: 14-03
    provides: "codeSuffix on IssueGiftCardInput/issueAccount, giftCardReissueId/giftCardReissueAdjustmentBusinessKey"
  - phase: 14-04
    provides: "giftCardCodeSuffix/maskGiftCardCodeSuffix in code.ts"
provides:
  - "issueAdminGiftCard exported from lib/services/gift-card-fulfillment.ts — issues an order-less gift card through issueLine's own machinery (D-07, D-19)"
  - "resendGiftCardDelivery exported from lib/services/gift-card-fulfillment.ts — re-sends a sent/needs_review delivery without mutating the row (D-08, D-21)"
  - "codeSuffix now recorded on checkout-issued cards via issueLine (D-02, second of the two issuance paths)"
  - "stableId widened to a variadic discriminator list, byte-identical for existing two-argument callers"
affects: [14-06, 14-07, 14-08]

actuals:
  tokens: 6019
  tasks: 3
  commits: 5
  plan_head_before: 2119dd3dd6450562eb67580152d632528e2bbe9d

tech-stack:
  added: []
  patterns:
    - "RED scaffolds return a fixed, non-throwing wrong value (e.g. { sent: true } unconditionally) rather than throwing unconditionally — an unconditional throw makes 'rejects/refuses' assertions pass vacuously; a fixed wrong success makes every assertion, including the refusal ones, fail for the missing behavior itself"
    - "admin-create and resend both stay entirely inside lib/services/gift-card-fulfillment.ts, reusing the module-private deliveryMessage/emailEnvironmentFrom/giftMessageFor/decryptGiftCardDeliveryCode helpers in place rather than exporting them — the only two new exports are the two functions plan 14-06/14-07's routes call"
    - "resendGiftCardDelivery issues no UPDATE at all; its 'unchanged' guarantee is structural (no write statement exists), not merely tested"

key-files:
  created: []
  modified:
    - lib/services/gift-card-fulfillment.ts
    - tests/integration/lib/services/gift-card-fulfillment.test.ts

key-decisions:
  - "GIFT_CARD_ADMIN_ISSUE_MAX_MINOR is a literal module constant (20,000 minor units / $200), not a live query against product_variants. This follows the plan's own action text verbatim ('read once and exported as a named constant in this module with a comment pointing at where the denominations live') rather than reading D-07's 'the product's configured maximum denomination' as a runtime DB read. Consequence worth flagging: if the store's real gift-card denominations ever diverge from data/d1/seed.sql's $25/$50/$100/$200, this ceiling will not track that change without a code edit."
  - "stableId (private) widened from a fixed two-discriminator signature to a variadic prefix + ...parts signature, so issueAdminGiftCard's single-discriminator (requestId) id derivation and issueLine/deliverOne's two-discriminator (orderId, lineId) derivation share one function. parts.join('\\u0000') over exactly two parts reproduces the original template literal byte-for-byte, so every existing call site's output is unchanged."
  - "issueAdminGiftCard validates the recipient through parseGiftCardCustomization (the same whole-object validator checkout uses) rather than writing a second email regex; resendGiftCardDelivery validates an optional admin-supplied `to` through the already-exported validateGiftCardRecipientEmail field validator for the same reason."
  - "resendGiftCardDelivery never calls the sender inside issueAdminGiftCard's own flow — the pending delivery row it creates (deliverAfter unset, so immediately due) is left for the existing cron drain to claim, exactly as D-07/GCA-07 require ('issued and delivered like a purchased one')."

requirements-completed: [GCA-01, GCA-05, GCA-06, GCA-07]

coverage:
  - id: D1
    description: "issueAdminGiftCard creates an account with no order/line/purchaser attribution and its own four-character code suffix; a retried requestId converges to one account, a different requestId diverges; an amount at/below zero or above the configured ceiling throws before any write; the created card is delivered by the unmodified cron drain (D-07, D-19)"
    requirement: GCA-07
    verification:
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#admin-created gift card (D-07, D-19) > creates an account with no order, line, or purchaser attribution, and a four-character code suffix"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#admin-created gift card (D-07, D-19) > converges two calls with the same requestId into one account"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#admin-created gift card (D-07, D-19) > creates two separate accounts for two different requestIds"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#admin-created gift card (D-07, D-19) > refuses an amount at or below zero, or above the configured maximum, and writes nothing"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#admin-created gift card (D-07, D-19) > delivers an admin-created card through the existing cron drain"
        status: pass
    human_judgment: false
  - id: D2
    description: "resendGiftCardDelivery re-sends a sent or needs_review delivery to the original recipient or an admin-supplied address, with the caller's own idempotency key (never the row's), leaving the delivery row's status/attempt_count/completed_at/claim_token/lease_expires_at unchanged; refuses a pending delivery (not_resendable) and a delivery with no retained ciphertext (code_unavailable) without sending; reports a sender failure (send_failed) and leaves the row untouched (D-08, D-21)"
    requirement: GCA-06
    verification:
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#gift-card delivery resend (D-08, D-21) > resends a sent delivery to the original recipient with the caller-supplied idempotency key, leaving the delivery row unchanged"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#gift-card delivery resend (D-08, D-21) > resends a needs_review delivery"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#gift-card delivery resend (D-08, D-21) > refuses a pending delivery without sending"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#gift-card delivery resend (D-08, D-21) > sends to an admin-supplied address instead of the original recipient when `to` is provided"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#gift-card delivery resend (D-08, D-21) > refuses a delivery whose ciphertext is absent"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#gift-card delivery resend (D-08, D-21) > reports a sender failure to the caller and leaves the delivery row untouched"
        status: pass
      - kind: other
        ref: "npm run typecheck (0 errors)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A card bought at checkout (fulfillPaidGiftCards -> issueLine) now records its own four-character code_suffix, the second of the two issuance paths D-02 names; pre-0024 cards remain NULL with no backfill (unchanged, not exercised by this plan)"
    requirement: GCA-01
    verification:
      - kind: integration
        ref: "tests/integration/lib/services/gift-card-fulfillment.test.ts#gift-card issuance and durable delivery on real D1 > records a four-character code suffix on a checkout-issued card (D-02)"
        status: pass
      - kind: other
        ref: "mise exec -- npm test (302 files / 2632 tests) and mise exec -- npm run test:workers (30 files / 231 tests), both full-suite green"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-10
status: complete
---

# Phase 14 Plan 05: Gift-Card Admin Issuance and Resend Summary

**Two new exports on `lib/services/gift-card-fulfillment.ts` — `issueAdminGiftCard` (order-less card, same machinery as a purchase) and `resendGiftCardDelivery` (re-send with a fresh idempotency key, zero writes to the delivery row) — plus `code_suffix` now recorded on checkout-issued cards too.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-10T20:52:00Z
- **Completed:** 2026-09-10T21:47:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- `issueAdminGiftCard` mints a gift card with no order/line/purchaser attribution, validated against a documented ceiling and the checkout's own email validator, then generates/digests/AAD-encrypts a code and calls `issueAccount` exactly as `issueLine` does — the created card's pending delivery is picked up and sent by the unmodified cron drain.
- `resendGiftCardDelivery` re-sends a `sent`/`needs_review` delivery's email to the original recipient or an admin-typed address, reusing `deliveryMessage`/`decryptGiftCardDeliveryCode`/`emailEnvironmentFrom` in place; it issues no UPDATE to the delivery row at all, and the caller-supplied idempotency key is what reaches the sender, never the row's own `email_idempotency_key`.
- Checkout-issued cards (`issueLine`) now carry their own `code_suffix`, closing the second of D-02's two issuance paths.
- `stableId` (private) widened from a fixed two-discriminator signature to a variadic one, so the new single-discriminator admin-create id derivation shares the exact same helper as the existing order+line derivation, with byte-identical output for every prior call site.

## Task Commits

Task 1 and Task 2 both carried `tdd="true"` and went through RED -> GREEN (no REFACTOR needed — both GREEN implementations were already minimal). Task 3 was a plain `type="auto"` task.

1. **Task 1 RED: failing tests for issueAdminGiftCard** - `8f0c17d` (test)
2. **Task 1 GREEN: implement issueAdminGiftCard** - `7c22ba7` (feat)
3. **Task 2 RED: failing tests for resendGiftCardDelivery** - `f5fff64` (test)
4. **Task 2 GREEN: implement resendGiftCardDelivery** - `0aaecb7` (feat)
5. **Task 3: record code suffix on checkout-issued cards** - `13f3554` (feat)

**Plan metadata:** (this commit)

**Tracer feedback gate (Task 1):** re-ran Task 1's full `<verify>` (all 12 tests in the target file, including the 7 pre-existing ones) after GREEN, before starting Task 2's expansion, per the `end-of-phase` human-verify mode with an automated-only `<verify>` block. Passed — logged `⚡ Tracer verified end-to-end — expanding` and continued without a checkpoint.

## Files Created/Modified
- `lib/services/gift-card-fulfillment.ts` - new exports `issueAdminGiftCard`, `resendGiftCardDelivery`, `IssueAdminGiftCardResult`, `ResendGiftCardDeliveryResult`; `stableId` widened to variadic; `issueLine`'s `issueAccount` call now passes `codeSuffix`
- `tests/integration/lib/services/gift-card-fulfillment.test.ts` - 12 new integration cases (5 for admin-create, 6 for resend, 1 for checkout code-suffix) against real D1, plus an `issueAndDeliver`/`deliverySnapshot` test helper pair

## Decisions Made
- `GIFT_CARD_ADMIN_ISSUE_MAX_MINOR` is a literal module constant (20,000 minor units), not a live query — see frontmatter `key-decisions` for the full rationale and the known-divergence caveat if the store's real denominations ever change.
- `stableId` widened to `(prefix, ...parts)`; `parts.join(' ')` over two parts reproduces the original two-argument template literal exactly.
- Both new functions reuse existing shared validators (`parseGiftCardCustomization`, `validateGiftCardRecipientEmail`) instead of writing new email-format regexes.
- `issueAdminGiftCard` never calls the sender itself — delivery is left entirely to the existing cron drain, per D-07/GCA-07's "issued and delivered like a purchased one."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Validated the admin-supplied `to` address in `resendGiftCardDelivery`**
- **Found during:** Task 2 (writing `resendGiftCardDelivery`)
- **Issue:** The plan's action text for Task 2 does not mention validating the optional `to` argument's format. Since a resend to a fraud-recovery address is explicitly named as an exfiltration-adjacent surface in the plan's own threat model (T-14-25), passing an unvalidated string straight to `sendEmail`'s `to` field risked forwarding a malformed or attacker-shaped value with no format check at all.
- **Fix:** When `to` is supplied, it is validated through the already-exported `validateGiftCardRecipientEmail` field validator (the same one the checkout recipient form uses) before use; an invalid address throws rather than being handed to the sender.
- **Files modified:** lib/services/gift-card-fulfillment.ts
- **Verification:** Covered indirectly by the existing "sends to an admin-supplied address" test (a well-formed address); no dedicated malformed-`to` test was added since the plan's acceptance criteria did not call for one, but the validator is the same one already integration-tested elsewhere in this codebase.
- **Committed in:** `0aaecb7` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical input validation).
**Impact on plan:** Defense-in-depth only — no scope creep, no new files, no change to any of the plan's stated artifacts, signatures, or acceptance criteria. All `must_haves.truths` and every task's acceptance criteria are met exactly as specified otherwise.

## Issues Encountered
- The straightforward RED-scaffold technique from earlier gift-card TDD plans (an unconditional `throw`) produces a **vacuous pass** for any test asserting a rejection/refusal (e.g. "refuses an amount above the ceiling", "refuses a pending delivery") — the scaffold throws/refuses regardless of input, so the assertion is trivially satisfied without proving anything about the missing validation logic. Caught before persisting RED evidence for both Task 1 and Task 2 by inspecting each new test's actual pass/fail status individually, not just the aggregate fail count. Resolved by using a scaffold that returns a fixed, unconditional *wrong success* instead (`{ created: false }` / `{ sent: true }`) — this makes every new assertion, including the refusal ones, fail for the missing behavior itself. Documented as an established pattern in `tech-stack.patterns` above for future TDD plans in this codebase to reuse.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `issueAdminGiftCard` is ready for plan 14-06's `POST /api/admin/gift-cards` route and plan 14-07's reissue route's new-card delivery to call directly.
- `resendGiftCardDelivery` is ready for plan 14-07's `POST /api/admin/gift-cards/[id]/resend` route to call directly, passing the full worker env obtained from `getCloudflareContext().env` and a `gift-card-resend/{deliveryId}/{eventId}`-shaped idempotency key it mints itself.
- Both issuance paths (checkout and admin) now record `code_suffix`; plan 14-08's masked-code list column has a non-NULL suffix to render for every card issued after migration 0024.
- GCA-05 (reissue) and the remainder of GCA-06/GCA-07 (routes, events, UI) are not delivered by this plan — this plan supplies only the fulfillment-service primitives those later plans' routes will call. `giftCardReissueId`/`giftCardReissueAdjustmentBusinessKey` and the repository's `reissue` method (14-03) already carry `codeSuffix` through to a reissued card without any change needed here.
- No blockers. Full unit suite (302 files / 2632 tests) and full D1 integration suite (30 files / 231 tests) both green after this plan's changes; `npm run typecheck` and `npx eslint` on both changed files are clean.

---
*Phase: 14-gift-card-admin-audit-trail*
*Completed: 2026-09-10*

## Self-Check: PASSED

- `lib/services/gift-card-fulfillment.ts` and `tests/integration/lib/services/gift-card-fulfillment.test.ts` verified present on disk with `[ -f ]`: FOUND
- All 5 task commits (`8f0c17d`, `7c22ba7`, `f5fff64`, `0aaecb7`, `13f3554`) verified in `git log --oneline --all`: FOUND
- `export async function issueAdminGiftCard` and `export async function resendGiftCardDelivery` verified present via grep: FOUND
- `mise exec -- npx vitest run --config vitest.workers.config.mts tests/integration/lib/services/gift-card-fulfillment.test.ts`: 19/19 passed
- `mise exec -- npm test`: 302 files / 2632 tests passed
- `mise exec -- npm run test:workers`: 30 files / 231 tests passed
- `npm run typecheck`: 0 errors
- `npx eslint lib/services/gift-card-fulfillment.ts tests/integration/lib/services/gift-card-fulfillment.test.ts`: 0 errors, 0 warnings
