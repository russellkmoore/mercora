# Phase 19: Operator Checklist - Context

**Gathered:** 2026-09-11
**Status:** Blocked on Russell — every task requires dashboard access this session does not have.

<domain>
## Phase Boundary

Three items only Russell can do, each verified with a live, read-only check so the checklist below is fact, not guesswork. Requirements OPS-05, OPS-06, OPS-07.
</domain>

<evidence>
## Verified current state (read-only checks this session, 2026-09-11)

- **OPS-05 (Stripe Tax):** the five most recent production orders all show `tax_source: "configured_fallback"` (D1 query against `orders.extensions`), none show `"provider"`. Stripe Tax is not enabled on the live account; the store is charging the configured flat-rate fallback, not calculated tax.
- **OPS-06 (support email):** `STORE_SUPPORT_EMAIL` is not set anywhere in `wrangler.jsonc`; `lib/store-config.ts:91` falls back to the placeholder `support@mercora.example.com`, which is what the live storefront's contact/support links currently show.
- **OPS-07 (secrets):** `wrangler secret list` against production shows `ADMIN_USER_IDS` present (the stale secret to remove) and does **not** list `ORDER_STATUS_SECRET` or `EMAIL_UNSUBSCRIBE_SECRET_CURRENT` — both are genuinely missing from the Worker's runtime secrets. This does not fail deploys because `scripts/check-deploy-config.mjs` validates a *build-time* environment variable, not the deployed Worker's actual secret store, so the gap has been invisible to CI.

None of this can be closed from here: Stripe Tax is a Stripe Dashboard setting, `STORE_SUPPORT_EMAIL` needs a real inbox behind it before it's set, and adding/removing Worker secrets needs the actual secret values, which this session must never read or generate on Russell's behalf.
</evidence>

<deferred>
## Deferred Ideas

None — this phase's only content is the checklist above.
</deferred>

---

*Phase: 19-operator-checklist*
*Context gathered: 2026-09-11 — hands off to Russell; no further autonomous action possible on this phase*
