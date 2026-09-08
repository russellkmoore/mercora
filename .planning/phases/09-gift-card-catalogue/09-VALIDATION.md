---
phase: "9"
slug: "gift-card-catalogue"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-08"
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest, config at repo root (`vitest.config.mts`) |
| **Config file** | `vitest.config.mts` (existing, unmodified) |
| **Quick run command** | `mise exec -- npx vitest run tests/unit/data/seed-gift-card.test.ts tests/unit/lib/inventory/availability.test.ts tests/unit/lib/services/inventory-adjustments.test.ts tests/unit/lib/models/mach/product-serializer.test.ts` |
| **Full suite command** | `mise exec -- npm test` |
| **Estimated runtime** | ~9 seconds (quick run); full suite ~1-2 minutes |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above (targeted files for the task; the full quick-run set for anything touching the seed/inventory/serializer trio)
- **After every plan wave:** Run `mise exec -- npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~9 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | CAT-01, CAT-02 | T-09-01 / T-09-02 / T-09-03 | Seed block applies cleanly to a scratch D1 and replays idempotently; `/product/gift-card` renders 200 locally | integration | `mise exec -- npx wrangler d1 execute mercora-db --local --persist-to /tmp/gsd-09-scratch-d1 --file data/d1/seed.sql` then read-back `SELECT`; `curl http://localhost:3000/product/gift-card` | ✅ | ✅ green |
| 9-01-02 | 01 | 1 | CAT-01 | T-09-04 | Guard test pins sentinels, statement count, ids, tax code, inventory shape, prices, image path | unit | `mise exec -- npx vitest run tests/unit/data/seed-gift-card.test.ts` | ✅ | ✅ green (9/9) |
| 9-02-01 | 02 | 2 | CAT-04 | — | Untracked gift-card inventory (`{"track_inventory": false}`) reads as always-available | unit | `mise exec -- npx vitest run tests/unit/lib/inventory/availability.test.ts` | ✅ | ✅ green (6/6) |
| 9-02-02 | 02 | 2 | CAT-04 | T-09-06 | Paid-order inventory decrement skips gift-card lines, alone and mixed with a physical line | unit | `mise exec -- npx vitest run tests/unit/lib/services/inventory-adjustments.test.ts` | ✅ | ✅ green (10/10) |
| 9-02-03 | 02 | 2 | CAT-02, CAT-04 | T-09-05 / T-09-07 | Public projection carries four available, correctly priced denominations; strips cost/barcode/inventory; tax code passes checkout regex | unit | `mise exec -- npx vitest run tests/unit/lib/models/mach/product-serializer.test.ts` | ✅ | ✅ green (9/9) |
| 9-03-01 | 03 | 2 | CAT-03 | T-09-10 | Generated render carries no lettering/logo/numeral; committed at the seeded image path | other (scripted generation + file check) | `mise exec -- node /tmp/gsd-09-generate-image.mjs`; `file data/r2/products/gift-card-33.png` (1024x1536) | ✅ | ✅ green |
| 9-03-02 | 03 | 2 | CAT-03 | T-09-08 / T-09-09 / T-09-11 | Public bucket serves the exact seeded image key at 200 | integration (remote R2) | `mise exec -- npx wrangler r2 object put voltique-images/products/gift-card-33.png --file data/r2/products/gift-card-33.png --remote`; `curl -sI https://voltique-images.russellkmoore.me/products/gift-card-33.png` | ✅ | ✅ green (200) |
| 9-04-01 | 04 | 3 | CAT-01, CAT-02, CAT-03 (docs) | T-09-16 | Runbook names the real seed path and the sliced production-apply recipe; no dead path or credential in docs | other (docs gate) | `mise exec -- npm run docs:lint` | ✅ | ✅ green (0 violations) |
| 9-04-02 | 04 | 3 | CAT-01, CAT-02 | T-09-15 | Operator decision recorded before any production write | manual (checkpoint:decision) | N/A — human answer recorded in 09-04-SUMMARY.md | ✅ | ✅ answered: apply-active (09-04-SUMMARY.md) |
| 9-04-03 | 04 | 3 | CAT-01, CAT-02, CAT-03 | T-09-12 / T-09-13 / T-09-14 | Production D1 holds the exact seeded rows; live product page and image both return 200 | integration (remote D1 + live curl) | `mise exec -- npx wrangler d1 execute mercora-db --remote --file /tmp/gsd-09-gift-card-apply.sql`; production read-back `SELECT`s; `curl https://voltique.russellkmoore.me/product/gift-card`; `curl -sI https://voltique-images.russellkmoore.me/products/gift-card-33.png` | ✅ | ✅ production read-back p=1 v=4 pr=1, live 200s (09-04-SUMMARY.md) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/unit/lib/inventory/availability.test.ts` — new file, new directory; closed by plan 09-02 Task 1 (6 tests)
- [x] Extend `tests/unit/lib/services/inventory-adjustments.test.ts` — closed by plan 09-02 Task 2 (4 new tests, gift-card skip)
- [x] Extend `tests/unit/lib/models/mach/product-serializer.test.ts` — closed by plan 09-02 Task 3 (6 new tests, gift-card denomination projection)
- [x] `tests/unit/lib/utils/product-image.test.ts` — confirmed to already exist and test the flat `{url, alt_text}` image shape generically; no gift-card-specific fixture was needed (Research Finding, re-confirmed this session: file present at `tests/unit/lib/utils/product-image.test.ts`)
- [x] Scripted/manual D1-apply verification for CAT-01 — closed by plan 09-01 Task 1's scratch-D1 apply and read-back, and by plan 09-04 Task 3's production apply and read-back

All Wave 0 gaps Research identified are closed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirm the production catalogue write (status: active/draft) before any `--remote` D1 apply | CAT-01, CAT-02 | Costly-to-reverse production write; the plan places a `checkpoint:decision` gate here by design (five hand-run deletes to undo) | Read the checkpoint's decision context in 09-04-PLAN.md Task 2; reply `apply-active`, `apply-draft`, or `hold`; the answer is recorded verbatim in 09-04-SUMMARY.md |
| Production read-back matches the plan 09-01 scratch read-back value for value | CAT-01 | Requires a live `wrangler d1 execute --remote` call against the real production database, not a vitest case | `mise exec -- npx wrangler d1 execute mercora-db --remote --json --command "SELECT ..."` per 09-04-PLAN.md Task 3's `<verify>` block; compare against 09-01-SUMMARY.md's recorded scratch values |
| `https://voltique.russellkmoore.me/product/gift-card` renders 200 with the product name and default price | CAT-02 | Live production HTTP fetch against the deployed Worker, not a unit test | the curl command in 09-04-PLAN.md Task 3's `<verify>` block, saving the body and printing the status code; grep the saved body for `Voltique Gift Card` and `25.00` |
| `https://voltique-images.russellkmoore.me/products/gift-card-33.png` resolves publicly | CAT-03 | Live CDN/R2 fetch, not a unit test | `curl -sI --max-time 30 https://voltique-images.russellkmoore.me/products/gift-card-33.png`; expect `200` |
| Live Featured category page lists the gift card last (backstop truth) | CAT-01 (D-02) | The category route has no `revalidate: 0` export, so it may serve a stale incremental cache; this is a backstop check, not a gate | `curl -s https://voltique.russellkmoore.me/category/featured \| grep -q "Voltique Gift Card"`; if absent, note that the category route may not have revalidated yet before treating it as a defect |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the one `checkpoint:decision` task is explicitly manual by design, per its `<verify><human-check>`)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only 9-04-02, the decision checkpoint, is non-automated; it is flanked by automated tasks on both sides)
- [x] Wave 0 covers all MISSING references (see Wave 0 Requirements above — all closed)
- [x] No watch-mode flags (`vitest run`, never `vitest watch`, used throughout)
- [x] Feedback latency < 9s (targeted quick-run command; full suite runs at wave boundaries only)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-08
