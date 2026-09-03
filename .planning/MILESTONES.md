# Milestones

## v1 Hardening (Shipped: 2026-09-02)

**Delivered:** The live Voltique storefront's docs and code now agree: the published admin token is dead, a misbuilt deploy cannot open the admin bypasses, the silent failure modes have telemetry and regression tests, the four ADRs are locked, and the runbooks and reference docs describe the current system.

**Phases completed:** 4 phases, 17 plans, 46 tasks
**Timeline:** 2026-08-31 (codebase map) → 2026-09-02 (last phase commit), 3 days
**Git range:** `f179b53` → `f716ae2`, 135 commits
**Code changes (excluding `.planning/`):** 51 files, +2,842 / −292 lines (32 code files outside `docs/`, +2,351 / −112)
**Closeout:** verified_closeout — all 4 phases verified, 19/19 requirements complete, artifact audit clear (0 open, 0 carried forward)
**Tech debt accepted:** see `milestones/v1-MILESTONE-AUDIT.md` (operator follow-ups: sitemap Build variable, post-deploy 503 and Analytics Engine checks, tail-consumer alert email; Cloudflare hygiene; mobile performance backlog)

**Key accomplishments:**

- A deployed Worker running a development build now hard-denies every `checkAdminPermissions` credential path (header bypass, Clerk session, and Bearer service token) via a new `lib/auth/deployment-guard.ts` module, proven by an end-to-end tracer test plus 15 isolated boundary/regression tests.
- `authenticateRequest` and `middleware.ts` now both fail closed with a real HTTP 503 on a deployed development build — the last two open choke points from `01-01` — and `docs/admin-authentication.md`/`docs/DEPLOYMENT_SETUP.md` document the guard as shipped, including the residual 401-vs-503 status-code gap for six non-`/api/admin` callers.
- Scrubbed the published `voltique-admin` token from `docs/CLAUDE.md`, replaced every URL-query credential example across three docs with header forms, and rewrote `docs/admin-authentication.md` to describe the real `isUserAdmin`/`adminUsers` mechanism instead of the phantom `ADMIN_USER_IDS` environment variable.
- Rotated the production `ADMIN_VECTORIZE_TOKEN` via a single generate-and-upload pipe and proved the previously published `voltique-admin` value now returns 401 on both `/api/admin/knowledge` and `/api/admin/vectorize`, with the storefront still serving 200.
- `checkout.tax_fallback` fires on every Stripe Tax degradation with zero identifiers, registered alongside two forward-looking events and a `reason` enum in both parity files, plus the two allocation functions exported for `02-04`.
- A new `WEB_VITALS` Analytics Engine binding, a bounded route-template mapper, and a rewritten `/api/analytics/vitals` route that writes exactly five fields and never returns anything but 200.
- `handlePaymentFailed` now emits one identifier-free `payment.intent_failed` event through a closed allow-list decline-reason mapper, writes nothing, and the placeholder TODO and its dead guard are gone.
- Category page now 404s through Next's boundary instead of a 200 sentinel div, both slug pages share a `Promise<{ slug: string }>` params signature, and the tax/discount allocation functions are pinned by sum-exactness tables at 1, 2, 10, and 100 lines.
- Live-site mobile Lighthouse baseline for four routes shows every one failing the PRD's target of 85 — home/category/checkout in the low-to-mid 70s, product highest at 80 — recorded as median-of-three in `docs/mobile-lighthouse-baseline.md`.
- Corrected the false MCP-checkout-boundary claim in `docs/checkout-trust-boundary.md` and marked all four ADR docs `Accepted`, with the lock recorded in a newly git-tracked `gsd-ingest-manifest.yaml`.
- Rewrote the migration, deploy-path, Node prerequisite, and Stripe webhook sections of three operator runbooks to match the guarded scripts and dispatch switch the repository actually enforces.
- Deleted the checkout.session.completed dispatch case, its comments-only handler, and its header doc bullet from the Stripe webhook route (29 lines, deletions only), then pinned the unhandled-event fall-through contract with a new 4-assertion regression test.
- Corrected `docs/README.md`'s status lines and model name to match the shipped system, then linked all 15 previously-unreachable documents across four new index groups so every file in `docs/` is reachable.
- CI's production audit gate raised to `--audit-level=high` and `docs/dependency-security.md` refreshed to close both Next-bundled exceptions with re-observed evidence — the audit reports 0 findings in production at every severity.

---
