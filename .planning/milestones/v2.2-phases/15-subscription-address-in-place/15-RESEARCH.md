# Phase 15: Subscription Address In Place - Research

**Researched:** 2026-09-10 (orchestrator scout; small phase, no external dependencies)
**Confidence:** HIGH — every fact below was read from the code this session.

## Summary

No new libraries. The work is a component extraction (`AddressForm`), a client save helper, a sentinel select option, a token-class dialog, and a post-save refresh + pre-select. The API (`/api/account/addresses`) already returns `201 { address }` with the minted id, so pre-selection is a state change, not a new request. The token gate (`scan:tokens`) is the main thing that bites storefront modals: only the 23 token classes are allowed.

## Key facts (file:line)

- `components/subscriptions/SubscriptionAcquisitionPanel.tsx`: props (21); address state (115–119); load effect gated on `selectedPlan?.shippingRequired && isLoaded && isSignedIn && userId`, `AbortController`, `fetchSavedAddressesForPlan`, pre-select default/first (209–233); `visibleAddresses` owner guard (236–239); select `disabled={loadingAddresses || visibleAddresses.length === 0}` with `addressLabel()` options (400–417); onChange clears `setup`, `checkoutError`, `completedOwner`; "Manage addresses" `Link` to `/account/addresses` (421–427); signed-out branch shows `<SignInButton mode="modal">` only (369–380); plan change resets `addressId` (342–350).
- `components/subscriptions/acquisition-client.ts`: `SavedSubscriptionAddress` (13), `fetchSavedAddressesForPlan` (179; max 25, id pattern, drops entries `shippingAddressFromSaved` rejects), `shippingAddressFromSaved` (213).
- `components/account/AddressManager.tsx`: module-private `FormState` (6), `empty` (11), `toForm` (16), `save()` (33–56: POST/PUT, `{ address?, error? }`, throws on `!ok || !address`), inline fields (85–102), input class string (71), single `message` `<p role="status">` (101). Only consumer: `app/account/addresses/page.tsx`.
- `app/api/account/addresses/route.ts`: GET → `{ addresses }`; POST → 401 / 403 (`hasSameOrigin`) / 8 KB cap / `parseAddressInput` / `addr_${uuid}` / 25-address cap / default handling; **201** `{ address }`; errors 409 (concurrent) or 400 `{ error }`.
- `lib/account/validation.ts` `parseAddressInput` (23): returns `{ type, label, is_default, address: { line1, line2, city, region, postal_code, country } }`; country `^[A-Z]{2}$`; `type` collapses to `shipping` unless `billing`.
- `lib/types/mach/Customer.ts:126` `MACHCustomerAddress`.
- `components/ui/dialog.tsx` exports `Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose` (264); `DialogOverlay` carries the only sanctioned `gsd:scan-ignore` block — do not copy it.
- `components/checkout/OrderConfirmationModal.tsx` — storefront dialog usage with token classes.
- `scripts/scan-hardcoded-colors.mjs` — hex/rgb/hsl literals and Tailwind palette utilities fail; `admin` path segments excluded; token classes (`bg-surface`, `bg-surface-elevated`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-on-primary`, `text-danger`, `focus:ring-ring`) pass.

## Pitfalls

1. **Sentinel value in a controlled select.** Setting `addressId` to `__add_new__` would make `selectedSavedAddress` undefined and disturb the idempotency `facts`; handle the sentinel in `onChange` (open modal, do not set state) so the displayed value stays.
2. **Owner scoping.** `visibleAddresses` returns `[]` unless `addressesOwner === userId`; after the refresh set `addressesOwner` again or the new list is hidden.
3. **Source contract negatives.** `product-acquisition-source.test.ts` forbids `localStorage|sessionStorage|console\.(log|error)` anywhere in the panel file; the exact substrings it requires must survive the edit.
4. **`type` union mismatch.** `MACHCustomerAddress.type` is wider than the form's `shipping|billing`; keep the form's narrow type and cast at the boundary as `AddressManager` does today.
5. **Default clearing.** `AddressManager` clears other addresses' `is_default` locally after a default save; keep that in the manager, not in `AddressForm`.
6. **Next.js 16 `Link` removal.** Removing the only `Link` import from the panel must also drop the import or lint fails on unused imports.

## Validation Architecture

- Framework: vitest (`npm test` unit, jsdom not available — no render tests; source contracts + pure-helper behaviour tests).
- Commands: `mise exec -- npx vitest run tests/unit/components/subscriptions tests/unit/components/account tests/unit/app/account-security-source.test.ts`; `npm run lint`; `npm run typecheck`; `npm run scan:tokens`; `mise exec -- npm test`; `npm run build`.
- Requirement map:
  - SUB-01 → `product-acquisition-source.test.ts` (contains `Add a new address…` + `AddAddressDialog`; no `/account/addresses` or `Manage addresses`; select not disabled on empty list).
  - SUB-02 → `address-form-source.test.ts` (field markup only in `AddressForm.tsx`; both consumers import it; `saveAddress` used; `AddressForm` posts nowhere itself) + `account-security-source.test.ts` unchanged.
  - SUB-03 → `acquisition-client.test.ts` `nextAddressSelection` cases (preferred id present → it; absent → default; none → first; empty → ""); panel source contract asserts `nextAddressSelection(` and the three reset calls appear in the save handler and that plan/quantity setters do not.
- Wave 0: none needed; the test files exist or are plain new files.

## RESEARCH COMPLETE
