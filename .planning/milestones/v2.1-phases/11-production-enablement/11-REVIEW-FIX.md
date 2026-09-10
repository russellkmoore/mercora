---
phase: 11-production-enablement
fixed_at: 2026-09-09T19:13:00Z
review_path: .planning/phases/11-production-enablement/11-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-09-09T19:13:00Z
**Source review:** .planning/phases/11-production-enablement/11-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Delivery-ring parse-order claim is reversed from the actual code

**Files modified:** `docs/DEPLOYMENT_SETUP.md`, `docs/runtime-configuration.md`
**Commit:** `1aaf389`
**Applied fix:** Confirmed the actual order in `lib/services/gift-card-fulfillment.ts:200-204` —
the pending-deliveries D1 query runs first, and the delivery-ring parse runs immediately after,
unconditionally (not gated on row count). Rewrote both passages to say the ring "is parsed
immediately after the pending-deliveries query and before any row is processed, regardless of how
many rows came back" instead of the reversed "parsed before the drain checks whether anything is
pending." The operational conclusion (a malformed ring still fails the cycle even with zero
deliveries queued) is preserved verbatim in both files.

### WR-02: `GET /api/gift-cards` 503 does not indicate ring health

**Files modified:** `docs/DEPLOYMENT_SETUP.md`
**Commit:** `32ce700`
**Applied fix:** Read `app/api/gift-cards/route.ts` and `lib/gift-cards/presentations.ts` and
confirmed neither calls `parseGiftCardCodeKeyRing` nor `parseGiftCardDeliveryKeyRing` — the route
only reads D1 and has a blanket `catch` returning 503. Reworded Step 3's check #3 in
`docs/DEPLOYMENT_SETUP.md` from "a 503 there means the ring or the database is unhealthy" to "a
503 there means the database is unhealthy (this endpoint never touches either key ring — check #2
above is what catches a malformed ring)," matching the review's suggested wording.

### WR-03: HMAC-ring placeholder in `.env.example` silently parses successfully, unlike the delivery-ring placeholder, with no warning

**Files modified:** `.env.example`
**Commit:** `d8ba58c`
**Applied fix:** Added a three-line warning to the HMAC-ring comment block in `.env.example`,
parallel to the delivery ring's existing "rejected by the parser until replaced" warning: notes
that the HMAC placeholder is long enough (33 bytes, over the 32-byte floor) to satisfy the parser
as written and will not fail loudly if left in place, and instructs replacing it with a real key
via `openssl rand -base64 32` before any deployment. Kept the commented-placeholder style. No
secret value was added. `tests/unit/scripts/env-example-gift-card-shape.test.ts` still passes
unmodified — the added lines are prose comments with no `NAME=value` shape, so the test's
line-matching regex (`ASSIGNMENT_LINE_RE`) does not match them and the "four names adjacent with
no assignment between them" ordering assertion is unaffected.

## Skipped Issues

None — all findings were fixed.

## Verification

Both required gates ran in the main checkout (no worktree — `workflow.use_worktrees` is `false`
in `.planning/config.json`), via `mise exec --`:

- `npm run docs:lint` — 0 violations (run after each of the three commits).
- `npx vitest run tests/unit/scripts/env-example-gift-card-shape.test.ts tests/unit/lib/gift-cards/config.test.ts` — 20 tests passed (run after the initial edit and again after the final WR-03 commit).

No file under `lib/**`, `app/**`, `wrangler.jsonc`, or `cloudflare-env.d.ts` was touched. No `.env.local`
or `.dev.vars` was read. No secret value was written anywhere.

---

_Fixed: 2026-09-09T19:13:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
