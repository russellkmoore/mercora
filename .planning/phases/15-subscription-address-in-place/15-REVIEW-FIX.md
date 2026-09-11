---
phase: 15-subscription-address-in-place
fixed_at: 2026-09-11T07:47:59Z
review_path: .planning/phases/15-subscription-address-in-place/15-REVIEW.md
iteration: 2
findings_in_scope: 20
fixed: 20
skipped: 0
status: all_fixed
---

# Phase 15: Code Review Fix Report

**Fixed at:** 2026-09-10T23:45:05Z
**Source review:** `.planning/phases/15-subscription-address-in-place/15-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 19 (0 Critical, 9 Warning, 10 Info; `fix_scope: all`)
- Fixed: 19
- Skipped: 0

**Gates** (run in the main checkout, `workflow.use_worktrees=false`, no worktree was created):

| Gate | Result |
|---|---|
| `npm run lint` | 0 errors, 54 warnings (all pre-existing, none in a touched file; the touched files lint clean individually) |
| `npm run typecheck` | clean |
| `npm run scan:tokens` | 0 violations |
| `mise exec -- npm test` | 308 files / 2781 tests passed (2774 before this fix pass; +7 tests) |

Every commit below is atomic, staged by explicit path, and not pushed.

## Fixed Issues

| ID | Title | Files | Commit | Status |
|---|---|---|---|---|
| WR-01 | Account page loses "Address saved." after an edit | `components/account/AddressForm.tsx`, `components/account/AddressManager.tsx`, `tests/unit/components/account/address-form-source.test.ts` | `cc7b28f` | fixed |
| WR-02 | Edit/Remove not disabled during a save | same three files | `995f70c` | fixed |
| WR-03 | Continue clickable during post-save refresh; resets after the await | `components/subscriptions/SubscriptionAcquisitionPanel.tsx`, `tests/unit/components/subscriptions/product-acquisition-source.test.ts` | `c2c2423` | fixed |
| WR-04 | Post-save refresh has no AbortController | same two files | `a430c72` | fixed: requires human verification (async lifecycle logic) |
| WR-05 | Just-saved address can silently vanish from the select | `components/subscriptions/acquisition-client.ts`, `lib/subscriptions/acquisition-service.ts`, `SubscriptionAcquisitionPanel.tsx`, `acquisition-client.test.ts`, `tests/unit/lib/subscriptions/acquisition-service.test.ts`, `product-acquisition-source.test.ts` | `72dab74` | fixed: requires human verification (see deviation note) |
| WR-06 | `addressDialogOpen` not reset on owner change | panel + panel source test | `0dd5fc7` | fixed |
| WR-07 | Refresh failure after a successful save reads as a failed save | panel + panel source test | `befc88b` | fixed |
| WR-08 | `saveAddress` shows a raw JSON parse error | `lib/account/address-client.ts`, `address-form-source.test.ts` | `8bddacf` | fixed |
| WR-09 | Sentinel fires on keyboard arrow traversal of the native select | panel + panel source test | `d7d480a` | fixed: requires human verification (browser interaction logic) |
| IN-01 | `addressId` interpolated into the URL unencoded | `lib/account/address-client.ts` | `10e56b5` | fixed |
| IN-02 | `type` select uses a bare cast | `components/account/AddressForm.tsx` | `1bfe967` | fixed |
| IN-03 | `initial`/`lockType` read only at mount, undocumented | `components/account/AddressForm.tsx` | `78a4c51` | fixed |
| IN-04 | Inputs rely on `placeholder` for their accessible name | `components/account/AddressForm.tsx` | `449d201` | fixed |
| IN-05 | Post-save selection and loading not announced | `SubscriptionAcquisitionPanel.tsx` | `d34b92f` | fixed |
| IN-06 | ARIA-role test is presence, not pairing | `address-form-source.test.ts` | `0881405` | fixed |
| IN-07 | `ID_PATTERN` test does not exercise `ID_PATTERN` | `acquisition-client.test.ts` | `5bfb78c` | fixed |
| IN-08 | Region contract does not pin `saved.id` or the sentinel early return | `product-acquisition-source.test.ts` | `f2a136b` | fixed |
| IN-09 | Two message channels; DELETE lacks `credentials` | `components/account/AddressManager.tsx` (channel unification landed in WR-01/02) | `d1b0d15` | fixed |
| IN-10 | `onSaved` typed `void` but the panel passes an async function | `AddressForm.tsx`, `components/subscriptions/AddAddressDialog.tsx`, `address-form-source.test.ts` | `91ccfe3` | fixed |

### What each fix does

**WR-01 / WR-02 / IN-09 / IN-10 — feedback and busy ownership lifted to the manager.**
`AddressForm` gained two optional callbacks. `onError(message)` hands feedback to the parent: when it is set the form renders no message of its own (failures arrive through `onError`, success is implied by `onSaved`); when it is unset the form keeps its inline `role="alert"` / `role="status"` paragraph, which is what `AddAddressDialog` relies on to keep API errors inside the modal (D-04). `onBusyChange(busy)` mirrors the form's busy flag. `AddressManager` passes both: it sets "Address saved." itself in `handleSaved` (so the confirmation survives the `key` remount after an edit), clears the message when a save starts (one channel, as before the extraction), and disables Edit/Remove on `busy || saving`. `AddressForm` is still the single field list. For IN-10, `onSaved` is typed `void | Promise<void>` and is invoked with `void` after the `try/finally`, so a consumer throw cannot be reported as a save failure. The DELETE now sends `credentials: "same-origin"` and encodes its id.

**WR-03 / WR-04 / WR-05(a) / WR-06 / WR-07 / IN-05 — the panel's post-save path.**
`handleAddressSaved` now applies `setSetup(null)`, `setCheckoutError("")`, `setCompletedOwner(null)` before the await, and Continue is additionally disabled while `loadingAddresses` is true, so the previous address can never start a SetupIntent in the refresh window. The refresh runs under `refreshControllerRef`, aborted by the `[currentOwner]` effect, an unmount effect, and the address-load effect's cleanup (a plan or auth change reloads the list, so an in-flight refresh must not race it); every setter is guarded by `!aborted && ownerRef.current === owner`. If the saved id is missing from the refreshed list the panel says the address was saved but cannot be used for this subscription instead of silently selecting another. A refresh failure after a successful POST now says "Your address was saved, but the list could not be refreshed. Reload the page to select it." and clears `addressId` rather than leaving a stale selection. `addressDialogOpen` (and the new `addNewPending`) reset in the owner-change block. "Loading saved addresses…" has `role="status"`, and a short `role="status"` "Address added and selected." follows a successful refresh (cleared on any manual change, plan change, or new save).

**WR-05(b) — 200-char alignment, wider than the orchestrator's instruction.**
The account API accepts `city`/`region` up to 200 chars. The review and the orchestrator asked to align the client filter (`shippingAddressFromSaved`, 128) to that. On inspection `lib/subscriptions/acquisition-service.ts` also capped `city` and `region` at 128, so raising only the client filter would have let a 150-char city into the select and then failed at "Continue to payment method" with "Subscription shipping address is invalid" — a worse outcome than the silent drop. Both the client filter and the acquisition service now use 200 for `city` and `region` (no test pinned 128; `line1` was already 256 server-side; the 32 KB JSON bound still applies; nothing downstream in the domain or Stripe mappers enforces 128). Tests: a 150-char city (and a 200-char region) survives `fetchSavedAddressesForPlan` and is pre-selected by `nextAddressSelection`, a 201-char city is dropped, and the service accepts 150 / rejects 201 before any provider call. Flagged for Russell because it loosens a server-side bound (128 → 200) in `lib/subscriptions/acquisition-service.ts`, a file the phase itself did not touch.

**WR-08 — `saveAddress` parse guard.** `response.json()` is wrapped; a non-JSON body (empty 401, HTML 5xx) falls through to "Address could not be saved". A behaviour test stubs `fetch` with an HTML 502, an empty 401, a JSON 400 with the API's own message, and a 201 success.

**WR-09 — committed-choice guard on the native select (D-03 kept).**
The select tracks whether the last interaction was a traversal key (`ArrowUp/Down`, `Home`, `End`, `PageUp/Down`). If `change` delivers the sentinel after such a key, the select enters `addNewPending`: it shows "Add a new address…" but `addressId` is untouched and nothing opens. Enter or Space then commits (opens the modal); Escape, blur, or arrowing to a real option snaps back. A mouse pick, or Enter inside the native popup (where the arrow keydowns do not reach the page), still opens the modal immediately as before. `addressId` is never written the sentinel; the source contract pins the branch shape.

**Test hardening (IN-06/07/08 and the pins added under each warning).** The ARIA test now asserts the error → `alert` and success → `status` pairing and exactly one `<p>` of each. The "cannot collide with `ID_PATTERN`" test now feeds `fetchSavedAddressesForPlan` a payload whose entry id is `__add_new__` and asserts it is filtered before `nextAddressSelection` ever sees it. The region contract pins `nextAddressSelection(next, saved.id)`, the sentinel early-return regex, resets-before-await ordering, the Continue gate, the abortable fetch, the saved-but-filtered branch, the refresh-failure wording, the owner-change dialog reset, and the keyboard guard.

## Skipped Issues

None.

## Human verification requested

- **WR-04 / WR-09 / WR-05:** marked "requires human verification" because the syntax and source-contract tiers cannot exercise the async lifecycle, the browser's native-select keyboard behaviour, or the widened server bound. One click-through on a shipping-required subscription product page (add an address, watch it pre-select, arrow through the select on Windows/Linux if available) plus a glance at the `acquisition-service.ts` diff covers all three.

---

_Fixed: 2026-09-10T23:45:05Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

## Iteration 2

**Fixed at:** 2026-09-11T07:47:59Z
**Source review:** `.planning/phases/15-subscription-address-in-place/15-REVIEW.md` (iteration 2 review appended: 1 Critical, 0 Warning, 0 Info)

**Summary:**
- Findings in scope: 1
- Fixed: 1
- Skipped: 0

| ID | Title | Files | Commit | Status |
|---|---|---|---|---|
| CR-01 | `parseAddress` in `app/api/setup-intent/route.ts` still capped city/region at 128 after WR-05 raised the client filter and `acquisition-service.ts` to 200 | `lib/subscriptions/address-limits.ts` (new), `app/api/setup-intent/route.ts`, `components/subscriptions/acquisition-client.ts`, `lib/subscriptions/acquisition-service.ts`, `tests/unit/app/api/subscription-routes.test.ts`, `tests/unit/components/subscriptions/acquisition-client.test.ts` | `84b21af` | fixed |

### What the fix does

WR-05 (iteration 1) raised the city/region cap from 128 to 200 in two places — the panel's client filter (`shippingAddressFromSaved`) and `lib/subscriptions/acquisition-service.ts`'s shipping-address guard — but missed a third, independently maintained copy: `app/api/setup-intent/route.ts`'s own `parseAddress` function, which still capped both at 128. A 129–200 char city or region was therefore selectable and pre-selected in the subscription panel (client filter said yes), passed the acquisition service's own bound if reached directly, but was rejected at "Continue to payment method" by the setup-intent route with a generic "Invalid subscription request" — a regression the iteration-1 fix introduced by fixing two of three sites.

Rather than raise the third number in isolation and risk a fourth future drift, the bound is now `ADDRESS_CITY_REGION_MAX` in a new `lib/subscriptions/address-limits.ts`, and all three sites (`acquisition-client.ts`, `acquisition-service.ts`, `setup-intent/route.ts`) import it instead of hardcoding their own literal. The module's own doc comment names all three call sites so a future editor sees the other two before changing the number in isolation.

**Tests added:**
- `tests/unit/app/api/subscription-routes.test.ts`: a route-level test posting a 200-char city and 200-char region (succeeds, `begin` called with both fields intact) and, separately, a 201-char city and a 201-char region (each rejected with `400 { error: "Invalid subscription request" }` before `begin` is called).
- `tests/unit/components/subscriptions/acquisition-client.test.ts`: a behavioural round-trip test — not just the client filter — that loads a saved address with a 150-char city and a 200-char region through `fetchSavedAddressesForPlan`, selects it via `nextAddressSelection`, derives the shipping address via `shippingAddressFromSaved`, and posts it through `createOwnerBoundSubscriptionSetupAttempt` to the **real** `setup-intent` route handler (imported directly, with only its external dependencies — Clerk auth, customer lookup, store config, the acquisition service, rate limiting, telemetry — mocked). This is the test that would have caught CR-01 in iteration 1: it fails if any one of the three layers' bound drifts from the other two, not just if the client filter alone regresses.

**Gates** (run in the main checkout, `workflow.use_worktrees=false`, no worktree was created):

| Gate | Result |
|---|---|
| `npm run lint` | 0 errors, 54 warnings (same pre-existing set as iteration 1; none in a touched file) |
| `npm run typecheck` | clean |
| `npm run scan:tokens` | 0 violations |
| `mise exec -- npm test` | 308 files / 2783 tests passed (2781 before this fix; +2 tests) |

### Skipped Issues

None.

---

_Fixed: 2026-09-11T07:47:59Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
