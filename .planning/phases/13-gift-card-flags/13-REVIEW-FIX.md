---
phase: 13-gift-card-flags
fixed_at: 2026-09-10T00:00:00Z
review_path: .planning/phases/13-gift-card-flags/13-REVIEW.md
iteration: 1
findings_in_scope: 16
fixed: 14
skipped: 2
status: partial
---

# Phase 13: Code Review Fix Report

**Fixed at:** 2026-09-10
**Source review:** `.planning/phases/13-gift-card-flags/13-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 16 (4 Critical, 12 Warning)
- Fixed: 14
- Skipped: 2 (WR-11, WR-12 — both documented instead, per the agreed decisions)

Every fix is its own commit. One extra commit (`cf813ec`) bounds a query CR-04
introduced and corrects three test fixtures that had assumed the old call shape.

## Fixed Issues

### CR-01: The honor guard is blind to committed-but-unsettled reservations

**Files modified:** `lib/gift-cards/repository.ts`, `tests/integration/lib/gift-cards/honor-guard.test.ts`
**Commit:** `fc28f7a`

The open-reservation count now uses the same "still holding value" clause
`availableBalanceExpression` uses, so a reservation that is committed but whose
redemption ledger entry has not landed yet is counted. Previously both halves
of the measurement read zero for that card and honoring flipped off
mid-settlement, stranding the redemption forever.

**One deviation from the suggested SQL, found by running it.** The review's
patch had no account scoping, and a committed reservation never expires — so
the first test run showed a reservation from one case leaking into the count of
every later case, including one whose card had been disabled. The count is now
joined to `gift_card_accounts` on `status = 'active'`, matching the population
the balance half already measures. Without that join the fix would have pinned
`open_reservations` above zero forever after the first committed reservation,
and honoring could never have been turned off again.

Integration case added: reserve, commit, do not settle, assert the card reads
zero available while the reservation count keeps honoring on.

### CR-02: Any admin can forge the honor-guard record through the settings API

**Files modified:** `app/api/admin/settings/route.ts`, `tests/unit/app/api/admin-settings-honor-guard.test.ts`, `tests/unit/lib/gift-cards/honor-guard-writer-source.test.ts`
**Commit:** `a69f6c4`

The handler is `POST`, not `PUT` as the review said; same code path. It now
rejects any update naming `gift_cards.honor_guard` **or** the `gift_cards`
category with **400** (the agreed status, not the review's suggested 403) before
`getDbAsync` is called, so a batch mixing the guard with a legitimate setting
applies neither half.

WR-09 is folded in here because it is the same contract: the writer source scan
walked only `app/`, which the generic settings writer never needed to import
from anyway. It now walks `app/`, `lib/` and `workers/`, allowlists the two
files that legitimately reference the writer, and asserts both still do so the
allowlist cannot rot.

### CR-03: Redemption gated on the configured honor flag, not the effective one

**Files modified:** `app/checkout/page.tsx`, `app/checkout/CheckoutPageClient.tsx` (new), `components/checkout/CheckoutClient.tsx`, `app/api/gift-cards/balance/route.ts`, `tests/unit/components/gift-card-checkout-gating-source.test.ts`
**Commit:** `2ff6047`

`/checkout` is now a server component that awaits `honorIsEffectivelyOn` once
per request and passes `honorEffective` down. `CheckoutClient` gates the apply
panel on that prop and no longer reads `useStoreConfig` at all.

`dynamic(..., { ssr: false })` is client-only, so the Stripe tree moved behind
a thin new client boundary (`CheckoutPageClient`) that also keeps the Clerk
`useAuth()` read exactly where it was. Auth behaviour is unchanged — that was
deliberate, to keep the regression surface to the one flag.

`/api/gift-cards/balance` reads the same effective value. Note the reachable
state for that route is sell=on/honor=off; with both flags off it still 404s
first, which is D-10 and was left alone.

Fail-open on a guard read error: showing an input the server would have
accepted is the correct failure direction.

### CR-04: The chat assistant still returned the gift card under sell=off

**Files modified:** `app/api/agent-chat/route.ts`, `tests/unit/lib/gift-cards/listing-call-sites-source.test.ts`, `tests/unit/lib/gift-cards/volt-visibility.test.ts` (new)
**Commits:** `991aa66`, `cf813ec`

Two filters, because they cover different sources. Hydrated rows go through
`filterListedProducts` before projection — that is the authoritative one, and it
covers the model's own bold-name picks, which never touch Vectorize. Vectorize
matches are stripped by product id before the prompt is built, so the model is
not fed gift-card copy it would then describe.

The second filter needs a lookup (the copy is filtered before hydration, so
`products.type` is not available yet). `cf813ec` bounds that lookup to the ids
the search actually returned and skips it entirely when selling is on or there
is nothing to check, so an ordinary chat message on a selling store pays
nothing.

MCP search already applied the predicate; the new test covers it behaviourally
alongside the chat route's source contract.

### WR-01: `/product/gift-card` stayed in the sitemap after it started 404ing

**Files modified:** `app/sitemap.ts`, `lib/seo/sitemap-data.ts`, `tests/unit/app/sitemap-gift-card-visibility.test.ts` (new), `tests/unit/lib/gift-cards/listing-call-sites-source.test.ts`
**Commit:** `cdac74b`

The projection carries `products.type` now and the sitemap applies
`isPubliclyVisibleProduct`. Per the agreed decision the card drops out whenever
**selling** is off — not only in the both-off state the review suggested. A
sitemap is an index, and the card is already absent from every other index in
that state.

### WR-02: `MIN(account.currency_code)` summed minor units across currencies

**Files modified:** `lib/gift-cards/repository.ts`, `lib/gift-cards/honor-guard.ts`, `tests/integration/lib/gift-cards/honor-guard.test.ts`, `tests/integration/lib/gift-cards/honor-guard-cron.test.ts`
**Commit:** `dc5504c`

The aggregate reports `currencyCount`; the guard records `currency: 'MIXED'`
when it is above 1. The total is kept because it still answers the only
question the record exists to answer — is there money out there — and the
sentinel is what stops a caller printing it as money.

### WR-03 / WR-04: The admin page 500ed, and the banner alarmed on a correct state

**Files modified:** `app/admin/gift-cards/page.tsx`, `components/admin/GiftCardHonorBanner.tsx`, `tests/unit/app/admin-gift-card-gating.test.ts`
**Commit:** `8a3289c`

The page read catches to `null`, matching what `/api/admin/gift-cards` has
always done. The banner takes `guardActive` (already computed by the page) and
shows one quiet, uncoloured line when honoring is off with a clear guard,
instead of "$0.00 outstanding across 0 open reservations" under a warning
header. The WR-02 sentinel is described rather than formatted.

### WR-05 / WR-06: Negative totals read as zero; untrusted values reached `Money`

**Files modified:** `lib/gift-cards/honor-guard.ts`, `tests/unit/lib/gift-cards/honor-guard.test.ts`, `tests/integration/lib/gift-cards/honor-guard.test.ts`
**Commit:** `94c5f61`

`balancesMayExist` uses `!== 0` and logs a negative total. The test that
cemented the opposite is flipped, with a comment saying why.

`parseRecord` now requires safe integers, a non-negative reservation count, and
an ISO code or the mixed sentinel. Six integration cases cover the values that
used to throw somewhere inside `Money.fromMinor(...).format()` in an admin
server component.

### WR-07: `/api/products` filtered after slicing

**Files modified:** `app/api/products/route.ts`, `tests/unit/app/api/products-public.test.ts`
**Commit:** `c85c9e5`

Filters once, slices from the filtered list — the shape the category branch
already used. Tests walk every page of a ten-product catalogue with the gift
card inside the first page and assert no gap and no repeat.

### WR-08 / WR-11: Doc claims corrected

**Files modified:** `docs/runtime-configuration.md`, `docs/DEPLOYMENT_SETUP.md`, `tests/unit/docs/gift-card-flag-docs.test.ts`
**Commit:** `84c014e`

Per the agreed decision the **docs** were wrong, not the code: a measurement
gated on the flag it exists to overrule could never produce the reading that
turns honoring off (D-05). Both docs now say the tick is unconditional and name
the `[cron] gift-card honor guard unavailable` noise on a pre-migration deploy.
The true half of the old claim — the request path really is inert with both
flags off — is kept and pinned by a test.

WR-11's documentation half landed here too (see Skipped Issues).

### WR-09: The writer source contract scanned only `app/`

Folded into commit `a69f6c4` — see CR-02.

### WR-10: MCP checkout surfaced a stopped sale as a generic failure

**Files modified:** `lib/mcp/tools/payment.ts`, `lib/gift-cards/checkout.ts`, `app/api/payment-intent/route.ts`, `tests/unit/lib/mcp/mcp-gift-card-sales-disabled.test.ts` (new)
**Commit:** `3597d79`

Mapped to `GIFT_CARD_SALES_DISABLED` with "remove the gift-card line" as the
first next action — "retry checkout" alone is a loop while the card is still in
the cart. The shopper-facing message moved next to the error class it describes
so the HTTP route and the agent path cannot drift.

## Skipped Issues

### WR-11: The home page caches the visibility decision for an hour

**File:** `app/page.tsx:86`
**Reason:** Skipped by decision — no code change is warranted. Both flags are
deploy-time Worker variables, so a flag change *is* a deploy, and a deploy
invalidates the OpenNext incremental cache. There is no path by which a flag
flips without a deploy, and therefore none by which a cached page outlives the
decision it was rendered under. The review's own fix offered exactly this as
the first option ("confirm and document that the cache is keyed by build id").

**What was done instead:** documented in `docs/runtime-configuration.md` and
pinned by a test in `tests/unit/docs/gift-card-flag-docs.test.ts` (commit
`84c014e`), so the reasoning is discoverable rather than tribal.

### WR-12: The admin gift-card queue lists cards in a state where it used to return empty

**File:** `app/api/admin/gift-cards/route.ts:38-49`
**Reason:** Skipped by decision — the behaviour change is correct, not
accidental. The route sits behind `checkAdminPermissions`; D-14 keeps the gift
card visible to the people who administer it whatever the flags say, and Phase
14's management depends on that. sell=on/honor=off is an invalid state that
should never be deployed, but hiding an operator's view of outstanding cards is
not how an invalid config should be surfaced.

**One correction to the review's premise, worth recording.** The review says
the state "throws at capability resolution" — that is true of any path that
*resolves capabilities*, and this route does not. Nothing throws here. The
decision to leave it open therefore rests on D-14 alone, not on unreachability.

**What was done instead:** two tests (commit `ca5e839`) pin what the route
actually does — a 200 with the honor guard deliberately unconsulted, and any
throw under the route surfacing as one fail-closed 503 naming no internals — so
the behaviour is deliberate and covered rather than undiscussed.

## Verification

All gates run in the **main checkout** (`workflow.use_worktrees` is `false` in
`.planning/config.json`, so no worktree was created and these numbers are
reproducible from the tree as it stands).

| Gate | Result |
| --- | --- |
| `npm run lint` | 0 errors, 52 warnings — all pre-existing, none in a line this work touched |
| `npm run typecheck` | clean |
| `npm run scan:tokens` | 0 violations (2 standing MANUAL-REVIEW notes, unchanged) |
| `npm run docs:lint` | 0 violations |
| `npm test` | 295 files, 2513 tests, all passing |
| `npm run test:workers` | 29 files, 188 tests, all passing |
| `npm run test:observability-worker` | 1 file, 3 tests, all passing |

The 52 lint warnings are the pre-existing baseline. The only one in a file this
work touched is `components/checkout/CheckoutClient.tsx:494`
(`window.location.href`), and the diff against the review base does not touch
that line.

## Notes for a human reviewer

Three things are worth a second pair of eyes:

1. **The account join in CR-01** changes what `openReservations` counts in one
   more way than the review asked for. An open reservation against a *disabled*
   card no longer counts. That matches the balance half, which has always
   excluded disabled cards, but it is a semantic choice rather than a mechanical
   fix.
2. **CR-03 moved `/checkout` from a client component to a server component.**
   Auth is unchanged (still `useAuth()` on the client, now one file down) and
   the Stripe no-SSR import is unchanged, but this is a page-level structural
   change and only source-contract tests cover it.
3. **WR-02's `MIXED` sentinel** is a new value flowing into a record several
   consumers read. `parseRecord` accepts it explicitly and the banner branches
   on it; anything added later that formats `record.currency` must do the same.

---

_Fixed: 2026-09-10_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
