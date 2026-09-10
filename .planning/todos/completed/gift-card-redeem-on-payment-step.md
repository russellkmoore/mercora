---
title: Redeem a gift card on the payment step (it is a form of payment, not a discount code)
created: 2026-09-10
resolves_phase: null
source: Russell's live check of the first production gift card, 2026-09-10 ("a gift card is a form of payment")
---

# Spike: apply a gift card from the Payment Information step

## Today

The gift-card code is entered on the first checkout step, in the order summary under the discount code (moved there in `3e4824a`; before that it was a box under the summary that nobody found). The code is redeemed server-side when `POST /api/payment-intent` creates the quote, which happens when the shopper continues to payment. Once on the payment step the field is gone; the applied amount shows as "Gift card GC-****-…-LMS7" (`f721f6c`).

## Wanted

A shopper on the Payment Information step sees a gift-card option beside Card / Cash App Pay / Klarna / Amazon Pay, applies a code there, and the order total and Stripe form update in place. A card that covers the whole order finishes without a card charge.

## What it takes (client only; the server already supports it)

- Payment-step UI: code input, apply/remove, the "Gift card GC-…" line and remaining-to-pay.
- On apply: call the existing create-intent path again with `giftCardToken` + `giftCardRequestKey`, replace `clientSecret`, remount Stripe Elements. Shipping-option changes on step 1 already re-create the intent, and the request key keeps re-quoting idempotent (`lib/services/checkout-pricing.ts` `giftCardRequestKey`, reservations in `lib/gift-cards/`).
- Full-cover case: `noCash` response already exists (goes straight to confirmation) — reuse it from the payment step.
- Abandoned intents: each re-quote creates a new PaymentIntent; the old one stays unconfirmed like any abandoned checkout (same as today).
- Stripe minimum-charge floor when the card covers all but a few cents — decide: block, or round the gift-card tender down so a chargeable remainder stays.
- Tests: step-props source contract, re-quote path, `noCash` from payment, plus a browser walkthrough (the thing this milestone never had).

Roughly half a day. Real regression risk in the payment step, so plan it as its own phase with UAT, not an unattended push.

## Related

- Recipient-based Account → Gift cards listing (SHOP-07 gap, v2.1 audit).
- `STORE_FEATURE_GIFT_CARD_ACQUISITION` only gates tender today (v2.1 audit INT-01).

## Resolved 2026-09-10

Shipped in `b121c93`: "Pay with a gift card" panel on the Payment Information step with Apply/Remove, in-place re-quote, Elements remount, `previousOrderId` release of the earlier hold, and a specific gift-card error. Browser walkthrough by Russell pending.
