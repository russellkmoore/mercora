# Phase 11: Production Enablement - Pattern Map

**Mapped:** 2026-09-08
**Files analyzed:** 8 (config-only, no `lib/`/`app/` code changes in scope)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `wrangler.jsonc` (`vars` block) | config | CRUD (add key-value pairs) | Existing `STORE_FEATURE_SUBSCRIPTION_*` entries, same file, lines 118-124 | exact |
| `cloudflare-env.d.ts` | config (generated) | transform (codegen output) | Commit `9df5ed9` (added subscription flags + regenerated types) and `24f964e` (regenerate-only commit) | exact |
| `docs/runtime-configuration.md` | config/docs | request-response (reference doc) | Existing HMAC-ring table row (line 22) + paragraph (lines 55-64) in the same file | exact |
| `docs/DEPLOYMENT_SETUP.md` (new `## 9`) | config/docs | batch (step-by-step runbook) | §6 Step 1b table (lines 358-384), §4 Step 2 sliced-seed-apply (lines 279-296), §8 Going Live (lines 446-479) | exact |
| `.env.example` | config | CRUD (env var template) | Existing gift-card HMAC comment block, lines 33-38 | exact |
| Extend `tests/unit/lib/gift-cards/config.test.ts` | test | transform (parser accept/reject) | Same file's existing `it.each` malformed-input block (lines 15-31) and delivery-ring tests (lines 57-75) | exact |
| Source-contract test for `.env.example`/`wrangler.jsonc` shape | test | CRUD (config presence assertion) | `tests/unit/scripts/check-deploy-config.test.ts` (validates `validateOrderStatusConfig` against `scripts/check-deploy-config.mjs`) | role-match |
| Shell pipelines for `wrangler secret put` / `.dev.vars` append | shell/ops | event-driven (one-shot ops action) | `.planning/PROJECT.md` line 222 — `ADMIN_VECTORIZE_TOKEN` rotation record | exact |

## Pattern Assignments

### `wrangler.jsonc` (`vars` block, config, CRUD)

**Analog:** `wrangler.jsonc` lines 110-124 (same file, existing subscription-flag block)

```jsonc
"vars": {
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_test_...",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_test_...",
  "NEXT_PUBLIC_IMAGE_CDN": "https://voltique-images.russellkmoore.me",
  "NEXT_PUBLIC_SITE_URL": "https://voltique.russellkmoore.me",
  // Deploy-time fallback for getActiveTheme() (D-10). Must also be added
  // as a Workers Build variable in the Cloudflare Dashboard per the
  // project rule for NEXT_PUBLIC_* vars (see 06-02 user setup).
  "NEXT_PUBLIC_THEME_DEFAULT": "volt-dark",
  // Subscriptions (docs/subscriptions.md). Reconciliation must stay on once
  // the first subscription exists; disable acquisition first to stop sales.
  // The terms version must match the recurring-terms section published on
  // the Terms of Service page.
  "STORE_FEATURE_SUBSCRIPTION_RECONCILIATION": "true",
  "STORE_FEATURE_SUBSCRIPTION_ACQUISITION": "true",
  "STORE_SUBSCRIPTION_TERMS_VERSION": "2026-09-07"
},
```

**Pattern to copy:** string `"true"` values, added as their own two lines, each preceded by an explanatory comment block that (a) names the feature, (b) states the reconciliation-before-acquisition rule, (c) links the runtime-configuration doc. Two separate commits per D-05/D-08 — reconciliation flag lands alone first, acquisition flag lands in a second commit after the D-06/D-07 gate. Never add a secret value here — only the two boolean-as-string flags belong in this block for gift cards.

---

### `cloudflare-env.d.ts` (generated, config)

**Analog:** commit `9df5ed9` (feature commit that added `STORE_FEATURE_SUBSCRIPTION_*` to both `wrangler.jsonc` and regenerated this file in the same commit) and `24f964e` ("chore: regenerate cloudflare-env.d.ts to match CI" — a regenerate-only commit, useful as the template for the acquisition-flag-only follow-up commit).

**Current shape to extend** (lines 20-21, 35):
```ts
STORE_FEATURE_SUBSCRIPTION_RECONCILIATION: string;
STORE_FEATURE_SUBSCRIPTION_ACQUISITION: string;
...
interface ProcessEnv extends StringifyValues<Pick<Cloudflare.Env,
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" | "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" |
  "NEXT_PUBLIC_IMAGE_CDN" | "NEXT_PUBLIC_SITE_URL" | "NEXT_PUBLIC_THEME_DEFAULT" |
  "STORE_FEATURE_SUBSCRIPTION_RECONCILIATION" | "STORE_FEATURE_SUBSCRIPTION_ACQUISITION" |
  "STORE_SUBSCRIPTION_TERMS_VERSION"
>> {}
```

**Pattern to copy:** never hand-edit this file. Run `mise exec -- npm run cf-typegen` (after moving `.env.local` aside per the recorded convention, restoring after) then `mise exec -- npm run cf-typecheck`. Two flags → two flag-flip commits, each touching only `wrangler.jsonc` + this regenerated file (D-08). `GIFT_CARD_CODE_HMAC_*` / `GIFT_CARD_DELIVERY_*` secret names do NOT appear here — secrets are not `vars`, so `cf-typegen` will not add them; only the two new `STORE_FEATURE_GIFT_CARD_*` string vars appear, mirroring the subscription pair.

---

### `docs/runtime-configuration.md` (config/docs)

**Analog:** same file's existing HMAC-ring row and paragraph.

**Table row to mirror** (line 22):
```
| Gift-card bearer lookup secrets | Server-only `GIFT_CARD_CODE_HMAC_CURRENT_VERSION` plus `GIFT_CARD_CODE_HMAC_KEYS_JSON` (at most four versioned keys; never `NEXT_PUBLIC_*`) |
```
Add a sibling row immediately after it (per D-10):
```
| Gift-card delivery encryption secrets | Server-only `GIFT_CARD_DELIVERY_CURRENT_VERSION` plus `GIFT_CARD_DELIVERY_KEYS_JSON` (at most four versioned AES-256 keys, base64-encoded, `base64:`-prefixed; never `NEXT_PUBLIC_*`) |
```

**Paragraph to mirror** (lines 55-64, the existing HMAC-ring paragraph):
```
`GIFT_CARD_CODE_HMAC_KEYS_JSON` is a JSON object whose canonical positive
integer property names are key versions, for example `{"1":"<32+ byte
secret>","2":"<32+ byte secret>"}`. The current version must be present,
and the ring is bounded to four keys. Store these values in local `.dev.vars`
or encrypted Cloudflare secrets. They are intentionally absent from
`StoreConfig`, browser configuration, committed deployment files, telemetry,
and errors.
```
Write a matching paragraph for `GIFT_CARD_DELIVERY_KEYS_JSON`, changing only: `base64:`-prefixed value shape, exactly 32 decoded bytes (AES-256, `GIFT_CARD_DELIVERY_KEY_BYTES` from `lib/gift-cards/encryption.ts`), same "current version required, ring bounded to four, `.dev.vars`/Cloudflare secrets only, absent from `StoreConfig`" language. Keep the existing gift-card acquisition/reconciliation paragraph (lines 60-64, already present) unchanged — it already documents the flag-order rule; do not duplicate it.

---

### `docs/DEPLOYMENT_SETUP.md` — new `## 9. Gift Card Enablement` (config/docs)

**Analogs, three sections in the same file:**

1. **§6 Step 1b table style** (lines 358-384) — two-column-plus markdown table with a "Where it must live / Why" shape; §9 should use a similarly tight table or numbered steps, not prose paragraphs, for the four-secret + two-flag sequence.
2. **§4 Step 2 sliced-seed-apply style** (lines 279-296) — shows the pattern of: short intro sentence, fenced bash block with inline comments, a closing sentence about why the mechanism exists. Use this shape for each of §9's steps (generate → put secret → verify → flip flag).
3. **§8 Going Live** (lines 446-479) — closest structural analog for a "flip production over to the real thing" section: numbered `### **Step N: ...**` subheadings, each with a fenced bash block. **Do NOT copy its literal secret-put line** — `echo "sk_live_..." | npx wrangler secret put ...` puts the value in shell history and command text. Per RESEARCH.md's flagged Pitfall, use the non-materializing form instead:

```bash
# Correct pattern (from RESEARCH.md Code Examples, verified against
# lib/gift-cards/config.ts and encryption.ts):
printf '1' | mise exec -- npx wrangler secret put GIFT_CARD_CODE_HMAC_CURRENT_VERSION
printf '{"1":"%s"}' "$(openssl rand -base64 32)" \
  | mise exec -- npx wrangler secret put GIFT_CARD_CODE_HMAC_KEYS_JSON
printf '1' | mise exec -- npx wrangler secret put GIFT_CARD_DELIVERY_CURRENT_VERSION
printf '{"1":"base64:%s"}' "$(openssl rand -base64 32)" \
  | mise exec -- npx wrangler secret put GIFT_CARD_DELIVERY_KEYS_JSON
```

Insert `## 9. Gift Card Enablement` immediately before the file's closing tagline (`**Your Mercora platform is now ready for production.**`), keeping that line as the true final line of the file (matches the file's existing "ends with a confidence statement" convention). Link `docs/runtime-configuration.md` for the variable contract; name no value, account id, or database id — matches the existing convention across §1-§8 (no live account IDs ever appear in this file, only placeholder/instructional text).

---

### `.env.example` (config)

**Analog:** same file, existing gift-card comment block (lines 30-38).

```
# Gift cards use separate acquisition and reconciliation switches. Acquisition
# requires reconciliation. Keep reconciliation enabled while any durable
# reservation or balance exists, even when new bearer-code entry is disabled.
# STORE_FEATURE_GIFT_CARD_RECONCILIATION=false
# STORE_FEATURE_GIFT_CARD_ACQUISITION=false
# Server-only versioned HMAC lookup ring. Put real values in `.dev.vars` or
# encrypted Workers secrets; never prefix these variables with NEXT_PUBLIC_.
# GIFT_CARD_CODE_HMAC_CURRENT_VERSION=1
# GIFT_CARD_CODE_HMAC_KEYS_JSON={"1":"generate-at-least-32-random-bytes"}
```

**Pattern to copy (D-11):** add two more commented lines directly after the HMAC pair, same indentation/comment style, placeholder text that cannot be mistaken for a real key:
```
# GIFT_CARD_DELIVERY_CURRENT_VERSION=1
# GIFT_CARD_DELIVERY_KEYS_JSON={"1":"base64:generate-32-bytes-then-base64-encode"}
```
**D-12 comment line (per Pitfall 6 correction — do not use the originally proposed `.env.local` wording):** add one line near this block stating gift-card secrets (and other Cloudflare bindings/secrets) are read from `.dev.vars` because `next.config.ts` calls `initOpenNextCloudflareForDev()`, which backs `getCloudflareContext()` with `.dev.vars`, not `.env.local`. `.env.local` only supplies `NEXT_PUBLIC_*`/plain `process.env` values. This matches the existing instructional tone already used at the bottom of `.env.example` ("Instructions: 1. Copy this file to .env.local").

---

### `tests/unit/lib/gift-cards/config.test.ts` (test, transform)

**Analog:** same file's existing structure — top-of-file constant fixtures (`current`, `previous`), a `describe` block, `it.each` for malformed-input rejection, individual `it` blocks for the delivery ring (lines 57-75, already covers a 16-byte-decoded rejection).

**Pattern to copy** for the new placeholder-shape test (Claude's Discretion item in CONTEXT.md/RESEARCH.md):
```ts
// A 32-byte placeholder round-trips through the delivery-ring parser
// (matches the documented .env.example / docs/DEPLOYMENT_SETUP.md §9 shape).
it("accepts the documented delivery-ring placeholder shape", () => {
  const placeholder = "base64:" + "A".repeat(43) + "=";
  expect(parseGiftCardDeliveryKeyRing({
    GIFT_CARD_DELIVERY_CURRENT_VERSION: "1",
    GIFT_CARD_DELIVERY_KEYS_JSON: JSON.stringify({ 1: placeholder }),
  })).toEqual({ currentVersion: 1, keys: { 1: placeholder } });
});

it("rejects a 31-byte delivery key (one byte under the documented minimum)", () => {
  // existing pattern at lines 69-75 covers the analogous 16-byte case —
  // extend with a boundary-adjacent (31-byte) value per Claude's Discretion.
});
```
Follow the existing file's `toThrow('Gift-card runtime configuration is unavailable')` assertion style for rejections, and the existing `toEqual` exact-object assertion style for acceptances. Do not add a new top-level `describe` — extend the existing one.

---

### Source-contract test for `.env.example` shape (test, CRUD)

**Analog:** `tests/unit/scripts/check-deploy-config.test.ts` (imports `validateOrderStatusConfig` from `@/scripts/check-deploy-config.mjs`, asserts throw/no-throw against fixture env objects).

```ts
import { describe, expect, it } from "vitest";
import { validateOrderStatusConfig } from "@/scripts/check-deploy-config.mjs";

const SECRET = "deployment-test-order-status-secret-0123456789";

describe("validateOrderStatusConfig", () => {
  it("requires a non-placeholder secret when guest links are enabled", () => {
    expect(() => validateOrderStatusConfig(
      { ORDER_STATUS_GUEST_LINKS_ENABLED: "true" },
    )).toThrow(/ORDER_STATUS_SECRET/);
    ...
  });
});
```

**Applicability note:** this is a role-match, not an exact analog — `check-deploy-config.mjs` validates a *runtime* config object, not a static file's text content. RESEARCH.md's own test map (OPS-04 row) lists the actual `.env.example` coverage as a Wave-0 gap solvable with a plain grep (`grep -c 'GIFT_CARD_' .env.example`, expect ≥4), not a new script module. If the planner wants a persisted test rather than a documented grep command, the closer shape is a small new `tests/unit/scripts/env-example-shape.test.ts` that reads `.env.example` with `fs.readFileSync` and asserts (via regex, not import) that all four `GIFT_CARD_DELIVERY_*`/`GIFT_CARD_CODE_HMAC_*` names appear — there is no existing file that reads `.env.example` as text to copy from; this would be a new, small pattern modeled loosely on `check-deploy-config.test.ts`'s fixture-and-assert style but reading a file instead of calling a function.

---

### Shell pipelines: `wrangler secret put` / `.dev.vars` append (shell/ops, event-driven)

**Analog:** `.planning/PROJECT.md` line 222 (Key Decisions table, Phase 1):
```
`ADMIN_VECTORIZE_TOKEN` rotated by the executor with a single
`openssl rand -hex 32 | wrangler secret put` pipeline; verified only with
the old value (Phase 1) — Value never printed or stored; proof is two live
401s. Required pushing `main` first because Cloudflare refuses secret edits
when the latest uploaded version is not deployed.
```

**Pattern to copy:** single pipeline, value never touches a variable/file, generation command feeds directly into `wrangler secret put`'s stdin, verification uses only names/observable side effects (never the value itself). If `wrangler secret put` fails with "latest version of your Worker isn't currently deployed," push `main` first and retry (documented Pitfall 4 in RESEARCH.md, same failure mode Phase 1 hit). Exact pipelines for this phase (already vetted against `lib/gift-cards/config.ts` / `encryption.ts` — see RESEARCH.md Code Examples section, reproduced verbatim there): HMAC ring uses a bare `openssl rand -base64 32` (no `base64:` prefix — raw string is the HMAC key material per `lib/gift-cards/code.ts:95-107`); delivery ring uses `base64:$(openssl rand -base64 32)` (prefix required per `lib/gift-cards/config.ts:134,139`). All four `mise exec -- npx wrangler secret put <NAME>` under Russell's OAuth login; proof is `mise exec -- npx wrangler secret list` (names only).

## Shared Patterns

### "Never materialize a secret" pipeline shape
**Source:** RESEARCH.md Code Examples section (verified against `lib/gift-cards/config.ts`, `lib/gift-cards/code.ts`, `lib/gift-cards/encryption.ts`) and `.planning/PROJECT.md` line 222.
**Apply to:** every `wrangler secret put` invocation in this phase — production and `.dev.vars` local values alike. Generation output only ever exists inside a `$(...)` substitution feeding directly into `printf`/`wrangler secret put` stdin; never assigned to a shell variable, never `echo`ed, never written to a file outside `.dev.vars` (and even there, appended via a subshell block, values never echoed to the terminal).

### Reconciliation-before-acquisition flag order
**Source:** `lib/commerce/capabilities.ts:158-160` (fails closed with `CommerceCapabilityConfigurationError` if acquisition is on without reconciliation) and the existing subscription-flag precedent in `wrangler.jsonc`/`docs/runtime-configuration.md`.
**Apply to:** `wrangler.jsonc` commit order (D-05/D-08), `docs/DEPLOYMENT_SETUP.md` §9 step order, and `docs/runtime-configuration.md` prose — all three must state/enforce the same order, matching how the subscription-flag pair already documents it in three places (code, `wrangler.jsonc` comment, `docs/runtime-configuration.md` paragraph).

### `mise exec --` prefix for every command
**Source:** `AGENTS.md` prerequisites (Node 24.18.1 pinned via `mise`) and RESEARCH.md's explicit requirement.
**Apply to:** every `npx wrangler ...`, `npm run cf-typegen`, `npm run cf-typecheck`, `npx vitest run ...` invocation in this phase's plan and its executed shell steps.

### Doc header/credential-shape lint constraints
**Source:** `scripts/docs-lint.mjs` — `checkHeaderConvention` (lines 268-283, requires first line `# ` heading + a `**Status:**` line — already present in both `docs/runtime-configuration.md` and `docs/DEPLOYMENT_SETUP.md`, unaffected by adding a `##` subsection) and `checkCredentialShapes` (lines 249-264, greps every scanned doc line for `UUID_RE`/`STRIPE_KEY_RE` shapes only — **does not** pattern-match a 32-byte-base64-shaped string, so a real key pasted into a doc would not be auto-caught; discipline is the actual control, not tooling, per RESEARCH.md's Security Domain section).
**Apply to:** `docs/runtime-configuration.md` and `docs/DEPLOYMENT_SETUP.md` edits — keep the `# `/`**Status:**` header intact, run `mise exec -- npm run docs:lint` after edits, and never paste a real generated value into either file even though the linter would not catch a base64-shaped one.

## No Analog Found

None. All eight files/edits have a same-file or same-repo analog; the source-contract test for `.env.example` (see above) is a role-match rather than an exact analog — no file in the repo currently reads `.env.example` as text and asserts on its content, so if the planner chooses the "persisted test file" option over the documented-grep option, that specific test file has no direct prior art to copy line-for-line (only the fixture/assert *style* from `check-deploy-config.test.ts`).

## Metadata

**Analog search scope:** `wrangler.jsonc`, `cloudflare-env.d.ts`, `docs/runtime-configuration.md`, `docs/DEPLOYMENT_SETUP.md`, `.env.example`, `tests/unit/lib/gift-cards/config.test.ts`, `tests/unit/scripts/*.test.ts`, `scripts/docs-lint.mjs`, `.planning/PROJECT.md`, `git log` for `wrangler.jsonc`/`cloudflare-env.d.ts`
**Files scanned:** 12
**Pattern extraction date:** 2026-09-08
