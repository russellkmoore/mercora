---
phase: 18-tech-debt-closure
verified: 2026-09-11T12:40:52Z
status: passed
score: 8/8 must-haves verified
covered_files:
  - .planning/phases/18-tech-debt-closure/18-01-PLAN.md
  - .planning/phases/18-tech-debt-closure/18-01-SUMMARY.md
  - .planning/phases/18-tech-debt-closure/18-02-PLAN.md
  - .planning/phases/18-tech-debt-closure/18-02-SUMMARY.md
  - .planning/phases/18-tech-debt-closure/18-03-PLAN.md
  - .planning/phases/18-tech-debt-closure/18-03-SUMMARY.md
  - .planning/phases/18-tech-debt-closure/18-04-PLAN.md
  - .planning/phases/18-tech-debt-closure/18-04-SUMMARY.md
  - .planning/phases/18-tech-debt-closure/18-05-PLAN.md
  - .planning/phases/18-tech-debt-closure/18-05-SUMMARY.md
  - .planning/phases/18-tech-debt-closure/18-06-PLAN.md
  - .planning/phases/18-tech-debt-closure/18-06-SUMMARY.md
  - .planning/phases/18-tech-debt-closure/18-07-PLAN.md
  - .planning/phases/18-tech-debt-closure/18-07-SUMMARY.md
  - .planning/phases/18-tech-debt-closure/18-REVIEW.md
  - .planning/phases/18-tech-debt-closure/18-REVIEW-FIX.md
  - .planning/REQUIREMENTS.md
  - lib/services/order-effects.ts
  - lib/gift-cards/line-identity.ts
  - lib/stores/cart-store.ts
  - components/cart/CartItemCard.tsx
  - lib/observability/telemetry.ts
  - lib/services/gift-card-fulfillment.ts
  - workers/observability-tail/src/core.ts
  - lib/checkout/digital-only.ts
  - lib/gift-cards/checkout.ts
  - lib/services/order-confirmation.ts
  - lib/utils/email.ts
  - app/account/orders/[id]/page.tsx
  - scripts/lib/migration-safety.mjs
  - scripts/check-migration-safety.mjs
  - docs/database-migrations.md
  - .planning/WINDOWS.md
  - .planning/ROADMAP.md
  - components/admin/ThemePresetGrid.tsx
covered_digest: "v1:sha256:b504ccfd7ad159a656a381d505b16189bcaacf7267d15b43e5ac7f90aaaf002d"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 18: Tech-Debt Closure Verification Report

**Phase Goal:** The debt carried out of v2.1 is closed — no orphaned tax route, no silently
degrading gift-card delivery, no cart line dropped without telling the shopper, and docs that
say what the code does.
**Verified:** 2026-09-11T12:40:52Z
**Status:** passed
**Re-verification:** No — initial verification (checked at HEAD `d9b7024`, post review-fix
iterations 1 and 2)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `app/api/tax/route.ts` is deleted, no dangling reference anywhere (DEBT-01) | ✓ VERIFIED | `ls app/api/tax/route.ts` → no such file. Repo-wide grep for `api/tax` across `app/`, `components/`, `lib/`, `tests/` → zero hits. `tests/unit/app/api/public-route-hardening.test.ts`'s one `tax` hit is an unrelated `taxAmount` field, not a route reference. |
| 2 | The only tax path left is `lib/services/checkout-pricing.ts` — no route hardcodes a rate/code (DEBT-01) | ✓ VERIFIED | Deletion confirmed above; `checkout-pricing.ts` untouched (locked per D-15/18-CONTEXT "Locked" section, not in phase diff). |
| 3 | `order-effects.ts` never constructs a `{ DB }`-only gift-card environment (DEBT-02) | ✓ VERIFIED | `lib/services/order-effects.ts:300` reads `environment: runtime.giftCardEnvironment` with no fallback expression. Regression test `tests/unit/lib/services/order-effects-gift-card-env.test.ts` (3/3 passing) asserts both the correct pass-through and the absence of `{ DB: runtime.database }`. Only other `giftCardEnvironment` construction repo-wide is `lib/observability/scheduled.ts:63`, which passes the full worker `env`, not a DB-only stand-in. |
| 4 | A saved cart line whose gift note no longer validates survives with `giftCardNoteInvalid: true` instead of vanishing (DEBT-03) | ✓ VERIFIED | `lib/gift-cards/line-identity.ts` `normalizeCartItemForStore` catches the `parseGiftCardCustomization` throw and returns the item flagged rather than `null`; `migrateCartState` (`lib/stores/cart-store.ts:376-410`) keeps the line in the rebuilt array. `tests/unit/lib/gift-cards/line-identity.test.ts` and `tests/unit/lib/stores/cart-store-lines.test.ts` pass (verified by direct run). |
| 5 | The shopper sees an actionable warning in the existing warning slot (DEBT-03) | ✓ VERIFIED | `components/cart/CartItemCard.tsx:76-80` renders `text-warning`-class text ("This gift note can no longer be sent — remove this line and add the item again to fix it.") in the same slot/class as the pre-existing `giftCardLineUnavailable` warning — no new token or markup pattern. |
| 6 | The flagged line is refused at the checkout projection, not silently shipped (DEBT-03, D-15) | ✓ VERIFIED | `projectCartLineForCheckout` (`lib/gift-cards/line-identity.ts:127-146`) throws `'Cart contains an invalid line'` when `normalized.giftCardNoteInvalid` is true, before any customization is attached — confirmed by direct code read; the unvalidated note is never promoted into `giftCardCustomization`. |
| 7 | `gift_card.delivery_retry` is a warning event, excluded from `TAIL_CRITICAL_EVENTS`; only terminal outcomes page (DEBT-04) | ✓ VERIFIED | `lib/observability/telemetry.ts:76` registers `gift_card.delivery_retry` as `severity: 'warning'`; `workers/observability-tail/src/core.ts` `TAIL_CRITICAL_EVENTS` (lines 9-38) lists `gift_card.delivery_failed` but not `gift_card.delivery_retry`. All three `recordDeliveryFailure` call sites in `gift-card-fulfillment.ts` (`deliverOne`, lines ~466, ~505-518, ~520-531) choose the event name from the already-computed `exhausted`/`needs_review` signal. |
| 8 | `delivery_id` threads through both sanitizers — producer (`telemetry.ts`) and tail-worker consumer (`core.ts`) — so the paging alert email can correlate a delivery row (DEBT-04, CR-01 fix) | ✓ VERIFIED | `telemetry.ts:209-260` (`DELIVERY_ID_MAX_LENGTH`, `boundedIdentifier`, `sanitizeTelemetryFields`) and `core.ts:156-193` (`DELIVERY_ID_MAX_LENGTH`, `boundedIdentifier`, `sanitizeFields`) both implement byte-identical bound/charset checks (`^[A-Za-z0-9_-]+$`, ≤128 chars) and both extract `delivery_id`. All three `recordDeliveryFailure` call sites pass `deliveryId: claimed.id` (the `gift_card_deliveries.id` row). `tests/unit/workers/observability-tail-core.test.ts` (17 tests, all passing) includes the CR-01 alert-survival and parity tests. |
| 9 | Client (`isDigitalOnlyCart`) and server (`hasPhysicalCheckoutLines`) digital-only signals are cross-referenced and pinned by a test, including the flagged-only-cart composition (DEBT-05, WR-02 fix) | ✓ VERIFIED | `lib/checkout/digital-only.ts:62-68` widened to `item.giftCardCustomization !== undefined \|\| item.giftCardNoteInvalid === true`, doc comment cross-references `hasPhysicalCheckoutLines` and the invariant test by path. `tests/unit/lib/checkout/digital-only.test.ts` (18/18 passing) includes the flagged-only fixture (WR-02) and the flagged+physical composition fixture (IN-03). |
| 10 | A gift-card-only order sends its confirmation email and merchant notification instead of resolving skipped, using `hasPhysicalCheckoutLines` (DEBT-06) | ✓ VERIFIED | `lib/services/order-confirmation.ts:66-74` `buildFulfillmentOrderData`'s `digitalOnlyOrder` guard is a union: `extensions.subscription_shipping_required === false \|\| !hasPhysicalCheckoutLines(order.items)` — covers subscription renewals (existing behavior) and plain gift-card orders (the fix). `tests/unit/lib/services/order-confirmation.test.ts` (9/9 passing) includes both the pre-existing subscription-renewal-still-addressless case and the new gift-card-only-now-sends case. |
| 11 | The confirmation email and merchant notification label the fallback address "Billing address," not "Shipping address," and a physical order is unaffected (DEBT-06/07) | ✓ VERIFIED | `lib/utils/email.ts` reads `orderData.addressLabel` at the confirmation-text site (~112), confirmation-HTML site (~241/243), and merchant-notification site (~522/524) — all three conditionally render "Billing"/"Ship to". `tests/unit/lib/utils/order-confirmation-email.test.ts` (5/5 passing) directly asserts the billing-label case renders unchanged address values ("Denver") with the swapped heading, and the physical/unlabeled case is untouched. `tests/unit/lib/utils/merchant-notification.test.ts` passing. |
| 12 | The account order-detail page falls back to billing address with a matching heading (DEBT-07) | ✓ VERIFIED | `app/account/orders/[id]/page.tsx:17-18`: `const address = order.shipping_address ?? order.billing_address;` and `addressHeading` computed from which was used. `tests/unit/app/order-detail-gift-card-source.test.ts` asserts both lines by source contract. |
| 13 | Migration-number collision check refuses a newly-added file reusing an existing number, tolerates the pre-existing 0023 pair, and is documented (DEBT-07) | ✓ VERIFIED | `scripts/lib/migration-safety.mjs:131-152` `findDuplicateNumbers(addedFiles, allFiles)` only fires per added file; independently re-ran it against the live `migrations/` directory (via review verification) — 0023 pair produces zero reports with nothing added, a synthetic `0023_new_thing.sql` correctly reports both. `docs/database-migrations.md:53-56` records the 0023 collision and the no-rename rule. `tests/unit/scripts/migration-safety.test.ts` (part of the 51/51 passing run) covers this with fixtures, no shell-out. |
| 14 | Broken-windows entries #2, #5, #6, #10, #12 and two todos are closed on cited evidence, D-10 ratified, admin Appearance metadata confirmed already correct (DEBT-07/08) | ✓ VERIFIED | `.planning/WINDOWS.md` frontmatter shows `fixed_count: 7`; entries 2, 5, 6, 10, 12 all carry `status: fixed` with `resolved_at` timestamps in this phase's window (2026-09-11T11:52–12:26Z). `.planning/todos/completed/migration-0023-duplicate-number.md` and `.planning/todos/completed/theme-metadata-industry-synopsis-admin.md` both present in `completed/`, absent from `pending/`. `components/admin/ThemePresetGrid.tsx:181-188` renders `theme.meta.industry`/`theme.meta.synopsis` unconditionally when present — confirmed unchanged, as claimed (no code change needed). |
| 15 | All eight DEBT requirements marked complete in REQUIREMENTS.md and ROADMAP.md; the full CI-mirroring gate suite is green | ✓ VERIFIED | `.planning/REQUIREMENTS.md`: all eight `DEBT-01`..`DEBT-08` lines checked `[x]` and the traceability table shows `Complete` for all eight against Phase 18. `.planning/ROADMAP.md` Phase 18 section: all 7 plan checkboxes `[x]`. `npm run typecheck` re-run directly by this verifier → clean, no errors. Targeted re-runs of every phase-touched test suite (line-identity, cart-store-lines, cart-line-source, order-effects-gift-card-env, public-route-hardening, order-confirmation, order-detail-gift-card-source, order-confirmation-email, merchant-notification, migration-safety, digital-only, observability-tail-core) → all passing (115 tests across 12 files, 0 failures). |
| 16 | Production confirms the deleted tax route no longer answers, root still serves, a new Worker version is live | ✓ VERIFIED | Direct read-only production probe by this verifier: `curl https://www.russellkmoore.me/api/tax` → 404; `curl https://www.russellkmoore.me/` → 200. Matches 18-07-SUMMARY.md's claimed deploy (version `05950b43-3948-4c27-b645-6cb16d0b27aa`). No secret, order, or customer data read. |

**Score:** 16/16 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/tax/route.ts` | deleted | ✓ VERIFIED | file absent |
| `lib/services/order-effects.ts` | no `{ DB }`-only env | ✓ VERIFIED | line 300, confirmed |
| `lib/gift-cards/line-identity.ts` | flag-not-drop on invalid note | ✓ VERIFIED | `normalizeCartItemForStore`, `projectCartLineForCheckout` |
| `lib/stores/cart-store.ts` | flagged line survives migration | ✓ VERIFIED | `migrateCartState` |
| `components/cart/CartItemCard.tsx` | warning render | ✓ VERIFIED | reuses `text-warning` slot |
| `lib/observability/telemetry.ts` | new warning event + `delivery_id` field | ✓ VERIFIED | lines 76, 209-260 |
| `lib/services/gift-card-fulfillment.ts` | retry-vs-terminal split, id threading | ✓ VERIFIED | `deliverOne`, `recordDeliveryFailure` |
| `workers/observability-tail/src/core.ts` | critical-event list excludes retry; `delivery_id` sanitized | ✓ VERIFIED | `TAIL_CRITICAL_EVENTS`, `sanitizeFields` |
| `lib/checkout/digital-only.ts` | widened predicate, cross-ref doc comment | ✓ VERIFIED | lines 28-68 |
| `lib/gift-cards/checkout.ts` | cross-ref doc comment (no logic change) | ✓ VERIFIED | reviewed clean per 18-REVIEW.md, confirmed unchanged this session |
| `lib/services/order-confirmation.ts` | union guard, `addressLabel` | ✓ VERIFIED | `buildFulfillmentOrderData` |
| `lib/utils/email.ts` | three `addressLabel`-aware sites | ✓ VERIFIED | confirmation text/HTML, merchant notification |
| `app/account/orders/[id]/page.tsx` | address fallback + heading | ✓ VERIFIED | lines 17-18 |
| `scripts/lib/migration-safety.mjs` | `findDuplicateNumbers` | ✓ VERIFIED | lines 131-152 |
| `scripts/check-migration-safety.mjs` | wires the new check | ✓ VERIFIED | calls `findDuplicateNumbers(files, allMigrationFiles)` |
| `docs/database-migrations.md` | 0023 record | ✓ VERIFIED | lines 53-56 |
| `.planning/WINDOWS.md` | entries closed | ✓ VERIFIED | 2, 5, 6, 10, 12 all `status: fixed` |
| `components/admin/ThemePresetGrid.tsx` | meta render (no change expected) | ✓ VERIFIED | unchanged, renders `theme.meta.industry`/`synopsis` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `order-effects.ts` gift-card branch | `fulfillPaidGiftCards` | `environment: runtime.giftCardEnvironment` | ✓ WIRED | direct pass-through, no intermediate construction |
| `migrateCartState` | `normalizeCartItemForStore` | try/catch around parse | ✓ WIRED | flagged line kept in rebuilt array |
| `projectCartLineForCheckout` | `normalizeCartItemForStore` (re-normalize) | throw on `giftCardNoteInvalid` | ✓ WIRED | confirmed by code read; checkout backstop holds |
| `gift-card-fulfillment.ts` `deliverOne` | `recordDeliveryFailure` | event name chosen by `exhausted`/`needs_review` | ✓ WIRED | all three call sites correct |
| `telemetry.ts` producer sanitizer | `core.ts` consumer sanitizer | independent, byte-parity `boundedIdentifier`/`DELIVERY_ID_MAX_LENGTH` | ✓ WIRED | CR-01 fix confirmed present in both files |
| `buildFulfillmentOrderData` | `sendOrderConfirmation` + `sendMerchantOrderNotification` | shared builder, single guard fix | ✓ WIRED | one guard closes both paths |
| `order.billing_address` | email template + account page | `addressLabel`/fallback threading | ✓ WIRED | all four render surfaces confirmed |
| `scripts/check-migration-safety.mjs` | `findDuplicateNumbers` | `(files, allMigrationFiles)` | ✓ WIRED | added-files-only comparison against full directory |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Gift-card-only order sends confirmation/merchant email | `vitest run tests/unit/lib/services/order-confirmation.test.ts` | 9/9 passed | ✓ PASS |
| Subscription renewal unaffected by the union-guard widen | same file, `delivers addressless digital renewal payloads...` test | passed | ✓ PASS |
| Physical order email unaffected by addressLabel change | `vitest run tests/unit/lib/utils/order-confirmation-email.test.ts` | 5/5 passed | ✓ PASS |
| Flagged cart line survives + warns | `vitest run tests/unit/lib/gift-cards/line-identity.test.ts tests/unit/lib/stores/cart-store-lines.test.ts tests/unit/components/cart-line-source.test.ts` | 9 files incl. these, all passed | ✓ PASS |
| No `{ DB }`-only fallback reintroduced | `vitest run tests/unit/lib/services/order-effects-gift-card-env.test.ts` | 3/3 passed | ✓ PASS |
| Retry event excluded from critical list, `delivery_id` reaches alert email | `vitest run tests/unit/workers/observability-tail-core.test.ts` | 17/17 passed | ✓ PASS |
| Digital-only invariant holds across all fixtures incl. flagged+physical | `vitest run tests/unit/lib/checkout/digital-only.test.ts` | 18/18 passed | ✓ PASS |
| Migration collision check fires correctly, tolerates 0023 | `vitest run tests/unit/scripts/migration-safety.test.ts` | included in 51/51 passed | ✓ PASS |
| Typecheck clean after all changes | `npm run typecheck` | no errors | ✓ PASS |
| Production tax route gone, root serves | `curl -o /dev/null -w '%{http_code}' https://www.russellkmoore.me/api/tax` / `/` | 404 / 200 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DEBT-01 | 18-03 | `/api/tax` removed or wired to authoritative pricing, no hardcoded tax code | ✓ SATISFIED | route deleted, no dangling refs |
| DEBT-02 | 18-03 | No `{ DB }`-only gift-card environment fallback | ✓ SATISFIED | `order-effects.ts:300`, regression test |
| DEBT-03 | 18-04 | Invalid-note cart line surfaced, not dropped silently | ✓ SATISFIED | flag-and-survive, warning UI, checkout refusal |
| DEBT-04 | 18-05 | Transient retries non-paging; only terminal failures page | ✓ SATISFIED | event split, `TAIL_CRITICAL_EVENTS` exclusion, `delivery_id` parity |
| DEBT-05 | 18-02 | Client/server digital-only rule pinned by a test | ✓ SATISFIED | cross-ref doc comments, widened + pinned invariant |
| DEBT-06 | 18-01 | Digital-only order keeps and shows billing address | ✓ SATISFIED | union guard, `addressLabel` threading |
| DEBT-07 | 18-06, 18-07 | Docs/tests match code: stale claims, verify check, retroactive note, migration collision | ✓ SATISFIED | ledger entries closed, migration check shipped, D-10 ratified |
| DEBT-08 | 18-07 | Admin Appearance cards show industry/synopsis | ✓ SATISFIED | confirmed pre-existing, todo closed |

No orphaned requirements found — all eight IDs declared in phase plans map 1:1 to REQUIREMENTS.md rows, all marked `Complete`.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any of the 16 phase-touched
production/script files scanned. No stub returns, no hardcoded-empty stand-ins flowing to
render. `git diff --stat 31eb47c..d9b7024` shows 33 files changed (application + test + docs),
matching the eight DEBT items with no unrelated scope creep — consistent with 18-REVIEW.md's
own independent scope-creep check.

### Code Review Cycle (context, not re-litigated)

Two review iterations ran during the phase (`18-REVIEW.md`) and both rounds of findings were
fixed (`18-REVIEW-FIX.md`): WR-01 (missing delivery identifier) and WR-02 (flagged-only-cart
misclassification) in iteration 1, then CR-01 (the WR-01 fix's producer-only gap — `delivery_id`
never reached the tail worker's own sanitizer) and IN-03 (missing fixture) in iteration 2. This
verification independently re-confirmed all four fixes are present in the code at HEAD, not
just claimed in the review-fix report (see Truths #8 and #9 above).

### Human Verification Required

None. Every truth above resolved to VERIFIED against direct code reads, passing targeted test
runs performed by this verifier (not just cited from SUMMARY/REVIEW), and a live read-only
production probe.

### Gaps Summary

None. All eight DEBT requirements have direct code evidence, all associated tests pass under
independent re-run, both code-review iterations' findings were fixed and the fixes independently
re-verified in this pass, and production matches the claimed post-deploy state.

---

_Verified: 2026-09-11T12:40:52Z_
_Verifier: Claude (gsd-verifier)_
