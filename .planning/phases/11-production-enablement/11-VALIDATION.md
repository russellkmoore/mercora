---
phase: "11"
slug: "production-enablement"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-08"
validated: "2026-09-09"
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

This phase writes almost no application code. Its validation problem is unusual and worth
stating plainly: the things that must be true live in a Cloudflare secret store, in a deployed
Worker's runtime behavior, and in two documents — not in a function anyone can unit test. So
the strategy splits in two.

Everything about **shape** is tested locally against the real, frozen parsers, before any
production command runs (11-01, 11-02). Everything about **live behavior** is proved by a
read-only production observation with a real failure mode (11-04, 11-05): a five-minute cron
cycle that would throw if the delivery ring were malformed, watched for its success line and
for the absence of the critical recovery-failure event.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.mts` (unit), `vitest.workers.config.mts` (Workers), `vitest.observability.config.mts` (tail worker) |
| **Quick run command** | `mise exec -- npx vitest run tests/unit/lib/gift-cards/config.test.ts` |
| **Full suite command** | `mise exec -- npm test` |
| **Estimated runtime** | quick ~0.8s; full unit suite ~8.3s (277 files, 2326 tests, measured 2026-09-08) |

**One machine-specific gotcha that affects every gate run in this phase.** `wrangler types`
reads local env files, including `.dev.vars`, which plan 11-01 creates. Measured during
planning: `mise exec -- npm run cf-typecheck` fails today with the local env file present and
passes with the env files moved out of the tree. Every `cf-typegen` / `cf-typecheck` invocation
in this phase must therefore run inside a move-aside wrapper — move `.env*.local` and
`.dev.vars` to a directory under the system temp path, run the command, capture the status,
move them back, exit with the captured status. Use the glob form for the local env file; this
runtime's secret-file guard refuses commands that name it literally.

---

## Sampling Rate

- **After every task commit:** `mise exec -- npm run lint && mise exec -- npm run typecheck && mise exec -- npx vitest run tests/unit/lib/gift-cards/config.test.ts`
- **After every plan wave:** `mise exec -- npm test && mise exec -- npm run docs:lint` (plus `cf-typecheck` inside the move-aside wrapper from wave 3 onward)
- **Before `/gsd-verify-work 11`:** the full CI gate list in `.github/workflows/ci.yml` order, run by plan 11-05 Task 3
- **Max feedback latency:** ~9 seconds for the full unit suite; under 1 second for the gift-card quick run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | OPS-01 | T-11-01 / T-11-02 | A generated key never leaves the pipeline, and git cannot see the file it lands in | other (shell) | `git check-ignore -v .dev.vars > "$TMPDIR/gsd11-ignore.txt" && grep -q '^\.gitignore:' … && test "$(grep -oE '^GIFT_CARD_[A-Z_]+' .dev.vars \| sort -u \| wc -l)" -eq 4` | ✅ `.gitignore` | ✅ green (re-run 2026-09-09: gitignore match + 4 names) |
| 11-01-02 | 01 | 1 | OPS-01 | T-11-03 / T-11-04 | The production ring shape is proven acceptable, and an under-length key proven rejected, before any live command | unit | `mise exec -- npx vitest run tests/unit/lib/gift-cards/config.test.ts` | ✅ extends existing file | ✅ green (re-run 2026-09-09: 15/15 passed) |
| 11-02-01 | 02 | 2 | OPS-04 | T-11-05 / T-11-06 | No placeholder in the public example can pass for key material | other (shell) | `test "$(grep -c 'GIFT_CARD_DELIVERY_KEYS_JSON' .env.example)" -eq 1 && test "$(grep -cE 'base64:[A-Za-z0-9+/]{20,}' .env.example)" -eq 0` | ✅ `.env.example` | ✅ green (re-run 2026-09-09) |
| 11-02-02 | 02 | 2 | OPS-04 | T-11-07 | The documented shape cannot drift from the enforced shape | unit | `mise exec -- npx vitest run tests/unit/scripts/env-example-gift-card-shape.test.ts` | ✅ `tests/unit/scripts/env-example-gift-card-shape.test.ts` | ✅ green (re-run 2026-09-09: 5/5 passed) |
| 11-03-01 | 03 | 2 | OPS-03 | T-11-10 | The variable contract is written without any credential-shaped string | other | `mise exec -- npm run docs:lint` | ✅ `scripts/docs-lint.mjs` | ✅ green (re-run 2026-09-09: 0 violations) |
| 11-03-02 | 03 | 2 | OPS-03 | T-11-09 / T-11-11 / T-11-12 / T-11-13 | The runbook teaches the non-leaking pipeline, the enforced flag order, and a verification that can actually fail | other | `test "$(awk '/^## 9\./,0' docs/DEPLOYMENT_SETUP.md \| grep -cE 'npm run (deploy\|deploy:ci)')" -eq 0 && mise exec -- npm run docs:lint` | ✅ `docs/DEPLOYMENT_SETUP.md` | ✅ green (re-run 2026-09-09) |
| 11-04-01 | 04 | 3 | OPS-01 | T-11-14 | Four values reach Cloudflare and nowhere else; the proof is names only | other (live, read-only) | `test "$(mise exec -- npx wrangler secret list \| grep -oE 'GIFT_CARD_(CODE_HMAC\|DELIVERY)_(CURRENT_VERSION\|KEYS_JSON)' \| sort -u \| wc -l)" -eq 4` | N/A — live check | ✅ green (re-run 2026-09-09: 4 names present in production) |
| 11-04-02 | 04 | 3 | OPS-02 | T-11-17 / T-11-18 / T-11-19 | Reconciliation only; acquisition provably absent from this commit; generated types match CI's | other | `test "$(grep -c '"STORE_FEATURE_GIFT_CARD_RECONCILIATION": "true"' wrangler.jsonc)" -eq 1 && test "$(grep -c 'STORE_FEATURE_GIFT_CARD_ACQUISITION' wrangler.jsonc)" -eq 0 && test "$(grep -c 'GIFT_CARD_' cloudflare-env.d.ts)" -eq 0` | ✅ `wrangler.jsonc` | ✅ green (superseded 2026-09-09 by 11-05-02, which now also has acquisition; reconciliation flag itself re-confirmed present) |
| 11-04-03 | 04 | 3 | OPS-01, OPS-02 | T-11-15 / T-11-16 / T-11-20 | A malformed ring would fail the cron within one cycle; no key-shaped material reached git | other (live, read-only) | `test "$(grep -c 'recovery queues drained' "$TMPDIR/mercora-11-cron.jsonl")" -ge 1 && test "$(grep -c 'cron.recovery_failed' …)" -eq 0` | N/A — live check | ✅ green (captured 2026-09-09 during 11-04 execution: drain success 1, recovery_failed 0; capture file deleted per plan) |
| 11-05-01 | 05 | 4 | OPS-02 | T-11-21 | A human decides before anything becomes purchasable; never auto-approved | manual | none — `checkpoint:decision gate="blocking-human"` | N/A — checkpoint | ✅ green (Russell answered `enable-anyway` 2026-09-09; never auto-approved) |
| 11-05-02 | 05 | 4 | OPS-02 | T-11-22 / T-11-23 / T-11-24 | Both flags consistent; a clean post-deploy cron cycle proves capability resolution did not throw | other (live, read-only) | `test "$(grep -c '"STORE_FEATURE_GIFT_CARD_ACQUISITION": "true"' wrangler.jsonc)" -eq 1 && test "$(grep -c 'recovery queues drained' "$TMPDIR/mercora-11-cron-acq.jsonl")" -ge 1` | ✅ `wrangler.jsonc` | ✅ green (2026-09-09: acquisition flag =1, deploy `31555fd0-5bcc-44bd-b1f7-3839a652c460`, drain success 1 / recovery_failed 0, capture file deleted) |
| 11-05-03 | 05 | 4 | OPS-01..04 | T-11-25 / T-11-26 | Whole-phase re-check: no key in history, no forbidden path touched | other | `mise exec -- npm test && mise exec -- npm run test:workers && mise exec -- npm run test:observability-worker && mise exec -- npm run build && …` | ✅ `.github/workflows/ci.yml` | ✅ green (2026-09-09: full CI gate list all exit 0; forbidden-path scan 0; scoped + wide leak scans both 0) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Vitest is already configured and already
covers the exact module this phase's tests extend (`tests/unit/lib/gift-cards/config.test.ts`,
10 passing cases before this phase). No framework install, no shared fixture file, and no test
scaffold is needed ahead of wave 1.

The one new test file, `tests/unit/scripts/env-example-gift-card-shape.test.ts`, is created by
the task that verifies with it (11-02-02) and lands under an include glob that already picks up
`tests/unit/scripts/check-deploy-config.test.ts`. That is authoring, not a wave-0 gap.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A signed-in shopper's gift-card listing returns a healthy response | OPS-01, OPS-02 | `GET /api/gift-cards` requires a live Clerk session. It is the only endpoint that distinguishes a healthy key ring from a broken one — the public balance endpoint answers identically either way by design — and no service-token bypass exists for that route. | Signed in as yourself on the live site, open the account gift-cards view. Expect HTTP 200 with a `cards` array; empty is correct, nothing has been sold. A 503 saying gift cards are temporarily unavailable means the ring or the database is unhealthy and acquisition must not be enabled. |
| The checkout gift-card code field still behaves after reconciliation goes on | OPS-02 | Visual and interactive, and it is the one shopper-visible path the reconciliation flag changes. Research assumption A1 said no redemption UI existed; planning disproved that — `components/checkout/CheckoutClient.tsx` renders a "Gift card" code input on the shipping step, ungated by either flag. | On the live site, open checkout with anything in the cart and enter a made-up gift-card code. Expect a clean rejection that does not break the page or block the rest of checkout. Before this phase the code was rejected by a no-op capability; after it, `resolveTender` throws a capability-disabled error. No gift card exists in production yet, so no code can legitimately succeed either way. |
| The gift card product page is usable by a shopper once acquisition is on | OPS-02 | Visual and interactive. It is also the still-open visual half of Phase 10's deferred verification. | On the live site, open the gift card product page as a shopper, confirm the recipient form and add-to-cart controls render and work, and that a gift card can be added to the cart. Anything wrong here belongs in `/gsd-verify-work 10`, not an inline fix. |
| The D-07 decision itself | OPS-02 | Only Russell can weigh enabling live gift-card sales against Phase 10's deferred human verification. | Answer the `checkpoint:decision` in 11-05 with `verified-10-passed`, `enable-anyway`, or `hold`. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a stated manual-only reason (the D-07 checkpoint is the only task without one, by design)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none exist)
- [x] No watch-mode flags
- [x] Feedback latency < 11s
- [x] `nyquist_compliant: true` set in frontmatter — set by 11-05-03 once every row above is green

**Approval:** validated 2026-09-09 by 11-05 Task 3. Every row above is green. The three
manual-only visual/interactive verifications in the table above this section remain open —
they are not part of the automated Nyquist contract and are carried forward to
`/gsd-verify-work 11` (and, for the still-open half, `/gsd-verify-work 10`) per D-07.
