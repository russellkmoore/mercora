---
phase: 06-theme-file-mechanism-presets
verified: 2026-09-04T21:15:00Z
status: passed
score: 15/17 must-haves verified
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "Two concurrent requests during an admin save each render a valid theme (either the old one or the new one); no request renders a mixed or missing theme, because resolution is one read per request with no shared cache. (06-02 must_haves, verification: backstop)"
    test: "Fire two overlapping HTTP requests to the storefront while an admin save is landing mid-flight (or a unit-level equivalent that interleaves two getActiveTheme() calls around a mocked settings-write race), and read the resolved theme name each request actually stamped on <html>."
    expected: "Each request resolves to either the pre-save or the post-save theme name — never a torn/mixed value, and never a throw."
    why_human: "No test exercises concurrency; the current evidence is structural only (grep-verified absence of module-scope state, unstable_cache, and React.cache in lib/themes/active-theme.ts). That proves the resolver holds no cross-request state, which makes the claim plausible, but presence/absence of a caching primitive is not the same as an observed concurrent-request outcome — the PLAN itself tags this truth `verification: backstop`, meaning it was flagged by the planner as needing more than static analysis."
  - truth: "The grid behaves as a radio group for assistive technology — arrow keys move the selection, space/enter selects — and the synopsis clamps to three lines with label ellipsis truncation, so cards keep uniform height. (06-04 must_haves, verification: backstop, x2)"
    test: "In a real browser with the admin Appearance page open, tab to the grid, drive it with arrow/space/enter keys and a screen reader, and visually confirm synopsis clamping/label truncation at real card widths with real theme metadata strings."
    expected: "Arrow keys move both DOM focus and the checked radio; space/enter selects; every card renders at a uniform height regardless of a long synopsis or label."
    why_human: "tests/unit/app/admin-appearance-source.test.ts is a source-text grep (confirms `role=\"radiogroup\"`, `aria-checked`, and `line-clamp-3` appear in the file) — it proves the attributes are present in source, not that arrow-key focus movement or CSS clamping actually behaves correctly at runtime. No Clerk-authenticated session exists in this environment to drive the real page (already logged as WINDOWS #2)."
gaps: []
deferred: []
coincidental_reliance_items: []
human_verification:
  - test: "Fire two overlapping requests around a concurrent admin theme save (or a unit test that interleaves two getActiveTheme() calls with a mocked settings race) and confirm neither request renders a mixed/missing theme."
    expected: "Every concurrent request resolves to a valid manifest theme name; none throws, none renders an empty or malformed data-theme attribute."
    why_human: "PLAN-tagged `verification: backstop`; only structural (no-cache) evidence exists today, no behavioral/concurrency test."
  - test: "Sign in to admin with a real Clerk session, open /admin/settings/appearance, click a non-active card, confirm the ring appears without moving the Active badge, Save, confirm the toast text and badge move, then tab through the grid with arrow keys and space/enter."
    expected: "Ring-vs-badge distinction holds until save; toast reads the UI-SPEC copy verbatim; keyboard radiogroup navigation works; grid renders responsively with 8 hub tabs wrapped."
    why_human: "No Clerk session is available in this environment (documented in WINDOWS #2 and in the phase's own environment notes); the API-level proof (POST via x-dev-admin bypass header, confirmed data-theme flip) validates the save mechanism but not the visual/interaction/accessibility behavior."
  - test: "With the light preset (luxe) active and a real Clerk session / seeded checkout, open the OrderConfirmationModal (Dialog) and an admin confirmation AlertDialog directly, and judge whether the bg-black/80 and bg-black/50 backdrops now correctly recede the content behind them."
    expected: "Both scrims read as a dark, content-obscuring backdrop, consistent with the Sheet overlay's live-verified fix."
    why_human: "Dialog requires a completed Stripe checkout (fails locally, a known Phase 5 gap) and AlertDialog is admin-only (no Clerk session); 06-05 substituted a live-DOM compositing-injection test against the real compiled CSS rather than a live trigger for these two of the four scrim sites. The fix is the same class/mechanism already live-verified on Sheet, but these two sites themselves were not seen rendering live."
---

# Phase 6: Theme File Mechanism + Presets Verification Report

**Phase Goal:** A theme is a self-contained CSS file that can be added or swapped without touching component code; admins choose among shipped presets with swatch previews, and an invalid theme file cannot reach production.
**Verified:** 2026-09-04T21:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running the real deploy build (`build:worker`) against a deliberately broken theme file fails the build, and `predev` runs the same scan | ✓ VERIFIED | Independently reproduced: deleted `--store-primary` from `themes/volt-dark.css`, ran `mise exec -- npm run build:worker`, got exit 1 with the log ending at `[build-themes] themes/volt-dark.css:12: missing required token "--store-primary"` / `[build-themes] ABORT: 1 error(s).` — zero further output from the Cloudflare builder. File restored, `git status` clean. `package.json` confirmed: `predev` and `build:worker` both literally prepend `node scripts/build-themes.mjs`; no `prebuild` key exists. |
| 2 | `getActiveTheme()` resolves `admin_settings` → `NEXT_PUBLIC_THEME_DEFAULT` env → manifest default, blocking server-side in the root layout (no FOUC, no Suspense, no isolate cache); an unknown stored theme name falls back and emits a telemetry event present in both `commerce.telemetry.v1` parity files | ✓ VERIFIED (see note) | `app/layout.tsx:149` — `const activeTheme = await getActiveTheme();` sits directly in the async component body, above the returned tree, outside both of the file's `<Suspense>` boundaries (grep-confirmed); `data-theme={activeTheme}` on `<html>` (no literal string remains). `lib/themes/active-theme.ts` has zero module-scope `let`/`var`, no `unstable_cache`/`React.cache`/`globalThis.` (grep-confirmed). `theme.unknown_selection` registered in `lib/observability/telemetry.ts` at `warning`/`sampleRate: 1` (grep-confirmed, count 1) and is absent from `workers/observability-tail/src/core.ts`'s `TAIL_CRITICAL_EVENTS` (grep-confirmed, count 0). 65/65 relevant unit tests pass (`active-theme.test.ts`, `observability-tail-core.test.ts`). **Judgment call, as the verify task explicitly asked to flag:** D-12/CONTEXT.md's literal wording asks for the event to be registered "in the tail Worker's `commerce.telemetry.v1` parity list" — literally read, that could mean the tail Worker's critical-event array. The phase instead registered the event only in `TELEMETRY_EVENTS` and proved via a passing test that it is correctly *absent* from `TAIL_CRITICAL_EVENTS` (that array is structurally critical-only, enforced by both the array's own consumers and a parity test). I judge this satisfies the roadmap SC's intent — a "telemetry event present in both parity files" is naturally read as "known to, and consistent with, both files' contracts" rather than literally duplicated in both arrays — and the SC's own annotation explicitly pre-authorizes this reading. Flagging per instructions in case a stricter literal reading is wanted. |
| 3 | Admin's Appearance section shows manifest-driven swatch-preview cards for every shipped theme, indicates the active one, and saves a selection through the existing `admin_settings` API pattern | ✓ VERIFIED (mechanism); visual/keyboard behavior unrun — see Human Verification | `components/admin/ThemePresetGrid.tsx` imports `THEME_MANIFEST` (no hardcoded card count), imports `APPEARANCE_SETTINGS_CATEGORY`/`APPEARANCE_THEME_SETTING_KEY` from `lib/themes/active-theme.ts` rather than restating literals, posts to `/api/admin/settings` (no new route — confirmed no other admin API route was added in this phase's `files_modified`), route exists at `app/admin/settings/appearance/page.tsx`, hub links to it (`app/admin/settings/page.tsx:484`). `npm run build` places `/admin/settings/appearance` in the route manifest. 8/8 source-contract tests pass. Independently re-verifiable mechanism proof already recorded in 06-04-SUMMARY.md (dev-bypass POST flips `data-theme`); not re-run live here since it mutates local D1 state and the mechanism-level evidence is already conclusive. |
| 4 | 2-3 preset themes ship, at least one light; the light preset's shadows and overlays read correctly rather than as dark-tuned leftovers | ✓ VERIFIED (with 2 of 4 sites evidenced via compositing test, not a live trigger — see Human Verification) | `ls themes/` shows `volt-dark.css`, `midnight.css`, `luxe.css` — 3 presets, `luxe` is light (ivory `#f8f5ef` surface, confirmed in `lib/themes/manifest.generated.ts`). All three pass `node scripts/build-themes.mjs --check` (fresh) and the token-contract parity test. Built CSS (`npm run build`) contains `data-theme=volt-dark`, `data-theme=midnight`, and `data-theme=luxe` blocks (grep-confirmed against `.next/static/css/*.css`). Light-preset acid test: `components/ui/dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx` all changed from `bg-surface/NN` to a sentinel-wrapped `bg-black/NN` (grep-confirmed, `gsd:scan-ignore-start`/`-end` present in all three); `app/category/[slug]/page.tsx` deliberately left at `bg-surface/40` with a written "accepted as-is" finding. `scan:tokens` still 0 violations post-fix. Sheet's fix was live-verified (`getComputedStyle` read under an actual open cart drawer); Dialog's and AlertDialog's fixes were verified via a live-DOM compositing-injection test against the real compiled CSS (no live trigger reachable in this environment — Dialog needs a completed Stripe checkout, AlertDialog needs a Clerk session) rather than an actual rendered scrim. |

**Score:** 4/4 ROADMAP success criteria evidenced (1 with an explicit judgment call flagged per the task's own instruction; 2 with partially-substituted evidence for 2 of 4 inspected sites).

### Supplementary Truths (plan-level must_haves, selected)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | A token value edited in `themes/volt-dark.css` reaches the browser through the generated barrel and the typed bridge with no hand-maintained duplicate | ✓ VERIFIED | `lib/themes/tokens.ts`'s `getThemeTokens` is a manifest lookup (no literal token object remains); `app/globals.css` imports `themes/index.generated.css`; built CSS carries both `bg-surface` and `store-surface` (confirmed by 06-01-SUMMARY's own build+grep, re-confirmed here via a fresh `npm run build`). |
| 6 | The generator is idempotent and check-mode never writes | ✓ VERIFIED | `node scripts/build-themes.mjs --check` → `[build-themes] check passed — generated output for 3 theme(s) is fresh.` `git status` clean on both generated paths after the run. |
| 7 | CI runs the freshness check | ✓ VERIFIED | `.github/workflows/ci.yml:39` — "Check theme manifest freshness" step present (grep-confirmed). |
| 8 | The 23-token contract is unchanged, unwidened, unnarrowed | ✓ VERIFIED | All three theme files show `grep -c '^\s*--store-'` == 23; `lib/themes/manifest.generated.ts`'s `ThemeTokenValues` type has exactly the 23 known camelCase keys (visually confirmed against the file). |
| 9 | Every shipped preset's manifest entry data matches its CSS file byte-for-byte via the parity test | ✓ VERIFIED | `token-contract.test.ts` passed (5 test files / 65 tests across the themes-related suite, all green in this session's independent run). |
| 10 | The admin card grid never posts a non-manifest theme name | ✓ VERIFIED | `ThemePresetGrid.tsx` re-checks the pending name against `THEME_MANIFEST` before posting (per source, matches the admin-appearance-source test's assertions); the authoritative gate is `getActiveTheme()`'s membership check (truth #2), which is independently verified. |
| 11 | No new token was added to express the light-preset overlay fix; no shared overlay class introduced | ✓ VERIFIED | Each of the 3 fixed scrim sites (`dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`) carries its own independent sentinel-wrapped literal (grep-confirmed, no shared constant/class extracted); token counts stayed at 23 for every theme file (confirmed above). |
| 12 | Full project gates are green at the state this phase leaves the tree in | ✓ VERIFIED | Independently re-run in this session: `npm run scan:tokens` → 0 violations (2 unchanged manual-review rows); `npm run lint` → 0 errors, 52 pre-existing warnings; `npm run typecheck` → exit 0; `npm test` → 248 files / 1932 tests, all green; `npm run build` → exit 0. |
| 13 | Two concurrent requests during an admin save each render a valid theme, never a mixed/missing one (verification: backstop) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | See `behavior_unverified_items` above. Structural evidence only (no cross-request state); no concurrency test exists. |
| 14 | The grid exposes real radiogroup keyboard/AT behavior; synopsis clamps and labels truncate at real widths (verification: backstop, x2) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | See `behavior_unverified_items` above. Source-text grep only; no rendered/interactive test, no Clerk session available to drive a live check. |
| 15 | Neither new theme file declares a font-loading at-rule; `luxe`'s display token references the layout's exposed CSS variable | ✓ VERIFIED | `grep -q 'font-cormorant-garamond' themes/luxe.css` succeeds; `build-themes.mjs`'s rule 3 (exactly one rule, zero at-rules) passing on all 3 files structurally forbids an `@font-face`/`@import` in any theme file. |
| 16 | An admin's saved selection reaches the storefront on the next request with no redeploy | ✓ VERIFIED | 06-03-SUMMARY and 06-04-SUMMARY both record a real dev-server + local-D1 proof (write the D1 row, curl the home page, observe the `data-theme` attribute flip); this session independently confirmed the mechanism's building blocks (async blocking layout read, no cache, manifest-gated resolver) rather than re-running the mutating D1 write itself. |
| 17 | No new API route or new authorization logic was introduced for the admin save path | ✓ VERIFIED | `files_modified` across all 5 plans lists no new route under `app/api/`; `ThemePresetGrid.tsx` posts to the pre-existing `/api/admin/settings` (grep-confirmed); that route's existing admin-permission check is unmodified (confirmed by reading `app/api/admin/settings/route.ts`, which is untouched by this phase per its own frontmatter). |

**Score:** 15/17 truths verified. 2 present-and-wired but behaviorally unexercised (backstop-tagged, routed to human verification per the tagging rule).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/build-themes.mjs` | Validator + codegen, `--check`/`--json`/`--path` | ✓ VERIFIED | Exists, exports confirmed via re-run (`--check` passes); deploy-gate proof independently reproduced. |
| `lib/themes/manifest.generated.ts` | `THEME_MANIFEST`, `DEFAULT_THEME_NAME`, 3 entries | ✓ VERIFIED | Read directly — 3 entries (`luxe`, `midnight`, `volt-dark`), no imports, no env reads. |
| `themes/index.generated.css` | One `@import` per theme, relative-prefixed | ✓ VERIFIED | 3 entries confirmed via `--check`. |
| `lib/themes/active-theme.ts` | `getActiveTheme()`, two setting constants | ✓ VERIFIED | Exists, wired into `app/layout.tsx`, no cross-request state (grep-confirmed). |
| `app/layout.tsx` | Async root layout, `data-theme={activeTheme}`, Cormorant Garamond load | ✓ VERIFIED | Confirmed by direct read: async function, `await getActiveTheme()` above the tree, `Cormorant_Garamond` import present. |
| `components/admin/ThemePresetGrid.tsx` | Manifest-driven card grid, save flow | ✓ VERIFIED | Exists, wired (see truth #3 evidence); mechanism proven, interaction behavior unrun. |
| `app/admin/settings/appearance/page.tsx` | Appearance route hosting the grid | ✓ VERIFIED | Exists, present in `npm run build`'s route manifest. |
| `themes/midnight.css`, `themes/luxe.css` | 23-token preset files | ✓ VERIFIED | Both pass the validator, both 23-token, 17-hex-colour shape confirmed. |
| `.planning/phases/06-theme-file-mechanism-presets/06-SCREENSHOTS.md` | Per-preset captures + QA findings + phase-close roll-up | ✓ VERIFIED | Exists, 397 lines, contains all 4 quoted ROADMAP criteria with named evidence, a 4-row findings table, and a carried-forward table. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/globals.css` | `themes/index.generated.css` | barrel import ahead of tailwind config | ✓ WIRED | Confirmed present, build compiles and produces `[data-theme=...]` blocks for all 3 themes. |
| `lib/themes/tokens.ts` | `lib/themes/manifest.generated.ts` | `THEME_MANIFEST` lookup | ✓ WIRED | `getThemeTokens` reads the manifest (05/06-01 rewrite). |
| `package.json` | `scripts/build-themes.mjs` | `predev`/`build:worker` prepend | ✓ WIRED | Grep-confirmed both script strings, no `prebuild` key. |
| `app/layout.tsx` | `lib/themes/active-theme.ts` | `await getActiveTheme()` above the tree | ✓ WIRED | Confirmed, outside Suspense. |
| `lib/themes/active-theme.ts` | `lib/themes/manifest.generated.ts` | membership check | ✓ WIRED | `THEME_MANIFEST` referenced in `active-theme.ts` (per 06-02 plan interface and passing unit tests). |
| `components/admin/ThemePresetGrid.tsx` | `lib/themes/manifest.generated.ts` | `THEME_MANIFEST` render | ✓ WIRED | Grep-confirmed import and usage, no hardcoded count. |
| `components/admin/ThemePresetGrid.tsx` | `app/api/admin/settings/route.ts` | POST of a single update | ✓ WIRED | Grep-confirmed POST target; existing endpoint untouched. |
| `app/admin/settings/page.tsx` | `app/admin/settings/appearance/page.tsx` | 8th tab entry, real navigation | ✓ WIRED | Grep-confirmed `href: "/admin/settings/appearance"` with `kind: "route"`. |
| `themes/luxe.css` | `app/layout.tsx` | `--store-font-display` references the Cormorant Garamond CSS var | ✓ WIRED (token-level only — see Anti-Patterns/Notable Findings) | `font-cormorant-garamond` variable reference confirmed in `luxe.css`; the token is not consumed by any rendered component (see below), so the wiring is complete but produces no visible effect yet — this is a pre-existing gap from Phase 5, not this phase's scope, and is not one of this phase's stated must-haves. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `app/layout.tsx` `data-theme` attribute | `activeTheme` | `getActiveTheme()` → D1 `admin_settings` (via `getSettings`) → env → manifest default | Yes | ✓ FLOWING (confirmed against real compiled output; `.next` build carries all 3 theme blocks, meaning the barrel path is live, not a static fallback) |
| `ThemePresetGrid` card colours | `theme.tokens.*` | `THEME_MANIFEST` (build-time generated from `themes/*.css`) | Yes | ✓ FLOWING (module-scope read, no fetch needed, confirmed via source) |
| `ThemePresetGrid` Active badge | `savedTheme` | `fetch('/api/admin/settings?category=appearance')` on mount, re-read from the POST response after save | Yes | ✓ FLOWING (grep-confirmed fetch + re-read pattern; not the optimistic client value) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Break a theme file, run the real deploy build | delete `--store-primary`, `npm run build:worker`, restore | Exit 1, `[build-themes] ABORT: 1 error(s).`, zero Cloudflare-builder output; file restored, `git status` clean | ✓ PASS |
| Generator check mode is idempotent | `node scripts/build-themes.mjs --check` (x1, against already-fresh output) | `check passed — generated output for 3 theme(s) is fresh.` | ✓ PASS |
| Theme-specific unit suites | `vitest run` on 5 theme/telemetry/admin-appearance test files | 5 files / 65 tests, all green | ✓ PASS |
| Full unit suite regression | `npm test` | 248 files / 1932 tests, all green | ✓ PASS |
| Lint / typecheck | `npm run lint`, `npm run typecheck` | 0 errors (52 pre-existing warnings, unrelated to this phase); typecheck clean | ✓ PASS |
| Token scan | `npm run scan:tokens` | 0 violations, same 2 manual-review rows as Phase 5 | ✓ PASS |
| Production build carries all 3 theme blocks | `npm run build` + grep `.next/static/css/*.css` | `data-theme=volt-dark`, `data-theme=midnight`, `data-theme=luxe` all present; `/admin/settings/appearance` in route manifest | ✓ PASS |
| Admin theme save flips storefront rendering (live browser click-through) | N/A | Not run — no Clerk session in this environment | ? SKIP (see Human Verification) |
| Live scrim rendering on Dialog/AlertDialog under `luxe` | N/A | Not run — no completed checkout / no Clerk session; substituted with compositing-injection test | ? SKIP (see Human Verification) |

### Probe Execution

No `scripts/*/tests/probe-*.sh`-style probes are declared by this phase's plans or referenced in SUMMARY/VALIDATION files. Skipped — not applicable to this phase's mechanism (build-time codegen + admin UI, not a migration/runbook tool).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| THEME-01 | 06-01 | Prebuild validator, generated barrel + manifest, wired into `build:worker`/`predev` | ✓ SATISFIED | Truths #1, #5, #6, #7 above; independently reproduced deploy-gate break. |
| THEME-02 | 06-02 | `getActiveTheme()` fallback chain, blocking root layout, unknown-selection telemetry | ✓ SATISFIED (with the judgment-call flag on truth #2's literal parity-file wording) | Truth #2 above. |
| THEME-03 | 06-04 | Admin Appearance section, manifest-driven cards, existing settings API | ✓ SATISFIED (mechanism); visual/keyboard behavior open — see Human Verification | Truth #3 above; WINDOWS #2. |
| THEME-04 | 06-03, 06-05 | 2-3 presets, at least one light, light-preset shadow/overlay QA | ✓ SATISFIED (2 of 4 scrim sites evidenced via compositing test, not live) | Truth #4 above. |

No orphaned requirements: `THEME-01` through `THEME-04` are each claimed by exactly one plan's frontmatter and match `REQUIREMENTS.md`'s Phase 6 traceability row.

### Anti-Patterns Found

None. Scanned every file this phase modified (`scripts/build-themes.mjs`, `lib/themes/active-theme.ts`, `lib/themes/tokens.ts`, `app/layout.tsx`, `components/admin/ThemePresetGrid.tsx`, `app/admin/settings/appearance/page.tsx`, all three theme files, and the three fixed scrim components) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers — zero matches. No empty-implementation stubs found (`ThemePresetGrid` renders real manifest data, `getActiveTheme` does a real D1-backed resolution, `getThemeTokens` is a real manifest lookup).

### Notable Findings Carried From WINDOWS.md (not phase-blocking, surfaced for visibility)

| # | Finding | Disposition here |
|---|---------|-------------------|
| WINDOWS #1 | `--store-font-display` is fully wired (token → Tailwind class → `next/font` load → `luxe.css` reference) but no component in `app/` or `components/` applies the `font-display` Tailwind class to any element, so `luxe`'s serif headings never actually render. Independently re-confirmed: `grep -rn "font-display\|fontDisplay\|store-font-display" app/ components/` finds only the token-mapping comment in `layout.tsx`, no consumer. | Not a FAILED truth: none of this phase's stated must-haves or the ROADMAP's four success criteria require a component to consume `font-display` — SC4 is scoped to "shadows and overlays," not typography. Genuine product gap versus the design intent in `docs/voltique-theme-direction.md`, correctly disclosed rather than hidden. Recommend picking up in Phase 7/8. |
| WINDOWS #2 | The full human-observable admin walkthrough (click a card, ring vs. badge, toast copy, keyboard radiogroup) was never run — no Clerk session in this environment. | Directly reflected in this report's `human_verification` list and in the two `PRESENT_BEHAVIOR_UNVERIFIED` truths above. |
| WINDOWS #3 | `GET /api/admin/settings?category=X` inserts the *entire* `defaultSettings` array (every category) when the filtered query returns zero rows — `appearance` has no `defaultSettings` entries, so a genuinely fresh install could 500 on first Appearance-page load. Independently re-confirmed by reading `app/api/admin/settings/route.ts:45-49`: `if (settings.length === 0) { ... await db.insert(admin_settings).values(defaultSettings); ... }` with no category filter on the insert. | Pre-existing bug, not introduced by this phase, correctly out of scope per every plan's `files_modified` (the route file is never touched). Not observed in this repo's current state because plan 06-03 already left one `appearance.theme` row in the local D1 fixture. Worth a real fix before a genuinely fresh install exercises the Appearance page — flagging for visibility, not as a Phase 6 gap. |

### Human Verification Required

1. **Concurrent-save race on `getActiveTheme()`**
   **Test:** Interleave two `getActiveTheme()` calls (or two overlapping HTTP requests) around a mocked/real admin theme save.
   **Expected:** Each resolves to a valid manifest theme name — the pre-save or post-save value — never mixed, empty, or throwing.
   **Why human:** PLAN-tagged `verification: backstop`; only structural no-cache evidence exists.

2. **Admin Appearance page browser walkthrough**
   **Test:** With a real Clerk admin session, click a card, confirm the ring appears without moving the Active badge, Save, confirm the toast, then navigate the grid with arrow keys and space/enter.
   **Expected:** Behavior matches the UI-SPEC's pending-vs-saved model and radiogroup semantics exactly.
   **Why human:** No Clerk session in this environment (WINDOWS #2); source-grep tests confirm the markup/attributes exist but not runtime behavior.

3. **Dialog and AlertDialog scrim fix, live**
   **Test:** Under the `luxe` preset, trigger a real checkout-confirmation Dialog and an admin AlertDialog, and confirm the new `bg-black/NN` backdrop visually recedes the content behind it.
   **Expected:** Same visible dark-scrim behavior already live-verified on the Sheet overlay.
   **Why human:** Dialog requires a completed Stripe checkout (fails locally, a known Phase 5 gap); AlertDialog requires a Clerk session. 06-05 substituted a live-DOM compositing-injection test against the real compiled CSS rather than a live trigger.

### Gaps Summary

No must-have truth failed and no artifact is missing, stub, or unwired. All four ROADMAP success criteria are evidenced, independently re-verified in this session (deploy-gate break-and-restore, `--check`, full lint/typecheck/test/build/scan gates, direct source reads of every key link). The phase's own executors were unusually transparent about what they could not verify in this sandboxed environment (no Clerk session, no completed checkout, no seeded order) and logged those gaps explicitly in `WINDOWS.md` rather than silently claiming a pass — this verification confirms those disclosures are accurate and complete, and surfaces the two PLAN-tagged `backstop` truths (concurrency, real keyboard/AT behavior) that the phase's own frontmatter flagged as needing more than static analysis. None of this blocks the phase goal's mechanism-level claims; it does mean a human with a real browser session and Clerk credentials should close out WINDOWS #2 and the concurrency/scrim spot-checks above before treating THEME-03's and THEME-04's visual/interactive claims as fully proven.

---

*Verified: 2026-09-04T21:15:00Z*
*Verifier: Claude (gsd-verifier)*

---

**Human verification outcome (2026-09-04T21:19:43Z):** Russell accepted the three human-verification items as passed on the strength of the code-level evidence above, via /gsd-autonomous. See 06-UAT.md.
