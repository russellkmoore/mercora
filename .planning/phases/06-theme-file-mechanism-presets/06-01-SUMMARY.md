---
phase: 06-theme-file-mechanism-presets
plan: 01
subsystem: theming
tags: [postcss, codegen, build-tooling, theme-manifest, ci]

# Dependency graph
requires:
  - phase: 05-03
    provides: "themes/volt-dark.css (23-token contract) and lib/themes/tokens.ts's original getThemeTokens() single-file version, replaced here by a manifest lookup"
provides:
  - "scripts/build-themes.mjs — postcss-based validator + codegen (validateThemeFile, buildManifest, renderManifestModule, renderBarrelCss, parseThemeHeader), --check/--json/--path CLI"
  - "lib/themes/manifest.generated.ts — committed THEME_MANIFEST array + DEFAULT_THEME_NAME, generated from themes/*.css"
  - "themes/index.generated.css — committed CSS import barrel, one @import per theme file"
  - "getThemeTokens(name?) — synchronous manifest lookup, ready for plan 06-02's getActiveTheme() to call with a resolved name"
  - "predev/build:worker/CI all fail closed on a broken theme file, before their real work starts"
affects: [06-02, 06-03, 06-04, 06-05]

# Actuals (#2632)
actuals:
  tokens: 11815
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "postcss.parse()-based structural CSS validator: walk rules/at-rules/decls rather than regex-scan, collect all errors across all files before reporting"
    - "Atomic codegen (temp file + rename) gated behind full-validation-passes-first, mirroring scripts/check-deploy-config.mjs's exported-function + main()-guard shape"
    - "--path flag on a build script resolves to a dry-run/fixture mode (validate + render in memory, never write) whenever the scanned directory isn't the canonical default — output paths are fixed regardless of --path, so writing under a scoped run would corrupt the real generated files"

key-files:
  created:
    - scripts/build-themes.mjs
    - lib/themes/manifest.generated.ts
    - themes/index.generated.css
    - tests/unit/scripts/build-themes.test.ts
    - tests/fixtures/themes/valid/good.css
    - tests/fixtures/themes/missing-token/good.css
    - tests/fixtures/themes/unknown-token/good.css
    - tests/fixtures/themes/extra-rule/good.css
    - tests/fixtures/themes/name-mismatch/mismatched.css
    - tests/fixtures/themes/bad-hex/good.css
    - tests/fixtures/themes/no-label/good.css
    - tests/fixtures/themes/empty/empty.css
  modified:
    - themes/volt-dark.css
    - lib/themes/tokens.ts
    - app/globals.css
    - scripts/scan-hardcoded-colors.mjs
    - package.json
    - .github/workflows/ci.yml
    - tests/unit/lib/themes/token-contract.test.ts

key-decisions:
  - "lib/themes/manifest.generated.ts added to scripts/scan-hardcoded-colors.mjs's THEME_SOURCE_FILES exclusion set (same treatment already given to lib/themes/tokens.ts) — the generated manifest legitimately contains hex literals, and excluding it by name (not weakening the scanner's rules) is how the existing scan:tokens gate already handles the theme-source special case"
  - "The barrel's @import lines are relative-path-prefixed ('./volt-dark.css', not 'volt-dark.css') — Tailwind's CSS @import resolution treats a bare specifier as a bare-module lookup (Node-style), not a relative path; the unprefixed form broke the real Next.js build with 'Can't resolve volt-dark.css'"
  - "--check mode and any --path pointing away from the canonical themes/ directory both skip the write step entirely (validate/render-in-memory only) — the generated file output paths are fixed constants regardless of --path, so a fixture-directed test run must never touch the real committed generated files"

patterns-established:
  - "Every scenario-specific validator fixture under tests/fixtures/themes/ isolates exactly one rule violation, proven against the same known-clean 23-token control content used by the valid/ fixture, so a fixture failure is attributable to content, not harness"

requirements-completed: [THEME-01]

coverage:
  - id: D1
    description: "A token value edited in themes/volt-dark.css reaches the browser through the generated barrel (app/globals.css -> index.generated.css) and reaches the typed bridge through the generated manifest (getThemeTokens()), with no hand-maintained duplicate left in the tree"
    requirement: "THEME-01"
    verification:
      - kind: integration
        ref: "mise exec -- npm run build && grep -l bg-surface .next/static/css/*.css && grep -l store-surface .next/static/css/*.css"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/themes/token-contract.test.ts (loops getThemeTokens(stem) over every themes/*.css file via readdirSync)"
        status: pass
    human_judgment: false
  - id: D2
    description: "scripts/build-themes.mjs exits non-zero with a bracketed file:line message for each of the six validator rules (missing token, unknown token, extra rule/at-rule, name mismatch, bad hex, no label) plus the two emptiness cases (empty file, empty directory), and a known-clean control still passes"
    requirement: "THEME-01"
    verification:
      - kind: unit
        ref: "tests/unit/scripts/build-themes.test.ts (16 tests: one per fixture scenario, plus direct-import tests for parseThemeHeader and renderer idempotence)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The generator is idempotent and writes both generated files atomically; check mode never writes; two consecutive runs produce byte-identical output"
    requirement: "THEME-01"
    verification:
      - kind: other
        ref: "mise exec -- node scripts/build-themes.mjs (x2) && git status --porcelain themes/index.generated.css lib/themes/manifest.generated.ts -> empty; mise exec -- node scripts/build-themes.mjs --check -> exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "predev and build:worker both run the validator before their existing command (no prebuild key); a deliberately broken theme file makes build:worker exit non-zero with a build-themes message before any Cloudflare-builder work starts; CI gains a freshness-check step"
    requirement: "THEME-01"
    verification:
      - kind: other
        ref: "node -e wiring-ok check (predev/build:worker both call build-themes.mjs, no prebuild key); deliberate delete-a-token-then-restore run of npm run build:worker (RC=1, log ends at [build-themes] ABORT, zero Cloudflare-builder output); .github/workflows/ci.yml Check theme manifest freshness step"
        status: pass
    human_judgment: true
    rationale: "The plan's own literal <verify> grep for Task 2 (`! grep -q 'opennextjs-cloudflare build'` in the deploy-gate log) produces a false negative: npm's own script-echo preamble always prints the full compound script string — including that literal substring — regardless of whether the Cloudflare builder actually ran. I verified the real underlying behavior two ways (log ends immediately at the build-themes ABORT line with zero builder output; re-running with `npm run build:worker --silent` removes the false-positive substring entirely and still shows the ABORT-only log), but a human should glance at the raw /tmp/06-01-deploy-gate.log evidence once since the plan's literal automated check cannot itself confirm this."
  - id: D5
    description: "mise exec -- npm run lint, npm run typecheck, and npm run scan:tokens all exit 0 after every change in this plan; scan:tokens reports 0 violations with the same 2 manual-review rows Phase 5 closed with"
    requirement: "THEME-01"
    verification:
      - kind: other
        ref: "npm run lint / npm run typecheck / npm run scan:tokens (this session's final combined run; scan:tokens: 0 violations, manual-review rows unchanged from Phase 5)"
        status: pass
      - kind: unit
        ref: "npm test (246 files / 1902 tests, full unit suite)"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-09-04
status: complete
---

# Phase 6 Plan 1: Theme File Mechanism Spine Summary

**A postcss-based validator and codegen script (`scripts/build-themes.mjs`) now compiles `themes/*.css` into a committed CSS import barrel and a typed manifest; the browser cascade and the non-cascade typed bridge both read from that generated output, with the hand-maintained token literal deleted and both the deploy build and CI gated on validation.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-04T19:30:00Z
- **Completed:** 2026-09-04T19:45:00Z
- **Tasks:** 3 completed
- **Files modified:** 19 (12 created, 7 modified)

## Accomplishments

- Built `scripts/build-themes.mjs`: a `postcss.parse()`-based AST validator enforcing all six D-06/D-07 rules (23-token presence, no unknown token, exactly one rule with zero at-rules, selector-equals-filename-stem, 6-digit hex colours, required header label) plus two emptiness checks, collecting every violation across every file rather than stopping at the first. Exports `parseThemeHeader`, `validateThemeFile`, `buildManifest`, `renderManifestModule`, `renderBarrelCss`; CLI flags `--check`/`--json`/`--path`; atomic writes (temp file + rename); log prefix `[build-themes]`.
- Generated and committed `lib/themes/manifest.generated.ts` (`THEME_MANIFEST`, `DEFAULT_THEME_NAME`) and `themes/index.generated.css` (one relative `@import` per theme file) from the sole existing theme, `volt-dark.css`, which gained the required `@theme label:` header comment additive to its existing frozen-contract comment.
- Rewrote `getThemeTokens()` in `lib/themes/tokens.ts` as a synchronous manifest lookup (`getThemeTokens(name = DEFAULT_THEME_NAME)`) falling back to the default entry, deleting the duplicated `VOLT_DARK_TOKENS` literal; the exported `ThemeTokens` type is unchanged so no caller signature changes.
- Pointed `app/globals.css` at the generated barrel in place of the direct `volt-dark.css` import, same position ahead of the tailwind `@config` directive.
- Wired the validator into `predev` and `build:worker` (both script strings edited literally — no `prebuild` key, since the real deploy path never triggers it) and into CI as a new "Check theme manifest freshness" step running `--check`; added `build:themes`/`build:themes:check` convenience scripts.
- Proved the deploy gate against the real build: deleting `--store-primary` from `themes/volt-dark.css` makes `npm run build:worker` exit non-zero with a `[build-themes]` message, and the captured log ends at that ABORT line — the Cloudflare builder (`opennextjs-cloudflare build`) never produces any output.
- Created 8 fixture directories under `tests/fixtures/themes/` (one per validator rule plus a known-clean control) and `tests/unit/scripts/build-themes.test.ts` (16 tests: one `spawnSync` case per fixture scenario including a runtime-created empty directory, plus direct-import tests for header parsing and renderer idempotence).
- Extended `tests/unit/lib/themes/token-contract.test.ts` to derive its theme list from `readdirSync('themes')` and loop `getThemeTokens(stem)` per file instead of hardcoding `volt-dark`; added default-name and unknown-name fallback assertions, and extended the imports-nothing-server-only check to also scan the generated manifest module.
- Verified end-to-end: `npm run build` followed by grepping the built CSS for both `bg-surface` and `store-surface` confirms the token declaration and the token-driven utility both reach the compiled stylesheet through the new barrel path.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end — one theme file's tokens reach both the browser and the typed bridge** - `913aa91` (feat)
2. **Task 2: Wire the validator into the real deploy path, the dev path, and CI** - `e5f09fc` (feat)
3. **Task 3: Fixture-driven validator tests and an all-themes contract test** - `2c74fb6` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `scripts/build-themes.mjs` - validator + manifest/barrel codegen, `--check`/`--json`/`--path` CLI
- `lib/themes/manifest.generated.ts` - committed generated `THEME_MANIFEST` + `DEFAULT_THEME_NAME`
- `themes/index.generated.css` - committed generated CSS import barrel
- `tests/unit/scripts/build-themes.test.ts` - fixture-driven validator tests + direct-import renderer/header tests
- `tests/fixtures/themes/{valid,missing-token,unknown-token,extra-rule,name-mismatch,bad-hex,no-label,empty}/` - one scenario per validator rule
- `themes/volt-dark.css` - added the required `@theme label:` header comment
- `lib/themes/tokens.ts` - `getThemeTokens(name?)` now a manifest lookup, duplicated literal deleted
- `app/globals.css` - imports the generated barrel instead of `volt-dark.css` directly
- `scripts/scan-hardcoded-colors.mjs` - added `lib/themes/manifest.generated.ts` to the theme-source exclusion set
- `package.json` - `predev`/`build:worker` prepend the validator; new `build:themes`/`build:themes:check` scripts
- `.github/workflows/ci.yml` - new "Check theme manifest freshness" step
- `tests/unit/lib/themes/token-contract.test.ts` - loops over every shipped theme file via `readdirSync`

## Decisions Made

- **Barrel import path must be relative-prefixed:** the generator initially emitted bare `@import 'volt-dark.css';`, which Tailwind's CSS resolver treats as a Node-style bare-module lookup rather than a relative path, breaking `npm run build` with "Can't resolve 'volt-dark.css'". Fixed to `@import './volt-dark.css';`.
- **Generated manifest joins the scanner's theme-source exclusion set:** `lib/themes/manifest.generated.ts` legitimately contains hex literals (it's generated build output, the same role `lib/themes/tokens.ts` played before this plan); added to `THEME_SOURCE_FILES` in `scripts/scan-hardcoded-colors.mjs` rather than weakening any scan rule.
- **`--path` and `--check` both skip the write step** whenever the resolved directory isn't the canonical `themes/`: the two generated-file output paths are fixed constants, so a fixture-directed validation run must never overwrite the real committed generated files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Barrel `@import` used a bare specifier, breaking the real Next.js build**
- **Found during:** Task 1 acceptance-criteria verification (`npm run build`)
- **Issue:** `renderBarrelCss` emitted `@import 'volt-dark.css';`; Tailwind's CSS `@import` resolution follows Node-style bare-specifier lookup for unprefixed imports, so it searched `node_modules` instead of the sibling file and failed with `Can't resolve 'volt-dark.css' in '.../themes'`.
- **Fix:** Changed the emitted import to `@import './volt-dark.css';` (explicit relative prefix).
- **Files modified:** `scripts/build-themes.mjs`
- **Verification:** `npm run build` exits 0; built CSS carries both `bg-surface` and `store-surface`.
- **Committed in:** `913aa91`

**2. [Rule 3 - Blocking issue] Generated manifest's hex literals would have failed scan:tokens**
- **Found during:** Task 1, pre-verification of the `npm run scan:tokens` acceptance criterion (flagged in advance by this plan's own environment notes)
- **Issue:** `lib/themes/manifest.generated.ts` legitimately contains 6-digit hex colour values; the scanner's `THEME_SOURCE_FILES` exclusion set only listed `lib/themes/tokens.ts`, so the new generated file would have registered as violations.
- **Fix:** Added `"lib/themes/manifest.generated.ts"` to `THEME_SOURCE_FILES` in `scripts/scan-hardcoded-colors.mjs` — an exclusion-by-name addition consistent with the existing theme-source convention, not a weakening of any scan rule.
- **Files modified:** `scripts/scan-hardcoded-colors.mjs`
- **Verification:** `npm run scan:tokens` reports 0 violations, same 2 manual-review rows as Phase 5.
- **Committed in:** `913aa91`

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues discovered while proving this plan's own acceptance criteria). **Impact:** Both fixes were necessary for the plan's stated acceptance criteria (a clean `npm run build` and a clean `npm run scan:tokens`) to hold. No scope creep beyond what those criteria required.

## Issues Encountered

- **Task 2's literal deploy-gate `<verify>` grep produces a false negative.** The plan's own automated check asserts `! grep -q 'opennextjs-cloudflare build' <log>` to prove the Cloudflare builder never ran after a broken theme file aborts `build:worker`. In practice, `npm run <script>` always echoes the full compound script string (`> node scripts/build-themes.mjs && ... opennextjs-cloudflare build`) as its own preamble before executing anything, so that literal substring is present in the log on every invocation — success or failure — independent of whether the builder tool itself ever ran. I confirmed the underlying behavior is correct two ways: (1) the captured log (`/tmp/06-01-deploy-gate.log`) ends immediately at `[build-themes] ABORT: 1 error(s).` with zero additional lines — no OpenNext banner, no build progress, nothing from the actual Cloudflare builder process; (2) re-running the identical break-then-restore sequence with `npm run build:worker --silent` (which suppresses npm's own preamble echo) removes the string entirely from the log while still producing the same non-zero exit and `[build-themes]` ABORT message. Recorded as `human_judgment: true` on coverage entry D4 rather than a false `pass`, since the plan's own literal automated command cannot itself prove this — a human should glance at the log evidence once.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The theme mechanism's spine is proven end to end on real code: a value in `themes/volt-dark.css` reaches the browser through the generated barrel and reaches Stripe/Clerk/email through the generated manifest, with no hand-maintained duplicate left in `lib/themes/`.
- `getThemeTokens(name?)` is ready for plan 06-02's `getActiveTheme()` to call with a resolved theme name — the interface contract (`THEME_MANIFEST`, `DEFAULT_THEME_NAME`, `ThemeManifestEntry`, `ThemeTokenValues`) is exactly what `06-RESEARCH.md`/`06-PATTERNS.md` specified.
- `scripts/build-themes.mjs`'s validator is ready to gate the two new preset theme files (`luxe.css`, `midnight.css`) that later plans in this phase will add — no changes to the validator itself should be needed, since it already loops over every file in the scanned directory.
- The deploy-gate false-negative in the plan's own Task 2 `<verify>` text (see Issues Encountered) is worth flagging to whoever writes future phases' verify commands: `npm run <script>` output always contains its own script definition string, so any check for "did tool X run" must either use `--silent` or search for tool X's actual runtime output, not its invocation string.

---
*Phase: 06-theme-file-mechanism-presets*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: scripts/build-themes.mjs
- FOUND: themes/volt-dark.css
- FOUND: themes/index.generated.css
- FOUND: lib/themes/manifest.generated.ts
- FOUND: lib/themes/tokens.ts
- FOUND: app/globals.css
- FOUND: package.json
- FOUND: .github/workflows/ci.yml
- FOUND: tests/unit/scripts/build-themes.test.ts
- FOUND: tests/unit/lib/themes/token-contract.test.ts
- FOUND: tests/fixtures/themes/valid/good.css
- FOUND: tests/fixtures/themes/missing-token/good.css
- FOUND: tests/fixtures/themes/unknown-token/good.css
- FOUND: tests/fixtures/themes/extra-rule/good.css
- FOUND: tests/fixtures/themes/name-mismatch/mismatched.css
- FOUND: tests/fixtures/themes/bad-hex/good.css
- FOUND: tests/fixtures/themes/no-label/good.css
- FOUND: tests/fixtures/themes/empty/empty.css
- FOUND commit: 913aa91
- FOUND commit: e5f09fc
- FOUND commit: 2c74fb6
