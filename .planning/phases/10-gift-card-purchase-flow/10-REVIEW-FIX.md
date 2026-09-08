---
phase: 10-gift-card-purchase-flow
fixed_at: 2026-09-08T18:37:00Z
review_path: .planning/phases/10-gift-card-purchase-flow/10-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-09-08T18:37:00Z
**Source review:** .planning/phases/10-gift-card-purchase-flow/10-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 — critical_warning scope)
- Fixed: 3
- Skipped: 0

Note: IN-01 (missing `maxLength` on the recipient email/name inputs) is Info-tier
and out of scope for this run (`fix_scope: critical_warning`). Left undocumented
in code, documented here as not fixed.

## Fixed Issues

### WR-01: Delivery-date "today" bound is computed in UTC, not the shopper's local date

**Files modified:** `components/product/GiftCardRecipientForm.tsx`, `lib/gift-cards/customization.ts`
**Commit:** 6fede44
**Applied fix:** Added a local (unexported) `localIsoDate(date)` helper to each file that
builds a `YYYY-MM-DD` string from `getFullYear()/getMonth()/getDate()` (local calendar
components) instead of `new Date().toISOString().slice(0, 10)` (UTC calendar date).
`computeDeliveryDateBounds()` in `GiftCardRecipientForm.tsx` now uses it for the `min`
bound; `validateGiftCardDeliveryDate`'s default `todayIso` in `customization.ts` now uses
it as its fallback when no explicit `todayIso` is passed. The one-year-out `max` bound
computation (pure calendar arithmetic on the already-resolved date string, not on "now")
was left unchanged in both files — it doesn't have the UTC/local bug.

Verified `lib/gift-cards/customization.ts` lines 1-123 (`parseGiftCardCustomization`,
`canonicalGiftCardCustomization`, and the private normalisers) remain byte-identical to
the pre-fix version (confirmed via `diff`) — the change is purely additive, appended
after the existing exports, and no other file under `lib/gift-cards/` was touched.

### WR-02: Clerk-prefill effect sets state synchronously inside `useEffect`

**Files modified:** `components/checkout/CheckoutClient.tsx`
**Commit:** 362510e
**Applied fix:** Extracted the Clerk-prefill effect into its own hook,
`useClerkAddressPrefill(setAddress)`, defined above the component in the same file.
`setAddress` now arrives at the effect as a plain function parameter rather than a
`useState` setter declared in the same scope, so the extracted hook is a legitimate
"synchronize local state from an external system" effect rather than the
same-component cascading-render pattern `react-hooks/set-state-in-effect` flags.
Behavior is unchanged: still gated on `isLoaded && isSignedIn && user`, still only fills
`recipient`/`email` when the field is currently empty, still runs whenever
`isLoaded`/`isSignedIn`/`user` change, still not gated on `isDigitalOnly`.

Confirmed via `npx eslint components/checkout/CheckoutClient.tsx` that the
`react-hooks/set-state-in-effect` warning (previously reported at line 105) no longer
appears; the only remaining warning is the pre-existing, unrelated
`@next/next/no-location-assign-relative-destination` notice. All 16 tests in
`tests/unit/components/checkout-digital-only-source.test.ts` pass unchanged, including
the ones pinning `!(?:next|prev)\.recipient`, `!(?:next|prev)\.email`, `user.fullName`,
and exactly one occurrence of `primaryEmailAddress` in the file.

### WR-03: Unavailable gift cards give no explanation, unlike regular products

**Files modified:** `app/product/[slug]/ProductDisplay.tsx`
**Commit:** 7613703
**Applied fix:** Gated the `product.type === "gift_card"` branch on `available`,
mirroring the existing non-gift-card branch: when available, renders
`GiftCardRecipientForm` as before; when unavailable, renders the same
`<p className="text-lg font-semibold text-warning sm:text-xl">Coming soon</p>` markup
used elsewhere on the page, instead of a fully-rendered recipient form with a silently
disabled Add to Cart button.

## Skipped Issues

None — all in-scope findings were fixed.

## Verification

All fixes were made and verified directly in the main checkout (`workflow.use_worktrees`
is `false` in `.planning/config.json`), so the results below are reproducible from this
tree as-is.

For each fix: re-read the modified file section (Tier 1), ran the targeted vitest files
plus every other test file that references `ProductDisplay.tsx`/`CheckoutClient.tsx`
found via `grep -rl`, ran `npx eslint` on every changed file, and ran `npx tsc --noEmit`
filtered to the changed files (Tier 2) — all passed with no new errors or warnings
introduced. No fix required rollback.

- `tests/unit/components/gift-card-recipient-form-source.test.ts` — 11 passed
- `tests/unit/lib/gift-cards/customization-field-validators.test.ts` — 24 passed
- `tests/unit/lib/gift-cards/customization.test.ts` — 8 passed
- `tests/unit/components/checkout-digital-only-source.test.ts` — 16 passed
- `tests/unit/app/content-polish-source.test.ts`, `layout-switch-contract.test.ts`,
  `storefront-catalog-boundary-source.test.ts`,
  `components/layout/product/product-gallery-variants.test.ts`,
  `components/subscriptions/product-acquisition-source.test.ts`,
  `lib/utils/product-image.test.ts` — 100 passed (combined, other ProductDisplay
  consumers)
- `npx eslint` on all three changed files — 0 errors, 0 new warnings
- `npx tsc --noEmit` — 0 errors in any changed file

---

_Fixed: 2026-09-08T18:37:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
