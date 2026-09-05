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
</content>
