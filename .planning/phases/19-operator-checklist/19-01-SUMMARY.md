---
phase: 19-operator-checklist
plan: 19-01
completed: 2026-09-11T16:30:00Z
one_liner: Stripe Tax enabled, support email routed, production secrets corrected — all three operator-only items done and verified from the outside.
---

# Plan 19-01 Summary: Operator Checklist

**Tasks:** 3/3 complete — all executed directly by Russell in conversation, with this session verifying each from the outside where possible.

## What happened

1. **OPS-05 (Stripe Tax):** Russell enabled Stripe Tax directly in the Stripe Dashboard. This session confirmed the pre-toggle state (every recent production order showed `tax_source: "configured_fallback"` via a read-only D1 query) and the toggle itself via Russell's direct confirmation — Stripe account settings are outside this session's reach.
2. **OPS-06 (support email):** Added `STORE_SUPPORT_EMAIL: "support@russellkmoore.me"` to `wrangler.jsonc` (commit `03a4acc`), pushed, deployed, and confirmed live on the storefront footer after edge-cache lag cleared. Russell confirmed the address is already routed via Cloudflare Email Routing to an inbox he checks.
3. **OPS-07 (secrets):** Generated `ORDER_STATUS_SECRET` and `EMAIL_UNSUBSCRIBE_SECRET_CURRENT` locally (64 random bytes each via `openssl rand -base64 48`) and piped each directly into `wrangler secret put` without ever printing the value. Confirmed no code referenced `ADMIN_USER_IDS` before deleting it with `wrangler secret delete`. Verified the final state with `wrangler secret list` — both required secrets present, the stale one gone.

## Verification

- `wrangler secret list` (production): `ORDER_STATUS_SECRET`, `EMAIL_UNSUBSCRIBE_SECRET_CURRENT` present; `ADMIN_USER_IDS` absent.
- `curl https://voltique.russellkmoore.me/` → `mailto:support@russellkmoore.me` present in the footer.
- Stripe Tax: Russell's direct confirmation (dashboard setting, not remotely verifiable without placing a live order).

## Deviations

None. Every task in the plan was executed as written; no code beyond the one `wrangler.jsonc` line was needed.

## Key files

- `wrangler.jsonc` — `STORE_SUPPORT_EMAIL` added
- Production Worker secrets: `ORDER_STATUS_SECRET`, `EMAIL_UNSUBSCRIBE_SECRET_CURRENT` set; `ADMIN_USER_IDS` deleted (no file changes — secrets live outside the repo)
