---
phase: "2"
slug: "observability-and-regression-guards"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-02"
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Unauthenticated internet → `/api/analytics/vitals` | Any browser or bot can POST beacons | Metric name, value, rating, pathname, isMobile |
| Vitals route → Workers Analytics Engine | Server-side write of five fields | Low-cardinality metrics |
| Stripe → `/api/webhooks/stripe` (`payment_intent.payment_failed`) | Signed webhook, attacker-influenceable decline codes | Decline code mapped to a closed enum |
| Checkout pricing → telemetry | Tax fallback event | Three enum fields, no identifiers |
| Executor shell → live production site | Lighthouse measurement runs | 12 page loads, one sitemap fetch |
| Build → `cloudflare-env.d.ts` | Type regeneration | Binding names only (no `.env.local` names) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Info Disclosure | `checkout.tax_fallback` payload | high | mitigate | Three allow-listed fields; sanitizer drops all else | closed |
| T-02-02 | Tampering | Enum parity telemetry ↔ tail worker | medium | mitigate | Byte-identical sets, parity test | closed |
| T-02-03 | DoS | Fallback event volume | low | accept | 2 KB envelope cap; sampleRate 1 intentional | closed (accepted) |
| T-02-04 / 09 | DoS | Sink-unavailable event flood | medium | mitigate | `analytics.vitals_sink_unavailable` sampleRate 0.01 | closed |
| T-02-05 | Tampering | Telemetry failure altering price | high | mitigate | `recordTelemetry` is void and fail-open; call does not gate pricing | closed |
| T-02-06 | Info Disclosure | Vitals payload PII | high | mitigate | Exactly five fields written; sentinel test proves userAgent/timestamp never serialized | closed |
| T-02-07 | DoS | Route-template cardinality | high | mitigate | Fixed template set, `/other` fallback, every template ≤ 96 ASCII bytes | closed |
| T-02-08 | DoS | Metric/rating cardinality | medium | mitigate | Closed allow-lists | closed |
| T-02-10 | Tampering | Oversized/control-char input | medium | mitigate | Length and control-char rejection; `Number.isFinite` on value; 4 KB body cap (WR-01) | closed |
| T-02-11 | DoS | Slow AE write blocking response | medium | mitigate | Write not awaited, own try/catch | closed |
| T-02-12 | Info Disclosure | Secret names in regenerated types | high | mitigate | 2-line diff adds only `WEB_VITALS` | closed |
| T-02-13 | Info Disclosure | Response oracle | low | accept | Uniform `{status:"ok"}` on every branch | closed (accepted) |
| T-02-14 | Tampering | Failed-payment handler state change | high | mitigate | Body is telemetry only; test asserts zero calls on finalizer/refund handlers | closed |
| T-02-15 | Info Disclosure | Raw Stripe strings in telemetry | medium | mitigate | `mapDeclineReason` returns one of five values (WR-02 refined) | closed |
| T-02-16 | Info Disclosure | Identifiers in `payment.intent_failed` | high | mitigate | Only provider/outcome/reason; test asserts envelope excludes ids | closed |
| T-02-17 | DoS | Webhook replay volume | low | accept | Claim/complete dedup short-circuits retries | closed (accepted) |
| T-02-18 | Repudiation | Failure not recorded | medium | mitigate | Event emitted unconditionally, sampleRate 1 | closed |
| T-02-19 / 20 | Info Disclosure / Spoofing | Slug reflection, fake 200 | medium | mitigate | Both pages `notFound()`; no reflecting branch remains | closed |
| T-02-21 | Tampering | Discount over-allocation | high | mitigate | CR-01 fix: per-line caps, ascending redistribution; invariants tested | closed |
| T-02-22 | DoS | Slug passthrough | low | accept | By design; documented | closed (accepted) |
| T-02-23 | DoS | Lighthouse load on production | medium | mitigate | 12 loads, one sitemap fetch, four HEAD probes | closed |
| T-02-24 | Info Disclosure | Raw reports committed | medium | mitigate | No JSON committed | closed |
| T-02-25 | Repudiation | Unverifiable median | medium | mitigate | All three raw scores published per route | closed |
| T-02-26 | Spoofing | Measuring a redirect | medium | mitigate | All four URLs verified 200 without redirect first | closed |
| T-02-27 | Tampering | Unpinned tool | low | mitigate | Lighthouse 13.4.1 pinned in the doc | closed |
| T-02-SC (×5) | Tampering | Package installs | low | accept | No dependency added in any plan | closed (accepted) |

*Status: open · closed · open — below high threshold (non-blocking)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-03, T-02-13, T-02-17, T-02-22 | Each has an explicit rationale in the plan threat model; underlying facts (byte cap, uniform response, dedup, passthrough design) verified in code by the auditor | Plans 02-01..05 (planner), passed plan-checker | 2026-09-02 |
| AR-02-02 | T-02-SC | No dependency changes this phase | Plans 02-01..05 (planner) | 2026-09-02 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-02 | 32 | 32 | 0 | gsd-security-auditor (verdict: SECURED; evidence re-derived from code and tests) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-02 (automated audit)
