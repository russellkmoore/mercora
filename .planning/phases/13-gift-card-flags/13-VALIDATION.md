---
phase: "13"
slug: "gift-card-flags"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-10"
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (unit, node environment) + `@cloudflare/vitest-pool-workers` (integration, real D1) |
| **Config file** | `vitest.config.mts` (unit, `tests/unit/**/*.test.ts`) · `vitest.workers.config.mts` (integration, `tests/integration/**/*.test.ts`) |
| **Quick run command** | `mise exec -- npx vitest run <file>` |
| **Full suite command** | `mise exec -- npm test && mise exec -- npm run test:workers && mise exec -- npm run test:observability-worker` |
| **Phase gate command** | the full AGENTS.md list, in plan 13-09 task 1 — includes `npm audit`, `npm run cf-typecheck` (with `.dev.vars` moved aside under an `EXIT` trap) and `npm run check:migrations -- --base origin/main` |
| **Estimated runtime** | ~45s unit, ~90s integration, ~15s observability worker |

Notes that matter for this phase:

- The unit suite sets no `STORE_FEATURE_*` environment variables, so `getStoreConfig()` resolves
  both gift-card flags to their `false` defaults under Vitest. Any new production read of
  `getStoreConfig()` on a hot path must therefore be injectable or mocked, or it silently flips
  existing gift-card tests. Plan 13-04 handles this by adding `giftCardSalesEnabled` to
  `PricingDependencies` and defaulting it to `true` in the shared `dependencies()` test helper.
- `tests/unit/app/product-slug-page.test.ts` mocks `@/lib/store-config` with a `commerce.features`
  object that carries only the subscription booleans. Plan 13-03 extends that mock; without the
  extension the gift-card flags read as `undefined` in that suite.
- `tests/unit/app/api/payment-intent-authority.test.ts` replaces the whole
  `@/lib/services/checkout-pricing` module. That is why plan 13-04 puts the new error class in
  `lib/gift-cards/checkout.ts`, which that suite leaves real.
- **`grep` on this machine resolves to ripgrep.** Any acceptance pattern containing `(` must use
  `grep -F`, or ripgrep rejects it as an unclosed group (`it(`, `SUM(`) or silently reads it as a
  capture group and matches the wrong text (`SUM(entry.amount_delta_minor)`). Every affected
  criterion in this phase's plans uses `-F`.
- **`grep -c` counts matching lines, not occurrences.** An imported-and-called symbol scores `2`,
  not `1`. Criteria in plans 13-07 and 13-08 check the import line and the call site separately
  rather than asserting a bare count of `1`.

---

## Sampling Rate

- **After every task commit:** the scoped Vitest file(s) named in that task's `<verify><automated>`
- **After every plan wave:** `mise exec -- npm test` then `mise exec -- npm run test:workers`
- **Before `/gsd-verify-work`:** the whole AGENTS.md CI list (plan 13-09 task 1)
- **Max feedback latency:** 60 seconds for a scoped run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | GCF-01, GCF-04 | T-13-01, T-13-02 | Tender follows honor; sell-without-honor still throws before any factory runs | unit | `mise exec -- npx vitest run tests/unit/lib/commerce/capabilities.test.ts` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | GCF-01 | T-13-03, T-13-04 | Visibility keys on catalog type, never slug or id; predicate absent from the shared model layer | unit | `mise exec -- npx vitest run tests/unit/lib/gift-cards/visibility.test.ts` | ❌ created by task | ⬜ pending |
| 13-02-01 | 02 | 2 | GCF-01, GCF-03 | T-13-05 | Gift-card filter bound to the non-admin branch only | unit | `mise exec -- npx vitest run tests/unit/app/api/products-public.test.ts tests/unit/app/category-slug-page.test.ts` | ✅ | ⬜ pending |
| 13-02-02 | 02 | 2 | GCF-01, GCF-03 | T-13-07, T-13-08 | Agent, recommendation and CMS surfaces read the same predicate | unit | `mise exec -- npx vitest run tests/unit/lib/cms/page-products.test.ts tests/unit/lib/mcp` | ✅ | ⬜ pending |
| 13-02-03 | 02 | 2 | GCF-01, GCF-03 | T-13-06 | No filter inside `listProducts`/`searchProducts`/`getProductsByCategory` | source-contract | `mise exec -- npx vitest run tests/unit/lib/gift-cards/listing-call-sites-source.test.ts` | ❌ created by task | ⬜ pending |
| 13-03-01 | 03 | 2 | GCF-01, GCF-03 | T-13-09, T-13-11 | Server decides render vs 404; branch keys on product type | static | `npm run typecheck && npm run scan:tokens && npm run lint` | ✅ | ⬜ pending |
| 13-03-02 | 03 | 2 | GCF-01, GCF-03 | T-13-09, T-13-10 | Unavailable branch precedes the inventory branch, so no add-to-cart path survives | unit + source-contract | `mise exec -- npx vitest run tests/unit/app/product-slug-page.test.ts tests/unit/components/gift-card-unavailable-source.test.ts` | ✅ / ❌ created by task | ⬜ pending |
| 13-04-01 | 04 | 2 | GCF-01 | T-13-12, T-13-13, T-13-16 | Server refuses a gift-card line while selling is off, from a server-side flag read | unit | `mise exec -- npx vitest run tests/unit/lib/services/checkout-pricing.test.ts` | ✅ | ⬜ pending |
| 13-04-02 | 04 | 2 | GCF-01 | T-13-14 | Sales-disabled and tender-unavailable are distinguishable by code | unit | `mise exec -- npx vitest run tests/unit/app/api/payment-intent-authority.test.ts` | ✅ | ⬜ pending |
| 13-04-03 | 04 | 2 | GCF-03 | T-13-15 | Apply panel follows honor, not sell, so redemption survives a sales rollback | source-contract | `mise exec -- npx vitest run tests/unit/components/gift-card-checkout-gating-source.test.ts tests/unit/components/checkout-digital-only-source.test.ts` | ❌ created by task | ⬜ pending |
| 13-05-01 | 05 | 2 | GCF-02 | T-13-19 | One batched round trip reusing the existing balance SQL; disabled cards excluded | integration | `mise exec -- npm run test:workers -- tests/integration/lib/gift-cards/honor-guard.test.ts` | ❌ created by task | ⬜ pending |
| 13-05-02 | 05 | 2 | GCF-02 | T-13-17, T-13-18, T-13-21 | Missing, stale, malformed and unreadable all resolve to "balances may exist" | unit + integration | `mise exec -- npx vitest run tests/unit/lib/gift-cards/honor-guard.test.ts` | ❌ created by task | ⬜ pending |
| 13-05-03 | 05 | 2 | GCF-02 | T-13-20 | Critical event registered at severity critical on both sides of the telemetry boundary | unit | `mise exec -- npx vitest run tests/unit/workers/observability-tail-core.test.ts && mise exec -- npm run test:observability-worker` | ✅ | ⬜ pending |
| 13-06-01 | 06 | 3 | GCF-05, GCF-02 | T-13-23, T-13-24, T-13-25 | Rollback recipe states the liability does not vanish; locked ADR untouched; no secret-shaped example | static | `npm run docs:lint` | ✅ | ⬜ pending |
| 13-06-02 | 06 | 3 | GCF-05 | T-13-22 | Four-state table checked against the capability code and the honor-guard constants | unit | `mise exec -- npx vitest run tests/unit/docs/gift-card-flag-docs.test.ts` | ❌ created by task | ⬜ pending |
| 13-07-01 | 07 | 3 | GCF-02 | T-13-28, T-13-29, T-13-30 | Every tick measures, stores and pages; a guard failure cannot stop the recovery drains | unit | `mise exec -- npx vitest run tests/unit/worker-cron-routing.test.ts` | ✅ | ⬜ pending |
| 13-07-02 | 07 | 3 | GCF-02, GCF-04 | T-13-26, T-13-27 | Honor override applies only while selling is off, so the invalid configuration still throws | unit | `mise exec -- npx vitest run tests/unit/lib/commerce/runtime-honor-override.test.ts` | ❌ created by task | ⬜ pending |
| 13-08-01 | 08 | 3 | GCF-02, GCF-03 | T-13-34, T-13-35 | Banner names an aggregate and a count, never card material; reachable exactly when the guard is active | unit | `mise exec -- npx vitest run tests/unit/app/admin-gift-card-gating.test.ts` | ❌ created by task | ⬜ pending |
| 13-08-02 | 08 | 3 | GCF-03 | T-13-31, T-13-32 | Authentication precedes existence; the public balance route keeps one generic invalid response | unit | `mise exec -- npx vitest run tests/unit/app/api/gift-card-presentation-routes.test.ts` | ✅ | ⬜ pending |
| 13-08-03 | 08 | 3 | GCF-02 | T-13-33, T-13-36 | No file under `app/` can write the honor-guard record | source-contract | `mise exec -- npx vitest run tests/unit/lib/gift-cards/honor-guard-writer-source.test.ts` | ❌ created by task | ⬜ pending |
| 13-09-01 | 09 | 4 | GCF-01..05 | T-13-38, T-13-40 | Whole CI list green including audit, cf-typecheck and the migration check; generated Cloudflare types do not drift; no unplanned migration | suite | `npm audit --omit=dev --audit-level=high && npm run build:themes:check && npm run scan:tokens && npm run lint && npm run typecheck && ( trap 'mv -f /tmp/dev.vars.hold .dev.vars 2>/dev/null' EXIT; mv -f .dev.vars /tmp/dev.vars.hold; npm run cf-typecheck ) && mise exec -- npm test && mise exec -- npm run test:workers && mise exec -- npm run test:observability-worker && npm run docs:lint && npm run build && npm run check:migrations -- --base origin/main` | ✅ | ⬜ pending |
| 13-09-02 | 09 | 4 | GCF-01..05 | T-13-37, T-13-40 | Deploy by push only; no flag value changed | cli | `mise exec -- npx wrangler deployments list` | ✅ | ⬜ pending |
| 13-09-03 | 09 | 4 | GCF-01..05 | T-13-39, T-13-41 | Production unchanged; guard row present and zero; alarm quiet | cli | `curl -s -o /dev/null -w '%{http_code}\n' https://voltique.russellkmoore.me/product/gift-card && mise exec -- npx wrangler d1 execute mercora-db --remote --json --command "SELECT key, data_type FROM admin_settings WHERE key = 'gift_cards.honor_guard'"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Both Vitest projects, the D1 migration
harness (`tests/integration/helpers/d1.ts`) and the observability-worker suite already exist and
run in CI.

Eight test files do not exist yet. Each is created by the task whose behaviour it pins, in the same
commit as that behaviour — no separate scaffolding wave is needed:

- [ ] `tests/unit/lib/gift-cards/visibility.test.ts` (13-01-02)
- [ ] `tests/unit/lib/gift-cards/listing-call-sites-source.test.ts` (13-02-03)
- [ ] `tests/unit/components/gift-card-unavailable-source.test.ts` (13-03-02)
- [ ] `tests/unit/components/gift-card-checkout-gating-source.test.ts` (13-04-03)
- [ ] `tests/unit/lib/gift-cards/honor-guard.test.ts` and `tests/integration/lib/gift-cards/honor-guard.test.ts` (13-05-01, 13-05-02)
- [ ] `tests/unit/docs/gift-card-flag-docs.test.ts` (13-06-02)
- [ ] `tests/unit/lib/commerce/runtime-honor-override.test.ts` (13-07-02)
- [ ] `tests/unit/app/admin-gift-card-gating.test.ts` and `tests/unit/lib/gift-cards/honor-guard-writer-source.test.ts` (13-08-01, 13-08-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| §9 of `docs/DEPLOYMENT_SETUP.md` is usable under pressure | GCF-05 | Whether prose is clear to an operator mid-rollback is a judgement no test makes | Read §9 end to end as if rolling back gift-card sales on a Sunday evening. Without opening code, can you tell which flag to flip, what happens to cards already sold, and how you would know if something is stranded? |
| Both-off state looks right in a browser | GCF-03 | Rendered absence across sidebar, page and storefront is a visual whole | Set both flags to `"false"` in local `.dev.vars`, run `npm run dev`: no Gift cards entry in the admin sidebar, `/admin/gift-cards` returns the ordinary 404, no gift card on the home page. Restore the flags. |
| Cloudflare build finished green | GCF-01..05 | The dashboard build log is not scriptable from here | Open the build log for the deployment and confirm it completed rather than falling back to a previous version |
| The alarm is quiet in production | GCF-02 | Confirming an event did *not* fire needs a window of observation | Watch the Worker tail or the observability tail worker's alert mailbox across one five-minute cron window and confirm no `gift_card.honor_disabled_with_balances` alert arrived |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify — 23 of 23, each paired with a `<fails_when>`
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — none are MISSING; every new test file is created by its own task
- [x] No watch-mode flags — every command is `vitest run` or a one-shot npm script
- [x] Feedback latency < 60s for scoped runs
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
