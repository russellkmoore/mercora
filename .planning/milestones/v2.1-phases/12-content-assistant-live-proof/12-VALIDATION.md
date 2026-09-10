---
phase: "12"
slug: "content-assistant-live-proof"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-09"
validated: "2026-09-09"
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled by 12-06 from commands that actually ran. Every command in the map below was executed;
> none is aspirational.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.11 |
| **Config file** | `vitest.config.mts` (repo default; `vitest.workers.config.mts` and `vitest.observability.config.mts` for the two Workers suites) |
| **Quick run command** | `mise exec -- npx vitest run tests/unit/data/knowledge-gift-cards.test.ts` |
| **Full suite command** | `mise exec -- npm test` |
| **Estimated runtime** | quick ~0.1s (measured 83ms, 10 tests); full ~7.3s (measured 7.27s, 279 files / 2347 tests) |

---

## Sampling Rate

- **After every task commit:** Run `mise exec -- npx vitest run tests/unit/data/knowledge-gift-cards.test.ts`
- **After every plan wave:** Run `mise exec -- npm test`
- **Before `/gsd-verify-work`:** the CI-mirroring list in CI's own order — `npm audit --omit=dev --audit-level=high`, `npm run build:themes:check`, `npm run scan:tokens`, `npm run lint`, `npm run typecheck`, `npm run cf-typecheck` (env files moved aside), `npm test`, `npm run test:workers`, `npm run test:observability-worker`, `npm run build`, plus `npm run docs:lint`. Run in full by 12-06 Task 1; all eleven exited 0.
- **Max feedback latency:** 7.3 seconds (the full unit suite)

Most of this phase's evidence is a production read rather than a test run, because the phase's
subject is production state. Those rows are typed `production-read` or `e2e` below and are never
counted as unit coverage.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | CONTENT-02 | T-12-01 / T-12-02 | Remote bindings opened read-only against a scratch config copy; the committed `wrangler.jsonc` is never edited | integration | `mise exec -- node $SCRATCH/12-remote-env.mjs` — exit 0; products=33, knowledge_md objects=9, dimensions=768, vectorCount=48, embedding length=768 | n/a — scratch harness | ✅ green |
| 12-01-02 | 01 | 1 | CONTENT-02 | T-12-03 / T-12-04 | Pre-write baseline captured with named columns only; no secret value read | production-read | `wrangler vectorize info voltique-index`; `wrangler d1 execute mercora-db --remote` named-column SELECTs; `wrangler r2 object get --remote` — baseline vectorCount 48, dimensions 768 | n/a — production read | ✅ green |
| 12-01-03 | 01 | 1 | CONTENT-02 | T-12-05 / T-12-06 | No production write happens until the tree and the CI gates are proven green | other | `git status --porcelain --untracked-files=no` (empty); the CI gate list run to green before the first write | n/a — gate run | ✅ green |
| 12-02-01 | 02 | 2 | CONTENT-01 | T-12-07 | The article's promises are pinned by a test that reads the real committed file, so a regression fails the suite | unit (RED) | `mise exec -- npx vitest run tests/unit/data/knowledge-gift-cards.test.ts` — 6 of 10 failed against the pre-rewrite article | ✅ | ✅ green |
| 12-02-02 | 02 | 2 | CONTENT-01 | T-12-08 / T-12-09 | The stale 60-minute delivery promise cannot re-enter the article | unit (GREEN) | `mise exec -- npx vitest run tests/unit/data/knowledge-gift-cards.test.ts` — 10 of 10 passed; `mise exec -- npm test` — 279 files / 2346 tests passed | ✅ | ✅ green |
| 12-02-03 | 02 | 2 | CONTENT-01 | T-12-10 | The public object's body is proven byte-identical to the committed file rather than assumed | e2e | `curl -sI https://voltique-images.russellkmoore.me/knowledge_md/gift-cards.md` ETag = `md5 -q data/r2/knowledge_md/gift-cards.md` — both `435afd94cd37ca7f77203101c222c35d` | ✅ | ✅ green |
| 12-03-01 | 03 | 2 | CONTENT-03 | T-12-11 / T-12-12 | The UPDATE is generated from the row's own current content, so no pre-existing byte is retyped | production-read | `wrangler d1 execute mercora-db --remote --json` read-only SELECT of the `terms-of-service` row plus a generated, scoped UPDATE | n/a — production read | ✅ green |
| 12-03-02 | 03 | 2 | CONTENT-03 | T-12-13 / T-12-14 | Exactly one row changes; only the columns Admin → Pages itself writes are touched | integration | `wrangler d1 execute mercora-db --remote --file` UPDATE, then read-back — content md5 `4c0a0ef39a1bc0c50f557eac877eaadb`, 1468 bytes, version 2→3, `status` still `published`, other four `pages` rows byte-identical | n/a — production write + read-back | ✅ green |
| 12-03-03 | 03 | 2 | CONTENT-03 | T-12-15 | The section is proven served, not just stored | e2e | `curl -sf https://voltique.russellkmoore.me/terms-of-service` then occurrence parity — `LIVE_TERMS_OK gift=4 recurring=4` | n/a — live page | ✅ green |
| 12-04-01 | 04 | 3 | CONTENT-02 | T-12-16 / T-12-17 | The re-index is upsert-only — the script contains no delete or clear call | integration | `mise exec -- node $SCRATCH/12-reindex-knowledge.mjs` — exit 0, 9 articles walked, 1 upserted, 0 errors, embeddingLength 768 | n/a — scratch harness | ✅ green |
| 12-04-02 | 04 | 3 | CONTENT-02 | T-12-18 / T-12-19 | Retrieval is proven on the `answer` prose alone, so the catalogue name in `products` cannot mask a regression | e2e | three unauthenticated `POST https://voltique.russellkmoore.me/api/agent-chat` calls, `answer` field parsed and matched against `gift card` — 200/200/200, matches 1 / 1 / 2 | n/a — live endpoint | ✅ green |
| 12-04-03 | 04 | 3 | CONTENT-02 | T-12-20 / T-12-21 | Nothing outside the one vector moved: the index count is unchanged and unrelated vectors survive | production-read | `wrangler vectorize info voltique-index` — 48 before and after, dimensions 768; `wrangler vectorize get-vectors --ids prod_33` and `--ids knowledge-shipping` intact; `git status --porcelain --untracked-files=no` empty | n/a — production read | ✅ green |
| 12-05-01 | 05 | 4 | SHOP-07 | T-12-22 / T-12-23 | The purchase can only happen once — it aborts if the proof artifact exists or if any gift card account exists | e2e | guarded purchase script against production; both guards logged as passing before the first billable call; `POST /v1/payment_intents/<id>/confirm` with the public `pk_test_` key only | n/a — production e2e | ✅ green |
| 12-05-02 | 05 | 4 | SHOP-07 | T-12-24 / T-12-25 / T-12-26 | Every SELECT names its columns; no bearer code or code column is ever read | production-read | `wrangler d1 execute mercora-db --remote --json` named-column SELECTs over `orders`, `gift_card_accounts`, `gift_card_deliveries`, `email_deliveries` — paid / active 2500 USD / sent / cloudflare succeeded | n/a — production read | ✅ green |
| 12-05-03 | 05 | 4 | SHOP-07 | T-12-27 / T-12-28 | The unprovable Account → Gift Cards clause is recorded as a gap, never claimed as a pass | other | `test -s COVERAGE.md` and a count of `stripe` in it — 11; the gap recorded in `12-PROOF-ORDER.md` §6 with `purchaser_customer_id` NULL as its evidence | ✅ | ✅ green |
| 12-06-01 | 06 | 5 | CONTENT-01, CONTENT-02, CONTENT-03, SHOP-07 | T-12-SC | The audit runs first, against an unchanged lockfile, before any other gate | other | the eleven CI-mirroring commands in CI's order — all exit 0; `npm audit --omit=dev --audit-level=high` found 0 vulnerabilities | n/a — gate run | ✅ green |
| 12-06-02 | 06 | 5 | CONTENT-01, CONTENT-02, CONTENT-03, SHOP-07 | T-12-32 | Every phase-level truth is re-derived from a command in one pass, not inherited from an earlier SUMMARY | e2e + production-read | ETag = MD5; `vectorize info` 48 / 768; `get-vectors --ids knowledge-gift-cards`; three `/api/agent-chat` answers; terms heading occurrence 1 in D1 and parity 4=4 live; order paid / one active 2500 USD card / delivery sent | n/a — see per-requirement table in 12-06-SUMMARY.md | ✅ green |
| 12-06-03 | 06 | 5 | CONTENT-01, CONTENT-02, CONTENT-03, SHOP-07 | T-12-29 / T-12-30 / T-12-31 | No secret-shaped added line reaches the push, and the scope of the phase's diff is proven rather than asserted | other | `git diff --name-only $PHASE_BASE..HEAD -- lib app components migrations wrangler.jsonc`; `git log -p $PHASE_BASE..HEAD` added-line secret scan — 0 matches; no migration added | ✅ (this file) | ⚠️ green with a recorded scope deviation — see below |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Recorded Scope Deviation (12-06-03)

The phase's scope assertion — "zero files changed under `lib/`, `app/`, `components/`,
`migrations/` or `wrangler.jsonc` over the phase range" — **did not hold**, and it is recorded
here as it actually came out rather than softened.

`PHASE_BASE` = `2102380915137d48c96b3726f2e21b69dbf57a6c`, from `12-01-SUMMARY.md`'s
`plan_head_before` field. Over `$PHASE_BASE..HEAD` (19 commits), the check returned three files
instead of none:

```
lib/services/checkout-pricing.ts
lib/services/gift-card-fulfillment.ts
wrangler.jsonc
```

The stronger statement that **is** true, verified from the diff:

- Those three are the **only** files under `lib/`, `app/`, `components/`, `migrations/` or
  `wrangler.jsonc` in the whole range. `app/`, `components/` and `migrations/` are empty in the
  range — D-11's template-and-component claim holds exactly as written.
- **No migration was added or changed.** `git diff --name-only --diff-filter=A $PHASE_BASE..HEAD -- migrations` returns nothing, so the deploy's migration step is a no-op.
- Every one of those three files belongs to one of four unattended orchestrator commits made
  during 12-05 under Russell's standing best-assumption instruction, each recorded in STATE.md
  Decisions and in `12-05-SUMMARY.md` §Deviations:

  | Commit | Files | What |
  |--------|-------|------|
  | `3b821f7` | `lib/services/checkout-pricing.ts`, `tests/unit/lib/services/checkout-pricing.test.ts` | the configured-rate tax fallback zero-rates `txcd_00000000` lines |
  | `32b9df1` | `wrangler.jsonc`, `cloudflare-env.d.ts` | public var `EMAIL_PROVIDER=cloudflare` |
  | `f813499` | `lib/services/gift-card-fulfillment.ts`, `tests/integration/lib/services/gift-card-fulfillment.test.ts` | the delivery cron passes the worker env to `sendEmail` |
  | `d8b4d11` | `wrangler.jsonc`, `cloudflare-env.d.ts` | public var `STORE_SENDER_EMAIL="Voltique <orders@russellkmoore.me>"` |

  No commit in the range touches those paths other than these four.
- `cloudflare-env.d.ts` and the two test files sit outside the asserted globs but are named here
  so the accounting is complete.
- The secret scan over added lines still returns **0**. The two `wrangler.jsonc` additions are a
  provider name and a public sender address; neither is a key, a token, or key-shaped base64. A
  wider sweep for `whsec_`, `rk_`, `pk_live_`, bearer tokens and 40+ character base64 runs found
  only git SHAs in planning front matter.

So T-12-30's mitigation fired and caught real changes, and T-12-31's migration claim holds
unconditionally. What is not true, and is not claimed, is that the phase shipped no application
code at all.

---

## Wave 0 Requirements

- [x] `tests/unit/data/knowledge-gift-cards.test.ts` — created in 12-02 Task 1 as a failing
      source-contract test for CONTENT-01, 10 assertions reading the real committed article.
- [x] No fixtures needed — the test reads the committed file directly, no mocks.
- [x] No framework install needed — vitest was already configured.

Two further test files were **modified** later in the phase (`tests/unit/lib/services/checkout-pricing.test.ts`
and `tests/integration/lib/services/gift-card-fulfillment.test.ts`), but they belong to the
unattended orchestrator fixes recorded above, not to Wave 0.

---

## Manual-Only Verifications

The plan named two. Four are recorded, because two more human items surfaced during the phase and
hiding them would misstate what is actually outstanding.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The delivered gift-card email arrives and is usable by a real recipient | SHOP-07 | D1 says `sent` and the provider says `succeeded` with a message id, but only Russell can open the inbox | Open russellkmoore@mac.com, find the Voltique gift-card email sent 2026-09-09T22:20:34Z, confirm it renders and carries a usable code |
| Account → Gift Cards lists the purchased card | SHOP-07 | **Not verifiable by anyone.** This is a structural gap, not a pending check — the issued row's `purchaser_customer_id` is NULL for a guest purchase, and `lib/gift-cards/presentations.ts` filters on that column, so a signed-in listing would be empty by construction | Do not attempt to confirm it. Decide whether guest purchases should be claimable by a later sign-in; that is a product decision for a future milestone, recorded in `12-PROOF-ORDER.md` §6 |
| The Terms of Service section 6 reads naturally in place | CONTENT-03 | Prose quality and typographic fit are editorial judgments; the automated check can only prove the markup shape matches its known-good sibling section | Open https://voltique.russellkmoore.me/terms-of-service and read section 6 after Recurring Orders |
| The Cloudflare Workers build triggered by 12-06's push succeeds | — | The build runs on Cloudflare, after the push, outside this session | Watch the Workers Builds run for the pushed commit; nothing in the range should change behaviour beyond what was already deployed during 12-05 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 12s (measured 7.3s full, 0.1s quick)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-09
