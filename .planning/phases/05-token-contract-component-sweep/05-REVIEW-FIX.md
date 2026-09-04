---
phase: 05-token-contract-component-sweep
fixed_at: 2026-09-04T18:31:47Z
review_path: .planning/phases/05-token-contract-component-sweep/05-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-09-04T18:31:47Z
**Source review:** .planning/phases/05-token-contract-component-sweep/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 3
- Fixed: 3
- Skipped: 0

Ran full test suite (`vitest run`: 245 files / 1884 tests, all passing),
`tsc --noEmit` (clean), and `eslint` after each change. All checks ran in
the main checkout — `workflow.use_worktrees` is `false` for this project, so
no isolated worktree was created for this run; the numbers above are
reproducible directly from this tree.

## Fixed Issues

### CR-01: Order-status email `statusColor` is a literal string, not a template interpolation

**Files modified:** `lib/utils/email.ts`
**Commit:** `99caad5` (already fixed by the orchestrator prior to this run, commit `fix(05-12): interpolate status colour tokens in order-status email`)
**Applied fix:** Not re-applied — verified already present. All six
`statusColor` assignments in `generateOrderStatusUpdateHTML()` (lines ~292,
298, 304, 324, 333, 347) now assign `tokens.*` directly (e.g.
`statusColor = tokens.info;`) instead of the double-quoted literal
`"${tokens.info}"`. A regression test exists at
`tests/unit/lib/utils/order-status-email-tokens.test.ts`.

### WR-01: Internal merchant notification email is bridged into the client bundle

**Files modified:** `lib/store-config.ts`, `lib/store/StoreConfigProvider.tsx`, `app/layout.tsx`
**Commit:** `8444b19`
**Applied fix:** Added a `PublicStoreConfig` type (`Omit<StoreConfig, "contact"> & { contact: Omit<StoreConfig["contact"], "merchantNotificationEmail"> }`) and a `toPublicStoreConfig()` helper in `lib/store-config.ts`. `StoreConfigProvider` (and its context) now type against `PublicStoreConfig` instead of the full `StoreConfig`. `app/layout.tsx` calls `toPublicStoreConfig(config)` before passing it into `<StoreConfigProvider>`, so `contact.merchantNotificationEmail` is stripped before the object is serialized into the RSC payload. Verified no client consumer of `useStoreConfig()` (`app/admin/settings/page.tsx`, `components/HeaderClient.tsx`, `components/admin/AdminSidebar.tsx`, `components/agent/AgentDrawer.tsx`, `components/checkout/PaymentForm.tsx`) reads that field — `lib/utils/email.ts` and `lib/services/order-confirmation.ts` still read it via their own direct `getStoreConfig()` calls server-side, unaffected.

### WR-02: Full order response logged to console in checkout success path

**Files modified:** `components/checkout/CheckoutClient.tsx`
**Commit:** `7cab877`
**Applied fix:** Removed the `console.log('Order created successfully:', orderResponse)` debug statement and the now-unused `const orderResponse = await res.json();` in `handlePaymentSuccess()`. The value was not used anywhere else in the component.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-09-04T18:31:47Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
