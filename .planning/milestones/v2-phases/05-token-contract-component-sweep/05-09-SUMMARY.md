---
phase: 05-token-contract-component-sweep
plan: 09
subsystem: ui
tags: [tailwind, tokens, inverse-tokens, cart, agent-chat, screenshot-tooling]

# Dependency graph
requires:
  - phase: 05-03
    provides: "the frozen 23-token contract wired end to end, including the five inverse tokens (surface-inverse, surface-inverse-elevated, on-inverse, muted-on-inverse, border-inverse) this plan is their first real consumer"
  - phase: 05-04
    provides: "components/ui/sheet.tsx rewritten to the contract, the primitive both drawers compose with"
provides:
  - "components/cart/CartDrawer.tsx and components/cart/CartItemCard.tsx scan-clean, converted to the inverse token set with the light-on-dark polarity unchanged"
  - "components/agent/AgentDrawer.tsx and components/agent/ProductCard.tsx scan-clean, converted to the inverse token set with the light-on-dark polarity unchanged, and the agent chat bubble reaching the info token per D-03"
  - "the corrected border-border-inverse Tailwind class name (border-inverse alone generates no CSS) as a precedent for any later plan touching the inverse border token"
  - "chunk-4-drawers screenshot coverage in 05-SCREENSHOTS.md for both drawers at both viewports, including a supplementary agent-drawer-open cell outside the standard D-20 grid"
affects: [05-10, 05-11, 05-12]

# Actuals (#2632)
actuals:
  tokens: 7067
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The Tailwind colour key tailwind.config.ts names \"border-inverse\" generates the border-color utility class border-border-inverse (prefix border- + colour key), not border-inverse -- matching the existing border-border precedent for the main border token. border-inverse alone is not a class Tailwind generates any CSS for; it silently falls back to the browser's currentColor default instead of erroring, which is what made this bug invisible to the token scanner and to a quick visual glance at a thumbnail-sized screenshot."
    - "Status colour tokens (bg-info, bg-primary, bg-danger, etc.) are shared vocabulary between the main and inverse surface families -- only the five surface/foreground/border tokens are duplicated as inverse variants. A dark chip inside a light panel (the agent chat's user bubble, the loading avatar) uses the same bg-info/bg-primary class it would use on the dark app surface, paired with the same on-colour precedent PromotionalBanner.tsx already established (bg-info pairs with text-foreground, not text-on-primary or text-on-inverse)."
  patterns-established: []

key-files:
  created: []
  modified:
    - components/cart/CartDrawer.tsx
    - components/cart/CartItemCard.tsx
    - components/agent/AgentDrawer.tsx
    - components/agent/ProductCard.tsx
    - .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md

key-decisions:
  - "CartTrigger (the header's cart icon button, defined inside CartDrawer.tsx but rendered on the dark app surface, not inside the light panel) takes MAIN-set tokens, not inverse -- text-foreground/hover:bg-foreground/hover:text-primary, since it sits outside the drawer entirely despite living in the same source file."
  - "The agent chat's user message bubble (originally bg-blue-500 text-white) maps to bg-info/text-foreground, matching D-03's naming of the chat bubble as one of exactly three surfaces that justify the info token's place in the contract, and matching PromotionalBanner.tsx's established bg-info/text-foreground on-colour precedent rather than inventing a new pairing."
  - "AgentDrawer.tsx's <hr> divider between the input area and the products area gained an explicit border-border-inverse class it did not have before (previously an unstyled browser-default <hr>), directed by Task 2's own action text (\"its dividers take the inverse set\") and needed to satisfy the acceptance criterion that all five inverse tokens have a real consumer in the file."
  - "Bare `border` classes with no explicit colour family (the CartItemCard outer card, the AgentDrawer input, the chat container, both message bubbles) were left unchanged rather than converted to border-border-inverse -- Tailwind v4's default border colour is currentColor, so these already resolved to the panel's own on-inverse/black text colour before and after the sweep; adding an explicit border-border-inverse class would have shifted them from black to #374151, a real pixel change the plan's own D-16 prohibits."
  - "Cart-open screenshot cells were captured with an empty cart (no persisted local-dev cart items), so CartItemCard.tsx's own token sweep (quantity buttons, Remove button, item divider) is not exercised by the tracked manifest evidence. Verified instead with a manual, untracked capture (one item added via a live add-to-cart flow) confirming the item card, quantity controls, and Remove button all render correctly on the light panel."

patterns-established: []

requirements-completed: [TOKEN-03, TOKEN-05]

coverage:
  - id: D1
    description: "Cart drawer (CartDrawer.tsx, CartItemCard.tsx) is a light inverse-set panel with no hardcoded hex or raw palette class; nested chips outside the panel (CartTrigger) keep main-set tokens; transitions/durations unchanged; build/lint/typecheck pass"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/cart -> 0 violations"
        status: pass
      - kind: other
        ref: "grep -q bg-surface-inverse && grep -q text-on-inverse && grep -q border-border-inverse components/cart/CartDrawer.tsx -> inverse-panel-ok"
        status: pass
      - kind: other
        ref: "transition/duration class count unchanged vs pre-sweep commit -> motion-stable"
        status: pass
      - kind: other
        ref: "mise exec -- npm run build && npm run lint && npm run typecheck -> all pass (0 lint errors, 52 pre-existing warnings unchanged; typecheck clean)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Agent drawer (AgentDrawer.tsx, ProductCard.tsx) is a light inverse-set panel; all five inverse tokens have a real consumer; nested dark chips (header triggers, loading avatar) stay main-set; the chat bubble reaches the info token per D-03; transitions/durations unchanged; vitest/lint/typecheck pass"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/agent -> 0 violations"
        status: pass
      - kind: other
        ref: "all five of surface-inverse/surface-inverse-elevated/on-inverse/muted-on-inverse/border-inverse referenced in AgentDrawer.tsx -> all-five-inverse-used"
        status: pass
      - kind: other
        ref: "grep -q -info && grep -qE (bg|text)-(surface-elevated|foreground|muted-foreground) AgentDrawer.tsx -> info-and-chips-ok"
        status: pass
      - kind: unit
        ref: "mise exec -- npm run test -> 244 test files / 1882 tests passed"
        status: pass
      - kind: other
        ref: "mise exec -- npm run lint && npm run typecheck -> pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "chunk-4-drawers captured for both drawers at both viewports plus a supplementary agent-drawer-open cell; diffed against chunk-3-engagement; every differing cart cell traces to S9/S10; both drawers confirmed still light-on-dark by direct visual read; a capture-environment image/dropdown-loading flake on unrelated non-drawer cells confirmed unrelated via a targeted 3x recapture"
    requirement: "TOKEN-05"
    verification:
      - kind: other
        ref: "mise exec -- node scripts/screenshot-routes.mjs --label chunk-4-drawers --allow-missing -> captured 22 cell(s), 4 missing (matches pre-existing order-status gap)"
        status: pass
      - kind: other
        ref: "grep -c chunk-4-drawers 05-SCREENSHOTS.md -> 25 (non-zero)"
        status: pass
      - kind: other
        ref: "PIL ImageChops.difference bbox + 15-20 random differing-pixel samples per cell, both cart cells vs chunk-3-engagement: every sample lands on border-neutral-800(#262626)->border-border-inverse(#374151, S10) or text-gray-400(~#a3a3af)->text-muted-on-inverse(#6b7280, S9)"
        status: pass
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/cart && -- --path components/agent -> 0 violations (re-checked after capture)"
        status: pass
    human_judgment: true
    rationale: "I visually inspected the chunk-4-drawers cart-open and agent-open captures at both viewports via the Read tool and confirmed both drawers render as light panels with dark, legible text against the dark page -- the plan's own human-check criterion (\"Open the cart drawer and the agent drawer... Confirm both are still light panels against the dark page\"). A human should still perform the plan's own live interactive pass in a real browser, matching the same caveat 05-06/05-07/05-08 recorded for their own human-check items -- a scripted pixel diff plus a static image review is not a substitute for a deliberate interactive QA pass."

# Metrics
duration: 45min
completed: 2026-09-04
status: complete
---

# Phase 5 Plan 9: Cart and Agent Drawer Inverse Token Sweep Summary

**Both light drawers -- cart and AI assistant chat -- now speak the five inverse contract tokens instead of hardcoded light hex values, with their light-on-dark polarity provably unchanged and a Tailwind class-naming bug (border-inverse vs. border-border-inverse) caught and fixed before it shipped.**

## Performance

- **Duration:** 45 min (approx.)
- **Started:** 2026-09-04T16:31:00Z (approx.)
- **Completed:** 2026-09-04T17:00:00Z (approx.)
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments

- Swept `CartDrawer.tsx` and `CartItemCard.tsx` onto the inverse token set per TOKEN-MAP §3: the panel background/text/border to `bg-surface-inverse`/`text-on-inverse`/`border-border-inverse`, quantity controls to `bg-surface-inverse-elevated`, secondary copy to `text-muted-on-inverse`, and the Remove button to the `danger` status tokens (`bg-danger/10`/`border-danger`/`text-danger`) matching the precedent already set by `SubscriptionSetupReturnHandler.tsx`. `CartTrigger` (the header's cart icon, defined in the same file but rendered on the dark app surface) correctly stayed on main-set tokens.
- Swept `AgentDrawer.tsx` and `components/agent/ProductCard.tsx` onto the inverse token set: the panel, chat well, and both message bubbles per TOKEN-MAP §3; mapped the user chat bubble to `bg-info`/`text-foreground` per D-03 (the chat bubble is one of exactly three surfaces that justify the `info` token's place in the contract); kept the header's drawer triggers and the loading avatar on main-set tokens as the nested dark chips this file's read_first specifically warned about.
- Found and fixed a Tailwind class-naming bug during Task 3 screenshot verification: `border-inverse` is not a class Tailwind generates any CSS for (the colour key is named `border-inverse`, so the real utility is `border-border-inverse`, matching the existing `border-border` precedent). The bug was silent -- no scan violation, no build/lint/typecheck error -- because Tailwind's v4 default border colour (`currentColor`) masked it at every check except a screenshot pixel diff.
- Captured `chunk-4-drawers` screenshot evidence: both drawers at both viewports plus a supplementary agent-drawer-open cell (outside the standard D-20 grid, opened via the same `data-testid` selector `HeaderClient.tsx`'s own mobile menu uses). Diffed against `chunk-3-engagement`; every differing pixel in the two cart cells traces to S9 (muted-on-inverse text convergence) or S10 (`border-neutral-800`→`border-border-inverse`). Confirmed in words that both drawers remain light panels on the dark page.

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert the cart drawer to the inverse token set** - `5df89bc` (feat)
2. **Task 2: Convert the agent drawer to the inverse token set** - `30e462b` (feat)
   - Bug fix found during Task 3 verification, applied to both Task 1 and Task 2 files - `90ef281` (fix)
3. **Task 3: Prove both drawers are still light** - `287a0ad` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/cart/CartDrawer.tsx` - panel, close button, empty state, divider, and checkout CTA rewritten to inverse/main tokens; `CartTrigger` rewritten to main-set tokens
- `components/cart/CartItemCard.tsx` - quantity controls, price/metadata text, and Remove button rewritten to inverse/danger tokens
- `components/agent/AgentDrawer.tsx` - panel, header triggers, chat well, both message bubbles, disclaimer, input, send button, divider, and products header rewritten to inverse/main/status tokens
- `components/agent/ProductCard.tsx` - card surface, title, metadata, and price rewritten to inverse/primary tokens
- `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` - `chunk-4-drawers` section (22 standard cells + 2 supplementary agent-drawer cells) with per-cell root-cause analysis and a documented capture-environment flake

## Decisions Made

- `CartTrigger` (header, dark surface) takes main-set tokens despite living in `CartDrawer.tsx`, since it renders outside the light panel entirely.
- The agent chat's user bubble maps to `bg-info`/`text-foreground` per D-03 and the existing `PromotionalBanner.tsx` on-colour precedent.
- Added an explicit `border-border-inverse` class to `AgentDrawer.tsx`'s previously-unstyled `<hr>` divider, directed by Task 2's own "dividers take the inverse set" instruction and needed to satisfy the all-five-tokens acceptance criterion.
- Left bare `border` classes (CartItemCard's outer card, AgentDrawer's input/chat container/message bubbles) unchanged rather than adding an explicit inverse border class, since Tailwind v4's `currentColor` default already resolves them to the panel's own text colour with no pixel change either way -- an explicit `border-border-inverse` there would have been a real, undirected colour shift.
- Verified `CartItemCard.tsx`'s own token sweep with an untracked manual capture (cart with one item added), since the tracked screenshot manifest's cart cells reflect an empty local-dev cart and don't exercise that file's classes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `border-inverse` is not a valid Tailwind class; fixed to `border-border-inverse`**
- **Found during:** Task 3 (screenshot pixel-diff verification)
- **Issue:** Used `border-inverse` as the border-color utility for the inverse border token in four places (the cart drawer's panel edge and item divider, both cart item quantity buttons, and the agent drawer's new `<hr>` divider). Tailwind's generated class name for a colour key named `border-inverse` is `border-{colorKey}` = `border-border-inverse` (matching the existing `border-border` pattern for the main `border` token), not `border-inverse` alone. The incorrect class generated no CSS rule at all, so the border silently fell back to Tailwind v4's `currentColor` default -- rendering pure black instead of the intended `#374151`.
- **Fix:** Replaced all four occurrences of `border-inverse` with `border-border-inverse` across `CartDrawer.tsx`, `CartItemCard.tsx` (x2), and `AgentDrawer.tsx`.
- **Files modified:** `components/cart/CartDrawer.tsx`, `components/cart/CartItemCard.tsx`, `components/agent/AgentDrawer.tsx`
- **Verification:** Rebuilt, re-ran the full scan/lint/typecheck/test suite (all pass, unchanged from before the fix), and re-captured screenshots confirming the panel border and divider now render at `#374151` (`rgb(55,65,81)`) instead of black -- pixel-diff sample `(38,38,38)` (old `border-neutral-800`) → `(55,65,81)` (new, correct value), matching the registered S10 snap.
- **Committed in:** `90ef281`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 - bug). **Impact on plan:** The bug was caught before the plan closed out, entirely within this plan's own verification loop (Task 3's screenshot step), and fixed with a targeted, re-verified commit. No scope creep; no other file affected.

## Issues Encountered

- The automated screenshot capture exhibited a `networkidle`-timing flake unrelated to this plan's files: across three full-grid capture runs, exactly one non-drawer cell (a different one each run -- `category`/`1280`/`nav-open`, `category`/`1280`/`resting`, `product`/`1280`/`nav-open`, `product`/`1280`/`resting` across attempts) differed from `chunk-3-engagement`. Each was individually pixel-diffed and traced to either a `next/image` product photo that hadn't finished loading (broken-image glyph, missing caption text) or an empty/still-loading Categories dropdown panel (flat `bg-surface-elevated` rectangle, no item text) -- neither pattern is producible by any file this plan touched. A targeted 3x isolated recapture of the flagged cell came back byte-identical to `chunk-3-engagement` every time, confirming the flake and not a rendering defect. Documented in `05-SCREENSHOTS.md`'s `chunk-4-drawers` narrative rather than chased further.
- The `border-inverse` / `border-border-inverse` bug (see Deviations above) was only visible via screenshot pixel-diff -- the token scanner, build, lint, typecheck, and vitest suites all passed with the bug present, since an invalid Tailwind class is not a syntax error and `currentColor`'s fallback produced a plausible-looking (if wrong) dark border. This is a reminder that the scan/build/test gates prove the absence of *raw palette values*, not the *correctness* of a token class name; the plan's own screenshot verification step is what caught it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both light drawers are now fully on the token contract with their polarity provably held; the five inverse tokens all have real consumers across four files, closing the loop D-05/D-06 opened when they were added to the frozen 23-token contract.
- `border-border-inverse` is now an established, verified precedent for any later plan (05-10 Stripe, 05-11/05-12 emails) that needs the inverse border token -- the correct class name is now proven in production code, not just in TOKEN-MAP's documentation table.
- The `bg-info`/`text-foreground` on-colour pairing for status tokens is confirmed working for a second consumer (the agent chat bubble), reinforcing the `PromotionalBanner.tsx` precedent for any future status-coloured surface.
- `CartItemCard.tsx`'s own sweep (quantity buttons, Remove button, item divider) is verified correct but not captured in the tracked screenshot manifest, since the local dev cart is empty by default -- any later plan that needs a populated-cart screenshot will need to add an item first (not currently part of any tracked fixture, unlike the blog-post/subscription-plan fixtures 05-07/05-08 seeded into local D1).
- `lib/utils/image-placeholders.ts` and `lib/types/mach/Promotion.ts` remain untouched and on the manual-review registry.

---
*Phase: 05-token-contract-component-sweep*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: components/cart/CartDrawer.tsx
- FOUND: components/cart/CartItemCard.tsx
- FOUND: components/agent/AgentDrawer.tsx
- FOUND: components/agent/ProductCard.tsx
- FOUND: .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md
- FOUND commit: 5df89bc
- FOUND commit: 30e462b
- FOUND commit: 90ef281
- FOUND commit: 287a0ad
