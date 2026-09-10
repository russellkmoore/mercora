# Phase 11: Production Enablement - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run) — Russell accepted all recommended answers across three areas

<domain>
## Phase Boundary

Production gets the two gift-card key rings as Worker secrets and the two feature flags as `wrangler.jsonc` `vars`, rolled out in the order `docs/runtime-configuration.md` requires (reconciliation first, verified, then acquisition), with the delivery ring documented, an enablement recipe in the deploy runbook, and `.env.example` showing all four secret shapes (OPS-01..OPS-04). Local development gets its own (non-production) key values.

Not in this phase: any code change under `lib/gift-cards/`, `lib/services/`, `app/api/`; the knowledge article, Volt re-index, Terms section and the live paid-order proof SHOP-07 (Phase 12); Phase 10's deferred human verification (`/gsd-verify-work 10`), which is a gate inside this phase's rollout, not its work.

</domain>

<decisions>
## Implementation Decisions

### Secrets (OPS-01)
- **D-01:** The executor generates and stores each of the four production secrets with a single shell pipeline under Russell's existing wrangler OAuth login — `openssl rand -base64 32` (or the JSON-wrapped equivalent for the `*_KEYS_JSON` rings) piped straight into `mise exec -- npx wrangler secret put <NAME>` — so no value is ever printed, logged, or written to a file outside Cloudflare's secret store. Proof is `mise exec -- npx wrangler secret list` showing the four names. Phase 1's `ADMIN_VECTORIZE_TOKEN` rotation is the precedent. — **Reversibility:** reversible — `wrangler secret delete` or a fresh `put` replaces a ring; nothing durable references a key until a card is issued under it, after which rotation (not deletion) is the path.
- **D-02:** Local development gets its own separately generated key values (never the production ones), appended by pipeline to a new untracked `.dev.vars` — research confirmed `next.config.ts` calls `initOpenNextCloudflareForDev()`, so `getCloudflareContext().env` (which is how all four gift-card variables are read) is backed by `.dev.vars` even under plain `npm run dev`. `.env.local` is not touched and is never read by the executor. `.gitignore` coverage of `.dev.vars` is verified before the append; the executor never echoes the values.
- **D-03:** Each ring ships with exactly one version: `GIFT_CARD_CODE_HMAC_CURRENT_VERSION=1` with `GIFT_CARD_CODE_HMAC_KEYS_JSON={"1":"<32-byte base64>"}`, and `GIFT_CARD_DELIVERY_CURRENT_VERSION=1` with `GIFT_CARD_DELIVERY_KEYS_JSON={"1":"<AES key, GIFT_CARD_DELIVERY_KEY_BYTES from lib/gift-cards/encryption.ts, base64>"}`. The parsers in `lib/gift-cards/config.ts` (`parseGiftCardCodeKeyRing`, `parseGiftCardDeliveryKeyRing`) are the acceptance test for the shape: research confirms the exact encoding each expects before any `secret put`.
- **D-04:** Secrets land before either flag flips; the rings are inert until a flag reads them.

### Rollout mechanics (OPS-02)
- **D-05:** Flag changes deploy the normal way: a commit to `wrangler.jsonc` `vars` pushed to `main`, which Cloudflare Workers Builds deploys with `deploy:ci`. Two commits, two pushes: `STORE_FEATURE_GIFT_CARD_RECONCILIATION: "true"` first, `STORE_FEATURE_GIFT_CARD_ACQUISITION: "true"` second. Before each push `mise exec -- npm run cf-typegen` regenerates `cloudflare-env.d.ts` and `mise exec -- npm run cf-typecheck` passes (regenerate without env files present, per the recorded CI convention). `npm run deploy` from a developer machine is not used.
- **D-06:** "Reconciliation verified" before the second flag means three read-only checks: the new version appears in `mise exec -- npx wrangler deployments list`; a production read-only request that exercises the reconciliation capability returns the expected shape (the planner picks the endpoint from `app/api/gift-cards/*` after research confirms which path reads the flag without side effects); and the `commerce-observability-tail` Worker records no `gift_card.*` error-severity event within one five-minute cron cycle after the deploy.
- **D-07:** The acquisition push is preceded by a `checkpoint:decision` with `gate="blocking-human"`: Russell either confirms `/gsd-verify-work 10` has passed or explicitly accepts enabling acquisition with Phase 10's human verification still deferred. Enabling acquisition makes gift cards purchasable on the live site, so this is the one gate that must stop an unattended run. — **Reversibility:** reversible by flag (set the var back to `"false"` and push), never by schema.
- **D-08:** The executor pushes the reconciliation commit itself (the flag only turns on the delivery drain and tender paths, which have nothing to act on until a card exists) and pauses at D-07 before the acquisition push. Pushing to `main` is the deploy action for this project; each push is one commit that changes only `wrangler.jsonc` and `cloudflare-env.d.ts`. Russell confirmed on 2026-09-08 ("Push as planned") that the first push may carry every unpushed commit on `main` — at planning time `main` was 85 commits ahead of `origin/main`, including all of Phase 10's checkout changes whose human verification is deferred — so the reconciliation push is also the first production deploy of Phase 10. The plan states this plainly in the push task and in the D-07 checkpoint copy.

### Docs and developer example (OPS-03, OPS-04)
- **D-09:** `docs/DEPLOYMENT_SETUP.md` gains a new `## 9. Gift Card Enablement` section after "Going Live": generate keys → put the four secrets → enable reconciliation → verify (the D-06 checks) → enable acquisition, each step with the exact command, linking `docs/runtime-configuration.md` for the variable contract and naming no value, account id, or database id.
- **D-10:** `docs/runtime-configuration.md` gains a table row for the delivery ring next to the HMAC-ring row and a paragraph mirroring the HMAC-ring text: JSON object keyed by canonical positive-integer versions, current version required, ring bounded to the module's maximum, base64 AES key bytes, server-only, never `NEXT_PUBLIC_*`, never in `wrangler.jsonc`.
- **D-11:** `.env.example` keeps its commented-placeholder style: two new lines for `GIFT_CARD_DELIVERY_CURRENT_VERSION` and `GIFT_CARD_DELIVERY_KEYS_JSON` beside the HMAC lines, with placeholder strings that cannot be mistaken for real keys.
- **D-12:** `.env.example` gains one comment line stating that the gift-card secrets (and every other Cloudflare binding/secret) are read from `.dev.vars` in local development because the dev server runs through `initOpenNextCloudflareForDev()`; `.env.local` only carries Next-side public values. Wording per research; no guess.
- **D-13:** Observation recorded, not a task: the uncommitted `wrangler.jsonc` / `cloudflare-env.d.ts` edits present at session start (2026-09-07) are no longer in the working tree and were never committed; the executor must not try to recreate them. If they were intentional, Russell redoes them after this phase.

### Carried forward
- Phase 9 D-12/D-13 precedent: the executor runs `wrangler` under Russell's login for production actions and read-back verification; ADR-DBM's migration gate is not involved (no migration in this phase).
- `MERCORA_ALLOW_PRODUCTION_MIGRATIONS` stays a Dashboard Build variable only; no secret or flag value ever enters `wrangler.jsonc` except the two `"true"` feature flags, which are public switches by design.
- `docs:lint` must stay green; the four locked ADRs are not edited.

### Claude's Discretion
- Exact byte/encoding recipe per ring (e.g. `openssl rand -base64 32` vs `-hex 32`) as dictated by `lib/gift-cards/config.ts` and `encryption.ts`; the JSON-wrapping pipeline that never materialises the value in a file (`printf '{"1":"%s"}' "$(openssl …)" | wrangler secret put …` or equivalent).
- Which read-only production endpoint proves reconciliation (D-06), how long to wait for one cron cycle, and how the tail-worker check is performed (`wrangler tail` on the tail consumer vs. the observability dataset).
- Test strategy: a source-contract test that `.env.example` names all four secrets, a docs-lint run, a unit test that the parsers accept the documented placeholder shape (with placeholder-length keys) and reject a 31-byte key; no production-touching tests.
- Recipe copy and section numbering in `DEPLOYMENT_SETUP.md`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Runtime contract (locked)
- `docs/runtime-configuration.md` — flag semantics (reconciliation defaults off, must stay on while balances exist; acquisition requires reconciliation), the HMAC-ring paragraph D-10 mirrors, the rule that secrets never enter `wrangler.jsonc`.
- `lib/gift-cards/config.ts` — env names (`GIFT_CARD_CODE_HMAC_CURRENT_VERSION`, `GIFT_CARD_CODE_HMAC_KEYS_JSON`, `GIFT_CARD_DELIVERY_CURRENT_VERSION`, `GIFT_CARD_DELIVERY_KEYS_JSON`), `MIN_KEY_BYTES = 32`, ring bounds, and the parsers that define an acceptable value.
- `lib/gift-cards/encryption.ts` — `GIFT_CARD_DELIVERY_KEY_BYTES`, contract version, max key versions for the delivery ring.
- `lib/commerce/runtime.ts`, `lib/observability/scheduled.ts`, `lib/store-config.ts` (lines ~430–440) — where the two flags are read; the cron's `giftCardsEnabled` gate on `drainGiftCardDeliveries`.
- `lib/services/gift-card-fulfillment.ts` (lines ~170–210) — the delivery ring's consumer.
- `docs/checkout-trust-boundary.md` — ADR-CTB-10: optional capabilities behind flags; defaults are no-ops.

### Deploy and secrets hygiene
- `docs/DEPLOYMENT_SETUP.md` §6 (Deployment Process, Step 1b Workers Builds variables, `deploy:ci` note at line ~328) and §8 Going Live — where D-09's §9 attaches.
- `AGENTS.md` — secrets list, `.dev.vars` contract, "no secret in `wrangler.jsonc`", `deploy:ci` only in Workers Builds.
- `scripts/check-deploy-config.mjs` — the predeploy gate `npm run deploy` would run (not used here; documents the placeholder patterns docs must avoid).
- `wrangler.jsonc` `vars` block — current keys (`NEXT_PUBLIC_*`, subscription flags); the two gift-card flags are added here.
- `package.json` — `cf-typegen`, `cf-typecheck`, `deploy`, `deploy:ci`.
- `.planning/PROJECT.md` Key Decisions — the Phase 1 `openssl rand | wrangler secret put` precedent and the note that Cloudflare refuses secret edits when the latest uploaded version is not deployed (push `main` first if that recurs).
- Memory: `cf-typecheck: regenerate without env files` — CI diffs against a no-env-file generation; move `.env.local` aside before `npm run cf-typegen`.

### Milestone framing
- `.planning/REQUIREMENTS.md` — OPS-01..OPS-04 wording; `.planning/ROADMAP.md` §"Phase 11".
- `.planning/phases/10-gift-card-purchase-flow/10-VERIFICATION.md` and `10-UAT.md` — the deferred human verification D-07 gates on.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Both key-ring parsers already exist and fail closed (`GiftCardRuntimeConfigurationError`) on missing/short/oversized keys; they are the shape oracle for D-03.
- `.env.example` already carries the HMAC ring and both flags as commented placeholders; D-11 extends the same block.
- `docs/DEPLOYMENT_SETUP.md` already documents the sliced seed apply (Phase 9) and the Workers Builds variable precedence; §9 follows those conventions.
- `wrangler secret list` returns JSON (names only) — the safe proof for OPS-01.

### Established Patterns
- Production actions run through `mise exec -- npx wrangler …` under Russell's OAuth login; values piped, never printed (Phase 1, Phase 9).
- Feature flags are string `"true"` vars in `wrangler.jsonc`; `cloudflare-env.d.ts` is regenerated by `cf-typegen` and diffed by `cf-typecheck` in CI.
- Deploys happen on push to `main` via Workers Builds (`deploy:ci`), which also applies migrations (none here).
- Docs are claim-checked and linted (`npm run docs:lint`); no doc names a credential value, account id, or database id.

### Integration Points
- Cloudflare secret store (four new names) → read by `parseGiftCardCodeKeyRing` / `parseGiftCardDeliveryKeyRing` at request/cron time.
- `wrangler.jsonc` `vars` → `lib/commerce/runtime.ts` and `lib/observability/scheduled.ts` flag reads.
- `docs/DEPLOYMENT_SETUP.md` §9, `docs/runtime-configuration.md` table + paragraph, `.env.example`.
- Observation for Russell (outside this phase): production's secret list today has `ADMIN_USER_IDS` (already slated for deletion), `ADMIN_VECTORIZE_TOKEN`, `CLERK_SECRET_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — and no `ORDER_STATUS_SECRET` or `EMAIL_UNSUBSCRIBE_SECRET_*`, both of which `AGENTS.md` lists as required secrets. Recorded under Deferred Ideas for a follow-up, not folded into this phase.

</code_context>

<specifics>
## Specific Ideas

- No secret value may appear in any tool output, commit, doc, or planning artifact; proofs are name lists and parser acceptance, never values.
- The acquisition push is the only step that changes what a live shopper can do; it gets the phase's single blocking-human gate (D-07).
- Docs describe the rollout in the same order the code requires: secrets → reconciliation → verify → acquisition.

</specifics>

<deferred>
## Deferred Ideas

- Production is missing `ORDER_STATUS_SECRET` and `EMAIL_UNSUBSCRIBE_SECRET_CURRENT/PREVIOUS` although `AGENTS.md` lists them as required; guest order-status links and unsubscribe links may be inert or failing in production. Needs a separate check and, if confirmed, secrets set the same way as this phase — not in scope for OPS-01..04.
- Delete the unused `ADMIN_USER_IDS` Worker secret (already on the v1 hygiene list).
- A key-rotation drill for both rings (second version, flip current, retire the old) — documented shape exists, exercise it later.

</deferred>

---

*Phase: 11-production-enablement*
*Context gathered: 2026-09-08*
