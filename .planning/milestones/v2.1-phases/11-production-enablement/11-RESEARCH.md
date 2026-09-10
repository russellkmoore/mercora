# Phase 11: Production Enablement - Research

**Researched:** 2026-09-08
**Domain:** Cloudflare Workers secrets/vars rollout for an existing, already-coded optional capability (gift cards)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Secrets (OPS-01)**
- **D-01:** The executor generates and stores each of the four production secrets with a single shell pipeline under Russell's existing wrangler OAuth login — `openssl rand -base64 32` (or the JSON-wrapped equivalent for the `*_KEYS_JSON` rings) piped straight into `mise exec -- npx wrangler secret put <NAME>` — so no value is ever printed, logged, or written to a file outside Cloudflare's secret store. Proof is `mise exec -- npx wrangler secret list` showing the four names. Phase 1's `ADMIN_VECTORIZE_TOKEN` rotation is the precedent. — **Reversibility:** reversible — `wrangler secret delete` or a fresh `put` replaces a ring; nothing durable references a key until a card is issued under it, after which rotation (not deletion) is the path.
- **D-02:** Local development gets its own separately generated key values (never the production ones), appended by pipeline to both `.env.local` (what `npm run dev` reads) and a new `.dev.vars` (the AGENTS.md contract for wrangler-driven runs); the executor never echoes those values either. `.dev.vars` and `.env.local` stay untracked (`.gitignore` already covers them — verify).
- **D-03:** Each ring ships with exactly one version: `GIFT_CARD_CODE_HMAC_CURRENT_VERSION=1` with `GIFT_CARD_CODE_HMAC_KEYS_JSON={"1":"<32-byte base64>"}`, and `GIFT_CARD_DELIVERY_CURRENT_VERSION=1` with `GIFT_CARD_DELIVERY_KEYS_JSON={"1":"<AES key, GIFT_CARD_DELIVERY_KEY_BYTES from lib/gift-cards/encryption.ts, base64>"}`. The parsers in `lib/gift-cards/config.ts` (`parseGiftCardCodeKeyRing`, `parseGiftCardDeliveryKeyRing`) are the acceptance test for the shape: research confirms the exact encoding each expects before any `secret put`.
- **D-04:** Secrets land before either flag flips; the rings are inert until a flag reads them.

**Rollout mechanics (OPS-02)**
- **D-05:** Flag changes deploy the normal way: a commit to `wrangler.jsonc` `vars` pushed to `main`, which Cloudflare Workers Builds deploys with `deploy:ci`. Two commits, two pushes: `STORE_FEATURE_GIFT_CARD_RECONCILIATION: "true"` first, `STORE_FEATURE_GIFT_CARD_ACQUISITION: "true"` second. Before each push `mise exec -- npm run cf-typegen` regenerates `cloudflare-env.d.ts` and `mise exec -- npm run cf-typecheck` passes (regenerate without env files present, per the recorded CI convention). `npm run deploy` from a developer machine is not used.
- **D-06:** "Reconciliation verified" before the second flag means three read-only checks: the new version appears in `mise exec -- npx wrangler deployments list`; a production read-only request that exercises the reconciliation capability returns the expected shape (the planner picks the endpoint from `app/api/gift-cards/*` after research confirms which path reads the flag without side effects); and the `commerce-observability-tail` Worker records no `gift_card.*` error-severity event within one five-minute cron cycle after the deploy.
- **D-07:** The acquisition push is preceded by a `checkpoint:decision` with `gate="blocking-human"`: Russell either confirms `/gsd-verify-work 10` has passed or explicitly accepts enabling acquisition with Phase 10's human verification still deferred. Enabling acquisition makes gift cards purchasable on the live site, so this is the one gate that must stop an unattended run. — **Reversibility:** reversible by flag (set the var back to `"false"` and push), never by schema.
- **D-08:** The executor pushes the reconciliation commit itself (the flag only turns on the delivery drain and tender paths, which have nothing to act on until a card exists) and pauses at D-07 before the acquisition push. Pushing to `main` is the deploy action for this project; each push is one commit that changes only `wrangler.jsonc` and `cloudflare-env.d.ts`.

**Docs and developer example (OPS-03, OPS-04)**
- **D-09:** `docs/DEPLOYMENT_SETUP.md` gains a new `## 9. Gift Card Enablement` section after "Going Live": generate keys → put the four secrets → enable reconciliation → verify (the D-06 checks) → enable acquisition, each step with the exact command, linking `docs/runtime-configuration.md` for the variable contract and naming no value, account id, or database id.
- **D-10:** `docs/runtime-configuration.md` gains a table row for the delivery ring next to the HMAC-ring row and a paragraph mirroring the HMAC-ring text: JSON object keyed by canonical positive-integer versions, current version required, ring bounded to the module's maximum, base64 AES key bytes, server-only, never `NEXT_PUBLIC_*`, never in `wrangler.jsonc`.
- **D-11:** `.env.example` keeps its commented-placeholder style: two new lines for `GIFT_CARD_DELIVERY_CURRENT_VERSION` and `GIFT_CARD_DELIVERY_KEYS_JSON` beside the HMAC lines, with placeholder strings that cannot be mistaken for real keys.
- **D-12:** `.env.example` gains one comment line stating which file each runner reads (`npm run dev` → `.env.local`; wrangler-driven runs → `.dev.vars`) only if research confirms that is accurate for this repo's scripts; otherwise the line is omitted rather than guessed.

**Carried forward**
- Phase 9 D-12/D-13 precedent: the executor runs `wrangler` under Russell's login for production actions and read-back verification; ADR-DBM's migration gate is not involved (no migration in this phase).
- `MERCORA_ALLOW_PRODUCTION_MIGRATIONS` stays a Dashboard Build variable only; no secret or flag value ever enters `wrangler.jsonc` except the two `"true"` feature flags, which are public switches by design.
- `docs:lint` must stay green; the four locked ADRs are not edited.

### Claude's Discretion
- Exact byte/encoding recipe per ring (e.g. `openssl rand -base64 32` vs `-hex 32`) as dictated by `lib/gift-cards/config.ts` and `encryption.ts`; the JSON-wrapping pipeline that never materialises the value in a file (`printf '{"1":"%s"}' "$(openssl …)" | wrangler secret put …` or equivalent).
- Whether `.dev.vars` and `.env.local` get identical dev values or two independent sets.
- Which read-only production endpoint proves reconciliation (D-06), how long to wait for one cron cycle, and how the tail-worker check is performed (`wrangler tail` on the tail consumer vs. the observability dataset).
- Test strategy: a source-contract test that `.env.example` names all four secrets, a docs-lint run, a unit test that the parsers accept the documented placeholder shape (with placeholder-length keys) and reject a 31-byte key; no production-touching tests.
- Recipe copy and section numbering in `DEPLOYMENT_SETUP.md`.

### Deferred Ideas (OUT OF SCOPE)
- Production is missing `ORDER_STATUS_SECRET` and `EMAIL_UNSUBSCRIBE_SECRET_CURRENT/PREVIOUS` although `AGENTS.md` lists them as required; guest order-status links and unsubscribe links may be inert or failing in production. Needs a separate check and, if confirmed, secrets set the same way as this phase — not in scope for OPS-01..04.
- Delete the unused `ADMIN_USER_IDS` Worker secret (already on the v1 hygiene list).
- A key-rotation drill for both rings (second version, flip current, retire the old) — documented shape exists, exercise it later.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | The code HMAC key ring and the delivery key ring are generated with at least 32-byte secrets and stored only as Worker secrets and in local `.dev.vars`; nothing lands in `wrangler.jsonc`, source, docs, or git history | Exact per-ring shape verified against `lib/gift-cards/config.ts` and `lib/gift-cards/encryption.ts` (see Architecture Patterns); exact non-materializing shell pipelines given in Code Examples; `.gitignore` coverage verified |
| OPS-02 | `STORE_FEATURE_GIFT_CARD_RECONCILIATION` is enabled and deployed first, then `STORE_FEATURE_GIFT_CARD_ACQUISITION`, in `wrangler.jsonc` `vars`, with `cloudflare-env.d.ts` regenerated and `cf-typecheck` passing | Exact flag-read sites verified (`lib/commerce/runtime.ts`, `lib/commerce/capabilities.ts`, `lib/observability/scheduled.ts`, `lib/store-config.ts`); existing subscription-flag pattern in `wrangler.jsonc` confirmed as the template; `cf-typegen`/`cf-typecheck` commands confirmed; verification-endpoint limitations documented in Common Pitfalls |
| OPS-03 | `docs/runtime-configuration.md` documents the delivery key ring alongside the code HMAC ring, and `docs/DEPLOYMENT_SETUP.md` carries a step-by-step enablement recipe | Exact attachment points in both docs identified with surrounding text quoted; `docs/docs-lint.mjs`'s 7 checks enumerated so new prose stays compliant |
| OPS-04 | `.env.example` shows the shape of all four gift card secrets with placeholder values so a developer can exercise the full flow locally | Current `.env.example` HMAC-ring block quoted verbatim; delivery-ring placeholder lines drafted to match the existing style; `.dev.vars` vs `.env.local` read-path clarified (see Pitfall 6) |
</phase_requirements>

## Summary

This phase installs no new library and writes almost no new application code — the gift-card
runtime (parsers, capability gating, delivery drain, telemetry) already shipped and is fully
covered by existing tests. The work is: generate two key rings that satisfy two already-frozen
parsers, load them as Cloudflare Worker secrets, flip two already-wired feature-flag `vars` in the
order the code requires, and update three docs/config artifacts to describe what was done. Every
acceptance shape this phase must hit is defined by code already in the tree — `lib/gift-cards/config.ts`'s
two parser functions are the literal, executable spec for what a secret value must look like, and
this research read both parsers plus their existing unit test (`tests/unit/lib/gift-cards/config.test.ts`)
to confirm the exact encoding.

Two facts materially change the plan's verification design. First, the two `app/api/gift-cards/*`
read paths are not equally useful for a read-only production check: `GET /api/gift-cards` requires
a signed-in Clerk session (401 without one) but *does* distinguish a healthy ring (200) from a
malformed one (503), while `POST /api/gift-cards/balance` needs no auth but is deliberately opaque —
it returns `{valid:false}` for a bad code, a missing card, *and* a malformed key ring alike, by
design (the code comment calls this "one generic invalid response"). Neither, therefore, is a
clean anonymous curl-only proof that reconciliation is healthy; D-06's plan needs to lean primarily
on `wrangler deployments list` plus a cron-cycle telemetry check, with the authenticated endpoint as
a secondary confirmation Russell (not an unauthenticated script) can run.

Second, there is no `gift_card.*` *event name* in the telemetry taxonomy — `TELEMETRY_EVENTS` is a
fixed, closed set of event names (`cron.recovery_failed`, `paid_effect.first_attempt_failed`,
`paid_effect.repeated_failure`, `refund.gift_restoration_unresolved`, etc.), and `gift_card` only
appears as a *field value* (`effect_type: 'gift_card'` or `provider: 'gift_card'`) attached to those
generic events. The cron path most likely to surface a malformed delivery ring
(`drainGiftCardDeliveries`, invoked every 5 minutes once reconciliation is on) fails through to
`cron.recovery_failed` with `provider: 'd1'` — not a gift-card-labeled field at all — because it is
one of three promises inside a single `Promise.all().catch()`. This is good news for D-06's intent
(a malformed ring surfaces within one 5-minute cycle, even with zero pending deliveries, because
`drainGiftCardDeliveries` parses the delivery ring unconditionally before checking whether there is
anything to deliver) but the verification command must watch for `cron.recovery_failed`, not a
`gift_card.*`-prefixed name.

**Primary recommendation:** Follow D-01 through D-12 exactly as locked; use the exact shell
pipelines in Code Examples (verified against the parsers' literal source); verify reconciliation
primarily via `wrangler deployments list` + a `wrangler tail` watch for `cron.recovery_failed`
during one 5-minute cron window, with the authenticated `GET /api/gift-cards` check as a
Russell-run secondary confirmation, not an unattended script step.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Key ring generation & storage | Cloudflare account (Worker secrets store) | Local dev (`.dev.vars`/`.env.local`) | Secret material never touches the app tier's source or config; it is injected into `env` at request time by the Workers runtime |
| Feature-flag rollout | API/Backend (`wrangler.jsonc` `vars` → `lib/commerce/runtime.ts`, `lib/store-config.ts`) | CDN/Static (build-time inlining for `NEXT_PUBLIC_*`, N/A here — these two flags are server-only, never `NEXT_PUBLIC_*`) | Flags are read server-side per request/cron tick; they never reach the browser bundle |
| Gift-card capability gating | API/Backend (`lib/commerce/capabilities.ts`) | — | `resolveCommerceCapabilities` is the single choke point; it throws at configuration time if acquisition is on without reconciliation, so misordering the flags is a fail-fast, not a silent bug |
| Delivery drain (cron) | API/Backend (`lib/observability/scheduled.ts` → `lib/services/gift-card-fulfillment.ts`) | Database/Storage (D1 `gift_card_deliveries` table) | Runs on a Cloudflare Cron Trigger inside the same Worker, independent of any HTTP request |
| Docs/config artifacts | N/A (documentation, not runtime) | — | `docs/runtime-configuration.md`, `docs/DEPLOYMENT_SETUP.md`, `.env.example` describe the above tiers but execute nothing |

## Package Legitimacy Audit

Not applicable. This phase installs no new npm package — it only sets Cloudflare Worker secrets,
flips `wrangler.jsonc` `vars`, and edits three documentation/config files. `npm install` is not run
by any task in this phase.

## Architecture Patterns

### Key-ring shapes (the literal acceptance test)

Read directly from `lib/gift-cards/config.ts` (lines 1-150) and `lib/gift-cards/encryption.ts`
(lines 1-21), plus `lib/gift-cards/code.ts` (lines 26-30, 95-107) for the HMAC ring's actual byte
check. Quoted verbatim so no value in this doc is paraphrased:

**HMAC code ring** — `GIFT_CARD_CODE_HMAC_CURRENT_VERSION` / `GIFT_CARD_CODE_HMAC_KEYS_JSON`

`lib/gift-cards/config.ts:16` — `const MIN_KEY_BYTES = 32;` and `:17` — `const MAX_KEY_BYTES = 4_096;`
`lib/gift-cards/code.ts:95-107`:
```ts
function keyBytes(value: unknown): Uint8Array<ArrayBuffer> | null {
  let bytes: Uint8Array<ArrayBuffer>;
  if (typeof value === "string") {
    bytes = encoder.encode(value);
  } else if (value instanceof Uint8Array) {
    bytes = Uint8Array.from(value);
  } else {
    return null;
  }
  return bytes.length >= MIN_KEY_BYTES && bytes.length <= MAX_KEY_BYTES ? bytes : null;
}
```
`[VERIFIED: lib/gift-cards/code.ts:95-107]` — a string key's byte length is its **raw UTF-8
encoded length**, not a base64-decoded length. The string itself is used directly as HMAC key
material (`crypto.subtle` HMAC key import happens elsewhere in `code.ts`'s digest function using
these raw bytes). There is **no `base64:` prefix requirement and no decode step** for this ring —
any string whose `TextEncoder().encode(value).length` is between 32 and 4096 passes. A standard
`openssl rand -base64 32` value (44 ASCII characters) is 44 UTF-8 bytes — comfortably inside the
bound, and simplest to generate consistently with the delivery ring.

**Delivery ring** — `GIFT_CARD_DELIVERY_CURRENT_VERSION` / `GIFT_CARD_DELIVERY_KEYS_JSON`

`lib/gift-cards/encryption.ts:5,19` — `const AES_KEY_BYTES = 32;` / `export const GIFT_CARD_DELIVERY_KEY_BYTES = AES_KEY_BYTES;`
`lib/gift-cards/config.ts:134,139`:
```ts
if (version === null || typeof key !== 'string' || !/^base64:[A-Za-z0-9+/]+={0,2}$/.test(key)) {
  throw new GiftCardRuntimeConfigurationError();
}
if (decodedByteLength(key.slice('base64:'.length)) !== GIFT_CARD_DELIVERY_KEY_BYTES) {
  throw new GiftCardRuntimeConfigurationError();
}
```
`[VERIFIED: lib/gift-cards/config.ts:134,139]` — the delivery-ring value **must** be literally
prefixed `base64:` and the remainder must decode (standard base64) to exactly 32 bytes
(`GIFT_CARD_DELIVERY_KEY_BYTES`). `lib/gift-cards/encryption.ts:139-141` (`keyBytes()`, the runtime
consumer) additionally requires the base64 portion to be **canonical** — decode-then-re-encode must
reproduce the exact same string (rejects non-canonical padding/whitespace). `openssl rand -base64 32`
always emits canonical standard base64 (32 bytes → 44 chars, one trailing `=`), so it satisfies both
the lenient `parseGiftCardDeliveryKeyRing` check and the stricter runtime `keyBytes()` check.

**Version fields** — `GIFT_CARD_CODE_HMAC_CURRENT_VERSION` and `GIFT_CARD_DELIVERY_CURRENT_VERSION`
are each a **plain positive-integer string** (`"1"`), matched by `/^[1-9][0-9]*$/`
(`lib/gift-cards/config.ts:41`, `positiveSafeInteger`) — not JSON, not random.

**Ring size bounds** — `MAX_GIFT_CARD_CODE_KEY_VERSIONS = 4` (`lib/gift-cards/code.ts:30,37`) and
`MAX_GIFT_CARD_DELIVERY_KEY_VERSIONS = 4` (`lib/gift-cards/encryption.ts:9,21`). D-03's one-version
ring is well inside both bounds.

**Existing unit test confirms the exact shapes** (`tests/unit/lib/gift-cards/config.test.ts:57-75`,
read this session):
```ts
it('parses an independently versioned AES-GCM delivery key ring', () => {
  expect(parseGiftCardDeliveryKeyRing({
    GIFT_CARD_DELIVERY_CURRENT_VERSION: '1',
    GIFT_CARD_DELIVERY_KEYS_JSON: JSON.stringify({
      1: 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    }),
  })).toEqual({
    currentVersion: 1,
    keys: { 1: 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
  });
});
```
`[VERIFIED: tests/unit/lib/gift-cards/config.test.ts:57-67]`

### Flag-read sites (what actually changes at runtime)

**`STORE_FEATURE_GIFT_CARD_RECONCILIATION`** is read in four places, all confirmed this session:
- `lib/commerce/runtime.ts:26` — `enabled(environment, 'STORE_FEATURE_GIFT_CARD_RECONCILIATION')`, feeds `resolveCommerceCapabilities`'s `giftCardReconciliation` flag.
- `lib/observability/scheduled.ts:30-31` — `const giftCardsEnabled = String(env.STORE_FEATURE_GIFT_CARD_RECONCILIATION ?? '').trim().toLowerCase() === 'true';` gates whether the 5-minute cron calls `drainGiftCardDeliveries` at all (`:41-43`).
- `lib/store-config.ts` (the `commerce.features.giftCardReconciliation` block, confirmed via `bool(env, "STORE_FEATURE_GIFT_CARD_RECONCILIATION", …)`) — feeds `StoreConfig`, a public-shaped object, but the boolean itself is not secret.
- `app/api/gift-cards/route.ts:18` and `app/api/gift-cards/balance/route.ts:28` — both short-circuit to a flag-off response before touching D1.

`lib/commerce/capabilities.ts:181-217` (`resolveCommerceCapabilities`, read in full this session) is
the actual gate: with reconciliation **on** and acquisition **off**, `gatedGiftCards` is a wrapper
that still allows `verifyReservedTender`/`applyTender`/`releaseTender`/`restoreTender` (existing
reservations can be settled/released) but makes `resolveTender` throw
`CommerceCapabilityDisabledError` for any nonempty token (no *new* reservations). This is exactly
the "reconciliation only, no new sales" behavior D-06/D-07 depend on.

**`STORE_FEATURE_GIFT_CARD_ACQUISITION`** additionally gates, per
`lib/commerce/capabilities.ts:158-160`:
```ts
if (flags.giftCardAcquisition && !flags.giftCardReconciliation) {
  throw new CommerceCapabilityConfigurationError(
    "Gift-card acquisition requires reservation reconciliation",
  );
}
```
`[VERIFIED: lib/commerce/capabilities.ts:158-160]` — turning acquisition on before reconciliation is
**not a silent misconfiguration**; it throws at capability-resolution time (i.e., on the very first
request/cron tick that resolves commerce capabilities after such a deploy). D-05's flag order is
therefore load-bearing at the code level, not just a rollout-hygiene preference.

`app/api/payment-intent/route.ts:92-102` (grep-confirmed) accepts an optional `giftCardToken` /
`giftCardRequestKey` pair and only calls into the gift-card capability when a token is present; no
dedicated storefront redemption/tender-entry UI component was found under `components/checkout/` or
`app/checkout/` in this session's search — Phase 10's shipped scope was gift-card *purchase*
(SHOP-01..06), not gift-card-as-tender redemption at someone else's checkout. `[ASSUMED]` — treat
"the storefront's redeem-code UI" in D-06/D-07's Claude's-Discretion note as referring to the
`giftCardToken` API surface, not a rendered component, unless the planner's own search of
`components/checkout/` turns one up.

### Verification-endpoint behavior (read in full this session)

`app/api/gift-cards/route.ts` (`GET`, 32 lines, read in full):
```ts
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  ...
  if (String(environment.STORE_FEATURE_GIFT_CARD_RECONCILIATION ?? '').trim().toLowerCase() !== 'true') {
    return NextResponse.json({ cards: [] });
  }
  if (!environment.DB) return NextResponse.json({ error: 'Gift cards are temporarily unavailable' }, { status: 503 });
  const cards = await listCustomerGiftCardPresentations({ ... });
  return NextResponse.json({ cards });
  ...
}
```
`[VERIFIED: app/api/gift-cards/route.ts:1-32]` — this endpoint **requires a Clerk session**
(401 without one). It *does* distinguish a healthy ring/DB from a broken one: reconciliation off →
`{cards: []}` always (no DB touch); reconciliation on + DB present + ring parses → `{cards: [...]}`
(200, likely `[]` for an account with no cards yet, since no gift card has been purchased in
production — SHOP-07 is deferred to Phase 12); reconciliation on + a ring-parse or DB error →
caught by the outer `try/catch` → 503 `{error: 'Gift cards are temporarily unavailable'}`. **This is
the one endpoint that can positively distinguish "ring is malformed" from "ring is fine, just
empty,"** but it cannot be curled anonymously — it needs a real Clerk-authenticated session cookie,
which an unattended executor does not have.

`app/api/gift-cards/balance/route.ts` (`POST`, 43 lines, read in full):
```ts
/**
 * Public balance lookup intentionally has one generic invalid response. It
 * reveals neither account IDs nor code-hash rotation state and never logs the
 * submitted bearer code.
 */
export async function POST(request: NextRequest) {
  ...
  try {
    ...
    if (String(raw.STORE_FEATURE_GIFT_CARD_RECONCILIATION ?? '').trim().toLowerCase() !== 'true' || !raw.DB) {
      return NextResponse.json({ valid: false });
    }
    const keyRing = parseGiftCardCodeKeyRing(raw);
    ...
  } catch {
    return NextResponse.json({ valid: false });
  }
}
```
`[VERIFIED: app/api/gift-cards/balance/route.ts:10-42]` — this one needs **no auth** (public POST),
but by explicit design ("one generic invalid response") it returns `{valid: false}` for a bad code,
an absent card, a flag-off state, **and** a malformed HMAC ring alike — the outer `catch` swallows a
`GiftCardRuntimeConfigurationError` from `parseGiftCardCodeKeyRing` into the same `{valid: false}` as
"no such card." **It cannot be used to positively prove the ring is healthy** — a 200 `{valid:
false}` is uninformative either way, since there is (as of this phase) no issued card in production
to test a real code against.

**Recommendation for D-06's second check:** treat `GET /api/gift-cards` (authenticated) as a
secondary confirmation Russell can run from a signed-in browser tab or an authenticated `curl`
Russell supplies a session cookie for — not as an unattended-executor step. For the executor's own
automated proof, rely primarily on (a) `wrangler deployments list` showing the new version live, and
(b) a `wrangler tail` window during one 5-minute cron cycle watching for `cron.recovery_failed` (see
next section) plus the *absence* of a thrown error in the Worker's own logs.

### Telemetry: no `gift_card.*` event name exists

`lib/observability/telemetry.ts:25-73` (`TELEMETRY_EVENTS`, read in full this session) is a closed,
fixed map of ~40 event names — none is prefixed `gift_card.`. `gift_card` appears **only** as an
allowed *value* for two enum **fields**:
```ts
effect_type: new Set([
  'confirmation_email', 'coupon', 'gift_card', 'inventory', 'merchant_notification',
  'subscription', 'paid_decrement', 'refund_restock',
]),
...
provider: new Set([
  'analytics', 'carrier', 'cloudflare_email', 'd1', 'gift_card', 'resend', 'stripe', 'workers_ai',
]),
```
`[VERIFIED: lib/observability/telemetry.ts:104-123]`

The cron path that would surface a malformed **delivery** ring is `drainGiftCardDeliveries`
(`lib/services/gift-card-fulfillment.ts:212-227`, read in full):
```ts
export async function drainGiftCardDeliveries(options: {...} = {}): Promise<{ attempted: number }> {
  ...
  const rows = await environment.DB.prepare(`SELECT gift_card_id FROM gift_card_deliveries
    WHERE deliver_after <= ? AND (status = 'pending' OR ...) ORDER BY updated_at, id LIMIT ?`)
    .bind(now, now, limit).all<{ gift_card_id: string }>();
  const keys = parseGiftCardDeliveryKeyRing(environment);
  for (const row of rows.results ?? []) {
    await deliverOne({ database: environment.DB, giftCardId: row.gift_card_id, keys, now });
  }
  return { attempted: rows.results?.length ?? 0 };
}
```
`[VERIFIED: lib/services/gift-card-fulfillment.ts:212-227]` — `parseGiftCardDeliveryKeyRing(environment)`
is called **unconditionally**, after the D1 query but *before* the loop, regardless of whether
`rows.results` is empty. This directly answers the context prompt's open question ("is a 0-row cron
run harmless?"): **no** — if the delivery-ring secret is malformed, every 5-minute cron tick throws
as soon as reconciliation is enabled, even with zero pending deliveries (there is no early return on
an empty row set). This is a *feature* for verification purposes: a bad ring surfaces within one
cron cycle, not silently.

That throw propagates up through `lib/observability/scheduled.ts:32-51`
(`handleScheduled`, read in full):
```ts
ctx.waitUntil(
  Promise.all([
    drainOrderEffects({...}),
    drainInventoryAdjustments({...}),
    giftCardsEnabled
      ? drainGiftCardDeliveries({ environment: ..., limit: 25 })
      : Promise.resolve({ attempted: 0 }),
  ])
    .then(([effects, inventory, giftCardDeliveries]) =>
      console.log('[cron] recovery queues drained', { effects, inventory, giftCardDeliveries })
    )
    .catch((error) => recordTelemetry('cron.recovery_failed', {
      operation: 'process', outcome: 'failed', provider: 'd1',
      retryable: true, trigger: 'recovery',
    }, error)),
);
```
`[VERIFIED: lib/observability/scheduled.ts:32-51]` — a `drainGiftCardDeliveries` failure is folded
into a single `Promise.all().catch()` alongside the order-effects and inventory drains, and the
recorded event is `cron.recovery_failed` with **`provider: 'd1'` — not `'gift_card'`**. The verify
command must watch for `cron.recovery_failed` (severity `critical`,
`workers/observability-tail/src/core.ts:9-34` `TAIL_CRITICAL_EVENTS` — confirmed in that list,
`[VERIFIED: workers/observability-tail/src/core.ts:9-34]`) — not a `gift_card.`-prefixed name, since
none exists. A gift-card-*issuance* failure (as opposed to the delivery drain) would instead surface
as `paid_effect.first_attempt_failed` (severity `error`, not tail-critical) or, after 3 attempts,
`paid_effect.repeated_failure` (severity `critical`, tail-critical) — both carry
`effect_type: 'gift_card'` in their fields (`lib/services/order-effects.ts:449-461`, read this
session) — but this path only fires when a paid gift-card *order* exists, which none does yet.

### Established patterns to follow (from `wrangler.jsonc`, read this session)

The two existing subscription flags are the exact template for the two new gift-card flags:
```jsonc
// Subscriptions (docs/subscriptions.md). Reconciliation must stay on once
// the first subscription exists; disable acquisition first to stop sales.
"STORE_FEATURE_SUBSCRIPTION_RECONCILIATION": "true",
"STORE_FEATURE_SUBSCRIPTION_ACQUISITION": "true",
```
`[VERIFIED: wrangler.jsonc:118-121]` — string `"true"` values with an explanatory comment above the
block. The new gift-card flags should follow the identical style (string `"true"`, comment
referencing the reconciliation-before-acquisition rule and linking `docs/runtime-configuration.md`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Random 32-byte key generation | A custom RNG script or Node `crypto.randomBytes` wrapper | `openssl rand -base64 32` piped directly into `wrangler secret put` | Matches the Phase 1 `ADMIN_VECTORIZE_TOKEN` precedent already accepted by this project; zero new dependency; output format is exactly what both parsers expect |
| Key-ring shape validation | A new validator script | The existing `parseGiftCardCodeKeyRing` / `parseGiftCardDeliveryKeyRing` (already covered by `tests/unit/lib/gift-cards/config.test.ts`) | These are the literal, already-tested spec; writing a second validator risks drifting from the real one |
| Flag-order enforcement | A pre-deploy check script | `resolveCommerceCapabilities`'s existing throw (`lib/commerce/capabilities.ts:158-160`) | The code already fails closed if acquisition is enabled without reconciliation — no new guard needed, just respect the order in the rollout plan |

**Key insight:** everything this phase needs to validate already has an enforced, tested contract in
the codebase. The research task was to *read* that contract precisely, not to design a new one.

## Common Pitfalls

### Pitfall 1: HMAC ring does not use base64 decoding — don't over-encode
**What goes wrong:** Treating the HMAC ring the same as the delivery ring (prefixing with `base64:`,
or worrying about decoded byte length) produces a value that still passes (a `base64:`-prefixed
string is just a longer string, still ≥32 UTF-8 bytes) but is inconsistent with the delivery ring's
actual contract and confusing to a future reader.
**Why it happens:** Both rings sit next to each other in `config.ts` and look similar at a glance.
**How to avoid:** Keep the HMAC ring as a bare `openssl rand -base64 32` output (no prefix); keep the
delivery ring as `base64:$(openssl rand -base64 32)` (with prefix). The two parsers are genuinely
different (`lib/gift-cards/code.ts:95-107` vs `lib/gift-cards/config.ts:134,139`).
**Warning signs:** A `base64:` prefix anywhere in the HMAC ring value, or a bare (unprefixed) value
in the delivery ring — the delivery ring will fail `parseGiftCardDeliveryKeyRing`'s regex closed
with the generic `GiftCardRuntimeConfigurationError` (no detail leaked, by design).

### Pitfall 2: The balance endpoint cannot prove ring health
**What goes wrong:** Using `POST /api/gift-cards/balance` with a bogus code as the D-06 read-only
proof and treating a 200 `{valid:false}` as "reconciliation is healthy."
**Why it happens:** It is the only unauthenticated gift-card endpoint, so it looks like the obvious
curl-able choice.
**How to avoid:** Use it only as a liveness/availability check (200, not 5xx, not a hang), not as a
ring-health check. For ring health, use `GET /api/gift-cards` (Clerk-authenticated) or the
cron-telemetry watch described above.
**Warning signs:** A verification step that only checks HTTP status 200 from the balance endpoint —
this is true whether the ring is perfect or completely broken.

### Pitfall 3: No `gift_card.*` telemetry event exists
**What goes wrong:** Grepping `wrangler tail` output for the literal string `gift_card.` and
concluding "clean" because nothing matches, when the actual failure event is `cron.recovery_failed`.
**Why it happens:** `gift_card` reads like it should be an event-name prefix, matching the pattern of
`payment.*`, `webhook.*`, etc.
**How to avoid:** Watch for the event names in `TAIL_CRITICAL_EVENTS`
(`workers/observability-tail/src/core.ts:9-34`) generally during the verification window, and
additionally grep for `"gift_card"` as a *field value* (it will appear inside a `fields` object, not
as an event name) to attribute a generic failure back to the gift-card subsystem.
**Warning signs:** A verify script with a hardcoded `gift_card\.` regex against tail output.

### Pitfall 4: `wrangler secret put` refuses edits after certain deploy states
**What goes wrong:** A `wrangler secret put` call fails with an error about the latest Worker
version not being deployed.
**Why it happens:** `[VERIFIED: Context7 /cloudflare/workers-sdk — packages/wrangler/src/secret/index.ts]`
wrangler's secret-put handler calls the legacy secrets API directly against the currently active
deployed version; if a newer *version* has been uploaded (e.g. via `versions upload`) but not
promoted to "deployed," the API returns `VERSION_NOT_DEPLOYED_ERR_CODE` and wrangler surfaces:
"Secret edit failed. You attempted to modify a secret, but the latest version of your Worker isn't
currently deployed... (1) use `wrangler versions secret put`... or (2) deploy the latest version
first, then modify secrets." This exactly matches the PROJECT.md Phase 1 precedent
(`.planning/PROJECT.md:222`, read this session): *"Required pushing `main` first because Cloudflare
refuses secret edits when the latest uploaded version is not deployed."*
**How to avoid:** If any `wrangler secret put` call in this phase fails with this message, push
`main` first (letting Workers Builds deploy the latest version) and retry the secret puts — do not
attempt `wrangler versions secret put` without discussing with Russell, since it changes the deploy
sequencing D-01/D-04 assume (secrets before flags).
**Warning signs:** The literal error text above from any `wrangler secret put` invocation.

### Pitfall 5: `wrangler secret put` reads from stdin only when not a TTY
**What goes wrong:** Running `wrangler secret put NAME` interactively (no pipe) drops into an
`isSecret` masked prompt instead of reading a piped value, which breaks a pipeline that assumed
non-interactive stdin behavior.
**Why it happens:** `[VERIFIED: Context7 /cloudflare/workers-sdk — packages/wrangler/src/secret/index.ts]`
`const isInteractive = process.stdin.isTTY; const secretValue = ... isInteractive ? await prompt(...) : await readFromStdin();`
**How to avoid:** Always invoke as `<value-producing-command> | mise exec -- npx wrangler secret put NAME`
so stdin is a pipe, never a bare TTY invocation. This is exactly what D-01 already specifies — no
deviation needed, just confirmation the mechanism works as assumed.
**Warning signs:** A hang waiting for interactive input, or a masked prompt appearing in a
non-interactive script.

### Pitfall 6: `.dev.vars` is required for `npm run dev` too, not just wrangler-driven runs
**What goes wrong:** Believing `.env.local` alone is sufficient for `npm run dev` to exercise the
gift-card code paths locally, per a naive reading of D-12's proposed split.
**Why it happens:** `npm run dev` runs `next dev --turbopack` (`package.json:11`), which on the
surface looks like a pure Next.js process with no wrangler involvement.
**How to avoid:** `next.config.ts:65-68` (read this session):
```ts
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
```
`[VERIFIED: next.config.ts:65-68]` — this call makes `getCloudflareContext()` available during
`next dev`, and `@opennextjs/cloudflare`'s dev integration backs that context with **`.dev.vars`**
(via `getPlatformProxy()`), not `.env.local`. Every gift-card runtime read in this codebase goes
through `getCloudflareContext().env` (`lib/gift-cards/runtime.ts:21-23`,
`lib/services/gift-card-fulfillment.ts`, both `app/api/gift-cards/*` routes) — **so the four secret
values must be in `.dev.vars` to be visible to `npm run dev` at all.** `.env.local` only supplies
values read via plain `process.env`/Next's own env-var pipeline (e.g. `NEXT_PUBLIC_*` client vars),
which none of the four gift-card secrets are. **D-12's proposed one-line comment
("`npm run dev` → `.env.local`; wrangler-driven runs → `.dev.vars`") is not accurate for these four
variables and must be corrected or omitted per D-12's own fallback rule** ("otherwise the line is
omitted rather than guessed"). The corrected statement: gift-card secrets belong in `.dev.vars`
regardless of which local runner is used; `.env.local` is for `NEXT_PUBLIC_*`/plain
`process.env` values only.
**Warning signs:** A local `npm run dev` session where `getStoreConfig()`'s flags read `true` (from
`.env.local` or `wrangler.jsonc` default) but every gift-card API call 503s — the flags are visible
via `process.env`/`StoreConfig` parsing but the *secrets* backing the parser calls are not, because
they were only added to `.env.local`.

### Pitfall 7: The `secret put`/`--check` gate order after a `wrangler` bump
**What goes wrong:** Running `cf-typegen` while `.env.local` is present pulls extra inferred vars
into `cloudflare-env.d.ts` that CI's no-env-file generation won't produce, causing `cf-typecheck` (CI)
to diverge from what a local run just committed.
**Why it happens:** Documented in this repo's own memory (`cf-typecheck: regenerate without env
files` — CI diffs against a no-env-file generation).
**How to avoid:** Move `.env.local` aside (e.g. `mv .env.local .env.local.bak`) before running
`mise exec -- npm run cf-typegen`, restore it after. `.dev.vars` does not affect `wrangler types`
output the same way `.env.local` does (`--strict-vars false` already accommodates most drift, but the
recorded convention specifically calls out `.env.local`); follow the recorded convention exactly.
**Warning signs:** `cf-typecheck` fails in CI (or a from-scratch clone) after passing locally.

## Code Examples

### Generate and store the HMAC code ring (production)
```bash
# Version (plain integer, not random)
printf '1' | mise exec -- npx wrangler secret put GIFT_CARD_CODE_HMAC_CURRENT_VERSION

# Key ring (JSON-wrapped random material — no base64: prefix, raw string used as HMAC key bytes)
printf '{"1":"%s"}' "$(openssl rand -base64 32)" \
  | mise exec -- npx wrangler secret put GIFT_CARD_CODE_HMAC_KEYS_JSON
```

### Generate and store the delivery ring (production)
```bash
# Version (plain integer, not random)
printf '1' | mise exec -- npx wrangler secret put GIFT_CARD_DELIVERY_CURRENT_VERSION

# Key ring (JSON-wrapped, base64:-prefixed 32-byte AES key)
printf '{"1":"base64:%s"}' "$(openssl rand -base64 32)" \
  | mise exec -- npx wrangler secret put GIFT_CARD_DELIVERY_KEYS_JSON
```
Neither pipeline writes the generated value to a file, to a variable that outlives the pipeline, or
to stdout — `openssl rand`'s output only ever exists inside the `$(...)` substitution feeding
`printf`, which feeds `wrangler secret put`'s stdin directly.

### Proof (names only, per D-01)
```bash
mise exec -- npx wrangler secret list
```

### Local dev values (separately generated, D-02) — append to `.dev.vars`
```bash
{
  printf 'GIFT_CARD_CODE_HMAC_CURRENT_VERSION=1\n'
  printf 'GIFT_CARD_CODE_HMAC_KEYS_JSON={"1":"%s"}\n' "$(openssl rand -base64 32)"
  printf 'GIFT_CARD_DELIVERY_CURRENT_VERSION=1\n'
  printf 'GIFT_CARD_DELIVERY_KEYS_JSON={"1":"base64:%s"}\n' "$(openssl rand -base64 32)"
} >> .dev.vars
```
Per Pitfall 6, `.dev.vars` is the file that matters for `npm run dev` to see these values (via
`getCloudflareContext()`); appending the same block to `.env.local` is harmless but not load-bearing
for these four variables specifically — do not rely on `.env.local` alone.

### Existing unit-test pattern to extend (discretionary; source: `tests/unit/lib/gift-cards/config.test.ts`)
```ts
// A 32-byte placeholder round-trips through the delivery-ring parser.
const placeholder32 = 'base64:' + 'A'.repeat(43) + '='; // 32 zero-ish bytes, canonical padding
// A 31-byte key is rejected (existing pattern at config.test.ts:69-75 covers the analogous case).
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "The storefront's redeem-code UI" (D-06 discretion note) refers to the `giftCardToken` API parameter on `/api/payment-intent`, not a rendered component — no dedicated redemption-form component was found in `components/checkout/` or `app/checkout/` in this session's search | Architecture Patterns | If a redemption UI does exist elsewhere and was missed, the planner should verify what visibly changes for a shopper when acquisition flips; low risk since ACQUISITION mainly governs *new gift-card purchase*, which SHOP-01..06 already built |
| A2 | `openssl rand -base64 32`'s output is always canonical standard base64 (44 chars, exactly one trailing `=`) across the `openssl` version installed in this environment (3.6.2) and in the executor's actual runtime environment | Code Examples, Architecture Patterns | Extremely low — this is a well-established property of base64 encoding of a fixed 32-byte input; not implementation-specific to any `openssl` version |
| A3 | `@opennextjs/cloudflare`'s `initOpenNextCloudflareForDev()` backs `getCloudflareContext()` with `.dev.vars` (not `.env.local`) during `next dev`, based on this session's reading of `next.config.ts` and the project's own documented convention (`AGENTS.md`, `docs/CLAUDE.md` troubleshooting section: "confirm Clerk keys are set in `.dev.vars`") rather than a direct read of the `@opennextjs/cloudflare` package source | Pitfall 6 | If wrong, D-12's original one-line comment might have been closer to correct; low risk since two independent doc sources in this repo already describe `.dev.vars` as the local-secret file regardless of runner |

**If this table is empty:** N/A — see above.

## Open Questions

1. **Does an authenticated `GET /api/gift-cards` check need to be scripted, or is it acceptable for
   Russell to run it manually from a browser as part of the D-07 checkpoint conversation?**
   - What we know: the endpoint requires a live Clerk session; no service-token bypass was found for
     this specific route (grep of `app/api/gift-cards/route.ts` shows only `auth()`, no
     `X-API-Key`/bearer-token branch).
   - What's unclear: whether the executor has any mechanism to obtain an authenticated session
     programmatically (e.g., a stored admin Clerk session token) without Russell's involvement.
   - Recommendation: default to the `wrangler deployments list` + cron-telemetry-watch pair as the
     automated proof, and treat the authenticated endpoint check as something Russell does once,
     conversationally, at or after the D-07 checkpoint — not a blocking automated step.

2. **Exact wording/section number for `docs/DEPLOYMENT_SETUP.md`'s new `## 9. Gift Card Enablement`.**
   - What we know: it attaches after the existing `## 8. Going Live (Production Keys)` section
     (file ends at line 480 with `**Your Mercora platform is now ready for production.**`).
   - What's unclear: whether the closing tagline line should move below the new section or stay as
     the file's final line with `## 9` inserted before it.
   - Recommendation: insert `## 9. Gift Card Enablement` immediately before the closing tagline line,
     keeping the tagline as the file's true final line (matches the existing "guide ends with a
     confidence statement" pattern) — Claude's Discretion per CONTEXT.md, left to the planner/executor.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `openssl` | Key generation (D-01, D-02) | ✓ | 3.6.2 | — |
| `wrangler` (via `npx`) | `secret put`, `secret list`, `deployments list` | ✓ | 4.129.0 (`node_modules/wrangler/package.json`, confirmed pinned via `chore(deps-dev): bump wrangler to ^4.129.0` commit `b4a5d40`) | — |
| `mise` / Node 24.18.1 | All `mise exec --` invocations | ✓ | v24.18.1 | — |
| Cloudflare account access (Russell's OAuth) | `wrangler secret put` against production | Not verified this session (no production write attempted, per instructions) | — | None — this phase cannot proceed without it; same precondition Phase 1/9 already relied on |

**Missing dependencies with no fallback:** None observed; production OAuth access is assumed present
per the Phase 1/9 precedent and was not itself tested (research must not run write commands against
production).

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest.config.mts`) |
| Config file | `vitest.config.mts` (unit), `vitest.workers.config.mts` (Workers integration), `vitest.observability.config.mts` (tail-worker) |
| Quick run command | `mise exec -- npx vitest run tests/unit/lib/gift-cards/config.test.ts` |
| Full suite command | `mise exec -- npm test && mise exec -- npm run test:workers && mise exec -- npm run test:observability-worker` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | Placeholder-shape key rings the docs/`.env.example` describe are accepted by the real parsers; an under-length key is rejected | unit | `mise exec -- npx vitest run tests/unit/lib/gift-cards/config.test.ts` | ✅ (extend existing file per Claude's Discretion — placeholder-shape assertions, no production values) |
| OPS-01 | No secret value appears in git history / tracked files after this phase | other (shell) | `git log -p --all -- wrangler.jsonc cloudflare-env.d.ts .env.example docs/ \| grep -E '(GIFT_CARD_(CODE_HMAC\|DELIVERY)_KEYS_JSON=.{20,}\|base64:[A-Za-z0-9+/]{20,})'` (expect empty) | ❌ Wave 0 — this is a one-off audit command, not a persisted test file |
| OPS-02 | `resolveCommerceCapabilities` still throws when acquisition is enabled without reconciliation (regression guard for the flag-order rule) | unit | `mise exec -- npx vitest run tests/unit/lib/commerce/capabilities.test.ts` (locate exact path during planning; existing coverage per `lib/commerce/capabilities.ts:158-160`) | ✅ — already covered by existing suite, confirm path during planning |
| OPS-02 | `cloudflare-env.d.ts` regenerates clean and `cf-typecheck` passes after each flag flip | other | `mise exec -- npm run cf-typegen && mise exec -- npm run cf-typecheck` | N/A — CI-mirroring command, not a test file |
| OPS-03 | `docs/runtime-configuration.md` and `docs/DEPLOYMENT_SETUP.md` stay lint-clean after edits | other | `mise exec -- npm run docs:lint` | ✅ — `scripts/docs-lint.mjs` exists |
| OPS-04 | `.env.example` names all four secrets with placeholder values | other (shell/grep) | `grep -c 'GIFT_CARD_' .env.example` (expect ≥4 lines: 2 HMAC + 2 delivery) | ❌ Wave 0 — simple grep assertion, could be promoted to a `tests/unit/scripts/` source-contract test per Claude's Discretion |

### Sampling Rate
- **Per task commit:** `mise exec -- npm run lint && mise exec -- npm run typecheck && mise exec -- npx vitest run tests/unit/lib/gift-cards/config.test.ts`
- **Per wave merge:** `mise exec -- npm run docs:lint && mise exec -- npm run cf-typecheck && mise exec -- npm test`
- **Phase gate:** Full CI-mirroring subset green before `/gsd-verify-work 11` (per Phase 9's precedent: `docs:lint`, `lint`, `typecheck`, `npm test`), plus the two live D-06 checks (deployments list + cron-telemetry watch) recorded with their real command output, not asserted.

### Wave 0 Gaps
- [ ] A placeholder-shape acceptance/rejection test extending `tests/unit/lib/gift-cards/config.test.ts` (or a new adjacent file) — covers OPS-01's "generated with at least 32-byte secrets" requirement at the parser level without ever touching a real secret.
- [ ] A source-contract test (or documented grep command) asserting `.env.example` contains all four gift-card variable names — covers OPS-04.
- [ ] No new fixtures or shared conftest-equivalent needed; existing test infrastructure (Vitest, no setup files beyond `vitest.config.mts`) covers this phase's testing needs.

*No test-framework installation needed — Vitest is already fully configured and used by the exact
module (`lib/gift-cards/config.ts`) this phase's tests extend.*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase does not touch authentication; `GET /api/gift-cards`'s existing Clerk `auth()` gate is unchanged |
| V3 Session Management | No | Unchanged |
| V4 Access Control | No | Unchanged — no new route, no new role check |
| V5 Input Validation | No | The parsers this phase must satisfy already exist and are already tested; this phase does not modify validation logic |
| V6 Cryptography | **Yes** | Key material MUST be generated with a CSPRNG (`openssl rand`, backed by the OS CSPRNG) at ≥32 bytes for the HMAC ring and exactly 32 bytes (AES-256) for the delivery ring — both already enforced by existing parsers; this phase's only cryptography-adjacent responsibility is *not weakening* that by generating shorter/predictable values, which the locked D-01/D-03 pipeline already prevents |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret value leaked via shell history, process list, or tool output | Information Disclosure | Pipe generation directly into `wrangler secret put`'s stdin (never `echo "value" | wrangler secret put`, never an intermediate variable/file) — this is exactly what D-01 already specifies; the existing `docs/DEPLOYMENT_SETUP.md` §8 Step 2 example (`echo "sk_live_..." | npx wrangler secret put ...`) is a **weaker pattern than D-01's** (the literal value sits in the command text/shell history) and should NOT be copied into the new §9 section — use the `printf '...%s...' "$(openssl rand ...)"` form throughout instead |
| Secret committed accidentally to `wrangler.jsonc`, docs, or `.env.local`/`.dev.vars` tracked by git | Information Disclosure / Tampering | `.gitignore` already covers `.env*.local` and `.dev.vars*` (`[VERIFIED: .gitignore:22-23,33]`); `.env.example` and doc edits use placeholder text only, verified by `scripts/docs-lint.mjs`'s `checkCredentialShapes` (UUID and Stripe-key-shaped-string regexes — note this check does **not** currently pattern-match a 32-byte-base64-shaped string, so a real key value pasted into a doc would **not** be caught by `docs:lint`; discipline, not tooling, is the actual control here) |
| Acquisition enabled without reconciliation → live-money capability misconfiguration | Elevation of Privilege (of a sort — new unverified reservations) | `lib/commerce/capabilities.ts:158-160` already fails closed with `CommerceCapabilityConfigurationError`; D-05's flag order (reconciliation, verify, then acquisition) is the operational mitigation this phase must follow exactly |
| Malformed key ring deployed silently, gift cards fail-open | Repudiation / Denial of Service (fails closed, not open, per code review) | Both parsers throw `GiftCardRuntimeConfigurationError` on any malformed shape (verified this session) — the code already fails closed; this phase's job is to make failures *observable* quickly (D-06's cron-cycle watch), not to add new fail-closed logic |

## Sources

### Primary (HIGH confidence)
- `lib/gift-cards/config.ts` (full file, 150 lines) — read this session
- `lib/gift-cards/encryption.ts` (full file, 362 lines) — read this session
- `lib/gift-cards/code.ts` (lines 1-200) — read this session
- `lib/gift-cards/runtime.ts` (full file, 65 lines) — read this session
- `lib/commerce/capabilities.ts` (full file, ~230 lines) — read this session
- `lib/commerce/runtime.ts` (grep-confirmed lines 25-28) — read this session
- `lib/observability/scheduled.ts` (full file, 74 lines) — read this session
- `lib/observability/telemetry.ts` (lines 1-260) — read this session
- `lib/services/gift-card-fulfillment.ts` (full file, ~230 lines) — read this session
- `lib/services/order-effects.ts` (lines 260-290, 440-470) — read this session
- `lib/store-config.ts` (lines 400-450) — read this session
- `app/api/gift-cards/route.ts` (full file, 32 lines) — read this session
- `app/api/gift-cards/balance/route.ts` (full file, 43 lines) — read this session
- `app/api/payment-intent/route.ts` (grep-confirmed lines 92-102) — read this session
- `workers/observability-tail/src/core.ts` (lines 1-40) — read this session
- `wrangler.jsonc` (lines 100-130) — read this session
- `next.config.ts` (full file) — read this session
- `.gitignore` (env/vars lines) — read this session
- `.env.example` (lines 1-70) — read this session
- `docs/runtime-configuration.md` (lines 1-90) — read this session
- `docs/DEPLOYMENT_SETUP.md` (lines 1-480) — read this session
- `docs/checkout-trust-boundary.md` (lines 45-65) — read this session
- `scripts/docs-lint.mjs` (full file) — read this session
- `scripts/check-deploy-config.mjs` (grep-confirmed) — read this session
- `package.json` (lines 1-45) — read this session
- `tests/unit/lib/gift-cards/config.test.ts` (full file, 77 lines) — read this session
- `.planning/PROJECT.md` (Key Decisions table, lines 200-230) — read this session
- Context7 `/cloudflare/workers-sdk` — `packages/wrangler/src/secret/index.ts` (secret-put command source, including `VERSION_NOT_DEPLOYED_ERR_CODE` handling and stdin/TTY behavior)

### Secondary (MEDIUM confidence)
- None beyond the primary sources above — this phase's domain is entirely internal to the already-read codebase and one external CLI (wrangler), both confirmed via direct source reads.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new packages this phase
- Architecture: HIGH — every flag-read site, parser, and capability-gating branch was read in full or in confirmed excerpt this session
- Pitfalls: HIGH — the two most consequential findings (balance-endpoint opacity, no `gift_card.*` event name) were discovered by reading the actual route/telemetry source, not inferred

**Research date:** 2026-09-08
**Valid until:** 30 days (stable, internal-codebase-driven domain; re-verify if `lib/gift-cards/*`, `lib/commerce/capabilities.ts`, or the wrangler major version changes before this phase executes)
