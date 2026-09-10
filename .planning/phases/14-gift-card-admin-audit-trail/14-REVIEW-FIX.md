---
phase: 14-gift-card-admin-audit-trail
fixed_at: 2026-09-10T22:23:00Z
review_path: .planning/phases/14-gift-card-admin-audit-trail/14-REVIEW.md
iteration: 2
findings_in_scope: 21
fixed: 21
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-09-10T22:09:00Z
**Source review:** `.planning/phases/14-gift-card-admin-audit-trail/14-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 17 (2 Critical, 7 Warning, 8 Info)
- Fixed: 17
- Skipped: 0

Every fix is its own commit on `main` (`workflow.use_worktrees` is `false`, so no worktree was
created; edits and commits were made in the main checkout). CR-01 and WR-01 share one commit
because WR-01's fix is a clause of CR-01's batch. 30 files changed, +1133 / −285.

## Findings

| ID | Status | Commit | What changed |
| --- | --- | --- | --- |
| CR-01 | fixed | `dcdda08` | `repository.reissue` is one `database.batch()`: drain adjustment + account + issuance ledger row + delivery row + both audit events. `issueAccount` split into `issueAccountStatements` / `verifyIssuedAccount` so both callers share the INSERTs and post-write checks. Retry converges on prior state before re-reading the balance: new card + adjustment both present → 409 "already reissued"; only one present → 409 "inconsistent state, needs manual repair". New integration test injects a delivery PK collision after the adjustment and proves the old balance is untouched, no adjustment/account/event landed, and a clean retry succeeds (D-19). The existing second-attempt test still passes. |
| CR-02 | fixed | `65b7416` | `runReveal` only sets dialog-local state; new `closeRevealDialog` clears the code and calls `onChanged()` when the dialog closes. `GiftCardDetail.load()` takes `"initial" \| "refresh"` — only the first load shows the full-page placeholder, so the action bar and its open dialog stay mounted through a refresh; a failed refresh toasts instead of unmounting. Source-contract tests pin: no `onChanged` in `runReveal`, refresh only on close, code cleared on close, code held in `useState` only, placeholder only on the initial load. (No `@testing-library/react` in the repo and the unit environment is `node`, so a render test was not possible; the source contract is the repo's established pattern.) |
| WR-01 | fixed | `dcdda08` | The `reissued` / `reissued_from` rows are prepared statements in the same batch as the money (`giftCardEventStatement`, details validated with `assertGiftCardEventDetails` before binding). The route no longer appends events; the D-01 partial UNIQUE index now rejects a duplicate batch as a whole. |
| WR-02 | fixed | `6309402` | New event type `code_reveal_failed` (vocabulary now ten members; timeline label added). On decrypt failure the reveal route best-effort appends it with `details.reason`: `decrypt` (`GiftCardDecryptionError`, still 409 `code_unavailable`) or `configuration` (anything else, now 503 `gift_cards_write_failed`). Three unit cases; `docs/runtime-configuration.md` documents the row. |
| WR-03 | fixed | `861ae36` | Admin-create derives the currency from `resolveStoreConfig(env).commerce.currency` (the same source checkout uses) and answers 400 `invalid_body` to any body carrying `currency`. Unit tests cover the refusal (`XXX`, `USD`, `usd`, non-string) and the store-currency source (`STORE_CURRENCY=EUR`). The create dialog never sent `currency`, so no dialog change was needed for this finding. |
| WR-04 | fixed | `68667f8` | `resolveGiftCardAdminIssueMaxMinor(database, currency)` reads the highest active gift-card variant price (`products.type = 'gift_card'`, `product_variants.price` JSON) at call time; `20_000` is now only the last-resort default when no such variant exists. Integration test inserts a catalogue with a $500 top denomination and proves the ceiling follows it per currency, ignores inactive variants, and falls back otherwise. Chose the catalogue lookup over a new `STORE_GIFT_CARD_MAX_MINOR` variable because D-07 names the product's configured maximum as the fallback and no such constant exists. |
| WR-05 | fixed | `a47f60a` | Notes route looks the account up first: 404 `gift_card_not_found` when absent, 503 if the lookup itself fails, and no event is written in either case. Unit tests for both. |
| WR-06 | fixed | `dbac3b3` | `findDeliveryByGiftCardId` (resend, reissue), `getSettings` and `giftCardDeliveryHasStoredCode` (reveal) are each wrapped and answer 503 `gift_cards_write_failed`. Reissue also skips the delivery read entirely when the admin supplies an address. Four unit cases. |
| WR-07 | fixed | `9b24d1f` | Balance half of `sumOutstandingGiftCardBalances` now selects `status = 'active' OR available_balance > 0` (third `nowSeconds` bind); the reservation half already covered `committed_at IS NOT NULL`. A drained disabled card reads zero and drops out, so a reissued balance is counted once. Comments beside the join, the result-type docs and two `honor-guard.ts` comments now say "cards still holding value". Both honor-guard integration suites gained a `drainLeftoverBalances()` isolation step (disabling alone no longer isolates a case). New cases: disabled card with balance → outstanding, honoring stays on with both flags off, reissue → old card zero / new card counted once; a drained disabled card contributes nothing; a cron tick keeps honoring on for a disabled card with balance. Phase 13's cases unchanged and green. |
| IN-01 | fixed | `c76a583` | Drizzle `gift_card_accounts_code_suffix_idx` gains `.where(sql\`code_suffix IS NOT NULL\`)`, matching 0024. |
| IN-02 | fixed | `ae327eb` | `invalid_limit` added to `GiftCardAdminErrorCode`; events route uses `jsonError` and the stale sibling-plan comment is gone. `gift_card_not_disabled` removed rather than used — D-06 specifies `gift_card_reissue_blocked` naming why, which the route and its tests already follow. |
| IN-03 | fixed | `b524a98` | `GiftCardTimeline` takes `currency` from `GiftCardDetail` and formats `amountMinor` / `amount_minor` via `Money.fromMinor(...).format()`; `to_gift_card_id` / `from_gift_card_id` render as links to `/admin/gift-cards/{id}`. |
| IN-04 | fixed | `68915bd` | Empty `finally` blocks removed in `issueLine`, `issueAdminGiftCard` and the reissue route; the zeroization note now sits above `const code = generateGiftCardCode()`. |
| IN-05 | fixed | `ebec811` | Admin-create normalizes the recipient once through `parseGiftCardCustomization` and uses that value for both the service call and the `admin_created` event. Unit test posts `"  Shopper@Example.COM "` and checks both see `shopper@example.com`. |
| IN-06 | fixed | `b711399` | Went further than the review's minimum: `presentations.ts` resolves `"admin: {display name}"` from the card's `admin_created` event joined to `admin_users`, batched per page like the customer lookup, so **both** the list and the detail projections carry D-17's label with no UI change. A creator with no `admin_users` row (dev bypass) leaves `purchaser` undefined and the UI keeps its "Admin created" fallback. Two integration cases; the admin user id is asserted absent from the projection. |
| IN-07 | fixed | `e0bc092` | `capabilities.codeRevealEnabled` is `settingOn && await isSuperAdminActor(auth)`; the check is skipped while the setting is off. Two unit cases. |
| IN-08 | fixed | `3aaa5fc` | Create dialog parses the amount with a strict decimal pattern bounded by the store currency's precision plus `Money.fromMajor` (rejects `1e3`, signs, separators; handles zero/three-decimal currencies); label reads "Amount (USD)" with an inline currency adornment. Currency comes from `useStoreConfig().commerce.currency`. |

## Decisions worth flagging

- **CR-01 retry semantics.** The review's sketch returned `{ created: false }` on a retry that finds
  both the new card and the adjustment. I kept the 409 instead: D-06 says a second reissue is
  refused, the existing second-attempt tests (repository and admin-actions suites) assert a
  `GiftCardConflictError`, and the orchestrator asked to keep them. A retry after a *failed* batch
  now works because nothing landed; a retry after a *successful* batch whose response was lost gets
  409 "Gift card has already been reissued" — a truthful once-only answer rather than a silent
  no-op. The half-applied state a pre-fix deploy could have left behind is surfaced as its own 409
  message rather than guessed at.
- **WR-07 test isolation.** The ledger is append-only, so the only way to zero a leftover card is
  what reissue does — a negative `adjustment` for exactly the available balance. Both suites now do
  that after settling stranded reservations and before each case. This is test scaffolding only;
  production behaviour is the SQL change.
- **Module graph.** `repository.ts` now imports `assertGiftCardEventDetails` from `./events`
  (which imports `@/lib/db`). Probed under the workers harness before relying on it: the import
  resolves cleanly (`getDbAsync` is only *called* by `appendGiftCardEvent`, which the repository
  never calls).
- **Vocabulary size.** `GIFT_CARD_EVENT_TYPES` is now ten members (`code_reveal_failed` added);
  the integration test that pinned "exactly nine" was updated to the new list.

## Verification

All gates ran in the **main checkout** (no worktree; `workflow.use_worktrees=false`), after the
last fix commit `3aaa5fc`:

| Gate | Result |
| --- | --- |
| `npm run lint` | 0 errors, 54 warnings (repo-wide, pre-existing; the touched files carry exactly 1 warning, `react-hooks/set-state-in-effect` on `GiftCardDetail.tsx`'s mount effect, present at HEAD before this run) |
| `npm run typecheck` | clean |
| `npm run scan:tokens` | 0 violations |
| `npm run docs:lint` | 0 violations |
| `mise exec -- npm test` | 306 files, 2728 passed |
| `mise exec -- npm run test:workers` | 31 files, 243 passed |
| `mise exec -- npm run test:observability-worker` | 1 file, 3 passed |

Per-fix verification was Tier 2 (typecheck + the directly affected vitest suites) for every
finding, with the D1-backed suites run under `vitest.workers.config.mts` where the finding touched
SQL. No gift-card codes or secrets were printed; no `.env*.local` / `.dev.vars` read; no deploy.

## Skipped Issues

None.

## Iteration 2

**Fixed at:** 2026-09-10T22:23:00Z
**Source:** `14-REVIEW.md` § Iteration 2 (0 Critical, WR-08, WR-09, IN-09, IN-10)
**Summary:** 4 in scope, 4 fixed, 0 skipped. Four commits on `main`, explicit-path adds, no push.

| ID | Status | Commit | What changed |
| --- | --- | --- | --- |
| WR-08 | fixed | `1654f90` | `revealGiftCardDeliveryCode` parses the ring first and checks `Object.hasOwn(keyRing.keys, row.code_key_version)` before decrypting; a gap throws `GiftCardEncryptionConfigurationError` (route → 503, audited `configuration`), so only a genuine decrypt failure reaches the route as `GiftCardDecryptionError` (409, `decrypt`). `decryptGiftCardDeliveryCode` is untouched — its collapse-everything behaviour is right for the delivery drain. The mocked plain-`Error` unit case now uses the real error class. New workers integration case exercises the real function for all three outcomes: intact ring → a code (shape-asserted only, never printed); version 1 rotated out with only version 2 in the ring → configuration error; ciphertext tampered in the row → decrypt error. |
| WR-09 | fixed | `a132069` | `isAdminCreated` (no purchaser, no order) is gone. `resolveProvenance` reads `gift_card_events` in one batched query per page for every row without a purchasing customer: `reissued_from` → `purchaser: "reissued from {old id}"` plus a new `reissuedFromGiftCardId` on `AdminGiftCardPresentation`; `admin_created` → `"admin: {display name || email}"` via `admin_users`; otherwise `undefined`. Reissue wins over admin-created. The detail route passes `reissuedFromGiftCardId` through; `GiftCardQueue` and `GiftCardDetail` render "Reissued from <link to old card>" when set, and both fallbacks are now "—" (never "Admin created"). Integration cases cover both provenance kinds in list and detail (the IN-06 admin-created case from iteration 1 plus a new reissued-card case that also checks the old card carries no provenance of its own). |
| IN-09 | fixed | `172ec15` | New `invalidGiftCardIdResponse(id)` in `admin-http.ts` runs `assertGiftCardId` and answers D-13's 404 `gift_card_not_found`. All nine `[id]` routes (detail, events, disable, notes, reissue, release-hold, requeue, resend, reveal) call it right after reading the param, so `giftCardReissueId` / `giftCardReissueDeliveryId` and the first repository read only ever see a well-formed id. Unit cases: the helper (well-formed, over-long, empty, whitespace, non-string) and the reissue-with-`to`, notes, detail and events routes with a 129-character id, each asserting no D1 read or derivation happened. |
| IN-10 | fixed | `2dc5f68` | The reissue batch is wrapped: on failure the repository re-probes `findAccountById(newGiftCardId)` and the adjustment by business key, and throws `GiftCardConflictError("Gift card has already been reissued")` when both exist (route → 409 `gift_card_reissue_blocked`), otherwise rethrows the D1 error (→ 503). Integration test wraps `env.DB` in a `Proxy` whose `batch()` first lets a competing reissue complete (so both callers passed the pre-check), asserts the loser gets the conflict, and that exactly the winner's adjustment, account and two events exist. Detection is by re-probe, not by parsing the D1 error message. |

### Verification (main checkout, after `172ec15`)

| Gate | Result |
| --- | --- |
| `npm run lint` | 0 errors, 54 warnings (unchanged from iteration 1; the touched files carry only the two pre-existing `react-hooks/set-state-in-effect` notes on the `GiftCardQueue` / `GiftCardDetail` mount effects) |
| `npm run typecheck` | clean |
| `mise exec -- npm test` | 306 files, 2737 passed (+9 over iteration 1) |
| `mise exec -- npm run test:workers` | 31 files, 246 passed (+3 over iteration 1) |

Per-fix verification was typecheck plus the directly affected suites: reveal / detail-routes / presentation-routes / admin-http unit suites, and the fulfillment, gift-card-events and repository workers suites. No gift-card code or secret was printed; no `.env*.local` / `.dev.vars` read; no deploy; nothing pushed.

### Iteration 2 skipped issues

None.

---

_Fixed: 2026-09-10T22:23:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
