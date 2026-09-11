---
phase: 16-blog-surfacing
plan: 04
subsystem: admin-settings
tags: [blog, admin-settings, content-tab, cloudflare-workers-builds, vitest]

# Dependency graph
requires:
  - phase: 16-blog-surfacing (plans 01-03)
    provides: "getContentSettings()/CONTENT_SETTING_KEYS/CONTENT_SETTING_DEFAULTS (01), the header nav gate (02), and the home-page block (03) — this plan is the admin control surface for all of it"
provides:
  - "Content tab in app/admin/settings/page.tsx — the only place an admin edits the five content.* values"
  - "Deployed, live-verified phase 16: header nav, home block and the admin Content tab are all in production"
affects: []

actuals:
  tokens: 6181
  tasks: 3
  commits: 3
  plan_head_before: 0c00f1a

tech-stack:
  added: []
  patterns:
    - "Per-tab settings form: interface + useState(seeded from the shared *_DEFAULTS constant) + a loadSettings forEach branch + a handleSave updates-array group + a tabs-array entry + a JSX block — the Promotions tab's own shape, repeated exactly for Content"
    - "Form bounds/enum options imported from the server-resolver module (lib/content/settings.ts) rather than retyped, with human labels for an enum kept as a position-indexed array so no enum literal is retyped in JSX either"

key-files:
  created:
    - tests/unit/app/api/admin-settings-content-category.test.ts
    - tests/unit/app/admin-settings-content-tab-source.test.ts
  modified:
    - app/admin/settings/page.tsx
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Content tab inserted into the tabs array and its JSX block immediately after Promotions and before Social — matches the order the plan's own <action> describes for the JSX block, and keeps the array/JSX ordering consistent with each other."
  - "The placement <select>'s human labels are a position-indexed array (BLOG_HOME_BLOCK_PLACEMENT_LABELS), not a literal-keyed lookup — avoids retyping 'before_featured'/'after_featured' anywhere in the file, which the plan's own acceptance-criteria grep checks for."
  - "Importing lib/content/settings.ts's five interface_context constants directly into this 'use client' page built and typechecked cleanly — no server-only-import client-boundary failure occurred, so the constants were not split into a separate module."
  - "The generic settings route's per-update write loop takes the insert branch (not update) for a first-time save into a freshly-seeded table; Task 2's write-path test asserts against insert() rather than update() to match that real branch."

requirements-completed: [BLOG-01, BLOG-02]

coverage:
  - id: D1
    description: "An admin opens a Content tab, edits blogNavLabel/blogHomeBlockEnabled/Heading/Count/Placement, and Save sends all five keys through the same POST /api/admin/settings batch as every other category"
    requirement: "BLOG-02"
    verification:
      - kind: unit
        ref: "tests/unit/app/admin-settings-content-tab-source.test.ts#Content tab in app/admin/settings/page.tsx — save-batch contract"
        status: pass
    human_judgment: true
    rationale: "No browser-render test exists for this client component (no jsdom/@testing-library in this project's test dependencies) — what's pinned here is the save-batch's source shape, not a click-through. Clicking the tab in a real browser with a Clerk admin session has not been done; named explicitly for Russell below, matching the standing pattern since Phase 15."
  - id: D2
    description: "The content.* write path is reachable only through the admin-gated settings endpoint, is not refused by the honor guard on its own, and a batch mixing content.* with the honor-guard key is refused whole with nothing written"
    verification:
      - kind: unit
        ref: "tests/unit/app/api/admin-settings-content-category.test.ts#POST /api/admin/settings — content.* write path (T-16-31, T-16-32)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The full ten-command CI-mirroring gate passes, the phase is deployed via git push, and the live storefront's header/home-block blog surfacing matches production's actual article count (zero, both before and after)"
    requirement: "BLOG-01"
    verification:
      - kind: other
        ref: "npm audit / build:themes:check / scan:tokens / lint / typecheck / cf-typecheck / test / test:workers / test:observability-worker / build — all exit 0 (commands and output recorded below)"
        status: pass
      - kind: other
        ref: "curl https://voltique.russellkmoore.me/ and /blog, before and after the push — observed counts recorded below"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-09-11
status: complete
---

# Phase 16 Plan 4: Content Admin Tab & Phase Deploy Summary

**A Content tab in the admin settings page edits all five `content.*` blog-surfacing settings through the existing generic save endpoint; the full CI gate is green and the phase is live at voltique.russellkmoore.me, correctly showing no blog nav/home block because production has zero published articles.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-11T08:48:00Z
- **Completed:** 2026-09-11T09:14:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `app/admin/settings/page.tsx` gained a Content tab, following the Promotions tab's exact six-place shape: imports, a `ContentSettingsForm` interface, `contentSettings` state seeded from `CONTENT_SETTING_DEFAULTS`, a `loadSettings` branch, five entries appended to `handleSave`'s `updates` array, a `tabs`-array entry, and a JSX block with two cards ("Blog Navigation", "Home Page Articles") using the admin dashboard's own fixed palette.
- The tab's count bounds, label/heading length caps, and placement options are all imported from `lib/content/settings.ts` rather than retyped — a grep for the literal bounds/enum strings returns `0`, pinned by an automated test.
- Two new test suites (12 cases) pin the write path's access control (admin-gated, not a way around the gift-card honor guard) and the admin page's save-batch contract (every pre-existing category's exact key count, exactly one Content tab guard, the shared-constant imports) — neither existing settings-route test file was edited.
- The full ten-command CI-mirroring gate passed; the phase (16-01 through 16-04, 22 commits) was pushed to `main` and deployed by Cloudflare Workers Builds; the live storefront was checked before and after the deploy and its behavior matches production's actual state (zero published blog posts).

## Task Commits

Each task was committed atomically:

1. **Task 1: The Content tab** - `541fcba` (feat)
2. **Task 2: Pin the content settings write path and the tab contract** - `d65832b` (test)

**Plan metadata:** this SUMMARY's own commit (docs).

_Task 2 carried `tdd="true"`, but its target behavior (Task 1's Content tab and the pre-existing settings route) was already implemented before the tests were written — there is no meaningful RED phase against already-correct code, so this plan follows the same precedent 16-02's Task 3 recorded: the tests were written and confirmed GREEN in one commit against the finished implementation, with a genuine red-then-fixed cycle on the write-path test's own mock shape (see Issues Encountered) rather than against the feature it exercises._

## Files Created/Modified

- `app/admin/settings/page.tsx` - Content tab: interface, state, load/save wiring, tabs entry, JSX
- `tests/unit/app/api/admin-settings-content-category.test.ts` - `defaultSettings` shape, GET category-scoped seeding, POST write-path/honor-guard interaction, 403 paths
- `tests/unit/app/admin-settings-content-tab-source.test.ts` - per-category save-entry counts, single Content tab guard, imported-not-retyped bounds/enum
- `.planning/REQUIREMENTS.md` - BLOG-01, BLOG-02, BLOG-03 marked complete (see Deviations)

## Gate Results (Task 3, Step 1 — CI's own order)

All ten commands run to completion, each prefixed `mise exec --`:

1. `npm audit --omit=dev --audit-level=high` — `found 0 vulnerabilities`
2. `npm run build:themes:check` — `[build-themes] check passed — generated output for 7 theme(s) is fresh.`
3. `npm run scan:tokens` — `[scan-tokens] 0 violations` (two pre-existing `MANUAL-REVIEW` lines, unrelated to this plan)
4. `npm run lint` — `0 errors and 5 warnings potentially fixable` (54 warnings total, all pre-existing, none in this plan's files)
5. `npm run typecheck` — exit 0, no output
6. `npm run cf-typecheck` — required moving `.env.local` and `.dev.vars` aside first (documented local-environment-file cause in the plan's own `<action>`); with both aside, `✨ Types at ./cloudflare-env.d.ts are up to date.`; both files restored immediately after
7. `npm test` — `316 test files, 2850 tests` passed
8. `npm run test:workers` — `31 test files, 249 tests` passed (pre-existing Stripe sourcemap warnings only)
9. `npm run test:observability-worker` — `1 test file, 3 tests` passed
10. `npm run build` — exit 0, full route manifest generated

Migration-safety check (`npm run check:migrations`) is pull-request-only per CI's own trigger and this plan adds no migration — does not apply, recorded rather than silently skipped.

## Deploy

- `git push origin main`: `3324ac3..d65832b main -> main` (22 commits: all of 16-01 through 16-04's own two task commits at push time; `origin/main` had not yet received any of Phase 16 before this push).
- Cloudflare Workers Builds check run `Workers Builds: mercora` on `d65832b`: `completed` / `success` (confirmed via `gh api repos/.../commits/d65832b/check-runs`).
- Confirmed the new version was actually serving (not a stale cached Worker) by diffing the root layout's client chunk hash before/after: `chunks/app/layout-c9de1ba1548ef788.js` → `chunks/app/layout-23097d61b52d2c6b.js`. The home page's own `app/page-*.js` chunk hash was unchanged, which is expected and not a sign of a stale deploy — `BlogHighlights` is a plain synchronous server component with no client-side code, so its presence/absence only changes server-rendered HTML, never that client chunk's contents.

## Live Check (Task 3, Step 3)

Ground truth first: `GET /blog` on production lists **0** article cards (`href="/blog/[slug]"` count is 0; the page renders its "No published post…" empty-state copy) — both before and after the push. This selects the "zero published articles" branch of the plan's verification.

| Check | Before push | After push (new version confirmed live) |
|---|---|---|
| `GET /` status | 200 | 200 |
| `GET /blog` status | 200 | 200 |
| `GET /blog` article-card count | 0 | 0 |
| Home page `href="/blog"` count | 1 | 1 |
| Home page contains `From the Blog` | No | No |

Per the plan's own branching: with zero published articles, the href count must stay unchanged and the heading must stay absent — both hold. The 1 pre-existing `/blog` href in both snapshots is the footer's unconditional link (D-14, deliberately untouched by this phase); the header's conditional desktop entry correctly did not add a second one, and the block correctly rendered nothing (not even its heading) because there are no posts to show.

`curl -sSf` against both `https://voltique.russellkmoore.me/` and `/blog` after the deploy returned `200` for both, satisfying Task 3's second `<verify>`.

## Requirement Status

- **BLOG-01** (header nav, configurable label, hides when empty) — Complete. Artifact: `components/Header.tsx` / `components/HeaderClient.tsx` (16-02). Test: `tests/unit/components/header-blog-nav.test.ts`. Admin control: this plan's Content tab, "Nav Link Label" field. Live-verified: production correctly shows no header blog link with zero published posts.
- **BLOG-02** (configurable home-page articles block, admin settings not template code) — Complete. Artifact: `components/home/BlogHighlights.tsx` / `app/page.tsx` (16-03). Test: `tests/unit/app/page-blog-highlights.test.ts`. Admin control: this plan's Content tab, "Home Page Articles" card (enabled/heading/count/placement). Live-verified: production correctly shows no home block with zero published posts.
- **BLOG-03** (excerpt precedence: explicit else derived, capped, no full body reuse) — Complete. Artifact: `lib/blog/excerpt.ts` (16-01), consumed by `BlogHighlights.tsx` (16-03). Test: `tests/unit/lib/blog/excerpt.test.ts`. Not directly exercised by this plan; carried forward here only for the REQUIREMENTS.md bookkeeping fix below.

## Decisions Made

- Imported `lib/content/settings.ts`'s five interface constants (plus `CONTENT_SETTING_KEYS`/`CONTENT_SETTING_DEFAULTS`/the `BlogHomeBlockPlacement` type) directly into the client-side settings page. The plan flagged a real risk here — a server-only module reaching a client boundary can break `npm run build` — but the build passed cleanly on the first attempt, so no split into a separate client-safe constants module was needed.
- `BLOG_HOME_BLOCK_PLACEMENT_LABELS` is a small position-indexed array (not a placement-keyed object), so the file never contains the literal strings `"before_featured"`/`"after_featured"` anywhere, satisfying the plan's own literal-retyping acceptance criterion by construction rather than by convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical bookkeeping] BLOG-01/02/03 were still "Pending" in REQUIREMENTS.md**
- **Found during:** Task 3, before the deploy commit
- **Issue:** All three Blog requirements were declared complete across 16-01 (`requirements-completed: [BLOG-02, BLOG-03]`), 16-02 (`[BLOG-01]`) and 16-03 (`[BLOG-02, BLOG-03]`)'s own SUMMARY frontmatter, but `.planning/REQUIREMENTS.md`'s checklist and traceability table still showed all three as `Pending` / unchecked — none of the earlier plans' `update_requirements` step had run against this file during the phase.
- **Fix:** Checked all three boxes in the `### Blog` section and set their traceability-table status to `Complete`, cross-referenced against each declaring plan's own coverage evidence (this plan declares `[BLOG-01, BLOG-02]` in its own frontmatter; BLOG-03 was ready the moment 16-03 finished, since both its declaring plans — 16-01 and 16-03 — were already summarized).
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** Read back the file after editing; both the `### Blog` checklist and the traceability table now show all three as complete.
- **Committed in:** this SUMMARY's own commit (docs)

---

**Total deviations:** 1 auto-fixed (1 missing bookkeeping)
**Impact on plan:** Documentation-only; no code or test behavior changed. Necessary so the milestone's requirement traceability reflects reality.

## Issues Encountered

- Task 2's write-path test initially asserted against `db.update()` being called 5 times, but the mocked `select().limit()` chain resolving to an empty array means the route's per-update loop takes the `insert` branch (no existing row), not `update` — corrected to assert against `insert()` and its captured `.values()` calls before the first full test run; not a deviation from the plan, just a mock-shape correction caught immediately by the first `vitest run`.
- `npm run cf-typecheck` failed on the first attempt with "Types at ./cloudflare-env.d.ts are out of date" — exactly the local-environment-file cause the plan's own `<action>` names. Moved `.env.local` and `.dev.vars` aside (built from concatenated shell-variable fragments per the plan's sandbox-guard workaround instructions, values never read), reran successfully, restored both files immediately.
- Confirming the new deploy was actually live took longer than expected: the home page's own client JS chunk hash didn't change post-deploy (expected in hindsight — `BlogHighlights` adds no client-side code), so an initial polling loop against that hash never detected the new version. Switched to polling the GitHub check-run status for the Cloudflare Workers Build directly (`gh api .../commits/{sha}/check-runs`), which is the authoritative signal, then cross-confirmed via the root layout's chunk hash changing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 16 (blog surfacing) is complete and deployed: BLOG-01, BLOG-02 and BLOG-03 are all satisfied, live-verified against production's actual (currently zero) published-article count, and admin-controllable end to end through the new Content tab.
- **For Russell:** the mobile nav sheet's blog entry and the admin Content tab itself have not been clicked through in a real browser with a signed-in Clerk admin session — this repository has no browser-render test for either surface (the standing pattern since Phase 15). Worth a quick manual pass once there's at least one published article, to see the header link, the home block, and the Content tab's fields together with real data.
- No blockers for the next phase (17, saved payment methods).

---
*Phase: 16-blog-surfacing*
*Completed: 2026-09-11*

## Self-Check: PASSED

All 4 files created/modified in this plan verified present on disk; both task commit hashes (`541fcba`, `d65832b`) verified present in `git log --oneline --all`; the plan's `<verification>` item 1 (`tests/unit/app/api` + `admin-settings-content-tab-source.test.ts`) re-run clean at 51 test files / 523 tests passed.
