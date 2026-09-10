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

---

## Iteration 2

**Re-reviewed:** 2026-09-10T22:40:00Z
**Scope:** the 16 fix commits `dcdda08`..`3aaa5fc` against the 17 iteration-1 findings, plus a regression pass over the batch ordering, the honor-guard aggregate, the error-code union and the reveal UI state.
**Smoke:** `vitest run tests/unit/lib/gift-cards tests/unit/app tests/unit/components` — 1314 passed. `vitest run --config vitest.workers.config.mts tests/integration/lib/gift-cards tests/integration/gift-card-admin-actions.test.ts` — 5 files, 84 passed. `npm run typecheck` — clean.

### Prior findings: verification

| ID | Verdict | What I checked at HEAD |
| --- | --- | --- |
| CR-01 | closed | `repository.ts:832-866`: one `database.batch()` with, in order, the drain adjustment (no `ON CONFLICT`), the three `issueAccountStatements` (account, issuance ledger via SELECT, delivery), then `reissued` and `reissued_from`. Order is right for the 0022 triggers: the balance guard sees the adjustment before the issuance guard needs the account row, and the D-01 partial UNIQUE on `reissued` is the last statement so it rejects the whole batch. `business_key` is UNIQUE (0022:222), so a racing reissue aborts at statement 1 and nothing else lands. Pre-batch probe at `:801-810`: both prior rows -> 409 "already reissued"; one -> 409 "inconsistent state". Balance is read only after the probe. Test `repository.test.ts` "rolls back the drain when a later write in the same batch fails": the injected failure is a PK collision on the delivery row (statement 4, after the adjustment; the delivery INSERT's `ON CONFLICT(gift_card_id)` does not cover the `id` PK so it really raises). Asserts old balance still 1_000, zero adjustments, no new account, zero events, then a clean retry succeeds and both balances are right. The pre-existing second-attempt test still asserts `GiftCardConflictError`. |
| CR-02 | closed | `GiftCardActionBar.tsx`: `runReveal` only calls `setRevealedCode`; `closeRevealDialog` runs `closeDialog()` (which nulls the code) and calls `onChanged()` only if a code was showing; the reveal `AlertDialog`'s `onOpenChange` routes to `closeRevealDialog`; `AlertDialogAction` calls `preventDefault` so the dialog stays open. `GiftCardDetail.tsx`: `loading` is true only for the `"initial"` load; `onChanged`, the note form and the Refresh button call `load()` in `"refresh"` mode, so the bar stays mounted. A failed refresh toasts instead of replacing the page. Code lives in `useState` only; unmount destroys it. |
| WR-01 | closed | Both event rows are `giftCardEventStatement(...)` entries in the CR-01 batch; `assertGiftCardEventDetails` runs before bind. The route no longer imports or calls `appendGiftCardEvent`. |
| WR-02 | partially closed — see WR-08 | `code_reveal_failed` is in `GIFT_CARD_EVENT_TYPES` and the timeline labels; the route writes it best-effort and maps `GiftCardDecryptionError` -> 409, anything else -> 503. But the production decrypt path cannot produce "anything else" for a rotated-out key. |
| WR-03 | closed | `app/api/admin/gift-cards/route.ts:150-152` refuses any body `currency` with 400 `invalid_body`; `:167-168` takes the currency from `resolveStoreConfig(environment).commerce.currency`. Tests in `gift-card-presentation-routes.test.ts`. |
| WR-04 | closed | `resolveGiftCardAdminIssueMaxMinor` reads `MAX(json_extract(variant.price, '$.amount'))` over active gift-card variants. I checked the units: `data/d1/seed.sql:393` stores `{"amount": 2500, "currency": "USD"}` (minor), and `Money.toJSON()` writes minor units, so the comparison against `amount.toMinorUnits()` is like-for-like. `20_000` is only the fallback. |
| WR-05 | closed | Notes route looks up the account first: 404 when absent, 503 when the lookup throws, no event written either way. |
| WR-06 | closed | resend (`:74-79`), reissue (`:83-89`), reveal (`:58-63`, `:78-83`) each wrap the pre-try D1 read and answer 503. |
| WR-07 | closed | Balance half: `WHERE account.status = 'active' OR ${balance} > 0` with three `nowSeconds` binds (`:325-343`). Reservation half unchanged and already covered committed rows on any account. A drained disabled card sums to zero and drops out of both the SUM and the currency count, so the reissued balance is counted once. `honor-guard.ts` diff is comment-only. The `drainLeftoverBalances()` scaffold runs in `beforeEach` before each case's setup (after `settleStrandedReservations` and the disable), so it is isolation, not masking: the WR-07 case issues + disables inside the case and expects 1_000 with honoring on under both flags off; the "drained to zero" case expects the card to vanish from the aggregate; the cron case expects `honorEffective: true` and the `honor_disabled_with_balances` alarm. A regression to `status = 'active'` fails the first two; a regression to "count everything" fails the third. Phase 13's cases are unchanged. |
| IN-01 | closed | `.where(sql\`${table.codeSuffix} IS NOT NULL\`)` on the Drizzle index. |
| IN-02 | closed | `invalid_limit` in the union, events route uses `jsonError`, stale comment gone, `gift_card_not_disabled` has zero references in `app`, `lib`, `components`, `tests`. |
| IN-03 | closed | `GiftCardTimeline` takes `currency`, formats `amountMinor`/`amount_minor` through `Money.fromMinor(...).format()`, links the two card-id keys. |
| IN-04 | closed | No empty `finally` left in the reissue route or `issueAdminGiftCard`; the two remaining `finally` blocks in `gift-card-fulfillment.ts` (`:491`, `:590`) are pre-existing and have bodies. |
| IN-05 | closed | Route normalizes through `parseGiftCardCustomization` once and passes the same value to the service and the event. |
| IN-06 | closed for admin-created cards — see WR-09 for the case it walks past | `resolveAdminCreatorLabels` joins `gift_card_events.actor_id` to `admin_users.user_id` and returns `admin: {display_name || email}`; the `admin_users` schema has `user_id`, `email`, `display_name`. Batched per page; the admin id is not returned. |
| IN-07 | closed | Detail route: `codeRevealEnabled = settingOn && await isSuperAdminActor(auth)`; `isSuperAdminActor` refuses service tokens and dev mode. |
| IN-08 | closed | `parseMajorAmount` uses a precision-bounded digit pattern and `Money.fromMajor(string, currency)` (which accepts strings). `useStoreConfig` throws without a provider, but `app/admin/layout.tsx` is nested under `app/layout.tsx`, which mounts `StoreConfigProvider`, so the dialog has one. |

Regression checks with no finding: `repository.ts` now imports `./events`, which imports `@/lib/db`; `lib/db.ts` only defines `cache()`-wrapped getters and has no top-level `getCloudflareContext` call, so the checkout paths that use the repository are unaffected. `readBalance` is not called after the batch. `created` in the reissue result is derived from the adjustment INSERT's `meta.changes`, which is always 1 on success — harmless. `assertGiftCardActor` accepts `id: null`, so a dev-bypass admin can reissue.

### New findings

#### Warnings

##### WR-08: A rotated-out delivery key is still reported as 409 `code_unavailable` / reason `decrypt`, not the 503 / `configuration` the fix and its test claim

**File:** `app/api/admin/gift-cards/[id]/reveal/route.ts:112-124`, `lib/gift-cards/encryption.ts:337-338, 354-355`, `tests/unit/app/api/admin-gift-cards-reveal.test.ts:185-196`

**Issue:** The route's branch is `error instanceof GiftCardDecryptionError ? "decrypt" : "configuration"`, and the comment says a "missing or rotated-out key" lands in the 503 branch. It does not. `decryptGiftCardDeliveryCode` does `const key = keyRing.byVersion.get(encrypted.keyVersion); if (!key) throw new GiftCardDecryptionError();` and its outer `catch` rewraps every other throw as `GiftCardDecryptionError` too. So the only way to reach the 503 branch in production is `parseGiftCardDeliveryKeyRing` throwing for a wholly missing ring (`GiftCardEncryptionConfigurationError`) or the delivery row lacking ciphertext (already screened by `giftCardDeliveryHasStoredCode`). The operator case WR-02 named — a key version rotated out of `GIFT_CARD_DELIVERY_KEYS_JSON` while old deliveries still reference it — is audited as `decrypt` and shown to the admin as "Gift-card code is unavailable". The unit test at `:186` proves the 503 path only by mocking `revealGiftCardDeliveryCode` to reject with a plain `Error("... is missing version 3")`, which the real function never does, so the test documents behaviour the code does not have.

**Fix:** Distinguish the ring gap before decrypting, in `revealGiftCardDeliveryCode`, where the stored `code_key_version` and the parsed ring are both in hand:

```ts
// lib/services/gift-card-fulfillment.ts, revealGiftCardDeliveryCode
const keyRing = parseGiftCardDeliveryKeyRing(args.environment);
if (!keyRing.keys.some((key) => key.version === row.code_key_version)) {
  throw new GiftCardEncryptionConfigurationError(); // or a new GiftCardKeyVersionMissingError
}
return decryptGiftCardDeliveryCode({ ..., keyRing });
```

(Adjust the membership check to whatever shape `GiftCardEncryptionKeyRing` exposes at `encryption.ts:23`; `resolveKeyRingUnsafe` already walks it.) Then replace the mocked unit case with one that exercises the real service: an integration test under the workers config that issues a card with key version 1, hands the route an environment whose ring only has version 2, and asserts 503 + `details.reason === "configuration"`.

##### WR-09: A reissued card is labelled "Admin created" in both the list and the detail page

**File:** `lib/gift-cards/presentations.ts:171-174` (`isAdminCreated`), `components/admin/GiftCardQueue.tsx:37-40`, `components/admin/gift-cards/GiftCardDetail.tsx:196`

**Issue:** `isAdminCreated` is `purchaser_customer_id IS NULL AND issued_order_id IS NULL`. A reissued card matches that exactly (`issueAccountStatements` writes both as NULL for reissue). `resolveAdminCreatorLabels` then finds no `admin_created` event, returns no label, and both UIs fall back to "Admin created". The purchaser column exists to answer "who is behind this card" on the fraud-audit surface (Russell's stated need in the context); telling an admin that a fraud-recovery reissue was hand-created is the wrong answer. This existed before the IN-06 fix (the UI fallback was the same), but the fix built the label resolver around exactly this predicate and did not cover the second population it selects. Only the timeline's `reissued_from` entry tells the truth.

**Fix:** Resolve both provenance kinds in the same batched query:

```ts
// presentations.ts, resolveAdminCreatorLabels -> resolveProvenanceLabels
`SELECT event.gift_card_id, event.event_type, event.details, admin.display_name, admin.email
 FROM gift_card_events event
 LEFT JOIN admin_users admin ON admin.user_id = event.actor_id
 WHERE event.event_type IN ('admin_created', 'reissued_from')
   AND event.gift_card_id IN (${placeholders})`
// admin_created  -> `admin: ${name}`
// reissued_from  -> `reissued from ${details.from_gift_card_id}` (the UI already links card ids)
```

And change the two UI fallbacks from "Admin created" to "—" so an unresolved label never asserts provenance. Add an integration case in `gift-card-presentation-routes.test.ts` that reissues a card and asserts the new card's `purchaser` names the old card, not an admin.

#### Info

##### IN-09: Reissue route derives ids from the URL param outside the `try`, so an over-long id is an unhandled 500

**File:** `app/api/admin/gift-cards/[id]/reissue/route.ts:96-97`

**Issue:** `giftCardReissueId(id)` and `giftCardReissueDeliveryId(id)` both call `assertGiftCardId`, which throws a `TypeError` for anything over 128 characters. They run after the WR-06 delivery read but before the `try`. With a `to` in the body the delivery read is skipped, so a 129+ character path segment escapes as a 500; without `to` the same input comes back as 503 "temporarily unavailable" from the delivery read's catch. D-13 says 404 `gift_card_not_found`.

**Fix:** Validate the param once at the top: `try { assertGiftCardId(id); } catch { return jsonError("gift_card_not_found", "Gift card not found", 404); }`, or move the two derivations inside the existing `try` and map `TypeError` to 404. The same one-line guard would tidy the notes and events routes, which currently answer 503 for the same input.

##### IN-10: A reissue that loses the pre-check race answers 503, not D-06's 409

**File:** `lib/gift-cards/repository.ts:832-866`, `app/api/admin/gift-cards/[id]/reissue/route.ts:143-147`

**Issue:** If two admins click Reissue on the same card at once, the second batch fails on the ledger's UNIQUE `business_key` (statement 1) with a raw D1 error. That is the right outcome for the data — nothing lands — but it is not a `GiftCardConflictError`, so the route returns 503 "Failed to reissue gift card" and the admin retries a card that has just been reissued (and then gets the 409). Same shape for the `reissued` partial-index rejection.

**Fix:** Wrap the batch: on failure, re-run the prior-state probe (`findAccountById(newGiftCardId)` + the adjustment lookup) and, if both rows now exist, `throw new GiftCardConflictError("Gift card has already been reissued")`; otherwise rethrow. Add a unit case in the repository suite that pre-inserts the adjustment row under `gift-card-reissue-out/{id}` and asserts the 409 shape.

### Iteration 2 counts

| Severity | Count | IDs |
| --- | --- | --- |
| Critical | 0 | — |
| Warning | 2 | WR-08, WR-09 |
| Info | 2 | IN-09, IN-10 |
| Total | 4 | |

Prior findings: 15 of 17 fully closed; WR-02 and IN-06 closed as fixed but each left the adjacent case above (WR-08, WR-09).

---

_Re-reviewed: 2026-09-10T22:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Iteration: 2_

