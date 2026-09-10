---
title: Gift cards v2 — admin management, audit trail, and flags that mean what they say
created: 2026-09-10
resolves_phase: null
source: Russell, 2026-09-10, after the first live gift-card purchase ("this admin panel is next to useless")
audit_acknowledged:
  milestone: v2.1
  at: 2026-09-10
---

# Seed for the next gift-card milestone

## 1. Flags: sell and honor

Two flags, kept (env names stay for compatibility), renamed in docs to what they do:

| Sell (`STORE_FEATURE_GIFT_CARD_ACQUISITION`) | Honor (`STORE_FEATURE_GIFT_CARD_RECONCILIATION`) | Meaning |
|---|---|---|
| on | on | normal |
| off | on | stopped selling; existing balances still redeemable |
| off | off | gift cards do not exist: product hidden, checkout field hidden, admin nav hidden |
| on | off | **invalid** — refuse to start (already enforced in `lib/commerce/capabilities.ts`) |

Fixes needed:

- **Sell=off must stop sales.** Today it only blocks redemption (backwards). It must hide the recipient form on the product page (or the product), reject gift-card lines in `priceCheckout`, and leave redemption alone.
- **Honor=off must refuse, or warn loudly in admin, while any active balance or open reservation exists.** Prepaid money must not be stranded by flipping a var.
- Off/off hides the admin nav entry and the account/checkout surfaces.
- `docs/DEPLOYMENT_SETUP.md` §9 and `docs/runtime-configuration.md` describe the flags in these terms.

## 2. Admin: manage individual cards

The admin page today is a 5-line stub and the API is a read-only list.

- **List / search:** masked code (last group), amount, available balance, status, purchaser, recipient, issuing order, delivery status, created-by (order or admin).
- **Card detail with a timeline (audit trail):** issued (order, purchaser, recipient, amount) or admin-created (who, why); every hold, redemption (order, amount), release; refund back to card; disabled / reissued (date, who); notes.
- **Actions:** disable (invalidate on fraud — freezes redemption, keeps the ledger); reissue remaining balance as a new card and email it; resend delivery email; retry / re-queue a `needs_review` delivery; release a stuck hold; admin-create a card (goodwill, replacement) with reason.
- **Notes:** free-text entries by CSRs/admins on the card, with author and timestamp.
- **Seeing the code:** decision needed. Codes exist only as an HMAC hash plus an encrypted delivery copy; revealing means decrypting in admin. Options: masked + "resend to recipient" (default), or full reveal behind a confirm with an audit event.

Storage: the ledger already records issuance, holds, redemptions; add a `gift_card_events` table (expand-only migration) for human actions and notes.

## 3. Related, already logged

- Saved payment methods (`saved-payment-methods.md`).
- Blog navigation and home block (`blog-public-navigation-and-home-block.md`).
- Stripe Tax unavailable on the live account; `STORE_SUPPORT_EMAIL` placeholder; orphaned `/api/tax`.
