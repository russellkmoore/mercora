# Docs changelog

**Status:** Living log of documentation moves, merges, and retirements.

## 2026-09-05 — Phase 8.2 documentation overhaul

- Retired `api-architecture.md` — stale endpoint inventory (~9 documented vs 88 real routes) and a
  "security layers" diagram duplicated with `architecture.md`'s own closing diagram.
- Retired `docs/admin-dashboard-specification.md` — design doc for modules that were never built;
  superseded by `docs/admin-authentication.md` for admin capability and the project's live planning
  record for current admin scope.
- Retired `docs/mobile-improvements-actionable.md` — its recommendations are already implemented in
  the code; current mobile status is owned by `docs/mobile-lighthouse-baseline.md`.
- Retired `docs/mobile-testing-automation.md` — its own historical banner says the Lighthouse
  CI/Playwright suites it describes are not implemented, confirmed absent from `package.json`; the
  one-time measurement it proposed automating is `docs/mobile-lighthouse-baseline.md`.
- Retired `docs/mobile-ux-assessment.md` — its own historical banner says it is superseded by
  `docs/mobile-lighthouse-baseline.md`.
- Retired `docs/ROADMAP.md` — framed around a "Phase 1/2/3" milestone numbering that predates and
  contradicts the live `.planning/PROJECT.md`/`.planning/STATE.md`, which fully supersedes it; the
  planning tree is the roadmap now.
- Retired `docs/o07-gift-cards-plan.md` — a completion/handoff record for a feature that has
  shipped; its living facts (feature flags, rollback order) already live in
  `docs/runtime-configuration.md` and `docs/checkout-trust-boundary.md`.
- Retired `docs/migration-reservations.md` — its own ledger claimed the next free number was
  `0023`, but migration `0023` was already applied for unrelated work, contradicting the ledger's
  own promise; the multi-branch coordination need it served has concluded.
- Retired `docs/STRIPE_INTEGRATION.md` — its unique content (the account-creation and API-key
  steps, tax enablement, the test-card table, and the test tax addresses) moved into
  `docs/DEPLOYMENT_SETUP.md`; its webhook event list is owned by
  `docs/webhooks-refunds-inventory.md` and its payment/finalization behavior by
  `docs/checkout-trust-boundary.md`.
- Whole-set claim check (plan 08.2-06): fixed a stale example variable name in
  `docs/admin-authentication.md`'s "Valid API Token" test (`$ADMIN_TOKEN` corrected to
  `$ADMIN_VECTORIZE_TOKEN`, matching the variable documented earlier in the same file) and
  replaced a real-looking example Shopify access token in `docs/shopify-migration.md`
  (`private-read-token`) with the file's own angle-bracket placeholder convention. Confirmed
  `docs/theming.md`'s five quoted validator messages are still byte-identical to
  `scripts/build-themes.mjs`, every `npm run` command named anywhere in the surviving set exists
  in `package.json`, and every backticked relative path resolves except the ones this file
  intentionally names as retired.
</content>
- 2026-09-05 (08.2 verification gap closure): added `**Status:**` lines to `ai-pipeline.md`, `content-publishing.md`, `customer-communications.md`, `runtime-configuration.md`; added the CI `check:migrations` step to the gate lists in `AGENTS.md` and `CONTRIBUTING.md`.
- 2026-09-05 (08.2 code review fixes): `scripts/docs-lint.mjs` now binds `locked: true` to each locked ADR's own manifest entry (a moved marker used to pass), requires a `**Status:**` line in every top-level doc header, and resolves nested `docs/**` paths; `docs/CLAUDE.md` no longer calls the token scanner "not CI-wired".
