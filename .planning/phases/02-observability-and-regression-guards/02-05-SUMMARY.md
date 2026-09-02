---
phase: 02-observability-and-regression-guards
plan: 05
subsystem: testing
tags: [lighthouse, mobile-performance, baseline, docs]

requires: []
provides:
  - "docs/mobile-lighthouse-baseline.md — a mobile Lighthouse baseline for home, category, product, and checkout, median of three runs each, judged against the PRD's target of 85"
affects: []

actuals:
  tokens: 1400
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Point-in-time production Lighthouse measurement via transient npx invocation, no CI wiring, scratch-directory JSON never committed"

key-files:
  created:
    - docs/mobile-lighthouse-baseline.md
  modified: []

key-decisions:
  - "Category and product slugs (featured, vivid-mission-pack) were taken from the live sitemap's document order as specified, but the actual Lighthouse measurement targeted the real production host (voltique.russellkmoore.me) rather than the sitemap's misconfigured mercora.example.com domain, since measuring the wrong host would not describe the live storefront — documented explicitly in the baseline doc rather than silently substituted"
  - "Checkout measured as an empty-cart page (HTTP 200, no redirect observed) since a fresh Lighthouse session carries no cart state; the doc records that the reported figures describe that empty-cart page"

patterns-established: []

requirements-completed: [MOB-01]

coverage:
  - id: D1
    description: "Mobile Lighthouse baseline recorded for home, category, product, and checkout with median-of-three scores and pass/fail against the PRD target of 85"
    requirement: "MOB-01"
    verification:
      - kind: other
        ref: "grep -c '^| /' docs/mobile-lighthouse-baseline.md == 4"
        status: pass
      - kind: other
        ref: "grep -ciE '\\| *(pass|fail) *\\|?$' docs/mobile-lighthouse-baseline.md >= 4"
        status: pass
      - kind: other
        ref: "git status --porcelain docs (no .json artifact added)"
        status: pass
      - kind: other
        ref: "npm run lint (exit 0, pre-existing warnings only, no new errors)"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-09-02
status: complete
---

# Phase 2 Plan 5: Mobile Lighthouse Baseline Summary

**Live-site mobile Lighthouse baseline for four routes shows every one failing the PRD's target of 85 — home/category/checkout in the low-to-mid 70s, product highest at 80 — recorded as median-of-three in `docs/mobile-lighthouse-baseline.md`.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-02T19:06:00Z (approx)
- **Completed:** 2026-09-02T19:28:17Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Discovered the first active category (`featured`) and product (`vivid-mission-pack`) slugs from a single fetch of the live sitemap, in document order.
- Ran Lighthouse 13.4.1 via `npx` (mobile form factor, default mobile throttling, performance category only, headless) three times each against `/`, `/category/featured`, `/product/vivid-mission-pack`, and `/checkout` on the live production host — twelve runs total, zero crawling beyond the four named URLs.
- Computed the median of three runs independently for performance score, LCP, CLS, and TBT per route, and published the raw three-value spread per route so no single anomalous run could set the baseline.
- Wrote `docs/mobile-lighthouse-baseline.md`: method, per-route results table with pass/fail against the PRD target of 85 (all four fail; 90 stretch named), run-spread section, and a Notes section covering the checkout empty-cart observation and a discovered sitemap domain mismatch.
- Left all twelve raw JSON reports in a scratch directory outside the repository; committed no JSON.

## Task Commits

1. **Task 1: Discover the four URLs and measure each three times** - no commit (scratch-only measurement task; verified zero repository files touched)
2. **Task 2: Write the baseline document** - `daceb9d` (docs)

**Plan metadata:** commit follows this SUMMARY.

## Files Created/Modified
- `docs/mobile-lighthouse-baseline.md` - New mobile Lighthouse baseline: method, per-route results (Performance/LCP/CLS/TBT/Result), run spread, notes, and follow-on pointers to Phase 4 REF-04 and `REQ-mobile-test-automation`

## Decisions Made
- Sitemap-discovered slugs (`featured`, `vivid-mission-pack`) were re-based onto the real production host for measurement, since the live sitemap's `<loc>` values render under a misconfigured `https://mercora.example.com` default from `lib/store-config.ts:103` rather than the actual `voltique.russellkmoore.me` host. This is documented explicitly in the baseline doc rather than silently worked around; no source file was touched to fix it (out of this plan's scope).
- Checkout was measured as served (HTTP 200, no redirect) with an empty cart, since a fresh Lighthouse session has no cart state and pre-populating one was out of scope; the doc states plainly that the checkout figures describe that empty-cart page.

## Deviations from Plan

None - plan executed exactly as written. The sitemap domain mismatch is a pre-existing finding documented in the output, not a deviation in what this plan built (it made no source change either way).

## Issues Encountered
- An early attempt to run the twelve Lighthouse invocations from inside a zsh shell function inside a `for` loop failed with a spurious `no such file or directory` trace on the log-redirect target, despite the directory existing. Worked around by running each `npx lighthouse` invocation as a direct, non-function command with explicit stdout/stderr redirection — all twelve subsequent runs succeeded on the first attempt with this form.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MOB-01 is closed: a reproducible, medianed, live mobile baseline now exists in `docs/`.
- Phase 4 REF-04 can tick the measurement checkboxes in `docs/mobile-improvements-actionable.md` using this baseline without re-measuring.
- Flagging for awareness (not a requirement of this phase): the live sitemap's domain mismatch (`mercora.example.com` instead of `voltique.russellkmoore.me`, sourced from `lib/store-config.ts:103`) affects any SEO/crawler consumer of `/sitemap.xml`, not just this measurement. Worth a look whenever `lib/store-config.ts` or `NEXT_PUBLIC_SITE_URL` is next touched.
- No blockers.

## Self-Check: PASSED

- `docs/mobile-lighthouse-baseline.md` FOUND
- Commit `daceb9d` FOUND in `git log --oneline --all`
- All plan-level `<verification>` commands re-run and passing: row count = 4, required terms present (Lighthouse/Chrome/median/sitemap/checkout/85/90), 4 verdict cells present, no `.json` under `docs/`, `docs/mobile-improvements-actionable.md` untouched, `npm run lint` exit 0.

---
*Phase: 02-observability-and-regression-guards*
*Completed: 2026-09-02*
