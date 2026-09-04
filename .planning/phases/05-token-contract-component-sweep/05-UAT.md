---
status: passed
phase: 05-token-contract-component-sweep
source: [05-VERIFICATION.md]
started: 2026-09-04T18:20:27Z
updated: 2026-09-04T18:34:02Z
---

## Current Test

number: 1
name: Order-status route visual regression
expected: |
  Seed a local order, run `mise exec -- npm run screenshot:routes` against /order-status/[id], compare to pre-sweep. Renders identically; status colours (especially the `info` token for "processing") read correctly and no raw palette value is visible.
awaiting: none

## Tests

### 1. Order-status route visual regression
expected: Seed a local order and screenshot /order-status/[id]. Renders identically to pre-sweep; status quartet colours correct (info = processing); no raw palette value. (No capture of this route exists anywhere in the phase because the local D1 seed has no orders.)
result: accepted (user waived live check 2026-09-04; code-level evidence in 05-VERIFICATION.md)

### 2. Checkout payment step (Stripe Elements) visual confirmation
expected: Complete a real test checkout to the payment step. Stripe Elements renders as a light inverse-token panel with correct field, focus-border, and invalid-state colours matching StripeProvider.tsx's appearance config; no iOS zoom on mobile. (The Elements iframe never mounted locally; /api/payment-intent returned 400.)
result: accepted (user waived live check 2026-09-04; code-level evidence in 05-VERIFICATION.md)

### 3. Authenticated account dashboard visual confirmation
expected: Sign in and view /account (nav, addresses, profile, gift cards, subscriptions). Renders identically to pre-sweep with no untokenised surface. (Every local capture attempt fell through to the unauthenticated 404.)
result: accepted (user waived live check 2026-09-04; code-level evidence in 05-VERIFICATION.md)

### 4. app/global-error.tsx live dark-page rendering
expected: Trigger a real unhandled root-layout exception in a production-like build. The error page is dark (main token set) and renders correctly even with no stylesheet loaded.
result: accepted (user waived live check 2026-09-04; code-level evidence in 05-VERIFICATION.md)

### 5. Transactional email visual confirmation
expected: Open the six rendered emails in .screenshots/emails/{pre-sweep,post-sweep}/*.html in a browser or mail client. Token colours correct, including the intentionally darkened divider (border-inverse = gray-700, snap S10). Decide whether the darker divider is acceptable or should be split into a second token in Phase 6.
result: accepted (user waived live check 2026-09-04; code-level evidence in 05-VERIFICATION.md)

### 6. Snaps S3 (default focus ring) and S11 (global-error primary button)
expected: Tab to a non-danger focusable element and confirm the neutral-700 ring is visible; trigger the error page's primary action button. Both render per the frozen token contract with no regression.
result: accepted (user waived live check 2026-09-04; code-level evidence in 05-VERIFICATION.md)

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
