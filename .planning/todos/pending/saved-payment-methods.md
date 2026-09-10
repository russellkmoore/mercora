---
title: Saved payment methods for signed-in shoppers (Stripe Customer + Account → Payment methods)
created: 2026-09-10
resolves_phase: null
source: Russell, 2026-09-10 — "Save my information" at checkout saved nothing to the store
---

# Saved payment methods

Stripe Link is now hidden in the Payment Element (`link: 'never'`) because its
"Save my information for faster checkout" box saved cards to Link, not to
Mercora, and nothing in the store could use them.

To make saving real: create a Stripe Customer per signed-in shopper (map Clerk
user → Stripe customer id), pass it when creating the PaymentIntent with
`setup_future_usage`, add Account → Payment methods (list/remove), and offer
saved methods in the Payment Element for signed-in shoppers. Guests keep the
plain card form. Re-enable Link only if it is wanted alongside this.
