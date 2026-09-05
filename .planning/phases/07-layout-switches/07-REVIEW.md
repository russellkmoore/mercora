---
phase: 07-layout-switches
reviewed: 2026-09-05T15:30:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - components/admin/LayoutSwitches.tsx
  - components/admin/ThemePresetGrid.tsx
  - components/admin/roving-index.ts
  - tests/unit/app/admin-layout-switches-source.test.ts
  - tests/unit/components/admin/roving-index.test.ts
  - tests/unit/app/admin-appearance-source.test.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 07: Layout Switches — Code Review Report (Iteration 2 — re-review after fixes)

**Reviewed:** 2026-09-05T15:30:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found (Info only — no Critical or Warning findings remain)

## Summary

Re-reviewed the two findings the gsd-code-fixer reported fixing in iteration 1 (WR-01, WR-02), plus the two new/modified files that resulted (`components/admin/roving-index.ts`, `tests/unit/components/admin/roving-index.test.ts`) and the two modified test files. Both are genuinely resolved, not just cosmetically addressed:

**WR-01 (partial-key save) — confirmed resolved.** `save()` in `components/admin/LayoutSwitches.tsx:342-406` now filters `SWITCH_GROUPS` down to `dirtyGroups` (`pending[group.id] !== undefined && pending[group.id] !== saved?.[group.id]`) and POSTs only those keys. Traced all three edge cases directly against the code:
- **Zero keys changed:** `if (dirtyGroups.length === 0) return;` fires before `setSaving(true)` or any fetch — no request, no state churn. (In practice `onSave` is also gated by the identical `isDirty` check in `LayoutSwitchesContent`, so this path is a defensive backstop, not the primary guard — reviewed and confirmed both checks use the exact same predicate, so they can't diverge.)
- **POST fails (`!response.ok`):** throws, caught by the `catch` block, `toast.error(...)`, `finally` resets `saving`. Neither `saved` nor `pending` state is touched on this path — a failed save leaves the UI exactly as the admin left it, so a retry is safe and no partial/incorrect state is displayed.
- **Per-key state merge:** verified against the actual settings endpoint (`app/api/admin/settings/route.ts:146-148`) that `updatedKeys = updates.map(u => u.key)` and the response's `settings` array is filtered with `inArray(admin_settings.key, updatedKeys)` — i.e. the response really does only echo back the keys this specific request sent, confirming the code comment's load-bearing assumption. The merge (`components/admin/LayoutSwitches.tsx:382-393`) then gates every field by `dirtyIds.has(...)`, falling back to the pre-save `saved` value for anything not sent. This makes the merge correct even if that server-echo assumption were ever wrong — an untouched group is never overwritten regardless of what the response contains, because it's never read for that field.

**WR-02 (shared roving-tabindex helper) — confirmed resolved.** `components/admin/roving-index.ts` is a new 12-line pure module; `git show bcc6f29` confirms `ThemePresetGrid.tsx`'s change is exactly a 6-line-added/7-line-removed import + re-export swap with the function body itself deleted from that file — zero logic change. `tests/unit/components/admin/roving-index.test.ts` asserts `themeGridNextRovingIndex === layoutSwitchesNextRovingIndex === nextRovingIndex` via `toBe` (reference identity, not just behavioral equivalence), which is the strongest form of the parity guarantee the original finding asked for.

Ran the full scoped suite plus `tsc --noEmit` and `eslint` against all six files in scope: 49 tests pass, no type errors, no lint errors.

No new issues found in the changed/added code. IN-01, IN-02, IN-03 from iteration 1 are carried forward unchanged below — none were in scope for this fix (Info findings are out of scope for `critical_warning`-tier auto-fix per the fix report), and this re-review's scope (the 6 files listed above) doesn't touch the files those three findings point at, so their status is unchanged/unverified this round.

## Info

### IN-01: `productGallery` remains an optional prop with a default long after its only real caller always supplies it

**File:** `app/product/[slug]/ProductDisplay.tsx:116, 139`
**Issue:** Carried forward from iteration 1 — not in scope for this re-review (not among the 6 files listed in config). See 07-REVIEW.md iteration 1 for full detail: the optional/default path is dead in production and only reachable from tests, now that `app/product/[slug]/page.tsx` always passes the prop.
**Fix:** Make `productGallery: ProductGallery` required, dropping the `DEFAULT_LAYOUTS.productGallery` fallback, unless a design reason still requires omission.

### IN-02: Two independent, differently-behaved image-URL resolvers now coexist for the same product-image concept

**File:** `components/layout/product/gallery-media-url.ts` vs `lib/utils/product-image.ts` (`resolveProductImageSrc`)
**Issue:** Carried forward from iteration 1 — not in scope for this re-review. Deliberate/tracked as a known follow-up per the file's own comment (07-RESEARCH.md Open Question 1); flagging only so it isn't lost.
**Fix:** No action required now.

### IN-03: Pre-extraction parity tests self-write their baseline if the snapshot file is missing

**File:** `tests/unit/components/layout/category/category-grid3-parity.test.ts:65-68` (same pattern in the home/product suites)
**Issue:** Carried forward from iteration 1 — not in scope for this re-review. Latent risk only: an accidentally-deleted snapshot would silently re-record rather than fail loudly.
**Fix:** No change required for this phase. Consider having the test fail (not write) when the snapshot is missing, outside an explicit `UPDATE_SNAPSHOTS=1` escape hatch.

---

_Reviewed: 2026-09-05T15:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
