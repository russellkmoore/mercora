---
phase: 05-token-contract-component-sweep
plan: 11
subsystem: ui
tags: [tailwind, tokens, clerk, order-status, error-boundary, account]

# Dependency graph
requires:
  - phase: 05-03
    provides: "the frozen 23-token contract and getThemeTokens() in lib/themes/tokens.ts — the bridge app/global-error.tsx and the Clerk appearance block both read directly"
  - phase: 05-10
    provides: "app/layout.tsx's existing server-side getThemeTokens() call, reused (not duplicated) for the Clerk appearance.variables block; the established border-border-inverse and bg-info/text-foreground status-token precedents"
  - phase: 05-04
    provides: "components/ui/button.tsx's ghost-variant hover:bg-surface-elevated pattern and HeaderClient.tsx's text-foreground/hover:bg-foreground/hover:text-primary nav-hover precedent, reused verbatim in ClerkLogin.tsx"
provides:
  - "Every authenticated-account surface (AccountNav, AddressManager, ProfileSettings, GiftCardDashboard, SubscriptionManager, and all seven app/account/** route files) on the token contract"
  - "components/OrderCard.tsx's status badge mapped onto the success/warning/danger/info quartet by meaning, reaching the info token via the processing/shipped states (D-03)"
  - "app/order-status/[id]/page.tsx's dead shadcn classes (text-text-secondary/primary, border-border-default, bg-white, text-primary-700/900) replaced with real tokens, normalizing its legacy light-panel design onto the dark main-set surface"
  - "app/global-error.tsx importing getThemeTokens() directly (never the client hook) and mapping its seven inline colours to MAIN-set fields only — provably still dark, still stylesheet-free"
  - "app/layout.tsx's ClerkProvider carrying appearance.variables sourced from the layout's single existing getThemeTokens() call, alongside the unchanged dark base theme"
  - "chunk-5-account screenshot coverage in 05-SCREENSHOTS.md, including a supplementary Clerk sign-in modal cell"
affects: [05-12]

# Actuals (#2632)
actuals:
  tokens: 16107
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subscription/gift-card status-to-token helper functions (statusToneClasses / deliveryToneClass) added inline in the two account components, mapping domain enum values onto the success/warning/danger/info quartet by meaning rather than by shade"
    - "getThemeTokens() called directly (not the useThemeTokens() client hook) in a component that renders outside any React provider tree, matching the existing typed-getter convention documented in lib/themes/tokens.ts's own file header"
    - "Legacy light-panel (bg-white) route normalized onto the dark main-set token surface rather than preserved as a fifth inverse-surface exception, repeating the precedent 05-10 set for the checkout page"

key-files:
  created: []
  modified:
    - components/account/AccountNav.tsx
    - components/account/AddressManager.tsx
    - components/account/ProfileSettings.tsx
    - components/account/GiftCardDashboard.tsx
    - components/account/SubscriptionManager.tsx
    - app/account/layout.tsx
    - app/account/page.tsx
    - app/account/settings/page.tsx
    - app/account/orders/page.tsx
    - app/account/orders/[id]/page.tsx
    - app/account/subscriptions/page.tsx
    - app/account/gift-cards/page.tsx
    - components/OrderCard.tsx
    - app/order-status/[id]/page.tsx
    - app/error.tsx
    - app/global-error.tsx
    - components/login/ClerkLogin.tsx
    - app/layout.tsx
    - .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md

key-decisions:
  - "AccountNav.tsx's active-item affordance is satisfied by the hover-state's own token mapping (hover:border-orange-500 -> hover:border-primary), not by adding usePathname()-based active-route detection — the component has never had active/inactive link differentiation (confirmed by git history and the current source), so D-16's 'don't lose an existing distinction' guard does not trigger, and adding one would both violate the sweep's no-new-functionality scope boundary and break tests/unit/components/account/account-subscriptions-navigation.test.ts, which renders AccountNav via renderToStaticMarkup() against a next/navigation mock that only exports notFound()."
  - "SubscriptionManager.tsx's and GiftCardDashboard.tsx's status badges and delivery/lifecycle notices are actively mapped onto the success/warning/danger/info quartet by meaning (subscription: active/trialing=success, paused/past_due=warning, canceled/unpaid/incomplete_expired=danger, pending/provider_created/incomplete=info; gift card: active=success/disabled=danger, delivery sent=success/needs_review=warning/pending-processing=info) — both files previously rendered these as plain neutral badges with no status colour at all, so this is new colour-coding directed by the plan's own action text ('Map subscription and gift-card states onto the status quartet by meaning'), not a shade consolidation of a pre-existing coloured badge."
  - "app/account/orders/[id]/page.tsx's order-status chip stays a plain bg-surface-elevated badge, not colour-mapped onto the quartet — that page isn't in Task 2's file list (only OrderCard.tsx, app/order-status/[id]/page.tsx, and app/orders/page.tsx are), the original design never coloured it, and D-16 forbids opportunistic restyling beyond what a task directs."
  - "app/order-status/[id]/page.tsx's bg-white card sections normalize onto bg-surface-elevated (the dark main-set surface), not the inverse token set — this guest order-status page is not one of TOKEN-MAP section 3's four scoped inverse consumers, and the <interfaces> block states every file in this chunk is MAIN-set. Its five dead shadcn classes (text-text-primary/secondary, border-border-default, text-primary-700/900) never resolved to anything in this codebase's Tailwind config, so this also makes several elements visible/legible for the first time — expected under D-17, not a regression."
  - "ClerkLogin.tsx's header button hover (previously hover:bg-white hover:text-orange-500) maps onto the exact text-foreground/hover:bg-foreground/hover:text-primary pattern HeaderClient.tsx's Home link and Categories dropdown trigger already use for the identical white-pill/orange-text hover effect, rather than inventing a new mapping."
  - "app/global-error.tsx's seven inline colour literals map only to MAIN-set getThemeTokens() fields (surfaceElevated/foreground/mutedForeground/primary/onPrimary/border) — RESEARCH Pitfall 4's predicted trap (pattern-matching D-13's neighbouring inverse-mapped consumers) was avoided; the page stays provably dark (zero inverse-field references, confirmed by grep) and every non-colour inline style property (layout, spacing, sizing) is byte-for-byte unchanged."

patterns-established:
  - "Domain-status-to-token-class helper functions (statusToneClasses(status): string) are the established pattern for mapping an app-specific status enum onto the success/warning/danger/info quartet, used now by OrderCard.tsx, SubscriptionManager.tsx, and GiftCardDashboard.tsx."

requirements-completed: [TOKEN-03, TOKEN-05]

coverage:
  - id: D1
    description: "Account components and all seven app/account/** route files swept to the token contract; AccountNav's hover affordance reaches the primary token"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/account && mise exec -- npm run scan:tokens -- --path app/account -> 0 violations"
        status: pass
      - kind: other
        ref: "grep -qE '(bg|text|border)-primary' components/account/AccountNav.tsx -> active-nav-affordance-ok"
        status: pass
      - kind: unit
        ref: "mise exec -- npm run test (1882 tests, includes tests/unit/components/account/account-subscriptions-navigation.test.ts) -> all pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "SubscriptionManager.tsx and GiftCardDashboard.tsx status badges/notices reach all four status tokens by meaning"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "for t in success warning danger info; do grep -rq -- \"-$t\" components/account/SubscriptionManager.tsx components/account/GiftCardDashboard.tsx; done -> status-quartet-complete (C=4)"
        status: pass
    human_judgment: false
  - id: D3
    description: "OrderCard.tsx, app/order-status/[id]/page.tsx, app/orders/page.tsx, app/error.tsx swept; processing/shipped order status reaches the info token; the dead text-text-secondary class is gone"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens across all four paths -> 0 violations; grep -q -- '-info' components/OrderCard.tsx && grep -c text-text-secondary 'app/order-status/[id]/page.tsx' == 0 -> order-tokens-ok"
        status: pass
    human_judgment: false
  - id: D4
    description: "app/global-error.tsx imports getThemeTokens() directly (never useThemeTokens), references zero inverse-set fields, stays dark, and keeps its own <html>/<body> with no stylesheet"
    requirement: "TOKEN-05"
    verification:
      - kind: other
        ref: "grep -cE 'surfaceInverse|surfaceInverseElevated|onInverse|mutedOnInverse|borderInverse' app/global-error.tsx == 0; grep -q getThemeTokens && grep -c useThemeTokens == 0 -> standalone-import-ok; grep -n '<html\\|<body\\|globals.css' -> both tags present, no stylesheet import"
        status: pass
      - kind: other
        ref: "git diff of app/global-error.tsx shows only style-object colour VALUES changed; every non-colour property (margin, minHeight, display, flexDirection, alignItems, justifyContent, padding, boxSizing, textAlign, fontSize, gap, marginTop, borderRadius, fontWeight, cursor, textDecoration) is byte-identical"
        status: pass
    human_judgment: true
    rationale: "The task's own <human-check> requires forcing a real root-layout error boundary in a browser to visually confirm the fallback renders dark with light text — no automated check renders app/global-error.tsx in this suite, since it deliberately mounts outside every test harness's provider tree. The automated grep/diff evidence above proves the code is correct by construction; the human check is the only way to observe the actual rendered pixel."
  - id: D5
    description: "Clerk's appearance prop keeps the dark base theme and gains a variables block sourced from the layout's single existing getThemeTokens() call; components/login/ClerkLogin.tsx swept"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "grep -q variables app/layout.tsx && grep -c 'getThemeTokens(' app/layout.tsx == 1 -> clerk-wired-once; mise exec -- npm run scan:tokens --path components/login && --path app/layout.tsx -> 0 violations; mise exec -- npm run typecheck -> passes (proves the Variables object matches @clerk/shared's typed Variables interface)"
        status: pass
      - kind: manual_procedural
        ref: "manual Playwright capture of the Clerk sign-in modal (.screenshots/chunk-5-account/clerk-widget__1280__signin-modal.png), visually reviewed: dark surface-elevated card, white body text, orange primary button/accents"
        status: pass
    human_judgment: false
  - id: D6
    description: "chunk-5-account screenshot label captured and diffed against chunk-4-checkout; every difference attributed to a registered cause or described as new"
    verification:
      - kind: other
        ref: "mise exec -- node scripts/screenshot-routes.mjs --label chunk-5-account --allow-missing -> 22 captured, 4 MISSING (order-status, expected); 21/22 tracked cells byte-identical to chunk-4-checkout, one (product/1280) attributed to the pre-existing next/image load-race flake 05-09/05-10 already documented"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-09-04
status: complete
---

# Phase 5 Plan 11: Account, Order, and Error-Boundary Token Sweep Summary

**Nineteen files — every authenticated account surface, the order card and guest order-status page, both error boundaries, and Clerk's widget theming — now speak the token contract, with the phase's single highest-risk file (`app/global-error.tsx`) provably still dark and still stylesheet-free.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-04T17:27:23Z
- **Completed:** 2026-09-04T17:47:10Z
- **Tasks:** 3 completed
- **Files modified:** 18 code files + 1 manifest (19 total)

## Accomplishments

- Swept `AccountNav`, `AddressManager`, `ProfileSettings`, `GiftCardDashboard`, `SubscriptionManager`, and all seven `app/account/**` route files to the token contract; `app/account/addresses/page.tsx` confirmed to already carry no colour class
- Added status-to-token mapping in `SubscriptionManager.tsx` and `GiftCardDashboard.tsx` so their status badges and delivery/lifecycle notices read success/warning/danger/info by meaning, not as flat neutral chips
- Mapped `OrderCard.tsx`'s status badge onto the same quartet, with processing/shipped reaching the `info` token per D-03
- Replaced every dead shadcn class in `app/order-status/[id]/page.tsx` (`text-text-secondary`, `text-text-primary`, `border-border-default`, `text-primary-700/900`) with real tokens, normalizing its legacy `bg-white` panel design onto the dark main-set surface (same precedent as 05-10's checkout normalization)
- Made `app/global-error.tsx` — the phase's single highest-risk polarity decision — import `getThemeTokens()` directly and map all seven inline colours to MAIN-set fields only; it stays dark, unlike the inverse-mapped drawers/Stripe/email consumers, with every non-colour inline style byte-identical to before
- Gave Clerk's `appearance` prop a `variables` block from the layout's single existing `getThemeTokens()` call, keeping the dark base theme, and swept `ClerkLogin.tsx` onto the same hover pattern `HeaderClient.tsx`'s nav links already use
- Captured `chunk-5-account` plus a supplementary Clerk sign-in modal cell; 21/22 tracked cells are byte-identical to `chunk-4-checkout`

## Task Commits

1. **Task 1: Sweep the account surfaces** - `2c96646` (feat)
2. **Task 2: Sweep the order surfaces and both error boundaries** - `8923ecc` (feat)
3. **Task 3: Theme the Clerk widgets and prove the account routes are unchanged** - `decfb41` (feat)

**Plan metadata:** _pending — this commit_

## Files Created/Modified

- `components/account/AccountNav.tsx` - hover-state tokens; active affordance via `hover:border-primary`
- `components/account/AddressManager.tsx` - full token sweep, form/list/card surfaces
- `components/account/ProfileSettings.tsx` - full token sweep
- `components/account/GiftCardDashboard.tsx` - token sweep plus status/delivery quartet mapping
- `components/account/SubscriptionManager.tsx` - token sweep plus status quartet mapping (`statusToneClasses`)
- `app/account/layout.tsx` - `bg-surface`/`text-foreground` page shell
- `app/account/page.tsx` - card surfaces and links to tokens
- `app/account/settings/page.tsx` - muted-foreground copy
- `app/account/orders/page.tsx` - muted-foreground empty state
- `app/account/orders/[id]/page.tsx` - card surfaces, links, dividers to tokens
- `app/account/subscriptions/page.tsx` - heading/copy to tokens
- `app/account/gift-cards/page.tsx` - heading/copy to tokens
- `components/OrderCard.tsx` - status quartet mapping, full token sweep
- `app/order-status/[id]/page.tsx` - dead shadcn classes replaced, `bg-white` normalized to `bg-surface-elevated`
- `app/error.tsx` - full token sweep
- `app/global-error.tsx` - `getThemeTokens()` direct import, MAIN-set inline styles
- `components/login/ClerkLogin.tsx` - `text-foreground`/`hover:bg-foreground`/`hover:text-primary`
- `app/layout.tsx` - Clerk `appearance.variables` block
- `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` - `chunk-5-account` label + verdict + Clerk widget cell

## Decisions Made

See `key-decisions` in frontmatter for the full rationale on each. Summary:

- AccountNav's active-affordance requirement is satisfied by the existing hover-state token mapping; no new `usePathname()` logic was added (would break a test that mocks `next/navigation`, and the component never had active/inactive differentiation to preserve).
- Subscription and gift-card status badges are newly colour-coded per the plan's explicit direction — this is new visual information, not a shade consolidation of a pre-existing coloured chip.
- `app/account/orders/[id]/page.tsx`'s status chip stays neutral (not in Task 2's scope; original design never coloured it).
- `app/order-status/[id]/page.tsx`'s legacy light panels normalize onto the dark main-set surface, following 05-10's checkout precedent, since it's not one of TOKEN-MAP §3's four scoped inverse consumers.
- Clerk login button hover reuses `HeaderClient.tsx`'s established `text-foreground`/`hover:bg-foreground`/`hover:text-primary` pattern verbatim.
- `app/global-error.tsx` maps to MAIN-set fields only, avoiding the exact trap RESEARCH Pitfall 4 predicted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed accidental spacing regression during OrderCard.tsx rewrite**
- **Found during:** Task 2, pre-commit self-check
- **Issue:** While rewriting `components/OrderCard.tsx`'s "Review items from this order" toggle button, a full-file rewrite introduced `p-3 py-2` instead of the original `px-3 py-2`, an unintended horizontal-padding change that D-16 forbids.
- **Fix:** Corrected to `px-3 py-2` before running any verification, restoring the original spacing exactly.
- **Files modified:** `components/OrderCard.tsx`
- **Verification:** `git diff` confirmed only colour-class tokens changed on that line after the fix; `scan:tokens`, `build`, `lint`, `typecheck`, and `test` all passed afterward.
- **Committed in:** `8923ecc` (fix applied before this commit, not a separate commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1). **Impact on plan:** None outside the immediate fix — a self-caught typo corrected before any verification or commit; no scope creep, no behavior change beyond restoring the original pixel.

## Known Stubs

None — no stub, placeholder, or unwired-data pattern was introduced by this plan.

## Issues Encountered

**Local environment cannot exercise the authenticated account UI or a seeded order.** This local dev environment has no Clerk session and the local D1 seed has no orders (documented in every prior chunk since 05-02). Consequences for this plan:
- Every `account` screenshot cell is still the unauthenticated `/account` → `/sign-in` → 404 fallback (S12), not the dashboard this plan's Task 1 files render. Coverage instead rests on `scan:tokens` (0 violations), `build`/`lint`/`typecheck`, `npm run test` (1882 passing, including the AccountNav-specific test), and a full read of every swept file against 05-TOKEN-MAP.md §2.
- `order-status` remains MISSING in the manifest for the same reason as every prior chunk. Coverage rests on a full read of `app/order-status/[id]/page.tsx` plus `scan:tokens` for that path; the task's own `<human-check>` covers the remaining behavioral proof.
- The Clerk sign-in modal *was* reachable (no session required to open it) and was captured manually; it renders correctly themed (dark `surface-elevated` card, orange `primary` button/accents).

Resolved without further action — this is a known, accepted local-environment limitation, not a defect in this plan's changes. See `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md`'s `chunk-5-account verdict` section for full detail.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for `05-12` (the final chunk: emails and the remaining shared `05-12` scope per the phase's chunk map). `app/global-error.tsx`'s polarity is settled and provably correct; `getThemeTokens()`'s MAIN-set/inverse-set split is now exercised by every consumer type the contract defines (CSS-cascade classes, a client hook, and a direct standalone import), giving 05-12 a fully proven pattern to extend to the email builders.

No blockers. One open item for whoever eventually seeds local test data or checks the deployed environment: manually verify (a) the Clerk sign-in widget still reads as part of this store, (b) a forced root-layout error renders the dark `global-error.tsx` fallback, and (c) real order status colours in the account area match their meaning — per this plan's Task 3 `<human-check>`.

---
*Phase: 05-token-contract-component-sweep*
*Completed: 2026-09-04*

## Self-Check: PASSED

All 19 files listed in `key-files.modified` confirmed present on disk (`[ -f ]`). All 3 task commits (`2c96646`, `8923ecc`, `decfb41`) confirmed in `git log --oneline --all`. All plan-level `<verification>` and per-task `<acceptance_criteria>` re-run; results recorded in the `coverage` frontmatter block above.
