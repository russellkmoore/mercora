---
phase: 10-gift-card-purchase-flow
plan: 03
subsystem: storefront-checkout
tags: [checkout, react, tdd, gift-card]
requires:
  - phase: 10-01
    provides: "GiftCardRecipientForm.tsx and lib/gift-cards/customization.ts per-field validators (unrelated surface; this plan only depends on 10-01 having landed the source-contract test style, not on its content)"
provides:
  - "components/checkout/ProgressBar.tsx optional steps?: string[] prop, defaulting to the existing four labels via a new module-level DEFAULT_STEPS const — the fill/completed/current logic needed no other change"
  - "components/checkout/ShippingForm.tsx optional heading?: string (default \"Shipping Address\") and helperText?: string (renders no paragraph when absent) props — every field, the field order, the country Select and the Use Address button stay byte-identical"
  - "tests/unit/components/checkout-step-props-source.test.ts — new source-contract test covering both components' new prop surface"
affects: [10-05]

actuals:
  tokens: 1605
  tasks: 2
  commits: 4
  plan_head_before: ebb06d85ae68cec76030edfbee1713eed149ab9b

tech-stack:
  added: []
  patterns:
    - "Both new props are purely additive and defaulted so existing callers (CheckoutClient.tsx) compile and render unchanged — the caller-side wiring for a digital-only cart is deferred entirely to plan 10-05"
    - "vitest --reporter=tap-flat plus a synthesized '# tests/# pass/# fail' footer for RED evidence (same accommodation as 10-02, since vitest's default/tap reporters nest subtests and have no node-test-style summary footer the tdd-red-evidence tool's parser recognises)"

key-files:
  created:
    - tests/unit/components/checkout-step-props-source.test.ts
  modified:
    - components/checkout/ProgressBar.tsx
    - components/checkout/ShippingForm.tsx

key-decisions:
  - "Two of Task 2's acceptance-criteria grep counts were miscounted at planning time against the pre-existing, unmodified file: the \"^ +address\\.[a-z_]+ &&$\" line-count regex excludes \"line1\" because [a-z_]+ does not match the digit, so the correct pre-existing (and post-plan) count is 5, not 6; and \"address.country\" already appeared twice before this plan (once in isSubmitDisabled, once in the Select's value prop), not once. Verified both counts are identical at HEAD~3 (before any edit in this plan) and at HEAD, proving the discrepancy is a planning-time miscount, not a regression this plan introduced. The real invariant the criteria exist to protect — all seven required fields present and isSubmitDisabled byte-identical — is verified directly via an empty git diff inside the expression."

patterns-established:
  - "ProgressBar and ShippingForm's optional-prop-with-identical-default pattern is the template plan 10-05 will use to wire the digital-only caller: pass the alternate array/strings only when isDigitalOnly, omit the props entirely otherwise."

requirements-completed: [SHOP-06]

coverage:
  - id: D1
    description: "ProgressBar accepts an optional steps array and defaults to the exact four labels it hardcodes today, so every existing caller that passes only a step index renders byte-identically"
    requirement: "SHOP-06"
    verification:
      - kind: unit
        ref: "tests/unit/components/checkout-step-props-source.test.ts — ProgressBar describe block, 5/5 passing"
        status: pass
      - kind: other
        ref: "git diff -- components/checkout/CheckoutClient.tsx is empty; mise exec -- npm run typecheck exits 0 with the existing call site unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "ProgressBar's fill/completed/current logic is already generic over the label count; only the prop and its default were added, no other line moved"
    requirement: "SHOP-06"
    verification:
      - kind: other
        ref: "git diff -- components/checkout/ProgressBar.tsx > /tmp/gsd-10-03-bar.diff; grep -c '^[-+].*fillWidths' -> 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "ShippingForm accepts an optional heading defaulting to Shipping Address and an optional helperText that renders no paragraph at all when absent"
    requirement: "SHOP-06"
    verification:
      - kind: unit
        ref: "tests/unit/components/checkout-step-props-source.test.ts — ShippingForm describe block, 6/6 passing"
        status: pass
    human_judgment: false
  - id: D4
    description: "ShippingForm's isSubmitDisabled and its seven required fields are unchanged"
    requirement: "SHOP-06"
    verification:
      - kind: other
        ref: "git diff -- components/checkout/ShippingForm.tsx shows zero changed lines inside the isSubmitDisabled expression; all 7 address.* conjuncts present by direct extraction"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every field, its order, every placeholder, the country Select's three options and the Use Address button are unchanged"
    requirement: "SHOP-06"
    verification:
      - kind: unit
        ref: "tests/unit/components/checkout-step-props-source.test.ts — 'still contains the Use Address button text and the three country option values'"
        status: pass
    human_judgment: false
  - id: D6
    description: "Neither component branches on gift cards, product type, a product id or a URL segment"
    requirement: "SHOP-06"
    verification:
      - kind: other
        ref: "grep -c giftCard over both files -> 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "At 360px the three-label bar keeps Billing details on one line; if it wraps, the label shortens to Billing"
    requirement: "SHOP-06"
    verification: []
    human_judgment: true
    rationale: "This is a visual layout claim about a three-label array (['Billing details', 'Payment', 'Order Submitted']) that no caller passes yet — plan 10-05 wires that caller. Nothing in this plan renders the three-label bar at 360px, so there is no live surface to screenshot or measure against; recorded for end-of-phase UAT harvest once 10-05 lands the caller (workflow.human_verify_mode: end-of-phase)."

duration: 5min
completed: 2026-09-08
status: complete
---

# Phase 10 Plan 03: Checkout Step Prop Surface Summary

**Added optional, backwards-compatible `steps?` on ProgressBar and `heading?`/`helperText?` on ShippingForm — physical checkout renders byte-identically, proven by the full 2283-test unit suite staying green with no caller edited.**

## Performance
- Duration: 5 minutes (2 tasks, 4 commits)
- Diff size: ~1,605 estimated tokens (chars/4) across two component files and one new test file

## Accomplishments
- `ProgressBar.tsx` gained a module-level `DEFAULT_STEPS` const (the four existing labels, same order) and an optional `steps?: string[]` prop defaulting to it — the `fillWidths` initialiser and the render map already read the resolved identifier, so no other line moved.
- `ShippingForm.tsx` gained optional `heading?: string` (default `"Shipping Address"`, the exact original literal) and `helperText?: string` (renders no paragraph when absent, `text-sm text-muted-foreground mb-4` when present) — every `Input`, the country `Select`'s three options, and the **Use Address** button stayed untouched.
- New source-contract test `tests/unit/components/checkout-step-props-source.test.ts` (11 assertions across two `describe` blocks) proves both defaults, the prop shapes, and that the required-field gate did not move.
- Neither call site (`CheckoutClient.tsx`) was edited — both new props resolve to their defaults today, so the physical checkout flow renders exactly as it did before this plan.

## Task Commits
| Task | Commit | Type | Description |
|------|--------|------|-------------|
| 1 (RED) | `bbb3f9c` | test | ProgressBar optional steps prop source-contract test (4/5 failing) |
| 1 (GREEN) | `241cc9c` | feat | ProgressBar accepts an optional label array |
| 2 (RED) | `b26bde4` | test | ShippingForm optional heading/helperText source-contract test (4/11 failing) |
| 2 (GREEN) | `c9bf6b2` | feat | ShippingForm accepts an optional heading and helper line |

## Files Created/Modified
- `components/checkout/ProgressBar.tsx` — modified: `DEFAULT_STEPS` const, `steps?: string[]` prop
- `components/checkout/ShippingForm.tsx` — modified: `heading?: string`, `helperText?: string` props, conditional helper `<p>`
- `tests/unit/components/checkout-step-props-source.test.ts` — created: 11 assertions across two `describe` blocks

## Decisions Made
See `key-decisions` in frontmatter — the acceptance-criteria grep-count discrepancy on `ShippingForm.tsx` (planning-time miscount unrelated to this plan's edit, verified against `HEAD~3`).

## Deviations from Plan
None beyond the acceptance-criteria grep-count documentation above (Decisions Made) — the plan executed as written: both props are additive and defaulted, no call site touched, no fence crossed (`lib/gift-cards/`, `app/api/`, `lib/services/`, `lib/stores/cart-store.ts`, `migrations/`, `lib/db/schema/` all show an empty diff).

## Issues Encountered
None. Both TDD RED phases produced genuine per-test assertion failures (never a module-load crash), classified `RED_EVIDENCE_OK` by `gsd_run check tdd-red-evidence` on the first attempt for both tasks.

## User Setup Required
None. No new environment variable, secret, or manual account setup is introduced by this plan.

## Next Phase Readiness
Plan 10-05 (the step-machine rewire) can now pass `steps={['Billing details', 'Payment', 'Order Submitted']}` with the shifted `0/1/2` index math (Pitfall 4) and `heading="Billing details"` / `helperText="Nothing ships — we need this for your receipt and tax."` for a digital-only cart — both are pure caller changes against props this plan already proved default correctly. The D7 human-check item (360px three-label wrap behavior) is recorded above for end-of-phase UAT harvest once 10-05 lands the only caller that renders the three-label array.

## Self-Check: PASSED
- `components/checkout/ProgressBar.tsx` — FOUND, modified
- `components/checkout/ShippingForm.tsx` — FOUND, modified
- `tests/unit/components/checkout-step-props-source.test.ts` — FOUND, created
- All 4 commit hashes (`bbb3f9c`, `241cc9c`, `b26bde4`, `c9bf6b2`) verified present in `git log --oneline --all --grep="10-03"`
- Re-ran every acceptance criterion in Tasks 1-2 (grep checks, diff-empty checks) — all pass except the two documented planning-time miscounts, which are proven pre-existing and unrelated to this plan's diff
- Re-ran plan `<verification>`: `mise exec -- npm test` (273 files, 2283 tests, all green), `mise exec -- npm run lint` (0 errors), `mise exec -- npm run typecheck` (clean), `mise exec -- npm run scan:tokens` (0 violations); `git diff --stat -- lib app/api migrations package.json package-lock.json` empty; `isSubmitDisabled` expression byte-identical

---
*Phase: 10-gift-card-purchase-flow*
*Completed: 2026-09-08*
