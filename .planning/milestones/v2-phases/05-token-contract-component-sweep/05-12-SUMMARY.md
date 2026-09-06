---
phase: 05-token-contract-component-sweep
plan: 12
subsystem: email
tags: [tailwind, tokens, transactional-email, inverse-tokens, whole-tree-scan, phase-close]

# Dependency graph
requires:
  - phase: 05-03
    provides: "getThemeTokens() in lib/themes/tokens.ts, the frozen 23-token contract, and the adopt-all decision on border-inverse=#374151 (with its known email-divider-darkening consequence)"
  - phase: 05-09
    provides: "the proven inverse token vocabulary (surface-inverse, surface-inverse-elevated, on-inverse, muted-on-inverse, border-inverse) and the corrected border-border-inverse Tailwind class precedent"
provides:
  - "All six transactional email builders (lib/utils/email.ts, lib/fulfillment/shipping-email.ts, lib/payments/refund-email.ts, lib/subscriptions/lifecycle-email.ts, lib/utils/review-notifications.ts, lib/email/footer.ts) sourcing every hex value from getThemeTokens() via the inverse mapping"
  - "A clean whole-tree scan:tokens result (0 violations, 2 manual-review rows) -- the phase's headline TOKEN-03 claim, made for the first time"
  - "The phase-close record in 05-SCREENSHOTS.md: email before/after comparison, D-20 coverage roll-up, ROADMAP criteria answered with evidence, and the S1-S11 snap observation register"
affects: []

# Actuals (#2632)
actuals:
  tokens: 16500
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Email builders resolve `const tokens = getThemeTokens();` once per HTML-building function and interpolate `${tokens.field}` directly into inline style attributes -- mail clients cannot read CSS custom properties, so hex must be baked in at send time (D-09/D-11), unlike every other sweep chunk which used Tailwind utility classes"
    - "Status-bearing email content (shipped/delivered=success, cancelled=danger, processing=info, refund/view-order accents=primary) maps by meaning onto the same status quartet used everywhere else in the sweep, consolidating multiple original shades (two greens, two oranges) onto one token value each -- a D-15 close-enough consolidation"
    - "Pre/post-sweep email render comparison: mock @/lib/email/sender and @/lib/store-config the same way this repo's own unit tests already do, call the real send*Email builders, capture the html argument passed to the mocked sendEmail, and SHA-256 it -- the only way to get genuine before/after evidence for a surface with no route and no Playwright-visitable URL"

key-files:
  created: []
  modified:
    - lib/utils/email.ts
    - lib/fulfillment/shipping-email.ts
    - lib/payments/refund-email.ts
    - lib/subscriptions/lifecycle-email.ts
    - lib/utils/review-notifications.ts
    - lib/email/footer.ts
    - .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md

key-decisions:
  - "Card/section email backgrounds (#ffffff, #f8fafc, #f1f5f9) map to surfaceInverseElevated (#f3f4f6, light grey) per TOKEN-MAP §3b's literal table, not to surfaceInverse -- this is a real, previously-unflagged visual change (pure white card becomes light grey) beyond the S10 divider darkening the plan called out in advance; documented explicitly in the phase-close record rather than passed through silently."
  - "Order-status-update's per-status colours (processing/shipped/delivered/cancelled/refunded) map onto the success/warning/danger/info/primary quartet by meaning, extending the plan's own §3b table (which only covers page/card/text/divider/brand/error roles) using the same semantic-first approach (D-15) the rest of the phase already established -- the two distinct greens (shipped #10b981, delivered #059669) consolidate onto one success shade."
  - "Refund/view-order accent oranges (#ea580c, #7c2d12, #c2410c) consolidate onto the single frozen primary value (#f97316) rather than inventing darker-primary variants -- no such token exists in the 23-token contract, and D-15 explicitly sanctions this kind of shade reduction."
  - "Genuine pre-sweep email renders were captured by extracting the pre-Task-1 file contents from git history (commit 15d3b69) into a throwaway, never-committed source snapshot and running them through the same sendEmail-mocking harness as the post-sweep capture -- the first capture attempt was silently corrupted when this plan's own full-suite `npm run test` verification runs re-executed the throwaway capture test and overwrote the pre-sweep directory with post-edit output (caught and fixed before Task 3 closed; see Deviations)."

requirements-completed: [TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04, TOKEN-05]

coverage:
  - id: D1
    description: "lib/utils/email.ts (85 of the phase's ~127 total hex occurrences) is token-sourced across all three templates (order confirmation, order status update, merchant notification); escaping calls and style attribute count verified identical before/after"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path lib/utils/email.ts -> 0 violations"
        status: pass
      - kind: other
        ref: "grep -c escapeHtmlText / style=\" identical before (32/101 lines) and after (32/101 lines)"
        status: pass
      - kind: unit
        ref: "mise exec -- npm run test -> 244 test files / 1882 tests (245/1888 with the throwaway capture test present, cleaned up before final run)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The five sibling builders (shipping-email.ts, refund-email.ts, lifecycle-email.ts, review-notifications.ts, footer.ts) share the same token vocabulary Task 1 established; footer.ts's muted-text field matches email.ts's exactly"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens --path lib/fulfillment && --path lib/payments && --path lib/subscriptions && --path lib/email && --path lib/utils -> 0 violations each"
        status: pass
      - kind: other
        ref: "per-file escaping-call count identical before/after (all five files); grep -c var( -> 0 in all five"
        status: pass
    human_judgment: false
  - id: D3
    description: "Whole-tree scan:tokens reports 0 violations with exactly 2 manual-review rows -- TOKEN-03's phase-wide claim; NEXT_PUBLIC_THEME_PRIMARY absent tree-wide; 23-token contract intact (17 runtimeColor calls, 0 hex in tailwind.config.ts; 23 --store- properties in themes/volt-dark.css)"
    requirement: "TOKEN-01, TOKEN-03, TOKEN-04"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -> [scan-tokens] 0 violations, 2 MANUAL-REVIEW rows"
        status: pass
      - kind: other
        ref: "grep -rn NEXT_PUBLIC_THEME_PRIMARY app components lib scripts tests docs -> 0 matches"
        status: pass
      - kind: other
        ref: "grep -c runtimeColor(\"--store- tailwind.config.ts == 17; grep -cE hex tailwind.config.ts == 0; grep -c --store- themes/volt-dark.css == 23"
        status: pass
      - kind: other
        ref: "mise exec -- npm run test && typecheck && lint && build -> all green (1882 tests, 0 type errors, 0 lint errors/52 pre-existing warnings, build exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Genuine before/after render comparison exists for all six email builders (rendered from the pre-sweep git commit vs. the swept tree, SHA-256 recorded each), with the S10 divider darkening and two newly-identified visual changes (card bg white->light-grey, footer text darkening) documented in 05-SCREENSHOTS.md's phase-close section"
    requirement: "TOKEN-05"
    verification:
      - kind: other
        ref: ".screenshots/emails/{pre-sweep,post-sweep}/*.html + *.sha256 (git-ignored, 8 templates each); hash pairs and colour-value diffs recorded in 05-SCREENSHOTS.md Part 1"
        status: pass
    human_judgment: true
    rationale: "The colour-value diff (every literal hex each template used, before vs. after) proves what changed at the token level, but this session had no browser automation available to actually render the HTML visually. The plan's own <human-check> -- opening the pre/post order-confirmation and shipping-confirmation HTML side by side in a browser -- remains open per workflow.human_verify_mode=end-of-phase; the files are ready at .screenshots/emails/{pre-sweep,post-sweep}/*.html for that visual pass."
  - id: D5
    description: "05-SCREENSHOTS.md's phase-close section covers all four parts the task required: email before/after table, D-20 coverage roll-up naming a chunk for every covered route and a reason for every gap, the four ROADMAP success criteria each answered with command evidence, and an honest S1-S11 snap register (8 of 11 directly evidenced; S3/S7/S11 stated as gaps, not claimed)"
    requirement: "TOKEN-05"
    verification:
      - kind: other
        ref: ".planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md \"## Phase-close record (05-12)\" section, all four subsections present"
        status: pass
    human_judgment: false

# Metrics
duration: 95min
completed: 2026-09-04
status: complete
---

# Phase 5 Plan 12: Transactional Email Sweep and Phase Close Summary

**All six transactional email builders now source their colours from `getThemeTokens()` via the inverse mapping, and the whole-tree `scan:tokens` run reports 0 violations for the first time in the phase.**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-09-04T18:00:00Z (approx.)
- **Completed:** 2026-09-04T19:35:00Z (approx.)
- **Tasks:** 3 completed
- **Files modified:** 7 (6 email builders + `05-SCREENSHOTS.md`)

## Accomplishments

- Swept `lib/utils/email.ts` (85 of the phase's roughly 127 total hex occurrences, more than any other file in the repository): order confirmation, order status update, and merchant notification templates all resolve `getThemeTokens()` once per function and interpolate the inverse-mapped fields directly into inline `style` attributes. Status colours (processing/shipped/delivered/cancelled/refunded) map onto the success/warning/danger/info/primary quartet by meaning, consolidating two distinct greens onto one `success` shade.
- Swept the five sibling builders (`shipping-email.ts`, `refund-email.ts`, `lifecycle-email.ts`, `review-notifications.ts`, `footer.ts`) onto the same token vocabulary, so every email this store sends shares one look; `footer.ts`'s muted-text field matches `email.ts`'s exactly, satisfying the shared-footer acceptance criterion.
- Captured genuine before/after renders for all six builders (eight templates including the shared footer partial) by mocking `@/lib/email/sender` and `@/lib/store-config` the same way this repo's own unit tests already do, calling the real `send*Email` functions, and SHA-256-hashing the captured HTML — once from the pre-sweep git commit, once from the swept tree.
- Ran the whole-tree `scan:tokens` with no path scope for the first time in the phase: **0 violations, exactly 2 manual-review rows** — TOKEN-03's headline claim.
- Wrote the phase-close section into `05-SCREENSHOTS.md`: the email before/after table (including two visual changes beyond the S10 divider darkening the plan flagged in advance — card backgrounds shift from pure white to light grey, and footer text darkens), a D-20 coverage roll-up naming which chunk covers every route and stating the reason for every gap, the four ROADMAP Phase 5 success criteria each answered with command evidence, and an honest S1–S11 snap observation register (8 of 11 snaps directly evidenced by a capture or live render; S3, S7, and S11 recorded as genuine gaps rather than claimed coverage).
- Confirmed `NEXT_PUBLIC_THEME_PRIMARY` absent tree-wide and the 23-token contract intact (17 `runtimeColor()` calls / 0 hex in `tailwind.config.ts`; 23 `--store-` properties in one block in `themes/volt-dark.css`) after all nine sweep chunks.
- `mise exec -- npm run test && npm run typecheck && npm run lint && npm run build` all green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture the pre-sweep email renders, then sweep the largest builder** - `b19f8a8` (feat)
2. **Task 2: Sweep the five sibling email builders** - `27ca4d1` (feat)
3. **Task 3: Close the phase — whole-tree scan, email review, and the coverage record** - `29f4759` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `lib/utils/email.ts` - order confirmation, order status update, and merchant notification templates rewritten to `getThemeTokens()`
- `lib/fulfillment/shipping-email.ts` - shipping confirmation template rewritten (largest of the five siblings, 21 hex occurrences)
- `lib/payments/refund-email.ts` - refund-settled template rewritten
- `lib/subscriptions/lifecycle-email.ts` - lifecycle notification template rewritten
- `lib/utils/review-notifications.ts` - review status/reminder templates rewritten
- `lib/email/footer.ts` - postal footer and unsubscribe footer partials rewritten (shared by all six builders)
- `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` - phase-close section (email comparison, coverage roll-up, criteria evidence, snap register)

## Decisions Made

- Card/section backgrounds (`#ffffff`, `#f8fafc`, `#f1f5f9`) map to `surfaceInverseElevated` (`#f3f4f6`) per the plan's own §3b table — a real visual shift (white card becomes light grey) not previously flagged as its own snap, documented explicitly rather than passed through silently.
- Order-status-update's per-status colours map onto the success/warning/danger/info/primary quartet by meaning, extending §3b's literal table using the same semantic-first approach (D-15) the rest of the phase established.
- Refund/view-order accent oranges consolidate onto the single frozen `primary` value rather than inventing darker-primary variants.
- Pre-sweep email renders were captured from git history (commit `15d3b69`, the state immediately before this plan's Task 1) via a throwaway source snapshot, after the first capture attempt was silently corrupted by this plan's own full-suite test runs (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Throwaway pre-sweep email capture test got re-executed and overwritten by full-suite verification runs**
- **Found during:** Task 3, when comparing "pre-sweep" and "post-sweep" SHA-256 hashes and finding them identical for every template
- **Issue:** The throwaway capture test file (`tests/unit/_tmp-email-capture.test.ts`) matched vitest's `include` glob (`tests/unit/**/*.test.ts`). Running the full test suite after Task 1 and again after Task 2 (as part of each task's own verification) re-executed that file with its default `EMAIL_CAPTURE_MODE` (`pre-sweep`), overwriting the genuine pre-sweep captures with output from the already-partially-swept working tree. The corruption was silent — no test failed — because the capture test's own assertions only check that `sendEmail` was called, not which code version produced the HTML.
- **Fix:** Extracted the true pre-sweep file contents for all six builders from git history (commit `15d3b69`, the last commit before this plan's Task 1) into a throwaway, never-committed source snapshot under `.screenshots/emails/_pre-src/` (rewriting each file's cross-imports of `@/lib/email/footer` and shipping-email's relative `./carrier-config`/`./service`/`./shipment-view`/`./types` imports to resolve correctly from the snapshot location), then ran a second throwaway capture test importing from that snapshot instead of the working tree. Regenerated all eight pre-sweep hashes; confirmed every one now differs from the corresponding post-sweep hash with a defensible colour-value diff.
- **Files modified:** None (both throwaway test files and the source snapshot were deleted before Task 3's commit; never staged)
- **Verification:** All eight pre/post hash pairs now differ; a targeted hex-literal diff per template shows exactly the expected token substitutions (page/card/text/divider/status colours), matching the plan's own §3b mapping and the S10 divider-darkening prediction.
- **Committed in:** N/A — the fix is entirely in the throwaway capture harness, never committed; the *result* (correct hashes) is recorded in `05-SCREENSHOTS.md`'s phase-close section, committed in `29f4759`.

---

**Total deviations:** 1 auto-fixed (1 Rule 1 — bug, in this plan's own throwaway verification tooling, not in shipped code). **Impact:** No shipped file was affected; the bug was in a never-committed test harness and was caught before Task 3 closed out, by cross-checking the "pre-sweep" hashes against what a first capture run had actually printed at Task 1 time. No scope creep.

## Issues Encountered

- The plan's `<human-check>` for Task 3 ("Open the pre-sweep and post-sweep order-confirmation and shipping-notification HTML side by side in a browser") could not be executed directly — no browser automation was available in this session. Substituted with a full literal colour-value diff of every template (every hex the pre- and post-sweep HTML actually contains), which proves the *values* changed exactly as directed but not that a mail client renders them as intended. The rendered `.html` files are ready at `.screenshots/emails/{pre-sweep,post-sweep}/*.html` for the deferred visual pass, consistent with `workflow.human_verify_mode=end-of-phase`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 5 is code-complete: all nine sweep chunks land, `scan:tokens` is clean tree-wide, the 23-token contract is intact, `NEXT_PUBLIC_THEME_PRIMARY` is gone, and every storefront surface (including transactional email) sources its colours from one contract.
- The border-inverse darkening (S10) is real and visible in the emails, exactly as 05-03's adopt-all decision predicted; a human should look at the rendered HTML files noted above and decide whether it reads acceptably, or whether it becomes a Phase 6 contract-value change.
- The two newly-identified email visual changes (card background white→light-grey, footer text darkening) are D-15-sanctioned shade consolidations, not regressions, but are new information for whoever does the human visual pass — they were not called out in this plan's own `<interfaces>` block in advance.
- `order-status`, the review-form validation-error state, and the checkout payment step remain uncaptured for the entire phase (environment limits: no seeded local order, no authenticated session, and a pricing-API 400 upstream of every file this phase touches) — all three have documented substitute evidence (code reads plus scoped `scan:tokens` passes) in the phase-close coverage roll-up, carried forward as open items for whoever next touches those surfaces.
- Phase 6 (theme validator, manifest, `getActiveTheme()`, second preset) can now build on a fully swept, contract-clean storefront.

---
*Phase: 05-token-contract-component-sweep*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: lib/utils/email.ts
- FOUND: lib/fulfillment/shipping-email.ts
- FOUND: lib/payments/refund-email.ts
- FOUND: lib/subscriptions/lifecycle-email.ts
- FOUND: lib/utils/review-notifications.ts
- FOUND: lib/email/footer.ts
- FOUND: .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md
- FOUND commit: b19f8a8
- FOUND commit: 27ca4d1
- FOUND commit: 29f4759
