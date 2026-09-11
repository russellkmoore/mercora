---
phase: 19-operator-checklist
verified: 2026-09-11T16:20:00Z
status: passed
score: 3/3 must-haves verified
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - "wrangler.jsonc"
  - "docs/runtime-configuration.md"
  - "AGENTS.md"
covered_digest: "n/a — human-checkpoint phase, evidence-based verification"
human_verification:
  - "Stripe Tax enabled on the live Stripe Dashboard account — Russell confirmed directly"
---

# Phase 19 — Verification

**Goal:** The three operator items that only Russell can do are done and proven from the outside.

## Requirements

### OPS-05 — Stripe Tax enabled
**Status:** passed (human-confirmed)
Russell enabled Stripe Tax directly in the Stripe Dashboard (2026-09-11). This is a Stripe account-level setting this session has no API access to toggle or verify remotely without placing a real order; the code path itself (`quote.taxSource`, `configured_fallback` vs `provider`) was already built and exercised in earlier phases — before this change, every recent production order showed `tax_source: "configured_fallback"` (confirmed by direct D1 query, see 19-CONTEXT.md). The fallback stays in place as the documented degraded mode per the requirement's own wording. The next real order will record `tax_source: "provider"`; no order has been placed since the toggle to observe this directly.

### OPS-06 — Support email reachable
**Status:** passed (verified live)
`STORE_SUPPORT_EMAIL` set to `support@russellkmoore.me` in `wrangler.jsonc` (commit `03a4acc`), deployed, and confirmed live: `curl https://voltique.russellkmoore.me/` shows `mailto:support@russellkmoore.me` in the footer (verified after edge-cache lag cleared). Same domain as the already-working `STORE_SENDER_EMAIL`.

### OPS-07 — Secrets correct
**Status:** passed (verified live, read-only)
`wrangler secret list` against production (2026-09-11) confirms: `ORDER_STATUS_SECRET` present (64 random bytes, generated locally and piped directly to `wrangler secret put`, never printed), `EMAIL_UNSUBSCRIBE_SECRET_CURRENT` present (same method), `ADMIN_USER_IDS` absent (deleted; confirmed no code references it before deletion). Docs name the secrets, never their values, per `AGENTS.md`'s existing convention — no doc change needed.

## Sign-off

All three items verified either live (OPS-06, OPS-07) or by Russell's direct confirmation of a dashboard action outside this session's reach (OPS-05). No code changes were required for this phase — every task was configuration or account-level action.

**Approval:** Russell, 2026-09-11 (executed the checklist directly in this conversation)
