---
phase: 17-saved-payment-methods
plan: 05
subsystem: account
tags: [payments, stripe, account, react, nextjs]

requires:
  - phase: 17-saved-payment-methods
    provides: "GET/DELETE /api/account/payment-methods routes and the SavedPaymentMethod interface (17-04)"
provides:
  - "Account -> Payment methods page at /account/payment-methods, auth-gated like the addresses page"
  - "PaymentMethodList client component: self-fetching list with a confirmed, same-origin DELETE remove"
  - "Unconditional 'Payment methods' entry in the account navigation (D-11)"
affects: [17-saved-payment-methods-verification]

actuals:
  tokens: 1777
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Self-fetching client component (no server-rendered initial prop) so the Stripe list call stays in the one route plan 17-04 already tested and off the page's server render path"
    - "List/remove/busy/message pattern mirrored directly from AddressManager.tsx: window.confirm before DELETE, optimistic local filter on success, role=\"status\" message paragraph, disabled buttons while busy"

key-files:
  created:
    - app/account/payment-methods/page.tsx
    - components/account/PaymentMethodList.tsx
    - tests/unit/components/account/account-payment-methods-navigation.test.ts
  modified:
    - components/account/AccountNav.tsx

key-decisions:
  - "PaymentMethodList imports SavedPaymentMethod from app/api/account/payment-methods/route.ts rather than restating the shape, per 17-04's interface contract."
  - "Payment methods nav entry placed unconditionally, immediately after Addresses, with no feature-flag gate (D-11) -- unlike Subscriptions."
  - "Card removal confirmation uses a native window.confirm() naming the brand and last four, matching the account-page convention noted as Claude's discretion in 17-CONTEXT.md, not a new Dialog component."

requirements-completed: [PAY-02]

coverage:
  - id: D1
    description: "A signed-in shopper reaches Account -> Payment methods from the account navigation and sees each saved card as brand, last four and expiry"
    requirement: PAY-02
    verification:
      - kind: unit
        ref: "tests/unit/components/account/account-payment-methods-navigation.test.ts#account payment methods navigation entry (D-11)"
        status: pass
      - kind: unit
        ref: "tests/unit/components/account/account-payment-methods-navigation.test.ts#PaymentMethodList source contract (D-10)"
        status: pass
    human_judgment: true
    rationale: "Rendered brand/last4/expiry formatting and the loading/empty/populated visual states are pinned only at the source-contract and route-shape level here; actual on-screen rendering with live Stripe data is a UX judgment best confirmed visually per 17-CONTEXT's D-14 (Payment Element itself is Stripe-hosted; this list is the one custom surface)."
  - id: D2
    description: "Removing a card asks for confirmation, calls the DELETE route, and drops the row from the list on success"
    requirement: PAY-02
    verification:
      - kind: unit
        ref: "tests/unit/components/account/account-payment-methods-navigation.test.ts#PaymentMethodList source contract (D-10)"
        status: pass
    human_judgment: true
    rationale: "The source-contract test pins the confirm()/DELETE/same-origin call shape but does not execute the fetch/state-update flow end to end (no jsdom/fetch mocking in this test file); the actual removal behavior is best confirmed by a human click-through."
  - id: D3
    description: "A shopper with no saved cards sees an explanatory empty state, not an error; there is no add-a-card form on this page"
    requirement: PAY-02
    verification:
      - kind: unit
        ref: "tests/unit/components/account/account-payment-methods-navigation.test.ts#PaymentMethodList source contract (D-10)"
        status: pass
    human_judgment: true
    rationale: "The no-<form>-substring check is a structural proxy for 'no add-a-card UI'; the empty-state copy itself is not asserted by a running test and is best confirmed visually."
  - id: D4
    description: "An anonymous visitor is redirected to sign-in and never renders the page"
    requirement: PAY-02
    verification:
      - kind: unit
        ref: "tests/unit/components/account/account-payment-methods-navigation.test.ts#account payment methods page auth gate (D-10)"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-09-11
status: complete
---

# Phase 17 Plan 05: Account Payment Methods Page Summary

**Account -> Payment methods page with a self-fetching PaymentMethodList client component (list/confirm/DELETE/remove, no add-a-card UI) and an unconditional AccountNav entry, both pinned by a new source-contract test file.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-11T10:14:00Z
- **Completed:** 2026-09-11T10:40:00Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `components/account/PaymentMethodList.tsx`: a `"use client"` component that self-fetches `GET /api/account/payment-methods` on mount, rendering loading / empty / populated states. Each populated row shows the brand (capitalized), last four, and a zero-padded `MM/YYYY` expiry, with a single Remove button — no Edit, no card icon, no add-a-card form. Remove asks `window.confirm`, calls `DELETE /api/account/payment-methods/{id}` with `credentials: "same-origin"`, filters the row on success, and surfaces success/error text in a `role="status"` paragraph while disabling buttons during the call. Every colour comes from existing token classes (`border-border`, `bg-surface-elevated`, `text-danger`, `text-foreground`, `text-muted-foreground`).
- `app/account/payment-methods/page.tsx`: an async server component gating on `await auth()`, redirecting anonymous visitors to `/sign-in?redirect_url=/account/payment-methods`, then rendering a heading, one explanatory paragraph ("cards are saved during checkout"), and `<PaymentMethodList />`.
- `components/account/AccountNav.tsx`: added `["Payment methods", "/account/payment-methods"]` immediately after the Addresses entry, unconditionally (no feature flag), leaving the existing Subscriptions conditional entry and the gift-cards comment untouched.
- `tests/unit/components/account/account-payment-methods-navigation.test.ts`: 8 tests covering the unconditional nav entry (both flag states), the rendered `AccountNav` output, the page's redirect-when-anonymous and render-when-signed-in behavior, and four source-contract assertions over `PaymentMethodList.tsx` (list fetch path, DELETE + same-origin credentials, `confirm(` guard, absence of `<form`).

## Task Commits

Each task was committed atomically, staged and committed by explicit pathspec (parallel-execution requirement — see Deviations):

1. **Task 1: PaymentMethodList — the list-with-remove client component** - `a2b82df` (feat)
2. **Task 2: The page and the account navigation entry** - `fe63abc` (feat)
3. **Task 3: Pin the navigation, the gate and the page's shape** - `84d8af1` (test)

**Plan metadata:** this SUMMARY's own commit.

## Files Created/Modified

- `app/account/payment-methods/page.tsx` - auth-gated server component rendering the payment-methods page
- `components/account/PaymentMethodList.tsx` - client component: fetch, render, confirm+remove
- `components/account/AccountNav.tsx` - unconditional "Payment methods" nav entry added after Addresses
- `tests/unit/components/account/account-payment-methods-navigation.test.ts` - nav, auth-gate, and source-contract tests

## Decisions Made

- Self-fetching component (no server-rendered `initial` prop), keeping the Stripe list call in the one route 17-04 already tested and off the page's server render path — this diverges from `AddressManager`'s server-prop pattern by design, per the plan's own instruction.
- Native `window.confirm()` for removal confirmation rather than a new Dialog component, per 17-CONTEXT.md's "Claude's discretion" note.
- Payment methods nav entry unconditional, no feature flag, matching D-11.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking / process correction] Fixed an over-broad commit that swept in the parallel 17-03 executor's staged files**
- **Found during:** Task 1 commit
- **Issue:** `git commit -F <msgfile>` commits the entire index, not just the most recently `git add`ed path. The parallel 17-03 executor (same checkout, no worktrees) had already staged `components/checkout/CheckoutClient.tsx` and two of its own test files at the moment I ran `git commit`, so my first attempt at the Task 1 commit included all four files (mine plus theirs) under my commit message.
- **Fix:** Immediately ran `git reset --soft HEAD~1` (moves the branch pointer only; touches neither the index nor the working tree) to undo the over-broad commit, restoring the other executor's staged files to exactly their prior staged state, then recommitted with `git commit -F <msgfile> -- components/account/PaymentMethodList.tsx` (explicit pathspec after `--`, which commits only that path regardless of what else is staged). Applied the same explicit-pathspec form for every subsequent commit in this plan.
- **Files modified:** none beyond the commit history itself; no source file content was affected.
- **Verification:** `git show --stat HEAD` confirmed each of my three commits touches only its own task's files; `git status --short` after each commit confirmed the parallel executor's in-progress files remained staged/modified and untouched.
- **Committed in:** `a2b82df` (corrected Task 1 commit)

**2. [Rule 3 - Blocking / process correction] Fixed a stale scratchpad commit-message file that produced a wrong commit message**
- **Found during:** Task 2 commit
- **Issue:** A `cat > <scratchpad file> <<'EOF'` heredoc silently failed under the shell's `noclobber` setting because a stale file already existed at that scratchpad path from an unrelated prior write in this session. `git commit -F` then read the stale file's leftover, unrelated content ("feat(11-04): enable gift-card reconciliation flag") as the commit message. The commit's file set was already correctly scoped (`git commit -F <file> -- app/account/payment-methods/page.tsx components/account/AccountNav.tsx`, following fix #1's pattern), so only the message text was wrong — no wrong files were committed.
- **Fix:** Verified with `git show HEAD --name-only` that the file set was correct (exactly the two Task 2 files, +18 lines, matching the intended diff), then removed the stale file, rewrote it correctly with `/bin/cat >|` (overwrite, bypassing `noclobber`, per this project's own shell-noclobber convention), and ran `git commit --amend -F <corrected file>` to fix the message on that same, still-unshared, just-created commit — content untouched, message corrected.
- **Files modified:** none; commit-message-only correction.
- **Verification:** `git show --stat HEAD` after the amend confirmed identical file set (`app/account/payment-methods/page.tsx`, `components/account/AccountNav.tsx`, 18 insertions) with the corrected message.
- **Committed in:** `fe63abc` (amended Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both process/git-mechanics corrections triggered by this plan's parallel, no-worktree execution mode; no application code was affected by either).
**Impact on plan:** No scope creep and no incorrect file content ever reached a commit. Both issues were caught and corrected before moving to the next task, and every commit in this plan (verified via `git show --stat`) touches exactly the files that task's `<files>` element lists.

## Issues Encountered

- `npm run lint` reports 2 pre-existing errors (`lib/hooks/useEnhancedUserContext.ts:162` — "Cannot call impure function"; `tests/unit/components/checkout/stripe-provider-customer-session.test.ts:31,61` — `react/no-children-prop`) plus 54 pre-existing warnings. Both errors are in files outside this plan's `files_modified` list, introduced by the parallel 17-03 executor's still-in-progress, uncommitted work in this shared checkout. Confirmed out of scope: `npx eslint` run scoped to only this plan's four files (`app/account/payment-methods/page.tsx components/account/PaymentMethodList.tsx components/account/AccountNav.tsx tests/unit/components/account/account-payment-methods-navigation.test.ts`) reports zero problems. Per the executor's scope boundary, these were not touched. `npm test` (322 files / 2919 tests), `npm run typecheck`, and `npm run scan:tokens` (0 violations) all pass clean against the full repo at the time of this plan's final task.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PAY-02 is complete end to end: `app/account/payment-methods/page.tsx` exists, gates on auth, and renders `PaymentMethodList`, which reads and removes saved cards through 17-04's routes; the account navigation exposes the page unconditionally.
- Verification note for the next step: the 2 pre-existing lint errors introduced by 17-03's concurrent work should be checked again once that plan lands its own SUMMARY — they belong to that plan's scope, not this one's.
- No blockers for this plan's own scope.

---
*Phase: 17-saved-payment-methods*
*Completed: 2026-09-11*

## Self-Check: PASSED

- FOUND: app/account/payment-methods/page.tsx
- FOUND: components/account/PaymentMethodList.tsx
- FOUND: components/account/AccountNav.tsx
- FOUND: tests/unit/components/account/account-payment-methods-navigation.test.ts
- FOUND: a2b82df (git log)
- FOUND: fe63abc (git log)
- FOUND: 84d8af1 (git log)
- `mise exec -- npx vitest run tests/unit/components/account/account-payment-methods-navigation.test.ts` - 8/8 passed
- `mise exec -- npx vitest run tests/unit/components/account/account-subscriptions-navigation.test.ts` - 2/2 passed (unchanged)
- `mise exec -- npm test` - 322 files / 2919 tests passed
- `mise exec -- npm run typecheck` - clean
- `mise exec -- npm run scan:tokens` - 0 violations
- `mise exec -- npm run build` - exit 0, `/account/payment-methods` present in route list
- `mise exec -- npx eslint <this plan's 4 files>` - 0 problems (2 pre-existing errors elsewhere, out of scope, see Issues Encountered)

plan_head_before: 8d94500
commits: 3 (scoped: `git log --oneline --grep="(17-05):"` — raw range count is not meaningful here because this plan executed interleaved with 17-03's commits on the same branch, same checkout, per this plan's explicit parallel-execution instructions)
