---
phase: 04-reference-documentation-refresh
plan: 04
subsystem: docs
tags: [markdown, documentation, mermaid, historical-labeling]

# Dependency graph
requires:
  - phase: 04-reference-documentation-refresh
    provides: REF-01 model-name sweep pattern established in plans 04-01/04-02/04-03; docs/mobile-lighthouse-baseline.md from Phase 2 as the current mobile measurement record
provides:
  - Status: Historical banners on the four documents that describe a system that no longer exists
  - Section-scoped historical banner on the docs/architecture.md ER diagram naming concrete schema gaps
  - Current model id (@cf/openai/gpt-oss-20b) at both docs/architecture.md diagram label sites
  - Closed mobile implementation checklist with per-item evidence citations
affects: [04-verify-work, later-docs-passes]

actuals:
  tokens: 6500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Historical banner blockquote directly under a heading (H1 for whole-document staleness, section heading for section-scoped staleness), blank line above and below, one falsifiable sentence"
    - "Checklist evidence notes: original item text preserved, dash, 'done, see' + backticked path, sourced only from a verified table (04-RESEARCH.md), never re-derived from memory"

key-files:
  created: []
  modified:
    - docs/admin-dashboard-specification.md
    - docs/mobile-ux-assessment.md
    - docs/mobile-testing-automation.md
    - docs/architecture.md
    - docs/mobile-improvements-actionable.md

key-decisions:
  - "Architecture.md's two LLM mermaid nodes kept their literal id 'LLM' unchanged per D-02 as resolved in 04-RESEARCH.md — only the bracketed label text was rewritten to the quoted current model id, since the ids are not derived from the model name"
  - "Banner sentences written from sources read this session (PROJECT.md, docs/CLAUDE.md, 04-RESEARCH.md's verified fact tables, docs/mobile-lighthouse-baseline.md) — no claim asserted from memory"
  - "Mobile-testing-automation banner uses 'not implemented', not 'not yet implemented' — no v1 work plans to build the proposed suites"

patterns-established:
  - "Pattern 2: Tracer-first banner rollout — Task 1 proved the exact banner shape end-to-end on one file (with its own tracer feedback gate) before Task 2 applied it verbatim to three more files, avoiding a four-file rework if the shape had been wrong"

requirements-completed: [REF-01, REF-04]

coverage:
  - id: D1
    description: "docs/admin-dashboard-specification.md carries the Status: Historical banner at line 3, naming PROJECT.md and CLAUDE.md as the source for shipped admin routes"
    requirement: "REF-04"
    verification:
      - kind: other
        ref: "grep/sed acceptance gates in 04-04-PLAN.md Task 1 <verify>"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/mobile-ux-assessment.md and docs/mobile-testing-automation.md carry the identical Status: Historical banner at line 3 with a blank line 4"
    requirement: "REF-04"
    verification:
      - kind: other
        ref: "grep/sed acceptance gates in 04-04-PLAN.md Task 2 <verify>"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/architecture.md carries a section-scoped Status: Historical banner under Database Schema Overview naming product_variants, order_effects, and the unmatched CHAT_SESSIONS entity, and both diagram LLM node labels now read @cf/openai/gpt-oss-20b with ids unchanged"
    requirement: "REF-01, REF-04"
    verification:
      - kind: other
        ref: "grep/sed acceptance gates in 04-04-PLAN.md Task 2 <verify>"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/mobile-improvements-actionable.md checklist shows 12 ticked items (each with a file:line evidence path that exists on disk) and 5 unticked human-verification items, unchanged in order and text"
    requirement: "REF-04"
    verification:
      - kind: other
        ref: "grep/test acceptance gates in 04-04-PLAN.md Task 3 <verify>, including test -e per cited path"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-09-03
status: complete
---

# Phase 4 Plan 4: Historical Document Banners and Checklist Closure Summary

Labelled four stale documents with a uniform historical banner and closed the mobile implementation checklist with per-item evidence citations, in three atomic commits.

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-03T00:51:00Z (approx, first task commit 2026-09-02T17:51:xx PDT)
- **Completed:** 2026-09-03T00:54:16Z (last task commit)
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments
- `docs/admin-dashboard-specification.md`, `docs/mobile-ux-assessment.md`, `docs/mobile-testing-automation.md`, and `docs/architecture.md` (section-scoped) each carry the identical `Status: Historical (September 2025)` banner, so a contributor no longer mistakes a design document, a stale snapshot, an unimplemented proposal, or a superseded ER diagram for current material.
- `docs/architecture.md`'s two AI-pipeline mermaid nodes name the current model `@cf/openai/gpt-oss-20b` (node ids left intact per D-02); the file's case-insensitive `llama` count is now 0.
- `docs/mobile-improvements-actionable.md`'s implementation checklist went from 0/17 ticked to 12/17 ticked, each ticked item citing a file:line path verified to exist on disk; the five human-verification items stay unticked.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end historical banner on one document (tracer)** - `73d4309` (docs)
2. **Task 2: The remaining three banners, plus the architecture diagram model labels** - `4f7045f` (docs)
3. **Task 3: Close the mobile implementation checklist with per-item evidence** - `c5d5293` (docs)

**Plan metadata:** committed separately per `git_commit_metadata` step (this file + STATE/ROADMAP/REQUIREMENTS).

## Files Created/Modified
- `docs/admin-dashboard-specification.md` - Historical design-document banner at line 3
- `docs/mobile-ux-assessment.md` - Historical snapshot banner at line 3, points to `docs/mobile-lighthouse-baseline.md`
- `docs/mobile-testing-automation.md` - Historical proposal banner at line 3, states the suites are not implemented
- `docs/architecture.md` - Section-scoped historical banner under Database Schema Overview; both LLM diagram labels renamed to the current model id
- `docs/mobile-improvements-actionable.md` - 12 checklist items ticked with evidence citations; 5 left unticked

## Banner sentences as written

- `docs/admin-dashboard-specification.md:3` — "This is a design document; the modules it describes that were never built are not planned, and the admin routes that actually ship are listed in `.planning/PROJECT.md` and `docs/CLAUDE.md`."
- `docs/mobile-ux-assessment.md:3` — "This is a September 2025 snapshot; its measurements are superseded by `docs/mobile-lighthouse-baseline.md`, which recorded all four measured routes falling short of the PRD target."
- `docs/mobile-testing-automation.md:3` — "This is a proposal; the Lighthouse CI and Playwright suites it describes are not implemented."
- `docs/architecture.md` (under `## Database Schema Overview`, line 216, heading at line 214) — "This diagram predates the variant model (`product_variants`) and the order ledger tables (`order_effects`, `order_events`, `order_webhooks`); the current schema also includes gift cards, subscriptions, CMS/blog, promotions, and admin-user tables not shown here, and the diagrammed `CHAT_SESSIONS` entity has no corresponding table in the current schema. See `lib/db/schema/` and `migrations/` for the current schema."

## Checklist before/after

`docs/mobile-improvements-actionable.md` implementation checklist: 0 checked / 17 unchecked before this plan's edit; 12 checked / 5 unchecked after. Verified with `/usr/bin/grep -c '\[x\]'` and `/usr/bin/grep -c '\[ \]'` both before and after the Task 3 commit.

## Decisions Made
- Both `docs/architecture.md` LLM node ids kept unchanged (D-02 as resolved by `04-RESEARCH.md`'s finding that these ids are literal `LLM`, not model-derived) — only the bracketed labels changed, each rewritten as a double-quoted mermaid string to keep the `/` and `@` safe.
- Every banner sentence and every checklist evidence path was copied from a source read this session (`.planning/PROJECT.md`, `docs/CLAUDE.md`, `04-RESEARCH.md`'s `## REF-04 Verified Facts`, `docs/mobile-lighthouse-baseline.md`) — none asserted from memory, per the plan's prohibition.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Commit tooling correction (not a plan deviation):** the first `cat > <scratchpad-file> <<'EOF'` heredoc for the Task 1 commit message silently failed under the shell's `noclobber` option (a stale file from an earlier session already existed at that exact scratchpad path), and `git commit -F` picked up that stale file's content — producing a commit with a correct diff but a wrong, unrelated commit message ("docs(04-02): name the current model and describe the real Stripe path..."). Caught immediately by reading `git log -1` after the commit. Fixed with `git commit --amend -F <freshly-named-file>` before any further work — this was the very last commit made, unpushed, and the amendment corrected my own tooling mistake rather than rewriting prior history. All subsequent commit messages used unique scratchpad filenames to avoid recurrence. Final commit `73d4309` carries the correct message and the correct diff (verified via `git log -1` and `git diff --name-only HEAD~1 HEAD`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

REF-04 is fully addressed by this plan. REF-01 (model-name sweep) is shared across plans 04-01 through 04-04; this plan's edits to `docs/architecture.md` were the last outstanding REF-01 file — a repo-wide `/usr/bin/grep -ri llama docs/` now returns nothing. Plan 04-05 (DEP-01, dependency baseline and CI audit-level line) is the only remaining plan in this phase and does not touch any file this plan owns.

---
*Phase: 04-reference-documentation-refresh*
*Completed: 2026-09-03*

## Self-Check: PASSED

All 5 modified files found on disk. All 3 task commits (`73d4309`, `4f7045f`, `c5d5293`) found in `git log`. All plan-level `<verification>` commands re-ran clean at self-check time.
