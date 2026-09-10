# Phase 12: Content, Assistant & Live Proof - Research

**Researched:** 2026-09-09
**Domain:** Cloudflare Workers/D1/R2/Vectorize/Workers AI operational scripting; Stripe PaymentIntent confirm; CMS content write
**Confidence:** MEDIUM-HIGH (the two hardest technical questions — remote-binding mechanics and the account-listing key — are HIGH, VERIFIED against installed source and live production reads; a few operational details, notably the live email provider, could not be resolved from static config and are flagged as open)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The Volt re-index runs as a local Node script using wrangler's `getPlatformProxy({ remoteBindings: true })` (AI, VECTORIZE, DB, MEDIA against production, under Russell's OAuth login — the Phase 9 image-generation precedent) that reproduces the logic of `app/api/admin/vectorize/route.ts` (products from D1 + `knowledge_md/*.md` from R2 → embeddings → Vectorize upsert). The admin HTTP route is not called because it requires `ADMIN_VECTORIZE_TOKEN` (a secret Claude never reads) or a Clerk admin session, and rotating the token would break Russell's own copy. The script lives under `scripts/` only if the plan judges it reusable; otherwise it stays in the session scratch directory and the SUMMARY records its shape. — **Unattended decision**.
- **D-02:** The Terms of Service gift-card section is written to the same CMS row Admin → Pages edits (`pages` where `slug = 'terms-of-service'`) with a single read-only-verified `UPDATE` via `wrangler d1 execute mercora-db --remote` that appends a new `<h2>6. Gift Cards</h2>` block before the closing "For questions…" paragraph, bumps `version`, `updated_at`, and `published_at` if the row's status requires, and leaves `status = 'published'`. CONTENT-03's "published through Admin → Pages" is satisfied in effect; the SUMMARY states plainly the admin UI itself was not driven. — **Unattended decision**.
- **D-03:** Neither action rewrites anything else: the article file is the only R2 object put (`knowledge_md/gift-cards.md`), the Terms row is the only D1 write, and the Vectorize upsert is the only index write. Each is preceded by a read-back of the current state and followed by a read-back proof.
- **D-04:** The proof is a scripted guest checkout against production in Stripe test mode: `POST /api/payment-intent` with one `prod_33` / `variant_33` ($25) line carrying a recipient customization, a full billing address, and `shippingMethodId: "digital"`; the returned PaymentIntent is confirmed through Stripe's API using only the public `pk_test_` publishable key and Stripe's test payment method `pm_card_visa`; then `POST /api/orders` with `paymentIntentId` and `orderId` finalises the order. — **Unattended decision**.
- **D-05:** The recipient is Russell's own address, `russellkmoore@mac.com`, name "Russell", message "Phase 12 live proof — Voltique gift card", no delivery date. The purchaser is a guest (no Clerk session). — **Unattended decision**.
- **D-06:** Evidence is gathered read-only from production D1 and the tail worker: the order row, the `gift_card_accounts` row (issued amount 2500 USD, status active), the `gift_card_deliveries` row reaching `status = 'sent'` within two five-minute cron cycles, and no `cron.recovery_failed`. The "appears under Account → Gift Cards" half of SHOP-07 is recorded as a human check for Russell. If the test payment fails, the executor stops with evidence rather than retrying blindly.
- **D-07:** The bearer code is never read, printed, or stored by the run; the proof reads only non-secret columns.
- **D-08:** `data/r2/knowledge_md/gift-cards.md` is rewritten: four amounts ($25/$50/$100/$200), delivered by email as soon as payment completes, never expires, not redeemable for cash or transferable for resale, redeemed at checkout, balance visible under Account → Gift Cards or by entering the code at checkout; keep the front-matter shape; tags gain `gift`, `present`, `voucher`.
- **D-09:** Terms section text: email delivery after payment; no expiry; no cash redemption; not transferable for resale; stored value usable across orders; contact link for issues — dated "Gift card terms version 2026-09-09".
- **D-10:** Volt proof: three unauthenticated `POST /api/agent-chat` calls ("what should I get as a gift?", "do you sell presents?", "do you have vouchers?") after the re-index; each reply must mention the gift card (case-insensitive "gift card"). Recorded with response excerpts.
- **Carried forward:** Phase 9 D-08 name "Voltique Gift Card"; Phase 10 D-01 billing-details contract; Phase 11 D-07/D-08. No secret value, bearer code, or account id in any artifact.

### Claude's Discretion

- Script file locations (scratch vs `scripts/`), embedding model/params copied exactly from the route, batch sizes, and whether products are re-embedded or only the knowledge article plus `prod_33` (recommend: full re-index exactly as the route does).
- Exact article and Terms wording within D-08/D-09.
- Whether to add a `tests/unit/data/knowledge-gift-cards.test.ts` source-contract test (recommend yes).
- How long to wait for the delivery row (two cron cycles max) and which tail-worker capture method to reuse from 11-04.

### Deferred Ideas (OUT OF SCOPE)

- A reusable, documented `scripts/vectorize-reindex.mjs` — worth keeping if this phase's script proves clean.
- Driving Admin → Pages through a real Clerk session (Russell's UAT list).
- `/gsd-verify-work 10` and the Phase 11 signed-in `GET /api/gift-cards` check — Russell's next session.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONTENT-01 | Rewrite `data/r2/knowledge_md/gift-cards.md` to match what ships and upload to R2 | Article format, indexer behavior, and R2 upload command verified below (§Standard Stack, §Code Examples) |
| CONTENT-02 | Re-index Volt; it recommends the gift card for gift/present/voucher questions | Full remote-binding mechanics for the re-index script verified below (§Pitfall 1 — the phase's hardest and most load-bearing finding); `prod_33`'s tags/ai_notes already contain the right words (verified live) |
| CONTENT-03 | Terms of Service page gains a gift-card section, published through Admin → Pages | Exact live production row content read back below (§Code Examples); sanitizer/render-time behavior verified |
| SHOP-07 | Gift-card-only order paid in Stripe test mode on production → issued card, delivery email, listed under Account → Gift Cards | Full checkout/confirm/finalize chain verified below; **critical finding**: a guest-purchased card structurally cannot appear under any Account → Gift Cards page (§Pitfall 2) |
</phase_requirements>

## Summary

This phase is almost entirely operational scripting against a live production Cloudflare stack, not application code. Three of the four requirements (CONTENT-01/02/03) are content and CMS writes; the fourth (SHOP-07) is a scripted Stripe test-mode purchase. The two hardest technical questions were resolved by reading the installed `wrangler` 4.129.0 source directly (not training data) and by running read-only queries against production D1: (1) whether `getPlatformProxy({ remoteBindings: true })` actually reaches production D1/R2/Vectorize without any other configuration — it does **not**, for D1 and R2 and Vectorize, without an additional per-binding `"remote": true` flag that must never be added to the committed `wrangler.jsonc`; and (2) whether the guest-purchased gift card from D-04/D-05 will ever appear under any signed-in shopper's Account → Gift Cards page — it structurally **cannot**, because `listCustomerGiftCardPresentations` filters on `purchaser_customer_id`, which is `NULL` for every guest order.

**Primary recommendation:** Build the re-index script against a **scratch-directory copy** of `wrangler.jsonc` with `"remote": true` added only to the `DB`, `MEDIA`, and `VECTORIZE` binding entries (AI needs no change — Workers AI is always remote in `getPlatformProxy`, confirmed in source), pass that copy's path as `configPath`, and never touch the committed `wrangler.jsonc`. Flag the Account → Gift Cards structural gap to the planner/Russell explicitly rather than silently treating D-06's "human check" framing as sufficient — it is a stronger and different problem than "no browser session available."

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Knowledge article content | R2 (object storage) | — | `knowledge_md/*.md` is a flat file the vectorize route lists and embeds; no DB row |
| Vector index (Volt retrieval) | Vectorize (Cloudflare AI service) | Workers AI (embeddings) | `voltique-index`, 768-dim, cosine; populated by embedding markdown text with `@cf/baai/bge-base-en-v1.5` |
| Volt chat responses | API/Backend (`app/api/agent-chat/route.ts`) | Workers AI (`@cf/openai/gpt-oss-20b`) | Server-side retrieval + generation; public endpoint, rate-limited |
| Terms of Service content | Database / Storage (D1 `pages` table) | Frontend Server (SSR render + sanitize) | `app/[slug]/page.tsx` reads D1 per request; `PageRenderer` re-sanitizes on every render |
| Checkout / payment | API/Backend (`/api/payment-intent`, `/api/orders`) | External (Stripe) | Server owns pricing, inventory, order persistence; Stripe owns tender capture |
| Gift-card issuance & delivery | API/Backend (`lib/services/gift-card-fulfillment.ts`) + cron | Database (`gift_card_accounts`, `gift_card_deliveries`) | Triggered by `finalizeOrderPayment`; drained by the 5-minute recovery cron |
| Gift-card account listing | API/Backend (`/api/gift-cards`) | Database | Keyed by Clerk `purchaser_customer_id`, not recipient email (see Pitfall 2) |

## Standard Stack

### Core

No new libraries are introduced by this phase. The re-index script uses the project's already-installed `wrangler` (4.129.0) programmatic API (`getPlatformProxy`) and the Workers/D1/R2/Vectorize bindings it already depends on for local dev.

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|---------------|
| `wrangler` | 4.129.0 `[VERIFIED: node_modules/wrangler/package.json]` | `getPlatformProxy` API for a local Node script to reach production Cloudflare bindings | Already the project's pinned Cloudflare CLI/SDK; same mechanism as the Phase 9 image-generation script |
| `@cf/baai/bge-base-en-v1.5` | n/a (Workers AI model) | Embedding model for both products and knowledge articles | `[VERIFIED: lib/ai/config.ts:39, app/api/admin/vectorize/route.ts:226,281]` — same model string in both files |
| `@cf/openai/gpt-oss-20b` | n/a (Workers AI model) | Volt's chat/generation model | `[VERIFIED: lib/ai/config.ts:29]` |

### Package Legitimacy Audit

**Not applicable.** This phase installs no new npm/PyPI/crates packages. The re-index script is pure Node.js (`fs`, `path`, `crypto`) plus the already-vendored `wrangler` package. `npm audit` in the existing CI gate suite covers the dependency tree unchanged.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────┐
                    │  Local Node script (D-01)   │
                    │  scripts/ or scratch dir    │
                    └──────────────┬──────────────┘
                                   │ getPlatformProxy({ configPath: <scratch
                                   │ wrangler.jsonc with remote:true on
                                   │ DB/MEDIA/VECTORIZE>, remoteBindings:true })
                    ┌──────────────┴───────────────────────────┐
                    │                                           │
             ┌──────▼──────┐   ┌──────────┐   ┌─────────┐  ┌───▼────┐
             │  D1 (DB)    │   │ R2 (MEDIA)│   │Workers AI│ │Vectorize│
             │  products   │   │knowledge_md│  │ embed    │ │ upsert  │
             └─────────────┘   └──────────┘   └─────────┘  └────────┘
                                                                  │
                                                          voltique-index
                                                                  │
                                                     ┌────────────▼────────────┐
                                                     │ POST /api/agent-chat     │
                                                     │ (production, live URL)  │
                                                     └──────────────────────────┘

     ─────────────────────────── separately ───────────────────────────

  wrangler r2 object put --remote     wrangler d1 execute --remote
  (gift-cards.md upload, CLI only,     (Terms of Service UPDATE,
   NOT through the script's binding)   CLI only)

     ─────────────────────────── SHOP-07 proof ──────────────────────────

  POST /api/payment-intent (guest, prod_33/variant_33, digital)
        │  {clientSecret, paymentIntentId, orderId}
        ▼
  Stripe confirm (publishable key + pm_card_visa)  ──► Stripe test mode succeeds
        │  succeeded
        ▼
  POST /api/orders {paymentIntentId, orderId}
        │  server re-verifies PaymentIntent with its own secret key
        ▼
  finalizeOrderPayment → order_effects staged → 5-min cron drains
        │
        ├─► gift_card_accounts (status=active, purchaser_customer_id=NULL)
        └─► gift_card_deliveries (status: pending→processing→sent)
                   │
                   ▼
            delivery email to russellkmoore@mac.com
```

### Recommended Approach for D-01 (the re-index script)

**What:** A Node script that never modifies the committed `wrangler.jsonc`, but builds a scratch copy with `"remote": true` added to exactly three binding entries, and calls `getPlatformProxy` against that copy.

**Why this is necessary — VERIFIED against the installed `wrangler` 4.129.0 source (not training data, not web docs):**

Read directly from `node_modules/wrangler/wrangler-dist/cli.js` (lines 25749–25801, the `BINDING_LOCAL_SUPPORT` table) and its consumers (lines 164436–164936, `buildMiniflareBindingOptions`):

```
BINDING_LOCAL_SUPPORT = {
  ...
  kv_namespace: "local-and-remote",
  r2_bucket: "local-and-remote",
  d1: "local-and-remote",
  ...
  vectorize: "remote",
  ...
  ai: "DO-NOT-USE-this-resource-will-never-have-a-local-simulator",
  ...
}
```

And the binding-builder functions that actually decide whether a call reaches production:

```js
// r2BucketEntry / d1DatabaseEntry — cli.js:164436, 164446
function r2BucketEntry({ binding, bucket_name, remote, local_dev }, remoteProxyConnectionString) {
  if (!remoteProxyConnectionString || !remote) {
    return [binding, { id, s3Credentials: local_dev?.experimental_s3_credentials }]; // LOCAL simulator
  }
  return [binding, { id, remoteProxyConnectionString }]; // production
}
// vectorize — cli.js:164921-164935
vectorize: Object.fromEntries(vectorizeBindings.map((vectorize) => {
  validateBindingRemoteSetting("vectorize", vectorize.remote, logger2.warn);
  return [vectorize.binding, {
    index_name: vectorize.index_name,
    remoteProxyConnectionString: vectorize.remote && remoteProxyConnectionString ? remoteProxyConnectionString : void 0,
  }];
})),
// ai — cli.js:164775-164778 (NO .remote check — unconditional)
ai: aiBindings.length > 0 ? { binding: aiBindings[0].binding, remoteProxyConnectionString } : void 0,
```
`[VERIFIED: node_modules/wrangler/wrangler-dist/cli.js:25749-25801,164436-164452,164775-164778,164921-164935 — this exact installed version, read this session]`

This means: **D1, R2, and Vectorize default to a local Miniflare simulator (empty/ephemeral state) unless the specific binding entry in the config carries `"remote": true`.** AI is the only one of the four bindings this script needs that is unconditionally remote — which is exactly why Phase 9's script worked with zero extra config (it only used AI and, via a *separate* CLI command, R2). Phase 12's script is new territory: it is the first script in this project to need D1 and Vectorize (and R2, in-process) remote simultaneously.

Adding `"remote": true` to the **committed** `wrangler.jsonc`'s `d1_databases`/`r2_buckets`/`vectorize` blocks would flip every local `npm run dev` to read/write production D1 and R2 by default — a severe, unacceptable regression to local dev and the `predev` seed flow. The fix is a **scratch config file**, never committed:

```js
// scripts/vectorize-reindex.mjs (or a scratch-dir equivalent)
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getPlatformProxy } from 'wrangler';

const REPO_ROOT = process.cwd();
const real = readFileSync(join(REPO_ROOT, 'wrangler.jsonc'), 'utf8');

// Targeted, minimal string edits — add "remote": true to exactly the three
// binding objects this script needs remote, leave everything else untouched.
// (Exact literal strings must be re-read from the live wrangler.jsonc at
// execution time; do not hand-copy stale line numbers.)
const patched = real
  .replace(
    /("binding":\s*"DB",\s*"database_name":\s*"mercora-db",\s*"database_id":\s*"[^"]+")/,
    '$1, "remote": true'
  )
  .replace(
    /("binding":\s*"MEDIA",\s*"bucket_name":\s*"voltique-images")/,
    '$1, "remote": true'
  )
  .replace(
    /("binding":\s*"VECTORIZE",\s*"index_name":\s*"voltique-index")/,
    '$1, "remote": true'
  );

const scratchDir = mkdtempSync(join(tmpdir(), 'gsd-12-wrangler-'));
const scratchConfigPath = join(scratchDir, 'wrangler.jsonc');
writeFileSync(scratchConfigPath, patched);

const { env, dispose } = await getPlatformProxy({
  configPath: scratchConfigPath,
  remoteBindings: true,
});
// env.DB, env.MEDIA, env.VECTORIZE, env.AI now all reach production.
// ... reproduce app/api/admin/vectorize/route.ts's algorithm exactly ...
await dispose();
```

**Verification step the plan must include before trusting this:** after building `env`, run one cheap read against each of the three previously-local bindings (e.g. `await env.DB.prepare('SELECT COUNT(*) FROM products').first()` should return `33`, not `0`; `await env.MEDIA.list({ prefix: 'knowledge_md/' })` should return `8` objects, not `0`) — a silent fallback to the empty local simulator is the single most likely failure mode and would otherwise look like a successful but empty re-index. `[ASSUMED — this specific verification step is my own recommendation, not something I ran; the underlying remote/local binding mechanics it protects against are VERIFIED as above]`

**`main` field caveat:** the scratch config still has `"main": "worker.ts"` (a relative path). `readConfig()` may attempt to resolve it relative to the scratch directory, where it won't exist. Recommend replacing that field with an absolute path to the real `worker.ts` in the same string-patch pass, or testing whether `getPlatformProxy` tolerates a missing `main` (it builds an empty in-memory script regardless — `script: ""` — per `getMiniflareOptionsFromConfig`, cli.js:361484-361506, so this is likely a non-issue but worth a smoke-test). `[ASSUMED]`

### Recommended Project Structure

```
scripts/
└── vectorize-reindex.mjs   # only if the plan judges it reusable per D-01; else scratch dir
data/r2/knowledge_md/
└── gift-cards.md           # CONTENT-01 rewrite target
tests/unit/data/
└── knowledge-gift-cards.test.ts   # recommended new source-contract test
```

### Anti-Patterns to Avoid

- **Adding `"remote": true` to the committed `wrangler.jsonc`:** flips local dev to production D1/R2/Vectorize by default. Use a scratch copy only.
- **Trusting the admin route's HTTP shape as the vectorize script's contract:** the route is Next.js request/response plumbing; only its D1 query, R2 listing, embedding calls, and `vectorize.upsert(...)` payload shape are what the script must reproduce. Copy the algorithm (already read and quoted below), not the HTTP wrapper.
- **Assuming `deliveryDate` is a valid gift-card customization field to send:** the only allowed keys are `recipientEmail`, `recipientName`, `message`, `deliveryDate` — D-05 says no delivery date, so omit the key entirely rather than sending an empty string (an empty string is *not* accepted; `normalizedDeliveryDate` requires either `undefined` or a valid `YYYY-MM-DD`). `[VERIFIED: lib/gift-cards/customization.ts:76-91]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reaching production Cloudflare bindings from a local script | A bespoke Cloudflare API client per binding | `getPlatformProxy` with a scratch `remote:true` config | Already the project's established pattern (Phase 9); avoids re-deriving auth/session handling wrangler already does |
| Verifying a PaymentIntent succeeded | Trusting the client-side confirm response alone | `POST /api/orders` → `finalizeOrderPayment` → `retrievePaymentIntent` with the server's own secret key | The server never trusts client-reported payment state; this is already enforced code, not something the script re-implements |
| HTML sanitization on the Terms of Service write | Hand-checking the inserted HTML is "safe" | Rely on `PageRenderer`'s existing `sanitizePageHtmlServer` call, which runs on **every render**, not just on write | `[VERIFIED: app/[slug]/PageRenderer.tsx:44]` — even a raw D1 `UPDATE` that bypasses `updatePage()`'s write-time sanitization is re-sanitized at read time; use only tags already in `SAFE_HTML_TAGS` (`h2`, `p` suffice) so nothing is silently stripped |

**Key insight:** almost everything this phase needs already exists as working, tested application code (the vectorize route's algorithm, the checkout/payment/finalization chain, the page sanitizer). The work is reproducing those algorithms from a script and CLI commands, not inventing new logic.

## Common Pitfalls

### Pitfall 1: `getPlatformProxy({ remoteBindings: true })` alone does not reach production D1, R2, or Vectorize

**What goes wrong:** The script silently reads/writes an empty local Miniflare simulator instead of production. D1 queries return 0 rows; R2 `list()` returns 0 objects; Vectorize calls likely throw (no local simulator exists at all for Vectorize) or silently no-op.
**Why it happens:** Only Workers AI is unconditionally remote in `getPlatformProxy`. D1, R2, and KV are `"local-and-remote"` — they need a per-binding `"remote": true` in the config *and* a live remote-proxy session; Vectorize is `"remote"`-only and needs the same flag or it gets no `remoteProxyConnectionString` at all. None of the project's committed `wrangler.jsonc` binding entries currently carry `"remote": true`. `[VERIFIED: node_modules/wrangler/wrangler-dist/cli.js, see Architecture Patterns above]`
**How to avoid:** Build the scratch-config-copy pattern described above; verify each of the three bindings actually returns production-shaped data (nonzero counts) before trusting the rest of the script's output.
**Warning signs:** A "successful" re-index that reports 0 products indexed, or a Vectorize upsert that throws immediately, or (worse) succeeds silently against a Vectorize binding with no `remoteProxyConnectionString`, meaning the upsert may target nothing at all.

### Pitfall 2: A guest-purchased gift card can never appear under any signed-in shopper's Account → Gift Cards page

**What goes wrong:** SHOP-07's full requirement text ("...the card appearing under Account → Gift Cards for the recipient's account") cannot be satisfied by D-04/D-05's guest-checkout proof, no matter who signs in afterward — including Russell himself, using the same email address the card was sent to.
**Why it happens:** `GET /api/gift-cards` calls `listCustomerGiftCardPresentations({ customerId: userId, ... })`, which runs `WHERE account.purchaser_customer_id = ?` — filtered strictly on the **purchaser's** Clerk user id, never on recipient email. `[VERIFIED: app/api/gift-cards/route.ts:19-25, lib/gift-cards/presentations.ts:67-77]` And `purchaser_customer_id` is set directly from `args.order.customer_id` at issuance time. `[VERIFIED: lib/services/gift-card-fulfillment.ts:81]` A guest `POST /api/payment-intent` call inserts the order with `customer_id: userId` where `userId` is `null` (no Clerk session). `[VERIFIED: app/api/payment-intent/route.ts:98,266]` `purchaser_customer_id` is a nullable column (`.references(...)`, no `.notNull()`). `[VERIFIED: lib/db/schema/gift-cards.ts:37-38]` A `NULL` value can never satisfy `= ?` against any concrete Clerk user id in SQL — this is not a browser-session testing limitation, it is a structural mismatch between "guest purchase" and "recipient's account listing."
**How to avoid:** This is a genuine, pre-existing gap between what an unattended guest-checkout script can prove and what SHOP-07's full requirement text asks for. Recommend the plan surface this explicitly as a discretion/confirmation point rather than quietly relying on D-06's "human check" framing, which implicitly assumes the only obstacle is the lack of a live browser session. Two honest paths: (a) accept and document that the Account → Gift Cards half of SHOP-07 is **not** provable by this script under any circumstances, and is fully deferred to Russell performing (or re-performing) a **signed-in** purchase; or (b) if a signed-in proof is wanted now, the script would need a live Clerk session — which D-04 explicitly avoided obtaining. This finding does not block D-06's D1-only evidence gathering (order/account/delivery rows), only the "appears under Account → Gift Cards" sub-claim.
**Warning signs:** None visible until a human actually signs in and checks — the D1 evidence rows will all look healthy (`gift_card_accounts.status = 'active'`, delivery `status = 'sent'`) while the account page silently shows zero cards, because that query was never going to match this row.

### Pitfall 3: The email provider actually in effect in production could not be determined from static config

**What goes wrong:** Planning around "Cloudflare Email Sending" vs. "Resend" delivery behavior (e.g. Resend sandbox recipient restrictions) on the wrong assumption.
**Why it happens:** `sender.ts`'s `resolveRuntime()` auto-selects a provider only when `EMAIL_PROVIDER` is unset **and** exactly one of `{ EMAIL binding, RESEND_API_KEY }` is configured — otherwise it throws (`"Both email providers are configured; set EMAIL_PROVIDER explicitly"`). `[VERIFIED: lib/email/sender.ts:77-95]` Production has **both** the `EMAIL` binding (`[VERIFIED: wrangler.jsonc:67-71]`) **and** a live `RESEND_API_KEY` secret (`[VERIFIED: wrangler secret list, read this session — name only, no value]`), and `EMAIL_PROVIDER` does not appear anywhere in the committed `wrangler.jsonc` `vars` block (`[VERIFIED: grep of wrangler.jsonc, no match]`). Since transactional email demonstrably already works in production (order confirmations shipped in earlier phases), `EMAIL_PROVIDER` must be set as a Cloudflare dashboard Build variable outside the repo — the same pattern already recorded in project memory for `NEXT_PUBLIC_THEME_DEFAULT`. This value could not be read from any tool available in this research session.
**How to avoid:** Do not assume either provider. During the live purchase proof, capture the tail-worker output around the delivery send and read which provider the `EmailResult` reports (`provider: "cloudflare" | "resend"`), or check the `email_deliveries` D1 table's `provider` column for this delivery's row after it completes, as part of the same read-only evidence gathering D-06 already plans.
**Warning signs:** If it turns out to be Resend and the sending domain isn't verified for arbitrary recipients, delivery could fail with a Resend sandbox-restriction error — this risk is much lower here because D-05 deliberately chose Russell's **own** email as recipient, which is very likely also the account-holder for any Resend sandbox in use.

### Pitfall 4: The knowledge-article indexer does not parse front matter — it embeds the whole raw file as text

**What goes wrong:** Assuming `id`/`title`/`category`/`tags` front-matter fields drive retrieval relevance or are validated by the indexer.
**Why it happens:** `app/api/admin/vectorize/route.ts`'s knowledge step does `const text = await file.text(); ... ai.run("@cf/baai/bge-base-en-v1.5", { text })` — it embeds the entire file content, front matter included, with no YAML parsing at all. `[VERIFIED: app/api/admin/vectorize/route.ts:274-294]` There is no schema contract enforced on the front matter; it matters only because its words (including `tags: [...]`) become part of the embedded text and therefore part of what semantic search matches against.
**How to avoid:** Keep the `tags: [gift, present, voucher]` and AI NOTES line prominent in the file body (not just as inert metadata) since they directly influence embedding similarity for "gift"/"present"/"voucher" queries.

### Pitfall 5: Vectorize metadata shape agreement between the indexer and the chat route is narrower than CONTEXT.md assumed — no `type` field exists or is needed

**What goes wrong:** Building the script to write a `type` field into Vectorize metadata because the chat route is assumed to filter on it.
**Why it happens (correction of an assumption in the phase's canonical refs):** The indexer writes `{ slug, source: "knowledge"|"product", text, productId? }` per vector. `[VERIFIED: app/api/admin/vectorize/route.ts:233-239,288-293]` The chat route only ever reads `match.metadata.text` (for retrieval context) and `match.metadata.productId` (to resolve full product records). `[VERIFIED: app/api/agent-chat/route.ts:607,617]` No `type`, `slug`, or `source` field is read anywhere in the chat route. The script only needs to match the four fields the indexer already writes — nothing more.
**How to avoid:** Reproduce exactly `{ id, values, metadata: { slug, source, text, productId? } }` per vector; do not invent additional metadata fields the route will never read.

## Code Examples

### Knowledge-indexing algorithm to reproduce (from the admin route, verified this session)

```typescript
// Source: app/api/admin/vectorize/route.ts:258-301 (knowledge step) — read verbatim this session
const list = await media.list({ prefix: "knowledge_md/" });
for (const obj of list.objects) {
  if (!obj.key.endsWith(".md")) continue;
  const slug = obj.key.replace("knowledge_md/", "").replace(".md", "");
  const file = await media.get(obj.key);
  const text = await file.text();
  const embedding = await ai.run("@cf/baai/bge-base-en-v1.5", { text });
  await vectorize.upsert([{
    id: `knowledge-${slug}`,
    values: embedding.data[0],
    metadata: { slug, source: "knowledge", text: text.substring(0, 1000) },
  }]);
}
```
The product step (lines 104-249) additionally clears the index first (`vectorize.query` a dummy 768-dim vector with `topK: 10000`, then `vectorize.deleteByIds` in batches of 1000), builds `generateProductMarkdown(...)` per product, uploads it to `products_md/{slug}.md` in R2, embeds it, and upserts `{ id: product.id, values, metadata: { slug, source: "product", text, productId } }`.

### Terms of Service — exact current production content and the target insertion point

Read via `wrangler d1 execute mercora-db --remote --json --command "SELECT content FROM pages WHERE slug='terms-of-service';"` this session (read-only; row `id=2`, `status='published'`, `version=2`, `published_at=NULL`, `updated_at=1788849233`):

```
<h1>Terms of Service</h1><p><strong>Last Updated:</strong> 2025-09-01</p><h2>1. Acceptance of Terms</h2><p>By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.</p><h2>2. Description of Service</h2><p>We provide an AI-powered eCommerce platform for outdoor gear and equipment.</p><h2>3. User Accounts</h2><p>You are responsible for maintaining the confidentiality of your account credentials.</p><h2>4. Contact Information</h2>
<h2>5. Recurring Orders</h2>
<p>Some products can be purchased as a subscription. When you subscribe, you authorise us to charge your saved payment method at the price and interval shown at checkout, starting on the day you subscribe, until you cancel. Each renewal ships to the address on the subscription. You can pause, skip, change the address, or cancel at any time from your account page; cancellation takes effect at the end of the current billing period. Prices may change with at least 30 days' notice before the next renewal. Recurring terms version 2026-09-07.</p>

<p>For questions about these terms, please contact us.</p>
```
`[VERIFIED: wrangler d1 execute mercora-db --remote (read-only SELECT), run this session]`

The new `<h2>6. Gift Cards</h2>` block per D-02/D-09 goes immediately before the final `<p>For questions about these terms, please contact us.</p>` paragraph — matching the same pattern the "5. Recurring Orders" section already used. Both `h2` and `p` are in `SAFE_HTML_TAGS`, so nothing will be stripped at render time. `[VERIFIED: lib/utils/sanitize-html-policy.ts:1-8]`

Recommended full replacement content (single `UPDATE`, avoiding fragile SQL `REPLACE()` escaping — write the whole new `content` value literally):

```sql
-- Read-back BEFORE (required by D-03):
-- wrangler d1 execute mercora-db --remote --json --command \
--   "SELECT id, version, updated_at, length(content) FROM pages WHERE slug='terms-of-service';"

UPDATE pages
SET content = '<h1>Terms of Service</h1><p><strong>Last Updated:</strong> 2025-09-01</p><h2>1. Acceptance of Terms</h2><p>By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.</p><h2>2. Description of Service</h2><p>We provide an AI-powered eCommerce platform for outdoor gear and equipment.</p><h2>3. User Accounts</h2><p>You are responsible for maintaining the confidentiality of your account credentials.</p><h2>4. Contact Information</h2>
<h2>5. Recurring Orders</h2>
<p>Some products can be purchased as a subscription. When you subscribe, you authorise us to charge your saved payment method at the price and interval shown at checkout, starting on the day you subscribe, until you cancel. Each renewal ships to the address on the subscription. You can pause, skip, change the address, or cancel at any time from your account page; cancellation takes effect at the end of the current billing period. Prices may change with at least 30 days'' notice before the next renewal. Recurring terms version 2026-09-07.</p>

<h2>6. Gift Cards</h2>
<p>Gift cards are delivered to the recipient by email as soon as payment completes. They never expire, cannot be redeemed for cash, and cannot be transferred or resold. Stored value can be used across multiple orders. If you have a question about a gift card, please contact us. Gift card terms version 2026-09-09.</p>

<p>For questions about these terms, please contact us.</p>',
    version = version + 1,
    updated_at = CAST(strftime(''%s'',''now'') AS INTEGER)
WHERE slug = 'terms-of-service' AND status = 'published';

-- Read-back AFTER (required by D-03): re-run the SELECT above, confirm version
-- incremented by exactly 1 and content length grew by the new block's length.
```
Note: `published_at` is left untouched (stays `NULL`) — `isPagePublished()` treats `NULL` as "always published, no gate," so setting it would not change any behavior. `[VERIFIED: lib/db/schema/pages.ts:256-260]` Doubled single-quotes (`''`) inside the SQL string literal escape the apostrophes already present in "authorise" and "notice's" — verify the exact escaping against whatever shell-quoting layer `wrangler d1 execute --command` requires at execution time; a `--file` flag with a `.sql` file may be safer than an inline `--command` for a string this long.

### Product row confirming CONTENT-02 is mostly a re-index, not new tagging work

```
-- SELECT id, name, tags, extensions FROM products WHERE id='prod_33';  (read this session)
tags: ["gift", "gift card", "present", "voucher", "gift certificate", "digital"]
extensions.ai_notes: "The Voltique Gift Card is a digital, stored-value product for shoppers
  who want to give Voltique gear without picking a specific item. Match it whenever a shopper
  asks about a gift, present, voucher, gift certificate, or something for someone who already
  has everything."
extensions.use_cases: ["gift", "present", "last-minute gift", "voucher", "gift certificate"]
```
`[VERIFIED: wrangler d1 execute mercora-db --remote (read-only SELECT), run this session]` — Phase 9's D-08 already seeded exactly the words CONTENT-02 needs to match on. This significantly de-risks CONTENT-02: the re-index just needs to run correctly (Pitfall 1), not require new product-side tagging.

### Live checkout request/response shapes (verified from source, not executed)

```
POST /api/payment-intent
{
  "items": [{ "productId": "prod_33", "variantId": "variant_33", "quantity": 1,
              "giftCardCustomization": { "recipientEmail": "russellkmoore@mac.com",
                "recipientName": "Russell", "message": "Phase 12 live proof — Voltique gift card" } }],
  "shippingAddress": { "line1": "101 Townsend St", "city": "San Francisco", "region": "CA",
    "postal_code": "94107", "country": "US", "email": "russellkmoore@mac.com", "recipient": "Russell" },
  "shippingMethodId": "digital"
}
→ 200 { clientSecret, paymentIntentId, orderId, amount, quote: {...} }
```
`shippingMethodId`'s value is not actually validated when the cart is all-digital (`hasPhysicalCheckoutLines` is false, so the shipping-method lookup branch never runs) — any bounded string satisfies the top-level request validator. `[VERIFIED: lib/services/checkout-pricing.ts:606-637, app/api/payment-intent/route.ts:91]` The billing address is still required in full even for an all-digital cart (Phase 10 D-01, unchanged). `deliveryDate` is omitted entirely (not sent as `""`) per D-05 — an empty string is rejected by the field parser. `[VERIFIED: lib/gift-cards/customization.ts:76-91]`

```
POST https://api.stripe.com/v1/payment_intents/{paymentIntentId}/confirm
Authorization: Bearer pk_test_...   (or -u pk_test_...: as HTTP Basic auth)
client_secret=<clientSecret from the /api/payment-intent response>
payment_method=pm_card_visa
return_url=https://voltique.russellkmoore.me/checkout
→ 200 { status: "succeeded", ... }
```
**CORRECTION (planning, 2026-09-09):** the original form of this example omitted `client_secret`, which would have failed. A publishable key alone does not authorize a confirm — the `client_secret` returned by `POST /api/payment-intent` is the credential that does, and it must be sent in the form body alongside `payment_method` and `return_url`. Re-verified against current Stripe documentation this session: under the default `confirmation_method: automatic`, client SDKs complete payment "using the client_secret" with the publishable key, which is exactly the browser path this script reproduces. `[CITED: docs.stripe.com/api/payment_intents — confirmation_method attribute; docs.stripe.com/api/payment_intents/update — client secret attribute]`

The same source states the client secret "must never be stored, logged, or exposed to anyone other than the customer." Plan `12-05` Task 1 step 7 therefore holds it in memory only: never written to `12-PROOF-ORDER.md`, never printed, never passed as a shell argument where it would appear in a process listing.
The PaymentIntent is created with `automatic_payment_methods: { enabled: true }` and no explicit `payment_method_types`. `[VERIFIED: app/api/payment-intent/route.ts:178]` Stripe's official example for `POST /v1/payment_intents/{id}/confirm` includes `return_url` even for a plain card confirm; recommend always sending one (the app's own production URL is a safe value) rather than relying on `pm_card_visa` never triggering `requires_action`. `[CITED: https://docs.stripe.com/api/payment_intents/confirm]` Publishable-key auth for this specific endpoint is standard Stripe behavior (it's the same call Stripe.js makes client-side) — CONTEXT.md's framing is correct; this research did not find a documented exception for it.

```
POST /api/orders
{ "paymentIntentId": "pi_...", "orderId": "WEB-GUEST-..." }
→ 200 { data: { id: orderId }, meta: { schema: "mach:order", idempotent: false } }
```
The server independently re-verifies the PaymentIntent with its own secret key (`retrievePaymentIntent`), checks `status === 'succeeded'`, `metadata.orderId` matches, currency and amount match the server's own quote — the client's report of success is never trusted. `[VERIFIED: lib/services/order-finalization.ts:94-144]`

### Read-only evidence queries (all confirmed runnable and safe this session)

```bash
# Order row
wrangler d1 execute mercora-db --remote --json --command \
  "SELECT id, status, payment_status, total_amount, currency_code FROM orders WHERE id='<orderId>';"

# Issued gift card (no code_hash, no bearer code — D-07)
wrangler d1 execute mercora-db --remote --json --command \
  "SELECT id, status, currency_code, issued_amount_minor, issued_order_id, purchaser_customer_id, created_at
   FROM gift_card_accounts WHERE issued_order_id='<orderId>';"

# Delivery status lifecycle
wrangler d1 execute mercora-db --remote --json --command \
  "SELECT id, status, recipient_email, attempt_count, deliver_after, completed_at
   FROM gift_card_deliveries WHERE order_id='<orderId>';"
```
`gift_card_accounts.status` enum: `["active","disabled"]`. `gift_card_deliveries.status` enum: `["pending","processing","sent","needs_review"]`. `[VERIFIED: lib/db/schema/gift-cards.ts:14-23,190-193, read this session]` Recovery cron runs every 5 minutes (`*/5 * * * *`). `[VERIFIED: wrangler.jsonc:9-11]` `purchaser_customer_id` will read back `NULL` for this guest purchase — expected, not a bug (see Pitfall 2).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `wrangler dev --remote` (whole-session remote) | Per-binding `"remote": true` + `getPlatformProxy({ remoteBindings: true })` | Current in 4.129.0, per source read this session | Finer-grained: a script can mix local and remote bindings per entry, but the default for D1/R2/KV is still local |

**Note on public documentation currency:** Cloudflare's public docs on `getPlatformProxy` supported bindings do not clearly enumerate the D1/R2/Vectorize `remote:true` per-binding requirement (search results were inconsistent and occasionally contradictory across different doc pages). The installed source code is the only fully reliable source found this session; recommend the plan trust the source-verified mechanics above over any single doc page.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The verification-read step (checking D1/MEDIA counts before trusting the rest of the re-index) is a necessary addition, not already implied by D-01 | Architecture Patterns (D-01) | Without it, a script that silently ran against the local simulator would report "success" with zero real changes, and the plan might mark CONTENT-02 done incorrectly |
| A2 | `getPlatformProxy`'s `main` field resolution does not block a scratch-directory config copy | Architecture Patterns (D-01) | If it does block, the script needs the `main` field patched to an absolute path too — a one-line fix, low risk either way |
| A3 | Whether production `EMAIL_PROVIDER` is `cloudflare` or `resend` | Pitfall 3 | If Resend and its sandbox is domain-restricted in a way that excludes Russell's own account email, the delivery step could fail; low likelihood since D-05 deliberately used Russell's own address |
| A4 | Recommended Stripe Tax billing address (101 Townsend St, San Francisco, CA 94107, US) is a reasonable placeholder | Code Examples | Low risk — `prod_33` uses `txcd_00000000` (unconditionally nontaxable), so tax computation itself is unaffected by address accuracy; only address-format validation matters |
| A5 | A `--file` flag is safer than a long inline `--command` string for the Terms of Service `UPDATE` | Code Examples | If inline quoting works fine, this is moot; if it doesn't, discovering it live costs one failed attempt rather than a silent wrong write (the read-back in D-03 would catch it either way) |

**If this table is empty:** N/A — see rows above for the claims needing confirmation before being treated as locked.

## Open Questions

1. **RESOLVED** — **Will the planner/Russell accept Pitfall 2's structural finding, or does it change D-04/D-05/D-06's scope?**
   - What we know: a guest-purchased card's `purchaser_customer_id` is `NULL` and can never match any signed-in user's query, verified against the exact source of both the write and read paths.
   - What's unclear: whether this changes the phase's scope (e.g., adding a signed-in purchase step) or is accepted as a known, documented gap for `/gsd-verify-work 10`/11 to carry forward.
   - Recommendation: surface this explicitly in planning rather than silently absorbing it into D-06's existing "human check" framing, since it is a stronger and different claim (structurally impossible vs. merely unverifiable by this run).
   - **Resolution (planning, 2026-09-09):** accepted as a documented gap per D-06; scope unchanged, no signed-in purchase step added. Plan `12-05` Task 3 writes the gap into `12-PROOF-ORDER.md` with the `NULL` purchaser id as its evidence, states plainly that the Account → Gift Cards clause is not provable by any purchase whose recipient is not the buyer, and hands Russell one decision: change the product, or correct SHOP-07's wording. It is deliberately not recorded as a pending human check, because a person signing in would find nothing.

2. **RESOLVED** — **Exact production `EMAIL_PROVIDER` value.**
   - What we know: both a Cloudflare `EMAIL` binding and a `RESEND_API_KEY` secret exist in production; the code throws if both are present and `EMAIL_PROVIDER` is unset; `EMAIL_PROVIDER` is not in the committed `wrangler.jsonc`.
   - What's unclear: the actual dashboard-only Build variable value.
   - Recommendation: read it opportunistically from the live delivery's `provider` field or tail-worker output during the SHOP-07 proof; no separate investigation needed.
   - **Resolution (planning, 2026-09-09):** answered by measurement rather than investigation, as recommended. Plan `12-05` Task 2 assertion 5 joins `gift_card_deliveries.email_idempotency_key` to `email_deliveries.idempotency_key` and reads that row's `provider` and `status`. The `email_deliveries` table was confirmed to exist in production during planning with a `provider` column constrained to `cloudflare` or `resend`, so the join returns the provider actually used for this delivery. No dashboard access is needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `wrangler` CLI | D-01 script, D-02 D1 write, CONTENT-01 R2 upload | ✓ | 4.129.0 `[VERIFIED]` | — |
| Production D1 (`mercora-db`) | All read-backs and the Terms write | ✓ | — (read-only queries succeeded this session) | — |
| Production Vectorize (`voltique-index`) | CONTENT-02 | ✓ | 768-dim, cosine `[VERIFIED: wrangler vectorize list]` | — |
| Stripe test mode (`pk_test_`) | SHOP-07 | ✓ | — (present in `wrangler.jsonc`, not read this session per D-04's scope, only its presence confirmed by CONTEXT.md's canonical refs) | — |
| Live Clerk browser session | The "Account → Gift Cards" half of SHOP-07 | ✗ | — | None — structurally cannot be satisfied by this run's guest purchase either way (Pitfall 2); deferred to Russell |

**Missing dependencies with no fallback:** None blocking the automatable parts of this phase.

**Missing dependencies with fallback:** Live Clerk session — already deferred per D-06/CONTEXT.md; Pitfall 2 clarifies this is not purely a session-availability problem.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run`) |
| Config file | `vitest.config.ts` (default), separate configs for workers/observability suites — not touched by this phase |
| Quick run command | `mise exec -- npx vitest run tests/unit/data/knowledge-gift-cards.test.ts` |
| Full suite command | `mise exec -- npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONTENT-01 | Article promises match what ships (four amounts, no "1 hour", "no expiry", no cash) | unit (source-contract, reads the committed `.md` file directly) | `mise exec -- npx vitest run tests/unit/data/knowledge-gift-cards.test.ts` | ❌ Wave 0 — recommended new file, precedent: `tests/unit/data/seed-gift-card.test.ts` |
| CONTENT-02 | Vectorize re-index reaches production and Volt recommends the gift card | manual (read-only production probe, not a vitest test — no local Vectorize simulator to test against) | `curl -s -X POST https://voltique.russellkmoore.me/api/agent-chat -H 'content-type: application/json' -d '{"question":"what should I get as a gift?"}'` × 3 (D-10's exact three questions) | N/A — inherently a live-production check |
| CONTENT-03 | Terms page renders the new section | manual (read-only) | `curl -s https://voltique.russellkmoore.me/terms-of-service \| grep -c 'Gift Cards'` | N/A |
| SHOP-07 | Order finalizes, card issues, delivery reaches `sent` | manual (read-only D1 SELECTs, listed in Code Examples above) | see Code Examples §Read-only evidence queries | N/A — inherently a live-production check |

### Sampling Rate

- **Per task commit:** run the new knowledge-article test plus `npm run lint`/`typecheck` if any script under `scripts/` is committed.
- **Per wave merge:** full CI-mirroring gate suite (`npm audit`, `build:themes:check`, `scan:tokens`, `lint`, `typecheck`, `cf-typecheck`, `npm test`, `test:workers`, `test:observability-worker`, `build`) — same list Phase 11 already ran clean.
- **Phase gate:** full suite green plus the four read-only production checks above (D-06's D1 evidence, D-10's three chat calls, the Terms curl check, and the article test) before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/unit/data/knowledge-gift-cards.test.ts` — covers CONTENT-01, mirrors `tests/unit/data/seed-gift-card.test.ts`'s pattern (read the real file, assert on its content, no mocking).
- [ ] No shared fixtures needed — this phase's tests are pure file-content assertions, same as the existing precedent.
- [ ] No framework install needed — Vitest is already fully configured.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Partially | The re-index script authenticates via Russell's own `wrangler`/Cloudflare OAuth session (already logged in), not a new credential; the admin HTTP route's `ADMIN_VECTORIZE_TOKEN` is deliberately bypassed per D-01, not weakened — the token itself is untouched |
| V3 Session Management | No | No new sessions introduced |
| V4 Access Control | Yes | The D1 `UPDATE` for Terms of Service is a direct database write bypassing the admin route's `checkAdminPermissions` check — this is an accepted, explicit, one-time exception per D-02/D-03, not a pattern to repeat; the plan should scope the write tightly (exact `WHERE slug = 'terms-of-service'`) to avoid an accidental broad update |
| V5 Input Validation | Yes | The checkout proof exercises the existing, already-validated `/api/payment-intent`/`/api/orders` endpoints unchanged — no new input surface is introduced by this phase |
| V6 Cryptography | Yes (read-only concern) | The gift-card bearer code and its HMAC/encryption keys must never be read, echoed, or logged (D-07) — verified the evidence queries above select only `id`, `status`, amounts, and timestamps, never `code_hash` or delivery ciphertext columns |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| A malformed/overly broad `UPDATE` statement on the `pages` table | Tampering | Scope every write with an exact `WHERE slug = 'terms-of-service' AND status = 'published'` predicate; read-back before and after (D-03) |
| A re-index script accidentally targeting a different Vectorize index or D1 database if the scratch config patch is malformed | Tampering | Verify the scratch config's `database_id`/`index_name`/`bucket_name` are byte-identical to the real `wrangler.jsonc` before running; the recommended verification-read step (A1) doubles as this check |
| Bearer code or key-ring material appearing in a log, commit, or SUMMARY | Information Disclosure | Same discipline already proven in Phase 11 (secret-name-only `wrangler secret list` checks, no value ever printed); this phase's evidence queries never select code/ciphertext columns |
| A re-run of the purchase script creating duplicate orders/charges | Tampering / Repudiation | D-06 already specifies "run exactly once"; `newOrderId()` includes `Date.now()` and a random suffix so accidental re-runs create new orders rather than colliding, but each one would be a real Stripe test-mode charge — treat the script as non-idempotent by design and gate it behind a single confirmed execution |

## Sources

### Primary (HIGH confidence)

- `node_modules/wrangler/wrangler-dist/cli.js` (installed wrangler 4.129.0, read directly this session) — `getPlatformProxy`, `BINDING_LOCAL_SUPPORT`, `r2BucketEntry`/`d1DatabaseEntry`/vectorize/AI binding-builder logic
- `wrangler d1 execute mercora-db --remote --json` (read-only SELECTs against production, run this session) — `pages` row, `products`/`product_variants` rows for `prod_33`
- `wrangler vectorize list` / `wrangler vectorize get voltique-index` (run this session) — index name, dimensions, metric
- `wrangler secret list` (run this session, names only) — confirms `RESEND_API_KEY` exists in production alongside the `EMAIL` binding
- `app/api/admin/vectorize/route.ts`, `app/api/agent-chat/route.ts`, `lib/ai/config.ts`, `lib/gift-cards/*.ts`, `lib/db/schema/*.ts`, `app/api/payment-intent/route.ts`, `app/api/orders/route.ts`, `lib/services/order-finalization.ts`, `lib/services/checkout-pricing.ts`, `app/api/gift-cards/route.ts`, `app/[slug]/page.tsx`, `app/[slug]/PageRenderer.tsx`, `lib/utils/sanitize-html-policy.ts` — all read directly this session

### Secondary (MEDIUM confidence)

- Stripe API docs, `POST /v1/payment_intents/{id}/confirm` — fetched this session (`docs.stripe.com`)
- Cloudflare `getPlatformProxy`/remote-bindings public docs — fetched this session, but found internally inconsistent across pages regarding Vectorize; superseded by the source read above

### Tertiary (LOW confidence)

- General web search results on `getPlatformProxy` remote bindings behavior — used only to form initial hypotheses, all superseded by the direct source read

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all versions/models read from source
- Architecture (remote-binding mechanics): HIGH — verified against the exact installed wrangler source this session
- Architecture (account-listing structural gap): HIGH — verified against exact source of both write and read paths
- Pitfalls: HIGH for Pitfalls 1, 2, 4, 5; MEDIUM for Pitfall 3 (email provider could not be directly confirmed)
- Content wording (D-08/D-09 exact prose): the recommended text is Claude's discretion per CONTEXT.md, not independently verifiable — treat as a draft for the planner/executor to finalize

**Research date:** 2026-09-09
**Valid until:** 7 days (fast-moving: production D1/Vectorize state and the live email provider could change before execution; the wrangler source-code findings are stable for the pinned 4.129.0 version but should be re-checked if `package.json` bumps `wrangler` before this phase executes)

## RESEARCH COMPLETE
