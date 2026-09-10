---
phase: 14-gift-card-admin-audit-trail
reviewed: 2026-09-10T21:43:30Z
depth: deep
files_reviewed: 48
files_reviewed_list:
  - app/admin/gift-cards/[id]/page.tsx
  - app/api/admin/gift-cards/[id]/disable/route.ts
  - app/api/admin/gift-cards/[id]/events/route.ts
  - app/api/admin/gift-cards/[id]/notes/route.ts
  - app/api/admin/gift-cards/[id]/reissue/route.ts
  - app/api/admin/gift-cards/[id]/release-hold/route.ts
  - app/api/admin/gift-cards/[id]/requeue/route.ts
  - app/api/admin/gift-cards/[id]/resend/route.ts
  - app/api/admin/gift-cards/[id]/reveal/route.ts
  - app/api/admin/gift-cards/[id]/route.ts
  - app/api/admin/gift-cards/route.ts
  - app/api/admin/settings/route.ts
  - components/admin/GiftCardQueue.tsx
  - components/admin/gift-cards/CreateGiftCardDialog.tsx
  - components/admin/gift-cards/GiftCardActionBar.tsx
  - components/admin/gift-cards/GiftCardDetail.tsx
  - components/admin/gift-cards/GiftCardTimeline.tsx
  - docs/database-migrations.md
  - docs/runtime-configuration.md
  - lib/db/schema/gift-cards.ts
  - lib/db/schema/settings.ts
  - lib/gift-cards/admin-http.ts
  - lib/gift-cards/code.ts
  - lib/gift-cards/domain.ts
  - lib/gift-cards/events.ts
  - lib/gift-cards/presentations.ts
  - lib/gift-cards/repository.ts
  - lib/gift-cards/timeline.ts
  - lib/services/gift-card-fulfillment.ts
  - migrations/0024_add_gift_card_events.sql
  - tests/integration/d1-harness.test.ts
  - tests/integration/gift-card-admin-actions.test.ts
  - tests/integration/gift-cards-migration.test.ts
  - tests/integration/lib/gift-cards/gift-card-events.test.ts
  - tests/integration/lib/gift-cards/repository.test.ts
  - tests/integration/lib/services/gift-card-fulfillment.test.ts
  - tests/unit/app/admin-gift-card-detail-page.test.ts
  - tests/unit/app/api/admin-gift-card-detail-routes.test.ts
  - tests/unit/app/api/admin-gift-cards-actions.test.ts
  - tests/unit/app/api/admin-gift-cards-reveal.test.ts
  - tests/unit/app/api/admin-settings-honor-guard.test.ts
  - tests/unit/app/api/gift-card-presentation-routes.test.ts
  - tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts
  - tests/unit/lib/gift-cards/admin-http.test.ts
  - tests/unit/lib/gift-cards/code.test.ts
  - tests/unit/lib/gift-cards/domain.test.ts
  - tests/unit/lib/gift-cards/honor-decision-owner-source.test.ts
  - tests/unit/lib/gift-cards/timeline.test.ts
findings:
  critical: 2
  warning: 7
  info: 8
  total: 17
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-09-10T21:43:30Z
**Depth:** deep
**Files Reviewed:** 48
**Status:** issues_found

## Summary

Every file changed between `a573c2c` and HEAD outside `.planning/` was read, with the money paths traced from the routes down through `repository.ts` to the 0022 triggers. Smoke checks pass: `vitest run tests/unit/lib/gift-cards tests/unit/app` reports 1083 passed, `npm run typecheck` is clean.

What holds up:

- **Authz.** All eleven handlers call `checkAdminPermissions` first; that function already refuses a cookie-authenticated POST that fails `hasSameOrigin`. The reveal route additionally checks the stored setting, then `isSuperAdminActor` (which refuses service tokens and the dev bypass), then `{ confirm: true }`, and writes `code_revealed` before decrypting. The unit test pins that order.
- **Code material.** A grep of every route, projection, timeline and component for `code_hash`, `code_ciphertext`, `code_nonce`, `code_key_version`, `claim_token`, `email_idempotency_key`, `business_key` and the plaintext code finds only the reissue route's *inputs* to `repository.reissue` (`codeHash`, `codeCiphertext`), never a response field. The forbidden-columns source contract scans the route directory and passes. Only the reveal body carries the code, with `Cache-Control: no-store`.
- **Phase 13 contracts.** `resolveHonorEffective` is called directly by the new page and all routes with the same `(DB, flags, now)` shape as `app/admin/gift-cards/page.tsx`. Nothing new writes `admin_settings`; the generic route now allow-lists `gift_cards.code_reveal_enabled` and still refuses `gift_cards.honor_guard` (trimmed). The honor-guard writer and ownership source contracts are in the passing suite.
- **Staging races (commits `6bcdcf5`, `030178b`).** `git show --stat` confirms each commit carries exactly the sibling files the SUMMARYs describe. No file has duplicated exports, no content is missing, and both typecheck and the full unit suite pass against HEAD.
- **Transition guards.** `disableAccount` only moves `active -> disabled` and sets `disabled_at` together (satisfies the 0022 status CHECK and trigger). `requeueDelivery` moves all four CHECK-coupled columns in one UPDATE. Release goes through the existing `releaseReservation`, which already refuses committed reservations. `writeAdjustment` relies on `gift_card_ledger_balance_guard` and is proven to refuse an overdraft.
- **`sumOutstandingGiftCardBalances`.** Adjustments are ordinary ledger rows, so a drained card sums to zero and the new active card is counted. Correct for the reissue case. (See WR-07 for the disabled-but-not-reissued case.)

What does not hold up: reissue is not atomic (CR-01) and the reveal UI throws the code away before the admin sees it (CR-02).

## Critical Issues

### CR-01: Reissue is two separate writes, so a failure between them strands the old card's balance permanently

**File:** `lib/gift-cards/repository.ts:678-739` (the `reissue` function), `lib/gift-cards/repository.ts:681-684` (its own doc comment)

**Issue:** D-06 and D-19 require the drain adjustment and the new-card issuance to land in one D1 `batch()`. The implementation says the opposite in its own comment ("run as two sequential, individually idempotent calls, not one `database.batch()`") and does exactly that:

```ts
const adjustment = await writeAdjustment({ ... amount: balance.availableBalance.negate() ... });
const newGiftCardId = await giftCardReissueId(args.oldGiftCardId);
const issued = await issueAccount({ id: newGiftCardId, ... });
```

If `issueAccount` fails after `writeAdjustment` has committed (a D1 transient error, a CHECK failure on the delivery row, a UNIQUE collision on `email_idempotency_key`, a dropped connection), the old card's ledger is already at zero and no new card exists. On retry, the function reaches the balance check before the adjustment:

```ts
if (!balance.availableBalance.gt(zero)) {
  throw new GiftCardConflictError("Gift card has no available balance to reissue");
}
```

`availableBalance` is now zero, so every retry returns 409 `gift_card_reissue_blocked`. The customer's money is gone from both cards with no recovery path short of a hand-written ledger row. The `writeAdjustment` idempotency (business key `gift-card-reissue-out/{oldId}`) is never reached on retry, so it does not help.

The 14-03 SUMMARY claims "an integration test proves a second reissue attempt fails and leaves no partial state." The test at `tests/integration/lib/gift-cards/repository.test.ts:681` runs a *complete* first reissue and then a second attempt. It never injects a failure between the two writes, so it does not prove what D-19 asked for.

A second, related retry problem: the route mints a fresh bearer code on every attempt (`app/api/admin/gift-cards/[id]/reissue/route.ts:91`). Once the new account row exists with the first attempt's hash, any retry's `issueAccount` hits `ON CONFLICT DO NOTHING`, then `sameAccount` fails and throws "Gift-card issuance identity conflicts with durable state". So even if the adjustment problem were fixed, the retry path can only ever converge if it stops before `issueAccount` when the new account already exists.

**Fix:** Make the whole reissue one transactional batch, and make the retry path converge on prior state instead of re-deriving it from a balance that has already moved:

```ts
const reissue = async (args) => {
  // ...status + reservation guards as today...
  const newGiftCardId = await giftCardReissueId(args.oldGiftCardId);
  const adjustmentKey = giftCardReissueAdjustmentBusinessKey(args.oldGiftCardId);

  // Retry: converge on what already happened, never re-read the balance.
  const priorNew = await findAccountById(newGiftCardId);
  const priorAdjustment = await database.prepare(`${LEDGER_SELECT} WHERE business_key = ? LIMIT 1`)
    .bind(adjustmentKey).first<LedgerRow>();
  if (priorNew && priorAdjustment) {
    return { created: false, newGiftCardId, amount: mapLedger(priorAdjustment).amountDelta.negate() };
  }
  if (priorNew || priorAdjustment) {
    // Half-applied state from a pre-fix deploy: surface it, do not guess.
    throw new GiftCardConflictError("Gift card reissue is in an inconsistent state; needs manual repair");
  }

  const balance = await readBalance(args.oldGiftCardId, args.now);
  // ...zero check as today...

  const entryId = `gift_ledger_${crypto.randomUUID()}`;
  const statements = [
    database.prepare(`INSERT INTO gift_card_ledger_entries (...) VALUES (?, ?, ?, 'adjustment', ?, ?, NULL, NULL, NULL, ?)`)
      .bind(entryId, args.oldGiftCardId, currency, balance.availableBalance.negate().toMinorUnits(), adjustmentKey, args.now),
    ...issueAccountStatements({ id: newGiftCardId, ... }),   // extract the three INSERTs from issueAccount
    // WR-01: put the two audit rows in the same batch (see below).
  ];
  await database.batch(statements);   // D1 batch is one transaction: all-or-nothing
  // ...post-batch validation as issueAccount does today...
};
```

Then add the missing test: stub `database.batch` (or corrupt the delivery input so the third INSERT fails a CHECK) on the first attempt, assert the adjustment count is 0 and the new account does not exist, then run a clean attempt and assert it succeeds. That is the D-19 "no partial state" proof.

### CR-02: The revealed code is discarded before the admin can see it

**File:** `components/admin/gift-cards/GiftCardActionBar.tsx:160-173` and `components/admin/gift-cards/GiftCardDetail.tsx:79-81, 132-134`

**Issue:** `runReveal` stores the code in local state and then calls `onChanged()`:

```ts
setRevealedCode(code);
onChanged();
```

`onChanged` is `() => void load()` in `GiftCardDetail`. `load` begins with `setLoading(true)`, and `GiftCardDetail` renders this while loading:

```tsx
if (loading) {
  return <div role="status" ...>Loading gift card…</div>;
}
```

That early return unmounts `GiftCardActionBar` entirely, which destroys `revealedCode`, `pending` and the open dialog. When the fetch completes the bar remounts with fresh state: no dialog, no code. Net effect: the super admin confirms, a permanent `code_revealed` audit event is written naming them, and they never see the code. Every reveal attempt adds another audit row. The unit tests for this component are source-contract greps (`admin-gift-card-detail-page.test.ts:77-97`), so nothing exercised the render path.

The other actions are unaffected because they call `closeDialog()` before `onChanged()` and their result is a toast, not state.

**Fix:** Do not unmount the bar on a refresh. Only show the full-page placeholder on the initial load:

```tsx
// GiftCardDetail.tsx
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);

const load = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
  if (mode === "initial") setLoading(true); else setRefreshing(true);
  // ...fetch as today...
  finally { setLoading(false); setRefreshing(false); }
}, [giftCardId]);

useEffect(() => { void load("initial"); }, [load]);
// keep `if (loading) return <placeholder/>` — it now only fires before the first card arrives
```

And in `GiftCardActionBar.runReveal`, drop the `onChanged()` call (the timeline can refresh when the dialog closes) or defer it to `closeDialog` for the reveal case. Add a render test with `@testing-library/react` that mocks `fetch`, clicks Reveal, confirms, and asserts the code element is in the document.

## Warnings

### WR-01: The `reissued` / `reissued_from` audit rows are written after the money moves, outside any transaction

**File:** `app/api/admin/gift-cards/[id]/reissue/route.ts:117-134`, `lib/gift-cards/events.ts:109-123`

**Issue:** The balance is drained and the new card issued inside `repository.reissue`; the two events are then appended via Drizzle on a separate connection. If either `appendGiftCardEvent` throws, the route returns 503 but the money has already moved, and the retry is blocked by the zero-balance check (CR-01), so the `reissued` event can never be written. The timeline for that card would show "Balance adjusted" with no explanation and no link to the new card. It also means the D-01 partial UNIQUE index on `reissued` is not actually what enforces once-only for the money; the balance check is. D-06 says "Both the UNIQUE business keys and the D-01 partial index make it once-only", which is only true if the event row lands in the same transaction as the ledger row.

**Fix:** Have `repository.reissue` accept `actor` and include two raw `INSERT INTO gift_card_events (...)` statements in the same `database.batch()` as the adjustment and issuance (CR-01's batch). The partial UNIQUE index then rejects the entire batch on a second attempt, which is the database-level once-only guarantee the context describes. Keep `assertGiftCardEventDetails` on the details objects before binding them.

### WR-02: A failed decrypt after the `code_revealed` event leaves an audit row that says a reveal happened when it did not

**File:** `app/api/admin/gift-cards/[id]/reveal/route.ts:83-100`

**Issue:** The route writes `code_revealed`, then calls `revealGiftCardDeliveryCode`, and maps *any* thrown error to 409 `code_unavailable`. Two consequences: (1) the audit log records a reveal that returned nothing; (2) a key-ring misconfiguration (`parseGiftCardDeliveryKeyRing` throwing, a rotated key no longer in the ring) is reported to the admin as "code unavailable" rather than as an operator error. D-12's event-before-code ordering is right, but the failure branch needs to be audited too.

**Fix:**

```ts
try {
  const code = await revealGiftCardDeliveryCode({ giftCardId: id, environment });
  ...
} catch (error) {
  await appendGiftCardEvent({
    giftCardId: id, eventType: "code_reveal_failed", actor,
    details: { reason: error instanceof GiftCardDecryptError ? "decrypt" : "configuration" },
  }).catch(() => undefined);
  return jsonError(
    error instanceof GiftCardDecryptError ? "code_unavailable" : "gift_cards_write_failed",
    ..., error instanceof GiftCardDecryptError ? 409 : 503,
  );
}
```

Add `code_reveal_failed` to `GIFT_CARD_EVENT_TYPES` and the timeline labels.

### WR-03: Admin-create accepts any three-letter `currency` from the request body

**File:** `app/api/admin/gift-cards/route.ts:150-155`

**Issue:** D-07 lists amount, recipient email, optional name and reason. The route additionally reads `record.currency` and accepts anything matching `/^[A-Z]{3}$/`, falling back to the store currency only when absent. A card minted in a currency the store does not trade in can never be redeemed: `reserve` requires `account.currency_code = ?` against the checkout currency (`repository.ts:774`). It also makes `sumOutstandingGiftCardBalances` report `currency_count > 1`, which the honor guard surfaces as `MIXED`. A service token holder can trigger this with one request.

**Fix:** Remove the `currency` body field and always use `resolveStoreConfig(environment).commerce.currency`; or, if multi-currency is intended, require `currency === storeCurrency` and return 400 otherwise. Add a unit case that posts `currency: "XXX"` and expects 400.

### WR-04: The admin-create ceiling is a hardcoded literal tied to seed data

**File:** `lib/services/gift-card-fulfillment.ts:304-306`

**Issue:** `GIFT_CARD_ADMIN_ISSUE_MAX_MINOR = 20_000` with a comment saying it mirrors `variant_33` in `data/d1/seed.sql`. D-07 says the fallback is "the product's configured maximum denomination". A store that changes its gift-card denominations (the README says the catalogue is sample data) silently keeps a $200 ceiling, and one that sells a $500 card cannot issue one by hand.

**Fix:** Resolve the maximum at call time from the gift-card product's variant prices (the checkout already knows which variants are gift cards via `isGiftCardOrderLine`), or add `STORE_GIFT_CARD_MAX_MINOR` to `docs/runtime-configuration.md` and `resolveStoreConfig`, and read that. Keep `20_000` only as the last-resort default.

### WR-05: Notes on an unknown card return 503 instead of the documented 404

**File:** `app/api/admin/gift-cards/[id]/notes/route.ts:61-71`

**Issue:** The route never checks the card exists. `appendGiftCardEvent` inserts with `gift_card_id` referencing `gift_card_accounts(id)`; D1 enforces foreign keys, so the insert fails and the catch returns 503 `gift_cards_write_failed` ("temporarily unavailable"). D-13 specifies 404 `gift_card_not_found` for this case, and the UI shows the 503 text as if the database were down. `requeue` has the same shape but its 409 `delivery_not_requeueable` is at least truthful.

**Fix:** Before the write:

```ts
const account = await createGiftCardRepository(environment.DB).findAccountById(id);
if (!account) return jsonError("gift_card_not_found", "Gift card not found", 404);
```

Add the unit case ("404s for an unknown card") that the disable route already has.

### WR-06: Several D1 calls run outside the try/catch, so a database error is an unhandled 500 rather than a typed 503

**File:** `app/api/admin/gift-cards/[id]/resend/route.ts:74`, `app/api/admin/gift-cards/[id]/reissue/route.ts:83`, `app/api/admin/gift-cards/[id]/reveal/route.ts:58, 78`

**Issue:** `findDeliveryByGiftCardId` (resend, reissue), `getSettings` and `giftCardDeliveryHasStoredCode` (reveal) are awaited before the `try`. A D1 failure there escapes the handler. The client-side `post` helper in `GiftCardActionBar` then reads a non-JSON body, falls back to `{}`, and shows "Request failed", losing the typed code every other failure path carries. D-13 requires 503 `gift_cards_write_failed` for this.

**Fix:** Move those awaits inside the existing `try`, or wrap each:

```ts
let delivery;
try { delivery = await repository.findDeliveryByGiftCardId(id); }
catch { return jsonError("gift_cards_write_failed", "Gift cards are temporarily unavailable", 503); }
```

### WR-07: A disabled card's remaining balance is invisible to the honor guard, which can 404 the very page needed to reissue it

**File:** `lib/gift-cards/repository.ts:311-318` (`WHERE account.status = 'active'`), interaction with `app/admin/gift-cards/[id]/page.tsx:36-39`

**Issue:** This is a policy interaction, not a regression, but Phase 14 changed the facts on the ground: before this phase nothing disabled a card; now an admin can. `sumOutstandingGiftCardBalances` counts only active accounts (plus committed-unsettled reservations on any account). A disabled card with, say, $50 remaining contributes 0. With both feature flags off, the honor guard therefore reports "no balances", `resolveHonorEffective` returns false, and the list page, the detail page and every API route 404. The admin cannot reach the Reissue button for the one card that still has money the store owes. D-05 says the answer to a mistaken disable is reissue; in this configuration that answer is unreachable.

**Fix:** Decide the policy explicitly and record it in the honor-guard doc comment. If a disabled card's balance is still money the store owes (it is, until reissued or written off), change the aggregate to `WHERE account.status = 'active' OR (account.status = 'disabled' AND <ledger balance> > 0)`. If not, add a `gift_cards.disabled_with_balance` count to the guard record so the operator can at least see it. Either way, add a test: disable the only card with a balance and assert what the guard reports.

## Info

### IN-01: Drizzle index for `code_suffix` is not partial, unlike the migration

**File:** `lib/db/schema/gift-cards.ts:51` vs `migrations/0024_add_gift_card_events.sql:35-36`

**Issue:** The SQL creates `gift_card_accounts_code_suffix_idx ... WHERE code_suffix IS NOT NULL`; the Drizzle table declares `index("gift_card_accounts_code_suffix_idx").on(table.codeSuffix)` with no `.where`. The same file does add `.where(...)` for the reissue unique index, so this is an inconsistency, not a convention.

**Fix:** `index("gift_card_accounts_code_suffix_idx").on(table.codeSuffix).where(sql\`${table.codeSuffix} IS NOT NULL\`)`.

### IN-02: Stale sibling-plan comment and two unused / missing error codes in `admin-http.ts`

**File:** `app/api/admin/gift-cards/[id]/events/route.ts:33-40`, `lib/gift-cards/admin-http.ts:82-101`

**Issue:** The events route explains it constructs `invalid_limit` inline because `admin-http.ts` "is being edited concurrently by a sibling plan's executor". That plan finished; the comment is now misleading and `invalid_limit` is still absent from `GiftCardAdminErrorCode`. Meanwhile `gift_card_not_disabled` is declared in the union but never produced.

**Fix:** Add `invalid_limit` to the union, use `jsonError` in the events route, delete the comment, and remove `gift_card_not_disabled` (or use it in the reissue route's "must be disabled" branch instead of the generic `gift_card_reissue_blocked`).

### IN-03: Timeline amounts assume a two-decimal currency and show no currency

**File:** `components/admin/gift-cards/GiftCardTimeline.tsx:75-77`

**Issue:** `(value / 100).toFixed(2)` for `amountMinor` / `amount_minor`. The rest of the admin UI formats through `Money.fromMinor(..., currency).format()`. The timeline entry has no currency field, so it cannot do the same today. Also `to_gift_card_id` / `from_gift_card_id` render as plain text rather than a link to `/admin/gift-cards/{id}`.

**Fix:** Pass the card's currency into `GiftCardTimeline` (the parent has it) and format with `Money`; render the two id fields as `Link`s.

### IN-04: Empty `try { … } finally { /* comment */ }` blocks

**File:** `lib/services/gift-card-fulfillment.ts:342-378`, `app/api/admin/gift-cards/[id]/reissue/route.ts:92-152`

**Issue:** Both wrap the code-handling scope in a `finally` whose body is only a comment about zeroization. It does nothing at runtime and reads as if it does.

**Fix:** Drop the `finally` and keep the comment above the `const code = generateGiftCardCode()` line.

### IN-05: `admin_created` stores the raw recipient address while the delivery row stores the normalized one

**File:** `app/api/admin/gift-cards/route.ts:186`, `lib/services/gift-card-fulfillment.ts:340-345`

**Issue:** The event details carry `recipient_email: recipientEmail` (as typed, e.g. `" Buyer@Example.com "`), while `parseGiftCardCustomization` trims and lowercases before writing the delivery row. The two views of "who this card went to" can disagree by case and whitespace.

**Fix:** Normalize once in the route with `parseGiftCardCustomization({ recipientEmail })` and use that value for both the service call and the event.

### IN-06: List and detail show "Admin created" rather than D-17's "admin: {display name}"

**File:** `components/admin/GiftCardQueue.tsx:37-40`, `components/admin/gift-cards/GiftCardDetail.tsx:195`

**Issue:** Documented deviation in 14-08 SUMMARY. The name *is* available on the timeline (the `admin_created` event's `actorLabel`), so the detail page could show it without a new query.

**Fix:** In `GiftCardDetail`, derive the purchaser label from the `admin_created` entry in `events` when `card.purchaser` is null. For the list, either accept the generic label or have `listAdminGiftCardPresentations` join the creating admin in the same batched style it uses for customers.

### IN-07: Reveal control is rendered for every admin once the setting is on

**File:** `components/admin/gift-cards/GiftCardActionBar.tsx:182-184, 204-206`

**Issue:** `canReveal` reads only `capabilities.codeRevealEnabled`. A non-super-admin sees the button, confirms, and gets a 403 toast. Not a security issue (the server refuses), but it invites the click.

**Fix:** Have the detail route return `capabilities.codeRevealEnabled: settingOn && await isSuperAdminActor(auth)`, so the button only appears for a caller who can use it.

### IN-08: Create dialog converts major units with `Math.round(Number(amount) * 100)`

**File:** `components/admin/gift-cards/CreateGiftCardDialog.tsx:41`

**Issue:** Assumes two decimal places and accepts inputs like `"1e3"` (Number parses it to 1000). Fine for USD; wrong for zero- or three-decimal currencies, and the placeholder does not show the store currency.

**Fix:** Parse with `Money.fromMajor(amount, storeCurrency).toMinorUnits()` inside a try, and show the currency code beside the input.

---

_Reviewed: 2026-09-10T21:43:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
