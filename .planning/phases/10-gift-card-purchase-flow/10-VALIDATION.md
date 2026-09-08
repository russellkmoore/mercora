---
phase: "10"
slug: "gift-card-purchase-flow"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-08"
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest, environment `node` — no jsdom and no `@testing-library/react` is installed, so component-level assertions are source-contract tests plus direct calls into exported pure helpers |
| **Config file** | `vitest.config.mts` (repo root); `@` aliases to the repo root; `oxc.jsx.runtime` is `automatic`, so a test may import a `.tsx` module directly |
| **Quick run command** | `mise exec -- npx vitest run <file>` |
| **Full suite command** | `mise exec -- npm test` |
| **Estimated runtime** | single file ~2s; full unit suite ~30s |

---

## Sampling Rate

- **After every task commit:** Run `mise exec -- npx vitest run <that task's test files>`
- **After every plan wave:** Run `mise exec -- npm test`
- **Before `/gsd-verify-work`:** the full CI gate order — `lint`, `typecheck`, `cf-typecheck`, `scan:tokens`, `test`, `test:workers`, `test:observability-worker`, `docs:lint`, `build`
- **Max feedback latency:** under 10 seconds for a single-file run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | SHOP-01, SHOP-02 | T-10-02 / T-10-06 | Client validators can never be more permissive than `parseGiftCardCustomization`; no gift-card secret is reachable from the form | unit (pure) + source contract + live page fetch | `mise exec -- npx vitest run tests/unit/lib/gift-cards/customization-field-validators.test.ts tests/unit/lib/gift-cards/customization.test.ts tests/unit/components/gift-card-recipient-form-source.test.ts` | ✅ | ✅ green |
| 10-01-02 | 01 | 1 | SHOP-02 | T-10-02 | Length, control-character and date rules delegate to the server's own normalisers | unit (pure) | `mise exec -- npx vitest run tests/unit/lib/gift-cards/customization-field-validators.test.ts` | ✅ | ✅ green |
| 10-01-03 | 01 | 1 | SHOP-01, SHOP-03, SHOP-04 | T-10-03 | Clerk identity is read only behind `isLoaded && isSignedIn`; the raw customization is normalised once by the store | source contract | `mise exec -- npx vitest run tests/unit/components/gift-card-recipient-form-source.test.ts tests/unit/lib/stores/cart-store-lines.test.ts` | ✅ | ✅ green |
| 10-02-01 | 02 | 2 | SHOP-05 | T-10-06 / T-10-05 | The block's props type is the four-field allowlist; no code or token field can render | unit (pure) + source contract | `mise exec -- npx vitest run tests/unit/components/gift-card-recipient-block-source.test.ts` | ✅ | ✅ green |
| 10-02-02 | 02 | 2 | SHOP-05 | T-10-08 | A malformed customization is dropped by the store before it reaches either surface | source contract | `mise exec -- npx vitest run tests/unit/components/cart-line-source.test.ts tests/unit/components/cart-hydration-contract.test.ts` | ✅ extend | ✅ green |
| 10-03-01 | 03 | 2 | SHOP-06 | T-10-10 | An out-of-range step index degrades quietly rather than throwing | source contract | `mise exec -- npx vitest run tests/unit/components/checkout-step-props-source.test.ts` | ✅ | ✅ green |
| 10-03-02 | 03 | 2 | SHOP-06 | T-10-04 / T-10-09 | The seven-field address gate is not relaxed for the digital case; the helper copy is honest | source contract | `mise exec -- npx vitest run tests/unit/components/checkout-step-props-source.test.ts tests/unit/app/checkout-recovery-source.test.ts` | ✅ | ✅ green |
| 10-04-01 | 04 | 3 | SHOP-05 | T-10-11 / T-10-06 | The modal fetches nothing and renders only through the allowlisted block | source contract | `mise exec -- npx vitest run tests/unit/components/order-confirmation-items-source.test.ts tests/unit/components/gift-card-recipient-block-source.test.ts` | ✅ | ✅ green |
| 10-04-02 | 04 | 3 | SHOP-05 | T-10-07 | Order ownership stays scoped to the Clerk user id (ADR-CTB-08) | source contract + production build | `mise exec -- npx vitest run tests/unit/app/order-detail-gift-card-source.test.ts tests/unit/app/orders-page-source.test.ts` then `mise exec -- npm run build` | ✅ | ✅ green |
| 10-05-01 | 05 | 4 | SHOP-06 | T-10-04 / T-10-13 / T-10-14 | A complete shopper-entered address is posted explicitly; the server keeps sole authority over pricing and the physical-lines check | unit (pure, paired invariant) | `mise exec -- npx vitest run tests/unit/lib/checkout/digital-only.test.ts` | ✅ | ✅ green |
| 10-05-02 | 05 | 4 | SHOP-06 | T-10-03 / T-10-15 | The Clerk prefill cannot overwrite typed input; the tax line is never client-adjusted | source contract | `mise exec -- npx vitest run tests/unit/components/checkout-digital-only-source.test.ts tests/unit/components/checkout-step-props-source.test.ts` | ✅ | ✅ green |
| 10-05-03 | 05 | 4 | SHOP-05 | T-10-01 | The snapshot lives in component state only, never persisted or transmitted | source contract + full gate | `mise exec -- npx vitest run tests/unit/components/checkout-digital-only-source.test.ts` then the full CI gate order | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No framework install is needed — Vitest is already configured and in use throughout `tests/unit/`. Six test files do not exist yet and are each created inside the task that needs them, before or alongside the code they cover:

- [x] `tests/unit/lib/gift-cards/customization-field-validators.test.ts` — SHOP-01, SHOP-02 (created in 10-01-01, extended in 10-01-02)
- [x] `tests/unit/components/gift-card-recipient-form-source.test.ts` — SHOP-01, SHOP-02, SHOP-03, SHOP-04 submission shape (created in 10-01-01, extended in 10-01-03)
- [x] `tests/unit/components/gift-card-recipient-block-source.test.ts` — SHOP-05 shared block (created in 10-02-01)
- [x] `tests/unit/components/checkout-step-props-source.test.ts` — SHOP-06 leaf-component props (created in 10-03-01, extended in 10-03-02)
- [x] `tests/unit/components/order-confirmation-items-source.test.ts` — SHOP-05 confirmation surface (created in 10-04-01)
- [x] `tests/unit/app/order-detail-gift-card-source.test.ts` — SHOP-05 account surface (created in 10-04-02)
- [x] `tests/unit/lib/checkout/digital-only.test.ts` — SHOP-06 fulfilment-mix predicate and the paired invariant against `hasPhysicalCheckoutLines` (created in 10-05-01)

Existing files extended rather than replaced: `tests/unit/components/cart-line-source.test.ts` (10-02-02). Existing files that already prove a phase requirement and are only re-run as regression guards: `tests/unit/lib/gift-cards/customization.test.ts`, `tests/unit/lib/gift-cards/line-identity.test.ts`, `tests/unit/lib/stores/cart-store-lines.test.ts` (SHOP-04 merge-and-separate is already proven there and needs no new test).

---

## Manual-Only Verifications

Five UI-SPEC rows are marked backstop and are covered by a `<human-check>` block rather than an automated assertion, because this repo has no jsdom, no visual-regression harness for the checkout or cart routes, and the Stripe payment step is outside the existing screenshot grid.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Recipient form stacks in one column at 360px with no horizontal overflow | SHOP-01 | Layout at a viewport width; no jsdom and no screenshot coverage for the product route at this breakpoint | 10-01-03 human-check: open `/product/gift-card` at 360px, confirm six stacked full-width elements and no horizontal scrollbar |
| Three-label progress bar keeps "Billing details" on one line at 360px | SHOP-06 | Text wrapping at a viewport width | 10-05-02 human-check: gift-card-only cart at `/checkout`, 360px; if it wraps, shorten the label to "Billing" |
| Confirmation modal items list scrolls at six or more lines | SHOP-05 | Requires a real six-item paid order; the Stripe payment step is outside the screenshot grid | 10-04-02 human-check: confirm the footer buttons stay in view while the list scrolls |
| Items section is omitted rather than showing a placeholder when the snapshot is empty | SHOP-05 | Unreachable in the normal synchronous flow; only forcible by hand | 10-04-01 source contract asserts the guard; visual confirmation optional |
| The modal never opens when the order call fails; the existing failure phase renders | SHOP-05 | Requires forcing an API failure mid-checkout | 10-04-02 human-check, or force the failure path once in a scratch run |

All other phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every one of the twelve tasks carries at least one runnable `<automated>` command with a stated `<fails_when>`
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — every task has one
- [x] Wave 0 covers all MISSING references — seven new test files, each created inside the task that needs it
- [x] No watch-mode flags — every command is `vitest run` or an `npm run` script
- [x] Feedback latency < 10s — single-file runs are ~2s; only the phase gate in 10-05-03 is long
- [x] `nyquist_compliant` flipped true in frontmatter — set by task 10-05-03 once every row above is green

**Approval:** validated 2026-09-08 — the full CI gate order (`lint`, `typecheck`, `cf-typecheck`, `scan:tokens`, `test` [277 files / 2326 tests], `test:workers` [27 files / 154 tests], `test:observability-worker` [1 file / 3 tests], `docs:lint`, `build`) passed in plan 10-05, task 3.
