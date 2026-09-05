---
phase: 07-layout-switches
reviewed: 2026-09-05T09:23:37Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - app/admin/settings/appearance/page.tsx
  - app/category/[slug]/CategoryDisplay.tsx
  - app/category/[slug]/page.tsx
  - app/page.tsx
  - app/product/[slug]/ProductDisplay.tsx
  - app/product/[slug]/page.tsx
  - components/admin/LayoutSwitches.tsx
  - components/layout/category/CategoryGrid2.tsx
  - components/layout/category/CategoryGrid3.tsx
  - components/layout/category/CategoryList.tsx
  - components/layout/category/category-layout-map.ts
  - components/layout/home/HomeHeroFullBleed.tsx
  - components/layout/home/HomeHeroMinimal.tsx
  - components/layout/home/HomeHeroSplit.tsx
  - components/layout/home/home-hero-map.ts
  - components/layout/product/ProductGalleryLeft.tsx
  - components/layout/product/ProductGalleryTop.tsx
  - components/layout/product/gallery-media-url.ts
  - lib/layout/settings.ts
  - lib/layout/variants.ts
  - lib/observability/telemetry.ts
  - tests/unit/app/admin-layout-switches-source.test.ts
  - tests/unit/app/layout-switch-contract.test.ts
  - tests/unit/components/layout/category/category-grid3-parity.test.ts
  - tests/unit/components/layout/category/category-variants.test.ts
  - tests/unit/components/layout/category/fixtures.ts
  - tests/unit/components/layout/home/home-hero-variants.test.ts
  - tests/unit/components/layout/product/product-gallery-variants.test.ts
  - tests/unit/lib/layout/settings.test.ts
  - tests/unit/lib/layout/variants.test.ts
  - tests/unit/workers/observability-tail-core.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 07: Layout Switches — Code Review Report

**Reviewed:** 2026-09-05T09:23:37Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Reviewed the three layout-switch enums/resolver, the eight named variant components and their three typed lookup maps, the two server pages that resolve an enum server-side, the `LayoutSwitches` admin island, and the accompanying test suite (175 tests across 9 files, all passing; `tsc --noEmit` and `eslint` both clean on every file in scope).

The security-sensitive surface holds up well: every stored value is validated by array-membership (`Array.prototype.includes`), never by indexing an object with an untrusted string, so a `__proto__`/`hasOwnProperty`/`constructor` stored value cannot reach a lookup map or resolve through the prototype chain — confirmed both by direct reading and by the dedicated tests in `tests/unit/lib/layout/settings.test.ts`. Telemetry on an unknown selection carries only `{ outcome: "invalid" }`, never the stored string. Both image-bearing home heroes source their image exclusively through `resolveProductImageSrc`. No `dangerouslySetInnerHTML`, no `eval`, no hardcoded secrets, no debug artifacts (`console.log`/`TODO`/`FIXME`) anywhere in the reviewed files. The RSC boundary is respected: enum values, never component references, cross into client components; `CategoryDisplay`'s own map lookup (rather than receiving a component prop) is the correct workaround for the "can't pass a function across the server/client boundary" constraint, and is exercised by a passing test. `getLayoutSettings()` degrades to the three defaults on a D1 read failure, matching `getActiveTheme()`'s posture, and holds no module-level state (asserted by a repo-wide grep-based test).

Two behavioral issues are worth fixing before this ships further, both in `components/admin/LayoutSwitches.tsx`: the save handler always overwrites all three settings keys (not just the one the admin actually changed), which is a new, more exposed lost-update surface than the single-key pattern `ThemePresetGrid` uses today; and the roving-tabindex math is a second, untested-for-drift copy of `ThemePresetGrid`'s own helper rather than a shared import.

## Warnings

### WR-01: Saving one layout switch silently re-writes the other two, widening the concurrent-admin overwrite window

**File:** `components/admin/LayoutSwitches.tsx:344-352`
**Issue:** `save()` builds `updates` from all three `SWITCH_GROUPS` unconditionally, and for any group the admin did *not* touch it falls back to `saved?.[group.id]` (the value loaded when this island's own `useEffect` fetch resolved):

```ts
const updates = SWITCH_GROUPS.map((group) => {
  const value = pending[group.id] ?? saved?.[group.id] ?? DEFAULT_LAYOUTS[group.id];
  return { key: group.key, value, category: APPEARANCE_SETTINGS_CATEGORY, data_type: "string" };
});
```

Every save POSTs all three keys, and the settings API (`/api/admin/settings`) writes every key it receives, last-write-wins, per-key. Contrast with `ThemePresetGrid.tsx`'s `save()`, which POSTs a single `updates` entry containing only the one key that changed. If admin session A loads the page, then admin session B changes `homeHero` and saves, then admin session A (still holding its stale initial `saved.homeHero`) changes only `categoryLayout` and saves, session A's save silently reverts B's `homeHero` change back to the value A loaded at page-open — a lost update on a field A never touched or saw change. `ThemePresetGrid`'s single-key POST pattern does not have this exposure at all, since it only ever writes the one field a save actually changed.

This is a real, provable regression relative to the codebase's existing precedent for the same kind of admin single-value save, not a hypothetical — the settings endpoint is confirmed last-write-wins per-key (see the POST handler's per-`update` write loop), and this island is the first place in the codebase to bundle three independently-editable settings into one all-or-nothing multi-key save.

**Fix:** Only include a group in `updates` when it is actually dirty (i.e., `pending[group.id] !== undefined && pending[group.id] !== saved?.[group.id]`), mirroring `isDirty`'s own per-group check:

```ts
const updates = SWITCH_GROUPS.filter(
  (group) => pending[group.id] !== undefined && pending[group.id] !== saved?.[group.id],
).map((group) => ({
  key: group.key,
  value: pending[group.id]!,
  category: APPEARANCE_SETTINGS_CATEGORY,
  data_type: "string",
}));
```
(The existing `tests/unit/app/admin-layout-switches-source.test.ts` assertion "sends exactly three updates in one request" will need updating to assert only-the-changed-keys instead.)

### WR-02: `nextRovingIndex` is duplicated verbatim from `ThemePresetGrid.tsx` with no parity test guarding the two copies

**File:** `components/admin/LayoutSwitches.tsx:109-112` (compare `components/admin/ThemePresetGrid.tsx`)
**Issue:** The roving-tabindex math is copied character-for-character into this file's own exported `nextRovingIndex`, per the file's own comment ("Copied verbatim from ThemePresetGrid.tsx"). Both copies are unit-tested independently (`tests/unit/app/admin-appearance-source.test.ts` and `tests/unit/app/admin-layout-switches-source.test.ts`), but nothing asserts the two implementations stay behaviorally identical — a future keyboard-nav bugfix applied to one (e.g., adding Home/End support, or fixing a wrap-around edge case) can silently diverge from the other with no test failure to catch it.
**Fix:** Extract the function to a small shared module (e.g. `lib/ui/roving-tabindex.ts`) and import it from both `ThemePresetGrid.tsx` and `LayoutSwitches.tsx`, or, if the jsdom-less test constraint genuinely requires each file to export its own copy, add a parity test (e.g. in the repo-wide `layout-switch-contract.test.ts`) that imports both and asserts identical output across a representative input matrix.

## Info

### IN-01: `productGallery` remains an optional prop with a default long after its only real caller always supplies it

**File:** `app/product/[slug]/ProductDisplay.tsx:116, 139`
**Issue:** The prop's own doc comment says the optional-with-`DEFAULT_LAYOUTS` fallback exists "only because `app/product/[slug]/page.tsx`'s own wiring is Task 3's job in this plan; every real call site passes it." Task 3 has since landed (`app/product/[slug]/page.tsx:97` passes `productGallery={productGallery}`), and grepping the repo shows exactly one production call site, which always supplies the prop. The optional/default path is now dead in production and only reachable from tests.
**Fix:** Make `productGallery: ProductGallery` required now that the real wiring exists, dropping the `DEFAULT_LAYOUTS.productGallery` fallback; keep it only if a design reason still requires callers to be able to omit it.

### IN-02: Two independent, differently-behaved image-URL resolvers now coexist for the same product-image concept

**File:** `components/layout/product/gallery-media-url.ts` vs `lib/utils/product-image.ts` (`resolveProductImageSrc`)
**Issue:** `getMediaUrl` (used by both product gallery variants) and `resolveProductImageSrc` (used by both home hero variants and `CategoryList`) both resolve a product/media image URL from the same two possible stored shapes, but do not normalize identically (per this file's own comment, "the two helpers do not normalise identically"). This is called out as deliberate today (byte-identical extraction obligation) with a note that the swap is "a separate cleanup for a later phase," but it means the same underlying data shape is now interpreted by two independently-maintained functions — a future fix to one shape-handling edge case (e.g., a new media record variant) applied to `resolveProductImageSrc` will not automatically reach the product gallery's images, and vice versa.
**Fix:** No action required now — this is already tracked as a known follow-up per the file's own comment (07-RESEARCH.md Open Question 1). Flagging here only so it isn't lost when a future phase edits either helper.

### IN-03: Pre-extraction parity tests self-write their baseline if the snapshot file is missing

**File:** `tests/unit/components/layout/category/category-grid3-parity.test.ts:65-68` (same pattern in the home/product suites)
**Issue:** If `category-display-grid3.html` (or the two `.txt` recordings) were ever missing on disk when the suite runs, the test writes the file from the *current* render before comparing, so it always passes rather than failing loudly on the missing frozen baseline. Verified today that all three snapshot files are committed to git (in commits `750c065`, `c6ef42d`, `58b667d`, each predating the corresponding extraction), so this is not an active defect. It is a latent one: a future accidental deletion of a snapshot file (bad `git clean -f`, a `.gitignore` misconfiguration, etc.) would silently regenerate a new "verbatim" baseline from whatever the source looks like at that moment, defeating the entire point of the parity gate without any test failure to surface it.
**Fix:** No change required for this phase. Consider, in a later cleanup, having the test fail (rather than write) when the snapshot is missing outside of an explicit `UPDATE_SNAPSHOTS=1` escape hatch, so an accidentally-deleted baseline is caught rather than silently re-recorded.

---

_Reviewed: 2026-09-05T09:23:37Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
