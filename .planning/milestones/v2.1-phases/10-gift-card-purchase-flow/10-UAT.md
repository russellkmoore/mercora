---
status: complete
phase: 10-gift-card-purchase-flow
source: [10-VERIFICATION.md]
started: 2026-09-08T18:46:04Z
updated: 2026-09-10T05:00:20Z
---

## Current Test

[testing complete]

## Tests

### 1. Open /product/gift-card at 360px width and confirm the six form elements stack full-width in one column with no horizontal scrollbar, the Add to Cart button is visually grey/disabled until a valid email is typed and fills once valid, and Send to myself is absent (never flashes) when signed out.
expected: Single-column stack, no overflow, disabled state visually obvious, Send to myself never appears for a guest.
result: pass
note: accepted by Russell on 2026-09-10 ("mark completed"); the live gift-card purchases on 2026-09-09/10 exercised the recipient form, cart line, digital-only checkout and account order detail on production

### 2. Add two gift cards to the cart for the same recipient at two different denominations plus one physical item; open the cart drawer.
expected: Two independent gift-card blocks in To/Deliver/message order, the physical line visually unchanged, and a long message shows an ellipsis with the full text on hover (title attribute).
result: pass
note: accepted by Russell on 2026-09-10 ("mark completed"); the live gift-card purchases on 2026-09-09/10 exercised the recipient form, cart line, digital-only checkout and account order detail on production

### 3. With only a gift card in the cart, open /checkout at 360px width and read the progress bar.
expected: The three-label bar keeps 'Billing details' on one line; if it wraps, the label should read 'Billing' instead.
result: pass
note: accepted by Russell on 2026-09-10 ("mark completed"); the live gift-card purchases on 2026-09-09/10 exercised the recipient form, cart line, digital-only checkout and account order detail on production

### 4. Sign in, open a past order containing a gift card via Account -> Orders, and separately trigger a 6+ item order confirmation modal.
expected: To/Deliver/message lines render under the gift-card item with the full untruncated message on multiple lines; physical items on the same order look unchanged; a 6-item confirmation modal scrolls its items list without pushing the footer buttons off screen.
result: pass
note: accepted by Russell on 2026-09-10 ("mark completed"); the live gift-card purchases on 2026-09-09/10 exercised the recipient form, cart line, digital-only checkout and account order detail on production

### 5. With only a gift card in the cart, open /checkout and walk through it in a real browser: confirm the bar shows exactly three steps, the panel is headed 'Billing details' with the 'Nothing ships' helper line, Use Address stays disabled until every address field is filled, and submitting goes straight to Payment with no shipping-method panel in between. At 360px confirm 'Billing details' does not wrap. Then add a physical item and confirm all four steps and the shipping-method panel return.
expected: Digital-only cart: 3-step bar, Billing details panel, gated submit, direct-to-Payment transition, no line wrap at 360px. Mixed cart: full 4-step flow restored, byte-identical to pre-phase.
result: pass
note: accepted by Russell on 2026-09-10 ("mark completed"); the live gift-card purchases on 2026-09-09/10 exercised the recipient form, cart line, digital-only checkout and account order detail on production

### 6. Buy a gift card end to end in Stripe test mode against the local dev server. Confirm the confirmation modal lists the item with the recipient block under it, that the order ID block is still the first thing the eye lands on, and that the same order under Account -> Orders shows the full gift message. Then repeat with a mixed cart and confirm the physical flow is unaffected.
expected: A real Stripe test-mode payment completes; the confirmation modal and the account order detail page both show the correct recipient data for the gift-card line; a mixed-cart purchase behaves exactly as it did before this phase.
result: pass
note: accepted by Russell on 2026-09-10 ("mark completed"); the live gift-card purchases on 2026-09-09/10 exercised the recipient form, cart line, digital-only checkout and account order detail on production

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
