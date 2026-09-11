---
phase: 18-tech-debt-closure
reviewed: 2026-09-11T12:02:44Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - app/account/orders/[id]/page.tsx
  - app/api/tax/route.ts (deleted)
  - components/cart/CartItemCard.tsx
  - docs/database-migrations.md
  - lib/checkout/digital-only.ts
  - lib/gift-cards/checkout.ts
  - lib/gift-cards/line-identity.ts
  - lib/observability/telemetry.ts
  - lib/services/gift-card-fulfillment.ts
  - lib/services/order-confirmation.ts
  - lib/services/order-effects.ts
  - lib/stores/cart-store.ts
  - lib/types/cartitem.ts
  - lib/utils/email.ts
  - scripts/check-migration-safety.mjs
  - scripts/lib/migration-safety.mjs
  - tests/integration/lib/services/gift-card-fulfillment.test.ts
  - tests/unit/api/tax-route.test.ts (deleted)
  - tests/unit/app/api/public-route-hardening.test.ts
  - tests/unit/app/order-detail-gift-card-source.test.ts
  - tests/unit/components/cart-line-source.test.ts
  - tests/unit/lib/checkout/digital-only.test.ts
  - tests/unit/lib/gift-cards/line-identity.test.ts
  - tests/unit/lib/services/order-confirmation.test.ts
  - tests/unit/lib/services/order-effects-gift-card-env.test.ts
  - tests/unit/lib/stores/cart-store-lines.test.ts
  - tests/unit/lib/utils/merchant-notification.test.ts
  - tests/unit/lib/utils/order-confirmation-email.test.ts
  - tests/unit/observability/instrumentation-source.test.ts
  - tests/unit/scripts/migration-safety.test.ts
  - tests/unit/workers/observability-tail-core.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-09-11T12:02:44Z
**Depth:** standard
**Files Reviewed:** 20 production files + 15 test files (diff from `31eb47c` to `HEAD`)
**Status:** issues_found (no blockers)

## Summary

Reviewed all eight DEBT items closed by Phase 18's six parallel plans. Traced each
item's claimed behavior against the actual source, not just the SUMMARY narration.

- **DEBT-01** (`/api/tax` deletion): clean. Zero dangling references anywhere in the
  repo outside `.open-next` (gitignored build output). `public-route-hardening.test.ts`
  does not assert a 404 for the deleted route — it simply dropped the row.
- **DEBT-02** (gift-card env fallback): clean. `order-effects.ts:296` now reads
  `runtime.giftCardEnvironment` with no `{ DB: ... }` construction anywhere in the
  file. The regression test would catch a literal reintroduction of the exact
  fallback expression (see IN-01 below for its one real limitation).
- **DEBT-03** (invalid gift note): clean and traced end-to-end.
  `normalizeCartItemForStore` flags-and-survives; `projectCartLineForCheckout`
  re-normalizes and throws on a flagged line (with the flag correctly forwarded
  across the second pass, closing a real gap the executor caught during TDD);
  `CartItemCard.tsx` renders the warning and — because a flagged line carries no
  `giftCardCustomization` — `GiftCardRecipientBlock` is provably never reached for
  it (`{item.giftCardCustomization && <GiftCardRecipientBlock .../>}`).
- **DEBT-04** (delivery-retry telemetry): `gift_card.delivery_retry` is confirmed
  excluded from `TAIL_CRITICAL_EVENTS`; all three `recordDeliveryFailure` call
  sites route correctly (absent-code-material stays terminal-on-attempt-one,
  post-send-failure and the catch block both choose retry vs. failed based on the
  already-computed `exhausted`/`needs_review` signal). One real gap: **the retry
  event carries no delivery id, gift-card id, or order id** — see WR-01.
- **DEBT-05** (digital-only equivalence): clean. Diff to both predicate files is
  doc-comments only; confirmed via `git diff` (17/23 inserted lines, all prose).
  Invariant test still passes, floor-guarded against silent fixture hollowing.
- **DEBT-06/07** (billing address + label): clean. The union guard
  (`subscription_shipping_required === false || !hasPhysicalCheckoutLines(...)`)
  is present exactly as the SUMMARY describes and the regression canary
  (`delivers addressless digital renewal payloads...`) still passes. All three
  `lib/utils/email.ts` sites checked: the confirmation HTML/text (~109, ~241) and
  merchant notification (~513-541) are `addressLabel`-aware; the untouched fourth
  site (`generateOrderStatusUpdateHTML`, ~436) was deliberately left hardcoded per
  a documented deviation — confirmed structurally unreachable for a digital order
  (it's driven only by the physical-shipment status-update path), though see
  IN-02 for a note on that justification's actual precision.
- **DEBT-07** (migration collision): clean. `findDuplicateNumbers` fires only when
  a newly-added file's number collides with anything else, and I independently
  ran it against the live repo state — the existing `0023` pair produces zero
  reports with no files added, and a synthetic `0023_new_thing.sql` addition
  correctly reports both existing collisions.
- **Scope creep**: none found. Full diff stat (31 files, +735/-317) matches the
  eight items exactly; no unrelated file touched.

Smoke tests, typecheck, and docs:lint all pass (see below).

## Warnings

### WR-01: Gift-card delivery telemetry (both the new retry event and the pre-existing critical event) carries no identifier an operator can use to find the record

**File:** `lib/services/gift-card-fulfillment.ts:113-131` (`recordDeliveryFailure`), consumed at `:458-460`, `:495-500`, `:507-509`
**Issue:** DEBT-04's own doc comment (`gift-card-fulfillment.ts:108-112`) and the
integration test's comment (`tests/integration/lib/services/gift-card-fulfillment.test.ts:319-320`)
both claim a retry is "still findable and attributable" without paging. In practice
the emitted envelope's `fields` are limited to `provider`, `retryable`, `trigger`,
and `attempt` — there is no `gift_card_id`, `delivery_id`, or `order_id` anywhere
in the closed `ALLOWED_FIELD_ENUMS` taxonomy (`lib/observability/telemetry.ts:117-138`).
An operator looking at a `gift_card.delivery_retry` warning in the log stream has
no way to correlate it to a specific delivery row, gift card, or order — only
"some cloudflare_email delivery on attempt 1 via a request trigger failed." This
is a pre-existing structural limitation of the whole `commerce.telemetry.v1`
contract (the same is true of the terminal `gift_card.delivery_failed` event both
before and after this phase), not a regression this phase introduced, but DEBT-04
explicitly claims "an operator can find and attribute a retry" and that claim
does not hold as written.
**Fix:** Either loosen the closed-taxonomy field set to allow one bounded,
non-PII identifier (e.g. `delivery_id`, already a UUID with no sensitive content)
for the two gift-card delivery events, or soften the SUMMARY/test-comment
"findable and attributable" language to "attributable by provider/trigger/attempt
only, cross-reference `gift_card_deliveries` by time window for the specific
record." Given the field allowlist is a deliberate anti-PII-leak boundary, adding
`delivery_id` (opaque UUID, no PII) is the lower-risk of the two options.

### WR-02: `lib/checkout/digital-only.ts`'s client-side signal still misclassifies a cart holding only a flagged (invalid-note) gift-card line

**File:** `lib/checkout/digital-only.ts:51-55` (`isDigitalOnlyCart`)
**Issue:** Confirmed still present in the final code:
`isDigitalOnlyCart` keys on `item.giftCardCustomization !== undefined`. A
DEBT-03-flagged line (`giftCardNoteInvalid: true`) carries no
`giftCardCustomization` by design, so a cart holding only such a line is
classified as *not* digital-only client-side, while the server
(`hasPhysicalCheckoutLines`, which reads `fulfillment_type`) would disagree once
an order line existed. This was caught by the 18-04 executor and explicitly
recorded as WINDOWS.md ledger entry 12 rather than silently left undiscovered —
credit for that — but it is a real, live defect in the DEBT-05 invariant this
phase otherwise pins and tests: `isDigitalOnlyCart(items) === !hasPhysicalCheckoutLines(orderItems)`
does not hold for this composition, and no fixture in
`tests/unit/lib/checkout/digital-only.test.ts` exercises a flagged-line cart to
catch it. Practical impact is UI-only (wrong intermediate checkout step shown;
`projectCartLineForCheckout` refuses the line regardless of which step renders),
so this is not a security or correctness-of-charge issue, but it is a known,
unfixed gap in a phase whose explicit goal was closing exactly this class of gap.
**Fix:** Either add a fifth fixture to `digital-only.test.ts` for a
flagged-only cart (documenting the known divergence explicitly, so it doesn't
silently start passing if someone "fixes" one side without the other), or widen
`isDigitalOnlyCart` to treat `giftCardNoteInvalid: true` the same as a present
customization (since checkout will refuse the line either way, both signals
should agree it's "digital-only" until removed). The latter is a small, low-risk
fix scoped entirely to `digital-only.ts` and would close ledger entry 12 rather
than carry it forward.

## Info

### IN-01: `order-effects-gift-card-env.test.ts`'s regression assertion is a literal string match, not a semantic one

**File:** `tests/unit/lib/services/order-effects-gift-card-env.test.ts:20-22`
**Issue:** `expect(source).not.toContain('{ DB: runtime.database }')` catches a
byte-identical reintroduction of the removed fallback, but would not catch a
reformatted equivalent (e.g. `{DB: runtime.database}` with no spaces, a
multi-line object literal, or `{ DB: runtime.database, ...}` with an added key).
This is the accepted limitation of source-contract tests generally and is
adequate for its stated purpose (a landmine-reintroduction canary, not a full
static-analysis guarantee), but is worth knowing the exact boundary of what it
proves — answering the review brief's own question ("would the test fail if
someone re-added the fallback?"): yes, for the exact original expression;
no guarantee for a re-derived equivalent.
**Fix:** No action required; noted for awareness. If stronger enforcement is
wanted later, a TS AST check (as DEBT-04's `instrumentation-source.test.ts` now
does) would close the gap, but that's disproportionate for a single-line guard.

### IN-02: `cart-store.ts`'s line-merge key can silently combine two *different* invalid gift notes into one flagged line

**File:** `lib/stores/cart-store.ts:377-404` (`migrateCartState`), `lib/gift-cards/line-identity.ts:34-42` (`canonicalLineFacts`)
**Issue:** A flagged line's `canonicalLineFacts` omits `giftCardCustomization`
(since the invalid customization was not carried forward), so two persisted cart
lines for the *same product/variant* but with *different, both-invalid* gift
notes now merge into a single line via `sameCartLineFacts` (previously both
would have been dropped independently, so this composition never arose). Not
covered by any test — `cart-store-lines.test.ts`'s mixed valid/invalid case uses
one valid and one invalid line, not two invalid lines for the same
product/variant. Since the original note text is unrecoverable either way (the
remediation is remove-and-re-add), this has no data-loss consequence beyond what
already exists, but the shopper would see one combined-quantity flagged line
where they'd added two separate gift recipients — a minor surprise, not a
correctness bug.
**Fix:** No action required for correctness. If desired, add a test case
documenting the merge is intentional/acceptable, or key `canonicalLineFacts` on
`giftCardNoteInvalid` presence too so two invalid lines never silently combine.

## Verification Performed

- `mise exec -- npx vitest run tests/unit/lib/services tests/unit/lib/gift-cards tests/unit/lib/stores tests/unit/components/cart-line-source.test.ts tests/unit/lib/checkout tests/unit/scripts tests/unit/workers/observability-tail-core.test.ts tests/unit/app/order-detail-gift-card-source.test.ts tests/unit/lib/utils --reporter=dot` → **943/943 tests passed, 79/79 files**
- `npm run typecheck` → clean, no errors
- `npm run docs:lint` → `0 violations`
- `npm run check:migrations -- --base 31eb47c` → `no migrations added; nothing to check.` (confirms no migration touched by this phase)
- Independently ran `findDuplicateNumbers` against the live `migrations/` directory: the existing `0023` pair reports zero collisions with nothing added; a synthetic `0023_new_thing.sql` addition correctly reports both existing `0023` files as collisions.
- `git diff 31eb47c HEAD -- lib/checkout/digital-only.ts lib/gift-cards/checkout.ts` reviewed line-by-line: confirmed comment-only, zero executable-line changes.
- `git diff --stat 31eb47c HEAD -- . ':!.planning'` reviewed in full: 31 files, all attributable to the eight DEBT items; no scope creep.
- Repo-wide grep for `api/tax` outside `.planning/` and `.open-next/` (gitignored build output): zero hits.

---

_Reviewed: 2026-09-11T12:02:44Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
