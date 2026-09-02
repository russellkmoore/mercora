---
phase: "3"
slug: "decision-lock-in-and-operator-runbooks"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-02"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit suite) |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run tests/unit/app/api/stripe-webhook-signature.test.ts tests/unit/app/api/stripe-webhook-payment-failed.test.ts tests/unit/app/api/stripe-webhook-subscription-route.test.ts tests/unit/app/api/stripe-webhook-subscriptions.test.ts tests/unit/app/api/stripe-webhook-refunds.test.ts tests/unit/app/api/stripe-webhook-retry.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

> Corrected during planning: the seeded quick-run path `tests/unit/app/api/webhooks` does not exist.
> The webhook tests are six flat files named `tests/unit/app/api/stripe-webhook-*.test.ts`.

### Shell caveats found while grounding these gates

Two forms were tried, failed in this repo's shell, and must not be reintroduced:

- **`diff <(...) <(...)`** — `diff` is shadowed by a shell function from the Claude shell snapshot and
  errors with `function definition file not found` in a non-interactive subshell. Use a string
  comparison instead: `test "$(grep PAT a)" = "$(grep PAT b)"`, always preceded by a count guard so two
  empty results cannot compare equal and pass vacuously.
- **`! cmd | grep -v ...`** — pipeline negation gave inconsistent results. Use an explicit count:
  `test "$(cmd | grep -vc ...)" = "0"`. `grep -vc` prints `0` and does not error when the upstream
  command produces no output, so the zero case is handled.

Also: the event-bullet pattern must keep its backtick — `^   - ` alone matches 15 lines in
`docs/DEPLOYMENT_SETUP.md`, while `^   - \`` matches only the event list.

---

## Sampling Rate

- **After every task commit:** the grep gates below for docs tasks; the six-file vitest command for the route task
- **After every plan wave:** `npm run lint && npm run typecheck && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | ADR-01, ADR-02 | T-03-02 | Doc claim is grep-checked against the code before it is written | grep | `test "$(grep -c 'remains outside' docs/checkout-trust-boundary.md)" = "0"` | ✅ | ⬜ pending |
| 3-01-01 | 01 | 1 | ADR-02 | T-03-01 | Lock record survives into git | shell | `test -n "$(git ls-files -- gsd-ingest-manifest.yaml)"` | ✅ | ⬜ pending |
| 3-01-02 | 01 | 1 | ADR-02 | T-03-01 | Marker is dated and machine-checkable | grep | `test "$(grep -lE '^\*\*Status:\*\* Accepted \(20[0-9]{2}-[0-9]{2}-[0-9]{2}\)$' docs/checkout-trust-boundary.md docs/webhooks-refunds-inventory.md docs/database-migrations.md docs/subscriptions.md \| wc -l \| tr -d ' ')" = "4"` | ✅ | ⬜ pending |
| 3-01-02 | 01 | 1 | ADR-02 | T-03-01 | Manifest still parses and no non-ADR entry was locked | node | `node -e "…yaml parse: 26 entries, 4 ADR locked, 0 non-ADR locked…"` (full command in 03-01-PLAN.md) | ✅ | ⬜ pending |
| 3-02-01 | 02 | 1 | RUN-01 | T-03-04 | No unguarded production migration instruction remains | grep | `test "$(grep -n 'wrangler d1 migrations apply' docs/DEPLOYMENT_SETUP.md \| grep -vc -- '--local')" = "0"` | ✅ | ⬜ pending |
| 3-02-01 | 02 | 1 | RUN-02 | T-03-05 | Every documented event has a handler | grep | `test "$(grep -c '^   - \`' docs/DEPLOYMENT_SETUP.md)" = "16"` | ✅ | ⬜ pending |
| 3-02-02 | 02 | 1 | RUN-01 | T-03-04 | Same gate applied to the second runbook | grep | `test "$(grep -n 'wrangler d1 migrations apply' docs/CLAUDE.md \| grep -vc -- '--local')" = "0"` | ✅ | ⬜ pending |
| 3-02-03 | 02 | 1 | RUN-02 | T-03-05 | The two operator lists cannot drift | shell | `test "$(grep -c '^   - \`' docs/STRIPE_INTEGRATION.md)" = "16" && test "$(grep '^   - \`' docs/DEPLOYMENT_SETUP.md)" = "$(grep '^   - \`' docs/STRIPE_INTEGRATION.md)"` | ✅ | ⬜ pending |
| 3-03-01 | 03 | 1 | RUN-02 | T-03-07, T-03-08 | Removal is behaviour-neutral; signature path untouched | unit | `npx vitest run tests/unit/app/api/stripe-webhook-signature.test.ts tests/unit/app/api/stripe-webhook-payment-failed.test.ts tests/unit/app/api/stripe-webhook-subscription-route.test.ts tests/unit/app/api/stripe-webhook-subscriptions.test.ts tests/unit/app/api/stripe-webhook-refunds.test.ts tests/unit/app/api/stripe-webhook-retry.test.ts` | ✅ | ⬜ pending |
| 3-03-02 | 03 | 1 | RUN-02 | T-03-09 | Unhandled event still claimed, ignored, 200, no finalizer | unit | `npx vitest run tests/unit/app/api/stripe-webhook-unhandled-events.test.ts` | ⬜ created by 3-03-02 | ⬜ pending |
| 3-03-02 | 03 | 1 | RUN-02 | — | No orphaned import or type after the deletion | build | `npm run lint && npm run typecheck && npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None. Existing test infrastructure covers every requirement in this phase. The one new test file
(`tests/unit/app/api/stripe-webhook-unhandled-events.test.ts`) is created by task 3-03-02 itself and
copies its scaffolding from the existing `tests/unit/app/api/stripe-webhook-signature.test.ts`.

The three documentation requirements (ADR-01, ADR-02, RUN-01) have no vitest coverage by design —
prose correctness is verified structurally with the grep and node gates listed above, not with a test
runner. Every one of those gates was confirmed red against the current tree during planning, so none of
them is vacuous.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Re-running `/gsd-ingest-docs` classifies all four ADRs as locked with no lock-status note and no W1 warning | ADR-02 | The ingest classifier is a subagent; merge mode can write to `.planning/`, so it is run by Russell on a throwaway branch | Create a throwaway branch, run `/gsd-ingest-docs --manifest gsd-ingest-manifest.yaml --mode merge`, confirm the four ADRs show `locked: true` and no I17/W1 entries, then discard the branch |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 7 tasks across the 3 plans carry at least one runnable `<automated>` command with a stated `<fails_when>`
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — no MISSING sentinels; no Wave 0 needed
- [x] No watch-mode flags — every vitest invocation uses `run`
- [x] Feedback latency < 90s — grep gates are instant; the six-file webhook run is well under a minute
- [ ] `nyquist_compliant: true` set in frontmatter — set by `/gsd-validate-phase` after execution

**Approval:** pending
