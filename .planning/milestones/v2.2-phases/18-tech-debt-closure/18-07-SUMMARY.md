---
phase: 18-tech-debt-closure
plan: 07
subsystem: process
tags: [broken-windows, requirements, roadmap, ci-gates, deploy, tax-route]

requires:
  - phase: 18-tech-debt-closure
    provides: "18-01..18-06's six code plans (all DEBT-01..06 fixes plus DEBT-07's code half)"
provides:
  - "Broken-windows ledger entries 2, 5, 6, 10 closed with cited evidence (entry 12 confirmed stayed closed)"
  - "Two pending todos (theme-metadata-industry-synopsis-admin, migration-0023-duplicate-number) moved to completed"
  - "D-10 ratification: deliverOne's existing note-at-send-time behavior is the accepted default for pre-existing pending gift-card deliveries"
  - "All eight DEBT requirements complete in REQUIREMENTS.md checklist and traceability table"
  - "Phase 18 closed in ROADMAP.md: all 7 plan checkboxes, phase-list line, Progress table row"
  - "Full CI-mirroring gate suite green in one pass"
  - "Phase 18's doc-only commits pushed and deployed; production confirmed read-only"
affects: [tech-debt, requirements-tracking, roadmap, production-deploy]

actuals:
  tokens: 4451
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "cf-typecheck's CI-mirrored baseline requires moving BOTH .env.local and .dev.vars aside before regenerating cloudflare-env.d.ts — not just .env.local as the prior recorded lesson said. wrangler types --strict-vars false infers var types from whatever env files are present locally; .dev.vars alone was enough to add four GIFT_CARD_* keys the committed file (and CI) does not carry."

key-files:
  created:
    - .planning/phases/18-tech-debt-closure/18-07-SUMMARY.md
  modified:
    - .planning/WINDOWS.md
    - .planning/todos/pending/theme-metadata-industry-synopsis-admin.md (moved to completed/)
    - .planning/todos/pending/migration-0023-duplicate-number.md (moved to completed/)
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "D-10 ratified: deliverOne (lib/services/gift-card-fulfillment.ts:439) already calls giftMessageFor unconditionally on every send, reading the buyer's note from the immutable orders.items snapshot at send time regardless of when the order was placed. This existing behavior is accepted as the answer to the Phase 12 review's deferred retroactive-note question — no code change. Flagged explicitly as Russell's to override; see 'D-10 Ratification' section below for the full reasoning."
  - "Entry 2 (D-12/DEBT-08) closed on code-level evidence, not a browser click-through: components/admin/ThemePresetGrid.tsx:180-186 renders theme.meta.industry and theme.meta.synopsis directly off the theme object, and all 7 themes in lib/themes/manifest.generated.ts carry both fields. This follows the same convention the rest of Phase 18 used for closing entries without a live Clerk session."
  - "Discovered and reverted a false-positive cf-typecheck fix: the first cf-typegen run (with .dev.vars present, .env.local moved aside) produced a 4-line diff adding GIFT_CARD_CODE_HMAC_*/GIFT_CARD_DELIVERY_* var declarations. This would have been wrong to commit — CI has no .dev.vars either, so the committed file (unchanged) is already the correct CI-mirrored baseline. Reverted with git checkout, redid the regeneration with .dev.vars also moved aside, got a zero-diff confirmation, and cf-typecheck passed clean against the untouched committed file."

requirements-completed: [DEBT-07, DEBT-08]

coverage:
  - id: D1
    description: "Broken-windows entries 2, 5, 6, 10 confirmed true and closed with cited evidence; no row deleted."
    requirement: "DEBT-07"
    verification:
      - kind: other
        ref: "gsd-tools windows status --raw (node inline check) — entries 2,5,6,10 all report status fixed"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two pending todos (theme-metadata-industry-synopsis-admin, migration-0023-duplicate-number) closed and moved to .planning/todos/completed/."
    requirement: "DEBT-07"
    verification:
      - kind: other
        ref: "test ! -e .planning/todos/pending/theme-metadata-industry-synopsis-admin.md && test ! -e .planning/todos/pending/migration-0023-duplicate-number.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "Admin Appearance grid renders theme industry/synopsis from the generated manifest for every theme; DEBT-08 confirmed already satisfied, no code change."
    requirement: "DEBT-08"
    verification:
      - kind: other
        ref: "grep theme.meta.industry/theme.meta.synopsis in ThemePresetGrid.tsx + manifest.generated.ts industry:/synopsis: count parity (7/7)"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-10 retroactive gift-note question ratified as answered by existing deliverOne behavior; recorded, flagged as Russell's to override."
    verification: []
    human_judgment: true
    rationale: "This is a product decision, not a technical one. Automation confirmed the code's existing behavior; whether that behavior is the RIGHT default is Russell's call, explicitly flagged rather than closed silently."
  - id: D5
    description: "Full CI-mirroring gate suite (12 commands) green in one pass; all eight DEBT requirements complete in REQUIREMENTS.md checklist and traceability table; ROADMAP.md Phase 18 fully ticked with a Progress row."
    requirement: "DEBT-07"
    verification:
      - kind: other
        ref: "npm audit, build:themes:check, scan:tokens, lint, typecheck, cf-typecheck, npm test, test:workers, test:observability-worker, docs:lint, check:migrations, build — see Gate Suite Results below"
        status: pass
    human_judgment: false
  - id: D6
    description: "Production confirms the deleted /api/tax route stays gone and the storefront root is healthy after this plan's push."
    verification:
      - kind: other
        ref: "curl POST https://voltique.russellkmoore.me/api/tax (404) + curl GET / (200), re-checked after new deploy landed"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-09-11
status: complete
---

# Phase 18 Plan 07: Phase Gate — Confirm, Close, Gate, Deploy Summary

**Closed four broken-windows entries and two todos on cited code-level evidence, ratified the D-10 gift-note default, ran all 12 CI-mirroring gates green in one pass (catching and reverting a false-fix cf-typecheck regeneration along the way), and confirmed the deployed tax-route deletion from production with read-only probes.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-11T12:34:37Z
- **Tasks:** 3
- **Files modified:** 5 (`.planning/WINDOWS.md`, 2 todo files moved, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`)

## Accomplishments

- Verified and closed broken-windows entries 2, 5, 6 (entry 10 confirmed already closed, entry 12 confirmed stayed closed) with the specific evidence read for each
- Closed both DEBT-07/DEBT-08 pending todos, moved to `.planning/todos/completed/`
- Recorded the D-10 gift-note ratification as a product decision for Russell to see and override
- Ran the full 12-command CI-mirroring gate suite in one pass, all green
- Marked all 8 DEBT requirements complete in both REQUIREMENTS.md surfaces
- Closed Phase 18 in ROADMAP.md (7 plan checkboxes, phase-list line, Progress table row) via scoped edits only
- Pushed 2 doc-only commits; confirmed the new deploy landed and production still serves 404 for the deleted tax route and 200 for the storefront root

## Task Commits

1. **Task 1: Confirm the four already-true claims, then close their records** — `24fb341` (docs)
2. **Task 2: Run the full gate suite and mark the phase complete in the planning record** — `c5b29e5` (docs)
3. **Task 3: Deploy by pushing, then confirm production read-only** — no repository commit (push + read-only verification only)

**Plan metadata:** this SUMMARY's own commit (docs, made immediately after this file is written)

## Ledger Entry Evidence

### Entry 5 (D-08) — stale token-scanner claim

Read `docs/CLAUDE.md` line 123: `scan-hardcoded-colors.mjs  # Token-contract scanner (npm run scan:tokens, CI-wired)`. Read the Testing section (lines 201-209): it lists the three test suites and defers to AGENTS.md for the full gate order — no "local-only" claim remains anywhere. Read `.github/workflows/ci.yml` line 43: `npm run scan:tokens` is a real CI step. The claim was already fixed by unrelated Phase 8.2 documentation work; no code change here. Closed via `gsd-tools windows fixed 5`.

### Entry 6 (D-09) — REQUIREMENTS-wide verify check

Searched `.planning/` outside `milestones/` for "unchecked bold requirement lines" / the whole-file zero-unchecked pattern the entry describes. The only match anywhere in the tree is `.planning/WINDOWS.md`'s own description of the entry (a citation, not a live check) and the archived `.planning/milestones/v2-phases/08.1-v2-tech-debt-closure/08.1-07-PLAN.md`. This plan's own Task 2 verify uses a DEBT-0[1-8]-scoped check, not the all-requirements whole-file pattern entry 6 describes — confirmed the pattern does not recur. Closed via `gsd-tools windows fixed 6`.

### Entry 2 (D-12/DEBT-08) — admin Appearance metadata

Read `components/admin/ThemePresetGrid.tsx` lines 180-186: the industry line (`{theme.meta.industry && ...}`) and synopsis line (`{theme.meta.synopsis && ...}`) both render directly off the theme object, each omitted entirely when absent rather than shown as an empty placeholder. Read `lib/themes/manifest.generated.ts`: `industry:` and `synopsis:` each appear exactly 7 times — once per theme (furniture/ceramics, skincare/wellness, fashion/jewelry, grocery/specialty-food, consumer-electronics, vintage-clothing, outdoor-gear) — with matching count parity. This closes on code-level evidence — the manifest data and the component's render logic read directly — under the same convention the rest of this run used; it was not verified by clicking through the admin UI in a browser. Closed via `gsd-tools windows fixed 2`.

### Entry 10 — dropped cart line (DEBT-03)

Already `fixed` (resolved 2026-09-11T11:52:55Z) before this plan ran. Read `18-04-SUMMARY.md` line 133: the closing commit is `cfe00fd` (Task 1 commit of plan 18-04). Confirmed the status stayed `fixed` — no action needed, re-verified rather than reclosed.

### Entry 12 (D-05 interaction with D-03) — digital-only misclassification

Already `fixed` (resolved 2026-09-11T12:10:40Z) before this plan ran, by plan 18-02's cross-reference fix in `lib/checkout/digital-only.ts`. Confirmed the status stayed `fixed`.

## D-10 Ratification (flagged for Russell to override)

**The question (Phase 12 review, IN-07 retroactive half, deferred at the time):** if a gift-card delivery was still `pending` from before the note-rendering fix landed (`48b2e42`), and its buyer wrote a note, should that note now appear when the delivery finally drains — even though the buyer wrote it when notes were never sent?

**What the code already does:** `deliverOne` (`lib/services/gift-card-fulfillment.ts:439`) calls `giftMessageFor` unconditionally on every claimed delivery, which reads the note from the immutable `orders.items` snapshot at send time — there is no gate on order creation date or on when the delivery row was created. Any pending delivery, old or new, gets its buyer's note rendered into the email when it sends.

**This run's ratification:** that existing behavior is accepted as correct, by default rather than by mandate. The buyer wrote the note intending it to go out; the delivery was only delayed, not cancelled. Suppressing the note for pre-fix pending rows would require adding a timestamp cutoff to distinguish old pending rows from new ones — more code, for a worse default, where a note the buyer wrote silently never appears. No code was changed.

**This is Russell's to override.** If he decides pre-fix pending deliveries should NOT retroactively pick up notes, that needs a timestamp-gated code change — this run explicitly declined to make that call unilaterally, same as the Phase 12 review did.

## Gate Suite Results

Full CI-mirroring gate suite, run in the order Task 2 specifies, in one pass:

| Gate | Result |
|---|---|
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| `npm run build:themes:check` | fresh, 7 themes |
| `npm run scan:tokens` | 0 violations (2 pre-existing MANUAL-REVIEW notes, out of scope) |
| `npm run lint` | 0 errors, 54 pre-existing warnings (out of scope) |
| `npm run typecheck` | clean |
| `npm run cf-typecheck` | clean — see note below |
| `npm test` | 322/322 files, 2958/2958 tests |
| `npm run test:workers` | 33/33 files, 255/255 tests |
| `npm run test:observability-worker` | 1/1 file, 3/3 tests |
| `npm run docs:lint` | 0 violations |
| `npm run check:migrations -- --base origin/main` | no migrations added (expected — this phase adds none) |
| `npm run build` | succeeded; route list confirmed no `/api/tax` |

**cf-typecheck note:** the first regeneration attempt (with `.env.local` moved aside but `.dev.vars` still present) produced a spurious 4-line diff adding `GIFT_CARD_CODE_HMAC_*`/`GIFT_CARD_DELIVERY_*` var declarations that exist only in local `.dev.vars`, not in `wrangler.jsonc` or CI. That diff was reverted with `git checkout -- cloudflare-env.d.ts` before it could be committed. Redone with both `.env.local` and `.dev.vars` moved aside, the regeneration produced a zero-diff match against the already-committed file, and `cf-typecheck` passed clean. Both files were restored immediately after. Refines the prior recorded lesson (project memory said only `.env.local` needed moving) — `wrangler types --strict-vars false` also picks up `.dev.vars`.

## Requirements and Roadmap

`gsd-tools requirements mark-complete DEBT-01,...,DEBT-08` flipped 7 requirements (DEBT-04 was already complete from plan 18-05). Confirmed both surfaces in `.planning/REQUIREMENTS.md`: all 8 checkboxes `[x]`, all 8 traceability rows `Complete`.

`.planning/ROADMAP.md` updated by scoped edit only: all 7 Phase 18 plan checkboxes ticked, the Phase 18 phase-list line ticked with a completion date, and a `18. Tech-Debt Closure | 7/7 | Complete    | 2026-09-11` row added to the Progress table in the same shape as the Phase 13-17 rows. No other phase section was touched (confirmed via `git diff .planning/ROADMAP.md` — only the three expected hunks).

## Production Deploy and Confirmation

Pushed 2 doc-only commits (`24fb341`, `c5b29e5`) to `main`. Neither touches application code — both are `.planning/` changes — so the pre-push probe of `/api/tax` was already `404` (the route deletion from plan 18-03 had already been deployed by the orchestrator's push before this plan started, at commit `56e8309`).

| Check | Before this push | After this push's deploy landed |
|---|---|---|
| `POST /api/tax` | 404 | 404 (unchanged — already deleted) |
| `GET /` (site root) | — | 200 |
| `wrangler deployments list` | latest at `2026-09-11T12:26:57.072Z`, version `9cf41e37-a8bb-4e7c-8d32-3e80ac5293da` | new deploy at `2026-09-11T12:34:05.247Z`, version `05950b43-3948-4c27-b645-6cb16d0b27aa` |

Cloudflare Workers Builds triggered a fresh build+deploy on the docs-only push (any push to `main` triggers it), reached live within ~7 minutes of the push, and re-confirmed the same production state. No secret, database row, order, or customer record was read. No deploy or migration command was run locally — `git push origin main` was the only trigger.

## Files Created/Modified

- `.planning/WINDOWS.md` — entries 2, 5, 6 flipped to `fixed` with `resolved_at` timestamps; entries 10, 12 confirmed unchanged
- `.planning/todos/pending/theme-metadata-industry-synopsis-admin.md` → `.planning/todos/completed/` — closed via `gsd-tools todo complete`
- `.planning/todos/pending/migration-0023-duplicate-number.md` → `.planning/todos/completed/` — closed via `gsd-tools todo complete`
- `.planning/REQUIREMENTS.md` — all 8 DEBT checkboxes and traceability rows flipped to complete
- `.planning/ROADMAP.md` — Phase 18 plan checkboxes, phase-list line, and Progress table row updated by scoped edit

## Decisions Made

See `key-decisions` in frontmatter: the D-10 ratification (flagged for Russell), the entry-2 code-level-evidence closing convention, and the discovered-and-reverted cf-typecheck false fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, caught before commit] Refined the cf-typecheck env-file isolation recipe**
- **Found during:** Task 2 (gate suite)
- **Issue:** The recorded project lesson said moving `.env.local` aside before `cf-typegen` was sufficient to match CI's no-env-file baseline. It is not — `wrangler types --strict-vars false` also infers var types from `.dev.vars`, so a first regeneration attempt produced a spurious diff adding four gift-card key declarations that exist locally but not in CI.
- **Fix:** Reverted the spurious diff with `git checkout -- cloudflare-env.d.ts` before committing anything. Moved `.dev.vars` aside alongside `.env.local`, regenerated again, got a zero-diff match against the already-committed file, and `cf-typecheck` passed clean. Restored both files immediately after.
- **Files modified:** None — the committed `cloudflare-env.d.ts` was already correct; no file changed as a result of this finding.
- **Verification:** `npm run cf-typecheck` passed clean after the correct regeneration.
- **Committed in:** N/A (no code change; documented as a process finding for future runs)

---

**Total deviations:** 1 auto-caught-and-reverted (no committed code change). **Impact on plan:** None on shipped code — this was a local tooling-isolation nuance caught before it could produce a false commit. Documented so the next phase's gate run does the two-file move from the start.

## Issues Encountered

None beyond the cf-typecheck isolation nuance documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 18 (Tech-Debt Closure) is complete: all 8 DEBT requirements shipped and verified, the broken-windows ledger is down to 5 open entries (4, 7, 8, 9, 11 — none owned by this phase), and production reflects the phase's only externally-visible change (the deleted `/api/tax` route).

**For Russell:**
- The D-10 gift-note ratification above is a product decision this run answered by default. Override it if the pre-fix pending-delivery behavior should differ.
- Phase 19 (Operator Checklist) is next — it needs Russell signed into the Stripe and Cloudflare dashboards; nothing in it can run unattended.
- Broken-windows entries 4, 7, 8, 9, 11 remain open, none owned by Phase 18 — they carry forward as-is.

## Self-Check: PASSED

- `.planning/phases/18-tech-debt-closure/18-07-SUMMARY.md` exists on disk.
- `git log --oneline --all --grep="18-07"` returns 2 commits (`24fb341`, `c5b29e5`).
- All three tasks' literal `<verify>` blocks re-run and passed (see Gate Suite Results and Production Deploy sections above).
- All plan-level `<success_criteria>` re-confirmed: ledger entries 2/5/6/10 fixed and none deleted; both todos closed; D-10 recorded; all 8 DEBT requirements complete in both surfaces; full gate suite green; production serves 404 for the deleted route, 200 for the root, and a new Worker version is live.

---
*Phase: 18-tech-debt-closure*
*Completed: 2026-09-11*
