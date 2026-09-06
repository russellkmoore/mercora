---
phase: 05-token-contract-component-sweep
plan: 07
subsystem: ui
tags: [tailwind, tokens, reviews, subscriptions, star-rating, screenshot-diff]

# Dependency graph
requires:
  - phase: 05-03
    provides: "the frozen 23-token contract wired end to end, the mechanism this plan substitutes class names against"
  - phase: 05-04
    provides: "components/ui/* primitives (input, textarea, select, badge, card) scan-clean and their real token vocabulary to match (border-ring/ring-ring focus treatment, focus:bg-surface-elevated item hover)"
  - phase: 05-06
    provides: "chunk-3-catalog full seven-route coverage as this plan's diff baseline, and the ProductCard.tsx/StarRating.tsx wiring this plan's StarRating sweep ripples into"
provides:
  - "components/reviews/ProductReviewsSection.tsx, ReviewForm.tsx, StarRating.tsx, and components/subscriptions/SubscriptionAcquisitionPanel.tsx, SubscriptionSetupReturnHandler.tsx scan-clean against scripts/scan-hardcoded-colors.mjs"
  - "review validation/submission feedback and subscription setup-return outcomes mapped onto the status quartet (success/warning/danger/info) by meaning"
  - "StarRating.tsx's filled/unfilled colours on the primary/muted-foreground tokens, rippling into every ProductCard star badge across home/category/product"
  - "chunk-3-engagement screenshot coverage in 05-SCREENSHOTS.md, including a new registered snap (S16) and three supplementary cells beyond the standard grid"
affects: [05-08, 05-09, 05-10, 05-11, 05-12]

# Actuals (#2632)
actuals:
  tokens: 14210
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A shared leaf component's token sweep ripples across every surface that composes it: StarRating.tsx is used by both components/reviews/* and ProductCard.tsx, so sweeping its two colour classes changed every star badge in the app, not just the reviews section it was read for. Confirmed via cell-by-cell PIL diff against the prior chunk's full-coverage baseline before registering it as a new snap (S16), the same discipline 05-06 established for S15."
    - "Outcome-state banners (subscription setup finalizing/error/success, review status chips) map onto the status quartet by meaning, not by the file's pre-existing accent colour: an orange brand-accent border used generically for every banner state pre-sweep is not itself semantic and does not survive the sweep unchanged where the plan calls for status-quartet coverage; interactive links inside any banner stay on the primary token regardless of the banner's own status colour, matching the CTA-link convention already established in the acquisition panel's own success/danger sections."
    - "A wrapper div that visually needs to read as a light host frame (backing a light-styled child like a Stripe iframe) but is not one of TOKEN-MAP §3's four scoped inverse-token surfaces stays on the main token set (bg-surface-elevated/text-foreground) rather than borrowing inverse tokens outside their authorized scope, per this plan's own acceptance criteria."
    - "Local-only D1 test fixtures (two synthetic subscription_plans rows) inserted directly via wrangler d1 execute --local, isolated to a separate dev-server run so a feature-flag-gated surface can be screenshotted without contaminating the standard coverage grid's diff against the prior chunk — extends 05-06's local-only-fixture precedent from catalog data to feature-flagged UI."

key-files:
  created: []
  modified:
    - components/reviews/ProductReviewsSection.tsx
    - components/reviews/ReviewForm.tsx
    - components/reviews/StarRating.tsx
    - components/subscriptions/SubscriptionAcquisitionPanel.tsx
    - components/subscriptions/SubscriptionSetupReturnHandler.tsx
    - .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md

key-decisions:
  - "StarRating.tsx's filled stars take text-primary and unfilled stars take text-muted-foreground, per this plan's own directive -- this ripples into every ProductCard star badge (home/category/product grids, cart-open background), not just the reviews section, and is registered as new snap S16 after a full pixel-diff against chunk-3-catalog confirmed no other change"
  - "ProductReviewsSection.tsx's rating-distribution bar track (bg-neutral-800, nested inside an already bg-surface-elevated section) maps to bg-border rather than the generic bg-surface-elevated table entry -- the generic mapping would make the track identical to its own parent surface and erase the bar visually; bg-border (#404040) preserves a visible, lighter-than-card track, matching the darker-card/lighter-track relationship the original neutral-900/neutral-800 pairing had"
  - "Distribution-bar and rating-summary select-hover chip colours (bg-neutral-700/hover:bg-neutral-700) map to bg-border/hover:bg-border rather than bg-surface-elevated's generic 'raised chip' alternative -- neutral-700's hex (#404040) is an exact pixel match for the border token, so this preserves the pre-sweep hover affordance exactly instead of losing it to the elevated-surface base colour it would otherwise collide with"
  - "SubscriptionAcquisitionPanel.tsx's Stripe setup host wrapper (previously bg-white/text-black, not one of TOKEN-MAP §3's four scoped inverse-token surfaces) moves to bg-surface-elevated/text-foreground on the main token set rather than borrowing surface-inverse/on-inverse -- required by this plan's own acceptance criteria ('No file in this task contains an inverse-set token class'); the Stripe iframe itself stays light independently via StripeProvider.tsx's own hardcoded appearance config, untouched by and out of scope for this plan"
  - "SubscriptionAcquisitionPanel.tsx has no plan-card grid to give a selected-vs-unselected visual contrast -- plan choice is a native <select> dropdown (confirmed by reading the full component), so T-05-07-01's 'selected state expressed with the primary token' mitigation is satisfied by the Subscribe section's own border-primary/70 accent and CTA styling, not by inventing new card markup (which would be a Rule 4 architectural change, out of scope for a colour sweep)"
  - "SubscriptionSetupReturnHandler.tsx's four outcome banners map onto the full status quartet by meaning: checking-account/sign-in-prompt=info, finalizing=warning, completed=success, error=danger -- interactive links and buttons inside every banner keep text-primary regardless of the banner's own status colour, matching the acquisition panel's own link convention in its success/danger sections"
  - "The chunk-3-engagement standard 22-cell grid was captured with subscription acquisition OFF (matching every prior chunk's default), keeping it a clean apples-to-apples diff against chunk-3-catalog; the three supplementary cells were captured in a second, isolated dev-server run with the feature flag on and two synthetic local-only subscription_plans D1 rows, so the feature-gated surface could be photographed without contaminating the standard grid's diff"

patterns-established:
  - "When a generic substitution-table mapping would make a role-differentiated pair of elements (e.g. a progress-bar track vs. its own parent surface) collapse onto the identical colour and erase a visible affordance, prefer the nearest table alternative that preserves the pre-sweep lighter/darker relationship over the literal generic mapping, and document the pixel value chosen and why"

requirements-completed: [TOKEN-03, TOKEN-05]

coverage:
  - id: D1
    description: "ProductReviewsSection.tsx, ReviewForm.tsx, and StarRating.tsx are scan-clean; star colours (including any SVG attribute) come from tokens; ReviewForm.tsx's validation/submission feedback reaches the danger and success tokens"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/reviews -> 0 violations"
        status: pass
      - kind: other
        ref: "grep -cE '(fill|stroke)=\"(#|rgb|hsl|[a-z]+\")' components/reviews/StarRating.tsx -> 0"
        status: pass
      - kind: other
        ref: "grep -q -- '-danger' ReviewForm.tsx && grep -q -- '-success' ReviewForm.tsx -> feedback-tokens-present"
        status: pass
      - kind: other
        ref: "mise exec -- npm run build && npm run lint && npm run typecheck -> all pass (0 lint errors, 52 pre-existing warnings unchanged; typecheck clean)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SubscriptionAcquisitionPanel.tsx and SubscriptionSetupReturnHandler.tsx are scan-clean; the Subscribe section's accent and CTAs reach the primary token; the setup-return banners cover at least three of the four status tokens"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/subscriptions -> 0 violations"
        status: pass
      - kind: other
        ref: "status-token loop over SubscriptionSetupReturnHandler.tsx (success/warning/danger/info) -> count=4, status-coverage-ok"
        status: pass
      - kind: other
        ref: "grep -cE '(border|bg|ring)-primary' SubscriptionAcquisitionPanel.tsx -> 4"
        status: pass
      - kind: other
        ref: "mise exec -- npm run test -> 244 test files / 1882 tests passed; lint/typecheck clean"
        status: pass
    human_judgment: false
  - id: D3
    description: "chunk-3-engagement screenshot coverage captured and diffed against chunk-3-catalog: 22/26 standard cells (4 order-status MISSING, matching the pre-existing baseline gap), every differing cell attributed to new snap S16 (StarRating's shared-component ripple) or carried-forward S13/S14, plus three supplementary cells proving the reviews rating-summary card and the Subscribe section's default-selected plan render correctly"
    requirement: "TOKEN-05"
    verification:
      - kind: other
        ref: "mise exec -- node scripts/screenshot-routes.mjs --label chunk-3-engagement --allow-missing -> captured 22 cell(s), 4 missing"
        status: pass
      - kind: other
        ref: "PIL ImageChops.difference bbox + 8-15 random differing-pixel samples per capture on all differing standard-grid cells: every sample lands on the S16 pair (rgb(253,199,0)->rgb(249,115,22) or rgb(82,82,82)->rgb(163,163,163)) or is byte-identical carrying forward S13/S14"
        status: pass
      - kind: manual_procedural
        ref: "visual read of product__1280__reviews-scrolled.png (Reviews tab open, rating summary card) and product__1280__subscription-plan-selected.png (Subscribe section with default plan)"
        status: pass
    human_judgment: true
    rationale: "I visually inspected both supplementary captures via the Read tool and confirmed the star rating reads clearly in brand orange/grey, and the Subscribe section's accent border, CTA, and delivery-schedule select all render on their intended tokens. I could not capture the review-form validation-error cell (ReviewForm.tsx only renders on an authenticated order line item, unreachable in this local dev environment without a Clerk session or seeded delivered order) or perform Task 3's own live interactive human-check (submitting the review form empty, selecting a plan while signed in) -- a human should still do that pass per the task's own instruction, since a scripted pixel diff plus a two-image visual review is not the same as a deliberate interactive QA pass, and Task 1's grep-based proof that ReviewForm.tsx references the danger/success tokens is not the same as seeing the error render live."

# Metrics
duration: 55min
completed: 2026-09-04
status: complete
---

# Phase 5 Plan 7: Review and Subscription Acquisition Sweep Summary

**The product route's two heaviest palette clusters -- reviews and subscription acquisition, 128 occurrences across five files -- now speak only the 23-token contract, with a shared-component ripple (StarRating's colours reaching every product card) caught, pixel-verified, and registered as a new snap (S16) rather than left unexplained.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-04T15:49:00Z (approx.)
- **Completed:** 2026-09-04T16:06:00Z (code); manifest/screenshot work continued after
- **Tasks:** 3 completed
- **Files modified:** 6 (5 source files, 1 screenshot manifest)

## Accomplishments

- Swept `ProductReviewsSection.tsx` (review cards, rating summary, distribution bars, highlight cards, filter/sort selects) and `ReviewForm.tsx` (existing-review status chip, new-review validation and submission feedback) onto main-set and status-quartet tokens. `ReviewForm.tsx`'s field errors and failed submissions reach `text-danger`; successful submission reaches `text-success`; pending/rate-limited notices reach `text-warning`. Form inputs match the `components/ui/input.tsx`/`textarea.tsx` focus vocabulary (`border-ring`/`ring-ring`) rather than a one-off orange focus ring.
- Swept `StarRating.tsx` (filled stars → `text-primary`, unfilled → `text-muted-foreground`; no SVG `fill`/`stroke` literal colours existed to begin with). Because `StarRating` is shared by `ProductCard.tsx`, this two-line change rippled into every star badge across the home, category, and product grids -- caught by a full pixel-diff against `chunk-3-catalog` and registered as a new snap, **S16**, rather than left as an unexplained diff.
- Swept `SubscriptionAcquisitionPanel.tsx` (Subscribe card, delivery/address selects, quantity/checkbox controls, every outcome state) and `SubscriptionSetupReturnHandler.tsx` (all four setup-return banners) onto main-set and status-quartet tokens. The setup-return banners cover all four status tokens (info, warning, success, danger) by meaning; the Stripe setup host frame, previously a hardcoded light `bg-white`/`text-black` panel outside TOKEN-MAP's four scoped inverse surfaces, moved to `bg-surface-elevated`/`text-foreground` per this plan's own "no inverse-set token" constraint.
- Captured `chunk-3-engagement` (22/26 standard cells; 4 `order-status` MISSING, matching the pre-existing gap) and diffed every cell against `chunk-3-catalog`. All differing cells trace to S16 or carry forward S13/S14 unchanged. Added three supplementary cells beyond the standard grid: the reviews rating-summary card (Reviews tab opened) and the Subscribe section with its default plan selected, both captured and pixel-verified; the review-form validation-error cell recorded MISSING with reason (unreachable without an authenticated order in this local environment, the same class of gap as `order-status`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Sweep the review surfaces** - `0718c90` (feat)
2. **Task 2: Sweep the subscription acquisition surfaces** - `3b5a866` (feat)
3. **Task 3: Prove the product route still reads correctly** - `dcf9453` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/reviews/ProductReviewsSection.tsx` - cards, rating summary, distribution bars, highlight cards, and filter/sort selects rewritten to main-set tokens; positive/critical tone labels map to success/warning
- `components/reviews/ReviewForm.tsx` - existing-review status chip and validation/submission feedback rewritten to the status quartet; form inputs matched to the ui primitive focus vocabulary
- `components/reviews/StarRating.tsx` - filled/unfilled star colours rewritten to primary/muted-foreground
- `components/subscriptions/SubscriptionAcquisitionPanel.tsx` - Subscribe card, selects, controls, and every outcome state rewritten to main-set and status-quartet tokens; Stripe host frame moved to main-set tokens
- `components/subscriptions/SubscriptionSetupReturnHandler.tsx` - all four return-flow banners mapped onto the full status quartet by meaning
- `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` - `chunk-3-engagement` standard-grid section (26 rows) plus a supplementary-cells section (3 rows), new registered snap S16, and coverage notes explaining every differing cell

## Decisions Made

- StarRating.tsx's filled/unfilled colours ripple into every ProductCard star badge across the app; registered as new snap S16 after a full pixel-diff confirmed no other change.
- The rating-distribution bar's track and the review-list select's hover chip both map to `bg-border`/`hover:bg-border` rather than the generic `bg-surface-elevated` table entry, to avoid the track/chip becoming visually identical to its own parent surface.
- The Stripe setup host wrapper moves to main-set tokens (`bg-surface-elevated`/`text-foreground`), not inverse tokens, per this plan's own acceptance criteria; the Stripe iframe itself stays light independently via `StripeProvider.tsx`, which is untouched and out of scope here.
- No plan-card selection UI exists to give a selected-vs-unselected contrast (plan choice is a native `<select>`); T-05-07-01's mitigation is satisfied by the Subscribe section's own accent styling rather than inventing new card markup.
- `SubscriptionSetupReturnHandler.tsx`'s four banners map onto the full status quartet by meaning (info/warning/success/danger); interactive links inside every banner keep `text-primary` regardless of the banner's own status colour.
- The standard chunk-3-engagement grid was captured with subscription acquisition off (matching every prior chunk); the three supplementary cells were captured in a second, isolated dev-server run with the feature flag on and two synthetic local-only D1 `subscription_plans` rows, keeping the standard grid's diff clean.

## Deviations from Plan

None - plan executed exactly as written. All Task 1 and Task 2 acceptance criteria passed on the first verification pass; no Rule 1-3 bug fixes were required.

## Issues Encountered

- The first `chunk-3-engagement` standard-grid capture was run with the subscription-acquisition feature flag still enabled from the supplementary-cell setup, so the product route's `resting`/`nav-open` cells unexpectedly included the Subscribe panel -- a real content difference, not a shade consolidation, that would have confused the diff against `chunk-3-catalog` (captured with the flag off). Caught before finalizing the manifest by diffing hashes cell-by-cell; the contaminated section was removed and the standard grid was recaptured with a clean, flag-off dev-server run. No lasting effect; the corrected capture is what's recorded.

## User Setup Required

None - no external service configuration required. The two synthetic `subscription_plans` rows used for the supplementary screenshot capture live only in the local, gitignored `.wrangler/` D1 state and were not added to any tracked seed file.

## Next Phase Readiness

- The product route's two heaviest palette clusters (reviews, subscription acquisition) are scan-clean and speak only the frozen 23-token contract.
- New snap S16 is registered for any later chunk that captures a `ProductCard` star-rating badge or `StarRating` anywhere else in the tree -- those cells will legitimately continue to show the gold→orange, dark-grey→light-grey star shift for the reasons documented here.
- The review-form validation-error and subscription-panel-with-authenticated-session states remain unphotographed in this environment; whichever later chunk sweeps `/account/orders` (where `ReviewForm.tsx` actually renders) should seed a real local D1 delivered order and an authenticated Clerk session to close this gap, alongside the still-open `order-status` seed gap from 05-02.
- `lib/utils/image-placeholders.ts` and `lib/types/mach/Promotion.ts` remain untouched and on the manual-review registry.
- `components/checkout/StripeProvider.tsx` still carries its own hardcoded `appearance` config (D-11's Stripe/email chunk); this plan's Stripe host wrapper decision is consistent with, but does not substitute for, that future sweep.

---
*Phase: 05-token-contract-component-sweep*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: components/reviews/ProductReviewsSection.tsx
- FOUND: components/reviews/ReviewForm.tsx
- FOUND: components/reviews/StarRating.tsx
- FOUND: components/subscriptions/SubscriptionAcquisitionPanel.tsx
- FOUND: components/subscriptions/SubscriptionSetupReturnHandler.tsx
- FOUND: .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md
- FOUND commit: 0718c90
- FOUND commit: 3b5a866
- FOUND commit: dcf9453
