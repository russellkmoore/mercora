---
phase: 11-production-enablement
reviewed: 2026-09-09T19:10:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - .env.example
  - cloudflare-env.d.ts
  - docs/DEPLOYMENT_SETUP.md
  - docs/runtime-configuration.md
  - tests/unit/lib/gift-cards/config.test.ts
  - tests/unit/scripts/env-example-gift-card-shape.test.ts
  - wrangler.jsonc
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-09-09T19:10:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase adds the two gift-card feature flags to `wrangler.jsonc`, regenerates
`cloudflare-env.d.ts`, documents the delivery key ring and a five-step
enablement recipe in `docs/DEPLOYMENT_SETUP.md`, adds `.env.example`
placeholder lines for the delivery ring, and adds parser-shape tests. No
secret values, credentials, or database/account IDs were introduced. The new
`wrangler secret put` recipe correctly avoids the older
`echo "sk_live…" | wrangler secret put` pattern used elsewhere in the same
file — the value is piped straight from `$(openssl rand -base64 32)` and
never echoed or held in a named shell variable. `wrangler.jsonc` gained only
the two `"true"` string flags, in the same style as the existing subscription
flags. `cloudflare-env.d.ts` correctly contains no `GIFT_CARD_CODE_HMAC_*` /
`GIFT_CARD_DELIVERY_*` names — only the two new `STORE_FEATURE_GIFT_CARD_*`
flag names, which is expected. All 20 tests in the two gift-card test files
pass, and `npm run docs:lint` reports 0 violations.

Cross-checking the new documentation prose against the actual runtime code
(`lib/services/gift-card-fulfillment.ts`, `app/api/gift-cards/route.ts`,
`lib/gift-cards/presentations.ts`, `lib/gift-cards/config.ts`) surfaced three
factual/documentation-accuracy problems that would mislead an operator
running the enablement or troubleshooting recipe, and one undocumented
asymmetry between the two `.env.example` placeholders that the plan itself
flagged as worth checking. None of these are exploitable secrets or crashes,
so all three are Warnings rather than Blockers — but they sit inside a
runbook explicitly written to be followed verbatim during a production
enablement, so getting the mechanism description right matters.

## Warnings

### WR-01: Delivery-ring parse-order claim is reversed from the actual code

**File:** `docs/DEPLOYMENT_SETUP.md:545` (and duplicated in `docs/runtime-configuration.md:82-85`)

**Issue:** Both docs state: "the delivery ring is parsed on every tick
**before** the drain checks whether anything is pending, so a malformed ring
shows up within one cycle even with zero deliveries queued." The actual
implementation in `lib/services/gift-card-fulfillment.ts` does the opposite
order:

```ts
// lib/services/gift-card-fulfillment.ts:200-204
const rows = await environment.DB.prepare(`SELECT gift_card_id FROM gift_card_deliveries
  WHERE deliver_after <= ?
    AND (status = 'pending' OR (status = 'processing' AND lease_expires_at <= ?))
  ORDER BY updated_at, id LIMIT ?`).bind(now, now, limit).all<{ gift_card_id: string }>();
const keys = parseGiftCardDeliveryKeyRing(environment);   // <-- parsed AFTER the pending-rows query
```

The D1 query that determines "whether anything is pending" runs first; the
key-ring parse runs second, unconditionally (not gated on `rows.results.length`).
The end conclusion — a malformed ring still throws even with zero deliveries
queued — happens to remain true because the parse isn't gated behind the row
count, but the stated *mechanism* ("parsed before the drain checks whether
anything is pending") is backwards from the source, and an operator using
this text to reason about an incident (e.g., assuming the DB is never even
queried when the ring is broken) will draw the wrong conclusion.

**Fix:** Correct both passages to describe the real order, e.g.:

```markdown
the delivery ring is parsed immediately after the pending-deliveries query
and before any row is processed, regardless of how many rows came back — so
a malformed ring still fails the cycle even with zero deliveries queued.
```

### WR-02: `GET /api/gift-cards` 503 does not indicate ring health

**File:** `docs/DEPLOYMENT_SETUP.md:548-552`

**Issue:** Step 3's third verification check states: "A signed-in request to
the account gift-card listing endpoint (`GET /api/gift-cards`) returns a
`cards` array; a 503 there means the ring or the database is unhealthy."
`app/api/gift-cards/route.ts` delegates to
`listCustomerGiftCardPresentations` in `lib/gift-cards/presentations.ts`,
which is a plain D1 read (`PRESENTATION_SELECT` joins
`gift_card_accounts`/`gift_card_deliveries`) and never calls
`parseGiftCardCodeKeyRing` or `parseGiftCardDeliveryKeyRing` — grep confirms
zero references to either parser anywhere in `presentations.ts` or
`route.ts`. A 503 from this endpoint can only reflect a D1/DB failure (or an
unrelated thrown error caught by the route's blanket `catch`), never a
malformed key ring. Using this endpoint as a ring-health signal during the
Step 3 gate, as instructed, gives a false negative: the ring could be broken
while this endpoint still returns 200 with `{ cards: [] }` or a populated
array, and the check that would actually catch the malformed-ring case is
check #2 (the cron tail), not this one.

**Fix:** Drop the "or the database" framing for this specific check, or
replace it with wording that matches what the endpoint actually verifies,
e.g.:

```markdown
3. A signed-in request to the account gift-card listing endpoint
   (`GET /api/gift-cards`) returns a `cards` array; a 503 there means the
   database is unhealthy (this endpoint never touches either key ring —
   check #2 is what catches a malformed ring).
```

### WR-03: HMAC-ring placeholder in `.env.example` silently parses successfully, unlike the delivery-ring placeholder, with no warning

**File:** `.env.example:44-47` (compare `.env.example:48-52`)

**Issue:** The delivery-ring comment explicitly warns: "the placeholder below
is rejected by the parser until replaced" (`.env.example:50`), and
`tests/unit/scripts/env-example-gift-card-shape.test.ts` proves that claim.
The HMAC-ring comment carries no equivalent warning — and unlike the delivery
placeholder, the HMAC placeholder `generate-at-least-32-random-bytes` is 33
UTF-8 bytes, one byte **over** `parseGiftCardCodeKeyRing`'s 32-byte floor, so
it parses successfully as-is (confirmed by
`tests/unit/scripts/env-example-gift-card-shape.test.ts`'s own
`"the documented HMAC placeholder parses as written (over the 32-byte
floor)"` test, and by `lib/gift-cards/config.ts`'s
`byteLength < MIN_KEY_BYTES` check, where `MIN_KEY_BYTES = 32`). A developer
who copies this line into `.dev.vars` or a Cloudflare secret without
regenerating a real key gets a configuration that looks valid and starts up
without error, but signs and looks up gift-card codes using a public,
guessable, well-known string as key material. The in-repo test comment
asserts "the file's own comment already carries that instruction" — but the
HMAC comment (`.env.example:44-45`, "Put real values in `.dev.vars` or
encrypted Workers secrets") is generic advice, not the fail-loud, parser-level
guarantee given to the delivery ring ("the placeholder below is rejected by
the parser until replaced"). This is the exact asymmetry the phase's own
review-scope notes call out as needing to be checked, and it is not
documented.

**Fix:** Add a parity warning to the HMAC-ring comment block, e.g.:

```
# Server-only versioned HMAC lookup ring. Put real values in `.dev.vars` or
# encrypted Workers secrets; never prefix these variables with NEXT_PUBLIC_.
# Unlike the delivery ring below, this placeholder is long enough to satisfy
# the parser as written — it will not fail loudly if left in place. Replace
# it with a real key before any deployment: openssl rand -base64 32.
# GIFT_CARD_CODE_HMAC_CURRENT_VERSION=1
# GIFT_CARD_CODE_HMAC_KEYS_JSON={"1":"generate-at-least-32-random-bytes"}
```

---

_Reviewed: 2026-09-09T19:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
