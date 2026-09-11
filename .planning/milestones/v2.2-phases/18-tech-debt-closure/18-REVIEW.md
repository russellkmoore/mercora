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

## Iteration 2

**Reviewed:** 2026-09-11T12:16:43Z
**Scope:** Re-review of the three 18-REVIEW-FIX.md commits (`eac58eb` WR-01, `134ae6a` WR-02, `5067f48` IN-02) against `lib/observability/telemetry.ts`, `lib/services/gift-card-fulfillment.ts`, `lib/checkout/digital-only.ts`, `workers/observability-tail/src/core.ts`, and the touched test files.

### Verified clean

- **WR-01 sanitizer (`boundedIdentifier` in `lib/observability/telemetry.ts:210-215`):** genuinely bounds the field. Rejects non-strings, empty strings, anything over 128 chars, and anything outside `[A-Za-z0-9_-]+` — no path for free text, an email address, or a bearer code to slip through. Confirmed directly against the unit tests (`telemetry.test.ts:106-116`) and against a live integration run (`gift_delivery_admin_9d3629d0...` — 84 chars, safe charset, well under the 128 cap).
- **WR-01 `claimed.id` threading (`lib/services/gift-card-fulfillment.ts`):** correct at all three `recordDeliveryFailure` call sites (`:470-474`, `:511-518`, `:527-531`). `claimed.id` is bound from the `RETURNING id, ...` clause of the `UPDATE gift_card_deliveries ... WHERE gift_card_id = ?` statement (`:448-461`) — it is the delivery row's own primary key, not `gift_card_id` or `order_id`. All three sites pass it through unchanged.
- **WR-02 boolean logic (`lib/checkout/digital-only.ts:62-68`):** `items.every((item) => item.giftCardCustomization !== undefined || item.giftCardNoteInvalid === true)` is an AND-across-items of an OR-within-item. Traced by hand for the specific composition in the review brief — one flagged gift-card line (`giftCardNoteInvalid: true`, no `giftCardCustomization`) plus one real physical line (neither field set): the physical line fails both disjuncts, so `.every()` short-circuits to `false`. **Not** misclassified as digital-only. No regression.
- **cart-store / IN-02:** `5067f48` added a documenting test only, no source change; re-confirmed the premise it documents (`canonicalLineFacts` drops `giftCardCustomization` for a flagged line, so two different-note flagged lines for the same product/variant merge on migration) is unchanged and intentional. No new regression in `cart-store.ts`.

### New finding

#### CR-01: WR-01's `delivery_id` never reaches the tail worker's critical alert email — the fix's stated goal does not hold for the one event that actually pages anyone

**File:** `workers/observability-tail/src/core.ts:148-174` (`sanitizeFields`), consumed by `parseEnvelope` (`:198`) and `alertLine` (`:346-352`)
**Issue:** `eac58eb` added `delivery_id` extraction to `sanitizeTelemetryFields` in `lib/observability/telemetry.ts` (the producer, used when `recordDeliveryFailure` writes the log line) but did **not** add the equivalent extraction to `sanitizeFields` in `workers/observability-tail/src/core.ts` (the consumer, used when the tail worker re-parses the JSON log line to build the critical-alert email). `core.ts`'s `sanitizeFields` only pulls `ENUM_FIELDS` keys, `attempt`/`count`/`duration_ms`/`http_status`, `retryable`, and `path` — there is no `delivery_id` handling anywhere in that file (confirmed by grep: zero hits for `delivery_id` in `workers/observability-tail/src/core.ts`).

`gift_card.delivery_failed` (the terminal, critical-severity event) **is** in `TAIL_CRITICAL_EVENTS`, so it is exactly the event this worker turns into a paging alert email. Because `sanitizeFields` silently drops any field not in its own closed set, the `delivery_id` present in the raw JSON log line is stripped before it reaches `alert.fields`, `alertLine()`, and the rendered email body (`renderAlert`/`buildEmailMessage`). An operator who receives the actual alert email — the mechanism WR-01 exists to make useful — still cannot correlate it to a delivery row without separately grepping raw structured logs; they are back to exactly the state WR-01 was meant to fix, for the one event class (critical/paging) where it matters most. (`gift_card.delivery_retry` is warning-severity and structurally excluded from `TAIL_CRITICAL_EVENTS` by design, so it never goes through this path at all — the gap is specific to the terminal event.)

This is precisely the failure mode `tests/unit/workers/observability-tail-core.test.ts:262-274` already has a named regression test for (`ENUM_FIELDS parity with lib/observability/telemetry.ts`, referencing a prior finding "01-REVIEW.md WR-05": *"core.ts's sanitizeFields() silently drops any field/value not in its own enum, so drift here means a critical alert email silently loses a diagnostic field with no test failure to catch it"*) — but that parity test only compares `ENUM_FIELDS` against `ALLOWED_FIELD_ENUMS` (the six closed-enum keys: `effect_type`, `operation`, `outcome`, `provider`, `reason`, `trigger`). `delivery_id` is not part of either enum object in either file — it is handled by ad hoc imperative code alongside `path`/`attempt`/`count`/etc. — so the existing parity test structurally cannot and did not catch this drift.

The integration test added by the WR-01 fix (`tests/integration/lib/services/gift-card-fulfillment.test.ts:335-337`) asserts the claim directly in a comment — *"this is the operator-facing proof: a retry is still findable and attributable ... without paging anyone"* — but only asserts against the raw `console.error`/`console.warn` envelope on the producer side; it never runs the payload through `extractCriticalAlerts`/`sanitizeFields` on the consumer side, so it could not have caught this either.

**Fix:** Add `delivery_id` extraction to `sanitizeFields` in `workers/observability-tail/src/core.ts`, mirroring `boundedIdentifier`'s bounds (safe charset, length cap) — e.g.:
```ts
// workers/observability-tail/src/core.ts, inside sanitizeFields, alongside the path check
if (typeof value.delivery_id === 'string' && value.delivery_id.length > 0 &&
  value.delivery_id.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value.delivery_id)) {
  output.delivery_id = value.delivery_id;
}
```
Then extend `tests/unit/workers/observability-tail-core.test.ts` with a case that runs a `gift_card.delivery_failed` envelope carrying `fields.delivery_id` through `extractCriticalAlerts` and asserts the resulting `alert.fields.delivery_id` (and the rendered `alertLine`/email body) actually carries it — closing the same class of gap the file's own `ENUM_FIELDS parity` test was written to prevent, for a field that test cannot see.

### Info

#### IN-03: WR-02's fixture set has no explicit "flagged gift-card line + physical line" composition, even though the logic is verified correct

**File:** `tests/unit/lib/checkout/digital-only.test.ts`
**Issue:** The review brief's specific regression scenario (one flagged gift-card line + one real physical line) is not present as its own fixture; only "one gift-card line plus one plain line" (an *unflagged* plain line) and "one flagged gift-card line" (alone) are covered. Traced by hand above and confirmed correct via the `.every()`/OR structure, so this is not a live bug, but the exact composition this iteration was asked to check has no fixture that would catch a future regression in it.
**Fix:** Add a sixth fixture — `cartItems: [{ giftCardNoteInvalid: true }, {}]`, `orderItems: [orderItem('digital'), orderItem('physical')]`, `expected: false` — to both the paired-invariant array and `MIN_NON_EMPTY_CART_FIXTURES`.

---

**Iteration 2 status:** 3 of 4 iteration-1 findings hold up under re-verification (WR-01's sanitizer and id-threading, WR-02's boolean logic, IN-02's documented behavior). WR-01's fix is incomplete: it addressed the producer side only, leaving the consumer side (tail worker) silently dropping the new field on exactly the event class — the critical, paging one — the fix was written for. One new Critical finding (CR-01), one new Info finding (IN-03).

_Reviewed: 2026-09-11T12:16:43Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (iteration 2)_
