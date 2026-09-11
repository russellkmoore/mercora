---
phase: 17-saved-payment-methods
plan: 03
subsystem: payments
tags: [stripe, customer-session, checkout, elements, payment-form]

requires:
  - phase: 17-saved-payment-methods
    provides: "17-02: app/api/payment-intent/route.ts returns customerSessionClientSecret for signed-in shoppers"
provides:
  - "StripeProvider.tsx forwards customerSessionClientSecret into Elements options, so the Payment Element renders Stripe's saved-card selector and save-this-card checkbox for signed-in shoppers"
  - "CheckoutClient.tsx stores the field from the /api/payment-intent response and threads it to StripeProvider, remounting in lockstep with clientSecret on every re-quote"
  - "PaymentForm.tsx's link: 'never' comment now states the real, current reason Link stays off (D-12)"
affects: [saved-payment-methods, checkout]

actuals:
  tokens: 1900
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Conditional-spread convention for optional Elements options (fonts, locale, customerSessionClientSecret all follow the same ...(x ? {x} : {}) shape)"

key-files:
  created:
    - tests/unit/components/checkout/stripe-provider-customer-session.test.ts
    - tests/unit/components/checkout/checkout-client-customer-session-source.test.ts
  modified:
    - components/checkout/StripeProvider.tsx
    - components/checkout/CheckoutClient.tsx
    - components/checkout/PaymentForm.tsx
    - tests/unit/components/payment-form-link-source.test.ts
    - tests/unit/components/checkout-gift-card-field-source.test.ts

key-decisions:
  - "customerSessionClientSecret is passed to StripeProvider as customerSessionClientSecret || undefined, so an empty-string reset (a re-quote that returns no Customer Session) never reaches Elements as a truthy empty key (D-07, T-17-14)."
  - "No second remount key was added — the existing key={clientSecret} is sufficient because both secrets arrive in the same response and are set in the same tick (17-RESEARCH.md Pattern 3)."
  - "PaymentForm.tsx's confirmPayment call and radios/paymentMethodOrder settings are untouched — the save behavior is entirely driven by the Customer Session config on the Elements instance (17-RESEARCH.md Pattern 4)."

requirements-completed: [PAY-03]

coverage:
  - id: D1
    description: "A signed-in shopper's Payment Element is created with both the PaymentIntent client secret and the Customer Session client secret"
    requirement: PAY-03
    verification:
      - kind: unit
        ref: "tests/unit/components/checkout/stripe-provider-customer-session.test.ts#forwards customerSessionClientSecret into Elements options when supplied"
        status: pass
    human_judgment: false
  - id: D2
    description: "A guest's Payment Element is created with the PaymentIntent client secret only — the Customer Session key is absent, not present-and-empty"
    requirement: PAY-03
    verification:
      - kind: unit
        ref: "tests/unit/components/checkout/stripe-provider-customer-session.test.ts#omits customerSessionClientSecret from Elements options when not supplied"
        status: pass
    human_judgment: false
  - id: D3
    description: "CheckoutClient reads customerSessionClientSecret from the /api/payment-intent response and threads it to StripeProvider, with key={clientSecret} unchanged"
    requirement: PAY-03
    verification:
      - kind: unit
        ref: "tests/unit/components/checkout/checkout-client-customer-session-source.test.ts#passes customerSessionClientSecret as a prop on the StripeProvider mount"
        status: pass
      - kind: unit
        ref: "tests/unit/components/checkout/checkout-client-customer-session-source.test.ts#keeps the existing key={clientSecret} remount"
        status: pass
    human_judgment: false
  - id: D4
    description: "link: 'never' stays byte-identical and its comment states the real reason Link is off"
    requirement: PAY-03
    verification:
      - kind: unit
        ref: "tests/unit/components/payment-form-link-source.test.ts#turns Link off in the Payment Element"
        status: pass
      - kind: unit
        ref: "tests/unit/components/payment-form-link-source.test.ts#explains why Link stays off in terms of the saved-payment-method feature (D-12)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No custom save-card checkbox or saved-card picker markup was written; that UI is Stripe-hosted (D-14)"
    verification:
      - kind: other
        ref: "git diff of components/checkout/PaymentForm.tsx and components/checkout/CheckoutClient.tsx: only comment text and prop-plumbing lines changed"
        status: pass
    human_judgment: false
  - id: D6
    description: "The full unit suite, lint, typecheck, and token scan stay green with the new wiring in place"
    verification:
      - kind: unit
        ref: "mise exec -- npm test (2919/2919 passed)"
        status: pass
      - kind: other
        ref: "mise exec -- npm run lint (0 errors, 54 pre-existing warnings)"
        status: pass
      - kind: other
        ref: "mise exec -- npm run typecheck (clean)"
        status: pass
      - kind: other
        ref: "mise exec -- npm run scan:tokens (0 violations)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-11
status: complete
---

# Phase 17 Plan 03: Checkout Client Wiring Summary

**`StripeProvider.tsx` forwards the Customer Session secret into `Elements`, `CheckoutClient.tsx` threads it down from the `/api/payment-intent` response, and `PaymentForm.tsx`'s stale "no saved-payment-method feature" comment now tells the truth — completing PAY-03's checkout half.**

## Performance

- **Duration:** ~20 min
- **Started:** ~2026-09-11T10:21:00Z (approx.)
- **Completed:** 2026-09-11T10:41:22Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `StripeProvider.tsx` accepts a new `customerSessionClientSecret?: string` prop and conditionally spreads it into `elementsOptions`, following the file's existing `fonts`/`locale` convention — the key is present only when the prop is supplied.
- `CheckoutClient.tsx` reads `customerSessionClientSecret` from the `/api/payment-intent` response type, stores it in its own state (always assigned with a `?? ''` fallback so a re-quote that returns no session clears the stale one), and passes it to `<StripeProvider>` as `customerSessionClientSecret={customerSessionClientSecret || undefined}` — the existing `key={clientSecret}` remount is unchanged and sufficient.
- `PaymentForm.tsx`'s `link: 'never'` line is byte-identical; the comment above it now explains that this store saves payment methods itself through the Customer Session, so Link's own save-box would offer a second, parallel place a card could live — re-enabling Link is a separate future decision.
- Two new test files (`stripe-provider-customer-session.test.ts`, `checkout-client-customer-session-source.test.ts`) prove the present/absent cases at both ends of the prop chain; `payment-form-link-source.test.ts` gained an anchor assertion on the new comment wording.

## Task Commits

Each task was committed atomically:

1. **Task 1: StripeProvider forwards the Customer Session secret into Elements** - `8d94500` (feat)
2. **Task 2: CheckoutClient stores and threads the Customer Session secret** - `52a41f6` (feat)
3. **Task 3: Restate why Stripe Link stays off** - `cb92a8b` (test)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `components/checkout/StripeProvider.tsx` - new `customerSessionClientSecret` prop, conditional spread into `elementsOptions`
- `components/checkout/CheckoutClient.tsx` - response type gains the field, new state, threaded to `<StripeProvider>`
- `components/checkout/PaymentForm.tsx` - comment above `link: 'never'` rewritten to state the real reason (D-12)
- `tests/unit/components/checkout/stripe-provider-customer-session.test.ts` (new) - Elements options present/absent coverage
- `tests/unit/components/checkout/checkout-client-customer-session-source.test.ts` (new) - source-contract test pinning the response type, state setter, prop, and `key={clientSecret}`
- `tests/unit/components/payment-form-link-source.test.ts` - docblock and assertion updated to match the new D-12 reason
- `tests/unit/components/checkout-gift-card-field-source.test.ts` - regex loosened after Task 2's multi-line `<StripeProvider>` mount broke its exact-formatting match (Rule 1)

## Decisions Made

- `customerSessionClientSecret || undefined` at the `<StripeProvider>` call site, not a bare `customerSessionClientSecret={customerSessionClientSecret}`, so an empty-string reset never becomes a truthy-but-empty key in the Elements options object.
- No second remount key was introduced; `key={clientSecret}` already forces a full remount whenever a re-quote produces a new `clientSecret`, and the Customer Session secret always arrives in that same response.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a test regression caused by this plan's own formatting change**
- **Found during:** Task 3 (`mise exec -- npm test` after Task 2's edits)
- **Issue:** `tests/unit/components/checkout-gift-card-field-source.test.ts` asserted an exact single-line regex `/<StripeProvider key=\{clientSecret\} clientSecret=\{clientSecret\}>/` against `CheckoutClient.tsx`. Task 2 reformatted the `<StripeProvider>` mount to multiple lines to fit the new `customerSessionClientSecret` prop, which broke the exact-formatting match.
- **Fix:** Loosened the regex to `/<StripeProvider[\s\S]*?key=\{clientSecret\}[\s\S]*?clientSecret=\{clientSecret\}/`, which still proves the mount carries both the remount key and the client secret prop, independent of line-wrapping.
- **Files modified:** `tests/unit/components/checkout-gift-card-field-source.test.ts`
- **Verification:** `mise exec -- npx vitest run tests/unit/components/checkout-gift-card-field-source.test.ts` — 6/6 passed
- **Committed in:** `cb92a8b` (Task 3 commit)

**2. [Rule 3 - Blocking] Fixed a typecheck/lint conflict introduced by Task 1's own test**
- **Found during:** Task 2 (`mise exec -- npm run typecheck`), refined during Task 3 (`mise exec -- npm run lint`)
- **Issue:** `stripe-provider-customer-session.test.ts` originally passed `children` as a third positional argument to `React.createElement`, which TypeScript rejected because `StripeProviderProps.children` is required and wasn't present in the props object (`error TS2769`). Moving `children` into the props object fixed the type error but tripped `eslint react/no-children-prop`.
- **Fix:** Kept `children` as the third positional argument to `React.createElement` and cast the props object to `Parameters<typeof StripeProvider>[0]` (via `as unknown as ...`, since `StripeProviderProps` isn't exported) to satisfy the overload without adding `children` as a named prop key.
- **Files modified:** `tests/unit/components/checkout/stripe-provider-customer-session.test.ts`
- **Verification:** `mise exec -- npm run typecheck` clean; `mise exec -- npm run lint` reports 0 errors (54 pre-existing warnings, baseline unchanged)
- **Committed in:** `8d94500` (introduced), fixed in `52a41f6` (typecheck) and `cb92a8b` (lint)

---

**Total deviations:** 2 auto-fixed (1 test regression from this plan's own formatting change, 1 blocking typecheck/lint conflict introduced by this plan's own test). **Impact:** Both fixes are confined to test files this plan already touches or a sibling test whose exact-format assertion this plan's own change broke. No scope creep, no behavior change to shipped code.

## Issues Encountered

- **Same-checkout parallel execution (no worktrees):** this plan ran concurrently with plan 17-05 (`components/account/**`) in the same working tree, per this plan's own prompt contract. During Task 2, `git commit` (invoked without explicit pathspec) briefly swept in an unrelated in-flight file staged by the 17-05 executor (`components/account/PaymentMethodList.tsx`) into a commit titled `feat(17-05): ...`. The 17-05 executor self-corrected by amending that commit down to just its own file moments later, which put this plan's Task 2 changes back into the staged index uncommitted. Task 2 was then re-committed cleanly (`52a41f6`, verified via `git show --stat` to contain only this plan's three files). All subsequent commits (Task 3) used explicit `git commit -m ... -- <paths>` pathspecs to prevent a recurrence. No code was lost; the final git history is clean and each of this plan's three commits contains exactly the files it should.
- Because this plan and 17-05 share one checkout, `git rev-list --count <base>..HEAD` measures more commits than this plan's own 3 (it includes 17-05's interleaved commits). Per the same caveat documented in 17-02-SUMMARY.md, the `commits: 3` and `tokens: 1900` in this SUMMARY's frontmatter are measured from this plan's own three hashes (`8d94500`, `52a41f6`, `cb92a8b`) and this plan's own file list, not the shared-history range.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The checkout-side half of PAY-03 is complete: a signed-in shopper's Payment Element is constructed with a Customer Session and renders Stripe's own saved-card selector and save-this-card checkbox; a guest's Payment Element never receives the key at all.
- Link stays off, and its comment now matches reality.
- No blockers. Plan 17-05 (Account → Payment methods UI/nav) is running concurrently in the same checkout and does not depend on anything this plan produced.

---
*Phase: 17-saved-payment-methods*
*Completed: 2026-09-11*

## Self-Check: PASSED

- FOUND: components/checkout/StripeProvider.tsx
- FOUND: components/checkout/CheckoutClient.tsx
- FOUND: components/checkout/PaymentForm.tsx
- FOUND: tests/unit/components/checkout/stripe-provider-customer-session.test.ts
- FOUND: tests/unit/components/checkout/checkout-client-customer-session-source.test.ts
- FOUND: tests/unit/components/payment-form-link-source.test.ts
- FOUND: tests/unit/components/checkout-gift-card-field-source.test.ts
- FOUND: 8d94500 (git log)
- FOUND: 52a41f6 (git log)
- FOUND: cb92a8b (git log)
- `mise exec -- npm test` - 2919/2919 passed
- `mise exec -- npm run lint` - 0 errors (54 pre-existing, unrelated warnings)
- `mise exec -- npm run typecheck` - clean
- `mise exec -- npm run scan:tokens` - 0 violations
