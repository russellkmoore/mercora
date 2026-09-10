---
title: Subscription PDP — add a shipping address in place instead of leaving the page
created: 2026-09-10
resolves_phase: null
source: Russell, 2026-09-10
---

# Subscription product page: add an address without navigating away

## Today

`components/subscriptions/SubscriptionAcquisitionPanel.tsx` (~line 400) renders a "Shipping address" `<select>` filled from `GET /api/account/addresses`. With no saved address the select is disabled and the shopper is sent to `/account/addresses` via a "Manage addresses" link, losing the product page and their plan/quantity choices. With saved addresses, only those appear; there is no way to add one here.

## Wanted

- The select always offers an **"Add a new address…"** option (also when the list is empty), replacing the navigation link.
- Choosing it opens a **modal** with the same address form the account page uses (`components/account/AddressManager.tsx` form: label, type, line1, line2, city, region, postal code, country).
- Saving posts to the same `POST /api/account/addresses` endpoint (same validation, same persistence as the profile page), closes the modal, refreshes the list, and **pre-selects the new address** in the dropdown. Plan, quantity and any pending state on the page survive.
- Errors from the API show inside the modal; cancel restores the previous selection.

## Notes for planning

- Extract the address form from `AddressManager` into a shared component so the account page and the modal render one form (no second copy of the field list or validation).
- Modal uses the existing shadcn `dialog` primitive and token classes; keyboard/escape/focus-return per `docs/theming.md` conventions.
- Guest shoppers on a subscription PDP: confirm what the panel does today when signed out and keep that behaviour.
- Tests: source contract for the select option, a unit test for the pre-select-after-save behaviour, and the existing account address tests unchanged.
