---
phase: 12-content-assistant-live-proof
plan: 01
subsystem: infra
tags: [cloudflare, wrangler, getPlatformProxy, d1, r2, vectorize, workers-ai, remote-bindings]

# Dependency graph
requires:
  - phase: 09-gift-card-catalogue
    provides: "The getPlatformProxy precedent (09-03) — a local Node script driving Workers AI against production under Russell's OAuth login"
  - phase: 11-production-enablement
    provides: "A green production deployment and the CI gate list this plan re-runs as a starting line"
provides:
  - "A proven read-only mechanism for reaching production DB, MEDIA, VECTORIZE and AI from one local Node process, via a scratch wrangler.jsonc copy carrying per-binding remote flags"
  - "The pre-write production baselines plans 12-02, 12-03 and 12-04 assert against"
  - "plan_head_before — the phase base SHA 12-06 needs for its scope-proof range"
  - "The finding that prod_33 already carries a healthy gift/present/voucher product vector, letting 12-04 stay upsert-only"
affects: [12-02, 12-03, 12-04, 12-05, 12-06]

actuals:
  tokens: 7300
  tasks: 3
  commits: 0

plan_head_before: 2102380915137d48c96b3726f2e21b69dbf57a6c

tech-stack:
  added: []
  patterns:
    - "Scratch wrangler.jsonc copy: read the committed config at run time, string-patch per-binding remote flags into exactly the entries you need, write to mkdtempSync, pass configPath to getPlatformProxy — the committed file is never edited"
    - "Resource-name assertion before opening bindings: the patched copy must still name mercora-db, the same database_id, voltique-images and voltique-index, or the harness aborts"
    - "Nonzero-count probes as the local-fallback detector: a zero D1/R2 count means the remote flags did not take, not an empty resource"

key-files:
  created: []
  modified: []

key-decisions:
  - "The harness stays in the session scratch directory and is not promoted to scripts/ — a committed scripts/vectorize-reindex.mjs is a 12-CONTEXT.md Deferred Idea, so it belongs to a later milestone (D-01 discretion clause)"
  - "12-04 reproduces only the admin route's knowledge-article step (pure upsert by stable id), not its destructive product clear-and-rebuild, because prod_33 already carries a healthy gift/present/voucher vector"
  - "The scratch harness loads wrangler through createRequire against the repo's package.json rather than a bare import, because it lives outside the repo tree"

patterns-established:
  - "Tracer-first production work: prove every binding reaches production with a read before any plan in the phase writes"
  - "R2 ETag equals the object body's MD5, making `curl -sI` + `md5 -q <local file>` an exact body-equality check against a committed file"

requirements-completed: [CONTENT-02]

coverage:
  - id: D1
    description: "One local Node process reads real production data from D1, R2, Vectorize and Workers AI through getPlatformProxy against a scratch wrangler.jsonc copy, with the committed config untouched and no write call in the harness"
    requirement: CONTENT-02
    verification:
      - kind: integration
        ref: "mise exec -- node $SCRATCH/12-remote-env.mjs (exit 0; products=33, knowledge_md objects=9, dimensions=768, vectorCount=48, embedding length=768)"
        status: pass
      - kind: other
        ref: "git status --porcelain wrangler.jsonc (empty) && grep -v '^[[:space:]]*//' wrangler.jsonc | grep -c '\"remote\"' (0)"
        status: pass
      - kind: other
        ref: "grep -cE \"deleteByIds|[.]upsert[(]|[.]put[(]|INSERT |UPDATE |DELETE \" $SCRATCH/12-remote-env.mjs (0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pre-write production baselines recorded: Vectorize index info, the stale knowledge-gift-cards vector, the prod_33 product vector, and the live R2 article whose body provably matches the committed file"
    requirement: CONTENT-02
    verification:
      - kind: other
        ref: "curl -sI .../knowledge_md/gift-cards.md etag == md5 -q data/r2/knowledge_md/gift-cards.md -> BASELINE_ETAG_MATCHES"
        status: pass
      - kind: other
        ref: "mise exec -- npx wrangler vectorize get-vectors voltique-index --ids prod_33 | grep -c '\"source\": \"product\"' (1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The five fast CI gates are green and no tracked file is modified, establishing the clean starting line 12-06 compares against"
    verification:
      - kind: other
        ref: "npm run lint && npm run typecheck && npm run scan:tokens && npm run build:themes:check && npm test (chain exit 0; 278 test files, 2336 tests passed)"
        status: pass
      - kind: other
        ref: "git status --porcelain --untracked-files=no -> TRACKED_TREE_CLEAN; git rev-parse HEAD -> PHASE_BASE_RECORDED (40 chars)"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-09-09
status: complete
---

# Phase 12 Plan 01: Read-only remote-binding tracer Summary

**Production D1, R2, Vectorize and Workers AI all reachable from one local Node process via a scratch `wrangler.jsonc` copy carrying three per-binding remote flags — proven with four nonzero production reads, zero writes, and the committed config byte-identical.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-09-09T20:20:30Z
- **Completed:** 2026-09-09T20:27:00Z
- **Tasks:** 3
- **Files modified:** 0 tracked (the harness is scratch-only; this SUMMARY is the only tracked file this plan adds)

## Accomplishments

- The load-bearing risk of the whole phase (12-RESEARCH.md Pitfall 1) is retired: with `"remote": true` on exactly the `DB`, `MEDIA` and `VECTORIZE` entries of a scratch config copy, `getPlatformProxy({ remoteBindings: true })` reaches production for all four bindings. All four probes returned production-shaped, nonzero data.
- The committed `wrangler.jsonc` was never opened for writing and is unchanged, so local `npm run dev` still targets local D1/R2 (T-12-01 mitigated and asserted).
- Four pre-write baselines recorded, including an exact body-equality proof between the live R2 article and the committed file.
- The `prod_33` finding is confirmed against production, which lets 12-04 skip the destructive product clear-and-rebuild and stay upsert-only.
- The tree is green on all five fast CI gates before Phase 12 writes anything to production.

## Task Commits

This plan writes no tracked files other than its own SUMMARY, so it produces no per-task commits. `git rev-list --count 2102380..HEAD` measured **0** at SUMMARY-write time, which is the legitimate docs-only case: Task 1's artifact is a scratch harness (D-01 discretion clause, not promoted to `scripts/`), and Tasks 2 and 3 are read-only probes and gate runs whose results live in this SUMMARY.

1. **Task 1: Open production DB, MEDIA, VECTORIZE and AI — read only** — no commit (scratch artifact)
2. **Task 2: Snapshot the pre-write production baseline** — no commit (read-only probes)
3. **Task 3: Prove the working tree and CI gates are green** — no commit (gate runs)

**Plan metadata:** see the final `docs(12-01)` commit.

## The harness shape (Task 1 artifact, scratch only)

`$SCRATCH/12-remote-env.mjs` — 161 lines, ES module, not tracked. Recorded here per D-01's discretion clause instead of being promoted to `scripts/`.

**Imports:** `node:fs` (`readFileSync`, `writeFileSync`, `mkdtempSync`, `existsSync`), `node:path` (`join`, `dirname`), `node:os` (`tmpdir`), `node:module` (`createRequire`). `wrangler` itself is loaded through `createRequire(join(repoRoot, "package.json"))` rather than a bare specifier — see Deviations.

**Exports:**
- `buildScratchConfig(repoRoot)` — reads the committed `wrangler.jsonc` at run time, patches it, writes the copy to a `mkdtempSync` directory, returns `{ scratchConfigPath, repoRoot, databaseId }`.
- `openRemoteEnv(repoRoot)` — builds the copy, calls `getPlatformProxy({ configPath, remoteBindings: true })`, returns `{ env, dispose, scratchConfigPath, databaseId }`. Plan 12-04 can import this instead of re-deriving it.

**The three patched binding entries** (each matched on its distinguishing value, each asserted to have actually changed):

| Config block | Match pattern anchor | Added |
|---|---|---|
| `d1_databases[]` | `"binding": "DB"` + `"database_name": "mercora-db"` + `"database_id"` | `"remote": true` |
| `r2_buckets[]` | `"binding": "MEDIA"` + `"bucket_name": "voltique-images"` | `"remote": true` |
| `vectorize[]` | `"binding": "VECTORIZE"` + `"index_name": "voltique-index"` | `"remote": true` |

The `ai` block is deliberately untouched — Workers AI is unconditionally remote in `getPlatformProxy`. (wrangler 4.129.0 emits a warning saying to set `remote: true` on the AI binding "to suppress this warning"; that is cosmetic only, and adding it would be noise in a copy that already reaches production AI. The warning text is quoted in Issues below.)

**The `main` path fix:** `"main": "worker.ts"` is rewritten to an absolute `JSON.stringify`'d path at `<repoRoot>/worker.ts`, and the file's existence is asserted. This removes 12-RESEARCH.md A2's unverified assumption about config resolution relative to the scratch directory rather than testing it.

**Pre-open assertions (T-12-02):** the patched copy must contain exactly 3 occurrences of `"remote": true`; must still contain `"database_name": "mercora-db"`, the same `database_id` read out of the real file, `"bucket_name": "voltique-images"` and `"index_name": "voltique-index"`; and the sibling `NEXT_INC_CACHE_R2_BUCKET` entry must still match its original unflagged shape. Any mismatch throws before a single binding is opened.

**The four probes** (`main()` guard, `dispose()` in `finally`, `process.exit(1)` naming the failing probe otherwise):

1. `env.DB.prepare("SELECT COUNT(*) AS n FROM products").first()` — requires `>= 33`
2. `env.MEDIA.list({ prefix: "knowledge_md/" })` — requires `>= 8` objects
3. `env.VECTORIZE.describe()` — requires `dimensions === 768` and `vectorCount >= 41`
4. `env.AI.run("@cf/baai/bge-base-en-v1.5", { text: "gift card" })` — requires `data[0].length === 768`; prints the length only, never the vector

## Task 1 — probe output (verbatim, counts only)

```
⎔ Establishing remote connection...
▲ [WARNING] AI bindings always access remote resources, and so may incur usage charges even in local dev. To suppress this warning, set `remote: true` for the binding definition in your configuration file.

[config] scratch copy: /var/folders/pv/.../T/gsd-12-wrangler-J7Nf4R/wrangler.jsonc
[config] database_id tail: ...6f45f9
[probe 1] D1 products rows = 33
[probe 2] R2 knowledge_md/ objects = 9
[probe 3] Vectorize dimensions = 768, vectorCount = 48
[probe 4] AI embedding length = 768
[result] all 4 probes reached production in 5.9s
```

Exit code **0**. Re-run once for the tracer gate: also exit 0.

Acceptance checks:

| Check | Result |
|---|---|
| `mise exec -- node $SCRATCH/12-remote-env.mjs` exit code | `0` |
| products >= 33 | 33 |
| knowledge_md objects >= 8 | 9 |
| index dimensions == 768 | 768 |
| index vectorCount >= 41 | 48 |
| embedding length == 768 | 768 |
| `git status --porcelain wrangler.jsonc` | empty |
| `grep -v '^\s*//' wrangler.jsonc \| grep -c '"remote"'` | `0` |
| write-call grep over the harness | `0` |

## Task 2 — pre-write production baselines

### 1. Vectorize index — `wrangler vectorize info voltique-index`

| dimensions | vectorCount | processedUpToMutation | processedUpToDatetime |
|---|---|---|---|
| 768 | 48 | `2a5fcf48-6f29-4087-a40a-ec4b598cb836` | `2026-09-08T16:43:21.305Z` |

### 2. The stale knowledge vector — `--ids knowledge-gift-cards`

- Vector exists. `values` length **768** (values themselves not recorded).
- `metadata.source` = `knowledge`, `metadata.slug` = `gift-cards`. Metadata keys present: `slug`, `source`, `text` — no `type` field, matching 12-RESEARCH.md Pitfall 5.
- Its stored text **still carries the stale delivery-window promise**, verbatim: `All gift cards are delivered via email within 1 hour of purchase.` Its front matter still reads `tags: [gift cards, faq]` — no `gift` / `present` / `voucher` vocabulary. This is what 12-02 rewrites and 12-04 re-embeds.

### 3. The product vector — `--ids prod_33`

- Vector exists. `values` length **768**.
- `metadata.source` = `product`, `metadata.productId` = `prod_33`, `metadata.slug` = `prod-33`. Keys: `productId`, `slug`, `source`, `text`.
- Its stored text **already lists the gift vocabulary**: `tags: ['gift', 'gift card', 'present', 'voucher', 'gift certificate', 'digital']` and `use_cases: ['gift', 'present', 'last-minute gift', 'voucher', 'gift certificate']`.

### 4. The live R2 object — `knowledge_md/gift-cards.md`

| Field | Value |
|---|---|
| HTTP status | `200` |
| `etag` | `f316aa5ead2efe1535784994605ef76b` |
| `content-length` | `451` |
| `last-modified` | `Sat, 26 Jul 2025 07:39:20 GMT` |
| `md5 -q data/r2/knowledge_md/gift-cards.md` | `f316aa5ead2efe1535784994605ef76b` |

The ETag equals the committed file's MD5 — `BASELINE_ETAG_MATCHES`. The live article body is byte-identical to the committed one, so 12-02's upload proof will measure its own upload and not pre-existing drift.

### The consequential finding for 12-04

`prod_33` already has a healthy product vector carrying the full gift / present / voucher / gift-certificate vocabulary in both its `tags` and `use_cases` lines, and the indexer embeds the whole raw text (Pitfall 4), so that vocabulary is already inside the embedding. **CONTENT-02 therefore does not need the admin route's destructive clear-and-rebuild step.** Per D-01's discretion clause and T-12-03's upsert-only mitigation, plan 12-04 reproduces only the route's knowledge-article step — pure upsert by stable id (`knowledge-gift-cards`), deleting nothing.

## Task 3 — gates, phase base, and git position

| Gate | Exit code |
|---|---|
| `npm run lint` | 0 (warnings only, all pre-existing `react-hooks/set-state-in-effect` warnings under `app/admin/**`; out of scope, not touched) |
| `npm run typecheck` | 0 |
| `npm run scan:tokens` | 0 |
| `npm run build:themes:check` | 0 |
| `mise exec -- npm test` | 0 — 278 test files, 2336 tests, all passed |

The verify chain (`lint && typecheck && scan:tokens && build:themes:check && test`) also exited **0** as a single chain.

**Phase base:** `git rev-parse HEAD`, run before this plan made any commit, is

```
plan_head_before: 2102380915137d48c96b3726f2e21b69dbf57a6c
```

40 characters — `PHASE_BASE_RECORDED`. It matches the SHA the orchestrator supplied at dispatch. This is the left side of every scope-proof range 12-06 runs.

**Working tree:** `git status --porcelain --untracked-files=no` printed nothing — `TRACKED_TREE_CLEAN`.

**Git position:** `main` is **8 commits ahead of `origin/main`** (the plan text recorded 5 at planning time — the three Phase 12 planning commits landed after the plan was written; see Deviations).

**Untracked paths** (`--untracked-files=all`):

```
?? .gsd/dispatch-isolation-sentinel.json
?? .planning/agent-history.json
?? .planning/config.json
?? .planning/state.json
?? MILESTONE-SEED.md
?? volt.png
?? volt.svg
```

This is the same set the plan recorded (the plan wrote `.gsd/` as a directory; at file granularity it holds one file, `dispatch-isolation-sentinel.json`). No difference beyond that expansion.

## Decisions Made

- **The harness is not promoted to `scripts/`.** D-01 leaves this to the plan's judgement and 12-CONTEXT.md lists a committed, documented `scripts/vectorize-reindex.mjs` under Deferred Ideas. It stays in the session scratch directory; its shape is recorded above so 12-04 can rebuild or import it.
- **12-04 stays upsert-only.** Justified by the `prod_33` baseline above, and consistent with T-12-03.
- **The AI binding gets no `remote` flag in the scratch copy** despite wrangler warning about it. The flag would only suppress a cosmetic warning; AI is already unconditionally remote, and the plan explicitly called a flag there noise.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The scratch harness could not resolve its `wrangler` import**

- **Found during:** Task 1 (first run of the harness)
- **Issue:** The harness lives in the session scratch directory, outside the repo tree, so `import { getPlatformProxy } from "wrangler"` failed with `ERR_MODULE_NOT_FOUND: Cannot find package 'wrangler' imported from /private/tmp/.../12-remote-env.mjs`. Node resolves bare specifiers by walking up from the importing file, and the scratch directory has no `node_modules` above it. The plan's code sketch (copied from 12-RESEARCH.md, which framed the file as living at `scripts/vectorize-reindex.mjs` inside the repo) assumed repo-local resolution.
- **Fix:** Replaced the static bare import with `createRequire(join(repoRoot, "package.json"))("wrangler")`, called after the repo root is resolved. This loads the same installed wrangler 4.129.0 whose source 12-RESEARCH.md verified, rather than any other copy. No package was installed and no dependency was added.
- **Files modified:** `$SCRATCH/12-remote-env.mjs` (scratch only — no tracked file)
- **Verification:** The harness then ran to completion with all four probes returning production data and exit 0.
- **Committed in:** n/a — scratch artifact, not tracked.

### Differences from planning-time measurements (recorded, not fixed)

**2. `knowledge_md/` holds 9 objects, not 8.** The plan's `>= 8` acceptance bound passes. The planning-time count of 8 was measured earlier; the phase's own artifacts have not added an object, so an article was added to R2 between planning and execution, or the planning-time count omitted one key. Noted here because 12-04's re-index will iterate whatever is actually there. Not treated as a failure: the criterion is `>= 8` and the value that matters for the local-fallback detector is "nonzero", which it clearly is.

**3. `main` is 8 commits ahead of `origin/main`, not 5.** The plan recorded 5 at planning time; the three Phase 12 planning commits (`docs: start milestone v2.1`, `docs: define milestone v2.1 requirements`, `docs: create milestone v2.1 roadmap`, plus the phase-12 planning artifacts) landed after that count was taken. 12-06 pushes `main` and needs the real number, so it is recorded here.

**4. The session's opening git snapshot showed `M cloudflare-env.d.ts` and `M wrangler.jsonc`.** That snapshot predates HEAD `2102380`; at execution time the tracked tree was clean and `wrangler.jsonc` had no modification. Both were verified directly rather than trusted from the snapshot.

---

**Total deviations:** 1 auto-fixed (1 blocking, Rule 3) plus 3 recorded measurement differences.
**Impact on plan:** No scope creep. The one auto-fix is a module-resolution detail forced by the scratch-directory convention the plan itself chose; it does not change what the harness does or what it proves. Every acceptance criterion and every `<verify>` block passed as written.

## Issues Encountered

- **wrangler warns about the AI binding on every run:** `AI bindings always access remote resources, and so may incur usage charges even in local dev. To suppress this warning, set 'remote: true' for the binding definition in your configuration file.` This is the expected, documented behaviour for an unconditionally-remote binding and confirms the AI probe hit production. Left as-is deliberately.
- **`npm run lint` prints warnings** (pre-existing `react-hooks/set-state-in-effect` in `app/admin/**`). Exit code is 0, they predate this phase, and they are outside this plan's scope, so they were not touched.

## Security / prohibitions observed

| Prohibition | Evidence |
|---|---|
| No edit to the committed `wrangler.jsonc` | `git status --porcelain wrangler.jsonc` empty; remote-flag count 0 after filtering comments (T-12-01) |
| No scratch config retargeting a different resource | Pre-open assertions on `mercora-db`, the same `database_id`, `voltique-images`, `voltique-index`, plus the untouched `NEXT_INC_CACHE_R2_BUCKET` entry (T-12-02) |
| No production write of any kind | Write-call grep over the harness returns 0; every CLI call used was `info` / `get-vectors` / `curl -I`; no D1 statement other than the `SELECT COUNT(*)` (T-12-03) |
| No secret read or printed | No `.dev.vars`, `.env.local`, `.env*.local` was opened; no `ADMIN_VECTORIZE_TOKEN`, Stripe secret, or gift-card `code_*` column was touched; the embedding is reported by length only; `database_id` is shown as a 6-character tail (T-12-04) |
| Right Cloudflare account | `wrangler whoami` reported an authenticated OAuth login for `russellkmoore@mac.com`, account `2b0a...0e3d`, before any probe (T-12-05) |
| No package installed | No `npm install` was run; `package.json` and the lockfile are unmodified (T-12-SC) |
| No code change under `lib/**`, `app/**`, `components/**`, `migrations/**` | Tracked tree clean before and after; the only tracked file this plan adds is this SUMMARY (D-11) |

## User Setup Required

None — no external service configuration required. `wrangler` was already authenticated under Russell's OAuth login (the Task 1 precondition), and nothing in this plan needed a secret.

## Next Phase Readiness

Ready. Everything 12-02..12-06 depend on is now proven rather than assumed:

- **12-02** can upload the rewritten article knowing the live R2 body currently matches the committed file exactly, so its ETag change will be attributable to its own upload.
- **12-03** can write the Terms of Service row against a D1 binding proven to reach production.
- **12-04** can `import { openRemoteEnv }` from the harness shape above (or rebuild it from this SUMMARY), and can proceed upsert-only on the strength of the `prod_33` finding.
- **12-06** has its `plan_head_before` = `2102380915137d48c96b3726f2e21b69dbf57a6c` and the real ahead-count of 8.

No blockers. One thing for later plans to keep in view: `knowledge_md/` holds 9 objects, one more than planning assumed, so a full re-index would touch 9 articles — though 12-04 only upserts the single `knowledge-gift-cards` id.

---
*Phase: 12-content-assistant-live-proof*
*Completed: 2026-09-09*

## Requirement status note

`requirements-completed: [CONTENT-02]` in the frontmatter mirrors this plan's `requirements` field, but **CONTENT-02 was deliberately NOT checked off in `REQUIREMENTS.md`.** The requirement reads "Volt is re-indexed and recommends the gift card when a shopper asks about gifts, presents, or vouchers" — this plan only proves the mechanism that makes the re-index possible. Plans 12-04 (the upsert) and 12-06 (the phase gate) also carry CONTENT-02 and are the ones that actually satisfy it. Marking it complete here would have claimed work that has not happened yet.

## Self-Check: PASSED

- `$SCRATCH/12-remote-env.mjs` — FOUND (161 lines, 7091 bytes)
- `.planning/phases/12-content-assistant-live-proof/12-01-SUMMARY.md` — FOUND
- Frontmatter parses; `plan_head_before` present and exactly 40 characters
- `git rev-list --count 2102380..HEAD` = 0 at SUMMARY-write time, matching `actuals.commits: 0` (docs-only plan, no tracked task artifacts)
- `git status --porcelain wrangler.jsonc` empty at close — `WRANGLER_UNTOUCHED`
- No secret value appears in this file; the only secret-shaped strings are environment-variable *names* inside the "was not read" attestation
