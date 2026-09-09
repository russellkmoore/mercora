---
status: pending
phase: 12-content-assistant-live-proof
source: [12-VERIFICATION.md, 12-05-SUMMARY.md, 12-06-SUMMARY.md, 12-REVIEW-FIX.md]
started: 2026-09-09T23:45:00Z
updated: 2026-09-09T23:45:00Z
---

## Current Test

number: 1
name: Open the gift-card email at russellkmoore@mac.com
expected: |
  An email from "Voltique <orders@russellkmoore.me>" sent 2026-09-09T22:20:34Z for the $25 card (run id phase12-20260909-80403f) renders cleanly, and the code it carries validates at checkout (enter it in the Gift card field; a balance of $25.00 is shown). Note: this email predates the fix that adds the buyer's note, so it carries no note.
awaiting: Russell

## Tests

### 1. Open the gift-card email at russellkmoore@mac.com
expected: Email from Voltique <orders@russellkmoore.me>, sent 2026-09-09T22:20:34Z, renders; the code validates at checkout with a $25.00 balance.
result: pending

### 2. Read section 6 ("Gift Cards") of https://voltique.russellkmoore.me/terms-of-service
expected: The section sits after "5. Recurring Orders" and before the closing "For questions…" paragraph, in the same style, and reads naturally.
result: pending

### 3. Decide the Account → Gift Cards clause of SHOP-07
expected: Either correct the requirement's wording (cards are listed for the purchaser, never the recipient; guest purchases list nowhere) or open follow-up work under lib/gift-cards/ for recipient-based listing. Evidence: the live card carries purchaser_customer_id NULL and the listing filters on that column.
result: pending (product decision)

### 4. Accept or revert the unattended production changes
expected: Commits 3b821f7 (fallback tax zero-rates nontaxable lines), 32b9df1 + d8b4d11 (EMAIL_PROVIDER=cloudflare, STORE_SENDER_EMAIL=Voltique <orders@russellkmoore.me>), f813499 (cron hands the worker env to the email sender), plus the review-fix commits 5045b58…eb07108 (gift note delivered in the email with URLs rejected, scheduled-date wording, telemetry). All are deployed. Revert any you disagree with; the demo site is recoverable.
result: pending

### 5. Buy one gift card with a personal note (optional)
expected: After the review fixes deployed, a purchase with a note delivers an email whose "Message from the sender:" block sits below the code and shows the note verbatim; a note containing a URL is rejected on the product page before add-to-cart.
result: pending

## Summary

Automated evidence (12-VERIFICATION.md) covers CONTENT-01/02/03 and the issuance + delivery half of SHOP-07. The five items above are the human-only checks and decisions left for Russell; the phase was closed under the unattended-run instruction with these recorded here and in STATE.md's Deferred Verification table (`/gsd-verify-work 12`).
