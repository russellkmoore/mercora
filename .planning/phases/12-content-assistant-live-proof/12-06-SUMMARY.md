---
phase: 12-content-assistant-live-proof
plan: 06
subsystem: testing
tags: [ci, vitest, wrangler, d1, r2, vectorize, workers-ai, stripe, validation, phase-gate]

# Dependency graph
requires:
  - phase: 12-content-assistant-live-proof
    provides: "12-01's phase base SHA, 12-02's article and source-contract test, 12-03's Terms row, 12-04's knowledge vector, 12-05's live purchase, issuance and delivery"
  - phase: 11-production-enablement
    provides: "The CI gate list this plan re-runs, and the move-aside wrapper that lets cf-typecheck match CI's no-env-file generation"
provides:
  - "A green phase gate: all ten CI commands plus docs:lint passing locally, in CI's order, against the phase's final tree"
  - "A filled, validated 12-VALIDATION.md carrying a per-task map for all 18 tasks in the phase"
  - "A one-pass re-verification of CONTENT-01, CONTENT-02, CONTENT-03 and SHOP-07 against production"
  - "A scope proof taken from the diff, including the honest record of where the phase's scope assertion did not hold"
  - "main on origin, closing milestone v2.1"
affects: [milestone-v2.1-completion, audit-milestone, next-milestone-planning]

actuals:
  tokens: 7100
  tasks: 3
  commits: 2

plan_head_before: c6a826658eddfa9b7821b65ac8d5659ff666cf09

tech-stack:
  added: []
  patterns:
    - "Phase gate as a literal replay of .github/workflows/ci.yml: the same commands, in the same order, with the PR-only step named and explained rather than silently dropped"
    - "Scope proof from the diff: pin the range from the first plan's recorded plan_head_before, run the assertion as written, record what it actually returned, then assert the stronger statement that is true"

key-files:
  created: []
  modified:
    - .planning/phases/12-content-assistant-live-proof/12-VALIDATION.md

key-decisions:
  - "The scope assertion was run as written and recorded as failing, not narrowed to make it pass — three files under the asserted globs, all attributable to the four unattended orchestrator commits from 12-05"
  - "Four manual-only rows are recorded in 12-VALIDATION.md rather than the two the plan named, because two more human items surfaced during the phase and omitting them would misstate what is outstanding"
  - "Account -> Gift Cards is typed as a structural gap, not a pending human check — a person signing in would find nothing, by construction"

patterns-established:
  - "Volt retrieval checks parse the answer field alone: the response's products array carries the catalogue name, so a whole-body grep would pass even on a prose regression"
  - "Terms-page cardinality is asserted against the stored D1 string; the served page's counts are parity evidence only, because Next.js ships the markup twice"

requirements-completed: [CONTENT-01, CONTENT-02, CONTENT-03, SHOP-07]

coverage:
  - id: D1
    description: "Every command in the CI workflow's list passes locally, in CI's order, against the phase's final tree, plus docs:lint"
    requirement: CONTENT-01
    verification:
      - kind: other
        ref: "11 commands under mise exec, all exit 0: npm audit --omit=dev --audit-level=high (0 vulnerabilities), build:themes:check, scan:tokens, lint (0 errors / 52 warnings), typecheck, cf-typecheck (env files aside, 'Types are up to date'), npm test (279 files / 2347 tests), test:workers (27 / 154), test:observability-worker (1 / 3), build, docs:lint (0 violations)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CONTENT-01 re-verifies: the committed article holds every promise and the live public object is byte-identical to it"
    requirement: CONTENT-01
    verification:
      - kind: unit
        ref: "mise exec -- npx vitest run tests/unit/data/knowledge-gift-cards.test.ts -> 10/10 passed in 83ms"
        status: pass
      - kind: e2e
        ref: "curl -sI https://voltique-images.russellkmoore.me/knowledge_md/gift-cards.md -> 200, etag 435afd94cd37ca7f77203101c222c35d == md5 -q data/r2/knowledge_md/gift-cards.md -> CONTENT_01_OK"
        status: pass
    human_judgment: false
  - id: D3
    description: "CONTENT-02 re-verifies: the index is intact at 48 vectors / 768 dimensions, the gift-card vector holds the rewritten article, and all three D-10 questions name a gift card in the answer prose"
    requirement: CONTENT-02
    verification:
      - kind: other
        ref: "wrangler vectorize info voltique-index -> dimensions 768, vectorCount 48 (>= 12-01 baseline 48); get-vectors --ids knowledge-gift-cards -> metadata keys exactly slug,source,text; source=knowledge, slug=gift-cards, text carries 'as soon as payment', no '1 hour'"
        status: pass
      - kind: e2e
        ref: "three unauthenticated POSTs to https://voltique.russellkmoore.me/api/agent-chat ('what should I get as a gift?', 'do you sell presents?', 'do you have vouchers?'); answer field parsed and matched -> 1, 1, 2 gift-card mentions"
        status: pass
    human_judgment: false
  - id: D4
    description: "CONTENT-03 re-verifies: the stored D1 row carries the gift-card heading exactly once with sections 1-5 intact, and the live page serves it at parity with the known-single section-5 heading"
    requirement: CONTENT-03
    verification:
      - kind: integration
        ref: "wrangler d1 execute mercora-db --remote --json -> rows_matched 1, heading_occurrences 1, content_len 1468, version 3, status published; sections 1, 5 and 6 all present"
        status: pass
      - kind: e2e
        ref: "curl -sf https://voltique.russellkmoore.me/terms-of-service -> 200; LIVE_TERMS_OK gift=4 recurring=4; all four promises present"
        status: pass
    human_judgment: false
  - id: D5
    description: "SHOP-07 re-verifies: the order reads paid, exactly one gift card account exists at 2500 USD active, its delivery row reads sent, and the email provider row reads cloudflare/succeeded"
    requirement: SHOP-07
    verification:
      - kind: other
        ref: "Named-column read-only SELECTs on production D1: orders WEB-GUEST-1788989054887-B4382C10 -> processing / paid / 2500 USD; whole-table gift_card_accounts -> exactly 1 row, active / 2500 / USD; gift_card_deliveries -> sent, attempt_count 4, completed_at 1788992434; email_deliveries join -> cloudflare / succeeded / error_code NULL"
        status: pass
    human_judgment: false
  - id: D6
    description: "12-VALIDATION.md is filled from commands that actually ran, with no placeholder left, status validated and nyquist_compliant true"
    verification:
      - kind: other
        ref: "The placeholder scan over 12-VALIDATION.md returns 0 (the file contains no brace character at all); 18 per-task rows across 12-01..12-06; frontmatter status: validated, nyquist_compliant: true, wave_0_complete: true"
        status: pass
    human_judgment: false
  - id: D7
    description: "The phase's scope is proven from the diff over the pinned range, including the honest record of the assertion that did not hold"
    verification:
      - kind: other
        ref: "PHASE_BASE 2102380915137d48c96b3726f2e21b69dbf57a6c from 12-01-SUMMARY.md; 19 commits in range; git diff --name-only over lib app components migrations wrangler.jsonc -> 3 files (SCOPE_NOT_HELD); app/, components/ and migrations/ empty; --diff-filter=A over migrations -> 0; secret scan over added lines -> 0"
        status: pass
    human_judgment: false
  - id: D8
    description: "main is pushed to origin with a clean tracked tree"
    verification:
      - kind: other
        ref: "git push origin main; git rev-list --count origin/main..HEAD -> 0; git status --porcelain --untracked-files=no -> empty"
        status: pass
    human_judgment: false
  - id: D9
    description: "Russell confirms the gift-card delivery email arrived at russellkmoore@mac.com and is usable"
    verification: []
    human_judgment: true
    rationale: "D1 says sent and the provider says succeeded with a message id, but only Russell can open the inbox."
  - id: D10
    description: "Russell reads Terms of Service section 6 in place and confirms it reads well"
    requirement: CONTENT-03
    verification: []
    human_judgment: true
    rationale: "Prose quality and typographic fit are editorial judgments; the automated check proves only that the markup shape matches the known-good sibling section."
  - id: D11
    description: "Russell decides what to do about the Account -> Gift Cards gap"
    requirement: SHOP-07
    verification: []
    human_judgment: true
    rationale: "Not a verification — a product decision. A guest purchase writes purchaser_customer_id NULL and the listing query filters on that column, so the listing is empty by construction. Nobody can confirm it by signing in."
  - id: D12
    description: "Russell watches the Cloudflare Workers build triggered by this push and confirms it succeeds"
    verification: []
    human_judgment: true
    rationale: "The build runs on Cloudflare after the push, outside this session."

# Metrics
duration: 12min
completed: 2026-09-09
status: complete
---

# Phase 12 Plan 06: Phase Gate, Validation Contract and Push Summary

**Every gate CI runs is green locally against the phase's final tree, all four requirements re-verify in one pass against live production, the validation contract is filled from commands that actually ran — and the phase's own scope assertion is recorded as failing, because four unattended fixes during 12-05 put real application code in the range.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-09T22:26:00Z
- **Completed:** 2026-09-09T22:40:00Z
- **Tasks:** 3 of 3
- **Files modified:** 2 tracked (`12-VALIDATION.md`, this SUMMARY)

## Task 1 — the CI-mirroring gate suite

Every command run under `mise exec --`, in CI's own order. All exit 0.

| # | Command | Exit | What it reported |
|---|---------|------|------------------|
| 1 | `npm audit --omit=dev --audit-level=high` | 0 | found 0 vulnerabilities |
| — | `npm run check:migrations -- --base <sha>` | **not run** | CI runs it on pull requests only, against the PR base SHA. This phase added no migration (proven in Task 3: `git diff --diff-filter=A` over `migrations/` returns nothing), so there is nothing for it to check. Named here rather than silently omitted. |
| 2 | `npm run build:themes:check` | 0 | theme manifest and CSS barrel fresh |
| 3 | `npm run scan:tokens` | 0 | no raw token usage |
| 4 | `npm run lint` | 0 | 52 problems — **0 errors**, 52 warnings (pre-existing `react-hooks/purity` and unused-directive warnings; warnings do not fail the gate) |
| 5 | `npm run typecheck` | 0 | `tsc --noEmit` clean |
| 6 | `npm run cf-typecheck` | 0 | run with `.env*.local` and `.dev.vars` moved aside; "Types at ./cloudflare-env.d.ts are up to date" — `CF_TYPECHECK_OK` |
| 7 | `npm test` | 0 | 279 test files, 2347 tests passed, 7.27s |
| 8 | `npm run test:workers` | 0 | 27 files, 154 tests passed, 3.65s |
| 9 | `npm run test:observability-worker` | 0 | 1 file, 3 tests passed, 245ms |
| 10 | `npm run build` | 0 | `next build --webpack` completed, full route manifest emitted |
| 11 | `npm run docs:lint` | 0 | `[docs-lint] 0 violations` |

**The env-file restore was checked, not assumed.** After `cf-typecheck` the holding directory was
listed and was empty, `rmdir` succeeded, and `ls -a` in the repo root shows `.dev.vars` and
`.env.local` back in place. 11-05's dotglob trap did not fire; both directions used the explicit
leading-dot glob form.

The unit count is 2347, one above 12-02's 2346. The extra test is the regression test the
orchestrator added in `3b821f7` during 12-05.

## Task 2 — every phase-level truth re-checked in one pass

Re-derived from commands, not inherited from the earlier SUMMARYs.

| Requirement | Check | Evidence | Result |
|---|---|---|---|
| CONTENT-01 | The committed article holds its promises | `vitest run tests/unit/data/knowledge-gift-cards.test.ts` -> 10/10 in 83ms | ✅ |
| CONTENT-01 | All four amounts, delivery on payment, no expiry, no cash, no resale, checkout field, balance location, no 60-minute window | `$25`/`$50`/`$100`/`$200` = 1 each; "as soon as payment" 2; "never expire" 2; cash 2; resold/resale 2; "Gift Cards" 2; Account 1; `1 hour|60 minutes|sixty` **0** | ✅ |
| CONTENT-01 | The live public object matches the committed bytes | HTTP 200; ETag `435afd94cd37ca7f77203101c222c35d` == `md5 -q data/r2/knowledge_md/gift-cards.md` -> `CONTENT_01_OK` | ✅ |
| CONTENT-02 | Index at or above 12-01's count, 768 dimensions | `wrangler vectorize info voltique-index` -> dimensions 768, vectorCount **48** (baseline 48) | ✅ |
| CONTENT-02 | The gift-card vector holds the rewritten article | `get-vectors --ids knowledge-gift-cards` -> metadata keys exactly `slug,source,text`; source `knowledge`, slug `gift-cards`; text carries "as soon as payment"; `/1 hour/i` false | ✅ |
| CONTENT-02 | The three D-10 questions each name a gift card in `answer` | "what should I get as a gift?" -> 1; "do you sell presents?" -> 1; "do you have vouchers?" -> 2. Matched on the parsed `answer` field alone, never the whole body | ✅ |
| CONTENT-03 | The stored row carries the heading exactly once | D1 `(length(content)-length(replace(...)))/length(...)` -> `heading_occurrences` **1**, `rows_matched` 1, `content_len` 1468, `version` 3, `status` published | ✅ |
| CONTENT-03 | Sections 1-5 intact | `content LIKE` probes -> section 1 ✓, section 5 ✓, section 6 ✓ | ✅ |
| CONTENT-03 | The live page serves it at parity | HTTP 200; `LIVE_TERMS_OK gift=4 recurring=4`; all four promises present (3 occurrences each) | ✅ |
| SHOP-07 | The order reads paid | `orders WHERE id='WEB-GUEST-1788989054887-B4382C10'` -> status `processing`, payment_status **`paid`**, total 2500 USD | ✅ |
| SHOP-07 | Exactly one gift card account, 2500, USD, active | whole-table `SELECT` on `gift_card_accounts` -> **exactly 1 row**: active / 2500 / USD / issued_order_id matching / purchaser_customer_id NULL | ✅ |
| SHOP-07 | Its delivery row reads sent | `gift_card_deliveries` -> `sent`, attempt_count 4, completed_at 1788992434 | ✅ |
| SHOP-07 | The provider actually sent it | `email_deliveries` joined on the idempotency key -> provider `cloudflare`, status `succeeded`, error_code NULL | ✅ |
| SHOP-07 | Account -> Gift Cards lists the card | **Recorded as a gap, not a pass.** `purchaser_customer_id` is NULL on the real issued row and `lib/gift-cards/presentations.ts` filters on that column, so a signed-in listing is empty by construction | ⚠️ documented gap |

Every D1 read named its columns. No gift-card code column and no secret value was read, printed
or written anywhere in this plan.

## Task 3 — validation contract, scope proof, push

`12-VALIDATION.md` is filled: 18 per-task rows across 12-01 through 12-06, each typed by the kind
of evidence that actually exists (unit, integration, e2e, production-read, other) rather than
dressed up as a unit test; Wave 0 recorded as the single test file 12-02 created; four
manual-only rows; `status: validated`, `nyquist_compliant: true`, `wave_0_complete: true`. The
placeholder scan returns 0 — the file contains no brace character at all.

`PHASE_BASE` = `2102380915137d48c96b3726f2e21b69dbf57a6c`, read from `12-01-SUMMARY.md`'s
`plan_head_before` frontmatter field, verified with `git rev-parse --verify` (it resolves to
`2102380 docs(12): mark phase planned`). The range holds 19 commits.

| Scope claim | Result |
|---|---|
| Zero files under `lib/`, `app/`, `components/`, `migrations/`, `wrangler.jsonc` | ❌ **did not hold** — 3 files (see the deviation below) |
| Zero files under `app/`, `components/`, `migrations/` | ✅ held — the check returns nothing |
| No migration added | ✅ `git diff --name-only --diff-filter=A $PHASE_BASE..HEAD -- migrations` returns nothing |
| No secret-shaped added line | ✅ **0** matches for the Stripe secret-key prefixes, the payment client-secret field name, and the three gift-card code column names. The literal patterns are deliberately not reproduced here — see the deviation below |
| Wider secret sweep (extra, not required) | ✅ 18 hits for `whsec_`/`rk_`/`pk_live_`/bearer/40+ char base64 — every one is a git SHA in planning front matter |

## Deviations from Plan

### 1. [Recorded honestly] The scope assertion failed by design, and was not loosened

The plan asserts zero files changed under `lib/`, `app/`, `components/`, `migrations/` and
`wrangler.jsonc` over the phase range. **It came back with three files:**

```
lib/services/checkout-pricing.ts
lib/services/gift-card-fulfillment.ts
wrangler.jsonc
```

The check was run exactly as written and its real output is recorded above and in
`12-VALIDATION.md`. Nothing was narrowed to make it pass.

Every one of those files belongs to one of four unattended orchestrator commits made during 12-05
under Russell's standing best-assumption instruction. Each is recorded in STATE.md Decisions and
in `12-05-SUMMARY.md` §Deviations 1:

| Commit | Files | Decision reference |
|---|---|---|
| `3b821f7` fix(checkout) | `lib/services/checkout-pricing.ts`, `tests/unit/lib/services/checkout-pricing.test.ts` | STATE.md "[Phase 12, unattended]: the live-proof purchase halted because production quoted $27.06 for the $25 gift card" — the fallback tax now zero-rates `txcd_00000000` lines |
| `32b9df1` feat(email) | `wrangler.jsonc`, `cloudflare-env.d.ts` | STATE.md "[Phase 12, unattended]: production had no EMAIL_PROVIDER" — public var `EMAIL_PROVIDER=cloudflare` |
| `f813499` fix(gift-cards) | `lib/services/gift-card-fulfillment.ts`, `tests/integration/lib/services/gift-card-fulfillment.test.ts` | STATE.md "[Phase 12, unattended]: EMAIL_PROVIDER alone did not unblock the gift-card email" — the cron drain now passes the worker env to `sendEmail` |
| `d8b4d11` feat(email) | `wrangler.jsonc`, `cloudflare-env.d.ts` | STATE.md "[Phase 12, unattended]: Cloudflare Email Sending rejected the store's placeholder from-address" — public var `STORE_SENDER_EMAIL="Voltique <orders@russellkmoore.me>"` |

**The stronger statement that is true**, verified from the diff:

- Those three are the **only** files under the asserted paths in the whole range. Filtering the
  log by those paths returns exactly the four commits above and no others.
- `app/`, `components/` and `migrations/` are **empty** in the range. D-11's claim — this phase
  shipped no template or component change — holds exactly as written.
- **No migration was added or changed**, so the deploy's migration step is a no-op and T-12-31's
  mitigation holds unconditionally.
- `cloudflare-env.d.ts` and the two test files fall outside the asserted globs and are named here
  so the accounting is complete. `cloudflare-env.d.ts` is a regenerated artifact, not hand-edited,
  and `cf-typecheck` confirms it matches what `wrangler types` produces.
- The secret scan over added lines still returns **0**. The two `wrangler.jsonc` additions are a
  provider name (`cloudflare`) and a public sender address (`Voltique <orders@russellkmoore.me>`).
  Neither is a `sk_` key, key-shaped base64, or a client-secret token; both were read in full and
  are reproduced above.

So the plan's `must_haves` truth "No file under lib/, app/ or components/ changed anywhere in the
phase" is **false as stated for `lib/`**, and its truth "The committed wrangler.jsonc is
byte-identical to its state before the phase began" is **false**. Both are recorded as such rather
than quietly satisfied. What the phase can honestly claim is narrower: no template, component or
route changed; no migration was added; and the only application code that moved was four
production fixes without which the milestone's own live proof could not have completed.

### 2. [Rule 3 — blocking issue] `PHASE_BASE` extraction needed an explicit first-match

`plan_head_before` appears twice in `12-01-SUMMARY.md` — once in the frontmatter and once in its
prose. A naive extraction returned both SHAs concatenated and every `git` invocation failed with
`GIT_FAILED`. Fixed by taking the first match only. Worth recording because the failure was loud
and in the safe direction: the check refused to run rather than silently proving nothing.

### 3. [Rule 1 — self-inflicted, fixed] The secret scan matched this SUMMARY's own prose

The first draft of the scope table above reproduced the scan's literal patterns — the Stripe
secret-key prefixes and the gift-card code column names — so re-running the scan over the range
including this plan's own commits returned **1**, matching a documentation line rather than a
value. The match was located, confirmed to be exactly that one line, and the wording changed to
name the patterns without reproducing them. Re-run after the fix: **0**. The check was not
relaxed and no pattern was removed from it; the document stopped tripping it.

Recorded because the failure mode is worth knowing: a scan that greps the whole range will read
the artifact that describes the scan.

### 3. [Recorded] Four manual-only rows instead of the two the plan named

The plan names two human checks for `12-VALIDATION.md`. Four are recorded: the delivery email and
the Account -> Gift Cards gap (the two named), plus 12-03's "does section 6 read well in place"
editorial judgment and 12-06's "watch the Cloudflare build" item. Recording fewer would have
misstated what is actually outstanding.

## Human checks left for Russell

**1. Confirm the gift-card email arrived.** Check russellkmoore@mac.com for the Voltique gift-card
email sent 2026-09-09T22:20:34Z. The database says `sent` and Cloudflare says `succeeded` with a
message id — only you can confirm it landed and is usable.

**2. Read Terms of Service section 6.** https://voltique.russellkmoore.me/terms-of-service — the
Gift Cards section sits after Recurring Orders. Confirm it reads well and matches its neighbours.

**3. Decide what to do about Account -> Gift Cards.** This is a product decision, not a check. A
guest purchase writes `purchaser_customer_id` NULL, and the listing query filters on that column,
so a guest-bought card can never appear under a signed-in account. Nobody can verify this clause
by signing in — it is empty by construction. Deciding whether guest purchases should be claimable
by a later sign-in is the open question.

**4. Watch the Cloudflare Workers build** triggered by this push. Nothing in the pushed range
changes behaviour: the only application code in it was already deployed during 12-05.

## Still open from earlier in the phase

Carried forward, unchanged by this plan, all recorded in STATE.md Deferred Items:

- **Stripe Tax is unavailable on the live Stripe account.** Every taxable order is charged the
  flat 8.25% `admin_settings` fallback rather than a calculated rate. The fix is in the Stripe
  account's Tax configuration, not in this repository.
- **`STORE_SUPPORT_EMAIL` is still the placeholder** and no Email Routing rule exists for
  `orders@russellkmoore.me`, so replies to gift-card emails bounce.
- **`/api/tax` hardcodes `txcd_99999999`**, so its displayed estimate taxes a gift card even
  though checkout no longer does. Display only.

## This closes milestone v2.1

Phase 12 is the last phase of milestone v2.1 (Gift Card Product). With this gate green, the
milestone's four phases are done: the catalogue product (9), the redemption and issuance
machinery (10), production enablement (11), and the content, assistant and live proof that a real
customer path works end to end (12). The one thing the milestone set out to prove and could not —
a guest-purchased card appearing under an account — is on record as a gap with its cause, not as
a passing check.

## The push and the deployment it triggered

`git push origin main` moved `origin/main` from `d8b4d11` to `48dd60f` — four commits, all
documentation and planning artifacts:

| Commit | Subject |
|---|---|
| `8cc564f` | docs(12): record unattended sender-address decision |
| `c6a8266` | docs(12-05): complete the live gift-card proof — paid, issued, delivered |
| `6583376` | docs(12-06): fill the phase 12 validation contract from commands that ran |
| `48dd60f` | docs(12-06): close phase 12 — CI gate green, all four requirements re-verified |

No application code and no migration is in that push. Every line of application code in the wider
phase range was already deployed during 12-05.

Afterwards: `git rev-list --count origin/main..HEAD` -> **0**, `git status --porcelain
--untracked-files=no` -> **empty** — `PHASE_CLOSED`.

**Workers Builds deployment:** version `8b818bfe-1e44-4846-9edb-e276c99093b3`, deployment created
**2026-09-09T22:39:43.477Z**, at 100%. It supersedes `720e9abb-7dee-4b65-97b2-f1d135809877`
(22:15:48Z, the `STORE_SENDER_EMAIL` deploy from 12-05). Post-deploy liveness: the storefront
returns 200 and `/terms-of-service` returns 200. Behaviour is unchanged, as expected for a
docs-only range.

The known untracked paths recorded in 12-01 remain untracked and were not cleaned up: `.gsd/`,
`.planning/agent-history.json`, `.planning/config.json`, `.planning/state.json`,
`MILESTONE-SEED.md`, `volt.png`, `volt.svg`.

## Self-Check: PASSED

- `12-VALIDATION.md` — FOUND, `status: validated`, `nyquist_compliant: true`, 18 per-task rows, placeholder scan 0.
- `12-06-SUMMARY.md` — FOUND.
- Commits verified present: `6583376` (this plan's validation commit), and the four referenced 12-05 orchestrator commits `3b821f7`, `32b9df1`, `f813499`, `d8b4d11`, plus `PHASE_BASE` `2102380`.
