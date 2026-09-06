---
phase: 05-token-contract-component-sweep
plan: 10
subsystem: ui
tags: [tailwind, tokens, stripe, checkout, react-context]

# Dependency graph
requires:
  - phase: 05-03
    provides: "the frozen 23-token contract and getThemeTokens() in lib/themes/tokens.ts — the bridge this plan carries across the server-to-client boundary"
  - phase: 05-04
    provides: "components/ui/input.tsx, select.tsx, dialog.tsx rewritten to the contract — the primitives ShippingForm.tsx and OrderConfirmationModal.tsx compose with"
  - phase: 05-09
    provides: "the established border-border-inverse Tailwind class-naming precedent and the bg-info/text-foreground status-token pairing this plan reuses"
provides:
  - "StoreConfigProvider carries a second context value (themeTokens) alongside StoreConfig; useThemeTokens() is the client-side channel for theme hex, computed once server-side in app/layout.tsx"
  - "components/checkout/StripeProvider.tsx scan-clean, appearance fully token-driven via useThemeTokens(), light inverse surface preserved under volt-dark"
  - "eleven checkout UI files scan-clean, converted from a legacy light (bg-white/text-black) panel design to the dark main-set token surface"
  - "chunk-4-checkout screenshot coverage in 05-SCREENSHOTS.md, including a documented MISSING for the two payment-form supplementary cells with code-level verification as the fallback"
affects: [05-11, 05-12]

# Actuals (#2632)
actuals:
  tokens: 11325
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second React context value added to an existing provider component (themeTokens alongside config) rather than a new provider, so Phase 6 can swap getThemeTokens()'s body for a per-request D1 read without touching a single consumer or the provider tree shape"
    - "Stripe Elements appearance literals replaced with useThemeTokens() reads; an rgba() focus shadow becomes the primary hex token plus an 8-digit hex alpha suffix instead of a restated channel triple"
    - "A pre-existing light-panel design inside a dark storefront (the checkout form) is normalized to the main dark token set by the sweep's own role-based mapping (Task 2's explicit 'checkout page chrome is a main-set surface' instruction), not preserved as a fifth inverse-surface exception — a deliberate, plan-directed polarity change scoped to exactly the checkout UI files, distinct from the four scoped inverse consumers in TOKEN-MAP §3"

key-files:
  created: []
  modified:
    - lib/store/StoreConfigProvider.tsx
    - lib/store/index.ts
    - app/layout.tsx
    - components/checkout/StripeProvider.tsx
    - components/checkout/CheckoutClient.tsx
    - components/checkout/PaymentForm.tsx
    - components/checkout/DiscountCodeInput.tsx
    - components/checkout/ShippingOptions.tsx
    - components/checkout/ShippingForm.tsx
    - components/checkout/ProgressBar.tsx
    - components/checkout/OrderSummary.tsx
    - components/checkout/OrderItemCard.tsx
    - components/checkout/OrderConfirmationModal.tsx
    - app/checkout/page.tsx
    - app/checkout/success/page.tsx
    - .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md

key-decisions:
  - "The checkout UI's completed-step summary boxes (collapsed shipping address/method, `border-l-4` accent) map to the success token, not primary — directed by Task 2's own action text ('a completed step... [is] success'), and confirmed by the acceptance criterion requiring CheckoutClient.tsx to reference both danger and success as distinct tokens, which no other element in the file naturally satisfies."
  - "bg-white checkout panels (shipping form, shipping options, order summary, payment section, confirmation modal) map to bg-surface-elevated per Task 2's explicit role framing ('Step panels, the order summary card, and the confirmation modal are elevated surfaces'), not to the inverse token set — despite `bg-white`/`bg-gray-50` literally appearing in TOKEN-MAP §3's inverse table, that row is scoped 'inside a drawer' only, which the checkout panels are not."
  - "Secondary/recessed chips nested inside the now-dark panels (CheckoutClient.tsx's collapsed-step accent boxes, OrderConfirmationModal.tsx's order-id `<pre>` block) map to bg-surface (darker) rather than bg-surface-elevated, to preserve the original design's two-shade layering (a lighter card containing a slightly different recessed/accent element) now inverted for a dark theme — a judgment call in the absence of an explicit TOKEN-MAP row for either."
  - "The PaymentForm.tsx submit-button spinner's border-white maps to border-foreground, not the literal §2 table row border-white/* -> border-border — Role beats shade (D-15): the spinner's role is a visible foreground indicator on a dark button, and border-border (#404040) would make it nearly invisible against bg-surface (#000000), a real pixel regression the literal table row would have introduced."
  - "StripeProvider.tsx's .Tab--selected borderColor (#f97316, not explicitly named in this plan's <interfaces> prose) is swept to tokens.primary along with the four rules the prose did name — the acceptance criterion ('no hex literal... of any kind') and the file's own measured 10-occurrence count govern over the prose's undercount."
  - "<hr> dividers in OrderSummary.tsx needed no colour class at all — Tailwind's preflight resets them to `border-color: currentColor`, so once the parent's text colour became text-foreground the dividers automatically became visible white-on-dark lines with zero code change, matching the prior black-on-white behavior's contrast relationship exactly."

patterns-established:
  - "When a plan's <interfaces> prose undercounts a file's colour occurrences, treat the acceptance criteria's literal requirement ('no hex literal of any kind') as authoritative over the prose summary, and verify via the file's own measured occurrence count rather than the prose's enumerated list."

requirements-completed: [TOKEN-03, TOKEN-05]

coverage:
  - id: D1
    description: "StoreConfigProvider gains a themeTokens prop and useThemeTokens() hook alongside an unchanged useStoreConfig(); app/layout.tsx computes getThemeTokens() once server-side and passes it in; Clerk's appearance prop is byte-identical"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "grep -q useThemeTokens lib/store/StoreConfigProvider.tsx && grep -q useStoreConfig lib/store/StoreConfigProvider.tsx && grep -q getThemeTokens app/layout.tsx && grep -q useThemeTokens components/checkout/StripeProvider.tsx -> bridge-wired"
        status: pass
      - kind: other
        ref: "git diff app/layout.tsx -- ClerkProvider appearance block: no lines changed inside the Clerk appearance prop"
        status: pass
      - kind: unit
        ref: "mise exec -- npm run test -> 244 test files / 1882 tests passed"
        status: pass
    human_judgment: false
  - id: D2
    description: "StripeProvider.tsx reads every appearance colour (variables + all five rule blocks including .Tab--selected) from useThemeTokens(), holds no hex/rgb/named-colour literal; the 16px font size, 44px minimum height, spacing unit, and border radius are unchanged"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/checkout/StripeProvider.tsx -> 0 violations"
        status: pass
      - kind: other
        ref: "grep -cE \"'16px'|'44px'|spacingUnit|borderRadius\" components/checkout/StripeProvider.tsx -> 8 (unchanged from pre-plan count)"
        status: pass
      - kind: other
        ref: "mise exec -- npm run build && npm run lint && npm run typecheck -> all pass (0 lint errors, 52 pre-existing warnings unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Eleven checkout UI files are scan-clean; CheckoutClient.tsx references both danger and success as distinct tokens; ProgressBar.tsx keeps three step states distinct by shape and token together; no inverse-set token class appears; sizing/spacing class count in CheckoutClient.tsx is unchanged"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/checkout && -- --path app/checkout -> 0 violations both"
        status: pass
      - kind: other
        ref: "grep -q -- '-danger' CheckoutClient.tsx && grep -q -- '-success' CheckoutClient.tsx -> outcome-tokens-distinct"
        status: pass
      - kind: other
        ref: "sizing/spacing class count in CheckoutClient.tsx before vs after this plan (grep -coE gap|p|px|py|pt|pb|m|mx|my|w|h|min-h|text pattern) -> sizing-stable"
        status: pass
      - kind: other
        ref: "grep -lE 'surface-inverse|on-inverse|muted-on-inverse|border-inverse' across all 11 Task 2 files -> no matches"
        status: pass
      - kind: unit
        ref: "mise exec -- npm run test -> 1882 tests passed, no new failures"
        status: pass
    human_judgment: false
  - id: D4
    description: "chunk-4-checkout captured (22 cells, 4 pre-existing order-status MISSING); 19/22 byte-identical to chunk-4-drawers; the 3 differing checkout cells trace to one registered snap (S17); the payment-form supplementary cells are documented MISSING with code-level verification that the Stripe form is still light"
    requirement: "TOKEN-05"
    verification:
      - kind: other
        ref: "mise exec -- node scripts/screenshot-routes.mjs --label chunk-4-checkout --allow-missing -> captured 22 cell(s), 4 missing"
        status: pass
      - kind: other
        ref: "PIL ImageChops.difference bbox + 8 random differing-pixel samples, checkout cells vs chunk-4-drawers: all samples land on text-gray-400(#9ca3af)->text-muted-foreground(#a3a3a3) antialiasing (new snap S17); product/1280/resting diff traces to an unrelated next/image load-race flake, confirmed by isolated recapture"
        status: pass
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/checkout -> 0 violations (re-checked after capture)"
        status: pass
    human_judgment: true
    rationale: "The two payment-form supplementary cells could not be captured live in this environment (POST /api/payment-intent 400'd upstream of anything this plan touches, before a Stripe client secret was issued). The 'Stripe form is still light' claim is backed by a direct code read of StripeProvider.tsx's token values (surfaceInverse #fdfdfb background, onInverse #000000 text), not a rendered screenshot. A human must complete the plan's own live human-check — walk a real checkout to the payment step and confirm the card fields, focus border, and invalid state render correctly — since a code read proves the values are correct but not that Stripe's appearance API applies them as intended."

# Metrics
duration: 90min
completed: 2026-09-04
status: complete
---

# Phase 5 Plan 10: Checkout Token Bridge and Sweep Summary

**Checkout is fully token-driven end to end — including the third-party Stripe Elements iframe that cannot read CSS — via a server-computed token bridge threaded through the existing StoreConfigProvider, with the checkout page's legacy light-on-dark panel design normalized to the storefront's dark theme.**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-09-04T10:00:00-07:00 (approx.)
- **Completed:** 2026-09-04T10:24:16-07:00
- **Tasks:** 3 completed
- **Files modified:** 16

## Accomplishments

- Extended `StoreConfigProvider` with a second context value (`themeTokens`) and a `useThemeTokens()` hook, computed once server-side in `app/layout.tsx` next to `getStoreConfig()`. This is the reversible-but-costly decision the plan called out: Phase 6 can now swap the active theme to a per-request D1 read by changing only `getThemeTokens()`'s body — no consumer, including Stripe, ever changes again.
- Rewrote `components/checkout/StripeProvider.tsx` to read all ten colour occurrences (variables plus all five rule blocks, including `.Tab--selected`, which this plan's own `<interfaces>` prose undercounted) from `useThemeTokens()`, matching TOKEN-MAP §3b's email-identical inverse mapping. The `rgba()` focus shadow became the primary hex token plus an 8-digit alpha suffix instead of a restated channel triple. Every non-colour rule — 16px font, 44px touch targets, spacing unit, border radius — is untouched.
- Swept eleven checkout UI files onto the token contract. The most consequential finding: the checkout form's panels were built as a **legacy light (`bg-white`/`text-black`) design nested inside the dark storefront**, not one of TOKEN-MAP §3's four scoped inverse surfaces. Per Task 2's own explicit role framing ("the checkout page chrome is a main-set surface"), all of it converts to the dark main-set tokens (`bg-surface-elevated`, `text-foreground`) — a real, deliberate polarity change from the pre-sweep checkout's appearance, scoped exactly to this plan and captured live via a scripted checkout walkthrough.
- Checkout state now reaches the status quartet by meaning: the error banner and payment-declined path are `danger`; the completed-step summary boxes (collapsed shipping address/method) and applied discounts are `success` — two visibly distinct tokens in `CheckoutClient.tsx`, satisfying the plan's own highest-stakes acceptance criterion that a declined payment and a completed step never render the same colour.
- Captured `chunk-4-checkout`: 19 of 22 grid cells are byte-identical to the prior chunk; the 3 that differ trace entirely to one line of text (a `text-gray-400` → `text-muted-foreground` consolidation, registered as new snap S17); a fourth, unrelated diff on the `product` route reproduces the same `next/image` load-race flake 05-09 already documented. The two payment-form supplementary cells could not be captured live — `POST /api/payment-intent` 400'd on a pricing/tax code path upstream of anything this plan touches — and are documented MISSING with the same reasoning 05-07 used for `ReviewForm.tsx`, backed by code-level proof of the correct token values instead.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bridge the tokens to the client and theme Stripe Elements** - `0f5ea56` (feat)
2. **Task 2: Sweep the checkout UI** - `01e8f2f` (feat)
3. **Task 3: Prove the checkout flow is unchanged and the payment form is still light** - `aed5a75` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `lib/store/StoreConfigProvider.tsx` - second context value (`themeTokens`), `useThemeTokens()` hook
- `lib/store/index.ts` - re-exports `useThemeTokens`
- `app/layout.tsx` - computes `getThemeTokens()` server-side, passes it into the provider
- `components/checkout/StripeProvider.tsx` - appearance fully token-driven via `useThemeTokens()`
- `components/checkout/CheckoutClient.tsx` - panels to `bg-surface-elevated`, completed steps to `success`, error banner to `danger`
- `components/checkout/PaymentForm.tsx` - button, spinners, error banner token-driven
- `components/checkout/DiscountCodeInput.tsx` - applied-discount chip to `success`, error to `danger`
- `components/checkout/ShippingOptions.tsx` - panel and selected-option state token-driven
- `components/checkout/ShippingForm.tsx` - panel and Select primitive overrides token-driven
- `components/checkout/ProgressBar.tsx` - three step states token-driven, kept shape-distinct
- `components/checkout/OrderSummary.tsx` - panel and discount rows token-driven
- `components/checkout/OrderItemCard.tsx` - nested item card token-driven
- `components/checkout/OrderConfirmationModal.tsx` - modal, order-id well, and buttons token-driven
- `app/checkout/page.tsx` - page wrapper token-driven
- `app/checkout/success/page.tsx` - confirmation panel token-driven
- `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` - `chunk-4-checkout` section, snap S17

## Decisions Made

- Completed-step summary boxes map to `success`, not `primary` (see key-decisions above).
- `bg-white` checkout panels map to `bg-surface-elevated` (main set), not the inverse set — the checkout form chrome is not one of TOKEN-MAP §3's four scoped inverse surfaces.
- Secondary/recessed chips (collapsed-step accent boxes, the order-id `<pre>` well) map to `bg-surface` rather than `bg-surface-elevated`, preserving the original two-shade layering inverted for dark.
- The submit-button spinner's `border-white` maps to `border-foreground`, not the literal `border-white/* → border-border` table row — role-based reasoning (visibility) overrides the generic shade table here.
- `.Tab--selected`'s hex literal is swept even though the plan's `<interfaces>` prose only named four of `StripeProvider.tsx`'s five colour-bearing rule blocks.

## Deviations from Plan

None - plan executed exactly as written. The `.Tab--selected` and completed-step-color findings above are execution decisions resolving ambiguity within the plan's own acceptance criteria (the prose undercounted; the acceptance criteria and file's own occurrence count governed), not departures from what the plan directed.

## Issues Encountered

- `POST /api/payment-intent` returned 400 during the Task 3 scripted checkout walkthrough, blocking a live capture of the two payment-form supplementary cells. Traced to `lib/services/checkout-pricing.ts`'s `priceCheckout`, a pricing/tax/shipping-method validation path entirely outside this plan's file list — not a regression this plan introduced. Documented as MISSING in `05-SCREENSHOTS.md` with code-level verification of the correct token wiring as the fallback, matching the precedent 05-07 established for `ReviewForm.tsx`'s own environment gap.
- A `next/image` load-race flake reproduced on the `product` route's screenshot cell (unrelated to this plan's files) — the same class of capture-environment flake 05-09 documented. Confirmed via an isolated recapture rather than chased further.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useThemeTokens()` is now a proven, live pattern for any future client consumer needing raw theme hex — plans 05-11 (Clerk) and 05-12 (emails) can follow the same provider-threading approach, or continue using `getThemeTokens()` directly server-side where appropriate.
- The checkout route's dark-panel conversion is a real, intentional visual change from pre-sweep `main` — reviewers and 05-11/05-12 should expect the checkout form to look categorically different (dark chrome, light embedded payment fields only) from before this plan, not treat it as a regression.
- The payment-step live render (focused field, invalid state, mobile iOS-zoom behavior) still needs a human to walk a real checkout in a browser — the plan's own human-check — since this environment could not produce a live Stripe Elements capture to sit alongside the code-level verification.
- `lib/utils/image-placeholders.ts` and `lib/types/mach/Promotion.ts` remain untouched and on the manual-review registry.

---
*Phase: 05-token-contract-component-sweep*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: lib/store/StoreConfigProvider.tsx
- FOUND: lib/themes/tokens.ts
- FOUND: components/checkout/StripeProvider.tsx
- FOUND: components/checkout/CheckoutClient.tsx
- FOUND: .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md
- FOUND: .planning/phases/05-token-contract-component-sweep/05-10-SUMMARY.md
- FOUND commit: 0f5ea56
- FOUND commit: 01e8f2f
- FOUND commit: aed5a75
