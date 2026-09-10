---
phase: 14-gift-card-admin-audit-trail
plan: 08
subsystem: ui
tags: [admin, gift-cards, react, next-app-router, dialog, sonner, audit-log]

requires:
  - phase: 14-04
    provides: "maskGiftCardCodeSuffix, gift_card_events vocabulary, timeline merge helpers"
  - phase: 14-06
    provides: "GET /api/admin/gift-cards/[id], GET .../events, q search + meta.total on the list route, POST admin-create"
  - phase: 14-07
    provides: "POST .../disable, .../notes, .../requeue, .../release-hold, .../resend, .../reissue, .../reveal with typed error codes"
provides:
  - "app/admin/gift-cards/[id]/page.tsx — the detail page, gated identically to the list page via giftCardSurfacesHidden + resolveHonorEffective"
  - "GiftCardDetail, GiftCardTimeline, GiftCardActionBar, CreateGiftCardDialog components"
  - "Rewritten GiftCardQueue: masked-code links, search/filter/paging, create dialog"
  - "honor-decision-owner-source.test.ts askers list now names the detail page (D-16 contract complete for this phase)"
affects: [14-09]

actuals:
  tokens: 14100
  tasks: 3
  commits: 3
  plan_head_before: 031253540b47db6da61916a1237f50d7e5936e13

tech-stack:
  added: []
  patterns:
    - "One parameterised GiftCardQueue loader (mount/search/filter/paging all call it) replaces the plan-14-06-era duplicated fetch-in-useEffect-and-in-callback"
    - "AlertDialogAction auto-closes its dialog on click in this Radix build; the reveal confirm calls event.preventDefault() in its onClick to keep the dialog open long enough to render the code inline, then clears it on close"
    - "requestId for admin-create is minted once by the parent (GiftCardQueue) at dialog-open time and passed down as a prop, not generated inside the dialog itself, so a remount of the dialog component can never silently mint a second id for one open session"
    - "Purchaser label for a card with no order and no resolved customer renders a generic 'Admin created' string rather than 'admin: {display name}' — the API's list/detail projections carry no admin display-name field, and re-querying per row to get one was explicitly out of scope for this plan (see Deviations)"

key-files:
  created:
    - app/admin/gift-cards/[id]/page.tsx
    - components/admin/gift-cards/GiftCardDetail.tsx
    - components/admin/gift-cards/GiftCardTimeline.tsx
    - components/admin/gift-cards/GiftCardActionBar.tsx
    - components/admin/gift-cards/CreateGiftCardDialog.tsx
    - tests/unit/app/admin-gift-card-detail-page.test.ts
  modified:
    - components/admin/GiftCardQueue.tsx
    - tests/unit/lib/gift-cards/honor-decision-owner-source.test.ts

key-decisions:
  - "Purchaser label for admin-created cards (no purchaser, no issuing order) renders 'Admin created' rather than D-17's literal 'admin: {display name}' — the list/detail API responses carry no admin display-name field for this case, and the task text explicitly said to take the label from the card's own data rather than re-query. Documented as a deviation below."
  - "Reveal's AlertDialogAction calls event.preventDefault() so the dialog stays open to show the revealed code inline instead of closing immediately on click, which is this Radix build's default behavior for AlertDialogAction."
  - "Note form and its 2000-character bound live in GiftCardDetail.tsx directly (not a separate component) since the plan described it as 'a note form under the action bar', not a standalone reusable component."

requirements-completed: [GCA-01, GCA-02, GCA-03, GCA-08]

coverage:
  - id: D1
    description: "The detail page exists at /admin/gift-cards/[id], gated identically to the list page (giftCardSurfacesHidden + resolveHonorEffective), and the Phase 13 honor-decision ownership contract names its path (D-16, GCA-02)"
    requirement: GCA-02
    verification:
      - kind: unit
        ref: "tests/unit/app/admin-gift-card-detail-page.test.ts#admin gift-card detail page gating (D-16)"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/gift-cards/honor-decision-owner-source.test.ts#every surface that asks the money question asks the owner"
        status: pass
    human_judgment: false
  - id: D2
    description: "The list shows all nine GCA-01 columns (masked code, issued, available, status, purchaser, recipient, order, delivery, created), is searchable by q, filterable by status, and pages via meta.total/limit/offset (GCA-01, D-15, D-17)"
    requirement: GCA-01
    verification: []
    human_judgment: true
    rationale: "No automated render/interaction test exercises GiftCardQueue's actual DOM output or search/filter/paging behavior — the plan's own verify for this task was structural (lint, typecheck, scan:tokens, full suite) plus source-level checks, not a component test. UAT should confirm search-by-order-id/email/suffix, the status filter, and Prev/Next against a live list."
  - id: D3
    description: "The detail page renders a header card, the action bar, a note form and the merged timeline in one view (GCA-02, GCA-03, D-17)"
    requirement: GCA-03
    verification: []
    human_judgment: true
    rationale: "GiftCardDetail's rendering is covered only by the page-level gating test (which stubs the component out entirely) and source-contract checks on the action bar/note form; no test renders the assembled detail view end to end. UAT should confirm the header fields, action availability by card/delivery state, and the note form round-trip."
  - id: D4
    description: "Disable, reissue, resend, re-queue and release-hold are each confirm-gated (AlertDialog for consequential actions, Dialog for the two that take input) and report their outcome as a sonner toast, never window.confirm (D-22)"
    verification:
      - kind: unit
        ref: "tests/unit/app/admin-gift-card-detail-page.test.ts#gift-card action bar source contracts (D-17, D-22, D-12) > imports AlertDialog from the alert-dialog component and toast from sonner"
        status: pass
      - kind: unit
        ref: "tests/unit/app/admin-gift-card-detail-page.test.ts#gift-card action bar source contracts (D-17, D-22, D-12) > contains no window.confirm call"
        status: pass
    human_judgment: true
    rationale: "The source contract proves the right primitives are imported and no native confirm is used, but no test drives an actual dialog open/confirm/toast cycle. UAT should click through each action once against a live card in each eligible state."
  - id: D5
    description: "The reveal control is absent unless capabilities.codeRevealEnabled is true, its AlertDialog names the audit consequence before the code is fetched, and the code displays only inside the open dialog, cleared on close and never logged (D-12, GCA-08)"
    requirement: GCA-08
    verification:
      - kind: unit
        ref: "tests/unit/app/admin-gift-card-detail-page.test.ts#gift-card action bar source contracts (D-17, D-22, D-12) > renders the reveal control conditionally on the settings flag from the detail response"
        status: pass
    human_judgment: true
    rationale: "The source contract proves the render is gated on the flag; it does not prove the runtime dialog sequencing (confirm before fetch, code cleared on close). UAT should toggle the setting on, reveal a code, confirm it copies correctly, and confirm it disappears when the dialog is dismissed."
  - id: D6
    description: "A card issued before the 0024 migration (null codeSuffix) renders an em dash rather than a partially masked string, in both the list and the detail header (D-02)"
    verification: []
    human_judgment: true
    rationale: "maskGiftCardCodeSuffix's null-handling is unit-tested in its own module (plan 14-04); no test in this plan exercises GiftCardQueue/GiftCardDetail specifically with a null-codeSuffix fixture. UAT should confirm against a pre-migration card if one exists, or a seeded fixture."

duration: 48min
completed: 2026-09-10
status: complete
---

# Phase 14 Plan 08: Gift-Card Admin UI Summary

**A real gift-card list (search/filter/paging/create) and a detail page (header, seven-action bar, notes, merged timeline) replacing the five-column read-only queue Russell called "next to useless."**

## Performance

- **Duration:** 48 min
- **Started:** 2026-09-10T20:31:00Z (approx.)
- **Completed:** 2026-09-10T21:19:00Z
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments
- `app/admin/gift-cards/[id]/page.tsx`: a new server component gated exactly like the list page — `giftCardSurfacesHidden` plus a direct call to `resolveHonorEffective` — and the Phase 13 ownership contract's asker list now names it, closing the D-16 contract for this phase.
- `GiftCardDetail`: fetches the card and its merged timeline, renders a header (masked code, issued/available balances, status, created/disabled dates, recipient, purchaser, issuing-order link, delivery status), mounts the action bar and a bounded note form, and refreshes both card and timeline after any successful action.
- `GiftCardTimeline`: plain-words labels for every timeline entry type, oldest-first, with detail fields rendered as labelled pairs rather than raw JSON.
- `GiftCardActionBar`: disable/reissue/resend/re-queue/release-hold/reveal, each shown only when the card/delivery/reservation state allows it, each confirm-gated (`AlertDialog` for consequential actions, `Dialog` for the two that take optional input), each reporting its outcome as a `sonner` toast. Reveal is additionally gated on `capabilities.codeRevealEnabled` from the detail response, and its code is never held in state longer than the open dialog.
- `GiftCardQueue` rewritten: all nine GCA-01 columns, a search box bound to `q`, a status filter, Prev/Next paging off `meta.total`/`limit`/`offset`, a single parameterised loader (collapsing the previous duplicated fetch), and a "Create card" button.
- `CreateGiftCardDialog`: amount converted from major to minor units, required reason, a `requestId` minted once per dialog-open and reused on retry so a double-click cannot mint two cards.
- Full plan `<verification>` re-run clean on the final HEAD: the three named unit-test files, `npm run lint`, `npm run typecheck`, `npm run scan:tokens`, the full `npm test` suite (306 files / 2708 tests), and `npm run build` all pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: List row to card detail to timeline — one click-through, end to end** - `c75bf06` (feat)
2. **Task 2: The list becomes usable — search, filter, paging, create** - `4861cbe` (feat)
3. **Task 3: The action bar — confirm dialogs, the note form, and the reveal** - `3fc5c17` (feat)

**Plan metadata:** (this commit)

**Tracer feedback gate (Task 1):** re-ran Task 1's full `<verify>` (the three named test files plus `npm run typecheck`) after GREEN, before starting Task 2's expansion, per the `end-of-phase` human-verify mode with an automated-only `<verify>` block. All 31 tests passed and `tsc --noEmit` was clean — logged the gate as verified and continued to Task 2 without a checkpoint.

## Files Created/Modified
- `app/admin/gift-cards/[id]/page.tsx` - the detail page, gated like the list page (D-16)
- `components/admin/gift-cards/GiftCardDetail.tsx` - header, action bar mount, note form, timeline mount
- `components/admin/gift-cards/GiftCardTimeline.tsx` - presentational, oldest-first timeline entries
- `components/admin/gift-cards/GiftCardActionBar.tsx` - the seven-action bar with confirm dialogs and toasts
- `components/admin/gift-cards/CreateGiftCardDialog.tsx` - admin-create form with idempotent `requestId`
- `components/admin/GiftCardQueue.tsx` - search/filter/paging list with the nine GCA-01 columns
- `tests/unit/app/admin-gift-card-detail-page.test.ts` - detail-page gating + action-bar/note-form source contracts
- `tests/unit/lib/gift-cards/honor-decision-owner-source.test.ts` - extended `askers` array

## Decisions Made
See frontmatter `key-decisions` for the full rationale. Summary:
- Admin-created cards with no purchaser render "Admin created" rather than a specific admin name, since neither the list nor detail API response carries an admin display-name field and re-querying per row was out of scope.
- Reveal's confirm button calls `event.preventDefault()` to keep its `AlertDialog` open long enough to show the code inline, since this codebase's Radix build closes `AlertDialogAction` by default.
- The note form lives inside `GiftCardDetail.tsx` rather than as its own component, matching the plan's description of it as a form under the action bar rather than a standalone reusable piece.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a stale-scratchpad commit-message collision on the Task 1 commit**
- **Found during:** Task 1, immediately after the first `git commit -F`
- **Issue:** zsh `noclobber` caused `cat > "$F"` to fail silently against a leftover file of the same name from an unrelated prior session in the scratchpad directory; `git commit -F` then read that stale file's content ("test(14-04): add failing test for gift-card event append/read") instead of this task's intended message, while the correct file set was still staged and committed.
- **Fix:** Rewrote the message file with `cat >|` (per this task's shell notes) and ran `git commit --amend -F` to correct the message before any further commits landed on top — no file content was affected, only the message text.
- **Files modified:** none (message-only correction on the still-topmost commit)
- **Verification:** `git log -1 --format='%H %s'` confirms the corrected message; the commit's file list (`git show --stat`) is unchanged from the original commit.
- **Committed in:** `c75bf06` (the corrected Task 1 commit)

**2. [Claude's discretion, not a deviation from a stated rule] Purchaser label for admin-created cards**
- See `key-decisions` above. Not tracked as a Rule 1-4 deviation because the plan's own text ("take that label from the card's own data, not by re-querying") constrained the implementation to this outcome; documented here for visibility since D-17's context text describes a more specific label the current API cannot produce without a re-query this plan was told not to do.

---

**Total deviations:** 1 auto-fixed (process/tooling), 1 documented implementation-scope note. **Impact:** No code-correctness issue; the commit-message fix corrected metadata only, and the purchaser-label note is a faithful reading of an explicit plan constraint rather than a bug.

## Issues Encountered
None beyond the commit-message tooling collision documented above.

## User Setup Required
None - no external service configuration required. The `gift_cards.code_reveal_enabled` setting (off by default, plan 14-02) still governs whether the reveal button appears; no new setting was added by this plan.

## Next Phase Readiness
- The full admin gift-card surface (list, detail, seven actions, notes, timeline, create) is live and wired to every plan 14-06/14-07 route.
- `app/admin/gift-cards/[id]/page.tsx` is in place for plan 14-09's phase-gate re-verification.
- The honor-decision ownership contract is complete for this phase — every surface that asks the existence question now asks `resolveHonorEffective` and is named in the `askers` list.
- Open item for a future plan or UAT pass: the purchaser label for admin-created cards ("Admin created") does not name the specific admin, unlike D-17's suggested "admin: {display name}" — would need either a new API field or a client-side lookup against the timeline's `admin_created` event actor label.

## Self-Check: PASSED

- `app/admin/gift-cards/[id]/page.tsx` exists: FOUND
- `components/admin/gift-cards/GiftCardDetail.tsx` exists: FOUND
- `components/admin/gift-cards/GiftCardTimeline.tsx` exists: FOUND
- `components/admin/gift-cards/GiftCardActionBar.tsx` exists: FOUND
- `components/admin/gift-cards/CreateGiftCardDialog.tsx` exists: FOUND
- `components/admin/GiftCardQueue.tsx` exists: FOUND
- `tests/unit/app/admin-gift-card-detail-page.test.ts` exists: FOUND
- Commit `c75bf06` exists in history: FOUND
- Commit `4861cbe` exists in history: FOUND
- Commit `3fc5c17` exists in history: FOUND
- `mise exec -- npx vitest run tests/unit/app/admin-gift-card-detail-page.test.ts tests/unit/lib/gift-cards/honor-decision-owner-source.test.ts tests/unit/app/admin-gift-card-gating.test.ts`: 35/35 passed
- `npm run lint`: exit 0 (54 pre-existing warnings, none newly introduced)
- `npm run typecheck`: exit 0
- `npm run scan:tokens`: 0 violations
- `mise exec -- npm test`: 306 files / 2708 tests passed
- `npm run build`: succeeded, `/admin/gift-cards/[id]` and all seven mutation routes registered

---
*Phase: 14-gift-card-admin-audit-trail*
*Completed: 2026-09-10*
