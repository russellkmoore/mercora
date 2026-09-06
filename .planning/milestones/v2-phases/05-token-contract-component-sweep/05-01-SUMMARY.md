---
phase: 05-token-contract-component-sweep
plan: 01
subsystem: testing
tags: [tooling, tailwind, tokens, scanner, vitest]

# Dependency graph
requires: []
provides:
  - "scripts/scan-hardcoded-colors.mjs — the whole-tree hardcoded-palette completion gate every later 05-* plan runs against"
  - "gsd:scan-ignore-start / gsd:scan-ignore-end sentinel convention, consumed by 05-03 for the admin CSS block"
  - "MANUAL_REVIEW registry pattern (named-file exception with a printed reason)"
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-10, 05-11, 05-12]

# Actuals (#2632)
actuals:
  tokens: 9500
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-dependency node: script convention (shebang, try/catch, [tag] ABORT: message, exit 1) reused from scripts/check-deploy-config.mjs"
    - "Sentinel-then-comment-strip processing order for text-based source scanners"

key-files:
  created:
    - scripts/scan-hardcoded-colors.mjs
    - tests/unit/scripts/scan-hardcoded-colors.test.ts
    - tests/fixtures/scan-tokens/clean.tsx
    - tests/fixtures/scan-tokens/dirty.tsx
    - tests/fixtures/scan-tokens/sentinel.css
    - tests/fixtures/scan-tokens/admin/hardcoded.tsx
  modified:
    - package.json

key-decisions:
  - "MANUAL_REVIEW files are fully excluded from scanning (not just flagged) — they are named-file exceptions with a printed reason, consistent with the plan's prohibition against silent broad exclusions"
  - "Functional-color regex (rgb/rgba/hsl/hsla) captures the whole call up to the closing paren for readable match text, not just the triggering digit"
  - "Tailwind/shadcn utility regex skips explicit variant-chain matching — a single-character lookbehind for 'not preceded by word/hyphen' is sufficient because every variant chain (including bracketed ones like data-[state=open]:) ends in a colon, which already satisfies that boundary"

patterns-established:
  - "Region sentinel (gsd:scan-ignore-start/end) processed before comment stripping, exactly as TOKEN-MAP §6 specifies — the tracer plan (05-03) will add the actual sentinel comments around app/globals.css's .admin-* block"

requirements-completed: [TOKEN-03]

coverage:
  - id: D1
    description: "scripts/scan-hardcoded-colors.mjs walks app/, components/, lib/, themes/, and tailwind.config.ts, detecting hex literals, rgb()/hsl() functions, raw Tailwind palette utilities, and dead shadcn vocabulary"
    requirement: "TOKEN-03"
    verification:
      - kind: unit
        ref: "tests/unit/scripts/scan-hardcoded-colors.test.ts#flags a raw palette utility and a hex literal, with a non-zero exit code"
        status: pass
      - kind: unit
        ref: "tests/unit/scripts/scan-hardcoded-colors.test.ts#reports zero findings and a zero exit for contract-token-only classes"
        status: pass
      - kind: other
        ref: "mise exec -- npm run scan:tokens; test $? -eq 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "scan:tokens npm script registered under an explicit (non-lifecycle-prefixed) name"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "grep scan:tokens package.json"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deterministic, sorted output: two runs over an unchanged tree are byte-identical"
    requirement: "TOKEN-03"
    verification:
      - kind: unit
        ref: "tests/unit/scripts/scan-hardcoded-colors.test.ts#produces identical JSON output across two runs over the same fixture tree"
        status: pass
      - kind: other
        ref: "diff of two whole-tree scan:tokens runs"
        status: pass
    human_judgment: false
  - id: D4
    description: "admin path exclusion and MANUAL_REVIEW registry: admin/ never appears in output, and exactly two MANUAL-REVIEW rows print on every run"
    requirement: "TOKEN-03"
    verification:
      - kind: unit
        ref: "tests/unit/scripts/scan-hardcoded-colors.test.ts#produces zero findings for a fixture under an admin directory segment, even though it is non-empty"
        status: pass
      - kind: other
        ref: "mise exec -- npm run scan:tokens 2>&1 | grep -c '^MANUAL-REVIEW' == 2"
        status: pass
    human_judgment: false
  - id: D5
    description: "Comment stripping and region sentinels keep JSDoc/comment-only palette strings and gsd:scan-ignore-wrapped regions from registering as violations"
    requirement: "TOKEN-03"
    verification:
      - kind: unit
        ref: "tests/unit/scripts/scan-hardcoded-colors.test.ts#strips line, block, and JSDoc comments before matching"
        status: pass
      - kind: unit
        ref: "tests/unit/scripts/scan-hardcoded-colors.test.ts#honours the gsd:scan-ignore region sentinel in a CSS file"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-09-04
status: complete
---

# Phase 5 Plan 1: Whole-Tree Hardcoded-Palette Scanner Summary

**Zero-dependency `scan:tokens` gate that walks the whole storefront tree and exits 1 with a deterministic, sorted violation report — proven fail-first against 1165 real violations across 86 files before any sweep code has run.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-04T05:26:00Z
- **Completed:** 2026-09-04T05:46:02Z
- **Tasks:** 2 completed
- **Files modified:** 7 (1 script, 1 package.json edit, 1 test file, 4 fixtures)

## Accomplishments

- Built `scripts/scan-hardcoded-colors.mjs`: walks `app/`, `components/`, `lib/`, `themes/`, and `tailwind.config.ts` for `.ts`/`.tsx`/`.css` files, detecting hex literals, `rgb()`/`rgba()`/`hsl()`/`hsla()` functional colors, raw Tailwind palette utilities, and dead shadcn vocabulary — all behind an arbitrary variant-chain boundary check.
- Registered `scan:tokens` as an explicit (non-lifecycle) npm script.
- Ran the scanner against the current pre-sweep tree: exits 1, reports 1165 violations across 86 files, prints exactly 2 `MANUAL-REVIEW` rows, excludes `app/admin/`/`components/admin/` entirely, and produces byte-identical output across repeated runs.
- Proved the gate with 4 fixtures (known-bad, known-clean, sentinel-region, admin-tree) and an 8-assertion Vitest suite driving the scanner as a child process via `--path`/`--json`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the whole-tree hardcoded-palette scanner** - `fdb532c` (feat)
2. **Task 2: Prove the gate fails first, with fixtures** - `5571460` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `scripts/scan-hardcoded-colors.mjs` - whole-tree scan gate; hex/rgb-hsl/Tailwind-utility/shadcn-dead-vocab detection, sentinel regions, comment stripping, `--path`/`--json` flags
- `package.json` - adds `scan:tokens` script alongside `check:migrations`
- `tests/unit/scripts/scan-hardcoded-colors.test.ts` - 8 assertions proving the gate's behavior via child-process invocation
- `tests/fixtures/scan-tokens/dirty.tsx` - known-bad fixture (raw utility, hex, variant chain, same-line multi-match)
- `tests/fixtures/scan-tokens/clean.tsx` - known-clean fixture (contract tokens + comment-only palette strings)
- `tests/fixtures/scan-tokens/sentinel.css` - sentinel-region fixture (values both inside and outside `gsd:scan-ignore-*`)
- `tests/fixtures/scan-tokens/admin/hardcoded.tsx` - admin-path exclusion fixture

## Decisions Made

- MANUAL_REVIEW files (`lib/utils/image-placeholders.ts`, `lib/types/mach/Promotion.ts`) are excluded from scanning entirely rather than merely flagged inline — this matches TOKEN-MAP §6's framing of them as named-file *exceptions*, each with a printed reason, so a future "0 violations" result is never silently missing content the scanner never looked at.
- Functional-color regex captures the full `rgb(...)`/`hsl(...)` call (up to the closing paren) rather than just the triggering `rgb(` + digit, for a more readable match string in scan output — same detection semantics, better diagnostics.
- No explicit variant-chain submatch in the Tailwind/shadcn regex: a single lookbehind for "not preceded by a word/hyphen character" is sufficient, since every variant chain — including bracketed arbitrary variants like `data-[state=open]:` — always ends in `:`, which already satisfies that boundary. This is simpler than modeling the full variant grammar and handles the arbitrary-value case the plan calls out without extra complexity.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The completion gate is live and proven fail-first. `mise exec -- npm run scan:tokens` currently reports 1165 violations across 86 files on the pre-sweep tree — this is expected and is the evidence the gate has teeth. Every later 05-* plan can run the same command; when it finally exits 0, that result means something because this plan watched it exit 1 first.

Ready for 05-02.

---
*Phase: 05-token-contract-component-sweep*
*Completed: 2026-09-04*
