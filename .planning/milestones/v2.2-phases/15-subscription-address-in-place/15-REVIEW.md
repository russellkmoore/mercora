---
phase: 15-subscription-address-in-place
reviewed: 2026-09-10T23:29:06Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - lib/account/address-client.ts
  - components/account/AddressForm.tsx
  - components/account/AddressManager.tsx
  - components/subscriptions/AddAddressDialog.tsx
  - components/subscriptions/acquisition-client.ts
  - components/subscriptions/SubscriptionAcquisitionPanel.tsx
  - tests/unit/components/account/address-form-source.test.ts
  - tests/unit/components/subscriptions/acquisition-client.test.ts
  - tests/unit/components/subscriptions/product-acquisition-source.test.ts
findings:
  critical: 0
  warning: 9
  info: 10
  total: 19
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-09-10T23:29:06Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the address-form extraction (`AddressForm`, `saveAddress`, the refactored `AddressManager`), the new `AddAddressDialog`, the `SubscriptionAcquisitionPanel` sentinel/refresh wiring, `nextAddressSelection`, and the three test files. Diff base `b35f1aa..HEAD`, excluding `.planning/`.

Smoke gates all pass: `vitest run tests/unit/components` 228/228, `npm run typecheck` clean, `npm run scan:tokens` 0 violations, `eslint` on the five source files clean. React 19.2.8, Next 16.3.4, Radix dialog 1.1.23.

The hard invariants the review was asked to check hold:

- The sentinel `__add_new__` is never written to `addressId` (the select's `onChange` returns early at `SubscriptionAcquisitionPanel.tsx:440-443`), `nextAddressSelection` rejects it explicitly (`acquisition-client.ts:230`), and `facts` is derived from `selectedSavedAddress` which is a lookup by id, so the sentinel cannot reach `attemptFactsKey`.
- The post-save handler re-sets `addressesOwner`, pre-selects `saved.id`, applies the three resets, and does not touch plan/quantity/terms (`SubscriptionAcquisitionPanel.tsx:279-284`); the region-scoped test really slices only that function.
- The select is disabled only by `loadingAddresses` (`:437`).
- The dialog uses only token classes, has no `gsd:scan-ignore`, keeps API errors inside the modal via `AddressForm`'s `role="alert"` message, and Cancel/Escape/overlay/X all route through `onOpenChange(false)` without touching `addressId`. Focus return is Radix default (the select was `document.activeElement` when the change fired).
- `saveAddress` sends `credentials: "same-origin"`, the same JSON body (`JSON.stringify(form)`), the same `content-type` header, and the same `{ address } | { error }` response handling as the pre-phase inline code.
- Guest branch is byte-identical.

No critical issues. Nine warnings, mostly around two themes: (1) the account page regressed in two small ways after the extraction (lost success message after an edit, Edit/Remove no longer locked during a save), and (2) the panel's post-save refresh is the only async path in the file without an abort controller, and it leaves a window where "Continue to payment method" can be clicked against the old address before the resets land. There is also a real, if narrow, silent-drop case where an address the API accepts is filtered out by the panel's stricter client-side validator, so the just-saved address never appears in the select and no message says why.

## Warnings

### WR-01: Account page loses the "Address saved." message after editing an address

**File:** `components/account/AddressManager.tsx:27-37`, `components/account/AddressManager.tsx:57-65`; `components/account/AddressForm.tsx:33-38`
**Issue:** Before this phase, `AddressManager.save()` set `setMessage("Address saved.")` on the manager after both create and edit. Now the success message lives inside `AddressForm` (`setMessage({ kind: "success" })` at `AddressForm.tsx:38`). In edit mode, `handleSaved` calls `setEditing(null)` (`:36`), which changes the `key` on `<AddressForm key={editing ?? "create"}>` (`:58`). React 19 batches the parent's `setEditing(null)` and the child's `setMessage(...)`/`setBusy(false)` into one render because they run in the same microtask after `await saveAddress(...)`. In that render the old form instance is unmounted (key changed) and its queued updates are discarded; the new `"create"` instance mounts with `message = null`. Result: after editing, the form blanks (matches old behaviour) but no confirmation is shown (regression). The 15-01 summary's claim that "a successful edit leaves the saved values visible with a success message" is not what happens on the account page, because the manager immediately remounts the form. Create mode is unaffected (key unchanged).
**Fix:** Have the manager own the confirmation for the edit case, the way `remove` does:
```tsx
function handleSaved(address: MACHCustomerAddress) {
  setAddresses((current) => { /* unchanged */ });
  if (editing) setMessage("Address saved.");
  setEditing(null);
}
```
Or drop the `key` remount on save (keep the key only for switching between edit targets) so the form's own message survives. Either way, add a source-contract assertion that the edit path yields a visible "Address saved." somewhere.

### WR-02: Edit/Remove buttons are no longer disabled while a save is in flight

**File:** `components/account/AddressManager.tsx:12`, `components/account/AddressManager.tsx:49-50`
**Issue:** Pre-phase, `busy` covered both `save` and `remove`, so the card buttons (`disabled={busy}`) were locked during any mutation. Now `busy` is only set by `remove`; `AddressForm` keeps its own `busy` privately. During a save the user can click Edit on another card. That changes the key, unmounts the in-flight form, and when the save resolves, `props.onSaved` (the unmounted instance's last props, closing over the *old* `editing` id) still runs `handleSaved`, which updates the list correctly but then calls `setEditing(null)`, silently discarding the edit the user just opened. A Remove clicked during a save of the same address is order-dependent. This is a behaviour change on a page the phase said would be unchanged.
**Fix:** Let the form report its busy state so the manager can keep the old lock:
```tsx
// AddressForm props
onBusyChange?: (busy: boolean) => void;
// in submit(): setBusy(true); props.onBusyChange?.(true); ... finally { setBusy(false); props.onBusyChange?.(false); }

// AddressManager
const [saving, setSaving] = useState(false);
<button disabled={busy || saving} ...>Edit</button>
<AddressForm ... onBusyChange={setSaving} />
```

### WR-03: "Continue to payment method" is clickable during the post-save refresh; resets land only after the await

**File:** `components/subscriptions/SubscriptionAcquisitionPanel.tsx:270-292`, `components/subscriptions/SubscriptionAcquisitionPanel.tsx:494-496`
**Issue:** `handleAddressSaved` closes the dialog and sets `loadingAddresses`, then awaits the refetch. The three resets (`setSetup(null)`, `setCheckoutError("")`, `setCompletedOwner(null)`) and the new `addressId` are applied only after the await. In that window the previous `addressId` is still selected, so `selectedShippingAddress` is defined and the Continue button (`:494-496`) is enabled (it does not check `loadingAddresses`). A shopper who already ticked the terms box and clicks Continue right after the modal closes creates a SetupIntent for the *old* address; when the refresh resolves, `setSetup(null)` throws the mounted payment form away and the server-side acquisition/SetupIntent is orphaned. Every other mutation path in this file (plan change `:374-381`, quantity `:421-426`, manual address change `:444-447`) applies the same resets synchronously in the event handler; D-05 says the same discipline applies here.
**Fix:** Apply the resets synchronously before the await, and gate Continue on `loadingAddresses`:
```tsx
async function handleAddressSaved(saved: MACHCustomerAddress) {
  setAddressDialogOpen(false);
  const owner = currentOwner;
  if (!owner || !selectedPlan) return;
  setSetup(null);
  setCheckoutError("");
  setCompletedOwner(null);
  setLoadingAddresses(true);
  setAddressError("");
  try { ... setAddresses(next); setAddressesOwner(owner); setAddressId(nextAddressSelection(next, saved.id)); }
  ...
}
// Continue button
disabled={working || loadingAddresses || !accepted || ...}
```
Keep the region-scoped test's three `toContain` assertions; they still hold.

### WR-04: The post-save refresh is the only async path in the panel without an AbortController

**File:** `components/subscriptions/SubscriptionAcquisitionPanel.tsx:277`
**Issue:** `fetchSavedAddressesForPlan(fetch, selectedPlan)` is called with no `signal`. The load effect (`:218-238`), the plan fetch (`:194-209`), the finalize effect (`:169-189`), the begin-attempt click (`:503-505`) and `SetupPaymentForm` (`:59-61`) all create a controller and guard every setter on `!controller.signal.aborted`. The only guard here is `ownerRef.current !== owner`, which does not change on unmount. `ProductDisplay.tsx:397-398` keys the panel by `selectedVariant.id`, so switching variant unmounts the panel mid-refresh; the fetch continues and the setters run against an unmounted component. React 19 silently drops those, so this is not a crash, but it is a divergence from the file's own safety pattern, the request is not cancelled, and a plan switch during the refresh lets two writers (this handler and the load effect) race on `addresses`/`addressId`/`loadingAddresses` with no ordering guarantee.
**Fix:** Either give the handler a ref-held controller aborted by the `[currentOwner]` effect cleanup and an unmount effect, mirroring `beginControllerRef`:
```tsx
const refreshControllerRef = useRef<AbortController | null>(null);
useEffect(() => () => refreshControllerRef.current?.abort(), []);
// in the [currentOwner] effect: refreshControllerRef.current?.abort();
// in handleAddressSaved:
const controller = new AbortController();
refreshControllerRef.current?.abort();
refreshControllerRef.current = controller;
const next = await fetchSavedAddressesForPlan(fetch, selectedPlan, controller.signal);
if (controller.signal.aborted || ownerRef.current !== owner) return;
```
Or, simpler and with one code path: store `saved.id` in a `preferredAddressIdRef` and bump an `addressRetry` counter that the existing load effect already abort-guards; the effect then calls `nextAddressSelection(next, preferredAddressIdRef.current)` and clears the ref.

### WR-05: A just-saved address can silently vanish from the select

**File:** `components/subscriptions/SubscriptionAcquisitionPanel.tsx:281`; `components/subscriptions/acquisition-client.ts:195-210`, `components/subscriptions/acquisition-client.ts:254`, `components/subscriptions/acquisition-client.ts:44-47`; `lib/account/validation.ts:5`
**Issue:** The API (`parseAddressInput`) accepts `city` and `region` up to 200 characters after trimming and does not reject control characters in `label`. The panel's refresh runs every entry through `fetchSavedAddressesForPlan`, whose filter calls `shippingAddressFromSaved` (city/region max 128, `:254`) and `boundedText(entry.label, 256)` (rejects any control character and any untrimmed value, `:44-47`). An address that the API accepts but the client filter rejects is saved to the account, the modal says "Address saved." and closes, and then the entry is missing from the refreshed list. `nextAddressSelection(next, saved.id)` falls back to the default/first with no signal, so the shopper sees a different address selected than the one they just typed, with no message. The form's own `maxLength={200}` on city/region (`AddressForm.tsx:92,100`) actively invites the 129-200 case. This mismatch predates the phase, but the phase is what makes it a visible in-page failure.
**Fix:** Two parts. (a) Detect and report the drop in the handler:
```tsx
const nextId = nextAddressSelection(next, saved.id);
setAddressId(nextId);
if (saved.id && nextId !== saved.id) {
  setAddressError("The new address was saved but cannot be used for this subscription. Edit it under Account > Addresses.");
}
```
(b) Align the limits: either raise `shippingAddressFromSaved`'s city/region max to 200, or lower the form's `maxLength` for city/region to 128 and have `parseAddressInput` reject control characters so the two validators agree.

### WR-06: `addressDialogOpen` is not reset when the signed-in owner changes

**File:** `components/subscriptions/SubscriptionAcquisitionPanel.tsx:146-158`, `components/subscriptions/SubscriptionAcquisitionPanel.tsx:124`
**Issue:** The owner-change block resets `setup`, `checkoutError`, `completedOwner`, `confirmedSetup`, `accepted`, and `working`, but not the new `addressDialogOpen`. If the session ends while the modal is open (sign-out in another tab, session expiry synced by Clerk), the signed-in branch unmounts and the dialog disappears with `addressDialogOpen` still `true`. The next sign-in, possibly as a different user, renders the panel with the add-address modal already open. Every other piece of attempt-scoped UI state is reset here; this one was missed.
**Fix:**
```tsx
if (stateOwner !== currentOwner) {
  setStateOwner(currentOwner);
  setSetup(null);
  setCheckoutError("");
  setCompletedOwner(null);
  setAddressDialogOpen(false);
  ...
}
```

### WR-07: Refresh failure after a successful save reads as a failed save and invites a duplicate

**File:** `components/subscriptions/SubscriptionAcquisitionPanel.tsx:285-288`
**Issue:** If the POST succeeds but the follow-up GET fails, the modal has already closed and the only feedback is `addressError = "Saved addresses could not be loaded"` (or the thrown message). Nothing tells the shopper the address was saved. The natural next action is to open "Add a new address…" again and re-enter it, creating a duplicate on the account. There is also no retry affordance for the refresh short of switching plans.
**Fix:** Use a message that states the save succeeded and give a retry path:
```tsx
} catch {
  if (ownerRef.current === owner) {
    setAddressError("Your address was saved, but the list could not be refreshed. Reload the page to select it.");
  }
}
```
If WR-04's "bump `addressRetry`" approach is taken, a "Retry" button next to `addressError` can re-run the load effect for free.

### WR-08: `saveAddress` shows a raw JSON parse error when the response body is not JSON

**File:** `lib/account/address-client.ts:54`
**Issue:** `await response.json()` runs unconditionally. A Clerk-middleware 401 with an empty body, a Cloudflare 5xx HTML page, or a network-layer interruption makes `response.json()` throw `SyntaxError: Unexpected token '<' ...`. `AddressForm.tsx:40-43` renders `error.message` verbatim in the `role="alert"` paragraph, so the shopper sees a parser message. The old inline code had the same shape, but this is now a shared library function rendered inside a modal, and every other client in this repo (`acquisition-client.ts` `boundedJson`) guards parsing.
**Fix:**
```ts
let body: { address?: MACHCustomerAddress; error?: string } = {};
try {
  body = (await response.json()) as typeof body;
} catch {
  // non-JSON body: fall through to the generic message
}
if (!response.ok || !body.address) {
  throw new Error(body.error || "Address could not be saved");
}
```

### WR-09: The sentinel option fires on keyboard arrow traversal of the native select

**File:** `components/subscriptions/SubscriptionAcquisitionPanel.tsx:438-443`, `components/subscriptions/SubscriptionAcquisitionPanel.tsx:457`
**Issue:** On Windows and Linux, Chrome and Firefox fire `change` on a focused, closed `<select>` for every arrow-key step. "Add a new address…" is the last option, so a keyboard user arrowing down past their last saved address opens the modal without pressing Enter, and Radix's focus trap pulls them into it. On close, focus returns to the select and the controlled `value` snaps back, so nothing is corrupted, but it is an abrupt interaction for keyboard and screen-reader users. This is a consequence of D-03's design (an action item inside a native select), so it may be accepted as-is; it is recorded so the trade-off is explicit.
**Fix:** If it is to be mitigated without changing D-03, add a plain button next to the select as the primary keyboard path and keep the sentinel for mouse users:
```tsx
<button type="button" onClick={() => setAddressDialogOpen(true)} className="mt-2 text-sm text-primary underline">
  Add a new address
</button>
```
Alternatively, move to the `components/ui/select` (Radix) primitive, which only commits on Enter/click.

## Info

### IN-01: `addressId` is interpolated into the URL path without encoding

**File:** `lib/account/address-client.ts:46`
**Issue:** `/api/account/addresses/${addressId}`. Ids are server-generated (`addr_<uuid>`), so this is not exploitable today, but a future id format containing `/`, `?` or `#` would change the route.
**Fix:** `` `/api/account/addresses/${encodeURIComponent(addressId)}` ``.

### IN-02: `type` select uses a bare cast instead of narrowing

**File:** `components/account/AddressForm.tsx:65`
**Issue:** `e.target.value as AddressFormState["type"]` trusts the DOM. `addressFormFrom` (`address-client.ts:30`) and `parseAddressInput` both narrow with `=== "billing" ? "billing" : "shipping"`. Same cast existed pre-phase.
**Fix:** `type: e.target.value === "billing" ? "billing" : "shipping"`.

### IN-03: `initial` and `lockType` are read only at mount

**File:** `components/account/AddressForm.tsx:18-22`
**Issue:** The `useState` initializer spreads `props.initial` and forces `lockType` once. If a consumer changes `initial` or `lockType` without changing the element's `key`, the form keeps stale values. `AddressManager` handles this with `key={editing ?? "create"}`; the dialog never changes them. Not a bug today, but the contract is implicit.
**Fix:** Add a one-line JSDoc on the props: "`initial` and `lockType` seed state on mount; re-key the element to change them."

### IN-04: Form inputs rely on `placeholder` as their accessible name

**File:** `components/account/AddressForm.tsx:52-112`
**Issue:** Only `country` has an `aria-label`. Browsers fall back to `placeholder` for the accessible name, so screen readers do announce something, but placeholders disappear on input and are not a substitute for labels (WCAG 1.3.1/3.3.2). Pre-existing on the account page; this phase now also renders the same inputs inside a modal.
**Fix:** Add `aria-label` per input (matching the placeholder text) or wrap each in a visually-hidden `<label>`.

### IN-05: Post-save selection change and loading state are not announced

**File:** `components/subscriptions/SubscriptionAcquisitionPanel.tsx:460`
**Issue:** "Loading saved addresses…" is a plain `<p>`; the select's value changes silently after the refresh. Sighted users see the new selection; screen-reader users get nothing between "Address saved." (inside a dialog that is closing) and the select's new value.
**Fix:** `<p role="status" className="mt-2 text-xs text-muted-foreground">Loading saved addresses…</p>` and consider a short `role="status"` confirmation after the refresh ("Address added and selected").

### IN-06: ARIA-role test is a presence check, not a pairing check

**File:** `tests/unit/components/account/address-form-source.test.ts:90-93`
**Issue:** The test passes as long as both `role="alert"` and `role="status"` appear anywhere in the file. Swapping them (alert for success, status for error) would still pass. The summary describes this test as pinning "error vs success" semantics; it does not.
**Fix:** Assert the pairing:
```ts
expect(formSource).toMatch(/message\.kind === "error" && \(\s*<p role="alert"/);
expect(formSource).toMatch(/message\.kind === "success" && \(\s*<p role="status"/);
```

### IN-07: "cannot collide with ID_PATTERN" test does not exercise ID_PATTERN

**File:** `tests/unit/components/subscriptions/acquisition-client.test.ts:404-409`
**Issue:** The test calls `nextAddressSelection([addrC], ADD_NEW_ADDRESS_VALUE)` and expects `"addr_c"`. That is the explicit `preferredId !== ADD_NEW_ADDRESS_VALUE` check at `acquisition-client.ts:230` doing the work, not `ID_PATTERN`; it is the same assertion as the test at `:399-402` with one fewer entry. The comment claims something the test does not prove.
**Fix:** Prove the claim through the surface that applies `ID_PATTERN`: feed `fetchSavedAddressesForPlan` a mocked payload containing `{ id: "__add_new__", address: {...} }` and assert it is filtered out. Or rename the test to describe what it actually checks.

### IN-08: Region contract does not pin the two facts that make SUB-03 safe

**File:** `tests/unit/components/subscriptions/product-acquisition-source.test.ts:59-71`
**Issue:** The region test checks that `nextAddressSelection(` is called but not that it receives `saved.id` (a refactor to `nextAddressSelection(next)` would still pass and silently drop pre-selection). Nothing in the file pins the select's early return (`if (value === ADD_NEW_ADDRESS_VALUE) { setAddressDialogOpen(true); return; }`), so removing the `return` and writing the sentinel to `addressId` would also pass.
**Fix:**
```ts
expect(region).toContain("nextAddressSelection(next, saved.id)");
expect(source).toMatch(/if \(value === ADD_NEW_ADDRESS_VALUE\) \{\s*setAddressDialogOpen\(true\);\s*return;\s*\}/);
```

### IN-09: Two message channels on the account page; DELETE still lacks `credentials`

**File:** `components/account/AddressManager.tsx:14-25`, `components/account/AddressManager.tsx:67`
**Issue:** The manager's `message` (remove) and the form's `message` (save) are independent. Pre-phase, starting a save cleared the remove message and vice-versa; now "Address saved." (form) and "Address removed." (manager) can be on screen together. Separately, `remove`'s `fetch` omits `credentials: "same-origin"` while `saveAddress` sets it; the browser default is the same, so this is consistency only.
**Fix:** Clear the manager's message in `handleSaved` (`setMessage("")` before the edit-case message from WR-01), and add `credentials: "same-origin"` to the DELETE call for symmetry.

### IN-10: `onSaved` is typed `void` but the panel passes an async function

**File:** `components/account/AddressForm.tsx:13`, `components/account/AddressForm.tsx:34`; `components/subscriptions/SubscriptionAcquisitionPanel.tsx:467`
**Issue:** `props.onSaved(address)` discards the promise returned by `handleAddressSaved`. It is safe today because the handler catches internally and nothing before its `try` can throw, but the type hides the fact that a rejection would be unobserved. Also, if a sync `onSaved` ever throws, the form's `catch` would report the save as failed after it succeeded.
**Fix:** Type it `onSaved: (address: MACHCustomerAddress) => void | Promise<void>` and call it as `void props.onSaved(address)` outside the `try` (after `saveAddress` resolves), so a consumer error can never be mis-reported as a save failure.

---

_Reviewed: 2026-09-10T23:29:06Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Iteration 2

**Reviewed:** 2026-09-11T07:43:38Z
**Scope:** Verification of the 19 fixes recorded in `15-REVIEW-FIX.md` (commits `cc7b28f`..`91ccfe3`) against HEAD, plus a regression sweep for unmount-safety, effect dependency arrays, and the `product-acquisition-source.test.ts` pinned substrings.
**Gates:** `vitest run tests/unit/components tests/unit/lib/subscriptions` — 316/316 passed. `npm run typecheck` — clean.

### Verification of the 19 findings

| ID | Verdict | Note |
|---|---|---|
| WR-01 | Closed | `AddressManager.handleSaved` (`AddressManager.tsx:37-48`) now owns `setMessage("Address saved.")` for both create and edit, unconditionally, after `setEditing(null)`. Because the message lives on the parent (which never unmounts on a `key` remount of the child), it survives the edit-path remount. `AddressForm` no longer renders its own message when `onError` is supplied (`inlineFeedback = props.onError === undefined`, `AddressForm.tsx:36`). |
| WR-02 | Closed | `AddressForm.onBusyChange` mirrors `busy` into the manager's `saving` state (`AddressManager.tsx:13,16-19`); `locked = busy \|\| saving` disables both Edit and Remove (`:60-61`) for the whole save, closing the same-render race the original finding described. |
| WR-03 | Closed | `handleAddressSaved` applies `setSetup(null)`, `setCheckoutError("")`, `setCompletedOwner(null)`, and `setLoadingAddresses(true)` synchronously, all before the first `await` (`SubscriptionAcquisitionPanel.tsx:298-306`), and Continue's `disabled` now includes `loadingAddresses` (`:565`). Because `handleAddressSaved` runs synchronously up to its own `await`, these all land in one render — there is no window where the previous address can start a SetupIntent. |
| WR-04 | Closed | `refreshControllerRef` is created per-call, aborted by the `[currentOwner]` effect (`:176`), an unmount-only effect (`:180`), and the address-load effect's cleanup (`:254-259`, explicitly commented as guarding against a race with a plan/owner reload). Every setter in `handleAddressSaved` is gated by `live() = !controller.signal.aborted && ownerRef.current === owner` (`:304,310,315,319,321,324,328-329,332`). `AbortController.abort()` is idempotent, so the multiple abort call sites (load-effect cleanup and owner-change effect can both fire against the same controller) cannot throw or double-fault. No controller is left unaborted on an unmount or owner-change path. |
| WR-05 | **Reopened — not fully closed, see CR-01 below** | The client filter (`acquisition-client.ts:262,276`) and `lib/subscriptions/acquisition-service.ts` (`:160,169`) were both correctly raised to 200 for `city`/`region`, and the 32 KB address-JSON bound at `acquisition-service.ts:165` is untouched. But `app/api/setup-intent/route.ts` — the actual HTTP boundary the browser POSTs to — has its own, independent address parser (`parseAddress`, `:40-77`) that still bounds `city` at 128 (`:46`) and `region` at 128 (`:57`) and was not touched by the fix. This is the "other consumer that depended on 128" the review instructions asked to rule out, and it was missed. |
| WR-06 | Closed | The owner-change block now resets `setAddressDialogOpen(false)` and the new `setAddNewPending(false)` alongside the other attempt-scoped state (`SubscriptionAcquisitionPanel.tsx:162-163`). |
| WR-07 | Closed | The refresh-failure catch now sets `"Your address was saved, but the list could not be refreshed. Reload the page to select it."` and clears `addressId` (`:323-330`), so a stale selection cannot be submitted and the shopper is not told the save failed. |
| WR-08 | Closed | `saveAddress` wraps `response.json()` in try/catch and falls through to the generic message on a non-JSON body (`lib/account/address-client.ts:54-59`); a behavior test covers an HTML 502 and an empty 401 (`address-form-source.test.ts`, "maps a non-JSON failure body..."). |
| WR-09 | Closed, with the same residual trade-off the original finding already accepted | `keyboardTraversalRef` distinguishes an arrow-key step onto the sentinel (which now only sets `addNewPending`, leaving `addressId` untouched) from a mouse pick or a committed Enter/Space (which opens the dialog). `addressId` is never assigned `ADD_NEW_ADDRESS_VALUE` anywhere in the file (verified by search — the only two `setAddressId` call sites with a variable, `nextAddressSelection(...)` results and the `value` from `onChange`, are both reached only after the sentinel branch has already `return`ed). `onBlur` and `Escape` both revert `addNewPending`, so a keyboard user who tabs away is not left on a half-committed state. Browser-native keyboard/touch behavior itself (the actual trigger condition) can't be exercised by a unit test; this remains a human-verification item as already flagged. |
| IN-01 | Closed | `lib/account/address-client.ts:46` — `encodeURIComponent(addressId)`. |
| IN-02 | Closed | `AddressForm.tsx:83` — `e.target.value === "billing" ? "billing" : "shipping"`, no cast. |
| IN-03 | Closed | JSDoc added on `initial` and `lockType` (`AddressForm.tsx:10,25`). |
| IN-04 | Closed | Every input now has `aria-label` (`AddressForm.tsx:73,80,95,104,114,123,132,142`). |
| IN-05 | Closed | `role="status"` on the loading paragraph and a new `addressNotice` `role="status"` confirmation after a successful refresh (`SubscriptionAcquisitionPanel.tsx:530-531`). |
| IN-06 | Closed | Test now asserts the `error`→`alert` / `success`→`status` pairing by regex and asserts exactly one of each `<p>` (`address-form-source.test.ts`, "uses the correct ARIA role..."). |
| IN-07 | Closed | `acquisition-client.test.ts:425` feeds `fetchSavedAddressesForPlan` a payload entry with `id: ADD_NEW_ADDRESS_VALUE` and asserts it is filtered by `ID_PATTERN` before `nextAddressSelection` is reached. |
| IN-08 | Closed | Region contract now pins `nextAddressSelection(next, saved.id)` and the sentinel early-return shape by regex (`product-acquisition-source.test.ts`, region assertions). |
| IN-09 | Closed | Single message channel (manager owns it via `onError`); DELETE now sends `credentials: "same-origin"` (`AddressManager.tsx:26`). |
| IN-10 | Closed | `onSaved` typed `(address: MACHCustomerAddress) => void \| Promise<void>` and invoked as `void props.onSaved(address)` after the `try/finally` block, outside it (`AddressForm.tsx:15,61-62`). |

### Regression sweep

- **Unmount safety:** `SubscriptionAcquisitionPanel`'s three async paths (`SetupPaymentForm` submit, the finalize effect, `handleAddressSaved`) all guard every post-await `setState` with an abort/owner check. `AddressManager`'s `save`/`remove` equivalents (now inside `AddressForm.submit` and `AddressManager.remove`) still have no unmount guard, but this is the same pattern the pre-phase `AddressManager.tsx` (`b35f1aa`) used — not a regression introduced by this phase, and React 19 drops post-unmount state updates silently rather than warning or crashing.
- **Effect dependency arrays:** all five `useEffect` calls in the panel list every reactive value they read (`currentOwner`; `confirmedSetup, currentOwner, finalizationRetry`; `enabled, planRetry, productId, termsVersion, variantId`; `isLoaded, isSignedIn, selectedPlan, userId`); none reference `fetch` as a dependency, consistent with the file's existing convention. No missing-dependency bugs found.
- **`product-acquisition-source.test.ts` pinned substrings:** every `expect(...).toContain(...)`/`toMatch(...)` assertion in the SUB-01/SUB-03 test was checked directly against the current `SubscriptionAcquisitionPanel.tsx` source; all pass and all describe real behavior (verified independently of running the suite, in addition to the smoke run below).

### New Findings

#### CR-01: A 129–200 char city/region address is selectable in the subscription panel but always rejected at checkout — WR-05's fix is incomplete

**File:** `app/api/setup-intent/route.ts:46,57`; contrast with `components/subscriptions/acquisition-client.ts:262,276` and `lib/subscriptions/acquisition-service.ts:160,169`
**Issue:** The WR-05 fix raised the shipping-address `city`/`region` character cap from 128 to 200 in two of the three layers that enforce it: the client-side select filter (`shippingAddressFromSaved`) and `lib/subscriptions/acquisition-service.ts`'s `validateBeginInput`. It did not raise the cap in `app/api/setup-intent/route.ts`'s own `parseAddress` (`boundedText(value.city, 128)` at `:46`, `region: optional("region", 128)` at `:57`), which is the actual HTTP handler the browser's `createSubscriptionSetupAttempt` POSTs to before `service.begin()` is ever called. `parseBody` treats a rejected address as an unparseable body (`parseAddress` returns `null` → `parseBody` returns `null`, `:97-98`) and the route responds `400 { error: "Invalid subscription request" }` with no detail. The 15-REVIEW-FIX.md summary asserts "nothing downstream in the domain or Stripe mappers enforces 128" — that check missed this route, which sits *upstream* of `acquisition-service.ts` in the actual request path even though it lives in a different layer of the codebase. Concretely: a shopper with a saved address whose city or region is 129–200 characters now sees that address appear in the shipping-address select (post-WR-05 fix), sees it pre-selected with "Address added and selected.", and the Continue button enables — then clicking Continue always fails with a generic "Secure subscription setup could not be started" error, with no address-specific explanation, for an address the UI has already told them is valid. This is strictly worse than the original WR-05 finding (a silent drop before any commitment) because the shopper now invests a full attempt before the opaque failure. No test exists for `app/api/setup-intent/route.ts` at all (`find tests -iname '*setup-intent*'` returns nothing), so this gap was not caught by the iteration-1 fix's test additions, which only exercised `acquisition-client.ts` and `acquisition-service.ts` directly.
**Fix:** Raise the two bounds in `app/api/setup-intent/route.ts` to match the other two layers:
```ts
const city = boundedText(value.city, 200);
...
region: optional("region", 200),
```
Add a route-level test (there is currently no test file for this route) that POSTs a 150-char city / 200-char region and asserts a 201, and a 201-char city and asserts the same 400 message `acquisition-service.ts` would produce — so the three layers can't drift again. Consider extracting the address-bounds table (`line1: 256, city: 200, region: 200, postal_code: 32, ...`) into one shared constant imported by all three call sites (`app/api/setup-intent/route.ts`, `acquisition-client.ts`, `acquisition-service.ts`) instead of three independently maintained literal copies, since this is the second time these numbers have drifted.

### Summary

18 of 19 iteration-1 findings are fully closed in code at HEAD and verified against the actual source (not just the fix report's claims). WR-05 is only partially closed: the fix correctly widened two of the three layers that bound `city`/`region` length but missed `app/api/setup-intent/route.ts`, which still enforces the old 128-char limit and is the layer the browser actually calls first. That gap is a genuine, user-facing regression relative to the fix's own stated goal and is recorded as CR-01 above.

**Findings: 1 Critical (CR-01), 0 Warning, 0 Info, 1 total.**

---

_Reviewed: 2026-09-11T07:43:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Iteration: 2_
