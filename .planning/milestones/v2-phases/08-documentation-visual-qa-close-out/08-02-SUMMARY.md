---
phase: 08-documentation-visual-qa-close-out
plan: 02
subsystem: docs
tags: [theming, css-custom-properties, next-font, documentation, claim-check]

requires:
  - phase: 08-documentation-visual-qa-close-out
    provides: "08-01's docs/theming.md tracer (H1, status line, section 0 admin-switching, section 1 the 23-token contract table) and its grep-based claim-check method"
provides:
  - "docs/theming.md sections 2-9: theme-file anatomy, a five-step duplication recipe, the validator's rejection table, resolution order, the admin surface, the layout switches, the two gates plus the screenshot harness, and known limits/backlog"
  - "docs/CLAUDE.md with corrected styling claims, theme/layout paths spliced into the structure tree, both gates named in Build Commands, and a link to docs/theming.md"
  - "README.md docs-index bullet and docs/runtime-configuration.md's Theme row, both pointing at docs/theming.md"
affects: [08-04, 08-05]

actuals:
  tokens: 6600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Two-sided grep claim-check extended from 08-01 across a full 9-section document: every quoted validator message, setting key, enum member, telemetry name, and gate command is asserted byte-identical against its own source file, not just spot-checked"
    - "Link-check pass: every backtick-quoted relative path in a doc is asserted to exist on disk via `test -e`, run as a single pass after all prose edits land"

key-files:
  created: []
  modified:
    - docs/theming.md
    - docs/CLAUDE.md
    - README.md
    - docs/runtime-configuration.md

key-decisions:
  - "The 'five of seven presets need a contrast correction' framing in the plan's action text is imprecise: volt-dark predates docs/voltique-theme-direction.md entirely (it's the store's original look, relocated verbatim, not converted), so only six presets were actually converted from the direction doc, and of those six, five needed a correction and retro needed none. Wrote the callout to state this precisely rather than repeat the plan's looser phrasing, per the executor notes' instruction to trust the files over planning-doc prose."
  - "docs/CLAUDE.md's Project Structure tree had no existing `scripts/` entry to splice the three theme/QA scripts under (unlike RESEARCH's assumption) — added a new top-level `scripts/` entry rather than inventing a false 'existing' one, matching the tree's established glyph/comment-alignment style."
  - "Fixed the plan's own <verify> scripts at execution time (not by editing PLAN.md): `/usr/bin/grep -qF \"$s\"\" fails on macOS/BSD-compatible grep whenever a literal pattern starts with `--` (e.g. `--manifest`), because grep treats it as an unrecognized option even under `-F`. Reran every check with an explicit `--` end-of-options marker (`grep -qF -- \"$s\"`), which is semantically identical byte-for-byte matching — confirmed all content checks pass under the corrected invocation."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "docs/theming.md sections 2-4 (theme-file anatomy, five-step duplication recipe, validator rejection table) let a developer duplicate a theme and diagnose any validator failure without reading scripts/build-themes.mjs"
    requirement: "DOCS-01"
    verification:
      - kind: other
        ref: "Task 1's two automated grep loops (14 validator messages + 3 command/CI-step strings) — all pass, byte-identical to scripts/build-themes.mjs and .github/workflows/ci.yml"
        status: pass
    human_judgment: true
    rationale: "Prose quality and recipe clarity are judgment calls the verifier should sanity-check by reading the file, even though every quoted string already passes an automated grep."
  - id: D2
    description: "docs/theming.md sections 5-9 (resolution order, admin surface, layout switches, the two gates + screenshot harness, known limits) document the full runtime and build-time mechanism, stating plainly that scan:tokens is not CI-wired"
    requirement: "DOCS-01"
    verification:
      - kind: other
        ref: "Task 2's two automated grep loops (16 keys/enums/commands + dev-bypass-absence + backlog-file-existence) — all pass"
        status: pass
    human_judgment: true
    rationale: "Same as D1 — content is machine-verified, overall readability and section-order fidelity to 08-UI-SPEC.md's nine-section contract is a human sanity-check."
  - id: D3
    description: "docs/CLAUDE.md no longer claims a hardcoded dark background or dark-by-default look; its structure tree names the theme/layout directories and three scripts; its Build Commands section names both gates and states which runs in CI; README.md and docs/runtime-configuration.md link/name the theming doc; every relative path docs/theming.md cites resolves to a real file"
    requirement: "DOCS-01"
    verification:
      - kind: other
        ref: "Task 3's negative-claim grep (0 occurrences of '#000000' or 'dark theme by default' in docs/CLAUDE.md), positive-claim grep (12/12 required strings present), and link-check (32 backtick-quoted relative paths in docs/theming.md, 0 broken, well over the 10-path floor)"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 2: docs/theming.md sections 2-9 and docs/CLAUDE.md truth-correction Summary

Completed `docs/theming.md` (326 lines) with the theme-file anatomy, a five-step duplication
recipe, the validator's rejection table, resolution order, the admin surface, the layout switches,
both build gates plus the screenshot harness's `--manifest` footgun, and a six-row known-limits
table — then corrected `docs/CLAUDE.md`'s two stale styling claims, spliced the theme/layout paths
into its structure tree, and linked the new document from three places, proving every quoted string
and cited path against the repository by grep rather than by reading.

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-05T16:29:00Z
- **Completed:** 2026-09-05T16:43:00Z
- **Tasks:** 3 completed
- **Files modified:** 4

## Accomplishments
- `docs/theming.md` grew from 81 lines (08-01's tracer) to 326 lines, completing all nine sections
  D-01 specifies — every validator error message, setting key, enum member, telemetry name, and
  gate command is a grep-verified, byte-identical quote from the file it came from, not a
  paraphrase.
- Documented the real font-loading bug/fix from Phase 6.1 (a nested `var()` reference resolves at
  its declaring element, not its consuming element) as a stated rule in the theme-file-anatomy
  section, since it's load-bearing for anyone adding a new display-face theme.
- Corrected `docs/CLAUDE.md`'s two stale styling claims (`background: #000000` and "dark theme by
  default"), added a `scripts/` entry to its Project Structure tree (none existed to splice under),
  and named both gates in Build Commands with a sentence stating which runs in CI.
- Linked `docs/theming.md` from `docs/CLAUDE.md`'s Important Files list, README.md's docs index,
  and added `NEXT_PUBLIC_THEME_DEFAULT` to `docs/runtime-configuration.md`'s Theme row.
- Ran the full claim check and link check as one pass: every quoted literal cross-checked against
  its source file, and all 32 backtick-quoted relative paths in `docs/theming.md` resolved to real
  files on disk (0 broken links).

## Task Commits

Each task was committed atomically:

1. **Task 1: Theme-file anatomy, duplication recipe, validator rejections** - `b179018` (docs)
2. **Task 2: Resolution order, admin surface, layout switches, gates, known limits** - `d0a1d24` (docs)
3. **Task 3: Correct docs/CLAUDE.md, link README/runtime-configuration, claim-check + link-check** - `3fa0589` (docs)

**Plan metadata:** commit to follow (docs: complete plan)

## Files Created/Modified
- `docs/theming.md` - Appended sections 2 through 9 (245 new lines) below 08-01's H1/status/section-0/section-1.
- `docs/CLAUDE.md` - Replaced two stale styling bullets; spliced `themes/`, `lib/themes/`, `lib/layout/`, `components/layout/`, two admin components, and a new `scripts/` entry into the structure tree; added both gate commands to Build Commands; linked `docs/theming.md` from Important Files to Reference.
- `README.md` - Added a `docs/theming.md` bullet to the Technical Documentation docs index.
- `docs/runtime-configuration.md` - Added `NEXT_PUBLIC_THEME_DEFAULT` to the Theme row, alongside the existing `NEXT_PUBLIC_STORE_LOGO_PATH`.

## Decisions Made
- The "five of seven presets need correction" callout is scoped precisely to the six presets actually converted from `docs/voltique-theme-direction.md` (volt-dark predates that document and was relocated verbatim, not converted); `retro` is named as the one converted preset needing no correction.
- Added a `scripts/` entry to `docs/CLAUDE.md`'s structure tree rather than assuming one existed, since a grep confirmed none was present — matches the tree's existing glyph/comment-alignment convention.
- Corrected the plan's own `<verify>` grep invocations at execution time (adding a `--` end-of-options marker before each literal pattern) after confirming macOS/BSD-compatible grep rejects `--manifest` as an unrecognized flag even under `-F`; the underlying content was unaffected — this is a shell-portability issue in the verify script, not a documentation defect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Task 2's second `<verify>` automated check fails under macOS grep due to a literal `--manifest` pattern**
- **Found during:** Task 2, running the plan's own automated verify block
- **Issue:** `/usr/bin/grep -qF "$s" docs/theming.md` fails with `grep: unrecognized option '--manifest'` whenever `$s` is the literal string `--manifest`, because grep's option parser treats a leading `--` as an option marker even when `-F` (fixed-string) is set. This is a BSD-grep-and-GNU-grep-shared behavior, not macOS-specific, and would fail identically for any executor running this exact verify block on any platform.
- **Fix:** Reran the check with `grep -qF -- "$s"`, adding the standard `--` end-of-options marker before the pattern. This is byte-for-byte the same substring match the plan intended; only the shell invocation needed the fix. All 16 required strings (plus the two trailing source-file greps) pass.
- **Files modified:** None — this was a verify-invocation fix, not a content or PLAN.md change.
- **Verification:** Reran the corrected check; all patterns found in `docs/theming.md`, both trailing source-file greps pass.
- **Committed in:** N/A (verification-only; no file change required)

---

**Total deviations:** 1 auto-fixed (Rule 3 — verify-script shell portability).
**Impact on plan:** None on content; the documented facts and quoted strings are unaffected. The plan's own `<verify>` block has a latent portability bug worth fixing at the source (adding `--` before grep patterns) if this plan is ever re-run verify-only.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

`docs/theming.md` is complete through section 9 (326 lines, exceeding the 250-line floor). Section
8's screenshot-harness paragraph and section 9's known-limits table both leave the QA-matrix-summary
subsection and any new close-out findings as absent (not placeholder headings), ready for 08-04 and
08-05 to append without touching anything this plan wrote. `docs/CLAUDE.md`, `README.md`, and
`docs/runtime-configuration.md` all now point at an accurate, machine-verified theming document. No
blockers.

`DOCS-01` is declared by this plan and by sibling plans in this phase that have not yet produced a
SUMMARY (per the shared-ID gate, checked via `requirements.ready-ids` during state update below).

---
*Phase: 08-documentation-visual-qa-close-out*
*Completed: 2026-09-05*

## Self-Check: PASSED

- `docs/theming.md` — FOUND (326 lines)
- `docs/CLAUDE.md` — FOUND, negative claims absent, positive claims present
- `README.md` — FOUND, docs/theming.md bullet present
- `docs/runtime-configuration.md` — FOUND, NEXT_PUBLIC_THEME_DEFAULT present
- Commit `b179018` (docs) — FOUND in git log
- Commit `d0a1d24` (docs) — FOUND in git log
- Commit `3fa0589` (docs) — FOUND in git log
- Task 1 verify: both automated grep loops pass (14 validator messages + 3 command/CI strings, all byte-identical to source)
- Task 2 verify: both automated grep loops pass (16 keys/enums/commands + dev-bypass-absence + backlog-file-existence)
- Task 3 verify: negative-claim grep clean, 12/12 positive-claim strings present, link-check 32/32 paths resolve (0 broken)
- No development bypass value (`mercora-dev-bypass`) found in any of the four touched files
