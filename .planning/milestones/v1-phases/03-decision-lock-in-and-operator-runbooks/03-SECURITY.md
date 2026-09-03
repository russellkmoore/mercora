---
phase: "3"
slug: "decision-lock-in-and-operator-runbooks"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-02"
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Repository docs → future reader (human or AI planner) | A binding-decision document marked `Accepted` is trusted input to future planning | Decision statements, code identifiers, dates |
| Repository config → GSD ingest pipeline | `gsd-ingest-manifest.yaml` routes documents into precedence buckets and records lock intent | Doc paths, types, `locked` flags |
| Operator → production D1 | A runbook command an operator copies and runs is a direct path into the production database | Migration apply commands and the gate flag |
| Operator → Stripe dashboard config | The documented event list decides which events Stripe delivers and therefore which money movements get reconciled | Sixteen event names |
| Stripe → `POST /api/webhooks/stripe` | Signature-verified provider payload crosses into order and refund state | Event type and object; signature |
| Webhook route → D1 processed-events ledger | Claim and complete calls are the idempotency boundary for every delivered event | Event id, claim token, outcome |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Repudiation | four ADR docs + `gsd-ingest-manifest.yaml` | low | mitigate | Each `**Status:** Accepted` marker carries the doc's first-commit date (2026-08-03/05/06/14); the manifest comment carries the 2026-09-02 lock date; the ADR-01 correction sentence keeps the supersession on the record. Verified: 4 dated markers match the tolerant regex; manifest contains `2026-09-02` | closed |
| T-03-02 | Tampering | `docs/checkout-trust-boundary.md` boundary statement | low | mitigate | Replacement text names `lib/services/checkout-pricing.ts`, `lib/services/order-finalization.ts`, `create_payment_intent`, `place_order`; executor grep-verified each before writing. Verified: `lib/mcp/checkout.ts` imports from checkout-pricing, `lib/mcp/tools/order.ts` imports from order-finalization; code review and verifier independently confirmed | closed |
| T-03-03 | Information Disclosure | four ADR docs + manifest | low | mitigate | No credential value introduced. Verified: repo-wide docs scan for `voltique-admin`, `sk_live_`, 20+-char `sk_test_`/`whsec_` values returns only prefix placeholders (`sk_live_your_live_secret_key`) | closed |
| T-03-04 | Denial of Service | `docs/CLAUDE.md` and `docs/DEPLOYMENT_SETUP.md` migration blocks | medium | mitigate | Bare remote `wrangler d1 migrations apply mercora-db` removed from both runbooks; production apply shown only as `MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1 npm run db:migrate:apply:production`, which `scripts/lib/d1-migrate-plan.mjs` gates on the env var plus `--confirm-production`. Verified: 0 unguarded remote applies in either doc; gate flag present in both | closed |
| T-03-05 | Tampering | `docs/DEPLOYMENT_SETUP.md` and `docs/STRIPE_INTEGRATION.md` event lists | medium | mitigate | Both lists carry the same 16 bullets, string-identical; every documented event has a `case` in the route's dispatch switch; the only route case not listed (`charge.refund.updated`) is the legacy-compat event the docs describe in prose. Verified by count and string-comparison gates and by the verifier | closed |
| T-03-06 | Information Disclosure | three runbooks | low | mitigate | No credential value introduced; `MERCORA_ALLOW_PRODUCTION_MIGRATIONS` is a gate flag, not a secret. Same scan as T-03-03 | closed |
| T-03-07 | Tampering | `app/api/webhooks/stripe/route.ts` dispatch switch | low | accept | Removed case set `outcome = 'ignored'`, identical to `default`; handler body was comments only. Diff is 29 deletions / 0 insertions; six pre-existing webhook suites pass unchanged; new test pins the fall-through contract | closed (accepted) |
| T-03-08 | Spoofing | signature verification path | low | accept | Edit confined to the switch and one unreferenced function; `constructWebhookEvent`, raw-body handling, and oversize-body rejection are upstream and untouched; `stripe-webhook-signature.test.ts` runs unchanged and green | closed (accepted) |
| T-03-09 | Repudiation | processed-events ledger | low | mitigate | Claim and complete calls sit outside the switch, so the fall-through event still gets a ledger entry. Verified: `stripe-webhook-unhandled-events.test.ts` asserts `claimWebhookEvent` is called (4 references) and the outcome is `ignored` | closed |
| T-03-SC (×3) | Tampering | npm / pip / cargo installs | low | accept | No plan installs a package; `package.json` and `package-lock.json` unchanged in this phase | closed (accepted) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-07 | Dead-branch removal is behavior-neutral: removed case and `default` both set `ignored`; regression test pins the contract | Planner (per CONTEXT.md RUN-02 Q2, accepted by Russell in discuss) | 2026-09-02 |
| AR-03-02 | T-03-08 | Signature verification path untouched by the edit; existing signature suite is the gate | Planner | 2026-09-02 |
| AR-03-03 | T-03-SC | No packages installed in any plan | Planner | 2026-09-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-02 | 10 | 10 | 0 | Orchestrator (secure-phase, State B, L1 short-circuit: no threat at or above `high`, register authored at plan time, ASVS 1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-02
