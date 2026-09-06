---
phase: 07-layout-switches
fixed_at: 2026-09-05T15:08:39Z
review_path: .planning/phases/07-layout-switches/07-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 07: Layout Switches — Code Review Fix Report

**Fixed at:** 2026-09-05T15:08:39Z
**Source review:** .planning/phases/07-layout-switches/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (WR-01, WR-02 — no Critical findings; Info findings out of scope for `critical_warning`)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Saving one layout switch silently re-writes the other two, widening the concurrent-admin overwrite window

**Files modified:** `components/admin/LayoutSwitches.tsx`, `tests/unit/app/admin-layout-switches-source.test.ts`
**Commit:** `ac31bd0`
**Applied fix:** `save()` now filters `SWITCH_GROUPS` down to `dirtyGroups` (only groups where `pending[group.id]` is set and differs from `saved?.[group.id]`) and POSTs only those keys, matching `ThemePresetGrid`'s single-key POST precedent. Because the settings endpoint's response only echoes back the keys a given request sent (`inArray(admin_settings.key, updatedKeys)`), the post-save state update was also changed from a blind `setSaved(extractLayoutSelections(body.settings))` (which would have silently defaulted the two untouched groups) to a merge that updates only the dirty groups' values in `saved` state, leaving untouched groups exactly as they were. `setPending` likewise clears only the keys that were sent, not the whole object. Updated the existing source-level test that asserted "sends exactly three updates" to instead assert the filter/merge logic is present, and added a second source-level test covering the confirmed-value merge.

### WR-02: `nextRovingIndex` is duplicated verbatim from `ThemePresetGrid.tsx` with no parity test guarding the two copies

**Files modified:** `components/admin/roving-index.ts` (new), `components/admin/LayoutSwitches.tsx`, `components/admin/ThemePresetGrid.tsx`, `tests/unit/components/admin/roving-index.test.ts` (new)
**Commit:** `bcc6f29`
**Applied fix:** Extracted the roving-tabindex helper into a new shared module, `components/admin/roving-index.ts`. Both `LayoutSwitches.tsx` and `ThemePresetGrid.tsx` now `import { nextRovingIndex } from "./roving-index"` and `export { nextRovingIndex }` — a pure import swap in `ThemePresetGrid.tsx` with zero behavior change, verified by its existing test suite (`tests/unit/app/admin-appearance-source.test.ts`, which imports `nextRovingIndex` directly from `ThemePresetGrid` and still passes unmodified) continuing to pass, satisfying the phase's prohibition on modifying `ThemePresetGrid`'s behavior/UI while allowing this one-line import change. Added `tests/unit/components/admin/roving-index.test.ts`, which exercises the shared function directly and asserts both files' re-exports are the exact same function reference (`toBe`), not merely behaviorally identical copies — closing the parity gap the finding called out.

## Skipped Issues

None — both in-scope findings were fixed.

## Verification

Ran after each fix and again at the end (main checkout — `workflow.use_worktrees` is `false` for this project, so no isolated worktree was used; edits and commits were made directly on `main`):

- `npx tsc --noEmit` — clean, no errors in any modified file.
- `npx eslint` on all modified/new files — clean.
- `npm run scan:tokens` — `0 violations`.
- `npx vitest run` (full suite) — `259 files passed, 2130 tests passed`.
- `npm run build` — succeeded.

---

_Fixed: 2026-09-05T15:08:39Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
