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
