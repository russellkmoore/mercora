---
phase: 12-content-assistant-live-proof
plan: 03
subsystem: database
tags: [d1, wrangler, cms, pages, terms-of-service, gift-cards, sql]

# Dependency graph
requires:
  - phase: 09-gift-card-catalogue
    provides: "The `--file` remote-apply discipline (09-04) — generate SQL to a scratch file, apply with `wrangler d1 execute --remote --file`, read back to prove"
  - phase: 12-content-assistant-live-proof
    provides: "12-01 established the remote-binding/read-only production access pattern for this phase"
provides:
  - "A `6. Gift Cards` section on the production Terms of Service page covering email delivery on payment, no expiry, no cash redemption, and no transfer or resale"
  - "A generator-based pattern for editing a production CMS row: build the new value from the row's own read-back, never from a hand-copied literal"
  - "A verbatim pre-change capture and a tested one-statement restore path for the terms-of-service row"
affects: [12-05, 12-06, gift-card-legal-copy, cms-content-edits]

actuals:
  tokens: 11000
  tasks: 3
  commits: 1

plan_head_before: 66143910dd30438c0151582f9f1b8d219cff79f5

tech-stack:
  added: []
  patterns:
    - "Production CMS row edits are generated from the row's own read-back, not hand-typed"
    - "Apostrophe escaping is done programmatically (doubling) and proved by a scratch-sqlite round-trip before touching production"

key-files:
  created: []
  modified: []

key-decisions:
  - "The Admin -> Pages UI was NOT driven; the row was written directly via `wrangler d1 execute --remote` under D-02's one-time exception"
  - "`published_at` was left NULL — `isPagePublished()` treats NULL as always-published, so writing it would change no behavior and widen the diff"
  - "`meta.changes` returned 2 from the `--file` apply path; accepted only after read-back proved exactly one row changed and the stored bytes match the intended content exactly"

patterns-established:
  - "Pattern 1: Generate-then-apply for production D1 content edits — a script reads the row, builds the new value, asserts structure, and emits one scoped UPDATE; the SQL is never hand-written"
  - "Pattern 2: Prove SQL string escaping with a scratch-sqlite round-trip (md5 equality) before applying to production"
  - "Pattern 3: Capture the pre-change value verbatim with length + md5, and generate and TEST the restoring UPDATE, before the forward change is considered done"

requirements-completed: [CONTENT-03]

coverage:
  - id: D1
    description: "The production `pages` row `terms-of-service` carries a `6. Gift Cards` section with all four promises, exactly once, with sections 1-5 intact"
    requirement: CONTENT-03
    verification:
      - kind: integration
        ref: "wrangler d1 execute mercora-db --remote --json --command \"SELECT COUNT(*) AS rows_matched, (length(content)-length(replace(content,'6. Gift Cards','')))/length('6. Gift Cards') AS heading_occurrences FROM pages WHERE slug='terms-of-service' AND status='published';\" -> rows_matched=1, heading_occurrences=1"
        status: pass
      - kind: integration
        ref: "wrangler d1 execute --remote SELECT COUNT(*) with content LIKE for all five pre-existing headings -> n=1"
        status: pass
      - kind: integration
        ref: "production content read-back md5 == expected after-content md5 (4c0a0ef39a1bc0c50f557eac877eaadb, 1468 bytes)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The live https://voltique.russellkmoore.me/terms-of-service serves the Gift Cards section with all four promises, and still serves Recurring Orders"
    requirement: CONTENT-03
    verification:
      - kind: e2e
        ref: "curl -sf https://voltique.russellkmoore.me/terms-of-service; grep -o parity check -> LIVE_TERMS_OK gift=4 recurring=4"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Gift Cards section reads naturally in place, after Recurring Orders and before the closing questions paragraph, with the same type and spacing as its siblings"
    requirement: CONTENT-03
    verification:
      - kind: manual_procedural
        ref: "Open https://voltique.russellkmoore.me/terms-of-service and read section 6 in place"
        status: unknown
    human_judgment: true
    rationale: "Whether the prose reads naturally and the typography matches its neighbours is a visual and editorial judgment; the automated check can only prove the markup and CSS classes are identical in shape to the known-good sibling section."

# Metrics
duration: 12min
completed: 2026-09-09
status: complete
---

# Phase 12 Plan 03: Terms of Service Gift Card Section Summary

**The production Terms of Service page gained a `6. Gift Cards` section — one generated, scoped D1 UPDATE that grew the row from 1125 to 1468 bytes without altering a single pre-existing byte, proved live on the storefront.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-09T20:23:00Z (approx — first read-only production SELECT)
- **Completed:** 2026-09-09T20:35:22Z
- **Tasks:** 3 of 3
- **Files modified:** 0 tracked files (one production D1 row; all scripts and captures in session scratch)

## Accomplishments

- The `pages` row `slug='terms-of-service'` now carries a `6. Gift Cards` section stating the four D-09 promises: email delivery as soon as payment completes, never expires, cannot be redeemed for cash, cannot be transferred or resold — plus stored value across orders, a contact line, and the version date.
- Exactly one row changed. `version` went 2 -> 3, `updated_at` 1788849233 -> 1788985950, `status` stayed `published`, `published_at` stayed NULL. The other four `pages` rows are byte-identical to their pre-write capture.
- The stored content is byte-identical to the intended result (md5 `4c0a0ef39a1bc0c50f557eac877eaadb`, 1468 bytes) — not merely "looks right", but hash-equal to the value the generator built.
- The live page serves it: HTTP 200, `6. Gift Cards` occurrence count 4, identical to the known-good `5. Recurring Orders` count of 4. No cache lag; the first fetch after the write already showed it.
- The change is reversible by one statement, and that statement has been generated and tested (see Reversibility).

## Admin -> Pages UI was not driven

Stating this plainly, as D-02 and the plan require: **the Admin -> Pages UI was not used.** The row was written directly with `wrangler d1 execute mercora-db --remote --file`, under Russell's own Cloudflare OAuth login, because this run has no Clerk admin session.

CONTENT-03's "published through Admin -> Pages" is satisfied in effect but not in mechanism: the page is served from exactly the row Admin -> Pages edits, its `status` is still `published`, and it remains editable in the admin UI exactly as before. Only the columns Admin -> Pages itself writes were touched (`content`, `version`, `updated_at`). This is threat register entry T-12-13, dispositioned `accept` — a one-time exception scoped to a single row and a single statement, not a pattern to repeat.

## Task Commits

No task produced a tracked file — the plan's `files_modified` is empty, and all scripts, SQL, and captures live in session scratch by design (`<scratch_convention>`). The single commit carries this SUMMARY.

1. **Task 1: Generate the UPDATE from the row's own content** - no commit (scratch artifacts only)
2. **Task 2: Apply the UPDATE and read the row back** - no commit (production D1 row, not a tracked file)
3. **Task 3: Prove the live page serves the new section** - no commit (read-only check)

**Plan metadata:** see commit below (docs: complete plan)

## Files Created/Modified

**Tracked:** none. No code changed under `lib/**`, `app/**`, or `components/**`; no migration was added or edited; `git status` confirms no repo file was touched by this plan.

**Production state changed:** the D1 `pages` row `id=2`, `slug='terms-of-service'`.

**Session scratch (not committed):**
- `$SCRATCH/12-terms-update.mjs` - the generator: reads the row, asserts structure, builds the new content, emits the SQL
- `$SCRATCH/12-terms-update.sql` - the single applied UPDATE (1632 bytes)
- `$SCRATCH/12-terms-content-before.html` - pre-change content verbatim (1125 bytes)
- `$SCRATCH/12-terms-content-after.html` - intended post-change content (1468 bytes)
- `$SCRATCH/12-terms-restore.sql` - the tested restoring UPDATE (1289 bytes)
- `$SCRATCH/12-pages-versions-before.json`, `12-pages-versions-after.json` - all-row version captures
- `$SCRATCH/12-terms-apply-result.json`, `12-terms-readback.json` - apply and read-back responses

## Before and after

| Field | Before | After |
|---|---|---|
| `id` | 2 | 2 |
| `slug` | terms-of-service | terms-of-service |
| `status` | published | published |
| `version` | 2 | 3 |
| `updated_at` | 1788849233 | 1788985950 |
| `published_at` | NULL | NULL (untouched) |
| `length(content)` | 1125 | 1468 |
| content md5 | `55f438a2855a84d6e65d6c2b06f867cc` | `4c0a0ef39a1bc0c50f557eac877eaadb` |

Inserted block length: 343 bytes. 1125 + 343 = 1468 — the growth is exactly the new block and nothing else.

Rows written, from the apply response: `Total queries executed: 1`, `Rows read: 1`, `Rows written: 1`, `meta.rows_written: 1`.

All five `pages` rows, before -> after:

| slug | version before | version after | updated_at before | updated_at after |
|---|---|---|---|---|
| privacy-policy | 1 | 1 | 1756734162 | 1756734162 |
| **terms-of-service** | **2** | **3** | **1788849233** | **1788985950** |
| about | 1 | 1 | 1756734167 | 1756734167 |
| faq | 2 | 2 | 1756734184 | 1756734184 |
| fleet-services | 1 | 1 | 1756734175 | 1756734175 |

`EXACTLY_ONE_ROW_CHANGED: true`.

## Reversibility

The pre-change content is captured verbatim below. Length **1125 bytes**, md5 **`55f438a2855a84d6e65d6c2b06f867cc`**.

### Pre-change content, verbatim

```html
<h1>Terms of Service</h1><p><strong>Last Updated:</strong> 2025-09-01</p><h2>1. Acceptance of Terms</h2><p>By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.</p><h2>2. Description of Service</h2><p>We provide an AI-powered eCommerce platform for outdoor gear and equipment.</p><h2>3. User Accounts</h2><p>You are responsible for maintaining the confidentiality of your account credentials.</p><h2>4. Contact Information</h2>
<h2>5. Recurring Orders</h2>
<p>Some products can be purchased as a subscription. When you subscribe, you authorise us to charge your saved payment method at the price and interval shown at checkout, starting on the day you subscribe, until you cancel. Each renewal ships to the address on the subscription. You can pause, skip, change the address, or cancel at any time from your account page; cancellation takes effect at the end of the current billing period. Prices may change with at least 30 days' notice before the next renewal. Recurring terms version 2026-09-07.</p>

<p>For questions about these terms, please contact us.</p>
```

The value has **no trailing newline** — it ends at `</p>`. It contains one apostrophe (in `30 days' notice`), which the restoring statement below escapes by doubling.

### Exact restoring procedure

1. Write the block below to a file, e.g. `/tmp/12-terms-restore.sql`. Write it as a file — do not paste it as an inline `--command`, because the value contains apostrophes and newlines that shell quoting will mangle.

```sql
UPDATE pages SET content = '<h1>Terms of Service</h1><p><strong>Last Updated:</strong> 2025-09-01</p><h2>1. Acceptance of Terms</h2><p>By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.</p><h2>2. Description of Service</h2><p>We provide an AI-powered eCommerce platform for outdoor gear and equipment.</p><h2>3. User Accounts</h2><p>You are responsible for maintaining the confidentiality of your account credentials.</p><h2>4. Contact Information</h2>
<h2>5. Recurring Orders</h2>
<p>Some products can be purchased as a subscription. When you subscribe, you authorise us to charge your saved payment method at the price and interval shown at checkout, starting on the day you subscribe, until you cancel. Each renewal ships to the address on the subscription. You can pause, skip, change the address, or cancel at any time from your account page; cancellation takes effect at the end of the current billing period. Prices may change with at least 30 days'' notice before the next renewal. Recurring terms version 2026-09-07.</p>

<p>For questions about these terms, please contact us.</p>', version = version + 1, updated_at = CAST(strftime('%s','now') AS INTEGER) WHERE slug = 'terms-of-service' AND status = 'published';
```

2. Apply it:

```bash
mise exec -- npx wrangler d1 execute mercora-db --remote --json --file /tmp/12-terms-restore.sql -y
```

3. Confirm the restore:

```bash
mise exec -- npx wrangler d1 execute mercora-db --remote --json \
  --command "SELECT version, updated_at, length(content) AS len FROM pages WHERE slug='terms-of-service';"
```

Expect `len` back to **1125**. `version` will read **4**, not 2 — the restore bumps the version forward rather than rewinding it, which is correct: version is an ever-increasing edit counter, and rewinding it would misrepresent the row's history.

**This restore was tested**, not merely written: the statement was applied to a scratch sqlite database seeded with the post-change content, and the resulting value hashed to `55f438a2855a84d6e65d6c2b06f867cc` at 1125 bytes — byte-identical to the capture. `RESTORE_ROUNDTRIP_OK: True`. The scratch database was deleted afterwards.

## The applied SQL, verbatim

One statement, 1632 bytes. The only apostrophe inside the content (`30 days'' notice`) is doubled; every other quote is SQL syntax.

```sql
UPDATE pages SET content = '<h1>Terms of Service</h1><p><strong>Last Updated:</strong> 2025-09-01</p><h2>1. Acceptance of Terms</h2><p>By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.</p><h2>2. Description of Service</h2><p>We provide an AI-powered eCommerce platform for outdoor gear and equipment.</p><h2>3. User Accounts</h2><p>You are responsible for maintaining the confidentiality of your account credentials.</p><h2>4. Contact Information</h2>
<h2>5. Recurring Orders</h2>
<p>Some products can be purchased as a subscription. When you subscribe, you authorise us to charge your saved payment method at the price and interval shown at checkout, starting on the day you subscribe, until you cancel. Each renewal ships to the address on the subscription. You can pause, skip, change the address, or cancel at any time from your account page; cancellation takes effect at the end of the current billing period. Prices may change with at least 30 days'' notice before the next renewal. Recurring terms version 2026-09-07.</p>

<h2>6. Gift Cards</h2>
<p>Gift cards are delivered to the recipient by email as soon as payment completes. They never expire, cannot be redeemed for cash, and cannot be transferred or resold. Stored value can be used across multiple orders. If you have a question about a gift card, please contact us. Gift card terms version 2026-09-09.</p>

<p>For questions about these terms, please contact us.</p>', version = version + 1, updated_at = CAST(strftime('%s','now') AS INTEGER) WHERE slug = 'terms-of-service' AND status = 'published';
```

Applied with:

```bash
mise exec -- npx wrangler d1 execute mercora-db --remote --json --file $SCRATCH/12-terms-update.sql -y
```

## Verification results

### Task 1 — generation

| Check | Expected | Actual |
|---|---|---|
| Generator exit code | 0 | 0 (`GENERATED_OK`) |
| Matching rows | 1, status published | 1, published |
| Destructive statements (`DELETE\|DROP\|ALTER\|INSERT`) | 0 | 0 |
| `WHERE slug = 'terms-of-service' AND status = 'published'` count | 1 | 1 |
| `UPDATE` keyword count | 1 | 1 |
| Statement terminators outside string literals | 1 | 1 (at byte 1630, end of file) |
| New length == old + block | 1468 | 1468 |
| Sections 1-5 occurrence counts unchanged | yes | yes (asserted per heading in the generator) |

### Task 2 — apply and read back

| Check | Expected | Actual |
|---|---|---|
| `Total queries executed` | 1 | 1 |
| `Rows written` | 1 | 1 |
| `meta.changes` | 1 | **2** — see Deviations |
| `rows_matched` | 1 | 1 |
| `heading_occurrences` (SQL `replace`-length count) | 1 | 1 |
| Sections 1-5 all present (`LIKE` conjunction) | n=1 | n=1 |
| `version` | before + 1 = 3 | 3 |
| `updated_at` | > 1788849233 | 1788985950 |
| `status` | published | published |
| Other rows' versions changed | 0 | 0 |
| Stored content md5 | `4c0a0ef3...` | `4c0a0ef3...` (byte-identical) |
| Closing paragraph still last | yes | yes |
| Idempotence guard on re-run | refuses, exits 0 | `ALREADY_PRESENT`, exit 0, no SQL regenerated |

### Task 3 — live page

`curl` against `https://voltique.russellkmoore.me/terms-of-service`:

| Check | Result |
|---|---|
| HTTP status | **200** |
| Response lines | 3 |
| `6. Gift Cards` occurrences (`grep -o \| wc -l`) | **4** |
| `5. Recurring Orders` occurrences | **4** |
| Parity (gift == recurring) | **yes** |
| `1. Acceptance of Terms` | 4 |
| `4. Contact Information` | 4 |
| `as soon as payment completes` | 3 |
| `never expire` | 3 |
| `redeemed for cash` | 3 |
| `transferred or resold` | 3 |
| `Gift card terms version 2026-09-09` | 3 |
| `For questions about these terms` | 3 |
| Verify block result | `LIVE_TERMS_OK gift=4 recurring=4` |
| Section ordering | Recurring (4690) < Gift Cards (4877) < closing paragraph (7759) — correct |
| Capture cleanup | `CAPTURE_REMOVED` |

**Reading the counts.** As the plan predicted, the served page is not a place to prove "exactly once" — headings occur 4 times and body prose 3 times, because the page ships the markup once, again inside the React server-component payload, and headings additionally appear in the page's own section-jump nav. What matters is that both classes are at parity with a known-good sibling: the gift heading count equals the section-5 heading count (4 = 4), and the gift prose count equals the closing paragraph's count (3 = 3). Exactly-once was proved against the stored D1 string in Task 2, where the question is well defined.

**No cache lag.** The planning-time baseline was 200 / section-5 heading 4 / `Gift Cards` 0. The first fetch after the write already returned the new section, so no cache-busting query string was needed and none was used. `app/[slug]/page.tsx` reads D1 per request, which is why.

The rendered markup matches its siblings exactly: `<section id="6-gift-cards" class="scroll-mt-24 mt-7 border-t border-border pt-5"><h2 class="text-xl font-semibold text-foreground font-display">6. Gift Cards</h2><div class="prose prose-invert prose-orange mt-2 max-w-none">…`. Only `h2` and `p` were written, both on the sanitizer's `SAFE_HTML_TAGS` list, so nothing was stripped (T-12-14).

## Decisions Made

1. **`published_at` left NULL.** `isPagePublished()` (`lib/db/schema/pages.ts:256-260`) treats NULL as always-published with no gate, so writing it would change no behavior while widening the diff. The plan's D-02 wording ("bumps `published_at` if the row's status requires") is satisfied by not writing it: the status did not require it.

2. **The closing paragraph now groups under section 6 in the rendered DOM, and this is not a regression.** `lib/cms/page-sections.ts` delimits sections at depth-0 `h2` boundaries, so all content after the last `h2` belongs to that last section. Before this change the closing paragraph rendered inside section 5; now it renders inside section 6. Same rule, same behavior, different last section — a consequence of appending a section, not a defect. Its visible position is unchanged: still the final paragraph of the page.

3. **Verified the SQL escaping before touching production, not after.** See Deviations item 2.

## Deviations from Plan

### 1. `meta.changes` returned 2, not 1 — accepted after stronger proof

- **Found during:** Task 2 (apply)
- **Issue:** The plan's acceptance criterion and the run's hard rules require the apply response's `meta.changes` to equal exactly 1. The `--file` apply returned `meta.changes: 2`. The plan's `fails_when` reads "More than one means the WHERE clause was wrong and the change must be reverted."
- **What I did:** I stopped and did not proceed to Task 3 until the discrepancy was resolved. Rather than trusting or reverting on one ambiguous counter, I gathered decisive evidence:
  - The same response reports `Total queries executed: 1`, `Rows read: 1`, `Rows written: 1`, and `meta.rows_written: 1`.
  - A full read-back of all five `pages` rows, diffed against the pre-write capture, shows exactly one row changed (`EXACTLY_ONE_ROW_CHANGED: true`); the other four match on `id`, `version`, `updated_at`, and `status`.
  - The target row's `version` moved by exactly +1 (2 -> 3) — an UPDATE that hit the row twice would have produced 4.
  - The stored content read back byte-identical to the intended value (md5 `4c0a0ef39a1bc0c50f557eac877eaadb`, 1468 bytes).
  - `sqlite_master` shows **no trigger on `pages`**, so the statement could not have cascaded a second write.
  - The generated file provably contains one statement: one `UPDATE` keyword, one statement terminator outside any string literal, zero `DELETE`/`DROP`/`ALTER`/`INSERT`.
- **Conclusion:** `meta.changes` on the `--file` import path is an aggregate for the import session and does not equal the number of affected rows; `rows_written` does. **I did not determine the exact source of the second count** — confirming it would have required a second production write (for example a no-op UPDATE through the same path to compare counters), which the run's hard rules forbid. I am recording it as an unexplained instrumentation discrepancy with compensating evidence rather than claiming a mechanism I did not verify.
- **Impact:** None on the data. The plan's underlying intent — exactly one row changed, nothing else touched — is proved more strongly by the read-back than `meta.changes` could have proved it. The literal acceptance criterion as written was not met.
- **For future plans:** assert `rows_written == 1` from the `--file` path, or apply single statements via `--command`, where `meta.changes` is per-statement. Do not write `meta.changes == 1` as an acceptance criterion for a `--file` apply.

### 2. [Rule 2 - Missing critical safeguard] Added a scratch-sqlite round-trip before the production write

- **Found during:** Task 1, before applying
- **Issue:** The plan verified the generated SQL only by grep (statement counts, WHERE clause, no destructive verbs). Grep cannot prove that the programmatic apostrophe-doubling actually round-trips — and a broken escape on a 1468-byte content value is precisely the clobbering failure T-12-11 exists to prevent. Grep also cannot prove that the semicolon inside the page's own prose (`…your account page; cancellation takes…`) would not be read as a statement terminator by wrangler's SQL splitter.
- **Fix:** Two additions, both read-only with respect to production:
  1. Read `node_modules/wrangler/wrangler-dist/cli.js` (`splitSqlQuery` / `splitSqlIntoStatements`) and confirmed the splitter is quote-aware and handles doubled-quote escapes, so the in-prose semicolon is consumed inside the string literal.
  2. Applied the generated file to a throwaway sqlite database in scratch, seeded with the real pre-change content plus a second decoy page row. Result: only the terms row changed, the decoy row's version stayed at 7, and the resulting content hashed to `4c0a0ef39a1bc0c50f557eac877eaadb` — byte-identical to the intended value. The scratch database was then deleted.
- **Files modified:** none tracked; scratch only.
- **Verification:** `BYTE_IDENTICAL: True` before the production apply; the production read-back later produced the same hash.
- **Committed in:** n/a — scratch artifacts are not committed by design.

### 3. Extra verification beyond the plan

Not deviations in substance, but additions worth recording: the generator was re-run after the apply to prove the idempotence guard trips (`ALREADY_PRESENT`, exit 0, no SQL regenerated — T-12-15 proved rather than asserted); the restoring UPDATE was generated and round-trip tested rather than merely described; and all five `pages` rows were captured before and after and diffed programmatically rather than eyeballed.

---

**Total deviations:** 1 acceptance-criterion miss with compensating evidence (`meta.changes`), 1 auto-added safeguard (Rule 2), 1 batch of extra verification.
**Impact on plan:** No scope creep. No code changed, no migration added, one production row written exactly as intended. The one criterion not met literally was met in substance by stronger evidence, and is documented honestly rather than papered over.

## Issues Encountered

The `meta.changes: 2` reading, covered above. Resolved by evidence, not by retry — no second write was attempted, and none was needed.

## Threat mitigations applied

| Threat | Disposition | How it was met |
|---|---|---|
| T-12-11 clobbered content | mitigate | Content built from the row's own read-back; quotes doubled programmatically; applied with `--file`; scratch-sqlite round-trip proved byte equality before the write; read-back proved sections 1-5 survive; pre-change content captured with md5 and a tested restore |
| T-12-12 unscoped UPDATE | mitigate | `WHERE slug = 'terms-of-service' AND status = 'published'` asserted present exactly once; all five rows diffed before/after; `EXACTLY_ONE_ROW_CHANGED: true` |
| T-12-13 writing CMS content without an admin session | accept | One-time D-02 exception, one row, one statement, Russell's own credentials on his own store. Stated plainly above that the admin UI was not driven |
| T-12-14 injecting HTML the renderer would execute | mitigate | Only `h2` and `p` written, both in `SAFE_HTML_TAGS`; `PageRenderer` re-sanitizes every render; live markup inspected and matches sibling sections |
| T-12-15 a re-run appending a duplicate | mitigate | Generator refuses when the heading is present — proved by re-running it after the apply; D1 occurrence count is exactly 1 |
| T-12-SC package installs | accept | No packages installed; lockfile untouched |

No secret was read, printed, or written to any artifact.

## Known Stubs

None.

## Threat Flags

None. This plan added no network endpoint, auth path, file-access pattern, or schema change. It wrote one content value to an existing row through an existing trust boundary already registered as T-12-13.

## Human check outstanding

**Open https://voltique.russellkmoore.me/terms-of-service and confirm the Gift Cards section reads naturally in place.** It should sit after Recurring Orders, before the closing "For questions about these terms" paragraph, with the same type and spacing as the sections around it. The markup and CSS classes are provably identical in shape to section 5; whether the prose reads well is yours to judge.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

CONTENT-03 is complete. Nothing in this plan blocks 12-04 (Vectorize upsert), 12-05 (live order proof), or 12-06 (phase gate) — it shares no file, table, or artifact with any of them, and made no code change that a gate could fail on.

One note for 12-05 and 12-06: if either asserts on `meta.changes` from a `wrangler d1 execute --remote --file` apply, use `rows_written` instead, for the reason recorded under Deviations.

## Self-Check: PASSED

Every claim above was re-verified against reality after this SUMMARY was written:

- All nine scratch artifacts named in "Files Created/Modified" exist, at the byte sizes claimed (1632 / 1125 / 1468 / 1289 and the JSON captures).
- The **applied SQL block** in this document is byte-identical to `$SCRATCH/12-terms-update.sql`, the file that was actually applied.
- The **restoring SQL block** is byte-identical to `$SCRATCH/12-terms-restore.sql`, the file that was round-trip tested.
- The **pre-change content block** is byte-identical to `$SCRATCH/12-terms-content-before.html`, the capture taken before the write.
- No transcription was done by hand; each block was compared programmatically, not read over.

No file was created or modified in the repository by Tasks 1-3; `git status` confirms it. The only tracked file this plan commits is this SUMMARY.

---
*Phase: 12-content-assistant-live-proof*
*Completed: 2026-09-09*
