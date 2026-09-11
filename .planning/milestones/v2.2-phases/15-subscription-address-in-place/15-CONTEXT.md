# Phase 15: Subscription Address In Place - Context

**Gathered:** 2026-09-10
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss. Russell was away; grey areas took the recommended answer. The source request is Russell's own (`.planning/todos/pending/subscription-pdp-add-address-inline.md`), so the behaviour is his; only the mechanics below are Claude's.

<domain>
## Phase Boundary

On a subscription product page, a signed-in shopper whose plan needs shipping can add a shipping address without leaving the page: the address select always offers "Add a new address…", choosing it opens a modal with the same form the account page uses, saving posts to the existing account addresses API, the list refreshes, the new address is pre-selected, and plan, quantity and any other page state survive. Requirements SUB-01..03. Guest (signed-out) behaviour on the page does not change. No API changes.
</domain>

<decisions>
## Implementation Decisions

### One form, two homes
- **D-01:** Extract the address form out of `components/account/AddressManager.tsx` into a shared client component `components/account/AddressForm.tsx`: props `{ initial?: Partial<AddressFormState>; mode: 'create' | 'edit'; addressId?: string; onSaved: (address: MACHCustomerAddress) => void; onCancel?: () => void; lockType?: 'shipping' | 'billing'; submitLabel?: string }`. It owns the field list (label, type, line1, line2, city, region, postal_code, country, is_default), the same HTML validation attributes, the busy state, and the inline message (`role="alert"` for errors, `role="status"` for success). `AddressManager` renders `AddressForm` and keeps the card list, edit/delete and the local default-clearing logic; `app/account/addresses/page.tsx` is unchanged. No second copy of the field list may exist (a source contract pins it).
- **D-02:** The save call moves to `lib/account/address-client.ts` `saveAddress(form, addressId?)`: POST `/api/account/addresses` (create) or PUT `/api/account/addresses/{id}` (edit), JSON body, `credentials: 'same-origin'`, returns `{ address }` or throws `Error(body.error || 'Address could not be saved')`. Both `AddressManager` and the modal use it; the API routes do not change.

### The select and the modal
- **D-03:** In `components/subscriptions/SubscriptionAcquisitionPanel.tsx` the address `<select>` renders whenever the plan requires shipping and the shopper is signed in. It is disabled only while loading, never for an empty list. Options: the placeholder (`Select an address`, or `Add an address to continue` when the list is empty), the saved addresses, and a last option with the sentinel value `__add_new__` labelled `Add a new address…`. Choosing the sentinel opens the modal and leaves `addressId` unchanged (the select keeps showing the previous selection); the "Manage addresses" `Link` to `/account/addresses` and the empty-state paragraph are removed. Loading and `addressError` messages stay.
- **D-04:** `components/subscriptions/AddAddressDialog.tsx` (new) wraps the shadcn `Dialog` from `components/ui/dialog` using the token classes and structure of `components/checkout/OrderConfirmationModal.tsx` (`bg-surface`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`/`text-on-primary`, `text-danger`), never the admin palette and never a `gsd:scan-ignore` comment. It renders `AddressForm` with `mode='create'`, `lockType='shipping'`, `submitLabel='Save address'`, and a Cancel button. API errors render inside the modal via the form's message; the modal stays open. Cancel, Escape and the overlay close it without touching `addressId`. Focus returns to the select (Radix default).
- **D-05:** After a successful save the panel re-fetches through the existing `fetchSavedAddressesForPlan` (so the entry passes the same validation as on load), sets `addressesOwner = userId`, and selects the new address by the id from the save response — falling back to the default/first only if the new id is not in the refreshed list. The same reset discipline as a manual change applies (`setSetup(null)`, `setCheckoutError('')`, `setCompletedOwner(null)`). `plan`, `quantity`, terms acceptance and every other state variable are not touched. A pure helper `nextAddressSelection(addresses, preferredId)` in `components/subscriptions/acquisition-client.ts` holds the selection rule so it is unit-testable.
- **D-06:** Guest shoppers still see only the sign-in button; nothing about the signed-out branch changes.

### Tests and docs
- **D-07:** Tests: `tests/unit/components/subscriptions/product-acquisition-source.test.ts` gains the SUB-01 contract (contains `Add a new address…` and `AddAddressDialog`, does not contain `/account/addresses` or `Manage addresses`; existing substrings and the no-storage/no-console negatives stay); a new `tests/unit/components/account/address-form-source.test.ts` pins that only `AddressForm.tsx` contains the field markup within `components/account/` and `components/subscriptions/` (the guest checkout `components/checkout/ShippingForm.tsx` is a separate, props-driven form outside this phase), that `AddressManager` and `AddAddressDialog` both import `AddressForm`, and that `AddressForm` uses `saveAddress`; `tests/unit/components/subscriptions/acquisition-client.test.ts` gains behaviour cases for `nextAddressSelection`; `tests/unit/app/account-security-source.test.ts` stays green. No admin, API or migration changes.
- **D-08:** UI-SPEC skipped (planning with `--skip-ui`): the dialog primitive, the checkout confirmation modal and the existing panel/form give the visual contract; `scan:tokens` is the gate.

### Claude's Discretion
- Exact copy of the placeholder/empty-state option text and the modal title/description.
- Whether `AddressForm` exposes the `type` select when `lockType` is set (recommended: hidden, value forced).
</decisions>

<specifics>
## Specific Ideas

- Russell: "Replace the navigation link and always keep a select to add a new address, which opens a modal panel allowing a user to enter a new shipping address. Saving that address saves it same as the profile page does, and pre-selects it in the dropdown."
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `components/subscriptions/SubscriptionAcquisitionPanel.tsx` — address state (lines ~115–119), load effect (~209–233), `visibleAddresses`, the select (~400–417), the block to remove (~421–427), the plan-change reset (~342–350), the signed-out branch (~369–380)
- `components/subscriptions/acquisition-client.ts` — `SavedSubscriptionAddress`, `fetchSavedAddressesForPlan`, `shippingAddressFromSaved`
- `components/account/AddressManager.tsx` — the form to extract (fields ~85–102, `save()` ~33–56, class string line ~71)
- `app/api/account/addresses/route.ts`, `app/api/account/addresses/[id]/route.ts`, `lib/account/validation.ts` (`parseAddressInput`) — the API contract (201 `{ address }` on create; 400/403/409 `{ error }`)
- `lib/types/mach/Customer.ts` `MACHCustomerAddress`
- `components/ui/dialog.tsx`, `components/checkout/OrderConfirmationModal.tsx` — dialog primitive and storefront usage
- `docs/theming.md` "The 23-token contract"; `scripts/scan-hardcoded-colors.mjs` — the token gate
- Tests: `tests/unit/components/subscriptions/product-acquisition-source.test.ts`, `acquisition-client.test.ts`, `tests/unit/app/account-security-source.test.ts`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The dialog primitive is Radix-backed (escape, focus trap, focus return come free).
- `fetchSavedAddressesForPlan` already validates and flattens saved addresses; reusing it after save keeps one validation path.
- The API already returns the created address with its id, so pre-selection needs no extra request beyond the refresh.

### Established Patterns
- Source-contract tests read component files as text and assert substrings; behaviour tests mock `fetch`.
- Storefront components use only token classes; `scan:tokens` excludes only paths with an `admin` segment.

### Integration Points
- The panel's `facts` idempotency key includes the shipping address, so a new selection naturally produces a new setup intent.
</code_context>

<deferred>
## Deferred Ideas

- Editing or deleting addresses from the product page (account page only).
- Address autocomplete / verification.
</deferred>

---

*Phase: 15-subscription-address-in-place*
*Context gathered: 2026-09-10 autonomously from Russell's todo*
