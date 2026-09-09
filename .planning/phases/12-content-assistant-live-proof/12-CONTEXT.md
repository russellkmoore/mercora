# Phase 12: Content, Assistant & Live Proof - Context

**Gathered:** 2026-09-09
**Status:** Ready for planning
**Mode:** Smart discuss, autonomous run with Russell away — every answer below is the recommended option, selected by Claude and logged as an unattended decision for Russell's review

<domain>
## Phase Boundary

The gift-card support article in `data/r2/knowledge_md/gift-cards.md` describes what actually ships and is uploaded to the public bucket; Volt is re-indexed so it recommends the gift card for gift/present/voucher questions; the Terms of Service CMS page gains a gift-card section; and one real gift-card-only order paid in Stripe test mode on production proves issuance, delivery email, and the recipient's Account → Gift Cards listing (CONTENT-01..03, SHOP-07). This closes milestone v2.1.

Not in this phase: any code change under `lib/**` or `app/**` (the storefront and APIs are done); Phase 10's deferred human verification (`/gsd-verify-work 10`, still Russell's); scheduled delivery (SHOP-08), custom amounts (SHOP-09), a Gift Cards category (CAT-05).

</domain>

<decisions>
## Implementation Decisions

### Admin-gated actions without a session (re-index, page publish)
- **D-01:** The Volt re-index runs as a local Node script using wrangler's `getPlatformProxy({ remoteBindings: true })` (AI, VECTORIZE, DB, MEDIA against production, under Russell's OAuth login — the Phase 9 image-generation precedent) that reproduces the logic of `app/api/admin/vectorize/route.ts` (products from D1 + `knowledge_md/*.md` from R2 → embeddings → Vectorize upsert). The admin HTTP route is not called because it requires `ADMIN_VECTORIZE_TOKEN` (a secret Claude never reads) or a Clerk admin session, and rotating the token would break Russell's own copy. The script lives under `scripts/` only if the plan judges it reusable; otherwise it stays in the session scratch directory and the SUMMARY records its shape. — **Unattended decision** (alternatives: rotate the admin token via a non-echoing pipeline and call the route; wait for Russell).
- **D-02:** The Terms of Service gift-card section is written to the same CMS row Admin → Pages edits (`pages` where `slug = 'terms-of-service'`) with a single read-only-verified `UPDATE` via `wrangler d1 execute mercora-db --remote` that appends a new `<h2>6. Gift Cards</h2>` block before the closing "For questions…" paragraph, bumps `version`, `updated_at`, and `published_at` if the row's status requires, and leaves `status = 'published'`. CONTENT-03's "published through Admin → Pages" is satisfied in effect (the page is served from that row and remains editable in admin); the SUMMARY states plainly that the admin UI itself was not driven. — **Unattended decision** (alternative: wait for Russell to paste the section in admin).
- **D-03:** Neither action rewrites anything else: the article file is the only R2 object put (`knowledge_md/gift-cards.md`), the Terms row is the only D1 write, and the Vectorize upsert is the only index write. Each is preceded by a read-back of the current state and followed by a read-back proof.

### Live paid-order proof (SHOP-07)
- **D-04:** The proof is a scripted guest checkout against production in Stripe test mode: `POST /api/payment-intent` with one `prod_33` / `variant_33` ($25) line carrying a recipient customization, a full billing address (the server requires line1/city/region/postal_code/country — Phase 10 D-01) and `shippingMethodId: "digital"`; the returned PaymentIntent is confirmed through Stripe's API using only the public `pk_test_` publishable key from `wrangler.jsonc` and Stripe's test payment method `pm_card_visa` (the same calls Stripe.js makes in the browser; no Stripe secret is involved); then `POST /api/orders` with `paymentIntentId` and `orderId` finalises the order. — **Unattended decision** (alternative: Russell buys one in a browser).
- **D-05:** The recipient is Russell's own address, `russellkmoore@mac.com`, so the delivery email lands where he can see it and the card appears under his Account → Gift Cards when he next signs in; recipient name "Russell", message "Phase 12 live proof — Voltique gift card", no delivery date. The purchaser is a guest (no Clerk session). — **Unattended decision**; Russell's email is used only inside his own store's checkout.
- **D-06:** Evidence is gathered read-only from production D1 and the tail worker: the order row (`orders`), the `gift_card_accounts` row for that order line (issued amount 2500 USD, status active), the `gift_card_deliveries` row reaching `status = 'sent'` within two five-minute cron cycles, and no `cron.recovery_failed`. The "appears under Account → Gift Cards" half of SHOP-07 is recorded as a human check for Russell (it needs his Clerk session) and is treated as covered by the D1 delivery row plus the account page's owner-scoped query. If the test payment fails (Stripe test mode misconfiguration, webhook secret mismatch), the executor stops with the evidence rather than retrying blindly.
- **D-07:** The bearer code is never read, printed, or stored by the run; the proof reads only non-secret columns (ids, status, amounts, timestamps, recipient email).

### Content
- **D-08:** `data/r2/knowledge_md/gift-cards.md` is rewritten to match what ships: four amounts ($25/$50/$100/$200), delivered by email as soon as payment completes (replacing "within 1 hour"), never expires, not redeemable for cash or transferable for resale, redeemed by entering the code in the "Gift card" field on the checkout shipping/billing step, balance visible under Account → Gift Cards (signed-in) or by entering the code at checkout; keep the front-matter shape (`id`, `title`, `category`, `tags`, AI NOTES line) the indexer expects; tags gain `gift`, `present`, `voucher` so Volt matches those words.
- **D-09:** The Terms section text: email delivery after payment; no expiry; no cash redemption; not transferable for resale; stored value usable across orders; contact link for issues — plain prose in the page's existing `<h2>/<p>` style, dated "Gift card terms version 2026-09-09".
- **D-10:** Volt proof: three unauthenticated `POST /api/agent-chat` calls ("what should I get as a gift?", "do you sell presents?", "do you have vouchers?") after the re-index; each reply must mention the gift card (case-insensitive "gift card"). Recorded with the response excerpts.

### Carried forward
- Phase 9 D-08 name "Voltique Gift Card"; Phase 10 D-01 billing-details contract; Phase 11 D-07/D-08 (acquisition live; Phase 10 UAT deferred — `/gsd-verify-work 10` remains Russell's).
- No secret value, bearer code, or account id in any artifact; docs:lint stays green if any doc changes (none planned).

### Claude's Discretion
- Script file locations (scratch vs `scripts/`), embedding model/params copied exactly from the route, batch sizes, and whether products are re-embedded or only the knowledge article plus `prod_33` (recommend: full re-index exactly as the route does, so the index matches admin behaviour).
- Exact article and Terms wording within D-08/D-09.
- Whether to add a `tests/unit/data/knowledge-gift-cards.test.ts` source-contract test pinning the article's promises (recommend yes: no "1 hour", mentions four amounts, "no expiry", "cash").
- How long to wait for the delivery row (two cron cycles max) and which tail-worker capture method to reuse from 11-04.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Assistant and content
- `app/api/admin/vectorize/route.ts` — the exact indexing logic (product markdown generation, `knowledge_md/` listing from `MEDIA`, embedding model, Vectorize upsert shape) the re-index script must reproduce.
- `lib/ai/config.ts` — model ids (embeddings `@cf/baai/bge-base-en-v1.5`, text `@cf/openai/gpt-oss-20b`).
- `app/api/agent-chat/route.ts` — Volt request/response shape (`question`, `userName`, `history`), public POST.
- `data/r2/knowledge_md/gift-cards.md` — current article (front matter + AI NOTES shape); memory `catalogue-images-via-workers-ai` — `getPlatformProxy` + `remoteBindings: true` precedent and `wrangler r2 object put … --remote` upload.
- `app/api/admin/pages/[id]/route.ts` and `lib/db/schema/` `pages` table columns (`content`, `status`, `version`, `updated_at`, `published_at`) — what Admin → Pages would write, to mirror in the D1 `UPDATE`.

### Checkout and gift-card proof (read-only)
- `app/api/payment-intent/route.ts` (`PaymentIntentRequest`, `normalizeAddress`, `newOrderId`), `lib/services/checkout-pricing.ts` (`CheckoutLineInput`, digital method), `app/api/orders/route.ts` (POST body: `paymentIntentId`, `orderId`), `lib/checkout/order-payload.ts`, `lib/gift-cards/customization.ts` (recipient shape), `lib/gift-cards/checkout.ts`.
- `lib/services/gift-card-fulfillment.ts`, `lib/gift-cards/repository.ts`, `lib/db/schema/gift-cards.ts` — issuance and delivery rows (`gift_card_accounts`, `gift_card_deliveries`), status values.
- `docs/checkout-trust-boundary.md` (ADR-CTB, ADR-CTB-10), `docs/webhooks-refunds-inventory.md` — finalisation is idempotent across POST /api/orders and the Stripe webhook; either path issues the card.
- `wrangler.jsonc` `vars` — `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (public `pk_test_`).
- Stripe: confirming a PaymentIntent with a publishable key and `client_secret` (`POST https://api.stripe.com/v1/payment_intents/{id}/confirm` with `payment_method=pm_card_visa`) — research verifies via Context7/Stripe docs.

### Milestone framing
- `.planning/REQUIREMENTS.md` (CONTENT-01..03, SHOP-07); `.planning/ROADMAP.md` §"Phase 12".
- `.planning/phases/11-production-enablement/11-04-SUMMARY.md`, `11-05-SUMMARY.md` — cron watch method, deployment ids; `.planning/phases/10-gift-card-purchase-flow/10-UAT.md` — the still-deferred human checks.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The vectorize route already contains the whole indexing algorithm; a script reproduces it with remote bindings.
- Phase 9's image script pattern (`getPlatformProxy` from `node_modules/wrangler/wrangler-dist/cli.js`, `remoteBindings: true`) and `wrangler r2 object put … --remote` are proven under Russell's login.
- Phase 11's tail-worker capture and `wrangler d1 execute --remote --json` read-backs are proven.
- Checkout for an all-digital guest cart is fully server-driven: no Clerk session needed for `POST /api/payment-intent` and `POST /api/orders`.

### Established Patterns
- Production actions run via `mise exec -- npx wrangler …`; secrets never read; proofs are read-only SELECTs and names.
- Content files are committed under `data/r2/` and uploaded by hand to the public bucket.
- Tests are vitest source-contract tests under `tests/unit/`.

### Integration Points
- `knowledge_md/gift-cards.md` (R2) → vectorize script → `voltique-index` → `POST /api/agent-chat`.
- `pages` row `terms-of-service` (D1) → `/terms-of-service` page.
- `POST /api/payment-intent` → Stripe confirm (public key) → `POST /api/orders` → `finalizeOrderPayment` → `order_effects` → cron → `gift_card_accounts`/`gift_card_deliveries` → delivery email (Resend/EMAIL binding) → Account → Gift Cards.

</code_context>

<specifics>
## Specific Ideas

- Russell is away; he asked for best-assumption decisions on the demo site and a list at the end. D-01, D-02, D-04, D-05 are the ones he did not choose himself.
- Nothing in this phase may weaken Phase 11's secret hygiene: the bearer code of the issued card and every key value stay out of all outputs.
- The article must not promise anything the storefront does not do (no scheduled delivery, no custom amounts).

</specifics>

<deferred>
## Deferred Ideas

- A reusable, documented `scripts/vectorize-reindex.mjs` (remote-binding re-index without the admin token) — worth keeping if the Phase 12 script proves clean; docs would then mention it beside the admin route.
- Driving Admin → Pages through a real Clerk session (Russell's UAT list).
- `/gsd-verify-work 10` and the Phase 11 signed-in `GET /api/gift-cards` check — Russell's next session.

</deferred>

---

*Phase: 12-content-assistant-live-proof*
*Context gathered: 2026-09-09*
