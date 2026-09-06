---
phase: 06-theme-file-mechanism-presets
plan: 04
subsystem: admin-ui
tags: [theme-presets, admin-settings, d1-settings, radiogroup-a11y, react]

# Dependency graph
requires:
  - phase: 06-01
    provides: "THEME_MANIFEST, DEFAULT_THEME_NAME (lib/themes/manifest.generated.ts)"
  - phase: 06-02
    provides: "APPEARANCE_SETTINGS_CATEGORY, APPEARANCE_THEME_SETTING_KEY (lib/themes/active-theme.ts), the existing POST /api/admin/settings pattern"
provides:
  - "components/admin/ThemePresetGrid.tsx — manifest-driven card grid, pending selection, save flow, toasts"
  - "app/admin/settings/appearance/page.tsx — the Appearance route hosting the grid"
  - "An eighth Settings hub tab entry ('Appearance') that navigates via next/link instead of flipping tab state"
  - "tests/unit/app/admin-appearance-source.test.ts — source-contract assertions"
affects: [06-05]

# Actuals (#2632)
actuals:
  tokens: 5134
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union tabs array (kind: 'state' | 'route') lets one tabs.map() render both client-state buttons and a real next/link navigation entry with correct TS narrowing on tab.id"
    - "Client component re-reads the confirmed value from the settings POST response itself (not a second GET round-trip) to avoid trusting the optimistic client value"

key-files:
  created:
    - components/admin/ThemePresetGrid.tsx
    - app/admin/settings/appearance/page.tsx
    - tests/unit/app/admin-appearance-source.test.ts
  modified:
    - app/admin/settings/page.tsx

key-decisions:
  - "The two setting constants are imported directly from lib/themes/active-theme.ts into the client component, per the plan's own interface contract, rather than duplicating the literal strings or adding a new shared module. Verified this does not break the client bundle: npm run build compiles clean with the import in place."
  - "The eighth tabs-array entry carries kind: 'route' | 'state' as an explicit discriminant so setActiveTab(tab.id) only ever sees the seven state-tab id literals after narrowing, rather than widening activeTab's type to include 'appearance'."
  - "Added flex-wrap to the hub's tab-strip container (Rule 1 — the UI-SPEC's overflow row assumed wrapping already existed; the source did not have the class), so eight entries actually wrap at narrow widths instead of squeezing into one row."
  - "After a successful save, the badge is driven by the settings POST's own response body, not a second fetch — it is still 'read from the endpoint, not the optimistic client value' per the plan's instruction, just without a redundant round-trip."

patterns-established:
  - "A client card grid can safely read a manifest-derived constant module co-located with server-only resolver code, provided the constants are declared at module top with no dependency the client's used exports actually reach — confirmed via a real production build, not assumed."

requirements-completed: [THEME-03]

coverage:
  - id: D1
    description: "ThemePresetGrid renders one card per manifest entry (any count) with live token-driven chips and a mini mock, a pending selection distinct from the Active badge, and persists a selection through the existing settings endpoint"
    requirement: THEME-03
    verification:
      - kind: unit
        ref: "tests/unit/app/admin-appearance-source.test.ts (8 tests: manifest-driven with no card-count literal, imported constants, existing-endpoint usage, escaped text, copywriting literals, a11y attributes, synopsis clamp, hub link)"
        status: pass
      - kind: other
        ref: "mise exec -- npm run typecheck && npm run lint && npm run scan:tokens && npm run build (all exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Appearance route exists at its own path, hosts the grid, and is reachable from the settings hub via a real navigation entry (not a tab-state change), with the other seven tabs unchanged"
    requirement: THEME-03
    verification:
      - kind: integration
        ref: "npm run build (route /admin/settings/appearance present in the route manifest)"
        status: pass
      - kind: unit
        ref: "tests/unit/app/admin-appearance-source.test.ts (hub-link + kind:\"route\" assertions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A real save through the existing POST /api/admin/settings endpoint changes the appearance.theme row and the storefront reflects it on the next request with no restart"
    requirement: THEME-03
    verification:
      - kind: other
        ref: "Local dev server + curl with the documented x-dev-admin dev-bypass header: GET appearance settings, POST appearance.theme=midnight, re-fetched / and confirmed data-theme=\"midnight\", then restored to volt-dark and reconfirmed data-theme=\"volt-dark\""
        status: pass
    human_judgment: false
  - id: D4
    description: "A real admin, in a browser, clicks a card (ring appears, badge does not move), saves (toast + badge moves), sees the storefront change in another tab, and can drive the grid with arrow keys / space / enter"
    verification: []
    human_judgment: true
    rationale: "This plan's own Task 3 <human-check> covers exactly this walkthrough and requires a real Clerk-authenticated browser session, which this environment does not have (documented in the environment notes: no local Clerk session, dev-bypass header only covers the API path). The API-level proof in D3 confirms the underlying mechanism end to end; the visual/interaction claims (ring vs badge, toast copy rendering, keyboard radiogroup behavior) still need a human pass. Logged as WINDOWS #2 (unrun-verify)."

# Metrics
duration: 16min
completed: 2026-09-04
status: complete
---

# Phase 6 Plan 4: Admin Appearance Page Summary

**A new `/admin/settings/appearance` route gives an admin a manifest-driven grid of theme-preview cards — five colour chips and a live mini-mock per theme, a click-to-select pending state distinct from the Active badge — that saves through the settings API the rest of the admin already uses, proven end to end against a real dev server: posting a new theme name flips the storefront's `data-theme` attribute with no restart.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-09-04T20:14:00Z
- **Completed:** 2026-09-04T20:29:35Z
- **Tasks:** 3 completed
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- Built `components/admin/ThemePresetGrid.tsx`: reads `THEME_MANIFEST` at module scope (cards render on first paint, no fetch needed for content), fetches the stored `appearance.theme` selection on mount from the category-scoped settings GET, and tracks saved/pending/saving as three separate pieces of state. Each card shows the fixed six-part anatomy — 5 colour chips in order (primary, surface, surface-elevated, foreground, surface-inverse), a mini mock (heading line + CTA pill, both reading that theme's own tokens via inline style), label, industry line, synopsis, and an Active badge that only ever reflects the loaded saved value, never the pending click.
- Wired the grid as a `role="radiogroup"` with per-card `role="radio"`/`aria-checked`, arrow-key navigation (wrapping in both directions, moving both selection and DOM focus), and space/enter selection — the UI-SPEC's two backstop accessibility rows.
- Save posts a single `updates` entry to the existing `POST /api/admin/settings` using the imported `APPEARANCE_SETTINGS_CATEGORY`/`APPEARANCE_THEME_SETTING_KEY` constants (no literal string restated), re-checks the pending name against the manifest before posting, and — on success — reads the confirmed value back out of the POST's own response body rather than trusting the optimistic client value, so a concurrent admin save can never leave the badge pointing at a theme the storefront isn't serving.
- Created the Appearance route (`app/admin/settings/appearance/page.tsx`): a thin server component rendering the exact title/subtitle copy and hosting the grid.
- Added an eighth entry to the settings hub's `tabs` array with a `kind: "route" | "state"` discriminant so the new entry renders as a real `next/link` navigation (current-route highlight via `usePathname()`) while the seven existing entries keep their `setActiveTab` click-state behavior unchanged. Added `flex-wrap` to the tab-strip container so eight entries actually wrap at narrow widths (Rule 1 — the UI-SPEC assumed this class already existed; it did not).
- Wrote `tests/unit/app/admin-appearance-source.test.ts` (8 tests, same source-grep shape as `admin-blog-source.test.ts`): manifest-driven grid with no numeric card-count assertion, imported setting constants, reused endpoint with no new route, escaped header-derived text (no raw-HTML sink), the four copywriting-contract literals verbatim, radiogroup a11y attributes plus arrow-key navigation, the synopsis clamp class, and the hub's route link.
- Ran the real end-to-end proof against `npm run dev` + local D1 using the project's documented `x-dev-admin: mercora-dev-bypass` header (no Clerk session available in this environment): `GET /api/admin/settings?category=appearance` returned the existing `volt-dark` row; `POST` with `value: "midnight"` returned the confirmed row; `curl http://localhost:3000/` then served `data-theme="midnight"` with no server restart; restored to `volt-dark` and reconfirmed. Server stopped cleanly afterward.
- Full gate suite: `npm run lint` (0 errors, pre-existing unrelated warnings only), `npm run typecheck` (exit 0), `npm run scan:tokens` (0 violations, same 2 manual-review rows Phase 5 closed with), `npm test` (248 files / 1932 tests, all green), `npm run build` (exit 0, `/admin/settings/appearance` present in the route manifest).

## Task Commits

Each task was committed atomically:

1. **Task 1: ThemePresetGrid — manifest-driven cards, pending selection, save flow** - `97bb30d` (feat)
2. **Task 2: The Appearance route and the settings hub link** - `d869b24` (feat)
3. **Task 3: Source-contract tests and the end-to-end selection proof** - `18af741` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/admin/ThemePresetGrid.tsx` - manifest-driven card grid, radiogroup a11y, pending/save state machine
- `app/admin/settings/appearance/page.tsx` - the Appearance route, hosts the grid
- `app/admin/settings/page.tsx` - eighth hub tab entry (routes instead of tab-state), tab-strip `flex-wrap`
- `tests/unit/app/admin-appearance-source.test.ts` - source-contract tests

## Decisions Made

- **Imported the appearance setting constants straight from `lib/themes/active-theme.ts` into the client component**, per the plan's own interface contract, and verified this does not leak server-only code or break the production client bundle by running the real `npm run build` rather than assuming tree-shaking would handle it.
- **`tabs` array uses a `kind` discriminant** rather than widening `activeTab`'s type or splitting into two arrays, so `setActiveTab(tab.id)` still only ever type-checks against the seven state-tab literals.
- **Re-read the saved theme from the POST response**, not a second GET, satisfying "re-read from the endpoint, not the optimistic value" with one network round-trip instead of two.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Settings hub tab strip had no `flex-wrap`, so eight entries would not wrap at narrow widths**
- **Found during:** Task 2, while matching the UI-SPEC's overflow row ("the hub's tab strip already wraps")
- **Issue:** The existing tab-strip container (`app/admin/settings/page.tsx`) was `flex space-x-1 ...` with no `flex-wrap` class. The UI-SPEC's E4-overflow resolution assumed wrapping already existed; it did not — with eight `flex-1` entries and no wrap, the strip would have squeezed all eight into one row instead of wrapping.
- **Fix:** Added `flex-wrap` to the tab-strip container className.
- **Files modified:** `app/admin/settings/page.tsx`
- **Verification:** Visual assumption corrected in source; full wrap behavior itself is part of the deferred human-check (D4 / WINDOWS #2).
- **Committed in:** `d869b24`

**2. [Rule 3 - Blocking issue, self-inflicted] Wrong commit message landed on Task 1's commit due to a shell noclobber collision**
- **Found during:** Task 1 commit step
- **Issue:** A stale, unrelated `commit-task1.txt` file already existed in the scratchpad directory from an earlier session; zsh's `noclobber` silently refused the `cat >` write, but the chained `git commit -F` still ran against the stale file's old content, producing a commit with an unrelated Phase 05-04 message on Phase 06-04's actual diff.
- **Fix:** Verified `git show --stat HEAD` showed only the intended file (`components/admin/ThemePresetGrid.tsx`, 260 insertions) before amending; then `git commit --amend -F` with a freshly, uniquely named message file to correct the message without altering the diff. Not yet shared/pushed, so amending was safe and appropriate rather than compounding the error with a wrong-message commit is left in history.
- **Files modified:** none (message-only)
- **Verification:** `git log --oneline -3` shows the corrected `feat(06-04): manifest-driven ThemePresetGrid with pending/save flow` message on the same commit content.
- **Committed in:** `97bb30d` (post-amend hash)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 — a UI-SPEC assumption that didn't hold in the actual source; 1 Rule 3 — a self-inflicted tooling collision corrected before any downstream commit depended on the wrong hash). **Impact:** Both necessary; neither changed scope beyond what Task 2's own acceptance criteria and basic commit hygiene required.

## Issues Encountered

- **Pre-existing, out-of-scope bug found in `app/api/admin/settings/route.ts` (not modified — this plan's `<interfaces>` explicitly forbids changing it).** `GET /api/admin/settings?category=X` inserts the *entire* `defaultSettings` array (every category, not just `X`) whenever the category-filtered query returns zero rows. `appearance` has no `defaultSettings` entries at all, so on a database where every other default category is already populated, `ThemePresetGrid`'s own `category=appearance` GET would trip this branch and attempt to re-insert already-existing primary keys, throwing and returning a 500 — which the grid would correctly show as its load-failure banner (not a crash), but the underlying cause is a real latent bug in shared, unmodified code. Not observed in this session's E2E proof only because plan 06-03 had already left a single `appearance.theme` row in the local D1 fixture (confirmed via `wrangler d1 execute --local` before starting). Logged in `.planning/WINDOWS.md` (#3, kind: deviation) rather than fixed, per the plan's explicit file-scope restriction.
- **Task 3's `<human-check>` (real browser click/ring/badge/toast/keyboard walkthrough) could not be run** — no Clerk-authenticated session is available in this environment (documented in the environment notes). Substituted an equivalent API-level proof using the project's documented `x-dev-admin` dev-bypass header, which confirms the underlying save-and-serve mechanism but not the visual/interaction details. Logged in `.planning/WINDOWS.md` (#2, kind: unrun-verify).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The admin can now change the storefront's theme without touching D1 by hand — THEME-03 is delivered and provable via the API-level E2E proof in this SUMMARY.
- Three cards render in this session (`luxe`, `midnight`, `volt-dark` — manifest order from 06-03's regeneration); the grid's own contract (no numeric card-count literal, pinned by the source test) makes this count-agnostic for any future preset addition.
- Two open WINDOWS entries carry into whatever picks up UI/QA verification next: #2 (this plan's human-check, browser walkthrough) and #3 (the settings-API empty-category insert bug, unrelated to this plan's files but discovered while proving this plan's own save path). Neither blocks THEME-03's own completion; both are real follow-up work.
- `font-display`'s still-unwired serif face (WINDOWS #1, carried from 06-03) remains open — this plan did not touch typography wiring.

---
*Phase: 06-theme-file-mechanism-presets*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: components/admin/ThemePresetGrid.tsx
- FOUND: app/admin/settings/appearance/page.tsx
- FOUND: tests/unit/app/admin-appearance-source.test.ts
- FOUND: app/admin/settings/page.tsx
- FOUND commit: 97bb30d
- FOUND commit: d869b24
- FOUND commit: 18af741
- Re-ran plan-level verification: `npx vitest run tests/unit/app/admin-appearance-source.test.ts` (8/8 pass), `npm run lint` (0 errors), `npm run typecheck` (exit 0), `npm run scan:tokens` (0 violations, 2 manual-review rows), `npm test` (248 files / 1932 tests, all pass), `npm run build` (exit 0, `/admin/settings/appearance` in route manifest), local-dev-server E2E proof (documented above), D1 restored to `volt-dark` and dev server stopped.
