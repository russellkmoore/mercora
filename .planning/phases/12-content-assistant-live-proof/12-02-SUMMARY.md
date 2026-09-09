---
phase: 12-content-assistant-live-proof
plan: 02
subsystem: content
tags: [r2, vitest, knowledge-base, gift-cards, cloudflare-cache]

# Dependency graph
requires:
  - phase: 12-content-assistant-live-proof
    provides: "12-01's pre-write production baseline: the live R2 article's ETag equalled the MD5 of the (then-unmodified) committed file, so any divergence found here is attributable to this plan's own upload"
provides:
  - "A gift-card knowledge article whose text matches what the storefront actually does (four amounts, immediate email delivery, no expiry, no cash, no resale, the real checkout field name, the real balance location) and whose tags carry the retrieval vocabulary gift/present/voucher"
  - "A source-contract vitest test that pins every one of those promises against the real committed file, no mocks, no fixtures"
  - "The corrected article live in the public voltique-images bucket at knowledge_md/gift-cards.md, with the R2 object body and the CDN's HEAD/ETag both proven to equal the committed file's MD5"
affects: ["12-04"]

actuals:
  tokens: 1100
  tasks: 3
  commits: 3

plan_head_before: e03f5e5

tech-stack:
  added: []
  patterns:
    - "Source-contract test reads the real committed file (readFileSync + REPO_ROOT), not a fixture, because the file is embedded verbatim (front matter included) into Volt's Vectorize index and uploaded verbatim to a public bucket"
    - "R2 ETag equals the object body's MD5 -- curl -sI etag compared to md5 -q <file> is an exact body-equality proof, reused from 12-01"

key-files:
  created:
    - tests/unit/data/knowledge-gift-cards.test.ts
  modified:
    - data/r2/knowledge_md/gift-cards.md

key-decisions:
  - "Kept id: faq-giftcards and the existing front-matter/AI-NOTES/## section shape so the Vectorize vector id knowledge-gift-cards and the article's identity stay stable across the rewrite"
  - "Named the checkout field exactly as CheckoutClient.tsx labels it (\"Gift card\", id gift-card-code, on the shipping step) rather than a paraphrase, confirmed by reading the component before writing the article"
  - "Wrote nothing about a scheduled send date or a custom amount -- SHOP-08 and SHOP-09 are deferred and the article must not promise either, per D-08 and the test's own guard assertion"

patterns-established:
  - "Contract-test-first content edit: write the failing test against the target state before touching the article, so the RED run proves the assertions discriminate rather than passing vacuously"

requirements-completed: [CONTENT-01]

coverage:
  - id: D1
    description: "The committed gift-card article names all four amounts, ties delivery to payment completing (not a clock), states no expiry/no cash/no resale, describes the checkout redemption step by the real field name, names Account -> Gift Cards as the balance location, and carries gift/present/voucher in its tags"
    requirement: CONTENT-01
    verification:
      - kind: unit
        ref: "mise exec -- npx vitest run tests/unit/data/knowledge-gift-cards.test.ts (RED before the rewrite: 6/10 failed; GREEN after: 10/10 passed)"
        status: pass
      - kind: other
        ref: "grep -c '\\$25'/'\\$50'/'\\$100'/'\\$200' = 1 each; grep -ic 'as soon as payment' = 2; grep -ic 'never expire' = 2; grep -ic cash = 2; grep -icE 'resold|resale' = 2; grep -c 'Gift Cards' = 2; grep -c Account = 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "The stale sixty-minute delivery promise no longer appears in the committed article, and only this one file under data/r2/knowledge_md/ was touched"
    requirement: CONTENT-01
    verification:
      - kind: unit
        ref: "knowledge-gift-cards.test.ts > 'does not promise delivery within 1 hour' -> pass"
        status: pass
      - kind: other
        ref: "git status --porcelain data/r2/knowledge_md/ -> exactly one path, gift-cards.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "The corrected article is uploaded to the public bucket at knowledge_md/gift-cards.md as the only R2 write this plan makes, and the R2 object body (source of truth for plan 12-04's re-index) is proven byte-identical to the committed file"
    requirement: CONTENT-01
    verification:
      - kind: other
        ref: "wrangler r2 object put voltique-images/knowledge_md/gift-cards.md --remote (exit 0); direct wrangler r2 object get --remote --pipe md5 = 435afd94cd37ca7f77203101c222c35d = md5 -q data/r2/knowledge_md/gift-cards.md"
        status: pass
      - kind: other
        ref: "curl -sI https://voltique-images.russellkmoore.me/knowledge_md/gift-cards.md -> 200, content-type text/markdown, etag 435afd94cd37ca7f77203101c222c35d == committed MD5 -> LIVE_BODY_MATCHES_COMMITTED"
        status: pass
    human_judgment: false
  - id: D4
    description: "The full unit suite is unaffected by the rewrite"
    verification:
      - kind: unit
        ref: "mise exec -- npm test -> 279 files / 2346 tests passed"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-09-09
status: complete
---

# Phase 12 Plan 02: Gift-Card Knowledge Article Rewrite + Source-Contract Test + R2 Upload Summary

**The gift-card support article now states what the storefront actually does -- four amounts, email delivery as soon as payment completes, no expiry, no cash, no resale, the real checkout field name, and Account -> Gift Cards as the balance location -- pinned by a new source-contract test and proven live on the public bucket via ETag-equals-MD5.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-09-09T20:28:51Z
- **Completed:** 2026-09-09T20:37:26Z
- **Tasks:** 3
- **Files modified:** 2 tracked (`data/r2/knowledge_md/gift-cards.md`, `tests/unit/data/knowledge-gift-cards.test.ts`)

## Accomplishments

- Replaced the stale "delivered via email within 1 hour of purchase" promise with "delivered by email as soon as payment completes," matching actual issuance-on-payment behavior.
- Added the checkout redemption step ("Gift card" field on the shipping/billing step, confirmed against `CheckoutClient.tsx`'s real label and field id) and the balance-visibility answer (Account -> Gift Cards for signed-in shoppers; by code at checkout for anyone), neither of which the article covered before.
- Added "not transferable or resold" alongside the existing no-cash/no-expiry limits.
- Widened front-matter `tags` to `[gift cards, gift, present, voucher, gift certificate, faq]` and wrote the AI NOTES sentence to name gift/present/voucher/gift certificate explicitly, so Volt's embedding similarity picks up those retrieval words (12-RESEARCH.md Pitfall 4: the indexer embeds the whole raw file, front matter included, with no YAML parsing).
- Wrote a 10-assertion source-contract test that reads the real committed file (no mocks, no fixtures) and fails on any of: the stale 1-hour phrase reappearing, a missing amount, missing delivery/expiry/cash/resale language, a missing checkout or balance answer, missing tags, or a re-introduced scheduled-delivery promise (guarding against SHOP-08 sneaking back in).
- Uploaded the corrected article as the only R2 write this plan makes, and proved the object's body is byte-identical to the committed file via both a direct R2 read and the public CDN's ETag.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the failing source-contract test that pins the article's promises** - `ef77426` (test)
2. **Task 2: Rewrite the article to match what ships** - `6614391` (docs)
3. **Task 3: Upload the article to the public bucket and prove the live body matches the committed body** - no tracked-file change (production R2 write only); its evidence is recorded below

**Plan metadata:** this SUMMARY's own commit, `docs(12-02): complete gift-card knowledge article plan`.

## RED-then-GREEN test transition

Before Task 2's rewrite, `mise exec -- npx vitest run tests/unit/data/knowledge-gift-cards.test.ts` failed 6 of 10 assertions against the original article (missing "as soon as payment," missing "resold/resale," missing "checkout"/"redeem," missing "Account"/"Gift Cards," missing `present`/`voucher` tags) and exited nonzero -- `RED_AS_EXPECTED`. After Task 2, the same command exited 0 with all 10 assertions passing. `grep -cE "vi\.mock|vi\.fn|from \"@/(lib|app|components)"` against the test file returned 0 (no matches), confirming the test reaches into no application code and registers no mock.

## Article: final section list

`data/r2/knowledge_md/gift-cards.md` (28 lines, 1763 bytes): front matter (`id: faq-giftcards`, `title: Gift Cards`, `category: sales`, widened `tags`) -> AI NOTES sentence -> `## Buying a Gift Card` -> `## Delivery` -> `## Redeeming at Checkout` -> `## Checking a Balance` -> `## Limits`. `id: faq-giftcards` was kept unchanged so the Vectorize vector id `knowledge-gift-cards` and the article's identity stay stable for plan 12-04's upsert.

## Grep counts (Task 2 acceptance criteria)

| Check | Result |
|---|---|
| `$25` / `$50` / `$100` / `$200` | 1 each |
| `as soon as payment` (case-insensitive) | 2 |
| `never expire` (case-insensitive) | 2 |
| `cash` (case-insensitive) | 2 |
| `resold\|resale` (case-insensitive) | 2 |
| `Gift Cards` | 2 |
| `Account` | 1 |
| `git status --porcelain data/r2/knowledge_md/` | exactly one path, `gift-cards.md` |
| `mise exec -- npm test` | 279 files / 2346 tests passed (was 278/2336 before this plan's new test file) |

## R2 upload and live-body proof (Task 3)

Per D-03, the live object was read back before writing and again after:

| Measurement | Value |
|---|---|
| Baseline ETag (12-01, pre-rewrite) | `f316aa5ead2efe1535784994605ef76b` |
| Pre-upload MD5 (this plan, `wrangler r2 object get --remote --pipe` before the put) | `f316aa5ead2efe1535784994605ef76b` -- matches the 12-01 baseline exactly, confirming no drift occurred between the tracer and this upload |
| `wrangler r2 object put voltique-images/knowledge_md/gift-cards.md --file data/r2/knowledge_md/gift-cards.md --remote --content-type text/markdown` | exit 0 |
| Post-upload MD5 (direct `wrangler r2 object get --remote --pipe` read) | `435afd94cd37ca7f77203101c222c35d` |
| Committed file MD5 (`md5 -q data/r2/knowledge_md/gift-cards.md`) | `435afd94cd37ca7f77203101c222c35d` -- equals the post-upload MD5 |
| `curl -sI https://voltique-images.russellkmoore.me/knowledge_md/gift-cards.md` | `200`, `content-type: text/markdown`, `etag: "435afd94cd37ca7f77203101c222c35d"` -- equals the committed MD5 -> `LIVE_BODY_MATCHES_COMMITTED` printed |

No other R2 key was put. No secret was read or printed. No deploy command ran.

## Deviations from Plan

### Auto-fixed Issues

None - the rewrite and test needed no in-flight bug fixes.

### Documented finding (not a defect in the write itself): CDN edge-cache staleness on the plain GET URL

Task 3's acceptance criteria include a second, stronger check beyond the ETag proof: that a plain `curl -s` GET of the public URL contains "as soon as payment" and not the old "1 hour" phrase. Immediately after upload this check failed -- not because the write was wrong, but because Cloudflare's edge cache was serving a GET response cached **before** this plan's upload (`cf-cache-status: HIT`, `age: ~640-800s`, `cache-control: max-age=14400`, i.e. a 4-hour TTL), while `curl -sI` (HEAD) and a direct `wrangler r2 object get --remote` both already returned the new content.

Evidence gathered to isolate the cause:
- `curl -sI` (HEAD, no query string): `cf-cache-status: DYNAMIC`, fresh ETag `435afd94...` matching the new file -- correct.
- `curl -s` (GET, no query string, repeated across 60+ seconds and again ~13 minutes later): consistently returned the old body, `md5 f316aa5ead2efe1535784994605ef76b`, `cf-cache-status: HIT`.
- `curl -s` with a cache-busting query string (`?cachebust=<random>`): returned the new body, `md5 435afd94...` -- proves the underlying object and CDN routing are correct; only the specific cached response for the exact canonical URL is stale.
- Client `Cache-Control: no-cache` / `Pragma: no-cache` request headers did not force the edge to bypass or revalidate the cached entry.
- `wrangler --help` has no cache-purge subcommand; purging this edge cache entry requires either the ~4-hour TTL to expire naturally or a Cloudflare dashboard/API cache purge, neither of which is available from this session's tool surface (no API token, no dashboard access, and acquiring one would mean reading a credential this plan is expressly forbidden from touching).

Why this does not block the plan: the plan's authoritative `must_haves.truths` check (D-03's ETag-equals-MD5 proof via `curl -sI`) passes. The downstream consumer this article exists for -- plan 12-04's Vectorize re-index -- reads the article via the R2 binding's `env.MEDIA.get()` directly (per `app/api/admin/vectorize/route.ts` and 12-PATTERNS.md), never through the public CDN hostname, so the re-index will see the correct, already-uploaded object regardless of this cache entry's remaining TTL. The finding is recorded here and in `.planning/WINDOWS.md` (entry 7, kind `deviation`, phase 12) so it stays visible; it will self-resolve by normal TTL expiry (roughly 3.5-4 hours after the ~20:23 UTC cache-population time inferred from the `age` header), or Russell can purge it immediately from the Cloudflare dashboard if he wants the plain public URL fresh sooner.

### Auth gates

None encountered.

## Self-Check: PASSED

- `tests/unit/data/knowledge-gift-cards.test.ts` — FOUND
- `data/r2/knowledge_md/gift-cards.md` — FOUND (rewritten content verified present)
- Commit `ef77426` — FOUND in `git log --oneline --all`
- Commit `6614391` — FOUND in `git log --oneline --all`
- R2 object `voltique-images/knowledge_md/gift-cards.md` — FOUND, body confirmed byte-identical to committed file via direct read and CDN HEAD/ETag
