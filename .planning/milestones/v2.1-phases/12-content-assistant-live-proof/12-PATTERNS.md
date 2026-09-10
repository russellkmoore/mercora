# Phase 12: Content, Assistant & Live Proof - Pattern Map

**Mapped:** 2026-09-09
**Files analyzed:** 8 (2 committed source files, 1 test file, 5 scripted/operational artifacts with no committed analog)
**Analogs found:** 8 / 8 (all found; several are prose/summary analogs rather than code files, since most of this phase's "files" are ops scripts and CLI transcripts, not application code)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `data/r2/knowledge_md/gift-cards.md` | content/config | file-I/O | `data/r2/knowledge_md/gift-cards.md` (self, rewrite) + `returns.md`/`faq.md` (shape) | exact |
| scratch re-index script (`getPlatformProxy` + vectorize algorithm) | utility/script | batch/event-driven | `app/api/admin/vectorize/route.ts` (algorithm) + Phase 9's `/tmp/gsd-09-generate-image.mjs` shape (per `09-03-SUMMARY.md`) | role-match |
| scratch `wrangler.jsonc` copy | config | file-I/O | committed `wrangler.jsonc` (`DB`/`MEDIA`/`VECTORIZE`/`AI` binding blocks) | exact (source of truth to patch) |
| Terms of Service `UPDATE` | migration-like/CLI write | CRUD | `app/api/admin/pages/[id]/route.ts` PUT (columns) + `09-04-SUMMARY.md` (sed-slice/remote-apply pattern) | role-match |
| scripted purchase (payment-intent → Stripe confirm → orders) | service/script | request-response | `components/checkout/CheckoutClient.tsx` (`createPaymentIntent`, `handlePaymentSuccess`) | exact (request/response shape) |
| D1 evidence SELECTs | test/verification | CRUD (read) | `09-04-SUMMARY.md` read-back queries + RESEARCH.md's own verified SELECTs | exact |
| tail-worker capture | test/verification | streaming | `.planning/phases/11-production-enablement/11-04-SUMMARY.md` (Task 3 `wrangler tail` capture) | exact |
| `tests/unit/data/knowledge-gift-cards.test.ts` | test | transform (source-contract) | `tests/unit/data/seed-gift-card.test.ts` | exact |
| Volt proof calls | test/verification | request-response | `app/api/agent-chat/route.ts` (request/response contract) | exact |

## Pattern Assignments

### `data/r2/knowledge_md/gift-cards.md` (content, file-I/O)

**Analog:** the file itself (current version) plus sibling articles `returns.md`, `faq.md` for shape.

**Current file in full** (must be rewritten, not replaced structurally):
```markdown
---
id: faq-giftcards
title: Gift Cards
category: sales
tags: [gift cards, faq]
---

**AI NOTES:** Explain how digital gift cards work, delivery methods, and limitations.

## Buying a Gift Card

Gift cards are available in $25, $50, $100, and $200 denominations.

## Delivery

All gift cards are delivered via email within 1 hour of purchase.

## Usage

Gift cards never expire and can be used across multiple orders. They cannot be redeemed for cash.
```

**Front-matter shape to keep** (from `faq.md`/`returns.md`): `id`, `title`, `category`, `tags: [...]` array, blank line, `**AI NOTES:** ...` sentence, then `##` sections. Per RESEARCH Pitfall 4, the indexer embeds the *entire raw file text* — front matter included — with no YAML parsing, so `tags` must literally contain the words `gift`, `present`, `voucher` (D-08) to influence embedding similarity; keep them in the tags array AND ideally reflected in prose/AI NOTES, not just as inert metadata.

**Concrete fixes required by D-08:**
- Replace "delivered via email within 1 hour of purchase" → "delivered by email as soon as payment completes" (test must assert no `"1 hour"` string remains).
- Add "never expires" (already present as "never expire" — keep), "not redeemable for cash" (present), add "not transferable for resale" (new).
- Add redemption instructions: entering the code in the "Gift card" field at checkout (matches `CheckoutClient.tsx`'s `giftCardToken` field, see below).
- Add balance visibility: Account → Gift Cards (signed-in) or by entering the code at checkout.
- `tags: [gift cards, faq]` → add `gift`, `present`, `voucher`.

---

### Scratch re-index script (utility, batch)

**Analog 1 — the algorithm to reproduce:** `app/api/admin/vectorize/route.ts`

Imports/binding-access pattern (lines ~30-58):
```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDbAsync } from "@/lib/db";
import { products, deserializeProduct, product_variants } from "@/lib/db/schema/products";
import { eq } from "drizzle-orm";

const { env } = await getCloudflareContext({ async: true });
const media = (env as any).MEDIA;
const vectorize = (env as any).VECTORIZE;
const ai = (env as any).AI;
```
In the script, replace `getCloudflareContext` with `getPlatformProxy` per RESEARCH's D-01 code example — same `env.DB`/`env.MEDIA`/`env.VECTORIZE`/`env.AI` shape, just sourced from the scratch config.

Knowledge-indexing step to reproduce verbatim (RESEARCH.md §Code Examples, verified against the route this session):
```typescript
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
Product step additionally clears the index first (`vectorize.query` dummy 768-dim vector, `topK: 10000`, then `vectorize.deleteByIds` in batches of 1000), builds product markdown, uploads to `products_md/{slug}.md`, embeds, upserts `{ id: product.id, values, metadata: { slug, source: "product", text, productId } }`. Per RESEARCH Pitfall 5, do NOT invent a `type` metadata field — only `{ slug, source, text, productId? }` is ever read (by `app/api/agent-chat/route.ts:607,617`, which reads only `metadata.text` and `metadata.productId`).

**Analog 2 — the getPlatformProxy/remote-binding script shape:** Phase 9's throwaway image generator, recorded in `09-03-SUMMARY.md` (script itself not committed, per that phase's D-07):
```
Wrote a throwaway generator at /tmp/gsd-09-generate-image.mjs (not committed, per D-07)
using getPlatformProxy against wrangler.jsonc with remoteBindings: true, calling
env.AI.run('@cf/leonardo/lucid-origin', ...)
```
Same pattern for Phase 12, but this script additionally needs the scratch `wrangler.jsonc` copy (Phase 9's script only touched `AI`, which needs no `remote: true` flag; Phase 12 needs `DB`+`MEDIA`+`VECTORIZE` too — see next section). Decide file location (scratch dir vs `scripts/`) per D-01's discretion clause; if kept, name it `scripts/vectorize-reindex.mjs` per RESEARCH's recommended structure.

**Verification step to include (RESEARCH A1, strongly recommended):** before trusting any real work, run one cheap read against each of the three previously-local bindings, e.g.:
```javascript
await env.DB.prepare('SELECT COUNT(*) FROM products').first(); // expect 33, not 0
await env.MEDIA.list({ prefix: 'knowledge_md/' }); // expect ~8 objects, not 0
```

---

### Scratch `wrangler.jsonc` copy (config, file-I/O)

**Analog:** the committed `wrangler.jsonc` binding blocks (never edited directly):
```jsonc
// d1_databases[]
{
  "binding": "DB",
  "database_name": "mercora-db",
  "database_id": "a27c0044-672d-4355-aa47-4410746f45f9"
}
// r2_buckets[]
{
  "binding": "MEDIA",
  "bucket_name": "voltique-images"
},
{
  "binding": "NEXT_INC_CACHE_R2_BUCKET",
  "bucket_name": "voltique-images"
}
// vectorize[]
{
  "binding": "VECTORIZE",
  "index_name": "voltique-index"
}
// ai
{
  "binding": "AI"
}
```
Note `NEXT_INC_CACHE_R2_BUCKET` shares the same `bucket_name` as `MEDIA` but is a *different* binding entry — the script must add `"remote": true` only to the `MEDIA` entry it actually uses, not blindly to every `r2_buckets` entry. `AI` needs no `"remote": true` (unconditionally remote in `getPlatformProxy`, per RESEARCH Pitfall 1's source read). Follow RESEARCH's exact scratch-copy recipe: read the real file at execution time (don't hand-copy stale text), regex/string-patch in `"remote": true` on exactly the `DB`, `MEDIA`, `VECTORIZE` entries, write to a `mkdtempSync` scratch directory, pass `configPath` to `getPlatformProxy`. Never write back to the repo's `wrangler.jsonc`.

---

### Terms of Service `UPDATE` (D1 write, CRUD)

**Analog 1 — what Admin → Pages would write:** `app/api/admin/pages/[id]/route.ts` PUT handler — columns it manages are `content`, `status`, `version`, `updated_at`, `published_at` (per CONTEXT.md's canonical refs and this route's field names, confirmed present in the route's request-validation branches at the 400/404/403 status-check lines this session).

**Analog 2 — the sanctioned single-block production-write pattern:** `09-04-SUMMARY.md`'s "sentinel-slice / `wrangler d1 execute --remote --file`" pattern:
```
patterns-established:
  - "A single-block, sentinel-delimited catalogue addition applies to production
     via sed extraction + wrangler d1 execute --remote --file, never a whole-file
     remote apply"
```
For Phase 12 there's no sentinel block to slice (this is a raw `UPDATE`, not a seed-file INSERT), but the same discipline applies: read-back BEFORE, apply via `--file` (not a risky inline `--command` for a long string, per RESEARCH A5), read-back AFTER, confirm exactly one row changed and `version` incremented by exactly 1.

**Exact statement (RESEARCH.md §Code Examples, verified against live production this session):**
```sql
UPDATE pages
SET content = '<h1>Terms of Service</h1>...<h2>6. Gift Cards</h2>
<p>Gift cards are delivered to the recipient by email as soon as payment completes. They
never expire, cannot be redeemed for cash, and cannot be transferred or resold. Stored value
can be used across multiple orders. If you have a question about a gift card, please contact
us. Gift card terms version 2026-09-09.</p>
<p>For questions about these terms, please contact us.</p>',
    version = version + 1,
    updated_at = CAST(strftime(''%s'',''now'') AS INTEGER)
WHERE slug = 'terms-of-service' AND status = 'published';
```
`published_at` is deliberately left untouched (`isPagePublished()` treats `NULL` as always-published). Both `h2` and `p` are in `SAFE_HTML_TAGS` (`lib/utils/sanitize-html-policy.ts`), so nothing is stripped at render time by `PageRenderer.tsx`'s `sanitizePageHtmlServer` call — that sanitizer runs on every render, so no write-time sanitization step needs to be replicated by this raw SQL write.

---

### Scripted purchase (service/script, request-response)

**Analog:** `components/checkout/CheckoutClient.tsx`, functions `createPaymentIntent` (lines ~231-278) and `handlePaymentSuccess` (lines ~283-315).

**Payment-intent request body pattern:**
```typescript
const res = await fetch('/api/payment-intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: items.map(projectCartLineForCheckout),
    shippingAddress: addressOverride ?? shippingAddress,
    shippingMethodId: selectedShippingOption.id,
    discountCodes: appliedDiscounts.map((discount) => discount.code),
    ...(giftCardToken.trim() ? {
      giftCardToken: giftCardToken.trim(),
      giftCardRequestKey: giftCardRequestKey.current ??= crypto.randomUUID(),
    } : {}),
  }),
});
```
For the script, the shape is per RESEARCH's exact request (D-04/D-05), a single `prod_33`/`variant_33` line with `giftCardCustomization` (not `giftCardToken` — that field is for *redeeming* a code at checkout, unrelated to this purchase, which is *buying* a gift card):
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
```
Omit `deliveryDate` entirely — an empty string is rejected by `lib/gift-cards/customization.ts`'s field parser (per RESEARCH, verified).

**Response handling pattern (same file):**
```typescript
const data = await res.json() as {
  noCash?: boolean;
  clientSecret: string;
  paymentIntentId: string;
  orderId: string;
  quote: AuthoritativeCheckoutQuote;
};
```

**Finalization request pattern:**
```typescript
const res = await fetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orderId, paymentIntentId }),
});
```

**Stripe confirm step (not in this codebase — external call the script must add):**
```
POST https://api.stripe.com/v1/payment_intents/{paymentIntentId}/confirm
Authorization: Bearer pk_test_...
payment_method=pm_card_visa
return_url=https://voltique.russellkmoore.me/checkout
```

**`lib/checkout/order-payload.ts`** is a *browser-only* localStorage helper (`savePendingCheckout`/`loadPendingCheckout`/`clearPendingCheckout`, guarded by `typeof window === 'undefined'`) — not applicable to a Node script; the script does not need pending-checkout recovery since it runs the full flow synchronously in one process. Noted for completeness only.

---

### D1 evidence SELECTs (test/verification, CRUD read)

**Analog:** `09-04-SUMMARY.md`'s production read-back pattern:
```
SELECT id, type, fulfillment_type, tax_category, status FROM products WHERE id='prod_33';
-> {"id":"prod_33","type":"gift_card","fulfillment_type":"digital","tax_category":"txcd_00000000","status":"active"}
```

**Exact queries for this phase (RESEARCH.md §Code Examples, all confirmed runnable this session):**
```bash
wrangler d1 execute mercora-db --remote --json --command \
  "SELECT id, status, payment_status, total_amount, currency_code FROM orders WHERE id='<orderId>';"

wrangler d1 execute mercora-db --remote --json --command \
  "SELECT id, status, currency_code, issued_amount_minor, issued_order_id, purchaser_customer_id, created_at
   FROM gift_card_accounts WHERE issued_order_id='<orderId>';"

wrangler d1 execute mercora-db --remote --json --command \
  "SELECT id, status, recipient_email, attempt_count, deliver_after, completed_at
   FROM gift_card_deliveries WHERE order_id='<orderId>';"
```
Never select `code_hash` or any delivery-ciphertext column (D-07). `purchaser_customer_id` will read back `NULL` for this guest purchase — expected, not a bug (structural gap, D-06).

---

### Tail-worker capture (test/verification, streaming)

**Analog:** `.planning/phases/11-production-enablement/11-04-SUMMARY.md`, Task 3:
```
Captured one full five-minute recovery-cron cycle via a temp-file `wrangler tail`
capture (deleted immediately after the assertion), confirmed the drain success log
line appeared and the critical `cron.recovery_failed` telemetry event did not
```
Reuse the same shape: redirect `wrangler tail --format json` to a temp file for the duration spanning the next 5-minute cron tick, grep for the delivery/success and failure sentinel lines, delete the capture file immediately after the assertion (no capture file persists past the check).

---

### `tests/unit/data/knowledge-gift-cards.test.ts` (test, source-contract)

**Analog:** `tests/unit/data/seed-gift-card.test.ts` (full pattern below, reused structurally):
```typescript
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const FILE = "data/r2/knowledge_md/gift-cards.md";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("gift-cards knowledge article: promises match what ships", () => {
  const content = readRepoFile(FILE);

  it("does not promise delivery within 1 hour", () => {
    expect(content).not.toMatch(/1 hour/i);
  });

  it("mentions all four denominations", () => {
    for (const amount of ["$25", "$50", "$100", "$200"]) {
      expect(content).toContain(amount);
    }
  });

  it("states no expiry and no cash redemption", () => {
    expect(content.toLowerCase()).toContain("never expire");
    expect(content.toLowerCase()).toContain("cash");
  });

  it("tags include gift/present/voucher for retrieval matching", () => {
    expect(content).toMatch(/tags:.*\bgift\b/i);
    expect(content).toMatch(/tags:.*\bpresent\b/i);
    expect(content).toMatch(/tags:.*\bvoucher\b/i);
  });
});
```
No mocking, no fixtures — pure file-content assertions against the real committed file, matching `seed-gift-card.test.ts`'s "read the real file, assert on its content" style exactly (including its comment-driven-regex style for count assertions, not directly needed here but the surrounding helper-function shape — `readRepoFile`, `REPO_ROOT` — should be copied verbatim for consistency).

---

### Volt proof calls (test/verification, request-response)

**Analog:** `app/api/agent-chat/route.ts` request/response contract (doc comment, lines ~14-30):
```
=== Request Body ===
{
  "question": "Which product would you recommend?",
  "userName": "John", // Optional, defaults to "Guest"
  "history": [...] // Optional conversation history
}

=== Response Format ===
{
  "answer": "AI response text",
  "productIds": [1, 2, 3],
  "products": [...],
  "history": [...],
  "userId": "clerk_user_id"
}
```
Public POST, no auth required. Proof calls (D-10) hit this exactly:
```bash
curl -s -X POST https://voltique.russellkmoore.me/api/agent-chat \
  -H 'content-type: application/json' \
  -d '{"question":"what should I get as a gift?"}'
```
Assert `answer` (case-insensitive) contains `"gift card"` for each of the three questions in D-10.

## Shared Patterns

### Remote-binding scratch config (D-01 mechanics)
**Source:** RESEARCH.md §Architecture Patterns, verified against `node_modules/wrangler/wrangler-dist/cli.js` 4.129.0 source this session.
**Apply to:** the re-index script only.
```
D1, R2 default to a local Miniflare simulator; Vectorize has no local simulator at all.
Only "remote": true on the specific binding entry (plus remoteBindings: true and a live
proxy session) reaches production. AI is unconditionally remote — no flag needed.
```

### Production write discipline (read-back before/after)
**Source:** `09-04-SUMMARY.md` pattern, reapplied to the Terms `UPDATE`.
**Apply to:** Terms UPDATE, R2 article upload, Vectorize upsert (D-03: each preceded by a read-back of current state, followed by a read-back proof).

### Secret hygiene / no-bearer-code discipline
**Source:** `11-04-SUMMARY.md` (`wrangler secret list` names-only checks, git-history grep for key-shaped base64).
**Apply to:** all D1 evidence SELECTs (never `code_hash` or ciphertext columns) and any log/capture output (tail-worker capture, script stdout).

## No Analog Found

None — every file/artifact in this phase has a workable analog, either in application code or in a prior phase's SUMMARY documenting an equivalent operational script/pattern.

## Metadata

**Analog search scope:** `app/api/admin/vectorize/route.ts`, `app/api/agent-chat/route.ts`, `app/api/admin/pages/[id]/route.ts`, `components/checkout/CheckoutClient.tsx`, `lib/checkout/order-payload.ts`, `data/r2/knowledge_md/*.md`, `tests/unit/data/seed-gift-card.test.ts`, `wrangler.jsonc`, `.planning/phases/09-gift-card-catalogue/09-03-SUMMARY.md`, `09-04-SUMMARY.md`, `.planning/phases/11-production-enablement/11-04-SUMMARY.md`.
**Files scanned:** 12
**Pattern extraction date:** 2026-09-09

## PATTERN MAPPING COMPLETE
