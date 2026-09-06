---
phase: 05-token-contract-component-sweep
plan: 02
subsystem: testing
tags: [playwright, screenshot, visual-regression, tooling]

# Dependency graph
requires:
  - phase: 05-01
    provides: "scan:tokens gate and the whole-tree scan conventions this plan's script mirrors (ABORT/exit-code shape)"
provides:
  - "scripts/screenshot-routes.mjs — deterministic multi-viewport, multi-state Playwright capture harness reused by every later 05-* chunk and by Phase 8"
  - "screenshot:routes npm script"
  - "05-SCREENSHOTS.md baseline label — the fixed pre-sweep comparison target for D-21"
affects: [05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-10, 05-11, 05-12]

# Actuals (#2632)
actuals:
  tokens: 5550
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: ["playwright@1.62.1", "@playwright/test@1.62.1"]
  patterns:
    - "Zero-dependency node: script convention (shebang, try/catch, [tag] ABORT: message, exit 1) reused from scripts/build-with-public-env.mjs"
    - "Coverage-grid + dedupe-by-(url,viewport,state) pattern for deterministic screenshot naming"

key-files:
  created:
    - scripts/screenshot-routes.mjs
    - .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md
  modified:
    - package.json
    - package-lock.json
    - .gitignore

key-decisions:
  - "The only two interactive-state selectors the coverage grid needs are the header nav trigger (desktop 'Categories' dropdown / mobile hamburger sheet) and the cart trigger — every non-cart route's 'open' state opens the nav, matching the read_first hint that named only HeaderClient and CartDrawer selectors"
  - "The cart cell only has a cart-open state (no separate resting state) since its resting state is identical to the home cell's resting state at the same viewport — this keeps the coverage grid at exactly 26 cells (6 routes x 2 viewports x 2 states + cart x 2 viewports x 1 state) with no accidental dedup surprises"
  - "Sitemap-resolved product/category paths are re-resolved against --base-url rather than used as absolute sitemap URLs verbatim, because the sitemap emits URLs from the store's configured site URL (currently an unfilled mercora.example.com placeholder), not necessarily the capture target"
  - "Seeded one category + one product + one variant directly into local D1 (ephemeral runtime state, not a repo file) rather than fixing the broken data/d1/seed.sql bulk insert (a pre-existing, out-of-scope bug — one product row is missing its options column value, corrupting the whole batch's VALUES arity) or editing the untouched predev seed path"

patterns-established:
  - "Coverage-grid builder (route -> {url, states}) with a dedupe map keyed on resolved (url, viewport, state), reusable by any future multi-route capture tool"

requirements-completed: [TOKEN-05]

coverage:
  - id: D1
    description: "Playwright and @playwright/test installed as devDependencies (1.62.1, human-verified at the Task 1 checkpoint); scripts/screenshot-routes.mjs built with deterministic <route>__<viewport>__<state>.png naming, a remote-URL guard requiring --allow-remote, and MISSING-row discipline; screenshot:routes npm script registered; .screenshots/ git-ignored"
    requirement: "TOKEN-05"
    verification:
      - kind: other
        ref: "mise exec -- node -e \"require('./package.json').devDependencies...\" (playwright + @playwright/test + screenshot:routes present)"
        status: pass
      - kind: other
        ref: "git check-ignore -q .screenshots"
        status: pass
      - kind: other
        ref: "mise exec -- node scripts/screenshot-routes.mjs --base-url https://voltique.russellkmoore.me --label probe; test $? -ne 0"
        status: pass
      - kind: other
        ref: "mise exec -- npm run lint (0 errors, exit 0)"
        status: pass
      - kind: other
        ref: "two full capture runs against an unchanged local site produced byte-identical PNG paths and SHA-256 hashes across all 22 captured cells"
        status: pass
    human_judgment: false
  - id: D2
    description: "The single pre-sweep baseline exists on disk under .screenshots/baseline/, and 05-SCREENSHOTS.md records every §8 coverage cell as either captured-with-hash or explicit MISSING, plus the S1-S11 intentional-snap register"
    requirement: "TOKEN-05"
    verification:
      - kind: other
        ref: "find .screenshots/baseline -name '*.png' | wc -l -> 22 (>= 12 required)"
        status: pass
      - kind: other
        ref: "grep -c '^| S[0-9]' 05-SCREENSHOTS.md -> 11"
        status: pass
      - kind: other
        ref: "git status --porcelain | grep '\\.screenshots.*\\.png$' -> 0 matches"
        status: pass
      - kind: manual_procedural
        ref: "visual read of home__1280__resting.png, product__390__resting.png, home__1280__nav-open.png, category__390__resting.png"
        status: pass
    human_judgment: true
    rationale: "I spot-checked 4 of the 22 captured baseline images and confirmed fully rendered storefront pages (not blank/loading/error states), satisfying the task's <human-check> item. A human should still skim the remaining images once before treating this baseline as authoritative, since a script-driven spot check is not the same as a deliberate visual QA pass."
---

# Phase 5 Plan 2: Screenshot Harness and Pre-Sweep Baseline Summary

**Playwright-based `screenshot:routes` capture harness with deterministic naming and a remote-URL guard, plus the one pre-sweep baseline (22 captures across 6 routes x 2 viewports x 2 states, order-status deferred) that every later 05-* chunk diffs against for D-21.**

## Performance

- **Duration:** ~55 min (continuation session; includes root-causing a stale Next.js incremental-cache issue unrelated to the script itself)
- **Tasks:** 2 completed this session (Task 1's checkpoint was resolved by the user before this continuation)
- **Files modified:** 5 (1 script, 1 manifest, package.json, package-lock.json, .gitignore)

## Accomplishments

- Installed `playwright` and `@playwright/test` 1.62.1 (human-verified at the Task 1 checkpoint) plus the chromium browser binary.
- Built `scripts/screenshot-routes.mjs`: resolves dynamic product/category slugs from the store's own `/sitemap.xml`, builds a coverage grid from `05-TOKEN-MAP.md` §8, captures at 1280x900 and 390x844 with a `resting` state plus one `open` interactive state (header nav for 6 routes, cart drawer for the cart cell), computes a SHA-256 per PNG, and appends a coverage table to a manifest. Refuses any non-localhost `--base-url` without `--allow-remote`. Exits non-zero on any MISSING cell unless `--allow-missing`.
- Registered `screenshot:routes` npm script and git-ignored `.screenshots/`.
- Captured the `baseline` label: 22 of 26 coverage cells captured, the remaining 4 (`order-status` x 2 viewports x 2 states) recorded as MISSING because the local D1 dev seed provides no orders — exactly the scenario `05-TOKEN-MAP.md` §8 anticipated.
- Seeded `05-SCREENSHOTS.md` with the phase-record header, the S1-S11 intentional-snap register transcribed verbatim from `05-TOKEN-MAP.md` §4, and coverage notes explaining the order-status defer and the (expected, by-design) visual identity of the 390px nav-open state across routes.
- Proved determinism: two full capture runs against an unchanged local site produced byte-identical file paths and SHA-256 hashes.

## Task Commits

Each task was committed atomically:

1. **Task 2: Install Playwright and build the route capture script** - `a74bc50` (feat)
2. **Deviation fix: resolve sitemap slugs against --base-url** - `ff151dc` (fix) — discovered while executing Task 3
3. **Task 3: Capture the pre-sweep baseline and seed the manifest** - `a85c839` (feat)

**Plan metadata:** (this commit)

_Task 1 (the package-legitimacy checkpoint) was resolved by the user in a prior session with no code changes — see the orchestrator-verified registry facts in this session's continuation prompt._

## Files Created/Modified

- `scripts/screenshot-routes.mjs` - Playwright capture harness: coverage-grid builder, dedupe-by-(url,viewport,state), remote-URL guard, SHA-256 hashing, manifest append
- `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` - phase screenshot record: header, S1-S11 intentional snaps, coverage notes, `baseline` label table (26 rows: 22 captured + 4 MISSING)
- `package.json` - adds `playwright`, `@playwright/test` devDependencies and the `screenshot:routes` script
- `package-lock.json` - lockfile update for the two new devDependencies
- `.gitignore` - adds `/.screenshots` (root-anchored, no trailing slash so `git check-ignore` matches before the directory exists)

## Decisions Made

- The coverage grid's "open" state for every non-cart route is the header nav (desktop dropdown / mobile sheet), not a per-page interactive element — this matches the plan's own `<read_first>` hint (only `HeaderClient.tsx` and `CartDrawer.tsx` selectors were named) and keeps the script to exactly two interactive-state selectors.
- The cart cell contributes only a `cart-open` state (its `resting` state would be byte-identical to the `home` cell's `resting` state at the same viewport), keeping the total coverage grid at 26 cells with no incidental dedup.
- Sitemap-resolved paths are re-joined against `--base-url` rather than used as the sitemap's own absolute URLs, because the sitemap emits URLs from the store's configured (currently placeholder) site URL — this is the harness's primary use case (local dev capture), so the bug would have made the tool unusable for its main purpose.
- A minimal category + product + variant row was inserted directly into the local D1 dev database (ephemeral runtime state, never a repo file) rather than debugging or fixing `data/d1/seed.sql`'s pre-existing broken bulk insert — the local dev seed genuinely does not provide catalog data by default, contrary to the plan's `<interfaces>` assumption, and fixing an unrelated seed-data file is out of this task's scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Local D1 dev seed does not provide products/categories, contradicting the plan's interfaces assumption**
- **Found during:** Task 3
- **Issue:** The plan's `<interfaces>` block states "The seed provides products and categories," but `data/d1/seed-dev.sql` (applied by `predev`) only seeds MCP agent-permission data. Product/category data lives in `data/d1/seed.sql`, which is documented (README.md) as a separate, manually-applied step — and that file's bulk INSERT for `products` is itself broken (one row is missing its `options` column value, shifting every subsequent value and causing `SQLITE_ERROR: all VALUES must have the same number of terms`, consistent with `docs/CLAUDE.md`'s existing note that this file has "partially fixed JSON formatting").
- **Fix:** Inserted one valid category (`cat_1`), one product (`prod_1`), and one variant (`variant_1`) directly into the local D1 sqlite file via `wrangler d1 execute --local`, using rows copied verbatim from the valid part of `data/d1/seed.sql`. This is local runtime state only — no repository file was changed, and `data/d1/seed.sql`'s existing bug was left untouched as out of scope.
- **Files modified:** none (local D1 runtime state only)
- **Verification:** `/sitemap.xml` resolved both a product and a category path; both pages returned HTTP 200 with real rendered content (confirmed visually).
- **Committed in:** n/a (no repo file changed)

**2. [Rule 1 - Bug] Sitemap slug resolution used the sitemap's absolute host, not --base-url**
- **Found during:** Task 3 (baseline capture aborted with `net::ERR_NAME_NOT_RESOLVED`)
- **Issue:** `app/sitemap.ts` emits absolute URLs built from `getStoreConfig().urls.site`, which is currently the unfilled `mercora.example.com` placeholder in this environment (a known, separately-tracked operator follow-up). The script used those absolute URLs verbatim, so local-dev captures tried to resolve a DNS name that doesn't exist.
- **Fix:** Re-resolve only the *path* portion of each sitemap `<loc>` against `--base-url`.
- **Files modified:** `scripts/screenshot-routes.mjs`
- **Verification:** Category and product cells captured successfully against `http://localhost:3000` after the fix.
- **Committed in:** `ff151dc`

**3. [Rule 1 - Bug] Two CartTrigger instances (desktop + mobile nav blocks) collided on the cart-open selector**
- **Found during:** Task 2 acceptance-criteria verification (determinism probe)
- **Issue:** `button[aria-label^="Cart ("]` matched both the desktop and mobile header's `CartTrigger`, and Playwright's `page.click` picked the DOM-first match regardless of which one was actually visible at the current viewport, timing out when that match was `display: none`.
- **Fix:** Scoped both the cart trigger and nav trigger selectors with Playwright's `:visible` pseudo-class.
- **Files modified:** `scripts/screenshot-routes.mjs`
- **Verification:** Both viewports' cart-open and nav-open states captured successfully in the determinism probe and the final baseline run.
- **Committed in:** `a74bc50` (fixed before the Task 2 commit; not a separate follow-up commit)

**4. [Rule 1 - Bug, investigative only] Stale Next.js incremental cache masked the header nav's category list**
- **Found during:** Task 3 baseline capture (nav-open screenshots showed an empty dropdown)
- **Issue:** `components/Header.tsx` wraps its category fetch in `unstable_cache` (`revalidate: 3600`). The dev server's first-ever request (before any catalog fixture existed) cached an empty category list, and that cache persisted across `next dev` process restarts and `.wrangler/state/v3/{cache,r2}` deletions — root cause was a stale `.next` build directory, not the Cache/R2 simulation. A full `rm -rf .next` plus restart resolved it.
- **Fix:** No code change — this is expected `next dev` caching behavior, not a bug in this plan's deliverables. Documented here so a future chunk plan doesn't re-lose time on the same investigation.
- **Files modified:** none (temporary diagnostic edits to `components/Header.tsx` were made and fully reverted via `git checkout --`)
- **Verification:** `git diff components/Header.tsx` confirms no residual changes; `home__1280__nav-open.png` shows the "Featured" category item rendered.
- **Committed in:** n/a (no change to commit)

---

**Total deviations:** 4 (2 blocking-issue/bug fixes committed to the script, 1 local-only D1 fixture with no committed file, 1 investigative dead-end with no code change). **Impact:** All were necessary to produce a real (non-empty, non-blank) baseline; no scope creep beyond the plan's own `<files>` list.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required. The Playwright package-legitimacy checkpoint (Task 1) was already resolved by the user before this continuation.

## Next Phase Readiness

- `scripts/screenshot-routes.mjs` and the `baseline` label are ready for every later 05-* chunk plan to diff against.
- `order-status` coverage is deferred: whichever later plan sweeps the order-status route should either seed a real local D1 order before running its own capture, or explicitly re-run the baseline's `order-status` cells with `--order-id` once an order exists, so that route gets genuine before/after coverage instead of two permanent MISSING pairs.
- The category/product fixture row (`cat_1`/`prod_1`/`variant_1`) inserted into local D1 for this capture is ephemeral dev-machine state, not a repo artifact — any developer running `screenshot:routes` locally for the first time will hit the same empty-sitemap MISSING result for `category`/`product` unless they seed similar data (via `data/d1/seed.sql`, once its pre-existing bulk-insert bug is fixed, or via an equivalent local insert). This is a pre-existing gap in local dev tooling, not something this plan's scope covers.
- `data/d1/seed.sql`'s broken `products` bulk INSERT (missing `options` value on one row) is a real, separately-actionable bug — out of scope here, but worth a follow-up ticket since it currently blocks the documented "load sample data" README step entirely.

---
*Phase: 05-token-contract-component-sweep*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: scripts/screenshot-routes.mjs
- FOUND: .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md
- FOUND commit: a74bc50
- FOUND commit: ff151dc
- FOUND commit: a85c839
