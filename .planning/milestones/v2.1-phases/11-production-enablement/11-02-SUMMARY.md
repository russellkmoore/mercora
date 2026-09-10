---
phase: 11-production-enablement
plan: 02
subsystem: gift-cards-config
tags: [docs, env-config, testing, secrets]
requires:
  - phase: 11-production-enablement
    plan: "01"
    provides: Proven local key-ring pipeline shape and phase_base (3f287e3) for downstream leak scans
provides:
  - ".env.example carrying all four gift-card secret names with a placeholder that fails closed until replaced"
  - "A source-contract test binding .env.example's documented shape to the real parsers"
affects: [phase-11-plan-03, phase-11-plan-04]
actuals:
  tokens: 1966
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - "Comment-tolerant assignment extraction regex (^#?\\s*([A-Z][A-Z0-9_]*)=(.*)$) to read a commented-placeholder env file as structured data without a parsing library"
key-files:
  created:
    - tests/unit/scripts/env-example-gift-card-shape.test.ts
  modified:
    - .env.example
key-decisions:
  - "D-12 wording used the corrected (not the originally proposed) form: .dev.vars is the read path under plain npm run dev too, since next.config.ts calls initOpenNextCloudflareForDev() unconditionally in development — not a split by runner, per 11-RESEARCH.md Pitfall 6."
  - "Delivery-ring comment block wrapped to 3 lines at ~80 chars per line (slightly wider than the file's typical ~78-char lines) to fit the required content within the plan's specified 3-line shape without truncating meaning."
patterns-established:
  - "Delivery-ring placeholder payload stays hyphenated English (never base64-shaped) so it both fails the parser's character-class regex and can never match a leak-detection scan for an unbroken base64 run — same discipline plan 11-01 established for test fixtures, now applied to the developer-facing example file."
requirements-completed: [OPS-04]
coverage:
  - id: D1
    description: ".env.example names all four gift-card secrets exactly once each, in the documented adjacent order (HMAC current, HMAC keys, delivery current, delivery keys), with no other assignment line between the first and last."
    requirement: "OPS-04"
    verification:
      - kind: unit
        ref: "tests/unit/scripts/env-example-gift-card-shape.test.ts#names each of the four gift-card secrets exactly once; #documents the four names in order, adjacent with no assignment between them"
        status: pass
      - kind: shell
        ref: "grep -c for each of the four names equals 1; grep -n 'GIFT_CARD_' .env.example shows the four names on four consecutive assignment lines"
        status: pass
    human_judgment: false
  - id: D2
    description: "The documented HMAC placeholder is accepted by parseGiftCardCodeKeyRing as written (33 bytes, over the 32-byte floor); the documented delivery placeholder is rejected by parseGiftCardDeliveryKeyRing as written and accepted only once its payload is replaced with a real 32-byte key."
    requirement: "OPS-04"
    verification:
      - kind: unit
        ref: "tests/unit/scripts/env-example-gift-card-shape.test.ts#the documented HMAC placeholder parses as written; #the documented delivery placeholder is rejected by the parser as written; #the delivery placeholder parses once its payload is replaced with a real 32-byte key"
        status: pass
    human_judgment: false
  - id: D3
    description: ".env.example states that local development reads the gift-card values from .dev.vars (not .env.local) and states why, via initOpenNextCloudflareForDev()."
    requirement: "OPS-04"
    verification:
      - kind: shell
        ref: "grep -c 'initOpenNextCloudflareForDev' .env.example equals 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "No placeholder in .env.example can be mistaken for real key material — no unbroken 20+ character base64 run anywhere in the file, and no secret-shaped literal was added in either commit's diff."
    requirement: "OPS-04"
    verification:
      - kind: shell
        ref: "grep -cE 'base64:[A-Za-z0-9+/]{20,}' .env.example equals 0; git log -p over both commits filtered to added lines only, grep -cE for the same pattern equals 0"
        status: pass
    human_judgment: false
duration: 4min
completed: 2026-09-09
status: complete
---

# Phase 11 Plan 02: Gift-Card .env.example Secrets Summary

**Extended `.env.example` with the delivery-ring placeholder pair and a `.dev.vars` read-path comment, then pinned the whole documented shape with a test that runs it through the real parsers.**

## Performance

- 2 tasks, 2 commits, 2 files changed (132 insertions, 0 deletions), ~4 minutes.
- `actuals.tokens` (chars/4 over the realized diff) came in far under the 35000-token estimate — the plan's own `read_first` set was wide (12+ files per task for context), but the eventual diff was a 10-line `.env.example` addition and a single new 122-line test file.

## Accomplishments

- **Task 1:** Added the two delivery-ring placeholder lines (`GIFT_CARD_DELIVERY_CURRENT_VERSION`, `GIFT_CARD_DELIVERY_KEYS_JSON`) immediately after the existing HMAC pair in `.env.example`, with a 3-line comment stating the AES-256 shape and generation command, and a 5-line comment above the HMAC block stating that all four gift-card secrets — and every other Cloudflare binding/secret — are read from `.dev.vars` in local development (never `.env.local`), because `next.config.ts` calls `initOpenNextCloudflareForDev()` unconditionally in development. The delivery placeholder payload (`replace-with-32-random-bytes-base64-encoded`) is hyphenated English behind the required `base64:` prefix, so it fails the delivery-ring's character-class regex and can never pass a base64-shape leak scan. The two existing HMAC lines were left byte-for-byte unchanged.
- **Task 2:** Created `tests/unit/scripts/env-example-gift-card-shape.test.ts`, which reads `.env.example` from disk with `readFileSync`, extracts every assignment line (comment-tolerant, via a regex that only matches an all-caps identifier immediately followed by `=`), and asserts against the real `parseGiftCardCodeKeyRing` / `parseGiftCardDeliveryKeyRing` parsers imported from `@/lib/gift-cards/config`:
  - All four gift-card names appear exactly once each, in the documented order, on four consecutive assignment-line positions.
  - The documented HMAC placeholder parses as written.
  - The documented delivery placeholder is rejected as written.
  - The delivery placeholder parses once its payload is swapped in memory for a real 32-byte key (`base64:${btoa("0".repeat(32))}`), proving the "accepted only when replaced" half of the OPS-04 claim.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add delivery-ring placeholders and local read-path comment to `.env.example` | `2469358` | `.env.example` |
| 2 | Pin `.env.example` against the real parsers with a source-contract test | `7406862` | `tests/unit/scripts/env-example-gift-card-shape.test.ts` |

## Files Created/Modified

- Modified: `.env.example` — 10 lines added (5-line `.dev.vars` read-path comment, 3-line delivery-ring comment, 2 delivery-ring placeholder lines). No deletions; the two existing HMAC lines are unchanged.
- Created: `tests/unit/scripts/env-example-gift-card-shape.test.ts` — 5 test cases, all passing, all built against the real parsers.

## Decisions Made

- Used the corrected D-12 wording (per 11-RESEARCH.md Pitfall 6): `.dev.vars` is the read path for `npm run dev` too, not split by runner — every gift-card read in this codebase goes through `getCloudflareContext().env`, which `initOpenNextCloudflareForDev()` backs with `.dev.vars` unconditionally in development.
- Wrapped the delivery-ring comment to 3 lines at ~80 characters per line, slightly wider than the file's typical ~78-character comment lines, to fit the required content (AES-256 shape, `base64:` prefix, generation command, fail-closed statement) within exactly 3 lines as specified.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria and the plan-level `<verification>` block passed on the first attempt.

## Issues Encountered

None.

## User Setup Required

None. This plan is entirely local — no production command was run, no secret value was generated, printed, or written anywhere.

## Next Phase Readiness

- Plan 11-03 (docs) can reference this plan's `.env.example` shape directly — `docs/runtime-configuration.md`'s new delivery-ring table row and paragraph, and `docs/DEPLOYMENT_SETUP.md`'s new `## 9. Gift Card Enablement` section, now have a committed, test-pinned example to point at.
- Plan 11-04 (production secret provisioning) has both a locally-proven pipeline shape (11-01) and a proven documented shape (this plan) to run against Cloudflare's secret store.
- No blockers. No secret value appeared in any transcript, commit, log, or planning artifact produced by this plan.

---
*Phase: 11-production-enablement*
*Completed: 2026-09-09*

## Self-Check: PASSED

- FOUND: `.env.example`
- FOUND: `tests/unit/scripts/env-example-gift-card-shape.test.ts`
- FOUND: `.planning/phases/11-production-enablement/11-02-SUMMARY.md`
- FOUND: commit `2469358` and `7406862` via `git log --oneline --all --grep="11-02"`
- Task 1 acceptance criteria re-verified: exit 0 (all five grep-based checks pass)
- Task 2 acceptance criteria re-verified: exit 0 (vitest 5 passed; `parseGiftCardDeliveryKeyRing` count 3)
- Plan-level `<verification>`: `npm test` (278 files / 2336 tests), `npm run lint`, `npm run typecheck` all exit 0; `git diff --stat -- .env.example` additions only; added-lines-only leak scan across both commits returns 0
