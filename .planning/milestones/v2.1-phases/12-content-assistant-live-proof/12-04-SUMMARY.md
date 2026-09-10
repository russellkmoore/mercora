---
phase: 12-content-assistant-live-proof
plan: 04
subsystem: ai
tags: [vectorize, workers-ai, embeddings, getPlatformProxy, remote-bindings, agent-chat, rag]

# Dependency graph
requires:
  - phase: 12-content-assistant-live-proof
    provides: "12-01's scratch remote-binding harness (openRemoteEnv), the 48-vector / 768-dimension index baseline, and the prod_33 finding that made an upsert-only run sufficient"
  - phase: 12-content-assistant-live-proof
    provides: "12-02's rewritten gift-card article, already uploaded to R2 and proven byte-identical to the committed file — the bytes this re-index embeds"
provides:
  - "A refreshed knowledge-gift-cards vector in voltique-index holding the rewritten article text (delivery on payment, four amounts, no expiry, gift/present/voucher vocabulary)"
  - "Live proof that Volt names the Voltique Gift Card for gift, present and voucher questions from an unauthenticated public POST"
  - "An upsert-only re-index script shape that reproduces the admin route's knowledge step with no index-clear and no product step"
affects: [12-05, 12-06]

actuals:
  tokens: 1400
  tasks: 3
  commits: 0

plan_head_before: b726fabe5bda2057620759842e8b11ab21d5b341

tech-stack:
  added: []
  patterns:
    - "Upsert-only production re-index: reproduce an admin route's indexing step with the destructive calls absent from the source rather than guarded at run time, so a grep over the script is a real gate"
    - "Model id read from source at run time: parse EMBEDDING_MODEL out of lib/ai/config.ts and assert the same literal appears in the route being reproduced, instead of hardcoding a remembered model string"
    - "Count-equality as an id-derivation proof: an upsert under a wrong id would raise vectorCount; an unchanged count plus refreshed text at the intended id proves the id was right"

key-files:
  created: []
  modified: []

key-decisions:
  - "Upserted only knowledge-gift-cards, not all nine knowledge articles — the dispatch narrowed the plan's Task 1 scope to a single vector write (recorded as Deviation 1)"
  - "The script walks and logs every knowledge_md/ object using the route's exact listing, .md filter and slug derivation, and skips the upsert for out-of-scope slugs, so the walk stays a faithful reproduction even though only one article is written"
  - "The embedding model id is parsed from lib/ai/config.ts at run time and cross-checked against app/api/admin/vectorize/route.ts rather than being written into the script as a literal"
  - "The script was run twice (identical, idempotent) because the first invocation's exit status was lost to a shell pipeline; both runs upserted the same id with the same bytes"

patterns-established:
  - "Pattern 1: absent-not-guarded — destructive calls are kept out of a production utility's source entirely so that grepping the source is the safety gate"
  - "Pattern 2: assert on the extracted answer field, never the raw chat JSON — the products array carries the catalogue name and would make a whole-body grep pass vacuously"

requirements-completed: [CONTENT-02]

coverage:
  - id: D1
    description: "The knowledge-gift-cards vector in voltique-index now holds the rewritten article: metadata.source knowledge, metadata.slug gift-cards, stored text carrying the delivery-on-payment promise and no longer the sixty-minute window"
    requirement: CONTENT-02
    verification:
      - kind: integration
        ref: "mise exec -- node $SCRATCH/12-reindex-knowledge.mjs (exit 0; 9 articles walked, 1 upserted, 0 errors; embeddingLength=768; mutationId recorded)"
        status: pass
      - kind: other
        ref: "wrangler vectorize get-vectors voltique-index --ids knowledge-gift-cards | grep -ic 'as soon as payment' -> 1; /1 hour/i over metadata.text -> false; metadata keys exactly slug,source,text"
        status: pass
    human_judgment: false
  - id: D2
    description: "The re-index destroyed nothing: no index-clear or vector-removal call exists in the script source, the index count is unchanged at 48 with dimensions 768, prod_33's product vector survives, and an unrelated knowledge vector still holds its own article"
    requirement: CONTENT-02
    verification:
      - kind: other
        ref: "grep -cE 'deleteByIds|deleteVectors|products_md|FROM products' $SCRATCH/12-reindex-knowledge.mjs -> 0"
        status: pass
      - kind: other
        ref: "wrangler vectorize info voltique-index -> dimensions 768, vectorCount 48 before and after (12-01 baseline 48)"
        status: pass
      - kind: other
        ref: "wrangler vectorize get-vectors --ids prod_33 | grep -c '\"source\": \"product\"' -> 1; --ids knowledge-shipping -> source knowledge, slug shipping, shipping-policy text, no gift-card text"
        status: pass
    human_judgment: false
  - id: D3
    description: "Three unauthenticated POSTs to the live /api/agent-chat asking about a gift, a present and a voucher each return HTTP 200 with an answer naming the Voltique Gift Card"
    requirement: CONTENT-02
    verification:
      - kind: e2e
        ref: "POST https://voltique.russellkmoore.me/api/agent-chat x3 ('what should I get as a gift?', 'do you sell presents?', 'do you have vouchers?') -> 200/200/200, extracted answer field matches /gift card/i in all three"
        status: pass
      - kind: e2e
        ref: "plan verify blocks re-run independently (curl -sf | JSON.parse .answer | grep -ic 'gift card') -> 1, 1, 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "This plan changed no tracked file and left the committed wrangler.jsonc untouched"
    verification:
      - kind: other
        ref: "git status --porcelain --untracked-files=no (empty) && git status --porcelain wrangler.jsonc (empty) -> NO_REPO_CHANGES"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-09-09
status: complete
---

# Phase 12 Plan 04: Volt Knowledge Re-index and Live Proof Summary

**The gift-card knowledge vector now holds the rewritten article, written by a single upsert that removed nothing — the index sits at the same 48 vectors it started at — and Volt answers all three of the gift, present and voucher questions by name: "Voltique Gift Card".**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-09-09T20:41:35Z
- **Completed:** 2026-09-09T20:48:00Z
- **Tasks:** 3
- **Files modified:** 0 tracked (the re-index script is scratch-only; this SUMMARY is the only tracked file this plan adds)

## Accomplishments

- Refreshed `knowledge-gift-cards` in `voltique-index` with an embedding of the R2 article 12-02 uploaded. Its stored text now carries "as soon as payment" and no longer carries "1 hour".
- Did it with **one** Vectorize write and zero removals: `vectorCount` was 48 before and 48 after, `prod_33` is intact, and `knowledge-shipping` still holds the shipping policy.
- Proved the retrieval end of CONTENT-02 against the live public endpoint, unauthenticated, three times — and proved it on the `answer` prose specifically, not on the raw JSON where the catalogue name would have made the check pass for free.
- Volt's replies now quote the corrected article back: "never expires", "$25, $50, $100, or $200", "delivered by email right after purchase". That text only exists in the article 12-02 rewrote, so the answers are direct evidence the new vector is the one being retrieved.

## Task Commits

This plan writes no tracked file other than this SUMMARY, so it produces no per-task commits. Measured at SUMMARY-write time:

```
plan_head_before: b726fabe5bda2057620759842e8b11ab21d5b341
git rev-list --count b726fab..HEAD = 0
```

That is the legitimate docs-only case: Task 1's artifact is a scratch script (per the plan's `<scratch_convention>`, its shape is recorded below instead of being promoted to `scripts/`), Task 2 is live read-only chat calls, and Task 3 is read-only index and repo checks.

1. **Task 1: Re-embed and upsert the knowledge article, upsert-only** — no commit (scratch artifact + production index write)
2. **Task 2: Ask Volt the three questions and record what it answers** — no commit (read-only live calls)
3. **Task 3: Confirm the index is intact and nothing outside scope moved** — no commit (read-only checks)

**Plan metadata:** the final `docs(12-04)` commit.

## The script's shape (Task 1 artifact, scratch only)

`$SCRATCH/12-reindex-knowledge.mjs` — 151 lines, 5.6 KB, ES module, not tracked.

**Imports:** `node:fs` (`readFileSync`, `existsSync`), `node:path` (`join`, `dirname`), and `openRemoteEnv` from 12-01's `./12-remote-env.mjs`. It opens no bindings of its own — the harness's scratch `wrangler.jsonc` copy, its resource-name assertions and its `createRequire`-loaded wrangler are all reused unchanged.

**Constants, all matching the admin route:** prefix `knowledge_md/`, id prefix `knowledge-`, source `knowledge`, text limit 1000, minimum text length 10. Plus one this plan adds: `TARGET_SLUGS = new Set(["gift-cards"])`.

**`resolveEmbeddingModel(repoRoot)`** — reads `lib/ai/config.ts`, pulls `EMBEDDING_MODEL.model` out with a regex, then reads `app/api/admin/vectorize/route.ts` and throws unless that same literal appears in it. So the script cannot embed with a model the route does not use, and the model id is never a remembered string. Resolved value: `@cf/baai/bge-base-en-v1.5`.

**The walk**, in the route's order and with the route's guards:

| Route behaviour | Reproduced |
|---|---|
| `media.list({ prefix: "knowledge_md/" })` | yes |
| `if (!obj.key.endsWith(".md")) continue` | yes |
| slug = key minus prefix minus `.md` | yes |
| `media.get` + `file.text()`, error on missing file | yes |
| skip when `text.trim().length < 10` | yes |
| embed the whole raw text, front matter included, no YAML parsing | yes |
| `vectorize.upsert([{ id: \`knowledge-${slug}\`, values: embedding.data[0], metadata: { slug, source: "knowledge", text: text.substring(0, 1000) } }])` | yes |
| index-clear (`query` + batched removal) before the product step | **absent from the source** |
| product step (D1 read, markdown generation, R2 product-markdown write, product upsert) | **absent from the source** |

The two absent steps are absent, not guarded — that is what makes the grep in the acceptance criteria a real gate rather than a formality. An extra safety net was added on top of the route's own guards: the embedding is rejected unless it is a 768-element array, so a malformed AI response cannot overwrite a good vector with garbage.

**Logging and exit:** one line per article (`[upsert]` with slug, id, text length, stored-text length, embedding length and mutation id; `[walk]` for an article left alone), a `[before]` line with the index description, a final `[result]` count, exit 1 on any error or if the upsert count does not equal `TARGET_SLUGS.size`, exit 0 otherwise.

## Task 1 — the re-index

### Baseline, recorded before the write (D-03)

`mise exec -- npx wrangler vectorize info voltique-index`:

| dimensions | vectorCount | processedUpToMutation | processedUpToDatetime |
|---|---|---|---|
| 768 | 48 | `2a5fcf48-6f29-4087-a40a-ec4b598cb836` | 2026-09-08T16:43:21.305Z |

Identical to 12-01's baseline. `wrangler vectorize get-vectors voltique-index --ids knowledge-gift-cards` returned the stale article: metadata keys exactly `slug,source,text`, `source: knowledge`, `slug: gift-cards`, stored text 451 characters, `tags: [gift cards, faq]`, and the old promise present ("1 hour" → true, "as soon as payment" → false).

### The run

```
[model] embedding model from lib/ai/config.ts = @cf/baai/bge-base-en-v1.5 (also present in the admin route)
[scope] upsert targets: gift-cards
[before] dimensions = 768, vectorCount = 48
[list] 9 object(s) under knowledge_md/
[walk] account — id knowledge-account left untouched (out of this plan's upsert scope)
[walk] exchanges — id knowledge-exchanges left untouched (out of this plan's upsert scope)
[walk] faq — id knowledge-faq left untouched (out of this plan's upsert scope)
[upsert] slug=gift-cards id=knowledge-gift-cards textLength=1761 storedTextLength=1000 embeddingLength=768 mutationId=0bbacd73-09ec-496a-b00a-e048d2bda751
[walk] returns — id knowledge-returns left untouched (out of this plan's upsert scope)
[walk] shipping — id knowledge-shipping left untouched (out of this plan's upsert scope)
[walk] sizing — id knowledge-sizing left untouched (out of this plan's upsert scope)
[walk] support — id knowledge-support left untouched (out of this plan's upsert scope)
[walk] warranty — id knowledge-warranty left untouched (out of this plan's upsert scope)
[result] 9 article(s) walked, 1 upserted, 0 error(s) in 8.7s
```

Nine slugs were walked (12-01 already recorded that `knowledge_md/` holds nine objects, one more than planning assumed). The second, identical run — see Deviation 2 — produced `mutationId=2f522bd4-a7b6-48d4-a94e-b2e0b70caffb`, exit code **0**, and reported `vectorCount = 48` at its own `[before]` read, confirming the first mutation added nothing.

### Read-back (D-03)

`wrangler vectorize get-vectors voltique-index --ids knowledge-gift-cards`, first attempt, no waiting needed:

| Field | Value |
|---|---|
| `id` | `knowledge-gift-cards` |
| `values` length | 768 |
| metadata keys | `slug`, `source`, `text` — exactly three, no invented field |
| `metadata.source` | `knowledge` |
| `metadata.slug` | `gift-cards` |
| `metadata.text` length | 1000 (article is 1761 characters; truncated exactly as the route truncates) |
| contains "as soon as payment" | **true** |
| contains "1 hour" | **false** |

The refreshed vector's stored text opens:

```
---
id: faq-giftcards
title: Gift Cards
category: sales
tags: [gift cards, gift, present, voucher, gift certificate, faq]
---

**AI NOTES:** The Voltique Gift Card is a digital gift, present, voucher, or gift certificate a shopper can buy for someone else or for themselves; recommend it for any "what should I get as a gift/present" or "do you sell vouchers/gift certificates" question. It comes in four fixed amounts,
```

That is 12-02's rewritten front matter and AI NOTES line, so the bytes in the index are the bytes 12-02 uploaded.

### Acceptance criteria

| Criterion | Result |
|---|---|
| script exits 0 | 0 (measured on the second run) |
| reports 8 articles processed | **deviation** — 9 walked, 1 upserted (see Deviation 1) |
| `grep -cE "deleteByIds\|deleteVectors\|products_md\|FROM products"` over the script | `0` |
| script references the model id `lib/ai/config.ts` declares | yes — parsed from that file at run time and cross-checked against the route |
| after count >= before count | 48 >= 48 |
| refreshed vector: source `knowledge`, slug `gift-cards`, text has "as soon as payment", not "1 hour" | all four true |
| `prod_33` still returns the product vector | yes |

`<verify>` blocks: destructive grep → `0`; `get-vectors knowledge-gift-cards \| grep -ic 'as soon as payment'` → `1`; `get-vectors prod_33 \| grep -c '"source": "product"'` → `1`.

## Task 2 — the three Volt questions

Three unauthenticated `POST https://voltique.russellkmoore.me/api/agent-chat` calls, body carrying only `question`, no `userName`, no `history`, no session. Assertions are on the parsed `answer` string alone.

| # | Question | Status | `answer` matches /gift card/i | Names the catalogue product | productIds returned |
|---|---|---|---|---|---|
| 1 | what should I get as a gift? | 200 | yes | yes — "Voltique Gift Card" | `["prod_32"]` |
| 2 | do you sell presents? | 200 | yes | yes — "Voltique Gift Card" | `[]` |
| 3 | do you have vouchers? | 200 | yes | yes — "Voltique Gift Card" | `[]` |

Answers, verbatim:

**1.** "Voltique Gift Card  \nCampfire S'mores Kit"

**2.** "Yes! We offer a convenient Voltique Gift Card that's perfect for any occasion. It's a digital present that can be sent by email right after purchase and can be redeemed for anything in our shop."

**3.** "Yes! We offer digital vouchers in the form of our Voltique Gift Card. It can be purchased for $25, $50, $100, or $200 and is delivered instantly by email."

All three name the gift card by its Phase 9 catalogue name, which the plan calls out as stronger evidence than the generic phrase.

The plan's three `<verify>` blocks were then run independently — a second, separate set of calls — and returned `grep -ic 'gift card'` counts of **1, 1 and 2**. Their answers, verbatim:

**1.** "Voltique Gift Card  \nCampfire S'mores Kit"

**2.** "Yes! We offer the Voltique Gift Card, a digital present that can be sent by email and used for any item in our shop. It comes in $25, $50, $100, or $200 amounts and never expires."

**3.** "Yes, we offer digital vouchers in the form of gift cards.  \nVoltique Gift Card is available in $25, $50, $100, and $200 amounts and is delivered by email right after purchase."

Six calls in total, all 200, all mentioning the gift card. No 429 and no retry was needed.

**Worth noting for 12-05/12-06:** "never expires", "$25, $50, $100, or $200" and "delivered by email right after purchase" are all statements from 12-02's rewritten article. The old article had no expiry sentence phrased that way and promised delivery "within 1 hour". Volt is quoting the new text, which is retrieval evidence beyond the phrase match.

**One observation, not a failure:** question 1's `products` array carried `prod_32` (Campfire S'mores Kit), not `prod_33` (the gift card), even though the prose named the gift card first. The route only returns products it can map from names the assistant emitted in bold, so this is a name-mapping artefact of that path, not a retrieval failure — the plan's criterion is the `answer` field and it passes. Recorded here in case 12-06 wants to look at it.

## Task 3 — index intact, repo untouched

`mise exec -- npx wrangler vectorize info voltique-index` after the run:

| dimensions | vectorCount | processedUpToMutation | processedUpToDatetime |
|---|---|---|---|
| 768 | 48 | `2a5fcf48-6f29-4087-a40a-ec4b598cb836` | 2026-09-08T16:43:21.305Z |

48 = the 12-01 baseline, exactly. Dimensions 768. Nothing was destroyed and nothing new appeared.

*(Note: `info`'s `processedUpToMutation` still names the pre-phase mutation even though `get-vectors` already returns the new text. The two endpoints report at different lags; the count and the read-back are the load-bearing numbers, and both are green.)*

**Unrelated-article spot check** — `wrangler vectorize get-vectors voltique-index --ids knowledge-shipping`:

| Field | Value |
|---|---|
| `values` length | 768 |
| metadata keys | `slug`, `source`, `text` |
| `metadata.source` | `knowledge` |
| `metadata.slug` | `shipping` |
| text opens | `id: faq-shipping`, `title: Shipping & Delivery`, `category: support`, `tags: [shipping, delivery, faq]`, AI NOTES "This is the official shipping policy…" |
| mentions "gift card" | false |

That article's vector holds that article, so no id-derivation bug wrote everything to one id.

**Repo:** `git status --porcelain --untracked-files=no` empty, `git status --porcelain wrangler.jsonc` empty → `NO_REPO_CHANGES`. The untracked set is unchanged from 12-01 (`.gsd/dispatch-isolation-sentinel.json`, `.planning/agent-history.json`, `.planning/config.json`, `.planning/state.json`, `MILESTONE-SEED.md`, `volt.png`, `volt.svg`).

## Decisions Made

- **Single-vector upsert.** The dispatch narrowed Task 1 to one Vectorize write; the script honours that with `TARGET_SLUGS` while still walking every object the way the route walks them. See Deviation 1.
- **Model id parsed, not typed.** Reading `EMBEDDING_MODEL` out of `lib/ai/config.ts` and asserting the same literal exists in the admin route turns "same model as the route" from a claim into a run-time check.
- **768-length embedding guard.** Not in the route, added here: an upsert is only issued for a well-formed 768-element vector, so a bad AI response cannot replace a good vector with a malformed one. Strictly additive safety on an upsert-only path.

## Deviations from Plan

### 1. [Scope narrowing — dispatch instruction] One article upserted, not all nine

- **Found during:** Task 1, before writing the script.
- **Issue:** The plan's Task 1 says to upsert every article under `knowledge_md/` and its acceptance criterion reads "reports 8 articles processed". The dispatch instruction for this plan states as a hard rule that "the ONLY Vectorize write is an upsert of the single knowledge vector id for `gift-cards`". The two cannot both be satisfied.
- **Resolution:** Followed the narrower instruction. The script walks all nine objects with the route's exact listing, `.md` filter and slug derivation, logs every one, and upserts only `gift-cards`. Result line: "9 article(s) walked, 1 upserted, 0 error(s)".
- **Why this is safe for the plan's own goals:** every `must_haves` truth still holds. The count is unchanged (48 → 48), the gift-card vector carries the rewritten text and not the stale window, the route's knowledge step is reproduced exactly, and nothing is deleted. The seven untouched knowledge vectors are byte-identical to what they were before this phase; their articles were not changed by 12-02, so re-embedding them would have replaced each vector with an embedding of the same text.
- **What is genuinely lost:** T-12-17's stated mitigation was "an id-derivation bug could not survive a second article's spot check". With one upsert that check no longer discriminates on its own. **The count-equality check covers the same failure:** an upsert under a wrongly-derived id would have created a new vector and pushed `vectorCount` to 49 while leaving `knowledge-gift-cards` stale. The count stayed at 48 *and* `knowledge-gift-cards` holds the new text, which is only possible if the id was derived correctly. The `knowledge-shipping` spot check was run anyway and is recorded above.
- **Files modified:** none tracked.
- **Follow-up available if wanted:** flipping `TARGET_SLUGS` to accept every slug turns the same script into the full knowledge re-index the plan described. Nothing else would change.

### 2. [Measurement] The script was run twice

- **Found during:** Task 1.
- **Issue:** The first invocation was piped through `tee`, and its exit status was lost — so "exits 0", an explicit acceptance criterion, had not actually been measured.
- **Resolution:** Ran the script a second time with the exit status captured directly. It reported `exit=0`, walked the same nine articles, upserted the same one id with the same bytes, and read `vectorCount = 48` before starting — which independently confirms the first run added no vector.
- **Cost:** one extra embedding call and one extra Vectorize mutation against the same id with the same content. No additional vector, no removal, nothing outside the single id the dispatch permits.
- **Judgement:** an idempotent second run was preferred over inferring the exit code from the log. It also doubles as a determinism check.

### Auth gates

None. `wrangler` was already authenticated under Russell's OAuth login; `ADMIN_VECTORIZE_TOKEN` was never read and the admin HTTP route was never called.

## Issues Encountered

- **`vectorize info` lags `get-vectors`.** After the upsert, `get-vectors` returned the new text immediately while `info` still reported the pre-phase `processedUpToMutation`. Both the before-count and after-count read 48, which is the number the acceptance criteria turn on. Not treated as a problem; recorded so a later reader does not mistake the stale mutation id for a failed write.
- **wrangler warns about the AI binding on every run** (the same cosmetic warning 12-01 recorded). Expected for an unconditionally-remote binding.

## Security / prohibitions observed

| Prohibition | Evidence |
|---|---|
| No Vectorize delete, `deleteByIds`, or index clear (D-03) | `grep -cE "deleteByIds\|deleteVectors\|products_md\|FROM products"` over the script → `0`; the calls are absent from the source, not guarded; count 48 → 48; `prod_33` and `knowledge-shipping` both intact (T-12-16) |
| No product re-embed, no write to the product-markdown prefix in R2 | The product step is absent from the script; the only `MEDIA` calls are `list` and `get` (T-12-16) |
| No `ADMIN_VECTORIZE_TOKEN` read, no call to the admin HTTP route | The script opens bindings via 12-01's harness and never issues an HTTP request to the admin route (T-12-19, D-01) |
| No edit to the committed `wrangler.jsonc` | `git status --porcelain wrangler.jsonc` empty; the harness's scratch copy is written to a `mkdtempSync` directory |
| No code change under `lib/**`, `app/**`, `components/**` | `git status --porcelain --untracked-files=no` empty → `NO_REPO_CHANGES` (D-11) |
| No secret value read, printed, or written | No `.dev.vars` or `.env*` opened; embeddings reported by length only; the only stored text quoted is from a public support article (T-12-20) |
| No `npm run deploy`, `deploy:ci`, or any deploy script | None was run |
| No package installed | No `npm install`; `package.json` and the lockfile unmodified (T-12-SC) |
| No `git add .` / `-A` | The only commit this plan makes stages this SUMMARY and the planning files by explicit path |

## Requirement status

**CONTENT-02 is marked complete in `REQUIREMENTS.md` by this plan.** Its text is "Volt is re-indexed and recommends the gift card when a shopper asks about gifts, presents, or vouchers." Both halves are now proven against production: the index holds the rewritten article at `knowledge-gift-cards`, and six live unauthenticated calls covering all three question shapes returned answers naming the Voltique Gift Card. 12-06 re-verifies it at the phase gate; marking it here reflects that the work it describes has actually happened.

## User Setup Required

None.

## Next Phase Readiness

Ready for 12-05 and 12-06.

- The index is at its pre-phase count with the gift-card article refreshed, so the live-order proof in 12-05 runs against an index in a known state.
- 12-06's scope proof still has 12-01's `plan_head_before` (`2102380915137d48c96b3726f2e21b69dbf57a6c`) as the phase base; this plan's own base was `b726fabe5bda2057620759842e8b11ab21d5b341` and it added no tracked file but this SUMMARY.
- One item for 12-06 to weigh: Deviation 1 means seven knowledge vectors carry embeddings generated before this phase. Their source articles are unchanged, so they are current — but if 12-06 wants the index to match exactly what a full admin re-index would produce, the same script with `TARGET_SLUGS` widened does it in one run.
- One observation for 12-06: on the "what should I get as a gift?" path, the returned `products` array carried `prod_32` rather than `prod_33` while the prose named the gift card. Worth a look, out of scope here.

---
*Phase: 12-content-assistant-live-proof*
*Completed: 2026-09-09*

## Self-Check: PASSED

- `$SCRATCH/12-reindex-knowledge.mjs` — FOUND (151 lines, 5.6 KB)
- `.planning/phases/12-content-assistant-live-proof/12-04-SUMMARY.md` — FOUND
- Run logs and both `get-vectors` captures (before/after) — FOUND in the session scratch directory
- `git rev-list --count b726fab..HEAD` = 0 at SUMMARY-write time, matching `actuals.commits: 0` (docs-only plan; the only tracked artifact is this SUMMARY)
- `git status --porcelain wrangler.jsonc` empty at close — WRANGLER_UNTOUCHED
- No secret value appears in this file; the only secret-shaped string is the *name* `ADMIN_VECTORIZE_TOKEN` inside the "was not read" attestation
